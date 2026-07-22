import React, { useState } from 'react';
import TruckAnimation from './components/TruckAnimation';
import Homepage from './components/Homepage';
import TripPlanner from './components/TripPlanner';
import RoutesPage from './components/RoutesPage';
import ELDLogsPage from './components/ELDLogsPage';
import HistoryPage from './components/HistoryPage';
import Sidebar from './components/Sidebar';
import './index.css';

function App() {
  const [showApp, setShowApp] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);
  const [activeTab, setActiveTab] = useState('homepage');

  // Shared ELD calculation results so the ELD Logs tab can display them!
  const [eldResult, setEldResult] = useState(null);

  // Driver / carrier info — shared between TripPlanner form and ELD logs
  const [driverInfo, setDriverInfo] = useState({
    driverName:  '',
    driverId:    '',
    truckNumber: '',
    coDriver:    'None',
    carrierId:   '',
    mainOffice:  ''
  });

  // Centered Trip Plan State for persistence across tab changes
  const [tripPlanState, setTripPlanState] = useState({
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
    plannedStops: [],
    tripStarted: false,
    startTimestamp: null,
    dispatchId: null,
    routeReady: false,
    eldUnsavedChanges: true
  });

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    window.scrollTo(0, 0);
  };

  const handleNewDispatch = () => {
    // Reset driver info and trip plan state for a new journey
    setDriverInfo({
      driverName:  '',
      driverId:    '',
      truckNumber: '',
      coDriver:    'None',
      carrierId:   '',
      mainOffice:  ''
    });
    
    setTripPlanState({
      inputs: {
        currentLocation: 'Detecting location...',
        pickupLocation: '',
        dropoffLocation: '',
        cycleHours: '70',
        departureDate: new Date().toISOString().split('T')[0]
      },
      locations: { current: null, pickup: null, dropoff: null },
      routeGeometry: null,
      metrics: {
        distance: 0, driveTime: 0, eta: '—', etaDate: '—',
        remainingCycle: 70, fuelStops: 0, restStops: 0
      },
      plannedStops: [],
      tripStarted: false,
      startTimestamp: null,
      dispatchId: null,
      routeReady: false,
      eldUnsavedChanges: true
    });
    
    setEldResult(null);
    handleTabChange('plan-trip');
  };

  // Render content based on current active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'homepage':
        return <Homepage onTabChange={handleTabChange} onNewDispatch={handleNewDispatch} />;
        
      case 'plan-trip':
        return (
          <TripPlanner 
            onTabChange={handleTabChange} 
            onNewDispatch={handleNewDispatch}
            onEldSolved={(result) => setEldResult(result)}
            tripPlanState={tripPlanState}
            setTripPlanState={setTripPlanState}
            driverInfo={driverInfo}
            setDriverInfo={setDriverInfo}
          />
        );

      case 'routes':
        return (
          <RoutesPage 
            onTabChange={handleTabChange} 
            onNewDispatch={handleNewDispatch}
            tripPlanState={tripPlanState}
            setTripPlanState={setTripPlanState}
            onEldSolved={(result) => setEldResult(result)}
          />
        );
        
      case 'eld-logs':
        return (
          <ELDLogsPage 
            onTabChange={handleTabChange} 
            onNewDispatch={handleNewDispatch}
            eldResult={eldResult}
            driverInfo={driverInfo}
            tripPlanState={tripPlanState}
            setTripPlanState={setTripPlanState}
          />
        );

      case 'history':
        return (
          <HistoryPage 
            onTabChange={handleTabChange}
            onNewDispatch={handleNewDispatch}
          />
        );

      default:
        // Placeholder for other tabs (Settings)
        return (
          <div className="tab-page-container">
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange} onNewDispatch={handleNewDispatch} />
            <div className="tab-page-content">
              <header className="tab-content-header">
                <h2 className="tab-page-title" style={{ textTransform: 'capitalize' }}>{activeTab} Management</h2>
                <p className="tab-page-subtitle">This section is currently being optimized by Spotter.ai's network engine.</p>
              </header>
              <div className="empty-state-card">
                <span className="empty-state-icon">⚙️</span>
                <h3>System Module Online</h3>
                <p>Telemetry stream active. High-fidelity visualization for <strong>{activeTab}</strong> will be online shortly.</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app-root">
      {showApp && renderTabContent()}
      
      {!animationFinished && (
        <TruckAnimation 
          onExitStart={() => {
            setShowApp(true);
            window.scrollTo(0, 0);
          }}
          onTransitionComplete={() => setAnimationFinished(true)} 
        />
      )}
    </div>
  );
}

export default App;
