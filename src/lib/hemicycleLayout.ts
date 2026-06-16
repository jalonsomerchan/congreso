export type SeatPosition = {
  x: number;
  y: number;
  row: number;
};

type Sector = {
  start: number;
  end: number;
};

const VIEW_CENTER_X = 500;
const VIEW_CENTER_Y = 592;
const SECTOR_BY_ZONE: Record<number, Sector> = {
  1: { start: 167, end: 113 },
  2: { start: 135, end: 75 },
  3: { start: 85, end: 25 },
  4: { start: 202, end: 154 },
  5: { start: 27, end: -21 },
};

const RADIUS_BY_ROW: Record<number, number> = {
  2: 166,
  3: 202,
  4: 238,
  5: 274,
  6: 310,
  7: 346,
  8: 382,
};

const CAPACITY_BY_ROW: Record<number, number> = {
  2: 12,
  3: 14,
  4: 15,
  5: 16,
  6: 17,
  7: 18,
  8: 20,
};

export function getHemicycleSeatPosition(seatId: unknown): SeatPosition | null {
  const normalizedSeat = normalizeSeatId(seatId);
  if (!normalizedSeat) return null;

  const numericSeat = Number(normalizedSeat);
  if (numericSeat > 0 && numericSeat < 100) return getFrontBenchPosition(numericSeat);
  if (!/^[1-5][2-8]\d{2}$/.test(normalizedSeat)) return null;

  const zone = Number(normalizedSeat[0]);
  const row = Number(normalizedSeat[1]);
  const index = Number(normalizedSeat.slice(2));
  const sector = SECTOR_BY_ZONE[zone];
  const radius = RADIUS_BY_ROW[row];
  if (!sector || !radius || !index) return null;

  const capacity = Math.max(CAPACITY_BY_ROW[row] ?? index, index);
  const progress = clamp((index - 0.5) / capacity, 0.03, 0.97);
  const angle = interpolate(sector.start, sector.end, progress);
  return polarToPoint(angle, radius, row);
}

export function getFallbackHemicyclePositions(count: number): SeatPosition[] {
  const seats = [
    ...Array.from({ length: 22 }, (_, index) => String(index + 1)),
    ...[4, 1, 2, 3, 5].flatMap((zone) =>
      [8, 7, 6, 5, 4, 3, 2].flatMap((row) =>
        Array.from({ length: CAPACITY_BY_ROW[row] }, (_, index) => `${zone}${row}${String(index + 1).padStart(2, '0')}`)
      )
    ),
  ];

  return seats.slice(0, Math.max(0, count)).map((seat) => getHemicycleSeatPosition(seat)).filter(Boolean) as SeatPosition[];
}

export function normalizeSeatId(seatId: unknown) {
  const value = String(seatId ?? '').trim();
  if (!value || value === '-1' || value.toLowerCase() === 'null') return null;
  return value.replace(/^0+/, '') || '0';
}

function getFrontBenchPosition(seatNumber: number): SeatPosition {
  const row = seatNumber <= 8 ? 0 : seatNumber <= 16 ? 1 : 2;
  const index = row === 0 ? seatNumber - 1 : row === 1 ? seatNumber - 9 : seatNumber - 17;
  const capacity = row === 2 ? 6 : 8;
  const start = row === 2 ? 226 : 214;
  const end = row === 2 ? 314 : 326;
  const radius = row === 0 ? 112 : row === 1 ? 148 : 184;
  const progress = capacity === 1 ? 0.5 : index / (capacity - 1);
  const angle = interpolate(start, end, progress);
  const radians = toRadians(angle);

  return {
    x: 500 + Math.cos(radians) * radius,
    y: 396 + Math.sin(radians) * radius,
    row,
  };
}

function polarToPoint(angle: number, radius: number, row: number): SeatPosition {
  const radians = toRadians(angle);
  return {
    x: VIEW_CENTER_X + Math.cos(radians) * radius,
    y: VIEW_CENTER_Y - Math.sin(radians) * radius,
    row,
  };
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
