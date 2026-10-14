import { act, renderHook, waitFor } from '@testing-library/react';
import { useRouteSectionState } from './useRouteSectionState';

describe('useRouteSectionState', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/dashboard/projects/project-1?tab=docs&keep=1');
  });

  it('restores a valid section from the URL after mounting', async () => {
    const { result } = renderHook(() => useRouteSectionState('tab', 'overview', ['overview', 'docs'], 'project-1'));

    await waitFor(() => expect(result.current[0]).toBe('docs'));
  });

  it('updates the URL while preserving other query parameters', () => {
    const { result } = renderHook(() => useRouteSectionState('tab', 'overview', ['overview', 'docs'], 'project-1'));

    act(() => result.current[1]('overview'));
    expect(window.location.search).toBe('?keep=1');

    act(() => result.current[1]('docs'));
    expect(window.location.search).toBe('?keep=1&tab=docs');
  });

  it('falls back when the URL contains an unknown section', async () => {
    window.history.replaceState({}, '', '/dashboard/projects/project-1?tab=unknown');
    const { result } = renderHook(() => useRouteSectionState('tab', 'overview', ['overview', 'docs'], 'project-1'));

    await waitFor(() => expect(result.current[0]).toBe('overview'));
  });
});
