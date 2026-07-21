from django.db import models

class Driver(models.Model):
    name = models.CharField(max_length=255)
    driver_id = models.CharField(max_length=100, unique=True)
    truck_number = models.CharField(max_length=100, blank=True)
    co_driver = models.CharField(max_length=255, blank=True)
    carrier_id = models.CharField(max_length=255, blank=True)
    main_office = models.CharField(max_length=255, blank=True)
    used_cycle_hours = models.FloatField(default=0.0)

    def __str__(self):
        return f"{self.name} ({self.driver_id})"

class TripDispatch(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, null=True, blank=True)
    is_complete = models.BooleanField(default=False)
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
