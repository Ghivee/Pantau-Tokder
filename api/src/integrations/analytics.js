const axios = require('axios');

const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://pantau-tokder-7ef7qah8f-ghivees-projects.vercel.app/api/auth/callback';

function getAuthUrl() {
  const scopes = [
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/youtube.readonly'
  ].join(' ');
  
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
}

async function exchangeCodeForTokens(code) {
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code'
  });
  return res.data; // { access_token, refresh_token, expires_in, token_type }
}

async function getAccessToken(refreshToken) {
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  return res.data.access_token;
}

/**
 * Fetch audience retention data for a specific video.
 * Returns an array of { percent_duration, retention } points.
 * Returns null if not available.
 */
async function fetchRetentionData(videoId, refreshToken) {
  if (!refreshToken) return null;

  try {
    const accessToken = await getAccessToken(refreshToken);

    const response = await axios.get('https://youtubeanalytics.googleapis.com/v2/reports', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        ids: 'channel==MINE',
        startDate: '2020-01-01',
        endDate: new Date().toISOString().slice(0, 10),
        metrics: 'audienceWatchRatio',
        dimensions: 'elapsedVideoTimeRatio',
        filters: `video==${videoId}`,
        sort: 'elapsedVideoTimeRatio'
      }
    });

    const rows = response.data.rows || [];
    if (rows.length === 0) return null;

    // Convert to our format: percent_duration (0-100), retention (0-100)
    return rows.map(row => ({
      percent_duration: Math.round(row[0] * 100),
      retention: Math.round(row[1] * 100 * 10) / 10  // keep 1 decimal
    }));
  } catch (err) {
    console.error(`Analytics fetch failed for video ${videoId}:`, err.response?.data || err.message);
    return null;
  }
}

module.exports = { getAuthUrl, exchangeCodeForTokens, fetchRetentionData };
