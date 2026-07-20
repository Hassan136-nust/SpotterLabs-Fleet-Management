/**
 * Service for Nominatim (Geocoding) and OSRM (Routing) APIs
 */

// Nominatim Geocoding API: search address to coordinates
export async function geocodeAddress(query) {
  if (!query || query.trim() === '') return null;
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SpotterLabsELDRoutePlanner/1.0'
        }
      }
    );
    
    if (!response.ok) throw new Error('Geocoding request failed');
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }
  } catch (error) {
    console.error('Error during geocoding:', error);
  }
  return null;
}

// OSRM Routing API: get route between points
export async function getRoute(coordinates) {
  // coordinates is array of [lat, lon]
  if (!coordinates || coordinates.length < 2) return null;
  
  // OSRM expects: lon,lat;lon,lat;...
  const coordString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
  
  try {
    const response = await fetch(
      `http://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`
    );
    
    if (!response.ok) throw new Error('Routing request failed');
    
    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distanceMeters: route.distance, // distance in meters
        durationSeconds: route.duration, // duration in seconds
        geometry: route.geometry // geojson geometry
      };
    }
  } catch (error) {
    console.error('Error fetching route:', error);
  }
  return null;
}
