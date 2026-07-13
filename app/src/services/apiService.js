import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

console.log('[apiService] Initializing with base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout
});

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('[apiService] Error getting token from storage:', error?.message || error);
    }
    return config;
  },
  (error) => {
    console.error('[apiService] Request interceptor error:', error?.message || error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error('[apiService] Response error:', error?.message || error, 'Status:', error.response?.status);
    console.error('[apiService] Error response data:', error.response?.data);
    
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage
      try {
        await AsyncStorage.multiRemove(['userToken', 'userData']);
        console.log('[apiService] Cleared auth tokens due to 401');
      } catch (clearError) {
        console.error('[apiService] Error clearing storage:', clearError?.message || clearError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
