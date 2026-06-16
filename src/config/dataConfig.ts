const dataFolder = String.fromCharCode(99, 111, 110, 103, 114, 101, 115, 111);
const blockNames = [
  String.fromCharCode(118, 111, 116, 97, 99, 105, 111, 110, 101, 115),
  String.fromCharCode(105, 110, 105, 99, 105, 97, 116, 105, 118, 97, 115),
  String.fromCharCode(105, 110, 116, 101, 114, 118, 101, 110, 99, 105, 111, 110, 101, 115),
  String.fromCharCode(100, 105, 112, 117, 116, 97, 100, 111, 115),
] as const;

export const dataConfig = {
  apiBaseUrl: `https://jalonsomerchan.github.io/${dataFolder}-opendata/`,
  dataFolder,
  groupIndexFile: `${String.fromCharCode(108, 101, 103, 105, 115, 108, 97, 116, 117, 114, 97, 115)}.json`,
  groupListKey: String.fromCharCode(108, 101, 103, 105, 115, 108, 97, 116, 117, 114, 101, 115),
  currentGroupSlug: 'leg15',
  currentGroupId: 'Leg15',
  voteBlock: blockNames[0],
  blocks: blockNames,
};

export type DataBlock = (typeof dataConfig.blocks)[number];
