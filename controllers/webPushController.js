const UserSettings = require("../models/UserSettings");

exports.getVapidPublicKey = (req, res) => {
  res.json({
    success: true,
    publicKey: process.env.VAPID_PUBLIC_KEY
  });
};

exports.subscribe = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: "Invalid subscription object" });
    }

    const settings = await UserSettings.findOne({ userId });
    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }

    // Check if subscription already exists (prevent duplicates)
    const exists = settings.pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
    
    if (!exists) {
      settings.pushSubscriptions.push(subscription);
      await settings.save();
    }

    res.status(201).json({ success: true, message: "Subscribed successfully" });
  } catch (err) {
    console.error("push subscribe error:", err);
    res.status(500).json({ success: false, message: "Failed to save subscription" });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ success: false, message: "Missing endpoint" });
    }

    const settings = await UserSettings.findOne({ userId });
    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }

    settings.pushSubscriptions = settings.pushSubscriptions.filter(sub => sub.endpoint !== endpoint);
    await settings.save();

    res.json({ success: true, message: "Unsubscribed successfully" });
  } catch (err) {
    console.error("push unsubscribe error:", err);
    res.status(500).json({ success: false, message: "Failed to remove subscription" });
  }
};

exports.testPush = async (req, res) => {
  try {
    const webpush = require("web-push");
    const userId = req.user?._id || req.user?.id;
    const settings = await UserSettings.findOne({ userId });

    if (!settings || !settings.pushSubscriptions || settings.pushSubscriptions.length === 0) {
      return res.status(400).json({ success: false, message: "No active push subscriptions found for your account." });
    }

    const payload = JSON.stringify({
      title: "Test Notification",
      body: "IT WORKS! This is a test notification from FONEST.",
      tag: "test-alert"
    });

    const promises = settings.pushSubscriptions.map(sub => webpush.sendNotification(sub, payload));
    await Promise.allSettled(promises);

    res.json({ success: true, message: "Test push sent to your devices!" });
  } catch (err) {
    console.error("Test push error:", err);
    res.status(500).json({ success: false, message: "Failed to send test push" });
  }
};
