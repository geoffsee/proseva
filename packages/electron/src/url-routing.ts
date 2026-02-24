export const SERVER_PORT = 3001;
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;
export const EXPLORER_PORT = 3002;
export const EXPLORER_URL = `http://localhost:${EXPLORER_PORT}`;

export function toServerUrl(input: string): string {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const url = new URL(input);
    if (url.pathname.startsWith("/explorer/")) {
      url.pathname = url.pathname.replace(/^\/explorer/, "");
      return `${EXPLORER_URL}${url.pathname}${url.search}`;
    }
    return input;
  }
  if (input.startsWith("/explorer/")) {
    const stripped = input.replace(/^\/explorer/, "");
    return `${EXPLORER_URL}${stripped}`;
  }
  if (!input.startsWith("/")) return `${SERVER_URL}/${input}`;
  return `${SERVER_URL}${input}`;
}
