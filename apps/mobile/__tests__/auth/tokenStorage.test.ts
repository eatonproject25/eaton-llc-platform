import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';

import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { api, TOKEN_KEYS } from '../../services/api';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
    defaults: { headers: { common: {} } },
  },
  TOKEN_KEYS: {
    access: 'auth_access_token',
    refresh: 'auth_refresh_token',
  },
}));

let capturedAuth: ReturnType<typeof useAuth>;

function TestConsumer() {
  capturedAuth = useAuth();
  return null;
}

function renderAuth() {
  return render(
    React.createElement(
      AuthProvider,
      null,
      React.createElement(TestConsumer)
    )
  );
}

describe('token storage behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
  });

  it('stores access and refresh tokens after successful login', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { access: 'access_abc', refresh: 'refresh_def' },
    });
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { id: 123 } });

    renderAuth();
    await waitFor(() => expect(capturedAuth.isLoading).toBe(false));

    await act(async () => {
      await capturedAuth.login('driver', 'pass123');
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.access, 'access_abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.refresh, 'refresh_def');
  });

  it('clears access and refresh tokens on logout', async () => {
    renderAuth();
    await waitFor(() => expect(capturedAuth.isLoading).toBe(false));

    await act(async () => {
      await capturedAuth.logout();
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.access);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEYS.refresh);
  });
});
