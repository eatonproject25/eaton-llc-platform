import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

// This screen allows users to log in with their credentials. 
// It uses the useAuth hook to handle authentication and redirects to the main app screen on success. 
// It also includes error handling and loading states for better UX.
export default function LoginScreen() {
  const { theme, isDark } = useTheme();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!username || !password) {
      setError('Please enter your username and password');
      return;
    }

    setIsLoading(true);
    setError('');

    const { error: authError } = await login(username, password);

    if (authError) {
      setError(authError);
      setIsLoading(false);
    } else {
      router.replace('/(tabs)/myjobs');
    }
  };
  // Build styles inside component to have access to theme values
  const styles = makeStyles(theme);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor= {theme.colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChangeText={setUsername}
            editable={!isLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor= {theme.colors.textTertiary}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
          />

          {error ? (
            <Text testID="login-error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity 
            style={styles.button}
            onPress = {handleSignIn}
            disabled={isLoading}
          >
            {isLoading 
              ? <ActivityIndicator color={theme.colors.textInverse} />
              : <Text style={styles.buttonText}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity 
           style={styles.linkContainer}
           onPress={() => router.push('/(auth)/forgotpassword')}
           >
            <Text style={styles.linkText}>
              Forgot your password? <Text style={styles.linkBold}>Reset it</Text>
            </Text>
          </TouchableOpacity>
        </View>
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
  buttonDisabled: { opacity: 0.6 },
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
    marginTop: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  
});
}