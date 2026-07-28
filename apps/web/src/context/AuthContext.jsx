import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const apiBaseUrlRaw = import.meta.env.VITE_API_BASE_URL || "";
  const apiBaseUrl = apiBaseUrlRaw.replace(/\/$/, "");

  // Setup axios interceptor to add token to all requests
  useEffect(() => {
    const apiTimeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 120000);

    axios.defaults.timeout = apiTimeoutMs;

    const normalizeUrl = (url) => {
      if (!url) return url;

      if (/^http:\/\/(localhost|127\.0\.0\.1):8000/.test(url)) {
        return url.replace(/^http:\/\/(localhost|127\.0\.0\.1):8000/, apiBaseUrl);
      }

      if (url.startsWith("/api") && apiBaseUrl.startsWith("http")) {
        if (apiBaseUrl.endsWith("/api")) {
          return `${apiBaseUrl}${url.slice(4)}`;
        }
        return `${apiBaseUrl}${url}`;
      }

      return url;
    };

    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        config.url = normalizeUrl(config.url);
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('🔐 Adding auth token to request:', config.url);
        } else {
          console.warn('⚠️ No token found for request:', config.url);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.error('❌ 401 Unauthorized - clearing token and redirecting to login');
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          localStorage.removeItem('mealPlannerToken');
          localStorage.removeItem('mealPlannerUser');
          setUser(null);
          
          if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  useEffect(() => {
    // Check if user is logged in on mount
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    console.log('🔍 Checking stored credentials...');
    console.log('Token exists:', !!token);
    console.log('User exists:', !!storedUser);
    
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        console.log('✅ User restored from storage:', parsedUser.email);
      } catch (error) {
        console.error('❌ Error parsing stored user:', error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    } else {
      console.log('ℹ️ No stored credentials found');
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    console.log('🔐 Attempting login for:', email);
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });
      
      const { access_token, user: userData } = response.data;
      
      console.log('✅ Login successful:', userData.email);
      console.log('Token received:', access_token.substring(0, 20) + '...');
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('❌ Login failed:', error.response?.data || error.message);
      throw error;
    }
  };

  const register = async (name, email, password, role, gender,specialization,department,years_of_experience) => {
    console.log('📝 Attempting registration for:', email, 'as', role);
    try {
      const response = await axios.post('/api/auth/register', {
        name,
        email,
        password,
        role,
        gender,
        specialization,
        department,
        years_of_experience:years_of_experience ? Number(years_of_experience) : null
      });

      console.log('✅ Registration successful:', email);
      return response.data;
    } catch (error) {
      console.error('❌ Registration failed:', error.response?.data || error.message);
      throw error;
    }
  };

    // const verifyEmail = async (email, code) => {
    //   try {
    //     const response = await axios.post('/api/auth/verify-email', {
    //       email,
    //       code
    //     });
    //     return response.data;
    //   } catch (error) {
    //     console.error('❌ Email verification failed:', error.response?.data || error.message);
    //     throw error;
    //   }
    // };

 

  const logout = () => {
    console.log('👋 Logging out...');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('mealPlannerToken');
    localStorage.removeItem('mealPlannerUser');
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    // verifyEmail,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
