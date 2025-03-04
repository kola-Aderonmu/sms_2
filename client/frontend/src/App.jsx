import React, { useEffect, useState, useCallback, useMemo } from "react";
import NotificationService from "../NotificationService";
import ThresholdSettings from "./ThresholdSettings";
import { alertService } from "../AlertService";
import AlertBell from "./AlertBell";
import AlertMonitor from "./AlertMonitor";
import HistoricalData from "./HistoricalData";
import NetworkMonitor from "./NetworkMonitor";
import Loading from "./Loading";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import "./App.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MAX_HISTORY_LENGTH = 20;
const RECONNECT_TIMEOUT = 3000;

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [histories, setHistories] = useState({
    cpu: [],
    ram: [],
    disk: [],
  });
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  // ###CHANGE THE VALUES FOR REAL DEPLOYMENT
  const [thresholds, setThresholds] = useState({
    cpu: 110,
    ram: 100,
    disk: 80,
  });

  const [alertSettings, setAlertSettings] = useState({
    email: true,
    browser: true,
  });
  const [alerts, setAlerts] = useState([]);

  const handleNewAlert = (metric, value, threshold) => {
    const newAlert = {
      message: `${metric} usage at ${value}% (Threshold: ${threshold}%)`,
      timestamp: new Date().toLocaleString(),
      type: value > threshold + 10 ? "critical" : "warning",
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 10)); // Keep last 10 alerts
  };
  const handleMetricsAlert = useCallback(
    (metrics) => {
      const currentTime = Date.now();

      // CPU Check
      if (metrics.cpu_usage_percent > thresholds.cpu) {
        handleNewAlert("CPU", metrics.cpu_usage_percent, thresholds.cpu);
        const isUrgent = metrics.cpu_usage_percent > thresholds.cpu + 10;
        if (alertService.shouldSendAlert("cpu", currentTime, isUrgent)) {
          NotificationService.sendAlert({
            type: "cpu",
            value: metrics.cpu_usage_percent,
            threshold: thresholds.cpu,
            isUrgent,
          });
          alertService.updateAlertTime("cpu");
        }
      }

      // Similar checks for RAM and Disk
      if (metrics.ram.percent > thresholds.ram) {
        handleNewAlert("RAM", metrics.ram.percent, thresholds.ram);
        const isUrgent = metrics.ram.percent > thresholds.ram + 10;
        if (alertService.shouldSendAlert("ram", currentTime, isUrgent)) {
          NotificationService.sendAlert({
            type: "ram",
            value: metrics.ram.percent,
            threshold: thresholds.ram,
            isUrgent,
          });
          alertService.updateAlertTime("ram");
        }
      }

      if (metrics.disk.percent > thresholds.disk) {
        handleNewAlert("Disk", metrics.disk.percent, thresholds.disk);
        const isUrgent = metrics.disk.percent > thresholds.disk + 10;
        if (alertService.shouldSendAlert("disk", currentTime, isUrgent)) {
          NotificationService.sendAlert({
            type: "disk",
            value: metrics.disk.percent,
            threshold: thresholds.disk,
            isUrgent,
          });
          alertService.updateAlertTime("disk");
        }
      }
    },
    [thresholds, handleNewAlert]
  );

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (metrics) {
      handleMetricsAlert(metrics);
    }
  }, [metrics, handleMetricsAlert]);

  const connectToEventSource = useCallback(() => {
    const eventSource = new EventSource(
      "http://localhost:5000/metrics_stream",
      {
        withCredentials: false,
      }
    );

    eventSource.onopen = () => {
      console.log("Connected to metrics stream");
      setConnectionStatus("connected");
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMetrics(data);
      setHistories((prev) => ({
        cpu: [...prev.cpu, data.cpu_usage_percent].slice(-MAX_HISTORY_LENGTH),
        ram: [...prev.ram, data.ram.percent].slice(-MAX_HISTORY_LENGTH),
        disk: [...prev.disk, data.disk.percent].slice(-MAX_HISTORY_LENGTH),
      }));
    };

    eventSource.onerror = () => {
      console.log("Connection lost, attempting to reconnect...");
      setConnectionStatus("disconnected");
      eventSource.close();
      setTimeout(connectToEventSource, RECONNECT_TIMEOUT);
    };

    return eventSource;
  }, []);

  useEffect(() => {
    const eventSource = connectToEventSource();
    return () => eventSource.close();
  }, [connectToEventSource]);

  useEffect(() => {
    NotificationService.requestPermission();
  }, []);

  useEffect(() => {
    if (metrics) {
      handleMetricsAlert(metrics);
    }
  }, [metrics, thresholds]);

  const handleThresholdChange = (metric, value) => {
    setThresholds((prev) => ({
      ...prev,
      [metric]: Number(value),
    }));
  };

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 250,
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
        },
        x: {
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
        },
      },
    }),
    []
  );

  const renderMetricBox = (title, percentage, history, color, total, used) => (
    <div className="metric-box">
      <h2>{title}</h2>
      <div className="progress-section">
        <div className="progress-label">
          <span>{title} Usage</span>
          <span>{percentage.toFixed(1)}%</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${title.toLowerCase()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <div className="chart-wrapper">
        <div className="chart-container">
          <Line
            data={{
              labels: history.map((_, i) => i + 1),
              datasets: [
                {
                  label: `${title} Usage (%)`,
                  data: history,
                  borderColor: color,
                  backgroundColor: `${color}33`,
                  fill: true,
                  tension: 0.4,
                },
              ],
            }}
            options={chartOptions}
          />
        </div>
        <div className="pie-chart-container">
          <Pie
            data={{
              labels: [`Used ${title}`, `Free ${title}`],
              datasets: [
                {
                  data: [used, total - used],
                  backgroundColor: [color, "#424242"],
                  hoverBackgroundColor: [color, "#424242"],
                },
              ],
            }}
          />
        </div>
      </div>
    </div>
  );

  // Additing the component for connections table
  const ConnectionsTable = ({ connections, totalConnections }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    // Add this console log to check the data
    console.log("Single connection data:", connections[0]);

    const formatTimestamp = (timestamp) => {
      const date = new Date(timestamp);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    };

    return (
      <div className="connections-container">
        <div
          className="table-header"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3>
            Active System Connections{" "}
            <span className="connection-count">({totalConnections})</span>
          </h3>
          <span className={`arrow-icon ${isExpanded ? "expanded" : ""}`}>
            ▼
          </span>
        </div>

        <div className={`table-wrapper ${isExpanded ? "expanded" : ""}`}>
          <table className="connections-table">
            <thead>
              <tr>
                <th>Process Name</th>
                <th>PID</th>
                <th>Local Address</th>
                <th>Remote Address</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((conn, index) => (
                <tr key={index}>
                  <td>{conn.process_name}</td>
                  <td>{conn.pid}</td>
                  <td>{conn.local_address}</td>
                  <td>{conn.remote_address}</td>
                  <td>{formatTimestamp(conn.timestamp)}</td>
                  <td>{conn.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <Loading onComplete={() => setIsLoading(false)} />;
  }
  return (
    <div className="App">
      <AlertBell alerts={alerts} />
      <div className={`connection-status ${connectionStatus}`}>
        {connectionStatus === "connected" ? "🟢 Connected" : "🔴 Disconnected"}
      </div>

      <h1>Server Metrics Monitor</h1>

      <AlertMonitor alerts={alerts} metrics={metrics} thresholds={thresholds} />

      <ThresholdSettings
        thresholds={thresholds}
        onThresholdChange={handleThresholdChange}
      />

      {metrics ? (
        <>
          {/* Progress Bars Section */}
          <div className="progress-bars-container">
            <div className="progress-card">
              <div className="progress-title">
                <span>CPU Usage</span>
                <span>{metrics.cpu_usage_percent}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill cpu"
                  style={{ width: `${metrics.cpu_usage_percent}%` }}
                />
              </div>
            </div>

            <div className="progress-card">
              <div className="progress-title">
                <span>RAM Usage</span>
                <span>{metrics.ram.percent}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill ram"
                  style={{ width: `${metrics.ram.percent}%` }}
                />
              </div>
            </div>

            <div className="progress-card">
              <div className="progress-title">
                <span>Disk Usage</span>
                <span>{metrics.disk.percent}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill disk"
                  style={{ width: `${metrics.disk.percent}%` }}
                />
              </div>
            </div>

            <div className="progress-card nodes-card">
              <div className="progress-title">
                <span>Connected Nodes</span>
              </div>
              <div className="nodes-count">{metrics.connected_nodes || 0}</div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="metrics-charts-container">
            {/* CPU Charts */}
            <div className="metrics-chart-card">
              <h3>CPU Metrics</h3>
              <div className="charts-wrapper">
                <div className="line-chart">
                  <Line
                    data={{
                      labels: histories.cpu.map((_, i) => i + 1),
                      datasets: [
                        {
                          label: "CPU Usage History (%)",
                          data: histories.cpu,
                          borderColor: "rgba(76, 175, 80, 1)",
                          backgroundColor: "rgba(76, 175, 80, 0.2)",
                          fill: true,
                          tension: 0.4,
                        },
                      ],
                    }}
                    options={chartOptions}
                  />
                </div>
                <div className="pie-chart">
                  <Pie
                    data={{
                      labels: ["Used CPU", "Free CPU"],
                      datasets: [
                        {
                          data: [
                            metrics.cpu_usage_percent,
                            100 - metrics.cpu_usage_percent,
                          ],
                          backgroundColor: ["rgba(76, 175, 80, 1)", "#424242"],
                        },
                      ],
                    }}
                  />
                </div>
              </div>
            </div>

            {/* RAM Charts */}
            <div className="metrics-chart-card">
              <h3>RAM Metrics</h3>
              <div className="charts-wrapper">
                <div className="line-chart">
                  <Line
                    data={{
                      labels: histories.ram.map((_, i) => i + 1),
                      datasets: [
                        {
                          label: "RAM Usage History (%)",
                          data: histories.ram,
                          borderColor: "rgba(33, 150, 243, 1)",
                          backgroundColor: "rgba(33, 150, 243, 0.2)",
                          fill: true,
                          tension: 0.4,
                        },
                      ],
                    }}
                    options={chartOptions}
                  />
                </div>
                <div className="pie-chart">
                  <Pie
                    data={{
                      labels: ["Used RAM", "Free RAM"],
                      datasets: [
                        {
                          data: [
                            metrics.ram.used_gb,
                            metrics.ram.total_gb - metrics.ram.used_gb,
                          ],
                          backgroundColor: ["rgba(33, 150, 243, 1)", "#424242"],
                        },
                      ],
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Disk Charts */}
            <div className="metrics-chart-card">
              <h3>Disk Metrics</h3>
              <div className="charts-wrapper">
                <div className="line-chart">
                  <Line
                    data={{
                      labels: histories.disk.map((_, i) => i + 1),
                      datasets: [
                        {
                          label: "Disk Usage History (%)",
                          data: histories.disk,
                          borderColor: "rgba(255, 193, 7, 1)",
                          backgroundColor: "rgba(255, 193, 7, 0.2)",
                          fill: true,
                          tension: 0.4,
                        },
                      ],
                    }}
                    options={chartOptions}
                  />
                </div>
                <div className="pie-chart">
                  <Pie
                    data={{
                      labels: ["Used Disk", "Free Disk"],
                      datasets: [
                        {
                          data: [
                            metrics.disk.used_gb,
                            metrics.disk.total_gb - metrics.disk.used_gb,
                          ],
                          backgroundColor: ["rgba(255, 193, 7, 1)", "#424242"],
                        },
                      ],
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="advanced-metrics">
            <HistoricalData />
            <NetworkMonitor />
          </div>

          {metrics && metrics.system_connections && (
            <ConnectionsTable
              connections={metrics.system_connections}
              totalConnections={metrics.total_connections}
            />
          )}
        </>
      ) : (
        <div className="loading">
          <p>Loading metrics data...</p>
        </div>
      )}

      <div className="alert-settings">
        <h3>Alert Settings</h3>
        <div className="alert-toggles">
          <label>
            <input
              type="checkbox"
              checked={alertSettings.email}
              onChange={(e) =>
                setAlertSettings((prev) => ({
                  ...prev,
                  email: e.target.checked,
                }))
              }
            />
            Email Alerts
          </label>
          <label>
            <input
              type="checkbox"
              checked={alertSettings.browser}
              onChange={(e) =>
                setAlertSettings((prev) => ({
                  ...prev,
                  browser: e.target.checked,
                }))
              }
            />
            Browser Notifications
          </label>
        </div>
      </div>
    </div>
  );
}

export default App;
