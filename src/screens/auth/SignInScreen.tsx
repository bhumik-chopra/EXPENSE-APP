import { useSignIn } from '@clerk/expo/legacy';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Sign In'>;

export function SignInScreen({ navigation, route }: Props) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isLoaded) {
      setError('Authentication is still loading. Please try again in a moment.');
      return;
    }

    if (!email.trim() || !password) {
      setError('Enter both your email and password to sign in.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await signIn.create({
        identifier: normalizedEmail,
        password,
      });

      if (result.status !== 'complete' || !result.createdSessionId) {
        throw new Error(
          result.firstFactorVerification?.error?.message ??
            `Sign in did not complete. Clerk status: ${result.status}.`,
        );
      }

      await setActive({ session: result.createdSessionId });
    } catch (authError) {
      setError(getClerkErrorMessage(authError, 'Unable to sign in.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Sign in with your email and password to continue managing your expenses.">
      <View style={styles.form}>
        {error ? <StatusBanner message={error} /> : null}
        <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry showPasswordToggle />
        <PrimaryButton label="Sign In" onPress={handleSubmit} loading={loading} />
        <Pressable onPress={() => navigation.navigate('Sign Up')}>
          <ThemedText variant="badge" style={styles.link}>
            Need an account? Sign Up
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
