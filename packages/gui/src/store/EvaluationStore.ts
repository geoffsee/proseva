import { types, flow, type Instance } from "mobx-state-tree";
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

type EvaluationInstance = Instance<typeof EvaluationModel>;
type DeviceTokenInstance = Instance<typeof DeviceTokenModel>;
type SmsRecipientInstance = Instance<typeof SmsRecipientModel>;
type SchedulerStatusInstance = Instance<typeof SchedulerStatusModel>;

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
  .actions((self) => {
    const loadEvaluations = flow(function* loadEvaluations() {
      self.isLoading = true;
      try {
        const evaluations: EvaluationType[] = yield api.evaluations.list();
        self.evaluations.replace(
          evaluations as unknown as EvaluationInstance[],
        );
      } catch (error) {
        console.error("Failed to load evaluations:", error);
      } finally {
        self.isLoading = false;
      }
    });

    const loadDeviceTokens = flow(function* loadDeviceTokens() {
      try {
        const tokens: DeviceToken[] = yield api.deviceTokens.list();
        self.deviceTokens.replace(tokens as unknown as DeviceTokenInstance[]);
      } catch (error) {
        console.error("Failed to load device tokens:", error);
      }
    });

    const loadSmsRecipients = flow(function* loadSmsRecipients() {
      try {
        const recipients: SmsRecipient[] = yield api.smsRecipients.list();
        self.smsRecipients.replace(
          recipients as unknown as SmsRecipientInstance[],
        );
      } catch (error) {
        console.error("Failed to load SMS recipients:", error);
      }
    });

    const loadSchedulerStatus = flow(function* loadSchedulerStatus() {
      try {
        const status: SchedulerStatus = yield api.scheduler.status();
        self.schedulerStatus = status as unknown as SchedulerStatusInstance;
      } catch (error) {
        console.error("Failed to load scheduler status:", error);
      }
    });

    const loadAll = flow(function* loadAll() {
      yield Promise.all([
        loadEvaluations(),
        loadDeviceTokens(),
        loadSmsRecipients(),
        loadSchedulerStatus(),
      ]);
    });

    type TriggerResult = {
      evaluationId: string;
      pushSent: boolean;
      smsSent: boolean;
    };

    const triggerEvaluation = flow(function* triggerEvaluation(): Generator<
      PromiseLike<unknown>,
      TriggerResult,
      unknown
    > {
      self.isTriggering = true;
      try {
        const result = (yield api.evaluations.trigger()) as TriggerResult;
        // Reload evaluations to get the new one
        yield loadEvaluations();
        return result;
      } catch (error) {
        console.error("Failed to trigger evaluation:", error);
        throw error;
      } finally {
        self.isTriggering = false;
      }
    });

    const addDeviceToken = flow(function* addDeviceToken(
      token: string,
      platform: "ios" | "android" | "web",
    ) {
      try {
        const newToken: DeviceToken = yield api.deviceTokens.create({
          token,
          platform,
        });
        self.deviceTokens.push(newToken as unknown as DeviceTokenInstance);
        return newToken;
      } catch (error) {
        console.error("Failed to add device token:", error);
        throw error;
      }
    });

    const removeDeviceToken = flow(function* removeDeviceToken(id: string) {
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
    });

    const addSmsRecipient = flow(function* addSmsRecipient(
      phone: string,
      name?: string,
    ) {
      try {
        const newRecipient: SmsRecipient = yield api.smsRecipients.create({
          phone,
          name,
        });
        self.smsRecipients.push(
          newRecipient as unknown as SmsRecipientInstance,
        );
        return newRecipient;
      } catch (error) {
        console.error("Failed to add SMS recipient:", error);
        throw error;
      }
    });

    const removeSmsRecipient = flow(function* removeSmsRecipient(id: string) {
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
    });

    return {
      loadEvaluations,
      loadDeviceTokens,
      loadSmsRecipients,
      loadSchedulerStatus,
      loadAll,
      triggerEvaluation,
      addDeviceToken,
      removeDeviceToken,
      addSmsRecipient,
      removeSmsRecipient,
    };
  });

export type IEvaluationStore = ReturnType<typeof EvaluationStore.create>;
