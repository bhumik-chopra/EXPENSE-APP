import { useAuth, useUser } from '@clerk/expo';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import { UserSnapshot } from '@/src/types';
import { storage, storageKeys } from '@/src/utils/storage';

type AuthContextValue = {
  isSignedIn: boolean;
  isLoaded: boolean;
  user: UserSnapshot | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  const snapshot = useMemo<UserSnapshot | null>(() => {
    if (!user) return null;

    return {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? '',
      fullName: user.fullName ?? user.firstName ?? 'Expense Tracker User',
      username: user.username ?? user.primaryEmailAddress?.emailAddress?.split('@')[0] ?? 'user',
    };
  }, [user]);

  useEffect(() => {
    if (snapshot) {
      storage.set(storageKeys.signedInUser, snapshot).catch(() => null);
    } else {
      storage.remove(storageKeys.signedInUser).catch(() => null);
    }
  }, [snapshot]);

  const value = useMemo(
    () => ({
      isLoaded,
      signOut,
      user: snapshot,
      isSignedIn: Boolean(isSignedIn),
    }),
    [isLoaded, isSignedIn, signOut, snapshot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAppAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAppAuth must be used within AuthProvider');
  }

  return context;
}
