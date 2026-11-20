import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
        md: '3px',
        lg: 'var(--radius)',
        xl: '6px',
        '2xl': '8px',
        '3xl': '10px',
      },
      fontFamily: {
        serif: ['ui-serif', 'Georgia', '"Times New Roman"', 'serif'],
      },
      // The whole product is re-coloured here: every slate / emerald / blue / … class now resolves to the warm palette
      // of the home page, so no screen needs touching to change its colour.
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        slate: {
          50: '#faf8f3', 100: '#f1ece0', 200: '#e1dac8', 300: '#cfc8b8', 400: '#a8a290',
          500: '#8a846f', 600: '#6b6657', 700: '#4a4538', 800: '#2b2a25', 900: '#1c1b18', 950: '#141414',
        },
        emerald: {
          50: '#eef4ee', 100: '#dbe9dc', 200: '#b9d4bc', 300: '#8fb994', 400: '#5f9a68',
          500: '#3f7d4a', 600: '#2f6b3b', 700: '#265a31', 800: '#1f4a28', 900: '#183a20', 950: '#0f2614',
        },
        green: {
          50: '#f3f6ea', 100: '#e5ecd2', 200: '#cbd9a6', 300: '#acc174', 400: '#8aa44c',
          500: '#6d8a33', 600: '#5a7a2c', 700: '#486224', 800: '#394e1e', 900: '#2c3d18', 950: '#18220c',
        },
        blue: {
          50: '#eef3f6', 100: '#dbe6ec', 200: '#b8cdd8', 300: '#8eaebf', 400: '#5f8aa1',
          500: '#3f6f8a', 600: '#2d5a73', 700: '#244a5f', 800: '#1d3b4c', 900: '#152c3a', 950: '#0d1c26',
        },
        sky: {
          50: '#edf4f5', 100: '#d9e8ea', 200: '#b3d1d6', 300: '#86b4bd', 400: '#5a95a1',
          500: '#3f7b88', 600: '#34656f', 700: '#2b525a', 800: '#244249', 900: '#1b3338', 950: '#0f1e21',
        },
        violet: {
          50: '#f6eef4', 100: '#ecdae7', 200: '#d9b5d0', 300: '#c08bb4', 400: '#a3608f',
          500: '#8a4778', 600: '#7a3b6e', 700: '#652f5b', 800: '#502549', 900: '#3b1b35', 950: '#260f22',
        },
        // the rest of the rainbow borrows from the families above, so nothing on screen stays neon
        indigo: {
          50: '#eef3f6', 100: '#dbe6ec', 200: '#b8cdd8', 300: '#8eaebf', 400: '#5f8aa1',
          500: '#3f6f8a', 600: '#2d5a73', 700: '#244a5f', 800: '#1d3b4c', 900: '#152c3a', 950: '#0d1c26',
        },
        cyan: {
          50: '#edf4f5', 100: '#d9e8ea', 200: '#b3d1d6', 300: '#86b4bd', 400: '#5a95a1',
          500: '#3f7b88', 600: '#34656f', 700: '#2b525a', 800: '#244249', 900: '#1b3338', 950: '#0f1e21',
        },
        purple: {
          50: '#f6eef4', 100: '#ecdae7', 200: '#d9b5d0', 300: '#c08bb4', 400: '#a3608f',
          500: '#8a4778', 600: '#7a3b6e', 700: '#652f5b', 800: '#502549', 900: '#3b1b35', 950: '#260f22',
        },
        fuchsia: {
          50: '#f6eef4', 100: '#ecdae7', 200: '#d9b5d0', 300: '#c08bb4', 400: '#a3608f',
          500: '#8a4778', 600: '#7a3b6e', 700: '#652f5b', 800: '#502549', 900: '#3b1b35', 950: '#260f22',
        },
        pink: {
          50: '#f6eef4', 100: '#ecdae7', 200: '#d9b5d0', 300: '#c08bb4', 400: '#a3608f',
          500: '#8a4778', 600: '#7a3b6e', 700: '#652f5b', 800: '#502549', 900: '#3b1b35', 950: '#260f22',
        },
        lime: {
          50: '#f3f6ea', 100: '#e5ecd2', 200: '#cbd9a6', 300: '#acc174', 400: '#8aa44c',
          500: '#6d8a33', 600: '#5a7a2c', 700: '#486224', 800: '#394e1e', 900: '#2c3d18', 950: '#18220c',
        },
        teal: {
          50: '#edf4f2', 100: '#d9e8e4', 200: '#b3d1ca', 300: '#86b4aa', 400: '#5a9588',
          500: '#3f7b6d', 600: '#336658', 700: '#2a5247', 800: '#23423a', 900: '#1b332d', 950: '#0f1f1b',
        },
        yellow: {
          50: '#fbf6e6', 100: '#f6ebc3', 200: '#edd78a', 300: '#e2c053', 400: '#d3a52c',
          500: '#b7791f', 600: '#9a6416', 700: '#7d5013', 800: '#5f3d10', 900: '#46300e', 950: '#2a1b06',
        },
        rose: {
          50: '#fbf0ec', 100: '#f6dcd2', 200: '#edb9a6', 300: '#e2917a', 400: '#d36a4f',
          500: '#bd4a2f', 600: '#a8412a', 700: '#873420', 800: '#6c2b1b', 900: '#532216', 950: '#32120b',
        },
        red: {
          50: '#fdf1ef', 100: '#fbdcd8', 200: '#f5b9b2', 300: '#ec8f85', 400: '#e0645a',
          500: '#cf3a2c', 600: '#b42318', 700: '#912018', 800: '#75190f', 900: '#5a140c', 950: '#350a06',
        },
      },
    },
  },
  plugins: [],
};

export default config;
