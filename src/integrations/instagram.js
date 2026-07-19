const axios = require('axios');

async function fetchInstagramPosts() {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const igId = process.env.IG_BUSINESS_ACCOUNT_ID;
  if (!token || !igId) {
    console.warn('IG API keys missing, returning mock data.');
    return [];
  }

  try {
    const res = await axios.get(`https://graph.facebook.com/v20.0/${igId}/media`, {
      params: {
        access_token: token,
        fields: 'id,caption,media_url,timestamp,permalink',
        limit: 10
      }
    });
    return res.data.data;
  } catch (error) {
    console.error('Error fetching IG posts:', error.message);
    return [];
  }
}

async function fetchInstagramStats(mediaId) {
  // Mock Implementation
  return { views: 0, likes: 0, comments: 0 };
}

module.exports = { fetchInstagramPosts, fetchInstagramStats };
