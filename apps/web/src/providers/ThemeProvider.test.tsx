import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeControl() {
  const { theme, setTheme } = useTheme();
  return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme}</button>;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('starts in light mode and persists the dark selection', () => {
    render(<ThemeProvider><ThemeControl /></ThemeProvider>);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('aether-theme')).toBe('dark');
  });

  it('restores the selected theme after a reload', () => {
    localStorage.setItem('aether-theme', 'dark');
    act(() => { render(<ThemeProvider><ThemeControl /></ThemeProvider>); });
    expect(screen.getByRole('button', { name: 'dark' })).toBeTruthy();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
