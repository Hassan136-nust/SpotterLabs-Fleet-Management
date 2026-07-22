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
  FiCloudRain,
  FiPlay
} from 'react-icons/fi';
import Sidebar from './Sidebar';
import MapContainer from './MapContainer';
import { geocodeAddress, getRoute } from '../services/api';
import { solveELDLogs } from '../utils/eldSolver';
import './TripPlanner.css';

const TripPlanner = ({ onTabChange, onNewDispatch, onEldSolved, tripPlanState, setTripPlanState, driverInfo, setDriverInfo }) => {
  const { inputs, locations, routeGeometry, metrics, plannedStops } = tripPlanState;

  // centralized state setters
  const setInputs = (valOrFn) => {
    setTripPlanState(prev => ({
      ...prev,
      inputs: typeof valOrFn === 'function' ? valOrFn(prev.inputs) : valOrFn
    }));
  };

  const setLocations = (valOrFn) => {
    setTripPlanState(prev => ({
      ...prev,
      locations: typeof valOrFn === 'function' ? valOrFn(prev.locations) : valOrFn
    }));
  };

  const setRouteGeometry = (valOrFn) => {
    setTripPlanState(prev => ({
      ...prev,
      routeGeometry: typeof valOrFn === 'function' ? valOrFn(prev.routeGeometry) : valOrFn
    }));
  };

  const setMetrics = (valOrFn) => {
    setTripPlanState(prev => ({
      ...prev,
      metrics: typeof valOrFn === 'function' ? valOrFn(prev.metrics) : valOrFn
    }));
  };

  const setPlannedStops = (valOrFn) => {
    setTripPlanState(prev => ({
      ...prev,
      plannedStops: typeof valOrFn === 'function' ? valOrFn(prev.plannedStops) : valOrFn
    }));
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [driverIdError, setDriverIdError] = useState(false);
  const [warningModal, setWarningModal] = useState({ show: false, hours: 0 });
  const [driverHoursModal, setDriverHoursModal] = useState({ show: false, hoursLeft: 0, driverName: '', driverId: '' });

  // Autocomplete and Dynamic suggestions
  const [suggestions, setSuggestions] = useState({ current: [], pickup: [], dropoff: [] });
  const [activeField, setActiveField] = useState(null);

  // Fetch suggestions from Photon API (free, OpenStreetMap data)
  const handleFetchSuggestions = async (field, query) => {
    setInputs(prev => ({ ...prev, [field === 'current' ? 'currentLocation' : field === 'pickup' ? 'pickupLocation' : 'dropoffLocation']: query }));
    
    if (!query || query.trim().length < 3) {
      setSuggestions(prev => ({ ...prev, [field]: [] }));
      return;
    }

    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        const items = data.features.map(f => {
          const props = f.properties;
          const city = props.city || props.town || props.name || '';
          const state = props.state || '';
          const country = props.country || '';
          const label = [city, state, country].filter(Boolean).join(', ');
          return label || props.label || 'Unknown location';
        });
        const uniqueItems = Array.from(new Set(items));
        setSuggestions(prev => ({ ...prev, [field]: uniqueItems }));
      }
    } catch (err) {
      console.error("Photon autocomplete failed:", err);
    }
  };

  const handleSelectSuggestion = (field, value) => {
    setInputs(prev => ({ ...prev, [field === 'current' ? 'currentLocation' : field === 'pickup' ? 'pickupLocation' : 'dropoffLocation']: value }));
    setSuggestions(prev => ({ ...prev, [field]: [] }));
    setActiveField(null);
  };

  // Fetch driver profile to get remaining cycle hours
  const handleDriverIdBlur = async () => {
    if (!driverInfo?.driverId) return;
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE}/api/driver/${driverInfo.driverId}/`);
      if (res.ok) {
        const data = await res.json();
        setDriverInfo(prev => ({
          ...prev,
          driverName: data.name || prev.driverName,
          truckNumber: data.truck_number || prev.truckNumber,
          coDriver: data.co_driver || prev.coDriver,
          carrierId: data.carrier_id || prev.carrierId,
          mainOffice: data.main_office || prev.mainOffice
        }));
        // Update cycle hours input to remaining hours
        const rem = data.remaining_cycle_hours.toFixed(1);
        setInputs(prev => ({ ...prev, cycleHours: rem }));
        setMetrics(prev => ({ ...prev, remainingCycle: rem }));
      }
    } catch (err) {
      console.error("Failed to fetch driver info", err);
    }
  };

  // Calculate route and HOS metrics using Django backend
  const handleCalculateRoute = async (e) => {
    if (e) e.preventDefault();

    // Validate Driver ID first
    if (!driverInfo?.driverId || driverInfo.driverId.trim() === '') {
      setDriverIdError(true);
      // Scroll to driver id field smoothly
      document.getElementById('driver-id-input')?.focus();
      document.getElementById('driver-id-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setDriverIdError(false);

    // Validate pickup and destination are not the same
    const normalise = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      inputs.pickupLocation && inputs.dropoffLocation &&
      normalise(inputs.pickupLocation) === normalise(inputs.dropoffLocation)
    ) {
      setError('Pickup and destination cannot be the same location. Please enter different addresses.');
      return;
    }

    setTripPlanState(prev => ({ ...prev, routeReady: false }));
    setLoading(true);
    setError(null);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

      // Check latest driver details from DB if driver ID is provided
      let driverRemainingHours = parseFloat(inputs.cycleHours) || 70;
      let fetchedDriverName = driverInfo?.driverName || '';
      if (driverInfo?.driverId) {
        try {
          const driverRes = await fetch(`${API_BASE}/api/driver/${driverInfo.driverId}/`);
          if (driverRes.ok) {
            const dData = await driverRes.json();
            driverRemainingHours = dData.remaining_cycle_hours;
            fetchedDriverName = dData.name || fetchedDriverName;
            setInputs(prev => ({ ...prev, cycleHours: driverRemainingHours.toFixed(1) }));
          }
        } catch (dErr) {
          console.error("Driver lookup error:", dErr);
        }
      }

      const response = await fetch(`${API_BASE}/api/plan-trip/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_location: inputs.currentLocation,
          pickup_location: inputs.pickupLocation,
          dropoff_location: inputs.dropoffLocation,
          current_cycle_used: Math.max(0, Math.min(70, 70 - driverRemainingHours)),
          driver_id: driverInfo?.driverId || '',
          driver_name: driverInfo?.driverName || '',
          truck_number: driverInfo?.truckNumber || '',
          co_driver: driverInfo?.coDriver || '',
          carrier_id: driverInfo?.carrierId || '',
          main_office: driverInfo?.mainOffice || ''
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to communicate with Django HOS backend API.');
        } else {
          const rawText = await response.text();
          throw new Error(`Server returned HTML error: ${rawText.slice(0, 150)}...`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const rawText = await response.text();
        throw new Error(`Invalid non-JSON response from server: ${rawText.slice(0, 150)}...`);
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

      // Save calculated stops list
      setPlannedStops(data.stops);

      // Sum driving duration
      const totalDriveHrs = data.legs.reduce((acc, leg) => acc + leg.drive_hours, 0);

      // Find end date and eta time from logs
      const finalDay = data.daily_logs[data.daily_logs.length - 1];
      const finalEvent = finalDay.events[finalDay.events.length - 1];

      // Map metrics from backend
      const calculatedMetrics = {
        distance: Math.round(data.total_miles),
        driveTime: parseFloat(totalDriveHrs.toFixed(1)),
        eta: finalEvent ? finalEvent.start : '06:00 PM',
        etaDate: finalDay.date.toUpperCase(),
        remainingCycle: parseFloat((driverRemainingHours - data.daily_logs.reduce((acc, day) => acc + day.totals.on_duty + day.totals.driving, 0)).toFixed(1)),
        fuelStops: data.stops.filter(s => s.type === 'fuel').length,
        restStops: data.stops.filter(s => s.type === 'rest').length
      };

      setMetrics(calculatedMetrics);

      // Store dispatch_id and routeReady in shared tripPlanState for tab persistence
      setTripPlanState(prev => ({
        ...prev,
        dispatchId: data.dispatch_id,
        routeReady: true,
        eldUnsavedChanges: true,
        tripStarted: false,
        startTimestamp: null
      }));

      // Trigger Modal displaying available driver hours left
      if (driverRemainingHours < 70) {
        setDriverHoursModal({
          show: true,
          hoursLeft: driverRemainingHours.toFixed(1),
          driverName: fetchedDriverName || driverInfo?.driverName || 'Driver',
          driverId: driverInfo?.driverId || ''
        });
      }

      // Trigger safety warning modal if remaining hours are negative (cycle exceeded)
      if (calculatedMetrics.remainingCycle < 0) {
        setWarningModal({
          show: true,
          hours: Math.abs(calculatedMetrics.remainingCycle)
        });
      }

      // Pass HOS result to App.jsx to synchronize the ELD Logs tab
      if (onEldSolved) {
        onEldSolved({
          dispatch_id: data.dispatch_id,
          // Driver & carrier metadata from form
          driverInfo: {
            driverName:  driverInfo?.driverName  || '',
            driverId:    driverInfo?.driverId    || '',
            truckNumber: driverInfo?.truckNumber || '',
            coDriver:    driverInfo?.coDriver    || 'None',
            carrierId:   driverInfo?.carrierId   || '',
            mainOffice:  driverInfo?.mainOffice  || ''
          },
          // Route context
          routeFrom: inputs.currentLocation,
          routeTo:   inputs.dropoffLocation,
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
            // Full events with start, end, location for FMCSA grid rendering
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

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  // Live Elapsed Timer that updates even when navigating back and forth across tabs
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!tripPlanState.tripStarted || !tripPlanState.startTimestamp) return;

    const calcElapsed = () => Math.floor((Date.now() - tripPlanState.startTimestamp) / 1000);
    setElapsedSeconds(calcElapsed());

    const timer = setInterval(() => {
      setElapsedSeconds(calcElapsed());
    }, 1000);

    return () => clearInterval(timer);
  }, [tripPlanState.tripStarted, tripPlanState.startTimestamp]);

  // Start Journey: update tripPlanState and notify backend
  const handleStartJourney = async () => {
    const now = Date.now();
    setTripPlanState(prev => ({
      ...prev,
      tripStarted: true,
      startTimestamp: now,
      routeReady: false
    }));

    // Mark trip as started in backend so it shows in History
    if (tripPlanState.dispatchId) {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        await fetch(`${API_BASE}/api/start-trip/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispatch_id: tripPlanState.dispatchId })
        });
      } catch (err) {
        console.error('Failed to mark trip as started:', err);
      }
    }

    // Auto-complete trip after the actual drive time elapses (real time)
    if (tripPlanState.dispatchId && metrics.driveTime > 0) {
      const driveDurationMs = metrics.driveTime * 60 * 60 * 1000;
      setTimeout(async () => {
        try {
          const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          await fetch(`${API_BASE}/api/complete-trip/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dispatch_id: tripPlanState.dispatchId })
          });
        } catch (err) {
          console.error('Auto-complete trip failed:', err);
        }
      }, driveDurationMs);
    }
  };

  // Format seconds as HH:MM:SS
  const formatElapsed = (secs) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };


  // Run on mount to fetch current location via browser geolocation
  useEffect(() => {
    const initLocation = async () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const res = await fetch(`https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`);
              if (res.ok) {
                const data = await res.json();
                if (data.features && data.features.length > 0) {
                  const prop = data.features[0].properties;
                  const city = prop.city || prop.town || prop.name || '';
                  const state = prop.state || '';
                  const label = city && state ? `${city}, ${state}` : prop.label || '';
                  if (label) {
                    setInputs(prev => ({ ...prev, currentLocation: label }));
                    setLocations(prev => ({ ...prev, current: { lat: latitude, lon: longitude, displayName: label } }));
                    return;
                  }
                }
              }
              setInputs(prev => ({ ...prev, currentLocation: '' }));
            } catch (err) {
              console.error("Browser location reverse lookup failed:", err);
              setInputs(prev => ({ ...prev, currentLocation: '' }));
            }
          },
          (err) => {
            console.log("Browser geolocation permission denied or timed out.", err);
            setInputs(prev => ({ ...prev, currentLocation: '' }));
          },
          { timeout: 8000 }
        );
      } else {
        setInputs(prev => ({ ...prev, currentLocation: '' }));
      }
    };

    initLocation();
  }, []);

  return (
    <div className="trip-planner-page-layout">
      {/* Sidebar Navigation */}
      <Sidebar activeTab="plan-trip" onTabChange={onTabChange} onNewDispatch={onNewDispatch} />

      {/* Main Panel */}
      <div className="planner-main-panel">
        
        {/* Top Navbar */}
        <header className="planner-top-header">
          
          <div className="hdr-widgets">
           
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
              <div className="planner-input-group relative-position">
                <label className="planner-input-lbl">CURRENT LOCATION</label>
                <div className="planner-input-wrapper">
                  <FiMapPin className="input-icon-left text-orange" />
                  <input 
                    type="text" 
                    value={inputs.currentLocation} 
                    onChange={e => handleFetchSuggestions('current', e.target.value)}
                    onFocus={() => setActiveField('current')}
                    onBlur={() => setTimeout(() => setActiveField(null), 250)}
                    placeholder="Enter starting address"
                    required
                    autoComplete="off"
                  />
                </div>
                {activeField === 'current' && suggestions.current.length > 0 && (
                  <div className="planner-suggestions-dropdown">
                    {suggestions.current.map((s, idx) => (
                      <div key={idx} className="planner-suggestion-item" onMouseDown={() => handleSelectSuggestion('current', s)}>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="planner-input-group relative-position">
                <label className="planner-input-lbl">PICKUP LOCATION</label>
                <div className="planner-input-wrapper">
                  <FiMapPin className="input-icon-left text-blue" />
                  <input 
                    type="text" 
                    value={inputs.pickupLocation}
                    onChange={e => handleFetchSuggestions('pickup', e.target.value)}
                    onFocus={() => setActiveField('pickup')}
                    onBlur={() => setTimeout(() => setActiveField(null), 250)}
                    placeholder="Enter pickup address"
                    required
                    autoComplete="off"
                  />
                </div>
                {activeField === 'pickup' && suggestions.pickup.length > 0 && (
                  <div className="planner-suggestions-dropdown">
                    {suggestions.pickup.map((s, idx) => (
                      <div key={idx} className="planner-suggestion-item" onMouseDown={() => handleSelectSuggestion('pickup', s)}>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="planner-input-group relative-position">
                <label className="planner-input-lbl">DROPOFF LOCATION</label>
                <div className="planner-input-wrapper">
                  <FiMapPin className="input-icon-left text-green" />
                  <input 
                    type="text" 
                    value={inputs.dropoffLocation}
                    onChange={e => handleFetchSuggestions('dropoff', e.target.value)}
                    onFocus={() => setActiveField('dropoff')}
                    onBlur={() => setTimeout(() => setActiveField(null), 250)}
                    placeholder="Enter destination address"
                    required
                    autoComplete="off"
                  />
                </div>
                {activeField === 'dropoff' && suggestions.dropoff.length > 0 && (
                  <div className="planner-suggestions-dropdown">
                    {suggestions.dropoff.map((s, idx) => (
                      <div key={idx} className="planner-suggestion-item" onMouseDown={() => handleSelectSuggestion('dropoff', s)}>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="planner-row-inputs">
                <div className="planner-input-group">
                  <label className="planner-input-lbl">CYCLE HOURS</label>
                  <input 
                    type="number" 
                    className="planner-raw-input"
                    value={inputs.cycleHours}
                    onChange={e => {
                      setInputs({ ...inputs, cycleHours: e.target.value });
                      setMetrics(prev => ({ ...prev, remainingCycle: e.target.value || 0 }));
                    }}
                    min="1"
                    max="70"
                    step="0.1"
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

              {/* ── Driver Info section ── */}
              <div className="planner-section-divider">
                <span>DRIVER &amp; VEHICLE INFO</span>
              </div>

              <div className="planner-row-inputs">
                <div className="planner-input-group">
                  <label className="planner-input-lbl">DRIVER NAME</label>
                  <input
                    type="text"
                    className="planner-raw-input"
                    placeholder="e.g. Alex Rivera"
                    value={driverInfo?.driverName || ''}
                    onChange={e => setDriverInfo(prev => ({ ...prev, driverName: e.target.value }))}
                  />
                </div>
                <div className="planner-input-group">
                  <label className="planner-input-lbl">DRIVER ID</label>
                  <input
                    id="driver-id-input"
                    type="text"
                    className={`planner-raw-input${driverIdError ? ' driver-id-error-input' : ''}`}
                    placeholder="e.g. #44920"
                    value={driverInfo?.driverId || ''}
                    onChange={e => {
                      setDriverInfo(prev => ({ ...prev, driverId: e.target.value }));
                      if (e.target.value.trim()) setDriverIdError(false);
                    }}
                    onBlur={handleDriverIdBlur}
                  />
                  {driverIdError && (
                    <div className="driver-id-error-msg">
                      ⚠️ Driver ID is required to generate a route.
                    </div>
                  )}
                </div>
              </div>

              <div className="planner-row-inputs">
                <div className="planner-input-group">
                  <label className="planner-input-lbl">TRUCK / VEHICLE #</label>
                  <input
                    type="text"
                    className="planner-raw-input"
                    placeholder="e.g. TRK-492"
                    value={driverInfo?.truckNumber || ''}
                    onChange={e => setDriverInfo(prev => ({ ...prev, truckNumber: e.target.value }))}
                  />
                </div>
                <div className="planner-input-group">
                  <label className="planner-input-lbl">CO-DRIVER</label>
                  <input
                    type="text"
                    className="planner-raw-input"
                    placeholder="None"
                    value={driverInfo?.coDriver || ''}
                    onChange={e => setDriverInfo(prev => ({ ...prev, coDriver: e.target.value }))}
                  />
                </div>
              </div>

              <div className="planner-row-inputs">
                <div className="planner-input-group">
                  <label className="planner-input-lbl">CARRIER NAME</label>
                  <input
                    type="text"
                    className="planner-raw-input"
                    placeholder="e.g. Spotter Labs LLC"
                    value={driverInfo?.carrierId || ''}
                    onChange={e => setDriverInfo(prev => ({ ...prev, carrierId: e.target.value }))}
                  />
                </div>
                <div className="planner-input-group">
                  <label className="planner-input-lbl">MAIN OFFICE / HQ</label>
                  <input
                    type="text"
                    className="planner-raw-input"
                    placeholder="e.g. Chicago, IL"
                    value={driverInfo?.mainOffice || ''}
                    onChange={e => setDriverInfo(prev => ({ ...prev, mainOffice: e.target.value }))}
                  />
                </div>
              </div>

              <button type="submit" className="planner-btn-orange" disabled={loading}>
                <FiCpu className="btn-cpu-icon" /> {loading ? 'GENERATING...' : 'GENERATE ROUTE'}
              </button>

              {/* Start Journey Button - shown only after route is generated */}
              {tripPlanState.routeReady && !tripPlanState.tripStarted && (
                <button
                  type="button"
                  className="planner-btn-start-journey"
                  onClick={handleStartJourney}
                >
                  <FiPlay className="btn-play-icon" />
                  START JOURNEY
                </button>
              )}

              {/* Trip Active Status - shown after journey started */}
              {tripPlanState.tripStarted && (
                <div className="trip-active-status-card">
                  <div className="trip-active-top-row">
                    <span className="trip-active-dot" />
                    <span className="trip-active-label">TRIP IN PROGRESS</span>
                  </div>
                  <div className="trip-active-dest">
                    📍 {inputs.dropoffLocation || 'Destination'}
                  </div>
                  <div className="trip-active-timer">
                    ⏱ Elapsed: <span className="trip-timer-value">{formatElapsed(elapsedSeconds)}</span>
                  </div>
                  <div className="trip-active-eta">
                    ETA: {metrics.eta} · {metrics.etaDate}
                  </div>
                </div>
              )}
            </form>

            {error && <div className="planner-error-box">{error}</div>}

            {/* Route nodes preview widget */}
            <div className="route-nodes-preview-section">
              <h4 className="preview-heading">ROUTE NODES PREVIEW</h4>
              <div className="preview-nodes-list">
                <div className="preview-node-item">
                  <span className="node-marker start"></span>
                  <div className="node-details">
                    <span className="node-title">Start: Depart Terminal</span>
                    <span className="node-address">{inputs.currentLocation}</span>
                  </div>
                </div>

                {plannedStops.length > 0 ? (
                  plannedStops.map((stop, idx) => {
                    let markerClass = "dropoff";
                    let title = "Stop";
                    if (stop.type === 'pickup') {
                      markerClass = "pickup";
                      title = "Pickup Stop";
                    } else if (stop.type === 'fuel') {
                      markerClass = "fuel";
                      title = "Fuel Stop";
                    } else if (stop.type === 'rest') {
                      markerClass = "rest";
                      title = "Mandatory Rest Break";
                    } else if (stop.type === 'dropoff') {
                      markerClass = "dropoff";
                      title = "Destination Dropoff";
                    }
                    return (
                      <div className="preview-node-item" key={idx}>
                        <span className={`node-marker ${markerClass}`}></span>
                        <div className="node-details">
                          <span className="node-title">{title} ({stop.duration_hrs}h)</span>
                          <span className="node-address">{stop.location}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <>
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
                  </>
                )}
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
              stops={plannedStops}
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
                <span className="metric-sub-lbl text-green">{metrics.distance > 0 ? '● OPTIMIZED' : '—'}</span>
              </div>
              <div className="metric-col">
                <span className="metric-lbl">ESTIMATED DRIVE TIME</span>
                <span className="metric-val">{metrics.driveTime} hrs</span>
                <div className="metric-progress-track">
                  <div className="metric-progress-fill" style={{ width: `${metrics.driveTime > 0 ? Math.min((metrics.driveTime / 70) * 100, 100) : 0}%` }}></div>
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
                <span className="metric-sub-lbl text-red">
                  {metrics.distance > 0 ? (
                    plannedStops.some(s => s.type === 'rest' && s.duration_hrs === 34.0) ? '34H RESTART SCHED.' : 
                    plannedStops.some(s => s.type === 'rest') ? '10H RESET SCHED.' : 'NO RESET REQUIRED'
                  ) : '—'}
                </span>
              </div>
              <div className="metric-col">
                <span className="metric-lbl">FUEL STOPS</span>
                <span className="metric-val">{metrics.fuelStops.toString().padStart(2, '0')}</span>
                <div className="indicator-dashes">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={`dash ${i < metrics.fuelStops ? 'active' : ''}`}></span>
                  ))}
                </div>
              </div>
              <div className="metric-col">
                <span className="metric-lbl">REST STOPS</span>
                <span className="metric-val">{metrics.restStops.toString().padStart(2, '0')}</span>
                <div className="indicator-dashes">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={`dash ${i < metrics.restStops ? 'active' : ''}`}></span>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Driver Hours Status Modal */}
      {driverHoursModal.show && (
        <div className="warning-modal-overlay">
          <div className="warning-modal-content" style={{ border: '1px solid #3b82f6', boxShadow: '0 0 25px rgba(59, 130, 246, 0.25)' }}>
            <div className="warning-modal-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>ℹ️</div>
            <h3 className="warning-modal-title" style={{ color: '#60a5fa' }}>DRIVER CYCLE HOURS STATUS</h3>
            <p className="warning-modal-text">
              {driverHoursModal.driverName && driverHoursModal.driverName.trim() !== '' && driverHoursModal.driverName !== 'Driver' && driverHoursModal.driverName !== 'Unknown Driver' ? (
                <>
                  Driver <span className="warning-highlight" style={{ color: '#60a5fa' }}>{driverHoursModal.driverName}</span> {driverHoursModal.driverId ? `(#${driverHoursModal.driverId})` : ''} has <span className="warning-highlight" style={{ color: '#10b981' }}>{driverHoursModal.hoursLeft} hours left</span> per week / 70-hr cycle.
                </>
              ) : (
                <>
                  You have <span className="warning-highlight" style={{ color: '#10b981' }}>{driverHoursModal.hoursLeft} hours left</span> per week / 70-hr cycle.
                </>
              )}
            </p>
            <p className="warning-modal-subtext">
              Route and HOS metrics have been configured according to available cycle hours.
            </p>
            <button 
              className="warning-modal-btn"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#ffffff' }}
              onClick={() => setDriverHoursModal({ show: false, hoursLeft: 0, driverName: '', driverId: '' })}
            >
              PROCEED TO ROUTE
            </button>
          </div>
        </div>
      )}

      {/* FMCSA HOS Compliance Warning Modal */}
      {warningModal.show && (
        <div className="warning-modal-overlay">
          <div className="warning-modal-content">
            <div className="warning-modal-icon">⚠️</div>
            <h3 className="warning-modal-title">FMSCA HOS CYCLE VIOLATION</h3>
            <p className="warning-modal-text">
              The calculated route exceeds the driver's available hours of service (HOS) cycle by <span className="warning-highlight">{warningModal.hours} hours</span>.
            </p>
            <p className="warning-modal-subtext">
              Spotter has scheduled the necessary 34H Rest Stops to reset the driver's cycle. Please review the updated log sheet and route details.
            </p>
            <button 
              className="warning-modal-btn" 
              onClick={() => setWarningModal({ show: false, hours: 0 })}
            >
              ACKNOWLEDGE WARNING
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
