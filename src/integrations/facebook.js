const axios = require('axios');

async function fetchFacebookPosts() {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!token || !pageId) {
    console.warn('FB API keys missing, returning mock data.');
    return [];
  }

  try {
    const res = await axios.get(`https://graph.facebook.com/v20.0/${pageId}/posts`, {
      params: {
        access_token: token,
        fields: 'id,message,created_time,permalink_url',
        limit: 10
      }
    });
    return res.data.data;
  } catch (error) {
    console.error('Error fetching FB posts:', error.message);
    return [];
  }
}

async function fetchFacebookStats(postId) {
  // Mock Implementation
  return { views: 0, likes: 0, comments: 0 };
}

module.exports = { fetchFacebookPosts, fetchFacebookStats };
