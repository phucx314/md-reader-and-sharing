import React from 'react';
import { TextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';

interface BrutalInputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export const BrutalInput: React.FC<BrutalInputProps> = ({
  label,
  error,
  icon,
  style,
  ...props
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      {label && (
        <ThemedText type="label" style={styles.label}>
          {label}
        </ThemedText>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: error ? colors.error : colors.border,
            backgroundColor: colors.card,
            shadowColor: error ? colors.error : colors.shadow,
          },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isDark ? '#999' : '#666'}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            { color: colors.text, flex: 1 },
            style,
          ]}
          placeholderTextColor={isDark ? '#777' : '#999'}
          cursorColor={colors.primary}
          selectionColor={colors.primary}
          {...props}
        />
      </View>
      {error && (
        <ThemedText type="caption" style={[styles.error, { color: colors.error }]}>
          {error}
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 14,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 16,
    paddingVertical: 14,
  },
  error: {
    marginTop: 6,
  },
});
