import { groupMyDayCards, type MyDayCard } from './myDay';

function card(id: string, dueDate: string | null, blockedByPendingCount = 0): MyDayCard {
  return {
    id, title: id, dueDate, blockedByPendingCount, completed: false, priority: null,
    listName: 'Pendiente', boardId: 'board', boardName: 'Tablero',
    workspaceId: 'workspace', workspaceName: 'Espacio',
  };
}

describe('groupMyDayCards', () => {
  it('keeps overdue, today, this calendar week, undated and blocked work visible', () => {
    const now = new Date(2026, 9, 14, 12); // Wednesday
    const cards = [
      card('overdue', new Date(2026, 9, 13, 18).toISOString()),
      card('today', new Date(2026, 9, 14, 8).toISOString()),
      card('week', new Date(2026, 9, 18, 16).toISOString()),
      card('next-week', new Date(2026, 9, 19, 9).toISOString()),
      card('undated', null, 2),
      { ...card('done', null, 1), completed: true },
    ];

    const grouped = groupMyDayCards(cards, now);

    expect(grouped.overdue.map((item) => item.id)).toEqual(['overdue']);
    expect(grouped.today.map((item) => item.id)).toEqual(['today']);
    expect(grouped.upcoming.map((item) => item.id)).toEqual(['week']);
    expect(grouped.unscheduled.map((item) => item.id)).toEqual(['undated']);
    expect(grouped.blocked.map((item) => item.id)).toEqual(['undated']);
  });
});
