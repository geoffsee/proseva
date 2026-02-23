export interface Instance {
	instance_id: string;
	email_address: string;
	public_key_jwk: string;
	api_key_hash: string;
	created_at: string;
	last_seen_at: string | null;
	status: 'active' | 'inactive';
}

export interface EmailRecord {
	email_id: string;
	instance_id: string;
	r2_key: string;
	ephemeral_public_key_jwk: string;
	iv: string;
	size_bytes: number;
	received_at: string;
	expires_at: string;
	picked_up: number;
}

export interface EmailListItem {
	emailId: string;
	receivedAt: string;
	sizeBytes: number;
}

export interface RegisterRequest {
	instanceId: string;
	publicKey: string;
}

export interface RegisterResponse {
	emailAddress: string;
	apiKey: string;
}

export interface StatusResponse {
	instanceId: string;
	emailAddress: string;
	pendingEmails: number;
	lastSeenAt: string | null;
	status: string;
}

export interface Env {
	DB: D1Database;
	EMAIL_BUCKET: R2Bucket;
	REGISTRATION_SECRET: string;
	EMAIL_TTL_DAYS: string;
	INSTANCE_PRUNE_DAYS: string;
}
