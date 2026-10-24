const express = require('express');
const router = express.Router();

// POST /api/csp-report — Collect CSP violation reports
router.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body?.['csp-report'] || req.body;
  if (report) {
    console.warn('CSP Violation:', {
      'blocked-uri': report['blocked-uri'],
      'document-uri': report['document-uri'],
      'violated-directive': report['violated-directive'],
      'original-policy': report['original-policy'],
      'script-sample': report['script-sample'],
      'line-number': report['line-number'],
      'column-number': report['column-number'],
      'source-file': report['source-file']
    });
  }
  res.status(204).send();
});

module.exports = router;