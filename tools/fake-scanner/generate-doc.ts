#!/usr/bin/env tsx

import { PDFDocument, StandardFonts, PDFPage, PDFFont, rgb } from "pdf-lib";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import {documentPresets} from "./presets.ts";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INBOX_DIR = path.join(__dirname, "inbox");


const vaLegalConfig = {
    caseInfo: {
        court: "CIRCUIT COURT",
        locality: "CITY OF NEWPORT NEWS",
        plaintiff: "JOHN DOE",
        defendant: "JANE DOE",
        petitioner: "JOHN DOE",
        respondent: "JANE DOE",
        caseNumber: "CL-2026-01234",
        attorney: "Sentience Unobliged, Esq.",
        barNumber: "12345",
        address: "123 Main Street, Newport News, VA 23601",
        phone: "(757) 555-0123",
        email: "geoff@law.bar",
        date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    },

    documentPresets: documentPresets,

    outputFilePrefix: "VA-Litigation-",
    defaultDocument: "divorce-complaint" as const,
};

type DocumentType = keyof typeof vaLegalConfig.documentPresets;

// ─── Helpers: Markdown inline tokens → PDF text segments ─────

interface TextSegment {
    text: string;
    bold: boolean;
}

function flattenInlineTokens(tokens: any[]): TextSegment[] {
    const segments: TextSegment[] = [];
    for (const t of tokens) {
        if (t.type === "strong") {
            if (t.tokens) {
                for (const inner of flattenInlineTokens(t.tokens)) {
                    segments.push({ text: inner.text, bold: true });
                }
            } else {
                segments.push({ text: t.text, bold: true });
            }
        } else if (t.type === "text") {
            segments.push({ text: t.text, bold: false });
        } else if (t.tokens) {
            segments.push(...flattenInlineTokens(t.tokens));
        } else if (t.raw) {
            segments.push({ text: t.raw, bold: false });
        }
    }
    return segments;
}

function drawRichText(
    page: PDFPage,
    segments: TextSegment[],
    startX: number,
    startY: number,
    maxWidth: number,
    fontSize: number,
    regularFont: PDFFont,
    bFont: PDFFont,
    lineHeight: number,
): number {
    let x = startX;
    let y = startY;

    for (const seg of segments) {
        const f = seg.bold ? bFont : regularFont;
        const words = seg.text.replace(/\n/g, " ").split(/( +)/);

        for (const word of words) {
            if (!word) continue;
            const w = f.widthOfTextAtSize(word, fontSize);

            if (x + w > startX + maxWidth && x > startX) {
                y -= lineHeight;
                x = startX;
                if (word.trim() === "") continue;
            }

            page.drawText(word, { x, y, size: fontSize, font: f });
            x += w;
        }
    }

    return y;
}

// ────────────────────────────────────────────────
//                GENERATOR FUNCTION with marked.js
// ────────────────────────────────────────────────
async function generateVirginiaLegalPDF(
    documentType: DocumentType = vaLegalConfig.defaultDocument,
    overrides: Partial<typeof vaLegalConfig.caseInfo> = {}
) {
    const info = { ...vaLegalConfig.caseInfo, ...overrides };
    const preset = vaLegalConfig.documentPresets[documentType];

    console.log(`\n⚖️  Generating ${preset.title} (${documentType}) using marked.js…`);

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(preset.font);
    const boldFont = await pdf.embedFont(StandardFonts.TimesRomanBold);

    // ─── Pre-process markdown into flat render operations ───
    const markdownText = preset.body(info);
    const tokens = marked.lexer(markdownText);
    const bodyLH = preset.lineHeight; // 24pt (double-spaced)
    const singleLH = 16;              // single-spaced for exempted elements

    interface RenderOp {
        kind: "rich-text" | "space";
        segments?: TextSegment[];
        indent?: number;
        prefix?: string;
        lh?: number;   // line height for wrapping within this element
        gap?: number;   // vertical gap after this element
    }

    const ops: RenderOp[] = [];
    for (const token of tokens) {
        switch (token.type) {
            case "paragraph": {
                const inlineTokens = (token as any).tokens ?? [];
                const segments = flattenInlineTokens(inlineTokens);
                const isLettered = segments.length > 0 && /^[a-f]\.\s/.test(segments[0].text);
                ops.push({
                    kind: "rich-text",
                    segments,
                    indent: isLettered ? 100 : 72,
                    lh: isLettered ? singleLH : bodyLH,
                    gap: isLettered ? singleLH + 4 : bodyLH,
                });
                break;
            }
            case "list": {
                const listToken = token as any;
                const items: any[] = listToken.items ?? [];
                const startNum: number = listToken.start ?? 1;
                for (let i = 0; i < items.length; i++) {
                    let inlineTokens: any[] = [];
                    for (const sub of items[i].tokens ?? []) {
                        if (sub.type === "paragraph" && sub.tokens) inlineTokens.push(...sub.tokens);
                        else if (sub.type === "text") inlineTokens.push(sub);
                    }
                    ops.push({
                        kind: "rich-text",
                        segments: flattenInlineTokens(inlineTokens),
                        indent: 72,
                        prefix: `${startNum + i}. `,
                        lh: singleLH,
                        gap: singleLH + 4,
                    });
                }
                break;
            }
            case "space":
                ops.push({ kind: "space", gap: bodyLH * 0.6 });
                break;
        }
    }

    // ─── Render pages (content flows across pages) ───────
    const SIG_RESERVE = 290;  // body stops here on last page, leaving room for signature
    let opIndex = 0;

    for (let p = 0; p < preset.pages || opIndex < ops.length; p++) {
        const page = pdf.addPage([612, 792]);
        const { width, height } = page.getSize();
        let y = height - 72;
        const textArea = width - 144;

        // Caption (single-spaced per guidelines)
        const CS = 16;
        if (preset.captionStyle === "full") {
            const courtHeader = `VIRGINIA: IN THE ${info.court} FOR THE ${info.locality}`;
            page.drawText(courtHeader, { x: 72, y, size: 12, font: boldFont });
            y -= CS * 2;

            page.drawText(`${info.plaintiff},`, { x: 72, y, size: 12, font });
            y -= CS;
            page.drawText("Plaintiff,", { x: 128, y, size: 12, font });
            y -= CS;

            page.drawText("v.", { x: 72, y, size: 12, font });
            const caseLabel = `CASE NO.: ${info.caseNumber}`;
            const caseLabelW = font.widthOfTextAtSize(caseLabel, 12);
            page.drawText(caseLabel, { x: width - 72 - caseLabelW, y, size: 12, font });
            y -= CS * 2;

            page.drawText(`${info.defendant},`, { x: 72, y, size: 12, font });
            y -= CS;
            page.drawText("Defendant.", { x: 128, y, size: 12, font });
            y -= CS * 2;
        }

        // Title (centered, bold, underlined per guidelines)
        const titleWidth = boldFont.widthOfTextAtSize(preset.title, 14);
        const titleX = (width - titleWidth) / 2;
        page.drawText(preset.title, { x: titleX, y, size: 14, font: boldFont });
        page.drawLine({
            start: { x: titleX, y: y - 2 },
            end: { x: titleX + titleWidth, y: y - 2 },
            thickness: 0.75,
            color: rgb(0, 0, 0),
        });
        y -= 36;

        // ─── Render body ops (continuing from previous page) ─────
        const bottomLimit = preset.hasAttorneySignature ? SIG_RESERVE : 100;

        for (; opIndex < ops.length; opIndex++) {
            if (y < bottomLimit) break;
            const op = ops[opIndex];

            if (op.kind === "space") {
                y -= op.gap!;
                continue;
            }

            const indent = op.indent ?? 72;
            let startX = indent;

            if (op.prefix) {
                const prefixWidth = font.widthOfTextAtSize(op.prefix, preset.fontSize);
                page.drawText(op.prefix, { x: indent, y, size: preset.fontSize, font });
                startX = indent + prefixWidth;
            }

            y = drawRichText(page, op.segments!, startX, y, width - startX - 72, preset.fontSize, font, boldFont, op.lh ?? bodyLH);
            y -= op.gap ?? bodyLH;
        }

        // Signature block on the page where all content has been rendered
        if (opIndex >= ops.length && preset.hasAttorneySignature) {
            const sigX = width / 2 - 16;
            const SLS = 16;
            let sigY = Math.min(y - 20, SIG_RESERVE - 20); // start below body text or at reserve

            page.drawText("Respectfully submitted,", { x: sigX, y: sigY, size: 12, font });
            sigY -= SLS * 2;

            page.drawText(info.plaintiff, { x: sigX, y: sigY, size: 12, font: boldFont });
            sigY -= SLS * 2.5;

            page.drawLine({
                start: { x: sigX, y: sigY + 8 },
                end: { x: sigX + 220, y: sigY + 8 },
                thickness: 0.75,
                color: rgb(0, 0, 0),
            });

            page.drawText(`${info.attorney}, Of Counsel`, { x: sigX, y: sigY - 6, size: 11, font });
            sigY -= SLS;
            page.drawText(info.address, { x: sigX, y: sigY - 6, size: 11, font });
            sigY -= SLS;
            page.drawText(`Telephone: ${info.phone}`, { x: sigX, y: sigY - 6, size: 11, font });
            sigY -= SLS;
            page.drawText(`Email: ${info.email}`, { x: sigX, y: sigY - 6, size: 11, font });

            break; // done — no more pages needed after signature
        }
    }

    // ─── Certificate of Service (required per guidelines) ──────
    {
        const certPage = pdf.addPage([612, 792]);
        const { width: cw } = certPage.getSize();
        let cy = 792 - 72;
        const SLS = 16;

        // Title (centered, bold, underlined)
        const certTitle = "CERTIFICATE OF SERVICE";
        const ctw = boldFont.widthOfTextAtSize(certTitle, 14);
        const ctx = (cw - ctw) / 2;
        certPage.drawText(certTitle, { x: ctx, y: cy, size: 14, font: boldFont });
        certPage.drawLine({
            start: { x: ctx, y: cy - 2 },
            end: { x: ctx + ctw, y: cy - 2 },
            thickness: 0.75,
            color: rgb(0, 0, 0),
        });
        cy -= 36;

        const year = new Date().getFullYear();
        const certBody =
            `I hereby certify that on the ______ day of _________________, ${year}, ` +
            `a true and correct copy of the foregoing ${preset.title} was served upon ` +
            `${info.defendant} by _________________ to:`;
        certPage.drawText(certBody, {
            x: 72,
            y: cy,
            size: 12,
            font,
            maxWidth: cw - 144,
            lineHeight: 24,
        });
        cy -= 24 * 4; // ~4 wrapped lines

        // Recipient address block (indented)
        certPage.drawText(info.defendant, { x: 200, y: cy, size: 12, font });
        cy -= SLS;
        certPage.drawText("[Address]", { x: 200, y: cy, size: 12, font });
        cy -= SLS;
        certPage.drawText("[City, State ZIP]", { x: 200, y: cy, size: 12, font });
        cy -= SLS * 3;

        // Signature line (right-aligned)
        const sigX = cw / 2 - 16;
        certPage.drawLine({
            start: { x: sigX, y: cy + 8 },
            end: { x: sigX + 220, y: cy + 8 },
            thickness: 0.75,
            color: rgb(0, 0, 0),
        });
        certPage.drawText(info.plaintiff, { x: sigX, y: cy - 8, size: 12, font });
    }

    // ─── Page numbers (centered at bottom of each page) ─────
    const pages = pdf.getPages();
    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
        const pg = pages[i];
        const { width: pw } = pg.getSize();
        const label = `${i + 1}`;
        const labelW = font.widthOfTextAtSize(label, 10);
        pg.drawText(label, { x: (pw - labelW) / 2, y: 40, size: 10, font });
    }

    const filename = path.join(INBOX_DIR, `${vaLegalConfig.outputFilePrefix}${documentType.replace(/-/g, "_")}.pdf`);
    const bytes = await pdf.save();

    await fs.mkdir(INBOX_DIR, { recursive: true });
    await fs.writeFile(filename, bytes);

    console.log(`✅ Generated → ${filename} (using marked.js)`);
}

// ────────────────────────────────────────────────
//                   CLI
// ────────────────────────────────────────────────
//
// Usage: npx tsx generate-doc.ts [document-type] [plaintiff] [defendant]
//
// Examples:
//
//   # Default divorce complaint
//   npx tsx generate-doc.ts
//
//   # Divorce complaint with custom party names
//   npx tsx generate-doc.ts divorce-complaint "WILLIAM SEEMUELLER" "SARAH SEEMUELLER"
//
//   # Answer to complaint
//   npx tsx generate-doc.ts answer-to-complaint "JANE DOE" "JOHN DOE"
//
//   # Marital settlement agreement
//   npx tsx generate-doc.ts marital-settlement-agreement
//
//   # Final decree of divorce (no children)
//   npx tsx generate-doc.ts final-decree-of-divorce
//
//   # Plaintiff's affidavit
//   npx tsx generate-doc.ts plaintiffs-affidavit "MARIA GARCIA" "CARLOS GARCIA"
//
//   # Motion for pendente lite relief (spousal only)
//   npx tsx generate-doc.ts motion-for-pendente-lite
//
//   # Divorce complaint with children
//   npx tsx generate-doc.ts divorce-complaint-with-children "ASHLEY BROWN" "MICHAEL BROWN"
//
//   # Motion for temporary custody & support
//   npx tsx generate-doc.ts motion-for-pendente-lite-custody-support
//
//   # Parenting plan agreement
//   npx tsx generate-doc.ts parenting-plan-agreement "JENNIFER SMITH" "ROBERT SMITH"
//
//   # Agreed order – custody, visitation, and child support
//   npx tsx generate-doc.ts agreed-order-custody-visitation-support
//
//   # Final decree of divorce (with children)
//   npx tsx generate-doc.ts final-decree-of-divorce-with-children
//
//   # Motion to modify custody/support
//   npx tsx generate-doc.ts motion-to-modify-custody-support "LISA JOHNSON" "DAVID JOHNSON"
//
//   # Petition for protective order (family abuse)
//   npx tsx generate-doc.ts petition-for-protective-order-family-abuse
//
//   # Emergency protective order affidavit
//   npx tsx generate-doc.ts emergency-protective-order-affidavit
//
//   # Preliminary protective order (ex parte)
//   npx tsx generate-doc.ts preliminary-protective-order
//
//   # Full protective order (family abuse, 2-year)
//   npx tsx generate-doc.ts full-protective-order-family-abuse
//
//   # Protective order pendente lite in divorce
//   npx tsx generate-doc.ts motion-for-protective-order-pendente-lite-divorce
//
//   # Generate all document types at once
//   for t in divorce-complaint answer-to-complaint marital-settlement-agreement \
//     final-decree-of-divorce plaintiffs-affidavit motion-for-pendente-lite \
//     divorce-complaint-with-children motion-for-pendente-lite-custody-support \
//     parenting-plan-agreement agreed-order-custody-visitation-support \
//     final-decree-of-divorce-with-children motion-to-modify-custody-support \
//     petition-for-protective-order-family-abuse emergency-protective-order-affidavit \
//     preliminary-protective-order full-protective-order-family-abuse \
//     motion-for-protective-order-pendente-lite-divorce; do
//       npx tsx generate-doc.ts "$t"
//   done
//
const allDocTypes = Object.keys(vaLegalConfig.documentPresets) as DocumentType[];

const LAST_TYPE_FILE = path.join(__dirname, ".last-doc-type");
let lastType: string | null = null;
try { lastType = fsSync.readFileSync(LAST_TYPE_FILE, "utf-8").trim(); } catch {}

const eligible = allDocTypes.filter(t => t !== lastType);
const randomType = eligible[Math.floor(Math.random() * eligible.length)];

const docType = (process.argv[2] as DocumentType) || randomType;
const overrides: Partial<typeof vaLegalConfig.caseInfo> = {};
if (process.argv[3]) overrides.plaintiff = process.argv[3];
if (process.argv[4]) overrides.defendant = process.argv[4];

generateVirginiaLegalPDF(docType, overrides)
    .then(() => fs.writeFile(LAST_TYPE_FILE, docType))
    .catch(console.error);