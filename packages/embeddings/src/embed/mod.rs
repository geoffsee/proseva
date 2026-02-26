use std::path::Path;

use anyhow::Result;
use indicatif::{ProgressBar, ProgressStyle};
use int4_runner::EmbeddingModel;

const ONNX_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/onnx");

pub struct Embedder {
    model: EmbeddingModel,
    batch_size: usize,
    dims: usize,
}

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

impl Embedder {
    pub fn new(batch_size: usize) -> Result<Self> {
        let load_start = std::time::Instant::now();

        println!("  Loading INT4 ONNX model from onnx/...");
        let model = load_model()?;

        // Probe dimensions by embedding a short string
        let probe = model
            .embed("hello")
            .map_err(|e| anyhow::anyhow!("Probe embed failed: {e}"))?;
        let dims = probe.values.len();

        println!(
            "  Model loaded in {:.2}s (dims={dims})",
            load_start.elapsed().as_secs_f64()
        );

        Ok(Self {
            model,
            batch_size,
            dims,
        })
    }

    pub fn model_dimensions(&self) -> usize {
        self.dims
    }

    /// Embed texts in batches, calling the callback with (node_ids, embeddings)
    /// after each batch so results can be written incrementally.
    pub fn embed_batched<F>(
        &self,
        node_ids: &[i64],
        texts: &[String],
        mut on_batch: F,
    ) -> Result<usize>
    where
        F: FnMut(&[i64], &[Vec<f32>]) -> Result<()>,
    {
        assert_eq!(node_ids.len(), texts.len());
        if texts.is_empty() {
            return Ok(0);
        }

        let pb = ProgressBar::new(texts.len() as u64);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("[{elapsed_precise}] {bar:50} {pos}/{len} embeddings ({eta})")
                .unwrap(),
        );

        let total_batches = (texts.len() + self.batch_size - 1) / self.batch_size;
        let mut total_written = 0;

        let mut offset = 0;
        let mut batch_num = 0;
        while offset < texts.len() {
            let end = (offset + self.batch_size).min(texts.len());
            let text_chunk = &texts[offset..end];
            let id_chunk = &node_ids[offset..end];
            batch_num += 1;

            let batch_start = std::time::Instant::now();
            let embeddings = self
                .model
                .embed_batch(text_chunk)
                .map_err(|e| anyhow::anyhow!("Embedding batch failed: {e}"))?;

            let vecs: Vec<Vec<f32>> = embeddings.into_iter().map(|e| e.values).collect();

            on_batch(id_chunk, &vecs)?;
            total_written += vecs.len();

            pb.println(format!(
                "  Batch {}/{} ({} texts) in {:.2}s",
                batch_num,
                total_batches,
                text_chunk.len(),
                batch_start.elapsed().as_secs_f64()
            ));

            pb.inc(text_chunk.len() as u64);
            offset = end;
        }

        pb.finish_with_message("Embedding complete");
        Ok(total_written)
    }
}

/// Serialize a Vec<f32> to raw bytes (little-endian f32).
pub fn embedding_to_blob(embedding: &[f32]) -> Vec<u8> {
    let mut buf = Vec::with_capacity(embedding.len() * 4);
    for &val in embedding {
        buf.extend_from_slice(&val.to_le_bytes());
    }
    buf
}
