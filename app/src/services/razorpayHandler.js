import { Alert } from 'react-native';
import { paymentService } from './paymentService';

/**
 * Reusable Razorpay Payment Handler
 * 
 * 1. Calls backend createOrder()
 * 2. Opens Razorpay Checkout on native/Expo dev client or web fallback
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
    let RazorpayCheckout = null;
    try {
      // Use eval/Function require to bypass Metro bundler static analysis when running in Expo Go without native build
      const safeRequire = eval('require');
      const RZ = safeRequire('react-native-razorpay');
      RazorpayCheckout = RZ.default || RZ;
    } catch (err) {
      RazorpayCheckout = null;
    }

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
          Alert.alert(
            'Payment Failed',
            error.description || error.message || 'Payment was cancelled or could not be processed.'
          );
        }
      }
    } else {
      // Test Mode Simulation fallback when running in Expo Go without native build
      Alert.alert(
        'Razorpay Test Mode',
        `Initiate Payment of ₹${amount} for Order ${orderId}?`,
        [
          {
            text: 'Cancel Payment',
            style: 'cancel',
            onPress: () => {
              if (setLoading) setLoading(false);
              if (onFailure) onFailure(new Error('User cancelled payment'));
            },
          },
          {
            text: 'Pay Now',
            onPress: async () => {
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
                Alert.alert('Payment Verification Failed', msg);
                if (onFailure) onFailure(verifyErr);
              }
            },
          },
        ]
      );
    }
  } catch (error) {
    if (setLoading) setLoading(false);
    console.error('[Razorpay] Order creation error:', error);
    const msg = error.response?.data?.message || error.message || 'Failed to initiate Razorpay payment';
    Alert.alert('Error', msg);
    if (onFailure) onFailure(error);
  }
};
