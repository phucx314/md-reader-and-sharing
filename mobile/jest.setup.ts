// Mock all native modules and third-party libraries before anything else
jest.mock('@expo-google-fonts/space-grotesk', () => ({
  useFonts: () => [true],
  SpaceGrotesk_400Regular: null,
  SpaceGrotesk_500Medium: null,
  SpaceGrotesk_700Bold: null,
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue('# Hello'),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return ({ children }: any) => Text({ children });
});

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useFocusEffect: (cb: () => void) => { cb(); },
}));

jest.mock('./src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#F5F0E8',
      surface: '#FFFEF2',
      text: '#111111',
      textMuted: '#666666',
      primary: '#FFE500',
      accent: '#00C2CB',
      success: '#00C853',
      border: '#111111',
      card: '#FFFFFF',
      shadow: '#111111',
      error: '#FF3B30',
    },
    isDark: false,
    toggleTheme: jest.fn(),
  }),
  ThemeProvider: ({ children }: any) => children,
}));

jest.mock('./src/context/AuthContext', () => ({
  useAuth: () => ({
    token: null,
    login: jest.fn(),
    logout: jest.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('./src/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn().mockResolvedValue({ data: { access_token: 'mock_token', url: 'http://test.com/view/abc' } }),
    delete: jest.fn().mockResolvedValue({}),
  },
}));
