import { addDays, clippedMinutes, dateKey, layoutTimedSegments, monthDays, startOfWeek } from './calendarMath';

describe('calendarMath', () => {
  it('starts weeks on Monday and provides a full six-week month grid', () => {
    const days = monthDays(new Date(2026, 9, 8));
    expect(days).toHaveLength(42);
    expect(dateKey(days[0])).toBe('2026-09-28');
    expect(dateKey(startOfWeek(new Date(2026, 9, 8)))).toBe('2026-10-05');
    expect(dateKey(addDays(days[0], 42))).toBe('2026-11-09');
  });

  it('clips a multi-day event at the edges of each day', () => {
    const start = new Date(2026, 9, 8, 23, 30);
    const end = new Date(2026, 9, 9, 1, 0);
    expect(clippedMinutes(start, end, new Date(2026, 9, 8))).toEqual({ startMinute: 1410, endMinute: 1440 });
    expect(clippedMinutes(start, end, new Date(2026, 9, 9))).toEqual({ startMinute: 0, endMinute: 60 });
  });

  it('places overlapping events side by side and keeps sequential events full width', () => {
    const layout = layoutTimedSegments([
      { id: 'a', startMinute: 540, endMinute: 600 },
      { id: 'b', startMinute: 570, endMinute: 630 },
      { id: 'c', startMinute: 630, endMinute: 690 },
    ]);
    expect(layout.find((item) => item.id === 'a')).toMatchObject({ column: 0, columns: 2 });
    expect(layout.find((item) => item.id === 'b')).toMatchObject({ column: 1, columns: 2 });
    expect(layout.find((item) => item.id === 'c')).toMatchObject({ column: 0, columns: 1 });
  });
});
