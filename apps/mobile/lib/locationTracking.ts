import axios from 'axios';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';

export const LOCATION_TASK_NAME = 'background-location-task';
// background task definition + start/stop functions for live tracking

// needs to be defined at the module level, outside any component
// expo-task-manager requires the task to be registered before the app renders
// which is why we import this file in _layout.tsx
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[LocationTask] Error:', error)
        return;
    }

    if (!data) return;

    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    if (!location) return;

    // background tasks run in a seperate context - we can't use the api instance 
    // with its interceptors, so we manually grab the token and make a plain axios call 
    try {
        const token = await SecureStore.getItemAsync('auth_access_token');
        if (!token) return; // not logged in, drop silently

        const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

        await axios.patch(
            `${baseUrl}/drivers/location/`,
            {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: new Date(location.timestamp).toISOString(),
            },
            {
                headers: { Authorization: `Bearer ${token}`},
                timeout: 10000,
            }
        );
    } catch {
        // Missed pings are acceptable - drop silently and wait for next interval
    }
});

// Requests perms and starts the background location task
// Returns true if tracking started successfully, false if permissions were denied
export async function startLocationTracking(): Promise<boolean> {
    // Foreground permission must be granted before we can ask for background
    try {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') return false;
    } catch {
        return false;
    }

    let hasBackgroundPermission = false;
    try {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        hasBackgroundPermission = bgStatus === 'granted';
    } catch {
        // Background permission setup may be unavailable in some dev builds.
        // Clock-in should still succeed and foreground usage can continue.
        hasBackgroundPermission = false;
    }

    try {
        if (hasBackgroundPermission) {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.Balanced, // Street-level, not GPS-exact
                timeInterval: 30000, // ping every 30 seconds
                distanceInterval: 0, // time-based only, not distance based
                // iOS: shows the blue bar at the top so the driver know tracking is active
                showsBackgroundLocationIndicator: true,
                // Android: required to keep the task alive when app is backgrounded
                foregroundService: {
                    notificationTitle: 'Location Tracking Active',
                    notificationBody: 'Your location is being shared with dispatch',
                    notificationColor: '#2469FF',
                },
            });
            return true;
        }
    } catch {
        // If background task start fails, do not block clock-in.
        return false;
    }

    return false;
}

// Stops the background location task if it's currently runnin.
export async function stopLocationTracking(): Promise<void> {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
}