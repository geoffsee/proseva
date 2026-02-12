# ML-KEM-1024 Encryption

This document describes the ML-KEM-1024 post-quantum encryption used in proseva.

## Overview

ML-KEM-1024 (Module-Lattice-Based Key Encapsulation Mechanism) is a NIST-standardized post-quantum cryptographic algorithm (FIPS 203) that provides protection against attacks from quantum computers.

**All databases are automatically encrypted with ML-KEM-1024.** The server automatically:
- Generates an ML-KEM-1024 keypair on first launch
- Persists it to `server/data/ml-kem-keys/` using an idb-repo KV store
- Loads the keypair on subsequent restarts
- Encrypts all data using the keypair

### Keypair Storage

The keypair is stored in `server/data/ml-kem-keys/` and is automatically persisted across server restarts. This directory is already excluded from git via `.gitignore`.

**Security:**
1. **Automatic Encryption**: When you set up a passphrase through the app (via PassphraseGate), the keypair store is automatically encrypted using PassphraseEncryptionProvider (PBKDF2 + AES-256-GCM)
2. **File Permissions**: The storage backend creates files with secure permissions
3. **Location**: `server/data/ml-kem-keys/` is created automatically
4. **Backup**: Back up the entire `server/data/` directory (includes both database and keypair)
5. **Access Control**: Standard filesystem permissions protect the keypair store

**Advanced**: You can also set `PROSEVA_DB_ENCRYPTION_KEY` as an environment variable to encrypt the keypair at server startup (useful for headless deployments):

```bash
export PROSEVA_DB_ENCRYPTION_KEY=your-secure-passphrase
# ML-KEM is enabled by default, no need to set PROSEVA_USE_ML_KEM=true
npm start
```

**Important**:
- Loss of the `server/data/ml-kem-keys/` directory or the passphrase means loss of the keypair, which makes previously encrypted data unrecoverable
- Always include this directory in your backup strategy
- **Passphrase Protection**: If the server detects an existing keypair that can't be decrypted (wrong passphrase), it will refuse to start and display an error instead of overwriting the keypair. This prevents accidental data loss.

## How It Works

### Encryption Process

1. **Key Generation**: On first launch, the server generates an ML-KEM-1024 keypair (1568-byte public key, 3168-byte secret key) and persists it to `server/data/ml-kem-keys/` via idb-repo
2. **Key Loading**: On subsequent launches, the server loads the keypair from the persisted store
3. **Encapsulation**: For each encryption operation:
   - Generate a random shared secret (32 bytes) using ML-KEM encapsulation with the public key
   - This produces a ciphertext (1568 bytes) that can only be decrypted with the secret key
4. **Data Encryption**: Use the shared secret as an AES-256-GCM key to encrypt the database
5. **Storage**: Store both the ML-KEM ciphertext and the AES-encrypted data

### Decryption Process

1. **Decapsulation**: Use the ML-KEM secret key to recover the shared secret from the ciphertext
2. **Data Decryption**: Use the recovered shared secret to decrypt the AES-encrypted database

### Security Properties

- **Post-Quantum Security**: Resistant to attacks from both classical and quantum computers
- **NIST Level 5 Security**: Approximately 256-bit classical security
- **Automatic Shared Secrets**: Each encryption automatically generates a fresh shared secret via ML-KEM encapsulation (keypair itself must be managed)
- **Forward Secrecy**: Each encryption uses a unique shared secret derived from the server's persisted keypair

## Encrypted Data Format

When ML-KEM-1024 is enabled, the encrypted database contains:

```json
{
  "__proseva_encrypted_v3": {
    "version": 3,
    "algorithm": "ml-kem-1024-aes-256-gcm",
    "kemCiphertext": "base64-encoded ML-KEM ciphertext (1568 bytes)",
    "iv": "base64-encoded AES IV (12 bytes)",
    "authTag": "base64-encoded AES auth tag (16 bytes)",
    "ciphertext": "base64-encoded encrypted data"
  }
}
```

Note: The public key is not stored in the envelope to reduce storage overhead. The server loads its persisted keypair from `server/data/ml-kem-keys/` on startup and uses it for all encryption/decryption operations.

## Encryption Format

The system uses a single encryption format:

- **ML-KEM-1024 + AES-256-GCM**: All databases are encrypted using this post-quantum secure format
- **Envelope format**: `{ __proseva_encrypted_v3: { algorithm, kemCiphertext, iv, authTag, ciphertext } }`
- **No legacy support**: Only ML-KEM-1024 encryption is supported

## Performance

ML-KEM-1024 operations are fast:
- Key generation: ~1ms
- Encapsulation: ~1ms
- Decapsulation: ~1ms
- AES-256-GCM encryption/decryption: negligible overhead

## Implementation Details

The implementation uses the `wasm-pqc-subtle` library for cryptographic operations and `idb-repo` for keypair persistence:

- **Crypto Library**: wasm-pqc-subtle v0.1.4 (WebAssembly bindings to Rust `ml-kem` crate)
- **Storage Library**: idb-repo v1.3.0 (file-based KV store using `NodeFileSystemStorageBackend`)
- **Algorithm**: ML-KEM-1024 (FIPS 203)
- **Key Sizes**: 1568 bytes (public), 3168 bytes (secret)
- **Ciphertext Size**: 1568 bytes
- **Shared Secret Size**: 32 bytes (perfect for AES-256)
- **Keypair Location**: `server/data/ml-kem-keys/` (auto-created on first launch)

## Security Considerations

1. **Key Persistence**: The ML-KEM keypair is automatically persisted to `server/data/ml-kem-keys/` using idb-repo's file-based storage. The keypair is loaded on server restart, ensuring encrypted data remains accessible.
2. **Layered Encryption**: When you set up a passphrase through the app, it's automatically used to encrypt the keypair store (PBKDF2 + AES-256-GCM). This provides defense-in-depth: the ML-KEM keypair (which encrypts your database) is itself encrypted with your passphrase.
3. **Key Storage**: The keypair store is in `server/data/ml-kem-keys/` with secure file permissions. For enhanced security, consider:
   - Using encrypted filesystems (LUKS, BitLocker, FileVault)
   - Cloud key management services (AWS KMS, Azure Key Vault) for enterprise deployments
4. **Key Backup**: Back up the entire `server/data/` directory (includes both database and keypair). Loss of the keypair or passphrase means permanent data loss.
5. **Overwrite Protection**: The server refuses to generate a new keypair if an existing keypair store is detected but cannot be decrypted. This prevents accidental data loss from passphrase mismatches. To intentionally reset encryption, manually delete `server/data/ml-kem-keys/`.
6. **WASM Security**: The WebAssembly module is loaded from the trusted `wasm-pqc-subtle` npm package.
7. **No Side Channels**: The implementation is constant-time to prevent timing attacks.
8. **NIST Standardized**: ML-KEM is a NIST-approved post-quantum algorithm (FIPS 203).
9. **Forward Secrecy**: Each encryption uses a fresh shared secret derived via ML-KEM encapsulation.

### Production Key Management Recommendations

For production environments, consider:

1. **Backup Strategy**: Include `server/data/ml-kem-keys/` in your backup rotation
2. **Environment Isolation**: Use separate `server/data/` directories for dev/staging/production
3. **Access Logging**: Monitor access to the `server/data/` directory
4. **Principle of Least Privilege**: Only the server process should have access to `server/data/`
5. **Disaster Recovery**: Document and test the process for restoring from backups (both database and keypair)

## Testing

Run the ML-KEM-1024 tests:

```bash
npm run test:server
```

The test suite includes:
- Basic encryption/decryption
- Round-trip data integrity
- Format validation
- Complex data structures
