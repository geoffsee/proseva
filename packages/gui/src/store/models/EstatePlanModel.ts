import { types } from "mobx-state-tree";

export const BeneficiaryModel = types.model("Beneficiary", {
  id: types.identifier,
  name: types.string,
  relationship: types.optional(types.string, ""),
  dateOfBirth: types.optional(types.string, ""),
  phone: types.optional(types.string, ""),
  email: types.optional(types.string, ""),
  address: types.optional(types.string, ""),
  notes: types.optional(types.string, ""),
});

export const EstateAssetModel = types.model("EstateAsset", {
  id: types.identifier,
  name: types.string,
  category: types.optional(
    types.enumeration([
      "real-property",
      "bank-account",
      "investment",
      "retirement",
      "insurance",
      "vehicle",
      "personal-property",
      "business-interest",
      "digital-asset",
      "other",
    ]),
    "other",
  ),
  estimatedValue: types.optional(types.number, 0),
  ownershipType: types.optional(types.string, ""),
  accountNumber: types.optional(types.string, ""),
  institution: types.optional(types.string, ""),
  beneficiaryIds: types.array(types.string),
  notes: types.optional(types.string, ""),
});

export const EstateDocumentModel = types.model("EstateDocument", {
  id: types.identifier,
  type: types.optional(
    types.enumeration([
      "last-will",
      "living-will",
      "power-of-attorney-financial",
      "power-of-attorney-healthcare",
      "healthcare-directive",
      "trust",
      "beneficiary-designation",
      "letter-of-instruction",
      "other",
    ]),
    "other",
  ),
  title: types.optional(types.string, ""),
  status: types.optional(
    types.enumeration([
      "not-started",
      "draft",
      "review",
      "signed",
      "notarized",
      "filed",
    ]),
    "not-started",
  ),
  content: types.optional(types.string, ""),
  fieldValues: types.frozen<Record<string, string>>({}),
  templateId: types.optional(types.string, ""),
  reviewDate: types.optional(types.string, ""),
  signedDate: types.optional(types.string, ""),
  notes: types.optional(types.string, ""),
  createdAt: types.string,
  updatedAt: types.string,
});

export const EstatePlanModel = types.model("EstatePlan", {
  id: types.identifier,
  title: types.string,
  status: types.optional(
    types.enumeration(["planning", "drafting", "review", "complete"]),
    "planning",
  ),
  testatorName: types.optional(types.string, ""),
  testatorDateOfBirth: types.optional(types.string, ""),
  testatorAddress: types.optional(types.string, ""),
  executorName: types.optional(types.string, ""),
  executorPhone: types.optional(types.string, ""),
  executorEmail: types.optional(types.string, ""),
  guardianName: types.optional(types.string, ""),
  guardianPhone: types.optional(types.string, ""),
  beneficiaries: types.array(BeneficiaryModel),
  assets: types.array(EstateAssetModel),
  documents: types.array(EstateDocumentModel),
  notes: types.optional(types.string, ""),
  createdAt: types.string,
  updatedAt: types.string,
});
