use std::sync::Arc;
use axum::{
    extract::State,
    routing::post,
    Json, Router,
};
use clap::Parser;
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

#[path = "../embed/mod.rs"]
mod embed;

#[derive(Parser)]
#[command(name = "embedding-server")]
#[command(about = "OpenAI-compatible embeddings server using EmbeddingGemma300M")]
struct Args {
    /// Port to listen on
    #[arg(long, short, default_value_t = 8000)]
    port: u16,

    /// Batch size for internal processing
    #[arg(long, default_value_t = 64)]
    batch_size: usize,
}

#[derive(Deserialize)]
struct EmbeddingRequest {
    #[allow(dead_code)]
    model: String,
    input: Input,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Input {
    Single(String),
    Multiple(Vec<String>),
}

#[derive(Serialize)]
struct EmbeddingResponse {
    object: String,
    data: Vec<EmbeddingData>,
    model: String,
    usage: Usage,
}

#[derive(Serialize)]
struct EmbeddingData {
    object: String,
    embedding: Vec<f32>,
    index: usize,
}

#[derive(Serialize)]
struct Usage {
    prompt_tokens: usize,
    total_tokens: usize,
}

struct AppState {
    embedder: embed::Embedder,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    let embedder = embed::Embedder::new(args.batch_size).await?;
    let state = Arc::new(AppState { embedder });

    let app = Router::new()
        .route("/v1/embeddings", post(embeddings_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", args.port)).await?;
    println!("Embedding server listening on port {}...", args.port);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn embeddings_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<EmbeddingRequest>,
) -> Json<EmbeddingResponse> {
    let texts = match payload.input {
        Input::Single(s) => vec![s],
        Input::Multiple(v) => v,
    };

    // Apply EmbeddingGemma query prefix for search queries
    let prefixed: Vec<String> = texts.iter().map(|t| embed::format_query(t)).collect();

    // Note: We don't have a tokenizer exposed here to count tokens accurately,
    // so we'll just report 0 for now or use a heuristic. OpenAI expects usage.
    let embeddings = state.embedder.pool.embed(prefixed, None).await.expect("Failed to generate embeddings");

    let data = embeddings
        .into_iter()
        .enumerate()
        .map(|(i, embedding)| EmbeddingData {
            object: "embedding".to_string(),
            embedding,
            index: i,
        })
        .collect();

    Json(EmbeddingResponse {
        object: "list".to_string(),
        data,
        model: "onnx-community/embeddinggemma-300m-ONNX".to_string(),
        usage: Usage {
            prompt_tokens: 0,
            total_tokens: 0,
        },
    })
}
