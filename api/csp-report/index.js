export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
  return res.status(204).send();
}