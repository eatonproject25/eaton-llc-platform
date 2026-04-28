import { isAxiosError } from 'axios';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../lib/ThemeContext';
import { api } from '../../services/api';

export default function ForgotPasswordScreen() {
  const { theme, isDark } = useTheme();
  const styles = makeStyles(theme);

  // Tracks which step of the flow we're on:
  // Step 1 = email entry, Step 2 = OTP verification, Step 3 = new password entry
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Send the OTP email
  // Calls POST /api/auth/password-reset/ with the user's email.
  // On success the backend emails them a 6-digit code and we advance to step 2.
  const handleSendCode = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/password-reset/', { email });
      setStep(2);
    } catch (err: unknown) {
      if (isAxiosError(err) && !err.response) {
        setError('Network error. Please try again.');
      } else {
        setError('Could not send reset code. Check your email and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify the OTP code
  // Calls POST /api/auth/password-reset/verify/ to confirm the code is valid
  // before asking the user to set a new password.
  const handleVerifyCode = async () => {
    if (!otp) {
      setError('Please enter the code from your email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/password-reset/verify/', { email, code: otp });
      setStep(3);
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        if (!err.response) {
          setError('Network error. Please try again.');
        } else if (err.response.status === 400) {
          setError('Invalid or expired code. Please try again.');
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set the new password
  // Calls POST /api/auth/password-reset/confirm/ with email, the verified OTP,
  // and the new password. On success, navigates back to the login screen.
  const handleResetPassword = async () => {
    if (!newPassword) {
      setError('Please enter your new password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/password-reset/confirm/', {
        email,
        code: otp,
        new_password: newPassword,
      });
      router.replace('/(auth)/login');
    } catch (err: unknown) {
      if (isAxiosError(err) && !err.response) {
        setError('Network error. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.content}>

        {/* ── STEP 1: Email entry ── */}
        {step === 1 && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>Enter your email to receive a reset code</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.button}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color={theme.colors.textInverse} />
                  : <Text style={styles.buttonText}>Send Code</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkContainer} onPress={() => router.back()}>
                <Text style={styles.linkText}>
                  Back to <Text style={styles.linkBold}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 2: OTP verification ── */}
        {step === 2 && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Check Your Email</Text>
              <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                editable={!isLoading}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.button}
                onPress={handleVerifyCode}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color={theme.colors.textInverse} />
                  : <Text style={styles.buttonText}>Verify Code</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkContainer}
                onPress={() => { setStep(1); setError(''); }}
              >
                <Text style={styles.linkText}>
                  Wrong email? <Text style={styles.linkBold}>Go back</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 3: New password ── */}
        {step === 3 && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.subtitle}>Choose a new password for your account</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor={theme.colors.textTertiary}
                secureTextEntry
                autoComplete="password-new"
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!isLoading}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.button}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color={theme.colors.textInverse} />
                  : <Text style={styles.buttonText}>Reset Password</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkContainer}
                onPress={() => { setStep(2); setError(''); }}
              >
                <Text style={styles.linkText}>
                 { "Didn't get the code?" } <Text style={styles.linkBold}>Go back</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: ReturnType<typeof import('../../lib/ThemeContext').useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      padding: theme.spacing.lg,
      justifyContent: 'center',
    },
    header: {
      marginBottom: theme.spacing.xxl,
    },
    title: {
      fontSize: theme.fontSize.xxxl,
      fontWeight: 'bold',
      marginBottom: theme.spacing.sm,
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
    },
    form: {
      gap: theme.spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      fontSize: theme.fontSize.md,
      backgroundColor: theme.colors.surfaceSecondary,
      color: theme.colors.text,
    },
    button: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    buttonText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
    },
    linkContainer: {
      marginTop: theme.spacing.md,
    },
    linkText: {
      textAlign: 'center',
      color: theme.colors.textSecondary,
    },
    linkBold: {
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.semibold,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: theme.fontSize.sm,
      textAlign: 'center',
    },
  });
}
