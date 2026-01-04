import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthLayout from '../../components/AuthLayout';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import { ErrorMessage } from '../../components/ErrorMessage';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/errorMessages';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    setError(null);
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(email.trim());
      Alert.alert('Email sent', 'Check your inbox for reset instructions.');
      navigation.goBack();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email associated with your account."
      showBack
    >
      <FormInput
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <PrimaryButton
        title="Send reset link"
        onPress={handleReset}
        loading={loading}
      />
      <View style={styles.note}>
        <Text style={styles.noteText}>
          We'll send you a link to reset your password.
        </Text>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  note: {
    marginTop: 16,
  },
  noteText: {
    color: colors.light.textMuted,
  },
});

export default ForgotPasswordScreen;

