import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface BrutalSwitchProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
}

export const BrutalSwitch: React.FC<BrutalSwitchProps> = ({ value, onValueChange }) => {
  const { colors } = useTheme();
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      friction: 5,
      tension: 60,
    }).start();
  }, [value, animValue]);

  const thumbLeft = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
    >
      <View style={[
        styles.track,
        { 
          backgroundColor: value ? colors.primary : colors.card,
          borderColor: colors.border,
        }
      ]}>
        <Animated.View style={[
          styles.thumb,
          { 
            left: thumbLeft,
            backgroundColor: '#111',
            borderColor: colors.border,
          }
        ]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    shadowColor: '#111',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
});
