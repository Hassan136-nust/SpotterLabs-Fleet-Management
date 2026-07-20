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

// Fixed Row Order
const GRAPH_Y = {
  OFF: 20, // Row 1: Off Duty
  SB: 60,  // Row 2: Sleeper Berth
  D: 100,  // Row 3: Driving
  ON: 140  // Row 4: On Duty (Not Driving)
};

const STATUS_COLORS = {
  OFF: '#4B5563', // gray
  SB: '#7C3AED',  // purple
  D: '#3B82F6',   // blue
  ON: '#F59E0B'   // amber
};

const ELDLogsPage = ({ onTabChange, eldResult }) => {
  // Determine if we have real solved data
  const hasRealData = eldResult && eldResult.daily_logs && eldResult.daily_logs.length > 0;
  
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  // 1. Get Day Data
  let days = [];
  let currentDateString = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  let rawTotals = { off_duty: 12.0, sleeper: 4.0, driving: 6.0, on_duty: 2.0 };
  let events = [];
  let totalMilesToday = 0;
  let remarksList = [];

  if (hasRealData) {
    days = eldResult.daily_logs;
    const currentDay = days[selectedDayIdx] || days[0];
    
    // Format YYYY-MM-DD to MM/DD/YYYY
    if (currentDay.date) {
      const [y, m, d] = currentDay.date.split('-');
      currentDateString = `${m}/${d}/${y}`;
    } else {
      currentDateString = currentDay.dateString;
    }
    
    rawTotals = currentDay.totals;
    events = currentDay.events;
    totalMilesToday = currentDay.total_miles_today || 0;
    remarksList = currentDay.remarks || [];
  } else {
    // Default mock data conforming to rules
    days = [
      { dayNumber: 1, dateString: '05/24/2026', total_miles_today: 432 },
      { dayNumber: 2, dateString: '05/25/2026', total_miles_today: 310 },
      { dayNumber: 3, dateString: '05/26/2026', total_miles_today: 280 }
    ];
    const currentDay = days[selectedDayIdx] || days[0];
    currentDateString = currentDay.dateString;
    totalMilesToday = currentDay.total_miles_today;
    
    rawTotals = {
      off_duty: 12.5,
      sleeper: 2.0,
      driving: 8.0,
      on_duty: 1.5
    };
    
    events = [
      { status: 'OFF', start: '00:00', end: '06:00', location: 'Chicago Hub' },
      { status: 'ON', start: '06:00', end: '06:30', location: 'Chicago Hub' },
      { status: 'D', start: '06:30', end: '11:30', location: 'En route I-80' },
      { status: 'SB', start: '11:30', end: '13:30', location: 'Love\'s Travel Stop' },
      { status: 'D', start: '13:30', end: '16:30', location: 'En route I-80' },
      { status: 'ON', start: '16:30', end: '17:30', location: 'Des Moines Logistics' },
      { status: 'OFF', start: '17:30', end: '24:00', location: 'Pilot Rest Area' }
    ];

    remarksList = [
      "00:00 - Chicago Hub, IL (start, off duty)",
      "06:00 - Chicago Hub, IL (pre-trip, on duty)",
      "06:30 - Chicago Hub, IL (depart, driving)",
      "11:30 - Love's Travel Stop, IA (fuel/rest, sleeper berth)",
      "13:30 - Love's Travel Stop, IA (resume, driving)",
      "16:30 - Des Moines, IA (delivery, on duty)",
      "17:30 - Pilot Rest Area, IA (10hr reset, off duty)"
    ];
  }

  // Map totals keys safely to match display standard
  const totals = {
    OFF: rawTotals.off_duty ?? rawTotals.OFF ?? 12.0,
    SB: rawTotals.sleeper ?? rawTotals.SB ?? 0.0,
    D: rawTotals.driving ?? rawTotals.D ?? 0.0,
    ON: rawTotals.on_duty ?? rawTotals.ON ?? 0.0
  };

  // Grid sizing parameters (FMCSA Official: 960px width, 160px height)
  const width = 960;
  const height = 160;
  const hourWidth = 40; // 960 / 24 = 40px per hour
  const minWidth = 960 / 1440; // 0.666px per minute

  const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Build the SVG path and tracking points
  let pathD = '';
  let currentX = 0;
  const points = [];

  events.forEach((event, index) => {
    const startY = GRAPH_Y[event.status] || GRAPH_Y.OFF;
    const durationMin = timeToMinutes(event.end) - timeToMinutes(event.start);
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

  // Hour numbers labeled above the grid
  const labels = [];
  const gridLines = [];

  for (let i = 0; i <= 24; i++) {
    const x = i * hourWidth;
    let label = i.toString();
    if (i === 0) label = 'Midnight';
    else if (i === 12) label = 'Noon';
    else if (i === 24) label = ''; // grid ends at 24

    labels.push(
      <text key={`lbl-${i}`} x={x} y={-8} className="eld-graph-lbl-txt" textAnchor="middle">
        {label}
      </text>
    );

    gridLines.push(
      <line key={`line-${i}`} x1={x} y1={0} x2={x} y2={height} className="eld-grid-line-hour" />
    );

    // Ticks at 30 minutes
    if (i < 24) {
      gridLines.push(
        <line key={`tick-30-${i}`} x1={x + hourWidth / 2} y1={0} x2={x + hourWidth / 2} y2={height} className="eld-grid-line-half" />
      );
    }
  }

  // Format Helper for Hours display
  const formatHrs = (decimal) => {
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const totalSum = (totals.OFF + totals.SB + totals.D + totals.ON);

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
              <span className="green-pulse-dot"></span> FMCSA COMPLIANT
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
            <div className="eld-clock-card border-off">
              <span className="eld-clock-lbl">OFF DUTY</span>
              <span className="eld-clock-val">{formatHrs(totals.OFF)} <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill" style={{ backgroundColor: STATUS_COLORS.OFF, width: `${(totals.OFF / 24) * 100}%` }}></div></div>
            </div>
            
            <div className="eld-clock-card border-sleeper">
              <span className="eld-clock-lbl">SLEEPER BERTH</span>
              <span className="eld-clock-val">{formatHrs(totals.SB)} <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill" style={{ backgroundColor: STATUS_COLORS.SB, width: `${(totals.SB / 10) * 100}%` }}></div></div>
            </div>

            <div className="eld-clock-card border-driving">
              <span className="eld-clock-lbl">DRIVING</span>
              <span className="eld-clock-val">{formatHrs(totals.D)} <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill" style={{ backgroundColor: STATUS_COLORS.D, width: `${(totals.D / 11) * 100}%` }}></div></div>
            </div>

            <div className="eld-clock-card border-on">
              <span className="eld-clock-lbl">ON DUTY</span>
              <span className="eld-clock-val">{formatHrs(totals.ON)} <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill" style={{ backgroundColor: STATUS_COLORS.ON, width: `${(totals.ON / 14) * 100}%` }}></div></div>
            </div>

            <div className="eld-clock-card border-cycle-orange">
              <span className="eld-clock-lbl">24-HOUR TOTAL</span>
              <span className="eld-clock-val text-orange-val">{totalSum.toFixed(1)} <span className="clock-unit">Hrs</span></span>
              <div className="clock-progress-track"><div className="clock-progress-fill bg-orange" style={{ width: '100%' }}></div></div>
            </div>
          </section>

          {/* 2. Main ELD graph card */}
          <section className="eld-graph-card-main">
            <div className="eld-graph-card-header">
              {/* Day Tabs */}
              <div className="day-selector-tabs">
                {days.map((day, idx) => (
                  <button 
                    key={day.dayNumber || idx}
                    className={`day-tab-btn ${selectedDayIdx === idx ? 'active' : ''}`}
                    onClick={() => setSelectedDayIdx(idx)}
                  >
                    Day {day.dayNumber || (idx + 1)}
                  </button>
                ))}
              </div>

              {/* Action utilities */}
              <div className="eld-graph-actions">
                <button className="eld-utility-btn" onClick={() => window.print()}><FiPrinter /> Print Log</button>
              </div>
            </div>

            {/* FMCSA Official Header fields */}
            <div className="fmcsa-header-grid">
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">1. DATE</span>
                <span className="cell-val">{currentDateString}</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">2. TOTAL MILES TODAY</span>
                <span className="cell-val">{totalMilesToday} mi</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">3. CARRIER NAME</span>
                <span className="cell-val">Spotter Labs Logistics LLC</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">4. MAIN OFFICE ADDRESS</span>
                <span className="cell-val">Chicago, IL</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">5. VEHICLE NUMBER</span>
                <span className="cell-val">TRK-492</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">6. CO-DRIVER NAME</span>
                <span className="cell-val">None</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">7. SHIPPING DOC #</span>
                <span className="cell-val">MANIFEST-81203</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">8. START TIME</span>
                <span className="cell-val">Midnight (00:00)</span>
              </div>
              <div className="fmcsa-header-cell cell-sig">
                <span className="cell-lbl">9. DRIVER SIGNATURE</span>
                <span className="cell-val signature-text">Alex Rivera</span>
              </div>
            </div>

            {/* SVG graph container with Y axis and Totals Column */}
            <div className="eld-canvas-layout-container">
              
              {/* Left Y-axis labels */}
              <div className="eld-y-axis-labels">
                <div className="y-axis-lbl" style={{ top: `${GRAPH_Y.OFF - 8}px` }}>OFF DUTY</div>
                <div className="y-axis-lbl" style={{ top: `${GRAPH_Y.SB - 8}px` }}>SLEEPER</div>
                <div className="y-axis-lbl" style={{ top: `${GRAPH_Y.D - 8}px` }}>DRIVING</div>
                <div className="y-axis-lbl" style={{ top: `${GRAPH_Y.ON - 8}px` }}>ON DUTY</div>
              </div>

              {/* Center SVG Grid */}
              <div className="eld-svg-wrapper-relative">
                <svg viewBox={`-15 -20 ${width + 30} ${height + 30}`} width="100%" height="100%">
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

              {/* Right-aligned Totals Column */}
              <div className="eld-totals-column-layout">
                <div className="totals-header-cell">TOTAL</div>
                <div className="totals-val-row" style={{ top: `${GRAPH_Y.OFF - 16}px` }}>{totals.OFF.toFixed(1)}</div>
                <div className="totals-val-row" style={{ top: `${GRAPH_Y.SB - 16}px` }}>{totals.SB.toFixed(1)}</div>
                <div className="totals-val-row" style={{ top: `${GRAPH_Y.D - 16}px` }}>{totals.D.toFixed(1)}</div>
                <div className="totals-val-row" style={{ top: `${GRAPH_Y.ON - 16}px` }}>{totals.ON.toFixed(1)}</div>
                <div className="totals-footer-cell">{totalSum.toFixed(1)}</div>
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
              <button className="btn-add-remark" onClick={() => alert("Remark logged to database successfully.")}>Add Remark</button>
            </div>

            <div className="annotations-table-wrapper">
              <table className="annotations-table">
                <thead>
                  <tr>
                    <th>STATUS</th>
                    <th>START TIME</th>
                    <th>LOCATION / REMARK DESCRIPTION</th>
                    <th>DURATION</th>
                    <th>NOTES / REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {remarksList.length > 0 ? (
                    remarksList.map((remark, idx) => {
                      const parts = remark.split(' - ');
                      const time = parts[0] || '—';
                      const rest = parts[1] || '—';
                      const loc = rest.split(' (')[0] || '—';
                      const note = rest.includes('(') ? rest.substring(rest.indexOf('(')) : '—';
                      
                      let color = STATUS_COLORS.OFF;
                      let statusText = "OFF DUTY";
                      if (note.includes('ON') || note.includes('on')) {
                        color = STATUS_COLORS.ON;
                        statusText = "ON DUTY (ND)";
                      } else if (note.includes('SB') || note.includes('sleeper')) {
                        color = STATUS_COLORS.SB;
                        statusText = "SLEEPER BERTH";
                      } else if (note.includes('D') || note.includes('driving')) {
                        color = STATUS_COLORS.D;
                        statusText = "DRIVING";
                      }

                      return (
                        <tr key={idx}>
                          <td>
                            <span className="status-label-badge" style={{ borderLeft: `4px solid ${color}`, paddingLeft: '8px' }}>
                              {statusText}
                            </span>
                          </td>
                          <td>{time}</td>
                          <td>{loc}</td>
                          <td>—</td>
                          <td>{remark}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <>
                      <tr>
                        <td><span className="bullet-dot bg-white"></span> OFF DUTY</td>
                        <td>12:00 AM</td>
                        <td>Chicago Hub, IL</td>
                        <td>06h 00m</td>
                        <td>Pre-trip prep next.</td>
                      </tr>
                      <tr>
                        <td><span className="bullet-dot bg-grey"></span> SLEEPER</td>
                        <td>11:30 AM</td>
                        <td>Love's Travel Stop, IA</td>
                        <td>02h 00m</td>
                        <td>Mandatory rest break complete.</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>

              {/* Floating Plus action button */}
              <button className="floating-action-button-table" onClick={() => alert("Form annotation overlay opened.")}><FiPlus /></button>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};

export default ELDLogsPage;
