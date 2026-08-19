import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useNavigationState } from '@react-navigation/native';

const TABS = [
  { name: 'Home',     label: 'Home',      activeIcon: 'home',              inactiveIcon: 'home-outline' },
  { name: 'ChitFund', label: 'Chit Fund', activeIcon: 'layers',            inactiveIcon: 'layers-outline' },
  { name: 'Withdraw', label: 'Withdraw',  activeIcon: 'arrow-up-circle',   inactiveIcon: 'arrow-up-circle-outline' },
  { name: 'Profile',  label: 'Profile',   activeIcon: 'person',            inactiveIcon: 'person-outline' },
];

/**
 * A self-contained floating bottom tab bar for use inside Stack-navigator screens
 * that are displayed "on top of" a tab screen. Allows navigating back to any tab.
 *
 * Props:
 *   navigation  – React Navigation navigation object
 *   activeTab   – (optional) name of the currently "active" tab to highlight (e.g. 'ChitFund')
 */
const BottomTabBar = ({ navigation, activeTab }) => {
  const { colors: themeColors, isDarkMode } = useTheme();

  const handlePress = (tabName) => {
    // Navigate to the tab navigator and then to the specific tab
    navigation.navigate('MainTabs', { screen: tabName });
  };

  return (
    <View style={styles.outerContainer} pointerEvents="box-none">
      <View style={[
        styles.pill,
        {
          backgroundColor: isDarkMode ? 'rgba(18,24,20,0.97)' : 'rgba(255,255,255,0.97)',
          borderColor: isDarkMode ? 'rgba(24,36,28,0.8)' : 'rgba(255,255,255,0.8)',
          shadowColor: isDarkMode ? '#000000' : '#0E3D23',
        }
      ]}>
        {TABS.map((tab) => {
          const focused = tab.name === activeTab;
          return (
            <Pressable
              key={tab.name}
              onPress={() => handlePress(tab.name)}
              style={styles.tabItem}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {focused ? (
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activeTabInner}
                >
                  <Ionicons name={tab.activeIcon} size={22} color="#fff" />
                  <Text style={styles.activeLabel}>{tab.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.inactiveTabInner}>
                  <Ionicons name={tab.inactiveIcon} size={22} color={themeColors.textSecondary} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    height: 64,
    width: '100%',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1,
    paddingHorizontal: 6,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    height: 44,
    minWidth: 80,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  inactiveTabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});

export default BottomTabBar;
