import { NativeModules } from 'react-native';
import { paymentService } from './paymentService';
import { customAlert } from '../context/AlertContext';

/**
 * Dynamically resolves Razorpay native checkout if native module is available
 * (present in standalone APK, local Android run, or custom EAS dev client).
 * Prevents Expo Go crashes by only importing when RNRazorpayCheckout is linked.
 */
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

/**
 * Reusable Razorpay Payment Handler
 * 
 * 1. Calls backend createOrder()
 * 2. Opens official native Razorpay Checkout with UPI / Cards / Netbanking (on APK/dev client)
 * 3. Sends payment credentials to backend verifyPayment()
 * 4. Backend automatically auto-approves investment, updates balance, creates transaction, sends push notification
 */
export const executeRazorpayPayment = async ({
  amount,
  paymentType, // 'investment', 'chit_join', 'chit_payment'
  payloadData,  // metadata
  user,
  onSuccess,
  onFailure,
  setLoading,
}) => {
  if (setLoading) setLoading(true);

  try {
    // Step 1: Create Razorpay order on backend
    const orderData = await paymentService.createOrder(amount, paymentType, payloadData);
    const { orderId, keyId, currency } = orderData;

    // Step 2: Prepare Razorpay Options
    const options = {
      description: `Growvest ${paymentType.replace('_', ' ').toUpperCase()}`,
      image: 'https://growvest-mobile.onrender.com/logo.png',
      currency: currency || 'INR',
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

    // Safe native check
    const RazorpayCheckout = getRazorpayCheckout();

    if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
      try {
        const response = await RazorpayCheckout.open(options);
        // Step 3: Send Razorpay signature to backend for verification
        const verification = await paymentService.verifyPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          paymentType,
          payloadData,
        });

        if (setLoading) setLoading(false);
        if (onSuccess) onSuccess(verification);
      } catch (error) {
        if (setLoading) setLoading(false);
        console.log('[Razorpay] Payment cancelled or dismissed:', error?.description || error?.message);
        if (onFailure) {
          onFailure(error);
        } else {
          customAlert.warning(
            'Payment Incomplete',
            error.description || error.message || 'Payment was cancelled or could not be processed.'
          );
        }
      }
    } else {
      // Test Mode Simulation fallback when running in Expo Go without native build
      customAlert.confirm({
        type: 'payout',
        title: 'Razorpay Native Mode',
        message: `Official Razorpay checkout with UPI & Cards opens natively in the Standalone APK / Dev Client build.\n\nRunning in Expo Go currently. Simulate test payment of ₹${amount} for Order ${orderId}?`,
        cancelText: 'Cancel Payment',
        confirmText: 'Simulate Pay',
        onCancel: () => {
          if (setLoading) setLoading(false);
          if (onFailure) onFailure(new Error('User cancelled payment'));
        },
        onConfirm: async () => {
          try {
            const mockPaymentId = `pay_${Date.now()}`;
            // Signature simulation token sent to backend for test verify
            const signature = `simulated_signature_${orderId}_${mockPaymentId}`;

            const verification = await paymentService.verifyPayment({
              razorpay_order_id: orderId,
              razorpay_payment_id: mockPaymentId,
              razorpay_signature: signature,
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
    console.error('[Razorpay] Order creation error:', error);
    const msg = error.response?.data?.message || error.message || 'Failed to initiate Razorpay payment';
    customAlert.error('Error', msg);
    if (onFailure) onFailure(error);
  }
};

/**
 * Open Razorpay Checkout for already-created orders (used by SIP, Chits, etc.)
 */
export const openRazorpayCheckout = async ({
  orderId,
  amount,
  keyId,
  name = 'Growvest',
  description = 'Payment',
  user,
  isSimulated = false,
  onSuccess,
  onError,
}) => {
  const options = {
    description,
    image: 'https://growvest-mobile.onrender.com/logo.png',
    currency: 'INR',
    key: keyId || 'rzp_test_xxxxxxxxx',
    amount: typeof amount === 'number' ? Math.round(amount) : Math.round(Number(amount)),
    name,
    order_id: orderId,
    prefill: {
      email: user?.email || '',
      contact: user?.mobileNumber || '',
      name: user?.name || user?.username || 'User',
    },
    theme: { color: '#085428' },
  };

  const RazorpayCheckout = getRazorpayCheckout();

  if (!isSimulated && RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
    try {
      const response = await RazorpayCheckout.open(options);
      if (onSuccess) {
        onSuccess({
          razorpay_order_id: response.razorpay_order_id || orderId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      }
    } catch (error) {
      console.log('[Razorpay] Checkout cancelled:', error);
      if (onError) onError(error);
    }
  } else {
    // Simulator fallback for Expo Go
    const displayAmount = Math.round(amount / 100);
    customAlert.confirm({
      type: 'payout',
      title: 'Razorpay Native Mode',
      message: `Official Razorpay checkout with UPI & Cards opens natively in the Standalone APK / Dev Client build.\n\nSimulate test payment of ₹${displayAmount.toLocaleString('en-IN')} for ${description}?`,
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
            razorpay_order_id: orderId,
            razorpay_payment_id: mockPaymentId,
            razorpay_signature: signature,
          });
        }
      },
    });
  }
};
