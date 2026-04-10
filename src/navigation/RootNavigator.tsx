import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { MAIN_TABS } from '@/src/constants/navigation';
import { AvatarBadge } from '@/src/components/common/AvatarBadge';
import { ThemeToggle } from '@/src/components/common/ThemeToggle';
import { SignInScreen } from '@/src/screens/auth/SignInScreen';
import { SignUpScreen } from '@/src/screens/auth/SignUpScreen';
import { VerifyEmailScreen } from '@/src/screens/auth/VerifyEmailScreen';
import { BhavishyvaniScreen } from '@/src/screens/main/BhavishyvaniScreen';
import { ChartsScreen } from '@/src/screens/main/ChartsScreen';
import { DashboardScreen } from '@/src/screens/main/DashboardScreen';
import { ReportsScreen } from '@/src/screens/main/ReportsScreen';
import { SettingsScreen } from '@/src/screens/main/SettingsScreen';
import { UploadReceiptScreen } from '@/src/screens/main/UploadReceiptScreen';
import { useAppAuth } from '@/src/providers/AuthProvider';
import { useAppTheme } from '@/src/theme/ThemeProvider';

import { AuthStackParamList, MainTabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AppTabs() {
  const { theme } = useAppTheme();
  const { user } = useAppAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitle: 'Expense Tracker',
        headerStyle: {
          backgroundColor: theme.mode === 'dark' ? '#0b0b0f' : '#eff6ff',
        },
        headerTitleStyle: {
          color: theme.colors.text,
          fontWeight: '800',
        },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            <AvatarBadge name={user?.fullName ?? 'ET'} size={36} />
          </View>
        ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          height: 78,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: theme.mode === 'dark' ? '#0f0d14' : 'rgba(255,255,255,0.96)',
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size }) => {
          const config = MAIN_TABS.find((item) => item.key === route.name);
          return <Ionicons name={config?.icon as any} size={size} color={color} />;
        },
        sceneStyle: {
          backgroundColor: 'transparent',
        },
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Upload Receipt" component={UploadReceiptScreen} />
      <Tab.Screen name="Charts" component={ChartsScreen} />
      <Tab.Screen name="BHAVISHYVANI" component={BhavishyvaniScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  const { theme } = useAppTheme();

  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}>
      <AuthStack.Screen name="Sign In" component={SignInScreen} />
      <AuthStack.Screen name="Sign Up" component={SignUpScreen} />
      <AuthStack.Screen name="Verify Email" component={VerifyEmailScreen} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { theme } = useAppTheme();
  const { isLoaded, isSignedIn } = useAppAuth();

  if (!isLoaded) {
    return null;
  }

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          border: theme.colors.border,
          primary: theme.colors.primary,
        },
      }}>
      {isSignedIn ? <AppTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
