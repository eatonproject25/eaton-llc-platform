import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from 'expo-router';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

export default function MoreScreen() {
    const { theme, setMode, isDark } = useTheme();
    const { logout } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
        } finally {
            router.replace('/(auth)/login');
        }
    };

    const styles = makeStyles(theme);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <TouchableOpacity style={styles.row} onPress={() => router.push('/more/profiledetails')}>
                <MaterialIcons name="person" size={20} color={theme.colors.textSecondary} style={{ marginRight: theme.spacing.sm }} />
                <Text style={styles.rowLabel}>My Profile</Text>
                <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
            <Text style={styles.sectionLabel}>PREFERENCES</Text>
            <View style={styles.row}>
                <Text style={styles.rowLabel}>Toggle Mode</Text>
                <MaterialIcons
                    name={isDark ? 'nightlight-round' : 'wb-sunny'}
                    size={20}
                    color={isDark ? theme.colors.primary : theme.colors.warning}
                    style={{ marginRight: theme.spacing.sm }}
                />
                <Switch
                    value={isDark}
                    onValueChange={(val) => setMode(val ? 'dark' : 'light')}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.background}
                />
            </View>

            <Text style={styles.sectionLabel}>APP</Text>
            <TouchableOpacity style={styles.row} onPress={() => router.push('../more/permissions')}>
                <MaterialIcons name="tune" size={20} color={theme.colors.textSecondary} style={{ marginRight: theme.spacing.sm }} />
                <Text style={styles.rowLabel}>Permissions</Text>
                <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
            
            <Text style={styles.sectionLabel}>SESSION</Text>
            <TouchableOpacity style={styles.row} onPress={handleLogout}>
                <MaterialIcons name="logout" size={20} color={theme.colors.error} style={{ marginRight: theme.spacing.sm }} />
                <Text style={[styles.rowLabel, { color: theme.colors.error }]}>Logout</Text>
                <Text style={[styles.rowChevron, { color: theme.colors.error }]}>›</Text>
            </TouchableOpacity>
        </View>
    );
}

function makeStyles(theme: ReturnType<typeof import('../../lib/ThemeContext').useTheme>['theme']) {
    return StyleSheet.create({
    container: {
        flex: 1,
        padding: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: theme.colors.background,
    },
    text: {
        fontSize: theme.fontSize.xxl,
        fontWeight: theme.fontWeight.bold,
        marginBottom: theme.spacing.sm,
        color: theme.colors.text,
    },
    subtext: {
        fontSize: theme.fontSize.md,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    rowLabel: {
        flex: 1,
        fontSize: theme.fontSize.md,
        color: theme.colors.text,
    },
    rowChevron: {
        fontSize: theme.fontSize.md,
        color: theme.colors.textSecondary,
    },
    sectionLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    letterSpacing: 1,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    },
});
}