import { writeFile } from "node:fs/promises";

const SCAN_NS = "http://schemas.hp.com/imaging/escl/2011/05/03";
const PWG_NS = "http://www.pwg.org/schemas/2010/12/sm";

const DEFAULT_ENDPOINTS = [
  "http://scanner.local:8080",
] as const;

const RETRYABLE_DOCUMENT_STATUSES = new Set([404, 409, 423, 425, 503]);

type HeaderBag = Headers | Record<string, string> | Array<[string, string]>;

export interface BrotherAds3300wOptions {
  endpoints?: string[];
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  defaultHeaders?: HeaderBag;
}

export interface ScanRegion {
  width: number;
  height: number;
  xOffset?: number;
  yOffset?: number;
}

export interface ScanSettings {
  intent?: string;
  inputSource?: string;
  duplex?: boolean;
  colorMode?: string;
  xResolution?: number;
  yResolution?: number;
  documentFormat?: string;
  scanRegion?: ScanRegion;
  brightness?: number;
  contrast?: number;
  threshold?: number;
}

export interface ScanJob {
  id: string;
  location: string;
  endpoint: string;
  requestXml: string;
}

export interface ScannedDocument {
  data: ArrayBuffer;
  contentType: string;
  sizeBytes: number;
  endpoint: string;
}

export interface ScanOnceOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface ScannerCapabilities {
  endpoint: string;
  rawXml: string;
  makeAndModel?: string;
  modelName?: string;
  uuid?: string;
  adminUrl?: string;
  documentFormats: string[];
  colorModes: string[];
  inputSources: string[];
  supportedResolutions: number[];
}

export interface ScannerStatus {
  endpoint: string;
  rawXml: string;
  scannerState?: string;
  adfState?: string;
  jobState?: string;
}

export class ScannerHttpError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly path: string;
  readonly responseBody: string;

  constructor(message: string, args: { status: number; endpoint: string; path: string; responseBody: string }) {
    super(message);
    this.name = "ScannerHttpError";
    this.status = args.status;
    this.endpoint = args.endpoint;
    this.path = args.path;
    this.responseBody = args.responseBody;
  }
}

export class BrotherAds3300wSdk {
  private readonly endpoints: string[];
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: HeaderBag;
  private preferredEndpoint: string;

  constructor(options: BrotherAds3300wOptions = {}) {
    const configuredEndpoints = options.endpoints?.map(normalizeEndpoint).filter((endpoint) => endpoint.length > 0) ?? [];
    this.endpoints = configuredEndpoints.length > 0 ? unique(configuredEndpoints) : [...DEFAULT_ENDPOINTS];
    const firstEndpoint = this.endpoints[0];
    if (!firstEndpoint) {
      throw new Error("At least one scanner endpoint is required.");
    }

    this.timeoutMs = options.requestTimeoutMs ?? 8000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.preferredEndpoint = firstEndpoint;
  }

  get configuredEndpoints(): readonly string[] {
    return this.endpoints;
  }

  async getCapabilitiesXml(): Promise<string> {
    const { endpoint, response } = await this.request("/eSCL/ScannerCapabilities");
    if (!response.ok) {
      throw await toHttpError(response, endpoint, "/eSCL/ScannerCapabilities");
    }
    return await response.text();
  }

  async getCapabilities(): Promise<ScannerCapabilities> {
    const { endpoint, response } = await this.request("/eSCL/ScannerCapabilities");
    if (!response.ok) {
      throw await toHttpError(response, endpoint, "/eSCL/ScannerCapabilities");
    }

    const xml = await response.text();
    return {
      endpoint,
      rawXml: xml,
      makeAndModel: firstTagValue(xml, "MakeAndModel"),
      modelName: firstTagValue(xml, "ModelName") ?? firstTagValue(xml, "Model"),
      uuid: firstTagValue(xml, "UUID"),
      adminUrl: firstTagValue(xml, "AdminURI"),
      documentFormats: unique(tagValues(xml, "DocumentFormat")),
      colorModes: unique(tagValues(xml, "ColorMode")),
      inputSources: unique(tagValues(xml, "InputSource")),
      supportedResolutions: unique(
        [...tagValues(xml, "XResolution"), ...tagValues(xml, "YResolution")]
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isFinite(value)),
      ).sort((a, b) => a - b),
    };
  }

  async getStatusXml(): Promise<string> {
    const { endpoint, response } = await this.request("/eSCL/ScannerStatus");
    if (!response.ok) {
      throw await toHttpError(response, endpoint, "/eSCL/ScannerStatus");
    }
    return await response.text();
  }

  async getStatus(): Promise<ScannerStatus> {
    const { endpoint, response } = await this.request("/eSCL/ScannerStatus");
    if (!response.ok) {
      throw await toHttpError(response, endpoint, "/eSCL/ScannerStatus");
    }

    const xml = await response.text();
    return {
      endpoint,
      rawXml: xml,
      scannerState: firstTagValue(xml, "ScannerState") ?? firstTagValue(xml, "ScanState") ?? firstTagValue(xml, "State"),
      adfState: firstTagValue(xml, "AdfState"),
      jobState: firstTagValue(xml, "JobState"),
    };
  }

  buildScanSettingsXml(settings: ScanSettings = {}): string {
    const intent = settings.intent ?? "Document";
    const inputSource = settings.inputSource ?? "Feeder";
    const colorMode = settings.colorMode ?? "RGB24";
    const xResolution = settings.xResolution ?? 300;
    const yResolution = settings.yResolution ?? settings.xResolution ?? 300;
    const documentFormat = settings.documentFormat ?? "image/jpeg";

    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<scan:ScanSettings xmlns:scan="${SCAN_NS}" xmlns:pwg="${PWG_NS}">`);
    lines.push("  <pwg:Version>2.63</pwg:Version>");
    lines.push(`  <scan:Intent>${escapeXml(intent)}</scan:Intent>`);
    lines.push(`  <scan:InputSource>${escapeXml(inputSource)}</scan:InputSource>`);
    lines.push(`  <scan:ColorMode>${escapeXml(colorMode)}</scan:ColorMode>`);
    lines.push(`  <scan:XResolution>${xResolution}</scan:XResolution>`);
    lines.push(`  <scan:YResolution>${yResolution}</scan:YResolution>`);
    lines.push(`  <pwg:DocumentFormat>${escapeXml(documentFormat)}</pwg:DocumentFormat>`);

    if (typeof settings.duplex === "boolean") {
      lines.push(`  <scan:Duplex>${settings.duplex ? "true" : "false"}</scan:Duplex>`);
    }
    if (typeof settings.brightness === "number") {
      lines.push(`  <scan:Brightness>${settings.brightness}</scan:Brightness>`);
    }
    if (typeof settings.contrast === "number") {
      lines.push(`  <scan:Contrast>${settings.contrast}</scan:Contrast>`);
    }
    if (typeof settings.threshold === "number") {
      lines.push(`  <scan:Threshold>${settings.threshold}</scan:Threshold>`);
    }
    if (settings.scanRegion) {
      const xOffset = settings.scanRegion.xOffset ?? 0;
      const yOffset = settings.scanRegion.yOffset ?? 0;
      lines.push("  <pwg:ScanRegions>");
      lines.push("    <pwg:ScanRegion>");
      lines.push(`      <pwg:Height>${settings.scanRegion.height}</pwg:Height>`);
      lines.push(`      <pwg:Width>${settings.scanRegion.width}</pwg:Width>`);
      lines.push(`      <pwg:XOffset>${xOffset}</pwg:XOffset>`);
      lines.push(`      <pwg:YOffset>${yOffset}</pwg:YOffset>`);
      lines.push("    </pwg:ScanRegion>");
      lines.push("  </pwg:ScanRegions>");
    }

    lines.push("</scan:ScanSettings>");
    return lines.join("\n");
  }

  async createScanJob(settings: ScanSettings = {}): Promise<ScanJob> {
    const requestXml = this.buildScanSettingsXml(settings);
    const { endpoint, response } = await this.request("/eSCL/ScanJobs", {
      method: "POST",
      headers: {
        "content-type": "application/xml",
      },
      body: requestXml,
    });

    if (![200, 201, 202].includes(response.status)) {
      throw await toHttpError(response, endpoint, "/eSCL/ScanJobs");
    }

    const locationHeader = response.headers.get("location");
    if (!locationHeader) {
      const responseBody = await safeReadText(response);
      throw new Error(
        `Scanner accepted ScanJobs request but did not provide Location header. Endpoint: ${endpoint}. Body: ${responseBody.slice(0, 200)}`,
      );
    }

    const location = resolveAgainstEndpoint(endpoint, locationHeader);
    const id = extractJobId(location);

    return { id, location, endpoint, requestXml };
  }

  async getNextDocument(job: string | ScanJob, allowNotReady = false): Promise<ScannedDocument | null> {
    const nextDocumentPath = toNextDocumentPath(job);
    const { endpoint, response } = await this.requestFromPathOrUrl(nextDocumentPath);

    if (allowNotReady && RETRYABLE_DOCUMENT_STATUSES.has(response.status)) {
      return null;
    }
    if (!response.ok) {
      throw await toHttpError(response, endpoint, nextDocumentPath);
    }

    const data = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    return {
      data,
      contentType,
      sizeBytes: data.byteLength,
      endpoint,
    };
  }

  async waitForNextDocument(job: string | ScanJob, options: ScanOnceOptions = {}): Promise<ScannedDocument> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const pollIntervalMs = options.pollIntervalMs ?? 750;

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const document = await this.getNextDocument(job, true);
      if (document) {
        return document;
      }
      await sleep(pollIntervalMs);
    }

    throw new Error(`Timed out waiting for scanned document after ${timeoutMs}ms.`);
  }

  async scanOnce(settings: ScanSettings = {}, options: ScanOnceOptions = {}): Promise<{ job: ScanJob; document: ScannedDocument }> {
    const job = await this.createScanJob(settings);
    const document = await this.waitForNextDocument(job, options);
    return { job, document };
  }

  async deleteScanJob(job: string | ScanJob): Promise<void> {
    const jobPath = toJobPath(job);
    const { endpoint, response } = await this.requestFromPathOrUrl(jobPath, { method: "DELETE" });

    if ([200, 202, 204, 404, 405].includes(response.status)) {
      return;
    }
    throw await toHttpError(response, endpoint, jobPath);
  }

  private async request(path: string, init: RequestInit = {}): Promise<{ endpoint: string; response: Response }> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const endpointOrder = this.endpointOrder();
    const errors: unknown[] = [];

    for (const endpoint of endpointOrder) {
      const url = `${endpoint}${normalizedPath}`;
      try {
        const response = await fetchWithTimeout(this.fetchImpl, url, this.withDefaultHeaders(init), this.timeoutMs);
        this.preferredEndpoint = endpoint;
        return { endpoint, response };
      } catch (error) {
        errors.push(new Error(`${endpoint}${normalizedPath}: ${stringifyError(error)}`));
      }
    }

    throw new AggregateError(errors, `Could not reach scanner on any endpoint: ${this.endpoints.join(", ")}`);
  }

  private async requestFromPathOrUrl(
    pathOrUrl: string,
    init: RequestInit = {},
  ): Promise<{ endpoint: string; response: Response }> {
    if (isAbsoluteUrl(pathOrUrl)) {
      const endpoint = new URL(pathOrUrl).origin;
      const response = await fetchWithTimeout(this.fetchImpl, pathOrUrl, this.withDefaultHeaders(init), this.timeoutMs);
      return { endpoint, response };
    }

    return this.request(pathOrUrl, init);
  }

  private withDefaultHeaders(init: RequestInit): RequestInit {
    const headers = new Headers(this.defaultHeaders);
    const overrideHeaders = new Headers(init.headers);
    overrideHeaders.forEach((value, key) => headers.set(key, value));

    return {
      ...init,
      headers,
    };
  }

  private endpointOrder(): string[] {
    const ordered = [this.preferredEndpoint, ...this.endpoints.filter((endpoint) => endpoint !== this.preferredEndpoint)];
    return unique(ordered);
  }
}

export async function saveScannedDocument(filePath: string, document: ScannedDocument): Promise<void> {
  await writeFile(filePath, new Uint8Array(document.data));
}

export function inferFileExtension(contentType: string): string {
  const lowered = contentType.toLowerCase();
  if (lowered.includes("pdf")) return "pdf";
  if (lowered.includes("jpeg") || lowered.includes("jpg")) return "jpg";
  if (lowered.includes("png")) return "png";
  if (lowered.includes("tiff")) return "tiff";
  return "bin";
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function tagValues(xml: string, localName: string): string[] {
  const pattern = new RegExp(`<(?:[A-Za-z0-9_-]+:)?${escapeRegExp(localName)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${escapeRegExp(localName)}>`, "g");
  const values: string[] = [];
  let match = pattern.exec(xml);
  while (match) {
    const value = match[1]?.trim();
    if (value) {
      values.push(unescapeXml(value));
    }
    match = pattern.exec(xml);
  }
  return values;
}

function firstTagValue(xml: string, localName: string): string | undefined {
  return tagValues(xml, localName)[0];
}

function unescapeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function resolveAgainstEndpoint(endpoint: string, locationHeader: string): string {
  if (isAbsoluteUrl(locationHeader)) {
    return locationHeader;
  }
  if (locationHeader.startsWith("/")) {
    return `${endpoint}${locationHeader}`;
  }
  return `${endpoint}/${locationHeader}`;
}

function toJobPath(job: string | ScanJob): string {
  if (typeof job !== "string") {
    return job.location;
  }

  const trimmed = job.trim();
  if (isAbsoluteUrl(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/eSCL/ScanJobs/")) {
    return trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    return `/eSCL/ScanJobs/${trimmed}`;
  }
  return trimmed;
}

function toNextDocumentPath(job: string | ScanJob): string {
  const jobPath = toJobPath(job).replace(/\/+$/, "");
  if (jobPath.endsWith("/NextDocument")) {
    return jobPath;
  }
  return `${jobPath}/NextDocument`;
}

function extractJobId(location: string): string {
  const withoutNextDocument = location.replace(/\/NextDocument\/?$/i, "");
  const parts = withoutNextDocument.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

async function toHttpError(response: Response, endpoint: string, path: string): Promise<ScannerHttpError> {
  const body = await safeReadText(response);
  const compactBody = body.replace(/\s+/g, " ").trim().slice(0, 300);
  const message = `Scanner request failed (${response.status}) for ${endpoint}${path}${compactBody ? `: ${compactBody}` : ""}`;
  return new ScannerHttpError(message, {
    status: response.status,
    endpoint,
    path,
    responseBody: body,
  });
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const linkedAbort = () => controller.abort();

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", linkedAbort, { once: true });
    }
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    if (init.signal) {
      init.signal.removeEventListener("abort", linkedAbort);
    }
  }
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
