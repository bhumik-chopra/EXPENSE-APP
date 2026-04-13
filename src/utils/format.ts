export const currency = (value: number, _code = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const currencyLabel = (_code = 'INR') => 'INR';

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

export const monthLabel = (value: Date) =>
  value.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });

export const toMonthInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};
