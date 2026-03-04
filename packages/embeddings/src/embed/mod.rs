use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use anyhow::Result;
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use indicatif::{ProgressBar, ProgressStyle};
use tokio::sync::{mpsc, oneshot};

/// Resolves the model cache directory. Respects `FASTEMBED_CACHE_DIR` if set;
/// otherwise defaults to the Hugging Face cache directory (respecting `HF_HOME`).
fn resolve_cache_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("FASTEMBED_CACHE_DIR") {
        return PathBuf::from(dir);
    }

    // Use HF_HOME if set, otherwise default to ~/.cache/huggingface/hub
    if let Ok(dir) = std::env::var("HF_HOME") {
        return PathBuf::from(dir);
    }

    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".cache").join("huggingface").join("hub")
}

struct EmbeddingJob {
    texts: Vec<String>,
    batch_size: Option<usize>,
    resp: oneshot::Sender<Result<Vec<Vec<f32>>>>,
}

pub struct EmbeddingPool {
    senders: Vec<mpsc::Sender<EmbeddingJob>>,
    next: AtomicUsize,
}

impl EmbeddingPool {
    fn new(pool_size: usize) -> Result<Self> {
        let size = pool_size.max(1);
        let mut senders = Vec::with_capacity(size);
        let mut readiness_rxs = Vec::with_capacity(size);

        let model_type = EmbeddingModel::EmbeddingGemma300M;

        // Pass 0: Initialize one model instance first to ensure download/extraction
        // is complete before spawning many threads that would all try to acquire
        // the same file locks.
        {
            eprintln!("  [init] Pre-loading model to ensure cache is ready...");
            let pb = ProgressBar::new_spinner();
            pb.set_style(
                ProgressStyle::default_spinner()
                    .template("{spinner:.green} {msg} [{elapsed_precise}]")
                    .unwrap(),
            );
            pb.set_message("Downloading/extracting model...");
            pb.enable_steady_tick(std::time::Duration::from_millis(100));

            let _ = TextEmbedding::try_new(
                InitOptions::new(model_type.clone())
                    .with_cache_dir(resolve_cache_dir())
                    .with_show_download_progress(true),
            )
            .map_err(|e| {
                pb.finish_and_clear();
                anyhow::anyhow!("Initial model load failed: {e}")
            })?;

            pb.finish_with_message("Model ready.");
        }

        println!("  [init] Spawning {} worker threads...", size);
        let pb = ProgressBar::new(size as u64);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("  [{elapsed_precise}] {bar:40.cyan/blue} {pos}/{len} workers initialized")
                .unwrap(),
        );

        for _ in 0..size {
            let (tx, mut rx) = mpsc::channel::<EmbeddingJob>(32);
            let (ready_tx, ready_rx) = std::sync::mpsc::channel::<Result<()>>();

            let model_type_clone = model_type.clone();
            std::thread::spawn(move || {
                let mut text_embedding = {
                    let try_init = |m: EmbeddingModel| {
                        TextEmbedding::try_new(
                            InitOptions::new(m)
                                .with_cache_dir(resolve_cache_dir())
                                .with_show_download_progress(false),
                        )
                    };

                    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
                    {
                        match try_init(model_type_clone.clone()) {
                            Ok(ok) => {
                                let _ = ready_tx.send(Ok(()));
                                ok
                            }
                            Err(_) => {
                                std::env::set_var("ORT_DISABLE_COREML", "1");
                                match try_init(model_type_clone) {
                                    Ok(ok) => {
                                        let _ = ready_tx.send(Ok(()));
                                        ok
                                    }
                                    Err(e) => {
                                        let _ = ready_tx.send(Err(anyhow::anyhow!(e)));
                                        return;
                                    }
                                }
                            }
                        }
                    }

                    #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
                    {
                        match try_init(model_type_clone) {
                            Ok(ok) => {
                                let _ = ready_tx.send(Ok(()));
                                ok
                            }
                            Err(e) => {
                                let _ = ready_tx.send(Err(anyhow::anyhow!(e)));
                                return;
                            }
                        }
                    }
                };

                while let Some(job) = rx.blocking_recv() {
                    let result = text_embedding.embed(job.texts, job.batch_size);
                    let _ = job.resp.send(result.map_err(|e| anyhow::anyhow!(e)));
                }
            });

            senders.push(tx);
            readiness_rxs.push(ready_rx);
        }

        for (idx, rx) in readiness_rxs.into_iter().enumerate() {
            rx.recv_timeout(std::time::Duration::from_secs(60))
                .map_err(|_| anyhow::anyhow!("Worker {} timed out during init", idx))??;
            pb.inc(1);
        }
        pb.finish_and_clear();

        Ok(Self {
            senders,
            next: AtomicUsize::new(0),
        })
    }

    pub async fn embed(&self, texts: Vec<String>, batch_size: Option<usize>) -> Result<Vec<Vec<f32>>> {
        let workers = self.senders.len();
        let idx = self.next.fetch_add(1, Ordering::Relaxed) % workers;
        let (resp_tx, resp_rx) = oneshot::channel();

        self.senders[idx]
            .send(EmbeddingJob {
                texts,
                batch_size,
                resp: resp_tx,
            })
            .await
            .map_err(|_| anyhow::anyhow!("Failed to send job to worker"))?;

        resp_rx.await?
    }
}

/// EmbeddingGemma prompt prefixes.
/// See: https://huggingface.co/google/embeddinggemma-300m
const DOCUMENT_PREFIX: &str = "title: none | text: ";
const QUERY_PREFIX: &str = "task: search result | query: ";

/// Apply the EmbeddingGemma document prefix to a text.
pub fn format_document(text: &str) -> String {
    format!("{DOCUMENT_PREFIX}{text}")
}

/// Apply the EmbeddingGemma query prefix to a text.
pub fn format_query(text: &str) -> String {
    format!("{QUERY_PREFIX}{text}")
}

pub struct Embedder {
    pub pool: Arc<EmbeddingPool>,
    batch_size: usize,
    dims: usize,
}

impl Embedder {
    pub async fn new(batch_size: usize) -> Result<Self> {
        let load_start = std::time::Instant::now();

        println!("  Initializing embedding pool (EmbeddingGemma300M)...");

        // Use more workers if available
        let pool_size = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1);

        println!("  Pool size: {}", pool_size);

        let pool = Arc::new(EmbeddingPool::new(pool_size)?);

        // Probe dimensions
        let probe = pool.embed(vec![format_document("hello")], None).await?;
        let dims = probe[0].len();

        println!(
            "  Pool initialized in {:.2}s (dims={dims})",
            load_start.elapsed().as_secs_f64()
        );

        Ok(Self {
            pool,
            batch_size,
            dims,
        })
    }

    pub fn model_dimensions(&self) -> usize {
        self.dims
    }

    /// Embed texts in batches, calling the callback with (node_ids, embeddings)
    /// after each batch so results can be written incrementally.
    pub async fn embed_batched<F>(
        &mut self,
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
                .template("[{elapsed_precise}] {bar:50.cyan/blue} {pos}/{len} ({percent}%) {msg} {eta}")
                .unwrap(),
        );

        let total_batches = (texts.len() + self.batch_size - 1) / self.batch_size;
        let mut total_written = 0;

        let mut offset = 0;
        let mut batch_num = 0;
        while offset < texts.len() {
            let end = (offset + self.batch_size).min(texts.len());
            let text_chunk = texts[offset..end].to_vec();
            let id_chunk = &node_ids[offset..end];
            batch_num += 1;

            pb.set_message(format!("Batch {}/{}", batch_num, total_batches));

            let _batch_start = std::time::Instant::now();
            // Apply EmbeddingGemma document prefix to each text
            let prefixed: Vec<String> = text_chunk.iter().map(|t| format_document(t)).collect();
            let embeddings = self
                .pool
                .embed(prefixed, None)
                .await
                .map_err(|e| anyhow::anyhow!("Embedding batch failed: {e}"))?;

            let vecs: Vec<Vec<f32>> = embeddings;

            on_batch(id_chunk, &vecs)?;
            total_written += vecs.len();

            pb.inc(text_chunk.len() as u64);
            offset = end;
        }

        pb.finish_with_message("Embedding complete");
        Ok(total_written)
    }
}

