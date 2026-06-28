import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);
  const initTimeoutRef = useRef(null);

  useEffect(() => {
    let active = true;
    let service = null;

    const setupNotifications = async () => {
      // Set a timeout to ensure we never block rendering
      const timeout = setTimeout(() => {
        if (active) {
          console.warn('[NotificationProvider] Setup timed out, continuing without notifications');
          setReady(true);
        }
      }, 5000);
      initTimeoutRef.current = timeout;

      try {
        console.log('[NotificationProvider] Setting up notifications...');
        const module = await import('../services/notificationService');
        service = module.notificationService;
        await service.initialize();
        console.log('[NotificationProvider] Notifications initialized successfully');
      } catch (error) {
        console.warn('[NotificationProvider] Notification setup failed:', error?.message || error);
      } finally {
        clearTimeout(timeout);
        if (active) {
          console.log('[NotificationProvider] Setup complete, ready:', true);
          setReady(true);
        }
      }
    };

    setupNotifications();

    return () => {
      active = false;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (service) {
        try {
          service.cleanup();
        } catch (cleanupError) {
          console.warn('[NotificationProvider] Cleanup failed:', cleanupError?.message || cleanupError);
        }
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
        console.log('[NotificationProvider] Syncing notification token, authenticated:', isAuthenticated);
        const { notificationService } = await import('../services/notificationService');
        if (!active) {
          return;
        }

        if (isAuthenticated) {
          await notificationService.syncTokenWithBackend();
          console.log('[NotificationProvider] Token synced successfully');
        } else {
          await notificationService.removeTokenFromBackend();
          console.log('[NotificationProvider] Token removed successfully');
        }
      } catch (error) {
        console.warn('[NotificationProvider] Notification token sync failed:', error?.message || error);
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
