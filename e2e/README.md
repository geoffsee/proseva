# ProSe VA E2E Tests

End-to-end tests for the ProSe VA legal case management application using Playwright.

## Quick Start

### Prerequisites

- Node.js 16+
- Bun (the project package manager)
- Application running on `http://localhost:5173`

### Installation

```bash
# Install dependencies
bun install

# Install Playwright browsers
bun exec playwright install
```

### Running Tests

```bash
# Run all tests (Chromium only)
bun run test:e2e

# Run tests in a specific file
bun exec playwright test e2e/example.spec.ts

# Run tests in headed mode (see browser)
bun run test:e2e:headed

# Run tests in debug mode
bun run test:e2e:debug

# Run specific test
bun exec playwright test -g "should navigate to Deadlines page"

# Generate HTML report after running tests
bun run test:e2e:report
```

**Note:** All tests run on **Chromium only**, matching the Playwright MCP behavior used during development. This ensures consistent test results and faster test execution.

### Development Mode

```bash
# Start frontend dev server
bun run dev:frontend

# In another terminal, run tests
bun exec playwright test --headed --watch
```

## Playwright Utils Library

The `playwright-utils.ts` file provides a comprehensive set of helper functions for testing the ProSe VA application.

### Key Features

#### Constants

```typescript
// Page URLs
pw.PAGES.DASHBOARD;
pw.PAGES.DEADLINES;
pw.PAGES.CASES;
pw.PAGES.EVIDENCE;
// ... and more

// Element selectors
pw.SELECTORS.NAV_DEADLINES;
pw.SELECTORS.DEADLINES_ADD_BUTTON;
pw.SELECTORS.DEADLINES_SEARCH;
// ... and more
```

#### Navigation Functions

```typescript
// Navigate directly to page
await pw.navigateTo(page, "/deadlines");

// Navigate using sidebar
await pw.goToDeadlines(page);
await pw.goToCases(page);
await pw.goToFinances(page);
// ... and more

// Get current URL
const url = await pw.getCurrentUrl(page);
```

#### Click and Interaction Functions

```typescript
// Click element by reference
await pw.clickElement(page, pw.SELECTORS.DEADLINES_ADD_BUTTON, "Add Deadline");

// Click navigation link
await pw.clickNavLink(page, pw.SELECTORS.NAV_DEADLINES, "Deadlines");

// Fill input field
await pw.fillInput(page, pw.SELECTORS.DEADLINES_SEARCH, "Criminal", "search");

// Select dropdown
await pw.selectDropdown(
  page,
  pw.SELECTORS.DEADLINES_TYPE_FILTER,
  "Hearing",
  "Type",
);

// Apply filter (search + select)
await pw.applyFilter(
  page,
  pw.SELECTORS.DEADLINES_URGENCY_FILTER,
  "Urgent",
  "Urgency",
);

// Open add form
await pw.openAddForm(page, pw.SELECTORS.DEADLINES_ADD_BUTTON);
```

#### Wait and Check Functions

```typescript
// Wait for element to appear
await pw.waitForElement(page, pw.SELECTORS.DEADLINES_ADD_BUTTON);

// Check if element is visible
const isVisible = await pw.isElementVisible(
  page,
  pw.SELECTORS.DEADLINES_ADD_BUTTON,
);

// Wait for specific text
await pw.waitForText(page, "Criminal Contempt Trial");

// Check if text exists on page
const hasText = await pw.hasText(page, "Deadlines");

// Get element text
const text = await pw.getElementText(page, pw.SELECTORS.NAV_DEADLINES);

// Get all page text
const pageText = await pw.getPageText(page);
```

#### Screenshot Functions

```typescript
// Take screenshot
await pw.takeScreenshot(page, "deadlines-page.png");

// Get page snapshot (accessibility)
const snapshot = await pw.getPageSnapshot(page);
```

#### Utility Functions

```typescript
// Get page title
const title = await pw.getPageTitle(page);

// Toggle color mode
await pw.toggleColorMode(page);
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect, Page } from "@playwright/test";
import * as pw from "./playwright-utils";

test.describe("My Feature", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page before each test
    await pw.goToDeadlines(page);
  });

  test("should display deadlines", async ({ page }) => {
    // Use utilities to interact with page
    expect(await pw.hasText(page, "Deadlines")).toBeTruthy();
  });

  test("should filter deadlines", async ({ page }) => {
    // Search
    await pw.search(page, pw.SELECTORS.DEADLINES_SEARCH, "Criminal");

    // Verify results
    expect(await pw.hasText(page, "Criminal Contempt")).toBeTruthy();

    // Take screenshot for documentation
    await pw.takeScreenshot(page, "filtered-deadlines.png");
  });
});
```

### Common Test Patterns

#### Navigation Testing

```typescript
test("should navigate to Cases page", async ({ page }) => {
  await pw.goToCases(page);

  const url = await pw.getCurrentUrl(page);
  expect(url).toContain("/cases");
  expect(await pw.hasText(page, "Cases")).toBeTruthy();
});
```

#### Search and Filter Testing

```typescript
test("should filter deadlines by type", async ({ page }) => {
  await pw.applyFilter(
    page,
    pw.SELECTORS.DEADLINES_TYPE_FILTER,
    "Hearing",
    "Type",
  );

  await page.waitForLoadState("networkidle");
  expect(await pw.hasText(page, "Hearing")).toBeTruthy();
});
```

#### Form Testing

```typescript
test("should open add deadline form", async ({ page }) => {
  await pw.openAddForm(page, pw.SELECTORS.DEADLINES_ADD_BUTTON);

  // Fill form fields
  await pw.fillInput(page, "e123", "Court Hearing", "title");
  await pw.selectDropdown(page, "e124", "Hearing", "type");

  // Submit
  await pw.clickElement(page, "e125", "Add button");
});
```

#### Multi-step Workflows

```typescript
test("should complete case workflow", async ({ page }) => {
  // Navigate
  await pw.goToCases(page);

  // Click case
  await pw.clickElement(page, "e157", "First case");

  // Wait for case details
  await pw.waitForElement(page, "e200"); // Details tab

  // Verify details
  expect(await pw.hasText(page, "Custody")).toBeTruthy();

  // Take screenshot
  await pw.takeScreenshot(page, "case-details.png");
});
```

## File Structure

```
e2e/
├── README.md                  # This file
├── playwright-utils.ts        # Reusable utility functions
├── example.spec.ts           # Example tests
├── pages/
│   ├── dashboard.spec.ts     # Dashboard tests
│   ├── deadlines.spec.ts     # Deadline tests
│   ├── cases.spec.ts         # Case tests
│   └── ...
└── fixtures/
    └── test-data.ts          # Test data and fixtures
```

## Debugging Tests

### Visual Debugging

```bash
# Run tests in headed mode
bun exec playwright test --headed

# Run tests in debug mode
bun exec playwright test --debug

# Slowdown execution
bun exec playwright test --headed --slow-mo=1000
```

### Inspect Locators

```bash
# Use Playwright Inspector
bun exec playwright test --debug

# Or use VS Code extension
# Install: Playwright Test for VS Code
```

### View Test Results

```bash
# View HTML report
bun exec playwright show-report

# Test artifacts are saved to test-results/
```

## CI/CD Integration

The tests are configured for CI/CD with:

- Automatic retry on failure (CI only)
- Screenshots on failure
- Video recording on failure
- JUnit XML report for CI systems
- HTML report for detailed analysis

### GitHub Actions Example

```yaml
- name: Install dependencies
  run: bun install

- name: Run E2E tests
  run: bun exec playwright test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Browser not found

```bash
bun exec playwright install
```

### Tests timing out

- Increase timeout in `playwright.config.ts`
- Check if app is running on `http://localhost:5173`
- Add explicit waits: `await page.waitForLoadState('networkidle')`

### Selectors not found

- Verify ref attributes in HTML
- Use `--debug` mode to inspect
- Check if element is visible: `await pw.isElementVisible(page, ref)`

### Tests pass locally but fail in CI

- Check for timing issues
- Add more explicit waits
- Use `--headed` to see browser behavior
- Check video/screenshot artifacts

## Performance Tips

1. **Reuse browser context** when possible
2. **Parallel execution** is enabled by default
3. **Use specific selectors** instead of broad queries
4. **Minimize network waits** with strategic `waitForLoadState()`
5. **Cache static resources** in dev server

## Contributing Tests

When adding new tests:

1. Use the `playwright-utils` library for common operations
2. Follow naming conventions: `should [action] [expected result]`
3. Add descriptive comments for complex workflows
4. Include screenshots for visual changes
5. Test both success and failure cases
6. Keep tests independent and repeatable

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Test Guide](https://playwright.dev/docs/intro)
- [Locators Guide](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)
- [Debugging](https://playwright.dev/docs/debug)

## Support

For issues or questions about the E2E tests:

1. Check test output and screenshots
2. Review test artifacts in `test-results/`
3. Check browser console for errors
4. Review network tab in Playwright Inspector
5. Open an issue with reproduction steps
