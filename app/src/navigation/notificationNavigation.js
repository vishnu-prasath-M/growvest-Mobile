import { navigate } from './navigationRef';
import { NOTIFICATION_TYPES } from '../services/notificationService';

const TAB_SCREENS = new Set(['Home', 'Investments', 'Withdraw', 'Profile']);

const TYPE_TO_SCREEN = {
  [NOTIFICATION_TYPES.INVESTMENT_APPROVED]: 'Investments',
  [NOTIFICATION_TYPES.INVESTMENT_REJECTED]: 'Investments',
  [NOTIFICATION_TYPES.INVESTMENT_PENDING]: 'Investments',
  [NOTIFICATION_TYPES.NEW_DEPOSIT]: 'Investments',
  [NOTIFICATION_TYPES.WITHDRAWAL_APPROVED]: 'Withdraw',
  [NOTIFICATION_TYPES.WITHDRAWAL_REJECTED]: 'Withdraw',
  [NOTIFICATION_TYPES.WITHDRAWAL_PAID]: 'Withdraw',
  [NOTIFICATION_TYPES.WITHDRAWAL_PENDING]: 'Withdraw',
  [NOTIFICATION_TYPES.PAYMENT_REJECTED]: 'Transactions',
  [NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT]: 'Home',
};

const parseParams = (data) => {
  if (!data?.params) {
    return undefined;
  }

  if (typeof data.params === 'string') {
    try {
      return JSON.parse(data.params);
    } catch {
      return undefined;
    }
  }

  return data.params;
};

export const navigateFromNotification = (data = {}) => {
  const screen = data.screen || TYPE_TO_SCREEN[data.type] || 'Home';
  const params = parseParams(data);

  if (TAB_SCREENS.has(screen)) {
    navigate('MainTabs', { screen, params });
    return;
  }

  navigate(screen, params);
};
