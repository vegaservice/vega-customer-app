// ═══════════════════════════════════════════════════
// src/services/firestoreService.js
// All Firestore database operations for VEGA
// ═══════════════════════════════════════════════════

import firestore from '@react-native-firebase/firestore';

// ── USER OPERATIONS ──────────────────────────────────────────────

export const createOrUpdateUser = async (phone, data) => {
  try {
    await firestore()
      .collection('users')
      .doc(phone)
      .set({
        ...data,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    return true;
  } catch (error) {
    console.error('createOrUpdateUser error:', error);
    return false;
  }
};

export const getUser = async (phone) => {
  try {
    const doc = await firestore().collection('users').doc(phone).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('getUser error:', error);
    return null;
  }
};

export const updateUserWallet = async (phone, newBalance) => {
  try {
    await firestore()
      .collection('users')
      .doc(phone)
      .update({ walletBalance: newBalance });
    return true;
  } catch (error) {
    console.error('updateUserWallet error:', error);
    return false;
  }
};

export const updateFCMToken = async (phone, token) => {
  try {
    await firestore()
      .collection('users')
      .doc(phone)
      .update({ fcmToken: token, tokenUpdatedAt: firestore.FieldValue.serverTimestamp() });
    return true;
  } catch (error) {
    console.error('updateFCMToken error:', error);
    return false;
  }
};

// ── BOOKING OPERATIONS ───────────────────────────────────────────

export const createBooking = async (bookingData) => {
  try {
    const orderId = 'VG' + Date.now().toString().slice(-6);
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const booking = {
      ...bookingData,
      orderId,
      otp,
      status: 'confirmed',
      createdAt: firestore.FieldValue.serverTimestamp(),
      rated: false,
    };

    await firestore()
      .collection('bookings')
      .doc(orderId)
      .set(booking);

    // Also add to user's booking subcollection for easy querying
    await firestore()
      .collection('users')
      .doc(bookingData.userId)
      .collection('bookings')
      .doc(orderId)
      .set({ orderId, status: 'confirmed', createdAt: firestore.FieldValue.serverTimestamp() });

    return { success: true, orderId, otp, booking };
  } catch (error) {
    console.error('createBooking error:', error);
    return { success: false, error: error.message };
  }
};

export const getUserBookings = async (phone) => {
  try {
    const snapshot = await firestore()
      .collection('bookings')
      .where('userId', '==', phone)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('getUserBookings error:', error);
    return [];
  }
};

export const getBookingById = async (orderId) => {
  try {
    const doc = await firestore().collection('bookings').doc(orderId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (error) {
    console.error('getBookingById error:', error);
    return null;
  }
};

export const updateBookingStatus = async (orderId, status) => {
  try {
    const update = {
      status,
      [`${status.toLowerCase()}At`]: firestore.FieldValue.serverTimestamp(),
    };
    await firestore().collection('bookings').doc(orderId).update(update);
    return true;
  } catch (error) {
    console.error('updateBookingStatus error:', error);
    return false;
  }
};

export const submitBookingRating = async (orderId, userId, rating, note) => {
  try {
    await firestore().collection('bookings').doc(orderId).update({
      rated: true,
      rating,
      ratingNote: note,
      ratedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Reward wallet +50
    const user = await getUser(userId);
    if (user) {
      await updateUserWallet(userId, (user.walletBalance || 0) + 50);
    }
    return true;
  } catch (error) {
    console.error('submitBookingRating error:', error);
    return false;
  }
};

// Real-time booking listener
export const listenToBooking = (orderId, callback) => {
  return firestore()
    .collection('bookings')
    .doc(orderId)
    .onSnapshot(doc => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
};

export const cancelBooking = async (orderId, userId, reason) => {
  try {
    await firestore().collection('bookings').doc(orderId).update({
      status: 'cancelled',
      cancelledAt: firestore.FieldValue.serverTimestamp(),
      cancelReason: reason || 'Cancelled by customer',
    });
    await firestore().collection('users').doc(userId).collection('bookings').doc(orderId).update({
      status: 'cancelled',
    });
    return { success: true };
  } catch (error) {
    console.error('cancelBooking error:', error);
    return { success: false, error: error.message };
  }
};

// ── PROMO CODE VALIDATION ─────────────────────────────────────────

export const validatePromoCode = async (code) => {
  try {
    const doc = await firestore()
      .collection('app_config')
      .doc('promo_codes')
      .get();

    if (doc.exists) {
      const codes = doc.data();
      const promo = codes[code.toUpperCase()];
      if (promo && promo.active) return promo;
    }
    return null;
  } catch (error) {
    console.error('validatePromoCode error:', error);
    return null;
  }
};
