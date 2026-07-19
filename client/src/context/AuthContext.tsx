import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  _id: string;
  name: string;
  username: string;
  mobileNumber: string;
  email?: string;
  role: string;
  balance?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (userData: any) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "https://growvest-mobile.onrender.com";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    const t = localStorage.getItem('token');
    return t && t !== "undefined" && t !== "null" ? t : null;
  });
  
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && savedUser !== "undefined" && savedUser !== "null") {
      try {
        const parsed = JSON.parse(savedUser);
        // Basic validation of parsed user - require at least name or username
        if (parsed && (parsed.name || parsed.username)) {
          return parsed;
        }
        return null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken && storedToken !== "undefined") {
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          } else if (response.status === 401 || response.status === 403 || response.status === 404) {
            // Token invalid, expired, or user deleted, clear everything
            logout();
          } else {
            // Server error (500, etc.) - do NOT logout, keep the current session
            console.error('Server error during auth init:', response.status);
          }
        } catch (error) {
          console.error('Auth initialization network failed:', error);
          // Network error - do NOT logout
        }
      } else {
        // No token, clear everything just in case
        logout();
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (userData: any) => {
    const userToStore = {
      _id: userData._id,
      name: userData.name,
      username: userData.username,
      mobileNumber: userData.mobileNumber,
      email: userData.email,
      role: userData.role,
      balance: userData.balance
    };
    setUser(userToStore);
    setToken(userData.token);
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userToStore));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Also clear any other potential legacy keys
    localStorage.removeItem('dbUser');
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...userData };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'user') {
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
