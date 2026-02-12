# AI Chat Edge Function Deployment Guide

## Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Google Gemini API key: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Supabase project linked: `supabase link --project-ref your-project-ref`

## Setup Steps

### 1. Set Gemini API Key

The Edge Function needs access to your Gemini API key. Store it in Supabase Secrets:

```bash
# For production (deployed)
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here

# For local development
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here --env-file .env.local
```

### 2. Deploy the Function

```bash
# Deploy to production
supabase functions deploy ai-chat

# Or deploy with environment-specific options
supabase functions deploy ai-chat --no-verify-jwt  # (not recommended for production)
```

### 3. Verify Deployment

Test the endpoint:

```bash
# Get your function URL
supabase functions list

# Test with curl (replace with your project URL and auth token)
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/ai-chat' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What tunes do I have in my repertoire?"
  }'
```

### 4. Check Logs

Monitor function logs for errors:

```bash
supabase functions logs ai-chat
```

## Local Development

### Start Supabase Locally

```bash
supabase start
```

### Serve Function Locally

```bash
# Terminal 1: Serve the function
supabase functions serve ai-chat

# Terminal 2: Start the frontend dev server
npm run dev
```

The function will be available at: `http://127.0.0.1:54321/functions/v1/ai-chat`

### Test Locally

```bash
# Using curl
curl -X POST 'http://127.0.0.1:54321/functions/v1/ai-chat' \
  -H 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Show me my reels"
  }'
```

## Troubleshooting

### "Gemini API key not configured"

**Solution**: Ensure you've set the secret:
```bash
supabase secrets set GEMINI_API_KEY=your_key
```

### "Unauthorized" or "Missing authorization"

**Cause**: Missing or invalid JWT token

**Solution**:
1. Ensure user is logged in
2. Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
3. Verify Edge Function CORS settings

### Function not responding

**Debug**:
```bash
# Check function status
supabase functions list

# View logs
supabase functions logs ai-chat --follow

# Test with verbose output
curl -v -X POST 'https://your-project.supabase.co/functions/v1/ai-chat' \
  -H 'Authorization: Bearer YOUR_KEY' \
  -d '{"message": "test"}'
```

### CORS errors

The function includes CORS headers for all origins (`*`). For production, you may want to restrict this:

```typescript
// In supabase/functions/ai-chat/index.ts
headers: {
  "Access-Control-Allow-Origin": "https://your-domain.com",
  // ...
}
```

## Monitoring

### Usage Metrics

Monitor in Supabase Dashboard:
- **Functions > ai-chat > Metrics**
- Track invocations, errors, duration

### Gemini API Quota

Check your usage at [Google AI Studio](https://aistudio.google.com/):
- Free tier: 15 requests/minute
- Monitor quota to avoid rate limits

## Updating the Function

After making changes to `supabase/functions/ai-chat/index.ts`:

```bash
# Re-deploy
supabase functions deploy ai-chat

# Verify
supabase functions logs ai-chat --follow
```

Changes take effect immediately (no restart needed).

## Security Best Practices

1. **Never commit API keys** - Use Supabase Secrets only
2. **Use RLS policies** - Ensure users can only access their own data
3. **Rate limiting** - Consider adding rate limits to prevent abuse
4. **Input validation** - Sanitize user messages before sending to Gemini
5. **Error handling** - Don't expose sensitive error details to clients

## Cost Considerations

- **Gemini Flash 1.5**: Free tier available (15 RPM)
- **Supabase Functions**: Included in free tier (500K invocations/month)
- **Database queries**: Optimized to fetch minimal data

For high-traffic apps, consider:
- Caching frequent queries
- Implementing client-side rate limiting
- Upgrading to Gemini Pro for higher limits
