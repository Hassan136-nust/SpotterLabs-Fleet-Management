from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import TripPlanRequestSerializer
from .services.routing import geocode_address, get_hgv_route
from .services.hos_engine import plan_trip

class PlanTripAPIView(APIView):
    def post(self, request, *args, **kwargs):
        serializer = TripPlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        data = serializer.validated_data
        current_loc = data['current_location']
        pickup_loc = data['pickup_location']
        dropoff_loc = data['dropoff_location']
        cycle_used = data['current_cycle_used']
        
        # 1. Geocode locations
        current_coords = geocode_address(current_loc)
        pickup_coords = geocode_address(pickup_loc)
        dropoff_coords = geocode_address(dropoff_loc)
        
        if not current_coords or not pickup_coords or not dropoff_coords:
            return Response(
                {"error": "Failed to geocode one or more of the specified locations. Please verify spelling."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 2. Get route legs combined distance & duration
        # We query directions between current -> pickup and pickup -> dropoff
        leg1_route = get_hgv_route(
            [current_coords['lat'], current_coords['lon']],
            [pickup_coords['lat'], pickup_coords['lon']]
        )
        leg2_route = get_hgv_route(
            [pickup_coords['lat'], pickup_coords['lon']],
            [dropoff_coords['lat'], dropoff_coords['lon']]
        )
        
        if not leg1_route or not leg2_route:
            return Response(
                {"error": "Failed to calculate driving routes between coordinates."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Combine routing metrics
        combined_route = {
            'distance_meters': leg1_route['distance_meters'] + leg2_route['distance_meters'],
            'duration_seconds': leg1_route['duration_seconds'] + leg2_route['duration_seconds'],
            'geometry': {
                'type': 'LineString',
                'coordinates': leg1_route['geometry']['coordinates'] + leg2_route['geometry']['coordinates']
            }
        }
        
        # 3. Simulate HOS
        try:
            trip_plan = plan_trip(
                current_location=current_coords['display_name'],
                pickup_location=pickup_coords['display_name'],
                dropoff_location=dropoff_coords['display_name'],
                cycle_used=cycle_used,
                route_data=combined_route
            )
            
            # Inject coordinates of pickup/dropoff into stops list for frontend map plotting
            for stop in trip_plan['stops']:
                if stop['type'] == 'pickup':
                    stop['lat'] = pickup_coords['lat']
                    stop['lng'] = pickup_coords['lon']
                elif stop['type'] == 'dropoff':
                    stop['lat'] = dropoff_coords['lat']
                    stop['lng'] = dropoff_coords['lon']
                    
            # Inject geometry for map polyline overlay
            trip_plan['route_geometry'] = combined_route['geometry']
            
            return Response(trip_plan, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": f"Failed to run HOS simulation engine: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
