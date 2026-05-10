import React from 'react';
import { Text, TextProps, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ThemedTextProps extends TextProps {
  type?: 'display' | 'title' | 'subtitle' | 'body' | 'label' | 'caption';
  primary?: boolean;
  muted?: boolean;
  /** Wraps text in a yellow highlight pill */
  highlight?: boolean;
}

export const ThemedText: React.FC<ThemedTextProps> = ({
  style,
  type = 'body',
  primary = false,
  muted = false,
  highlight = false,
  children,
  ...props
}) => {
  const { colors } = useTheme();

  const color = primary
    ? colors.primary
    : muted
    ? colors.textMuted
    : colors.text;

  const textEl = (
    <Text
      style={[{ color }, styles[type], style]}
      {...props}
    >
      {children}
    </Text>
  );

  if (highlight) {
    return (
      <View
        style={[
          styles.highlightPill,
          { backgroundColor: colors.primary, borderColor: colors.border },
        ]}
      >
        <Text style={[{ color: '#111111' }, styles[type], style]} {...props}>
          {children}
        </Text>
      </View>
    );
  }

  return textEl;
};

const styles = StyleSheet.create({
  display: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
  },
  title: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    fontFamily: 'SpaceGrotesk-Medium',
    fontSize: 14,
    fontWeight: '600',
  },
  caption: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  highlightPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 2,
    borderRadius: 4,
  },
});
