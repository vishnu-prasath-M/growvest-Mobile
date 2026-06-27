import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let service = null;

    const setupNotifications = async () => {
      try {
        const module = await import('../services/notificationService');
        service = module.notificationService;
        await service.initialize();
      } catch (error) {
        console.warn('Notification setup failed:', error?.message || error);
      } finally {
        if (active) {
          setReady(true);
        }
      }
    };

    setupNotifications();

    return () => {
      active = false;
      if (service) {
        service.cleanup();
      }
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let active = true;

    const sync = async () => {
      try {
        const { notificationService } = await import('../services/notificationService');
        if (!active) {
          return;
        }

        if (isAuthenticated) {
          await notificationService.syncTokenWithBackend();
        } else {
          await notificationService.removeTokenFromBackend();
        }
      } catch (error) {
        console.warn('Notification token sync failed:', error?.message || error);
      }
    };

    sync();

    return () => {
      active = false;
    };
  }, [isAuthenticated, ready]);

  return children;
};

export default NotificationProvider;
