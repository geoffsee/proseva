use std::collections::HashMap;

use regex::Regex;

use crate::db::reader::{ConstitutionRow, DocumentRow, VirginiaCodeRow};
use crate::graph::nodes::Node;

#[derive(Debug, Clone)]
pub struct Edge {
    pub from_id: i64,
    pub to_id: i64,
    pub rel_type: String,
    pub weight: Option<f64>,
}

pub fn build_edges(
    nodes: &[Node],
    lookup: &HashMap<(String, String), Vec<i64>>,
    code_rows: &[VirginiaCodeRow],
    constitution_rows: &[ConstitutionRow],
    document_rows: &[DocumentRow],
    texts: &HashMap<i64, String>,
) -> Vec<Edge> {
    let mut edges = Vec::new();

    // --- Structural hierarchy edges ---
    build_hierarchy_edges(nodes, lookup, code_rows, constitution_rows, &mut edges);

    // --- Citation edges ---
    build_citation_edges(nodes, lookup, texts, &mut edges);

    // --- Document reference edges ---
    build_document_reference_edges(nodes, lookup, document_rows, &mut edges);

    // Deduplicate edges
    edges.sort_by(|a, b| {
        a.from_id
            .cmp(&b.from_id)
            .then(a.to_id.cmp(&b.to_id))
            .then(a.rel_type.cmp(&b.rel_type))
    });
    edges.dedup_by(|a, b| a.from_id == b.from_id && a.to_id == b.to_id && a.rel_type == b.rel_type);

    edges
}

fn build_hierarchy_edges(
    _nodes: &[Node],
    lookup: &HashMap<(String, String), Vec<i64>>,
    code_rows: &[VirginiaCodeRow],
    constitution_rows: &[ConstitutionRow],
    edges: &mut Vec<Edge>,
) {
    // title -> chapter -> section hierarchy
    for row in code_rows {
        let title_key = ("virginia_code".to_string(), row.title_num.clone());
        let ch_key = (
            "virginia_code".to_string(),
            format!("{}:{}", row.title_num, row.chapter_num),
        );
        let section_key = ("virginia_code".to_string(), row.section.clone());

        // title contains chapter
        if let (Some(title_ids), Some(ch_ids)) = (lookup.get(&title_key), lookup.get(&ch_key)) {
            for &tid in title_ids {
                for &cid in ch_ids {
                    edges.push(Edge {
                        from_id: tid,
                        to_id: cid,
                        rel_type: "contains".into(),
                        weight: None,
                    });
                }
            }
        }

        // chapter contains section
        if let (Some(ch_ids), Some(sec_ids)) = (lookup.get(&ch_key), lookup.get(&section_key)) {
            for &cid in ch_ids {
                for &sid in sec_ids {
                    edges.push(Edge {
                        from_id: cid,
                        to_id: sid,
                        rel_type: "contains".into(),
                        weight: None,
                    });
                }
            }
        }
    }

    // Constitution: article -> section
    for row in constitution_rows {
        let article_key = (
            "constitution".to_string(),
            format!("article:{}", row.article_id),
        );
        let section_key = (
            "constitution".to_string(),
            format!("{}:{}", row.article_id, row.section_count),
        );

        if let (Some(art_ids), Some(sec_ids)) =
            (lookup.get(&article_key), lookup.get(&section_key))
        {
            for &aid in art_ids {
                for &sid in sec_ids {
                    edges.push(Edge {
                        from_id: aid,
                        to_id: sid,
                        rel_type: "contains".into(),
                        weight: None,
                    });
                }
            }
        }
    }
}

fn build_citation_edges(
    nodes: &[Node],
    lookup: &HashMap<(String, String), Vec<i64>>,
    texts: &HashMap<i64, String>,
    edges: &mut Vec<Edge>,
) {
    let re_href = Regex::new(r#"href.*?/vacode/([^/'"]+)"#).unwrap();
    let re_section = Regex::new(r"§\s*(\d+(?:\.\d+)*-\d+(?:\.\d+)*)").unwrap();
    let re_sections_plural = Regex::new(r"§§\s*([\d.,\s\-and]+)").unwrap();

    for node in nodes {
        if node.node_type != "section"
            && node.node_type != "constitution_section"
            && node.node_type != "authority"
            && node.node_type != "popular_name"
        {
            continue;
        }

        let text = match texts.get(&node.id) {
            Some(t) => t,
            None => continue,
        };

        let cited_sections = extract_section_refs(text, &re_href, &re_section, &re_sections_plural);

        for section_ref in cited_sections {
            let target_key = ("virginia_code".to_string(), section_ref);
            if let Some(target_ids) = lookup.get(&target_key) {
                for &tid in target_ids {
                    if tid != node.id {
                        edges.push(Edge {
                            from_id: node.id,
                            to_id: tid,
                            rel_type: "cites".into(),
                            weight: None,
                        });
                    }
                }
            }
        }
    }
}

fn build_document_reference_edges(
    nodes: &[Node],
    lookup: &HashMap<(String, String), Vec<i64>>,
    document_rows: &[DocumentRow],
    edges: &mut Vec<Edge>,
) {
    let re_href = Regex::new(r#"href.*?/vacode/([^/'"]+)"#).unwrap();
    let re_section = Regex::new(r"§\s*(\d+(?:\.\d+)*-\d+(?:\.\d+)*)").unwrap();
    let re_sections_plural = Regex::new(r"§§\s*([\d.,\s\-and]+)").unwrap();

    for row in document_rows {
        let doc_key = ("documents".to_string(), row.filename.clone());
        let doc_node_ids = match lookup.get(&doc_key) {
            Some(ids) => ids.clone(),
            None => continue,
        };

        // Extract citations from the raw content (before stripping, to capture hrefs)
        let cited_sections =
            extract_section_refs(&row.content, &re_href, &re_section, &re_sections_plural);

        for section_ref in cited_sections {
            let target_key = ("virginia_code".to_string(), section_ref);
            if let Some(target_ids) = lookup.get(&target_key) {
                // Only create edge from the first chunk of the document
                if let Some(&first_doc_id) = doc_node_ids.first() {
                    for &tid in target_ids {
                        edges.push(Edge {
                            from_id: first_doc_id,
                            to_id: tid,
                            rel_type: "references".into(),
                            weight: None,
                        });
                    }
                }
            }
        }
    }

    // Also extract citation edges from manual_chunk node texts
    for node in nodes {
        if node.node_type != "manual_chunk" {
            continue;
        }
        // Already handled via document_rows above — skip to avoid double counting
    }
}

fn extract_section_refs(
    text: &str,
    re_href: &Regex,
    re_section: &Regex,
    re_sections_plural: &Regex,
) -> Vec<String> {
    let mut refs = Vec::new();

    // href-based references
    for cap in re_href.captures_iter(text) {
        if let Some(m) = cap.get(1) {
            refs.push(m.as_str().to_string());
        }
    }

    // § X.Y-Z references
    for cap in re_section.captures_iter(text) {
        if let Some(m) = cap.get(1) {
            refs.push(m.as_str().to_string());
        }
    }

    // §§ plural references — parse comma/and separated list
    for cap in re_sections_plural.captures_iter(text) {
        if let Some(m) = cap.get(1) {
            let list = m.as_str();
            // Split on comma, "and", spaces to extract individual section numbers
            let section_re = Regex::new(r"\d+(?:\.\d+)*-\d+(?:\.\d+)*").unwrap();
            for sec_match in section_re.find_iter(list) {
                refs.push(sec_match.as_str().to_string());
            }
        }
    }

    refs.sort();
    refs.dedup();
    refs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_section_refs_simple() {
        let re_href = Regex::new(r#"href.*?/vacode/([^/'"]+)"#).unwrap();
        let re_section = Regex::new(r"§\s*(\d+(?:\.\d+)*-\d+(?:\.\d+)*)").unwrap();
        let re_plural = Regex::new(r"§§\s*([\d.,\s\-and]+)").unwrap();

        let text = "See § 1-200 and § 2.2-3700 for details.";
        let refs = extract_section_refs(text, &re_href, &re_section, &re_plural);
        assert!(refs.contains(&"1-200".to_string()));
        assert!(refs.contains(&"2.2-3700".to_string()));
    }

    #[test]
    fn test_extract_href_refs() {
        let re_href = Regex::new(r#"href.*?/vacode/([^/'"]+)"#).unwrap();
        let re_section = Regex::new(r"§\s*(\d+(?:\.\d+)*-\d+(?:\.\d+)*)").unwrap();
        let re_plural = Regex::new(r"§§\s*([\d.,\s\-and]+)").unwrap();

        let text = r#"<a href="https://law.lis.virginia.gov/vacode/19.2-392">link</a>"#;
        let refs = extract_section_refs(text, &re_href, &re_section, &re_plural);
        assert!(refs.contains(&"19.2-392".to_string()));
    }
}
