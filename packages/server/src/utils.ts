export function safeDownloadFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "attachment.bin";
  return trimmed.replace(/[\r\n"]/g, "_");
}
