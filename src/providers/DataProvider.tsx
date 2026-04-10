import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as expensesApi from '@/src/api/expenses';
import { useAppAuth } from '@/src/providers/AuthProvider';
import { AnalyticsSummary, Budget, Expense, Predictions, ReceiptAsset, ReceiptPayload } from '@/src/types';

type DataContextValue = {
  expenses: Expense[];
  analytics: AnalyticsSummary | null;
  budget: Budget | null;
  predictions: Predictions | null;
  loading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  addExpense: (expense: Partial<Expense>) => Promise<void>;
  removeExpense: (expenseId: string) => Promise<void>;
  processReceipt: (asset: ReceiptAsset) => Promise<ReceiptPayload>;
  saveProcessedReceipt: (payload: ReceiptPayload) => Promise<void>;
  setMonthlyBudget: (value: number) => Promise<void>;
  clearAllExpenses: () => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: PropsWithChildren) {
  const { isSignedIn, user } = useAppAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [predictions, setPredictions] = useState<Predictions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    if (!user || !isSignedIn) return;

    setLoading(true);
    setError(null);

    try {
      const [expensesData, analyticsData, budgetData, predictionsData] = await Promise.all([
        expensesApi.getExpenses(user),
        expensesApi.getAnalytics(user),
        expensesApi.getBudget(user),
        expensesApi.getPredictions(user),
      ]);

      setExpenses(expensesData);
      setAnalytics(analyticsData);
      setBudget(budgetData);
      setPredictions(predictionsData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load account data.');
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, user]);

  useEffect(() => {
    refreshAll().catch(() => null);
  }, [refreshAll]);

  const addExpense = useCallback(async (expense: Partial<Expense>) => {
    if (!user) return;
    await expensesApi.saveExpense(user, expense);
    await refreshAll();
  }, [refreshAll, user]);

  const removeExpense = useCallback(async (expenseId: string) => {
    if (!user) return;
    await expensesApi.deleteExpense(user, expenseId);
    await refreshAll();
  }, [refreshAll, user]);

  const processReceipt = useCallback(async (asset: ReceiptAsset) => {
    if (!user) {
      throw new Error('You need to be signed in to upload a receipt.');
    }

    return expensesApi.processReceipt(user, asset);
  }, [user]);

  const saveProcessedReceipt = useCallback(async (payload: ReceiptPayload) => {
    await addExpense({
      merchant: payload.vendor.trim() || payload.category || 'Receipt expense',
      amount: Number(payload.amount),
      currency: payload.currency,
      category: payload.category,
      date: payload.date,
      items: payload.items,
      source: 'receipt',
    });
  }, [addExpense]);

  const setMonthlyBudget = useCallback(async (value: number) => {
    if (!user) return;
    await expensesApi.updateBudget(user, value);
    await refreshAll();
  }, [refreshAll, user]);

  const clearAllExpenses = useCallback(async () => {
    if (!user) return;
    await expensesApi.clearExpenses(user);
    await refreshAll();
  }, [refreshAll, user]);

  const value = useMemo(
    () => ({
      expenses,
      analytics,
      budget,
      predictions,
      loading,
      error,
      refreshAll,
      addExpense,
      removeExpense,
      processReceipt,
      saveProcessedReceipt,
      setMonthlyBudget,
      clearAllExpenses,
    }),
    [
      expenses,
      analytics,
      budget,
      predictions,
      loading,
      error,
      refreshAll,
      addExpense,
      removeExpense,
      processReceipt,
      saveProcessedReceipt,
      setMonthlyBudget,
      clearAllExpenses,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useExpenseData() {
  const context = useContext(DataContext);

  if (!context) {
    throw new Error('useExpenseData must be used within DataProvider');
  }

  return context;
}
