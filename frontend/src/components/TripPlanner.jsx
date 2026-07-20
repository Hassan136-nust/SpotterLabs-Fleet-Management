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

  // Calculate route and HOS metrics
  const handleCalculateRoute = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const currentCoords = await geocodeAddress(inputs.currentLocation);
      const pickupCoords = await geocodeAddress(inputs.pickupLocation);
      const dropoffCoords = await geocodeAddress(inputs.dropoffLocation);

      if (!currentCoords || !pickupCoords || !dropoffCoords) {
        throw new Error('Addresses could not be geocoded. Please verify address spelling.');
      }

      setLocations({
        current: currentCoords,
        pickup: pickupCoords,
        dropoff: dropoffCoords
      });

      // Calculate route legs
      const leg1 = await getRoute([[currentCoords.lat, currentCoords.lon], [pickupCoords.lat, pickupCoords.lon]]);
      const leg2 = await getRoute([[pickupCoords.lat, pickupCoords.lon], [dropoffCoords.lat, dropoffCoords.lon]]);

      if (!leg1 || !leg2) {
        throw new Error('Failed to resolve route paths between locations.');
      }

      // Combine geometry
      setRouteGeometry({
        type: 'LineString',
        coordinates: [
          ...leg1.geometry.coordinates,
          ...leg2.geometry.coordinates
        ]
      });

      // Solve HOS / ELD
      const eld = solveELDLogs({
        currentCycleUsed: 70 - parseFloat(inputs.cycleHours),
        leg1Distance: leg1.distanceMeters,
        leg1Duration: leg1.durationSeconds,
        leg2Distance: leg2.distanceMeters,
        leg2Duration: leg2.durationSeconds,
        startTime: new Date(inputs.departureDate + 'T08:00:00')
      });

      if (onEldSolved) {
        onEldSolved(eld);
      }

      // Map metrics from solver
      const totalDistMiles = eld.totalDistanceMiles;
      const totalDurationHrs = eld.totalDurationMin / 60;
      
      const etaDateTime = new Date(new Date(inputs.departureDate + 'T08:00:00').getTime() + eld.totalDurationMin * 60 * 1000);
      
      setMetrics({
        distance: Math.round(totalDistMiles),
        driveTime: parseFloat(totalDurationHrs.toFixed(1)),
        eta: etaDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        etaDate: etaDateTime.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase(),
        remainingCycle: parseFloat((parseFloat(inputs.cycleHours) - (eld.totalDurationMin / 60)).toFixed(1)),
        fuelStops: Math.floor(totalDistMiles / 1000) || 1,
        restStops: Math.ceil(totalDurationHrs / 8) - 1 || 1
      });

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
