# Expense Tracker Mobile

Faithful React Native mobile implementation of the `Expense Tracker` web app using Expo, React Navigation, and Clerk.

## Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env`

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c2luY2VyZS1zaGVlcC00NC5jbGVyay5hY2NvdW50cy5kZXYk
```

3. Enable Clerk Native API in the Clerk dashboard and allow the redirect scheme:

```text
expensetracker://auth
```

4. Start the app

```bash
npx expo start
```

Do not place a Clerk secret key in this Expo app. Secret keys belong only on a secure backend/server.

The app auto-detects the backend host from the Expo development host when possible and falls back to `EXPO_PUBLIC_API_BASE_URL`.

## Included Features

- Clerk email/password sign in and sign up with verification code
- Persistent light/dark theme with premium visual treatment
- Dashboard with `UploadCard`, `PieChartCard`, `ExpenseTable`, `LineChartCard`, and `BudgetProgressCard`
- Receipt import from files, image library, and camera
- Backend integration for expenses, analytics, budget, reports, and predictions
- `BHAVISHYVANI` forecast screen
- CSV and PDF report export via native share flows

## Web To Mobile Mapping

- Dashboard -> `src/screens/main/DashboardScreen.tsx`
- Upload Receipt -> `src/screens/main/UploadReceiptScreen.tsx`
- Charts -> `src/screens/main/ChartsScreen.tsx`
- BHAVISHYVANI -> `src/screens/main/BhavishyvaniScreen.tsx`
- Reports -> `src/screens/main/ReportsScreen.tsx`
- Settings -> `src/screens/main/SettingsScreen.tsx`
- Auth flow -> `src/screens/auth/*`
- Shared UI/cards -> `src/components/*`
- Backend/API layer -> `src/api/*`
- Theme system -> `src/theme/*`
