import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';

interface BrutalButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export const BrutalButton: React.FC<BrutalButtonProps> = ({ 
  title, 
  variant = 'primary', 
  loading = false,
  style, 
  ...props 
}) => {
  const { colors } = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary': return colors.primary;
      case 'danger': return colors.error;
      case 'secondary': return colors.card;
      default: return colors.primary;
    }
  };

  const getTextColor = () => {
    if (variant === 'primary' || variant === 'danger') return '#111111';
    return colors.text;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { 
          backgroundColor: getBackgroundColor(),
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
        style,
      ]}
      activeOpacity={0.8}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <ThemedText style={[styles.text, { color: getTextColor() }]}>
          {title}
        </ThemedText>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    marginBottom: 8, // Accommodate shadow
  },
  text: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
