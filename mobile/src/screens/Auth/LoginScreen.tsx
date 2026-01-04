import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthLayout from '../../components/AuthLayout';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import { ErrorMessage } from '../../components/ErrorMessage';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/errorMessages';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
  });

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      await authService.signIn(email.trim(), password);
      // Navigation handled by auth listener in RootNavigator
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const processGoogle = async () => {
      if (response?.type === 'success') {
        setGoogleLoading(true);
        setError(null);
        try {
          const idToken = response.params?.id_token;
          if (!idToken) {
            throw new Error('Missing Google ID token');
          }
          await authService.signInWithGoogle(idToken);
        } catch (err: any) {
          setError(getErrorMessage(err));
        } finally {
          setGoogleLoading(false);
        }
      }
    };
    processGoogle();
  }, [response]);

  const handleGoogleSignIn = async () => {
    if (!request) {
      Alert.alert('Unavailable', 'Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_* env vars.');
      return;
    }
    await promptAsync();
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue"
    >
      <FormInput
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError(null); // Clear error when user starts typing
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <FormInput
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setError(null); // Clear error when user starts typing
        }}
        secureTextEntry
        autoComplete="password"
      />

      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <PrimaryButton
        title="Log in"
        onPress={handleLogin}
        loading={loading}
        style={{ marginTop: 8 }}
      />

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity
        style={[styles.googleButton, (!request || googleLoading) && styles.googleDisabled]}
        onPress={handleGoogleSignIn}
        disabled={!request || googleLoading}
      >
        <Text style={styles.googleText}>
          {googleLoading ? 'Signing in...' : 'Continue with Google'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => navigation.navigate('ForgotPassword')}
      >
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New here?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.link}> Create an account</Text>
        </TouchableOpacity>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  linkRow: {
    marginTop: 14,
  },
  link: {
    color: colors.light.accent,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 18,
    alignItems: 'center',
  },
  footerText: {
    color: colors.light.textSecondary,
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.light.border,
  },
  dividerText: {
    color: colors.light.textMuted,
    fontWeight: '600',
  },
  googleButton: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.light.backgroundElevated,
  },
  googleText: {
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  googleDisabled: {
    opacity: 0.6,
  },
});

export default LoginScreen;

