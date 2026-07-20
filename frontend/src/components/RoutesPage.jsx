import React from 'react';
import { 
  FiSearch, 
  FiBell, 
  FiUser, 
  FiCheckCircle, 
  FiInfo, 
  FiMapPin, 
  FiShare2, 
  FiPrinter, 
  FiCalendar, 
  FiXCircle,
  FiSend,
  FiTrendingUp,
  FiLayers,
  FiTarget,
  FiCpu
} from 'react-icons/fi';
import Sidebar from './Sidebar';
import MapContainer from './MapContainer';
import './RoutesPage.css';

const RoutesPage = ({ onTabChange, tripPlanState, setTripPlanState, onEldSolved }) => {
  const hasActiveRoute = tripPlanState && tripPlanState.routeGeometry;

  const routeGeometry = hasActiveRoute ? tripPlanState.routeGeometry : null;
  const locations = hasActiveRoute ? tripPlanState.locations : { current: null, pickup: null, dropoff: null };
  const stops = hasActiveRoute ? tripPlanState.plannedStops : [];
  const metrics = hasActiveRoute ? tripPlanState.metrics : {
    distance: 0,
    driveTime: 0,
    eta: '—',
    etaDate: '—',
    remainingCycle: 70
  };

  // Convert decimal remaining HOS cycle hours to HH:MM format
  const formatCycle = (decimalHours) => {
    if (isNaN(decimalHours) || decimalHours <= 0) return "00:00";
    const hrs = Math.floor(decimalHours);
    const mins = Math.round((decimalHours - hrs) * 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Handlers for action buttons
  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Dispatch Share Link copied to clipboard!");
  };

  const handlePrintManifest = () => {
    window.print();
  };

  const handlePushToEld = () => {
    if (!hasActiveRoute) {
      alert("Please generate a route on the Trip Planner page first before pushing to ELD.");
      return;
    }
    alert("Dispatch manifest successfully pushed to driver's ELD terminal!");
  };

  const handleReschedule = async () => {
    if (!hasActiveRoute) {
      alert("Please generate a route on the Trip Planner page first before rescheduling.");
      return;
    }
    const newDate = prompt("Enter new departure date (YYYY-MM-DD):", tripPlanState.inputs.departureDate);
    if (!newDate) return;
    
    try {
      // Update local inputs state
      setTripPlanState(prev => ({
        ...prev,
        inputs: { ...prev.inputs, departureDate: newDate }
      }));
      
      const response = await fetch('http://localhost:8000/api/plan-trip/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_location: tripPlanState.inputs.currentLocation,
          pickup_location: tripPlanState.inputs.pickupLocation,
          dropoff_location: tripPlanState.inputs.dropoffLocation,
          cycle_hours: parseFloat(tripPlanState.inputs.cycleHours) || 70
        }),
      });
      
      if (!response.ok) {
        throw new Error("Recalculation failed.");
      }
      
      const data = await response.json();
      
      // Update global plan state with recalculated HOS parameters
      setTripPlanState(prev => ({
        ...prev,
        routeGeometry: data.route.geometry,
        locations: {
          current: { lat: data.current_coords.lat, lon: data.current_coords.lon, displayName: data.current_coords.display_name },
          pickup: { lat: data.pickup_coords.lat, lon: data.pickup_coords.lon, displayName: data.pickup_coords.display_name },
          dropoff: { lat: data.dropoff_coords.lat, lon: data.dropoff_coords.lon, displayName: data.dropoff_coords.display_name }
        },
        metrics: {
          distance: Math.round(data.total_miles),
          driveTime: parseFloat((data.total_miles / 55).toFixed(1)),
          eta: data.daily_logs[data.daily_logs.length - 1].events[data.daily_logs[data.daily_logs.length - 1].events.length - 1].start,
          etaDate: data.daily_logs[data.daily_logs.length - 1].date,
          remainingCycle: parseFloat((70 - data.daily_logs.reduce((sum, d) => sum + d.totals.driving + d.totals.on_duty, 0)).toFixed(1)),
          fuelStops: data.stops.filter(s => s.type === 'fuel').length,
          restStops: data.stops.filter(s => s.type === 'rest').length
        },
        plannedStops: data.stops
      }));

      // Update ELD logs state
      if (onEldSolved) {
        onEldSolved({
          dailyLogs: data.daily_logs.map(day => ({
            dayNumber: day.day,
            dateString: day.date,
            total_miles_today: day.total_miles_today,
            remarks: day.remarks,
            totals: {
              D: day.totals.driving,
              ON: day.totals.on_duty,
              OFF: day.totals.off_duty,
              SB: day.totals.sleeper
            },
            events: day.events.map(ev => ({
              status: ev.status,
              start: ev.start,
              end: ev.end,
              hours: ev.hours,
              location: ev.location || 'En route'
            }))
          }))
        });
      }
      
      alert(`Successfully rescheduled departure date to ${newDate} and re-optimized route metrics!`);
    } catch (err) {
      alert("Error rescheduling route: " + err.message);
    }
  };

  const handleCancelRoute = () => {
    if (!hasActiveRoute) return;
    const confirmCancel = window.confirm("Are you sure you want to cancel and clear the active route?");
    if (!confirmCancel) return;
    
    setTripPlanState({
      inputs: {
        currentLocation: 'Detecting location...',
        pickupLocation: '',
        dropoffLocation: '',
        cycleHours: '70',
        departureDate: new Date().toISOString().split('T')[0]
      },
      locations: {
        current: null,
        pickup: null,
        dropoff: null
      },
      routeGeometry: null,
      metrics: {
        distance: 0,
        driveTime: 0,
        eta: '—',
        etaDate: '—',
        remainingCycle: 70,
        fuelStops: 0,
        restStops: 0
      },
      plannedStops: []
    });
    alert("Active dispatch cancelled and cleared.");
  };

  return (
    <div className="routes-page-layout">
      {/* Sidebar Navigation */}
      <Sidebar activeTab="routes" onTabChange={onTabChange} />

      {/* Main Panel */}
      <div className="routes-main-panel">
        
        {/* Top Navbar */}
        <header className="routes-top-header">
          <div className="routes-search-container">
            <FiSearch className="routes-search-icon" />
            <input 
              type="text" 
              placeholder="Search routes, drivers, or assets..." 
              className="routes-search-input" 
            />
          </div>
          <div className="routes-hdr-widgets">
            <button className="routes-bell-widget"><FiBell /></button>
            <div className="routes-user-widget-detailed">
              <div className="routes-user-info">
                <span className="routes-username">Marcus V.</span>
                <span className="routes-user-role">LEAD DISPATCHER</span>
              </div>
              <div className="routes-avatar-circle">MV</div>
            </div>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <div className="routes-content-viewport">
          
          {/* 1. Map Panel Section */}
          <section className="routes-map-container-section">
            <MapContainer 
              currentLoc={locations.current}
              pickupLoc={locations.pickup}
              dropoffLoc={locations.dropoff}
              routeGeometry={routeGeometry}
              stops={stops}
            />

            {/* Floating Info Overlays on Map */}
            <div className="map-float-card-route">
              <span className="route-alpha-title">{hasActiveRoute ? 'ACTIVE DISPATCH' : 'ROUTE ALPHA-7'}</span>
            </div>

            <div className="map-float-stats-row">
              <div className="map-stat-badge">
                <span className="green-pulse-dot"></span> VEHICLE LIVE: TRK-492
              </div>
              <div className="map-stat-badge orange-badge">
                ⚡ 68 MPH
              </div>
            </div>

            <div className="map-float-waypoints-overlay">
              <div className="waypoint-item"><span className="waypoint-letter">A</span> 1. Depart terminal</div>
              <div className="waypoint-item"><span className="waypoint-letter">C</span> 2. Cargo loading stop</div>
              <div className="waypoint-item"><span className="waypoint-letter">D</span> 3. Navigate destination</div>
            </div>

            <div className="map-controls-floating-right">
              <button className="map-ctrl-btn"><FiLayers /></button>
              <button className="map-ctrl-btn"><FiTarget /></button>
            </div>
          </section>

          {/* 2. Middle Stats Grid */}
          <section className="routes-stats-strip-grid">
            <div className="routes-stat-card">
              <span className="routes-stat-lbl">TOTAL DISTANCE</span>
              <span className="routes-stat-val">{metrics.distance.toLocaleString()} <span className="stat-unit">MILES</span></span>
            </div>
            
            <div className="routes-stat-card">
              <span className="routes-stat-lbl">EST. DRIVE TIME</span>
              <span className="routes-stat-val">{metrics.driveTime} <span className="stat-unit">HRS</span></span>
            </div>
            
            <div className="routes-stat-card border-orange-left">
              <span className="routes-stat-lbl">REMAINING CYCLE</span>
              <span className="routes-stat-val text-orange-val">{formatCycle(metrics.remainingCycle)} <span className="stat-unit">H:M</span></span>
            </div>
            
            <div className="routes-stat-card">
              <span className="routes-stat-lbl">ARRIVAL TIME</span>
              <span className="routes-stat-val">{metrics.etaDate}</span>
              <span className="routes-stat-sub">{metrics.eta} MDT</span>
            </div>
          </section>

          {/* 3. Bottom Workspace Split */}
          <div className="routes-bottom-workspace">
            
            {/* Left Box: Route Timeline */}
            <div className="route-timeline-card-large">
              <div className="timeline-card-header">
                <h3 className="timeline-card-title">Route Timeline</h3>
                <span className="timeline-badge-optimized">
                  <FiCpu /> OPTIMIZED FOR FUEL
                </span>
              </div>

              <div className="route-nodes-detailed-list">
                {hasActiveRoute && stops.length > 0 ? (
                  stops.map((stop, idx) => {
                    let markerClass = "planned";
                    let title = "Stop";
                    let checkEl = <span className="bullet-grey"></span>;

                    if (stop.type === 'start') {
                      markerClass = "completed";
                      title = "Start Terminal";
                      checkEl = <FiCheckCircle />;
                    } else if (stop.type === 'pickup') {
                      markerClass = "completed";
                      title = "Pickup Stop";
                      checkEl = <FiCheckCircle />;
                    } else if (stop.type === 'fuel') {
                      markerClass = "upcoming";
                      title = "Fuel Stop";
                      checkEl = <span className="bullet-pulse-orange"></span>;
                    } else if (stop.type === 'rest') {
                      markerClass = "planned";
                      title = stop.location.includes("30m") ? "30-Min Rest Break" : "10-Hr Reset Break";
                      checkEl = <span className="bullet-grey"></span>;
                    } else if (stop.type === 'dropoff') {
                      markerClass = "last-node";
                      title = "Destination Dropoff";
                      checkEl = <FiMapPin />;
                    }

                    return (
                      <div className={`node-detailed-item ${stop.type === 'dropoff' ? 'last-node' : markerClass}`} key={idx}>
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
                  })
                ) : (
                  <div className="no-timeline-data-message" style={{ padding: '24px', textAlign: 'center', color: '#8c7365', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', border: '1px dashed #2b201a', borderRadius: '8px' }}>
                    No active route dispatch loaded. Please configure and optimize a route on the <a href="#plan-trip" onClick={(e) => { e.preventDefault(); onTabChange('plan-trip'); }} style={{ color: '#ff6b00', textDecoration: 'none', fontWeight: 'bold' }}>Trip Planner</a> page first.
                  </div>
                )}
              </div>
            </div>

            {/* Right Box: Briefing, Asset, Grid */}
            <div className="routes-right-widgets-column">
              
              {/* Card 1: Driver Briefing */}
              <div className="driver-briefing-card">
                <div className="briefing-header">
                  <FiInfo className="briefing-info-icon" />
                  <h3 className="briefing-title">Driver Briefing</h3>
                </div>

                <div className="briefing-sections-list">
                  <div className="briefing-sec">
                    <span className="briefing-sec-lbl">GATE PROCEDURE</span>
                    <p className="briefing-sec-desc">
                      Archer Logistics requires high-viz vest and hard hat. Enter via South Gate (Gate 4) only.
                    </p>
                  </div>
                  
                  <div className="briefing-sec">
                    <span className="briefing-sec-lbl">LOAD SPECS</span>
                    <p className="briefing-sec-desc">
                      Frozen poultry. Maintain reefer at -5°F. Check temperature logs every 4 hours.
                    </p>
                  </div>

                   {/* Send Button */}
                  <button className="btn-push-to-eld" onClick={handlePushToEld}>
                    <FiSend className="btn-send-icon" /> PUSH TO ELD
                  </button>

                  <div className="briefing-sec border-top-divider">
                    <span className="briefing-sec-lbl">WEATHER ALERT</span>
                    <p className="briefing-sec-desc text-orange-desc">
                      Strong crosswinds expected on I-80 through Nebraska. Advisory for light high-profile vehicles.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Assigned Asset */}
              <div className="assigned-asset-card">
                <span className="asset-header-lbl">ASSIGNED ASSET</span>
                <div className="asset-details-widget">
                  {/* Thumbnail representing truck */}
                  <div className="truck-thumbnail-box">
                    <span className="thumbnail-truck-icon">🚚</span>
                  </div>
                  <div className="asset-meta-details">
                    <h4 className="asset-name-title">Unit 802</h4>
                    <span className="asset-model-desc">2024 Peterbilt 579</span>
                    <span className="asset-health-status">
                      <span className="green-pulse-dot"></span> HEALTH: OPTIMAL
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Action Buttons Grid */}
              <div className="action-buttons-grid-layout">
                <button className="action-grid-btn" onClick={handleShareLink}><FiShare2 className="grid-btn-icon" /> Share Link</button>
                <button className="action-grid-btn" onClick={handlePrintManifest}><FiPrinter className="grid-btn-icon" /> Manifest</button>
                <button className="action-grid-btn" onClick={handleReschedule}><FiCalendar className="grid-btn-icon" /> Reschedule</button>
                <button className="action-grid-btn" onClick={handleCancelRoute}><FiXCircle className="grid-btn-icon text-red" /> Cancel Route</button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default RoutesPage;
