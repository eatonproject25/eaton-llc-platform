import { useActionSheet } from '@expo/react-native-action-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import type { AlertButton } from 'react-native';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useClock } from '../../contexts/ClockContext';
import { enqueueAction } from '../../lib/offlineQueue';
import { buildQueuedStatusUpdateAction, buildStatusUpdatePayload } from '../../lib/statusUpdatePayload';
import { isStatusSyncConflict } from '../../lib/syncConflicts';
import { useTheme } from '../../lib/ThemeContext';
import { DriverAssignment, Job } from '../../lib/types'; // derive types from backend API
import { api } from '../../services/api';

// This screen shows detailed information about a specific job, including addresses, foreman info, truck info, and allows updating job status. 
// It fetches job details from the backend using the job ID from the route params.
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const jobId = Array.isArray(id) ? id[0] : id;
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { showActionSheetWithOptions } = useActionSheet();
  const {isClockedIn, handleClockToggle } = useClock();
  const queryClient = useQueryClient();
  
  // useQuery cahces each job individually by its ID
  // Opening a job detail while offline will show the last cached version automatically
  const { data: job, isLoading: loading, error, refetch: fetchJob } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const res = await api.get(`/jobs/${jobId}/`);
      return res.data as Job;
    },
    enabled: Boolean(jobId),
  });
  
  const [status, setStatus] = useState(
    job?.driver_assignments[0]?.status ?? 'assigned'
  );

  const [backhaulStatus, setBackhaulStatus] = useState(
    job?.driver_assignments[0]?.backhaul_status ?? 'en_route'
  );

  const getStatusTimestampField = (assignmentStatus: string): 'started_at' | 'on_site_at' | 'completed_at' | null => {
    switch (assignmentStatus) {
      case 'en_route':
        return 'started_at';
      case 'on_site':
        return 'on_site_at';
      case 'completed':
        return 'completed_at';
      default:
        return null;
    }
  };

  const extractUpdatedAssignment = (responseData: unknown): Partial<DriverAssignment> | null => {
    if (!responseData || typeof responseData !== 'object') return null;

    const responseObject = responseData as Record<string, any>;

    if (responseObject.assignment && typeof responseObject.assignment === 'object') {
      return responseObject.assignment as Partial<DriverAssignment>;
    }

    if (responseObject.driver_assignment && typeof responseObject.driver_assignment === 'object') {
      return responseObject.driver_assignment as Partial<DriverAssignment>;
    }

    if (Array.isArray(responseObject.driver_assignments) && responseObject.driver_assignments[0]) {
      return responseObject.driver_assignments[0] as Partial<DriverAssignment>;
    }

    if (
      'id' in responseObject ||
      'status' in responseObject ||
      'started_at' in responseObject ||
      'on_site_at' in responseObject ||
      'completed_at' in responseObject ||
      'backhaul_status' in responseObject ||
      'backhaul_started_at' in responseObject ||
      'backhaul_on_site_at' in responseObject ||
      'backhaul_completed_at' in responseObject
    ) {
      return responseObject as Partial<DriverAssignment>;
    }

    return null;
  };

  const mergeAssignmentIntoJob = (cachedJob: Job | undefined, updatedAssignment: Partial<DriverAssignment> | null) => {
    if (!cachedJob || !updatedAssignment) return cachedJob;

    const updatedAssignmentId = updatedAssignment.id !== undefined && updatedAssignment.id !== null
      ? String(updatedAssignment.id)
      : null;

    return {
      ...cachedJob,
      driver_assignments: cachedJob.driver_assignments.map((assignment, index) => {
        const shouldUpdate = updatedAssignmentId
          ? String(assignment.id) === updatedAssignmentId
          : index === 0;

        return shouldUpdate
          ? { ...assignment, ...updatedAssignment }
          : assignment;
      }),
    };
  };

  const applyUpdatedAssignmentToCache = (updatedAssignment: Partial<DriverAssignment> | null) => {
    if (!jobId || !updatedAssignment) return;

    queryClient.setQueryData<Job>(['job', jobId], (cachedJob) =>
      mergeAssignmentIntoJob(cachedJob, updatedAssignment)
    );

    queryClient.setQueryData<Job[]>(['jobs'], (cachedJobs) => {
      if (!Array.isArray(cachedJobs)) return cachedJobs;

      return cachedJobs.map((cachedJob) => {
        if (String(cachedJob.id) !== String(jobId)) return cachedJob;

        return mergeAssignmentIntoJob(cachedJob, updatedAssignment) ?? cachedJob;
      });
    });
  };

  const BACKHAUL_STATUS_LABELS = {
    en_route: 'En Route',
    on_site: 'On Site',
    completed: 'Completed',
  };

  const STATUS_LABELS = {
    assigned: 'Assigned',
    en_route: 'En Route',
    on_site: 'On Site',
    completed: 'Completed'
  };

  // Sync stataus whenever React Query delivers fresh job data from cache or network
  useEffect(() => {
    if (job?.driver_assignments[0]?.status) {
      setStatus(job.driver_assignments[0].status);
    }
    if (job?.driver_assignments[0]?.backhaul_status) {
      setBackhaulStatus(job.driver_assignments[0].backhaul_status);
    }
  }, [job]);

  const setCachedAssignmentStatus = (newStatus: string, occurredAt?: string) => {
    if (!jobId) return;

    const timestampField = getStatusTimestampField(newStatus);
    const assignmentPatch: Partial<DriverAssignment> = {
      status: newStatus,
    };

    if (timestampField && occurredAt) {
      assignmentPatch[timestampField] = occurredAt;
    }

    queryClient.setQueryData<Job>(['job', jobId], (cachedJob) => {
      if (!cachedJob?.driver_assignments?.length) return cachedJob;

      return {
        ...cachedJob,
        driver_assignments: cachedJob.driver_assignments.map((assignment, index) =>
          index === 0 ? { ...assignment, ...assignmentPatch } : assignment
        ),
      };
    });

    queryClient.setQueryData<Job[]>(['jobs'], (cachedJobs) => {
      if (!Array.isArray(cachedJobs)) return cachedJobs;

      return cachedJobs.map((cachedJob) => {
        if (String(cachedJob.id) !== String(jobId) || !cachedJob.driver_assignments?.length) {
          return cachedJob;
        }

        return {
          ...cachedJob,
          driver_assignments: cachedJob.driver_assignments.map((assignment, index) =>
            index === 0 ? { ...assignment, ...assignmentPatch } : assignment
          ),
        };
      });
    });
  };

  const setCachedBackhaulStatus = (newStatus: string) => {
    if (!jobId) return;

    queryClient.setQueryData<Job>(['job', jobId], (cachedJob) => {
      if (!cachedJob?.driver_assignments?.length) return cachedJob;

      return {
        ...cachedJob,
        driver_assignments: cachedJob.driver_assignments.map((assignment, index) =>
          index === 0 ? { ...assignment, backhaul_status: newStatus } : assignment
        ),
      };
    });

    queryClient.setQueryData<Job[]>(['jobs'], (cachedJobs) => {
      if (!Array.isArray(cachedJobs)) return cachedJobs;

      return cachedJobs.map((cachedJob) => {
        if (String(cachedJob.id) !== String(jobId) || !cachedJob.driver_assignments?.length) {
          return cachedJob;
        }

        return {
          ...cachedJob,
          driver_assignments: cachedJob.driver_assignments.map((assignment, index) =>
            index === 0 ? { ...assignment, backhaul_status: newStatus } : assignment
          ),
        };
      });
    });
  };


  // grabs status through driver assignmets
  const updateStatus = async (newStatus: string, skipClockCheck = false) => {
    const assignmentId = job?.driver_assignments[0]?.id;
    if (!assignmentId) return;

    // gate on clock status before anything else
    if (!isClockedIn && !skipClockCheck) {
      Alert.alert(
        'Not Clocked In',
        'You need to be clocked in to update job status. Would you like to clock in now?',
        [
          {
            text: 'Clock In',
            onPress: async() => {
              const clockedInSuccessfully = await handleClockToggle();
              // Avoid re-entering this same prompt while clock state is still propagating.
              if (clockedInSuccessfully) {
                updateStatus(newStatus, true);
              }
            },
          },
          { text: 'Cancel', style: 'cancel'},
        ]
      );
      return; 
    }

    // always update UI immediately so the driver gets instant feedback
    // 'Optimistic update' - we assume success and roll back if the API call fails
    const previousStatus = status;
    const occurredAt = new Date().toISOString();
    setStatus(newStatus);
    setCachedAssignmentStatus(newStatus, occurredAt);

    // Check connectivity before deciding whether to call the API or queue the action
    const { isConnected } = await NetInfo.fetch();

    if (!isConnected) {
      try {
        // No connection - save the action locally and return.
        await enqueueAction(
          buildQueuedStatusUpdateAction(assignmentId, newStatus, previousStatus, occurredAt)
        );
      } catch {
        setStatus(previousStatus);
        setCachedAssignmentStatus(previousStatus);
        Alert.alert(
          'Failed to update status',
          'Unable to save the status update for offline sync. Please try again.'
        );
      }
      return;
    }
    // Online - try to update immediately, but roll back if it fails (e.g. server error, or connection drops mid-request)
    try {
      const res = await api.patch(
        `/job-driver-assignments/${assignmentId}/status/`,
        buildStatusUpdatePayload(newStatus, previousStatus, occurredAt)
      );
      const updatedAssignment = extractUpdatedAssignment(res.data) ?? {};
      const normalizedStatus = updatedAssignment.status ?? newStatus;
      const normalizedTimestampField = getStatusTimestampField(normalizedStatus);
      const mergedUpdatedAssignment: Partial<DriverAssignment> = {
        ...updatedAssignment,
        status: normalizedStatus,
      };

      if (normalizedTimestampField) {
        mergedUpdatedAssignment[normalizedTimestampField] = occurredAt;
      }

      setStatus(normalizedStatus);
      applyUpdatedAssignmentToCache(mergedUpdatedAssignment);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['job', jobId], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['jobs'], refetchType: 'none' }),
      ]);
    } catch (err: any){
      // Server rejected it - roll back the optimistic update and show an error
      setStatus(previousStatus);
      setCachedAssignmentStatus(previousStatus);
      if (isStatusSyncConflict(err)) {
        Alert.alert(
          'Sync Conflict',
          'This job status was already changed by dispatch. Please refresh and review the latest status before trying again.'
        );
        await fetchJob();
        return;
      }

      Alert.alert(
        'Failed to update status',
         err.message ?? 'An error occurred while updating the job status. Please try again.'
      );
    }
  };

  // Opens action sheet to update job status
  const openStatusPicker = () => {
    const options = ['En Route', 'On Site', 'Completed', 'Cancel'];
    const cancelButtonIndex = 3;

    showActionSheetWithOptions(
      { options, cancelButtonIndex },
      (selectedIndex) => {
        if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) return;
        const values = ['en_route', 'on_site', 'completed'];
        updateStatus(values[selectedIndex]);
      }
    );
  };

      const updateBackhaulStatus = async (newStatus: string, skipClockCheck = false) => {
      const assignmentId = job?.driver_assignments[0]?.id;
      if (!assignmentId) return;

      if (!isClockedIn && !skipClockCheck) {
        Alert.alert(
          'Not Clocked In',
          'You need to be clocked in to update job status. Would you like to clock in now?',
          [
            {
              text: 'Clock In',
              onPress: async () => {
                const clockedInSuccessfully = await handleClockToggle();
                if (clockedInSuccessfully) {
                  updateBackhaulStatus(newStatus, true);
                }
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      const previousStatus = backhaulStatus;
      setBackhaulStatus(newStatus);
      setCachedBackhaulStatus(newStatus);

      const { isConnected } = await NetInfo.fetch();

      if (!isConnected) {
        try {
          const occurredAt = new Date().toISOString();
          await enqueueAction(
            buildQueuedStatusUpdateAction(assignmentId, newStatus, previousStatus ?? 'en_route', occurredAt)
          );
        } catch {
          setBackhaulStatus(previousStatus);
          setCachedBackhaulStatus(previousStatus);
          Alert.alert(
            'Failed to update status',
            'Unable to save the backhaul status update for offline sync. Please try again.'
          );
        }
        return;
      }

      try {
        const res = await api.patch(
          `/job-driver-assignments/${assignmentId}/backhaul-status/`,
          { status: newStatus }
        );
        const updatedAssignment = extractUpdatedAssignment(res.data);
        setBackhaulStatus(updatedAssignment?.backhaul_status ?? newStatus);
        applyUpdatedAssignmentToCache(updatedAssignment);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['job', jobId], refetchType: 'none' }),
          queryClient.invalidateQueries({ queryKey: ['jobs'], refetchType: 'none' }),
        ]);
      } catch (err: any) {
        setBackhaulStatus(previousStatus);
        setCachedBackhaulStatus(previousStatus);
        if (isStatusSyncConflict(err)) {
          Alert.alert(
            'Sync Conflict',
            'This backhaul status was already changed by dispatch. Please refresh and review before trying again.'
          );
          await fetchJob();
          return;
        }
        Alert.alert(
          'Failed to update status',
          err.message ?? 'An error occurred while updating the backhaul status. Please try again.'
        );
      }
    };

  const openBackhaulStatusPicker = () => {
    const options = ['En Route', 'On Site', 'Completed', 'Cancel'];
    const cancelButtonIndex = 3;

    showActionSheetWithOptions(
      { options, cancelButtonIndex },
      (selectedIndex) => {
        if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) return;
        const values = ['en_route', 'on_site', 'completed'];
        updateBackhaulStatus(values[selectedIndex]);
      }
    );
  };
  
  if (loading && !job) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // If a background refetch fails (for example while offline), keep showing cached job data.
  if (!job) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, gap: 12 }}>
        <Text style={{ color: theme.colors.textSecondary }}>{(error as any)?.message ?? 'Job not found.'}</Text>
        <TouchableOpacity onPress={() => fetchJob()}>
          <Text style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const truck = job.driver_assignments[0]?.driver_truck_info;

  // Pop up to choose maps app when address is tapped
  const openMaps = (latitude: string, longitude: string, label: string) => {
  const options: AlertButton[] = [
    {
      text: 'Google Maps',
      onPress: () =>
        Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`),
    },
  ];

  // Only add Apple Maps on iOS
  if (Platform.OS === 'ios') {
    options.push({
      text: 'Apple Maps',
      onPress: () =>
        Linking.openURL(`maps://?q=${latitude},${longitude}`),
    });
  }

  options.push({ text: 'Cancel', style: 'cancel' });

  Alert.alert('Open in Maps', label, options);
};

  // Helper function to copy addresses to clipboard
  const copyAddress = async (address: string) => {
    await Clipboard.setStringAsync(address);
    Alert.alert('Address Copied', address);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.section}>
          <Text style={styles.jobNumber}>{job.job_number}</Text>
          <Text style={styles.project}>{job.project}</Text>
          <Text style={styles.detail}>{job.job_date} · {job.shift_start}</Text>
          <Text style={styles.detail}>{job.material}</Text>
        </View>

        {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Addresses</Text>

          {/* Loading Address */}
          <Text style={styles.label}>Loading</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => openMaps(job.loading_address_info.latitude, job.loading_address_info.longitude, job.loading_address_info.location_name)}>
              <Text style={[styles.detail, { color: theme.colors.primary }]}>{job.loading_address_info.location_name}</Text>
              <Text style={[styles.detail, { color: theme.colors.primary }]}>{job.loading_address_info.street_address}, {job.loading_address_info.city}, {job.loading_address_info.state}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginLeft: 12 }} onPress={() => copyAddress(`${job.loading_address_info.street_address}, ${job.loading_address_info.city}, ${job.loading_address_info.state}`)}>
              <MaterialIcons name="content-copy" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Unloading Address */}
          <Text style={styles.label}>Unloading</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => openMaps(job.unloading_address_info.latitude, job.unloading_address_info.longitude, job.unloading_address_info.location_name)}>
              <Text style={[styles.detail, { color: theme.colors.primary }]}>{job.unloading_address_info.location_name}</Text>
              <Text style={[styles.detail, { color: theme.colors.primary }]}>{job.unloading_address_info.street_address}, {job.unloading_address_info.city}, {job.unloading_address_info.state}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginLeft: 12 }} onPress={() => copyAddress(`${job.unloading_address_info.street_address}, ${job.unloading_address_info.city}, ${job.unloading_address_info.state}`)}>
              <MaterialIcons name="content-copy" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <TouchableOpacity onPress={openStatusPicker} style={styles.statusButton}>
            <Text style={styles.statusButtonText}>
              {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
            </Text>
            <MaterialIcons name="expand-more" size={20} color={theme.colors.primary} />
          </TouchableOpacity>

          <View style={styles.statusTimeline}>
            {[
              { label: 'Assigned', time: job.driver_assignments[0]?.assigned_at },
              { label: 'En Route', time: job.driver_assignments[0]?.started_at },
              // TODO: backend needs to support these timestamps for accurate timeline
              { label: 'On Site', time: job.driver_assignments[0]?.on_site_at },  
              { label: 'Completed', time: job.driver_assignments[0]?.completed_at },
            ].map(({ label, time }) => (
              <View key={label} style={styles.timelineRow}>
                <Text style={styles.timelineLabel}>{label}</Text>
                <Text style={styles.timelineValue}>
                  {time ? new Date(time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Backhaul Status */}
        {job.is_backhaul_enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backhaul Status</Text>
            <TouchableOpacity onPress={openBackhaulStatusPicker} style={styles.statusButton}>
              <Text style={styles.statusButtonText}>
                {BACKHAUL_STATUS_LABELS[backhaulStatus as keyof typeof BACKHAUL_STATUS_LABELS] ?? 'Not Started'}
              </Text>
              <MaterialIcons name="expand-more" size={20} color={theme.colors.primary} />
            </TouchableOpacity>

            <View style={styles.statusTimeline}>
              {[
                { label: 'En Route', time: job.driver_assignments[0]?.backhaul_started_at },
                { label: 'On Site', time: job.driver_assignments[0]?.backhaul_on_site_at },
                { label: 'Completed', time: job.driver_assignments[0]?.backhaul_completed_at },
              ].map(({ label, time }) => (
                <View key={label} style={styles.timelineRow}>
                  <Text style={styles.timelineLabel}>{label}</Text>
                  <Text style={styles.timelineValue}>
                    {time ? new Date(time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Backhaul Addresses */}
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Backhaul Addresses</Text>
            <Text style={styles.label}>Loading</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openMaps(job.backhaul_loading_address_info!.latitude, job.backhaul_loading_address_info!.longitude, job.backhaul_loading_address_info!.location_name)}>
                <Text style={[styles.detail, { color: theme.colors.primary }]}>{job.backhaul_loading_address_info!.location_name}</Text>
                <Text style={[styles.detail, { color: theme.colors.primary }]}>{job.backhaul_loading_address_info!.street_address}, {job.backhaul_loading_address_info!.city}, {job.backhaul_loading_address_info!.state}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginLeft: 12 }} onPress={() => copyAddress(`${job.backhaul_loading_address_info!.street_address}, ${job.backhaul_loading_address_info!.city}, ${job.backhaul_loading_address_info!.state}`)}>
                <MaterialIcons name="content-copy" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Unloading</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openMaps(job.backhaul_unloading_address_info!.latitude, job.backhaul_unloading_address_info!.longitude, job.backhaul_unloading_address_info!.location_name)}>
                <Text style={[styles.detail, { color: theme.colors.primary }]}>{job.backhaul_unloading_address_info!.location_name}</Text>
                <Text style={[styles.detail, { color: theme.colors.primary }]}>{job.backhaul_unloading_address_info!.street_address}, {job.backhaul_unloading_address_info!.city}, {job.backhaul_unloading_address_info!.state}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginLeft: 12 }} onPress={() => copyAddress(`${job.backhaul_unloading_address_info!.street_address}, ${job.backhaul_unloading_address_info!.city}, ${job.backhaul_unloading_address_info!.state}`)}>
                <MaterialIcons name="content-copy" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          {job.additional_notes
            ? <Text style={styles.detail}>{job.additional_notes}</Text>
            : <Text style={[styles.detail, { fontStyle: 'italic'}]}>No notes from dispatch</Text>
          }
        </View>
        {/* Foreman */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Foreman</Text>
          <Text style={styles.detail}>{job.job_foreman_name}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${job.job_foreman_contact}`)}>
            <Text style={[styles.detail, { color: theme.colors.primary }]}>{job.job_foreman_contact}</Text>
          </TouchableOpacity>
        </View>

        {/* Truck */}
        {truck ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Truck</Text>
            <Text style={styles.detail}>{truck.truck_type}</Text>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${truck.driver_phone}`)}>
              <Text style={[styles.detail, { color: theme.colors.primary }]}>{truck.driver} · {truck.driver_phone}</Text>
            </TouchableOpacity>
          </View>
        ) : null}


      </View>
    </ScrollView>
  );
}

function makeStyles(theme: ReturnType<typeof import('../../lib/ThemeContext').useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    section: {
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
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.text,
    },
    sectionTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    label: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detail: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
    },
    statusButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    statusButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.semibold,
    },
    statusTimeline: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    timelineRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    timelineLabel: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    timelineValue: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
  });
}