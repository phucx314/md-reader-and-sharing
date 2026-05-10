import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ThemedTextProps extends TextProps {
  type?: 'title' | 'subtitle' | 'body' | 'label';
  primary?: boolean;
}

export const ThemedText: React.FC<ThemedTextProps> = ({ 
  style, 
  type = 'body', 
  primary = false,
  children, 
  ...props 
}) => {
  const { colors } = useTheme();

  return (
    <Text
      style={[
        { color: primary ? colors.primary : colors.text },
        styles[type],
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 20,
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
});
