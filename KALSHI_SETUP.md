# Kalshi API Setup

## Environment Variables

To use the Kalshi API integration, you need to set the following environment variables:

### Required for Authenticated Requests

1. **KALSHI_API_KEY_ID** - Your Kalshi API Key ID
   - Example: `your-api-key-id-here`

2. **KALSHI_PRIVATE_KEY** - Your RSA private key in PEM format
   - Must include the full key with `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`
   - Example:
     ```
     -----BEGIN RSA PRIVATE KEY-----
     MIIEpAIBAAKCAQEAxTjqI/1/jvL36X7uCccSX104DPkIy6xQf0R50nL0u3hGn6oE
     ...
     -----END RSA PRIVATE KEY-----
     ```

### Optional

3. **KALSHI_API_BASE_URL** - API base URL (defaults to production)
   - Production: `https://api.elections.kalshi.com/trade-api/v2`
   - Demo: `https://demo-api.kalshi.com/trade-api/v2`

## Setting Environment Variables

### Local Development (.env.local)

Create a `.env.local` file in the project root:

```bash
KALSHI_API_KEY_ID=your-key-id-here
KALSHI_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

**Important**: The `.env.local` file is already in `.gitignore` and will NOT be committed to Git.

### Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add the following variables:
   - `KALSHI_API_KEY_ID`
   - `KALSHI_PRIVATE_KEY` (paste the full key including BEGIN/END lines)

## Security Notes

- ✅ Credentials are stored in environment variables only
- ✅ Private key is never hardcoded or logged
- ✅ Private key is used only for request signing (RSA-PSS)
- ✅ `.env*` files are in `.gitignore`
- ✅ Credentials are never exposed in client-side code
- ✅ All API requests are server-side only

## Testing

The API will work without credentials for public market data, but authenticated requests provide:
- Higher rate limits
- Access to private data
- Trading capabilities (if implemented)
