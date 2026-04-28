import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, TouchableOpacity } from 'react-native';

import MyJobsScreen from '../../app/(tabs)/myjobs';
import { ThemeProvider } from '../../lib/ThemeContext';
import { Job } from '../../lib/types';
import { api } from '../../services/api';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
  useNavigation: () => ({
    setOptions: jest.fn(),
  }),
}));

jest.mock('../../services/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

jest.mock('../../contexts/ClockContext', () => ({
  useClock: () => ({
    isClockedIn: false,
    clockLoading: false,
    isTracking: false,
    handleClockToggle: jest.fn(),
  }),
}));

const mockApiGet = api.get as jest.Mock;

const makeJob = (id: number): Job => ({
  id,
  job_number: `JOB-${id}`,
  project: `Project ${id}`,
  job_date: '2026-03-28',
  shift_start: '08:00',
  material: 'Concrete',
  job_foreman_name: 'John Foreman',
  job_foreman_contact: '555-0100',
  additional_notes: 'Handle with care',
  loading_address: 10,
  unloading_address: 20,
  loading_address_info: {
    id: 10,
    street_address: '100 Riverfront Dr',
    city: 'Mankato',
    state: 'MN',
    zip_code: '56001',
    country: 'USA',
    location_name: 'Mankato Yard',
    location_type: 'yard',
    latitude: '44.1636',
    longitude: '-93.9994',
  },
  unloading_address_info: {
    id: 20,
    street_address: '20 Madison Ave',
    city: 'North Mankato',
    state: 'MN',
    zip_code: '56003',
    country: 'USA',
    location_name: 'River Bend Site',
    location_type: 'jobsite',
    latitude: '44.1733',
    longitude: '-94.0338',
  },
  backhaul_loading_address_info: null,
  backhaul_unloading_address_info: null,
  is_backhaul_enabled: false,
  driver_assignments: [],
});

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MyJobsScreen />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('MyJobsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
  });

  it('renders loading spinner on mount', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}));

    const { UNSAFE_getByType } = renderScreen();

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders job cards when API returns data', async () => {
    const jobs = [makeJob(1), makeJob(2)];
    mockApiGet.mockResolvedValueOnce({ data: jobs });

    const { getByText, getAllByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('JOB-1')).toBeTruthy();
      expect(getByText('Project 1')).toBeTruthy();
      expect(getAllByText('Concrete · Mankato')).toHaveLength(2);
      expect(getByText('JOB-2')).toBeTruthy();
    });
  });

  it('renders empty state when API returns an empty array', async () => {
    mockApiGet.mockResolvedValueOnce({ data: [] });

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('No jobs assigned yet')).toBeTruthy();
    });
  });

  it('shows error state on network failure', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network down'));

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Network down')).toBeTruthy();
      expect(getByText('Tap to retry')).toBeTruthy();
    });
  });

  it('pull-to-refresh calls fetch again', async () => {
    mockApiGet.mockResolvedValue({ data: [] });

    const { UNSAFE_getAllByType, getByText } = renderScreen();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(1);
      expect(getByText('No jobs assigned yet')).toBeTruthy();
    });

    const touchables = UNSAFE_getAllByType(TouchableOpacity);

    await act(async () => {
      await touchables[0].props.onPress();
    });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(2);
    });
  });

  it('navigates to job detail when a job card is pressed', async () => {
    mockApiGet.mockResolvedValue({ data: [makeJob(99)] });

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('JOB-99')).toBeTruthy();
    });

    fireEvent.press(getByText('JOB-99'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/job/[id]',
      params: { id: 99 },
    });
  });
});