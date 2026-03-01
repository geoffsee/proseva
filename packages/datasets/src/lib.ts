// lib.ts

import type { PathLike } from "bun";
import { utils } from "../../experimental/index.ts";

export const USER_AGENT = utils.getUserAgent({ server: true });

export const COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "*/*",
} as const;

// Back-compat: refresh scripts import `HEADERS`.
export const HEADERS = COMMON_HEADERS;

export const usesRelativeDirectory = (path: PathLike) =>
  new URL(path.toString(), import.meta.url).pathname;

export type DatasetKey =
  | "annual_reports"

  | "benchbook"
  | "cac_manual"
  | "case_law_authorities"
  | "caseload_stats"
  | "constitutional_law"
  | "courts"
  | "gdman"
  | "jdrman"
  | "other"
  | "vcc"
  | "virginia_code";

export const DATASET_CONFIG: Record<
  DatasetKey,
  {
    host: string;
    basePath: string;
    description: string;
    resources?:
      | Array<{ remotePath: string; localName: string }> // For static file lists
      | ((
          year?: number,
        ) => Array<{ url: string; localName: string; isHtml?: boolean }>) // For dynamic (e.g., year-based)
      | { pdfUrl: string; parser?: (pdfPath: string) => Promise<unknown> }; // For parsed datasets like courts
    tlsRejectUnauthorized?: boolean; // For sites with cert issues (e.g., lis.virginia.gov)
    protocol?: "http" | "https"; // Override default https (e.g., vcsc.virginia.gov is http-only)
  }
> = {
  annual_reports: {
    host: "www.vacourts.gov",
    basePath: "/static/courts/sjr/reports",
    description:
      "State of the Judiciary Annual Reports. Includes historical PDFs and recent HTML versions.",
    resources: (year = new Date().getFullYear()) => [
      {
        url: `https://ar.vacourts.gov/${year}annualreport.html`,
        localName: `state_of_the_judiciary_report_${year}.html`,
        isHtml: true,
      },
      {
        url: `https://www.vacourts.gov/static/courts/sjr/reports/${year}/state_of_the_judiciary_report.pdf`,
        localName: `state_of_the_judiciary_report_${year}.pdf`,
        isHtml: false,
      },
      {
        url: `https://www.vacourts.gov/static/courts/sjr/reports/${year}_sjr.pdf`,
        localName: `state_of_the_judiciary_report_${year}.pdf`,
        isHtml: false,
      },
    ],
  },
  benchbook: {
    host: "www.vacourts.gov",
    basePath: "/static/courts/gd/resources/manuals",
    description:
      "District Court Judges' Benchbook, a comprehensive reference for Virginia district court judges.",
    resources: [
      {
        remotePath: "/districtcourtbenchbook.pdf",
        localName: "districtcourtbenchbook.pdf",
      },
    ],
  },
  cac_manual: {
    host: "www.vacourts.gov",
    basePath: "/courtadmin/aoc/judplan/capp",
    description:
      "Commissioners of Accounts Compliance (CAC) Manual and indigency guidelines.",
    resources: [
      {
        remotePath: "/manuals/ctapptatty/cacmanual.pdf",
        localName: "cacmanual.pdf",
      },
      { remotePath: "/manuals/ctapptatty/toc.pdf", localName: "toc.pdf" },
      {
        remotePath: "/indigency_guidelines.pdf",
        localName: "indigency_guidelines.pdf",
      },
    ],
  },
  case_law_authorities: {
    host: "law.lis.virginia.gov",
    basePath: "",
    description:
      "CSV data for Virginia authorities, charters, compacts, and uncodified acts.",
    tlsRejectUnauthorized: false,
    resources: [
      { remotePath: "/CSV/Authorities.csv", localName: "Authorities.csv" },
      { remotePath: "/CSV/Charters.csv", localName: "Charters.csv" },
      { remotePath: "/CSV/Compacts.csv", localName: "Compacts.csv" },
      {
        remotePath: "/CSV/UnCodifiedActs.csv",
        localName: "UnCodifiedActs.csv",
      },
    ],
  },
  caseload_stats: {
    host: "www.vacourts.gov",
    basePath: "/courtadmin/aoc/djs/programs/cpss/csi",
    description:
      "General caseload statistics for Circuit, General District, and J&DR courts.",
    resources: [
      { remotePath: "/stats/cc_filings.pdf", localName: "cc_filings.pdf" },
      { remotePath: "/stats/cc_disps.pdf", localName: "cc_disps.pdf" },
      { remotePath: "/stats/gdc_filings.pdf", localName: "gdc_filings.pdf" },
      { remotePath: "/stats/gdc_disps.pdf", localName: "gdc_disps.pdf" },
      { remotePath: "/stats/jdr_filings.pdf", localName: "jdr_filings.pdf" },
      { remotePath: "/stats/jdr_disps.pdf", localName: "jdr_disps.pdf" },
      { remotePath: "/public_qrg.pdf", localName: "public_qrg.pdf" },
    ],
  },
  constitutional_law: {
    host: "law.lis.virginia.gov",
    basePath: "",
    description: "The Constitution of Virginia in CSV format.",
    tlsRejectUnauthorized: false,
    resources: [
      { remotePath: "/CSV/Constitution.csv", localName: "Constitution.csv" },
    ],
  },
  courts: {
    host: "www.vacourts.gov",
    basePath: "",
    description: "District Courts Directory PDF (download-only; no parsing).",
    resources: {
      pdfUrl: "/directories/dist.pdf",
    },
  },
  gdman: {
    host: "www.vacourts.gov",
    basePath: "/courts/gd/resources/manuals/gdman",
    description: "General District Court Manual (Procedures and Guidelines).",
    resources: [{ remotePath: "/gd_manual.pdf", localName: "gd_manual.pdf" }],
  },
  jdrman: {
    host: "www.vacourts.gov",
    basePath: "/courts/jdr/resources/manuals/jdrman",
    description:
      "Juvenile and Domestic Relations (J&DR) District Court Manual.",
    resources: [
      { remotePath: "/toc_jdr_manual.pdf", localName: "toc_jdr_manual.pdf" },
      { remotePath: "/chapter01.pdf", localName: "chapter01.pdf" },
      { remotePath: "/chapter02.pdf", localName: "chapter02.pdf" },
      { remotePath: "/chapter03.pdf", localName: "chapter03.pdf" },
      { remotePath: "/chapter04.pdf", localName: "chapter04.pdf" },
      { remotePath: "/chapter05.pdf", localName: "chapter05.pdf" },
      { remotePath: "/chapter06.pdf", localName: "chapter06.pdf" },
      { remotePath: "/chapter07.pdf", localName: "chapter07.pdf" },
      { remotePath: "/chapter08.pdf", localName: "chapter08.pdf" },
      { remotePath: "/chapter09.pdf", localName: "chapter09.pdf" },
      { remotePath: "/chapter10.pdf", localName: "chapter10.pdf" },
      { remotePath: "/chapter11.pdf", localName: "chapter11.pdf" },
      { remotePath: "/chapter12.pdf", localName: "chapter12.pdf" },
      { remotePath: "/chapter13.pdf", localName: "chapter13.pdf" },
      { remotePath: "/appendix_a.pdf", localName: "appendix_a.pdf" },
      { remotePath: "/appendix_b.pdf", localName: "appendix_b.pdf" },
      { remotePath: "/appendix_c.pdf", localName: "appendix_c.pdf" },
      { remotePath: "/index.pdf", localName: "index.pdf" },
      { remotePath: "/glossary.pdf", localName: "glossary.pdf" },
    ],
  },
  other: {
    host: "www.vacourts.gov",
    basePath: "",
    description:
      "Miscellaneous legal resources including Rules of Court, District Courts Directory, and Small Claims Court Procedures.",
    resources: [
      {
        remotePath: "/courtadmin/aoc/djs/resources/ust/ust_table.pdf",
        localName: "ust_table.pdf",
      },
      {
        remotePath: "/resources/small_claims_court_procedures.pdf",
        localName: "small_claims_court_procedures.pdf",
      },
      {
        remotePath: "/courts/vacourtfacility/complete.pdf",
        localName: "courthouse_facility_guidelines.pdf",
      },
      {
        remotePath: "/directories/dist.pdf",
        localName: "district_courts_directory.pdf",
      },
      {
        remotePath: "/courts/scv/rulesofcourt.pdf",
        localName: "rulesofcourt.pdf",
      },
    ],
  },
  vcc: {
    host: "www.vcsc.virginia.gov",
    basePath: "/VCCs",
    protocol: "http",
    description:
      "Virginia Crime Code (VCC) Book, containing codes used for charging and sentencing.",
    resources: (year = new Date().getFullYear()) => [
      { url: `/${year}/${year}VCCBook.pdf`, localName: `${year}VCCBook.pdf` },
      {
        url: `/${year}/${year}VCCCodeBook.pdf`,
        localName: `${year}VCCCodeBook.pdf`,
      },
    ],
  },
  virginia_code: {
    host: "law.lis.virginia.gov",
    basePath: "",
    description: "The Code of Virginia (all titles) in CSV format.",
    tlsRejectUnauthorized: false,
    resources: [
      { remotePath: "/CSV/PopularNames.csv", localName: "PopularNames.csv" },
      ...[
        "1",
        "2.2",
        "3.2",
        "4.1",
        "5.1",
        "6.2",
        "8.01",
        "8.1A",
        "8.2",
        "8.2A",
        "8.3A",
        "8.4",
        "8.4A",
        "8.5A",
        "8.7",
        "8.8A",
        "8.9A",
        "8.10",
        "8.11",
        "8.12",
        "8.13",
        "9.1",
        "10.1",
        "11",
        "12.1",
        "13.1",
        "15.2",
        "16.1",
        "17.1",
        "18.2",
        "19.2",
        "20",
        "21",
        "22.1",
        "23.1",
        "24.2",
        "25.1",
        "27",
        "28.2",
        "29.1",
        "30",
        "32.1",
        "33.2",
        "34",
        "35.1",
        "36",
        "37.2",
        "38.2",
        "40.1",
        "41.1",
        "42.1",
        "43",
        "44",
        "45.2",
        "46.2",
        "47.1",
        "48",
        "49",
        "50",
        "51.1",
        "51.5",
        "52",
        "53.1",
        "54.1",
        "55.1",
        "56",
        "57",
        "58.1",
        "59.1",
        "60.2",
        "61.1",
        "62.1",
        "63.2",
        "64.2",
        "65.2",
        "66",
      ].map((n) => ({
        remotePath: `/CSV/CoVTitle_${n}.csv`,
        localName: `CoVTitle_${n}.csv`,
      })),
    ],
  },
} as const;

export function getDatasetBaseUrl(
  key: DatasetKey,
  options: { protocol?: "http" | "https"; host?: string; basePath?: string } = {},
): string {
  const config = DATASET_CONFIG[key];
  if (!config) throw new Error(`Unknown dataset: ${key}`);
  const protocol = options.protocol ?? config.protocol ?? "https";
  const host = options.host ?? config.host;
  const basePath = options.basePath ?? config.basePath;
  return `${protocol}://${host}${basePath.startsWith("/") ? basePath : `/${basePath}`}`;
}

/**
 * Configures fetch options, including TLS rejection if needed.
 */
export function configureFetchForDataset(key: DatasetKey): void {
  const config = DATASET_CONFIG[key];
  if (config.tlsRejectUnauthorized === false) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}

/**
 * Gets resources (URLs and local names) for a dataset.
 * For dynamic datasets, pass currentYear.
 */
export function getDatasetResources(
  key: DatasetKey,
  currentYear?: number,
):
  | Array<{ url: string; localName: string; isHtml?: boolean }>
  | { pdfUrl: string; parser?: (pdfPath: string) => Promise<unknown> } {
  const config = DATASET_CONFIG[key];
  if (!config.resources) return [];
  const joinUrl = (base: string, path: string): string =>
    `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  if (typeof config.resources === "function") {
    const baseUrl = getDatasetBaseUrl(key);
    const resources = config.resources(currentYear);
    return resources.map((r) => {
      const url =
        r.url.startsWith("http://") || r.url.startsWith("https://")
          ? r.url
          : joinUrl(baseUrl, r.url);
      return { ...r, url };
    });
  } else if (Array.isArray(config.resources)) {
    const baseUrl = getDatasetBaseUrl(key);
    return config.resources.map(({ remotePath, localName }) => ({
      url: joinUrl(baseUrl, remotePath),
      localName,
    }));
  } else {
    // For parsed like courts
    const baseUrl = getDatasetBaseUrl(key);
    return {
      pdfUrl: joinUrl(baseUrl, config.resources.pdfUrl),
      parser: config.resources.parser,
    };
  }
}

/**
 * Generic function to find the most recent resource (e.g., for year-based datasets).
 * Adapted from annual_reports and vcc logic.
 */
export async function findMostRecentResource(
  key: DatasetKey,
  maxYearsToLookBack = 10,
  method: "HEAD" | "GET" = "HEAD",
): Promise<{
  year: number;
  url: string;
  localName: string;
  isHtml?: boolean;
} | null> {
  configureFetchForDataset(key);
  const currentYear = new Date().getFullYear();
  for (
    let year = currentYear;
    year >= currentYear - maxYearsToLookBack;
    year--
  ) {
    const candidates = getDatasetResources(key, year) as Array<{
      url: string;
      localName: string;
      isHtml?: boolean;
    }>;
    for (const candidate of candidates) {
      try {
        const res = await safeFetch(candidate.url, {
          headers: COMMON_HEADERS,
          method,
        });
        if (res.ok) {
          return { year, ...candidate };
        }
      } catch {
        // Silent fail
      }
    }
  }
  return null;
}

type RequestInfo = Request | string | URL;

/**
 * Generic download function for a resource.
 */
async function safeFetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const headersObj = init?.headers
    ? (init.headers as Record<string, string>)
    : {};
  const headers = new Headers(headersObj);
  if (!headers.has("User-Agent")) headers.set("User-Agent", USER_AGENT);
  if (!headers.has("Accept")) headers.set("Accept", "*/*");

  const method = init?.method ?? "GET";
  const timeoutMs = method === "HEAD" ? 30_000 : 120_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export { safeFetch };

export async function downloadResource(
  url: string,
  targetPath: string,
): Promise<void> {
  const res = await safeFetch(url, { headers: COMMON_HEADERS });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  await Bun.write(targetPath, buffer);
}

/**
 * Gets file size in MB.
 */
export function getFileSizeMB(filepath: string): string {
  const sizeBytes = Bun.file(filepath).size;
  return (sizeBytes / 1024 / 1024).toFixed(1);
}
