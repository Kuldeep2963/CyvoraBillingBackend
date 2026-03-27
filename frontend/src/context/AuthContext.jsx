import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(sessionStorage.getItem('accessToken')||localStorage.getItem('accessToken'));
  const [refreshToken, setRefreshToken] = useState(sessionStorage.getItem('refreshToken')||localStorage.getItem('refreshToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('user')||localStorage.getItem('user');
    if (savedUser && accessToken) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, [accessToken]);

  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('accessToken', data.accessToken);
      storage.setItem('refreshToken', data.refreshToken);
      storage.setItem('user', JSON.stringify(data.user));

      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const refreshAccessToken = async () => {
    try {
      const token = sessionStorage.getItem('refreshToken')||localStorage.getItem('refreshToken');
      if (!token) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Token refresh failed');
      }

      // Determine which storage was used
      const storage = localStorage.getItem('accessToken') ? localStorage : sessionStorage;
      storage.setItem('accessToken', data.accessToken);
      
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.accessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      logout();
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const value = {
    user,
    accessToken,
    refreshToken,
    loading,
    login,
    logout,
    refreshAccessToken,
    isAuthenticated: !!accessToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
