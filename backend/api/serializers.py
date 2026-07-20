from rest_framework import serializers

class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(required=True, max_length=255)
    pickup_location = serializers.CharField(required=True, max_length=255)
    dropoff_location = serializers.CharField(required=True, max_length=255)
    current_cycle_used = serializers.FloatField(required=True, min_value=0, max_value=70)
