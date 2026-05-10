import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ThemedViewProps extends ViewProps {
  card?: boolean;
}

export const ThemedView: React.FC<ThemedViewProps> = ({ style, card, children, ...props }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        { backgroundColor: card ? colors.card : colors.background },
        card && styles.card,
        card && { borderColor: colors.border, shadowColor: colors.shadow },
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
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
});
