import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiService } from '@/services/apiService';
import PersonalizedDashboard from './PersonalizedDashboard';

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'drag-user' } }),
}));

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: (selector: (state: { unreadCount: number; notifications: never[] }) => unknown) => selector({ unreadCount: 0, notifications: [] }),
}));

jest.mock('@/services/apiService', () => ({
  apiService: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? true;
  }
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left, y: top, left, top, width, height,
    right: left + width, bottom: top + height,
    toJSON: () => ({}),
  };
}

describe('PersonalizedDashboard widget positioning', () => {
  beforeEach(() => {
    window.localStorage.clear();
    const dashboard = {
      id: 'board-1', name: 'Personal', context: { type: 'PERSONAL', id: null }, locked: false,
      widgets: [{ id: 'widget-1', kind: 'today-priorities', column: 1, row: 1, width: 8, height: 3 }],
    };
    jest.mocked(apiService.get)
      .mockResolvedValueOnce({ success: true, data: { dashboards: [dashboard] } } as never)
      .mockResolvedValueOnce({ success: true, data: { projects: [] } } as never)
      .mockResolvedValueOnce({ success: true, data: { pending: [], overdue: [] } } as never);
    jest.mocked(apiService.patch).mockResolvedValue({ success: true, data: { dashboard } } as never);
    jest.mocked(apiService.post).mockResolvedValue({ success: true, data: { dashboard } } as never);
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    });
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: TestPointerEvent });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists the new grid position after dragging a widget', async () => {
    const { container } = render(<PersonalizedDashboard onQuickCreate={jest.fn()} />);
    const dragHandle = await screen.findByRole('button', { name: 'Mover widget Prioridades de hoy' });
    const grid = container.querySelector('[data-columns="24"]');
    const widget = container.querySelector('[data-kind="today-priorities"]');
    expect(grid).not.toBeNull();
    expect(widget).not.toBeNull();
    expect(widget?.parentElement?.style.gridRow).toMatch(/^1\s*\/\s*span/);

    jest.spyOn(grid!, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 1000, 800));
    jest.spyOn(widget!, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 330, 130));

    fireEvent.pointerDown(dragHandle, { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: 10, clientY: 12 });
    fireEvent.pointerMove(document, { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 610, clientY: 412 });
    await waitFor(() => expect(grid?.classList.contains('dragActive')).toBe(true));
    expect(grid?.querySelector('[class*="gridCellHighlight"]')).toBeNull();
    fireEvent.pointerMove(document, { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 620, clientY: 422 });
    fireEvent.pointerUp(document, { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: 620, clientY: 422 });

    await waitFor(() => {
      const saveCall = jest.mocked(apiService.patch).mock.calls.find(([url]) => url === '/api/users/me/dashboards/board-1');
      expect(saveCall).toBeDefined();
      const payload = saveCall?.[1] as { widgets: Array<{ column: number; row: number }> };
      expect(payload.widgets[0].column).toBeGreaterThan(1);
      expect(payload.widgets[0].row).toBeGreaterThan(1);
      expect(widget?.parentElement?.style.gridColumn).not.toBe('1 / span 16');
      expect(widget?.parentElement?.style.gridRow).not.toBe('1 / span 4');
    });
  });
});
