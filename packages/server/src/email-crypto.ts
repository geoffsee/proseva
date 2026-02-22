/**
 * ECDH P-256 + AES-256-GCM decryption for emails received from the
 * Cloudflare Email Worker. The worker encrypts each email with a fresh
 * ephemeral keypair; the instance decrypts using its long-lived private key.
 */

const ECDH_PARAMS: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };

export async function generateEcdhKeyPair(): Promise<{
  publicKeyJwk: string;
  privateKeyJwk: string;
}> {
  const keypair = await crypto.subtle.generateKey(ECDH_PARAMS, true, [
    "deriveBits",
  ]);
  const publicKeyJwk = JSON.stringify(
    await crypto.subtle.exportKey("jwk", keypair.publicKey),
  );
  const privateKeyJwk = JSON.stringify(
    await crypto.subtle.exportKey("jwk", keypair.privateKey),
  );
  return { publicKeyJwk, privateKeyJwk };
}

export async function decryptEmail(
  encryptedBytes: ArrayBuffer,
  ephemeralPublicKeyJwk: string,
  ivBase64: string,
  privateKeyJwk: string,
): Promise<ArrayBuffer> {
  const ephemeralPublicKey = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(ephemeralPublicKeyJwk),
    ECDH_PARAMS,
    false,
    [],
  );

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(privateKeyJwk),
    ECDH_PARAMS,
    false,
    ["deriveBits"],
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: ephemeralPublicKey },
    privateKey,
    256,
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));

  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, encryptedBytes);
}
