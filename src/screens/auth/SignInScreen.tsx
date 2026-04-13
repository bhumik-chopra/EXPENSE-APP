import { useSignIn } from '@clerk/expo';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormField } from '@/src/components/common/FormField';
import { PrimaryButton } from '@/src/components/common/PrimaryButton';
import { SecondaryButton } from '@/src/components/common/SecondaryButton';
import { StatusBanner } from '@/src/components/common/StatusBanner';
import { ThemedText } from '@/src/components/common/ThemedText';
import { AuthStackParamList } from '@/src/navigation/types';
import { getClerkErrorMessage } from '@/src/utils/clerk';

import { AuthScaffold } from './AuthScaffold';

type Props = NativeStackScreenProps<AuthStackParamList, 'Sign In'>;

export function SignInScreen({ navigation, route }: Props) {
  const { signIn, errors, fetchStatus } = useSignIn();
  const [identifier, setIdentifier] = useState(route.params?.identifier ?? '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const requiresSecondFactor =
    signIn?.status === 'needs_client_trust' || signIn?.status === 'needs_second_factor';

  const handleSubmit = async () => {
    if (!signIn) {
      setError('Authentication is still loading. Please try again in a moment.');
      return;
    }

    if (!identifier.trim() || !password) {
      setError('Enter your email or username and password to sign in.');
      return;
    }

    setError('');
    setInfo('');

    try {
      const normalizedIdentifier = identifier.trim();
      const { error: passwordError } = await signIn.password({
        identifier: normalizedIdentifier,
        password,
      });

      if (passwordError) {
        setError(getClerkErrorMessage(passwordError, 'Unable to sign in.'));
        return;
      }

      if (signIn.status === 'complete') {
        await signIn.finalize();
        return;
      }

      if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
        const emailCodeFactor = signIn.supportedSecondFactors?.find((factor) => factor.strategy === 'email_code');

        if (emailCodeFactor) {
          await signIn.mfa.sendEmailCode();
          setInfo('A verification code was sent to your email. Enter it below to finish signing in.');
          return;
        }

        setError('This sign-in requires a second factor that is not configured in the app yet.');
        return;
      }

      setError(`Sign in is not complete yet. Clerk status: ${signIn.status}.`);
    } catch (authError) {
      setError(getClerkErrorMessage(authError, 'Unable to sign in.'));
    }
  };

  const handleVerifySecondFactor = async () => {
    if (!signIn) {
      setError('Authentication is still loading. Please try again in a moment.');
      return;
    }

    setError('');
    setInfo('');

    try {
      await signIn.mfa.verifyEmailCode({ code: code.trim() });

      if (signIn.status === 'complete') {
        await signIn.finalize();
        return;
      }

      setError(`Verification is not complete yet. Clerk status: ${signIn.status}.`);
    } catch (verifyError) {
      setError(getClerkErrorMessage(verifyError, 'Unable to verify the second factor.'));
    }
  };

  const handleResendSecondFactor = async () => {
    if (!signIn) {
      setError('Authentication is still loading. Please try again in a moment.');
      return;
    }

    setError('');
    setInfo('');

    try {
      await signIn.mfa.sendEmailCode();
      setInfo('A new verification code was sent to your email.');
    } catch (resendError) {
      setError(getClerkErrorMessage(resendError, 'Unable to resend the second-factor code.'));
    }
  };

  const handleStartOver = async () => {
    if (!signIn) {
      return;
    }

    await signIn.reset();
    setCode('');
    setPassword('');
    setError('');
    setInfo('');
  };

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Sign in with your email or username and password to continue managing your expenses.">
      <View style={styles.form}>
        {error ? <StatusBanner message={error} /> : null}
        {info ? <StatusBanner message={info} tone="success" /> : null}
        {errors?.fields?.identifier?.message ? <StatusBanner message={errors.fields.identifier.message} /> : null}
        {errors?.fields?.password?.message ? <StatusBanner message={errors.fields.password.message} /> : null}
        {errors?.fields?.code?.message ? <StatusBanner message={errors.fields.code.message} /> : null}
        <FormField
          label="Email or Username"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry showPasswordToggle />
        <PrimaryButton label="Sign In" onPress={handleSubmit} loading={fetchStatus === 'fetching'} />
        {requiresSecondFactor ? (
          <>
            <FormField
              label="Verification Code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="Enter the email code"
            />
            <PrimaryButton label="Verify Code" onPress={handleVerifySecondFactor} loading={fetchStatus === 'fetching'} />
            <SecondaryButton label="Resend Code" onPress={handleResendSecondFactor} disabled={fetchStatus === 'fetching'} />
            <SecondaryButton label="Start Over" onPress={handleStartOver} disabled={fetchStatus === 'fetching'} />
          </>
        ) : null}
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
