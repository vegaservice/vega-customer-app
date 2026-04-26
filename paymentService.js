// ═══════════════════════════════════════════════════
// src/services/paymentService.js
// Razorpay integration for VEGA
// ═══════════════════════════════════════════════════

import RazorpayCheckout from 'react-native-razorpay';

// ── RAZORPAY CONFIG ──────────────────────────────────────────────
// STEP 1: Create account at https://razorpay.com
// STEP 2: Go to Settings → API Keys → Generate Test Key
// STEP 3: Replace the key below with your actual key
// STEP 4: Switch to LIVE key when going to production

const RAZORPAY_KEY_TEST = 'rzp_test_REPLACE_WITH_YOUR_KEY';
const RAZORPAY_KEY_LIVE = 'rzp_live_REPLACE_WITH_YOUR_KEY';

// Set to true when going to production
const IS_PRODUCTION = false;
const RAZORPAY_KEY = IS_PRODUCTION ? RAZORPAY_KEY_LIVE : RAZORPAY_KEY_TEST;

// ── PAYMENT HANDLER ──────────────────────────────────────────────

export const initiateRazorpayPayment = ({
  amount,        // in rupees (will be converted to paise)
  orderId,       // VEGA order ID
  userName,
  userPhone,
  userEmail,
  description,
  onSuccess,
  onFailure,
}) => {
  const options = {
    description: description || 'VEGA Home Services',
    image: 'https://vegavizag.in/logo.png',   // Your logo URL
    currency: 'INR',
    key: RAZORPAY_KEY,
    amount: amount * 100,                      // Razorpay needs paise
    name: 'VEGA Home Services',
    order_id: '',                              // Leave blank for standard checkout
    prefill: {
      email: userEmail || 'customer@vegavizag.in',
      contact: userPhone?.replace('+91', '') || '',
      name: userName || 'VEGA Customer',
    },
    theme: {
      color: '#C8541A',                        // VEGA saffron orange
    },
    notes: {
      vega_order_id: orderId,
      address: 'Visakhapatnam, Andhra Pradesh',
    },
  };

  RazorpayCheckout.open(options)
    .then(data => {
      // Payment successful
      // data.razorpay_payment_id — payment ID
      // data.razorpay_order_id — order ID
      // data.razorpay_signature — signature to verify on backend
      console.log('Payment success:', data);
      if (onSuccess) onSuccess(data);
    })
    .catch(error => {
      // Payment failed or user cancelled
      console.log('Payment error:', error);
      if (onFailure) onFailure(error);
    });
};

// ── PAYMENT METHODS CONFIG ───────────────────────────────────────

export const PAYMENT_METHODS = [
  {
    id: 'upi',
    label: 'UPI',
    icon: '📱',
    sub: 'GPay, PhonePe, BHIM',
    supported: true,
  },
  {
    id: 'card',
    label: 'Card',
    icon: '💳',
    sub: 'Debit / Credit Card',
    supported: true,
  },
  {
    id: 'netbanking',
    label: 'Net Banking',
    icon: '🏦',
    sub: 'All major banks',
    supported: true,
  },
  {
    id: 'cash',
    label: 'Cash',
    icon: '💵',
    sub: 'Pay after service',
    supported: true,
  },
];

// ── TEST CARD NUMBERS (for testing only) ─────────────────────────
// Card: 4111 1111 1111 1111
// Expiry: Any future date
// CVV: Any 3 digits
// OTP: 1234 (Razorpay test OTP)
