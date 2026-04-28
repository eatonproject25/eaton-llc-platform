import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as SecureStore from 'expo-secure-store';

import { api, TOKEN_KEYS } from '../../services/api';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
    router: {
        replace: (...args: any[]) => mockRouterReplace(...args),
    },
}));

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('api interceptors', () => {
    let mock: MockAdapter;

    beforeEach(() => {
        mock = new MockAdapter(api);
        jest.clearAllMocks();
    });

    afterEach(() => {
        mock.restore();
    });

    // ── Request interceptor ───────────────────────────────────────────────────

    describe('request interceptor', () => {
        it('attaches Authorization header when a token is stored', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('test-token');
            mock.onGet('/test').reply(200, {});

            await api.get('/test');

            expect(mock.history.get[0].headers?.Authorization).toBe('Bearer test-token');
        });

        it('does not attach Authorization header when no token is stored', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
            mock.onGet('/test').reply(200, {});

            await api.get('/test');

            expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
        });
    });

    // ── Response interceptor ──────────────────────────────────────────────────

    describe('response interceptor', () => {
        it('refreshes the access token on 401 and retries the original request', async () => {
            // First call → 401, second call (retry) → 200
            mock.onGet('/protected').replyOnce(401).onGet('/protected').replyOnce(200, { ok: true });

            // SecureStore: access token for the first request, refresh token during refresh flow,
            // then access token again for the retried request
            (SecureStore.getItemAsync as jest.Mock)
                .mockResolvedValueOnce('old-access-token')   // request interceptor — initial attempt
                .mockResolvedValueOnce('valid-refresh-token') // response interceptor — refresh flow
                .mockResolvedValueOnce('new-access-token');  // request interceptor — retry

            // Mock the token refresh call (uses global axios.post, not the api instance)
            jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: { access: 'new-access-token' },
            });

            const response = await api.get('/protected');

            expect(response.data).toEqual({ ok: true });
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.access, 'new-access-token');
        });

        it('clears tokens and redirects to login when the refresh call also fails', async () => {
            mock.onGet('/protected').replyOnce(401);

            (SecureStore.getItemAsync as jest.Mock)
                .mockResolvedValueOnce('old-access-token')   // request interceptor
                .mockResolvedValueOnce('expired-refresh-token'); // response interceptor

            // Refresh fails
            jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Refresh failed'));

            await expect(api.get('/protected')).rejects.toThrow();

            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.access);
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.refresh);
            expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/login');
        });
    });
});