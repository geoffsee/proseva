import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const TEST_REGISTRATION_SECRET = 'test-secret-key-for-registration';

async function generateTestKeypair() {
	const keypair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
	const publicKeyJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', keypair.publicKey));
	const privateKeyJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', keypair.privateKey));
	return { publicKeyJwk, privateKeyJwk };
}

async function registerTestInstance(ctx: ExecutionContext) {
	const instanceId = crypto.randomUUID();
	const { publicKeyJwk, privateKeyJwk } = await generateTestKeypair();

	const request = new IncomingRequest('http://localhost/api/v1/register', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${TEST_REGISTRATION_SECRET}`,
		},
		body: JSON.stringify({ instanceId, publicKey: publicKeyJwk }),
	});

	const response = await worker.fetch(request, env, ctx);
	const body = await response.json<{ emailAddress: string; apiKey: string }>();
	return { instanceId, publicKeyJwk, privateKeyJwk, ...body };
}

describe('proseva-email-server', () => {
	beforeEach(async () => {
		// Reset D1 tables
		await env.DB.exec('DELETE FROM emails');
		await env.DB.exec('DELETE FROM instances');
	});

	describe('health check', () => {
		it('GET /api/v1/health returns ok', async () => {
			const request = new IncomingRequest('http://localhost/api/v1/health');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			const body = await response.json<{ ok: boolean }>();
			expect(body.ok).toBe(true);
		});
	});

	describe('registration', () => {
		it('registers an instance and returns email address + API key', async () => {
			const ctx = createExecutionContext();
			const result = await registerTestInstance(ctx);
			await waitOnExecutionContext(ctx);
			expect(result.emailAddress).toBe(`${result.instanceId}@proseva.app`);
			expect(result.apiKey).toBeTruthy();
			expect(result.apiKey.length).toBe(64); // 32 bytes hex
		});

		it('rejects registration without valid secret', async () => {
			const request = new IncomingRequest('http://localhost/api/v1/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer wrong-secret',
				},
				body: JSON.stringify({ instanceId: 'test', publicKey: '{}' }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(403);
		});

		it('rejects duplicate registration', async () => {
			const ctx = createExecutionContext();
			const { instanceId, publicKeyJwk } = await registerTestInstance(ctx);
			await waitOnExecutionContext(ctx);

			const ctx2 = createExecutionContext();
			const request = new IncomingRequest('http://localhost/api/v1/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${TEST_REGISTRATION_SECRET}`,
				},
				body: JSON.stringify({ instanceId, publicKey: publicKeyJwk }),
			});
			const response = await worker.fetch(request, env, ctx2);
			await waitOnExecutionContext(ctx2);
			expect(response.status).toBe(409);
		});
	});

	describe('authenticated routes', () => {
		it('rejects unauthenticated requests', async () => {
			const request = new IncomingRequest('http://localhost/api/v1/emails');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(401);
		});

		it('lists pending emails (empty)', async () => {
			const ctx = createExecutionContext();
			const { instanceId, apiKey } = await registerTestInstance(ctx);
			await waitOnExecutionContext(ctx);

			const ctx2 = createExecutionContext();
			const request = new IncomingRequest('http://localhost/api/v1/emails', {
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'X-Instance-Id': instanceId,
				},
			});
			const response = await worker.fetch(request, env, ctx2);
			await waitOnExecutionContext(ctx2);
			expect(response.status).toBe(200);
			const body = await response.json<{ emails: unknown[] }>();
			expect(body.emails).toEqual([]);
		});

		it('returns instance status', async () => {
			const ctx = createExecutionContext();
			const { instanceId, apiKey, emailAddress } = await registerTestInstance(ctx);
			await waitOnExecutionContext(ctx);

			const ctx2 = createExecutionContext();
			const request = new IncomingRequest('http://localhost/api/v1/status', {
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'X-Instance-Id': instanceId,
				},
			});
			const response = await worker.fetch(request, env, ctx2);
			await waitOnExecutionContext(ctx2);
			expect(response.status).toBe(200);
			const body = await response.json<{ instanceId: string; emailAddress: string; pendingEmails: number }>();
			expect(body.instanceId).toBe(instanceId);
			expect(body.emailAddress).toBe(emailAddress);
			expect(body.pendingEmails).toBe(0);
		});
	});

	describe('key rotation', () => {
		it('rotates the instance public key', async () => {
			const ctx = createExecutionContext();
			const { instanceId, apiKey } = await registerTestInstance(ctx);
			await waitOnExecutionContext(ctx);

			const { publicKeyJwk: newPublicKey } = await generateTestKeypair();

			const ctx2 = createExecutionContext();
			const request = new IncomingRequest('http://localhost/api/v1/rotate-key', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`,
					'X-Instance-Id': instanceId,
				},
				body: JSON.stringify({ newPublicKey }),
			});
			const response = await worker.fetch(request, env, ctx2);
			await waitOnExecutionContext(ctx2);
			expect(response.status).toBe(200);
			const body = await response.json<{ success: boolean }>();
			expect(body.success).toBe(true);
		});
	});
});

describe('crypto roundtrip', () => {
	it('encrypts and decrypts correctly', async () => {
		const { encryptForInstance } = await import('../src/crypto');

		const keypair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
		const publicKeyJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', keypair.publicKey));

		const plaintext = new TextEncoder().encode('Subject: Test\r\nFrom: test@example.com\r\n\r\nHello World');
		const { ciphertext, ephemeralPublicKeyJwk, iv } = await encryptForInstance(plaintext.buffer, publicKeyJwk);

		// Decrypt (simulating what the ProSeVA instance does)
		const ephemeralPublicKey = await crypto.subtle.importKey(
			'jwk',
			JSON.parse(ephemeralPublicKeyJwk),
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			[],
		);

		const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemeralPublicKey }, keypair.privateKey, 256);

		const aesKey = await crypto.subtle.importKey('raw', sharedBits, { name: 'AES-GCM' }, false, ['decrypt']);

		const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
		const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, ciphertext);

		const decryptedText = new TextDecoder().decode(decrypted);
		expect(decryptedText).toBe('Subject: Test\r\nFrom: test@example.com\r\n\r\nHello World');
	});
});
