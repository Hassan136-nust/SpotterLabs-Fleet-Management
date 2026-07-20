import React, { useState, useEffect } from 'react';
import { 
  FiSearch, 
  FiBell, 
  FiUser, 
  FiMapPin, 
  FiCalendar, 
  FiCpu, 
  FiLayers, 
  FiCompass, 
  FiCloudRain 
} from 'react-icons/fi';
import Sidebar from './Sidebar';
import MapContainer from './MapContainer';
import { geocodeAddress, getRoute } from '../services/api';
import { solveELDLogs } from '../utils/eldSolver';
import './TripPlanner.css';

const TripPlanner = ({ onTabChange, onEldSolved }) => {
  const [inputs, setInputs] = useState({
    currentLocation: 'Chicago, IL',
    pickupLocation: 'Des Moines, IA',
    dropoffLocation: 'Denver, CO',
    cycleHours: '70',
    departureDate: '2023-10-24'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Map and calculation states
  const [locations, setLocations] = useState({
    current: null,
    pickup: null,
    dropoff: null
  });
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [metrics, setMetrics] = useState({
    distance: 842,
    driveTime: 12.5,
    eta: '06:45 AM',
    etaDate: 'OCT 24, 2023',
    remainingCycle: 57.5,
    fuelStops: 2,
    restStops: 1
  });

  // Calculate route and HOS metrics using Django backend
  const handleCalculateRoute = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/api/plan-trip/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_location: inputs.currentLocation,
          pickup_location: inputs.pickupLocation,
          dropoff_location: inputs.dropoffLocation,
          current_cycle_used: 70 - parseFloat(inputs.cycleHours)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to communicate with Django HOS backend API.');
      }

      const data = await response.json();

      // Find pickup and dropoff stop coordinates from stops
      const pickupStop = data.stops.find(s => s.type === 'pickup');
      const dropoffStop = data.stops.find(s => s.type === 'dropoff');
      
      // Get first and last coordinates of route path for pinning
      const coordsList = data.route_geometry.coordinates;
      const startCoord = coordsList[0];

      setLocations({
        current: { lat: startCoord[1], lon: startCoord[0], displayName: inputs.currentLocation },
        pickup: { lat: pickupStop.lat, lon: pickupStop.lng, displayName: inputs.pickupLocation },
        dropoff: { lat: dropoffStop.lat, lon: dropoffStop.lng, displayName: inputs.dropoffLocation }
      });

      // Update Leaflet Route Polyline
      setRouteGeometry(data.route_geometry);

      // Sum driving duration
      const totalDriveHrs = data.legs.reduce((acc, leg) => acc + leg.drive_hours, 0);

      // Find end date and eta time from logs
      const finalDay = data.daily_logs[data.daily_logs.length - 1];
      const finalEvent = finalDay.events[finalDay.events.length - 1];

      // Map metrics from backend
      setMetrics({
        distance: Math.round(data.total_miles),
        driveTime: parseFloat(totalDriveHrs.toFixed(1)),
        eta: finalEvent ? finalEvent.start : '06:00 PM',
        etaDate: finalDay.date.toUpperCase(),
        remainingCycle: parseFloat((parseFloat(inputs.cycleHours) - data.daily_logs.reduce((acc, day) => acc + day.totals.on_duty + day.totals.driving, 0)).toFixed(1)),
        fuelStops: data.stops.filter(s => s.type === 'fuel').length,
        restStops: data.stops.filter(s => s.type === 'rest').length
      });

      // Pass HOS result to App.jsx to synchronize the ELD Logs tab
      if (onEldSolved) {
        onEldSolved({
          dailyLogs: data.daily_logs.map(day => ({
            dayNumber: day.day,
            dateString: day.date,
            totals: {
              D: day.totals.driving,
              ON: day.totals.on_duty,
              OFF: day.totals.off_duty,
              SB: day.totals.sleeper
            },
            intervals: day.events.map(ev => ({
              status: ev.status,
              durationMin: Math.round(ev.hours * 60)
            }))
          }))
        });
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run on mount to initialize default route shown in screenshot (Chicago to Denver)
  useEffect(() => {
    handleCalculateRoute();
  }, []);

  return (
    <div className="trip-planner-page-layout">
      {/* Sidebar Navigation */}
      <Sidebar activeTab="plan-trip" onTabChange={onTabChange} />

      {/* Main Panel */}
      <div className="planner-main-panel">
        
        {/* Top Navbar */}
        <header className="planner-top-header">
          <div className="search-bar-container">
            <FiSearch className="search-bar-icon" />
            <input 
              type="text" 
              placeholder="Search loads, drivers, or trucks..." 
              className="search-input-field" 
            />
          </div>
          <div className="hdr-widgets">
            <button className="hdr-bell-widget"><FiBell /></button>
            <button className="hdr-user-widget"><FiUser /></button>
          </div>
        </header>

        {/* Content Split: Form on Left, Map on Right */}
        <div className="planner-workspace-split">
          
          {/* Left panel: Form parameters */}
          <div className="planner-form-panel">
            <div className="planner-panel-header">
              <h2 className="planner-title">Trip Planner</h2>
              <p className="planner-subtitle">Configure logistics and optimize route efficiency.</p>
            </div>

            <form onSubmit={handleCalculateRoute} className="planner-form">
              <div className="planner-input-group">
                <label className="planner-input-lbl">CURRENT LOCATION</label>
                <div className="planner-input-wrapper">
                  <FiMapPin className="input-icon-left text-orange" />
                  <input 
                    type="text" 
                    value={inputs.currentLocation} 
                    onChange={e => setInputs({ ...inputs, currentLocation: e.target.value })}
                    placeholder="Enter starting address"
                    required
                  />
                </div>
              </div>

              <div className="planner-input-group">
                <label className="planner-input-lbl">PICKUP LOCATION</label>
                <div className="planner-input-wrapper">
                  <FiMapPin className="input-icon-left text-blue" />
                  <input 
                    type="text" 
                    value={inputs.pickupLocation}
                    onChange={e => setInputs({ ...inputs, pickupLocation: e.target.value })}
                    placeholder="Enter pickup address"
                    required
                  />
                </div>
              </div>

              <div className="planner-input-group">
                <label className="planner-input-lbl">DROPOFF LOCATION</label>
                <div className="planner-input-wrapper">
                  <FiMapPin className="input-icon-left text-green" />
                  <input 
                    type="text" 
                    value={inputs.dropoffLocation}
                    onChange={e => setInputs({ ...inputs, dropoffLocation: e.target.value })}
                    placeholder="Enter destination address"
                    required
                  />
                </div>
              </div>

              <div className="planner-row-inputs">
                <div className="planner-input-group">
                  <label className="planner-input-lbl">CYCLE HOURS</label>
                  <input 
                    type="number" 
                    className="planner-raw-input"
                    value={inputs.cycleHours}
                    onChange={e => setInputs({ ...inputs, cycleHours: e.target.value })}
                    min="1"
                    max="70"
                    required
                  />
                </div>
                <div className="planner-input-group">
                  <label className="planner-input-lbl">DEPARTURE TIME</label>
                  <div className="planner-input-wrapper no-padding-left">
                    <FiCalendar className="input-icon-right" />
                    <input 
                      type="date" 
                      className="planner-date-input"
                      value={inputs.departureDate}
                      onChange={e => setInputs({ ...inputs, departureDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="planner-btn-orange" disabled={loading}>
                <FiCpu className="btn-cpu-icon" /> {loading ? 'GENERATING...' : 'GENERATE ROUTE'}
              </button>
            </form>

            {error && <div className="planner-error-box">{error}</div>}

            {/* Route nodes preview widget */}
            <div className="route-nodes-preview-section">
              <h4 className="preview-heading">ROUTE NODES PREVIEW</h4>
              <div className="preview-nodes-list">
                <div className="preview-node-item">
                  <span className="node-marker start"></span>
                  <div className="node-details">
                    <span className="node-title">Start: Chicago Terminal</span>
                    <span className="node-address">{inputs.currentLocation}</span>
                  </div>
                </div>
                <div className="preview-node-item">
                  <span className="node-marker pickup"></span>
                  <div className="node-details">
                    <span className="node-title">Pickup: Logistics Hub Point</span>
                    <span className="node-address">{inputs.pickupLocation}</span>
                  </div>
                </div>
                <div className="preview-node-item">
                  <span className="node-marker dropoff"></span>
                  <div className="node-details">
                    <span className="node-title">End: Denver Logistics Park</span>
                    <span className="node-address">{inputs.dropoffLocation}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Leaflet Map */}
          <div className="planner-map-panel">
            <MapContainer 
              currentLoc={locations.current}
              pickupLoc={locations.pickup}
              dropoffLoc={locations.dropoff}
              routeGeometry={routeGeometry}
            />

            {/* Floating Top Bar on Map */}
            <div className="map-floating-actions">
              <button className="map-action-btn"><FiLayers /></button>
              <button className="map-action-btn"><FiCompass /></button>
              <button className="map-action-btn"><FiCloudRain /></button>
            </div>

            {/* Bottom Dashboard Metrics Bar Overlay */}
            <div className="map-bottom-dashboard-overlay">
              <div className="metric-col">
                <span className="metric-lbl">DISTANCE</span>
                <span className="metric-val">{metrics.distance} mi</span>
                <span className="metric-sub-lbl text-green">● OPTIMIZED</span>
              </div>
              <div className="metric-col">
                <span className="metric-lbl">ESTIMATED DRIVE TIME</span>
                <span className="metric-val">{metrics.driveTime} hrs</span>
                <div className="metric-progress-track">
                  <div className="metric-progress-fill" style={{ width: '40%' }}></div>
                </div>
              </div>
              <div className="metric-col">
                <span className="metric-lbl">ETA</span>
                <span className="metric-val">{metrics.eta}</span>
                <span className="metric-sub-lbl">{metrics.etaDate}</span>
              </div>
              <div className="metric-col">
                <span className="metric-lbl">REMAINING CYCLE</span>
                <span className="metric-val">{metrics.remainingCycle} hrs</span>
                <span className="metric-sub-lbl text-red">RESET IN 3D 4H</span>
              </div>
              <div className="metric-col">
                <span className="metric-lbl">FUEL STOPS</span>
                <span className="metric-val">{metrics.fuelStops.toString().padStart(2, '0')}</span>
                <div className="indicator-dashes">
                  <span className="dash active"></span>
                  <span className="dash active"></span>
                  <span className="dash"></span>
                </div>
              </div>
              <div className="metric-col">
                <span className="metric-lbl">REST STOPS</span>
                <span className="metric-val">{metrics.restStops.toString().padStart(2, '0')}</span>
                <div className="indicator-dashes">
                  <span className="dash active"></span>
                  <span className="dash"></span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default TripPlanner;
