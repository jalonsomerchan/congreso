import { officialHemicycleSeats } from '../data/officialHemicycleSeats';

export type OfficialSeatPosition = {
  name: string;
  group: string;
  x: number;
  y: number;
};

let cachedPositions: Map<string, OfficialSeatPosition> | null = null;

export async function getOfficialHemicyclePositions() {
  cachedPositions ??= loadOfficialHemicyclePositions();

  return cachedPositions;
}

export async function getOfficialHemicycleSeatPositionsList() {
  const positions = await getOfficialHemicyclePositions();
  const seen = new Set<string>();

  return [...positions.values()].filter((position) => {
    const key = `${position.x},${position.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getOfficialHemicycleSeatPosition(name: string) {
  const positions = await getOfficialHemicyclePositions();
  for (const key of getDeputyNameKeys(name)) {
    const position = positions.get(key);
    if (position) return position;
  }

  return null;
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

function getDeputyNameKeys(value: unknown) {
  const rawName = String(value ?? '').trim();
  const keys = new Set([normalizeDeputyName(rawName)]);
  const [surnamePart, namePart] = rawName.split(',').map((part) => part?.trim());

  if (surnamePart && namePart) {
    keys.add(normalizeDeputyName(`${namePart} ${surnamePart}`));
  }

  return [...keys].filter(Boolean);
}

function loadOfficialHemicyclePositions() {
  const positions = new Map<string, OfficialSeatPosition>();

  for (const seat of officialHemicycleSeats) {
    for (const normalizedName of getDeputyNameKeys(seat.name)) {
      positions.set(normalizedName, {
        name: seat.name,
        group: seat.group,
        x: seat.x,
        y: seat.y,
      });
    }
  }

  return positions;
}
