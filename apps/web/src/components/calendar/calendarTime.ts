function pad(value: number): string { return String(value).padStart(2, '0'); }

/** A local calendar hour may roll into the following day. */
export function oneHourAfter(date: string, time: string): { date: string; time: string } {
  const next = new Date(`${date}T${time}:00`);
  next.setHours(next.getHours() + 1);
  return {
    date: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
    time: `${pad(next.getHours())}:${pad(next.getMinutes())}`,
  };
}

/** The end must be strictly later than the start when both dates match. */
export function availableEndMinutes(hour: number, minTime?: string): number[] {
  const minimum = minTime ? Number(minTime.slice(0, 2)) * 60 + Number(minTime.slice(3, 5)) : -1;
  return Array.from({ length: 60 }, (_, minute) => minute)
    .filter(minute => hour * 60 + minute > minimum);
}

export function availableEndHours(minTime?: string): number[] {
  return Array.from({ length: 24 }, (_, hour) => hour)
    .filter(hour => availableEndMinutes(hour, minTime).length > 0);
}

export function timeForSelectedHour(hour: number, currentMinute: number, minTime?: string): string {
  const minutes = availableEndMinutes(hour, minTime);
  const minute = minutes.includes(currentMinute) ? currentMinute : minutes[0];
  return `${pad(hour)}:${pad(minute)}`;
}
