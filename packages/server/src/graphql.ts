import { createSchema, createYoga } from "graphql-yoga";
import { Database } from "bun:sqlite";
import { join } from "path";

const datasetsDir = process.env.DATASETS_DIR;
if (!datasetsDir) throw new Error("DATASETS_DIR environment variable is required");

const datasetsDb = new Database(join(datasetsDir, "virginia.db"), { readonly: true });

interface CourtRow {
  name: string;
  locality: string | null;
  type: string | null;
  district: string | null;
  clerk: string | null;
  phone: string | null;
  phones: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  hours: string | null;
  homepage: string | null;
  judges: string | null;
}

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Court {
      name: String!
      locality: String
      type: String
      district: String
      clerk: String
      phone: String
      phones: JSON
      fax: String
      email: String
      address: String
      city: String
      state: String
      zip: String
      hours: String
      website: String
      judges: [String!]!
    }

    scalar JSON

    type Query {
      courts: [Court!]!
    }
  `,
  resolvers: {
    JSON: {
      __serialize: (value: unknown) => value,
      __parseValue: (value: unknown) => value,
      __parseLiteral: (ast: any) => ast.value,
    },
    Query: {
      courts: () => {
        const rows = datasetsDb
          .query("SELECT * FROM courts ORDER BY name")
          .all() as CourtRow[];
        return rows.map((row) => ({
          name: row.name,
          locality: row.locality,
          type: row.type,
          district: row.district,
          clerk: row.clerk,
          phone: row.phone,
          phones: row.phones ? JSON.parse(row.phones) : null,
          fax: row.fax,
          email: row.email,
          address: [
            row.address,
            row.city || row.state || row.zip
              ? `${row.city ?? ""}, ${row.state ?? "VA"} ${row.zip ?? ""}`
              : null,
          ]
            .filter(Boolean)
            .join(", "),
          city: row.city ?? "",
          state: row.state ?? "VA",
          zip: row.zip ?? "",
          hours: row.hours,
          website: row.homepage ?? "",
          judges: row.judges ? JSON.parse(row.judges) : [],
        }));
      },
    },
  },
});

export const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
});
