const crypto = require('crypto');

// Google refresh tokens are stored encrypted (AES-256-GCM). The key must stay the same across
// serverless restarts, so it is never random: ENCRYPTION_KEY (64 hex characters) when set,
// otherwise derived from GOOGLE_CLIENT_SECRET, which every deployment that can connect
// YouTube Analytics already has.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function keyFrom(env = process.env) {
  const k = env.ENCRYPTION_KEY;
  if (k && /^[0-9a-f]{64}$/i.test(k)) return Buffer.from(k, 'hex');
  const material = k || env.GOOGLE_CLIENT_SECRET;
  return material ? crypto.createHash('sha256').update('pantau-tokder:' + material).digest() : null;
}

const FORMAT = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;
const isEncrypted = (v) => FORMAT.test(String(v || ''));

function encrypt(plaintext, key = keyFrom()) {
  if (!plaintext) return null;
  if (!key) return String(plaintext);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext.toString('hex')}`;
}

// Returns the plain value; a token saved before encryption existed comes back as is.
// Throws when an encrypted value cannot be read (the key changed): the channel must be reconnected.
function decrypt(value, key = keyFrom()) {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  if (!key) throw new Error('Kunci enkripsi tidak ada (isi ENCRYPTION_KEY atau GOOGLE_CLIENT_SECRET)');
  const [ivHex, tagHex, ctHex] = value.split(':');
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
  } catch (e) {
    throw new Error('Token tersimpan tidak bisa dibuka (kunci enkripsi berubah). Hubungkan ulang channel ini di Pengaturan.');
  }
}

// Short signature for links that must work without a login (the video link TikTok pulls from).
function sign(text, key = keyFrom()) {
  if (!key) throw new Error('Kunci enkripsi tidak ada (isi ENCRYPTION_KEY atau GOOGLE_CLIENT_SECRET)');
  return crypto.createHmac('sha256', key).update('media:' + String(text)).digest('base64url').slice(0, 32);
}

module.exports = { encrypt, decrypt, isEncrypted, keyFrom, sign };
