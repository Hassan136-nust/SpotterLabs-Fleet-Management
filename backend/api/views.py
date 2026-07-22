from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import TripPlanRequestSerializer, DriverSerializer
from .services.routing import geocode_address, get_hgv_route
from .services.hos_engine import plan_trip
from .models import TripDispatch, Driver

class PlanTripAPIView(APIView):
    def post(self, request, *args, **kwargs):
        serializer = TripPlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        data = serializer.validated_data
        
        # Driver handling
        driver_id = data.get('driver_id')
        driver = None
        if driver_id:
            driver, _ = Driver.objects.get_or_create(
                driver_id=driver_id,
                defaults={
                    'name': data.get('driver_name', 'Unknown Driver'),
                    'truck_number': data.get('truck_number', ''),
                    'co_driver': data.get('co_driver', 'None'),
                    'carrier_id': data.get('carrier_id', ''),
                    'main_office': data.get('main_office', ''),
                    'used_cycle_hours': 0.0
                }
            )
            # Use driver's actual cycle hours if they exist
            cycle_used = driver.used_cycle_hours
        else:
            cycle_used = data.get('current_cycle_used', 0.0)

        current_loc = data['current_location']
        pickup_loc = data['pickup_location']
        dropoff_loc = data['dropoff_location']
        
        # 1. Geocode locations
        current_coords = geocode_address(current_loc)
        pickup_coords = geocode_address(pickup_loc)
        dropoff_coords = geocode_address(dropoff_loc)
        
        if not current_coords or not pickup_coords or not dropoff_coords:
            missing = []
            if not current_coords: missing.append(f"current_location: '{current_loc}'")
            if not pickup_coords:  missing.append(f"pickup_location: '{pickup_loc}'")
            if not dropoff_coords: missing.append(f"dropoff_location: '{dropoff_loc}'")
            return Response(
                {"error": f"Failed to geocode: {', '.join(missing)}. Please verify spelling or try a more specific address (e.g. 'Chicago, IL, USA')."},
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
                driver=driver,
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
            import traceback
            return Response(
                {"error": f"HOS engine error: {str(e)}", "detail": traceback.format_exc()},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class HistoryAPIView(APIView):
    def get(self, request, *args, **kwargs):
        dispatches = TripDispatch.objects.select_related('driver').all().order_by('-created_at')
        records = []
        for d in dispatches:
            records.append({
                "id": d.id,
                "driver_name": d.driver.name if d.driver else "Unassigned",
                "driver_id": d.driver.driver_id if d.driver else "",
                "is_complete": d.is_complete,
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

class DriverAPIView(APIView):
    def get(self, request, driver_id, *args, **kwargs):
        try:
            driver = Driver.objects.get(driver_id=driver_id)
            serializer = DriverSerializer(driver)
            data = serializer.data
            data['remaining_cycle_hours'] = max(0.0, 70.0 - driver.used_cycle_hours)
            return Response(data, status=status.HTTP_200_OK)
        except Driver.DoesNotExist:
            return Response({
                "driver_id": driver_id,
                "name": "",
                "used_cycle_hours": 0.0,
                "remaining_cycle_hours": 70.0,
                "is_new": True
            }, status=status.HTTP_200_OK)

class CompleteTripAPIView(APIView):
    def post(self, request, *args, **kwargs):
        dispatch_id = request.data.get('dispatch_id')
        if not dispatch_id:
            return Response({"error": "dispatch_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            dispatch = TripDispatch.objects.get(id=dispatch_id)
            if dispatch.is_complete:
                return Response({"message": "Trip is already complete"}, status=status.HTTP_200_OK)
                
            dispatch.is_complete = True
            dispatch.save()
            
            driver = dispatch.driver
            if driver:
                # Add total driving + on-duty time from the logs to driver's cycle
                total_used = 0
                for day in dispatch.logs_data:
                    totals = day.get('totals', {})
                    total_used += totals.get('driving', 0) + totals.get('on_duty', 0)
                
                driver.used_cycle_hours += total_used
                driver.save()
                
            return Response({"message": "Trip completed successfully", "used_added": total_used if driver else 0}, status=status.HTTP_200_OK)
        except TripDispatch.DoesNotExist:
            return Response({"error": "Trip dispatch not found"}, status=status.HTTP_404_NOT_FOUND)

