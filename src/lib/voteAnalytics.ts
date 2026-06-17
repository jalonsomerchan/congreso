import { dataConfig } from '../config/dataConfig';
import {
  getAllSectionRecords,
  getRecordDate,
  getRecordDetail,
  getRecordTitle,
  getVoteTotals,
  getVotesByDeputy,
  isVoteApproved,
  sortRecords,
  type DataRecord,
  type VoteDeputy,
  type VoteTotals,
  type VoteType,
} from './congressData';

export type VoteAnalyticsRecord = {
  record: DataRecord;
  detail: any;
  id: string;
  title: string;
  date: string;
  legislature: string;
  approved: boolean;
  totals: VoteTotals;
};

export type DeputyVote = VoteDeputy & {
  voteId: string;
  title: string;
  date: string;
  legislature: string;
  approved: boolean;
};

export type VoteCountSet = Record<VoteType, number>;

export type DeputyStats = {
  slug: string;
  name: string;
  group: string;
  votes: DeputyVote[];
  counts: VoteCountSet;
  participationRate: number;
  telematicVotes: number;
};

export type GroupStats = {
  group: string;
  counts: VoteCountSet;
  total: number;
  abstentionRate: number;
  noRate: number;
};

export type LegislatureStats = {
  legislature: string;
  votes: VoteAnalyticsRecord[];
  voteCount: number;
  approvedCount: number;
  rejectedCount: number;
  totals: VoteCountSet;
  groups: GroupStats[];
  deputies: DeputyStats[];
};

export type VoteAnalytics = {
  votes: VoteAnalyticsRecord[];
  deputies: DeputyStats[];
  legislatures: LegislatureStats[];
};

const emptyCounts = (): VoteCountSet => ({ yes: 0, no: 0, abstentions: 0, absent: 0 });
const analyticsCache = new Map<string, Promise<VoteAnalytics>>();

export function getDeputySlug(name: string) {
  return normalizeForSlug(name) || 'diputado';
}

export async function getVoteAnalytics() {
  const cacheKey = dataConfig.voteBlock;
  if (!analyticsCache.has(cacheKey)) {
    analyticsCache.set(cacheKey, loadVoteAnalytics());
  }

  return analyticsCache.get(cacheKey)!;
}

export async function getDeputyPaths(locale?: string) {
  const analytics = await getVoteAnalytics();
  return analytics.deputies.map((deputy) => ({
    params: locale ? { locale, slug: deputy.slug } : { slug: deputy.slug },
    props: { deputy },
  }));
}

export async function getLegislatureStatsPaths(locale?: string) {
  const analytics = await getVoteAnalytics();
  return analytics.legislatures.map((stats) => ({
    params: locale ? { locale, legislature: stats.legislature } : { legislature: stats.legislature },
    props: { stats },
  }));
}

async function loadVoteAnalytics() {
  const records = sortRecords(await getAllSectionRecords(dataConfig.voteBlock));
  const votes = await Promise.all(records.map(toAnalyticsRecord));
  const deputies = buildDeputyStats(votes);
  const legislatures = buildLegislatureStats(votes, deputies);

  return {
    votes,
    deputies,
    legislatures,
  };
}

async function toAnalyticsRecord(record: DataRecord): Promise<VoteAnalyticsRecord> {
  const detail = await getRecordDetail(record);
  const totals = getVoteTotals(detail) ?? { yes: 0, no: 0, abstentions: 0, absent: 0, present: 0 };

  return {
    record,
    detail,
    id: String(record.id),
    title: getRecordTitle(record, detail, String(record.id)),
    date: getRecordDate(record),
    legislature: String(record.legislature ?? record.grouping?.legislatures?.[0] ?? dataConfig.currentGroupId),
    approved: isVoteApproved(detail),
    totals,
  };
}

function buildDeputyStats(votes: VoteAnalyticsRecord[]) {
  const deputies = new Map<string, DeputyStats>();

  votes.forEach((vote) => {
    getVotesByDeputy(vote.detail).forEach((item) => {
      const name = item.deputy || '—';
      const slug = getDeputySlug(name);
      const current = deputies.get(slug) ?? {
        slug,
        name,
        group: item.group || '—',
        votes: [],
        counts: emptyCounts(),
        participationRate: 0,
        telematicVotes: 0,
      };

      current.group = item.group || current.group;
      current.votes.push({
        ...item,
        voteId: vote.id,
        title: vote.title,
        date: vote.date,
        legislature: vote.legislature,
        approved: vote.approved,
      });
      current.counts[item.voteType] += 1;
      if (item.seat === '-1') current.telematicVotes += 1;
      deputies.set(slug, current);
    });
  });

  return [...deputies.values()]
    .map((deputy) => ({
      ...deputy,
      votes: deputy.votes.sort((a, b) => b.date.localeCompare(a.date)),
      participationRate: deputy.votes.length === 0 ? 0 : (deputy.votes.length - deputy.counts.absent) / deputy.votes.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function buildLegislatureStats(votes: VoteAnalyticsRecord[], allDeputies: DeputyStats[]) {
  const legislatures = new Map<string, VoteAnalyticsRecord[]>();
  votes.forEach((vote) => {
    const current = legislatures.get(vote.legislature) ?? [];
    current.push(vote);
    legislatures.set(vote.legislature, current);
  });

  return [...legislatures.entries()]
    .map(([legislature, legislatureVotes]) => {
      const deputies = buildDeputyStats(legislatureVotes);
      const totals = legislatureVotes.reduce((acc, vote) => addTotals(acc, vote.totals), emptyCounts());
      const groups = buildGroupStats(legislatureVotes);

      return {
        legislature,
        votes: legislatureVotes,
        voteCount: legislatureVotes.length,
        approvedCount: legislatureVotes.filter((vote) => vote.approved).length,
        rejectedCount: legislatureVotes.filter((vote) => !vote.approved).length,
        totals,
        groups,
        deputies: deputies.length > 0 ? deputies : allDeputies.filter((deputy) => deputy.votes.some((vote) => vote.legislature === legislature)),
      };
    })
    .sort((a, b) => b.legislature.localeCompare(a.legislature, 'es'));
}

function buildGroupStats(votes: VoteAnalyticsRecord[]) {
  const groups = new Map<string, GroupStats>();

  votes.forEach((vote) => {
    getVotesByDeputy(vote.detail).forEach((item) => {
      const group = item.group || '—';
      const current = groups.get(group) ?? { group, counts: emptyCounts(), total: 0, abstentionRate: 0, noRate: 0 };
      current.counts[item.voteType] += 1;
      current.total += 1;
      groups.set(group, current);
    });
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      abstentionRate: group.total === 0 ? 0 : group.counts.abstentions / group.total,
      noRate: group.total === 0 ? 0 : group.counts.no / group.total,
    }))
    .sort((a, b) => b.total - a.total);
}

function addTotals(acc: VoteCountSet, totals: VoteTotals) {
  acc.yes += totals.yes;
  acc.no += totals.no;
  acc.abstentions += totals.abstentions;
  acc.absent += totals.absent;
  return acc;
}

function normalizeForSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
