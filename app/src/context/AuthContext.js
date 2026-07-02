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
        console.log('[AuthContext] Starting auth initialization...');
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');
        
        console.log('[AuthContext] Stored token found:', !!storedToken);
        
        if (storedToken) {
          setToken(storedToken);
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
              console.log('[AuthContext] Stored user data loaded');
            } catch (err) {
              console.error('[AuthContext] Error parsing stored user data:', err);
            }
          }
          
          // Verify token against server with timeout
          try {
            console.log('[AuthContext] Verifying token with server...');
            const response = await Promise.race([
              api.get(API_ENDPOINTS.ME),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('API timeout')), 10000)
              )
            ]);
            
            if (response.data) {
              const userToStore = response.data;
              setUser(userToStore);
              await AsyncStorage.setItem('userData', JSON.stringify(userToStore));
              console.log('[AuthContext] Token verified, user data updated');
            }
          } catch (err) {
            console.error('[AuthContext] Verify token failed:', err?.message || err);
            if (err.response?.status === 401) {
              console.log('[AuthContext] Token invalid, logging out...');
              await logout();
            } else {
              // If server is unreachable or timeout, continue with stored token
              console.warn('[AuthContext] Server unreachable or timeout, continuing with stored token');
            }
          }
        }
      } catch (e) {
        console.error('[AuthContext] Failed to load auth state from AsyncStorage:', e?.message || e);
      } finally {
        console.log('[AuthContext] Auth initialization complete, loading:', false);
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
      await notificationService.registerDevice(userProfile._id || userProfile.id, userProfile.username);
      await notificationService.sendWelcomeNotification();
    } catch (error) {
      console.warn('[AuthContext] Notification setup failed:', error?.message || error);
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
