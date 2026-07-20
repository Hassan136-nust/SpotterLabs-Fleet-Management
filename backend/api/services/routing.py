import requests
import urllib.parse
from django.conf import settings

ORS_API_KEY = getattr(settings, 'OPENROUTE_SERVICE_API_KEY', None)

def geocode_address(query: str) -> dict:
    """
    Geocode an address to [lon, lat] using OpenRouteService or fallback to Nominatim.
    """
    if not query or query.strip() == "":
        return None

    # Try OpenRouteService if API key is present
    if ORS_API_KEY:
        try:
            url = f"https://api.openrouteservice.org/geocode/search?text={urllib.parse.quote(query)}&api_key={ORS_API_KEY}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('features'):
                    coords = data['features'][0]['geometry']['coordinates'] # [lon, lat]
                    display_name = data['features'][0]['properties'].get('label', query)
                    return {
                        'lat': coords[1],
                        'lon': coords[0],
                        'display_name': display_name
                    }
        except Exception as e:
            print(f"ORS Geocoding failed: {e}")

    # Fallback to keyless Nominatim (same as frontend)
    try:
        headers = {'User-Agent': 'SpotterLabsELDRoutePlannerBackend/1.0'}
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(query)}&limit=1"
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data:
                return {
                    'lat': float(data[0]['lat']),
                    'lon': float(data[0]['lon']),
                    'display_name': data[0]['display_name']
                }
    except Exception as e:
        print(f"Nominatim geocoding fallback failed: {e}")
        
    return None

def get_hgv_route(start_coords: list, end_coords: list) -> dict:
    """
    Get directions route between coordinates using ORS or fallback to OSRM.
    start_coords: [lat, lon]
    end_coords: [lat, lon]
    """
    # Try OpenRouteService
    if ORS_API_KEY:
        try:
            url = f"https://api.openrouteservice.org/v2/directions/driving-hgv?api_key={ORS_API_KEY}&start={start_coords[1]},{start_coords[0]}&end={end_coords[1]},{end_coords[0]}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('features'):
                    route = data['features'][0]
                    summary = route['properties']['summary']
                    return {
                        'distance_meters': summary['distance'], # meters
                        'duration_seconds': summary['duration'], # seconds
                        'geometry': route['geometry'] # GeoJSON geometry
                    }
        except Exception as e:
            print(f"ORS Directions failed: {e}")

    # Fallback to OSRM (keyless)
    try:
        coord_string = f"{start_coords[1]},{start_coords[0]};{end_coords[1]},{end_coords[0]}"
        url = f"http://router.project-osrm.org/route/v1/driving/{coord_string}?overview=full&geometries=geojson"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 'Ok' and data.get('routes'):
                route = data['routes'][0]
                return {
                    'distance_meters': route['distance'],
                    'duration_seconds': route['duration'],
                    'geometry': route['geometry']
                }
    except Exception as e:
        print(f"OSRM Directions fallback failed: {e}")
        
    return None
