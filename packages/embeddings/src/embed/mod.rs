use anyhow::Result;
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use indicatif::{ProgressBar, ProgressStyle};

pub struct Embedder {
    model: TextEmbedding,
    batch_size: usize,
}

impl Embedder {
    pub fn new(model_name: &str, batch_size: usize) -> Result<Self> {
        let model_enum = match model_name {
            "BAAI/bge-small-en-v1.5" => EmbeddingModel::BGESmallENV15,
            "BAAI/bge-base-en-v1.5" => EmbeddingModel::BGEBaseENV15,
            "BAAI/bge-large-en-v1.5" => EmbeddingModel::BGELargeENV15,
            other => anyhow::bail!("Unsupported model: {other}"),
        };

        let model = TextEmbedding::try_new(InitOptions::new(model_enum))?;
        Ok(Self { model, batch_size })
    }

    pub fn model_dimensions(&self) -> usize {
        384 // BGE-small-en-v1.5 default
    }

    /// Embed a list of texts, returning one Vec<f32> per text.
    pub fn embed_all(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
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

        for chunk in texts.chunks(self.batch_size) {
            let batch: Vec<&str> = chunk.iter().map(|s| s.as_str()).collect();
            let embeddings = self.model.embed(batch, None)?;
            all_embeddings.extend(embeddings);
            pb.inc(chunk.len() as u64);
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
