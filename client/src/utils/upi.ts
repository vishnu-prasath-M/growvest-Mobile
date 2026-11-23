/**
 * UPI Link Generator Utility
 * Provides consistent UPI link generation across the application
 */

/**
 * Generates a UPI payment link with consistent format
 * @param upiId - UPI ID of the recipient
 * @param amount - Amount to be paid
 * @param transactionNote - Optional transaction note/reference
 * @param payeeName - Name of the payee (defaults to "Growvest")
 * @returns Formatted UPI link string
 */
export const generateUPILink = (
  upiId: string = "q751029321@ybl",
  amount: number | string,
  transactionId?: string,
  payeeName: string = "Growvest"
): string => {
  // Validate inputs
  if (!upiId || !amount) {
    throw new Error('UPI ID and amount are required');
  }

  // Convert amount to number and validate
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Invalid amount provided');
  }

  // Generate a transaction ID if not provided
  const txnId = transactionId || `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Use direct string to avoid URL encoding issues in some UPI apps (like %40 for @)
  // Simplified link (pa, pn, am, cu, tn) for better compatibility with personal accounts
  const upiLink = `upi://pay?pa=${upiId.trim()}&pn=${encodeURIComponent(payeeName)}&tn=Investment&am=${numericAmount}&cu=INR`;

  return upiLink;
};

/**
 * Validates UPI ID format
 * @param upiId - UPI ID to validate
 * @returns True if valid, false otherwise
 */
export const validateUPIId = (upiId: string): boolean => {
  if (!upiId || typeof upiId !== 'string') return false;

  // Basic UPI ID validation (username@provider)
  const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
  return upiRegex.test(upiId.trim());
};

/**
 * Validates amount for UPI payment
 * @param amount - Amount to validate
 * @returns True if valid, false otherwise
 */
export const validateAmount = (amount: number | string): boolean => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(numericAmount) && numericAmount > 0 && numericAmount <= 100000; // Max 1 lakh for safety
};

/**
 * Generates platform-specific UPI deeplinks for instant app launching
 */
export const openUPIDeeplink = (
  upiId: string,
  amount: number | string,
  note: string = "Growvest Payout",
  payeeName: string = "User",
  app?: "generic" | "gpay" | "phonepe" | "paytm"
): string => {
  if (!upiId) return "";
  const cleanUpi = upiId.trim();
  const cleanAmt = typeof amount === "number" ? amount.toFixed(2) : parseFloat(amount).toFixed(2);
  const encodedName = encodeURIComponent(payeeName || "User");
  const query = `pa=${cleanUpi}&pn=${encodedName}&am=${cleanAmt}&cu=INR`;

  if (app === "gpay") {
    return `tez://upi/pay?${query}`;
  }
  if (app === "phonepe") {
    return `phonepe://pay?${query}`;
  }
  if (app === "paytm") {
    return `paytmmp://pay?${query}`;
  }
  return `upi://pay?${query}`;
};
