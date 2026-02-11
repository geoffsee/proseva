import courtsData from "../../../static/va-courts.json";

export interface CourtInfo {
  name: string;
  locality: string;
  type:
    | "General District"
    | "Juvenile & Domestic Relations"
    | "Combined District";
  district: string;
  clerk: string | null;
  phone: string | null;
  phones?: Record<string, string | undefined>;
  fax: string | null;
  email: string | null;
  address: string | null;
  city: string;
  state: string;
  zip: string;
  hours: string | null;
  website: string;
  judges: string[];
}

export const VIRGINIA_COURTS: CourtInfo[] = courtsData.map((c) => ({
  name: c.name,
  locality: c.locality,
  type: c.type as CourtInfo["type"],
  district: c.district,
  clerk: c.clerk,
  phone: c.phone,
  phones: c.phones,
  fax: c.fax,
  email: c.email,
  address: [c.address, `${c.city}, ${c.state} ${c.zip}`]
    .filter(Boolean)
    .join(", "),
  city: c.city ?? "",
  state: c.state ?? "VA",
  zip: c.zip ?? "",
  hours: c.hours,
  website: c.homepage ?? "",
  judges: c.judges ?? [],
}));
