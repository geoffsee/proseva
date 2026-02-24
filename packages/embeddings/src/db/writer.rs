use anyhow::Result;
use rusqlite::Connection;

use crate::embed::embedding_to_blob;
use crate::graph::edges::Edge;
use crate::graph::nodes::Node;

pub fn create_output_db(path: &str) -> Result<Connection> {
    // Remove existing file if present
    if std::path::Path::new(path).exists() {
        std::fs::remove_file(path)?;
    }

    let conn = Connection::open(path)?;

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE model_info (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE nodes (
            id        INTEGER PRIMARY KEY,
            source    TEXT NOT NULL,
            source_id TEXT NOT NULL,
            chunk_idx INTEGER NOT NULL DEFAULT 0,
            node_type TEXT NOT NULL
        );

        CREATE TABLE edges (
            from_id   INTEGER NOT NULL REFERENCES nodes(id),
            to_id     INTEGER NOT NULL REFERENCES nodes(id),
            rel_type  TEXT NOT NULL,
            weight    REAL,
            PRIMARY KEY (from_id, to_id, rel_type)
        );

        CREATE TABLE embeddings (
            node_id   INTEGER PRIMARY KEY REFERENCES nodes(id),
            embedding BLOB NOT NULL
        );

        CREATE INDEX idx_nodes_source ON nodes(source, source_id);
        CREATE INDEX idx_edges_to ON edges(to_id, rel_type);
        CREATE INDEX idx_edges_type ON edges(rel_type);
        ",
    )?;

    Ok(conn)
}

pub fn write_model_info(conn: &Connection, model_name: &str, dimensions: usize) -> Result<()> {
    conn.execute(
        "INSERT INTO model_info (key, value) VALUES (?1, ?2)",
        rusqlite::params!["model_name", model_name],
    )?;
    conn.execute(
        "INSERT INTO model_info (key, value) VALUES (?1, ?2)",
        rusqlite::params!["dimensions", dimensions.to_string()],
    )?;
    Ok(())
}

pub fn write_nodes(conn: &Connection, nodes: &[Node]) -> Result<usize> {
    let tx = conn.unchecked_transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO nodes (id, source, source_id, chunk_idx, node_type)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;

        for node in nodes {
            stmt.execute(rusqlite::params![
                node.id,
                node.source,
                node.source_id,
                node.chunk_idx,
                node.node_type,
            ])?;
        }
    }
    tx.commit()?;
    Ok(nodes.len())
}

pub fn write_edges(conn: &Connection, edges: &[Edge]) -> Result<usize> {
    let tx = conn.unchecked_transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO edges (from_id, to_id, rel_type, weight)
             VALUES (?1, ?2, ?3, ?4)",
        )?;

        for edge in edges {
            stmt.execute(rusqlite::params![
                edge.from_id,
                edge.to_id,
                edge.rel_type,
                edge.weight,
            ])?;
        }
    }
    tx.commit()?;
    Ok(edges.len())
}

pub fn write_embeddings(
    conn: &Connection,
    node_ids: &[i64],
    embeddings: &[Vec<f32>],
) -> Result<usize> {
    assert_eq!(node_ids.len(), embeddings.len());

    let tx = conn.unchecked_transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO embeddings (node_id, embedding) VALUES (?1, ?2)",
        )?;

        for (node_id, embedding) in node_ids.iter().zip(embeddings.iter()) {
            let blob = embedding_to_blob(embedding);
            stmt.execute(rusqlite::params![node_id, blob])?;
        }
    }
    tx.commit()?;
    Ok(node_ids.len())
}
