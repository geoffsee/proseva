import type { Env } from './types';

export async function storeEncryptedEmail(env: Env, r2Key: string, ciphertext: ArrayBuffer): Promise<void> {
	await env.EMAIL_BUCKET.put(r2Key, ciphertext);
}

export async function getEncryptedEmail(env: Env, r2Key: string): Promise<ArrayBuffer | null> {
	const obj = await env.EMAIL_BUCKET.get(r2Key);
	if (!obj) return null;
	return obj.arrayBuffer();
}

export async function deleteEmail(env: Env, r2Key: string): Promise<void> {
	await env.EMAIL_BUCKET.delete(r2Key);
}

export async function deleteEmails(env: Env, r2Keys: string[]): Promise<void> {
	if (r2Keys.length === 0) return;
	// R2 delete supports batch of up to 1000 keys
	const batchSize = 1000;
	for (let i = 0; i < r2Keys.length; i += batchSize) {
		const batch = r2Keys.slice(i, i + batchSize);
		await env.EMAIL_BUCKET.delete(batch);
	}
}
