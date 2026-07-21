from rest_framework import serializers
from .models import Driver, TripDispatch

class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = '__all__'

class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(required=True, max_length=255)
    pickup_location = serializers.CharField(required=True, max_length=255)
    dropoff_location = serializers.CharField(required=True, max_length=255)
    current_cycle_used = serializers.FloatField(required=True, min_value=0, max_value=70)
    
    # Driver Info
    driver_id = serializers.CharField(required=False, allow_blank=True, max_length=100)
    driver_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    truck_number = serializers.CharField(required=False, allow_blank=True, max_length=100)
    co_driver = serializers.CharField(required=False, allow_blank=True, max_length=255)
    carrier_id = serializers.CharField(required=False, allow_blank=True, max_length=255)
    main_office = serializers.CharField(required=False, allow_blank=True, max_length=255)
