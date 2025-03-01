import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";

const HistoricalData = () => {
  const [historicalData, setHistoricalData] = useState([]);
  const [timeRange, setTimeRange] = useState("24h");

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "System Resource Usage Over Time",
      },
    },
  };

  useEffect(() => {
    fetch(`http://localhost:5000/historical_data/${timeRange}`)
      .then((res) => res.json())
      .then((data) => setHistoricalData(data));
  }, [timeRange]);

  const chartData = {
    labels: historicalData.map((d) =>
      new Date(d.timestamp).toLocaleTimeString()
    ),
    datasets: [
      {
        label: "CPU Usage",
        data: historicalData.map((d) => d.cpu),
        borderColor: "rgba(76, 175, 80, 1)",
        tension: 0.4,
      },
      {
        label: "RAM Usage",
        data: historicalData.map((d) => d.ram),
        borderColor: "rgba(33, 150, 243, 1)",
        tension: 0.4,
      },
      {
        label: "Disk Usage",
        data: historicalData.map((d) => d.disk),
        borderColor: "rgba(255, 193, 7, 1)",
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="historical-data">
      <h3>Historical Performance</h3>
      <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
        <option value="24h">Last 24 Hours</option>
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
      </select>
      <div className="chart-container">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default HistoricalData;
