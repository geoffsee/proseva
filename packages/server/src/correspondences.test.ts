import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";
import type { Correspondence } from "./db.ts";

const ctx = setupTestServer();

describe("Correspondence API", () => {
  it("lists empty", async () => {
    const res = await api.get("/api/correspondences", ctx.baseUrl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates a correspondence", async () => {
    const res = await api.post(
      "/api/correspondences",
      {
        caseId: "case-1",
        direction: "incoming",
        channel: "email",
        subject: "Status Update",
        sender: "clerk@example.org",
        recipient: "user@example.org",
        summary: "Hearing rescheduled",
      },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect((body as any).subject).toBe("Status Update");
    expect((body as any).direction).toBe("incoming");
    expect((body as any).channel).toBe("email");
    expect((body as any).id).toBeTruthy();
  });

  it("gets by id", async () => {
    const created = await (
      await api.post(
        "/api/correspondences",
        { subject: "Get Test" },
        ctx.baseUrl,
      )
    ).json();

    const res = await api.get(
      `/api/correspondences/${(created as Correspondence).id}`,
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).subject).toBe("Get Test");
  });

  it("returns 404 for missing", async () => {
    const res = await api.get("/api/correspondences/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("updates a correspondence", async () => {
    const created = await (
      await api.post(
        "/api/correspondences",
        { subject: "Old Subject" },
        ctx.baseUrl,
      )
    ).json();

    const res = await api.patch(
      `/api/correspondences/${(created as Correspondence).id}`,
      { subject: "New Subject", channel: "mail" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect((body as Record<string, unknown>).subject).toBe("New Subject");
    expect((body as Record<string, unknown>).channel).toBe("mail");
  });

  it("returns 404 updating missing", async () => {
    const res = await api.patch(
      "/api/correspondences/nope",
      { subject: "X" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(404);
  });

  it("deletes a correspondence", async () => {
    const created = await (
      await api.post(
        "/api/correspondences",
        { subject: "Delete Me" },
        ctx.baseUrl,
      )
    ).json();

    const res = await api.delete(
      `/api/correspondences/${(created as Correspondence).id}`,
      ctx.baseUrl,
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 deleting missing", async () => {
    const res = await api.delete("/api/correspondences/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("supports singular endpoint aliases", async () => {
    const created = await (
      await api.post(
        "/api/correspondence",
        { subject: "Alias Route" },
        ctx.baseUrl,
      )
    ).json();

    const listRes = await api.get("/api/correspondence", ctx.baseUrl);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(Array.isArray(list)).toBe(true);
    expect(
      (list as Correspondence[]).some(
        (item: { id: string }) => item.id === (created as Correspondence).id,
      ),
    ).toBe(true);
  });

  it("imports .eml files via parser", async () => {
    const emlContent = [
      "Date: Tue, 01 Jan 2025 10:00:00 +0000",
      "From: sender@example.com",
      "To: recipient@example.com",
      "Subject: Imported Email",
      "Message-ID: <imported-1@example.com>",
      "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="boundary123"',
      "",
      "--boundary123",
      'Content-Type: text/plain; charset="utf-8"',
      "",
      "This is a test email import.",
      "--boundary123",
      'Content-Type: application/pdf; name="test.pdf"',
      "Content-Transfer-Encoding: base64",
      'Content-Disposition: attachment; filename="test.pdf"',
      "",
      "SGVsbG8gYXR0YWNobWVudA==",
      "--boundary123--",
    ].join("\r\n");

    const file = new File([emlContent], "import-test.eml", {
      type: "message/rfc822",
    });
    const formData = new FormData();
    formData.append("files", file);
    formData.append("caseId", "case-abc");

    const importRes = await api.postForm(
      "/api/correspondences/import-email",
      formData,
      ctx.baseUrl,
    );
    expect(importRes.status).toBe(201);
    const importBody = await importRes.json();
    expect((importBody as Record<string, unknown>).createdCount).toBe(1);
    expect((importBody as Record<string, unknown>).errorCount).toBe(0);
    expect(
      (importBody as Record<string, Record<string, unknown>[]>).created![0]!
        .channel,
    ).toBe("email");
    expect(
      (importBody as Record<string, Record<string, unknown>[]>).created![0]!
        .subject,
    ).toBe("Imported Email");
    expect(
      (importBody as Record<string, Record<string, unknown>[]>).created![0]!
        .sender,
    ).toContain("sender@example.com");
    expect(
      (importBody as Record<string, Record<string, unknown>[]>).created![0]!
        .recipient,
    ).toContain("recipient@example.com");
    expect(
      (importBody as Record<string, Record<string, unknown>[]>).created![0]!
        .caseId,
    ).toBe("case-abc");
    expect(
      (importBody as Record<string, Record<string, unknown>[]>).created![0]!
        .attachments,
    ).toHaveLength(1);
    expect(
      (
        (importBody as Record<string, Record<string, unknown>[]>).created![0]!
          .attachments as any[]
      ).at(0).filename,
    ).toBe("test.pdf");

    const correspondenceId = (importBody as any).created[0].id as string;
    const attachmentId = (importBody as any).created[0].attachments[0]
      .id as string;
    const downloadRes = await api.get(
      `/api/correspondences/${correspondenceId}/attachments/${attachmentId}`,
      ctx.baseUrl,
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const downloaded = new TextDecoder().decode(
      new Uint8Array(await downloadRes.arrayBuffer()),
    );
    expect(downloaded).toBe("Hello attachment");

    const deleteRes = await api.delete(
      `/api/correspondences/${correspondenceId}`,
      ctx.baseUrl,
    );
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await api.get(
      `/api/correspondences/${correspondenceId}/attachments/${attachmentId}`,
      ctx.baseUrl,
    );
    expect(afterDeleteRes.status).toBe(404);
  });
});
