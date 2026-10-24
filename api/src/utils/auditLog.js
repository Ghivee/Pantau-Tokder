const db = require('../config/db');

async function ensureAuditTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_type TEXT NOT NULL, -- 'admin' | 'editor'
      actor_id INTEGER,
      actor_nama TEXT,
      ip TEXT,
      user_agent TEXT,
      action TEXT NOT NULL,
      target_type TEXT, -- 'editor', 'channel', 'content', 'aktivitas', 'auth', 'settings'
      target_id TEXT,
      before_json JSONB,
      after_json JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_type, actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
  `);
}

async function logAudit({ actorType, actorId, actorNama, ip, userAgent, action, targetType, targetId, before, after }) {
  try {
    await ensureAuditTable();
    await db.query(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_nama, ip, user_agent, action, target_type, target_id, before_json, after_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        actorType,
        actorId,
        actorNama,
        ip,
        userAgent,
        action,
        targetType,
        targetId,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null
      ]
    );
  } catch (e) {
    console.error('Audit log failed:', e.message);
    // Don't throw - audit logging should never break the main operation
  }
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.headers['x-real-ip'] 
    || req.socket?.remoteAddress 
    || 'unknown';
}

function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

function createAuditMiddleware(targetType, action, getTargetId = () => null, getBefore = () => null, getAfter = () => null) {
  return async (req, res, next) => {
    const originalSend = res.send;
    let responseBody = null;
    
    res.send = function(body) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    const originalJson = res.json;
    res.json = function(data) {
      responseBody = data;
      return originalJson.call(this, data);
    };

    // Capture before state if getter provided
    const before = getBefore ? getBefore(req) : null;

    // Wait for response
    res.on('finish', async () => {
      try {
        // Only log on success (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const after = getAfter ? getAfter(req, responseBody) : null;
          await logAudit({
            actorType: req.isAdmin ? 'admin' : (req.editor ? 'editor' : 'unknown'),
            actorId: req.isAdmin ? null : (req.editor?.id || null),
            actorNama: req.isAdmin ? 'Pemilik' : (req.editor?.nama || 'Unknown'),
            ip: getClientIp(req),
            userAgent: getUserAgent(req),
            action,
            targetType,
            targetId: getTargetId ? getTargetId(req, responseBody) : null,
            before,
            after
          });
        }
      } catch (e) {
        console.error('Audit log on finish failed:', e.message);
      }
    });

    next();
  };
}

async function getAuditLogs({ actorType, actorId, targetType, targetId, action, from, to, limit = 100, offset = 0 }) {
  await ensureAuditTable();
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (actorType) { conditions.push(`actor_type = $${paramIdx++}`); params.push(actorType); }
  if (actorId) { conditions.push(`actor_id = $${paramIdx++}`); params.push(actorId); }
  if (targetType) { conditions.push(`target_type = $${paramIdx++}`); params.push(targetType); }
  if (targetId) { conditions.push(`target_id = $${paramIdx++}`); params.push(targetId); }
  if (action) { conditions.push(`action = $${paramIdx++}`); params.push(action); }
  if (from) { conditions.push(`created_at >= $${paramIdx++}`); params.push(from); }
  if (to) { conditions.push(`created_at <= $${paramIdx++}`); params.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const query = `
    SELECT id, actor_type, actor_id, actor_nama, action, target_type, target_id, before_json, after_json, created_at
    FROM audit_logs
    ${where}
    ORDER BY created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx}
  `;
  
  const result = await db.query(query, params);
  return result.rows;
}

module.exports = {
  logAudit,
  getAuditLogs,
  createAuditMiddleware,
  getClientIp,
  getUserAgent,
  ensureAuditTable
};