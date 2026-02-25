use anyhow::Result;
use polars::prelude::*;

use crate::db::reader::{
    AuthorityRow, ConstitutionRow, CourtRow, DocumentRow, PopularNameRow, VirginiaCodeRow,
};
use crate::text::html::strip_html;

/// Cleaned DataFrames ready for node building.
/// Each DataFrame has at minimum an `id` column and a `clean_text` column.
pub struct CleanedData {
    pub virginia_code: DataFrame,
    pub constitution: DataFrame,
    pub authorities: DataFrame,
    pub courts: DataFrame,
    pub popular_names: DataFrame,
    pub documents: DataFrame,
}

/// Run the full ETL pipeline on raw rows from virginia.db.
pub fn run_etl(
    code_rows: &[VirginiaCodeRow],
    constitution_rows: &[ConstitutionRow],
    authority_rows: &[AuthorityRow],
    court_rows: &[CourtRow],
    popular_name_rows: &[PopularNameRow],
    document_rows: &[DocumentRow],
) -> Result<CleanedData> {
    let virginia_code = clean_virginia_code(code_rows)?;
    let constitution = clean_constitution(constitution_rows)?;
    let authorities = clean_authorities(authority_rows)?;
    let courts = clean_courts(court_rows)?;
    let popular_names = clean_popular_names(popular_name_rows)?;
    let documents = clean_documents(document_rows)?;

    Ok(CleanedData {
        virginia_code,
        constitution,
        authorities,
        courts,
        popular_names,
        documents,
    })
}

/// Apply strip_html to every element of a string Column.
fn strip_html_column(col: &Column) -> PolarsResult<Option<Column>> {
    let ca = col.str()?;
    let out: StringChunked = ca
        .into_iter()
        .map(|opt_val| opt_val.map(|v| strip_html(v)))
        .collect();
    Ok(Some(out.into_column()))
}

// --- Virginia Code ---

fn clean_virginia_code(rows: &[VirginiaCodeRow]) -> Result<DataFrame> {
    let ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
    let sections: Vec<&str> = rows.iter().map(|r| r.section.as_str()).collect();
    let title_nums: Vec<&str> = rows.iter().map(|r| r.title_num.as_str()).collect();
    let title_names: Vec<&str> = rows.iter().map(|r| r.title_name.as_str()).collect();
    let chapter_nums: Vec<&str> = rows.iter().map(|r| r.chapter_num.as_str()).collect();
    let chapter_names: Vec<&str> = rows.iter().map(|r| r.chapter_name.as_str()).collect();
    let titles: Vec<&str> = rows.iter().map(|r| r.title.as_str()).collect();
    let bodies: Vec<&str> = rows.iter().map(|r| r.body.as_str()).collect();

    let df = DataFrame::new(vec![
        Column::new("id".into(), ids),
        Column::new("section".into(), sections),
        Column::new("title_num".into(), title_nums),
        Column::new("title_name".into(), title_names),
        Column::new("chapter_num".into(), chapter_nums),
        Column::new("chapter_name".into(), chapter_names),
        Column::new("title_raw".into(), titles),
        Column::new("body_raw".into(), bodies),
    ])?;

    let result = df
        .lazy()
        .with_columns([
            col("title_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("title_clean"),
            col("body_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("body_clean"),
        ])
        .with_column(
            (col("title_name")
                + lit(" | ")
                + col("chapter_name")
                + lit(" | ")
                + col("title_clean")
                + lit(" ")
                + col("body_clean"))
            .alias("clean_text"),
        )
        .filter(col("section").str().len_chars().gt(lit(0)))
        .filter(col("clean_text").str().len_chars().gt(lit(20)))
        .unique(Some(vec!["clean_text".into()]), UniqueKeepStrategy::First)
        .select([
            col("id"),
            col("section"),
            col("title_num"),
            col("chapter_num"),
            col("title_name"),
            col("chapter_name"),
            col("clean_text"),
        ])
        .collect()?;

    Ok(result)
}

// --- Constitution ---

fn clean_constitution(rows: &[ConstitutionRow]) -> Result<DataFrame> {
    let ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
    let article_ids: Vec<i64> = rows.iter().map(|r| r.article_id).collect();
    let article_names: Vec<&str> = rows.iter().map(|r| r.article_name.as_str()).collect();
    let section_names: Vec<&str> = rows.iter().map(|r| r.section_name.as_str()).collect();
    let section_titles: Vec<&str> = rows.iter().map(|r| r.section_title.as_str()).collect();
    let section_texts: Vec<&str> = rows.iter().map(|r| r.section_text.as_str()).collect();
    let section_counts: Vec<i64> = rows.iter().map(|r| r.section_count).collect();

    let df = DataFrame::new(vec![
        Column::new("id".into(), ids),
        Column::new("article_id".into(), article_ids),
        Column::new("article_name".into(), article_names),
        Column::new("section_name_raw".into(), section_names),
        Column::new("section_title_raw".into(), section_titles),
        Column::new("section_text_raw".into(), section_texts),
        Column::new("section_count".into(), section_counts),
    ])?;

    let result = df
        .lazy()
        .with_columns([
            col("section_name_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("section_name_clean"),
            col("section_title_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("section_title_clean"),
            col("section_text_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("section_text_clean"),
        ])
        .with_column(
            (col("article_name")
                + lit(" | ")
                + col("section_name_clean")
                + lit(" ")
                + col("section_title_clean")
                + lit(" ")
                + col("section_text_clean"))
            .alias("clean_text"),
        )
        .filter(col("section_text_clean").str().len_chars().gt(lit(0)))
        .select([
            col("id"),
            col("article_id"),
            col("article_name"),
            col("section_count"),
            col("clean_text"),
        ])
        .collect()?;

    Ok(result)
}

// --- Authorities ---

fn clean_authorities(rows: &[AuthorityRow]) -> Result<DataFrame> {
    let ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
    let short_names: Vec<&str> = rows.iter().map(|r| r.short_name.as_str()).collect();
    let titles: Vec<&str> = rows.iter().map(|r| r.title.as_str()).collect();
    let bodies: Vec<&str> = rows.iter().map(|r| r.body.as_str()).collect();

    let df = DataFrame::new(vec![
        Column::new("id".into(), ids),
        Column::new("short_name".into(), short_names),
        Column::new("title_raw".into(), titles),
        Column::new("body_raw".into(), bodies),
    ])?;

    let result = df
        .lazy()
        .with_columns([
            col("title_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("title_clean"),
            col("body_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("body_clean"),
        ])
        .with_column(
            (col("title_clean") + lit(" ") + col("body_clean")).alias("clean_text"),
        )
        .filter(col("short_name").str().len_chars().gt(lit(0)))
        .filter(col("clean_text").str().len_chars().gt(lit(10)))
        .select([col("id"), col("short_name"), col("clean_text")])
        .collect()?;

    Ok(result)
}

// --- Courts ---

fn clean_courts(rows: &[CourtRow]) -> Result<DataFrame> {
    let ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
    let names: Vec<&str> = rows.iter().map(|r| r.name.as_str()).collect();
    let localities: Vec<&str> = rows.iter().map(|r| r.locality.as_str()).collect();
    let court_types: Vec<&str> = rows.iter().map(|r| r.court_type.as_str()).collect();
    let districts: Vec<&str> = rows.iter().map(|r| r.district.as_str()).collect();
    let cities: Vec<&str> = rows.iter().map(|r| r.city.as_str()).collect();

    let df = DataFrame::new(vec![
        Column::new("id".into(), ids),
        Column::new("name".into(), names),
        Column::new("locality".into(), localities),
        Column::new("court_type".into(), court_types),
        Column::new("district".into(), districts),
        Column::new("city".into(), cities),
    ])?;

    let result = df
        .lazy()
        .with_column(
            (col("name")
                + lit(" ")
                + col("locality")
                + lit(" ")
                + col("court_type")
                + lit(" ")
                + col("district")
                + lit(" ")
                + col("city"))
            .alias("clean_text"),
        )
        .select([col("id"), col("clean_text")])
        .collect()?;

    Ok(result)
}

// --- Popular Names ---

fn clean_popular_names(rows: &[PopularNameRow]) -> Result<DataFrame> {
    let ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
    let names: Vec<&str> = rows.iter().map(|r| r.name.as_str()).collect();
    let bodies: Vec<&str> = rows.iter().map(|r| r.body.as_str()).collect();

    let df = DataFrame::new(vec![
        Column::new("id".into(), ids),
        Column::new("name".into(), names),
        Column::new("body_raw".into(), bodies),
    ])?;

    let result = df
        .lazy()
        .with_column(
            col("body_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("body_clean"),
        )
        .with_column(
            (col("name") + lit(" ") + col("body_clean")).alias("clean_text"),
        )
        .filter(col("name").str().len_chars().gt(lit(0)))
        .filter(col("clean_text").str().len_chars().gt(lit(10)))
        .select([col("id"), col("name"), col("clean_text")])
        .collect()?;

    Ok(result)
}

// --- Documents ---

fn clean_documents(rows: &[DocumentRow]) -> Result<DataFrame> {
    let ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
    let filenames: Vec<&str> = rows.iter().map(|r| r.filename.as_str()).collect();
    let titles: Vec<&str> = rows.iter().map(|r| r.title.as_str()).collect();
    let contents: Vec<&str> = rows.iter().map(|r| r.content.as_str()).collect();

    let df = DataFrame::new(vec![
        Column::new("id".into(), ids),
        Column::new("filename".into(), filenames),
        Column::new("title_raw".into(), titles),
        Column::new("content_raw".into(), contents),
    ])?;

    let result = df
        .lazy()
        .with_columns([
            col("title_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("title_clean"),
            col("content_raw")
                .map(|s| strip_html_column(&s), GetOutput::from_type(DataType::String))
                .alias("content_clean"),
        ])
        .with_column(
            (col("title_clean") + lit(" ") + col("content_clean")).alias("clean_text"),
        )
        .filter(col("filename").str().len_chars().gt(lit(0)))
        .select([col("id"), col("filename"), col("clean_text")])
        .collect()?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_virginia_code_dedup() {
        let rows = vec![
            VirginiaCodeRow {
                id: 1,
                title_num: "1".into(),
                title_name: "Title One".into(),
                chapter_num: "1".into(),
                chapter_name: "Chapter One".into(),
                section: "1-1".into(),
                title: "<b>Active Section</b>".into(),
                body: "<p>Some substantive content here.</p>".into(),
            },
            VirginiaCodeRow {
                id: 2,
                title_num: "1".into(),
                title_name: "Title One".into(),
                chapter_num: "2".into(),
                chapter_name: "Chapter Two".into(),
                section: "1-2".into(),
                title: "Repealed".into(),
                body: "".into(),
            },
            VirginiaCodeRow {
                id: 3,
                title_num: "1".into(),
                title_name: "Title One".into(),
                chapter_num: "3".into(),
                chapter_name: "Chapter Three".into(),
                section: "1-3".into(),
                title: "Repealed".into(),
                body: "".into(),
            },
        ];

        let result = clean_virginia_code(&rows).unwrap();
        assert!(result.height() <= rows.len());
        assert!(result.height() >= 1);
    }

    #[test]
    fn test_clean_courts() {
        let rows = vec![CourtRow {
            id: 1,
            name: "Circuit Court".into(),
            locality: "Fairfax".into(),
            court_type: "Circuit".into(),
            district: "19th".into(),
            address: "4110 Chain Bridge Rd".into(),
            city: "Fairfax".into(),
            state: "VA".into(),
            zip: "22030".into(),
        }];

        let result = clean_courts(&rows).unwrap();
        assert_eq!(result.height(), 1);
        let text = result
            .column("clean_text")
            .unwrap()
            .str()
            .unwrap()
            .get(0)
            .unwrap();
        assert!(text.contains("Circuit Court"));
        assert!(text.contains("Fairfax"));
    }
}
