/**
 * ECIES encryption using ECDH P-256 + AES-256-GCM.
 *
 * For each email, a fresh ephemeral keypair is generated. The shared secret
 * derived from the ephemeral private key and the instance's public key is
 * used to encrypt the email with AES-256-GCM. Only the ephemeral public key
 * and IV are stored alongside the ciphertext — the ephemeral private key is
 * discarded immediately.
 */

export interface EncryptionResult {
	ciphertext: ArrayBuffer;
	ephemeralPublicKeyJwk: string;
	iv: string; // base64
}

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };

export async function encryptForInstance(plaintext: ArrayBuffer, instancePublicKeyJwk: string): Promise<EncryptionResult> {
	const instancePublicKey = await crypto.subtle.importKey('jwk', JSON.parse(instancePublicKeyJwk), ECDH_PARAMS, false, []);

	const ephemeralKeypair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveBits']);

	const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: instancePublicKey }, ephemeralKeypair.privateKey, 256);

	const aesKey = await crypto.subtle.importKey('raw', sharedBits, { name: 'AES-GCM' }, false, ['encrypt']);

	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);

	const ephemeralPublicKeyJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', ephemeralKeypair.publicKey));
	const ivBase64 = btoa(String.fromCharCode(...iv));

	return { ciphertext, ephemeralPublicKeyJwk, iv: ivBase64 };
}
