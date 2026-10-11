import { createContext, useContext } from 'react';

// Kept apart from AuthContext.jsx so that file only exports a component (required for Vite fast refresh).
export const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);
