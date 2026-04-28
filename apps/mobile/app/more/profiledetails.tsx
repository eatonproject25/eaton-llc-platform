import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/ThemeContext';
import { Driver } from '../../lib/types';
import { api } from '../../services/api';

export default function ProfileDetailsScreen() {
    const { theme } = useTheme();
    const styles = makeStyles(theme);

    const [driver, setDriver] = useState<Driver | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchDriverDetails = async () => {
            try {
                setLoading(true);
                const response = await api.get('/drivers/me/');
                setDriver(response.data);
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError('An unknown error occurred.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDriverDetails();
    }, []);

    if (loading) {
        return <Text>Loading...</Text>;
    }

    if (error) {
        return <Text>Error: {error}</Text>;
    }

    if (!driver) return null;
    
    return (
        <View style={styles.container}>
            <Text style={styles.name}>{driver.name}</Text>

            <Text style={styles.sectionLabel}>CONTACT</Text>
            <View style={styles.row}>
                <MaterialIcons name="phone" size={20} color={theme.colors.textSecondary} style={{ marginRight: theme.spacing.sm }} />
                <Text style={styles.rowLabel}>{driver.phone_number || 'No phone number'}</Text>
            </View>
            <View style={styles.row}>
                <MaterialIcons name="email" size={20} color={theme.colors.textSecondary} style={{ marginRight: theme.spacing.sm }} />
                <Text style={styles.rowLabel}>{driver.email_address || 'No email'}</Text>
            </View>
            <View style={styles.row}>
                <MaterialIcons name="location-on" size={20} color={theme.colors.textSecondary} style={{ marginRight: theme.spacing.sm }} />
                <Text style={styles.rowLabel}>{driver.address || 'No address'}</Text>
            </View>

            <Text style={styles.sectionLabel}>DRIVER INFO</Text>
            <View style={styles.row}>
                <MaterialIcons name="badge" size={20} color={theme.colors.textSecondary} style={{ marginRight: theme.spacing.sm }} />
                <Text style={styles.rowLabel}>{driver.driver_license || 'No license on file'}</Text>
            </View>
            <View style={styles.row}>
                <MaterialIcons name="local-shipping" size={20} color={theme.colors.textSecondary} style={{ marginRight: theme.spacing.sm }} />
                <Text style={styles.rowLabel}>{driver.truck_count} truck{driver.truck_count !== 1 ? 's' : ''} assigned</Text>
            </View>
        </View>
    );
}


function makeStyles(theme: ReturnType<typeof import('../../lib/ThemeContext').useTheme>['theme']) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
            padding: theme.spacing.lg,
        },
        text: {
            fontSize: theme.fontSize.xxl,
            fontWeight: theme.fontWeight.bold,
            color: theme.colors.text,
        },
        name: {
            fontSize: theme.fontSize.xxl,
            fontWeight: theme.fontWeight.bold,
            color: theme.colors.text,
            marginBottom: theme.spacing.lg,
        },
        sectionLabel: {
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.textSecondary,
            marginTop: theme.spacing.lg,
            marginBottom: theme.spacing.sm,
            letterSpacing: 1,
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
    });
}