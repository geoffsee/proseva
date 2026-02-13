# ProSeVA SDK

Type-safe TypeScript client generated from `server/openapi.json` for interacting with the ProSeVA API.

## Install

```bash
# From repository root after building
bun install             # ensure workspace deps
cd proseva-sdk
bun install             # installs sdk-specific dev deps
bun pack                # optional: create tarball for local install
```

To consume locally without publishing:

```bash
# from another project
npm install /path/to/pro-se-va-copy/proseva-sdk
```

## Usage

```ts
import { createProsevaClientWithToken } from "proseva-sdk";

const api = createProsevaClientWithToken("<jwt>", {
  baseUrl: "https://proseva.example.com/api",
});

const { data } = await api.GET("/cases");
```

### Auth tokens

Pass `getAuthToken` (sync or async) to attach `Authorization: Bearer <token>` automatically:

```ts
import { createProsevaClient } from "proseva-sdk";

const api = createProsevaClient({
  getAuthToken: async () => process.env.PROSEVA_TOKEN ?? null,
});
```

## Regenerate types

```bash
cd proseva-sdk
bun x openapi-typescript ../server/openapi.json --output src/types.ts
bun x tsc -p tsconfig.json
```

## Exports

- `createProsevaClient`
- `createProsevaClientWithToken`
- OpenAPI types: `paths`, `components`, `operations`
