import { describe, it, expect, vi } from "vitest";
import { EvaluationStore } from "./EvaluationStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.evaluations, "list").mockResolvedValue([]);
vi.spyOn(apiModule.api.evaluations, "trigger").mockResolvedValue({
  evaluationId: "1",
  pushSent: true,
  smsSent: true,
});
vi.spyOn(apiModule.api.deviceTokens, "list").mockResolvedValue([]);
vi.spyOn(apiModule.api.deviceTokens, "create").mockResolvedValue({} as any);
vi.spyOn(apiModule.api.deviceTokens, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.smsRecipients, "list").mockResolvedValue([]);
vi.spyOn(apiModule.api.smsRecipients, "create").mockResolvedValue({} as any);
vi.spyOn(apiModule.api.smsRecipients, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.scheduler, "status").mockResolvedValue({
  enabled: true,
  running: false,
  lastRunTime: null,
  nextRunTime: null,
  timezone: "UTC",
  cronExpression: "0 9 * * *",
  channels: {
    firebase: { configured: true, tokenCount: 0 },
    twilio: { configured: true, recipientCount: 0 },
  },
});

function createStore() {
  return EvaluationStore.create({});
}

describe("EvaluationStore", () => {
  it("loadEvaluations loads from api", async () => {
    const mockEvaluations = [
      {
        id: "1",
        createdAt: new Date().toISOString(),
        status: "sent",
        analysis: {
          overdueDeadlines: [],
          upcomingDeadlines: [],
          tomorrowActions: [],
          aiSummary: "Test Summary",
        },
        notification: {
          title: "Test Title",
          body: "Test Body",
        },
      },
    ];
    vi.spyOn(apiModule.api.evaluations, "list").mockResolvedValue(
      mockEvaluations as any,
    );

    const store = createStore();
    await store.loadEvaluations();

    expect(store.evaluations).toHaveLength(1);
    expect(apiModule.api.evaluations.list).toHaveBeenCalled();
  });

  it("loadAll loads everything", async () => {
    const store = createStore();
    await store.loadAll();

    expect(apiModule.api.evaluations.list).toHaveBeenCalled();
    expect(apiModule.api.deviceTokens.list).toHaveBeenCalled();
    expect(apiModule.api.smsRecipients.list).toHaveBeenCalled();
    expect(apiModule.api.scheduler.status).toHaveBeenCalled();
  });

  it("triggerEvaluation calls api and reloads", async () => {
    const store = createStore();
    const triggerSpy = vi.spyOn(apiModule.api.evaluations, "trigger");
    const listSpy = vi.spyOn(apiModule.api.evaluations, "list");

    await store.triggerEvaluation();

    expect(triggerSpy).toHaveBeenCalled();
    expect(listSpy).toHaveBeenCalled();
  });

  it("addDeviceToken adds and calls api", async () => {
    const mockToken = {
      id: "t1",
      token: "abc",
      platform: "ios",
      active: true,
      createdAt: new Date().toISOString(),
    };
    vi.spyOn(apiModule.api.deviceTokens, "create").mockResolvedValue(
      mockToken as any,
    );

    const store = createStore();
    await store.addDeviceToken("abc", "ios");

    expect(store.deviceTokens).toHaveLength(1);
    expect(store.deviceTokens[0].token).toBe("abc");
    expect(apiModule.api.deviceTokens.create).toHaveBeenCalled();
  });

  it("addSmsRecipient adds and calls api", async () => {
    const mockRecipient = {
      id: "r1",
      phone: "123",
      active: true,
      createdAt: new Date().toISOString(),
    };
    vi.spyOn(apiModule.api.smsRecipients, "create").mockResolvedValue(
      mockRecipient as any,
    );

    const store = createStore();
    await store.addSmsRecipient("123", "User");

    expect(store.smsRecipients).toHaveLength(1);
    expect(store.smsRecipients[0].phone).toBe("123");
    expect(apiModule.api.smsRecipients.create).toHaveBeenCalled();
  });
});
