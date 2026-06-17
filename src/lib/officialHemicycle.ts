export type OfficialSeatPosition = {
  x: number;
  y: number;
};

const OFFICIAL_HEMICYCLE_URL = 'https://www.congreso.es/es/hemiciclo';
const MEMBER_PATTERN = /<area[\s\S]*?alt="([^"]+)"[\s\S]*?coords="(\d+),(\d+),(\d+)"/g;
const cache = new Map<string, Promise<Map<string, OfficialSeatPosition>>>();

export async function getOfficialHemicyclePositions() {
  if (!cache.has(OFFICIAL_HEMICYCLE_URL)) {
    cache.set(OFFICIAL_HEMICYCLE_URL, loadOfficialHemicyclePositions());
  }

  return cache.get(OFFICIAL_HEMICYCLE_URL)!;
}

export async function getOfficialHemicycleSeatPosition(name: string) {
  const positions = await getOfficialHemicyclePositions();
  return positions.get(normalizeDeputyName(name)) ?? null;
}

export function normalizeDeputyName(value: unknown) {
  return String(value ?? '')
    .replace(/\s+\([^)]*\)$/u, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/[.'’`-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');
}

async function loadOfficialHemicyclePositions() {
  const response = await fetch(OFFICIAL_HEMICYCLE_URL, {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load official hemicycle: ${response.status}`);
  }

  const html = await response.text();
  const positions = new Map<string, OfficialSeatPosition>();

  for (const match of html.matchAll(MEMBER_PATTERN)) {
    const [, rawName, x, y] = match;
    const normalizedName = normalizeDeputyName(rawName);
    if (!normalizedName) continue;

    positions.set(normalizedName, {
      x: Number(x),
      y: Number(y),
    });
  }

  return positions;
}
