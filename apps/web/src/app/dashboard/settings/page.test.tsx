import { fireEvent, render, screen } from '@testing-library/react';
import SettingsPage from './page';

const setTheme = jest.fn();
const loadPreferences = jest.fn();
const updatePreferences = jest.fn().mockResolvedValue(undefined);

jest.mock('@/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'light', setTheme }),
}));

jest.mock('@/stores/preferencesStore', () => ({
  usePreferencesStore: Object.assign(
    () => ({ preferences: null, loadPreferences, updatePreferences }),
    { getState: () => ({ error: null }) },
  ),
}));

describe('Ajustes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('muestra apariencia y avisos sin el gobierno del workspace', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'Apariencia' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Notificaciones' })).toBeTruthy();
    expect(screen.queryByText('Gobierno del workspace')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
