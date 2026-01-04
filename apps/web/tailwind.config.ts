import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#111111',
        card: '#1a1a1a',
        'card-hover': '#1f1f1f',
        border: '#2a2a2a',
        'border-light': '#333333',
        text: {
          primary: '#e5e5e5',
          secondary: '#a0a0a0',
          muted: '#6b6b6b',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Courier New', 'monospace'],
      },
      borderRadius: {
        terminal: '0.25rem',
      },
      boxShadow: {
        terminal: '0 0 0 1px rgba(255, 255, 255, 0.05)',
        'terminal-hover': '0 0 0 1px rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
