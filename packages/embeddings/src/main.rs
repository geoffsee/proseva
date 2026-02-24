mod db;
mod embed;
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

    /// Fastembed model name
    #[arg(long, default_value = "BAAI/bge-small-en-v1.5")]
    model: String,

    /// Skip embedding computation (only build graph)
    #[arg(long, default_value_t = false)]
    skip_embeddings: bool,

    /// Batch size for embedding computation
    #[arg(long, default_value_t = 256)]
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
    println!("Model:  {}", args.model);
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

    let node_result = graph::nodes::build_nodes(
        &code_rows,
        &constitution_rows,
        &authority_rows,
        &court_rows,
        &popular_name_rows,
        &document_rows,
    )?;

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
    println!("  Wrote {} nodes, {} edges", nodes_written, edges_written);

    // ========== Pass 3: Embed — Compute Vectors ==========
    if args.skip_embeddings {
        println!("\n  Skipping embeddings (--skip-embeddings)");
    } else {
        println!("\n=== Pass 3: Computing embeddings ===");
        let pass3_start = Instant::now();

        let embedder = embed::Embedder::new(&args.model, args.batch_size)?;
        let dims = embedder.model_dimensions();

        db::writer::write_model_info(&out_conn, &args.model, dims)?;

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
        let embeddings = embedder.embed_all(&embed_texts)?;

        let embeds_written = db::writer::write_embeddings(&out_conn, &embed_node_ids, &embeddings)?;
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
