// TikTok Integration
// TikTok's official API does not allow public video data scraping.
// To integrate TikTok, you need to use the TikTok Marketing API with a Business Account,
// or a third-party service like Apify. For now, this returns an empty array
// so that no fake data is mixed into the real analytics.

async function fetchTikTokVideos() {
  console.log("TikTok integration not yet configured — returning empty data.");
  return [];
}

module.exports = { fetchTikTokVideos };
