const webpush = require("web-push");
const UserSettings = require("../models/UserSettings");
const User = require("../models/User");

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@fonest.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send a background push notification to all admins who have opted-in.
 * @param {string} alertType - e.g., 'returnRequests', 'outOfStockAlerts'
 * @param {object} payload - The body to push: { title, body, icon, data, tag }
 */
exports.sendPushToAdmins = async (alertType, payload) => {
  try {
    // 1. Find all admin users
    const admins = await User.find({ role: "admin" }).select("_id").lean();
    if (!admins.length) return;

    const adminIds = admins.map((a) => a._id);

    // 2. Look up their settings and filter only those opted-in
    const settingsList = await UserSettings.find({ userId: { $in: adminIds } });

    const notificationsPromises = [];

    // 3. Loop over valid subscriptions and send
    settingsList.forEach((settings) => {
      // Check if they allowed this specific alert type
      if (settings.notifications?.[alertType] === true) {
        const subs = settings.pushSubscriptions || [];
        
        subs.forEach((sub, index) => {
          notificationsPromises.push(
            webpush.sendNotification(sub, JSON.stringify(payload)).catch(err => {
              console.error(`Push error for admin ${settings.userId}:`, err);
              // If subscription is invalid/expired (410, 404), we could remove it from the array here
              if (err.statusCode === 410 || err.statusCode === 404) {
                 settings.pushSubscriptions.splice(index, 1);
                 settings.save().catch(e => console.error("Failed to prune sub:", e));
              }
            })
          );
        });
      }
    });

    await Promise.allSettled(notificationsPromises);
  } catch (err) {
    console.error("sendPushToAdmins error:", err);
  }
};
