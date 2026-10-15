export interface MyDayCard {
  id: string;
  title: string;
  dueDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  completed: boolean;
  blockedByPendingCount: number;
  listName: string;
  boardId: string;
  boardName: string;
  workspaceId: string;
  workspaceName: string;
}

export interface MyDayGroups {
  overdue: MyDayCard[];
  today: MyDayCard[];
  upcoming: MyDayCard[];
  unscheduled: MyDayCard[];
  blocked: MyDayCard[];
}

function dueTime(card: MyDayCard): number {
  if (!card.dueDate) return Number.POSITIVE_INFINITY;
  const time = new Date(card.dueDate).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function sortByDue(cards: MyDayCard[]): MyDayCard[] {
  const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  return cards.sort((left, right) =>
    dueTime(left) - dueTime(right)
    || (priority[left.priority ?? 'LOW'] - priority[right.priority ?? 'LOW'])
    || left.title.localeCompare(right.title)
  );
}

/** Agrupa trabajo asignado usando días del calendario local, no horas transcurridas. */
export function groupMyDayCards(cards: MyDayCard[], now = new Date()): MyDayGroups {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const nextWeekStart = new Date(todayStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + ((7 - todayStart.getDay()) % 7) + 1);

  const groups: MyDayGroups = { overdue: [], today: [], upcoming: [], unscheduled: [], blocked: [] };
  for (const card of cards) {
    if (card.completed) continue;
    if (card.blockedByPendingCount > 0) groups.blocked.push(card);

    const due = dueTime(card);
    if (!Number.isFinite(due)) groups.unscheduled.push(card);
    else if (due < todayStart.getTime()) groups.overdue.push(card);
    else if (due < tomorrowStart.getTime()) groups.today.push(card);
    else if (due < nextWeekStart.getTime()) groups.upcoming.push(card);
  }

  for (const group of Object.values(groups)) sortByDue(group);
  return groups;
}
