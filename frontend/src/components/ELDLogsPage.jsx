import React, { useState, useEffect } from 'react';
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

// Default Mock Logs (FMCSA compliant)
const defaultMockLogs = [
  {
    dayNumber: 1,
    dateString: '05/24/2026',
    total_miles_today: 432,
    totals: { off_duty: 12.5, sleeper: 2.0, driving: 8.0, on_duty: 1.5 },
    intervals: [
      { status: 'OFF', durationMin: 360 }, // 12:00 AM - 06:00 AM
      { status: 'ON', durationMin: 30 },   // 06:00 AM - 06:30 AM
      { status: 'D', durationMin: 300 },    // 06:30 AM - 11:30 AM
      { status: 'SB', durationMin: 120 },   // 11:30 AM - 01:30 PM
      { status: 'D', durationMin: 180 },    // 01:30 PM - 04:30 PM
      { status: 'ON', durationMin: 60 },    // 04:30 PM - 05:30 PM
      { status: 'OFF', durationMin: 390 }   // 05:30 PM - 12:00 AM
    ],
    remarks: [
      "00:00 - Chicago Hub, IL (start, off duty)",
      "06:00 - Chicago Hub, IL (pre-trip, on duty)",
      "06:30 - Chicago Hub, IL (depart, driving)",
      "11:30 - Love's Travel Stop, IA (fuel/rest, sleeper berth)",
      "13:30 - Love's Travel Stop, IA (resume, driving)",
      "16:30 - Des Moines, IA (delivery, on duty)",
      "17:30 - Pilot Rest Area, IA (10hr reset, off duty)"
    ]
  },
  {
    dayNumber: 2,
    dateString: '05/25/2026',
    total_miles_today: 310,
    totals: { off_duty: 14.0, sleeper: 2.0, driving: 6.0, on_duty: 2.0 },
    intervals: [
      { status: 'OFF', durationMin: 600 }, // 12:00 AM - 10:00 AM
      { status: 'ON', durationMin: 30 },   // 10:00 AM - 10:30 AM
      { status: 'D', durationMin: 360 },    // 10:30 AM - 04:30 PM
      { status: 'ON', durationMin: 90 },    // 04:30 PM - 06:00 PM
      { status: 'OFF', durationMin: 360 }   // 06:00 PM - 12:00 AM
    ],
    remarks: [
      "00:00 - Pilot Rest Area, IA (start, off duty)",
      "10:00 - Pilot Rest Area, IA (pre-trip, on duty)",
      "10:30 - Pilot Rest Area, IA (depart, driving)",
      "16:30 - Omaha, NE (unload, on duty)",
      "18:00 - Pilot Plaza Omaha, NE (10hr reset, off duty)"
    ]
  }
];

const ELDLogsPage = ({ onTabChange, eldResult }) => {
  const hasRealData = eldResult && eldResult.dailyLogs && eldResult.dailyLogs.length > 0;
  
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [localLogs, setLocalLogs] = useState(() => {
    if (eldResult && eldResult.dailyLogs && eldResult.dailyLogs.length > 0) {
      return eldResult.dailyLogs;
    }
    return defaultMockLogs;
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newRemarkStatus, setNewRemarkStatus] = useState('OFF');
  const [newRemarkTime, setNewRemarkTime] = useState('12:00');
  const [newRemarkLocation, setNewRemarkLocation] = useState('');
  const [newRemarkNote, setNewRemarkNote] = useState('');

  // Sync state with props changes
  useEffect(() => {
    if (hasRealData) {
      setLocalLogs(eldResult.dailyLogs);
    } else {
      setLocalLogs(defaultMockLogs);
    }
  }, [eldResult, hasRealData]);

  // Active day calculations
  const currentDay = localLogs[selectedDayIdx] || (localLogs.length > 0 ? localLogs[0] : null);
  
  let currentDateString = '—';
  let rawTotals = { off_duty: 12.0, sleeper: 0.0, driving: 0.0, on_duty: 0.0 };
  let events = [];
  let totalMilesToday = 0;
  let remarksList = [];

  if (currentDay) {
    // Format YYYY-MM-DD to MM/DD/YYYY
    if (currentDay.dateString && currentDay.dateString.includes('-')) {
      const [y, m, d] = currentDay.dateString.split('-');
      currentDateString = `${m}/${d}/${y}`;
    } else {
      currentDateString = currentDay.dateString || '—';
    }
    
    rawTotals = currentDay.totals || {};
    events = currentDay.intervals || [];
    totalMilesToday = currentDay.total_miles_today || 0;
    remarksList = currentDay.remarks || [];
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
                {localLogs.map((day, idx) => (
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
              <button className="btn-add-remark" onClick={() => setShowModal(true)}>Add Remark</button>
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
              <button className="floating-action-button-table" onClick={() => setShowModal(true)}><FiPlus /></button>
            </div>
          </section>

        </div>

      </div>

      {/* Add Remark Modal Dialog overlay */}
      {showModal && (
        <div className="eld-modal-overlay">
          <div className="eld-modal-container">
            <h3 className="modal-title">Add HOS Log Remark</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formatRemark = `${newRemarkTime} - ${newRemarkLocation} (${newRemarkStatus.toUpperCase()}: ${newRemarkNote})`;
              const updated = [...localLogs];
              const cur = { ...updated[selectedDayIdx] };
              cur.remarks = [...(cur.remarks || []), formatRemark];
              
              // Also add a new status segment into intervals to visually update the grid!
              const parseTime = (t) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
              };
              const targetMin = parseTime(newRemarkTime);
              
              // Split and rebuild intervals
              let cumMin = 0;
              const newIntervals = [];
              let added = false;
              
              (cur.intervals || []).forEach(interval => {
                const duration = interval.durationMin || 0;
                if (!added && cumMin + duration >= targetMin) {
                  // Split existing interval
                  const leftDuration = targetMin - cumMin;
                  const rightDuration = (cumMin + duration) - targetMin;
                  
                  if (leftDuration > 0) {
                    newIntervals.push({ status: interval.status, durationMin: leftDuration });
                  }
                  // Insert the new status interval for 30 minutes
                  newIntervals.push({ status: newRemarkStatus, durationMin: Math.min(30, rightDuration > 0 ? rightDuration : 30) });
                  
                  if (rightDuration - 30 > 0) {
                    newIntervals.push({ status: interval.status, durationMin: rightDuration - 30 });
                  }
                  added = true;
                } else {
                  newIntervals.push(interval);
                }
                cumMin += duration;
              });
              
              if (!added) {
                newIntervals.push({ status: newRemarkStatus, durationMin: 30 });
              }
              
              cur.intervals = newIntervals;
              
              // Recalculate totals based on new intervals
              const newTotals = { OFF: 0, SB: 0, D: 0, ON: 0 };
              newIntervals.forEach(intv => {
                newTotals[intv.status] = (newTotals[intv.status] || 0) + (intv.durationMin / 60);
              });
              cur.totals = {
                off_duty: newTotals.OFF,
                sleeper: newTotals.SB,
                driving: newTotals.D,
                on_duty: newTotals.ON
              };
              
              updated[selectedDayIdx] = cur;
              setLocalLogs(updated);
              setShowModal(false);
              setNewRemarkLocation('');
              setNewRemarkNote('');
            }}>
              <div className="modal-form-group">
                <label>STATUS TYPE</label>
                <select value={newRemarkStatus} onChange={(e) => setNewRemarkStatus(e.target.value)}>
                  <option value="OFF">OFF DUTY</option>
                  <option value="SB">SLEEPER BERTH</option>
                  <option value="D">DRIVING</option>
                  <option value="ON">ON DUTY (ND)</option>
                </select>
              </div>

              <div className="modal-form-group">
                <label>START TIME (HH:MM)</label>
                <input 
                  type="time" 
                  value={newRemarkTime} 
                  onChange={(e) => setNewRemarkTime(e.target.value)} 
                  required 
                />
              </div>

              <div className="modal-form-group">
                <label>LOCATION (CITY, STATE)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Des Moines, IA"
                  value={newRemarkLocation} 
                  onChange={(e) => setNewRemarkLocation(e.target.value)} 
                  required 
                />
              </div>

              <div className="modal-form-group">
                <label>REMARKS / NOTES</label>
                <input 
                  type="text" 
                  placeholder="e.g. Routine Fuel Stop"
                  value={newRemarkNote} 
                  onChange={(e) => setNewRemarkNote(e.target.value)} 
                  required 
                />
              </div>

              <div className="modal-actions-row">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-modal-submit">Save Remark</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ELDLogsPage;
