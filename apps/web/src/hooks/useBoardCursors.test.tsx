import { fireEvent, renderHook } from '@testing-library/react';
import { socketService } from '@/services/socketService';
import { useBoardCursors } from './useBoardCursors';

jest.mock('@/services/socketService', () => ({
  socketService: {
    emitCursorMove: jest.fn(),
    onCursorMoved: jest.fn(),
    offCursorMoved: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'local-user' } }),
}));

describe('useBoardCursors', () => {
  it('emits pointer coordinates relative to the full surface passed to the hook', () => {
    const boardSurface = document.createElement('section');
    const header = document.createElement('header');
    boardSurface.appendChild(header);
    jest.spyOn(boardSurface, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 40,
      left: 20,
      top: 40,
      right: 620,
      bottom: 440,
      width: 600,
      height: 400,
      toJSON: () => ({}),
    });

    const { unmount } = renderHook(() => useBoardCursors('board-1', boardSurface));
    fireEvent.mouseMove(header, { clientX: 320, clientY: 240 });

    expect(socketService.emitCursorMove).toHaveBeenCalledWith('board-1', 50, 50);
    unmount();
  });
});
