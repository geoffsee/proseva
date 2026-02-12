import { types, flow } from "mobx-state-tree";
import { api } from "../lib/api";
import type {
  EvaluationType,
  DeviceToken,
  SmsRecipient,
  SchedulerStatus,
} from "../lib/api";

const DeadlineSummaryModel = types.model("DeadlineSummary", {
  id: types.string,
  title: types.string,
  date: types.string,
  caseId: types.string,
  caseName: types.maybe(types.string),
  type: types.string,
  daysOverdue: types.maybe(types.number),
  daysUntil: types.maybe(types.number),
});

const NotificationModel = types.model("Notification", {
  title: types.string,
  body: types.string,
  sentAt: types.maybe(types.string),
  pushSent: types.maybe(types.boolean),
  smsSent: types.maybe(types.boolean),
});

const AnalysisModel = types.model("Analysis", {
  overdueDeadlines: types.array(DeadlineSummaryModel),
  upcomingDeadlines: types.array(DeadlineSummaryModel),
  tomorrowActions: types.array(types.string),
  aiSummary: types.string,
});

const EvaluationModel = types.model("Evaluation", {
  id: types.identifier,
  createdAt: types.string,
  status: types.enumeration([
    "pending",
    "analyzing",
    "sending",
    "sent",
    "failed",
  ]),
  analysis: AnalysisModel,
  notification: NotificationModel,
  error: types.maybe(types.string),
});

const DeviceTokenModel = types.model("DeviceToken", {
  id: types.identifier,
  token: types.string,
  platform: types.enumeration(["ios", "android", "web"]),
  createdAt: types.string,
  active: types.boolean,
});

const SmsRecipientModel = types.model("SmsRecipient", {
  id: types.identifier,
  phone: types.string,
  name: types.maybe(types.string),
  createdAt: types.string,
  active: types.boolean,
});

const ChannelStatusModel = types.model("ChannelStatus", {
  configured: types.boolean,
  tokenCount: types.optional(types.number, 0),
  recipientCount: types.optional(types.number, 0),
});

const SchedulerStatusModel = types.model("SchedulerStatus", {
  enabled: types.boolean,
  running: types.boolean,
  lastRunTime: types.maybeNull(types.string),
  nextRunTime: types.maybeNull(types.string),
  timezone: types.string,
  cronExpression: types.string,
  channels: types.model({
    firebase: ChannelStatusModel,
    twilio: ChannelStatusModel,
  }),
});

export const EvaluationStore = types
  .model("EvaluationStore", {
    evaluations: types.array(EvaluationModel),
    deviceTokens: types.array(DeviceTokenModel),
    smsRecipients: types.array(SmsRecipientModel),
    schedulerStatus: types.maybeNull(SchedulerStatusModel),
    isLoading: types.optional(types.boolean, false),
    isTriggering: types.optional(types.boolean, false),
  })
  .views((self) => ({
    get sortedEvaluations() {
      return [...self.evaluations].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
    get latestEvaluation() {
      return this.sortedEvaluations[0] ?? null;
    },
    get activeDeviceTokens() {
      return self.deviceTokens.filter((t) => t.active);
    },
    get activeSmsRecipients() {
      return self.smsRecipients.filter((r) => r.active);
    },
    getEvaluationById(id: string) {
      return self.evaluations.find((e) => e.id === id) ?? null;
    },
  }))
  .actions((self) => ({
    loadEvaluations: flow(function* () {
      self.isLoading = true;
      try {
        const evaluations: EvaluationType[] = yield api.evaluations.list();
        // @ts-expect-error - MST array replace type mismatch with plain array
        self.evaluations.replace(evaluations);
      } catch (error) {
        console.error("Failed to load evaluations:", error);
      } finally {
        self.isLoading = false;
      }
    }),

    loadDeviceTokens: flow(function* () {
      try {
        const tokens: DeviceToken[] = yield api.deviceTokens.list();
        // @ts-expect-error - MST array replace type mismatch with plain array
        self.deviceTokens.replace(tokens);
      } catch (error) {
        console.error("Failed to load device tokens:", error);
      }
    }),

    loadSmsRecipients: flow(function* () {
      try {
        const recipients: SmsRecipient[] = yield api.smsRecipients.list();
        // @ts-expect-error - MST array replace type mismatch with plain array
        self.smsRecipients.replace(recipients);
      } catch (error) {
        console.error("Failed to load SMS recipients:", error);
      }
    }),

    loadSchedulerStatus: flow(function* () {
      try {
        const status: SchedulerStatus = yield api.scheduler.status();
        // @ts-expect-error - MST model assignment type mismatch
        self.schedulerStatus = status;
      } catch (error) {
        console.error("Failed to load scheduler status:", error);
      }
    }),

    loadAll: flow(function* () {
      yield Promise.all([
        self.loadEvaluations(),
        self.loadDeviceTokens(),
        self.loadSmsRecipients(),
        self.loadSchedulerStatus(),
      ]);
    }),

    triggerEvaluation: flow(function* () {
      self.isTriggering = true;
      try {
        const result: {
          evaluationId: string;
          pushSent: boolean;
          smsSent: boolean;
        } = yield api.evaluations.trigger();
        // Reload evaluations to get the new one
        yield self.loadEvaluations();
        return result;
      } catch (error) {
        console.error("Failed to trigger evaluation:", error);
        throw error;
      } finally {
        self.isTriggering = false;
      }
    }),

    addDeviceToken: flow(function* (
      token: string,
      platform: "ios" | "android" | "web",
    ) {
      try {
        const newToken: DeviceToken = yield api.deviceTokens.create({
          token,
          platform,
        });
        // @ts-expect-error - MST array push type mismatch
        self.deviceTokens.push(newToken);
        return newToken;
      } catch (error) {
        console.error("Failed to add device token:", error);
        throw error;
      }
    }),

    removeDeviceToken: flow(function* (id: string) {
      try {
        yield api.deviceTokens.delete(id);
        const idx = self.deviceTokens.findIndex((t) => t.id === id);
        if (idx >= 0) {
          self.deviceTokens.splice(idx, 1);
        }
      } catch (error) {
        console.error("Failed to remove device token:", error);
        throw error;
      }
    }),

    addSmsRecipient: flow(function* (phone: string, name?: string) {
      try {
        const newRecipient: SmsRecipient = yield api.smsRecipients.create({
          phone,
          name,
        });
        // @ts-expect-error - MST array push type mismatch
        self.smsRecipients.push(newRecipient);
        return newRecipient;
      } catch (error) {
        console.error("Failed to add SMS recipient:", error);
        throw error;
      }
    }),

    removeSmsRecipient: flow(function* (id: string) {
      try {
        yield api.smsRecipients.delete(id);
        const idx = self.smsRecipients.findIndex((r) => r.id === id);
        if (idx >= 0) {
          self.smsRecipients.splice(idx, 1);
        }
      } catch (error) {
        console.error("Failed to remove SMS recipient:", error);
        throw error;
      }
    }),
  }));

export type IEvaluationStore = ReturnType<typeof EvaluationStore.create>;
