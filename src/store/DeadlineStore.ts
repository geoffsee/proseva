import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { DeadlineModel } from "./models/DeadlineModel";
import type { Deadline } from "../types";
import { api } from "../lib/api";
import { parseLocalDate } from "../lib/dateUtils";

export const DeadlineStore = types
  .model("DeadlineStore", {
    deadlines: types.array(DeadlineModel),
    selectedType: types.optional(types.string, "all"),
    selectedUrgency: types.optional(types.string, "all"),
    selectedCaseId: types.optional(types.string, "all"),
    searchQuery: types.optional(types.string, ""),
  })
  .views((self) => ({
    get sortedDeadlines() {
      return [...self.deadlines].sort((a, b) => {
        // Completed items go to the bottom
        if (a.completed !== b.completed) return a.completed ? 1 : -1;

        // Define urgency priority order: urgent > upcoming > future > overdue
        const urgencyPriority = {
          urgent: 1,
          upcoming: 2,
          future: 3,
          overdue: 4,
        };
        const aPriority = urgencyPriority[a.urgency];
        const bPriority = urgencyPriority[b.urgency];

        // Sort by urgency priority first
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // Within same urgency level, sort by date
        if (a.urgency === "overdue") {
          // Overdue: most recent first (reverse chronological)
          return (
            parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()
          );
        } else {
          // Urgent/Upcoming/Future: earliest first (chronological)
          return (
            parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
          );
        }
      });
    },
    get filteredDeadlines() {
      return this.sortedDeadlines.filter((d) => {
        const matchesSearch =
          !self.searchQuery ||
          d.title.toLowerCase().includes(self.searchQuery.toLowerCase()) ||
          d.description.toLowerCase().includes(self.searchQuery.toLowerCase());

        const matchesType =
          self.selectedType === "all" || d.type === self.selectedType;
        const matchesUrgency =
          self.selectedUrgency === "all" || d.urgency === self.selectedUrgency;
        const matchesCase =
          self.selectedCaseId === "all" || d.caseId === self.selectedCaseId;

        return matchesSearch && matchesType && matchesUrgency && matchesCase;
      });
    },
    get overdueDeadlines() {
      return self.deadlines.filter(
        (d) => !d.completed && d.urgency === "overdue",
      );
    },
    get urgentDeadlines() {
      return self.deadlines.filter(
        (d) => !d.completed && d.urgency === "urgent",
      );
    },
    get upcomingDeadlines() {
      return self.deadlines.filter(
        (d) => !d.completed && d.urgency === "upcoming",
      );
    },
    get futureDeadlines() {
      return self.deadlines.filter(
        (d) => !d.completed && d.urgency === "future",
      );
    },
    get completedDeadlines() {
      return self.deadlines.filter((d) => d.completed);
    },
  }))
  .actions((self) => ({
    loadDeadlines: flow(function* () {
      try {
        const deadlines = (yield api.deadlines.list()) as Deadline[];
        if (deadlines && Array.isArray(deadlines)) {
          self.deadlines.replace(deadlines);
        }
      } catch (error) {
        console.error("Failed to load deadlines from API:", error);
      }
    }),
    addDeadline: flow(function* (d: {
      title: string;
      date: string;
      type?: "filing" | "hearing" | "discovery" | "other";
      completed?: boolean;
      caseId?: string;
      description?: string;
      priority?: "low" | "medium" | "high";
    }) {
      self.deadlines.push({
        id: uuidv4(),
        title: d.title,
        date: d.date,
        type: d.type ?? "other",
        completed: d.completed ?? false,
        caseId: d.caseId ?? "",
        description: d.description ?? "",
        priority: d.priority ?? "medium",
      });
      yield api.deadlines.create(d);
    }),
    updateDeadline: flow(function* (
      id: string,
      updates: Record<string, unknown>,
    ) {
      const d = self.deadlines.find((d) => d.id === id);
      if (d) {
        Object.assign(d, updates);
        yield api.deadlines.update(id, updates);
      }
    }),
    deleteDeadline: flow(function* (id: string) {
      const idx = self.deadlines.findIndex((d) => d.id === id);
      if (idx >= 0) {
        self.deadlines.splice(idx, 1);
        yield api.deadlines.delete(id);
      }
    }),
    toggleComplete: flow(function* (id: string) {
      const d = self.deadlines.find((d) => d.id === id);
      if (d) {
        d.completed = !d.completed;
        yield api.deadlines.toggleComplete(id);
      }
    }),
    setSelectedType(type: string) {
      self.selectedType = type;
    },
    setSelectedUrgency(urgency: string) {
      self.selectedUrgency = urgency;
    },
    setSelectedCaseId(caseId: string) {
      self.selectedCaseId = caseId;
    },
    setSearchQuery(query: string) {
      self.searchQuery = query;
    },
    clearFilters() {
      self.selectedType = "all";
      self.selectedUrgency = "all";
      self.selectedCaseId = "all";
      self.searchQuery = "";
    },
  }));
