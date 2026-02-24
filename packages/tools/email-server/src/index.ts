import type { Env, RegisterRequest } from './types';
import { authenticateInstance, validateRegistrationSecret, generateApiKey, hashApiKey } from './auth';
import { encryptForInstance } from './crypto';
import {
	getInstanceByEmail,
	createInstance,
	insertEmail,
	listPendingEmails,
	getEmail,
	markEmailPickedUp,
	deleteExpiredEmails,
	pruneInactiveInstances,
	updateInstancePublicKey,
	getPendingEmailCount,
} from './db';
import { storeEncryptedEmail, getEncryptedEmail, deleteEmail, deleteEmails } from './storage';

function corsHeaders(): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Instance-Id',
	};
}

function corsJson(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...corsHeaders() },
	});
}

function corsResponse(body: ArrayBuffer | null, status: number, headers: Record<string, string>): Response {
	return new Response(body, { status, headers: { ...headers, ...corsHeaders() } });
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders() });
		}

		// Health check
		if (path === '/api/v1/health' && request.method === 'GET') {
			return corsJson({ ok: true });
		}

		// Registration (protected by shared secret)
		if (path === '/api/v1/register' && request.method === 'POST') {
			return handleRegister(request, env);
		}

		// All other routes require instance auth
		const instance = await authenticateInstance(request, env);
		if (!instance) {
			return corsJson({ error: 'Unauthorized' }, 401);
		}

		// List pending emails
		if (path === '/api/v1/emails' && request.method === 'GET') {
			const emails = await listPendingEmails(env, instance.instance_id);
			return corsJson({ emails });
		}

		// Download encrypted email
		const emailDownloadMatch = path.match(/^\/api\/v1\/emails\/([^/]+)$/);
		if (emailDownloadMatch && request.method === 'GET') {
			return handleDownloadEmail(env, emailDownloadMatch[1], instance.instance_id);
		}

		// Acknowledge email pickup
		const emailAckMatch = path.match(/^\/api\/v1\/emails\/([^/]+)\/ack$/);
		if (emailAckMatch && request.method === 'POST') {
			return handleAckEmail(env, ctx, emailAckMatch[1], instance.instance_id);
		}

		// Rotate public key
		if (path === '/api/v1/rotate-key' && request.method === 'POST') {
			return handleRotateKey(request, env, instance.instance_id);
		}

		// Instance status
		if (path === '/api/v1/status' && request.method === 'GET') {
			const pendingEmails = await getPendingEmailCount(env, instance.instance_id);
			return corsJson({
				instanceId: instance.instance_id,
				emailAddress: instance.email_address,
				pendingEmails,
				lastSeenAt: instance.last_seen_at,
				status: instance.status,
			});
		}

		return corsJson({ error: 'Not found' }, 404);
	},

	async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
		const recipientAddress = message.to.toLowerCase().trim();

		const instance = await getInstanceByEmail(env, recipientAddress);
		if (!instance) {
			message.setReject('Unknown recipient');
			return;
		}

		// Read raw email bytes
		const rawEmail = await new Response(message.raw).arrayBuffer();

		// Encrypt with instance's public key (ECIES)
		const { ciphertext, ephemeralPublicKeyJwk, iv } = await encryptForInstance(rawEmail, instance.public_key_jwk);

		const emailId = crypto.randomUUID();
		const r2Key = `${instance.instance_id}/${emailId}.enc`;
		const ttlDays = parseInt(env.EMAIL_TTL_DAYS || '7', 10);

		// Store encrypted blob in R2
		await storeEncryptedEmail(env, r2Key, ciphertext);

		// Store metadata in D1 (no PII)
		await insertEmail(env, emailId, instance.instance_id, r2Key, ephemeralPublicKeyJwk, iv, ciphertext.byteLength, ttlDays);
	},

	async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
		// Delete expired emails from R2 and D1
		const expiredR2Keys = await deleteExpiredEmails(env);
		await deleteEmails(env, expiredR2Keys);

		// Prune inactive instances
		const pruneDays = parseInt(env.INSTANCE_PRUNE_DAYS || '90', 10);
		const prunedR2Keys = await pruneInactiveInstances(env, pruneDays);
		await deleteEmails(env, prunedR2Keys);
	},
} satisfies ExportedHandler<Env>;

async function handleRegister(request: Request, env: Env): Promise<Response> {
	if (!validateRegistrationSecret(request, env)) {
		return corsJson({ error: 'Invalid registration secret' }, 403);
	}

	let body: RegisterRequest;
	try {
		body = await request.json<RegisterRequest>();
	} catch {
		return corsJson({ error: 'Invalid JSON body' }, 400);
	}

	if (!body.instanceId || !body.publicKey) {
		return corsJson({ error: 'instanceId and publicKey are required' }, 400);
	}

	// Validate the public key is valid JWK
	try {
		await crypto.subtle.importKey('jwk', JSON.parse(body.publicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	} catch {
		return corsJson({ error: 'Invalid ECDH P-256 public key' }, 400);
	}

	const emailAddress = `${body.instanceId}@proseva.app`;
	const apiKey = generateApiKey();
	const apiKeyHash = await hashApiKey(apiKey);

	try {
		await createInstance(env, body.instanceId, emailAddress, body.publicKey, apiKeyHash);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes('UNIQUE') || msg.includes('unique')) {
			return corsJson({ error: 'Instance already registered' }, 409);
		}
		throw e;
	}

	return corsJson({ emailAddress, apiKey }, 201);
}

async function handleDownloadEmail(env: Env, emailId: string, instanceId: string): Promise<Response> {
	const emailRecord = await getEmail(env, emailId, instanceId);
	if (!emailRecord) {
		return corsJson({ error: 'Email not found' }, 404);
	}

	if (emailRecord.picked_up) {
		return corsJson({ error: 'Email already picked up' }, 410);
	}

	const ciphertext = await getEncryptedEmail(env, emailRecord.r2_key);
	if (!ciphertext) {
		return corsJson({ error: 'Email data not found' }, 404);
	}

	return corsResponse(ciphertext, 200, {
		'Content-Type': 'application/octet-stream',
		'X-Ephemeral-Public-Key': emailRecord.ephemeral_public_key_jwk,
		'X-Encryption-IV': emailRecord.iv,
		'X-Email-Id': emailRecord.email_id,
	});
}

async function handleAckEmail(env: Env, ctx: ExecutionContext, emailId: string, instanceId: string): Promise<Response> {
	const emailRecord = await getEmail(env, emailId, instanceId);
	if (!emailRecord) {
		return corsJson({ error: 'Email not found' }, 404);
	}

	await markEmailPickedUp(env, emailId);

	// Delete R2 object immediately
	ctx.waitUntil(deleteEmail(env, emailRecord.r2_key));

	return corsJson({ deleted: true });
}

async function handleRotateKey(request: Request, env: Env, instanceId: string): Promise<Response> {
	let body: { newPublicKey: string };
	try {
		body = await request.json<{ newPublicKey: string }>();
	} catch {
		return corsJson({ error: 'Invalid JSON body' }, 400);
	}

	if (!body.newPublicKey) {
		return corsJson({ error: 'newPublicKey is required' }, 400);
	}

	// Validate the new public key
	try {
		await crypto.subtle.importKey('jwk', JSON.parse(body.newPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	} catch {
		return corsJson({ error: 'Invalid ECDH P-256 public key' }, 400);
	}

	await updateInstancePublicKey(env, instanceId, body.newPublicKey);

	return corsJson({ success: true });
}
