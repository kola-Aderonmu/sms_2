const ThresholdSettings = ({ thresholds, onThresholdChange }) => {
  return (
    <div className="threshold-settings">
      <h3>Alert Thresholds</h3>
      <div className="threshold-controls">
        <div className="threshold-item">
          <label>CPU Warning Level (%)</label>
          <input
            type="number"
            value={thresholds.cpu}
            onChange={(e) => onThresholdChange("cpu", e.target.value)}
            min="0"
            max="100"
          />
        </div>
        <div className="threshold-item">
          <label>RAM Warning Level (%)</label>
          <input
            type="number"
            value={thresholds.ram}
            onChange={(e) => onThresholdChange("ram", e.target.value)}
            min="0"
            max="100"
          />
        </div>
        <div className="threshold-item">
          <label>Disk Warning Level (%)</label>
          <input
            type="number"
            value={thresholds.disk}
            onChange={(e) => onThresholdChange("disk", e.target.value)}
            min="0"
            max="100"
          />
        </div>
      </div>
    </div>
  );
};
export default ThresholdSettings;
