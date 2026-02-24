// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

interface Logger {
    level: LogLevel;
    error(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    info(...args: unknown[]): void;
    debug(...args: unknown[]): void;
}

const createLogger = (level: LogLevel = 'info'): Logger => ({
    level,
    error(...args) {
        if (['error'].includes(this.level)) console.error('[ERROR]', ...args);
    },
    warn(...args) {
        if (['error', 'warn'].includes(this.level)) console.warn('[WARN]', ...args);
    },
    info(...args) {
        if (['error', 'warn', 'info'].includes(this.level)) console.warn('[INFO]', ...args);
    },
    debug(...args) {
        if (['error', 'warn', 'info', 'debug'].includes(this.level)) console.debug('[DEBUG]', ...args);
    },
});

const log = createLogger('debug');

interface Court {
    name: string;
    locality: string;
    type: string;
    district: string | null;
    clerk: string | null;
    phone: string | null;
    phones?: Record<string, string>;
    fax: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string;
    zip: string | null;
    hours: string | null;
    homepage: string | null;
    judges: string[];
}

const COURT_TYPES: Record<string, string> = {
    "GD": "General District",
    "JDR": "Juvenile & Domestic Relations",
    "GD & JDR": "Combined District",
};

// Regex patterns (unchanged)
const RE_COURT_NAME          = /^(.+?)\s+(GD & JDR|GD|JDR)$/;
const RE_JUDICIAL_DISTRICT   = /^(.+\s+Judicial District)$/;
const RE_PHONE               = /^(\d{3}[/-]\d{3}[/-]\d{4})$/;
const RE_LABELED_PHONE       = /^(\w+):\s*(\d{3}[/-]\d{3}[/-]\d{4})$/;
const RE_FAX                 = /^Fax\s*-\s*(.+)$/;
const RE_CITY_STATE_ZIP      = /^(.+?),\s*VA\s+(\d{5}(?:-\d{4})?)$/;
const RE_HOURS               = /^Clerk'?s Office Hours:\s*(.+)$/;
const RE_HOMEPAGE            = /^Homepage:(.+)$/;
const RE_EMAIL_LABELED       = /^E-?Mail:\s*(\S+@\S+)$/i;
const RE_EMAIL_BARE          = /^\S+@vacourts\.gov$/;
const RE_EMAIL_LINE          = /^email:\s*$/i;
const RE_JUDGE               = /^Hon\.\s+(.+)$/;
const RE_PAGE_HEADER         = /^(COURT\/DISTRICT\/ADDRESS|JUDGE\(S\)|CLERK\/CONTACT INFORMATION|District Courts Directory|Page\s+\d+(\s+of)?(\s+\d+)?|\d{2}-\w{3}-\d{4}\s+\d{2}:\d{2}:\d{2}|[A-Z]{3}-\d{4}\s+\d{2}:\d{2}:\d{2})$/;
const RE_PO_BOX              = /^P\.?\s*O\.?\s*Box\s+\d+/i;
const RE_PHYSICAL_ADDR       = /^Physical Address:\s*(.*)$/i;
const RE_MAILING_ADDR        = /^Mailing Address:\s*(.*)$/i;

// ────────────────────────────────────────────────────────────────────────────────
// Parsing Functions with Logging
// ────────────────────────────────────────────────────────────────────────────────

export function splitIntoBlocks(text: string): string[][] {
    log.info(`Splitting text into blocks (${text.split(/\r?\n/).length} raw lines)`);

    const blocks: string[][] = [];
    let current: string[] = [];
    let blockCount = 0;

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (RE_PAGE_HEADER.test(line)) {
            log.debug(`Skipped page header/footer: "${line}"`);
            continue;
        }
        if (!line) continue;

        current.push(line);

        if (RE_HOMEPAGE.test(line)) {
            blockCount++;
            log.debug(`Block #${blockCount} completed (${current.length} lines) → Homepage: ${line}`);
            blocks.push(current);
            current = [];
        }
    }

    if (current.length > 0) {
        log.warn(`Incomplete final block (${current.length} lines) — no Homepage line found`);
        blocks.push(current);
    }

    log.info(`Found ${blocks.length} court blocks`);
    return blocks;
}

export function parseBlock(lines: string[], blockIndex: number = -1): Court | null {
    if (lines.length === 0) {
        log.warn(`Empty block #${blockIndex} skipped`);
        return null;
    }

    // Skip any leading lines that aren't court names (e.g. fragments of headers missed by splitIntoBlocks)
    let firstLineIndex = 0;
    let nameMatch = null;
    while (firstLineIndex < lines.length) {
        const line = lines[firstLineIndex];
        nameMatch = RE_COURT_NAME.exec(line);
        if (nameMatch) break;
        log.debug(`  [Block #${blockIndex}] Skipping leading line: "${line}"`);
        firstLineIndex++;
    }

    if (!nameMatch) {
        log.warn(`Block #${blockIndex} rejected — no valid court name match in ${lines.length} lines. First line was: "${lines[0]}"`);
        return null;
    }

    const firstLine = lines[firstLineIndex];
    log.debug(`Parsing block #${blockIndex} — identified court name: "${firstLine}"`);

    const locality = nameMatch[1].trim();
    const courtCode = nameMatch[2].trim();
    const courtType = COURT_TYPES[courtCode] ?? courtCode;

    const court: Court = {
        name: `${locality} ${courtCode}`,
        locality,
        type: courtType,
        district: null,
        clerk: null,
        phone: null,
        phones: undefined,
        fax: null,
        email: null,
        address: null,
        city: null,
        state: "VA",
        zip: null,
        hours: null,
        homepage: null,
        judges: [],
    };

    log.info(`→ Court: ${court.name} (${court.type})`);

    let expectEmailNext = false;
    let lineIndex = 1;

    for (const line of lines.slice(firstLineIndex + 1)) {
        log.debug(`  [L${lineIndex++}] "${line}"`);

        if (RE_JUDICIAL_DISTRICT.test(line)) {
            court.district = RE_JUDICIAL_DISTRICT.exec(line)![1];
            log.debug(`    → District: ${court.district}`);
            continue;
        }

        if (RE_HOMEPAGE.test(line)) {
            court.homepage = RE_HOMEPAGE.exec(line)![1].trim();
            log.debug(`    → Homepage: ${court.homepage}`);
            continue;
        }

        if (RE_HOURS.test(line)) {
            court.hours = RE_HOURS.exec(line)![1].trim();
            log.debug(`    → Hours: ${court.hours}`);
            continue;
        }

        if (RE_FAX.test(line)) {
            court.fax = RE_FAX.exec(line)![1].trim();
            log.debug(`    → Fax: ${court.fax}`);
            continue;
        }

        const labeledMatch = RE_LABELED_PHONE.exec(line);
        if (labeledMatch) {
            const label = labeledMatch[1];
            const num = labeledMatch[2];
            court.phones = court.phones ?? {};
            court.phones[label] = num;
            if (!court.phone) court.phone = num;
            log.debug(`    → Phone ${label}: ${num}`);
            continue;
        }

        if (RE_PHONE.test(line)) {
            const num = RE_PHONE.exec(line)![1];
            if (!court.phone) {
                court.phone = num;
                log.debug(`    → Main phone: ${num}`);
            } else {
                court.phones = court.phones ?? {};
                court.phones.other = num;
                log.debug(`    → Additional phone: ${num}`);
            }
            continue;
        }

        // Email variants
        if (RE_EMAIL_LABELED.test(line)) {
            court.email = RE_EMAIL_LABELED.exec(line)![1].trim();
            log.debug(`    → Email (labeled): ${court.email}`);
            expectEmailNext = false;
            continue;
        }

        if (RE_EMAIL_LINE.test(line)) {
            expectEmailNext = true;
            log.debug(`    → Expecting email on next line`);
            continue;
        }

        if (RE_EMAIL_BARE.test(line)) {
            court.email = line.trim();
            log.debug(`    → Email (bare): ${court.email}`);
            expectEmailNext = false;
            continue;
        }

        if (expectEmailNext && line.includes('@')) {
            court.email = line.trim();
            log.debug(`    → Email (after label): ${court.email}`);
            expectEmailNext = false;
            continue;
        }
        expectEmailNext = false;

        if (RE_JUDGE.test(line)) {
            const judge = RE_JUDGE.exec(line)![1].trim();
            court.judges.push(judge);
            log.debug(`    → Judge: ${judge}`);
            continue;
        }

        if (RE_CITY_STATE_ZIP.test(line)) {
            const m = RE_CITY_STATE_ZIP.exec(line)!;
            court.city = m[1].trim();
            court.zip = m[2].trim();
            log.debug(`    → Location: ${court.city}, VA ${court.zip}`);
            continue;
        }

        if (
            court.clerk === null &&
            court.district === null &&
            !RE_PO_BOX.test(line)
        ) {
            court.clerk = line;
            log.debug(`    → Clerk (heuristic): ${court.clerk}`);
            continue;
        }

        const isLikelyAddress =
            RE_PO_BOX.test(line) ||
            /^\d+\s/.test(line) ||
            /Street|Avenue|Road|Blvd|Drive|Suite|Floor|Courthouse|Mall|Center|Plaza|Building|Rd\.|St\.|Ave\./i.test(line) ||
            RE_PHYSICAL_ADDR.test(line) ||
            RE_MAILING_ADDR.test(line);

        if (isLikelyAddress) {
            const addrPart = line;
            court.address = court.address ? court.address + ", " + addrPart : addrPart;
            log.debug(`    → Address line: ${addrPart}`);
            continue;
        }

        log.warn(`    [UNMATCHED] "${line}"`);
    }

    if (court.phones && Object.keys(court.phones).length === 0) {
        delete court.phones;
    }

    log.info(`Completed ${court.name}:`);
    log.info(`  Clerk: ${court.clerk ?? '—'}`);
    log.info(`  Phone: ${court.phone ?? '—'}`);
    log.info(`  Email: ${court.email ?? '—'}`);
    log.info(`  Address: ${court.address ?? '—'}`);
    log.info(`  City/Zip: ${court.city ?? '—'}, ${court.zip ?? '—'}`);
    log.info(`  Judges: ${court.judges.length ? court.judges.join(', ') : '—'}`);
    log.info(`  Homepage: ${court.homepage ?? '—'}`);

    return court;
}

export function parseVirginiaCourts(text: string): Court[] {
    const blocks = splitIntoBlocks(text);
    const courts: Court[] = [];

    blocks.forEach((block, i) => {
        const parsed = parseBlock(block, i + 1);
        if (parsed) courts.push(parsed);
    });

    log.info(`Parsing complete — ${courts.length} courts extracted`);
    return courts;
}