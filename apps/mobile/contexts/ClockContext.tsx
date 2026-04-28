import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { startLocationTracking, stopLocationTracking } from '../lib/locationTracking';
import { api } from '../services/api';


type ClockContextType = {
    isClockedIn: boolean;
    clockLoading: boolean;
    isTracking: boolean; // drives live indicator in the header
    handleClockToggle: () => Promise<boolean>;
};

const ClockContext = createContext<ClockContextType | undefined>(undefined);

export function ClockProvider({ children }: { children: React.ReactNode }) {
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [clockLoading, setClockLoading] = useState(false);
    const [isTracking, setIsTracking] = useState(false);

    // Hydrate clock status from backend on mount
    useEffect(() => {
        const fetchClockStatus = async () => {
            try {
                const res = await api.get('/drivers/clock-status/');
                const clockedIn = res.data.is_clocked_in;
                setIsClockedIn(res.data.is_clocked_in);

                // If they're already clocked in when the app loads, 
                // restart tracking - the background task may have been killed too
                if (clockedIn) {
                    const started = await startLocationTracking();
                    setIsTracking(started);
                }
            } catch {
                // fail silently — default false is safe
            }
        };
        fetchClockStatus();
    }, []);

    const shouldTryFallback = (error: any) => {
        const status = error?.response?.status;
        return status === 404 || status === 405 || (status >= 500 && status < 600);
    };

    const isRetryableToggleError = (error: any) => {
        const status = error?.response?.status;
        return status === 400 || status === 404 || status === 405 || (status >= 500 && status < 600);
    };

    const fetchServerClockStatus = async () => {
        const res = await api.get('/drivers/clock-status/');
        return Boolean(res.data?.is_clocked_in);
    };

    const callApi = async (method: 'post' | 'patch' | 'put', path: string, body?: Record<string, unknown>) => {
        const client = api as any;
        if (body === undefined) {
            return client[method](path);
        }
        return client[method](path, body);
    };

    const toggleClockOnBackend = async (nextClockedIn: boolean) => {
        const primaryPath = nextClockedIn ? '/drivers/clock-in/' : '/drivers/clock-out/';
        const primaryNoSlashPath = nextClockedIn ? '/drivers/clock-in' : '/drivers/clock-out';
        const statePayloads = [
            { is_clocked_in: nextClockedIn },
            { clocked_in: nextClockedIn },
        ];
        const attempts: string[] = [];
        let lastError: any;
        let statusVerified = false;

        const runAttempt = async (
            method: 'post' | 'patch' | 'put',
            path: string,
            body?: Record<string, unknown>,
            retryable = shouldTryFallback
        ) => {
            attempts.push(`${method.toUpperCase()} ${path}`);
            try {
                await callApi(method, path, body);
                return true;
            } catch (error: any) {
                lastError = error;

                // Some backend implementations may successfully toggle state but still return 5xx.
                // Verify current state before deciding the attempt really failed.
                if (!statusVerified) {
                    statusVerified = true;
                    try {
                        const currentClockedIn = await fetchServerClockStatus();
                        if (currentClockedIn === nextClockedIn) {
                            return true;
                        }
                    } catch {
                        // Ignore status verification errors and continue fallbacks.
                    }
                }

                if (!retryable(error)) {
                    throw error;
                }
                return false;
            }
        };

        if (await runAttempt('post', primaryPath)) {
            return;
        }

        if (await runAttempt('post', primaryNoSlashPath)) {
            return;

        }

        for (const payload of statePayloads) {
            if (await runAttempt('patch', '/drivers/clock-status/', payload, isRetryableToggleError)) {
                return;
            }
            if (await runAttempt('put', '/drivers/clock-status/', payload, isRetryableToggleError)) {
                return;
            }
            if (await runAttempt('patch', '/drivers/clock-status', payload, isRetryableToggleError)) {
                return;
            }
            if (await runAttempt('put', '/drivers/clock-status', payload, isRetryableToggleError)) {
                return;
            }
            if (await runAttempt('post', '/drivers/clock-status/', payload)) {
                return;
            }
            if (await runAttempt('post', '/drivers/clock-status', payload)) {
                return;
            }
        }

        const detail = lastError?.response?.data?.detail;
        const message = lastError?.message;
        const uniqueAttempts = [...new Set(attempts)];
        throw new Error(
            `${detail ?? message ?? 'Clock toggle failed.'} Tried: ${uniqueAttempts.join(' -> ')}`
        );
    };

    const handleClockToggle = async () => {
        setClockLoading(true);
        try {
            if (isClockedIn) {
                await toggleClockOnBackend(false);
                setIsClockedIn(false);
                //stop tracking on clock out
                await stopLocationTracking();
                setIsTracking(false);
            } else {
                await toggleClockOnBackend(true);
                setIsClockedIn(true);
                //start tracking on clock in
                const started = await startLocationTracking();
                setIsTracking(started);
            }
            return true;
        } catch (err: any) {
            const statusCode = err?.response?.status;
            const isServerError = typeof statusCode === 'number' && statusCode >= 500;
            const fallbackMessage = isServerError
                ? 'Backend clock endpoint returned a server error (500). Please contact backend support.'
                : 'Please try again.';

            console.warn('Clock toggle failed', err?.message ?? err);
            Alert.alert(
                'Unable to update clock status',
                err?.message ?? err?.response?.data?.detail ?? fallbackMessage
            );
            return false;
        } finally {
            setClockLoading(false);
        }
    };

    return (
        <ClockContext.Provider value={{ isClockedIn, clockLoading, isTracking, handleClockToggle }}>
            {children}
        </ClockContext.Provider>
    );
}

export function useClock() {
    const context = useContext(ClockContext);
    if (!context) throw new Error('useClock must be used within ClockProvider');
    return context;
}