import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ThemedViewProps extends ViewProps {
  /** Standard card with border + hard shadow */
  card?: boolean;
  /** Yellow accent background card */
  highlight?: boolean;
  /** Remove default card padding */
  noPadding?: boolean;
}

export const ThemedView: React.FC<ThemedViewProps> = ({
  style,
  card,
  highlight,
  noPadding,
  children,
  ...props
}) => {
  const { colors } = useTheme();

  const bg = highlight
    ? colors.primary
    : card
    ? colors.card
    : colors.background;

  return (
    <View
      style={[
        { backgroundColor: bg },
        (card || highlight) && styles.card,
        (card || highlight) && {
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
        noPadding && { padding: 0 },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 3,
    padding: 16,
    // Hard offset shadow — zero blur is the neo-brutalism signature
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
});
