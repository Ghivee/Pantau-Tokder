const db = require('../config/db');

async function getSummary() {
  // A basic mock implementation for returning dashboard numbers
  const result = await db.query(`
    SELECT 
      SUM(views) as total_views, 
      SUM(likes) as total_likes, 
      SUM(comments) as total_comments
    FROM (
      SELECT DISTINCT ON (content_id) views, likes, comments
      FROM metrics_snapshot
      ORDER BY content_id, timestamp DESC
    ) latest_metrics
  `);
  
  return result.rows[0] || { total_views: 0, total_likes: 0, total_comments: 0 };
}

async function getTrend() {
  // Stub implementation
  return { trend: [] };
}

module.exports = { getSummary, getTrend };
