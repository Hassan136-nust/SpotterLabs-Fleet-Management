import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import './MapContainer.css';

const MapContainer = ({ currentLoc, pickupLoc, dropoffLoc, routeGeometry }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    markers: [],
    route: null
  });

  // Inject Leaflet CSS dynamically if not present
  useEffect(() => {
    const cssId = 'leaflet-css-link';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create Leaflet Map instance
    const map = L.map(mapRef.current, {
      center: [39.8283, -98.5795], // Default center of US
      zoom: 4,
      zoomControl: true
    });

    // Add Free OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers & Polyline when coords or route changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old layers
    layersRef.current.markers.forEach(marker => marker.remove());
    layersRef.current.markers = [];
    
    if (layersRef.current.route) {
      layersRef.current.route.remove();
      layersRef.current.route = null;
    }

    const bounds = [];

    // Helper to create premium circular markers
    const createCustomMarker = (latlng, color, label, title) => {
      const marker = L.circleMarker(latlng, {
        radius: 10,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; color: #1e293b; padding: 4px;">
          <strong style="text-transform: uppercase; font-size: 10px; color: ${color}; letter-spacing: 0.05em;">${title}</strong>
          <div style="font-weight: 600; font-size: 13px; margin-top: 2px;">${label}</div>
        </div>
      `);

      layersRef.current.markers.push(marker);
      bounds.push(latlng);
      return marker;
    };

    // Add Current Location
    if (currentLoc) {
      createCustomMarker([currentLoc.lat, currentLoc.lon], '#6366f1', currentLoc.displayName.split(',')[0], 'Current Location');
    }

    // Add Pickup Location
    if (pickupLoc) {
      createCustomMarker([pickupLoc.lat, pickupLoc.lon], '#10b981', pickupLoc.displayName.split(',')[0], 'Pickup Point');
    }

    // Add Dropoff Location
    if (dropoffLoc) {
      createCustomMarker([dropoffLoc.lat, dropoffLoc.lon], '#ef4444', dropoffLoc.displayName.split(',')[0], 'Dropoff Point');
    }

    // Add Route Polyline
    if (routeGeometry) {
      // Decode OSRM route geometry (OSRM returns geojson coordinates as [lon, lat])
      const latlngs = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);
      
      const polyline = L.polyline(latlngs, {
        color: '#6366f1',
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      layersRef.current.route = polyline;
      
      // Extend bounds to cover entire route
      polyline.getBounds();
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    } else if (bounds.length > 0) {
      // If no route, fit bounds to markers
      map.fitBounds(L.latLngBounds(bounds), { maxZoom: 10, padding: [50, 50] });
    }
  }, [currentLoc, pickupLoc, dropoffLoc, routeGeometry]);

  return (
    <div className="map-wrapper">
      <div ref={mapRef} className="leaflet-map-container" />
    </div>
  );
};

export default MapContainer;
