// TikTok Integration (Mock Data Generator)
// Note: Official TikTok API for public data scraping is restricted.
// This is a stub that generates realistic random TikTok data for testing.
// In a real environment, replace this with an Apify scraper call or TikTok Marketing API.

async function fetchTikTokVideos() {
  console.log("Fetching mock TikTok videos...");
  
  // Let's generate a couple of random TikToks
  const data = [];
  
  // We'll hardcode some possible hashtags corresponding to our editors #DNI, #FND, #RNA, #BDI
  const possibleTags = ['#DNI', '#FND', '#RNA', '#BDI'];
  
  for (let i = 0; i < 3; i++) {
    const randomTag = possibleTags[Math.floor(Math.random() * possibleTags.length)];
    const isShort = true; // TikToks are generally shorts
    const durationSecs = Math.floor(Math.random() * 50) + 15; // 15s to 65s
    const id = 'tk' + Math.floor(Math.random() * 1000000);
    
    data.push({
      post_id: id,
      platform: 'tiktok',
      url: `https://www.tiktok.com/@tokder/video/${id}`,
      title: `Konten TikTok Viral Ke-${i+1} ${randomTag}`,
      description: `Ini adalah deskripsi konten tiktok yang sangat menarik! Jangan lupa cek keranjang kuning. ${randomTag}`,
      publishedAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      views: Math.floor(Math.random() * 500000) + 5000,
      likes: Math.floor(Math.random() * 50000) + 500,
      comments: Math.floor(Math.random() * 1000) + 10,
      durationSecs: durationSecs,
      tipe_video: isShort ? 'short' : 'long'
    });
  }
  
  return data;
}

module.exports = { fetchTikTokVideos };
