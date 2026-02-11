/**
 * Citation Formatter Service
 *
 * Formats legal and academic citations in various styles:
 * - Bluebook (legal standard, 21st Edition)
 * - APA (American Psychological Association, 7th Edition)
 * - MLA (Modern Language Association, 9th Edition)
 * - Chicago (Chicago Manual of Style, 17th Edition)
 *
 * Optimized for legal research: supports cases, statutes, regulations,
 * constitutions, court rules, legislative materials, short forms, and
 * subsequent history.
 */

export type CitationStyle = "bluebook" | "apa" | "mla" | "chicago";

export type SourceType =
    | "case"
    | "statute"
    | "regulation"
    | "constitution"
    | "court_rule"
    | "legislative"
    | "secondary"
    | "unknown";

export interface CitationSource {
    title: string;
    url?: string;
    author?: string;
    date?: string;
    year?: string;

    // Case fields
    court?: string;
    reporter?: string;
    volume?: string;
    page?: string;
    pincite?: string;
    caseNumber?: string;
    subsequentHistory?: string; // e.g. "aff'd", "rev'd", "cert. denied"
    subsequentCitation?: string; // e.g. "550 U.S. 1 (2007)"
    parallelCite?: string; // e.g. "128 S. Ct. 999"

    // Statute fields
    statute?: string; // e.g. "42 U.S.C.", "Va. Code Ann."
    section?: string;

    // Regulation fields
    regulationTitle?: string; // e.g. "44"
    regulationSource?: string; // e.g. "C.F.R.", "Va. Admin. Code"
    regulationPart?: string;
    regulationSection?: string;

    // Constitution fields
    constitution?: string; // e.g. "U.S. Const.", "Va. Const."
    article?: string;
    amendment?: string;
    clause?: string;

    // Court rule fields
    ruleSource?: string; // e.g. "Fed. R. Civ. P.", "Va. Sup. Ct. R."
    ruleNumber?: string;

    // Legislative material fields
    billNumber?: string; // e.g. "H.R. 1234", "S. 567"
    congress?: string; // e.g. "118th Cong."
    session?: string;
    legislativeType?: string; // "bill", "resolution", "report", "hearing"
    committee?: string;
}

/**
 * Detect the source type from the fields populated on a CitationSource.
 */
export function detectSourceType(source: CitationSource): SourceType {
    if (source.constitution || source.amendment || source.article) return "constitution";
    if (source.ruleSource || source.ruleNumber) return "court_rule";
    if (source.regulationSource || source.regulationTitle) return "regulation";
    if (source.billNumber || source.legislativeType) return "legislative";
    if (source.statute && source.section) return "statute";
    if (source.reporter && source.volume) return "case";
    if (source.author) return "secondary";
    return "unknown";
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Format a citation in the specified style.
 */
export function formatCitation(source: CitationSource, style: CitationStyle): string {
    switch (style) {
        case "bluebook":
            return formatBluebook(source);
        case "apa":
            return formatAPA(source);
        case "mla":
            return formatMLA(source);
        case "chicago":
            return formatChicago(source);
        default:
            return formatBluebook(source);
    }
}

/**
 * Generate an "Id." or "Id. at [pincite]" short-form citation.
 * Use when the immediately preceding citation is the same source.
 */
export function formatId(pincite?: string): string {
    return pincite ? `*Id.* at ${pincite}` : "*Id.*";
}

/**
 * Generate a "supra" short-form citation.
 * Use for secondary sources previously cited in full.
 *   e.g.  Smith, supra note 3, at 45.
 */
export function formatSupra(author: string, noteNumber: number, pincite?: string): string {
    const base = `${author}, *supra* note ${noteNumber}`;
    return pincite ? `${base}, at ${pincite}.` : `${base}.`;
}

/**
 * Generate a short-form case citation.
 *   e.g.  *Roe*, 410 U.S. at 113.
 */
export function formatShortCase(shortName: string, volume: string, reporter: string, pincite: string): string {
    return `*${shortName}*, ${volume} ${reporter} at ${pincite}`;
}

/**
 * Extract citations from research context items.
 */
export function extractCitations(
    contextItems: Array<{
        type: string;
        title: string;
        citation?: string;
        summary?: string;
    }>,
    style: CitationStyle,
): string[] {
    return contextItems
        .filter((item) => item.citation || item.title)
        .map((item) => {
            if (item.citation) return item.citation;
            return formatCitation({ title: item.title }, style);
        });
}

/**
 * Create a bibliography / works-cited / table-of-authorities section.
 */
export function generateBibliography(citations: string[], style: CitationStyle): string {
    const header =
        style === "bluebook"
            ? "Table of Authorities"
            : style === "apa"
                ? "References"
                : style === "mla"
                    ? "Works Cited"
                    : "Bibliography";

    let output = `\n\n## ${header}\n\n`;

    // Bluebook Table of Authorities groups by type and uses numbered footnotes
    citations.forEach((citation, index) => {
        if (style === "bluebook") {
            output += `${index + 1}. ${citation}\n\n`;
        } else {
            output += `${citation}\n\n`;
        }
    });

    return output;
}

// ─── Bluebook (21st Ed.) ─────────────────────────────────────────────────────

function formatBluebook(source: CitationSource): string {
    const type = detectSourceType(source);

    switch (type) {
        case "case":
            return formatBluebookCase(source);
        case "statute":
            return formatBluebookStatute(source);
        case "regulation":
            return formatBluebookRegulation(source);
        case "constitution":
            return formatBluebookConstitution(source);
        case "court_rule":
            return formatBluebookCourtRule(source);
        case "legislative":
            return formatBluebookLegislative(source);
        case "secondary":
            return formatBluebookSecondary(source);
        default:
            return formatBluebookFallback(source);
    }
}

/**
 * Bluebook Rule 10: Cases
 *   *Case Name*, Volume Reporter Page, Pincite (Court Year), subsequent history.
 *   e.g. *Marbury v. Madison*, 5 U.S. (1 Cranch) 137, 177 (1803).
 */
function formatBluebookCase(source: CitationSource): string {
    const parts: string[] = [];

    // Case name in italics (Rule 2.1)
    parts.push(`*${source.title}*,`);

    // Reporter cite
    parts.push(`${source.volume} ${source.reporter} ${source.page}`);

    // Pincite
    if (source.pincite) {
        parts[parts.length - 1] += `,`;
        parts.push(source.pincite);
    }

    // Parenthetical: (Court Year)
    const year = source.year || extractYearFromDate(source.date);
    const court = source.court || "";
    // Omit court name when the reporter unambiguously identifies it (e.g. U.S. Reports)
    const courtStr = court && !isUnambiguousReporter(source.reporter || "") ? `${court} ` : "";
    parts.push(`(${courtStr}${year})`);

    // Parallel cite
    if (source.parallelCite) {
        parts[parts.length - 1] += ",";
        parts.push(source.parallelCite);
    }

    // Subsequent history (Rule 10.7)
    if (source.subsequentHistory) {
        parts[parts.length - 1] += ",";
        const historyPhrase = SUBSEQUENT_HISTORY_ABBREVS[source.subsequentHistory] || source.subsequentHistory;
        const histCite = source.subsequentCitation ? `, ${source.subsequentCitation}` : "";
        parts.push(`${historyPhrase}${histCite}`);
    }

    return joinAndTerminate(parts);
}

/**
 * Bluebook Rule 12: Statutes
 *   Title Source § Section (Year).
 *   e.g. 42 U.S.C. § 1983 (2018).
 *   e.g. Va. Code Ann. § 8.01-271.1 (2023).
 */
function formatBluebookStatute(source: CitationSource): string {
    const year = source.year || extractYearFromDate(source.date);
    const yearStr = year ? ` (${year})` : "";
    return `${source.statute} § ${source.section}${yearStr}.`;
}

/**
 * Bluebook Rule 14.2: Regulations (C.F.R.)
 *   Title C.F.R. § Section (Year).
 *   e.g. 44 C.F.R. § 206.110 (2024).
 */
function formatBluebookRegulation(source: CitationSource): string {
    const regSource = source.regulationSource || "C.F.R.";
    const part = source.regulationSection || source.regulationPart || "";
    const year = source.year || extractYearFromDate(source.date);
    const yearStr = year ? ` (${year})` : "";

    if (source.regulationTitle) {
        return `${source.regulationTitle} ${regSource} § ${part}${yearStr}.`;
    }
    return `${regSource} § ${part}${yearStr}.`;
}

/**
 * Bluebook Rule 11: Constitutions
 *   U.S. Const. amend. XIV, § 1.
 *   Va. Const. art. I, § 8.
 */
function formatBluebookConstitution(source: CitationSource): string {
    const constName = source.constitution || "U.S. Const.";
    const parts: string[] = [constName];

    if (source.amendment) {
        parts.push(`amend. ${source.amendment}`);
    }
    if (source.article) {
        parts.push(`art. ${source.article}`);
    }
    if (source.section) {
        parts.push(`§ ${source.section}`);
    }
    if (source.clause) {
        parts.push(`cl. ${source.clause}`);
    }

    return parts.join(", ") + ".";
}

/**
 * Bluebook Rule 12.9.3: Court Rules
 *   Fed. R. Civ. P. 12(b)(6).
 *   Va. Sup. Ct. R. 3A:15.
 */
function formatBluebookCourtRule(source: CitationSource): string {
    const ruleSource = source.ruleSource || "";
    const ruleNumber = source.ruleNumber || "";
    return `${ruleSource} ${ruleNumber}`.trim() + ".";
}

/**
 * Bluebook Rule 13: Legislative Materials
 *   H.R. 1234, 118th Cong. (2024).
 *   S. Rep. No. 105-190, at 12 (1998).
 */
function formatBluebookLegislative(source: CitationSource): string {
    const parts: string[] = [];

    if (source.billNumber) {
        parts.push(source.billNumber);
    } else if (source.title) {
        parts.push(source.title);
    }

    if (source.congress) {
        parts.push(source.congress);
    }
    if (source.session) {
        parts.push(source.session);
    }
    if (source.pincite) {
        parts.push(`at ${source.pincite}`);
    }

    const year = source.year || extractYearFromDate(source.date);
    if (year) {
        parts.push(`(${year})`);
    }

    return joinAndTerminate(parts, ",");
}

/**
 * Bluebook Rule 15-16: Secondary Sources (books, articles, reports)
 *   Author, *Title* Page (Edition Year).
 */
function formatBluebookSecondary(source: CitationSource): string {
    const parts: string[] = [];

    parts.push(source.author || "");
    parts.push(`*${source.title}*`);

    if (source.pincite) {
        parts.push(source.pincite);
    }

    const year = source.year || extractYearFromDate(source.date);
    if (year) {
        parts.push(`(${year})`);
    }

    return joinAndTerminate(parts, ",");
}

function formatBluebookFallback(source: CitationSource): string {
    const year = source.year || extractYearFromDate(source.date);
    if (source.url) {
        const dateStr = source.date ? ` (${source.date})` : year ? ` (${year})` : "";
        return `${source.title}${dateStr}, ${source.url}.`;
    }
    return year ? `${source.title} (${year}).` : `${source.title}.`;
}

// ─── APA (7th Ed.) ───────────────────────────────────────────────────────────

function formatAPA(source: CitationSource): string {
    const type = detectSourceType(source);

    if (type === "case") {
        // APA 10.19: Case Name, Volume Reporter Page (Court Year). URL
        const parts: string[] = [];
        parts.push(italicize(source.title) + ",");
        parts.push(`${source.volume} ${source.reporter} ${source.page}`);
        if (source.pincite) parts[parts.length - 1] += `, ${source.pincite}`;
        const year = source.year || extractYearFromDate(source.date);
        const court = source.court || "";
        parts.push(`(${court ? court + " " : ""}${year}).`);
        if (source.url) parts.push(source.url);
        return parts.join(" ");
    }

    if (type === "statute") {
        // APA 11.5: Name of Act, Title Source § Section (Year). URL
        const year = source.year || extractYearFromDate(source.date);
        const base = source.title !== source.statute
            ? `${source.title}, ${source.statute} § ${source.section}`
            : `${source.statute} § ${source.section}`;
        const cite = year ? `${base} (${year}).` : `${base}.`;
        return source.url ? `${cite} ${source.url}` : cite;
    }

    // Generic: Author (Year). Title. Source. URL
    const parts: string[] = [];
    if (source.author) parts.push(formatAuthorAPA(source.author));
    const year = source.year || extractYearFromDate(source.date);
    if (year) parts.push(`(${year}).`);
    parts.push(italicize(source.title) + ".");
    if (source.court) parts.push(source.court + ".");
    else if (source.reporter) parts.push(`${source.volume} ${source.reporter} ${source.page}.`);
    if (source.url) parts.push(source.url);
    return parts.join(" ");
}

// ─── MLA (9th Ed.) ───────────────────────────────────────────────────────────

function formatMLA(source: CitationSource): string {
    const parts: string[] = [];

    if (source.author) parts.push(formatAuthorMLA(source.author) + ".");

    // Title quoted for articles, italicized for books
    const type = detectSourceType(source);
    if (type === "case" || type === "secondary") {
        parts.push(`"${source.title}."`);
    } else {
        parts.push(italicize(source.title) + ".");
    }

    if (source.reporter) {
        const citation = `${source.volume} ${source.reporter} ${source.page}`;
        parts.push(citation + ",");
    } else if (source.court) {
        parts.push(source.court + ",");
    }

    const date = source.date || source.year;
    if (date) parts.push(formatDateMLA(date) + ".");
    if (source.url) parts.push(source.url + ".");

    return parts.join(" ");
}

// ─── Chicago (17th Ed.) ──────────────────────────────────────────────────────

function formatChicago(source: CitationSource): string {
    const parts: string[] = [];

    if (source.author) parts.push(formatAuthorChicago(source.author) + ".");

    parts.push(italicize(source.title) + ".");

    if (source.reporter) {
        parts.push(`${source.volume} ${source.reporter} ${source.page}.`);
    } else if (source.court) {
        parts.push(source.court + ".");
    }

    const year = source.year || extractYearFromDate(source.date);
    if (year) parts.push(year + ".");

    return parts.join(" ");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Subsequent-history abbreviations per Bluebook Table T8.
 */
const SUBSEQUENT_HISTORY_ABBREVS: Record<string, string> = {
    "aff'd": "*aff'd*",
    "rev'd": "*rev'd*",
    "cert. denied": "*cert. denied*",
    "cert. granted": "*cert. granted*",
    "vacated": "*vacated*",
    "overruled": "*overruled by*",
    "modified": "*modified*",
    "reh'g denied": "*reh'g denied*",
    "reh'g granted": "*reh'g granted*",
    "remanded": "*remanded*",
    "on remand": "*on remand*",
};

/**
 * Reporters that unambiguously identify the court, per Bluebook Rule 10.4(a).
 * When citing these, the court name is omitted from the parenthetical.
 */
function isUnambiguousReporter(reporter: string): boolean {
    const unambiguous = [
        "U.S.",
        "S. Ct.",
        "L. Ed.",
        "L. Ed. 2d",
        "Va.",
        "Va. App.",
        "S.E.",
        "S.E.2d",
    ];
    return unambiguous.some((r) => reporter.includes(r));
}

function formatAuthorAPA(author: string): string {
    const names = author.split(" ");
    if (names.length === 1) return author;
    const lastName = names[names.length - 1];
    const initials = names
        .slice(0, -1)
        .map((n) => n.charAt(0).toUpperCase() + ".")
        .join(" ");
    return `${lastName}, ${initials}`;
}

function formatAuthorMLA(author: string): string {
    const names = author.split(" ");
    if (names.length === 1) return author;
    const lastName = names[names.length - 1];
    const firstName = names.slice(0, -1).join(" ");
    return `${lastName}, ${firstName}`;
}

function formatAuthorChicago(author: string): string {
    return formatAuthorMLA(author);
}

function extractYearFromDate(date?: string): string {
    if (!date) return "";
    const yearMatch = date.match(/\d{4}/);
    return yearMatch ? yearMatch[0] : "";
}

function formatDateMLA(date: string): string {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return date;
        const months = [
            "Jan.", "Feb.", "Mar.", "Apr.", "May", "June",
            "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec.",
        ];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
        return date;
    }
}

function italicize(text: string): string {
    return `*${text}*`;
}

/**
 * Join parts with a separator and ensure the result ends with a period.
 */
function joinAndTerminate(parts: string[], separator = " "): string {
    const result = parts.filter(Boolean).join(separator).replace(/,\s*,/g, ",");
    return result.endsWith(".") ? result : result + ".";
}
