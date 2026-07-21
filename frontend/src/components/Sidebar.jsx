import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiLayout,
  FiMap,
  FiCompass,
  FiFileText,
  FiClock,
  FiSettings,
  FiPlus
} from 'react-icons/fi';
import './Sidebar.css';

const Sidebar = ({ activeTab, onTabChange, onNewDispatch }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleConfirmNewDispatch = () => {
    setShowConfirmModal(false);
    if (onNewDispatch) onNewDispatch();
  };

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-header">
        <span className="brand-logo-text">Spotter.ai</span>
        <span className="brand-sub-text">FLEET MANAGEMENT</span>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-navigation">
        <button
          className={`nav-button-item ${activeTab === 'homepage' ? 'active' : ''}`}
          onClick={() => onTabChange('homepage')}
        >
          <FiLayout className="nav-btn-icon" /> Homepage
        </button>
        <button
          className={`nav-button-item ${activeTab === 'plan-trip' ? 'active' : ''}`}
          onClick={() => onTabChange('plan-trip')}
        >
          <FiMap className="nav-btn-icon" /> Plan Trip
        </button>
        <button
          className={`nav-button-item ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => onTabChange('routes')}
        >
          <FiCompass className="nav-btn-icon" /> Routes
        </button>
        <button
          className={`nav-button-item ${activeTab === 'eld-logs' ? 'active' : ''}`}
          onClick={() => onTabChange('eld-logs')}
        >
          <FiFileText className="nav-btn-icon" /> ELD Logs
        </button>
        <button
          className={`nav-button-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => onTabChange('history')}
        >
          <FiClock className="nav-btn-icon" /> History
        </button>
        <button
          className={`nav-button-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
        >
          <FiSettings className="nav-btn-icon" /> Settings
        </button>
      </nav>

      {/* Sidebar Footer Actions */}
      <div className="sidebar-bottom-actions">
        <button className="btn-new-dispatch" onClick={() => setShowConfirmModal(true)}>
          <FiPlus className="plus-icon" /> New Dispatch
        </button>

        {/* User Profile */}
        <div className="user-profile-widget">
          <div className="profile-avatar-circle">SL</div>
          <div className="profile-user-details">
            <div className="profile-username">Spotter Labs</div>
            <div className="profile-title">Fleet Supervisor</div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal via Portal */}
      {showConfirmModal && createPortal(
        <div className="sidebar-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="sidebar-modal-container" onClick={(e) => e.stopPropagation()}>
            <h3 className="sidebar-modal-title">Start New Dispatch?</h3>
            <p className="sidebar-modal-desc">
              Are you sure you want to start a new dispatch? This will clear your current trip planner and driver session.
            </p>
            <div className="sidebar-modal-actions">
              <button className="sidebar-btn-cancel" onClick={() => setShowConfirmModal(false)}>Cancel</button>
              <button className="sidebar-btn-confirm" onClick={handleConfirmNewDispatch}>Confirm</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
};

export default Sidebar;
