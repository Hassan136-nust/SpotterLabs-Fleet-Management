import React, { useState, useEffect } from 'react';
import { FiSearch, FiBell, FiPrinter, FiFileText, FiPlus, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Sidebar from './Sidebar';
import './ELDLogsPage.css';

/* ═══════════════════════════════════════════════════════════
   FMCSA CONSTANTS
═══════════════════════════════════════════════════════════ */
const HOUR_WIDTH  = 48;    // px per hour — wider for readability
const ROW_HEIGHT  = 44;    // px per status row
const GRID_WIDTH  = HOUR_WIDTH * 24;   // 1152px
const GRID_HEIGHT = ROW_HEIGHT * 4;    // 176px
const LEFT_LABEL  = 110;  // width of left label column (px in SVG units)
const RIGHT_COL   = 60;   // right totals column
const TOP_LABEL   = 28;   // height of hour labels row

// Fixed row order per FMCSA: 0=OFF 1=SB 2=D 3=ON
const ROW_ORDER   = ['OFF', 'SB', 'D', 'ON'];
const ROW_NAMES   = {
  OFF: 'Off Duty',
  SB:  'Sleeper Berth',
  D:   'Driving',
  ON:  'On Duty (Not Drv.)',
};
const STATUS_COLORS = {
  OFF: '#4B5563',
  SB:  '#7C3AED',
  D:   '#3B82F6',
  ON:  '#F59E0B',
};

function timeToX(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return Math.min((h + m / 60) * HOUR_WIDTH, GRID_WIDTH);
}

function fmtHrs(dec) {
  const h = Math.floor(Math.abs(dec));
  const m = Math.round((Math.abs(dec) - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════════════════════
   ELD CANVAS SVG
═══════════════════════════════════════════════════════════ */
function ELDCanvas({ events }) {
  const totalW = LEFT_LABEL + GRID_WIDTH + RIGHT_COL;
  const totalH = TOP_LABEL + GRID_HEIGHT + 2;

  // Compute per-row totals for totals column
  const rowTotals = { OFF: 0, SB: 0, D: 0, ON: 0 };
  if (events) {
    events.forEach(ev => {
      if (ev.start && ev.end && ROW_ORDER.includes(ev.status)) {
        const [sh, sm] = ev.start.split(':').map(Number);
        const [eh, em] = ev.end.split(':').map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        rowTotals[ev.status] = (rowTotals[ev.status] || 0) + Math.max(mins, 0) / 60;
      }
    });
  }
  const totalSum = Object.values(rowTotals).reduce((a, b) => a + b, 0);

  // Hour labels above grid
  const hourLabels = [];
  for (let h = 0; h <= 24; h++) {
    const x = LEFT_LABEL + h * HOUR_WIDTH;
    let label = '';
    if (h === 0)       label = 'Mid';
    else if (h === 12) label = 'Noon';
    else if (h === 24) label = '';
    else               label = String(h);
    hourLabels.push(
      <text key={`hl-${h}`} x={x} y={TOP_LABEL - 6} textAnchor="middle"
        fill="#9ca3af" fontSize="10" fontFamily="Inter,system-ui,sans-serif" fontWeight="600">
        {label}
      </text>
    );
  }

  // Vertical grid lines
  const vLines = [];
  for (let h = 0; h <= 24; h++) {
    const x = LEFT_LABEL + h * HOUR_WIDTH;
    const isMajor = (h % 6 === 0);
    vLines.push(
      <line key={`vl-${h}`} x1={x} y1={TOP_LABEL} x2={x} y2={TOP_LABEL + GRID_HEIGHT}
        stroke={isMajor ? '#374151' : '#1f2937'} strokeWidth={isMajor ? 1.5 : 0.5} />
    );
    // 30-min tick
    if (h < 24) {
      const xh = LEFT_LABEL + h * HOUR_WIDTH + HOUR_WIDTH / 2;
      vLines.push(
        <line key={`vh-${h}`} x1={xh} y1={TOP_LABEL} x2={xh} y2={TOP_LABEL + GRID_HEIGHT}
          stroke="#1a2535" strokeWidth={0.3} strokeDasharray="2,2" />
      );
    }
  }

  // Horizontal row dividers + row labels
  const hLines  = [];
  const rowLbls = [];
  ROW_ORDER.forEach((status, i) => {
    const y = TOP_LABEL + i * ROW_HEIGHT;
    hLines.push(
      <line key={`hl-${i}`} x1={0} y1={y} x2={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} y2={y}
        stroke="#374151" strokeWidth={i === 0 ? 1.5 : 1} />
    );
    // Row label
    rowLbls.push(
      <text key={`rl-${i}`} x={LEFT_LABEL - 8} y={y + ROW_HEIGHT / 2 + 4}
        textAnchor="end" fill="#d1d5db" fontSize="10" fontFamily="Inter,system-ui,sans-serif" fontWeight="700">
        {ROW_NAMES[status]}
      </text>
    );
    // Colored row background (subtle)
    hLines.push(
      <rect key={`rb-${i}`} x={LEFT_LABEL} y={y} width={GRID_WIDTH} height={ROW_HEIGHT}
        fill={STATUS_COLORS[status]} opacity={0.04} />
    );
  });
  // Bottom border
  hLines.push(
    <line key="hl-bot" x1={0} y1={TOP_LABEL + GRID_HEIGHT} x2={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} y2={TOP_LABEL + GRID_HEIGHT}
      stroke="#374151" strokeWidth={1.5} />
  );

  // Status blocks + drop lines
  const blocks    = [];
  const dropLines = [];

  if (events && events.length > 0) {
    events.forEach((ev, i) => {
      const rowIdx = ROW_ORDER.indexOf(ev.status);
      if (rowIdx < 0) return;
      const x1 = LEFT_LABEL + timeToX(ev.start);
      const x2 = LEFT_LABEL + timeToX(ev.end);
      const y  = TOP_LABEL + rowIdx * ROW_HEIGHT;
      const color = STATUS_COLORS[ev.status] || '#4B5563';
      const w = Math.max(x2 - x1, 0);

      // Filled block
      blocks.push(
        <rect key={`blk-${i}`} x={x1} y={y + 2} width={w} height={ROW_HEIGHT - 4}
          fill={color} opacity={0.82} rx={2} />
      );

      // Time label inside block (if wide enough)
      if (w >= 36) {
        blocks.push(
          <text key={`bt-${i}`} x={x1 + w / 2} y={y + ROW_HEIGHT / 2 + 4}
            textAnchor="middle" fill="#ffffff" fontSize="9"
            fontFamily="Inter,system-ui,sans-serif" fontWeight="800" opacity={0.9}>
            {ev.start}–{ev.end}
          </text>
        );
      }

      // Vertical drop line at transition
      if (i > 0) {
        const prevRowIdx = ROW_ORDER.indexOf(events[i - 1].status);
        if (prevRowIdx >= 0 && prevRowIdx !== rowIdx) {
          const yTop = TOP_LABEL + Math.min(prevRowIdx, rowIdx) * ROW_HEIGHT;
          const yBot = TOP_LABEL + (Math.max(prevRowIdx, rowIdx) + 1) * ROW_HEIGHT;
          dropLines.push(
            <line key={`dl-${i}`} x1={x1} y1={yTop} x2={x1} y2={yBot}
              stroke="#ffffff" strokeWidth={2} opacity={0.85} />
          );
        }
      }
    });
  } else {
    // Empty state hint
    blocks.push(
      <text key="empty" x={LEFT_LABEL + GRID_WIDTH / 2} y={TOP_LABEL + GRID_HEIGHT / 2 + 4}
        textAnchor="middle" fill="#6b7280" fontSize="13"
        fontFamily="Inter,system-ui,sans-serif">
        Plan a trip to generate ELD log data
      </text>
    );
  }

  // Totals column (right side)
  const totCells = [];
  // Header
  totCells.push(
    <rect key="tot-hdr-bg" x={LEFT_LABEL + GRID_WIDTH} y={TOP_LABEL} width={RIGHT_COL} height={GRID_HEIGHT} fill="#111827" />,
    <text key="tot-hdr" x={LEFT_LABEL + GRID_WIDTH + RIGHT_COL / 2} y={TOP_LABEL - 8}
      textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="Inter,system-ui,sans-serif" fontWeight="700">
      HOURS
    </text>
  );
  ROW_ORDER.forEach((status, i) => {
    const y = TOP_LABEL + i * ROW_HEIGHT;
    totCells.push(
      <line key={`tl-${i}`} x1={LEFT_LABEL + GRID_WIDTH} y1={y} x2={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} y2={y}
        stroke="#374151" strokeWidth={1} />,
      <text key={`tv-${i}`} x={LEFT_LABEL + GRID_WIDTH + RIGHT_COL / 2} y={y + ROW_HEIGHT / 2 + 4}
        textAnchor="middle" fill="#f9fafb" fontSize="12"
        fontFamily="Inter,system-ui,sans-serif" fontWeight="800">
        {(rowTotals[status] || 0).toFixed(1)}
      </text>
    );
  });
  // Total sum footer
  const sumOk = Math.abs(totalSum - 24) < 0.2;
  totCells.push(
    <line key="tot-sep" x1={LEFT_LABEL + GRID_WIDTH} y1={TOP_LABEL + GRID_HEIGHT} x2={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} y2={TOP_LABEL + GRID_HEIGHT}
      stroke="#374151" strokeWidth={2} />,
    <rect key="tot-foot-bg" x={LEFT_LABEL + GRID_WIDTH} y={TOP_LABEL + GRID_HEIGHT} width={RIGHT_COL} height={22} fill={sumOk ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'} />,
    <text key="tot-sum" x={LEFT_LABEL + GRID_WIDTH + RIGHT_COL / 2} y={TOP_LABEL + GRID_HEIGHT + 15}
      textAnchor="middle" fill={sumOk ? '#10b981' : '#ef4444'} fontSize="11"
      fontFamily="Inter,system-ui,sans-serif" fontWeight="900">
      {totalSum.toFixed(1)} {sumOk ? '✓' : '!'}
    </text>
  );

  // Left border box
  const outerBorder = (
    <rect x={0} y={TOP_LABEL} width={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} height={GRID_HEIGHT}
      fill="none" stroke="#374151" strokeWidth={1.5} />
  );

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH + 24}`}
      width="100%"
      style={{ display: 'block', minHeight: 220 }}
    >
      {/* Grid backgrounds */}
      <rect x={LEFT_LABEL} y={TOP_LABEL} width={GRID_WIDTH} height={GRID_HEIGHT} fill="#0f172a" />

      {/* Row backgrounds + horizontal lines */}
      {hLines}

      {/* Vertical grid lines */}
      {vLines}

      {/* Hour labels */}
      {hourLabels}

      {/* Row labels */}
      {rowLbls}

      {/* Status blocks */}
      {blocks}

      {/* Drop lines */}
      {dropLines}

      {/* Totals column */}
      {totCells}

      {/* Outer border */}
      {outerBorder}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   DEFAULT MOCK DATA
═══════════════════════════════════════════════════════════ */
const defaultMockLogs = [
  {
    dayNumber: 1, dateString: '05/24/2026', total_miles_today: 432,
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
      '00:00 – Chicago Hub, IL (start, off duty)',
      '06:00 – Chicago Hub, IL (pre-trip, on duty)',
      '06:30 – Chicago Hub, IL (depart, driving)',
      "11:30 – Love's Travel Stop, IA (fuel/rest, sleeper berth)",
      '13:30 – En route I-80 (resume, driving)',
      '16:30 – Des Moines, IA (delivery, on duty)',
      '17:30 – Pilot Rest Area, IA (10hr reset, off duty)',
    ],
  },
  {
    dayNumber: 2, dateString: '05/25/2026', total_miles_today: 310,
    totals: { OFF: 14.0, SB: 0.0, D: 6.0, ON: 4.0 },
    events: [
      { status: 'OFF', start: '00:00', end: '10:00', hours: 10.0, location: 'Pilot Rest Area, IA' },
      { status: 'ON',  start: '10:00', end: '10:30', hours: 0.5,  location: 'Pilot Rest Area, IA' },
      { status: 'D',   start: '10:30', end: '16:30', hours: 6.0,  location: 'En route I-80' },
      { status: 'ON',  start: '16:30', end: '18:00', hours: 1.5,  location: 'Omaha, NE' },
      { status: 'OFF', start: '18:00', end: '24:00', hours: 6.0,  location: 'Pilot Plaza, Omaha, NE' },
    ],
    remarks: [
      '00:00 – Pilot Rest Area, IA (start, off duty)',
      '10:00 – Pilot Rest Area, IA (pre-trip, on duty)',
      '10:30 – Pilot Rest Area, IA (depart, driving)',
      '16:30 – Omaha, NE (unload, on duty)',
      '18:00 – Pilot Plaza, Omaha, NE (10hr reset, off duty)',
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
const ELDLogsPage = ({ onTabChange, eldResult, driverInfo, tripPlanState }) => {
  const hasRealData = eldResult?.dailyLogs?.length > 0;

  // Resolve driver display values — real data when provided, fallbacks otherwise
  const di = driverInfo || {};
  const resolvedDriver = {
    name:       di.driverName  || (hasRealData ? '' : 'Alex Rivera'),
    id:         di.driverId    || (hasRealData ? '' : '#44920'),
    truck:      di.truckNumber || (hasRealData ? '—' : 'TRK-492'),
    coDriver:   di.coDriver    || 'None',
    carrier:    di.carrierId   || (hasRealData ? '—' : 'Spotter Labs Logistics LLC'),
    mainOffice: di.mainOffice  || (hasRealData ? '—' : 'Chicago, IL'),
  };
  // Avatar initials from name
  const avatarInitials = resolvedDriver.name
    ? resolvedDriver.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  // Shipping doc from eldResult if present, else show as manifest-{date}
  const shippingDoc = eldResult?.shippingDoc ||
    (hasRealData ? `MFT-${eldResult.dailyLogs[0]?.dateString?.replace(/-/g,'') || '—'}` : 'MANIFEST-81203');

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [localLogs, setLocalLogs] = useState(() =>
    hasRealData ? eldResult.dailyLogs : defaultMockLogs
  );
  const [showModal, setShowModal]                   = useState(false);
  const [newRemarkStatus, setNewRemarkStatus]       = useState('OFF');
  const [newRemarkTime, setNewRemarkTime]           = useState('12:00');
  const [newRemarkLocation, setNewRemarkLocation]   = useState('');
  const [newRemarkNote, setNewRemarkNote]           = useState('');

  useEffect(() => {
    setLocalLogs(hasRealData ? eldResult.dailyLogs : defaultMockLogs);
    setSelectedDayIdx(0);
  }, [eldResult]);

  const currentDay = localLogs[Math.min(selectedDayIdx, localLogs.length - 1)] || null;

  let currentDateString = '—';
  let totals   = { OFF: 0, SB: 0, D: 0, ON: 0 };
  let events   = [];
  let miles    = 0;
  let remarks  = [];

  if (currentDay) {
    if (currentDay.dateString?.includes('-')) {
      const [y, mo, d] = currentDay.dateString.split('-');
      currentDateString = `${mo}/${d}/${y}`;
    } else {
      currentDateString = currentDay.dateString || '—';
    }
    const t = currentDay.totals || {};
    totals = {
      OFF: t.OFF ?? t.off_duty ?? 0,
      SB:  t.SB  ?? t.sleeper  ?? 0,
      D:   t.D   ?? t.driving  ?? 0,
      ON:  t.ON  ?? t.on_duty  ?? 0,
    };
    events  = currentDay.events || [];
    miles   = currentDay.total_miles_today || 0;
    remarks = currentDay.remarks || [];
  }

  const totalHrs = totals.OFF + totals.SB + totals.D + totals.ON;

  const handleAddRemark = (e) => {
    e.preventDefault();
    const entry = `${newRemarkTime} – ${newRemarkLocation} (${newRemarkStatus}: ${newRemarkNote})`;
    const updated = [...localLogs];
    const cur = { ...updated[selectedDayIdx] };
    cur.remarks = [...(cur.remarks || []), entry];
    updated[selectedDayIdx] = cur;
    setLocalLogs(updated);
    setShowModal(false);
    setNewRemarkLocation('');
    setNewRemarkNote('');
  };

  const STATUS_FULL_NAMES = { OFF: 'OFF DUTY', SB: 'SLEEPER BERTH', D: 'DRIVING', ON: 'ON DUTY (ND)' };

  return (
    <div className="eld-page-layout">
      <Sidebar activeTab="eld-logs" onTabChange={onTabChange} />

      <div className="eld-main-panel">

        {/* ── Topbar ── */}
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
              <span className="green-pulse-dot" /> FMCSA COMPLIANT
            </div>
            <div className="eld-user-widget-detailed">
              <div className="eld-user-info">
                <span className="eld-username">{resolvedDriver.name || 'Driver'}</span>
                <span className="eld-user-role">{resolvedDriver.id ? `ID: ${resolvedDriver.id}` : 'No ID set'}</span>
              </div>
              <div className="eld-avatar-circle">{avatarInitials}</div>
            </div>
          </div>
        </header>

        <div className="eld-content-viewport">

          {/* ── HOS Status Cards ── */}
          <section className="eld-clocks-strip-grid">
            {[
              { lbl: 'OFF DUTY',       val: totals.OFF, max: 24, color: STATUS_COLORS.OFF },
              { lbl: 'SLEEPER BERTH',  val: totals.SB,  max: 10, color: STATUS_COLORS.SB  },
              { lbl: 'DRIVING',        val: totals.D,   max: 11, color: STATUS_COLORS.D   },
              { lbl: 'ON DUTY (ND)',   val: totals.ON,  max: 14, color: STATUS_COLORS.ON  },
              { lbl: '24-HR TOTAL',    val: totalHrs,   max: 24, color: '#ff6b00'         },
            ].map(({ lbl, val, max, color }) => (
              <div key={lbl} className="eld-clock-card" style={{ borderLeft: `3px solid ${color}` }}>
                <span className="eld-clock-lbl">{lbl}</span>
                <span className="eld-clock-val">{fmtHrs(val)} <span className="clock-unit">Hrs</span></span>
                <div className="clock-progress-track">
                  <div className="clock-progress-fill" style={{ backgroundColor: color, width: `${Math.min((val / max) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </section>

          {/* ── Log Sheet Card ── */}
          <section className="eld-graph-card-main">

            {/* Card header */}
            <div className="eld-graph-card-header">
              <div className="day-selector-tabs">
                <button className="day-nav-btn" onClick={() => setSelectedDayIdx(i => Math.max(0, i - 1))} disabled={selectedDayIdx === 0}>
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
                <button className="day-nav-btn" onClick={() => setSelectedDayIdx(i => Math.min(localLogs.length - 1, i + 1))} disabled={selectedDayIdx === localLogs.length - 1}>
                  <FiChevronRight />
                </button>
              </div>
              <button className="eld-utility-btn" onClick={() => window.print()}>
                <FiPrinter /> Print
              </button>
            </div>

            {/* FMCSA Header fields — all from real data */}
            <div className="fmcsa-header-grid">
              {[
                ['DATE',             currentDateString],
                ['TOTAL MILES TODAY', `${miles} mi`],
                ['CARRIER NAME',      resolvedDriver.carrier],
                ['MAIN OFFICE',       resolvedDriver.mainOffice],
                ['VEHICLE NUMBER',    resolvedDriver.truck],
                ['CO-DRIVER',         resolvedDriver.coDriver],
                ['SHIPPING DOC #',    shippingDoc],
                ['24HR START TIME',   'Midnight (00:00)'],
              ].map(([lbl, val]) => (
                <div key={lbl} className="fmcsa-header-cell">
                  <span className="cell-lbl">{lbl}</span>
                  <span className="cell-val">{val || '—'}</span>
                </div>
              ))}
              <div className="fmcsa-header-cell cell-sig">
                <span className="cell-lbl">DRIVER SIGNATURE</span>
                <span className="cell-val signature-text">{resolvedDriver.name || '—'}</span>
              </div>
            </div>

            {/* ELD CANVAS */}
            <div className="eld-canvas-wrapper">
              <ELDCanvas events={events} />
            </div>

            {/* Legend */}
            <div className="eld-legend-row">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="eld-legend-item">
                  <span className="eld-legend-dot" style={{ backgroundColor: color }} />
                  <span className="eld-legend-lbl">{ROW_NAMES[status]}</span>
                </div>
              ))}
            </div>

            {/* Hourly summary */}
            <div className="eld-graph-summaries-strip">
              {[['Total OFF', fmtHrs(totals.OFF), ''], ['Total SB', fmtHrs(totals.SB), ''], ['Total DR', fmtHrs(totals.D), 'text-orange'], ['Total ON', fmtHrs(totals.ON), 'text-blue']].map(([lbl, val, cls]) => (
                <div key={lbl} className="summary-col">
                  <span className="summary-lbl">{lbl}</span>
                  <span className={`summary-val ${cls}`}>{val}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Remarks & Events Table ── */}
          <section className="eld-annotations-card-large">
            <div className="annotations-header">
              <div className="annotations-title-widget">
                <FiFileText className="annotations-icon" />
                <h3>Log Details &amp; Remarks</h3>
              </div>
              <button className="btn-add-remark" onClick={() => setShowModal(true)}>+ Add Remark</button>
            </div>

            {/* Remarks list */}
            {remarks.length > 0 && (
              <div className="eld-remarks-list">
                {remarks.map((r, i) => (
                  <div key={i} className="eld-remark-row">
                    <span className="remark-bullet">▸</span>
                    <span className="remark-text">{r}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="annotations-table-wrapper">
              <table className="annotations-table">
                <thead>
                  <tr>
                    <th>STATUS</th>
                    <th>START</th>
                    <th>END</th>
                    <th>DURATION</th>
                    <th>LOCATION</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length > 0 ? events.map((ev, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="status-label-badge" style={{ borderLeft: `4px solid ${STATUS_COLORS[ev.status] || '#4B5563'}`, paddingLeft: 8 }}>
                          {STATUS_FULL_NAMES[ev.status] || ev.status}
                        </span>
                      </td>
                      <td className="mono">{ev.start || '—'}</td>
                      <td className="mono">{ev.end   || '—'}</td>
                      <td className="mono">{fmtHrs(ev.hours || 0)}</td>
                      <td>{ev.location || '—'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: 32 }}>
                        No log events — plan a trip first.
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
        <div className="eld-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="eld-modal-container">
            <h3 className="modal-title">Add HOS Remark</h3>
            <form onSubmit={handleAddRemark}>
              <div className="modal-form-group">
                <label>STATUS</label>
                <select value={newRemarkStatus} onChange={e => setNewRemarkStatus(e.target.value)}>
                  <option value="OFF">Off Duty</option>
                  <option value="SB">Sleeper Berth</option>
                  <option value="D">Driving</option>
                  <option value="ON">On Duty (ND)</option>
                </select>
              </div>
              <div className="modal-form-group">
                <label>TIME</label>
                <input type="time" value={newRemarkTime} onChange={e => setNewRemarkTime(e.target.value)} required />
              </div>
              <div className="modal-form-group">
                <label>LOCATION</label>
                <input type="text" placeholder="City, State" value={newRemarkLocation} onChange={e => setNewRemarkLocation(e.target.value)} required />
              </div>
              <div className="modal-form-group">
                <label>NOTES</label>
                <input type="text" placeholder="e.g. Fuel stop" value={newRemarkNote} onChange={e => setNewRemarkNote(e.target.value)} required />
              </div>
              <div className="modal-actions-row">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-modal-submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ELDLogsPage;
