const crypto = require('crypto');
const axios = require('axios');

// TikTok (Login Kit + Display API + Content Posting), Instagram (Instagram API with Instagram Login) and Facebook
// Pages (Facebook Login). Statistics are read-only. Each platform also asks for exactly one upload scope
// (video.upload, instagram_business_content_publish, pages_manage_posts) for the Posting feature, which only
// ever sends the owner's own video as a draft.
// Field and metric names follow each platform's current documentation; they are the first thing
// to check if a platform answers with an error after it changes its API.

// Spasi atau baris baru yang ikut tertempel saat mengisi kunci di Vercel membuat platform menolak kuncinya.
for (const k of ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']) {
  if (process.env[k]) process.env[k] = process.env[k].trim();
}

const GRAPH = () => process.env.META_GRAPH_VERSION || 'v23.0';

const PLATFORMS = {
  tiktok: {
    nama: 'TikTok',
    env: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
    scope: 'user.info.basic,user.info.stats,video.list,video.upload',
  },
  instagram: {
    nama: 'Instagram',
    env: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'],
    scope: 'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish',
  },
  facebook: {
    nama: 'Facebook',
    env: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    scope: 'pages_show_list,pages_read_engagement,read_insights,pages_manage_posts',
  },
};

const configured = (p) => !!PLATFORMS[p] && PLATFORMS[p].env.every((k) => process.env[k]);

function authUrl(platform, redirectUri, state) {
  const e = (k) => process.env[k];
  const q = (o) => new URLSearchParams(o).toString();
  if (platform === 'tiktok') {
    return 'https://www.tiktok.com/v2/auth/authorize/?' + q({ client_key: e('TIKTOK_CLIENT_KEY'), scope: PLATFORMS.tiktok.scope, response_type: 'code', redirect_uri: redirectUri, state });
  }
  if (platform === 'instagram') {
    return 'https://www.instagram.com/oauth/authorize?' + q({ client_id: e('INSTAGRAM_APP_ID'), redirect_uri: redirectUri, response_type: 'code', scope: PLATFORMS.instagram.scope, state });
  }
  return `https://www.facebook.com/${GRAPH()}/dialog/oauth?` + q({ client_id: e('FACEBOOK_APP_ID'), redirect_uri: redirectUri, response_type: 'code', scope: PLATFORMS.facebook.scope, state });
}

const inSeconds = (s) => (s ? new Date(Date.now() + Number(s) * 1000) : null);

// ---------- TikTok ----------
async function tiktokToken(params) {
  const r = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, ...params,
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const d = r.data || {};
  if (d.error) throw new Error(`TikTok: ${d.error_description || d.error}`);
  return {
    access: d.access_token, refresh: d.refresh_token, expires_at: inSeconds(d.expires_in),
    refresh_expires_at: inSeconds(d.refresh_expires_in), scope: d.scope, user_id: d.open_id,
  };
}

async function tiktokProfile(access) {
  const r = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
    headers: { Authorization: `Bearer ${access}` },
    params: { fields: 'open_id,display_name,avatar_url,follower_count,likes_count,video_count' },
  });
  const u = (r.data && r.data.data && r.data.data.user) || {};
  return { akun_id: u.open_id, nama: u.display_name || 'TikTok', avatar: u.avatar_url || null, followers: u.follower_count ?? null };
}

const tiktokPost = (v) => ({
  post_id: String(v.id), url: v.share_url || null, judul: String(v.title || v.video_description || '').slice(0, 300),
  deskripsi: v.video_description || v.title || '', tanggal: new Date(Number(v.create_time) * 1000),
  views: v.view_count ?? null, likes: v.like_count ?? null, comments: v.comment_count ?? null, shares: v.share_count ?? null,
  durasi: v.duration ?? null,
});

async function tiktokPosts(access, sejak, maxHalaman = 5) {
  const out = [];
  let cursor;
  for (let i = 0; i < maxHalaman; i++) {
    const r = await axios.post('https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,share_url,duration,view_count,like_count,comment_count,share_count',
      { max_count: 20, ...(cursor ? { cursor } : {}) }, { headers: { Authorization: `Bearer ${access}` } });
    const d = (r.data && r.data.data) || {};
    const list = (d.videos || []).map(tiktokPost);
    out.push(...list.filter((p) => p.tanggal >= sejak));
    if (!d.has_more || !list.length || list[list.length - 1].tanggal < sejak) break;
    cursor = d.cursor;
  }
  return out;
}

// ---------- Instagram ----------
async function instagramExchange(code, redirectUri) {
  const short = await axios.post('https://api.instagram.com/oauth/access_token', new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID, client_secret: process.env.INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code', redirect_uri: redirectUri, code,
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const s = short.data.data ? short.data.data[0] : short.data;
  const long = await axios.get('https://graph.instagram.com/access_token', {
    params: { grant_type: 'ig_exchange_token', client_secret: process.env.INSTAGRAM_APP_SECRET, access_token: s.access_token },
  });
  return { access: long.data.access_token, refresh: null, expires_at: inSeconds(long.data.expires_in), refresh_expires_at: null, scope: PLATFORMS.instagram.scope, user_id: String(s.user_id) };
}

// A long-lived Instagram token is renewed with itself (valid 60 days, renewable after 24 hours).
async function instagramRefresh(access) {
  const r = await axios.get('https://graph.instagram.com/refresh_access_token', { params: { grant_type: 'ig_refresh_token', access_token: access } });
  return { access: r.data.access_token, refresh: null, expires_at: inSeconds(r.data.expires_in), refresh_expires_at: null };
}

async function instagramProfile(access) {
  const r = await axios.get(`https://graph.instagram.com/${GRAPH()}/me`, { params: { fields: 'user_id,username,name,profile_picture_url,followers_count,media_count', access_token: access } });
  const u = r.data || {};
  return { akun_id: String(u.user_id || u.id), nama: u.name || u.username || 'Instagram', handle: u.username ? '@' + u.username : null, avatar: u.profile_picture_url || null, followers: u.followers_count ?? null };
}

const instagramPost = (m) => ({
  post_id: String(m.id), url: m.permalink || null, judul: String(m.caption || '').split('\n')[0].slice(0, 300), deskripsi: m.caption || '',
  tanggal: new Date(m.timestamp), views: null, likes: m.like_count ?? null, comments: m.comments_count ?? null, shares: null, durasi: null,
});

async function instagramPosts(access, sejak, maxHalaman = 4) {
  const out = [];
  let url = `https://graph.instagram.com/${GRAPH()}/me/media`;
  let params = { fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count', limit: 50, access_token: access };
  for (let i = 0; i < maxHalaman && url; i++) {
    const r = await axios.get(url, { params });
    const list = (r.data.data || []).map(instagramPost);
    out.push(...list.filter((p) => p.tanggal >= sejak));
    if (!list.length || list[list.length - 1].tanggal < sejak) break;
    url = r.data.paging && r.data.paging.next; params = undefined;
  }
  // Views per post come from the insights endpoint; a post that has none (older, or a photo) stays empty.
  for (const p of out.slice(0, 40)) {
    try {
      const r = await axios.get(`https://graph.instagram.com/${GRAPH()}/${p.post_id}/insights`, { params: { metric: 'views', access_token: access } });
      const v = (r.data.data || [])[0];
      if (v && v.values && v.values[0]) p.views = v.values[0].value;
    } catch (e) { /* no insights for this post */ }
  }
  return out;
}

// ---------- Facebook Pages ----------
async function facebookExchange(code, redirectUri) {
  const short = await axios.get(`https://graph.facebook.com/${GRAPH()}/oauth/access_token`, {
    params: { client_id: process.env.FACEBOOK_APP_ID, client_secret: process.env.FACEBOOK_APP_SECRET, redirect_uri: redirectUri, code },
  });
  const long = await axios.get(`https://graph.facebook.com/${GRAPH()}/oauth/access_token`, {
    params: { grant_type: 'fb_exchange_token', client_id: process.env.FACEBOOK_APP_ID, client_secret: process.env.FACEBOOK_APP_SECRET, fb_exchange_token: short.data.access_token },
  });
  const me = await axios.get(`https://graph.facebook.com/${GRAPH()}/me`, { params: { fields: 'id', access_token: long.data.access_token } });
  const pages = await axios.get(`https://graph.facebook.com/${GRAPH()}/me/accounts`, {
    params: { fields: 'id,name,access_token,followers_count,fan_count,picture{url}', limit: 100, access_token: long.data.access_token },
  });
  // Page tokens made from a long-lived user token do not expire, so each page is stored by itself.
  return {
    user_id: String(me.data.id), scope: PLATFORMS.facebook.scope,
    pages: (pages.data.data || []).map((p) => ({
      akun_id: String(p.id), nama: p.name, avatar: p.picture && p.picture.data ? p.picture.data.url : null,
      followers: p.followers_count ?? p.fan_count ?? null, access: p.access_token, expires_at: null,
    })),
  };
}

async function facebookProfile(pageId, access) {
  const r = await axios.get(`https://graph.facebook.com/${GRAPH()}/${pageId}`, { params: { fields: 'name,followers_count,fan_count,picture{url}', access_token: access } });
  const p = r.data || {};
  return { akun_id: String(pageId), nama: p.name || 'Facebook', avatar: p.picture && p.picture.data ? p.picture.data.url : null, followers: p.followers_count ?? p.fan_count ?? null };
}

const facebookPost = (v) => ({
  post_id: String(v.id), url: v.permalink_url ? (v.permalink_url.startsWith('http') ? v.permalink_url : 'https://www.facebook.com' + v.permalink_url) : null,
  judul: String(v.title || v.description || '').split('\n')[0].slice(0, 300), deskripsi: v.description || v.title || '',
  tanggal: new Date(v.created_time), views: v.views ?? null,
  likes: v.likes && v.likes.summary ? v.likes.summary.total_count : null,
  comments: v.comments && v.comments.summary ? v.comments.summary.total_count : null, shares: null, durasi: v.length ?? null,
});

async function facebookPosts(pageId, access, sejak, maxHalaman = 4) {
  const out = [];
  let url = `https://graph.facebook.com/${GRAPH()}/${pageId}/videos`;
  let params = { fields: 'id,title,description,created_time,permalink_url,length,views,likes.summary(true).limit(0),comments.summary(true).limit(0)', limit: 25, access_token: access };
  for (let i = 0; i < maxHalaman && url; i++) {
    const r = await axios.get(url, { params });
    const list = (r.data.data || []).map(facebookPost);
    out.push(...list.filter((p) => p.tanggal >= sejak));
    if (!list.length || list[list.length - 1].tanggal < sejak) break;
    url = r.data.paging && r.data.paging.next; params = undefined;
  }
  return out;
}

// ---------- Meta callbacks (deauthorize / data deletion) ----------
// Meta posts a "signed_request": base64url(signature).base64url(payload), signed with the app secret.
function parseSignedRequest(signed, secrets) {
  const [sig, payload] = String(signed || '').split('.');
  if (!sig || !payload) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (e) { return null; }
  const got = Buffer.from(sig, 'base64url');
  for (const secret of secrets.filter(Boolean)) {
    const want = crypto.createHmac('sha256', secret).update(payload).digest();
    if (want.length === got.length && crypto.timingSafeEqual(want, got)) return data;
  }
  return null;
}

const POSTING_SCOPE = /video\.upload|instagram_business_content_publish|pages_manage_posts/;

module.exports = {
  POSTING_SCOPE, GRAPH,
  PLATFORMS, configured, authUrl, parseSignedRequest,
  tiktok: { exchange: (code, redirectUri) => tiktokToken({ code, grant_type: 'authorization_code', redirect_uri: redirectUri }), refresh: (rt) => tiktokToken({ grant_type: 'refresh_token', refresh_token: rt }), profile: tiktokProfile, posts: tiktokPosts, post: tiktokPost },
  instagram: { exchange: instagramExchange, refresh: instagramRefresh, profile: instagramProfile, posts: instagramPosts, post: instagramPost },
  facebook: { exchange: facebookExchange, profile: facebookProfile, posts: facebookPosts, post: facebookPost },
};
