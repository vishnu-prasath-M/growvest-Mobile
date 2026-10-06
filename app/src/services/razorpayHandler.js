import { NativeModules, Linking } from 'react-native';
import { paymentService } from './paymentService';
import { customAlert } from '../context/AlertContext';

// ============================================================================
// === PREVIOUS RAZORPAY NATIVE CHECKOUT (COMMENTED OUT AS REQUESTED) =========
// ============================================================================
/*
const getRazorpayCheckout = () => {
  try {
    const isNativeModuleAvailable = !!(
      NativeModules.RNRazorpayCheckout ||
      (typeof global !== 'undefined' && global.__turboModuleProxy?.('RNRazorpayCheckout'))
    );

    if (!isNativeModuleAvailable) {
      return null;
    }

    const RazorpayCheckout = require('react-native-razorpay');
    return RazorpayCheckout.default || RazorpayCheckout;
  } catch (err) {
    console.warn('[Razorpay] Native module resolution failed:', err?.message);
    return null;
  }
};
*/

/**
 * Reusable Custom UPI Payment Handler (replaces Razorpay)
 * 
 * 1. Calls backend createOrder() (which generates order with Custom UPI / PayMe gateway)
 * 2. Launches the official payment URL in the browser / UPI app chooser via Linking.openURL
 * 3. Prompts user to confirm payment once completed
 * 4. Calls backend verifyPayment() to check gateway status, auto-approve, update balances & notify
 */
export const executeRazorpayPayment = async ({
  amount,
  paymentType, // 'investment', 'chit_join', 'chit_payment', 'pocket_money'
  payloadData,  // metadata
  user,
  onSuccess,
  onFailure,
  setLoading,
}) => {
  if (setLoading) setLoading(true);

  try {
    // Step 1: Create payment order on backend
    const orderData = await paymentService.createOrder(amount, paymentType, payloadData);
    const { orderId, paymentUrl, isSimulated } = orderData;

    /*
    // === PREVIOUS RAZORPAY OPTIONS & CHECKOUT (COMMENTED OUT) ===
    const options = {
      description: `Growvest ${paymentType.replace('_', ' ').toUpperCase()}`,
      image: 'https://growvest-mobile.onrender.com/logo.png',
      currency: 'INR',
      key: keyId || 'rzp_test_xxxxxxxxx',
      amount: Math.round(amount * 100),
      name: 'Growvest',
      order_id: orderId,
      prefill: {
        email: user?.email || '',
        contact: user?.mobileNumber || '',
        name: user?.name || user?.username || 'User',
      },
      theme: { color: '#0E3D23' },
    };
    const RazorpayCheckout = getRazorpayCheckout();
    if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
      const response = await RazorpayCheckout.open(options);
      ...
    }
    */

    // Step 2: Handle live UPI Payment URL or Test Simulator
    const isLiveUrl = Boolean(
      paymentUrl &&
      (paymentUrl.startsWith('http://') || paymentUrl.startsWith('https://')) &&
      !paymentUrl.includes('simulated')
    );

    if (isLiveUrl && !isSimulated) {
      // Live Gateway Flow: Open UPI / Instant Pay checkout
      try {
        await Linking.openURL(paymentUrl);
      } catch (linkErr) {
        console.warn('[PaymentHandler] Could not open URL automatically:', linkErr.message);
      }

      if (setLoading) setLoading(false);

      // Prompt user to verify once payment is completed in UPI app / browser
      customAlert.confirm({
        type: 'payout',
        title: 'UPI Payment Initiated',
        message: `Your payment link of ₹${Number(amount).toLocaleString('en-IN')} has been opened.\n\nAfter completing the payment in your UPI app or browser, tap "Verify Payment" below.`,
        cancelText: 'Cancel Payment',
        confirmText: 'Verify Payment',
        onCancel: () => {
          if (setLoading) setLoading(false);
          if (onFailure) onFailure(new Error('User cancelled payment'));
        },
        onConfirm: async () => {
          try {
            if (setLoading) setLoading(true);
            const verification = await paymentService.verifyPayment({
              order_id: orderId,
              paymentType,
              payloadData,
            });

            if (verification?.isPending) {
              if (setLoading) setLoading(false);
              customAlert.warning(
                'Payment Pending',
                verification.message || 'Payment is still being processed. Please wait a few moments and tap verify again.'
              );
              return;
            }

            if (setLoading) setLoading(false);
            if (onSuccess) onSuccess(verification);
          } catch (verifyErr) {
            if (setLoading) setLoading(false);
            const msg = verifyErr.response?.data?.message || verifyErr.message || 'Verification failed';
            customAlert.error('Payment Verification Failed', msg);
            if (onFailure) onFailure(verifyErr);
          }
        },
      });
    } else {
      // Test Mode Simulation Fallback (for development / local testing)
      if (setLoading) setLoading(false);

      customAlert.confirm({
        type: 'payout',
        title: 'UPI Gateway (Test Mode)',
        message: `Gateway is running in simulation mode.\n\nSimulate successful payment of ₹${Number(amount).toLocaleString('en-IN')} for Order ${orderId}?`,
        cancelText: 'Cancel Payment',
        confirmText: 'Simulate Pay',
        onCancel: () => {
          if (setLoading) setLoading(false);
          if (onFailure) onFailure(new Error('User cancelled payment'));
        },
        onConfirm: async () => {
          try {
            if (setLoading) setLoading(true);
            const mockUtr = `UTR_SIM_${Date.now()}`;

            const verification = await paymentService.verifyPayment({
              order_id: orderId,
              utr: mockUtr,
              isSimulated: true,
              paymentType,
              payloadData,
            });

            if (setLoading) setLoading(false);
            if (onSuccess) onSuccess(verification);
          } catch (verifyErr) {
            if (setLoading) setLoading(false);
            const msg = verifyErr.response?.data?.message || verifyErr.message || 'Verification failed';
            customAlert.error('Payment Verification Failed', msg);
            if (onFailure) onFailure(verifyErr);
          }
        },
      });
    }
  } catch (error) {
    if (setLoading) setLoading(false);
    console.error('[PaymentHandler] Order initiation error:', error);
    const msg = error.response?.data?.message || error.message || 'Failed to initiate payment';
    customAlert.error('Error', msg);
    if (onFailure) onFailure(error);
  }
};

/**
 * Open Checkout for already-created orders (used by SIP, etc.)
 */
export const openRazorpayCheckout = async ({
  orderId,
  paymentUrl,
  amount,
  keyId,
  name = 'Growvest',
  description = 'Payment',
  user,
  isSimulated = false,
  onSuccess,
  onError,
}) => {
  const displayAmount = typeof amount === 'number' && amount > 10000 && Number.isInteger(amount) && amount % 100 === 0
    ? Math.round(amount / 100)
    : Math.round(Number(amount));

  const isLiveUrl = Boolean(
    paymentUrl &&
    (paymentUrl.startsWith('http://') || paymentUrl.startsWith('https://')) &&
    !paymentUrl.includes('simulated')
  );

  if (isLiveUrl && !isSimulated) {
    try {
      await Linking.openURL(paymentUrl);
    } catch (e) {
      console.warn('[PaymentHandler] Could not open URL:', e.message);
    }

    customAlert.confirm({
      type: 'payout',
      title: 'Complete UPI Payment',
      message: `Payment page opened for ₹${displayAmount.toLocaleString('en-IN')}.\n\nComplete the transaction in your UPI app or browser, then tap "I Have Paid" below.`,
      cancelText: 'Cancel',
      confirmText: 'I Have Paid',
      onCancel: () => {
        if (onError) onError(new Error('User cancelled payment'));
      },
      onConfirm: () => {
        if (onSuccess) {
          onSuccess({
            order_id: orderId,
            razorpay_order_id: orderId,
            utr: `UTR_${Date.now()}`,
            razorpay_payment_id: `PAY_${Date.now()}`,
            razorpay_signature: `VERIFIED_${orderId}`,
          });
        }
      },
    });
  } else {
    // Test simulator fallback
    customAlert.confirm({
      type: 'payout',
      title: 'UPI Gateway (Test Mode)',
      message: `Simulate test payment of ₹${displayAmount.toLocaleString('en-IN')} for ${description}?`,
      cancelText: 'Cancel',
      confirmText: 'Simulate Pay',
      onCancel: () => {
        if (onError) onError(new Error('User cancelled'));
      },
      onConfirm: () => {
        const mockPaymentId = `pay_${Date.now()}`;
        const signature = `simulated_signature_${orderId}_${mockPaymentId}`;
        if (onSuccess) {
          onSuccess({
            order_id: orderId,
            razorpay_order_id: orderId,
            utr: `UTR_SIM_${Date.now()}`,
            razorpay_payment_id: mockPaymentId,
            razorpay_signature: signature,
            isSimulated: true,
          });
        }
      },
    });
  }
};
