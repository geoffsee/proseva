import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { EstatePlanModel } from "./models/EstatePlanModel";
import { api } from "../lib/api";

export const EstatePlanStore = types
  .model("EstatePlanStore", {
    plans: types.array(EstatePlanModel),
    selectedStatus: types.optional(types.string, "all"),
    searchQuery: types.optional(types.string, ""),
  })
  .views((self) => ({
    get sortedPlans() {
      return [...self.plans].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    },
    get filteredPlans() {
      return this.sortedPlans.filter((p) => {
        const matchesStatus =
          self.selectedStatus === "all" || p.status === self.selectedStatus;
        const matchesSearch =
          !self.searchQuery ||
          p.title.toLowerCase().includes(self.searchQuery.toLowerCase()) ||
          p.testatorName
            .toLowerCase()
            .includes(self.searchQuery.toLowerCase()) ||
          p.executorName.toLowerCase().includes(self.searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
      });
    },
    get totalEstateValue() {
      return self.plans.reduce(
        (total, plan) =>
          total + plan.assets.reduce((sum, a) => sum + a.estimatedValue, 0),
        0,
      );
    },
    get documentsNeedingReview() {
      const now = new Date();
      const docs: {
        planId: string;
        planTitle: string;
        docId: string;
        docTitle: string;
        reviewDate: string;
      }[] = [];
      for (const plan of self.plans) {
        for (const doc of plan.documents) {
          if (doc.reviewDate && new Date(doc.reviewDate) <= now) {
            docs.push({
              planId: plan.id,
              planTitle: plan.title,
              docId: doc.id,
              docTitle: doc.title,
              reviewDate: doc.reviewDate,
            });
          }
        }
      }
      return docs;
    },
    getPlan(id: string) {
      return self.plans.find((p) => p.id === id);
    },
  }))
  .actions((self) => ({
    loadPlans: flow(function* () {
      try {
        const plans: any[] = yield api.estatePlans.list();
        if (plans && Array.isArray(plans)) {
          self.plans.replace(plans as any);
        }
      } catch (error) {
        console.error("Failed to load estate plans from API:", error);
      }
    }),
    addPlan: flow(function* (data: {
      title: string;
      testatorName?: string;
      testatorDateOfBirth?: string;
      testatorAddress?: string;
      executorName?: string;
      executorPhone?: string;
      executorEmail?: string;
      guardianName?: string;
      guardianPhone?: string;
      notes?: string;
    }) {
      const now = new Date().toISOString();
      const newPlan = {
        id: uuidv4(),
        title: data.title,
        status: "planning" as const,
        testatorName: data.testatorName ?? "",
        testatorDateOfBirth: data.testatorDateOfBirth ?? "",
        testatorAddress: data.testatorAddress ?? "",
        executorName: data.executorName ?? "",
        executorPhone: data.executorPhone ?? "",
        executorEmail: data.executorEmail ?? "",
        guardianName: data.guardianName ?? "",
        guardianPhone: data.guardianPhone ?? "",
        beneficiaries: [],
        assets: [],
        documents: [],
        notes: data.notes ?? "",
        createdAt: now,
        updatedAt: now,
      };
      self.plans.push(newPlan as any);
      yield api.estatePlans.create(newPlan);
    }),
    updatePlan: flow(function* (id: string, updates: Record<string, unknown>) {
      const plan = self.plans.find((p) => p.id === id);
      if (plan) {
        Object.assign(plan, {
          ...updates,
          updatedAt: new Date().toISOString(),
        });
        yield api.estatePlans.update(id, updates as any);
      }
    }),
    deletePlan: flow(function* (id: string) {
      const idx = self.plans.findIndex((p) => p.id === id);
      if (idx >= 0) {
        self.plans.splice(idx, 1);
        yield api.estatePlans.delete(id);
      }
    }),
    addBeneficiary: flow(function* (
      planId: string,
      data: {
        name: string;
        relationship?: string;
        dateOfBirth?: string;
        phone?: string;
        email?: string;
        address?: string;
        notes?: string;
      },
    ) {
      const plan = self.plans.find((p) => p.id === planId);
      if (plan) {
        const b = {
          id: uuidv4(),
          name: data.name,
          relationship: data.relationship ?? "",
          dateOfBirth: data.dateOfBirth ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          notes: data.notes ?? "",
        };
        plan.beneficiaries.push(b as any);
        plan.updatedAt = new Date().toISOString();
        yield api.estatePlans.addBeneficiary(planId, b);
      }
    }),
    removeBeneficiary: flow(function* (planId: string, beneficiaryId: string) {
      const plan = self.plans.find((p) => p.id === planId);
      if (plan) {
        const idx = plan.beneficiaries.findIndex((b) => b.id === beneficiaryId);
        if (idx >= 0) {
          plan.beneficiaries.splice(idx, 1);
          plan.updatedAt = new Date().toISOString();
          yield api.estatePlans.removeBeneficiary(planId, beneficiaryId);
        }
      }
    }),
    addAsset: flow(function* (
      planId: string,
      data: {
        name: string;
        category?: string;
        estimatedValue?: number;
        ownershipType?: string;
        accountNumber?: string;
        institution?: string;
        beneficiaryIds?: string[];
        notes?: string;
      },
    ) {
      const plan = self.plans.find((p) => p.id === planId);
      if (plan) {
        const a = {
          id: uuidv4(),
          name: data.name,
          category: data.category ?? "other",
          estimatedValue: data.estimatedValue ?? 0,
          ownershipType: data.ownershipType ?? "",
          accountNumber: data.accountNumber ?? "",
          institution: data.institution ?? "",
          beneficiaryIds: data.beneficiaryIds ?? [],
          notes: data.notes ?? "",
        };
        plan.assets.push(a as any);
        plan.updatedAt = new Date().toISOString();
        yield api.estatePlans.addAsset(planId, a);
      }
    }),
    removeAsset: flow(function* (planId: string, assetId: string) {
      const plan = self.plans.find((p) => p.id === planId);
      if (plan) {
        const idx = plan.assets.findIndex((a) => a.id === assetId);
        if (idx >= 0) {
          plan.assets.splice(idx, 1);
          plan.updatedAt = new Date().toISOString();
          yield api.estatePlans.removeAsset(planId, assetId);
        }
      }
    }),
    addEstateDocument: flow(function* (
      planId: string,
      data: {
        type?: string;
        title: string;
        content?: string;
        fieldValues?: Record<string, string>;
        templateId?: string;
        status?: string;
      },
    ) {
      const plan = self.plans.find((p) => p.id === planId);
      if (plan) {
        const now = new Date().toISOString();
        const doc = {
          id: uuidv4(),
          type: data.type ?? "other",
          title: data.title,
          status: data.status ?? "not-started",
          content: data.content ?? "",
          fieldValues: data.fieldValues ?? {},
          templateId: data.templateId ?? "",
          reviewDate: "",
          signedDate: "",
          notes: "",
          createdAt: now,
          updatedAt: now,
        };
        plan.documents.push(doc as any);
        plan.updatedAt = now;
        yield api.estatePlans.addDocument(planId, doc);
      }
    }),
    updateEstateDocument: flow(function* (
      planId: string,
      docId: string,
      updates: Record<string, unknown>,
    ) {
      const plan = self.plans.find((p) => p.id === planId);
      if (plan) {
        const doc = plan.documents.find((d) => d.id === docId);
        if (doc) {
          Object.assign(doc, {
            ...updates,
            updatedAt: new Date().toISOString(),
          });
          plan.updatedAt = new Date().toISOString();
          yield api.estatePlans.updateDocument(planId, docId, updates);
        }
      }
    }),
    removeEstateDocument: flow(function* (planId: string, docId: string) {
      const plan = self.plans.find((p) => p.id === planId);
      if (plan) {
        const idx = plan.documents.findIndex((d) => d.id === docId);
        if (idx >= 0) {
          plan.documents.splice(idx, 1);
          plan.updatedAt = new Date().toISOString();
          yield api.estatePlans.removeDocument(planId, docId);
        }
      }
    }),
    setSelectedStatus(status: string) {
      self.selectedStatus = status;
    },
    setSearchQuery(query: string) {
      self.searchQuery = query;
    },
    clearFilters() {
      self.selectedStatus = "all";
      self.searchQuery = "";
    },
  }));
