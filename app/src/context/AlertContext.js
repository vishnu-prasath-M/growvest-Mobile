import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ModernAlertModal from '../components/ModernAlertModal';

const AlertContext = createContext(null);

// Static holder for non-hook invocations
let globalAlertHandler = null;

export const AlertProvider = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    primaryButtonText: 'OK',
    secondaryButtonText: null,
    onPrimaryPress: null,
    onSecondaryPress: null,
    isDestructive: false,
  });

  const closeAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback(
    ({
      type = 'success',
      title = '',
      message = '',
      primaryButtonText = 'OK',
      secondaryButtonText = null,
      onPrimaryPress = null,
      onSecondaryPress = null,
      isDestructive = false,
    }) => {
      setAlertConfig({
        visible: true,
        type,
        title,
        message,
        primaryButtonText,
        secondaryButtonText,
        isDestructive,
        onPrimaryPress: () => {
          closeAlert();
          if (typeof onPrimaryPress === 'function') {
            onPrimaryPress();
          }
        },
        onSecondaryPress: secondaryButtonText
          ? () => {
              closeAlert();
              if (typeof onSecondaryPress === 'function') {
                onSecondaryPress();
              }
            }
          : null,
      });
    },
    [closeAlert]
  );

  const showConfirm = useCallback(
    ({
      title,
      message,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      type = 'warning',
      isDestructive = false,
      onConfirm,
      onCancel,
    }) => {
      showAlert({
        type,
        title,
        message,
        primaryButtonText: confirmText,
        secondaryButtonText: cancelText,
        isDestructive,
        onPrimaryPress: onConfirm,
        onSecondaryPress: onCancel,
      });
    },
    [showAlert]
  );

  const showSuccess = useCallback(
    (title, message, onOk, buttonText = 'Nice one!') => {
      showAlert({
        type: 'success',
        title: title || 'Success!',
        message: message || '',
        primaryButtonText: buttonText,
        onPrimaryPress: onOk,
      });
    },
    [showAlert]
  );

  const showError = useCallback(
    (title, message, onOk, buttonText = 'Try again') => {
      showAlert({
        type: 'error',
        title: title || 'There is a problem',
        message: message || '',
        primaryButtonText: buttonText,
        onPrimaryPress: onOk,
      });
    },
    [showAlert]
  );

  const showWarning = useCallback(
    (title, message, onOk, buttonText = 'Okay') => {
      showAlert({
        type: 'warning',
        title: title || 'Notice',
        message: message || '',
        primaryButtonText: buttonText,
        onPrimaryPress: onOk,
      });
    },
    [showAlert]
  );

  // Bind global handler
  React.useEffect(() => {
    globalAlertHandler = {
      showAlert,
      showConfirm,
      showSuccess,
      showError,
      showWarning,
      closeAlert,
    };
    return () => {
      globalAlertHandler = null;
    };
  }, [showAlert, showConfirm, showSuccess, showError, showWarning, closeAlert]);

  return (
    <AlertContext.Provider
      value={{
        showAlert,
        showConfirm,
        showSuccess,
        showError,
        showWarning,
        closeAlert,
      }}
    >
      {children}
      <ModernAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        primaryButtonText={alertConfig.primaryButtonText}
        secondaryButtonText={alertConfig.secondaryButtonText}
        isDestructive={alertConfig.isDestructive}
        onPrimaryPress={alertConfig.onPrimaryPress || closeAlert}
        onSecondaryPress={alertConfig.onSecondaryPress || closeAlert}
        onClose={closeAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    // If used outside provider, fallback to global handler if available
    if (globalAlertHandler) return globalAlertHandler;
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

// Global standalone object for calling alerts from non-React hook scopes
export const customAlert = {
  show: (opts) => globalAlertHandler?.showAlert(opts),
  confirm: (opts) => globalAlertHandler?.showConfirm(opts),
  success: (title, msg, onOk, btn) => globalAlertHandler?.showSuccess(title, msg, onOk, btn),
  error: (title, msg, onOk, btn) => globalAlertHandler?.showError(title, msg, onOk, btn),
  warning: (title, msg, onOk, btn) => globalAlertHandler?.showWarning(title, msg, onOk, btn),
};
