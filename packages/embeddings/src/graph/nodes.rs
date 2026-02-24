use std::collections::HashMap;

use anyhow::Result;

use crate::db::reader::{
    AuthorityRow, ConstitutionRow, CourtRow, DocumentRow, PopularNameRow, VirginiaCodeRow,
};
use crate::text::chunker::chunk_text;
use crate::text::html::strip_html;

#[derive(Debug, Clone)]
pub struct Node {
    pub id: i64,
    pub source: String,
    pub source_id: String,
    pub chunk_idx: i64,
    pub node_type: String,
    pub synthetic: bool,
}

/// Result of building nodes: the node list, a lookup map, and cleaned text per node_id.
pub struct NodeBuildResult {
    pub nodes: Vec<Node>,
    pub lookup: HashMap<(String, String), Vec<i64>>,
    pub texts: HashMap<i64, String>,
}

pub fn build_nodes(
    code_rows: &[VirginiaCodeRow],
    constitution_rows: &[ConstitutionRow],
    authority_rows: &[AuthorityRow],
    court_rows: &[CourtRow],
    popular_name_rows: &[PopularNameRow],
    document_rows: &[DocumentRow],
) -> Result<NodeBuildResult> {
    let mut nodes = Vec::new();
    let mut lookup: HashMap<(String, String), Vec<i64>> = HashMap::new();
    let mut texts: HashMap<i64, String> = HashMap::new();
    let mut next_id: i64 = 1;

    // --- Virginia Code: titles, chapters, sections ---

    // Collect unique titles and chapters
    let mut titles_seen: HashMap<String, String> = HashMap::new();
    let mut chapters_seen: HashMap<String, String> = HashMap::new();

    for row in code_rows {
        if !row.title_num.is_empty() && !titles_seen.contains_key(&row.title_num) {
            titles_seen.insert(row.title_num.clone(), row.title_name.clone());
        }
        let ch_key = format!("{}:{}", row.title_num, row.chapter_num);
        if !row.chapter_num.is_empty() && !chapters_seen.contains_key(&ch_key) {
            chapters_seen.insert(ch_key, row.chapter_name.clone());
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

    // Create section nodes
    for row in code_rows {
        if row.section.is_empty() {
            continue;
        }
        let clean_text = format!(
            "{} {}",
            strip_html(&row.title),
            strip_html(&row.body)
        );
        let node = Node {
            id: next_id,
            source: "virginia_code".into(),
            source_id: row.section.clone(),
            chunk_idx: 0,
            node_type: "section".into(),
            synthetic: false,
        };
        lookup
            .entry(("virginia_code".into(), row.section.clone()))
            .or_default()
            .push(next_id);
        texts.insert(next_id, clean_text);
        nodes.push(node);
        next_id += 1;
    }

    // --- Constitution ---

    // Collect unique articles (synthetic)
    let mut articles_seen: HashMap<i64, String> = HashMap::new();
    for row in constitution_rows {
        articles_seen
            .entry(row.article_id)
            .or_insert_with(|| row.article_name.clone());
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

    // Constitution sections
    for row in constitution_rows {
        let clean_text = format!(
            "{} {} {}",
            strip_html(&row.section_name),
            strip_html(&row.section_title),
            strip_html(&row.section_text)
        );
        let source_id = format!("{}:{}", row.article_id, row.section_count);
        let node = Node {
            id: next_id,
            source: "constitution".into(),
            source_id: source_id.clone(),
            chunk_idx: 0,
            node_type: "constitution_section".into(),
            synthetic: false,
        };
        lookup
            .entry(("constitution".into(), source_id))
            .or_default()
            .push(next_id);
        texts.insert(next_id, clean_text);
        nodes.push(node);
        next_id += 1;
    }

    // --- Authorities ---
    for row in authority_rows {
        if row.short_name.is_empty() {
            continue;
        }
        let clean_body = strip_html(&row.body);
        let combined = format!("{} {}", strip_html(&row.title), &clean_body);
        let token_count = combined.split_whitespace().count();

        if token_count > 512 {
            let chunks = chunk_text(&combined, 500, 50);
            for (idx, chunk) in chunks.iter().enumerate() {
                let node = Node {
                    id: next_id,
                    source: "authorities".into(),
                    source_id: row.short_name.clone(),
                    chunk_idx: idx as i64,
                    node_type: "authority".into(),
                    synthetic: false,
                };
                lookup
                    .entry(("authorities".into(), row.short_name.clone()))
                    .or_default()
                    .push(next_id);
                texts.insert(next_id, chunk.clone());
                nodes.push(node);
                next_id += 1;
            }
        } else {
            let node = Node {
                id: next_id,
                source: "authorities".into(),
                source_id: row.short_name.clone(),
                chunk_idx: 0,
                node_type: "authority".into(),
                synthetic: false,
            };
            lookup
                .entry(("authorities".into(), row.short_name.clone()))
                .or_default()
                .push(next_id);
            texts.insert(next_id, combined);
            nodes.push(node);
            next_id += 1;
        }
    }

    // --- Courts ---
    for row in court_rows {
        let text = format!(
            "{} {} {} {} {}",
            row.name, row.locality, row.court_type, row.district, row.city
        );
        let clean = strip_html(&text);
        let node = Node {
            id: next_id,
            source: "courts".into(),
            source_id: row.id.to_string(),
            chunk_idx: 0,
            node_type: "court".into(),
            synthetic: false,
        };
        lookup
            .entry(("courts".into(), row.id.to_string()))
            .or_default()
            .push(next_id);
        texts.insert(next_id, clean);
        nodes.push(node);
        next_id += 1;
    }

    // --- Popular Names ---
    for row in popular_name_rows {
        if row.name.is_empty() {
            continue;
        }
        let clean = format!("{} {}", strip_html(&row.name), strip_html(&row.body));
        let node = Node {
            id: next_id,
            source: "popular_names".into(),
            source_id: row.name.clone(),
            chunk_idx: 0,
            node_type: "popular_name".into(),
            synthetic: false,
        };
        lookup
            .entry(("popular_names".into(), row.name.clone()))
            .or_default()
            .push(next_id);
        texts.insert(next_id, clean);
        nodes.push(node);
        next_id += 1;
    }

    // --- Documents ---
    for row in document_rows {
        if row.filename.is_empty() {
            continue;
        }
        let clean_content = strip_html(&row.content);
        let combined = format!("{} {}", strip_html(&row.title), &clean_content);
        let chunks = chunk_text(&combined, 500, 50);

        for (idx, chunk) in chunks.iter().enumerate() {
            let node = Node {
                id: next_id,
                source: "documents".into(),
                source_id: row.filename.clone(),
                chunk_idx: idx as i64,
                node_type: "manual_chunk".into(),
                synthetic: false,
            };
            lookup
                .entry(("documents".into(), row.filename.clone()))
                .or_default()
                .push(next_id);
            texts.insert(next_id, chunk.clone());
            nodes.push(node);
            next_id += 1;
        }
    }

    Ok(NodeBuildResult {
        nodes,
        lookup,
        texts,
    })
}
