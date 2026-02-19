export interface StatuteRef {
  code: string;
  title: string;
  description: string;
  url: string;
}

export const VIRGINIA_STATUTES: StatuteRef[] = [
  {
    code: "Va. Code § 20-107.1",
    title: "Spousal Support",
    description:
      "Court authority to decree spousal support and maintenance for either party.",
    url: "https://law.lis.virginia.gov/vacode/title20/chapter6/section20-107.1/",
  },
  {
    code: "Va. Code § 20-107.2",
    title: "Equitable Distribution",
    description:
      "Court determines legal title, ownership, and division of marital property.",
    url: "https://law.lis.virginia.gov/vacode/title20/chapter6/section20-107.2/",
  },
  {
    code: "Va. Code § 20-107.3",
    title: "Child Support Guidelines",
    description:
      "Guidelines for determining child support obligations in Virginia.",
    url: "https://law.lis.virginia.gov/vacode/title20/chapter6/section20-107.3/",
  },
  {
    code: "Va. Code § 20-124.2",
    title: "Custody & Visitation - Best Interests",
    description:
      "Factors the court considers in determining the best interests of a child.",
    url: "https://law.lis.virginia.gov/vacode/title20/chapter6.1/section20-124.2/",
  },
  {
    code: "Va. Code § 20-124.3",
    title: "Custody & Visitation - Court Powers",
    description:
      "Court authority to award custody and visitation to either parent.",
    url: "https://law.lis.virginia.gov/vacode/title20/chapter6.1/section20-124.3/",
  },
  {
    code: "Va. Code § 16.1-278.15",
    title: "Contempt - Support Enforcement",
    description:
      "JDR court authority to enforce support orders through contempt proceedings.",
    url: "https://law.lis.virginia.gov/vacode/title16.1/chapter11/section16.1-278.15/",
  },
  {
    code: "Va. Code § 20-99",
    title: "Divorce - Residency Requirements",
    description:
      "At least one party must have been a domiciliary and resident of Virginia for at least six months.",
    url: "https://law.lis.virginia.gov/vacode/title20/chapter6/section20-99/",
  },
  {
    code: "Va. Code § 63.2-1900",
    title: "DCSE - Support Enforcement",
    description: "Division of Child Support Enforcement powers and duties.",
    url: "https://law.lis.virginia.gov/vacode/title63.2/chapter19/section63.2-1900/",
  },
];
