# Bearer Token Authentication

This document describes the bearer token authentication system added to Pro-Se-VA.

## Overview

The API now requires bearer token authentication for all endpoints except:

- `/api/auth/login` - Login endpoint to obtain token
- `/api/security/*` - Security-related endpoints (passphrase setup, recovery)

## Authentication Flow

### 1. Setup Passphrase (First-time only)

Before you can authenticate, a passphrase must be configured on the server:

```bash
curl -X POST http://localhost:3001/api/security/setup-passphrase \
  -H "Content-Type: application/json" \
  -d '{"passphrase":"your-secure-passphrase"}'
```

### 2. Login and Get Token

Use the passphrase to obtain a JWT token:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"passphrase":"your-secure-passphrase","ttl":"24h"}'
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}
```

TTL options:

- `24h` - 24 hours (default)
- `7d` - 7 days
- `30m` - 30 minutes
- `1h` - 1 hour

### 3. Use Token for API Calls

Include the token in the `Authorization` header:

```bash
curl http://localhost:3001/api/cases \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## CLI Usage

The Pro-Se-VA CLI automatically handles token authentication.

### Login

```bash
proseva auth login
# You'll be prompted for your passphrase
# Token is stored in ~/.proseva/token.json
```

Custom TTL:

```bash
proseva auth login --ttl 7d
```

### Check Authentication Status

```bash
proseva auth status
```

Output:

```
✓ Authenticated
API URL: http://localhost:3001
Token expires in 23h 45m
Stored in /Users/you/.proseva/token.json
```

### Logout

```bash
proseva auth logout
```

This removes the stored token. You'll need to login again for subsequent API calls.

### Using Commands

Once logged in, all CLI commands automatically include your token:

```bash
proseva status
proseva config get
proseva db stats
# etc.
```

## Token Storage

- **Server**: JWT secret is stored in the database (`server/data/db.json`) under `serverConfig.jwt_secret`
- **CLI**: Token is stored in `~/.proseva/token.json` with expiration timestamp

## Security Notes

1. **Token Lifetime**: Tokens expire after the specified TTL. Default is 24 hours.
2. **Token Storage**: CLI tokens are stored in plaintext in `~/.proseva/token.json`. Protect this file appropriately.
3. **JWT Secret**: Generated automatically on first use and persisted in the database.
4. **Passphrase**: Hashed using bcrypt (cost=12) before storage.

## Error Responses

### 401 Unauthorized - Missing Token

```json
{
  "error": "Authentication required. Please provide a valid Bearer token.",
  "code": "AUTH_REQUIRED"
}
```

### 401 Unauthorized - Invalid Header Format

```json
{
  "error": "Invalid Authorization header format. Use 'Bearer <token>'.",
  "code": "INVALID_AUTH_HEADER"
}
```

### 401 Unauthorized - Invalid/Expired Token

```json
{
  "error": "Invalid or expired token.",
  "code": "INVALID_TOKEN"
}
```

## Implementation Details

### Server Components

1. **Auth API** (`server/src/auth-api.ts`):
   - `POST /api/auth/login` - Issues JWT tokens
   - Token verification using jose library
   - Configurable TTL support

2. **Authentication Middleware** (`server/src/index.ts`):
   - `requireAuthentication` - Validates Bearer tokens
   - Runs before all protected endpoints
   - Allows unauthenticated access to security and auth routes

3. **Token Generation**:
   - Algorithm: HS256 (HMAC SHA-256)
   - Secret: 256-bit random key (generated once, stored in DB)
   - Claims: `iss` (proseva), `aud` (proseva-api), `exp` (expiration), `type` (access)

### CLI Components

1. **Auth Command** (`cli/commands/auth.ts`):
   - `login` - Prompts for passphrase (hidden input), stores token
   - `logout` - Removes stored token
   - `status` - Shows authentication status

2. **API Client** (`cli/lib/api-client.ts`):
   - Automatically includes `Authorization: Bearer <token>` header
   - Token loaded from `~/.proseva/token.json` on startup

## Frontend Integration

The frontend automatically handles bearer token authentication through the PassphraseGate component.

### Authentication Flow

1. **Passphrase Entry**: User enters their passphrase in PassphraseGate
2. **Token Acquisition**: PassphraseGate calls `/api/auth/login` to get JWT token
3. **Token Storage**: Token stored in memory via `setAuthToken()`
4. **Automatic Inclusion**: All API calls automatically include `Authorization: Bearer <token>` header
5. **Session Management**: Token cleared on expiration, user prompted to re-authenticate

### Key Components

**PassphraseGate** (`src/components/security/PassphraseGate.tsx`):

- Handles initial passphrase setup and entry
- Calls `/api/auth/login` after passphrase verification
- Sets up auth expiration callback

**API Client** (`src/lib/api.ts`):

- `setAuthToken(token)` - Store JWT token in memory
- `getAuthToken()` - Retrieve current token
- `clearAuthToken()` - Remove token (on logout/expiration)
- `setAuthExpiredCallback(callback)` - Handle 401 responses
- All API calls automatically include Bearer token

### Token Expiration Handling

When a 401 response is received:

1. Token is automatically cleared
2. Auth expiration callback is triggered
3. PassphraseGate returns to login state
4. User sees "Your session has expired. Please log in again."
5. User re-enters passphrase to get new token

### Testing

The PassphraseGate component includes test mode detection:

```typescript
const isTestMode = import.meta.env.MODE === "test";
```

In test mode, authentication is bypassed for easier testing.

## Migration Guide

### Existing API Clients

If you have existing scripts or applications using the API:

1. Add authentication:

   ```bash
   # Get token first
   TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"passphrase":"your-passphrase"}' \
     | jq -r '.token')

   # Use token in subsequent requests
   curl http://localhost:3001/api/cases \
     -H "Authorization: Bearer $TOKEN"
   ```

2. Update your scripts to handle 401 responses and re-authenticate when needed.

### Disabling Authentication (Not Recommended)

Authentication is enforced by the `requireAuthentication` middleware. To disable it (not recommended for production):

1. Edit `server/src/index.ts`
2. Remove `requireAuthentication` from the `before` array in `AutoRouter` config
3. Restart the server

This is **not recommended** as it exposes your API without protection.
