use std::path::Path;

use clap::Parser;
use int4_runner::{server::run_server, EmbeddingModel};

const ONNX_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/onnx");

#[derive(Parser)]
#[command(name = "embedding-server")]
#[command(about = "OpenAI-compatible INT4 ONNX embeddings server")]
struct Args {
    /// Port to listen on
    #[arg(long, short, default_value_t = 8000)]
    port: u16,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let args = Args::parse();

    let onnx_path = Path::new(ONNX_DIR).join("weights/model.int4.onnx");
    let tokenizer_path = Path::new(ONNX_DIR).join("tokenizer/tokenizer.json");

    if !onnx_path.exists() {
        eprintln!("ONNX model not found at {}", onnx_path.display());
        std::process::exit(1);
    }
    if !tokenizer_path.exists() {
        eprintln!("Tokenizer not found at {}", tokenizer_path.display());
        std::process::exit(1);
    }

    println!("Loading model...");
    let tokenizer_json = std::fs::read(&tokenizer_path)?;
    let model = EmbeddingModel::from_file(&onnx_path, &tokenizer_json)
        .map_err(|e| format!("Failed to load model: {e}"))?;

    println!("Model loaded. Starting server on port {}...", args.port);
    run_server(model, args.port).await
}
