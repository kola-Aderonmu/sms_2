class AlertService {
  constructor() {
    this.lastAlertTime = {
      cpu: 0,
      ram: 0,
      disk: 0,
    };
  }

  shouldSendAlert(metric, currentTime, isUrgent) {
    const cooldownPeriod = isUrgent ? 60000 : 300000; // 1 min or 5 min
    return currentTime - this.lastAlertTime[metric] > cooldownPeriod;
  }

  updateAlertTime(metric) {
    this.lastAlertTime[metric] = Date.now();
  }
}

export const alertService = new AlertService();
