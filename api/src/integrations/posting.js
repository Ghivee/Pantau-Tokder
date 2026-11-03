const axios = require('axios');
const { GRAPH } = require('./sosmed');

// Sending one video to TikTok, Instagram, Facebook and YouTube. Nothing goes public by itself:
// each platform first keeps the video as a draft, and the owner presses "Tayangkan".
//  - TikTok: inbox upload. TikTok pulls the video from our verified address and puts it in the
//    owner's TikTok app as a draft; the caption and the final Post button are done in the app.
//  - Instagram: a Reels container is prepared; publishing it is the "Tayangkan" step (a prepared
//    container lasts 24 hours).
//  - Facebook: an unpublished page video; "Tayangkan" publishes it.
//  - YouTube: uploaded as private by a GitHub Actions job (it needs the whole file, which a Vercel
//    function cannot carry); the owner makes it public in YouTube Studio.

const err = (e) => {
  const d = e.response && e.response.data;
  const m = d && ((d.error && (d.error.message || d.error.description || d.error.code)) || d.message || d.error_description);
  return new Error(String(m || e.message).slice(0, 300));
};

// ---------- TikTok ----------
async function tiktokDraf(access, videoUrl) {
  try {
    const r = await axios.post('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
      { source_info: { source: 'PULL_FROM_URL', video_url: videoUrl } }, { headers: { Authorization: `Bearer ${access}` } });
    const e = r.data && r.data.error;
    if (e && e.code && e.code !== 'ok') throw new Error(e.message || e.code);
    return { ref: r.data.data.publish_id };
  } catch (e) { throw err(e); }
}

// PROCESSING_* → still working; SEND_TO_USER_INBOX → the draft is in the TikTok app; FAILED → see reason.
async function tiktokStatus(access, publishId) {
  try {
    const r = await axios.post('https://open.tiktokapis.com/v2/post/publish/status/fetch/', { publish_id: publishId }, { headers: { Authorization: `Bearer ${access}` } });
    const d = (r.data && r.data.data) || {};
    if (d.status === 'FAILED') return { status: 'gagal', galat: d.fail_reason || 'TikTok menolak video' };
    if (d.status === 'SEND_TO_USER_INBOX') return { status: 'di-app' };
    if (d.status === 'PUBLISH_COMPLETE') return { status: 'tayang' };
    return { status: 'diproses' };
  } catch (e) { throw err(e); }
}

// ---------- Instagram ----------
async function instagramSiapkan(access, videoUrl, caption) {
  try {
    const r = await axios.post(`https://graph.instagram.com/${GRAPH()}/me/media`, null, {
      params: { media_type: 'REELS', video_url: videoUrl, caption: String(caption || '').slice(0, 2200), share_to_feed: true, access_token: access },
    });
    return { ref: r.data.id };
  } catch (e) { throw err(e); }
}

async function instagramStatus(access, containerId) {
  try {
    const r = await axios.get(`https://graph.instagram.com/${GRAPH()}/${containerId}`, { params: { fields: 'status_code,status', access_token: access } });
    const c = r.data.status_code;
    if (c === 'FINISHED') return { status: 'siap' };
    if (c === 'PUBLISHED') return { status: 'tayang' };
    if (c === 'ERROR' || c === 'EXPIRED') return { status: 'gagal', galat: r.data.status || (c === 'EXPIRED' ? 'Persiapan kedaluwarsa (24 jam), unggah ulang' : 'Instagram menolak video') };
    return { status: 'diproses' };
  } catch (e) { throw err(e); }
}

async function instagramTayang(access, containerId) {
  try {
    const r = await axios.post(`https://graph.instagram.com/${GRAPH()}/me/media_publish`, null, { params: { creation_id: containerId, access_token: access } });
    let url = null;
    try { url = (await axios.get(`https://graph.instagram.com/${GRAPH()}/${r.data.id}`, { params: { fields: 'permalink', access_token: access } })).data.permalink || null; } catch (e) { /* link is a bonus */ }
    return { url };
  } catch (e) { throw err(e); }
}

// ---------- Facebook ----------
async function facebookSiapkan(pageId, token, videoUrl, judul, deskripsi) {
  try {
    const r = await axios.post(`https://graph.facebook.com/${GRAPH()}/${pageId}/videos`, null, {
      params: { file_url: videoUrl, title: judul, description: deskripsi || '', published: false, access_token: token },
    });
    return { ref: r.data.id };
  } catch (e) { throw err(e); }
}

async function facebookStatus(token, videoId) {
  try {
    const r = await axios.get(`https://graph.facebook.com/${GRAPH()}/${videoId}`, { params: { fields: 'status,published,permalink_url', access_token: token } });
    const v = (r.data.status && r.data.status.video_status) || '';
    if (v === 'error') return { status: 'gagal', galat: 'Facebook menolak video' };
    if (r.data.published === true) return { status: 'tayang', url: r.data.permalink_url ? 'https://www.facebook.com' + r.data.permalink_url : null };
    return { status: v === 'ready' ? 'siap' : 'diproses' };
  } catch (e) { throw err(e); }
}

async function facebookTayang(token, videoId) {
  try {
    await axios.post(`https://graph.facebook.com/${GRAPH()}/${videoId}`, null, { params: { published: true, access_token: token } });
    return facebookStatus(token, videoId);
  } catch (e) { throw err(e); }
}

module.exports = { tiktokDraf, tiktokStatus, instagramSiapkan, instagramStatus, instagramTayang, facebookSiapkan, facebookStatus, facebookTayang };
