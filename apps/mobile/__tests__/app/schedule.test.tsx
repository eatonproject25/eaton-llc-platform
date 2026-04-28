import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ActivityIndicator, Linking } from 'react-native';

import PermissionsScreen from '../../app/more/permissions';
import { ThemeProvider } from '../../lib/ThemeContext';

jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: jest.fn(),
  getMediaLibraryPermissionsAsync: jest.fn(),
}), { virtual: true });

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
}), { virtual: true });

const imagePicker = require('expo-image-picker');
const location = require('expo-location');

function renderScreen() {
  return render(
    <ThemeProvider>
      <PermissionsScreen />
    </ThemeProvider>
  );
}

describe('PermissionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    location.getBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    imagePicker.getCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
    imagePicker.getMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
  });

  it('renders loading spinner on mount', () => {
    location.getForegroundPermissionsAsync.mockImplementation(() => new Promise(() => {}));
    location.getBackgroundPermissionsAsync.mockImplementation(() => new Promise(() => {}));
    imagePicker.getCameraPermissionsAsync.mockImplementation(() => new Promise(() => {}));
    imagePicker.getMediaLibraryPermissionsAsync.mockImplementation(() => new Promise(() => {}));

    const { UNSAFE_getAllByType } = renderScreen();

    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('shows denied permissions with Open Settings actions', async () => {
    location.getBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    imagePicker.getMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { getAllByText } = renderScreen();

    await waitFor(() => {
      expect(getAllByText('Open Settings')).toHaveLength(2);
    });
  });

  it('opens system settings when Open Settings is tapped', async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Open Settings')).toBeTruthy();
    });

    fireEvent.press(getByText('Open Settings'));

    await waitFor(() => {
      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
    });

    openSettingsSpy.mockRestore();
  });

  it('refresh status re-checks all permission providers', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(location.getBackgroundPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(imagePicker.getCameraPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(imagePicker.getMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByText('Refresh Status'));

    await waitFor(() => {
      expect(location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(2);
      expect(location.getBackgroundPermissionsAsync).toHaveBeenCalledTimes(2);
      expect(imagePicker.getCameraPermissionsAsync).toHaveBeenCalledTimes(2);
      expect(imagePicker.getMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(2);
    });
  });
});
