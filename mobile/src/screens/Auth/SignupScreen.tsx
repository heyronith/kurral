import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthLayout from '../../components/AuthLayout';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import { ErrorMessage } from '../../components/ErrorMessage';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/errorMessages';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

const SignupScreen = ({ navigation }: Props) => {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    setError(null);
    if (!name || !handle || !email || !password) {
      setError('Please fill out all fields.');
      return;
    }
    setLoading(true);
    try {
      await authService.signUp(email.trim(), password, name.trim(), handle.trim());
      // Navigation handled by auth listener in RootNavigator
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join Kural and control your feed."
      showBack
    >
      <FormInput
        label="Full Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError(null);
        }}
        autoCapitalize="words"
      />
      <FormInput
        label="Handle"
        value={handle}
        onChangeText={(text) => {
          setHandle(text);
          setError(null);
        }}
        autoCapitalize="none"
        placeholder="yourhandle"
      />
      <FormInput
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError(null);
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
          setError(null);
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
        title="Sign up"
        onPress={handleSignup}
        loading={loading}
        style={{ marginTop: 8 }}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}> Log in</Text>
        </TouchableOpacity>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    marginTop: 18,
    alignItems: 'center',
  },
  footerText: {
    color: colors.light.textSecondary,
    fontSize: 14,
  },
  link: {
    color: colors.light.accent,
    fontWeight: '700',
  },
});

export default SignupScreen;

