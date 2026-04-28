import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ActivityIndicator, Alert, Linking } from 'react-native';

import JobDetailScreen from '../../app/job/[id]';
import { ThemeProvider } from '../../lib/ThemeContext';
import { Job } from '../../lib/types';
import { api } from '../../services/api';

const mockShowActionSheetWithOptions = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '123' }),
}));

jest.mock('@expo/react-native-action-sheet', () => ({
  useActionSheet: () => ({
    showActionSheetWithOptions: (...args: any[]) => mockShowActionSheetWithOptions(...args),
  }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

jest.mock('../../contexts/ClockContext', () => ({
  useClock: () => ({
    isClockedIn: true,
    clockLoading: false,
    isTracking: false,
    handleClockToggle: jest.fn(),
  }),
}));

const mockApiGet = api.get as jest.Mock;
const mockApiPatch = api.patch as jest.Mock;

const makeJob = (): Job => ({
  id: 123,
  job_number: 'JOB-123',
  project: 'Mankato Civic Project',
  job_date: '2026-03-28',
  shift_start: '09:00',
  material: 'Concrete',
  job_foreman_name: 'Alex Foreman',
  job_foreman_contact: '555-2200',
  additional_notes: 'Deliver before noon',
  loading_address: 1,
  unloading_address: 2,
  loading_address_info: {
    id: 1,
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
    id: 2,
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
  driver_assignments: [
    {
      id: 77,
      driver_truck_info: {
        id: 8,
        driver: 'Jamie Driver',
        truck_type: 'Dump Truck',
        driver_phone: '555-3300',
      },
      status: 'assigned',
      started_at: '2026-03-28T14:00:00Z',
      on_site_at: null,
      completed_at: null,
      assigned_at: '2026-03-28T13:00:00Z',
      unassigned_at: null,
      backhaul_status: null,
      backhaul_started_at: null,
      backhaul_on_site_at: null,
      backhaul_completed_at: null,
    },
  ],
});

function renderScreen(queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <JobDetailScreen />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('JobDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockShowActionSheetWithOptions.mockImplementation((_options: any, callback: (i?: number) => void) => {
      callback(0);
    });
  });

  it('renders loading spinner on mount', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}));

    const { UNSAFE_getByType } = renderScreen();

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders key job fields after load', async () => {
    mockApiGet.mockResolvedValueOnce({ data: makeJob() });

    const { getByText, getAllByText } = renderScreen();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/jobs/123/');
      expect(getByText('JOB-123')).toBeTruthy();
      expect(getByText('Mankato Civic Project')).toBeTruthy();
      expect(getByText('2026-03-28 · 09:00')).toBeTruthy();
      expect(getByText('Concrete')).toBeTruthy();
      expect(getByText('Mankato Yard')).toBeTruthy();
      expect(getByText('100 Riverfront Dr, Mankato, MN')).toBeTruthy();
      expect(getByText('River Bend Site')).toBeTruthy();
      expect(getByText('Alex Foreman')).toBeTruthy();
      expect(getByText('555-2200')).toBeTruthy();
      expect(getByText('Dump Truck')).toBeTruthy();
      expect(getByText('Jamie Driver · 555-3300')).toBeTruthy();
      expect(getAllByText('Assigned').length).toBeGreaterThan(0);
    });
  });

  it('calls PATCH when status is updated', async () => {
    const job = makeJob();
    mockApiGet.mockResolvedValueOnce({ data: job });
    mockApiPatch.mockResolvedValueOnce({
      data: {
        id: 77,
        status: 'en_route',
        started_at: '2026-03-28T14:30:00Z',
        on_site_at: null,
        completed_at: null,
      },
    });

    const { getAllByText } = renderScreen();

    await waitFor(() => {
      expect(getAllByText('Assigned').length).toBeGreaterThan(0);
    });

    fireEvent.press(getAllByText('Assigned')[0]);

    await waitFor(() => {
      expect(mockShowActionSheetWithOptions).toHaveBeenCalled();
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/job-driver-assignments/77/status/',
        expect.objectContaining({
          status: 'en_route',
          expected_status: 'assigned',
          occurred_at: expect.any(String),
        })
      );
      expect(mockApiGet).toHaveBeenCalledTimes(1);
      expect(getAllByText('En Route').length).toBeGreaterThan(0);
    });
  });

  it('rolls back status and alerts when PATCH fails', async () => {
    mockApiGet.mockResolvedValueOnce({ data: makeJob() });
    mockApiPatch.mockRejectedValueOnce(new Error('Patch failed'));

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByText, getAllByText } = renderScreen();

    await waitFor(() => {
      expect(getAllByText('Assigned').length).toBeGreaterThan(0);
    });

    fireEvent.press(getAllByText('Assigned')[0]);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/job-driver-assignments/77/status/',
        expect.objectContaining({
          status: 'en_route',
          expected_status: 'assigned',
          occurred_at: expect.any(String),
        })
      );
      expect(getAllByText('Assigned').length).toBeGreaterThan(0);
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to update status',
        'Patch failed'
      );
    });

    alertSpy.mockRestore();
  });

  it('openMaps triggers Alert.alert with expected options', async () => {
    mockApiGet.mockResolvedValueOnce({ data: makeJob() });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Mankato Yard')).toBeTruthy();
    });

    fireEvent.press(getByText('Mankato Yard'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
      const call = alertSpy.mock.calls[0];
      expect(call[0]).toBe('Open in Maps');
      expect(call[1]).toBe('Mankato Yard');
      expect(call[2]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Google Maps' }),
          expect.objectContaining({ text: 'Apple Maps' }),
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        ])
      );
    });

    alertSpy.mockRestore();
  });

  it('tap-to-call uses Linking.openURL with tel scheme', async () => {
    mockApiGet.mockResolvedValueOnce({ data: makeJob() });

    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined);

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('555-2200')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('555-2200'));
    });

    expect(openUrlSpy).toHaveBeenCalledWith('tel:555-2200');

    openUrlSpy.mockRestore();
  });

  it('keeps rendering cached job data when refetch fails offline', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
      },
    });

    queryClient.setQueryData(['job', '123'], makeJob());
    mockApiGet.mockRejectedValueOnce(new Error('Network Error'));

    const { getByText, queryByText } = renderScreen(queryClient);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/jobs/123/');
    });

    expect(getByText('JOB-123')).toBeTruthy();
    expect(queryByText('Network Error')).toBeNull();
  });
});