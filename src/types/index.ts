export type ThemeMode = 'light' | 'dark';

export type UserSnapshot = {
  id: string;
  email: string;
  fullName: string;
  username: string;
};

export type ExpenseItem = {
  name: string;
  quantity?: number;
  price?: number;
};

export type Expense = {
  id: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  merchant?: string;
  note?: string;
  items?: ExpenseItem[];
  source?: string;
  createdAt?: string;
};

export type AnalyticsSummary = {
  totalSpent: number;
  totalExpenses: number;
  monthlyBudget: number;
  remainingBudget: number;
  categoryBreakdown: { label: string; value: number; color: string }[];
  spendingTrend: { label: string; value: number }[];
};

export type Budget = {
  monthlyBudget: number;
  spent: number;
  remaining: number;
  utilization: number;
};

export type PredictionRisk = 'safe' | 'warning' | 'overspending';

export type Predictions = {
  predictedMonthEndSpend: number;
  predictedNext7DaysSpend: number;
  predictedTopCategory: string;
  insights: string[];
  risk: PredictionRisk;
  riskLabel: string;
  budget: number;
  currentSpend: number;
};

export type ReceiptPayload = {
  vendor: string;
  amount: string;
  currency: string;
  category: string;
  date: string;
  items: ExpenseItem[];
};

export type ReceiptAsset = {
  uri: string;
  name: string;
  mimeType: string;
};
