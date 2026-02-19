# Pro-Se-VA CLI

Modern CLI for managing the Pro-Se-VA server remotely via REST API.

## Installation

```bash
cd app/cli
bun install
bun link
```

## Authentication

The server requires authentication for all API requests. You must log in before using any commands.

```bash
# Log in with your passphrase (prompted securely)
proseva auth login

# Log in with a custom token TTL
proseva auth login --ttl 7d

# Check authentication status
proseva auth status

# Log out (remove stored token)
proseva auth logout
```

Tokens are stored locally at `~/.proseva/token.json` and automatically included in all subsequent requests. Expired tokens are cleaned up automatically.

## Usage

### Basic Commands

```bash
# Log in first
proseva auth login

# Show server status
proseva status

# View configuration
proseva config get

# Set configuration value
proseva config set firebase.projectId my-project

# Test service connection
proseva config test openai

# Show database statistics
proseva db stats

# Export database
proseva db export json > backup.json

# List notification recipients
proseva notifications sms list
proseva notifications devices list

# Trigger test evaluation
proseva notifications test

# Scan directory for documents
proseva scan /path/to/documents
```

### Remote Server Management

```bash
# Connect to remote server
proseva --api-url https://proseva.example.com auth login

# Or set environment variable
export PROSEVA_API_URL=https://proseva.example.com
proseva auth login
proseva config get
```

### Output Formats

```bash
# Human-readable output (default)
proseva status

# JSON output for scripting
proseva --json status | jq .

# Verbose logging
proseva --verbose config test openai
```

## Commands

### `proseva status`

Show system status dashboard including:

- Database entity counts
- Service configuration status
- Recent evaluations
- Scheduler status

Options:

- `--watch` - Refresh every 5 seconds

### `proseva auth`

Authentication management:

#### `auth login`

Log in with your passphrase and receive an authentication token. The passphrase is prompted securely (hidden input).

Options:

- `--ttl <duration>` - Token time-to-live (default: `24h`). Accepts values like `30m`, `24h`, `7d`.

#### `auth logout`

Remove the stored authentication token.

#### `auth status`

Show current authentication status, including token expiration time and storage location.

### `proseva config`

Configuration management commands:

#### `config get [key]`

View configuration (all or specific key).

Examples:

```bash
proseva config get                    # Show all config
proseva config get firebase.projectId # Show specific value
```

#### `config set <key> <value>`

Set configuration value.

Examples:

```bash
proseva config set firebase.projectId my-project
proseva config set scheduler.enabled true
proseva config set ai.openaiApiKey sk-...
```

#### `config reset [group]`

Reset to environment defaults.

Examples:

```bash
proseva config reset              # Reset all
proseva config reset firebase     # Reset Firebase config only
```

#### `config test <service>`

Test service connection. Supported services:

- `firebase` - Test Firebase Cloud Messaging
- `openai` - Test OpenAI API connection
- `twilio` - Test Twilio SMS (requires phone number)

#### `config reinit <service>`

Reinitialize service after configuration change. Supported services:

- `firebase` - Reinitialize Firebase
- `twilio` - Reinitialize Twilio
- `scheduler` - Restart scheduler

### `proseva db`

Database operations:

#### `db stats`

Show entity counts per collection.

#### `db export <format>`

Export database. Supported formats:

- `json` - Export as JSON

Example:

```bash
proseva db export json > backup.json
```

### `proseva scan <directory>`

Scan directory and ingest PDF documents.

Examples:

```bash
proseva scan /path/to/documents
proseva scan ~/case-files
```

Options:

- `--watch` - Watch mode for continuous scanning (not yet implemented)

### `proseva notifications`

Notification management:

#### `notifications devices list`

List FCM device tokens.

#### `notifications devices add <token>`

Add device token.

Options:

- `-n, --name <name>` - Device name
- `-p, --platform <platform>` - Platform (ios|android|web)

#### `notifications devices remove <id>`

Remove device token.

#### `notifications sms list`

List SMS recipients.

#### `notifications sms add <phone>`

Add SMS recipient.

Options:

- `-n, --name <name>` - Recipient name

Example:

```bash
proseva notifications sms add +15555551234 -n "John Doe"
```

#### `notifications sms remove <id>`

Remove SMS recipient.

#### `notifications test`

Trigger test evaluation and send notifications.

## Global Options

- `--api-url <url>` - Server URL (default: http://localhost:3001)
- `--json` - Output as JSON
- `--verbose` - Verbose logging
- `-h, --help` - Show help
- `-V, --version` - Show version

## Environment Variables

- `PROSEVA_API_URL` - Default API URL

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Network error (cannot connect to server)
- `3` - Validation error

## Development

### Generate Types

When the OpenAPI spec changes, regenerate types:

```bash
bun run generate-types
```

### Build

```bash
bun run build
```

### Test

```bash
bun run dev status
bun run dev config get
```

## Examples

### Initial Server Setup

```bash
# Log in first
proseva auth login

# Set OpenAI API key
proseva config set ai.openaiApiKey sk-...

# Set Firebase credentials
proseva config set firebase.projectId my-project
proseva config set firebase.clientEmail service@my-project.iam.gserviceaccount.com
proseva config set firebase.privateKey "-----BEGIN PRIVATE KEY-----\n..."

# Reinitialize Firebase
proseva config reinit firebase

# Set Twilio credentials
proseva config set twilio.accountSid AC...
proseva config set twilio.authToken ...
proseva config set twilio.phoneNumber +15555551234

# Reinitialize Twilio
proseva config reinit twilio

# Add SMS recipient
proseva notifications sms add +15555555678 -n "Me"

# Test notifications
proseva notifications test
```

### Daily Operations

```bash
# Log in (if token has expired)
proseva auth login

# Check server status
proseva status

# Scan new documents
proseva scan ~/new-documents

# View database stats
proseva db stats

# Export backup
proseva db export json > backup-$(date +%Y%m%d).json
```

### Remote Management

```bash
# Connect to production server
export PROSEVA_API_URL=https://proseva.example.com

# Authenticate
proseva auth login

# Update configuration
proseva config set scheduler.timezone "America/Chicago"
proseva config reinit scheduler

# Monitor status
proseva status --watch
```
