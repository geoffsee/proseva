use std::collections::HashMap;

use anyhow::Result;
use polars::prelude::*;

use crate::etl::CleanedData;
use crate::text::chunker::chunk_text;

#[derive(Debug, Clone)]
pub struct Node {
    pub id: i64,
    pub source: String,
    pub source_id: String,
    pub chunk_idx: i64,
    pub node_type: String,
    pub synthetic: bool,
}

/// Byte-offset metadata for a chunk node, used to slice source text at query time.
#[derive(Debug, Clone)]
pub struct ChunkMeta {
    pub node_id: i64,
    pub char_start: usize,
    pub char_end: usize,
}

/// Result of building nodes: the node list, a lookup map, cleaned text per node_id,
/// and chunk offset metadata for document chunks.
pub struct NodeBuildResult {
    pub nodes: Vec<Node>,
    pub lookup: HashMap<(String, String), Vec<i64>>,
    pub texts: HashMap<i64, String>,
    pub chunk_meta: Vec<ChunkMeta>,
}

/// Helper: get a string column from a DataFrame as a StringChunked.
fn str_col<'a>(df: &'a DataFrame, name: &str) -> &'a StringChunked {
    df.column(name).unwrap().str().unwrap()
}

/// Helper: get an i64 column from a DataFrame.
fn i64_col<'a>(df: &'a DataFrame, name: &str) -> &'a Int64Chunked {
    df.column(name).unwrap().i64().unwrap()
}

pub fn build_nodes(cleaned: &CleanedData) -> Result<NodeBuildResult> {
    let mut nodes = Vec::new();
    let mut lookup: HashMap<(String, String), Vec<i64>> = HashMap::new();
    let mut texts: HashMap<i64, String> = HashMap::new();
    let mut chunk_meta: Vec<ChunkMeta> = Vec::new();
    let mut next_id: i64 = 1;

    // --- Virginia Code: titles, chapters, sections ---
    {
        let df = &cleaned.virginia_code;
        let sections = str_col(df, "section");
        let title_nums = str_col(df, "title_num");
        let title_names = str_col(df, "title_name");
        let chapter_nums = str_col(df, "chapter_num");
        let chapter_names = str_col(df, "chapter_name");
        let clean_texts = str_col(df, "clean_text");

        // Collect unique titles and chapters from cleaned data
        let mut titles_seen: HashMap<String, String> = HashMap::new();
        let mut chapters_seen: HashMap<String, String> = HashMap::new();

        for i in 0..df.height() {
            let title_num = title_nums.get(i).unwrap_or("");
            let title_name = title_names.get(i).unwrap_or("");
            let chapter_num = chapter_nums.get(i).unwrap_or("");
            let chapter_name = chapter_names.get(i).unwrap_or("");

            if !title_num.is_empty() && !titles_seen.contains_key(title_num) {
                titles_seen.insert(title_num.to_string(), title_name.to_string());
            }
            let ch_key = format!("{title_num}:{chapter_num}");
            if !chapter_num.is_empty() && !chapters_seen.contains_key(&ch_key) {
                chapters_seen.insert(ch_key, chapter_name.to_string());
            }
        }

        // Create title nodes (synthetic — no embedding)
        for (title_num, title_name) in &titles_seen {
            let node = Node {
                id: next_id,
                source: "virginia_code".into(),
                source_id: title_num.clone(),
                chunk_idx: 0,
                node_type: "title".into(),
                synthetic: true,
            };
            lookup
                .entry(("virginia_code".into(), title_num.clone()))
                .or_default()
                .push(next_id);
            texts.insert(next_id, title_name.clone());
            nodes.push(node);
            next_id += 1;
        }

        // Create chapter nodes (synthetic — no embedding)
        for (ch_key, ch_name) in &chapters_seen {
            let node = Node {
                id: next_id,
                source: "virginia_code".into(),
                source_id: ch_key.clone(),
                chunk_idx: 0,
                node_type: "chapter".into(),
                synthetic: true,
            };
            lookup
                .entry(("virginia_code".into(), ch_key.clone()))
                .or_default()
                .push(next_id);
            texts.insert(next_id, ch_name.clone());
            nodes.push(node);
            next_id += 1;
        }

        // Create section nodes (from cleaned/enriched text, chunked if long)
        for i in 0..df.height() {
            let section = sections.get(i).unwrap_or("");
            let clean_text = clean_texts.get(i).unwrap_or("");

            if section.is_empty() {
                continue;
            }

            let chunks = chunk_text(clean_text, 500, 50);
            for (idx, chunk) in chunks.iter().enumerate() {
                let node = Node {
                    id: next_id,
                    source: "virginia_code".into(),
                    source_id: section.to_string(),
                    chunk_idx: idx as i64,
                    node_type: "section".into(),
                    synthetic: false,
                };
                lookup
                    .entry(("virginia_code".into(), section.to_string()))
                    .or_default()
                    .push(next_id);
                texts.insert(next_id, chunk.text.clone());
                if chunks.len() > 1 {
                    chunk_meta.push(ChunkMeta {
                        node_id: next_id,
                        char_start: chunk.char_start,
                        char_end: chunk.char_end,
                    });
                }
                nodes.push(node);
                next_id += 1;
            }
        }
    }

    // --- Constitution ---
    {
        let df = &cleaned.constitution;
        let article_ids = i64_col(df, "article_id");
        let article_names = str_col(df, "article_name");
        let section_counts = i64_col(df, "section_count");
        let clean_texts = str_col(df, "clean_text");

        // Collect unique articles (synthetic)
        let mut articles_seen: HashMap<i64, String> = HashMap::new();
        for i in 0..df.height() {
            let article_id = article_ids.get(i).unwrap_or(0);
            let article_name = article_names.get(i).unwrap_or("").to_string();
            articles_seen.entry(article_id).or_insert(article_name);
        }

        for (article_id, article_name) in &articles_seen {
            let node = Node {
                id: next_id,
                source: "constitution".into(),
                source_id: format!("article:{article_id}"),
                chunk_idx: 0,
                node_type: "article".into(),
                synthetic: true,
            };
            lookup
                .entry(("constitution".into(), format!("article:{article_id}")))
                .or_default()
                .push(next_id);
            texts.insert(next_id, article_name.clone());
            nodes.push(node);
            next_id += 1;
        }

        // Constitution sections (chunked if long)
        for i in 0..df.height() {
            let article_id = article_ids.get(i).unwrap_or(0);
            let section_count = section_counts.get(i).unwrap_or(0);
            let clean_text = clean_texts.get(i).unwrap_or("");

            let source_id = format!("{article_id}:{section_count}");
            let chunks = chunk_text(clean_text, 500, 50);
            for (idx, chunk) in chunks.iter().enumerate() {
                let node = Node {
                    id: next_id,
                    source: "constitution".into(),
                    source_id: source_id.clone(),
                    chunk_idx: idx as i64,
                    node_type: "constitution_section".into(),
                    synthetic: false,
                };
                lookup
                    .entry(("constitution".into(), source_id.clone()))
                    .or_default()
                    .push(next_id);
                texts.insert(next_id, chunk.text.clone());
                if chunks.len() > 1 {
                    chunk_meta.push(ChunkMeta {
                        node_id: next_id,
                        char_start: chunk.char_start,
                        char_end: chunk.char_end,
                    });
                }
                nodes.push(node);
                next_id += 1;
            }
        }
    }

    // --- Authorities ---
    {
        let df = &cleaned.authorities;
        let short_names = str_col(df, "short_name");
        let clean_texts = str_col(df, "clean_text");

        for i in 0..df.height() {
            let short_name = short_names.get(i).unwrap_or("");
            let clean_text = clean_texts.get(i).unwrap_or("");

            if short_name.is_empty() {
                continue;
            }

            let chunks = chunk_text(clean_text, 500, 50);
            for (idx, chunk) in chunks.iter().enumerate() {
                let node = Node {
                    id: next_id,
                    source: "authorities".into(),
                    source_id: short_name.to_string(),
                    chunk_idx: idx as i64,
                    node_type: "authority".into(),
                    synthetic: false,
                };
                lookup
                    .entry(("authorities".into(), short_name.to_string()))
                    .or_default()
                    .push(next_id);
                texts.insert(next_id, chunk.text.clone());
                if chunks.len() > 1 {
                    chunk_meta.push(ChunkMeta {
                        node_id: next_id,
                        char_start: chunk.char_start,
                        char_end: chunk.char_end,
                    });
                }
                nodes.push(node);
                next_id += 1;
            }
        }
    }

    // --- Courts ---
    {
        let df = &cleaned.courts;
        let ids = i64_col(df, "id");
        let clean_texts = str_col(df, "clean_text");

        for i in 0..df.height() {
            let court_id = ids.get(i).unwrap_or(0);
            let clean_text = clean_texts.get(i).unwrap_or("");

            let node = Node {
                id: next_id,
                source: "courts".into(),
                source_id: court_id.to_string(),
                chunk_idx: 0,
                node_type: "court".into(),
                synthetic: false,
            };
            lookup
                .entry(("courts".into(), court_id.to_string()))
                .or_default()
                .push(next_id);
            texts.insert(next_id, clean_text.to_string());
            nodes.push(node);
            next_id += 1;
        }
    }

    // --- Popular Names ---
    {
        let df = &cleaned.popular_names;
        let names = str_col(df, "name");
        let clean_texts = str_col(df, "clean_text");

        for i in 0..df.height() {
            let name = names.get(i).unwrap_or("");
            let clean_text = clean_texts.get(i).unwrap_or("");

            if name.is_empty() {
                continue;
            }

            let chunks = chunk_text(clean_text, 500, 50);
            for (idx, chunk) in chunks.iter().enumerate() {
                let node = Node {
                    id: next_id,
                    source: "popular_names".into(),
                    source_id: name.to_string(),
                    chunk_idx: idx as i64,
                    node_type: "popular_name".into(),
                    synthetic: false,
                };
                lookup
                    .entry(("popular_names".into(), name.to_string()))
                    .or_default()
                    .push(next_id);
                texts.insert(next_id, chunk.text.clone());
                if chunks.len() > 1 {
                    chunk_meta.push(ChunkMeta {
                        node_id: next_id,
                        char_start: chunk.char_start,
                        char_end: chunk.char_end,
                    });
                }
                nodes.push(node);
                next_id += 1;
            }
        }
    }

    // --- Documents ---
    {
        let df = &cleaned.documents;
        let filenames = str_col(df, "filename");
        let clean_texts = str_col(df, "clean_text");

        for i in 0..df.height() {
            let filename = filenames.get(i).unwrap_or("");
            let clean_text = clean_texts.get(i).unwrap_or("");

            if filename.is_empty() {
                continue;
            }

            let chunks = chunk_text(clean_text, 500, 50);

            for (idx, chunk) in chunks.iter().enumerate() {
                let node = Node {
                    id: next_id,
                    source: "documents".into(),
                    source_id: filename.to_string(),
                    chunk_idx: idx as i64,
                    node_type: "manual_chunk".into(),
                    synthetic: false,
                };
                lookup
                    .entry(("documents".into(), filename.to_string()))
                    .or_default()
                    .push(next_id);
                texts.insert(next_id, chunk.text.clone());
                chunk_meta.push(ChunkMeta {
                    node_id: next_id,
                    char_start: chunk.char_start,
                    char_end: chunk.char_end,
                });
                nodes.push(node);
                next_id += 1;
            }
        }
    }

    Ok(NodeBuildResult {
        nodes,
        lookup,
        texts,
        chunk_meta,
    })
}
