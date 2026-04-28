import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, TOKEN_KEYS } from '../services/api';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise< {error: string | null} >;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // On app launch, check if valid tokens exist in SecureStore
    useEffect(() => {
        const checkTokens = async () => {
            try {
                const token = await SecureStore.getItemAsync(TOKEN_KEYS.access);
                setIsAuthenticated(!!token); // If token exists, user is authenticated
            } catch {
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };
        checkTokens();
    }, []);

    const login = async (username: string, password: string): Promise<{ error: string | null }> => {
        try {
            const response = await api.post('/login/', { username, password });
            const { access, refresh } = response.data;

            if (api.defaults?.headers?.common) {
                api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
            }

            // Verify the logged-in user has a Driver record before persisting tokens.
            try {
                await api.get('/drivers/me/');
            } catch (roleError) {
                await SecureStore.deleteItemAsync(TOKEN_KEYS.access);
                await SecureStore.deleteItemAsync(TOKEN_KEYS.refresh);
                if (api.defaults?.headers?.common) {
                    delete api.defaults.headers.common['Authorization'];
                }

                if (
                    axios.isAxiosError(roleError) &&
                    (roleError.response?.status === 403 || roleError.response?.status === 404)
                ) {
                    return { error: 'Access denied. This app is for drivers only.' };
                }

                throw roleError;
            }

            await SecureStore.setItemAsync(TOKEN_KEYS.access, access);
            await SecureStore.setItemAsync(TOKEN_KEYS.refresh, refresh);

            setIsAuthenticated(true);
            return { error: null };
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    return { error: 'Invalid username or password.' };
                }
                if (error.response?.status === 400) {
                    // Check if backend returned a specific error message
                    const message = error.response?.data?.detail || error.response?.data?.message;
                    if (message) {
                        return { error: message };
                    }
                    return { error: 'Invalid username or password.' };
                }
                if (!error.response) {
                    return { error: 'Network error. Please check your connection and try again.' };
                }
                if (error.response?.status === 500) {
                    return { error: 'Server error. Please try again later.' };
                }
            }

            console.error('Login error:', error);
            return { error: 'An unexpected error occurred. Please try again.' };
        }
    };

    const logout = async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEYS.access);
        await SecureStore.deleteItemAsync(TOKEN_KEYS.refresh);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}