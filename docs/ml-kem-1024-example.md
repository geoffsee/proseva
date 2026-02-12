# ML-KEM-1024 Encryption Example

This document demonstrates how to use ML-KEM-1024 post-quantum encryption in proseva.

## Overview

ML-KEM-1024 (Module-Lattice-Based Key Encapsulation Mechanism) is a NIST-standardized post-quantum cryptographic algorithm (FIPS 203) that provides protection against attacks from quantum computers.

## Enabling ML-KEM-1024

Set the environment variables before starting the server:

```bash
export PROSEVA_USE_ML_KEM=true
export PROSEVA_ML_KEM_KEYPAIR_FILE=/path/to/secure/mlkem-keypair.json
npm start
```

Or add them to your `.env` file:

```env
PROSEVA_USE_ML_KEM=true
PROSEVA_ML_KEM_KEYPAIR_FILE=/path/to/secure/mlkem-keypair.json
```

**Important**: The `PROSEVA_ML_KEM_KEYPAIR_FILE` setting is required for production use. Without it:
- A new keypair is generated on each server restart
- Data encrypted with the old keypair cannot be decrypted
- This results in permanent data loss

### Keypair File Security

The keypair file contains both the public and secret keys and should be protected:

1. **File Permissions**: The file is automatically created with mode `0600` (read/write for owner only)
2. **Storage Location**: Store in a secure directory with restricted access
3. **Backup**: Keep encrypted backups of the keypair file in a secure location
4. **Access Control**: Limit access to the file to the server process user only

Example secure setup:

```bash
# Create a secure directory
sudo mkdir -p /etc/proseva/secrets
sudo chmod 700 /etc/proseva/secrets

# Set the environment variable
export PROSEVA_ML_KEM_KEYPAIR_FILE=/etc/proseva/secrets/mlkem-keypair.json

# On first run, the keypair will be generated and saved with 0600 permissions
# Make sure to backup this file securely!
```

## How It Works

### Encryption Process

1. **Key Generation**: Server generates an ML-KEM-1024 keypair (1568-byte public key, 3168-byte secret key)
2. **Encapsulation**: For each encryption operation:
   - Generate a random shared secret (32 bytes) using ML-KEM encapsulation with the public key
   - This produces a ciphertext (1568 bytes) that can only be decrypted with the secret key
3. **Data Encryption**: Use the shared secret as an AES-256-GCM key to encrypt the database
4. **Storage**: Store both the ML-KEM ciphertext and the AES-encrypted data

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

Note: The public key is not stored in the envelope to reduce storage overhead. The server uses its persisted keypair for all encryption operations.

## Backward Compatibility

The system automatically detects and supports three encryption formats:

- **V3 (ML-KEM-1024)**: Post-quantum encryption
- **V2 (PBKDF2)**: Passphrase-based encryption
- **V1 (Legacy)**: Legacy format (read-only)

You can migrate from V2 to V3 by:
1. Enabling `PROSEVA_USE_ML_KEM=true`
2. Reading an existing V2 encrypted database (automatic decryption)
3. Saving the database (automatic encryption with V3)

## Performance

ML-KEM-1024 operations are fast:
- Key generation: ~1ms
- Encapsulation: ~1ms
- Decapsulation: ~1ms
- AES-256-GCM encryption/decryption: negligible overhead

## Implementation Details

The implementation uses the `wasm-pqc-subtle` library, which provides WebAssembly bindings to the Rust `ml-kem` crate:

- **Library**: wasm-pqc-subtle v0.1.4
- **Algorithm**: ML-KEM-1024 (FIPS 203)
- **Key Sizes**: 1568 bytes (public), 3168 bytes (secret)
- **Ciphertext Size**: 1568 bytes
- **Shared Secret Size**: 32 bytes (perfect for AES-256)

## Security Considerations

1. **Key Persistence**: The ML-KEM keypair MUST be persisted in production using `PROSEVA_ML_KEM_KEYPAIR_FILE`. Without persistence, encrypted data cannot be decrypted after server restart.
2. **Key Storage**: The keypair file should be stored in a secure location with restricted permissions (0600). Consider using:
   - Encrypted filesystems
   - Hardware Security Modules (HSMs) for enterprise deployments
   - Cloud key management services (AWS KMS, Azure Key Vault, etc.)
3. **Key Backup**: Maintain secure, encrypted backups of the keypair file. Loss of the keypair means permanent data loss.
4. **WASM Security**: The WebAssembly module is loaded from the trusted `wasm-pqc-subtle` npm package.
5. **No Side Channels**: The implementation is constant-time to prevent timing attacks.
6. **NIST Standardized**: ML-KEM is a NIST-approved post-quantum algorithm (FIPS 203).
7. **Forward Secrecy**: Each encryption uses a fresh shared secret derived via ML-KEM encapsulation.

### Production Key Management Recommendations

For production environments, consider:

1. **Environment-specific keypairs**: Use different keypairs for dev/staging/production
2. **Key rotation**: Implement a key rotation strategy (though this requires re-encrypting all data)
3. **Access logging**: Monitor access to the keypair file
4. **Principle of least privilege**: Only the server process should have read access to the keypair file
5. **Disaster recovery**: Document and test the process for restoring from keypair backups

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
