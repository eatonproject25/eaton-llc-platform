import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import ForgotPasswordScreen from '../../app/(auth)/forgotpassword';
import { ThemeProvider } from '../../lib/ThemeContext';
import { api } from '../../services/api';

const mockBack = jest.fn();

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-router', () => ({
  router: {
    back: (...args: any[]) => mockBack(...args),
  },
}));

jest.mock('../../services/api', () => ({
  api: {
    post: jest.fn(),
  },
}));

describe('Forgot Password Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header text', () => {
    const { getByText } = render(
      <ThemeProvider>
        <ForgotPasswordScreen />
      </ThemeProvider>
    );

    expect(getByText('Reset Password')).toBeTruthy();
    expect(getByText('Enter your email to receive a reset code')).toBeTruthy();
  });

  it('renders step 1 fields and CTA button', () => {
    const { getByPlaceholderText, getByText } = render(
      <ThemeProvider>
        <ForgotPasswordScreen />
      </ThemeProvider>
    );

    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByText('Send Code')).toBeTruthy();
  });

  it('shows validation error when email is empty', async () => {
    const { getByText, findByText } = render(
      <ThemeProvider>
        <ForgotPasswordScreen />
      </ThemeProvider>
    );

    fireEvent.press(getByText('Send Code'));

    expect(await findByText('Please enter your email address')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('advances to code verification step after successful send code', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({ data: {} });

    const { getByPlaceholderText, getByText, findByText } = render(
      <ThemeProvider>
        <ForgotPasswordScreen />
      </ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'driver@example.com');
    fireEvent.press(getByText('Send Code'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/password-reset/', { email: 'driver@example.com' });
    });

    expect(await findByText('Check Your Email')).toBeTruthy();
    expect(getByText('Verify Code')).toBeTruthy();
  });

  it('navigates back to login from step 1', () => {
    const { getByText } = render(
      <ThemeProvider>
        <ForgotPasswordScreen />
      </ThemeProvider>
    );

    fireEvent.press(getByText('Sign In'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
