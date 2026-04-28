import { ClockProvider } from "@/contexts/ClockContext";
import { asyncStoragePersister, queryClient } from "@/lib/queryClient";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, LogBox, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import "../lib/locationTracking";
import { getQueue, removeAction } from "../lib/offlineQueue";
import { replayQueuedStatusUpdates } from "../lib/statusUpdateSync";
import { ThemeProvider } from "../lib/ThemeContext";
import { DriverAssignment, Job } from "../lib/types";
import { api } from "../services/api";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log("🔥 NOTIFICATION RECEIVED:", notification);

    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

function AppInitializer() {
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);
  const lastHandledResponseId = useRef<string | null>(null);
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  const getJobIdFromNotificationResponse = (response: Notifications.NotificationResponse | null): string | null => {
    if (!response) return null;

    const data = response.notification.request.content.data as Record<string, unknown>;

    const normalizeId = (value: unknown): string | null => {
      if (value === undefined || value === null) return null;

      const stringValue = String(value).trim();
      return stringValue.length > 0 ? stringValue : null;
    };

    const rawJobId =
      data?.jobId ??
      data?.job_id ??
      data?.assignmentId ??
      data?.assignment_id ??
      data?.id ??
      (typeof data?.job === "object" && data.job !== null ? (data.job as Record<string, unknown>).id : undefined);

    return normalizeId(rawJobId);
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;

    const responseId = response.notification.request.identifier;
    if (lastHandledResponseId.current === responseId) return;
    lastHandledResponseId.current = responseId;

    const jobId = getJobIdFromNotificationResponse(response);
    if (jobId) {
      router.push(`/job/${jobId}`);
      return;
    }

    router.push("/(tabs)/myjobs");
  };

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      const registerForPushNotifications = async () => {
        try {
          // Android: Set up notification channel for heads-up display
          if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("default", {
              name: "default",
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: "#FF231F7C",
              enableVibrate: true,
            });
          }

          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowSound: true,
              allowBadge: false,
            },
          });
          if (status !== "granted") return;

          if (!projectId) throw new Error("Missing EAS projectId");

          const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
          console.log("🔥 PHONE TOKEN:", tokenData.data);

          await api.post("/devices/", {
            token: tokenData.data,
            platform: Platform.OS === "ios" ? "ios" : "android",
          });
        } catch {
          // Push notifications are non-critical — fail silently
        }
      };

      registerForPushNotifications();

      // Handles app launch from a notification tap when the app was killed.
      Notifications.getLastNotificationResponseAsync().then((response) => {
        handleNotificationResponse(response);
      });


      notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });

      

      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationResponse(response);
      });
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated, isLoading, projectId]);

  return null;
}

export default function RootLayout() {
  const isSyncing = useRef(false);
  const [isOffline, setIsOffline] = useState(false);

  const extractUpdatedAssignment = (responseData: unknown): Partial<DriverAssignment> | null => {
    if (!responseData || typeof responseData !== "object") return null;

    const responseObject = responseData as Record<string, any>;

    if (responseObject.assignment && typeof responseObject.assignment === "object") {
      return responseObject.assignment as Partial<DriverAssignment>;
    }

    if (responseObject.driver_assignment && typeof responseObject.driver_assignment === "object") {
      return responseObject.driver_assignment as Partial<DriverAssignment>;
    }

    if (Array.isArray(responseObject.driver_assignments) && responseObject.driver_assignments[0]) {
      return responseObject.driver_assignments[0] as Partial<DriverAssignment>;
    }

    if (
      "id" in responseObject ||
      "status" in responseObject ||
      "started_at" in responseObject ||
      "on_site_at" in responseObject ||
      "completed_at" in responseObject
    ) {
      return responseObject as Partial<DriverAssignment>;
    }

    return null;
  };

  const getStatusTimestampField = (assignmentStatus: string): "started_at" | "on_site_at" | "completed_at" | null => {
    switch (assignmentStatus) {
      case "en_route":
        return "started_at";
      case "on_site":
        return "on_site_at";
      case "completed":
        return "completed_at";
      default:
        return null;
    }
  };

  const mergeAssignmentIntoJob = (
    cachedJob: Job | undefined,
    assignmentId: number,
    updatedAssignment: Partial<DriverAssignment>
  ): Job | undefined => {
    if (!cachedJob?.driver_assignments?.length) return cachedJob;

    const normalizedUpdatedAssignmentId =
      updatedAssignment.id !== undefined && updatedAssignment.id !== null
        ? String(updatedAssignment.id)
        : String(assignmentId);

    let foundMatch = false;
    const nextAssignments = cachedJob.driver_assignments.map((assignment) => {
      const shouldUpdate =
        String(assignment.id) === String(assignmentId) ||
        String(assignment.id) === normalizedUpdatedAssignmentId;

      if (!shouldUpdate) return assignment;

      foundMatch = true;
      return { ...assignment, ...updatedAssignment };
    });

    if (!foundMatch) return cachedJob;

    return {
      ...cachedJob,
      driver_assignments: nextAssignments,
    };
  };

  const mergeSyncedStatusUpdateIntoCache = (
    assignmentId: number,
    responseData: unknown,
    occurredAt: string
  ) => {
    const updatedAssignment = extractUpdatedAssignment(responseData);
    if (!updatedAssignment) return;

    const normalizedStatus = updatedAssignment.status;
    const timestampField =
      typeof normalizedStatus === "string"
        ? getStatusTimestampField(normalizedStatus)
        : null;
    const normalizedAssignment: Partial<DriverAssignment> = {
      ...updatedAssignment,
    };

    if (timestampField) {
      normalizedAssignment[timestampField] = occurredAt;
    }

    queryClient.setQueryData<Job[]>(["jobs"], (cachedJobs) => {
      if (!Array.isArray(cachedJobs)) return cachedJobs;

      return cachedJobs.map((cachedJob) =>
        mergeAssignmentIntoJob(cachedJob, assignmentId, normalizedAssignment) ?? cachedJob
      );
    });

    const jobQueries = queryClient.getQueriesData<Job>({ queryKey: ["job"] });
    for (const [queryKey] of jobQueries) {
      queryClient.setQueryData<Job>(queryKey, (cachedJob) =>
        mergeAssignmentIntoJob(cachedJob, assignmentId, normalizedAssignment)
      );
    }
  };

  useEffect(() => {
    LogBox.ignoreLogs([
      "Unable to activate keep awake",
      "Uncaught (in promise",
    ]);
  }, []);

  useEffect(() => {
    if (!__DEV__) return;

    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args
        .map((arg) => (typeof arg === "string" ? arg : arg?.message ?? ""))
        .join(" ");

      if (message.includes("Unable to activate keep awake")) {
        return;
      }

      originalConsoleError(...args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  useEffect(() => {
    const globalObj = globalThis as any;
    if (typeof globalObj?.addEventListener !== "function") return;

    const onUnhandledRejection = (event: any) => {
      const message =
        event?.reason?.message ??
        (typeof event?.reason === "string" ? event.reason : "");

      if (typeof message === "string" && message.includes("Unable to activate keep awake")) {
        event?.preventDefault?.();
      }
    };

    globalObj.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      globalObj.removeEventListener?.("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const connected = state.isConnected ?? false;
      setIsOffline(!connected);

      if (!connected || isSyncing.current) return;
      const queue = await getQueue();
      if (queue.length === 0) return;

      isSyncing.current = true;
      try {
        await replayQueuedStatusUpdates(queue, {
          patchStatus: async (assignmentId, payload) => {
            const response = await api.patch(`/job-driver-assignments/${assignmentId}/status/`, payload);
            return response.data;
          },
          onSuccess: async (action, responseData) => {
            mergeSyncedStatusUpdateIntoCache(action.assignmentId, responseData, action.occurredAt);
          },
          removeAction,
          onConflict: async (action) => {
            Alert.alert(
              "Sync Conflict",
              `Could not sync update for Job #${action.assignmentId}. It may have been modified by dispatch.`
            );
          },
          onTransientFailure: (_action, _error) => {
            // Will retry automatically on next reconnect
          },
          invalidateQueries: async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["jobs"] }),
              queryClient.invalidateQueries({ queryKey: ["job"] }),
            ]);
          },
        });
      } finally {
        isSyncing.current = false;
      }
    });

    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24, buster: "v1" }}
        >
          <ActionSheetProvider>
            <AuthProvider>
              <ClockProvider>
                <AppInitializer />
                {isOffline && (
                  <View style={styles.offlineBanner}>
                    <Text style={styles.offlineBannerText}>
                      No connection — showing cached data
                    </Text>
                  </View>
                )}
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="job/[id]" options={{ title: "Job Details", headerShown: true }} />
                  <Stack.Screen name="more/profiledetails" options={{ title: "My Profile", headerShown: true }} />
                  <Stack.Screen name="more/permissions" options={{ title: "Permissions", headerShown: true }} />
                </Stack>
              </ClockProvider>
            </AuthProvider>
          </ActionSheetProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: "#b91c1c",
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  offlineBannerText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});