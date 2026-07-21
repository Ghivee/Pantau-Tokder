const { google } = require('googleapis');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://pantau-tokder-7ef7qah8f-ghivees-projects.vercel.app/api/auth/callback'
  );
}

function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/youtube.readonly'
  ];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'  // Always ask for consent to get refresh_token
  });
}

async function exchangeCodeForTokens(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function getAuthorizedClient(refreshToken) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

/**
 * Fetch audience retention data for a specific video.
 * Returns an array of { percent_duration, retention } points.
 * Returns null if not available.
 */
async function fetchRetentionData(videoId, refreshToken) {
  if (!refreshToken) return null;

  try {
    const auth = await getAuthorizedClient(refreshToken);
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth });

    // Audience retention report
    const response = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: '2020-01-01',
      endDate: new Date().toISOString().slice(0, 10),
      metrics: 'audienceWatchRatio',
      dimensions: 'elapsedVideoTimeRatio',
      filters: `video==${videoId}`,
      sort: 'elapsedVideoTimeRatio'
    });

    const rows = response.data.rows || [];
    if (rows.length === 0) return null;

    // Convert to our format: percent_duration (0-100), retention (0-100)
    return rows.map(row => ({
      percent_duration: Math.round(row[0] * 100),
      retention: Math.round(row[1] * 100 * 10) / 10  // keep 1 decimal
    }));
  } catch (err) {
    console.error(`Analytics fetch failed for video ${videoId}:`, err.message);
    return null;
  }
}

module.exports = { getAuthUrl, exchangeCodeForTokens, fetchRetentionData };
