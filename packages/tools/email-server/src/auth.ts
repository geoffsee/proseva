import type { Env, Instance } from './types';

export async function hashApiKey(apiKey: string): Promise<string> {
	const encoded = new TextEncoder().encode(apiKey);
	const digest = await crypto.subtle.digest('SHA-256', encoded);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function generateApiKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function authenticateInstance(request: Request, env: Env): Promise<Instance | null> {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) return null;

	const apiKey = authHeader.slice(7);
	const instanceId = request.headers.get('X-Instance-Id');
	if (!instanceId) return null;

	const keyHash = await hashApiKey(apiKey);

	const instance = await env.DB.prepare('SELECT * FROM instances WHERE instance_id = ? AND api_key_hash = ? AND status = ?')
		.bind(instanceId, keyHash, 'active')
		.first<Instance>();

	if (!instance) return null;

	// Update last_seen_at (fire-and-forget)
	env.DB.prepare('UPDATE instances SET last_seen_at = datetime(\'now\') WHERE instance_id = ?').bind(instanceId).run();

	return instance;
}

export function validateRegistrationSecret(request: Request, env: Env): boolean {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) return false;
	return authHeader.slice(7) === env.REGISTRATION_SECRET;
}
