import { availableEndHours, availableEndMinutes, oneHourAfter, timeForSelectedHour } from './calendarTime';

describe('event time selection', () => {
  it('defaults the end to one hour after the chosen start', () => {
    expect(oneHourAfter('2026-10-10', '16:00')).toEqual({ date: '2026-10-10', time: '17:00' });
    expect(oneHourAfter('2026-10-10', '23:30')).toEqual({ date: '2026-10-11', time: '00:30' });
    expect(oneHourAfter('2026-12-31', '23:00')).toEqual({ date: '2027-01-01', time: '00:00' });
  });

  it('does not offer end times before or equal to the start on the same day', () => {
    expect(availableEndHours('16:00')).toEqual([16, 17, 18, 19, 20, 21, 22, 23]);
    expect(availableEndMinutes(16, '16:00')[0]).toBe(1);
    expect(availableEndHours('16:59')[0]).toBe(17);
    expect(availableEndMinutes(16, '16:30')[0]).toBe(31);
    expect(timeForSelectedHour(16, 0, '16:30')).toBe('16:31');
    expect(availableEndHours('23:59')).toEqual([]);
  });

  it('allows the full clock when the end date is a later day', () => {
    expect(availableEndHours()).toHaveLength(24);
    expect(availableEndMinutes(0)[0]).toBe(0);
  });
});
