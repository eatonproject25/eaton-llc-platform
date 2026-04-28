import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../lib/ThemeContext';

type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'loading';

type PermissionItem = {
  key: string;
  label: string;
  description: string;
  status: PermissionStatus;
};

export default function PermissionsScreen() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [permissions, setPermissions] = useState<PermissionItem[]>([
    { key: 'location_fg', label: 'Location (Foreground)', description: 'Required for live tracking while app is open', status: 'loading' },
    { key: 'location_bg', label: 'Location (Background)', description: 'Required for live tracking when app is closed', status: 'loading' },
    { key: 'camera', label: 'Camera', description: 'Required for taking ticket photos', status: 'loading' },
    { key: 'photo_library', label: 'Photo Library', description: 'Required for uploading tickets from gallery', status: 'loading' },
  ]);

  const checkPermissions = useCallback(async () => {
    const [fgLocation, bgLocation, camera, photoLibrary] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      ImagePicker.getCameraPermissionsAsync(),
      ImagePicker.getMediaLibraryPermissionsAsync(),
    ]);

    setPermissions([
      { key: 'location_fg', label: 'Location (Foreground)', description: 'Required for live tracking while app is open', status: fgLocation.status as PermissionStatus },
      { key: 'location_bg', label: 'Location (Background)', description: 'Required for live tracking when app is closed', status: bgLocation.status as PermissionStatus },
      { key: 'camera', label: 'Camera', description: 'Required for taking ticket photos', status: camera.status as PermissionStatus },
      { key: 'photo_library', label: 'Photo Library', description: 'Required for uploading tickets from gallery', status: photoLibrary.status as PermissionStatus },
    ]);
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionLabel}>APP PERMISSIONS</Text>
      {permissions.map((item) => (
        <View key={item.key} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowDescription}>{item.description}</Text>
          </View>

          {item.status === 'loading' ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : item.status === 'granted' ? (
            <MaterialIcons name="check-circle" size={22} color={theme.colors.success} />
          ) : (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => Linking.openSettings()}
            >
              <MaterialIcons name="warning" size={16} color={theme.colors.warning} />
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity style={styles.refreshButton} onPress={checkPermissions}>
        <Text style={styles.refreshButtonText}>Refresh Status</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        To change a permission, tap Open Settings, update the permission, then come back and tap Refresh Status.
      </Text>
    </ScrollView>
  );
}

function makeStyles(theme: ReturnType<typeof import('../../lib/ThemeContext').useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.lg,
    },
    sectionLabel: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      letterSpacing: 1,
      marginBottom: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: theme.spacing.md,
    },
    rowLeft: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
      fontWeight: theme.fontWeight.medium,
    },
    rowDescription: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    settingsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.warning + '20',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.md,
    },
    settingsButtonText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.warning,
      fontWeight: theme.fontWeight.semibold,
    },
    refreshButton: {
      marginTop: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
    },
    refreshButtonText: {
      color: theme.colors.primary,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
    },
    hint: {
      marginTop: theme.spacing.md,
      fontSize: theme.fontSize.sm,
      color: theme.colors.textTertiary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}