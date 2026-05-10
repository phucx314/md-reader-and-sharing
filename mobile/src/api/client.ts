import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API URL is set via EXPO_PUBLIC_API_URL in your .env file
// For physical device: your computer's local IP (e.g., 192.168.x.x)
// For Android emulator: 10.0.2.2
// For iOS simulator: localhost
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.2.46:8000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
