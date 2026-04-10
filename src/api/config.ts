import Constants from 'expo-constants';

const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000';

const deriveExpoHostApiBaseUrl = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.developer?.tool ??
    null;

  if (!hostUri) {
    return null;
  }

  const host = hostUri.split(':')[0];
  return host ? `http://${host}:5000` : null;
};

export const getApiBaseUrl = async () => {
  return deriveExpoHostApiBaseUrl() ?? envApiBaseUrl;
};

export const getCachedApiBaseUrl = () => deriveExpoHostApiBaseUrl() ?? envApiBaseUrl;
