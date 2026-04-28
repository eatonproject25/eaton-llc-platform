import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useClock } from '../../contexts/ClockContext';
import { useTheme } from '../../lib/ThemeContext';
import { Job } from '../../lib/types'; // Importing Job and Address types from lib/types.ts
import { api } from '../../services/api';

// This screen displays a list of jobs assigned to the logged-in driver. 
// It fetches the jobs from the backend API and shows key details like job number, project, date, material, and loading city. 
// Users can tap on a job to see more details on a separate screen. 
// The screen also includes pull-to-refresh functionality and error handling for network issues.

export async function fetchJobs(): Promise<Job[]> {
  const res = await api.get('/drivers/me/jobs/');
  return res.data.results ?? res.data;
}

export default function MyJobsScreen() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const { isClockedIn, clockLoading, isTracking, handleClockToggle } = useClock();

  // Pulsing animation for live dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isTracking) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true}),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true}),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isTracking]);

  // Clock out prompt to get drivers to submit tickets
  const handleClockOutPrompt = async () => {
    if (isClockedIn) {
      Alert.alert(
        'Before You Clock Out',
        'Do you have tickets to submit?',
        [
          {
            text: 'Submit Tickets',
            onPress: async () => {
              router.push('./tickets');
            },
          },
          {
            text: 'No, Clock Out',
            style: 'destructive',
            onPress: handleClockToggle,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } else {
      handleClockToggle();
    }
  };
  
  // - on mount: checks cache first, then fetches if stale
  // - while offline: returns whatever is in the persisted cache automatically
  // - isRefetching: true when refetching in background, can be used to show a loading indicator without blocking the UI
  const { data: jobs=[], isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: fetchJobs,
  });

  // clock in/out useEffect
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () =>
        isTracking ? (
          <View style={{ marginLeft: 12 }}>
            <View style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
        ) : null,
      headerRight: () => (
        <View style= {{ flexDirection: 'row', alignItems: 'center', marginRight: 4}}>
        <TouchableOpacity
          onPress = {handleClockOutPrompt}
          disabled={clockLoading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#ffffff',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20,
            borderWidth: 4,
            borderColor: isClockedIn ? theme.colors.error : theme.colors.success,
          }}
        >
          {clockLoading ? (
            <ActivityIndicator size="small" color={isClockedIn ? theme.colors.error : theme.colors.success} />
          ) : (
            <>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isClockedIn ? theme.colors.error : theme.colors.success,
              }} />
              <Text style={{
                fontSize: theme.fontSize.sm,
                fontWeight: theme.fontWeight.bold,
                color: isClockedIn ? theme.colors.error : theme.colors.success,
              }}>
                {isClockedIn ? 'Clock Out' : 'Clock In'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      ),
    });
  }, [isClockedIn, clockLoading, isTracking, pulseAnim]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={styles.header}>
        <Text style={styles.lastRefreshText}>
          {isRefetching ? 'Refreshing...' : `Last updated: ${new Date().toLocaleTimeString()}`}
        </Text>
      <TouchableOpacity onPress={() => refetch()}>
        <MaterialIcons name="refresh" size={24} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>

    {isLoading ? (
      // isLoading is only true on the very first load with no cached data
      // If cached data exists (even stale), isLoading will be false and
      // the cached jobs will render immediately while a background refetch runs
      <ActivityIndicator 
        size="large" 
        color={theme.colors.primary} 
        style={{ marginTop: 60 }} 
      />
    ) : error ? (
      <View style={styles.errorContainer}>
        <MaterialIcons name="wifi-off" size={32} color={theme.colors.error} />
        <Text style={styles.errorText}>
          {(error as any).message ?? 'Failed to load jobs'}
        </Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    ) : (
    <FlatList
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
      data={jobs}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress= {() => router.push({ pathname: '/job/[id]', params: { id: item.id } })}>
          <Text style={styles.jobNumber}>{item.job_number}</Text>
          <Text style={styles.project}>{item.project}</Text>
          <Text style={styles.detail}>{item.job_date} · {item.shift_start}</Text>
          <Text style={styles.detail}>{item.material} · {item.loading_address_info.city}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No jobs assigned yet</Text>}
      // refetch() is what pull-to-refresh calls
      // React Query handles the loading state - no need to manage setRefreshing manually
      refreshControl= {
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    />
    )}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof import('../../lib/ThemeContext').useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.xs,
    },
    jobNumber: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.semibold,
    },
    project: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.text,
    },
    detail: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    empty: {
      textAlign: 'center',
      color: theme.colors.textSecondary,
      marginTop: 60,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.text,
    },
    lastRefreshText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.55)',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.error,
    },
    liveText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.error,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    retryText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
  });
}