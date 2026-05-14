// ===============================================================
// VEGA Home Services — Firebase Cloud Functions
// End-to-end push notification triggers for all booking events
// Deploy: firebase deploy --only functions
// ===============================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// Helper: send FCM to a single token
const sendFCM = async (token, title, body, data = {}) => {
  if (!token) return;
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'vega_notifications' },
      },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch (e) {
    console.error('FCM send error:', e.message, 'token:', token?.slice(0, 20));
  }
};

// Helper: send FCM to multiple tokens
const sendFCMMulti = async (tokens, title, body, data = {}) => {
  const valid = [...new Set(tokens.filter(Boolean))];
  if (!valid.length) return;
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );
  const messages = valid.map(token => ({
    token,
    notification: { title, body },
    data: stringData,
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'vega_notifications' },
    },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  }));
  try {
    const result = await messaging.sendEach(messages);
    console.log(`FCM: sent ${result.successCount}/${valid.length}`);
  } catch (e) {
    console.error('FCM multi send error:', e.message);
  }
};

// Helper: get hub manager + admin FCM tokens
// Hub managers: workers collection with role==hub_manager
// Admins: admins collection (e.g. admins/9441270570)
const getHubManagerAndAdminTokens = async () => {
  const [hubSnap, adminSnap] = await Promise.all([
    db.collection('workers')
      .where('role', '==', 'hub_manager')
      .where('status', '==', 'active')
      .get(),
    db.collection('admins').get(),
  ]);
  const hubTokens = hubSnap.docs.map(d => d.data().fcmToken).filter(Boolean);
  const adminTokens = adminSnap.docs.map(d => d.data().fcmToken).filter(Boolean);
  return [...hubTokens, ...adminTokens];
};

// ── TRIGGER 1: New booking created ──────────────────────────────
// Notify Hub Managers + Admin when customer books a service
exports.onNewBooking = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const booking = snap.data();
    const { orderId, customerName, userName, serviceType, items, userId } = booking;
    const displayName = customerName || userName || 'Customer';
    const displayService = serviceType ||
      (items && items[0]?.name) || 'Home Service';
    const displayOrder = orderId || context.params.bookingId.slice(-6);

    const tokens = await getHubManagerAndAdminTokens();
    if (tokens.length === 0) {
      console.log('No hub manager / admin tokens found');
      return;
    }

    await sendFCMMulti(
      tokens,
      '🆕 New Booking Received!',
      `${displayName} booked ${displayService}. Assign a professional now.`,
      {
        bookingId: context.params.bookingId,
        orderId: displayOrder,
        type: 'new_booking',
        screen: 'bookings',
      }
    );
    console.log(`New booking ${displayOrder} → notified ${tokens.length} recipients`);
  });

// ── TRIGGER 2: Booking status updated ───────────────────────────
// Route notifications to the right person based on the new status
exports.onBookingUpdate = functions.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status) return;

    const {
      status, assignedWorkerId, assignedWorkerName,
      userId, customerName, userName, orderId, serviceType, items,
    } = after;
    const bookingId = context.params.bookingId;
    const displayName = customerName || userName || 'Customer';
    const displayOrder = orderId || bookingId.slice(-6);
    const displayService = serviceType ||
      (items && items[0]?.name) || 'Home Service';

    // 1. assigned → notify the assigned worker
    if (status === 'assigned' && assignedWorkerId) {
      const workerDoc = await db.collection('workers').doc(assignedWorkerId).get();
      const workerToken = workerDoc.exists ? workerDoc.data().fcmToken : null;
      await sendFCM(
        workerToken,
        '🎯 New Job Assigned!',
        `You have a new ${displayService} job (#${displayOrder}). Check the app now.`,
        { bookingId, orderId: displayOrder, type: 'job_assigned', screen: 'jobs' }
      );
    }

    // 2. on_the_way → notify customer
    if (status === 'on_the_way' && userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      const userToken = userDoc.exists ? userDoc.data().fcmToken : null;
      await sendFCM(
        userToken,
        '🚗 Professional On the Way!',
        `${assignedWorkerName || 'Your professional'} is heading to you now.`,
        { bookingId, orderId: displayOrder, type: 'status_update', screen: 'booking_detail' }
      );
    }

    // 3. in_progress → notify customer
    if (status === 'in_progress' && userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      const userToken = userDoc.exists ? userDoc.data().fcmToken : null;
      await sendFCM(
        userToken,
        '🛠 Service Started!',
        `Your ${displayService} service has begun. Sit back and relax!`,
        { bookingId, orderId: displayOrder, type: 'status_update', screen: 'booking_detail' }
      );
    }

    // 4. completed → notify customer with rating prompt
    if (status === 'completed' && userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      const userToken = userDoc.exists ? userDoc.data().fcmToken : null;
      await sendFCM(
        userToken,
        '✅ Service Completed!',
        `Your ${displayService} is done! Rate & earn ₹50 wallet credit.`,
        { bookingId, orderId: displayOrder, type: 'service_completed', screen: 'rate_booking' }
      );
    }

    // 5. cancelled or rejected → notify customer
    if ((status === 'cancelled' || status === 'rejected') && userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      const userToken = userDoc.exists ? userDoc.data().fcmToken : null;
      await sendFCM(
        userToken,
        status === 'cancelled' ? '❌ Booking Cancelled' : '❌ Booking Rejected',
        `Your booking #${displayOrder} has been ${status}. Contact support if needed.`,
        { bookingId, orderId: displayOrder, type: 'booking_cancelled', screen: 'bookings' }
      );
    }

    // 6. Notify Hub Manager + Admin for all active status changes
    const activeStatuses = ['assigned', 'on_the_way', 'in_progress', 'completed', 'cancelled', 'rejected'];
    if (activeStatuses.includes(status)) {
      const tokens = await getHubManagerAndAdminTokens();
      if (tokens.length > 0) {
        const statusLabels = {
          assigned: 'Assigned to Worker',
          on_the_way: 'Worker On the Way',
          in_progress: 'Service In Progress',
          completed: 'Completed ✅',
          cancelled: 'Cancelled ❌',
          rejected: 'Rejected ❌',
        };
        await sendFCMMulti(
          tokens,
          `📊 Job #${displayOrder} — ${statusLabels[status] || status}`,
          `${displayName}'s ${displayService} is now: ${statusLabels[status] || status}`,
          { bookingId, orderId: displayOrder, type: 'job_status_update', screen: 'bookings' }
        );
      }
    }

    console.log(`Booking ${displayOrder} status: ${before.status} → ${status}`);
  });
