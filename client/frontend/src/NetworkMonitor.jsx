import { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";

const NetworkMonitor = () => {
  const [networkStats, setNetworkStats] = useState({
    incoming: 0,
    outgoing: 0,
    connections: 0,
    packets_received: 0,
    packets_sent: 0,
  });

  useEffect(() => {
    const fetchNetworkStats = async () => {
      const response = await fetch("http://localhost:5000/network_stats");
      const data = await response.json();
      setNetworkStats(data);
    };

    const interval = setInterval(fetchNetworkStats, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="network-monitor">
      <h3>Network Traffic Monitor</h3>
      <div className="network-stats-grid">
        <div className="stat-card">
          <h4>Incoming Traffic</h4>
          <span>{networkStats.incoming.toFixed(2)} MB/s</span>
        </div>
        <div className="stat-card">
          <h4>Outgoing Traffic</h4>
          <span>{networkStats.outgoing.toFixed(2)} MB/s</span>
        </div>
        <div className="stat-card">
          <h4>Active Connections</h4>
          <span>{networkStats.connections}</span>
        </div>
        <div className="stat-card">
          <h4>Packets Received</h4>
          <span>{networkStats.packets_received}</span>
        </div>
        <div className="stat-card">
          <h4>Packets Sent</h4>
          <span>{networkStats.packets_sent}</span>
        </div>
      </div>
    </div>
  );
};

export default NetworkMonitor;
