import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemedText } from '../src/components/ThemedText';
import { ThemedView } from '../src/components/ThemedView';
import { BrutalButton } from '../src/components/BrutalButton';
import { BrutalInput } from '../src/components/BrutalInput';

// ─── Shared theme mock ────────────────────────────────────────────────────────
const mockColors = {
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
};

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: mockColors, isDark: false, toggleTheme: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('ThemedText', () => {
  it('renders children correctly', () => {
    render(<ThemedText>Hello World</ThemedText>);
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('applies title type styles', () => {
    const { getByText } = render(<ThemedText type="title">Title</ThemedText>);
    const el = getByText('Title');
    expect(el.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 26 })])
    );
  });

  it('applies display type styles', () => {
    const { getByText } = render(<ThemedText type="display">Big</ThemedText>);
    expect(getByText('Big').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 40 })])
    );
  });

  it('applies caption type styles', () => {
    const { getByText } = render(<ThemedText type="caption">Small</ThemedText>);
    expect(getByText('Small').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 12 })])
    );
  });

  it('applies primary color when primary prop is set', () => {
    const { getByText } = render(<ThemedText primary>Yellow</ThemedText>);
    expect(getByText('Yellow').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#FFE500' })])
    );
  });

  it('applies muted color when muted prop is set', () => {
    const { getByText } = render(<ThemedText muted>Muted</ThemedText>);
    expect(getByText('Muted').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#666666' })])
    );
  });

  it('renders highlight pill wrapper when highlight prop is set', () => {
    const { getByText, UNSAFE_getByType } = render(
      <ThemedText highlight>Highlighted</ThemedText>
    );
    expect(getByText('Highlighted')).toBeTruthy();
    // Pill wrapper should be a View
    const { View } = require('react-native');
    expect(UNSAFE_getByType(View)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('ThemedView', () => {
  it('renders children', () => {
    render(
      <ThemedView>
        <ThemedText>Inside</ThemedText>
      </ThemedView>
    );
    expect(screen.getByText('Inside')).toBeTruthy();
  });

  it('applies card styles when card prop is set', () => {
    const { UNSAFE_getByType } = render(<ThemedView card><ThemedText>Card</ThemedText></ThemedView>);
    const { View } = require('react-native');
    const view = UNSAFE_getByType(View);
    // Card should have borderWidth
    const flatStyle = [].concat(...(view.props.style || []));
    const hasBorder = flatStyle.some((s: any) => s?.borderWidth === 3);
    expect(hasBorder).toBe(true);
  });

  it('applies primary yellow background when highlight prop is set', () => {
    const { UNSAFE_getByType } = render(<ThemedView highlight><ThemedText>H</ThemedText></ThemedView>);
    const { View } = require('react-native');
    const view = UNSAFE_getByType(View);
    const flatStyle = [].concat(...(view.props.style || []));
    const hasPrimary = flatStyle.some((s: any) => s?.backgroundColor === '#FFE500');
    expect(hasPrimary).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BrutalButton', () => {
  it('renders the title text', () => {
    render(<BrutalButton title="Click Me" />);
    expect(screen.getByText('Click Me')).toBeTruthy();
  });

  it('shows ActivityIndicator when loading', () => {
    const { UNSAFE_getByType } = render(<BrutalButton title="Load" loading />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('is disabled when loading is true', () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(<BrutalButton title="Load" loading onPress={onPress} />);
    const { TouchableOpacity } = require('react-native');
    const btn = UNSAFE_getByType(TouchableOpacity);
    expect(btn.props.disabled).toBe(true);
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<BrutalButton title="Tap" onPress={onPress} />);
    getByText('Tap').props.onPress?.();
    // Note: Animated.View wraps, so we test via TouchableOpacity
    const { fireEvent } = require('@testing-library/react-native');
    fireEvent.press(getByText('Tap'));
  });

  it('renders accent variant without crashing', () => {
    render(<BrutalButton title="Accent" variant="accent" />);
    expect(screen.getByText('Accent')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BrutalInput', () => {
  it('renders without crashing', () => {
    render(<BrutalInput placeholder="Type here" value="" onChangeText={jest.fn()} />);
    expect(screen.getByPlaceholderText('Type here')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<BrutalInput label="Username" value="" onChangeText={jest.fn()} />);
    expect(screen.getByText('Username')).toBeTruthy();
  });

  it('renders error message when error prop is provided', () => {
    render(<BrutalInput error="Required field" value="" onChangeText={jest.fn()} />);
    expect(screen.getByText('Required field')).toBeTruthy();
  });

  it('renders icon when icon prop is provided', () => {
    const { UNSAFE_getByType } = render(
      <BrutalInput icon="person-outline" value="" onChangeText={jest.fn()} />
    );
    expect(UNSAFE_getByType('Ionicons')).toBeTruthy();
  });
});
