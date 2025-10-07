# Hoppenings Agent API

A Node.js API for crawling brewery events and beer releases, designed to work with Custom GPT Actions.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set environment variables**:
   ```bash
   export HOPP_API_KEY='super-secret-demo-key'
   export PORT=3000
   ```

3. **Start the server**:
   ```bash
   node server.js
   ```

4. **Test locally**:
   ```bash
   curl -s http://localhost:3000/ping -H "Authorization: Bearer $HOPP_API_KEY"
   ```

## Custom GPT Integration

### 1. OpenAPI Specification
Use the `openapi.yaml` file to import the API into your Custom GPT:

- **File**: `openapi.yaml`
- **Update**: Replace the `servers.url` with your current ngrok URL

### 2. GPT Actions Setup
1. Go to GPT Builder → Configure → Actions
2. Add Action → Import from OpenAPI
3. Paste the contents of `openapi.yaml`
4. Set Authentication:
   - **Type**: API Key
   - **Header name**: `Authorization`
   - **Value**: `Bearer super-secret-demo-key`

### 3. GPT Instructions
Add this to your Custom GPT instructions:

```
You are Hoppenings Crawler. When the user asks to fetch brewery events or beer releases, call the `crawlAndUpsert` action with:
- `target` as the provided URL (events page or sitemap),
- `sinceDays` if the user says "last X days".
If connectivity is questionable, call `ping` first. After `crawlAndUpsert`, summarize the `summary` object (inserted/updated counts and target).
```

## API Endpoints

### GET /ping
Health check endpoint.

**Response**:
```json
{"ok": true, "msg": "pong"}
```

### POST /crawl-and-upsert
Crawl a site/sitemap and upsert events.

**Request Body**:
```json
{
  "target": "https://redlegbrewing.com/tribe_events-sitemap.xml",
  "sinceDays": 7,
  "dryRun": false
}
```

**Response**:
```json
{
  "ok": true,
  "summary": {
    "target": "https://redlegbrewing.com/tribe_events-sitemap.xml",
    "sinceDays": 7,
    "dryRun": false,
    "inserted": 3,
    "updated": 1,
    "events": [...] // only present in dryRun mode
  }
}
```

## Development Features

- **Request Logging**: All requests are logged with timestamps
- **Dry Run Mode**: Preview what would be crawled without writing to database
- **ngrok Integration**: Ready for Custom GPT Actions via ngrok tunnel

## Testing with ngrok

1. **Start ngrok** (in a separate terminal):
   ```bash
   ngrok http 3000
   ```

2. **Test through ngrok**:
   ```bash
   curl -s https://your-ngrok-url.ngrok-free.dev/ping \
     -H "Authorization: Bearer $HOPP_API_KEY"
   ```

3. **Monitor requests**: Visit http://127.0.0.1:4040 for ngrok inspector

## Common Issues

- **ERR_NGROK_8012**: Server isn't running on port 3000
- **401 Unauthorized**: API key doesn't match between GPT Action and server
- **502 Bad Gateway**: ngrok URL changed - update OpenAPI spec

## Next Steps

Ready to implement real crawling logic? The current endpoint returns mock data. You can:

1. Add real web scraping logic
2. Integrate with a database (Supabase, PostgreSQL, etc.)
3. Add more sophisticated event parsing
4. Implement rate limiting and error handling
