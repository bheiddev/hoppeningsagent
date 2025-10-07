# Instagram Graph API Setup Guide

## Overview
This guide will help you set up Instagram Graph API integration for HoppeningsGPT to crawl business Instagram pages.

## Prerequisites
- Facebook Developer Account
- Instagram Business Account
- Facebook Page connected to Instagram Business Account

## Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "Create App" → "Business" → "Next"
3. Fill in app details:
   - App Name: "Hoppenings Crawler"
   - App Contact Email: your email
   - Business Account: select your business account
4. Click "Create App"

## Step 2: Add Instagram Basic Display Product

1. In your app dashboard, click "Add Product"
2. Find "Instagram Basic Display" and click "Set Up"
3. Click "Create New App" in the Instagram Basic Display section

## Step 3: Configure Instagram Basic Display

1. Go to Instagram Basic Display → Basic Display
2. Add OAuth Redirect URIs:
   - `https://your-domain.com/auth/instagram/callback`
   - `http://localhost:3000/auth/instagram/callback` (for local testing)
3. Add Deauthorize Callback URL:
   - `https://your-domain.com/auth/instagram/deauthorize`
4. Add Data Deletion Request URL:
   - `https://your-domain.com/auth/instagram/delete`

## Step 4: Get Page Access Token

### Option A: Using Graph API Explorer (Recommended for testing)

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Generate a User Access Token with these permissions:
   - `instagram_basic`
   - `pages_show_list`
   - `pages_read_engagement`
4. Use this token to get your Page Access Token:
   ```
   GET /me/accounts?access_token={user_access_token}
   ```
5. Find your Instagram-connected page and copy the `access_token`

### Option B: Using Access Token Tool

1. Go to your app dashboard → Tools → Access Token Tool
2. Select your Instagram-connected page
3. Copy the Page Access Token

## Step 5: Get Business Account ID

1. In Graph API Explorer, use your Page Access Token
2. Make this request:
   ```
   GET /me?fields=instagram_business_account
   ```
3. Copy the `instagram_business_account.id` value

## Step 6: Configure Environment Variables

Add these to your `.env` file:

```bash
# Instagram Graph API Configuration
INSTAGRAM_PAGE_ACCESS_TOKEN=your_page_access_token_here
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_business_account_id_here
```

## Step 7: Test the Integration

1. Start your server:
   ```bash
   node server.js
   ```

2. Test the new endpoint:
   ```bash
   curl -X POST http://localhost:3000/crawl-instagram-graph \
     -H "Authorization: Bearer your_hopp_api_key" \
     -H "Content-Type: application/json" \
     -d '{
       "username": "your_brewery_username",
       "limit": 10,
       "dryRun": true,
       "extractEvents": true
     }'
   ```

## Step 8: Token Management

### Short-lived vs Long-lived Tokens
- **Short-lived**: Expires in 1 hour
- **Long-lived**: Expires in ~60 days (recommended for backend)

### Exchange for Long-lived Token
```bash
curl -X GET "https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id={app_id}&client_secret={app_secret}&fb_exchange_token={short_lived_token}"
```

### System User Token (Production)
For production, consider using a System User token that never expires:
1. Go to Business Settings → System Users
2. Create a System User
3. Assign your app to the System User
4. Generate a token with required permissions

## API Usage Examples

### Basic Crawl
```json
{
  "username": "redlegbrewco",
  "limit": 25,
  "dryRun": false,
  "extractEvents": true
}
```

### Response Format
```json
{
  "ok": true,
  "user": {
    "username": "redlegbrewco",
    "business_account": true
  },
  "posts": [...],
  "extracted_events": [...],
  "total": 25,
  "events_found": 3,
  "source": "instagram_graph_api",
  "api_version": "v23.0"
}
```

## Error Handling

### Common Errors
- **401 Unauthorized**: Token expired or invalid
- **400 Bad Request**: Invalid business account ID or username
- **403 Forbidden**: Insufficient permissions

### Rate Limits
- Instagram Graph API has rate limits
- Recommended: 1 request per brewery per hour/day
- Use pagination for older posts: `paging.next`

## Database Schema Updates

The system now supports deduplication using `source_id`:

```sql
-- Add these columns to your events_base table if they don't exist
ALTER TABLE events_base ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE events_base ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Create index for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_events_source_id ON events_base(source_id);
```

## Next Steps

1. **Set up automated crawling**: Schedule regular crawls for each brewery
2. **Add pagination**: Implement `paging.next` for older posts
3. **Enhance event extraction**: Improve LLM parsing of captions
4. **Add insights**: Use Instagram Insights API for engagement metrics
5. **Monitor rate limits**: Implement proper rate limiting and retry logic

## Troubleshooting

### "Account is personal, private, or not found"
- Ensure the Instagram account is a Business Account
- Verify the account is connected to a Facebook Page
- Check that the username is correct (without @)

### "Invalid request to Instagram Graph API"
- Verify your Business Account ID is correct
- Ensure your Page Access Token has the right permissions
- Check that the API version (v23.0) is supported

### Token Expiration
- Set up monitoring for token expiration
- Implement automatic token refresh
- Consider using System User tokens for production
