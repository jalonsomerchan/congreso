import { dataConfig, dataSections, type DataSectionId } from '../config/dataConfig';

export type DataSection = (typeof dataSections)[number];
export type DataRecord = Record<string, any>;

const cache = new Map<string, Promise<any>>();

export async function fetchData(path: string) {
  const url = new URL(path, dataConfig.apiBaseUrl).href;
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return response.json();
    }));
  }

  return cache.get(url)!;
}

export async function getGlobalIndex() {
  return fetchData(`data/${dataConfig.dataFolder}/${dataConfig.groupIndexFile}`);
}

export async function getSectionIndex(sectionId: DataSectionId) {
  return fetchData(`data/${dataConfig.dataFolder}/${sectionId}/index.json`);
}

export async function getCurrentSectionRecords(sectionId: DataSectionId) {
  const global = await getGlobalIndex();
  const group = getGroups(global).find((item: any) => item.slug === dataConfig.currentGroupSlug);
  const sectionPath = group?.sections?.[sectionId]?.index_path;

  return sectionPath ? getRecordsFromPayload(await fetchData(sectionPath)) : [];
}

export async function getAllSectionRecords(sectionId: DataSectionId) {
  return getRecordsFromPayload(await getSectionIndex(sectionId));
}

export async function getRecordDetail(record: DataRecord) {
  return record.path ? fetchData(record.path).catch(() => null) : null;
}

export async function getHomeData() {
  const entries = await Promise.all(
    dataSections.map(async (section) => {
      const records = sortRecords(await getCurrentSectionRecords(section.id)).slice(0, 9);
      const withDetails = section.id === dataConfig.voteBlock ? await withRecordDetails(records) : records.map((record) => ({ record, detail: null }));
      return [section.id, withDetails] as const;
    })
  );

  return Object.fromEntries(entries) as Record<DataSectionId, Array<{ record: DataRecord; detail: any }>>;
}

export async function withRecordDetails(records: DataRecord[]) {
  return Promise.all(records.map(async (record) => ({ record, detail: await getRecordDetail(record) })));
}

export async function getDetailPaths(locale?: string) {
  const groups = await Promise.all(
    dataSections.map(async (section) => {
      const records = await getAllSectionRecords(section.id);
      const items = await withRecordDetails(sortRecords(records));
      return items.map(({ record, detail }) => ({
        params: locale ? { locale, section: section.id, id: record.id } : { section: section.id, id: record.id },
        props: { sectionId: section.id, record, detail },
      }));
    })
  );

  return groups.flat();
}

export function getGroups(payload: any) {
  return payload?.[dataConfig.groupListKey] ?? [];
}

export function getRecordsFromPayload(payload: any): DataRecord[] {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.latest_records)) return payload.latest_records;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.items)) return payload.items;
  if (payload.votes && typeof payload.votes === 'object') return Object.values(payload.votes);
  if (payload.datasets && typeof payload.datasets === 'object') return Object.values(payload.datasets);
  if (payload.resources && typeof payload.resources === 'object') return Object.values(payload.resources);
  return [];
}

export function sortRecords(records: DataRecord[]) {
  return [...records].sort((a, b) => getSortValue(b) - getSortValue(a));
}

function getSortValue(record: DataRecord) {
  const value = getRecordDate(record);
  if (!value) return 0;
  if (/^\d{8}(\d{6})?$/.test(value)) return Number(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function getRecordDate(record: DataRecord) {
  return record.date ?? record.captured_at ?? record.export_timestamp ?? record.first_seen_at ?? '';
}

export function formatDate(value: unknown, locale: string) {
  if (!value) return '—';
  const text = String(value);
  if (/^\d{8}$/.test(text)) {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(Date.UTC(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8))))
    );
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: text.includes('T') ? '2-digit' : undefined,
    minute: text.includes('T') ? '2-digit' : undefined,
  }).format(date);
}

export function formatNumber(value: unknown, locale: string) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat(locale).format(Number.isFinite(number) ? number : 0);
}

export function getRecordTitle(record: DataRecord, detail: any, fallback = '') {
  const info = detail?.data?.informacion ?? detail?.informacion;
  return info?.textoSubGrupo || info?.tituloSubGrupo || info?.titulo || record.official_name || record.official_filename || humanizeId(record.id) || fallback;
}

export function getRecordDescription(record: DataRecord, detail: any) {
  const info = detail?.data?.informacion ?? detail?.informacion;
  return info?.textoExpediente || info?.tituloSubGrupo || info?.titulo || record.official_filename || record.source_url || record.path || '';
}

export function getVoteTotals(detail: any) {
  const totals = detail?.data?.totales ?? detail?.totales;
  if (totals) {
    return {
      yes: totals.afavor ?? totals.aFavor ?? totals.si ?? 0,
      no: totals.enContra ?? totals.no ?? 0,
      abstentions: totals.abstenciones ?? 0,
      absent: totals.noVotan ?? totals.ausentes ?? 0,
      present: totals.presentes ?? 0,
    };
  }

  const votes = detail?.data?.votaciones ?? detail?.votaciones;
  if (!Array.isArray(votes)) return null;

  return votes.reduce(
    (total, item) => {
      const value = normalizeVote(item.voto);
      if (value === 'yes') total.yes += 1;
      else if (value === 'no') total.no += 1;
      else if (value === 'abstentions') total.abstentions += 1;
      else total.absent += 1;
      return total;
    },
    { yes: 0, no: 0, abstentions: 0, absent: 0, present: votes.length }
  );
}

export function getVotesByGroup(detail: any) {
  const votes = detail?.data?.votaciones ?? detail?.votaciones;
  if (!Array.isArray(votes)) return [];
  const groups = new Map<string, { yes: number; no: number; abstentions: number; absent: number }>();

  votes.forEach((vote) => {
    const group = vote.grupo || '—';
    const current = groups.get(group) ?? { yes: 0, no: 0, abstentions: 0, absent: 0 };
    const value = normalizeVote(vote.voto);
    if (value === 'yes') current.yes += 1;
    else if (value === 'no') current.no += 1;
    else if (value === 'abstentions') current.abstentions += 1;
    else current.absent += 1;
    groups.set(group, current);
  });

  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

function normalizeVote(value: unknown) {
  const vote = String(value ?? '').trim().toLocaleLowerCase('es');
  if (vote === 'sí' || vote === 'si' || vote === 'a favor' || vote === 'afavor') return 'yes';
  if (vote === 'no' || vote === 'en contra') return 'no';
  if (vote.startsWith('abst')) return 'abstentions';
  return 'absent';
}

function humanizeId(value: unknown) {
  return String(value ?? '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase('es'))
    .trim();
}
