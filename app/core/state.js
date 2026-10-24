// app/core/state.js - Centralized state management
import { today } from './utils.js';

export const S = {
  editors: [],
  content: [],
  aktivitas: [],
  channels: [],
  daily: [],
  goal: null,
  scan: null,
  oauth: null,
  anPeriode: 28,
  error: null,
  warnings: [],
  loadedAt: null,
  session: null,
  periode: 7,
  channel: 'all',
  day: null,
  konten: { q: '', channel: 'all', editor: 'all', tipe: 'all', periode: '30', sort: 'tanggal', dir: 'desc', page: 1 },
  sel: new Set(),
  cache: new Map(),
  connected: new Set(),
  medians: {},
};

export function getState() {
  return S;
}

export function setSession(session) {
  S.session = session;
}

export function clearSession() {
  S.session = null;
}

export function isAdmin() {
  return S.session && S.session.type === 'admin';
}

export function me(editorById) {
  return (S.session && S.session.type === 'karyawan' ? S.editors.find((e) => e.id === S.session.id) || null : null);
}

export function canLog(editorById) {
  return isAdmin() || !!me(editorById);
}

export function canAssign(editorById) {
  return isAdmin() || (me(editorById) && (me(editorById).peran || 'editor') === 'editor');
}