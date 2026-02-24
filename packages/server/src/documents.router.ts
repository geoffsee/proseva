import { AutoRouter } from "itty-router";
import { basename } from "path";
import { readFile, stat } from "fs/promises";
import OpenAI from "openai";
import { db } from "./db";
import { getBlobStore } from "./blob-store";
import { ingestPdfToBlob, deriveCategory, classifyDocument } from "./ingest";
import { autoPopulateFromDocument } from "./ingestion-agent";
import { getConfig } from "./config";
import { broadcast } from "./broadcast";
import { safeDownloadFilename } from "./utils";
import { ingestionStatus } from "./ingestion-status";
import {
  asIttyRoute,
  created as openapiCreated,
  json,
  noContent as openapiNoContent,
  notFound as openapiNotFound,
  openapiFormat,
} from "./openapi";

const json201 = <T>(data: T) => openapiCreated(data);
const notFound = () => openapiNotFound();
const noContent = () => openapiNoContent();

const router = AutoRouter({ base: "/api", format: openapiFormat });

router
  .get(
    "/documents",
    asIttyRoute("get", "/documents", async () => {
      return [...db.documents.values()].map(
        ({ extractedText: _extractedText, ...rest }) => rest,
      );
    }),
  )
  .post(
    "/documents/upload",
    asIttyRoute("post", "/documents/upload", async (req) => {
      const formData = await req.formData();
      const category = (formData.get("category") as string) || "_new_filings";
      const files = formData.getAll("files") as File[];

      console.log(
        `[upload] Received ${files.length} file(s), category=${category}`,
      );

      if (files.length === 0) {
        return json(400, { error: "No files provided" });
      }

      const openai = new OpenAI({
        apiKey: getConfig("OPENAI_API_KEY"),
        baseURL: getConfig("OPENAI_ENDPOINT"),
      });

      const newEntries: Array<
        Omit<import("./db").DocumentRecord, "extractedText">
      > = [];

      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          console.log(`[upload] Skipping non-PDF: ${file.name}`);
          continue;
        }
        console.log(
          `[upload] Processing: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`,
        );
        const buffer = Buffer.from(await file.arrayBuffer());
        const { record } = await ingestPdfToBlob(
          buffer,
          file.name,
          category,
          openai,
        );

        if (category === "_auto") {
          const classified = await classifyDocument(
            record.extractedText,
            openai,
          );
          record.category = classified;
          db.documents.set(record.id, record);
          console.log(
            `[upload] Auto-classified ${file.name} as "${classified}"`,
          );
        }

        try {
          console.log(`[upload] Running auto-populate for: ${file.name}`);
          const { caseId, log } = await autoPopulateFromDocument({
            openai,
            entry: record,
            text: record.extractedText,
          });
          if (caseId) {
            record.caseId = caseId;
            db.documents.set(record.id, record);
          }
          console.log(
            `[upload] Auto-populate complete for ${file.name}: caseId=${caseId || "none"}, actions:\n  ${log.join("\n  ")}`,
          );
        } catch (err) {
          console.error("[upload] Auto-populate failed:", err);
        }

        const { extractedText: _extractedText, ...rest } = record;
        newEntries.push(rest);
      }

      if (newEntries.length > 0) {
        db.persist();
      }

      console.log(`[upload] Done. ${newEntries.length} document(s) ingested.`);
      if (newEntries.length > 0) broadcast("documents-changed");
      return json201(newEntries);
    }),
  )

  .get("/documents/:id/download", async ({ params }) => {
    const doc = db.documents.get(params.id);
    if (!doc) return notFound();

    const blob = await getBlobStore().retrieve(params.id);
    if (!blob) return notFound();

    const filename = safeDownloadFilename(doc.filename);
    const normalizedBytes = new Uint8Array(blob.byteLength);
    normalizedBytes.set(blob);
    const responseBlob = new Blob([normalizedBytes], {
      type: "application/pdf",
    });

    return new Response(responseBlob, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": String(responseBlob.size),
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  })
  .get("/documents/:id/text", async ({ params }) => {
    const doc = db.documents.get(params.id);
    if (!doc) return notFound();

    return new Response(doc.extractedText, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  })
  .delete(
    "/documents/:id",
    asIttyRoute("delete", "/documents/:id", async ({ params }) => {
      const doc = db.documents.get(params.id);
      if (!doc) return notFound();

      try {
        await getBlobStore().delete(params.id);
      } catch {
        /* best effort */
      }
      db.fileMetadata.delete(params.id);
      db.documents.delete(params.id);
      db.persist();
      return noContent();
    }),
  )

  // --- Ingestion status ---
  .get(
    "/ingest/status",
    asIttyRoute("get", "/ingest/status", () => ingestionStatus),
  )

  // --- Scan directory for documents ---
  .post(
    "/ingest/scan",
    asIttyRoute("post", "/ingest/scan", async (req) => {
      try {
        const body = await req.json();
        const { directory } = body;

        if (!directory) {
          return json(400, { error: "directory is required" });
        }

        // Verify OpenAI is configured
        const openaiApiKey = getConfig("OPENAI_API_KEY");
        if (!openaiApiKey) {
          return json(400, { error: "OpenAI API key not configured" });
        }

        // Verify directory exists and is accessible
        try {
          const dirStat = await stat(directory);
          if (!dirStat.isDirectory()) {
            return json(400, { error: "Path is not a directory" });
          }
        } catch {
          return json(400, { error: "Directory not found or not accessible" });
        }

        const startedAt = new Date().toISOString();
        const openai = new OpenAI({
          apiKey: openaiApiKey,
          baseURL: getConfig("OPENAI_ENDPOINT"),
        });

        const existingSignatures = new Set(
          [...db.documents.values()].map((e) => `${e.filename}|${e.fileSize}`),
        );

        // Find all PDFs in directory recursively
        const { readdirSync, statSync } = await import("fs");
        const { resolve } = await import("path");

        function* walkSync(dir: string): Generator<string> {
          const files = readdirSync(dir);
          for (const file of files) {
            const pathToFile = resolve(dir, file);
            const isDirectory = statSync(pathToFile).isDirectory();
            if (isDirectory) {
              yield* walkSync(pathToFile);
            } else if (file.toLowerCase().endsWith(".pdf")) {
              yield pathToFile;
            }
          }
        }

        const pdfFiles = [...walkSync(directory)];
        let added = 0;
        let skipped = 0;
        let errors = 0;

        for (const pdfPath of pdfFiles) {
          try {
            const buffer = await readFile(pdfPath);
            const filename = basename(pdfPath);
            const fileStats = await stat(pdfPath);
            const signature = `${filename}|${fileStats.size}`;

            if (existingSignatures.has(signature)) {
              skipped++;
              continue;
            }

            const category = deriveCategory(pdfPath, directory);
            const { record } = await ingestPdfToBlob(
              buffer,
              filename,
              category,
              openai,
            );

            try {
              const { caseId } = await autoPopulateFromDocument({
                openai,
                entry: record,
                text: record.extractedText,
              });
              if (caseId) {
                record.caseId = caseId;
                db.documents.set(record.id, record);
              }
            } catch (err) {
              console.error("Auto-populate failed for", filename, err);
            }

            existingSignatures.add(signature);
            added++;
          } catch (err) {
            console.error("Failed to ingest", pdfPath, err);
            errors++;
          }
        }

        if (added > 0) {
          db.persist();
        }

        const finishedAt = new Date().toISOString();

        return {
          status: "completed",
          added,
          skipped,
          errors,
          directory,
          startedAt,
          finishedAt,
        };
      } catch (error) {
        return json(500, {
          error: error instanceof Error ? error.message : "Scan failed",
        });
      }
    }),
  );

export { router as documentsRouter };
