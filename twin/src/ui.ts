export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}`)

import { LANG } from './i18n'

/** Modo presentación (?video=1): tomas limpias para el video y el pitch. */
export const VIDEO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('video')

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(LANG === 'en' ? 'en-US' : 'es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
