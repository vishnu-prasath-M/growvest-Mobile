import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/apiService';
import { API_ENDPOINTS } from '../config/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');
        
        if (storedToken) {
          setToken(storedToken);
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch (err) {
              console.error('Error parsing stored user data:', err);
            }
          }
          
          // Verify token against server
          try {
            const response = await api.get(API_ENDPOINTS.ME);
            if (response.data) {
              const userToStore = response.data;
              setUser(userToStore);
              await AsyncStorage.setItem('userData', JSON.stringify(userToStore));
            }

            try {
              const { notificationService } = await import('../services/notificationService');
              await notificationService.syncTokenWithBackend();
            } catch (syncError) {
              console.warn('FCM token sync on startup failed:', syncError?.message || syncError);
            }
          } catch (err) {
            console.error('Verify token failed:', err);
            if (err.response?.status === 401) {
              await logout();
            }
          }
        }
      } catch (e) {
        console.error('Failed to load auth state from AsyncStorage:', e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (userToken, userData) => {
    setToken(userToken);
    const { token: _, ...userProfile } = userData;
    setUser(userProfile);
    await AsyncStorage.setItem('userToken', userToken);
    await AsyncStorage.setItem('userData', JSON.stringify(userProfile));

    try {
      const { notificationService } = await import('../services/notificationService');
      await notificationService.syncTokenWithBackend();
    } catch (error) {
      console.warn('FCM token sync after login failed:', error?.message || error);
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove(['userToken', 'userData']);
  };

  const updateUser = async (newUserData) => {
    const updated = user ? { ...user, ...newUserData } : newUserData;
    setUser(updated);
    await AsyncStorage.setItem('userData', JSON.stringify(updated));
    return updated;
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
