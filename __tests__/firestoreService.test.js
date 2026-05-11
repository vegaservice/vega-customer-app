// ═══════════════════════════════════════════════════
// __tests__/firestoreService.test.js
// Unit tests for all firestoreService.js functions
// ═══════════════════════════════════════════════════

import firestore from '@react-native-firebase/firestore';

import {
  createOrUpdateUser,
  getUser,
  updateUserWallet,
  updateFCMToken,
  createBooking,
  getUserBookings,
  updateBookingStatus,
  submitBookingRating,
  cancelBooking,
  validatePromoCode,
} from '../firestoreService';

// ── helpers to reach into the mock ───────────────────────────────
const getMockDoc = () => firestore().collection('').doc('');
const getMockCollection = () => firestore().collection('');

beforeEach(() => {
  jest.clearAllMocks();
});

// ── createOrUpdateUser ────────────────────────────────────────────
describe('createOrUpdateUser', () => {
  it('calls set with merge:true and serverTimestamp on the user doc', async () => {
    const result = await createOrUpdateUser('+919999999999', { name: 'Arjun' });

    expect(firestore).toHaveBeenCalled();
    const mockDoc = getMockDoc();
    expect(mockDoc.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Arjun',
        updatedAt: expect.anything(),
      }),
      { merge: true },
    );
    expect(result).toBe(true);
  });

  it('returns false when Firestore throws', async () => {
    getMockDoc().set.mockRejectedValueOnce(new Error('network error'));
    const result = await createOrUpdateUser('+91000', { name: 'X' });
    expect(result).toBe(false);
  });
});

// ── getUser ───────────────────────────────────────────────────────
describe('getUser', () => {
  it('returns doc.data() when doc exists', async () => {
    const result = await getUser('+919999999999');
    expect(result).toEqual({ walletBalance: 100 });
  });

  it('returns null when doc does not exist', async () => {
    getMockDoc().get.mockResolvedValueOnce({ exists: false, data: () => null });
    const result = await getUser('+910000000000');
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    getMockDoc().get.mockRejectedValueOnce(new Error('timeout'));
    const result = await getUser('+911111111111');
    expect(result).toBeNull();
  });
});

// ── updateUserWallet ──────────────────────────────────────────────
describe('updateUserWallet', () => {
  it('calls update with the new wallet balance', async () => {
    const result = await updateUserWallet('+919999999999', 250);

    expect(getMockDoc().update).toHaveBeenCalledWith({ walletBalance: 250 });
    expect(result).toBe(true);
  });

  it('returns false on error', async () => {
    getMockDoc().update.mockRejectedValueOnce(new Error('write failed'));
    const result = await updateUserWallet('+919999999999', 250);
    expect(result).toBe(false);
  });
});

// ── updateFCMToken ────────────────────────────────────────────────
describe('updateFCMToken', () => {
  it('calls update with fcmToken and tokenUpdatedAt', async () => {
    const result = await updateFCMToken('+919999999999', 'fcm-token-abc');

    expect(getMockDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({
        fcmToken: 'fcm-token-abc',
        tokenUpdatedAt: expect.anything(),
      }),
    );
    expect(result).toBe(true);
  });

  it('returns false on error', async () => {
    getMockDoc().update.mockRejectedValueOnce(new Error('fail'));
    const result = await updateFCMToken('+919999999999', 'token');
    expect(result).toBe(false);
  });
});

// ── createBooking ─────────────────────────────────────────────────
describe('createBooking', () => {
  it('returns success:true with an orderId starting with VG', async () => {
    const result = await createBooking({ userId: 'user123', service: 'Cleaning' });

    expect(result.success).toBe(true);
    expect(result.orderId).toMatch(/^VG/);
  });

  it('generates a 4-digit OTP string', async () => {
    const result = await createBooking({ userId: 'user123' });

    expect(result.otp).toMatch(/^\d{4}$/);
  });

  it('sets status to lowercase "confirmed"', async () => {
    const result = await createBooking({ userId: 'user123' });

    expect(result.booking.status).toBe('confirmed');
  });

  it('calls set on the bookings collection with the booking object', async () => {
    const result = await createBooking({ userId: 'user123', total: 499 });

    expect(getMockDoc().set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'confirmed',
        orderId: result.orderId,
        otp: result.otp,
        rated: false,
        userId: 'user123',
        total: 499,
      }),
    );
  });

  it('also writes to the user bookings subcollection', async () => {
    const result = await createBooking({ userId: 'user123' });
    // The subcollection doc set is called via mockDoc.set — verify at least 2 set calls
    expect(getMockDoc().set.mock.calls.length).toBeGreaterThanOrEqual(2);
    // The subcollection entry should carry status:'confirmed'
    const subcollectionCall = getMockDoc().set.mock.calls.find(
      (call) => call[0] && call[0].status === 'confirmed' && call[0].orderId === result.orderId,
    );
    expect(subcollectionCall).toBeDefined();
  });

  it('returns success:false with error message on failure', async () => {
    getMockDoc().set.mockRejectedValueOnce(new Error('quota exceeded'));
    const result = await createBooking({ userId: 'user123' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('quota exceeded');
  });
});

// ── getUserBookings ───────────────────────────────────────────────
describe('getUserBookings', () => {
  it('returns an empty array when snapshot has no docs', async () => {
    const result = await getUserBookings('+919999999999');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('maps snapshot docs to objects with id field', async () => {
    getMockCollection().get.mockResolvedValueOnce({
      docs: [
        { id: 'VG123456', data: () => ({ status: 'confirmed', total: 499 }) },
        { id: 'VG654321', data: () => ({ status: 'completed', total: 299 }) },
      ],
    });
    const result = await getUserBookings('+919999999999');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'VG123456', status: 'confirmed', total: 499 });
    expect(result[1]).toEqual({ id: 'VG654321', status: 'completed', total: 299 });
  });

  it('returns empty array on error', async () => {
    getMockCollection().get.mockRejectedValueOnce(new Error('index missing'));
    const result = await getUserBookings('+919999999999');
    expect(result).toEqual([]);
  });
});

// ── updateBookingStatus ───────────────────────────────────────────
describe('updateBookingStatus', () => {
  it('calls update with the status and a dynamic <status>At timestamp field', async () => {
    const result = await updateBookingStatus('VG123456', 'completed');

    expect(getMockDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        completedAt: expect.anything(),
      }),
    );
    expect(result).toBe(true);
  });

  it('uses lowercase for the timestamp key', async () => {
    await updateBookingStatus('VG123456', 'InProgress');
    const callArg = getMockDoc().update.mock.calls[0][0];
    expect(callArg).toHaveProperty('inprogressAt');
  });

  it('returns false on error', async () => {
    getMockDoc().update.mockRejectedValueOnce(new Error('fail'));
    const result = await updateBookingStatus('VG123456', 'completed');
    expect(result).toBe(false);
  });
});

// ── submitBookingRating ───────────────────────────────────────────
describe('submitBookingRating', () => {
  it('updates the booking doc with rated:true, rating, ratingNote', async () => {
    const result = await submitBookingRating('VG123456', '+919999999999', 5, 'Great service!');

    expect(getMockDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({
        rated: true,
        rating: 5,
        ratingNote: 'Great service!',
        ratedAt: expect.anything(),
      }),
    );
    expect(result).toBe(true);
  });

  it('credits wallet +50 on top of existing balance', async () => {
    // getUser returns { walletBalance: 100 } by default from the mock
    await submitBookingRating('VG123456', '+919999999999', 4, 'Good');

    // updateUserWallet should have been called with 100 + 50 = 150
    const updateCalls = getMockDoc().update.mock.calls;
    const walletCall = updateCalls.find(
      (call) => call[0] && call[0].walletBalance !== undefined,
    );
    expect(walletCall).toBeDefined();
    expect(walletCall[0].walletBalance).toBe(150);
  });

  it('still returns true when user is not found (no wallet update)', async () => {
    getMockDoc().get.mockResolvedValueOnce({ exists: false, data: () => null });
    const result = await submitBookingRating('VG123456', '+910000000000', 3, '');
    expect(result).toBe(true);
  });

  it('returns false on error', async () => {
    getMockDoc().update.mockRejectedValueOnce(new Error('fail'));
    const result = await submitBookingRating('VG123456', '+919999999999', 5, '');
    expect(result).toBe(false);
  });
});

// ── cancelBooking ─────────────────────────────────────────────────
describe('cancelBooking', () => {
  it('returns { success: true } on success', async () => {
    const result = await cancelBooking('VG123456', 'user123', 'Changed my mind');
    expect(result).toEqual({ success: true });
  });

  it('sets status to "cancelled" on the bookings collection doc', async () => {
    await cancelBooking('VG123456', 'user123', 'Changed my mind');

    const updateCalls = getMockDoc().update.mock.calls;
    const bookingUpdate = updateCalls.find(
      (call) => call[0] && call[0].status === 'cancelled' && call[0].cancelledAt !== undefined,
    );
    expect(bookingUpdate).toBeDefined();
    expect(bookingUpdate[0].status).toBe('cancelled');
  });

  it('saves the cancelReason supplied by the caller', async () => {
    await cancelBooking('VG123456', 'user123', 'Wrong address');

    const updateCalls = getMockDoc().update.mock.calls;
    const bookingUpdate = updateCalls.find(
      (call) => call[0] && call[0].cancelReason !== undefined,
    );
    expect(bookingUpdate[0].cancelReason).toBe('Wrong address');
  });

  it('falls back to "Cancelled by customer" when no reason is provided', async () => {
    await cancelBooking('VG123456', 'user123');

    const updateCalls = getMockDoc().update.mock.calls;
    const bookingUpdate = updateCalls.find(
      (call) => call[0] && call[0].cancelReason !== undefined,
    );
    expect(bookingUpdate[0].cancelReason).toBe('Cancelled by customer');
  });

  it('also updates the user bookings subcollection to status:cancelled', async () => {
    await cancelBooking('VG123456', 'user123', 'Test');

    const updateCalls = getMockDoc().update.mock.calls;
    const subcollectionUpdate = updateCalls.find(
      (call) => call[0] && Object.keys(call[0]).length === 1 && call[0].status === 'cancelled',
    );
    expect(subcollectionUpdate).toBeDefined();
  });

  it('includes cancelledAt serverTimestamp', async () => {
    await cancelBooking('VG123456', 'user123', 'Test');

    const updateCalls = getMockDoc().update.mock.calls;
    const bookingUpdate = updateCalls.find(
      (call) => call[0] && call[0].cancelledAt !== undefined,
    );
    expect(bookingUpdate[0].cancelledAt).toBeDefined();
  });

  it('returns { success: false, error } on failure', async () => {
    getMockDoc().update.mockRejectedValueOnce(new Error('permission denied'));
    const result = await cancelBooking('VG123456', 'user123', 'Test');
    expect(result.success).toBe(false);
    expect(result.error).toBe('permission denied');
  });
});

// ── validatePromoCode ─────────────────────────────────────────────
describe('validatePromoCode', () => {
  it('returns the promo object when code is valid and active', async () => {
    getMockDoc().get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        VEGA50: { active: true, discount: 50, type: 'flat' },
      }),
    });
    const result = await validatePromoCode('vega50');
    expect(result).toEqual({ active: true, discount: 50, type: 'flat' });
  });

  it('returns null when code does not exist in the doc', async () => {
    getMockDoc().get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ OTHER: { active: true } }),
    });
    const result = await validatePromoCode('NOTEXIST');
    expect(result).toBeNull();
  });

  it('returns null when promo is inactive', async () => {
    getMockDoc().get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ VEGA50: { active: false, discount: 50 } }),
    });
    const result = await validatePromoCode('VEGA50');
    expect(result).toBeNull();
  });

  it('returns null when the promo_codes doc does not exist', async () => {
    getMockDoc().get.mockResolvedValueOnce({ exists: false, data: () => null });
    const result = await validatePromoCode('VEGA50');
    expect(result).toBeNull();
  });

  it('is case-insensitive — uppercases the input before lookup', async () => {
    getMockDoc().get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ VEGA50: { active: true, discount: 50 } }),
    });
    const result = await validatePromoCode('vega50');
    expect(result).not.toBeNull();
  });

  it('returns null on Firestore error', async () => {
    getMockDoc().get.mockRejectedValueOnce(new Error('unavailable'));
    const result = await validatePromoCode('VEGA50');
    expect(result).toBeNull();
  });
});
