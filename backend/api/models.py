from django.db import models

class TripDispatch(models.Model):
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    cycle_hours = models.FloatField()
    
    # Solved Results
    distance_miles = models.FloatField()
    drive_hours = models.FloatField()
    eta = models.CharField(max_length=50)
    eta_date = models.CharField(max_length=50)
    
    # JSON Structures
    stops_data = models.JSONField()
    logs_data = models.JSONField()
    route_geometry = models.JSONField()
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.pickup_location} -> {self.dropoff_location} ({self.distance_miles} mi)"
