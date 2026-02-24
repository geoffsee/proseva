import { describe, it, expect } from "bun:test";
import { toServerUrl, SERVER_URL, EXPLORER_URL } from "./url-routing";

describe("toServerUrl", () => {
  describe("regular API paths", () => {
    it("routes absolute paths to server", () => {
      expect(toServerUrl("/api/health")).toBe(`${SERVER_URL}/api/health`);
    });

    it("routes relative paths to server", () => {
      expect(toServerUrl("api/health")).toBe(`${SERVER_URL}/api/health`);
    });

    it("passes through full http URLs unchanged", () => {
      expect(toServerUrl("http://example.com/api/foo")).toBe("http://example.com/api/foo");
    });

    it("passes through full https URLs unchanged", () => {
      expect(toServerUrl("https://example.com/api/foo")).toBe("https://example.com/api/foo");
    });
  });

  describe("explorer routing", () => {
    it("routes /explorer/ paths to explorer URL", () => {
      expect(toServerUrl("/explorer/graphql")).toBe(`${EXPLORER_URL}/graphql`);
    });

    it("strips /explorer prefix from path", () => {
      expect(toServerUrl("/explorer/some/nested/path")).toBe(`${EXPLORER_URL}/some/nested/path`);
    });

    it("routes full http explorer URLs to explorer", () => {
      expect(toServerUrl("http://localhost:5173/explorer/graphql")).toBe(`${EXPLORER_URL}/graphql`);
    });

    it("preserves query string for explorer URLs", () => {
      expect(toServerUrl("http://localhost:5173/explorer/graphql?debug=1")).toBe(
        `${EXPLORER_URL}/graphql?debug=1`,
      );
    });

    it("does not match /explorersomething (requires trailing slash)", () => {
      // /explorersomething doesn't start with /explorer/ so it goes to server
      expect(toServerUrl("/explorersomething")).toBe(`${SERVER_URL}/explorersomething`);
    });
  });

  describe("edge cases", () => {
    it("routes root path to server", () => {
      expect(toServerUrl("/")).toBe(`${SERVER_URL}/`);
    });

    it("handles /explorer/ with only slash after prefix", () => {
      expect(toServerUrl("/explorer/")).toBe(`${EXPLORER_URL}/`);
    });
  });
});
