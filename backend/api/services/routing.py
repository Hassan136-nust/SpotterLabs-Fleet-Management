import requests
import urllib.parse
from django.conf import settings

ORS_API_KEY = getattr(settings, 'OPENROUTE_SERVICE_API_KEY', None)

# Generous timeouts for Render free tier outbound requests
GEOCODE_TIMEOUT = 20
ROUTE_TIMEOUT   = 25


def geocode_address(query: str) -> dict:
    """
    Geocode an address using OpenRouteService (if key set) or Nominatim fallback.
    Returns { lat, lon, display_name } or None.
    """
    if not query or query.strip() == "":
        return None

    # --- Try OpenRouteService ---
    if ORS_API_KEY:
        try:
            url = (
                f"https://api.openrouteservice.org/geocode/search"
                f"?text={urllib.parse.quote(query)}&api_key={ORS_API_KEY}&size=1"
            )
            response = requests.get(url, timeout=GEOCODE_TIMEOUT)
            if response.status_code == 200:
                data = response.json()
                if data.get('features'):
                    coords = data['features'][0]['geometry']['coordinates']  # [lon, lat]
                    display_name = data['features'][0]['properties'].get('label', query)
                    return {'lat': coords[1], 'lon': coords[0], 'display_name': display_name}
        except Exception as e:
            print(f"ORS Geocoding failed: {e}")

    # --- Fallback: Nominatim (OpenStreetMap) ---
    try:
        headers = {'User-Agent': 'SpotterLabsELDRoutePlannerBackend/1.0'}
        url = (
            f"https://nominatim.openstreetmap.org/search"
            f"?format=json&q={urllib.parse.quote(query)}&limit=1&addressdetails=0"
        )
        response = requests.get(url, headers=headers, timeout=GEOCODE_TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            if data:
                return {
                    'lat': float(data[0]['lat']),
                    'lon': float(data[0]['lon']),
                    'display_name': data[0].get('display_name', query)
                }
    except Exception as e:
        print(f"Nominatim geocoding failed: {e}")

    return None


def get_hgv_route(start_coords: list, end_coords: list) -> dict:
    """
    Get a driving route between two [lat, lon] points.
    Returns { distance_meters, duration_seconds, geometry } or None.
    Tries ORS HGV profile first, falls back to OSRM car profile.
    """
    # --- Try OpenRouteService HGV ---
    if ORS_API_KEY:
        try:
            url = (
                f"https://api.openrouteservice.org/v2/directions/driving-hgv"
                f"?api_key={ORS_API_KEY}"
                f"&start={start_coords[1]},{start_coords[0]}"
                f"&end={end_coords[1]},{end_coords[0]}"
            )
            response = requests.get(url, timeout=ROUTE_TIMEOUT)
            if response.status_code == 200:
                data = response.json()
                if data.get('features'):
                    route   = data['features'][0]
                    summary = route['properties']['summary']
                    return {
                        'distance_meters':  summary['distance'],
                        'duration_seconds': summary['duration'],
                        'geometry':         route['geometry']
                    }
        except Exception as e:
            print(f"ORS HGV routing failed: {e}")

    # --- Fallback: OSRM ---
    try:
        coord_string = f"{start_coords[1]},{start_coords[0]};{end_coords[1]},{end_coords[0]}"
        url = (
            f"http://router.project-osrm.org/route/v1/driving/{coord_string}"
            f"?overview=full&geometries=geojson"
        )
        response = requests.get(url, timeout=ROUTE_TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 'Ok' and data.get('routes'):
                route = data['routes'][0]
                return {
                    'distance_meters':  route['distance'],
                    'duration_seconds': route['duration'],
                    'geometry':         route['geometry']
                }
    except Exception as e:
        print(f"OSRM routing failed: {e}")

    return None
