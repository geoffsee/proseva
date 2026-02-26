mod db;
mod embed;
mod etl;
mod graph;
mod text;

use std::path::PathBuf;
use std::time::Instant;

use anyhow::Result;
use clap::Parser;
use rusqlite::Connection;

#[derive(Parser, Debug)]
#[command(name = "proseva-embeddings")]
#[command(about = "Build knowledge graph and embeddings from virginia.db")]
struct Args {
    /// Path to virginia.db (input)
    #[arg(long)]
    input: PathBuf,

    /// Path to write embeddings.sqlite.db (output)
    #[arg(long)]
    output: Option<PathBuf>,

    /// Skip embedding computation (only build graph)
    #[arg(long, default_value_t = false)]
    skip_embeddings: bool,

    /// Batch size for embedding computation
    #[arg(long, default_value_t = 64)]
    batch_size: usize,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let total_start = Instant::now();

    let input_path = &args.input;
    if !input_path.exists() {
        anyhow::bail!("Input file not found: {}", input_path.display());
    }

    let output_path = args.output.unwrap_or_else(|| {
        input_path
            .parent()
            .unwrap()
            .join("embeddings.sqlite.db")
    });

    println!("Input:  {}", input_path.display());
    println!("Output: {}", output_path.display());
    println!();

    // Open input database
    let input_conn =
        Connection::open_with_flags(input_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;

    // ========== Pass 1: Parse — Build Nodes ==========
    println!("=== Pass 1: Building nodes ===");
    let pass1_start = Instant::now();

    let code_rows = db::reader::read_virginia_code(&input_conn)?;
    println!("  virginia_code:  {} rows", code_rows.len());

    let constitution_rows = db::reader::read_constitution(&input_conn)?;
    println!("  constitution:   {} rows", constitution_rows.len());

    let authority_rows = db::reader::read_authorities(&input_conn)?;
    println!("  authorities:    {} rows", authority_rows.len());

    let court_rows = db::reader::read_courts(&input_conn)?;
    println!("  courts:         {} rows", court_rows.len());

    let popular_name_rows = db::reader::read_popular_names(&input_conn)?;
    println!("  popular_names:  {} rows", popular_name_rows.len());

    let document_rows = db::reader::read_documents(&input_conn)?;
    println!("  documents:      {} rows", document_rows.len());

    // --- ETL: clean, enrich, filter, dedup ---
    println!("\n  Running ETL pipeline...");
    let etl_start = Instant::now();
    let cleaned = etl::run_etl(
        &code_rows,
        &constitution_rows,
        &authority_rows,
        &court_rows,
        &popular_name_rows,
        &document_rows,
    )?;

    println!(
        "  ETL output: virginia_code={}, constitution={}, authorities={}, courts={}, popular_names={}, documents={}",
        cleaned.virginia_code.height(),
        cleaned.constitution.height(),
        cleaned.authorities.height(),
        cleaned.courts.height(),
        cleaned.popular_names.height(),
        cleaned.documents.height(),
    );
    println!("  ETL took:       {:.2}s", etl_start.elapsed().as_secs_f64());

    let node_result = graph::nodes::build_nodes(&cleaned)?;

    let synthetic_count = node_result.nodes.iter().filter(|n| n.synthetic).count();
    let embeddable_count = node_result.nodes.len() - synthetic_count;

    println!(
        "  Total nodes:    {} ({} embeddable, {} synthetic)",
        node_result.nodes.len(),
        embeddable_count,
        synthetic_count
    );
    println!("  Pass 1 took:    {:.2}s", pass1_start.elapsed().as_secs_f64());
    println!();

    // ========== Pass 2: Extract — Build Edges ==========
    println!("=== Pass 2: Building edges ===");
    let pass2_start = Instant::now();

    let edges = graph::edges::build_edges(
        &node_result.nodes,
        &node_result.lookup,
        &code_rows,
        &constitution_rows,
        &document_rows,
        &node_result.texts,
    );

    // Count by type
    let mut cites_count = 0;
    let mut contains_count = 0;
    let mut references_count = 0;
    for edge in &edges {
        match edge.rel_type.as_str() {
            "cites" => cites_count += 1,
            "contains" => contains_count += 1,
            "references" => references_count += 1,
            _ => {}
        }
    }

    println!("  Total edges:    {}", edges.len());
    println!("    contains:     {}", contains_count);
    println!("    cites:        {}", cites_count);
    println!("    references:   {}", references_count);
    println!("  Pass 2 took:    {:.2}s", pass2_start.elapsed().as_secs_f64());
    println!();

    // Close input connection — we're done reading
    drop(input_conn);

    // ========== Write graph to output DB ==========
    println!("=== Writing output database ===");
    let write_start = Instant::now();

    let out_conn = db::writer::create_output_db(output_path.to_str().unwrap())?;
    let nodes_written = db::writer::write_nodes(&out_conn, &node_result.nodes)?;
    let edges_written = db::writer::write_edges(&out_conn, &edges)?;
    let chunk_meta_written = db::writer::write_chunk_meta(&out_conn, &node_result.chunk_meta)?;
    println!(
        "  Wrote {} nodes, {} edges, {} chunk_meta entries",
        nodes_written, edges_written, chunk_meta_written
    );

    // ========== Pass 3: Embed — Compute Vectors ==========
    if args.skip_embeddings {
        println!("\n  Skipping embeddings (--skip-embeddings)");
    } else {
        println!("\n=== Pass 3: Computing embeddings ===");
        let pass3_start = Instant::now();

        let embedder = embed::Embedder::new(args.batch_size)?;
        let dims = embedder.model_dimensions();

        db::writer::write_model_info(&out_conn, "Octen-Embedding-0.6B-INT4-ONNX", dims)?;

        // Collect embeddable nodes and their texts
        let mut embed_node_ids = Vec::new();
        let mut embed_texts = Vec::new();

        for node in &node_result.nodes {
            if node.synthetic {
                continue;
            }
            if let Some(text) = node_result.texts.get(&node.id) {
                if !text.is_empty() {
                    embed_node_ids.push(node.id);
                    embed_texts.push(text.clone());
                }
            }
        }

        println!("  Embedding {} texts...", embed_texts.len());

        // Sort texts by length (proxy for token count) so similar-length texts
        // are grouped together — gives more predictable batch timing and better
        // progress estimates. Since the ONNX model pads every input to 512 tokens,
        // this doesn't change compute per-text, but it improves batch-level reporting.
        let mut order: Vec<usize> = (0..embed_texts.len()).collect();
        order.sort_by_key(|&i| embed_texts[i].len());

        let sorted_ids: Vec<i64> = order.iter().map(|&i| embed_node_ids[i]).collect();
        let sorted_texts: Vec<String> = order.iter().map(|&i| embed_texts[i].clone()).collect();

        // Report text-length distribution
        {
            let lengths: Vec<usize> = sorted_texts.iter().map(|t| t.len()).collect();
            let total_chars: usize = lengths.iter().sum();
            let min_len = lengths.first().copied().unwrap_or(0);
            let max_len = lengths.last().copied().unwrap_or(0);
            let median_len = lengths[lengths.len() / 2];
            let avg_len = total_chars as f64 / lengths.len() as f64;

            // Bucket distribution: <100, 100-500, 500-1000, 1000-2000, 2000+ chars
            let buckets = [
                (0, 100, "< 100"),
                (100, 500, "100-500"),
                (500, 1000, "500-1k"),
                (1000, 2000, "1k-2k"),
                (2000, usize::MAX, "2k+"),
            ];
            let mut counts = vec![0usize; buckets.len()];
            for &l in &lengths {
                for (i, &(lo, hi, _)) in buckets.iter().enumerate() {
                    if l >= lo && l < hi {
                        counts[i] += 1;
                        break;
                    }
                }
            }

            println!("  Text length distribution (chars):");
            println!(
                "    min={}, median={}, mean={:.0}, max={}",
                min_len, median_len, avg_len, max_len,
            );
            let bucket_str: Vec<String> = buckets
                .iter()
                .zip(counts.iter())
                .filter(|(_, &c)| c > 0)
                .map(|(&(_, _, label), &c)| format!("{}={}", label, c))
                .collect();
            println!("    buckets: {}", bucket_str.join(", "));
        }

        let embeds_written = embedder.embed_batched(
            &sorted_ids,
            &sorted_texts,
            |ids, vecs| db::writer::write_embeddings_batch(&out_conn, ids, vecs),
        )?;
        println!("  Wrote {} embeddings", embeds_written);
        println!(
            "  Pass 3 took:    {:.2}s",
            pass3_start.elapsed().as_secs_f64()
        );
    }

    println!(
        "  Write took:     {:.2}s",
        write_start.elapsed().as_secs_f64()
    );
    println!();

    println!(
        "=== Done in {:.2}s ===",
        total_start.elapsed().as_secs_f64()
    );
    println!("Output: {}", output_path.display());

    Ok(())
}
