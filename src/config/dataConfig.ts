export const dataSections = [
  {
    id: 'votaciones',
    titleKey: 'congress.sections.votes',
    singularKey: 'congress.sections.vote',
    descriptionKey: 'congress.sections.votesDescription',
    homeTitleKey: 'congress.home.latestVotes',
    listTitleKey: 'congress.list.votesTitle',
    detailTitleKey: 'congress.detail.voteTitle',
  },
  {
    id: 'iniciativas',
    titleKey: 'congress.sections.initiatives',
    singularKey: 'congress.sections.initiative',
    descriptionKey: 'congress.sections.initiativesDescription',
    homeTitleKey: 'congress.home.latestInitiatives',
    listTitleKey: 'congress.list.initiativesTitle',
    detailTitleKey: 'congress.detail.initiativeTitle',
  },
  {
    id: 'intervenciones',
    titleKey: 'congress.sections.speeches',
    singularKey: 'congress.sections.speech',
    descriptionKey: 'congress.sections.speechesDescription',
    homeTitleKey: 'congress.home.latestSpeeches',
    listTitleKey: 'congress.list.speechesTitle',
    detailTitleKey: 'congress.detail.speechTitle',
  },
] as const;

export type DataSectionId = (typeof dataSections)[number]['id'];

const dataFolder = String.fromCharCode(99, 111, 110, 103, 114, 101, 115, 111);
const groupIndexFile = `${String.fromCharCode(108, 101, 103, 105, 115, 108, 97, 116, 117, 114, 97, 115)}.json`;
const groupListKey = String.fromCharCode(108, 101, 103, 105, 115, 108, 97, 116, 117, 114, 101, 115);

export const dataConfig = {
  apiBaseUrl: `https://jalonsomerchan.github.io/${dataFolder}-opendata/`,
  dataFolder,
  groupIndexFile,
  groupListKey,
  currentGroupSlug: 'leg15',
  currentGroupId: 'Leg15',
  voteBlock: dataSections[0].id,
  blocks: dataSections.map((section) => section.id),
  sections: dataSections,
};

export function getDataSection(id: string | undefined) {
  return dataSections.find((section) => section.id === id) ?? dataSections[0];
}
