import React, { useState } from 'react';
import { 
  FiSearch, 
  FiBell, 
  FiUser, 
  FiCalendar, 
  FiDownload, 
  FiPrinter, 
  FiFileText,
  FiPlus
} from 'react-icons/fi';
import Sidebar from './Sidebar';
import './ELDLogsPage.css';

// Y-Coordinates matching graph statuses
const GRAPH_Y = {
  OFF: 20,
  SB: 60,
  D: 100,
  ON: 140
};

const ELDLogsPage = ({ onTabChange, eldResult }) => {
  // Determine if we have real solved data or if we should display the default high-fidelity mockup
  const hasRealData = eldResult && eldResult.dailyLogs && eldResult.dailyLogs.length > 0;
  
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  // 1. Get Day Data
  let days = [];
  let currentDateString = 'May 24, 2024';
  let totals = { OFF: 12.5, SB: 8.0, D: 6.7, ON: 8.25 };
  let intervals = [];

  if (hasRealData) {
    days = eldResult.dailyLogs;
    const currentDay = days[selectedDayIdx] || days[0];
    currentDateString = currentDay.dateString;
    totals = currentDay.totals;
    intervals = currentDay.intervals;
  } else {
    // Default Mockup Data matching screenshot
    days = [
      { dayNumber: 1, dateString: 'May 24, 2024' },
      { dayNumber: 2, dateString: 'May 25, 2024' },
      { dayNumber: 3, dateString: 'May 26, 2024' },
      { dayNumber: 4, dateString: 'May 27, 2024' }
    ];
    totals = {
      OFF: 12.5, // 12h 30m
      SB: 8.0,   // 8h 00m
      D: 6.7,    // 06:42 (6.7 hours)
      ON: 8.25   // 08:15 (8.25 hours)
    };
    
    // Mock intervals for Day 1
    intervals = [
      { status: 'OFF', durationMin: 260 }, // 12:00 AM - 04:20 AM
      { status: 'SB', durationMin: 130 },  // 04:20 AM - 06:30 AM
      { status: 'D', durationMin: 402 },   // 06:30 AM - 01:12 PM
      { status: 'ON', durationMin: 495 },  // 01:12 PM - 09:27 PM
      { status: 'OFF', durationMin: 153 }  // 09:27 PM - 12:00 AM
    ];
  }

  // Graph render maths
  const width = 840;
  const height = 160;
  const hourWidth = width / 24;
  const minWidth = width / 1440;

  // Build the SVG path
  let pathD = '';
  let currentX = 0;
  const points = [];

  intervals.forEach((interval, index) => {
    const startY = GRAPH_Y[interval.status] || GRAPH_Y.OFF;
    const durationMin = interval.durationMin;
    const endX = currentX + (durationMin * minWidth);

    if (index === 0) {
      pathD += `M ${currentX} ${startY}`;
      points.push({ x: currentX, y: startY });
    } else {
      pathD += ` L ${currentX} ${startY}`;
      points.push({ x: currentX, y: startY });
    }

    pathD += ` L ${endX} ${startY}`;
    points.push({ x: endX, y: startY });

    currentX = endX;
  });

  // Grid vertical hour lines
  const gridLines = [];
  const labels = [];
  for (let i = 0; i <= 24; i++) {
    const x = i * hourWidth;
    let label = i.toString();
    if (i === 0 || i === 24) label = 'M';
    else if (i === 12) label = 'N';
    else if (i > 12) label = (i - 12).toString();

    labels.push(
      <text key={`lbl-${i}`} x={x} y={-8} className="eld-graph-lbl-txt" textAnchor="middle">
        {label}
      </text>
    );

    gridLines.push(
      <line key={`line-${i}`} x1={x} y1={0} x2={x} y2={height} className="eld-grid-line-hour" />
    );

    if (i < 24) {
      gridLines.push(
        <line key={`tick-30-${i}`} x1={x + hourWidth / 2} y1={0} x2={x + hourWidth / 2} y2={height} className="eld-grid-line-half" />
      );
    }
  }

  // Format Helper: decimal hours to H:M string
  const formatHrs = (decimal) => {
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div className="eld-page-layout">
      {/* Sidebar Navigation */}
      <Sidebar activeTab="eld-logs" onTabChange={onTabChange} />

      {/* Main Panel */}
      <div className="eld-main-panel">
        
        {/* Top Navbar */}
        <header className="eld-top-header">
          <div className="eld-title-container">
            <span className="eld-page-header-title">ELD Logs</span>
          </div>

          <div className="eld-search-container">
            <FiSearch className="eld-search-icon" />
            <input 
              type="text" 
              placeholder="Search logs by driver, ID or truck..." 
              className="eld-search-input" 
            />
          </div>

          <div className="eld-hdr-widgets">
            <div className="system-compliant-pill">
              <span className="green-pulse-dot"></span> System Compliant
            </div>
            <button className="eld-bell-widget"><FiBell /></button>
            <div className="eld-user-widget-detailed">
              <div className="eld-user-info">
                <span className="eld-username">Alex Rivera</span>
                <span className="eld-user-role">ID: #44920</span>
              </div>
              <div className="eld-avatar-circle">AR</div>
            </div>
          </div>
        </header>

        {/* Viewport Content */}
        <div className="eld-content-viewport">
          
          {/* 1. Clocks Stats row */}
          <section className="eld-clocks-strip-grid">
            <div className="eld-clock-card border-orange">
              <span className="eld-clock-lbl">DRIVING</span>
              <span className="eld-clock-val">{formatHrs(totals.D)} <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill bg-orange" style={{ width: `${(totals.D / 11) * 100}%` }}></div></div>
            </div>
            
            <div className="eld-clock-card border-blue">
              <span className="eld-clock-lbl">ON DUTY</span>
              <span className="eld-clock-val">{formatHrs(totals.ON)} <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill bg-blue" style={{ width: `${(totals.ON / 14) * 100}%` }}></div></div>
            </div>

            <div className="eld-clock-card border-white">
              <span className="eld-clock-lbl">OFF DUTY</span>
              <span className="eld-clock-val">{formatHrs(totals.OFF)} <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill bg-white" style={{ width: `${(totals.OFF / 24) * 100}%` }}></div></div>
            </div>

            <div className="eld-clock-card border-grey">
              <span className="eld-clock-lbl">SLEEPER BERTH</span>
              <span className="eld-clock-val">{formatHrs(totals.SB)} <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill bg-grey" style={{ width: `${(totals.SB / 10) * 100}%` }}></div></div>
            </div>

            <div className="eld-clock-card border-cycle-orange">
              <span className="eld-clock-lbl">CYCLE REMAINING</span>
              <span className="eld-clock-val text-orange-val">42:18 <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill bg-orange" style={{ width: '60%' }}></div></div>
            </div>
          </section>

          {/* 2. Main ELD graph card */}
          <section className="eld-graph-card-main">
            <div className="eld-graph-card-header">
              {/* Day Tabs */}
              <div className="day-selector-tabs">
                {days.map((day, idx) => (
                  <button 
                    key={day.dayNumber}
                    className={`day-tab-btn ${selectedDayIdx === idx ? 'active' : ''}`}
                    onClick={() => setSelectedDayIdx(idx)}
                  >
                    Day {day.dayNumber}
                  </button>
                ))}
              </div>

              {/* Date */}
              <div className="eld-graph-date-display">
                <FiCalendar className="date-icon" /> {currentDateString}
              </div>

              {/* Action utilities */}
              <div className="eld-graph-actions">
                <button className="eld-utility-btn"><FiDownload /> Download PDF</button>
                <button className="eld-utility-btn"><FiPrinter /> Print Log</button>
              </div>
            </div>

            {/* SVG graph container */}
            <div className="eld-svg-graph-container-wrapper">
              <div className="eld-y-axis-labels">
                <div className="y-axis-lbl" style={{ top: `${GRAPH_Y.OFF - 8}px` }}>OFF DUTY</div>
                <div className="y-axis-lbl" style={{ top: `${GRAPH_Y.SB - 8}px` }}>SLEEPER</div>
                <div className="y-axis-lbl" style={{ top: `${GRAPH_Y.D - 8}px` }}>DRIVING</div>
                <div className="y-axis-lbl" style={{ top: `${GRAPH_Y.ON - 8}px` }}>ON DUTY</div>
              </div>

              <div className="eld-svg-wrapper-relative">
                <svg viewBox={`-10 -20 ${width + 20} ${height + 30}`} width="100%" height="100%">
                  {/* Grid background */}
                  <rect x={0} y={0} width={width} height={height} className="eld-grid-bg" />
                  
                  {/* Horizontal status guide lines */}
                  <line x1={0} y1={GRAPH_Y.OFF} x2={width} y2={GRAPH_Y.OFF} className="eld-row-guide-line" />
                  <line x1={0} y1={GRAPH_Y.SB} x2={width} y2={GRAPH_Y.SB} className="eld-row-guide-line" />
                  <line x1={0} y1={GRAPH_Y.D} x2={width} y2={GRAPH_Y.D} className="eld-row-guide-line" />
                  <line x1={0} y1={GRAPH_Y.ON} x2={width} y2={GRAPH_Y.ON} className="eld-row-guide-line" />

                  {/* Grid vertical lines & hour labels */}
                  {gridLines}
                  {labels}

                  {/* The active HOS line path */}
                  <path d={pathD} className="eld-path-active-line" />
                  
                  {/* Transition points */}
                  {points.map((p, idx) => (
                    <circle key={`pt-${idx}`} cx={p.x} cy={p.y} r={3} className="eld-path-point" />
                  ))}
                </svg>
              </div>
            </div>

            {/* Bottom summaries grid inside card */}
            <div className="eld-graph-summaries-strip">
              <div className="summary-col">
                <span className="summary-lbl">Total OFF</span>
                <span className="summary-val">{formatHrs(totals.OFF)}</span>
              </div>
              <div className="summary-col">
                <span className="summary-lbl">Total SB</span>
                <span className="summary-val">{formatHrs(totals.SB)}</span>
              </div>
              <div className="summary-col">
                <span className="summary-lbl">Total DR</span>
                <span className="summary-val text-orange">{formatHrs(totals.D)}</span>
              </div>
              <div className="summary-col">
                <span className="summary-lbl">Total ON</span>
                <span className="summary-val text-blue">{formatHrs(totals.ON)}</span>
              </div>
            </div>

          </section>

          {/* 3. Log Details & Annotations Card */}
          <section className="eld-annotations-card-large">
            <div className="annotations-header">
              <div className="annotations-title-widget">
                <FiFileText className="annotations-icon" />
                <h3>Log Details & Annotations</h3>
              </div>
              <button className="btn-add-remark">Add Remark</button>
            </div>

            <div className="annotations-table-wrapper">
              <table className="annotations-table">
                <thead>
                  <tr>
                    <th>STATUS</th>
                    <th>START TIME</th>
                    <th>LOCATION</th>
                    <th>DURATION</th>
                    <th>NOTES / REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="bullet-dot bg-white"></span> OFF DUTY</td>
                    <td>12:00 AM</td>
                    <td>Laredo, TX</td>
                    <td>04h 20m</td>
                    <td>Daily reset complete.</td>
                  </tr>
                  <tr>
                    <td><span className="bullet-dot bg-grey"></span> SLEEPER</td>
                    <td>04:20 AM</td>
                    <td>Laredo, TX</td>
                    <td>02h 10m</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>

              {/* Floating Plus action button */}
              <button className="floating-action-button-table"><FiPlus /></button>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};

export default ELDLogsPage;
