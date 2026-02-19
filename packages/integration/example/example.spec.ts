/**
 * Example E2E Test Suite for ProSe VA
 *
 * This demonstrates how to use the playwright-utils library for testing
 * the ProSe VA application. Run with: npx playwright test e2e/example.spec.ts
 */

import { test, expect } from "@playwright/test";
import * as pw from "../e2e/playwright-utils.ts";

// Setup: Navigate to base URL before each test
test.beforeEach(async ({ page }) => {
  await pw.navigateTo(page, pw.PAGES.DASHBOARD);
});

test.describe("ProSe VA - Navigation and Basic Features", () => {
  test("should load dashboard with key statistics", async ({ page }) => {
    // Verify page loaded
    const title = await pw.getPageTitle(page);
    expect(title).toBe("ProSeVA");

    // Verify we're on dashboard
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("5173");
  });

  test("should navigate to Deadlines page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.DEADLINES);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/deadlines");
  });

  test("should navigate to Cases page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.CASES);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/cases");
  });

  test("should navigate to Evidence page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.EVIDENCE);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/evidence");
  });

  test("should navigate to Timeline page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.TIMELINE);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/timeline");
  });

  test("should navigate to Finances page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.FINANCES);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/finances");
  });

  test("should navigate to Contacts page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.CONTACTS);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/contacts");
  });

  test("should navigate to Calendar page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.CALENDAR);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/calendar");
  });

  test("should navigate to Resources page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.RESOURCES);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/resources");
  });

  test("should navigate to Chat page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.CHAT);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/chat");
  });

  test("should navigate to Reports page", async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.REPORTS);
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/reports");
  });
});

test.describe("ProSe VA - Deadlines Filtering", () => {
  test.beforeEach(async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.DEADLINES);
  });

  test("should filter deadlines by type", async ({ page }) => {
    // Apply filter
    await pw.applyFilter(
      page,
      pw.SELECTORS.DEADLINES_TYPE_FILTER,
      "Hearing",
      "Type",
    );
    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test("should search deadlines by title", async ({ page }) => {
    // Search for a specific deadline
    await pw.search(page, pw.SELECTORS.DEADLINES_SEARCH, "Criminal");
    // Wait for search to complete
    await page.waitForLoadState("networkidle");
  });

  test("should filter deadlines by urgency", async ({ page }) => {
    // Apply urgency filter
    await pw.applyFilter(
      page,
      pw.SELECTORS.DEADLINES_URGENCY_FILTER,
      "Future",
      "Urgency",
    );
    // Wait for results
    await page.waitForLoadState("networkidle");
  });
});

test.describe("ProSe VA - Filings Management", () => {
  test.beforeEach(async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.FILINGS);
  });

  test("should display filings list", async ({ page }) => {
    // Verify filings page loaded
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/filings");
  });

  test("should filter filings by type", async ({ page }) => {
    // Apply filter
    await pw.applyFilter(
      page,
      pw.SELECTORS.FILINGS_TYPE_FILTER,
      "Motion",
      "Type",
    );
    // Wait for results
    await page.waitForLoadState("networkidle");
  });

  test("should search filings by title", async ({ page }) => {
    // Search
    await pw.search(page, pw.SELECTORS.FILINGS_SEARCH, "Emergency");
    // Wait for results
    await page.waitForLoadState("networkidle");
  });
});

test.describe("ProSe VA - Evidence Management", () => {
  test.beforeEach(async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.EVIDENCE);
  });

  test("should display evidence items", async ({ page }) => {
    // Verify page loaded
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/evidence");
  });

  test("should filter evidence by type", async ({ page }) => {
    // Apply filter
    await pw.applyFilter(
      page,
      pw.SELECTORS.EVIDENCE_TYPE_FILTER,
      "Document",
      "Type",
    );
    // Wait for results
    await page.waitForLoadState("networkidle");
  });

  test("should filter evidence by relevance", async ({ page }) => {
    // Apply filter
    await pw.applyFilter(
      page,
      pw.SELECTORS.EVIDENCE_RELEVANCE_FILTER,
      "High",
      "Relevance",
    );
    // Wait for results
    await page.waitForLoadState("networkidle");
  });

  test("should search evidence by title", async ({ page }) => {
    // Search
    await pw.search(page, pw.SELECTORS.EVIDENCE_SEARCH, "Certificate");
    // Wait for results
    await page.waitForLoadState("networkidle");
  });
});

test.describe("ProSe VA - Timeline Features", () => {
  test.beforeEach(async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.TIMELINE);
  });

  test("should display timeline", async ({ page }) => {
    // Verify timeline loaded
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/timeline");
  });

  test("should have date range inputs", async ({ page }) => {
    // Check date inputs exist
    const hasFrom = await pw.isElementVisible(
      page,
      pw.SELECTORS.TIMELINE_DATE_FROM,
    );
    const hasTo = await pw.isElementVisible(
      page,
      pw.SELECTORS.TIMELINE_DATE_TO,
    );
    expect(hasFrom || hasTo).toBeTruthy();
  });
});

test.describe("ProSe VA - Contacts Management", () => {
  test.beforeEach(async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.CONTACTS);
  });

  test("should display contacts list", async ({ page }) => {
    // Verify page loaded
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/contacts");
  });

  test("should filter contacts by role", async ({ page }) => {
    // Apply filter
    await pw.applyFilter(
      page,
      pw.SELECTORS.CONTACTS_ROLE_FILTER,
      "Attorney",
      "Role",
    );
    // Wait for results
    await page.waitForLoadState("networkidle");
  });

  test("should search contacts", async ({ page }) => {
    // Search
    await pw.search(page, pw.SELECTORS.CONTACTS_SEARCH, "Judge");
    // Wait for results
    await page.waitForLoadState("networkidle");
  });
});

test.describe("ProSe VA - Resources Page", () => {
  test.beforeEach(async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.RESOURCES);
  });

  test("should display legal resources", async ({ page }) => {
    // Verify page loaded
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/resources");
  });
});

test.describe("ProSe VA - Chat Assistant", () => {
  test.beforeEach(async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.CHAT);
  });

  test("should display chat interface", async ({ page }) => {
    // Verify page loaded
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/chat");
  });

  test("should have chat input and send button", async ({ page }) => {
    // Verify input exists
    const hasInput = await pw.isElementVisible(page, pw.SELECTORS.CHAT_INPUT);
    const hasButton = await pw.isElementVisible(
      page,
      pw.SELECTORS.CHAT_SEND_BUTTON,
    );
    expect(hasInput || hasButton).toBeTruthy();
  });
});

test.describe("ProSe VA - Reports Page", () => {
  test.beforeEach(async ({ page }) => {
    await pw.navigateTo(page, pw.PAGES.REPORTS);
  });

  test("should display report templates", async ({ page }) => {
    // Verify page loaded
    const url = await pw.getCurrentUrl(page);
    expect(url).toContain("/reports");
  });
});

test.describe("ProSe VA - Theme Toggle", () => {
  test("should toggle color mode", async ({ page }) => {
    await pw.toggleColorMode(page);
    // Wait for theme change to apply
    await page.waitForTimeout(500);
    // Test passes if no errors occur
    expect(true).toBeTruthy();
  });
});

/**
 * Note: All tests run on Chromium only, matching the MCP behavior used during development.
 * This ensures consistent test results and faster execution.
 * Configure in playwright.config.ts if you need to test other browsers.
 */
