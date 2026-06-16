import {
  byGroupNumber,
  escapeHtml,
  formatDate,
  formatNumber,
  getBlockTotal,
  getRecordDate,
  getRecordsFromPayload,
  getRecordDescription,
  getRecordTitle,
  getVoteTotals,
  truncate,
} from './data-utils.js';

const root = document.querySelector('[data-open-dashboard]');
const configNode = document.getElementById('open-dashboard-config');

if (root && configNode?.textContent) {
  const config = JSON.parse(configNode.textContent);
  const state = { config, global: null, indexes: {}, selectedGroup: config.currentGroupSlug, activeSection: 'all', records: [], query: '' };
  const ui = {
    status: root.querySelector('[data-status]'),
    statusDot: root.querySelector('[data-status-dot]'),
    metrics: root.querySelector('[data-summary-metrics]'),
    select: root.querySelector('[data-group-select]'),
    search: root.querySelector('[data-search]'),
    filters: root.querySelector('[data-section-filters]'),
    blocks: root.querySelector('[data-blocks]'),
    history: root.querySelector('[data-history]'),
    records: root.querySelector('[data-records]'),
    insight: root.querySelector('[data-insight]'),
  };
  init(state, ui).catch((error) => {
    setStatus(ui, config.copy.error, 'error');
    if (ui.records) ui.records.innerHTML = `<article class="dashboard__record"><h3>${escapeHtml(config.copy.error)}</h3><p>${escapeHtml(error.message)}</p></article>`;
  });
}

async function init(state, ui) {
  const { config } = state;
  setStatus(ui, config.copy.loading);
  state.global = await fetchJson(config, `data/${config.dataFolder}/${config.groupIndexFile}`);
  state.selectedGroup = chooseInitialGroup(state.global, config.currentGroupSlug);
  renderControls(state, ui);
  renderHistory(state, ui);
  const indexEntries = await Promise.all(config.blocks.map(async (block) => [block, await fetchJson(config, `data/${config.dataFolder}/${block}/index.json`)]));
  state.indexes = Object.fromEntries(indexEntries);
  renderSummary(state, ui);
  renderBlocks(state, ui);
  await loadGroupRecords(state, ui);
  setStatus(ui, config.copy.ready, 'ready');
}

async function loadGroupRecords(state, ui) {
  const group = findGroup(state.global, state.selectedGroup);
  const sections = Object.entries(group?.sections ?? {});
  const recordsByBlock = await Promise.all(sections.map(async ([block, section]) => {
    if (!section.latest_path) return [];
    try {
      const payload = await fetchJson(state.config, section.latest_path);
      return getRecordsFromPayload(payload).map((record) => ({ ...record, block }));
    } catch { return []; }
  }));
  const records = recordsByBlock.flat().slice(0, 36);
  state.records = await enhanceVoteRecords(state.config, records);
  renderSummary(state, ui);
  renderBlocks(state, ui);
  renderRecords(state, ui);
  renderInsight(state, ui);
}

async function enhanceVoteRecords(config, records) {
  const detailCandidates = records.filter((record) => record.block === config.voteBlock && record.path).slice(0, 9);
  const details = await Promise.all(detailCandidates.map(async (record) => {
    try { return [record.id, await fetchJson(config, record.path)]; }
    catch { return [record.id, null]; }
  }));
  const detailMap = new Map(details);
  return records.map((record) => ({ ...record, detail: detailMap.get(record.id) ?? null }));
}

async function fetchJson(config, relativePath) {
  const url = new URL(relativePath, config.apiBaseUrl).href;
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function getGroups(payload, config) {
  return payload?.[config.groupListKey] ?? [];
}

function chooseInitialGroup(payload, preferredSlug) {
  const groups = getGroups(payload, { groupListKey: String.fromCharCode(108, 101, 103, 105, 115, 108, 97, 116, 117, 114, 101, 115) });
  return groups.find((item) => item.slug === preferredSlug)?.slug ?? [...groups].sort(byGroupNumber).at(-1)?.slug ?? preferredSlug;
}

function findGroup(payload, slug) {
  const key = String.fromCharCode(108, 101, 103, 105, 115, 108, 97, 116, 117, 114, 101, 115);
  return payload?.[key]?.find((group) => group.slug === slug);
}

function setStatus(ui, message, state = 'loading') {
  if (ui.status) ui.status.textContent = message;
  if (ui.statusDot) ui.statusDot.dataset.state = state;
}

function renderControls(state, ui) {
  const groups = [...getGroups(state.global, state.config)].sort(byGroupNumber).reverse();
  if (ui.select) {
    ui.select.innerHTML = groups.map((group) => {
      const selected = group.slug === state.selectedGroup ? 'selected' : '';
      const badge = group.slug === state.config.currentGroupSlug ? ` · ${state.config.copy.currentBadge}` : '';
      return `<option value="${escapeHtml(group.slug)}" ${selected}>${escapeHtml(group.id)} · ${formatNumber(group.total_records)} ${escapeHtml(state.config.copy.records)}${escapeHtml(badge)}</option>`;
    }).join('');
    ui.select.addEventListener('change', () => { state.selectedGroup = ui.select.value; loadGroupRecords(state, ui); });
  }
  if (ui.search) ui.search.addEventListener('input', () => { state.query = ui.search.value.trim().toLocaleLowerCase('es'); renderRecords(state, ui); });
  if (ui.filters) {
    ui.filters.innerHTML = [['all', state.config.copy.allSections], ...state.config.blocks.map((block) => [block, state.config.copy.blockLabels[block]])]
      .map(([block, label]) => `<button class="dashboard__chip" type="button" data-section="${block}" aria-pressed="${block === state.activeSection}">${escapeHtml(label)}</button>`).join('');
    ui.filters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-section]');
      if (!button) return;
      state.activeSection = button.dataset.section;
      ui.filters.querySelectorAll('[data-section]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      renderRecords(state, ui);
    });
  }
}

function renderSummary(state, ui) {
  const group = findGroup(state.global, state.selectedGroup);
  const values = [
    formatNumber(group?.total_records ?? 0),
    formatNumber((state.global?.sections ?? []).reduce((sum, section) => sum + (section.total_records ?? 0), 0)),
    formatNumber(state.global?.total_legislatures ?? getGroups(state.global, state.config).length),
    formatDate(state.global?.generated_at),
  ];
  ui.metrics?.querySelectorAll('[data-metric-value]').forEach((node, index) => { node.textContent = values[index] ?? '—'; });
}

function renderBlocks(state, ui) {
  const group = findGroup(state.global, state.selectedGroup);
  if (!ui.blocks) return;
  ui.blocks.innerHTML = state.config.blocks.map((block) => {
    const globalSection = (state.global?.sections ?? []).find((section) => section.section === block);
    const currentSection = group?.sections?.[block];
    const total = currentSection?.total_records ?? 0;
    const globalTotal = globalSection?.total_records ?? getBlockTotal(state.indexes[block]);
    const years = globalSection?.years?.length ?? 0;
    const groups = globalSection?.[state.config.groupListKey]?.length ?? 0;
    return `<article class="dashboard__block"><h3>${escapeHtml(state.config.copy.blockLabels[block])}</h3><p>${escapeHtml(state.config.copy.updated)} ${escapeHtml(formatDate(state.indexes[block]?.generated_at))}</p><div class="dashboard__mini-grid">${miniStat(state.config.copy.currentBadge, total)}${miniStat(state.config.copy.records, globalTotal)}${miniStat(state.config.copy.selectGroup, groups)}${miniStat(state.config.copy.years, years)}</div></article>`;
  }).join('');
}

function renderHistory(state, ui) {
  const groups = [...getGroups(state.global, state.config)].filter((item) => item.total_records > 0).sort(byGroupNumber);
  const max = Math.max(...groups.map((item) => item.total_records), 1);
  if (!ui.history) return;
  ui.history.innerHTML = groups.map((group) => `<div class="dashboard__bar"><div class="dashboard__bar-label"><span>${escapeHtml(group.id)}</span><strong>${formatNumber(group.total_records)}</strong></div><div class="dashboard__bar-track"><div class="dashboard__bar-fill" style="width:${Math.max(4, (group.total_records / max) * 100)}%"></div></div></div>`).join('');
}

function renderRecords(state, ui) {
  if (!ui.records) return;
  const query = state.query;
  const filtered = state.records.filter((record) => {
    if (state.activeSection !== 'all' && record.block !== state.activeSection) return false;
    if (!query) return true;
    return `${getRecordTitle(record, record.detail, '')} ${getRecordDescription(record, record.detail)} ${record.id ?? ''}`.toLocaleLowerCase('es').includes(query);
  });
  if (filtered.length === 0) { ui.records.innerHTML = `<article class="dashboard__record"><h3>${escapeHtml(state.config.copy.noResults)}</h3><p>${escapeHtml(state.config.copy.noData)}</p></article>`; return; }
  ui.records.innerHTML = filtered.map((record) => renderRecord(record, state.config)).join('');
}

function renderRecord(record, config) {
  const blockLabel = config.copy.blockLabels[record.block] ?? record.block;
  const title = truncate(getRecordTitle(record, record.detail, blockLabel), 120);
  const description = truncate(getRecordDescription(record, record.detail), 210);
  const totals = getVoteTotals(record.detail);
  return `<article class="dashboard__record"><span class="dashboard__record-meta">${escapeHtml(blockLabel)} · ${escapeHtml(formatDate(getRecordDate(record)))}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${totals ? renderVoteTotals(totals, config) : ''}${record.source_url ? `<a href="${escapeHtml(record.source_url)}">${escapeHtml(config.copy.viewSource)}</a>` : ''}</article>`;
}

function renderVoteTotals(totals, config) {
  return `<div class="dashboard__vote-grid">${miniStat(config.copy.voteYes, totals.yes, 'dashboard__vote-stat')}${miniStat(config.copy.voteNo, totals.no, 'dashboard__vote-stat')}${miniStat(config.copy.abstentions, totals.abstentions, 'dashboard__vote-stat')}${miniStat(config.copy.absent, totals.absent, 'dashboard__vote-stat')}</div>`;
}

function renderInsight(state, ui) {
  const group = findGroup(state.global, state.selectedGroup);
  if (!ui.insight || !group) return;
  const topBlock = Object.entries(group.sections ?? {}).sort((a, b) => (b[1]?.total_records ?? 0) - (a[1]?.total_records ?? 0))[0];
  ui.insight.querySelector('strong').textContent = group.id;
  ui.insight.querySelector('span').textContent = topBlock ? `${state.config.copy.blockLabels[topBlock[0]]}: ${formatNumber(topBlock[1].total_records)} ${state.config.copy.records}.` : state.config.copy.noData;
}

function miniStat(label, value, className = 'dashboard__mini-stat') {
  return `<div class="${className}"><span>${escapeHtml(label)}</span><strong>${formatNumber(value)}</strong></div>`;
}
