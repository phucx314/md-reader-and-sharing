import React, { useRef } from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ActivityIndicator,
  Animated,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';

interface BrutalButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const BrutalButton: React.FC<BrutalButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  style,
  onPress,
  ...props
}) => {
  const { colors } = useTheme();
  const pressed = useRef(new Animated.Value(0)).current;

  const bgMap = {
    primary: colors.primary,
    secondary: colors.card,
    accent: colors.accent,
    danger: colors.error,
  };

  const textColorMap = {
    primary: '#111111',
    secondary: colors.text,
    accent: '#111111',
    danger: '#FFFFFF',
  };

  const handlePressIn = () => {
    Animated.timing(pressed, { toValue: 1, duration: 60, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressed, { toValue: 0, duration: 100, useNativeDriver: true }).start();
  };

  // Simulate pressing down: translate + shrink shadow
  const translateXY = pressed.interpolate({ inputRange: [0, 1], outputRange: [0, 2] });
  const shadowOpacity = pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const sizePad = { sm: { paddingVertical: 8, paddingHorizontal: 16 }, md: { paddingVertical: 14, paddingHorizontal: 24 }, lg: { paddingVertical: 18, paddingHorizontal: 32 } }[size];
  const fontSize = { sm: 13, md: 15, lg: 17 }[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={loading || props.disabled}
      style={[fullWidth && { width: '100%' }, style]}
      {...props}
    >
      {/* Shadow layer — offset behind button */}
      <Animated.View
        style={[
          styles.shadow,
          { backgroundColor: colors.shadow, opacity: shadowOpacity },
        ]}
      />
      <Animated.View
        style={[
          styles.button,
          sizePad,
          {
            backgroundColor: bgMap[variant],
            borderColor: colors.border,
            transform: [{ translateX: translateXY }, { translateY: translateXY }],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColorMap[variant]} size="small" />
        ) : (
          <ThemedText
            type="label"
            style={[styles.text, { color: textColorMap[variant], fontSize }]}
          >
            {title}
          </ThemedText>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  shadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    zIndex: 0,
  },
  text: {
    fontFamily: 'SpaceGrotesk-Bold',
    letterSpacing: 0.3,
  },
});
