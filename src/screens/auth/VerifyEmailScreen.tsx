import { useSignUp } from '@clerk/expo/legacy';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { View } from 'react-native';

import { FormField } from '@/src/components/common/FormField';
import { PrimaryButton } from '@/src/components/common/PrimaryButton';
import { SecondaryButton } from '@/src/components/common/SecondaryButton';
import { StatusBanner } from '@/src/components/common/StatusBanner';
import { AuthStackParamList } from '@/src/navigation/types';
import { getClerkErrorMessage } from '@/src/utils/clerk';

import { AuthScaffold } from './AuthScaffold';

type Props = NativeStackScreenProps<AuthStackParamList, 'Verify Email'>;

export function VerifyEmailScreen({ navigation, route }: Props) {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!isLoaded) {
      setError('Authentication is still loading. Please try again in a moment.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        return;
      }

      if (result.status === 'missing_requirements' || result.status === 'abandoned') {
        setInfo('Your email looks verified, but Clerk did not finish creating a session here. Please sign in with your email and password.');
        navigation.navigate('Sign In', { identifier: route.params.email });
        return;
      }

      setError(`Verification is still pending. Clerk status: ${result.status}. Try resending the code or sign in if your email is already verified.`);
    } catch (verifyError) {
      const message = getClerkErrorMessage(verifyError, 'Verification failed.');
      const normalizedMessage = message.toLowerCase();

      if (normalizedMessage.includes('already verified') || normalizedMessage.includes('has been verified')) {
        setInfo('This email is already verified. Please sign in with your email and password.');
        navigation.navigate('Sign In', { identifier: route.params.email });
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!isLoaded) {
      setError('Authentication is still loading. Please try again in a moment.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setInfo(`A new verification code was sent to ${route.params.email}.`);
    } catch (resendError) {
      const message = getClerkErrorMessage(resendError, 'Unable to resend verification code.');
      const normalizedMessage = message.toLowerCase();

      if (normalizedMessage.includes('already verified') || normalizedMessage.includes('has been verified')) {
        setInfo('This email is already verified. Please sign in with your email and password.');
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Verify your email"
      subtitle={`Enter the verification code sent to ${route.params.email}.`}>
      <View style={{ gap: 14 }}>
        {error ? <StatusBanner message={error} /> : null}
        {info ? <StatusBanner message={info} tone="success" /> : null}
        <FormField label="Verification Code" value={code} onChangeText={setCode} keyboardType="number-pad" />
        <PrimaryButton label="Verify Email" onPress={handleVerify} loading={loading} />
        <SecondaryButton label="Resend Code" onPress={handleResend} />
        <SecondaryButton
          label="Go To Sign In"
          onPress={() => navigation.navigate('Sign In', { identifier: route.params.email })}
        />
      </View>
    </AuthScaffold>
  );
}
