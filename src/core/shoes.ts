/**
 * Running shoes and accumulated mileage.
 *
 * Small enough for localStorage. Distance is stored in metres; the UI converts.
 * When a shoe hits its limit, the app warns — it does not force retirement.
 */

import { newId } from './activity';

const KEY = 'runlog:shoes:v1';

/** Default wear warning: 700 km. */
export const DEFAULT_SHOE_LIMIT_M = 700_000;

export interface Shoe {
  id: string;
  name: string;
  /** Optional brand line, free text. */
  brand: string;
  /** Total distance logged in this pair (metres). */
  distanceM: number;
  /** Soft wear limit in metres. */
  limitM: number;
  retired: boolean;
  createdAt: number;
}

function clampLimit(m: number): number {
  if (!Number.isFinite(m) || m <= 0) return DEFAULT_SHOE_LIMIT_M;
  return Math.min(2_000_000, Math.max(50_000, m));
}

export function sanitiseShoe(raw: unknown): Shoe | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<Shoe>;
  if (typeof s.id !== 'string' || typeof s.name !== 'string' || !s.name.trim()) return null;
  return {
    id: s.id,
    name: s.name.trim().slice(0, 80),
    brand: typeof s.brand === 'string' ? s.brand.trim().slice(0, 80) : '',
    distanceM: Math.max(0, typeof s.distanceM === 'number' && Number.isFinite(s.distanceM) ? s.distanceM : 0),
    limitM: clampLimit(typeof s.limitM === 'number' ? s.limitM : DEFAULT_SHOE_LIMIT_M),
    retired: Boolean(s.retired),
    createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
  };
}

export function loadShoes(): Shoe[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitiseShoe).filter((s): s is Shoe => s !== null);
  } catch {
    return [];
  }
}

export function saveShoes(shoes: Shoe[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(shoes));
  } catch {
    // Private mode / full storage.
  }
}

export function createShoe(input: {
  name: string;
  brand?: string;
  limitM?: number;
}): Shoe {
  return {
    id: newId(),
    name: input.name.trim() || 'Shoes',
    brand: (input.brand ?? '').trim(),
    distanceM: 0,
    limitM: clampLimit(input.limitM ?? DEFAULT_SHOE_LIMIT_M),
    retired: false,
    createdAt: Date.now(),
  };
}

/** Update name, brand, and/or wear limit without touching mileage. */
export function updateShoe(
  shoes: Shoe[],
  shoeId: string,
  patch: { name?: string; brand?: string; limitM?: number },
): Shoe[] {
  return shoes.map((s) => {
    if (s.id !== shoeId) return s;
    return {
      ...s,
      name: patch.name !== undefined ? patch.name.trim().slice(0, 80) || s.name : s.name,
      brand: patch.brand !== undefined ? patch.brand.trim().slice(0, 80) : s.brand,
      limitM: patch.limitM !== undefined ? clampLimit(patch.limitM) : s.limitM,
    };
  });
}

export function addDistanceToShoe(shoes: Shoe[], shoeId: string, metres: number): Shoe[] {
  if (!(metres > 0)) return shoes;
  return shoes.map((s) =>
    s.id === shoeId && !s.retired ? { ...s, distanceM: s.distanceM + metres } : s,
  );
}

export function shoeWearFraction(shoe: Shoe): number {
  if (!(shoe.limitM > 0)) return 0;
  return shoe.distanceM / shoe.limitM;
}

export function shoeNeedsWarning(shoe: Shoe): boolean {
  return !shoe.retired && shoeWearFraction(shoe) >= 1;
}

export function activeShoes(shoes: Shoe[]): Shoe[] {
  return shoes.filter((s) => !s.retired);
}
