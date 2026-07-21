import React, { useState, useEffect } from 'react';
import { FiClock, FiSearch, FiCheckCircle, FiActivity, FiMap, FiTruck } from 'react-icons/fi';
import Sidebar from './Sidebar';
import './HistoryPage.css';

const HistoryPage = ({ onTabChange, onNewDispatch }) => {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query,   setQuery]     = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE}/api/history/`);
        if (response.ok) {
          const data = await response.json();
          setHistory(data);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Client-side search filter
  const filtered = history.filter(r => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (r.driver_name  || '').toLowerCase().includes(q) ||
      (r.driver_id    || '').toLowerCase().includes(q) ||
      (r.current_location  || '').toLowerCase().includes(q) ||
      (r.dropoff_location  || '').toLowerCase().includes(q)
    );
  });

  const totalMiles    = history.reduce((s, r) => s + (r.distance_miles || 0), 0);
  const completed     = history.filter(r => r.is_complete).length;
  const inProgress    = history.length - completed;

  // Safely truncate long location strings
  const shortLoc = (str = '') => {
    if (!str) return '—';
    const part = str.split(',')[0].trim();
    return part.length > 28 ? part.slice(0, 26) + '…' : part;
  };

  return (
    <div className="history-page-layout">
      <Sidebar activeTab="history" onTabChange={onTabChange} onNewDispatch={onNewDispatch} />

      <div className="history-main-panel">

        {/* Top header */}
        <header className="history-top-header">
          <div className="history-title-container">
            <FiClock className="history-page-icon" />
            <span className="history-page-header-title">Dispatch History</span>
          </div>
          <div className="history-search-container">
            <FiSearch className="history-search-icon" />
            <input
              type="text"
              placeholder="Search by driver, ID, or location..."
              className="history-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </header>

        <div className="history-content-viewport">

          {/* Summary strip */}
          <div className="history-summary-strip">
            <div className="history-summary-card">
              <span className="hsc-label">Total Dispatches</span>
              <span className="hsc-value">{history.length}</span>
            </div>
            <div className="history-summary-card">
              <span className="hsc-label">Miles Logged</span>
              <span className="hsc-value orange">{Math.round(totalMiles).toLocaleString()}</span>
            </div>
            <div className="history-summary-card">
              <span className="hsc-label">Completed</span>
              <span className="hsc-value green">{completed}</span>
            </div>
            <div className="history-summary-card">
              <span className="hsc-label">In Progress</span>
              <span className="hsc-value">{inProgress}</span>
            </div>
          </div>

          {/* Records card */}
          <div className="history-card-main">
            <div className="history-card-header">
              <h3 className="history-card-title">All Records</h3>
              <span className="history-record-count">{filtered.length} records</span>
            </div>

            {loading ? (
              <div className="history-loading">
                <div className="history-loading-spinner" />
                Loading dispatch records...
              </div>
            ) : filtered.length === 0 ? (
              <div className="history-empty">
                <span className="history-empty-icon">📭</span>
                <h4 className="history-empty-title">
                  {query ? 'No results found' : 'No dispatch records yet'}
                </h4>
                <p className="history-empty-desc">
                  {query
                    ? 'Try a different search term.'
                    : 'Plan your first trip to see records here.'}
                </p>
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div className="history-records-header">
                  <span className="hrh-cell">Date</span>
                  <span className="hrh-cell">Driver</span>
                  <span className="hrh-cell">Route</span>
                  <span className="hrh-cell">Metrics</span>
                  <span className="hrh-cell">Status</span>
                </div>

                {/* Rows */}
                <div className="history-records-list">
                  {filtered.map(record => (
                    <div className="history-record-row" key={record.id}>

                      {/* Date */}
                      <div className="hrc-date">
                        <div className="dt-primary">
                          {record.created_at ? record.created_at.split(' ')[0] : '—'}
                        </div>
                        <div className="dt-secondary">
                          {record.created_at ? record.created_at.split(' ')[1] : ''}
                        </div>
                      </div>

                      {/* Driver */}
                      <div className="hrc-driver">
                        <div className="driver-name">
                          {record.driver_name || 'Unassigned'}
                        </div>
                        {record.driver_id && (
                          <span className="driver-id-badge">ID: {record.driver_id}</span>
                        )}
                      </div>

                      {/* Route */}
                      <div className="hrc-route">
                        <div className="route-stop">
                          <span className="route-dot origin" />
                          <span className="label">{shortLoc(record.current_location)}</span>
                        </div>
                        <div className="route-connector" />
                        <div className="route-stop">
                          <span className="route-dot dest" />
                          <span className="label">{shortLoc(record.dropoff_location)}</span>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="hrc-metrics">
                        <div className="metric-chip">
                          <span className="mc-val">{Math.round(record.distance_miles || 0)}</span>
                          <span className="mc-unit">Miles</span>
                        </div>
                        <div className="metric-chip">
                          <span className="mc-val">{(record.drive_hours || 0).toFixed(1)}</span>
                          <span className="mc-unit">Hours</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="hrc-status">
                        {record.is_complete ? (
                          <span className="status-pill complete">
                            <span className="status-dot green" />
                            COMPLETED
                          </span>
                        ) : (
                          <span className="status-pill in-progress">
                            <span className="status-dot orange" />
                            IN PROGRESS
                          </span>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
