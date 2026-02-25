//! Standalone binary to generate a small test virginia.db for benchmarking.
//! Run with: cargo run --bin generate-fixtures

use rusqlite::{params, Connection};
use std::path::PathBuf;

fn main() {
    let path: PathBuf = [env!("CARGO_MANIFEST_DIR"), "fixtures", "test-virginia.db"]
        .iter()
        .collect();

    if path.exists() {
        std::fs::remove_file(&path).unwrap();
    }

    let db = Connection::open(&path).unwrap();
    db.execute_batch("PRAGMA journal_mode=WAL;").unwrap();

    // ── virginia_code ───────────────────────────────────────────────────
    db.execute_batch(
        "CREATE TABLE virginia_code (
            id          INTEGER PRIMARY KEY,
            title_num   TEXT,
            title_name  TEXT,
            chapter_num TEXT,
            chapter_name TEXT,
            section     TEXT,
            title       TEXT,
            body        TEXT
        )",
    )
    .unwrap();

    let code_rows: &[(i64, &str, &str, &str, &str, &str, &str, &str)] = &[
        (1, "1", "General Provisions", "1", "Common Law", "1-200",
         "Rule of construction",
         "The common law of England, insofar as it is not repugnant to the principles of the Bill of Rights and Constitution of this Commonwealth, shall continue in full force."),
        (2, "1", "General Provisions", "1", "Common Law", "1-200.1",
         "Certain combative fighting not unlawful",
         "Combative fighting by combatants in combative fighting events that are regulated and conducted shall not be unlawful."),
        (3, "2.2", "Administration of Government", "1", "In General", "2.2-100",
         "Short title",
         "This title may be cited as the Virginia Freedom of Information Act."),
        (4, "2.2", "Administration of Government", "2", "Governor", "2.2-200",
         "Powers of the Governor",
         "The Governor shall take care that the laws be faithfully executed. The Governor may make executive orders."),
        (5, "8.01", "Civil Remedies and Procedure", "3", "Limitations", "8.01-230",
         "Personal actions based on contracts",
         "Every action for which a limitation period is prescribed shall be brought within the limitation period after the cause of action accrues."),
        (6, "8.01", "Civil Remedies and Procedure", "3", "Limitations", "8.01-243",
         "Personal injuries; property damage",
         "Every action for personal injuries shall be brought within two years after the cause of action accrues. See § 8.01-230."),
        (7, "18.2", "Crimes and Offenses Generally", "4", "Crimes Against the Person", "18.2-31",
         "Capital murder defined",
         "The following offenses shall constitute capital murder, punishable as a Class 1 felony: the willful, deliberate, and premeditated killing of any person."),
        (8, "18.2", "Crimes and Offenses Generally", "4", "Crimes Against the Person", "18.2-32",
         "First and second degree murder defined",
         "Murder, other than capital murder, by poison, lying in wait, imprisonment, starving, or by any willful, deliberate, and premeditated killing, shall be murder of the first degree."),
        (9, "46.2", "Motor Vehicles", "8", "Regulation of Traffic", "46.2-852",
         "Reckless driving; general rule",
         "Irrespective of the maximum speeds permitted by law, any person who drives a vehicle on any highway recklessly or at a speed or in a manner so as to endanger life, limb, or property shall be guilty of reckless driving."),
        (10, "46.2", "Motor Vehicles", "8", "Regulation of Traffic", "46.2-862",
         "Exceeding speed limit",
         "A person shall be guilty of reckless driving who drives a motor vehicle on the highways in the Commonwealth at a speed of twenty miles per hour or more in excess of the applicable maximum speed limit. See § 46.2-852."),
    ];
    for r in code_rows {
        db.execute(
            "INSERT INTO virginia_code VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7],
        )
        .unwrap();
    }

    // ── constitution ────────────────────────────────────────────────────
    db.execute_batch(
        "CREATE TABLE constitution (
            id            INTEGER PRIMARY KEY,
            article_id    INTEGER,
            article       TEXT,
            article_name  TEXT,
            section_name  TEXT,
            section_title TEXT,
            section_text  TEXT,
            section_count INTEGER
        )",
    )
    .unwrap();

    let const_rows: &[(i64, i64, &str, &str, &str, &str, &str, i64)] = &[
        (1, 1, "I", "Bill of Rights", "Section 1",
         "Equality and rights of men",
         "That all men are by nature equally free and independent and have certain inherent rights, of which, when they enter into a state of society, they cannot, by any compact, deprive or divest their posterity.",
         17),
        (2, 1, "I", "Bill of Rights", "Section 8",
         "Freedom of speech",
         "That the freedoms of speech and of the press are among the great bulwarks of liberty, and can never be restrained except by despotic governments.",
         17),
        (3, 2, "II", "Legislature", "Section 1",
         "Legislative power",
         "The legislative power of the Commonwealth shall be vested in a General Assembly, which shall consist of a Senate and House of Delegates.",
         7),
        (4, 3, "III", "Executive", "Section 1",
         "Executive power",
         "The chief executive power of the Commonwealth shall be vested in a Governor. See Article II for legislative interaction.",
         4),
        (5, 4, "IV", "Judiciary", "Section 1",
         "Judicial power",
         "The judicial power of the Commonwealth shall be vested in a Supreme Court and in such other courts of original or appellate jurisdiction as the General Assembly may establish.",
         10),
    ];
    for r in const_rows {
        db.execute(
            "INSERT INTO constitution VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7],
        )
        .unwrap();
    }

    // ── authorities ─────────────────────────────────────────────────────
    db.execute_batch(
        "CREATE TABLE authorities (
            id         INTEGER PRIMARY KEY,
            name       TEXT,
            short_name TEXT,
            codified   TEXT,
            title      TEXT,
            section    TEXT,
            body       TEXT
        )",
    )
    .unwrap();

    let auth_rows: &[(i64, &str, &str, &str, &str, &str, &str)] = &[
        (1, "Virginia Administrative Code", "VAC", "8VAC20-131",
         "Regulations Establishing Standards for Accrediting Public Schools",
         "8VAC20-131-10",
         "These regulations establish standards for accreditation of public schools in Virginia to ensure quality education."),
        (2, "Virginia Administrative Code", "VAC", "9VAC25-260",
         "Water Quality Standards",
         "9VAC25-260-10",
         "Water quality standards for surface waters in the Commonwealth of Virginia including designated uses and criteria."),
        (3, "Executive Order", "EO", "EO-12",
         "Executive Order Twelve",
         "EO-12-1",
         "Directing state agencies to develop comprehensive climate action plans in accordance with § 2.2-100."),
        (4, "Attorney General Opinion", "AG", "AG-2023-001",
         "Interpretation of FOIA Requirements",
         "AG-2023-001",
         "The Attorney General interprets the Virginia Freedom of Information Act (§ 2.2-100 et seq.) regarding electronic records."),
        (5, "Virginia Administrative Code", "VAC", "12VAC5-590",
         "Waterworks Regulations",
         "12VAC5-590-10",
         "Regulations governing waterworks and water supply in the Commonwealth, referencing 9VAC25-260 water quality standards."),
    ];
    for r in auth_rows {
        db.execute(
            "INSERT INTO authorities VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![r.0, r.1, r.2, r.3, r.4, r.5, r.6],
        )
        .unwrap();
    }

    // ── courts ──────────────────────────────────────────────────────────
    db.execute_batch(
        "CREATE TABLE courts (
            id        INTEGER PRIMARY KEY,
            name      TEXT,
            locality  TEXT,
            type      TEXT,
            district  TEXT,
            address   TEXT,
            city      TEXT,
            state     TEXT,
            zip       TEXT
        )",
    )
    .unwrap();

    let court_rows: &[(i64, &str, &str, &str, &str, &str, &str, &str, &str)] = &[
        (1, "Supreme Court of Virginia", "Richmond", "Supreme",
         "Statewide", "100 N 9th St", "Richmond", "VA", "23219"),
        (2, "Court of Appeals of Virginia", "Richmond", "Appellate",
         "Statewide", "109 N 8th St", "Richmond", "VA", "23219"),
        (3, "Fairfax County Circuit Court", "Fairfax", "Circuit",
         "19th", "4110 Chain Bridge Rd", "Fairfax", "VA", "22030"),
        (4, "Arlington County General District Court", "Arlington", "General District",
         "17th", "1425 N Courthouse Rd", "Arlington", "VA", "22201"),
        (5, "Virginia Beach Circuit Court", "Virginia Beach", "Circuit",
         "2nd", "2425 Nimmo Pkwy", "Virginia Beach", "VA", "23456"),
    ];
    for r in court_rows {
        db.execute(
            "INSERT INTO courts VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8],
        )
        .unwrap();
    }

    // ── popular_names ───────────────────────────────────────────────────
    db.execute_batch(
        "CREATE TABLE popular_names (
            id        INTEGER PRIMARY KEY,
            name      TEXT,
            title_num TEXT,
            section   TEXT,
            body      TEXT
        )",
    )
    .unwrap();

    let pop_rows: &[(i64, &str, &str, &str, &str)] = &[
        (1, "Virginia Freedom of Information Act", "2.2", "2.2-100",
         "The FOIA ensures public access to government records and meetings."),
        (2, "Virginia Consumer Protection Act", "59.1", "59.1-196",
         "Prohibits deceptive business practices and protects consumers."),
        (3, "Virginia Uniform Trade Secrets Act", "59.1", "59.1-336",
         "Provides remedies for misappropriation of trade secrets."),
        (4, "Dillon's Rule", "1", "1-200",
         "Local governments possess only powers expressly granted by the General Assembly."),
        (5, "Brady Rule", "18.2", "18.2-31",
         "Relates to capital murder statutes and due process requirements."),
    ];
    for r in pop_rows {
        db.execute(
            "INSERT INTO popular_names VALUES (?1,?2,?3,?4,?5)",
            params![r.0, r.1, r.2, r.3, r.4],
        )
        .unwrap();
    }

    // ── documents ───────────────────────────────────────────────────────
    db.execute_batch(
        "CREATE TABLE documents (
            id       INTEGER PRIMARY KEY,
            dataset  TEXT,
            filename TEXT,
            title    TEXT,
            content  TEXT
        )",
    )
    .unwrap();

    let doc_rows: &[(i64, &str, &str, &str, &str)] = &[
        (1, "case-law", "smith-v-commonwealth.txt",
         "Smith v. Commonwealth (2021)",
         "The defendant was convicted of reckless driving under § 46.2-852. The Court of Appeals affirmed, holding that the evidence was sufficient to prove endangerment. Cf. § 46.2-862 regarding speed-based reckless driving."),
        (2, "case-law", "jones-v-board.txt",
         "Jones v. Board of Education (2020)",
         "The petitioner challenged the school accreditation standards under 8VAC20-131. The Supreme Court of Virginia held the regulations were within the Board's statutory authority."),
        (3, "legislation", "hb-1234-summary.txt",
         "HB 1234 - Amendment to FOIA",
         "This bill amends § 2.2-100 of the Code of Virginia to expand electronic records access under the Freedom of Information Act."),
        (4, "legislation", "sb-567-summary.txt",
         "SB 567 - Water Quality Amendment",
         "This bill updates water quality standards referenced in 9VAC25-260, adding monitoring requirements for emerging contaminants."),
        (5, "case-law", "doe-v-city.txt",
         "Doe v. City of Fairfax (2022)",
         "The plaintiff brought a personal injury action under § 8.01-243 in the Fairfax County Circuit Court. The court applied the two-year statute of limitations under § 8.01-230."),
    ];
    for r in doc_rows {
        db.execute(
            "INSERT INTO documents VALUES (?1,?2,?3,?4,?5)",
            params![r.0, r.1, r.2, r.3, r.4],
        )
        .unwrap();
    }

    db.close().unwrap();

    let size = std::fs::metadata(&path).unwrap().len();
    println!("Created {}  ({} bytes)", path.display(), size);
    println!("  virginia_code:  {} rows", code_rows.len());
    println!("  constitution:   {} rows", const_rows.len());
    println!("  authorities:    {} rows", auth_rows.len());
    println!("  courts:         {} rows", court_rows.len());
    println!("  popular_names:  {} rows", pop_rows.len());
    println!("  documents:      {} rows", doc_rows.len());
    println!(
        "  total:          {} rows",
        code_rows.len() + const_rows.len() + auth_rows.len()
            + court_rows.len() + pop_rows.len() + doc_rows.len()
    );
}
