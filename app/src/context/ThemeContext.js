import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, theme, darkTheme, updateActiveColors } from '../theme/theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme_preference');
        if (savedTheme) {
          const dark = savedTheme === 'dark';
          setIsDarkMode(dark);
          updateActiveColors(dark ? 'dark' : 'light');
        } else {
          const dark = systemScheme === 'dark';
          setIsDarkMode(dark);
          updateActiveColors(dark ? 'dark' : 'light');
        }
      } catch (error) {
        console.error('Failed to load theme preference', error);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    // Apply smooth ease-in-out layout animation transition
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    updateActiveColors(nextMode ? 'dark' : 'light');
    try {
      await AsyncStorage.setItem('theme_preference', nextMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save theme preference', error);
    }
  };

  const activeColors = isDarkMode ? darkColors : lightColors;
  const activeTheme = isDarkMode ? darkTheme : theme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors: activeColors, theme: activeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
