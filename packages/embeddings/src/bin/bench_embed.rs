//! Benchmark binary for embedding pipeline performance analysis.
//!
//! Measures per-text embedding time at different token lengths (synthetic texts)
//! and with real texts from the test fixtures DB. Also tests batch size effects.
//!
//! Run with: cargo run --release --bin bench-embed

use std::path::Path;
use std::time::Instant;

use anyhow::Result;
use int4_runner::EmbeddingModel;
use rusqlite::Connection;

const ONNX_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/onnx");
const FIXTURES_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures");

fn load_model() -> Result<EmbeddingModel> {
    let onnx_path = Path::new(ONNX_DIR).join("weights/model.int4.onnx");
    let tokenizer_path = Path::new(ONNX_DIR).join("tokenizer/tokenizer.json");

    if !onnx_path.exists() {
        anyhow::bail!("ONNX model not found at {}", onnx_path.display());
    }
    if !tokenizer_path.exists() {
        anyhow::bail!("Tokenizer not found at {}", tokenizer_path.display());
    }

    let tokenizer_json = std::fs::read(&tokenizer_path)?;
    let model = EmbeddingModel::from_file(&onnx_path, &tokenizer_json)
        .map_err(|e| anyhow::anyhow!("Failed to load model: {e}"))?;
    Ok(model)
}

/// Generate a synthetic text that tokenizes to approximately `target_tokens` tokens.
/// Uses simple repeated words — actual token count is reported from the model.
fn synthetic_text(target_tokens: usize) -> String {
    // Most common English words are single tokens. Repeating varied words
    // avoids tokenizer merging artifacts.
    let words = [
        "the", "court", "shall", "determine", "whether", "evidence",
        "presented", "during", "trial", "supports", "finding", "that",
        "defendant", "acted", "with", "reasonable", "care", "under",
        "circumstances", "described", "within", "applicable", "statute",
    ];
    let mut parts = Vec::with_capacity(target_tokens);
    for i in 0..target_tokens {
        parts.push(words[i % words.len()]);
    }
    parts.join(" ")
}

/// Load real texts from test-virginia.db using the same pipeline the main binary uses.
fn load_real_texts() -> Result<Vec<(String, String)>> {
    let db_path = Path::new(FIXTURES_DIR).join("test-virginia.db");
    if !db_path.exists() {
        anyhow::bail!(
            "test-virginia.db not found at {}. Run `cargo run --bin generate-fixtures` first.",
            db_path.display()
        );
    }

    let conn = Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut texts: Vec<(String, String)> = Vec::new();

    // Courts — short texts (~10-30 tokens)
    {
        let mut stmt = conn.prepare("SELECT name, locality, type, district FROM courts")?;
        let rows = stmt.query_map([], |row| {
            let name: String = row.get(0)?;
            let locality: String = row.get(1)?;
            let court_type: String = row.get(2)?;
            let district: String = row.get(3)?;
            Ok(format!(
                "{name} — {court_type} court in {locality}, {district} district"
            ))
        })?;
        for row in rows {
            texts.push(("court".into(), row?));
        }
    }

    // Popular names — short-to-medium texts
    {
        let mut stmt = conn.prepare("SELECT name, body FROM popular_names")?;
        let rows = stmt.query_map([], |row| {
            let name: String = row.get(0)?;
            let body: String = row.get(1)?;
            Ok(format!("{name}: {body}"))
        })?;
        for row in rows {
            texts.push(("popular_name".into(), row?));
        }
    }

    // Code sections — medium texts
    {
        let mut stmt = conn.prepare("SELECT section, title, body FROM virginia_code")?;
        let rows = stmt.query_map([], |row| {
            let section: String = row.get(0)?;
            let title: String = row.get(1)?;
            let body: String = row.get(2)?;
            Ok(format!("§ {section} — {title}\n{body}"))
        })?;
        for row in rows {
            texts.push(("code_section".into(), row?));
        }
    }

    // Documents — longer texts
    {
        let mut stmt = conn.prepare("SELECT title, content FROM documents")?;
        let rows = stmt.query_map([], |row| {
            let title: String = row.get(0)?;
            let content: String = row.get(1)?;
            Ok(format!("{title}\n{content}"))
        })?;
        for row in rows {
            texts.push(("document".into(), row?));
        }
    }

    Ok(texts)
}

struct BenchResult {
    label: String,
    token_count: u32,
    time_ms: f64,
}

fn bench_single(model: &EmbeddingModel, label: &str, text: &str) -> Result<BenchResult> {
    let start = Instant::now();
    let embedding = model
        .embed(text)
        .map_err(|e| anyhow::anyhow!("Embed failed: {e}"))?;
    let elapsed = start.elapsed();

    Ok(BenchResult {
        label: label.to_string(),
        token_count: embedding.token_count,
        time_ms: elapsed.as_secs_f64() * 1000.0,
    })
}

fn bench_batch(model: &EmbeddingModel, texts: &[&str], batch_size_label: usize) -> Result<f64> {
    let start = Instant::now();
    let _embeddings = model
        .embed_batch(texts)
        .map_err(|e| anyhow::anyhow!("Batch embed failed: {e}"))?;
    let elapsed = start.elapsed();
    let total_ms = elapsed.as_secs_f64() * 1000.0;

    println!(
        "  batch_size={:<4} texts={:<4} total={:.1}ms  avg={:.1}ms/text",
        batch_size_label,
        texts.len(),
        total_ms,
        total_ms / texts.len() as f64,
    );

    Ok(total_ms)
}

fn main() -> Result<()> {
    println!("=== Embedding Pipeline Benchmark ===\n");

    // ── Load model ──────────────────────────────────────────────────────
    println!("Loading model...");
    let load_start = Instant::now();
    let model = load_model()?;
    println!(
        "Model loaded in {:.2}s\n",
        load_start.elapsed().as_secs_f64()
    );

    // ── Warmup ──────────────────────────────────────────────────────────
    println!("Warming up (2 embeddings)...");
    let _ = model.embed("warmup text one");
    let _ = model.embed("warmup text two for stability");
    println!();

    // ── Benchmark 1: Synthetic texts at specific token lengths ─────────
    println!("=== Benchmark 1: Synthetic texts by target token length ===\n");
    let target_lengths = [50, 100, 200, 400, 512];

    let mut results: Vec<BenchResult> = Vec::new();
    for &target in &target_lengths {
        let text = synthetic_text(target);
        let r = bench_single(&model, &format!("synthetic-{target}"), &text)?;
        results.push(r);
    }

    println!(
        "  {:<20} {:>8} {:>10} {:>12}",
        "Label", "Tokens", "Time(ms)", "Tok/sec"
    );
    println!("  {}", "-".repeat(54));
    for r in &results {
        let tok_per_sec = r.token_count as f64 / (r.time_ms / 1000.0);
        println!(
            "  {:<20} {:>8} {:>10.1} {:>12.0}",
            r.label, r.token_count, r.time_ms, tok_per_sec,
        );
    }

    // Compare: time ratio of shortest vs longest
    if results.len() >= 2 {
        let shortest = &results[0];
        let longest = &results[results.len() - 1];
        println!(
            "\n  Ratio ({}tok vs {}tok): {:.2}x time for {:.1}x tokens",
            shortest.token_count,
            longest.token_count,
            longest.time_ms / shortest.time_ms,
            longest.token_count as f64 / shortest.token_count as f64,
        );
    }
    println!();

    // ── Benchmark 2: Batch size effect ─────────────────────────────────
    println!("=== Benchmark 2: Batch size effect (same texts, different batch sizes) ===\n");
    let batch_texts: Vec<String> = (0..8).map(|_| synthetic_text(100)).collect();
    let batch_refs: Vec<&str> = batch_texts.iter().map(|s| s.as_str()).collect();

    // Process all 8 as one batch
    bench_batch(&model, &batch_refs, 8)?;
    // Process as 4+4
    bench_batch(&model, &batch_refs[..4], 4)?;
    bench_batch(&model, &batch_refs[4..], 4)?;
    // Process one-at-a-time
    for (i, text) in batch_refs.iter().enumerate() {
        if i == 0 {
            print!("  batch_size=1    ");
        }
        let start = Instant::now();
        let _ = model.embed(text);
        if i == 0 {
            // Only report first one to keep output clean
            let ms = start.elapsed().as_secs_f64() * 1000.0;
            println!("single embed: {:.1}ms (first of 8)", ms);
        }
    }
    println!();

    // ── Benchmark 3: Real texts from test-virginia.db ──────────────────
    println!("=== Benchmark 3: Real texts from test-virginia.db ===\n");
    match load_real_texts() {
        Ok(real_texts) => {
            let mut real_results: Vec<BenchResult> = Vec::new();
            for (source, text) in &real_texts {
                let r = bench_single(&model, source, text)?;
                real_results.push(r);
            }

            // Sort by token count for display
            real_results.sort_by_key(|r| r.token_count);

            println!(
                "  {:<20} {:>8} {:>10} {:>12}",
                "Source", "Tokens", "Time(ms)", "Tok/sec"
            );
            println!("  {}", "-".repeat(54));
            for r in &real_results {
                let tok_per_sec = r.token_count as f64 / (r.time_ms / 1000.0);
                println!(
                    "  {:<20} {:>8} {:>10.1} {:>12.0}",
                    r.label, r.token_count, r.time_ms, tok_per_sec,
                );
            }

            // Token distribution summary
            println!("\n  --- Token length distribution ---");
            let token_counts: Vec<u32> = real_results.iter().map(|r| r.token_count).collect();
            let total_tokens: u32 = token_counts.iter().sum();
            let max_tokens = *token_counts.iter().max().unwrap_or(&0);
            let min_tokens = *token_counts.iter().min().unwrap_or(&0);
            let avg_tokens = total_tokens as f64 / token_counts.len() as f64;
            let median_tokens = {
                let mut sorted = token_counts.clone();
                sorted.sort();
                sorted[sorted.len() / 2]
            };

            println!("  Texts:   {}", token_counts.len());
            println!("  Min:     {} tokens", min_tokens);
            println!("  Max:     {} tokens", max_tokens);
            println!("  Mean:    {:.0} tokens", avg_tokens);
            println!("  Median:  {} tokens", median_tokens);
            println!("  Total:   {} tokens", total_tokens);

            let wasted_padding: u32 = token_counts.iter().map(|&t| 512 - t.min(512)).sum();
            let total_padded = token_counts.len() as u32 * 512;
            println!(
                "  Padding: {} / {} tokens ({:.1}% wasted)",
                wasted_padding,
                total_padded,
                wasted_padding as f64 / total_padded as f64 * 100.0,
            );

            // Time summary
            let total_time_ms: f64 = real_results.iter().map(|r| r.time_ms).sum();
            println!(
                "\n  Total time:  {:.1}ms for {} texts ({:.1}ms/text avg)",
                total_time_ms,
                real_results.len(),
                total_time_ms / real_results.len() as f64,
            );
        }
        Err(e) => {
            println!("  Skipping real texts: {e}");
        }
    }

    println!("\n=== Benchmark complete ===");
    Ok(())
}
