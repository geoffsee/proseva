import { AutoRouter } from "itty-router";
import {
  registerDeviceToken,
  getDeviceTokens,
  removeDeviceToken,
  registerSmsRecipient,
  getSmsRecipients,
  removeSmsRecipient,
} from "./notifications";
import {
  asIttyRoute,
  created as openapiCreated,
  json,
  noContent as openapiNoContent,
  notFound as openapiNotFound,
  openapiFormat,
} from "./openapi";

const json201 = <T>(data: T) => openapiCreated(data);
const notFound = () => openapiNotFound();
const noContent = () => openapiNoContent();

const router = AutoRouter({ base: "/api", format: openapiFormat });

// --- Device Tokens (FCM) ---
router
  .get(
    "/device-tokens",
    asIttyRoute("get", "/device-tokens", () => getDeviceTokens()),
  )
  .post(
    "/device-tokens",
    asIttyRoute("post", "/device-tokens", async (req) => {
      const body = await req.json();
      const token = typeof body?.token === "string" ? body.token : "";
      const platform = body?.platform;

      if (
        !token ||
        (platform !== "ios" && platform !== "android" && platform !== "web")
      ) {
        return json(400, { error: "token and platform are required" });
      }

      return json201(registerDeviceToken(token, platform));
    }),
  )
  .delete(
    "/device-tokens/:tokenId",
    asIttyRoute("delete", "/device-tokens/:tokenId", ({ params }) => {
      const removed = removeDeviceToken(params.tokenId);
      if (!removed) return notFound();
      return noContent();
    }),
  )

  // --- SMS Recipients ---
  .get(
    "/sms-recipients",
    asIttyRoute("get", "/sms-recipients", () => getSmsRecipients()),
  )
  .post(
    "/sms-recipients",
    asIttyRoute("post", "/sms-recipients", async (req) => {
      const body = await req.json();
      const phone = typeof body?.phone === "string" ? body.phone : "";
      const name = typeof body?.name === "string" ? body.name : undefined;

      if (!phone) {
        return json(400, { error: "phone is required" });
      }

      return json201(registerSmsRecipient(phone, name));
    }),
  )
  .delete(
    "/sms-recipients/:recipientId",
    asIttyRoute("delete", "/sms-recipients/:recipientId", ({ params }) => {
      const removed = removeSmsRecipient(params.recipientId);
      if (!removed) return notFound();
      return noContent();
    }),
  );

export { router as notificationsRouter };
