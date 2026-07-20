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

    // SVG icons definition (Feather Icons format)
    const flagIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;
    const boxIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`;
    const fuelIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M3 22V2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v20"></path><path d="M17 22h-2v-4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v4H9"></path><circle cx="10" cy="7" r="2"></circle><path d="M19 5h1a1 1 0 0 1 1 1v5a2 2 0 0 1-2 2h-1"></path></svg>`;
    const coffeeIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`;
    const warehouseIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;

    // Helper to create glowing HTML markers with SVGs
    const createCustomMarker = (latlng, color, label, title, iconHtml) => {
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker-wrap',
        html: `
          <div class="custom-map-marker-pulse" style="border-color: ${color}; box-shadow: 0 0 12px ${color}; background-color: ${color};">
            <div class="custom-map-marker-icon-container">${iconHtml}</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
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
          let iconHtml = '•';

          if (stop.type === 'start') {
            color = '#ff6b00';
            title = 'START TERMINAL';
            iconHtml = flagIcon;
          } else if (stop.type === 'pickup') {
            color = '#3b82f6';
            title = 'PICKUP STOP';
            iconHtml = boxIcon;
          } else if (stop.type === 'dropoff') {
            color = '#10b981';
            title = 'DESTINATION DROPOFF';
            iconHtml = warehouseIcon;
          } else if (stop.type === 'fuel') {
            color = '#eab308';
            title = 'FUEL STOP';
            iconHtml = fuelIcon;
          } else if (stop.type === 'rest') {
            color = '#64748b';
            title = 'REST STOP';
            iconHtml = coffeeIcon;
          }

          createCustomMarker([stop.lat, stop.lng], color, stop.location, title, iconHtml);
        }
      });
    } else {
      // Fallback to primary markers
      if (currentLoc) {
        createCustomMarker([currentLoc.lat, currentLoc.lon], '#ff6b00', currentLoc.displayName, 'START TERMINAL', flagIcon);
      }
      if (pickupLoc) {
        createCustomMarker([pickupLoc.lat, pickupLoc.lon], '#3b82f6', pickupLoc.displayName, 'PICKUP STOP', boxIcon);
      }
      if (dropoffLoc) {
        createCustomMarker([dropoffLoc.lat, dropoffLoc.lon], '#10b981', dropoffLoc.displayName, 'DESTINATION DROPOFF', warehouseIcon);
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

  // Smooth Google-Maps style flyTo zoom onto detected location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && currentLoc && !routeGeometry) {
      map.flyTo([currentLoc.lat, currentLoc.lon], 11, {
        animate: true,
        duration: 1.8
      });
    }
  }, [currentLoc, routeGeometry]);

  return (
    <div className="map-wrapper">
      <div ref={mapRef} className="leaflet-map-container" />
    </div>
  );
};

export default MapContainer;
