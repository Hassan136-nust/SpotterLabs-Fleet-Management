import datetime
import math

# constants
MAX_DRIVING_HOURS = 11
MAX_WINDOW_HOURS = 14
MIN_RESET_HOURS = 10
BREAK_TRIGGER_HOURS = 8
BREAK_DURATION_MINUTES = 30
MAX_CYCLE_HOURS = 70
CYCLE_DAYS = 8
FUEL_INTERVAL_MILES = 1000
PICKUP_DROPOFF_HOURS = 1
AVERAGE_SPEED_MPH = 55

STATUS_OFF = "OFF"
STATUS_SB = "SB"
STATUS_D = "D"
STATUS_ON = "ON"

def haversine_distance(coord1, coord2):
    """Calculates haversine distance in miles between two coordinates [lon, lat]"""
    lon1, lat1 = coord1
    lon2, lat2 = coord2
    R = 3958.8  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def get_coordinate_at_distance(coordinates: list, target_miles: float) -> list:
    """Finds coordinates [lat, lon] at target_miles along the route geometry coordinates list [[lon, lat], ...]"""
    if not coordinates:
        return [39.8283, -98.5795]  # Default center of US
    if target_miles <= 0:
        return [coordinates[0][1], coordinates[0][0]]

    cumulative_dist = 0.0
    for i in range(len(coordinates) - 1):
        p1 = coordinates[i]
        p2 = coordinates[i + 1]
        dist = haversine_distance(p1, p2)
        if cumulative_dist + dist >= target_miles:
            # Interpolate
            ratio = (target_miles - cumulative_dist) / dist if dist > 0 else 0.0
            lon = p1[0] + ratio * (p2[0] - p1[0])
            lat = p1[1] + ratio * (p2[1] - p1[1])
            return [lat, lon]
        cumulative_dist += dist

    return [coordinates[-1][1], coordinates[-1][0]]

def calculate_fuel_stops(total_miles: float) -> list:
    """Returns mileage marks for fuel stops (every 1000 miles)."""
    stops = []
    current_mark = 1000
    while current_mark < total_miles:
        stops.append(current_mark)
        current_mark += 1000
    return stops

def check_hos_violations(totals: dict, cycle_hours: float, drove_8hrs_no_break: bool) -> list:
    """Check HOS violations for a given day."""
    violations = []
    
    if totals.get("driving", 0) > MAX_DRIVING_HOURS:
        violations.append("Exceeds 11hr driving limit")
        
    if totals.get("on_duty", 0) + totals.get("driving", 0) > MAX_WINDOW_HOURS:
        violations.append("Exceeds 14hr on-duty window")
        
    if cycle_hours > MAX_CYCLE_HOURS:
        violations.append("Exceeds 70hr/8-day cycle limit")
        
    if drove_8hrs_no_break:
        violations.append("Missing 30-min break after 8hr driving")
        
    return violations

def plan_trip(current_location: str, pickup_location: str, dropoff_location: str, cycle_used: float, route_data: dict) -> dict:
    """
    Simulates the HOS logs day-by-day based on routing data and cycle usage.
    """
    dist_meters = route_data['distance_meters']
    total_miles = dist_meters * 0.000621371 # meters to miles
    
    leg1_miles = total_miles * 0.3
    leg2_miles = total_miles * 0.7
    
    leg1_duration = (leg1_miles / AVERAGE_SPEED_MPH)
    leg2_duration = (leg2_miles / AVERAGE_SPEED_MPH)
    
    legs = [
        {"from": current_location, "to": pickup_location, "miles": round(leg1_miles, 1), "drive_hours": round(leg1_duration, 1)},
        {"from": pickup_location, "to": dropoff_location, "miles": round(leg2_miles, 1), "drive_hours": round(leg2_duration, 1)}
    ]
    
    # Run simulation passing route geometry coordinates for stops interpolation
    route_coords = route_data.get('geometry', {}).get('coordinates', [])
    simulation = run_hos_simulation(
        total_miles, leg1_duration, leg2_duration, cycle_used, route_coords,
        current_location=current_location,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location
    )
    
    # Extract calculated stops list
    stops = simulation['stops']
    
    # Set display names for Start, Pickup, and Dropoff stop objects
    for stop in stops:
        if stop['type'] == 'start':
            stop['location'] = current_location
        elif stop['type'] == 'pickup':
            stop['location'] = pickup_location
        elif stop['type'] == 'dropoff':
            stop['location'] = dropoff_location
            
    return {
        "total_miles": round(total_miles, 1),
        "total_days": len(simulation['daily_logs']),
        "legs": legs,
        "stops": stops,
        "daily_logs": simulation['daily_logs']
    }

def run_hos_simulation(total_miles, leg1_hrs, leg2_hrs, current_cycle_used, route_coords,
                       current_location="Starting Terminal",
                       pickup_location="Pickup Location",
                       dropoff_location="Dropoff Location"):
    """
    Simulates the HOS clocks minute-by-minute and calculates GPS coordinates for stops.
    """
    timeline = []
    events = []
    stops = []
    
    time = 0 # minutes
    remaining_leg1 = leg1_hrs * 60
    remaining_leg2 = leg2_hrs * 60
    
    # Clocks
    driving_clock = 0
    on_duty_clock = 0
    continuous_driving = 0
    remaining_cycle = (MAX_CYCLE_HOURS - current_cycle_used) * 60
    miles_since_fuel = 0
    current_miles = 0.0
    
    phase = "leg1"
    pickup_timer = 60
    dropoff_timer = 60

    # Add starting stop marker
    start_coords = route_coords[0] if route_coords else [0.0, 0.0]
    stops.append({
        "type": "start",
        "location": "Starting Terminal",
        "duration_hrs": 0.0,
        "status": STATUS_OFF,
        "lat": start_coords[1] if len(start_coords) > 1 else 39.8283,
        "lng": start_coords[0] if len(start_coords) > 0 else -98.5795
    })
    
    def add_event(status, duration, desc, location=None):
        # Derive a real location label from current phase if not explicitly provided
        if location is None:
            if phase == "leg1":
                location = f"En route to {pickup_location}"
            elif phase == "pickup":
                location = pickup_location
            elif phase == "leg2":
                location = f"En route to {dropoff_location}"
            elif phase == "dropoff":
                location = dropoff_location
            else:
                location = current_location
        events.append({
            "status": status,
            "start": format_min_to_time(time - duration),
            "end": format_min_to_time(time),
            "location": location,
            "hours": round(duration / 60, 2),
            "description": desc
        })
        
    def add_time_step(status, min_step=1):
        nonlocal time, current_miles, miles_since_fuel
        for _ in range(min_step):
            timeline.append(status)
            time += 1
            if status == STATUS_D:
                miles_driven = (1/60) * AVERAGE_SPEED_MPH
                current_miles += miles_driven
                miles_since_fuel += miles_driven

    # Pre-trip inspection (30 mins)
    add_time_step(STATUS_ON, 30)
    on_duty_clock += 30
    remaining_cycle -= 30
    add_event(STATUS_ON, 30, "Pre-Trip Inspection", current_location)

    while phase != "complete":
        # 1. 34-hour restart if cycle exhausted
        if remaining_cycle <= 0:
            add_time_step(STATUS_OFF, 2040)
            driving_clock = 0
            on_duty_clock = 0
            continuous_driving = 0
            remaining_cycle = MAX_CYCLE_HOURS * 60
            
            lat_lon = get_coordinate_at_distance(route_coords, current_miles)
            stops.append({
                "type": "rest",
                "location": f"Rest Break (34h Restart) - Mile {round(current_miles)}",
                "duration_hrs": 34.0,
                "status": STATUS_OFF,
                "lat": lat_lon[0],
                "lng": lat_lon[1]
            })
            add_event(STATUS_OFF, 2040, "34-Hour Restart (Cycle Reset)",
                      f"Rest Area — Mile {round(current_miles)} en route to {pickup_location if phase in ('leg1','pickup') else dropoff_location}")
            continue
            
        # 2. 10-hour rest if daily shift limits reached
        if on_duty_clock >= MAX_WINDOW_HOURS * 60 or driving_clock >= MAX_DRIVING_HOURS * 60:
            add_time_step(STATUS_OFF, 600)
            driving_clock = 0
            on_duty_clock = 0
            continuous_driving = 0
            
            lat_lon = get_coordinate_at_distance(route_coords, current_miles)
            stops.append({
                "type": "rest",
                "location": f"Shift Rest Break (10h Reset) - Mile {round(current_miles)}",
                "duration_hrs": 10.0,
                "status": STATUS_OFF,
                "lat": lat_lon[0],
                "lng": lat_lon[1]
            })
            add_event(STATUS_OFF, 600, "10-Hour Rest Break",
                      f"Rest Area — Mile {round(current_miles)} en route to {pickup_location if phase in ('leg1','pickup') else dropoff_location}")
            continue
            
        # 3. 30-min break if 8 hours driven
        if continuous_driving >= BREAK_TRIGGER_HOURS * 60:
            add_time_step(STATUS_OFF, 30)
            on_duty_clock += 30
            continuous_driving = 0
            
            lat_lon = get_coordinate_at_distance(route_coords, current_miles)
            stops.append({
                "type": "rest",
                "location": f"Mandatory Rest Break (30m) - Mile {round(current_miles)}",
                "duration_hrs": 0.5,
                "status": STATUS_OFF,
                "lat": lat_lon[0],
                "lng": lat_lon[1]
            })
            add_event(STATUS_OFF, 30, "30-Minute Break",
                      f"Mile {round(current_miles)} — en route to {pickup_location if phase in ('leg1','pickup') else dropoff_location}")
            continue
            
        # 4. Fuel Stop
        if miles_since_fuel >= FUEL_INTERVAL_MILES:
            if on_duty_clock + 30 > MAX_WINDOW_HOURS * 60:
                add_time_step(STATUS_OFF, 600)
                driving_clock = 0
                on_duty_clock = 0
                continuous_driving = 0
                
                lat_lon = get_coordinate_at_distance(route_coords, current_miles)
                stops.append({
                    "type": "rest",
                    "location": f"Shift Rest Break (10h Reset) - Mile {round(current_miles)}",
                    "duration_hrs": 10.0,
                    "status": STATUS_OFF,
                    "lat": lat_lon[0],
                    "lng": lat_lon[1]
                })
                add_event(STATUS_OFF, 600, "10-Hour Rest Break",
                          f"Rest Area — Mile {round(current_miles)} en route to {dropoff_location}")
            else:
                add_time_step(STATUS_ON, 30)
                on_duty_clock += 30
                remaining_cycle -= 30
                
                lat_lon = get_coordinate_at_distance(route_coords, current_miles)
                stops.append({
                    "type": "fuel",
                    "location": f"Fueling Stop - Mile {round(current_miles)}",
                    "duration_hrs": 0.5,
                    "status": STATUS_ON,
                    "lat": lat_lon[0],
                    "lng": lat_lon[1]
                })
                miles_since_fuel = 0
                continuous_driving = 0
                add_event(STATUS_ON, 30, "Fueling Stop",
                          f"Fuel Stop — Mile {round(current_miles)} en route to {pickup_location if phase in ('leg1','pickup') else dropoff_location}")
            continue

        # 5. Process Leg 1
        if phase == "leg1":
            if remaining_leg1 > 0:
                add_time_step(STATUS_D, 1)
                driving_clock += 1
                on_duty_clock += 1
                continuous_driving += 1
                remaining_cycle -= 1
                remaining_leg1 -= 1
            else:
                phase = "pickup"
                
        # 6. Process Pickup
        elif phase == "pickup":
            if pickup_timer > 0:
                if on_duty_clock + 1 > MAX_WINDOW_HOURS * 60:
                    add_time_step(STATUS_OFF, 600)
                    driving_clock = 0
                    on_duty_clock = 0
                    continuous_driving = 0
                    
                    lat_lon = get_coordinate_at_distance(route_coords, current_miles)
                    stops.append({
                        "type": "rest",
                        "location": f"Shift Rest Break (10h Reset) - Mile {round(current_miles)}",
                        "duration_hrs": 10.0,
                        "status": STATUS_OFF,
                        "lat": lat_lon[0],
                        "lng": lat_lon[1]
                    })
                    add_event(STATUS_OFF, 600, "10-Hour Rest Break",
                              f"Rest Area — Mile {round(current_miles)} en route to {pickup_location}")
                else:
                    add_time_step(STATUS_ON, 1)
                    on_duty_clock += 1
                    remaining_cycle -= 1
                    pickup_timer -= 1
            else:
                # Add pickup stop
                pickup_lat_lon = get_coordinate_at_distance(route_coords, current_miles)
                stops.append({
                    "type": "pickup",
                    "location": "Pickup stop",
                    "duration_hrs": 1.0,
                    "status": STATUS_ON,
                    "lat": pickup_lat_lon[0],
                    "lng": pickup_lat_lon[1]
                })
                add_event(STATUS_ON, 60, "Loading Cargo", pickup_location)
                continuous_driving = 0
                phase = "leg2"
                
        # 7. Process Leg 2
        elif phase == "leg2":
            if remaining_leg2 > 0:
                add_time_step(STATUS_D, 1)
                driving_clock += 1
                on_duty_clock += 1
                continuous_driving += 1
                remaining_cycle -= 1
                remaining_leg2 -= 1
            else:
                phase = "dropoff"
                
        # 8. Process Dropoff
        elif phase == "dropoff":
            if dropoff_timer > 0:
                if on_duty_clock + 1 > MAX_WINDOW_HOURS * 60:
                    add_time_step(STATUS_OFF, 600)
                    driving_clock = 0
                    on_duty_clock = 0
                    continuous_driving = 0
                    
                    lat_lon = get_coordinate_at_distance(route_coords, current_miles)
                    stops.append({
                        "type": "rest",
                        "location": f"Shift Rest Break (10h Reset) - Mile {round(current_miles)}",
                        "duration_hrs": 10.0,
                        "status": STATUS_OFF,
                        "lat": lat_lon[0],
                        "lng": lat_lon[1]
                    })
                    add_event(STATUS_OFF, 600, "10-Hour Rest Break",
                              f"Rest Area — Mile {round(current_miles)} en route to {dropoff_location}")
                else:
                    add_time_step(STATUS_ON, 1)
                    on_duty_clock += 1
                    remaining_cycle -= 1
                    dropoff_timer -= 1
            else:
                # Add dropoff stop
                dropoff_lat_lon = get_coordinate_at_distance(route_coords, current_miles)
                stops.append({
                    "type": "dropoff",
                    "location": "Dropoff stop",
                    "duration_hrs": 1.0,
                    "status": STATUS_ON,
                    "lat": dropoff_lat_lon[0],
                    "lng": dropoff_lat_lon[1]
                })
                add_event(STATUS_ON, 60, "Unloading Cargo", dropoff_location)
                # Post-trip inspection (15 mins)
                add_time_step(STATUS_ON, 15)
                on_duty_clock += 15
                remaining_cycle -= 15
                add_event(STATUS_ON, 15, "Post-Trip Inspection", dropoff_location)
                phase = "complete"

    # Segment into daily logs
    total_minutes = len(timeline)
    days_count = (total_minutes + 1439) // 1440
    daily_logs = []
    
    base_date = datetime.date.today()
    rolling_cycle_used = current_cycle_used
    
    for d in range(days_count):
        day_start = d * 1440
        day_end = min((d + 1) * 1440, total_minutes)
        day_timeline = timeline[day_start:day_end]
        
        # Pad last day
        if len(day_timeline) < 1440:
            day_timeline.extend([STATUS_OFF] * (1440 - len(day_timeline)))
            
        day_events = []
        current_status = day_timeline[0]
        start_min = 0
        
        # ── Build per-minute location context (which phase each minute belongs to) ──
        # We track which phase produced each minute by using the events log
        # and attributing their location to the daily slice.
        total_day_mins_before = d * 1440

        def get_event_location_for_minute(abs_min):
            """Find which global event contains this absolute minute."""
            running = 0
            for ev in events:
                sh, sm = (int(x) for x in ev['start'].split(':'))
                eh, em = (int(x) for x in ev['end'].split(':'))
                ev_start_abs = sh * 60 + sm
                ev_end_abs   = eh * 60 + em
                # Adjust for multi-day: use event order index
                if ev_start_abs <= (abs_min % 1440) < ev_end_abs:
                    return ev['location']
            return f"En route to {dropoff_location}"

        for m in range(1, 1440):
            if day_timeline[m] != current_status:
                duration_hrs = (m - start_min) / 60
                abs_mid = total_day_mins_before + (start_min + m) // 2
                loc = get_event_location_for_minute(abs_mid)
                day_events.append({
                    "status": current_status,
                    "start": format_min_to_time(start_min),
                    "end": format_min_to_time(m),
                    "hours": round(duration_hrs, 2),
                    "location": loc
                })
                current_status = day_timeline[m]
                start_min = m

        duration_hrs = (1440 - start_min) / 60
        abs_mid = total_day_mins_before + (start_min + 1440) // 2
        loc = get_event_location_for_minute(abs_mid)
        day_events.append({
            "status": current_status,
            "start": format_min_to_time(start_min),
            "end": "24:00",
            "hours": round(duration_hrs, 2),
            "location": loc
        })

        totals = {"off_duty": 0.0, "sleeper": 0.0, "driving": 0.0, "on_duty": 0.0, "total": 24.0}
        for ev in day_events:
            h = ev['hours']
            if ev['status'] == STATUS_OFF:
                totals['off_duty'] += h
            elif ev['status'] == STATUS_SB:
                totals['sleeper'] += h
            elif ev['status'] == STATUS_D:
                totals['driving'] += h
            elif ev['status'] == STATUS_ON:
                totals['on_duty'] += h

        on_duty_today = totals['on_duty'] + totals['driving']
        rolling_cycle_used += on_duty_today
        drove_8hrs_without_break = False
        
        continuous_drive_mins = 0
        for m in range(1440):
            st = day_timeline[m]
            if st == STATUS_D:
                continuous_drive_mins += 1
                if continuous_drive_mins >= 480:
                    drove_8hrs_without_break = True
            else:
                is_break = True
                for b_check in range(30):
                    if m + b_check < 1440 and day_timeline[m + b_check] == STATUS_D:
                        is_break = False
                        break
                if is_break:
                    continuous_drive_mins = 0

        violations = check_hos_violations(totals, rolling_cycle_used, drove_8hrs_without_break)
        day_date = base_date + datetime.timedelta(days=d)
        
        remarks = []
        for ev in day_events:
            status_label = {
                STATUS_OFF: "Off Duty",
                STATUS_SB:  "Sleeper Berth",
                STATUS_D:   "Driving",
                STATUS_ON:  "On Duty (Not Driving)"
            }.get(ev['status'], ev['status'])
            remarks.append(f"{ev['start']} — {ev['location']} ({status_label}, {round(ev['hours'],2)}h)")

        daily_logs.append({
            "day": d + 1,
            "date": day_date.strftime("%Y-%m-%d"),
            "total_miles_today": round((totals['driving'] * AVERAGE_SPEED_MPH), 1),
            "events": day_events,
            "totals": totals,
            "remarks": remarks,
            "hos_violations": violations
        })

    return {
        "daily_logs": daily_logs,
        "events": events,
        "stops": stops
    }

def format_min_to_time(minutes):
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"
