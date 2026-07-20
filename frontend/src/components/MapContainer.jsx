import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import './MapContainer.css';

const MapContainer = ({ currentLoc, pickupLoc, dropoffLoc, routeGeometry, stops }) => {
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

    // Add Free CartoDB Dark Matter Tile Layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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
      if (Array.isArray(layersRef.current.route)) {
        layersRef.current.route.forEach(r => r.remove());
      } else {
        layersRef.current.route.remove();
      }
      layersRef.current.route = null;
    }

    const bounds = [];

    // Helper to create glowing HTML markers
    const createCustomMarker = (latlng, color, label, title, initial) => {
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker-wrap',
        html: `
          <div class="custom-map-marker-pulse" style="border-color: ${color}; box-shadow: 0 0 10px ${color};">
            <div class="custom-map-marker-dot" style="background-color: ${color};"></div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker(latlng, { icon: customIcon }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; color: #ffffff; background-color: #150f0c; border: 1px solid #2b201a; padding: 10px 14px; border-radius: 8px; box-shadow: 0 6px 12px rgba(0,0,0,0.5);">
          <strong style="text-transform: uppercase; font-size: 9px; color: ${color}; letter-spacing: 0.08em; display: block; margin-bottom: 2px;">${title}</strong>
          <div style="font-weight: 700; font-size: 13px; color: #ffffff;">${label}</div>
        </div>
      `, {
        className: 'custom-map-popup'
      });

      layersRef.current.markers.push(marker);
      bounds.push(latlng);
      return marker;
    };

    // Draw all stops dynamically
    if (stops && stops.length > 0) {
      stops.forEach(stop => {
        if (stop.lat && stop.lng) {
          let color = '#ff6b00';
          let title = 'STOP';
          let initial = '•';

          if (stop.type === 'start') {
            color = '#ff6b00';
            title = 'START TERMINAL';
            initial = 'S';
          } else if (stop.type === 'pickup') {
            color = '#3b82f6';
            title = 'PICKUP STOP';
            initial = 'P';
          } else if (stop.type === 'dropoff') {
            color = '#10b981';
            title = 'DESTINATION DROPOFF';
            initial = 'D';
          } else if (stop.type === 'fuel') {
            color = '#eab308';
            title = 'FUEL STOP';
            initial = 'F';
          } else if (stop.type === 'rest') {
            color = '#64748b';
            title = 'REST STOP';
            initial = 'R';
          }

          createCustomMarker([stop.lat, stop.lng], color, stop.location, title, initial);
        }
      });
    } else {
      // Fallback to primary markers
      if (currentLoc) {
        createCustomMarker([currentLoc.lat, currentLoc.lon], '#ff6b00', currentLoc.displayName, 'START TERMINAL', 'S');
      }
      if (pickupLoc) {
        createCustomMarker([pickupLoc.lat, pickupLoc.lon], '#3b82f6', pickupLoc.displayName, 'PICKUP STOP', 'P');
      }
      if (dropoffLoc) {
        createCustomMarker([dropoffLoc.lat, dropoffLoc.lon], '#10b981', dropoffLoc.displayName, 'DESTINATION DROPOFF', 'D');
      }
    }

    // Add Route Polyline
    if (routeGeometry) {
      const latlngs = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);
      
      // 1. Semi-transparent background glow layer
      const glowPolyline = L.polyline(latlngs, {
        color: '#ff6b00',
        weight: 8,
        opacity: 0.25,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // 2. High opacity main route layer
      const mainPolyline = L.polyline(latlngs, {
        color: '#ff6b00',
        weight: 3.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      layersRef.current.route = [glowPolyline, mainPolyline];
      
      map.fitBounds(mainPolyline.getBounds(), { padding: [50, 50] });
    } else if (bounds.length > 0) {
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
