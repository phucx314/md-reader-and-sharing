import React from 'react';
import { TextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';

interface BrutalInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const BrutalInput: React.FC<BrutalInputProps> = ({ 
  label, 
  error,
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
      <TextInput
        style={[
          styles.input,
          { 
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: error ? colors.error : colors.border,
            shadowColor: error ? colors.error : colors.shadow,
          },
          style,
        ]}
        placeholderTextColor={isDark ? '#888' : '#666'}
        {...props}
      />
      {error && (
        <ThemedText style={[styles.error, { color: colors.error }]}>
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
    marginBottom: 8,
  },
  input: {
    fontFamily: 'SpaceGrotesk-Regular',
    borderWidth: 3,
    padding: 14,
    fontSize: 16,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  error: {
    marginTop: 8,
    fontSize: 12,
  },
});
