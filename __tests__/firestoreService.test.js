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

const getMockDoc = () => firestore().collection('').doc('');
const getMockCollection = () => firestore().collection('');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createOrUpdateUser', () => {
  it('calls set with merge:true and serverTimestamp', async () => {
    const result = await createOrUpdateUser('+919999999999', { name: 'Arjun' });
    expect(getMockDoc().set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Arjun', updatedAt: expect.anything() }),
      { merge: true },
    );
    expect(result).toBe(true);
  });
  it('returns false when Firestore throws', async () => {
    getMockDoc().set.mockRejectedValueOnce(new Error('network error'));
    expect(await createOrUpdateUser('+91000', { name: 'X' })).toBe(false);
  });
});

describe('getUser', () => {
  it('returns doc.data() when doc exists', async () => {
    expect(await getUser('+919999999999')).toEqual({ walletBalance: 100 });
  });
  it('returns null when doc does not exist', async () => {
    getMockDoc().get.mockResolvedValueOnce({ exists: false, data: () => null });
    expect(await getUser('+910000000000')).toBeNull();
  });
  it('returns null on error', async () => {
    getMockDoc().get.mockRejectedValueOnce(new Error('timeout'));
    expect(await getUser('+911111111111')).toBeNull();
  });
});

describe('updateUserWallet', () => {
  it('calls update with new balance', async () => {
    const result = await updateUserWallet('+919999999999', 250);
    expect(getMockDoc().update).toHaveBeenCalledWith({ walletBalance: 250 });
    expect(result).toBe(true);
  });
  it('returns false on error', async () => {
    getMockDoc().update.mockRejectedValueOnce(new Error('fail'));
    expect(await updateUserWallet('+919999999999', 250)).toBe(false);
  });
});

describe('updateFCMToken', () => {
  it('saves fcmToken and tokenUpdatedAt', async () => {
    await updateFCMToken('+919999999999', 'fcm-token-abc');
    expect(getMockDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({ fcmToken: 'fcm-token-abc', tokenUpdatedAt: expect.anything() }),
    );
  });
  it('returns false on error', async () => {
    getMockDoc().update.mockRejectedValueOnce(new Error('fail'));
    expect(await updateFCMToken('+919999999999', 'token')).toBe(false);
  });
});

describe('createBooking', () => {
  it('returns success:true with orderId starting with VG', async () => {
    const result = await createBooking({ userId: 'user123', service: 'Cleaning' });
    expect(result.success).toBe(true);
    expect(result.orderId).toMatch(/^VG/);
  });
  it('generates a 4-digit OTP', async () => {
    const result = await createBooking({ userId: 'user123' });
    expect(result.otp).toMatch(/^\d{4}$/);
  });
  it('sets status to lowercase confirmed', async () => {
    const result = await createBooking({ userId: 'user123' });
    expect(result.booking.status).toBe('confirmed');
  });
  it('returns success:false on failure', async () => {
    getMockDoc().set.mockRejectedValueOnce(new Error('quota exceeded'));
    const result = await createBooking({ userId: 'user123' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('quota exceeded');
  });
});

describe('getUserBookings', () => {
  it('returns empty array when no docs', async () => {
    expect(await getUserBookings('+919999999999')).toEqual([]);
  });
  it('maps docs to objects with id', async () => {
    getMockCollection().get.mockResolvedValueOnce({
      docs: [{ id: 'VG123', data: () => ({ status: 'confirmed' }) }],
    });
    const result = await getUserBookings('+919999999999');
    expect(result[0]).toEqual({ id: 'VG123', status: 'confirmed' });
  });
});

describe('updateBookingStatus', () => {
  it('updates status with timestamp key', async () => {
    await updateBookingStatus('VG123456', 'completed');
    expect(getMockDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', completedAt: expect.anything() }),
    );
  });
  it('returns false on error', async () => {
    getMockDoc().update.mockRejectedValueOnce(new Error('fail'));
    expect(await updateBookingStatus('VG123456', 'completed')).toBe(false);
  });
});

describe('submitBookingRating', () => {
  it('updates booking with rated:true and rating', async () => {
    await submitBookingRating('VG123456', '+919999999999', 5, 'Great!');
    expect(getMockDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({ rated: true, rating: 5, ratingNote: 'Great!' }),
    );
  });
  it('credits wallet +50', async () => {
    await submitBookingRating('VG123456', '+919999999999', 4, 'Good');
    const walletCall = getMockDoc().update.mock.calls.find(c => c[0]?.walletBalance !== undefined);
    expect(walletCall[0].walletBalance).toBe(150);
  });
});

describe('cancelBooking', () => {
  it('returns success:true', async () => {
    expect(await cancelBooking('VG123456', 'user123', 'Changed mind')).toEqual({ success: true });
  });
  it('sets status cancelled with reason and timestamp', async () => {
    await cancelBooking('VG123456', 'user123', 'Wrong address');
    const call = getMockDoc().update.mock.calls.find(c => c[0]?.status === 'cancelled');
    expect(call[0].cancelReason).toBe('Wrong address');
    expect(call[0].cancelledAt).toBeDefined();
  });
  it('defaults reason to Cancelled by customer', async () => {
    await cancelBooking('VG123456', 'user123');
    const call = getMockDoc().update.mock.calls.find(c => c[0]?.cancelReason);
    expect(call[0].cancelReason).toBe('Cancelled by customer');
  });
  it('returns success:false on error', async () => {
    getMockDoc().update.mockRejectedValueOnce(new Error('denied'));
    const result = await cancelBooking('VG123456', 'user123', 'Test');
    expect(result.success).toBe(false);
  });
});

describe('validatePromoCode', () => {
  it('returns promo when valid and active', async () => {
    getMockDoc().get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ VEGA50: { active: true, discount: 50 } }),
    });
    expect(await validatePromoCode('vega50')).toEqual({ active: true, discount: 50 });
  });
  it('returns null for inactive promo', async () => {
    getMockDoc().get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ VEGA50: { active: false } }),
    });
    expect(await validatePromoCode('VEGA50')).toBeNull();
  });
  it('returns null on error', async () => {
    getMockDoc().get.mockRejectedValueOnce(new Error('unavailable'));
    expect(await validatePromoCode('VEGA50')).toBeNull();
  });
});
