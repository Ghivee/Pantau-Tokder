const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

module.exports = { escapeHtml };
