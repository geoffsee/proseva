const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== "darwin") {
    return;
  }

  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  if (!appleApiKey || !appleApiKeyId || !appleApiIssuer) {
    console.log(
      "Skipping notarization: APPLE_API_KEY, APPLE_API_KEY_ID, or APPLE_API_ISSUER not set",
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  console.log(`Notarizing ${appName}...`);

  await notarize({
    appPath: `${appOutDir}/${appName}.app`,
    appleApiKey,
    appleApiKeyId,
    appleApiIssuer,
  });

  console.log("Notarization complete.");
};
