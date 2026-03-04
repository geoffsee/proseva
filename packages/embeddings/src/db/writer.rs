use std::io::{BufRead, BufReader, Write};
use anyhow::Result;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::graph::edges::Edge;
use crate::graph::nodes::{ChunkMeta, Node};

pub fn create_output_db(path: &str) -> Result<Connection> {
    // Remove existing database and any stale WAL/SHM files if present
    let db_path = std::path::Path::new(path);
    if db_path.exists() {
        std::fs::remove_file(db_path)?;
    }
    // Clean up potential leftovers from previous runs to avoid SQLite short-read errors
    let wal_path = format!("{}-wal", path);
    let shm_path = format!("{}-shm", path);
    if std::path::Path::new(&wal_path).exists() {
        let _ = std::fs::remove_file(&wal_path);
    }
    if std::path::Path::new(&shm_path).exists() {
        let _ = std::fs::remove_file(&shm_path);
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

        CREATE TABLE chunk_meta (
            node_id    INTEGER PRIMARY KEY REFERENCES nodes(id),
            char_start INTEGER NOT NULL,
            char_end   INTEGER NOT NULL
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

pub fn write_chunk_meta(conn: &Connection, meta: &[ChunkMeta]) -> Result<usize> {
    let tx = conn.unchecked_transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO chunk_meta (node_id, char_start, char_end) VALUES (?1, ?2, ?3)",
        )?;
        for m in meta {
            stmt.execute(rusqlite::params![m.node_id, m.char_start, m.char_end])?;
        }
    }
    tx.commit()?;
    Ok(meta.len())
}

pub fn open_output_db(path: &str) -> Result<Connection> {
    if !std::path::Path::new(path).exists() {
        anyhow::bail!("Output database not found: {path}");
    }

    let conn = Connection::open(path)?;
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        ",
    )?;
    Ok(conn)
}

pub fn clear_embeddings(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM model_info", [])?;
    conn.execute("DELETE FROM embeddings", [])?;
    Ok(())
}

#[derive(Serialize, Deserialize)]
struct EmbeddingRecord {
    node_id: i64,
    embedding: Vec<f32>,
}

pub fn write_embeddings_jsonl_batch(
    writer: &mut dyn Write,
    node_ids: &[i64],
    embeddings: &[Vec<f32>],
) -> Result<()> {
    assert_eq!(node_ids.len(), embeddings.len());

    for (node_id, embedding) in node_ids.iter().zip(embeddings.iter()) {
        let record = EmbeddingRecord {
            node_id: *node_id,
            embedding: embedding.clone(),
        };
        serde_json::to_writer(&mut *writer, &record)?;
        writer.write_all(b"\n")?;
    }

    Ok(())
}

pub fn load_embeddings_from_jsonl(conn: &Connection, jsonl_path: &std::path::Path) -> Result<usize> {
    let file = std::fs::File::open(jsonl_path)?;
    let reader = BufReader::new(file);

    let tx = conn.unchecked_transaction()?;
    let mut count = 0;
    {
        let mut stmt = tx.prepare("INSERT INTO embeddings (node_id, embedding) VALUES (?1, ?2)")?;

        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let record: EmbeddingRecord = serde_json::from_str(&line)?;

            // Convert Vec<f32> to bytes for BLOB
            let bytes: Vec<u8> = record
                .embedding
                .iter()
                .flat_map(|&f| f.to_le_bytes())
                .collect();

            stmt.execute(rusqlite::params![record.node_id, bytes])?;
            count += 1;
        }
    }
    tx.commit()?;

    Ok(count)
}
