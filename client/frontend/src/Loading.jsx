import React from "react";

const Loading = ({ onComplete }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="loading-container">
      <div className="hourglass"></div>
      <div className="progress-bar">
        <div className="progress-fill"></div>
      </div>
      <p>Loading System Metrics...</p>
    </div>
  );
};

export default Loading;
