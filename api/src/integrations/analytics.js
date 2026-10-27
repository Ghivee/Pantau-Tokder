const axios = require('axios');

// The first few YouTube Analytics failures of a sync, kept so the app can show why numbers are missing.
const recentErrors = [];
function noteError(what, err) {
  const msg = err.response?.data?.error?.message || err.message;
  if (recentErrors.length < 5 && !recentErrors.some((e) => e.endsWith(msg))) recentErrors.push(`${what}: ${msg}`);
}
function takeErrors() {
  return recentErrors.splice(0, recentErrors.length);
}

function getAuthUrl(redirectUri, state) {
  const scopes = [
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
  ].join(' ');
  
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=${encodeURIComponent('consent select_account')}&state=${encodeURIComponent(state)}`;
}

async function exchangeCodeForTokens(code, redirectUri) {
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
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

// Audience retention straight from YouTube Analytics: [] when YouTube has no curve for the video yet.
// Errors are thrown with Google's own message so the app can show the real reason.
async function retentionCurve(videoId, accessToken) {
  try {
    const response = await axios.get('https://youtubeanalytics.googleapis.com/v2/reports', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
      params: {
        ids: 'channel==MINE',
        startDate: '2020-01-01',
        endDate: new Date().toISOString().slice(0, 10),
        metrics: 'audienceWatchRatio',
        dimensions: 'elapsedVideoTimeRatio',
        filters: `video==${videoId}`,
        sort: 'elapsedVideoTimeRatio',
      },
    });
    return (response.data.rows || []).map((row) => ({
      percent_duration: Math.round(row[0] * 100),
      retention: Math.round(row[1] * 100 * 10) / 10,
    }));
  } catch (err) {
    throw new Error(err.response?.data?.error?.message || err.message);
  }
}

// For the sync: the curve, or null when there is none or YouTube refused (the reason goes to the sync notes).
async function fetchRetentionData(videoId, accessToken) {
  if (!accessToken) return null;
  try {
    const curve = await retentionCurve(videoId, accessToken);
    return curve.length ? curve : null;
  } catch (err) {
    console.error(`Analytics fetch failed for video ${videoId}:`, err.message);
    noteError('Retensi', err);
    return null;
  }
}

/**
 * Fetch estimated revenue data for a specific video.
 * Returns revenue amount (number).
 * Returns null if not available or no revenue.
 */
// Revenue is asked from YouTube in rupiah (YouTube converts with its own daily rate).
// Until the stored US$ figures are converted once (see analyticsService.pastikanRupiah) the
// scan keeps asking in US$, so the two are never mixed.
let mataUang = 'USD';
const pakaiMataUang = (c) => { mataUang = c === 'IDR' ? 'IDR' : 'USD'; };

async function fetchRevenueData(videoId, accessToken) {
  if (!accessToken) return null;

  try {
    const response = await axios.get('https://youtubeanalytics.googleapis.com/v2/reports', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        ids: 'channel==MINE',
        startDate: '2020-01-01',
        endDate: new Date().toISOString().slice(0, 10),
        metrics: 'estimatedRevenue',
        currency: mataUang,
        filters: `video==${videoId}`
      }
    });

    const rows = response.data.rows || [];
    if (rows.length === 0) return 0;

    // rows[0][0] will be the estimatedRevenue value
    return parseFloat(rows[0][0]) || 0;
  } catch (err) {
    console.error(`Revenue fetch failed for video ${videoId}:`, err.response?.data || err.message);
    noteError('Pendapatan video', err);
    return null;
  }
}

/**
 * The channel a token belongs to. With a Google account that owns several channels,
 * each consent is for the one channel picked on Google's screen.
 */
async function fetchOwnChannel(accessToken) {
  const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { part: 'snippet', mine: true }
  });
  const item = (res.data.items || [])[0];
  return item ? { id: item.id, nama: item.snippet.title } : null;
}

/**
 * Daily channel totals: views, minutes watched, subscribers gained/lost and estimated revenue.
 * Channels without monetization access are retried without revenue.
 */
async function fetchChannelDaily(accessToken, startDate, endDate) {
  const base = ['views', 'estimatedMinutesWatched', 'subscribersGained', 'subscribersLost'];
  const run = (metrics) => axios.get('https://youtubeanalytics.googleapis.com/v2/reports', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { ids: 'channel==MINE', startDate, endDate, metrics: metrics.join(','), dimensions: 'day', sort: 'day', currency: mataUang }
  });
  let res;
  let withRevenue = true;
  try {
    res = await run([...base, 'estimatedRevenue']);
  } catch (err) {
    withRevenue = false;
    res = await run(base);
  }
  return (res.data.rows || []).map((r) => ({
    tanggal: r[0],
    views: Number(r[1]) || 0,
    menit_tonton: Number(r[2]) || 0,
    sub_naik: Number(r[3]) || 0,
    sub_turun: Number(r[4]) || 0,
    revenue: withRevenue ? Number(r[5]) || 0 : null,
  }));
}

module.exports = { pakaiMataUang, retentionCurve, getAuthUrl, exchangeCodeForTokens, getAccessToken, fetchRetentionData, fetchRevenueData, fetchOwnChannel, fetchChannelDaily, takeErrors };
