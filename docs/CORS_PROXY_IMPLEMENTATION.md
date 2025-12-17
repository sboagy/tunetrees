# CORS Proxy Implementation for TheSession.org

## Overview
This document describes the CORS proxy implementation that fixes the "Failed to fetch" error when importing tunes from TheSession.org.

## Problem Statement
When users attempted to search for or import tunes from TheSession.org through the "Add Tune" dialog, they encountered a "Failed to fetch" error. This was caused by browser CORS (Cross-Origin Resource Sharing) policy blocking direct fetch requests from the TuneTrees PWA to TheSession.org's API.

## Technical Root Cause
- TheSession.org API does not include CORS headers that allow cross-origin requests from arbitrary domains
- Browser security policy blocks these requests with a `TypeError: Failed to fetch`
- The error occurred in two functions:
  - `fetchTheSessionURLsFromTitle` (searching by title)
  - `fetchTuneInfoFromTheSessionURL` (fetching tune details by URL)

## Solution Architecture

### High-Level Flow
```
Browser (localhost:5173)
    ↓ fetch("/api/proxy/thesession?url=...")
Cloudflare Worker (localhost:8787)
    ↓ fetch("https://thesession.org/...")
TheSession.org API
    ↓ JSON response
Cloudflare Worker
    ↓ JSON response + CORS headers
Browser
```

### Components

#### 1. Cloudflare Worker Proxy Endpoint
**File:** `worker/src/index.ts`

**Endpoint:** `GET /api/proxy/thesession?url=<encoded-url>`

**Functionality:**
- Receives URL to proxy via query parameter
- Validates the URL (security checks)
- Forwards request to TheSession.org
- Returns response with proper CORS headers

**Security Validations:**
1. **URL Format**: Validates URL can be parsed (prevents malformed URLs)
2. **Hostname**: Exact match for `thesession.org` (prevents subdomain attacks)
3. **Protocol**: Only HTTPS allowed (prevents protocol manipulation)
4. **Timeout**: 10-second timeout (prevents hanging connections)
5. **JSON Validation**: Handles malformed JSON responses gracefully

**Error Handling:**
- 400: Missing or invalid URL parameter
- 400: Invalid hostname (not thesession.org)
- 400: Invalid protocol (not HTTPS)
- 502: Invalid JSON response from TheSession.org
- 504: Request timeout
- 500: Other proxy errors

#### 2. Import Utils Update
**File:** `src/lib/import/import-utils.ts`

**Changes:**
- Added `getWorkerUrl()` function with smart defaults
- Routes all TheSession.org API calls through the proxy
- Maintains same error handling and response structure

**Worker URL Resolution:**
```typescript
1. Check VITE_WORKER_URL environment variable
2. If production (HTTPS): use window.location.origin
3. If development (HTTP): use http://localhost:8787
```

This prevents mixed content warnings in production.

#### 3. Environment Variables
**Files:** `.env.example`, `.env.local.example`, `.env.production.example`

**Variable:** `VITE_WORKER_URL`

**Values:**
- Development: `http://localhost:8787` (local wrangler dev)
- Production: `https://tunetrees-pwa.pages.dev` (or same origin)

## Security Considerations

### Attack Vectors Prevented

1. **Subdomain Attacks**
   - ❌ `malicious-thesession.org` → Blocked by exact hostname match
   - ✅ `thesession.org` → Allowed

2. **Protocol Manipulation**
   - ❌ `http://thesession.org` → Blocked (HTTP not allowed)
   - ❌ `ftp://thesession.org` → Blocked
   - ✅ `https://thesession.org` → Allowed

3. **Resource Exhaustion**
   - 10-second timeout prevents hanging connections
   - Worker automatically terminates slow requests

4. **JSON Injection**
   - Malformed JSON responses are caught and return 502 error
   - No arbitrary code execution possible

5. **Mixed Content**
   - Smart URL detection prevents HTTP/HTTPS mixed content
   - Production defaults to HTTPS worker URLs

### Security Best Practices
- ✅ Input validation (URL, hostname, protocol)
- ✅ Timeout protection (10 seconds)
- ✅ Error handling (malformed URLs, JSON, timeouts)
- ✅ Logging (all requests logged for monitoring)
- ✅ CORS headers (properly configured)
- ✅ No authentication required (TheSession.org API is public)

## Performance Impact

### Latency
- Proxy adds ~50-100ms latency (Cloudflare edge network)
- Acceptable for user-initiated imports (not performance-critical)

### Scalability
- Cloudflare Workers scale automatically
- No rate limiting currently (TheSession.org handles their own)
- Can add rate limiting in future if needed

### Caching
- No caching currently implemented
- Future improvement: Cache frequently accessed tunes
- Would reduce load on TheSession.org API

## Testing

### Manual Testing
See `TESTING_THE_FIX.md` for detailed instructions.

**Quick Test:**
1. Start worker: `cd worker && npm run dev`
2. Start app: `npm run dev`
3. Add Tune → Search for "Kiss the Maid behind the Barrel"
4. Verify search results appear (no "Failed to fetch")

### Automated Testing
```bash
# E2E tests (requires worker running)
ENABLE_IMPORT_TESTS=true npx playwright test tune-import-001-thesession
```

**Test Coverage:**
- Import by direct URL (single setting)
- Import by direct URL (multiple settings)
- Search by title and import
- Error handling for invalid URLs

## Deployment

### Development
1. Install dependencies: `cd worker && npm install`
2. Start worker: `npm run dev`
3. Worker runs on `http://localhost:8787`

### Production
1. Deploy worker: `cd worker && npm run deploy`
2. Set JWT secret: `npx wrangler secret put SUPABASE_JWT_SECRET`
3. Update `.env.production`: `VITE_WORKER_URL=https://tunetrees-pwa.pages.dev`
4. Deploy app to Cloudflare Pages

### Verification
Test the import feature on production to ensure the proxy works correctly.

## Monitoring & Debugging

### Logs
- Worker logs available in Cloudflare dashboard
- Console logs include request details and errors
- All proxy requests logged with URL and status

### Common Issues

**"Connection refused"**
- Worker not running on port 8787
- Check `VITE_WORKER_URL` configuration

**"Invalid URL - only thesession.org is allowed"**
- Trying to proxy non-thesession.org URLs
- Security feature - only thesession.org allowed

**"Request timeout"**
- TheSession.org slow or unresponsive
- 10-second timeout is intentional
- User should retry

**Mixed content warnings**
- Check `VITE_WORKER_URL` uses HTTPS in production
- Smart URL detection should prevent this

## Future Improvements

### 1. Rate Limiting
Add rate limiting to prevent abuse:
```typescript
// Track requests per IP
// Limit: 10 requests per minute per IP
```

### 2. Caching
Implement caching for frequently accessed tunes:
```typescript
// Cache tune data in Cloudflare KV
// TTL: 24 hours
// Reduces load on TheSession.org
```

### 3. IrishTune.info Support
Add support for irishtune.info imports:
```typescript
// Similar proxy endpoint
// Different validation rules
```

### 4. Analytics
Track import usage:
- Most searched tunes
- Error rates
- Response times

### 5. Error Recovery
Implement retry logic with exponential backoff:
```typescript
// Retry failed requests 3 times
// 1s, 2s, 4s delays
```

## References

### External APIs
- TheSession.org API: https://thesession.org/tunes/search?format=json
- TheSession.org Terms: https://thesession.org/about

### Cloudflare Resources
- Workers Documentation: https://developers.cloudflare.com/workers/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/

### Related Issues
- GitHub Issue: #[issue-number]
- PR: #[pr-number]
- Original bug report: [link]

## Changelog

### 2025-12-17 - Initial Implementation
- Added CORS proxy endpoint in Cloudflare Worker
- Updated import utils to use proxy
- Added environment variable configuration
- Created testing documentation
- Addressed security concerns from code review

### Security Improvements (2025-12-17)
- Exact hostname matching (prevents subdomain attacks)
- Protocol validation (HTTPS only)
- URL parsing validation (handles malformed URLs)
- JSON parsing validation (handles malformed responses)
- 10-second timeout (prevents resource exhaustion)
- Smart worker URL detection (prevents mixed content)

---

**Last Updated:** 2025-12-17
**Author:** GitHub Copilot (@copilot)
**Status:** Implementation Complete, Awaiting Testing
