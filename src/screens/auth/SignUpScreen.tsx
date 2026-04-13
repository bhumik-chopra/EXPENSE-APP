import { useSignUp } from '@clerk/expo/legacy';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormField } from '@/src/components/common/FormField';
import { PrimaryButton } from '@/src/components/common/PrimaryButton';
import { StatusBanner } from '@/src/components/common/StatusBanner';
import { ThemedText } from '@/src/components/common/ThemedText';
import { AuthStackParamList } from '@/src/navigation/types';
import { getClerkErrorMessage } from '@/src/utils/clerk';

import { AuthScaffold } from './AuthScaffold';

type Props = NativeStackScreenProps<AuthStackParamList, 'Sign Up'>;

const isPasswordValid = (value: string) =>
  value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value);

export function SignUpScreen({ navigation }: Props) {
  const { signUp, isLoaded } = useSignUp();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isLoaded) {
      setError('Authentication is still loading. Please try again in a moment.');
      return;
    }

    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      setError('Enter your full name, username, email, and password to create an account.');
      return;
    }

    if (!isPasswordValid(password)) {
      setError('Password must be at least 8 characters and include uppercase and lowercase letters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedUsername = username.trim().toLowerCase();
      const [firstName, ...restNames] = fullName.trim().split(/\s+/);

      await signUp.create({
        emailAddress: normalizedEmail,
        username: normalizedUsername,
        password,
        firstName: firstName ?? fullName.trim(),
        lastName: restNames.join(' ') || undefined,
        unsafeMetadata: {
          fullName: fullName.trim(),
        },
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      navigation.navigate('Verify Email', { email: normalizedEmail });
    } catch (authError) {
      setError(getClerkErrorMessage(authError, 'Unable to sign up.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Create your account"
      subtitle="Create an account with your full name, username, email, and password. You will verify your email before the session starts.">
      <View style={styles.form}>
        {error ? <StatusBanner message={error} /> : null}
        <FormField label="Full Name" value={fullName} onChangeText={setFullName} />
        <FormField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          showPasswordToggle
          helperText="Minimum 8 characters, 1 uppercase, and 1 lowercase letter."
        />
        <PrimaryButton label="Sign Up" onPress={handleSubmit} loading={loading} />
        <Pressable onPress={() => navigation.navigate('Sign In')}>
          <ThemedText variant="badge" style={styles.link}>
            Already have an account? Sign In
          </ThemedText>
        </Pressable>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  link: {
    textAlign: 'center',
    marginTop: 4,
  },
});
