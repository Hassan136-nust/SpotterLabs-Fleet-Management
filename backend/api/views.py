from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import TripPlanRequestSerializer
from .services.routing import geocode_address, get_hgv_route
from .services.hos_engine import plan_trip
from .models import TripDispatch

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
            
            # Save the dispatch to the database
            drive_hours_sum = sum(leg['drive_hours'] for leg in trip_plan['legs'])
            final_day = trip_plan['daily_logs'][-1]
            final_event = final_day['events'][-1] if final_day['events'] else None
            eta_time = final_event['start'] if final_event else '06:00 PM'
            
            dispatch_record = TripDispatch.objects.create(
                current_location=current_coords['display_name'],
                pickup_location=pickup_coords['display_name'],
                dropoff_location=dropoff_coords['display_name'],
                cycle_hours=cycle_used,
                distance_miles=trip_plan['total_miles'],
                drive_hours=drive_hours_sum,
                eta=eta_time,
                eta_date=final_day['date'],
                stops_data=trip_plan['stops'],
                logs_data=trip_plan['daily_logs'],
                route_geometry=trip_plan['route_geometry']
            )
            
            # Include db record id in response
            trip_plan['dispatch_id'] = dispatch_record.id
            
            return Response(trip_plan, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": f"Failed to run HOS simulation engine: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class HistoryAPIView(APIView):
    def get(self, request, *args, **kwargs):
        dispatches = TripDispatch.objects.all().order_by('-created_at')
        records = []
        for d in dispatches:
            records.append({
                "id": d.id,
                "current_location": d.current_location,
                "pickup_location": d.pickup_location,
                "dropoff_location": d.dropoff_location,
                "cycle_hours": d.cycle_hours,
                "distance_miles": d.distance_miles,
                "drive_hours": d.drive_hours,
                "eta": d.eta,
                "eta_date": d.eta_date,
                "created_at": d.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        return Response(records, status=status.HTTP_200_OK)

