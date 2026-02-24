import type { IRequest } from "itty-router";
import type { paths } from "./api-types.js";

export type ApiPaths = paths;

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

type OperationFor<Path extends keyof ApiPaths, Method extends HttpMethod> =
  ApiPaths[Path] extends Record<string, unknown>
    ? ApiPaths[Path][Method]
    : never;

type StatusKeyToNumber<K> = K extends number
  ? K
  : K extends `${infer N extends number}`
    ? N
    : never;

type ResponseForStatus<R, Status extends number> = Status extends keyof R
  ? R[Status]
  : `${Status}` extends keyof R
    ? R[`${Status}`]
    : never;

type JsonBodyForResponse<Resp> = Resp extends { content: infer C }
  ? C extends { "application/json": infer B }
    ? B
    : undefined
  : Resp extends { content?: infer C }
    ? C extends { "application/json": infer B }
      ? B
      : undefined
    : undefined;

type ApiResponseVariant<Status extends number, Body> = Body extends undefined
  ? {
      status: Status;
      headers?: HeadersInit;
    }
  : {
      status: Status;
      body: Body;
      headers?: HeadersInit;
    };

type ApiResponseUnionFromResponses<R> = {
  [K in keyof R]: ApiResponseVariant<
    StatusKeyToNumber<K>,
    JsonBodyForResponse<R[K]>
  >;
}[keyof R];

type ApiOkBodyFromResponses<R> =
  JsonBodyForResponse<ResponseForStatus<R, 200>> extends infer Body
    ? Body extends undefined
      ? never
      : Body
    : never;

export type ApiOperationResult<Op> = Op extends { responses: infer R }
  ? ApiResponseUnionFromResponses<R> | ApiOkBodyFromResponses<R>
  : never;

export type ApiRouteResult<
  Path extends keyof ApiPaths,
  Method extends HttpMethod,
> = ApiOperationResult<OperationFor<Path, Method>>;

export type ApiRouteHandler<
  Path extends keyof ApiPaths,
  Method extends HttpMethod,
  Req = IRequest,
> = (
  request: Req,
) => ApiRouteResult<Path, Method> | Promise<ApiRouteResult<Path, Method>>;

type IttyPathToOpenApiPath<Path extends string> =
  Path extends `${infer Head}:${infer Param}/${infer Tail}`
    ? `${Head}{${Param}}/${IttyPathToOpenApiPath<Tail>}`
    : Path extends `${infer Head}:${infer Param}`
      ? `${Head}{${Param}}`
      : Path;

type OpenApiPathFromItty<Path extends string> = IttyPathToOpenApiPath<Path> &
  keyof ApiPaths;

/**
 * Identity wrapper to type-check an itty-router handler against the OpenAPI
 * `paths` response types.
 */
export function asIttyRoute<
  const Method extends HttpMethod,
  const Path extends string,
  const OpenApiPath extends OpenApiPathFromItty<Path>,
>(
  _method: Method,
  _path: Path,
  handler: ApiRouteHandler<OpenApiPath, Method>,
): typeof handler {
  return handler;
}

/**
 * For routers that don't use the same literal path string as OpenAPI (e.g.
 * sub-routers with a `base`), use this to type-check against the OpenAPI path.
 */
export function asRoute<
  const Method extends HttpMethod,
  const OpenApiPath extends keyof ApiPaths,
>(
  _method: Method,
  _openApiPath: OpenApiPath,
  handler: ApiRouteHandler<OpenApiPath, Method>,
): typeof handler {
  return handler;
}

export type ApiEnvelope =
  | {
      __openapi: true;
      status: number;
      headers?: HeadersInit;
    }
  | {
      __openapi: true;
      status: number;
      body: unknown;
      headers?: HeadersInit;
    };

export function json<Status extends number, Body>(
  status: Status,
  body: Body,
  headers?: HeadersInit,
): { __openapi: true; status: Status; body: Body; headers?: HeadersInit } {
  return { __openapi: true, status, body, headers };
}

export function empty<Status extends number>(
  status: Status,
  headers?: HeadersInit,
): { __openapi: true; status: Status; headers?: HeadersInit } {
  return { __openapi: true, status, headers };
}

export function ok<Body>(
  body: Body,
  headers?: HeadersInit,
): { __openapi: true; status: 200; body: Body; headers?: HeadersInit } {
  return json(200, body, headers);
}

export function created<Body>(
  body: Body,
  headers?: HeadersInit,
): { __openapi: true; status: 201; body: Body; headers?: HeadersInit } {
  return json(201, body, headers);
}

export function noContent(headers?: HeadersInit): {
  __openapi: true;
  status: 204;
  headers?: HeadersInit;
} {
  return empty(204, headers);
}

export function notFound(headers?: HeadersInit): {
  __openapi: true;
  status: 404;
  headers?: HeadersInit;
} {
  return empty(404, headers);
}

export function openapiFormat(response: unknown): Response | undefined {
  if (response === undefined || response instanceof Response) return response;

  if (
    response &&
    typeof response === "object" &&
    "__openapi" in response &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response as any).__openapi === true &&
    "status" in response &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (response as any).status === "number"
  ) {
    const env = response as ApiEnvelope;
    const headers = new Headers(env.headers ?? {});

    if ("body" in env) {
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }
      return new Response(JSON.stringify(env.body), {
        status: env.status,
        headers,
      });
    }

    return new Response(null, { status: env.status, headers });
  }

  // Default: treat as JSON body with status 200, matching AutoRouter defaults.
  return new Response(JSON.stringify(response), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
