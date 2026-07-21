import React from 'react';
import {
  FiUser,
  FiCheckCircle,
  FiMapPin,
  FiXCircle,
  FiLayers,
  FiTarget,
  FiCpu
} from 'react-icons/fi';
import Sidebar from './Sidebar';
import MapContainer from './MapContainer';
import './RoutesPage.css';

const RoutesPage = ({ onTabChange, onNewDispatch, tripPlanState, setTripPlanState, onEldSolved }) => {
  const hasActiveRoute = tripPlanState && tripPlanState.routeGeometry;

  const routeGeometry = hasActiveRoute ? tripPlanState.routeGeometry : null;
  const locations     = hasActiveRoute ? tripPlanState.locations : { current: null, pickup: null, dropoff: null };
  const stops         = hasActiveRoute ? tripPlanState.plannedStops : [];
  const metrics       = hasActiveRoute ? tripPlanState.metrics : {
    distance: 0, driveTime: 0, eta: '—', etaDate: '—', remainingCycle: 70
  };

  const formatCycle = (h) => {
    if (isNaN(h) || h <= 0) return '00:00';
    const hrs  = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const handleCancelRoute = () => {
    if (!hasActiveRoute) return;
    if (!window.confirm('Are you sure you want to cancel and clear the active route?')) return;
    setTripPlanState({
      inputs: {
        currentLocation: '',
        pickupLocation: '',
        dropoffLocation: '',
        cycleHours: '70',
        departureDate: new Date().toISOString().split('T')[0]
      },
      locations:     { current: null, pickup: null, dropoff: null },
      routeGeometry: null,
      metrics: { distance: 0, driveTime: 0, eta: '—', etaDate: '—', remainingCycle: 70, fuelStops: 0, restStops: 0 },
      plannedStops: []
    });
  };

  return (
    <div className="routes-page-layout">
      <Sidebar activeTab="routes" onTabChange={onTabChange} onNewDispatch={onNewDispatch} />

      <div className="routes-main-panel">

        {/* Top header */}
        <header className="routes-top-header">
          <div className="routes-hdr-widgets" style={{ marginLeft: 'auto' }}>
            <div className="routes-user-widget-detailed">
              <button className="hdr-user-widget"><FiUser /></button>
            </div>
          </div>
        </header>

        <div className="routes-content-viewport">

          {/* ── No route empty state ── */}
          {!hasActiveRoute && (
            <div className="routes-empty-state">
              <span className="routes-empty-icon">🗺️</span>
              <h3 className="routes-empty-title">No Active Dispatch</h3>
              <p className="routes-empty-desc">
                Plan a trip first to see your route, stops, and metrics here.
              </p>
              <button className="routes-empty-cta" onClick={() => onTabChange('plan-trip')}>
                GO TO TRIP PLANNER →
              </button>
            </div>
          )}

          {hasActiveRoute && (
            <>
              {/* 1. Map */}
              <section className="routes-map-container-section">
                <MapContainer
                  currentLoc={locations.current}
                  pickupLoc={locations.pickup}
                  dropoffLoc={locations.dropoff}
                  routeGeometry={routeGeometry}
                  stops={stops}
                />

                <div className="map-float-card-route">
                  <span className="route-alpha-title">ACTIVE DISPATCH</span>
                </div>

                <div className="map-controls-floating-right">
                  <button className="map-ctrl-btn"><FiLayers /></button>
                  <button className="map-ctrl-btn"><FiTarget /></button>
                </div>
              </section>

              {/* 2. Stats strip */}
              <section className="routes-stats-strip-grid">
                <div className="routes-stat-card">
                  <span className="routes-stat-lbl">TOTAL DISTANCE</span>
                  <span className="routes-stat-val">
                    {metrics.distance.toLocaleString()} <span className="stat-unit">MILES</span>
                  </span>
                </div>
                <div className="routes-stat-card">
                  <span className="routes-stat-lbl">EST. DRIVE TIME</span>
                  <span className="routes-stat-val">
                    {metrics.driveTime} <span className="stat-unit">HRS</span>
                  </span>
                </div>
                <div className="routes-stat-card border-orange-left">
                  <span className="routes-stat-lbl">REMAINING CYCLE</span>
                  <span className="routes-stat-val text-orange-val">
                    {formatCycle(metrics.remainingCycle)} <span className="stat-unit">H:M</span>
                  </span>
                </div>
                <div className="routes-stat-card">
                  <span className="routes-stat-lbl">ARRIVAL DATE</span>
                  <span className="routes-stat-val">{metrics.etaDate}</span>
                  <span className="routes-stat-sub">{metrics.eta}</span>
                </div>
              </section>

              {/* 3. Timeline + Cancel */}
              <div className="routes-bottom-workspace">

                {/* Route Timeline */}
                <div className="route-timeline-card-large">
                  <div className="timeline-card-header">
                    <h3 className="timeline-card-title">Route Timeline</h3>
                    <span className="timeline-badge-optimized">
                      <FiCpu /> HOS OPTIMIZED
                    </span>
                  </div>

                  <div className="route-nodes-detailed-list">
                    {stops.map((stop, idx) => {
                      let markerClass = 'planned';
                      let title = 'Stop';
                      let checkEl = <span className="bullet-grey" />;

                      if (stop.type === 'start') {
                        markerClass = 'completed';
                        title = 'Start Terminal';
                        checkEl = <FiCheckCircle />;
                      } else if (stop.type === 'pickup') {
                        markerClass = 'completed';
                        title = 'Pickup Stop';
                        checkEl = <FiCheckCircle />;
                      } else if (stop.type === 'fuel') {
                        markerClass = 'upcoming';
                        title = 'Fuel Stop';
                        checkEl = <span className="bullet-pulse-orange" />;
                      } else if (stop.type === 'rest') {
                        markerClass = 'planned';
                        title = stop.location?.includes('30m') ? '30-Min Rest Break' : '10-Hr Reset Break';
                        checkEl = <span className="bullet-grey" />;
                      } else if (stop.type === 'dropoff') {
                        markerClass = 'last-node';
                        title = 'Destination Dropoff';
                        checkEl = <FiMapPin />;
                      }

                      return (
                        <div
                          className={`node-detailed-item ${stop.type === 'dropoff' ? 'last-node' : markerClass}`}
                          key={idx}
                        >
                          <div className="node-status-check">{checkEl}</div>
                          <div className="node-main-info">
                            <h4 className="node-place-title">{title}</h4>
                            <span className="node-place-sub">{stop.location}</span>
                          </div>
                          <div className="node-time-info">
                            <span className="node-time-val">{stop.duration_hrs} Hrs</span>
                            <span className="node-time-status text-orange-status">{stop.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right column — only Cancel Route */}
                <div className="routes-right-widgets-column">

                  {/* Stop summary chips */}
                  <div className="routes-stops-summary-card">
                    <span className="routes-stat-lbl" style={{ marginBottom: '12px', display: 'block' }}>STOP SUMMARY</span>
                    <div className="stops-chips-row">
                      <div className="stop-chip">
                        <span className="stop-chip-val">{stops.filter(s => s.type === 'fuel').length}</span>
                        <span className="stop-chip-lbl">Fuel</span>
                      </div>
                      <div className="stop-chip">
                        <span className="stop-chip-val">{stops.filter(s => s.type === 'rest').length}</span>
                        <span className="stop-chip-lbl">Rest</span>
                      </div>
                      <div className="stop-chip">
                        <span className="stop-chip-val">{stops.filter(s => s.type === 'pickup').length}</span>
                        <span className="stop-chip-lbl">Pickup</span>
                      </div>
                      <div className="stop-chip">
                        <span className="stop-chip-val">{stops.filter(s => s.type === 'dropoff').length}</span>
                        <span className="stop-chip-lbl">Dropoff</span>
                      </div>
                    </div>
                  </div>

                  {/* Cancel Route — only action button */}
                  <button className="btn-cancel-route-full" onClick={handleCancelRoute}>
                    <FiXCircle className="cancel-route-icon" />
                    Cancel Route
                  </button>

                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default RoutesPage;
