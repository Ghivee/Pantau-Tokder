const axios = require('axios');

async function fetchFacebookPosts() {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!token || !pageId) {
    console.warn('FB API keys missing, returning empty data.');
    return [];
  }

  try {
    const res = await axios.get(`https://graph.facebook.com/v20.0/${pageId}/videos`, {
      params: {
        access_token: token,
        fields: 'id,description,created_time,permalink_url,length',
        limit: 20
      }
    });
    return res.data.data.map(post => ({
      post_id: post.id,
      platform: 'facebook',
      url: post.permalink_url || `https://www.facebook.com/video/${post.id}`,
      title: (post.description || '').slice(0, 120) || `Video Facebook ${post.id}`,
      description: post.description || '',
      publishedAt: post.created_time,
      durationSecs: Math.round(post.length || 0),
      tipe_video: (post.length || 0) < 90 ? 'short' : 'long',
    }));
  } catch (error) {
    console.error('Error fetching FB posts:', error.message);
    return [];
  }
}

async function fetchFacebookStats(postId) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) return { views: 0, likes: 0, comments: 0 };
  
  try {
    const res = await axios.get(`https://graph.facebook.com/v20.0/${postId}`, {
      params: {
        access_token: token,
        fields: 'video_insights.metric(total_video_views,total_video_reactions_by_type_total){name,values},comments.summary(true)'
      }
    });
    const insights = res.data.video_insights?.data || [];
    const viewsData = insights.find(i => i.name === 'total_video_views');
    const views = viewsData?.values?.[0]?.value || 0;
    const likesData = insights.find(i => i.name === 'total_video_reactions_by_type_total');
    const likes = likesData?.values?.[0]?.value?.like || 0;
    const comments = res.data.comments?.summary?.total_count || 0;
    return { views, likes, comments };
  } catch (err) {
    console.error(`FB stats error for ${postId}:`, err.message);
    return { views: 0, likes: 0, comments: 0 };
  }
}

module.exports = { fetchFacebookPosts, fetchFacebookStats };
