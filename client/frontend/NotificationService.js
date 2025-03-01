class NotificationService {
  static async sendAlert(alertData) {
    try {
      const response = await fetch("http://localhost:5000/send_alert", {
        // Changed to correct port
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alertData),
      });

      if (!response.ok) {
        throw new Error(`Failed to send alert: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Alert sent successfully:", result);
      return result;
    } catch (error) {
      console.error("Error sending alert:", error);
      throw error; // Propagate error for handling in the component
    }
  }

  static requestPermission() {
    if (Notification.permission !== "granted") {
      return Notification.requestPermission();
    }
    return Promise.resolve(Notification.permission);
  }

  static checkThresholds(metrics, thresholds) {
    const alerts = [];

    if (metrics.cpu_usage_percent > thresholds.cpu) {
      alerts.push({
        type: "cpu",
        value: metrics.cpu_usage_percent,
        threshold: thresholds.cpu,
        isUrgent: metrics.cpu_usage_percent > thresholds.cpu + 10,
      });
    }

    return alerts;
  }
}

export default NotificationService;
