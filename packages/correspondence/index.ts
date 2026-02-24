import { EmlReader } from "./src/EmlReader.js";

export type ParsedEmailAttachment = {
  filename: string;
  contentType: string;
  filesize: number;
  content: ArrayBuffer;
};

export type ParsedEmail = {
  date: string | null;
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  replyTo: string;
  direction: "incoming" | "outgoing";
  messageId: string;
  text: string;
  html: string;
  attachments: ParsedEmailAttachment[];
};

type HeaderValue = string | string[] | null | undefined;

function normalizeHeader(value: HeaderValue): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(", ").trim();
  return value.trim();
}

function toArrayBuffer(value: unknown): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  if (value instanceof Uint8Array) {
    return value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength,
    ) as ArrayBuffer;
  }
  if (typeof value === "string") {
    return new TextEncoder().encode(value).buffer;
  }
  return new ArrayBuffer(0);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value: Date | null): string | null {
  if (!value) return null;
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

export function parseEml(input: ArrayBuffer | Uint8Array): ParsedEmail {
  const reader = new EmlReader(input);

  const html = (() => {
    try {
      const value = reader.getMessageHtml();
      return typeof value === "string" ? value : "";
    } catch {
      return "";
    }
  })();

  const text = (() => {
    try {
      const value = reader.getMessageText();
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    } catch {
      // Some HTML-only emails may fail text extraction in non-DOM contexts.
    }
    return html ? stripHtml(html) : "";
  })();

  const attachments = (reader.getAttachments() ?? []).map((attachment) => ({
    filename: String(attachment.filename ?? ""),
    contentType: String(attachment.contentType ?? "application/octet-stream"),
    filesize: Number(attachment.filesize ?? 0),
    content: toArrayBuffer(attachment.content),
  }));

  return {
    date: normalizeDate(reader.getDate()),
    subject: normalizeHeader(reader.getSubject()),
    from: normalizeHeader(reader.getFrom()),
    to: normalizeHeader(reader.getTo()),
    cc: normalizeHeader(reader.getCc()),
    bcc: normalizeHeader(reader.getBcc()),
    replyTo: normalizeHeader(reader.getReplyTo()),
    direction: reader.getType() === "sent" ? "outgoing" : "incoming",
    messageId: normalizeHeader(
      reader.getHeader("message-id", true, true) as HeaderValue,
    ),
    text,
    html,
    attachments,
  };
}

export async function parseEmlFile(file: Blob): Promise<ParsedEmail> {
  const buffer = await file.arrayBuffer();
  return parseEml(buffer);
}
