# Growvest Mobile App UI Transformation Plan

## Overview
Transform the Growvest React Native mobile application UI into a premium, production-ready fintech experience while preserving all existing functionality and backend integrations.

## Files to Modify (ONLY in `app` and `mobile-server`)
- `app/App.js`
- `app/src/theme/theme.js`
- `app/src/navigation/AppNavigator.js`
- `app/src/screens/auth/LoginScreen.js`
- `app/src/screens/auth/SignupScreen.js`
- `app/src/screens/tabs/HomeScreen.js`
- `app/src/screens/tabs/InvestmentsScreen.js`
- `app/src/screens/tabs/TransactionsScreen.js`
- `app/src/screens/tabs/WithdrawScreen.js`
- `app/src/screens/tabs/ProfileScreen.js`
- `app/src/screens/investment/InvestmentAmountScreen.js`
- `app/src/screens/investment/InvestmentPaymentScreen.js`
- `app/src/screens/investment/InvestmentStatusScreen.js`
- `app/src/services/*` (if needed for data binding fixes)
- `mobile-server/controllers/*` (if needed for API fixes)
- `mobile-server/routes/*` (if needed for API fixes)

## Implementation Order

1. **Theme System** (`app/src/theme/theme.js`) - Premium fintech colors, typography, shadows, spacing
2. **Bottom Tab Navigation** (`app/src/navigation/AppNavigator.js`) - Floating tab bar with premium icons
3. **Home Screen** (`app/src/screens/tabs/HomeScreen.js`) - Dashboard layout with real data
4. **Transactions Screen** (`app/src/screens/tabs/TransactionsScreen.js`) - Filtered transactions with premium UI
5. **Investments Screen** (`app/src/screens/tabs/InvestmentsScreen.js`) - Premium investment UI
6. **Withdraw Screen** (`app/src/screens/tabs/WithdrawScreen.js`) - Premium withdraw UI
7. **Profile Screen** (`app/src/screens/tabs/ProfileScreen.js`) - Real user data with premium UI
8. **Investment Flow Screens** - Amount, Payment, Status screens
9. **Auth Screens** - Login, Signup
10. **App.js** - Main app entry point updates

## Key Design Decisions
- Use Growvest existing color theme (#4F46E5 primary, etc.)
- Floating bottom tab navigation
- Premium card components with shadows
- Real data fetching from MongoDB/API
- Subtle animations
- Responsive to all screen sizes
- SafeAreaView support