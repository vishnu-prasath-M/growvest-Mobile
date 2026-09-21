import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Pressable } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const SmoothToggle = ({ value, onValueChange, activeColor = '#10B981', disabled = false }) => {
  const { isDarkMode } = useTheme();
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value ? 1 : 0,
      bounciness: 3,
      speed: 18,
      useNativeDriver: true,
    }).start();
  }, [value]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  return (
    <Pressable
      onPress={() => !disabled && onValueChange && onValueChange(!value)}
      style={{ opacity: disabled ? 0.5 : 1, padding: 2 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          backgroundColor: isDarkMode ? '#374151' : '#E2E4DC',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: activeColor || '#10B981',
              opacity: animatedValue,
              borderRadius: 14,
            },
          ]}
        />
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            transform: [{ translateX }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.22,
            shadowRadius: 3,
            elevation: 4,
          }}
        />
      </View>
    </Pressable>
  );
};

export default React.memo(SmoothToggle);
