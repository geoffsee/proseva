#![allow(dead_code)]

use anyhow::Result;
use rusqlite::Connection;

#[derive(Debug, Clone)]
pub struct VirginiaCodeRow {
    pub id: i64,
    pub title_num: String,
    pub title_name: String,
    pub chapter_num: String,
    pub chapter_name: String,
    pub section: String,
    pub title: String,
    pub body: String,
}

#[derive(Debug, Clone)]
pub struct ConstitutionRow {
    pub id: i64,
    pub article_id: i64,
    pub article: String,
    pub article_name: String,
    pub section_name: String,
    pub section_title: String,
    pub section_text: String,
    pub section_count: i64,
}

#[derive(Debug, Clone)]
pub struct AuthorityRow {
    pub id: i64,
    pub name: String,
    pub short_name: String,
    pub codified: String,
    pub title: String,
    pub section: String,
    pub body: String,
}

#[derive(Debug, Clone)]
pub struct CourtRow {
    pub id: i64,
    pub name: String,
    pub locality: String,
    pub court_type: String,
    pub district: String,
    pub address: String,
    pub city: String,
    pub state: String,
    pub zip: String,
}

#[derive(Debug, Clone)]
pub struct PopularNameRow {
    pub id: i64,
    pub name: String,
    pub title_num: String,
    pub section: String,
    pub body: String,
}

#[derive(Debug, Clone)]
pub struct DocumentRow {
    pub id: i64,
    pub dataset: String,
    pub filename: String,
    pub title: String,
    pub content: String,
}

pub fn read_virginia_code(conn: &Connection) -> Result<Vec<VirginiaCodeRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, COALESCE(title_num,''), COALESCE(title_name,''),
                COALESCE(chapter_num,''), COALESCE(chapter_name,''),
                COALESCE(section,''), COALESCE(title,''), COALESCE(body,'')
         FROM virginia_code",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(VirginiaCodeRow {
            id: row.get(0)?,
            title_num: row.get(1)?,
            title_name: row.get(2)?,
            chapter_num: row.get(3)?,
            chapter_name: row.get(4)?,
            section: row.get(5)?,
            title: row.get(6)?,
            body: row.get(7)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn read_constitution(conn: &Connection) -> Result<Vec<ConstitutionRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, COALESCE(article_id,0), COALESCE(article,''), COALESCE(article_name,''),
                COALESCE(section_name,''), COALESCE(section_title,''),
                COALESCE(section_text,''), COALESCE(section_count,0)
         FROM constitution",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ConstitutionRow {
            id: row.get(0)?,
            article_id: row.get(1)?,
            article: row.get(2)?,
            article_name: row.get(3)?,
            section_name: row.get(4)?,
            section_title: row.get(5)?,
            section_text: row.get(6)?,
            section_count: row.get(7)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn read_authorities(conn: &Connection) -> Result<Vec<AuthorityRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, COALESCE(name,''), COALESCE(short_name,''), COALESCE(codified,''),
                COALESCE(title,''), COALESCE(section,''), COALESCE(body,'')
         FROM authorities",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(AuthorityRow {
            id: row.get(0)?,
            name: row.get(1)?,
            short_name: row.get(2)?,
            codified: row.get(3)?,
            title: row.get(4)?,
            section: row.get(5)?,
            body: row.get(6)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn read_courts(conn: &Connection) -> Result<Vec<CourtRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, COALESCE(name,''), COALESCE(locality,''), COALESCE(type,''),
                COALESCE(district,''), COALESCE(address,''), COALESCE(city,''),
                COALESCE(state,''), COALESCE(zip,'')
         FROM courts",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CourtRow {
            id: row.get(0)?,
            name: row.get(1)?,
            locality: row.get(2)?,
            court_type: row.get(3)?,
            district: row.get(4)?,
            address: row.get(5)?,
            city: row.get(6)?,
            state: row.get(7)?,
            zip: row.get(8)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn read_popular_names(conn: &Connection) -> Result<Vec<PopularNameRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, COALESCE(name,''), COALESCE(title_num,''),
                COALESCE(section,''), COALESCE(body,'')
         FROM popular_names",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(PopularNameRow {
            id: row.get(0)?,
            name: row.get(1)?,
            title_num: row.get(2)?,
            section: row.get(3)?,
            body: row.get(4)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn read_documents(conn: &Connection) -> Result<Vec<DocumentRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, COALESCE(dataset,''), COALESCE(filename,''),
                COALESCE(title,''), COALESCE(content,'')
         FROM documents",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(DocumentRow {
            id: row.get(0)?,
            dataset: row.get(1)?,
            filename: row.get(2)?,
            title: row.get(3)?,
            content: row.get(4)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}
