import { renderHook } from '@testing-library/react';
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
  beforeEach(() => jest.clearAllMocks());

  it('emits pointer coordinates across the entire board surface, including its empty area', () => {
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
    // The pointer may be over empty space rather than a list or card.
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 560, clientY: 400 }));

    expect(socketService.emitCursorMove).toHaveBeenCalledWith('board-1', 90, 90);
    unmount();
  });

  it('does not emit cursor positions outside the board surface', () => {
    const boardSurface = document.createElement('section');
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
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 700, clientY: 300 }));

    expect(socketService.emitCursorMove).not.toHaveBeenCalled();
    unmount();
  });
});
