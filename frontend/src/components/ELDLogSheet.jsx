import React from 'react';
import './ELDLogSheet.css';

const STATUS_Y = {
  OFF: 20,
  SB: 60,
  D: 100,
  ON: 140
};

const ELDLogSheet = ({ log }) => {
  const { dayNumber, dateString, totals, intervals } = log;

  // Grid config
  const width = 960;
  const height = 160;
  const hourWidth = width / 24; // 40px per hour
  const minWidth = width / 1440; // ~0.666px per minute

  // Build the SVG path for the ELD graph
  let pathD = '';
  let currentX = 0;

  // Track coordinates to draw transitions
  const points = [];

  intervals.forEach((interval, index) => {
    const startY = STATUS_Y[interval.status];
    const durationMin = interval.durationMin;
    const endX = currentX + (durationMin * minWidth);

    // Initial point
    if (index === 0) {
      pathD += `M ${currentX} ${startY}`;
      points.push({ x: currentX, y: startY, status: interval.status });
    } else {
      // Draw vertical line from previous status y to current status y
      const prevY = STATUS_Y[intervals[index - 1].status];
      pathD += ` L ${currentX} ${startY}`;
      points.push({ x: currentX, y: startY, status: interval.status });
    }

    // Draw horizontal line for the duration
    pathD += ` L ${endX} ${startY}`;
    points.push({ x: endX, y: startY, status: interval.status });

    currentX = endX;
  });

  // Generate vertical grid lines and ticks
  const gridLines = [];
  const labels = [];

  for (let i = 0; i <= 24; i++) {
    const x = i * hourWidth;
    
    // Hour labels (Midnight, 1, ..., 11, Noon, 1, ..., 11, Midnight)
    let label = i.toString();
    if (i === 0 || i === 24) label = 'M';
    else if (i === 12) label = 'N';
    else if (i > 12) label = (i - 12).toString();

    labels.push(
      <text key={`lbl-${i}`} x={x} y={-8} className="grid-label" textAnchor="middle">
        {label}
      </text>
    );

    // Main hourly vertical grid line
    gridLines.push(
      <line key={`line-${i}`} x1={x} y1={0} x2={x} y2={height} className="grid-line-hour" />
    );

    // 15-minute and 30-minute ticks between hours
    if (i < 24) {
      gridLines.push(
        <line key={`tick-30-${i}`} x1={x + hourWidth / 2} y1={0} x2={x + hourWidth / 2} y2={height} className="grid-line-half" />
      );
      gridLines.push(
        <line key={`tick-15-${i}`} x1={x + hourWidth / 4} y1={0} x2={x + hourWidth / 4} y2={height} className="grid-line-quarter" />
      );
      gridLines.push(
        <line key={`tick-45-${i}`} x1={x + (hourWidth * 3) / 4} y1={0} x2={x + (hourWidth * 3) / 4} y2={height} className="grid-line-quarter" />
      );
    }
  }

  // Row label names
  const rowLabels = [
    { name: 'OFF (Off Duty)', y: STATUS_Y.OFF },
    { name: 'SB (Sleeper Berth)', y: STATUS_Y.SB },
    { name: 'D (Driving)', y: STATUS_Y.D },
    { name: 'ON (On Duty - ND)', y: STATUS_Y.ON }
  ];

  return (
    <div className="eld-sheet-card">
      <div className="eld-sheet-header">
        <h3 className="eld-day-title">Day {dayNumber} Log Sheet</h3>
        <span className="eld-day-date">{dateString}</span>
      </div>

      <div className="eld-grid-container">
        {/* Row Labels (Left Side) */}
        <div className="eld-row-labels">
          {rowLabels.map(row => (
            <div key={row.name} className="eld-row-label-text" style={{ top: `${row.y - 8}px` }}>
              {row.name}
            </div>
          ))}
        </div>

        {/* SVG Grid */}
        <div className="eld-svg-wrapper">
          <svg viewBox={`-20 -20 ${width + 40} ${height + 40}`} width="100%" height="100%">
            {/* Grid background */}
            <rect x={0} y={0} width={width} height={height} className="grid-rect-bg" />
            
            {/* Horizontal rows */}
            <line x1={0} y1={STATUS_Y.OFF} x2={width} y2={STATUS_Y.OFF} className="grid-row-line" />
            <line x1={0} y1={STATUS_Y.SB} x2={width} y2={STATUS_Y.SB} className="grid-row-line" />
            <line x1={0} y1={STATUS_Y.D} x2={width} y2={STATUS_Y.D} className="grid-row-line" />
            <line x1={0} y1={STATUS_Y.ON} x2={width} y2={STATUS_Y.ON} className="grid-row-line" />

            {/* Grid vertical lines & hour labels */}
            {gridLines}
            {labels}

            {/* The active ELD line path */}
            <path d={pathD} className="eld-active-line" />
            
            {/* Vertices/joints */}
            {points.map((p, idx) => (
              <circle key={`pt-${idx}`} cx={p.x} cy={p.y} r={3} className="eld-line-joint" />
            ))}
          </svg>
        </div>
      </div>

      {/* Summary totals */}
      <div className="eld-totals-grid">
        <div className="eld-total-box">
          <span className="eld-total-lbl">OFF DUTY</span>
          <span className="eld-total-val">{totals.OFF.toFixed(2)} hrs</span>
        </div>
        <div className="eld-total-box">
          <span className="eld-total-lbl">SLEEPER BERTH</span>
          <span className="eld-total-val">{totals.SB.toFixed(2)} hrs</span>
        </div>
        <div className="eld-total-box">
          <span className="eld-total-lbl">DRIVING</span>
          <span className="eld-total-val">{totals.D.toFixed(2)} hrs</span>
        </div>
        <div className="eld-total-box">
          <span className="eld-total-lbl">ON DUTY (ND)</span>
          <span className="eld-total-val">{totals.ON.toFixed(2)} hrs</span>
        </div>
        <div className="eld-total-box highlighted">
          <span className="eld-total-lbl">TOTAL HOURS</span>
          <span className="eld-total-val">{(totals.OFF + totals.SB + totals.D + totals.ON).toFixed(1)} hrs</span>
        </div>
      </div>
    </div>
  );
};

export default ELDLogSheet;
