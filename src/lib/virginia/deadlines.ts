export interface DeadlineRule {
  name: string;
  days: number;
  description: string;
}

export const FILING_DEADLINES: DeadlineRule[] = [
  {
    name: "Answer to Complaint",
    days: 21,
    description: "Must file an answer within 21 days of being served.",
  },
  {
    name: "Response to Motion",
    days: 14,
    description:
      "Written opposition to a motion is typically due 14 days before the hearing.",
  },
  {
    name: "Discovery Responses",
    days: 21,
    description:
      "Responses to interrogatories and requests for production are due within 21 days.",
  },
  {
    name: "Appeal from JDR Court",
    days: 10,
    description:
      "Notice of appeal from JDR to Circuit Court must be filed within 10 days.",
  },
  {
    name: "Motion for Reconsideration",
    days: 21,
    description: "Must be filed within 21 days of the order.",
  },
];
