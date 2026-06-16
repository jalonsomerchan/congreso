function getPageLocale() {
  return document.documentElement.lang === 'en' ? 'en-GB' : 'es-ES';
}

export function formatNumber(value) {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat(getPageLocale()).format(Number.isFinite(numericValue) ? numericValue : 0);
}

export function formatDate(value) {
  if (!value) return '—';
  if (/^\d{8}$/.test(value)) {
    const parsed = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8))));
    return new Intl.DateTimeFormat(getPageLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(getPageLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: value.includes('T') ? '2-digit' : undefined,
    minute: value.includes('T') ? '2-digit' : undefined,
  }).format(date);
}

export function byGroupNumber(a, b) {
  return getGroupNumber(a.id) - getGroupNumber(b.id);
}

function getGroupNumber(id) {
  const match = String(id ?? '').match(/\d+/);
  return match ? Number(match[0]) : -1;
}

export function getRecordsFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.latest_records)) return payload.latest_records;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.items)) return payload.items;
  if (payload.votes && typeof payload.votes === 'object') return Object.values(payload.votes);
  if (payload.datasets && typeof payload.datasets === 'object') return Object.values(payload.datasets);
  if (payload.resources && typeof payload.resources === 'object') return Object.values(payload.resources);
  return [];
}

export function getBlockTotal(payload) {
  if (!payload) return 0;
  if (typeof payload.total_records === 'number') return payload.total_records;
  if (typeof payload.total_votes === 'number') return payload.total_votes;
  if (typeof payload.total_datasets === 'number') return payload.total_datasets;
  return getRecordsFromPayload(payload).length;
}

export function getRecordDate(record) {
  return record.date ?? record.captured_at ?? record.export_timestamp ?? record.first_seen_at ?? '';
}

export function getRecordTitle(record, detail, fallback) {
  const info = detail?.data?.informacion;
  return info?.textoSubGrupo || info?.tituloSubGrupo || info?.titulo || record.official_name || record.official_filename || record.id || fallback;
}

export function getRecordDescription(record, detail) {
  const info = detail?.data?.informacion;
  return info?.textoExpediente || info?.titulo || record.source_url || record.path || '';
}

export function getVoteTotals(detail) {
  const totals = detail?.data?.totales;
  if (!totals) return null;
  return { yes: totals.afavor ?? 0, no: totals.enContra ?? 0, abstentions: totals.abstenciones ?? 0, absent: totals.noVotan ?? 0 };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function truncate(value, length = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1).trim()}…`;
}
