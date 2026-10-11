import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { AuthContext } from './useAuth';

const API_URL = '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const initializationStarted = useRef(false);

  const setAuthHeader = useCallback((t) => {
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await axios.post(`${API_URL}/auth/logout`, {}, { timeout: 2000 }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('token');
      setAuthHeader(null);
      setToken(null);
      setUser(null);
      toast.success('Logged out successfully.');
      setLoading(false);
    }
  }, [token, setAuthHeader]);

  useEffect(() => {
    // Only run once
    if (initializationStarted.current) return;
    initializationStarted.current = true;

    let isMounted = true;

    // FAIL-SAFE: Force loading to false after 7 seconds no matter what
    const failSafeTimer = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Auth initialization timed out (Fail-Safe triggered)');
        setLoading(false);
      }
    }, 7000);
    
    const initializeAuth = async () => {
      console.log('Starting Auth Initialization...');
      const storedToken = localStorage.getItem('token');
      
      if (!storedToken || storedToken === 'undefined' || storedToken === 'null') {
        console.log('No valid token found in storage');
        if (isMounted) {
          localStorage.removeItem('token');
          setLoading(false);
        }
        return;
      }

      try {
        // Set local header for this specific check
        console.log('Fetching user profile with timeout...');
        const response = await axios.get(`${API_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${storedToken}` },
          timeout: 5000 // 5 second timeout for the request itself
        });
        
        if (isMounted && response.data.status === 'success') {
          console.log('Auth Check Success: User found');
          setAuthHeader(storedToken);
          setUser(response.data.data.user);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Auth Check Failed:', error.message, error.code);
          
          // Clear credentials on definite auth errors
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.log('Session invalid, clearing storage');
            localStorage.removeItem('token');
            setAuthHeader(null);
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        if (isMounted) {
          console.log('Initialization flow finished');
          setLoading(false);
          clearTimeout(failSafeTimer);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      clearTimeout(failSafeTimer);
    };
  }, [setAuthHeader]); // Run once on mount

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token: newToken, user: newUser } = response.data.data;
      localStorage.setItem('token', newToken);
      setAuthHeader(newToken);
      setToken(newToken);
      setUser(newUser);
      toast.success('Login successful!');
      return { success: true, user: newUser };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed.';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const value = {
    user, token, loading, login, logout,
    isAuthenticated: !!token,
    register: (data) => axios.post(`${API_URL}/auth/register`, data),
    updateProfile: async (data) => {
      const res = await axios.put(`${API_URL}/auth/profile`, data);
      setUser(res.data.data.user);
      return res;
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : (
        <div className="d-flex justify-content-center align-items-center vh-100 bg-white">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status"></div>
            <h5 className="text-muted">Initializing Edulens LMS...</h5>
            <p className="extra-small text-muted">Checking authentication status...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};