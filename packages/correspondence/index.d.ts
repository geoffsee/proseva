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

export function parseEml(input: ArrayBuffer | Uint8Array): ParsedEmail;
export function parseEmlFile(file: Blob): Promise<ParsedEmail>;
