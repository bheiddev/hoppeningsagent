# Deploy to Render

## Quick Deploy Steps:

1. **Push to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. **Deploy to Render**:
   - Go to [render.com](https://render.com)
   - Sign up/login with GitHub
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Render will auto-detect the `render.yaml` file
   - Click "Create Web Service"

3. **Environment Variables** (update in render.yaml):
   - `HOPP_API_KEY=Brooklyn1993!`
   - `PORT=10000`
   - `SUPABASE_URL=https://your-project.supabase.co` (replace with your actual URL)
   - `SUPABASE_ANON_KEY=your-anon-key-here` (replace with your actual key)

   **To get your Supabase credentials:**
   - Go to your Supabase project dashboard
   - Click "Settings" → "API"
   - Copy the "Project URL" and "anon public" key

4. **Update Custom GPT**:
   - Replace ngrok URL in OpenAPI spec with your Render URL
   - Re-import the OpenAPI spec in your Custom GPT

## Render URL Format:
Your app will be available at: `https://hoppenings-agent.onrender.com`

## Benefits:
- ✅ Always online (no local server needed)
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ Easy environment variable management
- ✅ GitHub integration for updates
