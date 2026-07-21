import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FiLayout,
  FiMap,
  FiCompass,
  FiFileText,
  FiClock,
  FiSettings,
  FiPlus,
  FiMenu,
  FiX
} from 'react-icons/fi';
import './Sidebar.css';

const Sidebar = ({ activeTab, onTabChange, onNewDispatch }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar when tab changes on mobile
  const handleTabChange = (tab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleConfirmNewDispatch = () => {
    setShowConfirmModal(false);
    setMobileOpen(false);
    if (onNewDispatch) onNewDispatch();
  };

  return (
    <>
      {/* ── Hamburger button (mobile only) ── */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(prev => !prev)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <FiX /> : <FiMenu />}
      </button>

      {/* ── Backdrop overlay (mobile only) ── */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar panel ── */}
      <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand-header">
          <span className="brand-logo-text">Spotter.ai</span>
          <span className="brand-sub-text">FLEET MANAGEMENT</span>
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-navigation">
          <button
            className={`nav-button-item ${activeTab === 'homepage' ? 'active' : ''}`}
            onClick={() => handleTabChange('homepage')}
          >
            <FiLayout className="nav-btn-icon" /> Homepage
          </button>
          <button
            className={`nav-button-item ${activeTab === 'plan-trip' ? 'active' : ''}`}
            onClick={() => handleTabChange('plan-trip')}
          >
            <FiMap className="nav-btn-icon" /> Plan Trip
          </button>
          <button
            className={`nav-button-item ${activeTab === 'routes' ? 'active' : ''}`}
            onClick={() => handleTabChange('routes')}
          >
            <FiCompass className="nav-btn-icon" /> Routes
          </button>
          <button
            className={`nav-button-item ${activeTab === 'eld-logs' ? 'active' : ''}`}
            onClick={() => handleTabChange('eld-logs')}
          >
            <FiFileText className="nav-btn-icon" /> ELD Logs
          </button>
          <button
            className={`nav-button-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
          >
            <FiClock className="nav-btn-icon" /> History
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
      </aside>

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
    </>
  );
};

export default Sidebar;
