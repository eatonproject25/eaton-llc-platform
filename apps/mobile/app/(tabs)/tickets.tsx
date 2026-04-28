import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClock } from '../../contexts/ClockContext';
import { useTheme } from '../../lib/ThemeContext';
import { Ticket } from '../../lib/types';
import { api } from '../../services/api';



function buildDateStrip(): Date[] {
    const days: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = -30; i <= 0; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push(d);
    }
    return days;
}
// for arrow buttons
function offsetDate(dateKey: string, days: number): string {
    const d = new Date(dateKey + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return toDateKey(d);
}

function toDateKey(d: Date): string {
    return d.toISOString().slice(0, 10);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TicketsScreen() {
    const { theme } = useTheme();
    const styles = makeStyles(theme);
    const queryClient = useQueryClient();
    const navigation = useNavigation();
    const stripRef = useRef<ScrollView>(null);

    const { isClockedIn, clockLoading, isTracking, handleClockToggle } = useClock();

    const stripDays = buildDateStrip();

    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    const todayKey = toDateKey(todayDate);

    const [selectedDate, setSelectedDate] = useState(toDateKey(todayDate));
    const [imageUri, setImageUri] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    const isToday = selectedDate === todayKey;

    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!isTracking) return;
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [isTracking]);

    // scrollview matches arrow movement
    useEffect(() => {
        const index = stripDays.findIndex(d => toDateKey(d) === selectedDate);
        if (index === -1) return;
        const pillWidth = 64;
        stripRef.current?.scrollTo({
            x: index * pillWidth - 120,
            animated: true,
        });
    }, [selectedDate]);

    // makes sure current date shows on navigation
    useEffect(() => {
        const todayIndex = stripDays.length - 1;
        const pillWidth = 64;
        setTimeout(() => {
            stripRef.current?.scrollTo({
                x: todayIndex * pillWidth - 120,
                animated: false,
            });
        }, 0);
    }, []);
    
// Clock in button
    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 12}}>
                    {isTracking && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Animated.View style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: theme.colors.error,
                                 opacity: pulseAnim,
                            }} />
                            <Text style={{ fontSize: theme.fontSize.xs, color: theme.colors.error, fontWeight: theme.fontWeight.semibold }}>
                                LIVE
                            </Text>
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={handleClockToggle}
                        disabled={clockLoading}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: '#ffffff',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            marginRight: 12,
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

    // Fetches tickets for the selected date from the backend
    // queryKey includes selectedDate so each date gets its own cache entry
    // switching dates re-fetches automatically, same as job/[id] screen
    const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
        queryKey: ['tickets', selectedDate],
        queryFn: async () => {
            const res = await api.get('/tickets/', { params: { date: selectedDate } });
            return res.data as Ticket[];
        },
    });

    // ----------- Camera ------------
    const openCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Camera Permission Required',
                'Camera access is needed to take photos for ticket submission. Enable it in Settings.'
            );
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            // allows editing of the captured image
            allowsEditing: true,
            // compresses image to 70%
            quality: 0.7,
        });

        if (!result.canceled) {
            setImageUri((prev) => [...prev, result.assets[0].uri]);
        }
    };
    // ----------- Gallery ------------
    const openGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Gallery Permission Required',
                'Photo library access is needed to select images for ticket submission. Enable it in Settings.'
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setImageUri((prev) => [...prev, ...result.assets.map(a => a.uri)]);
        }
    };

    // ----------- Submit Ticket ------------
    const handleSubmit = async () => {
        if (!imageUri.length) return;

        setUploading(true);
        try {
            const formData = new FormData();
            imageUri.forEach((uri, index) => {
                formData.append('photos', {
                    uri,
                    name: `ticket_${Date.now()}_${index}.jpg`,
                    type: 'image/jpeg',
                } as any);
            });

            formData.append('date', selectedDate);

            await api.post('/tickets/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            await queryClient.invalidateQueries({ queryKey: ['tickets', selectedDate] });
            setImageUri([]);

            Alert.alert(
                'Ticket Submitted',
                'Your ticket has been submitted successfully.',
                [{ text: 'Done' }]
            );
        } catch (error) {
            Alert.alert(
                'Submission Failed',
                'There was an error submitting your ticket. Please try again.'
            );
        } finally {
            setUploading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex:1, backgroundColor: theme.colors.background }} edges={['bottom']}>
            {/* ---- Arrows to Select Date ---- */}
            <View style={styles.dateNavRow}>
                <TouchableOpacity
                    onPress={() => setSelectedDate(prev => offsetDate(prev, -1))}
                    disabled={selectedDate === toDateKey(stripDays[0])} 
                    style={styles.arrowButton}
                >
                    <MaterialIcons
                        name="chevron-left"
                        size={28}
                        color={selectedDate === toDateKey(stripDays[0])
                            ? theme.colors.disabled
                            : theme.colors.primary}
                    />
                </TouchableOpacity>

                {/* ---- Date Heading ----*/}
                <Text style={styles.dateHeading}>
                    {isToday
                        ? 'Today'
                        : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'long', month: 'long', day: 'numeric'
                        })
                    }
                </Text>

                <TouchableOpacity
                    onPress={() => setSelectedDate(prev => offsetDate(prev, 1))}
                    disabled={isToday} 
                    style={styles.arrowButton}
                >
                    <MaterialIcons
                        name="chevron-right"
                        size={28}
                        color={isToday ? theme.colors.disabled : theme.colors.primary}
                    />
                </TouchableOpacity>
            </View>
            {/* -- Date Strip for selecting which day's tickets to view -- */}
            <View style={styles.stripWrapper}>
                <ScrollView
                    ref={stripRef}
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.stripContent}
                >
                    {stripDays.map((day) => {
                        const key = toDateKey(day);
                        const isSelected = key === selectedDate;
                        const isT = key === todayKey;
                        const hasSubmissions = tickets.length > 0 && key === selectedDate;

                        return (
                            <TouchableOpacity
                                key = {key}
                                style = {[
                                    styles.pill,
                                    isT && styles.pillToday,
                                    isSelected && styles.pillSelected,
                                ]}
                                onPress={() => {
                                    setSelectedDate(key);
                                    setImageUri([]);
                                }}
                            >
                                <Text style={[styles.pillDay, isSelected && styles.pillTextSelected]}>
                                    {DAY_NAMES[day.getDay()]} 
                                </Text>
                                <Text style={[styles.pillDate, isSelected && styles.pillTextSelected]}>
                                    {day.getDate()}
                                </Text>
                                {hasSubmissions && (
                                    <View style={[styles.dot, isSelected && styles.dotSelected]} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>             
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                {/* -- Submitted tickets for selected date */}
                {ticketsLoading ? (
                    <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20}} />
                ) : tickets.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.sectionLabel}>
                            SUBMITTED - {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {tickets.flatMap(ticket =>
                                ticket.photos.map((photo,index) => (
                                    <Image
                                        key={`${ticket.id}-${index}`}
                                        source= {{uri: photo.photo}}
                                        style={styles.historyThumb}
                                        resizeMode="cover"
                                    />
                                ))
                            )}
                        </ScrollView>
                    </View>
                )}

                {isToday ? (
                    <>
                        <Text style={styles.subtitle}>
                            Take a photo of your paperwork or pick one from your gallery.
                        </Text>

                        {imageUri.length > 0 && (
                            <View style={styles.previewContainer}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={{width: '100%'}}
                                >
                                    {imageUri.map((uri, index) => (
                                        <Image
                                            key={index}
                                            source={{ uri }}
                                            style = {styles.preview}
                                            resizeMode="contain"
                                        />
                                    ))}
                                </ScrollView>
                                <TouchableOpacity
                                    onPress={() => setImageUri([]) }
                                    style={styles.retakeButton}
                                >
                                    <Text style={styles.retakeText}>Clear All / Choose Different</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {imageUri.length > 0 && (
                            <TouchableOpacity
                                style={[styles.submitButton, uploading && styles.submitDisabled]}
                                onPress={handleSubmit}
                                disabled={uploading}
                            >
                                {uploading
                                    ? <ActivityIndicator color={theme.colors.textInverse} />
                                    : <Text style={styles.submitButtonText}>Submit to Dispatch</Text>
                                }
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    // past date - read date
                    !ticketsLoading && tickets.length === 0 && (
                        <Text style={styles.emptyText}> No tickets submitted on this day.</Text>
                    )
                )}
            </ScrollView>

            {isToday && (
                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.bottomButton} onPress={openCamera}>
                        <Text style={styles.bottomButtonText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.bottomButton, styles.bottomButtonSecondary]} onPress={openGallery}>
                        <Text style={styles.bottomButtonTextSecondary}> Gallery </Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}               

function makeStyles(theme: ReturnType<typeof import('../../lib/ThemeContext').useTheme>['theme']) {
    return StyleSheet.create({
        stripWrapper: {
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
        },
        stripContent: {
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            gap: theme.spacing.xs,
        },
        pill: {
            width: 56,
            alignItems: 'center',
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.borderRadius.lg,
            gap: 2,
        },
        pillToday: {
            backgroundColor: theme.colors.primary + '20',
        },
        pillSelected: {
            backgroundColor: theme.colors.primary,
        },
        pillDay: {
            fontSize: theme.fontSize.sm,
            color: theme.colors.textSecondary,
            fontWeight: theme.fontWeight.medium,
        },
        pillDate: {
            fontSize: theme.fontSize.md,
            color: theme.colors.text,
            fontWeight: theme.fontWeight.bold,
        },
        pillTextSelected: {
            color: theme.colors.textInverse,
        },
        dot: {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.colors.primary,
            marginTop: 2,
        },
        dotSelected: {
            backgroundColor: theme.colors.textInverse,
        },
        container: {
            padding: theme.spacing.lg,
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        dateHeading: {
            fontSize: theme.fontSize.xl,
            fontWeight: theme.fontWeight.bold,
            color: theme.colors.text,
            textAlign: 'center',
        },
        sectionLabel: {
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.textSecondary,
            letterSpacing: 1,
            alignSelf: 'flex-start',
        },
        historySection: {
            width: '100%',
            gap: theme.spacing.sm,
        },
        historyThumb: {
            width: 100,
            height: 100,
            borderRadius: theme.borderRadius.md,
            marginRight: theme.spacing.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        subtitle: {
            fontSize: theme.fontSize.sm,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            lineHeight: 20,
        },
        previewContainer: {
            width: '100%',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },
        preview: {
            width: 260,
            height: 300,
            borderRadius: theme.borderRadius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginRight: theme.spacing.sm,
        },
        retakeButton: {
            paddingVertical: theme.spacing.sm,
        },
        retakeText: {
            color: theme.colors.primary,
            fontSize: theme.fontSize.sm,
            textDecorationLine: 'underline',
        },
        submitButton: {
            backgroundColor: theme.colors.success,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            alignItems: 'center',
            width: '100%',
        },
        submitDisabled: {
            backgroundColor: theme.colors.disabled,
        },
        submitButtonText: {
            color: theme.colors.textInverse,
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.semibold,
        },
        emptyText: {
            color: theme.colors.textTertiary,
            fontSize: theme.fontSize.md,
            marginTop: theme.spacing.xl,
        },
        bottomBar: {
            flexDirection: 'row',
            gap: theme.spacing.sm,
            padding: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
        },
        bottomButton: {
            flex: 1,
            backgroundColor: theme.colors.primary,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            alignItems: 'center',
        },
        bottomButtonSecondary: {
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: theme.colors.primary,
        },
        bottomButtonText: {
            color: theme.colors.textInverse,
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.semibold,
        },
        bottomButtonTextSecondary: {
            color: theme.colors.primary,
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.semibold,
        },
        dateNavRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.sm,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        arrowButton: {
            padding: theme.spacing.xs,
        },
    });
}