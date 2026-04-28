import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../lib/ThemeContext";
import { api } from "../../services/api";

type NotificationItem = {
  id: number;
  title: string;
  body: string;
  sent_at: string;
  is_read: boolean;
  data: unknown;
};

async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await api.get("/notifications/");
  return res.data.results ?? res.data;
}

function getJobIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const notificationData = data as Record<string, unknown>;
  const rawJobId =
    notificationData.jobId ??
    notificationData.job_id ??
    notificationData.assignmentId ??
    notificationData.assignment_id ??
    notificationData.id;

  if (rawJobId === undefined || rawJobId === null) return null;

  const jobId = String(rawJobId).trim();
  return jobId.length > 0 ? jobId : null;
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/`, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <MaterialIcons name="notifications-none" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>We&apos;ll let you know when there are updates about your jobs</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.is_read && styles.cardUnread]}
            onPress={() => {
              if (!item.is_read) {
                markRead.mutate(item.id);
              }

              const jobId = getJobIdFromNotificationData(item.data);
              if (jobId) {
                router.push(`/job/${jobId}`);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.cardRow}>
              <MaterialIcons
                name="notifications"
                size={20}
                color={item.is_read ? theme.colors.textSecondary : theme.colors.primary}
              />
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, !item.is_read && styles.cardTitleUnread]}>
                  {item.title}
                </Text>
                <Text style={styles.cardBody}>{item.body}</Text>
                <Text style={styles.cardTime}>
                  {formatDistanceToNow(new Date(item.sent_at), { addSuffix: true })}
                </Text>
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof import('../../lib/ThemeContext').useTheme>['theme']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg, gap: theme.spacing.md },
    emptyTitle: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.text, marginTop: theme.spacing.sm },
    emptySubtext: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary, textAlign: 'center' },
    card: { backgroundColor: theme.colors.surface, marginHorizontal: theme.spacing.md, marginTop: theme.spacing.sm, borderRadius: 10, padding: theme.spacing.md },
    cardUnread: { borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
    cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: theme.fontSize.md, color: theme.colors.text },
    cardTitleUnread: { fontWeight: theme.fontWeight.bold },
    cardBody: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
    cardTime: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 4 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 4 },
  });
}
