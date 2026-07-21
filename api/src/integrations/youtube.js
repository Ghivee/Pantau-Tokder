const axios = require('axios');

function parseISODuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(secs) {
  if (!secs || secs === 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function fetchNewVideos() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!apiKey || !channelId) {
    console.warn('YouTube API keys missing, returning empty array.');
    return [];
  }

  try {
    // Fetch videos published in the last 30 days only
    // This handles the "only new videos going forward" requirement 
    // while giving a 30-day window to catch recent uploads
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - 30);

    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: apiKey,
        channelId: channelId,
        part: 'snippet',
        order: 'date',
        maxResults: 50,          // Max per page
        type: 'video',
        publishedAfter: publishedAfter.toISOString()  // Only recent videos
      }
    });

    const items = searchRes.data.items || [];
    if (items.length === 0) {
      console.log('No new videos found in last 30 days.');
      return [];
    }

    const videoIds = items.map(item => item.id.videoId).join(',');

    // Fetch full details: stats + duration
    const videoRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: apiKey,
        id: videoIds,
        part: 'snippet,statistics,contentDetails'
      }
    });

    const processedVideos = (videoRes.data.items || []).map(vid => {
      const durationSecs = parseISODuration(vid.contentDetails.duration);
      // < 120 seconds = Shorts, >= 120 seconds = Long video
      const isShort = durationSecs > 0 && durationSecs < 120;

      return {
        post_id: vid.id,
        platform: 'youtube',
        url: isShort
          ? `https://www.youtube.com/shorts/${vid.id}`
          : `https://www.youtube.com/watch?v=${vid.id}`,
        title: vid.snippet.title,
        description: vid.snippet.description,
        publishedAt: vid.snippet.publishedAt,
        views: parseInt(vid.statistics.viewCount || 0),
        likes: parseInt(vid.statistics.likeCount || 0),
        comments: parseInt(vid.statistics.commentCount || 0),
        durationSecs: durationSecs,
        durationFormatted: formatDuration(durationSecs),
        tipe_video: isShort ? 'short' : 'long'
      };
    });

    return processedVideos;
  } catch (error) {
    console.error('Error fetching YouTube videos:', error.response?.data || error.message);
    return [];
  }
}

module.exports = { fetchNewVideos, parseISODuration, formatDuration };
