import { createYoga } from "graphql-yoga";
import { schema } from "./graphql/schema";

export const yoga = createYoga({ schema, graphqlEndpoint: "/api/graphql" });
