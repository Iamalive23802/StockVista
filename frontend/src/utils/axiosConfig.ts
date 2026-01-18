import axios from 'axios';
import API_BASE from './apiBase';

// Create axios instance with dynamic base URL
const axiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60 second timeout to accommodate large uploads
});

// Add a request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Get token from session storage
    const token = sessionStorage.getItem('token');
    
    // If token exists, add to headers
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add content type if not set
    if (!config.headers['Content-Type'] && config.method !== 'get') {
      config.headers['Content-Type'] = 'application/json';
    }
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token expiration
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Response error:', error.response?.status, error.response?.data);
    
    // Handle 401 (Unauthorized) or 403 (Forbidden) responses
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Clear session storage and redirect to login
      sessionStorage.clear();
      window.location.href = '/login';
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;