const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getAuthUrl, exchangeCodeForTokens } = require('../integrations/analytics');

// GET /api/auth/google — Redirect user to Google OAuth consent screen
router.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({ 
      error: 'GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diatur di Vercel Environment Variables.' 
    });
  }
  
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'pantautokder.vercel.app';
  const redirectUri = `${protocol}://${host}/api/auth/callback`;
  
  const url = getAuthUrl(redirectUri);
  res.redirect(url);
});

// GET /api/auth/callback — Google redirects here after user grants access
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.send(`<html><body style="font-family:sans-serif; padding:40px; text-align:center;">
      <h2>❌ Akses Ditolak</h2>
      <p>${error}</p>
      <a href="/">Kembali ke Dashboard</a>
    </body></html>`);
  }

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'pantautokder.vercel.app';
    const redirectUri = `${protocol}://${host}/api/auth/callback`;

    const tokens = await exchangeCodeForTokens(code, redirectUri);
    
    // Store refresh_token in database settings table
    if (tokens.refresh_token) {
      await db.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        ['google_refresh_token', tokens.refresh_token]
      );
    }

    // Also store access_token for immediate use
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['google_access_token', tokens.access_token]
    );

    return res.send(`<html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif; padding:40px; text-align:center; background:#0f0f0f; color:white;">
      <div style="max-width:500px; margin:0 auto; padding:40px; background:#1a1a1a; border-radius:16px; border:1px solid #333;">
        <div style="font-size:48px; margin-bottom:16px;">✅</div>
        <h2 style="color:#20C997; margin-bottom:8px;">YouTube Analytics Terhubung!</h2>
        <p style="color:#aaa;">Token OAuth berhasil disimpan. Sistem sekarang dapat mengambil data retensi asli dari YouTube Analytics Anda.</p>
        <p style="color:#aaa; margin-top:16px;">Kembali ke dashboard dan tekan <strong>"Sinkronkan Sekarang"</strong> untuk memperbarui data retensi semua video.</p>
        <a href="/" style="display:inline-block; margin-top:24px; padding:12px 24px; background:#20C997; color:white; border-radius:8px; text-decoration:none; font-weight:600;">Kembali ke Dashboard</a>
      </div>
    </body></html>`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.status(500).send(`<html><body style="font-family:sans-serif; padding:40px; text-align:center;">
      <h2>❌ Gagal menyimpan token</h2>
      <p>${err.message}</p>
      <a href="/">Kembali ke Dashboard</a>
    </body></html>`);
  }
});

// GET /api/auth/status — Check if OAuth is connected
router.get('/status', async (req, res) => {
  try {
    const result = await db.query(`SELECT value FROM settings WHERE key = 'google_refresh_token'`);
    const isConnected = result.rows.length > 0 && !!result.rows[0].value;
    res.json({ 
      connected: isConnected,
      message: isConnected ? 'YouTube Analytics terhubung ✅' : 'Belum terhubung ❌'
    });
  } catch (err) {
    res.json({ connected: false, message: 'Tidak dapat memeriksa status: ' + err.message });
  }
});

module.exports = router;
