export const HOUR_HEIGHT = 64;

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, count: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

export function monthDays(date: Date): Date[] {
  const first = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function overlapsDay(start: Date, end: Date, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const nextDay = addDays(day, 1).getTime();
  return start.getTime() < nextDay && end.getTime() > dayStart;
}

export function clippedMinutes(start: Date, end: Date, day: Date): { startMinute: number; endMinute: number } | null {
  if (!overlapsDay(start, end, day)) return null;
  const dayStart = startOfDay(day).getTime();
  const nextDay = addDays(day, 1).getTime();
  return {
    startMinute: Math.max(0, (start.getTime() - dayStart) / 60000),
    endMinute: Math.min(1440, (end.getTime() - dayStart) / 60000, (nextDay - dayStart) / 60000),
  };
}

export type TimedSegment = { id: string; startMinute: number; endMinute: number };

/** Assigns side-by-side columns to overlapping events without hiding any event. */
export function layoutTimedSegments<T extends TimedSegment>(segments: T[]): (T & { column: number; columns: number })[] {
  const ordered = [...segments].sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);
  const result: (T & { column: number; columns: number; group: number })[] = [];
  let active: (T & { column: number; columns: number; group: number })[] = [];
  let group = -1;
  let groupEnd = -1;
  const maxByGroup = new Map<number, number>();

  for (const segment of ordered) {
    if (segment.startMinute >= groupEnd) {
      group += 1;
      groupEnd = segment.endMinute;
      active = [];
    } else {
      groupEnd = Math.max(groupEnd, segment.endMinute);
      active = active.filter((entry) => entry.endMinute > segment.startMinute);
    }
    const used = new Set(active.map((entry) => entry.column));
    let column = 0;
    while (used.has(column)) column += 1;
    const entry = { ...segment, column, columns: 1, group };
    active.push(entry);
    result.push(entry);
    maxByGroup.set(group, Math.max(maxByGroup.get(group) ?? 0, column + 1));
  }
  return result.map((entry) => {
    const { group, ...segment } = entry;
    return { ...segment, columns: maxByGroup.get(group) ?? 1 } as T & { column: number; columns: number };
  });
}
