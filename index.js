#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
const fs = require('fs');

// Write GCS key if provided as env var
if (process.env.GCS_KEY_JSON) {
  fs.writeFileSync('./gcs-key.json', process.env.GCS_KEY_JSON);
}

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Initialize GCS
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: './gcs-key.json'
});
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || 'tiktok-videos');

// Download function
async function downloadVideo(awemeId, videoUrl, username) {
  try {
    const filename = `${awemeId}_${username}_${Date.now()}.mp4`;
    const response = await axios.get(videoUrl, { 
      responseType: 'stream',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const file = bucket.file(filename);
    const stream = file.createWriteStream({
      metadata: { contentType: 'video/mp4' }
    });
    
    return new Promise((resolve, reject) => {
      response.data.pipe(stream)
        .on('error', reject)
        .on('finish', () => {
          resolve(`https://storage.googleapis.com/${bucket.name}/${filename}`);
        });
    });
  } catch (error) {
    console.error(`Failed ${awemeId}:`, error.message);
    return null;
  }
}

// Main loop
async function run() {
  console.log('🚀 Simple Video Downloader Started');
  
  while (true) {
    try {
      // Get videos without downloaded_url
      const { data: videos, error } = await supabase
        .from('shop_videos_new')
        .select('aweme_id, username, video_url')
        .is('downloaded_url', null)
        .not('video_url', 'is', null)
        .limit(50);

      if (error) throw error;

      if (!videos || videos.length === 0) {
        console.log('No videos to download. Waiting 5 minutes...');
        await new Promise(r => setTimeout(r, 300000));
        continue;
      }

      console.log(`Found ${videos.length} videos to download`);
      
      // Download 5 at a time
      for (let i = 0; i < videos.length; i += 5) {
        const batch = videos.slice(i, i + 5);
        await Promise.all(batch.map(async (video) => {
          const gcsUrl = await downloadVideo(video.aweme_id, video.video_url, video.username);
          if (gcsUrl) {
            await supabase
              .from('shop_videos_new')
              .update({ 
                downloaded_url: gcsUrl,
                downloaded_at: new Date().toISOString()
              })
              .eq('aweme_id', video.aweme_id);
            console.log(`✅ ${video.aweme_id}`);
          }
        }));
      }
      
    } catch (error) {
      console.error('Error:', error.message);
      await new Promise(r => setTimeout(r, 60000));
    }
  }
}

run();