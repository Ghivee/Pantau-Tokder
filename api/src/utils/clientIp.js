// The caller's public IP. On Vercel the edge overwrites these headers with the real address,
// so they cannot be faked by the browser; anywhere else only the socket address is trusted.
function clientIp(req) {
  let ip = '';
  if (process.env.VERCEL) {
    ip = req.headers['x-real-ip'] || String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || '').split(',')[0];
  }
  ip = String(ip || (req.socket && req.socket.remoteAddress) || '').trim();
  return ip.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, '$1') || 'unknown';
}

module.exports = { clientIp };
