import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';

import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { api, TOKEN_KEYS } from '../../services/api';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

jest.mock('../../services/api', () => ({
    api: {
        post: jest.fn(),
        get: jest.fn(),
    },
    TOKEN_KEYS: {
        access: 'auth_access_token',
        refresh: 'auth_refresh_token',
    },
}));

// ─── Test consumer ─────────────────────────────────────────────────────────────
// Renders inside AuthProvider and captures the context value for assertions.

let capturedAuth: ReturnType<typeof useAuth>;

function TestConsumer() {
    capturedAuth = useAuth();
    return null;
}

function renderAuth() {
    return render(
        <AuthProvider>
            <TestConsumer />
        </AuthProvider>
    );
}

// ─── Error factories ───────────────────────────────────────────────────────────

const make401Error = () =>
    Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        response: { status: 401 },
    });

const makeNetworkError = () =>
    Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        response: undefined,
    });

const make404Error = () =>
    Object.assign(new Error('Not Found'), {
        isAxiosError: true,
        response: { status: 404 },
    });

const make403Error = () =>
    Object.assign(new Error('Forbidden'), {
        isAxiosError: true,
        response: { status: 403 },
    });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Token check on app launch ─────────────────────────────────────────────

    describe('token check on launch', () => {
        it('sets isAuthenticated true if a stored token exists', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');

            renderAuth();

            await waitFor(() => expect(capturedAuth.isLoading).toBe(false));
            expect(capturedAuth.isAuthenticated).toBe(true);
        });

        it('sets isAuthenticated false if no stored token', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

            renderAuth();

            await waitFor(() => expect(capturedAuth.isLoading).toBe(false));
            expect(capturedAuth.isAuthenticated).toBe(false);
        });
    });

    // ── login() ───────────────────────────────────────────────────────────────

    describe('login()', () => {
        beforeEach(() => {
            // Suppress the initial token check so it doesn't interfere
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
        });

        it('success — stores tokens and sets isAuthenticated true', async () => {
            (api.post as jest.Mock).mockResolvedValueOnce({
                data: { access: 'access-tok', refresh: 'refresh-tok' },
            });
            (api.get as jest.Mock).mockResolvedValueOnce({ data: { id: 123 } });

            renderAuth();
            await waitFor(() => expect(capturedAuth.isLoading).toBe(false));

            let result: { error: string | null };
            await act(async () => {
                result = await capturedAuth.login('driver1', 'pass123');
            });

            expect(result!.error).toBeNull();
            expect(api.get).toHaveBeenCalledWith('/drivers/me/');
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.access, 'access-tok');
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.refresh, 'refresh-tok');
            expect(capturedAuth.isAuthenticated).toBe(true);
        });

        it('failure — 401 returns invalid credentials error and stays logged out', async () => {
            (api.post as jest.Mock).mockRejectedValueOnce(make401Error());

            renderAuth();
            await waitFor(() => expect(capturedAuth.isLoading).toBe(false));

            let result: { error: string | null };
            await act(async () => {
                result = await capturedAuth.login('bad', 'creds');
            });

            expect(result!.error).toBe('Invalid username or password.');
            expect(api.get).not.toHaveBeenCalled();
            expect(capturedAuth.isAuthenticated).toBe(false);
        });

        it('failure — network error returns network error message and stays logged out', async () => {
            (api.post as jest.Mock).mockRejectedValueOnce(makeNetworkError());

            renderAuth();
            await waitFor(() => expect(capturedAuth.isLoading).toBe(false));

            let result: { error: string | null };
            await act(async () => {
                result = await capturedAuth.login('user', 'pass');
            });

            expect(result!.error).toBe('Network error. Please check your connection and try again.');
            expect(api.get).not.toHaveBeenCalled();
            expect(capturedAuth.isAuthenticated).toBe(false);
        });

        it('login blocked (non-driver) — returns access denied error and deletes tokens', async () => {
            (api.post as jest.Mock).mockResolvedValueOnce({
                data: { access: 'access-tok', refresh: 'refresh-tok' },
            });
            (api.get as jest.Mock).mockRejectedValueOnce(make404Error());

            renderAuth();
            await waitFor(() => expect(capturedAuth.isLoading).toBe(false));

            let result: { error: string | null };
            await act(async () => {
                result = await capturedAuth.login('non-driver', 'pass123');
            });

            expect(result!.error).toBe('Access denied. This app is for drivers only.');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.access);
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.refresh);
            expect(capturedAuth.isAuthenticated).toBe(false);
        });

        it('login blocked (non-driver permission denied) — returns access denied on 403 and deletes tokens', async () => {
            (api.post as jest.Mock).mockResolvedValueOnce({
                data: { access: 'access-tok', refresh: 'refresh-tok' },
            });
            (api.get as jest.Mock).mockRejectedValueOnce(make403Error());

            renderAuth();
            await waitFor(() => expect(capturedAuth.isLoading).toBe(false));

            let result: { error: string | null };
            await act(async () => {
                result = await capturedAuth.login('non-driver', 'pass123');
            });

            expect(result!.error).toBe('Access denied. This app is for drivers only.');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.access);
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.refresh);
            expect(capturedAuth.isAuthenticated).toBe(false);
        });
    });

    // ── logout() ──────────────────────────────────────────────────────────────

    describe('logout()', () => {
        it('clears both tokens from SecureStore and sets isAuthenticated false', async () => {
            // Start authenticated
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');

            renderAuth();
            await waitFor(() => expect(capturedAuth.isAuthenticated).toBe(true));

            await act(async () => {
                await capturedAuth.logout();
            });

            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.access);
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.refresh);
            expect(capturedAuth.isAuthenticated).toBe(false);
        });
    });
});