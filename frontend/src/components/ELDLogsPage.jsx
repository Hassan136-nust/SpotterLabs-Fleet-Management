import React, { useState, useEffect } from 'react';
import { 
  FiSearch, 
  FiBell,
  FiPrinter, 
  FiFileText,
  FiPlus,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import Sidebar from './Sidebar';
import './ELDLogsPage.css';

// FMCSA Fixed Row Order and Y positioning
// Each row is 40px tall, grid starts at y=0
const HOUR_WIDTH = 40;   // 40px per hour
const ROW_HEIGHT = 40;   // 40px per row
const GRID_WIDTH = 960;  // 24 * 40
const GRID_HEIGHT = 160; // 4 * 40

// Row index 0=OFF, 1=SB, 2=D, 3=ON
const ROW_INDEX = { OFF: 0, SB: 1, D: 2, ON: 3 };
const ROW_LABELS = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty (Not Drv.)'];

const STATUS_COLORS = {
  OFF: '#4B5563', // gray
  SB:  '#7C3AED', // purple
  D:   '#3B82F6', // blue
  ON:  '#F59E0B'  // amber
};

// Convert "HH:MM" or "24:00" to pixel X
function timeToX(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const totalHours = h + m / 60;
  return Math.min(totalHours * HOUR_WIDTH, GRID_WIDTH);
}

// Default FMCSA-compliant mock logs shown before any trip is planned
const defaultMockLogs = [
  {
    dayNumber: 1,
    dateString: '05/24/2026',
    total_miles_today: 432,
    totals: { OFF: 12.5, SB: 2.0, D: 8.0, ON: 1.5 },
    events: [
      { status: 'OFF', start: '00:00', end: '06:00', hours: 6.0,  location: 'Chicago Hub, IL' },
      { status: 'ON',  start: '06:00', end: '06:30', hours: 0.5,  location: 'Chicago Hub, IL' },
      { status: 'D',   start: '06:30', end: '11:30', hours: 5.0,  location: 'En route I-80' },
      { status: 'SB',  start: '11:30', end: '13:30', hours: 2.0,  location: "Love's Travel Stop, IA" },
      { status: 'D',   start: '13:30', end: '16:30', hours: 3.0,  location: 'En route I-80' },
      { status: 'ON',  start: '16:30', end: '17:30', hours: 1.0,  location: 'Des Moines, IA' },
      { status: 'OFF', start: '17:30', end: '24:00', hours: 6.5,  location: 'Pilot Rest Area, IA' },
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
    totals: { OFF: 14.0, SB: 2.0, D: 6.0, ON: 2.0 },
    events: [
      { status: 'OFF', start: '00:00', end: '10:00', hours: 10.0, location: 'Pilot Rest Area, IA' },
      { status: 'ON',  start: '10:00', end: '10:30', hours: 0.5,  location: 'Pilot Rest Area, IA' },
      { status: 'D',   start: '10:30', end: '16:30', hours: 6.0,  location: 'En route I-80' },
      { status: 'ON',  start: '16:30', end: '18:00', hours: 1.5,  location: 'Omaha, NE' },
      { status: 'OFF', start: '18:00', end: '24:00', hours: 6.0,  location: 'Pilot Plaza, Omaha NE' },
    ],
    remarks: [
      "00:00 - Pilot Rest Area, IA (start, off duty)",
      "10:00 - Pilot Rest Area, IA (pre-trip, on duty)",
      "10:30 - Pilot Rest Area, IA (depart, driving)",
      "16:30 - Omaha, NE (unload, on duty)",
      "18:00 - Pilot Plaza, Omaha NE (10hr reset, off duty)"
    ]
  }
];

// ─── FMCSA ELD CANVAS SVG ────────────────────────────────────────────────────
function ELDCanvas({ events }) {
  if (!events || events.length === 0) {
    return (
      <svg viewBox={`-120 -30 ${GRID_WIDTH + 140} ${GRID_HEIGHT + 50}`} width="100%" height="100%">
        <rect x={0} y={0} width={GRID_WIDTH} height={GRID_HEIGHT} fill="#0d0908" />
        <text x={GRID_WIDTH / 2} y={GRID_HEIGHT / 2} textAnchor="middle" fill="#8c7365" fontSize="14">
          No events — generate a trip to see ELD data
        </text>
      </svg>
    );
  }

  // Build colored rectangles (one per event) and vertical drop lines
  const blocks = [];
  const dropLines = [];

  events.forEach((ev, i) => {
    const rowIdx = ROW_INDEX[ev.status] ?? ROW_INDEX.OFF;
    const x1 = timeToX(ev.start);
    const x2 = timeToX(ev.end);
    const y  = rowIdx * ROW_HEIGHT;
    const color = STATUS_COLORS[ev.status] || '#4B5563';

    // Filled status block
    blocks.push(
      <rect
        key={`block-${i}`}
        x={x1}
        y={y}
        width={Math.max(x2 - x1, 0)}
        height={ROW_HEIGHT}
        fill={color}
        opacity={0.85}
      />
    );

    // Vertical drop line at the START of each block (status change marker)
    if (i > 0) {
      const prevRow = ROW_INDEX[events[i - 1].status] ?? 0;
      const curRow  = rowIdx;
      const yTop    = Math.min(prevRow, curRow) * ROW_HEIGHT;
      const yBot    = (Math.max(prevRow, curRow) + 1) * ROW_HEIGHT;
      dropLines.push(
        <line
          key={`drop-${i}`}
          x1={x1} y1={yTop}
          x2={x1} y2={yBot}
          stroke="#ffffff"
          strokeWidth={1.5}
          strokeDasharray="none"
        />
      );
    }
  });

  // Grid hour lines (vertical) + row dividers (horizontal)
  const gridLines = [];
  for (let h = 0; h <= 24; h++) {
    const x = h * HOUR_WIDTH;
    const isMajor = h % 6 === 0;
    gridLines.push(
      <line
        key={`vl-${h}`}
        x1={x} y1={0} x2={x} y2={GRID_HEIGHT}
        stroke={isMajor ? '#4b3228' : '#2b201a'}
        strokeWidth={isMajor ? 1.5 : 0.5}
      />
    );
  }
  for (let r = 0; r <= 4; r++) {
    const y = r * ROW_HEIGHT;
    gridLines.push(
      <line
        key={`hl-${r}`}
        x1={0} y1={y} x2={GRID_WIDTH} y2={y}
        stroke="#2b201a"
        strokeWidth={r === 0 || r === 4 ? 1.5 : 1}
      />
    );
  }

  // Hour labels above grid
  const hourLabels = [];
  for (let h = 0; h <= 23; h++) {
    const x = h * HOUR_WIDTH;
    let label;
    if (h === 0)  label = 'Mid';
    else if (h === 12) label = 'Noon';
    else if (h < 12) label = String(h);
    else label = String(h);
    hourLabels.push(
      <text key={`lbl-${h}`} x={x + HOUR_WIDTH / 2} y={-10} textAnchor="middle" fill="#8c7365" fontSize="9" fontFamily="Inter,system-ui,sans-serif">
        {label}
      </text>
    );
  }

  // Row labels on left
  const rowLabelElems = ROW_LABELS.map((label, i) => (
    <text
      key={`rlbl-${i}`}
      x={-8}
      y={i * ROW_HEIGHT + ROW_HEIGHT / 2 + 4}
      textAnchor="end"
      fill="#b09e95"
      fontSize="9"
      fontFamily="Inter,system-ui,sans-serif"
    >
      {label}
    </text>
  ));

  return (
    <svg viewBox={`-120 -30 ${GRID_WIDTH + 140} ${GRID_HEIGHT + 50}`} width="100%" height="100%" style={{ display: 'block' }}>
      {/* Background */}
      <rect x={0} y={0} width={GRID_WIDTH} height={GRID_HEIGHT} fill="#0d0908" />

      {/* Colored status blocks */}
      {blocks}

      {/* Grid lines on top */}
      {gridLines}

      {/* Vertical drop lines (status changes) */}
      {dropLines}

      {/* Row labels */}
      {rowLabelElems}

      {/* Hour labels */}
      {hourLabels}
    </svg>
  );
}

// ─── MAIN ELD LOGS PAGE ───────────────────────────────────────────────────────
const ELDLogsPage = ({ onTabChange, eldResult }) => {
  const hasRealData = eldResult && eldResult.dailyLogs && eldResult.dailyLogs.length > 0;

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [localLogs, setLocalLogs] = useState(() =>
    hasRealData ? eldResult.dailyLogs : defaultMockLogs
  );

  // Modal state
  const [showModal, setShowModal]               = useState(false);
  const [newRemarkStatus, setNewRemarkStatus]   = useState('OFF');
  const [newRemarkTime, setNewRemarkTime]       = useState('12:00');
  const [newRemarkLocation, setNewRemarkLocation] = useState('');
  const [newRemarkNote, setNewRemarkNote]       = useState('');

  // Sync with real data when trip is planned
  useEffect(() => {
    if (hasRealData) {
      setLocalLogs(eldResult.dailyLogs);
      setSelectedDayIdx(0);
    } else {
      setLocalLogs(defaultMockLogs);
    }
  }, [eldResult]);

  // Current day
  const currentDay = localLogs[selectedDayIdx] || localLogs[0] || null;

  let currentDateString = '—';
  let rawTotals   = { OFF: 0, SB: 0, D: 0, ON: 0 };
  let events      = [];
  let totalMilesToday = 0;
  let remarksList = [];

  if (currentDay) {
    if (currentDay.dateString && currentDay.dateString.includes('-')) {
      const [y, mo, d] = currentDay.dateString.split('-');
      currentDateString = `${mo}/${d}/${y}`;
    } else {
      currentDateString = currentDay.dateString || '—';
    }
    // Support both naming conventions from backend
    const t = currentDay.totals || {};
    rawTotals = {
      OFF: t.OFF ?? t.off_duty ?? 0,
      SB:  t.SB  ?? t.sleeper  ?? 0,
      D:   t.D   ?? t.driving  ?? 0,
      ON:  t.ON  ?? t.on_duty  ?? 0,
    };
    events          = currentDay.events || [];
    totalMilesToday = currentDay.total_miles_today || 0;
    remarksList     = currentDay.remarks || [];
  }

  const totalSum = rawTotals.OFF + rawTotals.SB + rawTotals.D + rawTotals.ON;

  const formatHrs = (decimal) => {
    const h = Math.floor(Math.abs(decimal));
    const m = Math.round((Math.abs(decimal) - h) * 60);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  };

  // Add remark handler — splits an existing event at the given time
  const handleAddRemark = (e) => {
    e.preventDefault();
    const formatRemark = `${newRemarkTime} - ${newRemarkLocation} (${newRemarkStatus}: ${newRemarkNote})`;

    const updated   = [...localLogs];
    const cur       = { ...updated[selectedDayIdx] };
    cur.remarks     = [...(cur.remarks || []), formatRemark];
    updated[selectedDayIdx] = cur;
    setLocalLogs(updated);
    setShowModal(false);
    setNewRemarkLocation('');
    setNewRemarkNote('');
  };

  const prevDay = () => setSelectedDayIdx(i => Math.max(0, i - 1));
  const nextDay = () => setSelectedDayIdx(i => Math.min(localLogs.length - 1, i + 1));

  return (
    <div className="eld-page-layout">
      <Sidebar activeTab="eld-logs" onTabChange={onTabChange} />

      <div className="eld-main-panel">

        {/* Top Navbar */}
        <header className="eld-top-header">
          <div className="eld-title-container">
            <span className="eld-page-header-title">ELD Logs</span>
          </div>
          <div className="eld-search-container">
            <FiSearch className="eld-search-icon" />
            <input type="text" placeholder="Search logs by driver, ID or truck..." className="eld-search-input" />
          </div>
          <div className="eld-hdr-widgets">
            <div className="system-compliant-pill">
              <span className="green-pulse-dot"></span> FMCSA COMPLIANT
            </div>
            <div className="eld-user-widget-detailed">
              <div className="eld-user-info">
                <span className="eld-username">Alex Rivera</span>
                <span className="eld-user-role">ID: #44920</span>
              </div>
              <div className="eld-avatar-circle">AR</div>
            </div>
          </div>
        </header>

        <div className="eld-content-viewport">

          {/* ── Clocks strip ── */}
          <section className="eld-clocks-strip-grid">
            {[
              { lbl: 'OFF DUTY',      val: rawTotals.OFF, max: 24, color: STATUS_COLORS.OFF },
              { lbl: 'SLEEPER BERTH', val: rawTotals.SB,  max: 10, color: STATUS_COLORS.SB  },
              { lbl: 'DRIVING',       val: rawTotals.D,   max: 11, color: STATUS_COLORS.D   },
              { lbl: 'ON DUTY (ND)',  val: rawTotals.ON,  max: 14, color: STATUS_COLORS.ON  },
              { lbl: '24-HR TOTAL',   val: totalSum,      max: 24, color: '#ff6b00'         },
            ].map(({ lbl, val, max, color }) => (
              <div key={lbl} className="eld-clock-card" style={{ borderLeft: `3px solid ${color}` }}>
                <span className="eld-clock-lbl">{lbl}</span>
                <span className="eld-clock-val">{formatHrs(val)} <span className="clock-unit">Hrs</span></span>
                <div className="clock-progress-track">
                  <div className="clock-progress-fill" style={{ backgroundColor: color, width: `${Math.min((val / max) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </section>

          {/* ── FMCSA Log Sheet Card ── */}
          <section className="eld-graph-card-main">

            {/* Card header: day nav + date + print */}
            <div className="eld-graph-card-header">
              <div className="day-selector-tabs">
                <button className="day-nav-btn" onClick={prevDay} disabled={selectedDayIdx === 0}>
                  <FiChevronLeft />
                </button>
                {localLogs.map((day, idx) => (
                  <button
                    key={idx}
                    className={`day-tab-btn ${selectedDayIdx === idx ? 'active' : ''}`}
                    onClick={() => setSelectedDayIdx(idx)}
                  >
                    Day {day.dayNumber || idx + 1}
                  </button>
                ))}
                <button className="day-nav-btn" onClick={nextDay} disabled={selectedDayIdx === localLogs.length - 1}>
                  <FiChevronRight />
                </button>
              </div>
              <div className="eld-graph-actions">
                <button className="eld-utility-btn" onClick={() => window.print()}>
                  <FiPrinter /> Print Log
                </button>
              </div>
            </div>

            {/* FMCSA Official Header fields */}
            <div className="fmcsa-header-grid">
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">DATE</span>
                <span className="cell-val">{currentDateString}</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">TOTAL MILES TODAY</span>
                <span className="cell-val">{totalMilesToday} mi</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">CARRIER NAME</span>
                <span className="cell-val">Spotter Labs Logistics LLC</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">MAIN OFFICE</span>
                <span className="cell-val">Chicago, IL</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">VEHICLE NUMBER</span>
                <span className="cell-val">TRK-492</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">CO-DRIVER</span>
                <span className="cell-val">None</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">SHIPPING DOC #</span>
                <span className="cell-val">MANIFEST-81203</span>
              </div>
              <div className="fmcsa-header-cell">
                <span className="cell-lbl">START TIME</span>
                <span className="cell-val">Midnight (00:00)</span>
              </div>
              <div className="fmcsa-header-cell cell-sig">
                <span className="cell-lbl">DRIVER SIGNATURE</span>
                <span className="cell-val signature-text">Alex Rivera</span>
              </div>
            </div>

            {/* ── FMCSA Grid + Totals ── */}
            <div className="eld-canvas-layout-container">
              {/* SVG Canvas */}
              <div className="eld-svg-wrapper-relative">
                <ELDCanvas events={events} />
              </div>

              {/* Right totals column */}
              <div className="eld-totals-right-col">
                <div className="totals-right-header">HRS</div>
                {[
                  { label: 'Off Duty',    val: rawTotals.OFF },
                  { label: 'Sleeper',     val: rawTotals.SB  },
                  { label: 'Driving',     val: rawTotals.D   },
                  { label: 'On Duty (ND)',val: rawTotals.ON  },
                ].map(({ label, val }) => (
                  <div key={label} className="totals-right-row">
                    <span className="totals-right-label">{label}</span>
                    <span className="totals-right-val">{val.toFixed(1)}</span>
                  </div>
                ))}
                <div className="totals-right-footer">
                  <span className="totals-right-label">TOTAL</span>
                  <span className="totals-right-val" style={{ color: Math.abs(totalSum - 24) < 0.1 ? '#10b981' : '#ef4444' }}>
                    {totalSum.toFixed(1)} {Math.abs(totalSum - 24) < 0.1 ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary strip */}
            <div className="eld-graph-summaries-strip">
              <div className="summary-col"><span className="summary-lbl">Total OFF</span><span className="summary-val">{formatHrs(rawTotals.OFF)}</span></div>
              <div className="summary-col"><span className="summary-lbl">Total SB</span><span className="summary-val">{formatHrs(rawTotals.SB)}</span></div>
              <div className="summary-col"><span className="summary-lbl">Total DR</span><span className="summary-val text-orange">{formatHrs(rawTotals.D)}</span></div>
              <div className="summary-col"><span className="summary-lbl">Total ON</span><span className="summary-val text-blue">{formatHrs(rawTotals.ON)}</span></div>
            </div>
          </section>

          {/* ── Remarks & Annotations ── */}
          <section className="eld-annotations-card-large">
            <div className="annotations-header">
              <div className="annotations-title-widget">
                <FiFileText className="annotations-icon" />
                <h3>Log Details &amp; Annotations</h3>
              </div>
              <button className="btn-add-remark" onClick={() => setShowModal(true)}>+ Add Remark</button>
            </div>

            <div className="annotations-table-wrapper">
              <table className="annotations-table">
                <thead>
                  <tr>
                    <th>STATUS</th>
                    <th>START</th>
                    <th>END</th>
                    <th>LOCATION</th>
                    <th>HOURS</th>
                    <th>REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length > 0 ? (
                    events.map((ev, idx) => (
                      <tr key={idx}>
                        <td>
                          <span
                            className="status-label-badge"
                            style={{ borderLeft: `4px solid ${STATUS_COLORS[ev.status] || '#4B5563'}`, paddingLeft: '8px' }}
                          >
                            {{ OFF: 'OFF DUTY', SB: 'SLEEPER BERTH', D: 'DRIVING', ON: 'ON DUTY (ND)' }[ev.status] || ev.status}
                          </span>
                        </td>
                        <td>{ev.start || '—'}</td>
                        <td>{ev.end   || '—'}</td>
                        <td>{ev.location || '—'}</td>
                        <td>{(ev.hours || 0).toFixed(2)} h</td>
                        <td>{remarksList.find(r => r.startsWith(ev.start)) || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#8c7365', padding: '32px' }}>
                        No log data — plan a trip on the Trip Planner page first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <button className="floating-action-button-table" onClick={() => setShowModal(true)}>
                <FiPlus />
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* ── Add Remark Modal ── */}
      {showModal && (
        <div className="eld-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="eld-modal-container">
            <h3 className="modal-title">Add HOS Log Remark</h3>
            <form onSubmit={handleAddRemark}>
              <div className="modal-form-group">
                <label>STATUS TYPE</label>
                <select value={newRemarkStatus} onChange={e => setNewRemarkStatus(e.target.value)}>
                  <option value="OFF">OFF DUTY</option>
                  <option value="SB">SLEEPER BERTH</option>
                  <option value="D">DRIVING</option>
                  <option value="ON">ON DUTY (ND)</option>
                </select>
              </div>
              <div className="modal-form-group">
                <label>TIME (HH:MM)</label>
                <input type="time" value={newRemarkTime} onChange={e => setNewRemarkTime(e.target.value)} required />
              </div>
              <div className="modal-form-group">
                <label>LOCATION (City, State)</label>
                <input type="text" placeholder="e.g. Des Moines, IA" value={newRemarkLocation} onChange={e => setNewRemarkLocation(e.target.value)} required />
              </div>
              <div className="modal-form-group">
                <label>NOTES / REMARKS</label>
                <input type="text" placeholder="e.g. Fuel stop" value={newRemarkNote} onChange={e => setNewRemarkNote(e.target.value)} required />
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
