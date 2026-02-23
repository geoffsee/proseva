import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				miniflare: {
					d1Databases: {
						DB: {
							id: 'test-db',
						},
					},
					r2Buckets: ['EMAIL_BUCKET'],
					bindings: {
						REGISTRATION_SECRET: 'test-secret-key-for-registration',
						EMAIL_TTL_DAYS: '7',
						INSTANCE_PRUNE_DAYS: '90',
					},
				},
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
		setupFiles: ['./test/setup.ts'],
	},
});
