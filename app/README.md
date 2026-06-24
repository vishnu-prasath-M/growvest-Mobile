# Zenvest Mobile App

A React Native mobile application for Zenvest investment platform, built with Expo.

## Features

- **Authentication**: Login with email/mobile number, signup with username and mobile
- **Dashboard**: View balance, earnings, and pending requests
- **Investments**: Create saving and fixed deposits with different interest rates
- **Transactions**: View complete transaction history
- **Withdrawals**: Request withdrawals from saving and fixed deposits
- **Profile**: Manage user profile and account settings

## Technology Stack

- **React Native**: Cross-platform mobile development
- **Expo**: Development and build tooling
- **React Navigation**: Navigation between screens
- **React Native Paper**: Material Design components
- **Axios**: HTTP client for API calls
- **AsyncStorage**: Local data persistence
- **React Native Vector Icons**: Icon library

## Backend Integration

The app connects to the existing Zenvest backend API:
- **Base URL**: https://growvest-online.onrender.com/api
- **Authentication**: JWT token

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1. Navigate to the app directory:
```bash
cd app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Run on your preferred platform:
- **iOS**: Press `i` in the terminal or use the Expo Go app
- **Android**: Press `a` in the terminal or use the Expo Go app
- **Web**: Press `w` in the terminal

## Project Structure

```
app/
├── src/
│   ├── config/
│   │   └── api.js              # API configuration
│   ├── navigation/
│   │   └── AppNavigator.js     # Navigation setup
│   ├── screens/
│   │   ├── auth/              # Authentication screens
│   │   │   ├── LoginScreen.js
│   │   │   └── SignupScreen.js
│   │   ├── tabs/              # Tab screens
│   │   │   ├── HomeScreen.js
│   │   │   ├── InvestmentsScreen.js
│   │   │   ├── TransactionsScreen.js
│   │   │   ├── WithdrawScreen.js
│   │   │   └── ProfileScreen.js
│   │   └── investment/        # Investment flow screens
│   │       ├── InvestmentAmountScreen.js
│   │       ├── InvestmentPaymentScreen.js
│   │       └── InvestmentStatusScreen.js
│   ├── services/              # API services
│   │   ├── apiService.js
│   │   ├── authService.js
│   │   ├── investmentService.js
│   │   ├── transactionService.js
│   │   ├── withdrawalService.js
│   │   ├── userService.js
│   │   └── notificationService.js
│   └── theme/
│       └── theme.js           # Theme configuration
├── assets/                     # Images and icons
├── App.js                      # Main entry point
├── app.json                    # Expo configuration
├── babel.config.js             # Babel configuration
└── package.json                # Dependencies
```

## API Endpoints Used

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- GET `/api/auth/me` - Get current user

### Investments
- POST `/api/investments` - Create investment
- GET `/api/investments` - Get all investments
- PATCH `/api/investments/:id/status` - Update investment status

### Transactions
- GET `/api/transactions/my` - Get user transactions
- GET `/api/transactions/user/:email` - Get transactions by email

### Withdrawals
- POST `/api/withdrawals` - Create withdrawal request
- GET `/api/withdrawals` - Get withdrawals

### Users
- GET `/api/users/profile` - Get user profile
- GET `/api/users/email/:email` - Get user by email

## Features Details

### Investment Flow
1. **Amount Stage**: Select investment type (Saving/Fixed) and enter amount
2. **Payment Stage**: Show QR code and UPI ID for payment
3. **Status Stage**: Confirm payment and submit to admin

### Interest Rates
- **Saving Deposit**: 12% p.a.
- **Fixed Deposit**: 24% p.a. (1-year lock period)

### Withdrawal Rules
- **Saving Deposits**: Withdraw anytime
- **Fixed Deposits**: Withdraw only after 1-year lock period

## Session Management
- User session is persisted using AsyncStorage
- Auto-login on app restart if valid token exists
- Manual logout option in Profile screen

## Notification Service
The notification service structure is prepared for future push notification implementation. Currently supports:
- Local notification structure
- Notification type definitions
- Message templates for different notification types

## Development Notes

- The app uses the existing backend without any modifications
- All API calls use JWT authentication
- Session management is handled via AsyncStorage
- The app follows mobile-first design principles
- Safe area support for notched devices
- Responsive design for different screen sizes

## Build for Production

### Android
```bash
expo build:android
```

### iOS
```bash
expo build:ios
```

## Troubleshooting

### Common Issues

1. **Metro bundler issues**: Clear cache with `npm start -- --clear`
2. **Dependency issues**: Delete `node_modules` and run `npm install`
3. **API connection issues**: Ensure backend is running at https://growvest-online.onrender.com

## License

Proprietary - Zenvest
