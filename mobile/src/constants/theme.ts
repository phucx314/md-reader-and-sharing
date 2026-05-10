export const lightTheme = {
  background: '#F5F0E8',   // warm cream — key neo-brutalism tone
  surface: '#FFFEF2',      // slightly warmer white for cards
  text: '#111111',
  textMuted: '#666666',
  primary: '#FACC15',      // flatter, less bright yellow
  accent: '#00C2CB',       // teal for secondary actions
  success: '#00C853',
  border: '#111111',
  card: '#FFFFFF',
  shadow: '#111111',
  error: '#FF3B30',
};

export const darkTheme = {
  background: '#1C1C1C',   // slightly lighter gray, less contrast clash than pure black
  surface: '#262626',
  text: '#F5F0E8',         // cream text on dark
  textMuted: '#999999',
  primary: '#FACC15',
  accent: '#00C2CB',
  success: '#00C853',
  border: '#F5F0E8',
  card: '#2C2C2C',
  shadow: 'transparent',   // remove drop shadows entirely in dark mode
  error: '#FF453A',
};

export type ThemeColors = typeof lightTheme;

