import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from '@/src/navigation/RootNavigator';
import { AuthProvider } from '@/src/providers/AuthProvider';
import { DataProvider } from '@/src/providers/DataProvider';
import { AppThemeProvider, useAppTheme } from '@/src/theme/ThemeProvider';

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function MissingConfiguration() {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Expense Tracker</Text>
      <Text style={styles.message}>
        Add `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to your environment before running the app.
      </Text>
    </View>
  );
}

function AppContent() {
  const { colorScheme } = useAppTheme();

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AuthProvider>
        <DataProvider>
          <RootNavigator />
        </DataProvider>
      </AuthProvider>
    </>
  );
}

function Root() {
  if (!clerkPublishableKey) {
    return <MissingConfiguration />;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <AppThemeProvider>
        <AppContent />
      </AppThemeProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b0b0f',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 12,
  },
  message: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: '#d8b4fe',
  },
});
