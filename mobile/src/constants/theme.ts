export const lightTheme = {
  background: '#F5F0E8',   // warm cream — key neo-brutalism tone
  surface: '#FFFEF2',      // slightly warmer white for cards
  text: '#111111',
  textMuted: '#666666',
  primary: '#FFE500',      // signature yellow
  accent: '#00C2CB',       // teal for secondary actions
  success: '#00C853',
  border: '#111111',
  card: '#FFFFFF',
  shadow: '#111111',
  error: '#FF3B30',
};

export const darkTheme = {
  background: '#0F0F0F',
  surface: '#1A1A1A',
  text: '#F5F0E8',         // cream text on dark — easier on eyes
  textMuted: '#999999',
  primary: '#FFE500',
  accent: '#00C2CB',
  success: '#00C853',
  border: '#F5F0E8',
  card: '#222222',
  shadow: '#FFE500',
  error: '#FF453A',
};

export type ThemeColors = typeof lightTheme;

