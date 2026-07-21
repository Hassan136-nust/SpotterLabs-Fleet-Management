import React, { useState, useEffect } from 'react';
import { FiClock, FiSearch, FiCheckCircle, FiActivity } from 'react-icons/fi';
import Sidebar from './Sidebar';
import './HistoryPage.css';

const HistoryPage = ({ onTabChange, onNewDispatch }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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
        console.error("Failed to fetch history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="history-page-layout">
      <Sidebar activeTab="history" onTabChange={onTabChange} onNewDispatch={onNewDispatch} />
      
      <div className="history-main-panel">
        <header className="history-top-header">
          <div className="history-title-container">
            <FiClock className="history-page-icon" />
            <span className="history-page-header-title">Dispatch History</span>
          </div>
          <div className="history-search-container">
            <FiSearch className="history-search-icon" />
            <input type="text" placeholder="Search by driver, ID, or location..." className="history-search-input" />
          </div>
        </header>

        <div className="history-content-viewport">
          <div className="history-card-main">
            {loading ? (
              <div className="history-loading">Loading records...</div>
            ) : history.length === 0 ? (
              <div className="history-empty">No dispatch records found.</div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>DRIVER</th>
                    <th>ROUTE</th>
                    <th>METRICS</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td className="col-date">
                        <div className="dt-primary">{record.created_at.split(' ')[0]}</div>
                        <div className="dt-secondary">{record.created_at.split(' ')[1]}</div>
                      </td>
                      <td className="col-driver">
                        <div className="driver-name">{record.driver_name}</div>
                        <div className="driver-id">{record.driver_id ? `ID: ${record.driver_id}` : 'No ID'}</div>
                      </td>
                      <td className="col-route">
                        <div className="route-point"><span className="dot start"></span> {record.current_location.split(',')[0]}</div>
                        <div className="route-line-vertical"></div>
                        <div className="route-point"><span className="dot end"></span> {record.dropoff_location.split(',')[0]}</div>
                      </td>
                      <td className="col-metrics">
                        <div className="metric-badge">
                          <span className="m-val">{Math.round(record.distance_miles)}</span> mi
                        </div>
                        <div className="metric-badge">
                          <span className="m-val">{record.drive_hours.toFixed(1)}</span> hrs
                        </div>
                      </td>
                      <td className="col-status">
                        {record.is_complete ? (
                          <span className="status-pill complete">
                            <FiCheckCircle /> COMPLETED
                          </span>
                        ) : (
                          <span className="status-pill active">
                            <FiActivity /> IN PROGRESS
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
