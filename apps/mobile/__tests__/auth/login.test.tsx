import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import LoginScreen from '../../app/(auth)/login';
import { ThemeProvider } from '../../lib/ThemeContext';

// Router Mocks
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: any[]) => mockReplace(...args),
    push: (...args: any[]) => mockPush(...args),
  },
}));

// Auth Mock
const mockLogin = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: (...args: any[]) => mockLogin(...args),
  }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders username/password inputs and Sign In button', () => {
    const { getByPlaceholderText, getByText, queryByTestId } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();

    expect(queryByTestId('login-error')).toBeNull();
  });

  it('renders header text', () => {
    const { getByText } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    expect(getByText('Welcome Back')).toBeTruthy();
    expect(getByText('Sign in to continue')).toBeTruthy();
  });

  it('navigates to forgot password screen when "Reset it" is pressed', () => {
    const { getByText } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    fireEvent.press(getByText('Reset it'));

    expect(mockPush).toHaveBeenCalledWith('/(auth)/forgotpassword');
  });

  it('shows validation error when username and/or password is empty and does not call login', async () => {
    const { getByText, findByTestId } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    fireEvent.press(getByText('Sign In'));

    const errorNode = await findByTestId('login-error');
    expect(errorNode.props.children).toBe('Please enter your username and password');

    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows error message for invalid credentials and does not navigate', async () => {
    mockLogin.mockResolvedValueOnce({ error: 'Invalid username or password' });

    const { getByPlaceholderText, getByText, findByTestId } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText('Username'), 'wronguser');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpass');

    fireEvent.press(getByText('Sign In'));

    const errorNode = await findByTestId('login-error');
    expect(errorNode.props.children).toBe('Invalid username or password');

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows error message for network error and does not navigate', async () => {
    mockLogin.mockResolvedValueOnce({ error: 'Network error. Please try again.' });

    const { getByPlaceholderText, getByText, findByTestId } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText('Username'), 'user');
    fireEvent.changeText(getByPlaceholderText('Password'), 'pass');

    fireEvent.press(getByText('Sign In'));

    const errorNode = await findByTestId('login-error');
    expect(errorNode.props.children).toBe('Network error. Please try again.');

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('navigates to myjobs on valid login and shows no error', async () => {
    mockLogin.mockResolvedValueOnce({ error: null });

    const { getByPlaceholderText, getByText, queryByTestId } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText('Username'), 'validuser');
    fireEvent.changeText(getByPlaceholderText('Password'), 'validpass');

    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/myjobs');
    });

    expect(queryByTestId('login-error')).toBeNull();
  });

  it('shows loading state while awaiting login (spinner swap + inputs disabled + no double submit)', async () => {
    let resolveLogin: (value: { error: string | null }) => void;

    const pendingPromise = new Promise<{ error: string | null }>((resolve) => {
      resolveLogin = resolve;
    });

    mockLogin.mockReturnValueOnce(pendingPromise);

    const { getByPlaceholderText, getByText, queryByText } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    const usernameInput = getByPlaceholderText('Username');
    const passwordInput = getByPlaceholderText('Password');
    const signInText = getByText('Sign In');

    fireEvent.changeText(usernameInput, 'user');
    fireEvent.changeText(passwordInput, 'pass');

    fireEvent.press(signInText);

    // Spinner replaces text
    expect(queryByText('Sign In')).toBeNull();

    // Inputs disabled
    expect(getByPlaceholderText('Username').props.editable).toBe(false);
    expect(getByPlaceholderText('Password').props.editable).toBe(false);

    // No double submit
    fireEvent.press(signInText);
    expect(mockLogin).toHaveBeenCalledTimes(1);

    resolveLogin!({ error: 'Invalid username or password' });

    await waitFor(() => {
      expect(queryByText('Sign In')).toBeTruthy();
    });
  });
});
