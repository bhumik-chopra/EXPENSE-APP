import { StyleSheet, View } from 'react-native';

import { AvatarBadge } from '@/src/components/common/AvatarBadge';
import { GlowCard } from '@/src/components/common/GlowCard';
import { FormField } from '@/src/components/common/FormField';
import { PrimaryButton } from '@/src/components/common/PrimaryButton';
import { Screen } from '@/src/components/common/Screen';
import { SecondaryButton } from '@/src/components/common/SecondaryButton';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useAppAuth } from '@/src/providers/AuthProvider';
import { useExpenseData } from '@/src/providers/DataProvider';

export function SettingsScreen() {
  const { user, signOut } = useAppAuth();
  const { budget, setMonthlyBudget, clearAllExpenses } = useExpenseData();

  return (
    <Screen>
      <GlowCard>
        <View style={styles.profileHeader}>
          <AvatarBadge name={user?.fullName ?? 'Expense Tracker'} size={64} />
          <View style={{ gap: 4 }}>
            <ThemedText variant="title">{user?.fullName ?? 'Expense Tracker User'}</ThemedText>
            <ThemedText>@{user?.username ?? 'user'}</ThemedText>
            <ThemedText>{user?.email ?? ''}</ThemedText>
          </View>
        </View>
      </GlowCard>
      <GlowCard>
        <ThemedText variant="subtitle">Budget</ThemedText>
        <FormField
          label="Monthly Budget"
          defaultValue={String(budget?.monthlyBudget ?? '')}
          keyboardType="decimal-pad"
          onSubmitEditing={(event) => setMonthlyBudget(Number(event.nativeEvent.text))}
        />
      </GlowCard>
      <GlowCard>
        <ThemedText variant="subtitle">Account actions</ThemedText>
        <SecondaryButton label="Clear All Expenses" onPress={() => clearAllExpenses()} />
        <PrimaryButton label="Logout" onPress={() => signOut()} />
      </GlowCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
