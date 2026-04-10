import { DEFAULT_CATEGORIES } from '@/src/constants/categories';
import { AnalyticsSummary, Budget, Expense, Predictions, ReceiptAsset, ReceiptPayload, UserSnapshot } from '@/src/types';

import { apiRequest } from './client';

const buildUserHeaders = (user: UserSnapshot) => ({
  'X-User-Id': user.id,
  'X-User-Email': user.email,
  'X-User-Name': user.fullName,
});

const colors = ['#2563eb', '#60a5fa', '#38bdf8', '#8b5cf6', '#ec4899', '#22c55e'];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeExpense = (value: any): Expense => ({
  id: String(value.id ?? value.expense_id ?? value._id ?? Math.random()),
  amount: toNumber(value.amount),
  currency: value.currency ?? 'INR',
  category: value.category ?? 'Other',
  date: value.date ?? value.created_at ?? new Date().toISOString(),
  merchant: value.merchant ?? value.vendor,
  note: value.note ?? value.description,
  items: Array.isArray(value.items) ? value.items : [],
  source: value.source,
  createdAt: value.created_at ?? value.createdAt,
});

export async function getHealth(user: UserSnapshot) {
  return apiRequest('/api/health', { headers: buildUserHeaders(user) });
}

export async function getExpenses(user: UserSnapshot) {
  const payload = await apiRequest<any>('/api/expenses', { headers: buildUserHeaders(user) });
  const list = Array.isArray(payload) ? payload : payload.expenses ?? [];
  return list.map(normalizeExpense);
}

export async function saveExpense(user: UserSnapshot, expense: Partial<Expense>) {
  return apiRequest('/api/expenses', {
    method: 'POST',
    headers: buildUserHeaders(user),
    body: JSON.stringify(expense),
  });
}

export async function deleteExpense(user: UserSnapshot, expenseId: string) {
  return apiRequest(`/api/expenses/${expenseId}`, {
    method: 'DELETE',
    headers: buildUserHeaders(user),
  });
}

export async function clearExpenses(user: UserSnapshot) {
  return apiRequest('/api/expenses/clear', {
    method: 'DELETE',
    headers: buildUserHeaders(user),
  });
}

export async function processReceipt(user: UserSnapshot, asset: ReceiptAsset) {
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType,
  } as any);

  const payload = await apiRequest<any>('/api/process-bill', {
    method: 'POST',
    headers: buildUserHeaders(user),
    body: formData,
  });

  return {
    vendor: payload.vendor ?? payload.merchant ?? '',
    amount: String(payload.amount ?? ''),
    currency: payload.currency ?? 'INR',
    category: payload.category ?? 'Other',
    date: payload.date ?? new Date().toISOString().slice(0, 10),
    items: Array.isArray(payload.items)
      ? payload.items.map((item: any) =>
          typeof item === 'string'
            ? { name: item }
            : {
                name: String(item?.name ?? ''),
                quantity: item?.quantity != null ? toNumber(item.quantity) : undefined,
                price: item?.price != null ? toNumber(item.price) : undefined,
              },
        ).filter((item: { name: string }) => item.name)
      : [],
  } satisfies ReceiptPayload;
}

export async function categorizeExpense(user: UserSnapshot, payload: { description: string }) {
  return apiRequest<any>('/api/categorize-expense', {
    method: 'POST',
    headers: buildUserHeaders(user),
    body: JSON.stringify(payload),
  });
}

export async function getAnalytics(user: UserSnapshot): Promise<AnalyticsSummary> {
  const payload = await apiRequest<any>('/api/analytics', { headers: buildUserHeaders(user) });
  const categories = payload.categoryBreakdown ?? payload.categories ?? payload.by_category ?? payload.categoryData ?? {};
  const trend = payload.spendingTrend ?? payload.daily_spend ?? payload.trend ?? payload.monthlyData ?? [];

  const categoryEntries = Array.isArray(categories)
    ? categories
    : Object.entries(categories).map(([label, value]) => ({ label, value }));

  const trendEntries = Array.isArray(trend)
    ? trend
    : Object.entries(trend).map(([label, value]) => ({ label, value }));

  const monthlyBudget = toNumber(payload.monthlyBudget ?? payload.budget ?? payload.monthly_budget);
  const totalSpent = toNumber(payload.totalSpent ?? payload.total_spent ?? payload.totalExpenses);
  const totalExpenses = toNumber(payload.totalExpenses ?? payload.total_expenses ?? payload.expenseCount);

  return {
    totalSpent,
    totalExpenses,
    monthlyBudget,
    remainingBudget: monthlyBudget - totalSpent,
    categoryBreakdown: categoryEntries.map((entry: any, index: number) => ({
      label: entry.label ?? entry.category ?? entry.name ?? DEFAULT_CATEGORIES[index] ?? `Category ${index + 1}`,
      value: toNumber(entry.value ?? entry.amount),
      color: entry.color ?? colors[index % colors.length],
    })),
    spendingTrend: trendEntries.map((entry: any) => ({
      label: String(entry.label ?? entry.date ?? entry.month ?? ''),
      value: toNumber(entry.value ?? entry.amount),
    })),
  };
}

export async function getBudget(user: UserSnapshot): Promise<Budget> {
  const payload = await apiRequest<any>('/api/budget', { headers: buildUserHeaders(user) });
  const monthlyBudget = toNumber(payload.monthlyBudget ?? payload.budget ?? payload.monthly_budget);
  const spent = toNumber(payload.spent ?? payload.currentSpend ?? payload.current_spend);
  const remaining = payload.remaining != null ? toNumber(payload.remaining) : monthlyBudget - spent;

  return {
    monthlyBudget,
    spent,
    remaining,
    utilization: monthlyBudget ? Math.min(100, Math.round((spent / monthlyBudget) * 100)) : 0,
  };
}

export async function updateBudget(user: UserSnapshot, monthlyBudget: number) {
  return apiRequest('/api/budget', {
    method: 'PUT',
    headers: buildUserHeaders(user),
    body: JSON.stringify({ monthly_budget: Number(monthlyBudget) }),
  });
}

export async function getPredictions(user: UserSnapshot): Promise<Predictions> {
  const payload = await apiRequest<any>('/api/predictions', { headers: buildUserHeaders(user) });
  const forecast = payload.forecast ?? {};
  const riskPayload = payload.risk ?? {};
  const risk = (riskPayload.label ?? payload.risk_status ?? 'safe') as Predictions['risk'];

  return {
    predictedMonthEndSpend: toNumber(
      payload.predictedMonthEndSpend ?? payload.predicted_month_end_spend ?? forecast.predicted_month_end_spend,
    ),
    predictedNext7DaysSpend: toNumber(
      payload.predictedNext7DaysSpend ?? payload.predicted_next_7_days_spend ?? forecast.predicted_next_7_days_spend,
    ),
    predictedTopCategory: payload.predictedTopCategory ?? payload.predicted_top_category ?? forecast.predicted_top_category ?? 'Other',
    insights: Array.isArray(payload.insights) ? payload.insights : [],
    risk,
    riskLabel:
      payload.riskLabel ??
      (risk === 'overspending' ? 'High Risk' : risk === 'warning' ? 'Watch Closely' : 'On Track'),
    budget: toNumber(payload.budget ?? riskPayload.budget),
    currentSpend: toNumber(payload.currentSpend ?? payload.current_spend ?? riskPayload.current_spend),
  };
}
