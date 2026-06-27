import { userService } from './userService';

export const dashboardService = {
  getDashboard: () => userService.getDashboardData(),
};
