# TikTok Video Downloader

Simple standalone video downloader for Railway deployment.

## Setup

1. Add environment variables in Railway:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY` 
   - `GOOGLE_CLOUD_PROJECT_ID`
   - `GCS_BUCKET_NAME`
   - `GCS_KEY_JSON` (entire JSON contents)

2. Deploy - it will automatically run `npm start`