import { useState, useEffect } from "react";

const AlertBell = ({ alerts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [readAlerts, setReadAlerts] = useState(new Set());

  useEffect(() => {
    const unreadCount = alerts.filter(
      (alert) => !readAlerts.has(alert.timestamp)
    ).length;
    setAlertCount(unreadCount);
    setHasUnread(unreadCount > 0);
  }, [alerts, readAlerts]);

  const handleBellClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Mark all current alerts as read
      const newReadAlerts = new Set(readAlerts);
      alerts.forEach((alert) => newReadAlerts.add(alert.timestamp));
      setReadAlerts(newReadAlerts);
    }
  };

  return (
    <div className="alert-bell-container">
      <div
        className={`bell-icon ${hasUnread ? "has-alerts" : ""}`}
        onClick={handleBellClick}
      >
        🔔
        {alertCount > 0 && <span className="alert-count">{alertCount}</span>}
      </div>

      {isOpen && (
        <div className="alerts-dropdown">
          <div className="alerts-header">
            <h3>System Alerts</h3>
            <button className="close-button" onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className="alerts-list">
            {alerts.length > 0 ? (
              alerts.map((alert, index) => (
                <div key={index} className={`alert-item ${alert.type || ""}`}>
                  <span className="alert-time">{alert.timestamp}</span>
                  <span className="alert-message">{alert.message}</span>
                </div>
              ))
            ) : (
              <div className="no-alerts">No alerts to display</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertBell;
