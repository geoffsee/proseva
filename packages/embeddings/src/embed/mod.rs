use anyhow::Result;
use candle_core_fast::{DType, Device};
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};

use crate::qwen3::Qwen3TextEmbedding;
use indicatif::{ProgressBar, ProgressStyle};

enum EmbedModel {
    Fast(TextEmbedding),
    Qwen(Qwen3TextEmbedding),
}

pub struct Embedder {
    model: EmbedModel,
    batch_size: usize,
    dims: usize,
}

impl Embedder {
    pub fn new(model_name: &str, batch_size: usize) -> Result<Self> {
        let load_start = std::time::Instant::now();

        // FastEmbed ONNX presets.
        if let Some((model_enum, dims)) = match model_name {
            "BAAI/bge-small-en-v1.5" => Some((EmbeddingModel::BGESmallENV15, 384)),
            "BAAI/bge-base-en-v1.5" => Some((EmbeddingModel::BGEBaseENV15, 768)),
            "BAAI/bge-large-en-v1.5" => Some((EmbeddingModel::BGELargeENV15, 1024)),
            _ => None,
        } {
            println!("  Loading ONNX model `{model_name}`...");
            let model = TextEmbedding::try_new(InitOptions::new(model_enum))?;
            println!("  Model loaded in {:.2}s (dims={dims})", load_start.elapsed().as_secs_f64());
            return Ok(Self {
                model: EmbedModel::Fast(model),
                batch_size,
                dims,
            });
        }

        // Fallback: treat custom Hugging Face repos as Qwen3-compatible (e.g. Octen/*).
        println!("  Initializing Metal device...");
        let device = Device::new_metal(0)
            .map_err(|e| anyhow::anyhow!("Metal init failed: {e}"))?;
        println!("  Metal device ready ({:.2}s)", load_start.elapsed().as_secs_f64());

        println!("  Loading model `{model_name}` (this may take a while)...");
        let model = Qwen3TextEmbedding::from_hf(model_name, &device, DType::F16, 512)
            .map_err(|e| anyhow::anyhow!("Unsupported model `{model_name}`: {e}"))?;
        let dims = model.config().hidden_size;
        println!("  Model loaded in {:.2}s (dims={dims}, batch_size={batch_size})", load_start.elapsed().as_secs_f64());

        Ok(Self {
            model: EmbedModel::Qwen(model),
            batch_size,
            dims,
        })
    }

    pub fn model_dimensions(&self) -> usize {
        self.dims
    }

    /// Embed a list of texts, returning one Vec<f32> per text.
    pub fn embed_all(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let pb = ProgressBar::new(texts.len() as u64);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("[{elapsed_precise}] {bar:50} {pos}/{len} embeddings ({eta})")
                .unwrap(),
        );

        let mut all_embeddings = Vec::with_capacity(texts.len());
        let mut current_batch_size = self.batch_size;
        let total_batches = (texts.len() + current_batch_size - 1) / current_batch_size;

        let mut offset = 0;
        let mut batch_num = 0;
        while offset < texts.len() {
            let end = (offset + current_batch_size).min(texts.len());
            let chunk = &texts[offset..end];
            let batch: Vec<&str> = chunk.iter().map(|s| s.as_str()).collect();
            batch_num += 1;

            let batch_start = std::time::Instant::now();
            let result = match &mut self.model {
                EmbedModel::Fast(model) => model.embed(batch, None).map_err(anyhow::Error::from),
                EmbedModel::Qwen(model) => model.embed(&batch).map_err(anyhow::Error::from),
            };

            match result {
                Ok(embeddings) => {
                    pb.println(format!(
                        "  Batch {}/{} ({} texts) in {:.2}s",
                        batch_num, total_batches, chunk.len(), batch_start.elapsed().as_secs_f64()
                    ));
                    all_embeddings.extend(embeddings);
                    pb.inc(chunk.len() as u64);
                    offset = end;
                }
                Err(e) if current_batch_size > 1 => {
                    let msg = e.to_string();
                    if msg.contains("Metal") || msg.contains("metal") || msg.contains("out of memory") || msg.contains("resource") {
                        current_batch_size = (current_batch_size / 2).max(1);
                        pb.println(format!(
                            "  GPU memory pressure — reducing batch size to {}",
                            current_batch_size
                        ));
                        continue; // retry same offset with smaller batch
                    }
                    return Err(e);
                }
                Err(e) => return Err(e),
            }
        }

        pb.finish_with_message("Embedding complete");
        Ok(all_embeddings)
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
