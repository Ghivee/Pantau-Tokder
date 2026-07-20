const axios = require('axios');

function parseISODuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  
  const hours = (parseInt(match[1]) || 0);
  const minutes = (parseInt(match[2]) || 0);
  const seconds = (parseInt(match[3]) || 0);
  
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchNewVideos() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!apiKey || !channelId) {
    console.warn('YouTube API keys missing, returning empty array.');
    return [];
  }
  
  try {
    // 1. Fetch latest videos from channel (up to 20 for sync)
    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: apiKey,
        channelId: channelId,
        part: 'snippet',
        order: 'date',
        maxResults: 20,
        type: 'video'
      }
    });
    
    const items = searchRes.data.items || [];
    if (items.length === 0) return [];
    
    const videoIds = items.map(item => item.id.videoId).join(',');
    
    // 2. Fetch full details (stats, duration, description)
    const videoRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: apiKey,
        id: videoIds,
        part: 'snippet,statistics,contentDetails'
      }
    });
    
    const processedVideos = (videoRes.data.items || []).map(vid => {
      const durationSecs = parseISODuration(vid.contentDetails.duration);
      // User requested < 120s is short, >= 120s is long
      const isShort = durationSecs < 120;
      
      return {
        post_id: vid.id,
        platform: 'youtube',
        url: `https://www.youtube.com/watch?v=${vid.id}`,
        title: vid.snippet.title,
        description: vid.snippet.description,
        publishedAt: vid.snippet.publishedAt,
        views: parseInt(vid.statistics.viewCount || 0),
        likes: parseInt(vid.statistics.likeCount || 0),
        comments: parseInt(vid.statistics.commentCount || 0),
        durationSecs: durationSecs,
        tipe_video: isShort ? 'short' : 'long'
      };
    });
    
    return processedVideos;
  } catch (error) {
    console.error('Error fetching YouTube videos:', error.response?.data || error.message);
    return [];
  }
}

module.exports = { fetchNewVideos };
