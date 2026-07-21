import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPrinter, FiFileText, FiPlus, FiChevronLeft, FiChevronRight, FiDownload } from 'react-icons/fi';
import Sidebar from './Sidebar';
import './ELDLogsPage.css';

/* ═══════════════════════════════════════════════════════════
   FMCSA CONSTANTS  (wider/taller for crystal clarity)
═══════════════════════════════════════════════════════════ */
const HOUR_WIDTH  = 52;
const ROW_HEIGHT  = 52;
const GRID_WIDTH  = HOUR_WIDTH * 24;      // 1248px
const GRID_HEIGHT = ROW_HEIGHT * 4;       // 208px
const LEFT_LABEL  = 130;
const RIGHT_COL   = 72;
const TOP_LABEL   = 32;

const ROW_ORDER = ['OFF', 'SB', 'D', 'ON'];
const ROW_NAMES = {
  OFF: 'Off Duty',
  SB:  'Sleeper Berth',
  D:   'Driving',
  ON:  'On Duty (Not Drv.)',
};
const STATUS_COLORS = {
  OFF: '#6B7280',
  SB:  '#7C3AED',
  D:   '#2563EB',
  ON:  '#D97706',
};
const STATUS_COLORS_PRINT = {
  OFF: '#9ca3af',
  SB:  '#7c3aed',
  D:   '#2563eb',
  ON:  '#d97706',
};

function timeToX(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] || 0, m = parts[1] || 0;
  return Math.min((h + m / 60) * HOUR_WIDTH, GRID_WIDTH);
}

function fmtHrs(dec) {
  const abs = Math.abs(dec || 0);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════════════════════
   FMCSA CANVAS SVG  — clean block style
═══════════════════════════════════════════════════════════ */
function ELDCanvas({ events, forPrint = false }) {
  const totalW = LEFT_LABEL + GRID_WIDTH + RIGHT_COL;
  const totalH = TOP_LABEL + GRID_HEIGHT + 30;

  const bg    = forPrint ? '#ffffff' : '#080e1a';
  const gridC = forPrint ? '#d1d5db' : '#1e293b';
  const majorC= forPrint ? '#9ca3af' : '#374151';
  const lblC  = forPrint ? '#111827' : '#cbd5e1';
  const colors = forPrint ? STATUS_COLORS_PRINT : STATUS_COLORS;

  // Per-row totals
  const rowTotals = { OFF: 0, SB: 0, D: 0, ON: 0 };
  if (events) {
    events.forEach(ev => {
      if (!ev.start || !ev.end || !ROW_ORDER.includes(ev.status)) return;
      const [sh, sm] = ev.start.split(':').map(Number);
      const [eh, em] = ev.end.split(':').map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm);
      rowTotals[ev.status] += Math.max(mins, 0) / 60;
    });
  }
  const totalSum = Object.values(rowTotals).reduce((a, b) => a + b, 0);
  const sumOk = Math.abs(totalSum - 24) < 0.3;

  // ── Hour labels ──
  const hourLabels = [];
  for (let h = 0; h <= 24; h++) {
    const x = LEFT_LABEL + h * HOUR_WIDTH;
    let label = h === 0 ? 'Mid' : h === 12 ? 'Noon' : h === 24 ? '' : String(h);
    hourLabels.push(
      <text key={`hl-${h}`} x={x} y={TOP_LABEL - 8} textAnchor="middle"
        fill={lblC} fontSize="10" fontFamily="Inter,Arial,sans-serif" fontWeight="700">
        {label}
      </text>
    );
    // 15-min sub-tick marks at bottom of label area
    if (h < 24) {
      [0.25, 0.5, 0.75].forEach((frac, ti) => {
        const xt = LEFT_LABEL + (h + frac) * HOUR_WIDTH;
        hourLabels.push(
          <line key={`tick-${h}-${ti}`}
            x1={xt} y1={TOP_LABEL - 4} x2={xt} y2={TOP_LABEL}
            stroke={majorC} strokeWidth={frac === 0.5 ? 1 : 0.5} />
        );
      });
    }
  }

  // ── Vertical grid lines ──
  const vLines = [];
  for (let h = 0; h <= 24; h++) {
    const x = LEFT_LABEL + h * HOUR_WIDTH;
    const isMajor = h % 6 === 0;
    vLines.push(
      <line key={`vl-${h}`} x1={x} y1={TOP_LABEL} x2={x} y2={TOP_LABEL + GRID_HEIGHT}
        stroke={isMajor ? majorC : gridC}
        strokeWidth={isMajor ? 1.5 : 0.7} />
    );
    if (h < 24) {
      vLines.push(
        <line key={`vhf-${h}`}
          x1={LEFT_LABEL + (h + 0.5) * HOUR_WIDTH} y1={TOP_LABEL}
          x2={LEFT_LABEL + (h + 0.5) * HOUR_WIDTH} y2={TOP_LABEL + GRID_HEIGHT}
          stroke={gridC} strokeWidth={0.4} strokeDasharray="3,3" />
      );
    }
  }

  // ── Horizontal row dividers + labels ──
  const rowElems = [];
  ROW_ORDER.forEach((status, i) => {
    const y    = TOP_LABEL + i * ROW_HEIGHT;
    const col  = colors[status];
    // Alternating row background
    rowElems.push(
      <rect key={`rbg-${i}`} x={LEFT_LABEL} y={y}
        width={GRID_WIDTH} height={ROW_HEIGHT}
        fill={col} opacity={forPrint ? 0.06 : 0.05} />
    );
    rowElems.push(
      <line key={`rh-${i}`} x1={0} y1={y} x2={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} y2={y}
        stroke={majorC} strokeWidth={i === 0 ? 1.5 : 1} />
    );
    // Row label: colored dot + text
    rowElems.push(
      <circle key={`rdot-${i}`} cx={8} cy={y + ROW_HEIGHT / 2}
        r={4} fill={col} />
    );
    rowElems.push(
      <text key={`rl-${i}`} x={18} y={y + ROW_HEIGHT / 2 + 4}
        textAnchor="start" fill={lblC}
        fontSize="10" fontFamily="Inter,Arial,sans-serif" fontWeight="700">
        {ROW_NAMES[status]}
      </text>
    );
  });
  rowElems.push(
    <line key="rh-bot" x1={0} y1={TOP_LABEL + GRID_HEIGHT}
      x2={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} y2={TOP_LABEL + GRID_HEIGHT}
      stroke={majorC} strokeWidth={2} />
  );

  // ── Status blocks + drop lines ──
  const blocks    = [];
  const dropLines = [];

  if (events && events.length > 0) {
    events.forEach((ev, i) => {
      const rowIdx = ROW_ORDER.indexOf(ev.status);
      if (rowIdx < 0) return;
      const x1  = LEFT_LABEL + timeToX(ev.start);
      const x2  = LEFT_LABEL + timeToX(ev.end);
      const y   = TOP_LABEL + rowIdx * ROW_HEIGHT;
      const col = colors[ev.status] || '#4B5563';
      const w   = Math.max(x2 - x1, 0);

      // Clean horizontal line
      blocks.push(
        <rect key={`blk-${i}`} x={x1} y={y + ROW_HEIGHT / 2 - 2} width={w} height={4}
          fill={col} opacity={forPrint ? 1 : 0.9} rx={2} />
      );
      // Dots at segment ends
      blocks.push(
        <circle key={`dot1-${i}`} cx={x1} cy={y + ROW_HEIGHT / 2} r={3} fill={col} />
      );
      blocks.push(
        <circle key={`dot2-${i}`} cx={x2} cy={y + ROW_HEIGHT / 2} r={3} fill={col} />
      );

      // Clean, unified label above the line
      if (w >= 65) {
        blocks.push(
          <text key={`lbl-${i}`} x={x1 + w / 2} y={y + ROW_HEIGHT / 2 - 8}
            textAnchor="middle" fill={lblC} fontSize="9.5"
            fontFamily="Inter,Arial,sans-serif" fontWeight="600">
            {ev.start} - {ev.end} ({fmtHrs(ev.hours)}h)
          </text>
        );
      }

      // Vertical drop line at status transition
      if (i > 0) {
        const prevRowIdx = ROW_ORDER.indexOf(events[i - 1].status);
        if (prevRowIdx >= 0 && prevRowIdx !== rowIdx) {
          const yTop = TOP_LABEL + Math.min(prevRowIdx, rowIdx) * ROW_HEIGHT + ROW_HEIGHT / 2;
          const yBot = TOP_LABEL + Math.max(prevRowIdx, rowIdx) * ROW_HEIGHT + ROW_HEIGHT / 2;
          dropLines.push(
            <line key={`dl-${i}`} x1={x1} y1={yTop} x2={x1} y2={yBot}
              stroke={col} strokeWidth={2.5} opacity={forPrint ? 1 : 0.8} />
          );
        }
      }
    });
  } else {
    blocks.push(
      <text key="empty" x={LEFT_LABEL + GRID_WIDTH / 2} y={TOP_LABEL + GRID_HEIGHT / 2 + 5}
        textAnchor="middle" fill={forPrint ? '#9ca3af' : '#475569'} fontSize="14"
        fontFamily="Inter,Arial,sans-serif" fontStyle="italic">
        No ELD events — plan a trip first
      </text>
    );
  }

  // ── Totals column ──
  const totCells = [];
  totCells.push(
    <rect key="tot-bg" x={LEFT_LABEL + GRID_WIDTH} y={TOP_LABEL}
      width={RIGHT_COL} height={GRID_HEIGHT}
      fill={forPrint ? '#f9fafb' : '#0c1424'} />,
    <text key="tot-hdr-lbl"
      x={LEFT_LABEL + GRID_WIDTH + RIGHT_COL / 2} y={TOP_LABEL - 8}
      textAnchor="middle" fill={lblC} fontSize="9"
      fontFamily="Inter,Arial,sans-serif" fontWeight="800" letterSpacing="1">
      HOURS
    </text>
  );
  ROW_ORDER.forEach((status, i) => {
    const y   = TOP_LABEL + i * ROW_HEIGHT;
    const col = colors[status];
    totCells.push(
      <line key={`tl-${i}`}
        x1={LEFT_LABEL + GRID_WIDTH} y1={y}
        x2={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} y2={y}
        stroke={majorC} strokeWidth={1} />,
      <rect key={`tbar-${i}`}
        x={LEFT_LABEL + GRID_WIDTH + 6} y={y + ROW_HEIGHT / 2 + 6}
        width={Math.min((rowTotals[status] / 12) * (RIGHT_COL - 12), RIGHT_COL - 12)}
        height={3} fill={col} opacity={0.5} rx={1} />,
      <text key={`tv-${i}`}
        x={LEFT_LABEL + GRID_WIDTH + RIGHT_COL / 2} y={y + ROW_HEIGHT / 2 + 4}
        textAnchor="middle" fill={forPrint ? '#111827' : '#f9fafb'} fontSize="13"
        fontFamily="Inter,Arial,sans-serif" fontWeight="900">
        {(rowTotals[status] || 0).toFixed(1)}
      </text>
    );
  });
  totCells.push(
    <line key="tot-sep"
      x1={LEFT_LABEL + GRID_WIDTH} y1={TOP_LABEL + GRID_HEIGHT}
      x2={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} y2={TOP_LABEL + GRID_HEIGHT}
      stroke={sumOk ? '#10b981' : '#ef4444'} strokeWidth={2.5} />,
    <rect key="tot-foot"
      x={LEFT_LABEL + GRID_WIDTH} y={TOP_LABEL + GRID_HEIGHT}
      width={RIGHT_COL} height={28}
      fill={sumOk ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'} />,
    <text key="tot-sum"
      x={LEFT_LABEL + GRID_WIDTH + RIGHT_COL / 2} y={TOP_LABEL + GRID_HEIGHT + 18}
      textAnchor="middle"
      fill={sumOk ? '#10b981' : '#ef4444'} fontSize="12"
      fontFamily="Inter,Arial,sans-serif" fontWeight="900">
      {totalSum.toFixed(1)} {sumOk ? '✓' : '!'}
    </text>
  );

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ display: 'block', background: bg }}
    >
      {/* Canvas background */}
      <rect x={LEFT_LABEL} y={TOP_LABEL}
        width={GRID_WIDTH} height={GRID_HEIGHT} fill={bg} />

      {/* Row stripes + labels */}
      {rowElems}

      {/* Vertical grid */}
      {vLines}

      {/* Hour labels + tick marks */}
      {hourLabels}

      {/* Status filled blocks */}
      {blocks}

      {/* Transition drop lines */}
      {dropLines}

      {/* Totals column */}
      {totCells}

      {/* Outer border */}
      <rect x={0} y={TOP_LABEL}
        width={LEFT_LABEL + GRID_WIDTH + RIGHT_COL} height={GRID_HEIGHT}
        fill="none" stroke={majorC} strokeWidth={1.5} />
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
   PDF / PRINT GENERATOR
═══════════════════════════════════════════════════════════ */
function buildPrintHTML({ resolvedDriver, shippingDoc, logs }) {
  const statusLabel = { OFF: 'Off Duty', SB: 'Sleeper Berth', D: 'Driving', ON: 'On Duty (ND)' };

  const daySheets = logs.map((day, idx) => {
    const events  = day.events || [];
    const totals  = day.totals || {};
    const t       = {
      OFF: totals.OFF ?? totals.off_duty ?? 0,
      SB:  totals.SB  ?? totals.sleeper  ?? 0,
      D:   totals.D   ?? totals.driving  ?? 0,
      ON:  totals.ON  ?? totals.on_duty  ?? 0,
    };
    const totalHrs = t.OFF + t.SB + t.D + t.ON;
    const fmt      = (d) => { const h=Math.floor(d), m=Math.round((d-h)*60); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; };

    // Build inline SVG for the print canvas (using forPrint=true colors on white)
    const HW = 40, RH = 40, GW = HW * 24, GH = RH * 4, LL = 110, RC = 56, TL = 22;
    const cols = { OFF: '#9ca3af', SB: '#7c3aed', D: '#2563eb', ON: '#d97706' };
    const txc  = (t) => { if(!t) return 0; const [h,m]=t.split(':').map(Number); return Math.min((h+m/60)*HW, GW); };

    let svgBlocks = '';
    let svgDrops  = '';
    const order   = ['OFF','SB','D','ON'];
    events.forEach((ev, i) => {
      const ri = order.indexOf(ev.status); if (ri < 0) return;
      const x1 = LL + txc(ev.start), x2 = LL + txc(ev.end), y = TL + ri * RH;
      const w  = Math.max(x2 - x1, 0);
      const c  = cols[ev.status] || '#aaa';
      svgBlocks += `<rect x="${x1}" y="${y+2}" width="${w}" height="${RH-4}" fill="${c}" opacity="0.7" rx="2"/>`;
      if (w >= 30) svgBlocks += `<text x="${x1+w/2}" y="${y+RH/2+4}" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial">${ev.start}–${ev.end}</text>`;
      if (i > 0) {
        const pi = order.indexOf(events[i-1].status);
        if (pi >= 0 && pi !== ri) {
          const yt = TL + Math.min(pi,ri)*RH, yb = TL + (Math.max(pi,ri)+1)*RH;
          svgDrops += `<line x1="${x1}" y1="${yt}" x2="${x1}" y2="${yb}" stroke="#374151" stroke-width="2"/>`;
        }
      }
    });

    let gridV = ''; for(let h=0;h<=24;h++){const x=LL+h*HW,maj=h%6===0; gridV+=`<line x1="${x}" y1="${TL}" x2="${x}" y2="${TL+GH}" stroke="${maj?'#9ca3af':'#e5e7eb'}" stroke-width="${maj?1.2:0.4}"/>`;} 
    let gridH = ''; order.forEach((_,i)=>{const y=TL+i*RH; gridH+=`<line x1="0" y1="${y}" x2="${LL+GW+RC}" y2="${y}" stroke="#9ca3af" stroke-width="${i===0?1.5:0.7}"/>`;});
    gridH += `<line x1="0" y1="${TL+GH}" x2="${LL+GW+RC}" y2="${TL+GH}" stroke="#6b7280" stroke-width="1.5"/>`;
    let rowLbls = ''; const rnames=['Off Duty','Sleeper Berth','Driving','On Duty (Not Drv.)']; order.forEach((s,i)=>{const y=TL+i*RH; rowLbls+=`<text x="${LL-6}" y="${y+RH/2+4}" text-anchor="end" fill="#111" font-size="9" font-weight="bold" font-family="Arial">${rnames[i]}</text>`;});
    let hlbls = ''; for(let h=0;h<=24;h++){const x=LL+h*HW; let l=h===0?'Mid':h===12?'Noon':h===24?'':String(h); hlbls+=`<text x="${x}" y="${TL-5}" text-anchor="middle" fill="#374151" font-size="9" font-weight="bold" font-family="Arial">${l}</text>`;}
    let totCol = ''; order.forEach((s,i)=>{const y=TL+i*RH; totCol+=`<line x1="${LL+GW}" y1="${y}" x2="${LL+GW+RC}" y2="${y}" stroke="#9ca3af" stroke-width="0.7"/><text x="${LL+GW+RC/2}" y="${y+RH/2+4}" text-anchor="middle" fill="#111" font-size="11" font-weight="bold" font-family="Arial">${(t[s]||0).toFixed(1)}</text>`;});

    const evRows = events.map(ev => `
      <tr>
        <td style="color:${cols[ev.status]};font-weight:800">${statusLabel[ev.status]||ev.status}</td>
        <td>${ev.start||'—'}</td><td>${ev.end||'—'}</td>
        <td>${fmt(ev.hours||0)}</td>
        <td>${ev.location||'—'}</td>
      </tr>`).join('');

    const rmkRows = (day.remarks||[]).map(r => `<tr><td>▸</td><td colspan="4">${r}</td></tr>`).join('');

    let dateStr = day.dateString || '—';
    if (dateStr.includes('-')) { const [y,m,d]=dateStr.split('-'); dateStr=`${m}/${d}/${y}`; }

    return `
      <div class="page-break">
        <div class="doc-header">
          <div class="doc-title">DRIVER'S DAILY LOG — FMCSA RODS</div>
          <div class="doc-subtitle">Day ${day.dayNumber || idx+1} of ${logs.length}</div>
        </div>

        <div class="info-grid">
          <div class="info-cell"><div class="info-lbl">DATE</div><div class="info-val">${dateStr}</div></div>
          <div class="info-cell"><div class="info-lbl">DRIVER NAME</div><div class="info-val">${resolvedDriver.name||'—'}</div></div>
          <div class="info-cell"><div class="info-lbl">DRIVER ID</div><div class="info-val">${resolvedDriver.id||'—'}</div></div>
          <div class="info-cell"><div class="info-lbl">VEHICLE #</div><div class="info-val">${resolvedDriver.truck||'—'}</div></div>
          <div class="info-cell"><div class="info-lbl">CO-DRIVER</div><div class="info-val">${resolvedDriver.coDriver||'None'}</div></div>
          <div class="info-cell"><div class="info-lbl">CARRIER</div><div class="info-val">${resolvedDriver.carrier||'—'}</div></div>
          <div class="info-cell"><div class="info-lbl">MAIN OFFICE</div><div class="info-val">${resolvedDriver.mainOffice||'—'}</div></div>
          <div class="info-cell"><div class="info-lbl">SHIPPING DOC</div><div class="info-val">${shippingDoc}</div></div>
          <div class="info-cell"><div class="info-lbl">TOTAL MILES</div><div class="info-val">${day.total_miles_today||0} mi</div></div>
          <div class="info-cell"><div class="info-lbl">24HR START</div><div class="info-val">Midnight (00:00)</div></div>
        </div>

        <div class="canvas-wrapper">
          <svg viewBox="0 0 ${LL+GW+RC+10} ${TL+GH+30}" width="100%">
            <rect x="${LL}" y="${TL}" width="${GW}" height="${GH}" fill="#f9fafb"/>
            ${gridH}${gridV}${rowLbls}${hlbls}${svgBlocks}${svgDrops}
            <text x="${LL+GW+RC/2}" y="${TL-5}" text-anchor="middle" fill="#374151" font-size="8" font-weight="bold" font-family="Arial">HRS</text>
            <rect x="${LL+GW}" y="${TL}" width="${RC}" height="${GH}" fill="#f3f4f6"/>
            ${totCol}
            <rect x="${LL+GW}" y="${TL+GH}" width="${RC}" height="22" fill="#dbeafe"/>
            <text x="${LL+GW+RC/2}" y="${TL+GH+15}" text-anchor="middle" fill="#1d4ed8" font-size="11" font-weight="bold" font-family="Arial">${totalHrs.toFixed(1)} ✓</text>
            <rect x="0" y="${TL}" width="${LL+GW+RC}" height="${GH}" fill="none" stroke="#9ca3af" stroke-width="1.5"/>
          </svg>
        </div>

        <div class="totals-strip">
          <div class="tot-box"><div class="tot-lbl">OFF DUTY</div><div class="tot-val gray">${fmt(t.OFF)}</div></div>
          <div class="tot-box"><div class="tot-lbl">SLEEPER</div><div class="tot-val purple">${fmt(t.SB)}</div></div>
          <div class="tot-box"><div class="tot-lbl">DRIVING</div><div class="tot-val blue">${fmt(t.D)}</div></div>
          <div class="tot-box"><div class="tot-lbl">ON DUTY (ND)</div><div class="tot-val amber">${fmt(t.ON)}</div></div>
          <div class="tot-box total-box"><div class="tot-lbl">24-HR TOTAL</div><div class="tot-val">${fmt(totalHrs)}</div></div>
        </div>

        <table class="events-table">
          <thead><tr><th>STATUS</th><th>START</th><th>END</th><th>DURATION</th><th>LOCATION</th></tr></thead>
          <tbody>${evRows||'<tr><td colspan="5" style="text-align:center;color:#9ca3af">No events</td></tr>'}</tbody>
        </table>

        ${rmkRows ? `<div class="remarks-section"><div class="remarks-title">REMARKS &amp; ANNOTATIONS</div><table class="remarks-table"><tbody>${rmkRows}</tbody></table></div>` : ''}

        <div class="signature-row">
          <div class="sig-left"><div class="sig-lbl">DRIVER SIGNATURE</div><div class="sig-value">${resolvedDriver.name||'________________'}</div></div>
          <div class="sig-right"><div class="sig-lbl">DATE SIGNED</div><div class="sig-value">${dateStr}</div></div>
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ELD Driver Log — ${resolvedDriver.name || 'Driver'}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; }
  .page-break { page-break-after: always; padding-bottom: 16px; }
  .page-break:last-child { page-break-after: avoid; }
  .doc-header { text-align: center; border-bottom: 3px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 12px; }
  .doc-title { font-size: 16px; font-weight: 900; color: #1d4ed8; letter-spacing: 2px; }
  .doc-subtitle { font-size: 10px; color: #6b7280; margin-top: 2px; letter-spacing: 1px; }
  .info-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 12px; }
  .info-cell { border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 8px; background: #f9fafb; }
  .info-lbl { font-size: 7.5px; font-weight: 800; color: #6b7280; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 2px; }
  .info-val { font-size: 11px; font-weight: 700; color: #111; }
  .canvas-wrapper { border: 1.5px solid #9ca3af; border-radius: 6px; overflow: hidden; margin-bottom: 10px; background: #f9fafb; }
  .totals-strip { display: flex; gap: 6px; margin-bottom: 10px; }
  .tot-box { flex: 1; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 8px; background: #f9fafb; text-align: center; }
  .total-box { background: #eff6ff; border-color: #1d4ed8; }
  .tot-lbl { font-size: 7px; font-weight: 800; color: #6b7280; letter-spacing: 0.1em; }
  .tot-val { font-size: 15px; font-weight: 900; color: #111; }
  .tot-val.gray   { color: #4b5563; }
  .tot-val.purple { color: #7c3aed; }
  .tot-val.blue   { color: #1d4ed8; }
  .tot-val.amber  { color: #d97706; }
  .events-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
  .events-table th { background: #1d4ed8; color: #fff; padding: 5px 8px; text-align: left; font-size: 9px; letter-spacing: 0.08em; }
  .events-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
  .events-table tr:nth-child(even) td { background: #f9fafb; }
  .remarks-section { margin-bottom: 10px; }
  .remarks-title { font-size: 8px; font-weight: 900; color: #6b7280; letter-spacing: 0.1em; margin-bottom: 4px; }
  .remarks-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .remarks-table td { padding: 3px 6px; border-bottom: 1px solid #f3f4f6; }
  .remarks-table td:first-child { color: #d97706; width: 16px; }
  .signature-row { display: flex; gap: 24px; border-top: 2px solid #111; padding-top: 8px; margin-top: 8px; }
  .sig-left, .sig-right { flex: 1; }
  .sig-lbl { font-size: 8px; font-weight: 800; color: #6b7280; letter-spacing: 0.08em; }
  .sig-value { font-family: 'Georgia', serif; font-size: 18px; color: #1d4ed8; border-bottom: 1px solid #111; padding-bottom: 2px; margin-top: 4px; }
</style>
</head>
<body>
${daySheets}
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
const ELDLogsPage = ({ onTabChange, onNewDispatch, eldResult, driverInfo, tripPlanState }) => {
  const hasRealData = eldResult?.dailyLogs?.length > 0;

  const di = driverInfo || {};
  const resolvedDriver = {
    name:       di.driverName  || (hasRealData ? '' : 'Alex Rivera'),
    id:         di.driverId    || (hasRealData ? '' : '#44920'),
    truck:      di.truckNumber || (hasRealData ? '—' : 'TRK-492'),
    coDriver:   di.coDriver    || 'None',
    carrier:    di.carrierId   || (hasRealData ? '—' : 'Spotter Labs Logistics LLC'),
    mainOffice: di.mainOffice  || (hasRealData ? '—' : 'Chicago, IL'),
  };
  const avatarInitials = resolvedDriver.name
    ? resolvedDriver.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const shippingDoc = eldResult?.shippingDoc ||
    (hasRealData
      ? `MFT-${(eldResult.dailyLogs[0]?.dateString || '').replace(/-/g, '')}`
      : 'MANIFEST-81203');

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [localLogs, setLocalLogs] = useState(() =>
    hasRealData ? eldResult.dailyLogs : defaultMockLogs
  );
  const [showModal, setShowModal]               = useState(false);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [newRemarkStatus, setNewRemarkStatus]   = useState('OFF');
  const [newRemarkTime, setNewRemarkTime]       = useState('12:00');
  const [newRemarkLocation, setNewRemarkLocation] = useState('');
  const [newRemarkNote, setNewRemarkNote]       = useState('');

  useEffect(() => {
    setLocalLogs(hasRealData ? eldResult.dailyLogs : defaultMockLogs);
    setSelectedDayIdx(0);
  }, [eldResult]);

  const currentDay = localLogs[Math.min(selectedDayIdx, localLogs.length - 1)] || null;

  let currentDateString = '—';
  let totals = { OFF: 0, SB: 0, D: 0, ON: 0 };
  let events = [], miles = 0, remarks = [];

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

  // ── Download / Print PDF ──
  const handleDownloadPDF = () => {
    const html = buildPrintHTML({ resolvedDriver, shippingDoc, logs: localLogs });
    const win  = window.open('', '_blank', 'width=1120,height=860');
    if (!win) { alert('Pop-up blocked — please allow pop-ups for this site.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  };

  const handleAddRemark = (e) => {
    e.preventDefault();
    const entry = `${newRemarkTime} – ${newRemarkLocation} (${newRemarkStatus}: ${newRemarkNote})`;
    const updated = [...localLogs];
    const cur     = { ...updated[selectedDayIdx] };
    cur.remarks   = [...(cur.remarks || []), entry];
    updated[selectedDayIdx] = cur;
    setLocalLogs(updated);
    setShowModal(false);
    setNewRemarkLocation('');
    setNewRemarkNote('');
  };

  const STATUS_FULL_NAMES = {
    OFF: 'OFF DUTY', SB: 'SLEEPER BERTH', D: 'DRIVING', ON: 'ON DUTY (ND)'
  };

  const [savingProgress, setSavingProgress] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveProgress = async () => {
    if (!eldResult?.dispatch_id) {
      alert("No active dispatch ID found. Plan a trip first.");
      return;
    }
    setSavingProgress(true);
    try {
      const res = await fetch('http://localhost:8000/api/complete-trip/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatch_id: eldResult.dispatch_id })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert("Failed to save progress.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving progress.");
    } finally {
      setSavingProgress(false);
    }
  };

  return (
    <div className="eld-page-layout">
      <Sidebar activeTab="eld-logs" onTabChange={onTabChange} onNewDispatch={onNewDispatch} />

      <div className="eld-main-panel">

        {/* Topbar */}
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
            
            <button 
              className={`eld-utility-btn ${saveSuccess ? 'success-btn' : ''}`}
              onClick={handleSaveProgress}
              disabled={savingProgress || !hasRealData}
              style={{ backgroundColor: saveSuccess ? '#10b981' : '#f97316', color: 'white', border: 'none', marginLeft: '12px', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold' }}
            >
              {savingProgress ? 'SAVING...' : saveSuccess ? '✓ SAVED' : 'SAVE PROGRESS'}
            </button>

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

          {/* HOS Clock Cards */}
          <section className="eld-clocks-strip-grid">
            {[
              { lbl: 'OFF DUTY',      val: totals.OFF, max: 24, color: STATUS_COLORS.OFF },
              { lbl: 'SLEEPER BERTH', val: totals.SB,  max: 10, color: STATUS_COLORS.SB  },
              { lbl: 'DRIVING',       val: totals.D,   max: 11, color: STATUS_COLORS.D   },
              { lbl: 'ON DUTY (ND)',  val: totals.ON,  max: 14, color: STATUS_COLORS.ON  },
              { lbl: '24-HR TOTAL',   val: totalHrs,   max: 24, color: '#ff6b00'         },
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

          {/* Log Sheet Card */}
          <section className="eld-graph-card-main">

            <div className="eld-graph-card-header">
              <div className="day-selector-tabs">
                <button className="day-nav-btn"
                  onClick={() => setSelectedDayIdx(i => Math.max(0, i - 1))}
                  disabled={selectedDayIdx === 0}>
                  <FiChevronLeft />
                </button>
                {localLogs.map((day, idx) => (
                  <button key={idx}
                    className={`day-tab-btn ${selectedDayIdx === idx ? 'active' : ''}`}
                    onClick={() => setSelectedDayIdx(idx)}>
                    Day {day.dayNumber || idx + 1}
                  </button>
                ))}
                <button className="day-nav-btn"
                  onClick={() => setSelectedDayIdx(i => Math.min(localLogs.length - 1, i + 1))}
                  disabled={selectedDayIdx === localLogs.length - 1}>
                  <FiChevronRight />
                </button>
              </div>
              <div className="eld-graph-actions">
                <button className="eld-utility-btn" onClick={handleDownloadPDF}>
                  <FiDownload /> Download PDF
                </button>
                <button className="eld-utility-btn" onClick={handleDownloadPDF}>
                  <FiPrinter /> Print
                </button>
              </div>
            </div>

            {/* FMCSA Header Grid */}
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

            {/* ── ELD CANVAS ── */}
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
              <div className="eld-legend-item">
                <span style={{ color: '#94a3b8', fontSize: '0.7rem', marginLeft: 'auto' }}>
                  ◈ = Status transition
                </span>
              </div>
            </div>

            {/* Summary strip */}
            <div className="eld-graph-summaries-strip">
              {[
                ['Total OFF', fmtHrs(totals.OFF), ''],
                ['Total SB',  fmtHrs(totals.SB),  ''],
                ['Total DR',  fmtHrs(totals.D),   'text-orange'],
                ['Total ON',  fmtHrs(totals.ON),  'text-blue'],
              ].map(([lbl, val, cls]) => (
                <div key={lbl} className="summary-col">
                  <span className="summary-lbl">{lbl}</span>
                  <span className={`summary-val ${cls}`}>{val}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Remarks & Events Table */}
          <section className="eld-annotations-card-large">
            <div className="annotations-header">
              <div className="annotations-title-widget">
                <FiFileText className="annotations-icon" />
                <h3>Log Details &amp; Remarks</h3>
              </div>
              <button className="btn-add-remark" onClick={() => setShowModal(true)}>+ Add Remark</button>
            </div>

            {remarks.length > 0 && (
              <div className="eld-remarks-list">
                {remarks.slice(0, 5).map((r, i) => (
                  <div key={i} className="eld-remark-row">
                    <span className="remark-bullet">▸</span>
                    <span className="remark-text">{r}</span>
                  </div>
                ))}
                {remarks.length > 5 && (
                  <div className="eld-remark-show-all" style={{ marginTop: '12px', textAlign: 'center' }}>
                    <button className="btn-secondary" onClick={() => setShowRemarksModal(true)} style={{ padding: '6px 16px', fontSize: '0.85rem' }}>
                      Show All {remarks.length} Remarks
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="annotations-table-wrapper">
              <table className="annotations-table">
                <thead>
                  <tr>
                    <th>STATUS</th><th>START</th><th>END</th>
                    <th>DURATION</th><th>LOCATION</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length > 0 ? events.map((ev, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="status-label-badge"
                          style={{ borderLeft: `4px solid ${STATUS_COLORS[ev.status] || '#4B5563'}`, paddingLeft: 8 }}>
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

      {/* Add Remark Modal */}
      {showModal && (
        <div className="eld-modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
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
                <input type="text" placeholder="City, State" value={newRemarkLocation}
                  onChange={e => setNewRemarkLocation(e.target.value)} required />
              </div>
              <div className="modal-form-group">
                <label>NOTES</label>
                <input type="text" placeholder="e.g. Fuel stop" value={newRemarkNote}
                  onChange={e => setNewRemarkNote(e.target.value)} required />
              </div>
              <div className="modal-actions-row">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-modal-submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Show All Remarks Modal */}
      {showRemarksModal && (
        <div className="eld-modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowRemarksModal(false)}>
          <div className="eld-modal-container" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>All Remarks ({remarks.length})</h3>
              <button onClick={() => setShowRemarksModal(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.2rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <div className="eld-remarks-list" style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
              {remarks.map((r, i) => (
                <div key={i} className="eld-remark-row" style={{ marginBottom: '8px' }}>
                  <span className="remark-bullet" style={{ color: '#d97706', marginRight: '8px' }}>▸</span>
                  <span className="remark-text">{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ELDLogsPage;
