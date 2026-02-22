import type { Env, Instance, EmailRecord, EmailListItem } from './types';

export async function getInstanceByEmail(env: Env, emailAddress: string): Promise<Instance | null> {
	return env.DB.prepare('SELECT * FROM instances WHERE email_address = ? AND status = ?').bind(emailAddress, 'active').first<Instance>();
}

export async function getInstanceById(env: Env, instanceId: string): Promise<Instance | null> {
	return env.DB.prepare('SELECT * FROM instances WHERE instance_id = ?').bind(instanceId).first<Instance>();
}

export async function createInstance(env: Env, instanceId: string, emailAddress: string, publicKeyJwk: string, apiKeyHash: string): Promise<void> {
	await env.DB.prepare(
		'INSERT INTO instances (instance_id, email_address, public_key_jwk, api_key_hash) VALUES (?, ?, ?, ?)',
	)
		.bind(instanceId, emailAddress, publicKeyJwk, apiKeyHash)
		.run();
}

export async function insertEmail(
	env: Env,
	emailId: string,
	instanceId: string,
	r2Key: string,
	ephemeralPublicKeyJwk: string,
	iv: string,
	sizeBytes: number,
	ttlDays: number,
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO emails (email_id, instance_id, r2_key, ephemeral_public_key_jwk, iv, size_bytes, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+' || ? || ' days'))`,
	)
		.bind(emailId, instanceId, r2Key, ephemeralPublicKeyJwk, iv, sizeBytes, ttlDays)
		.run();
}

export async function listPendingEmails(env: Env, instanceId: string): Promise<EmailListItem[]> {
	const result = await env.DB.prepare(
		'SELECT email_id, received_at, size_bytes FROM emails WHERE instance_id = ? AND picked_up = 0 ORDER BY received_at ASC',
	)
		.bind(instanceId)
		.all<{ email_id: string; received_at: string; size_bytes: number }>();

	return result.results.map((row) => ({
		emailId: row.email_id,
		receivedAt: row.received_at,
		sizeBytes: row.size_bytes,
	}));
}

export async function getEmail(env: Env, emailId: string, instanceId: string): Promise<EmailRecord | null> {
	return env.DB.prepare('SELECT * FROM emails WHERE email_id = ? AND instance_id = ?').bind(emailId, instanceId).first<EmailRecord>();
}

export async function markEmailPickedUp(env: Env, emailId: string): Promise<void> {
	await env.DB.prepare("UPDATE emails SET picked_up = 1 WHERE email_id = ?").bind(emailId).run();
}

export async function deleteExpiredEmails(env: Env): Promise<string[]> {
	const expired = await env.DB.prepare("SELECT email_id, r2_key FROM emails WHERE expires_at < datetime('now') AND picked_up = 0")
		.all<{ email_id: string; r2_key: string }>();

	const r2Keys: string[] = [];
	for (const row of expired.results) {
		r2Keys.push(row.r2_key);
	}

	if (expired.results.length > 0) {
		await env.DB.prepare("DELETE FROM emails WHERE expires_at < datetime('now') AND picked_up = 0").run();
	}

	// Also clean up picked-up email metadata older than 24 hours
	await env.DB.prepare("DELETE FROM emails WHERE picked_up = 1 AND received_at < datetime('now', '-1 day')").run();

	return r2Keys;
}

export async function pruneInactiveInstances(env: Env, pruneDays: number): Promise<string[]> {
	// Find instances that haven't polled in pruneDays
	const stale = await env.DB.prepare(
		"SELECT instance_id FROM instances WHERE status = 'active' AND (last_seen_at IS NULL AND created_at < datetime('now', '-' || ? || ' days')) OR (last_seen_at < datetime('now', '-' || ? || ' days'))",
	)
		.bind(pruneDays, pruneDays)
		.all<{ instance_id: string }>();

	const instanceIds = stale.results.map((r) => r.instance_id);

	for (const instanceId of instanceIds) {
		await env.DB.prepare("UPDATE instances SET status = 'inactive' WHERE instance_id = ?").bind(instanceId).run();
	}

	// Get R2 keys for pending emails of pruned instances
	const r2Keys: string[] = [];
	for (const instanceId of instanceIds) {
		const emails = await env.DB.prepare('SELECT r2_key FROM emails WHERE instance_id = ? AND picked_up = 0')
			.bind(instanceId)
			.all<{ r2_key: string }>();
		for (const row of emails.results) {
			r2Keys.push(row.r2_key);
		}
		await env.DB.prepare('DELETE FROM emails WHERE instance_id = ?').bind(instanceId).run();
	}

	return r2Keys;
}

export async function updateInstancePublicKey(env: Env, instanceId: string, newPublicKeyJwk: string): Promise<void> {
	await env.DB.prepare('UPDATE instances SET public_key_jwk = ? WHERE instance_id = ?').bind(newPublicKeyJwk, instanceId).run();
}

export async function getPendingEmailCount(env: Env, instanceId: string): Promise<number> {
	const result = await env.DB.prepare('SELECT COUNT(*) as count FROM emails WHERE instance_id = ? AND picked_up = 0')
		.bind(instanceId)
		.first<{ count: number }>();
	return result?.count ?? 0;
}
