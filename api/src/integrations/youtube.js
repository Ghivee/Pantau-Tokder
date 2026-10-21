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

const DEFAULT_CHANNELS = require('../config/channels');

// YOUTUBE_CHANNEL_IDS wins; otherwise the project's own channel list; the old single
// YOUTUBE_CHANNEL_ID is only used when that list is empty.
function channelIds() {
  const split = (raw) => [...new Set(String(raw || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
  const fromEnv = split(process.env.YOUTUBE_CHANNEL_IDS);
  if (fromEnv.length) return fromEnv;
  if (DEFAULT_CHANNELS.length) return DEFAULT_CHANNELS.map((c) => c.id);
  return split(process.env.YOUTUBE_CHANNEL_ID);
}

function toVideo(vid) {
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
    channelId: vid.snippet.channelId,
    channelTitle: vid.snippet.channelTitle,
    views: parseInt(vid.statistics.viewCount || 0),
    likes: parseInt(vid.statistics.likeCount || 0),
    comments: parseInt(vid.statistics.commentCount || 0),
    durationSecs: durationSecs,
    durationFormatted: formatDuration(durationSecs),
    tipe_video: isShort ? 'short' : 'long'
  };
}

// Uploads of one channel from the last `days` days, read from its uploads playlist
// (1 quota unit per page instead of 100 for search).
async function fetchNewVideos(channelId = channelIds()[0], days = 30) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !channelId) {
    console.warn('YouTube API keys missing, returning empty array.');
    return [];
  }

  try {
    const since = Date.now() - days * 86400000;
    const playlistId = 'UU' + channelId.slice(2);
    const ids = [];
    let pageToken;
    for (let page = 0; page < 6; page++) {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
        params: { key: apiKey, playlistId, part: 'contentDetails', maxResults: 50, pageToken }
      });
      const items = res.data.items || [];
      const recent = items.filter((it) => new Date(it.contentDetails.videoPublishedAt || 0).getTime() >= since);
      ids.push(...recent.map((it) => it.contentDetails.videoId));
      pageToken = res.data.nextPageToken;
      if (!pageToken || recent.length < items.length) break;
    }
    if (ids.length === 0) {
      console.log(`No new videos found in last ${days} days for ${channelId}.`);
      return [];
    }
    return fetchVideosByIds(ids);
  } catch (error) {
    console.error(`Error fetching YouTube videos for ${channelId}:`, error.response?.data || error.message);
    return [];
  }
}

async function fetchVideosByIds(videoIdsArray) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !videoIdsArray || videoIdsArray.length === 0) return [];

  try {
    let processedVideos = [];
    // Process in chunks of 50
    for (let i = 0; i < videoIdsArray.length; i += 50) {
      const chunkIds = videoIdsArray.slice(i, i + 50).join(',');
      const videoRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          key: apiKey,
          id: chunkIds,
          part: 'snippet,statistics,contentDetails'
        }
      });
      processedVideos = processedVideos.concat((videoRes.data.items || []).map(toVideo));
    }
    return processedVideos;
  } catch (error) {
    console.error('Error fetching YouTube videos by IDs:', error.response?.data || error.message);
    return [];
  }
}

module.exports = { fetchNewVideos, fetchVideosByIds, parseISODuration, formatDuration, channelIds };
