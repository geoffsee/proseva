import { types } from "mobx-state-tree";
import { parseLocalDate } from "../../lib/dateUtils";

export const DeadlineModel = types
  .model("Deadline", {
    id: types.identifier,
    caseId: types.optional(types.string, ""),
    title: types.string,
    date: types.string,
    type: types.optional(
      types.enumeration(["filing", "hearing", "discovery", "payment", "other"]),
      "other",
    ),
    completed: types.optional(types.boolean, false),
    description: types.optional(types.string, ""),
    priority: types.optional(
      types.enumeration(["low", "medium", "high"]),
      "medium",
    ),
  })
  .views((self) => ({
    get urgency(): "overdue" | "urgent" | "upcoming" | "future" {
      if (self.completed) return "future";

      const deadlineDate = parseLocalDate(self.date);
      const now = new Date();
      // Set now to midnight for consistent day comparisons
      now.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays < 0) return "overdue";
      if (diffDays <= 3) return "urgent";
      if (diffDays <= 14) return "upcoming";
      return "future";
    },
    get daysUntil(): number {
      const deadlineDate = parseLocalDate(self.date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return Math.floor(
        (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
    },
  }));
