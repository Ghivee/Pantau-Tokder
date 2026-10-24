const crypto = require('crypto');

// Encryption key from environment (32 bytes for AES-256-GCM)
// In production, set ENCRYPTION_KEY in Vercel Environment Variables
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : crypto.randomBytes(32); // Fallback for development only

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

function encrypt(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

function decrypt(ciphertext) {
  if (!ciphertext) return null;
  try {
    const [ivHex, authTagHex, ciphertextHex] = ciphertext.split(':');
    if (!ivHex || !authTagHex || !ciphertextHex) {
      // Legacy plaintext - return as-is for migration
      return ciphertext;
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(ciphertextHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (e) {
    console.error('Decryption failed:', e.message);
    // If decryption fails, it might be legacy plaintext
    return ciphertext;
  }
}

function rotateKey(oldKeyHex, newKeyHex) {
  // Utility to re-encrypt all tokens with new key
  // Run as a one-time migration script
  const oldKey = Buffer.from(oldKeyHex, 'hex');
  const newKey = Buffer.from(newKeyHex, 'hex');
  
  return {
    reEncrypt: (ciphertext) => {
      if (!ciphertext) return null;
      try {
        const [ivHex, authTagHex, ciphertextHex] = ciphertext.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encrypted = Buffer.from(ciphertextHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, oldKey, iv);
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
        return encrypt(plaintext);
      } catch (e) {
        return ciphertext;
      }
    }
  };
}

module.exports = { encrypt, decrypt, rotateKey, ENCRYPTION_KEY, ALGORITHM };