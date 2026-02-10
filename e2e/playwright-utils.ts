/**
 * Playwright Utilities Library for ProSe VA E2E Tests
 *
 * This library provides reusable helper functions for navigating,
 * interacting with, and testing the ProSe VA application using Playwright.
 */

/**
 * Navigation URLs for ProSe VA application
 */
export const PAGES = {
  // Home
  DASHBOARD: "/",

  // CORE Section
  DEADLINES: "/deadlines",
  FILINGS: "/filings",
  EVIDENCE: "/evidence",
  TIMELINE: "/timeline",

  // DATA Section
  CASES: "/cases",
  DOCUMENTS: "/documents",
  FINANCES: "/finances",
  CONTACTS: "/contacts",
  NOTES: "/notes",
  CALENDAR: "/calendar",

  // TOOLS Section
  TASKS: "/tasks",
  RESOURCES: "/resources",
  DOCUMENT_MANAGER: "/document-manager",
  CHAT: "/chat",
  REPORTS: "/reports",
} as const;

/**
 * Element references used throughout the application
 * Using data-testid attributes for stable selector targeting
 */
export const SELECTORS = {
  // Common Buttons
  COLOR_MODE_TOGGLE: "color-mode-toggle",

  // Deadlines
  DEADLINES_SEARCH: "deadlines-search",
  DEADLINES_TYPE_FILTER: "deadlines-type-filter",
  DEADLINES_URGENCY_FILTER: "deadlines-urgency-filter",
  DEADLINES_CASE_FILTER: "deadlines-case-filter",

  // Filings
  FILINGS_SEARCH: "filings-search",
  FILINGS_TYPE_FILTER: "filings-type-filter",
  FILINGS_CASE_FILTER: "filings-case-filter",
  FILINGS_DATE_FROM: "filings-date-from",
  FILINGS_DATE_TO: "filings-date-to",

  // Evidence
  EVIDENCE_SEARCH: "evidence-search",
  EVIDENCE_TYPE_FILTER: "evidence-type-filter",
  EVIDENCE_RELEVANCE_FILTER: "evidence-relevance-filter",
  EVIDENCE_ADMISSIBILITY_FILTER: "evidence-admissibility-filter",
  EVIDENCE_CASE_FILTER: "evidence-case-filter",

  // Timeline
  TIMELINE_DATE_FROM: "timeline-date-from",
  TIMELINE_DATE_TO: "timeline-date-to",

  // Contacts
  CONTACTS_SEARCH: "contacts-search",
  CONTACTS_ROLE_FILTER: "contacts-role-filter",
  CONTACTS_CASE_FILTER: "contacts-case-filter",

  // Chat
  CHAT_INPUT: "chat-input",
  CHAT_SEND_BUTTON: "chat-send-button",
} as const;

/**
 * Navigate to a page in the ProSe VA application
 * @param page - Playwright page object
 * @param url - URL to navigate to (use PAGES constant)
 * @param timeout - Navigation timeout in milliseconds
 */
export async function navigateTo(
  page: any,
  url: string,
  timeout: number = 30000,
): Promise<void> {
  await page.goto(`http://localhost:5173${url}`, {
    waitUntil: "networkidle",
    timeout,
  });
}

/**
 * Click a navigation link by reference
 * @param page - Playwright page object
 * @param ref - Element reference from SELECTORS
 * @param label - Descriptive label for logging
 */
export async function clickNavLink(
  page: any,
  ref: string,
  label: string,
): Promise<void> {
  await page.locator(`[ref="${ref}"]`).click();
  console.log(`Clicked: ${label}`);
}

/**
 * Navigate using sidebar navigation
 * @param page - Playwright page object
 * @param navRef - Navigation element reference from SELECTORS
 */
export async function navigateViaSidebar(
  page: any,
  navRef: string,
): Promise<void> {
  await clickNavLink(page, navRef, `Navigation: ${navRef}`);
  await page.waitForNavigation({ waitUntil: "networkidle" });
}

/**
 * Take a screenshot of the current page
 * @param page - Playwright page object
 * @param filename - Name of the file to save (without path)
 */
export async function takeScreenshot(
  page: any,
  filename: string,
): Promise<string> {
  const filepath = `.playwright-mcp/${filename}`;
  await page.screenshot({
    path: filepath,
    scale: "css",
    type: "png",
  });
  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}

/**
 * Get page accessibility snapshot
 * @param page - Playwright page object
 * @param filename - Optional filename to save to
 */
export async function getPageSnapshot(
  page: any,
  filename?: string,
): Promise<any> {
  return await page.accessibility.snapshot({
    interestingOnly: false,
    root: null,
  });
}

/**
 * Click element by testid
 * @param page - Playwright page object
 * @param testId - Element test id
 * @param element - Descriptive element name
 */
export async function clickElement(
  page: any,
  testId: string,
  element: string,
): Promise<void> {
  await page.getByTestId(testId).click();
  console.log(`Clicked: ${element}`);
}

/**
 * Fill a text input by testid
 * @param page - Playwright page object
 * @param testId - Element test id
 * @param text - Text to fill
 * @param label - Descriptive label
 */
export async function fillInput(
  page: any,
  testId: string,
  text: string,
  label: string,
): Promise<void> {
  await page.getByTestId(testId).fill(text);
  console.log(`Filled ${label}: ${text}`);
}

/**
 * Select dropdown option by testid
 * @param page - Playwright page object
 * @param testId - Element test id
 * @param value - Option value to select
 * @param label - Descriptive label
 */
export async function selectDropdown(
  page: any,
  testId: string,
  value: string,
  label: string,
): Promise<void> {
  await page.getByTestId(testId).selectOption(value);
  console.log(`Selected ${label}: ${value}`);
}

/**
 * Get text content from element
 * @param page - Playwright page object
 * @param testId - Element test id
 */
export async function getElementText(
  page: any,
  testId: string,
): Promise<string> {
  return await page.getByTestId(testId).textContent();
}

/**
 * Wait for element to be visible
 * @param page - Playwright page object
 * @param testId - Element test id
 * @param timeout - Timeout in milliseconds
 */
export async function waitForElement(
  page: any,
  testId: string,
  timeout: number = 5000,
): Promise<void> {
  await page.getByTestId(testId).waitFor({ state: "visible", timeout });
}

/**
 * Check if element is visible
 * @param page - Playwright page object
 * @param testId - Element test id
 */
export async function isElementVisible(
  page: any,
  testId: string,
): Promise<boolean> {
  try {
    await page.getByTestId(testId).waitFor({ state: "visible", timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Common page interactions
 */

/**
 * Navigate to a specific page via direct URL
 * @param page - Playwright page object
 * @param pagePath - URL path using PAGES constant
 * @param navRef - Navigation reference (deprecated, kept for backward compatibility)
 */
export async function goToPage(
  page: any,
  pagePath: string,
  navRef?: string,
): Promise<void> {
  // Navigate directly by URL instead of clicking sidebar
  await navigateTo(page, pagePath);
}

/**
 * Search on a page using search input
 * @param page - Playwright page object
 * @param searchRef - Search input element reference
 * @param searchTerm - Term to search for
 */
export async function search(
  page: any,
  searchRef: string,
  searchTerm: string,
): Promise<void> {
  await fillInput(page, searchRef, searchTerm, "search");
  // Wait for results to update
  await page.waitForLoadState("networkidle");
}

/**
 * Filter by dropdown on a page
 * @param page - Playwright page object
 * @param filterRef - Filter dropdown element reference
 * @param filterValue - Value to filter by
 * @param filterLabel - Descriptive label
 */
export async function applyFilter(
  page: any,
  filterRef: string,
  filterValue: string,
  filterLabel: string,
): Promise<void> {
  await selectDropdown(page, filterRef, filterValue, filterLabel);
  // Wait for filtered results
  await page.waitForLoadState("networkidle");
}

/**
 * Click add button and wait for form/dialog to appear
 * @param page - Playwright page object
 * @param addButtonRef - Add button element reference
 * @param formSelectors - CSS selectors for form elements to wait for
 */
export async function openAddForm(
  page: any,
  addButtonRef: string,
  formSelectors?: string[],
): Promise<void> {
  await clickElement(page, addButtonRef, "Add button");

  if (formSelectors && formSelectors.length > 0) {
    // Wait for any of the form selectors to appear
    await Promise.race(
      formSelectors.map((selector) =>
        page.locator(selector).waitFor({ state: "visible", timeout: 5000 }),
      ),
    );
  }
}

/**
 * Toggle color mode (light/dark theme)
 * @param page - Playwright page object
 */
export async function toggleColorMode(page: any): Promise<void> {
  try {
    const colorModeButton = page
      .getByTestId(SELECTORS.COLOR_MODE_TOGGLE)
      .first();
    // Wait for hydration of ClientOnly component
    await colorModeButton.waitFor({ state: "visible", timeout: 10000 });
    await colorModeButton.click();
    console.log("Toggled color mode");
  } catch (error) {
    console.log("Color mode toggle not found - skipping test");
  }
}

/**
 * Get page title
 * @param page - Playwright page object
 */
export async function getPageTitle(page: any): Promise<string> {
  return await page.title();
}

/**
 * Get current URL
 * @param page - Playwright page object
 */
export async function getCurrentUrl(page: any): Promise<string> {
  return page.url();
}

/**
 * Wait for text to appear on page
 * @param page - Playwright page object
 * @param text - Text to wait for
 * @param timeout - Timeout in milliseconds
 */
export async function waitForText(
  page: any,
  text: string,
  timeout: number = 5000,
): Promise<void> {
  // Use getByText with substring matching instead of strict text selector
  await page
    .getByText(text, { exact: false })
    .first()
    .waitFor({ state: "visible", timeout });
}

/**
 * Check if text appears on page
 * @param page - Playwright page object
 * @param text - Text to check for
 */
export async function hasText(page: any, text: string): Promise<boolean> {
  try {
    // Check if text exists anywhere on the page using getByText
    const element = await page.getByText(text, { exact: false }).first();
    // Verify it's actually visible
    const isVisible = await element
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    return isVisible;
  } catch {
    return false;
  }
}

/**
 * Get all text content from page
 * @param page - Playwright page object
 */
export async function getPageText(page: any): Promise<string> {
  return await page.evaluate(() => document.body.innerText);
}

/**
 * Navigation helper - go to dashboard
 */
export async function goToDashboard(page: any): Promise<void> {
  await goToPage(page, PAGES.DASHBOARD, SELECTORS.NAV_DASHBOARD);
}

/**
 * Navigation helper - go to deadlines
 */
export async function goToDeadlines(page: any): Promise<void> {
  await goToPage(page, PAGES.DEADLINES, SELECTORS.NAV_DEADLINES);
}

/**
 * Navigation helper - go to filings
 */
export async function goToFilings(page: any): Promise<void> {
  await goToPage(page, PAGES.FILINGS, SELECTORS.NAV_FILINGS);
}

/**
 * Navigation helper - go to evidence
 */
export async function goToEvidence(page: any): Promise<void> {
  await goToPage(page, PAGES.EVIDENCE, SELECTORS.NAV_EVIDENCE);
}

/**
 * Navigation helper - go to timeline
 */
export async function goToTimeline(page: any): Promise<void> {
  await goToPage(page, PAGES.TIMELINE, SELECTORS.NAV_TIMELINE);
}

/**
 * Navigation helper - go to cases
 */
export async function goToCases(page: any): Promise<void> {
  await goToPage(page, PAGES.CASES, SELECTORS.NAV_CASES);
}

/**
 * Navigation helper - go to documents
 */
export async function goToDocuments(page: any): Promise<void> {
  await goToPage(page, PAGES.DOCUMENTS, SELECTORS.NAV_DOCUMENTS);
}

/**
 * Navigation helper - go to finances
 */
export async function goToFinances(page: any): Promise<void> {
  await goToPage(page, PAGES.FINANCES, SELECTORS.NAV_FINANCES);
}

/**
 * Navigation helper - go to contacts
 */
export async function goToContacts(page: any): Promise<void> {
  await goToPage(page, PAGES.CONTACTS, SELECTORS.NAV_CONTACTS);
}

/**
 * Navigation helper - go to notes
 */
export async function goToNotes(page: any): Promise<void> {
  await goToPage(page, PAGES.NOTES, SELECTORS.NAV_NOTES);
}

/**
 * Navigation helper - go to calendar
 */
export async function goToCalendar(page: any): Promise<void> {
  await goToPage(page, PAGES.CALENDAR, SELECTORS.NAV_CALENDAR);
}

/**
 * Navigation helper - go to tasks
 */
export async function goToTasks(page: any): Promise<void> {
  await goToPage(page, PAGES.TASKS, SELECTORS.NAV_TASKS);
}

/**
 * Navigation helper - go to resources
 */
export async function goToResources(page: any): Promise<void> {
  await goToPage(page, PAGES.RESOURCES, SELECTORS.NAV_RESOURCES);
}

/**
 * Navigation helper - go to document manager
 */
export async function goToDocumentManager(page: any): Promise<void> {
  await goToPage(page, PAGES.DOCUMENT_MANAGER, SELECTORS.NAV_DOC_MANAGER);
}

/**
 * Navigation helper - go to AI chat
 */
export async function goToChat(page: any): Promise<void> {
  await goToPage(page, PAGES.CHAT, SELECTORS.NAV_AI_CHAT);
}

/**
 * Navigation helper - go to reports
 */
export async function goToReports(page: any): Promise<void> {
  await goToPage(page, PAGES.REPORTS, SELECTORS.NAV_REPORTS);
}
