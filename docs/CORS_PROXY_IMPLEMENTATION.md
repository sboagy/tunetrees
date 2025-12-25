# CORS Proxy Implementation for TheSession.org

## Quick Summary

This fix uses different proxy strategies for development vs production to bypass CORS restrictions when importing tunes from TheSession.org:

- **Development**: Vite dev server proxy (just run `npm run dev`)
- **Production**: Cloudflare Pages Function (deploys automatically with app)

## Architecture

### Development
```
Browser → Vite proxy (/api/proxy/thesession) → TheSession.org
```
**Implementation**: `vite.config.ts` proxy configuration  
**Benefits**: No separate server needed, automatic CORS handling

### Production
```
Browser → Pages Function (/api/proxy/thesession) → TheSession.org
```
**Implementation**: `/functions/api/proxy/thesession.ts`  
**Benefits**: Deploys with app, serverless, same-origin

## Key Design Decisions

### Why Not Use the Sync Worker?

**Rejected Approach**: Adding proxy to the Cloudflare Worker used for sync
- ❌ Pollutes sync worker with non-sync functionality
- ❌ Conflicts with plans to isolate sync operations (issue #338)

**Chosen Approach**: Separate Pages Function + Vite proxy
- ✅ Sync worker stays focused on sync only
- ✅ Simpler development (no separate worker to run)
- ✅ More flexible for future import sources
- ✅ Cleaner separation of concerns

### Why Pages Functions?

- ✅ Deployed automatically with the app (no separate deployment)
- ✅ Same-origin to the app (no CORS, no mixed content)
- ✅ Serverless (scales automatically)
- ✅ Fast (runs on Cloudflare edge network)
- ✅ Easy to add more proxy functions for other sources

## Security

All requests are validated:
- ✅ Exact hostname match (`thesession.org` only)
- ✅ HTTPS-only protocol
- ✅ URL parsing validation
- ✅ JSON response validation
- ✅ 10-second timeout

## Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite proxy for development |
| `functions/api/proxy/thesession.ts` | Pages Function for production |
| `src/lib/import/import-utils.ts` | Uses same-origin proxy endpoint |
| `TESTING_THE_FIX.md` | Testing instructions |

## Testing

**Development**:
```bash
npm run dev  # Proxy is automatic
```

**Production**: Deploy to Cloudflare Pages (Pages Function deploys automatically)

## See Also

- `TESTING_THE_FIX.md` - Detailed testing instructions
- Issue #338 - Sync isolation requirements

---

**Last Updated**: 2025-12-25  
**Status**: Implementation Complete
