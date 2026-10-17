import { act, renderHook } from '@testing-library/react';
import * as Y from 'yjs';
import { useDocumentAutoSave } from './useDocumentAutoSave';

describe('useDocumentAutoSave', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a failed save visible and saves again when retried', async () => {
    jest.useFakeTimers();
    const yjsDoc = new Y.Doc();
    const onSave = jest.fn()
      .mockRejectedValueOnce(new Error('Error de conexión'))
      .mockResolvedValueOnce(undefined);
    const { result, unmount } = renderHook(() => useDocumentAutoSave({
      documentId: 'document-1',
      yjsDoc,
      editor: null,
      enabled: true,
      onSave,
      shouldSaveOnUnmount: () => false,
    }));

    act(() => yjsDoc.getText('content').insert(0, 'Cambios locales'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.saveError).toBe('Error de conexión');
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.saveNow();
    });

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1][0]).toBe('document-1');
    expect(onSave.mock.calls[1][1]).toBeInstanceOf(Uint8Array);
    expect(result.current.saveError).toBeNull();

    unmount();
    yjsDoc.destroy();
  });
});
