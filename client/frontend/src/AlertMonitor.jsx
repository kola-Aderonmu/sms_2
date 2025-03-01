const AlertMonitor = ({ alerts, metrics, thresholds }) => {
  return (
    <div className="alert-monitor">
      <h3>System Alert Monitor</h3>
      <div className="current-status">
        <div
          className={`status-item ${
            metrics?.cpu_usage_percent > thresholds.cpu ? "warning" : "normal"
          }`}
        >
          CPU: {metrics?.cpu_usage_percent}% (Threshold: {thresholds.cpu}%)
        </div>
        <div
          className={`status-item ${
            metrics?.ram.percent > thresholds.ram ? "warning" : "normal"
          }`}
        >
          RAM: {metrics?.ram.percent}% (Threshold: {thresholds.ram}%)
        </div>
        <div
          className={`status-item ${
            metrics?.disk.percent > thresholds.disk ? "warning" : "normal"
          }`}
        >
          Disk: {metrics?.disk.percent}% (Threshold: {thresholds.disk}%)
        </div>
      </div>
      <div className="alert-history">
        {alerts.map((alert, index) => (
          <div key={index} className={`alert-entry ${alert.type}`}>
            <span className="alert-time">{alert.timestamp}</span>
            <span className="alert-type">{alert.type.toUpperCase()}</span>
            <span className="alert-message">{alert.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
export default AlertMonitor;
