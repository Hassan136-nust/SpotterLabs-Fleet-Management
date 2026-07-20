import datetime

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
    
    # We split trip into legs
    # For simulation, we assume:
    # - Leg 1 (current -> pickup): 30% of total distance
    # - Leg 2 (pickup -> dropoff): 70% of total distance
    # (or we can use geocoding to split properly, but this is a very standard fallback)
    leg1_miles = total_miles * 0.3
    leg2_miles = total_miles * 0.7
    
    leg1_duration = (leg1_miles / AVERAGE_SPEED_MPH)
    leg2_duration = (leg2_miles / AVERAGE_SPEED_MPH)
    
    legs = [
        {"from": current_location, "to": pickup_location, "miles": round(leg1_miles, 1), "drive_hours": round(leg1_duration, 1)},
        {"from": pickup_location, "to": dropoff_location, "miles": round(leg2_miles, 1), "drive_hours": round(leg2_duration, 1)}
    ]
    
    # Run simulation
    simulation = run_hos_simulation(total_miles, leg1_duration, leg2_duration, cycle_used)
    
    # Prepare stops array
    stops = []
    # Add pickup
    stops.append({
        "type": "pickup",
        "location": pickup_location,
        "duration_hrs": 1.0,
        "status": STATUS_ON
    })
    
    # Fuel stops markers
    fuel_markers = calculate_fuel_stops(total_miles)
    for fm in fuel_markers:
        stops.append({
            "type": "fuel",
            "location": f"~{fm}mi mark",
            "duration_hrs": 0.5,
            "status": STATUS_ON
        })
        
    # Rests
    for ev in simulation['events']:
        if ev['description'] == "10-Hour Rest Break":
            stops.append({
                "type": "rest",
                "location": "Rest stop",
                "duration_hrs": 10.0,
                "status": STATUS_OFF
            })
            
    # Add dropoff
    stops.append({
        "type": "dropoff",
        "location": dropoff_location,
        "duration_hrs": 1.0,
        "status": STATUS_ON
    })
    
    return {
        "total_miles": round(total_miles, 1),
        "total_days": len(simulation['daily_logs']),
        "legs": legs,
        "stops": stops,
        "daily_logs": simulation['daily_logs']
    }

def run_hos_simulation(total_miles, leg1_hrs, leg2_hrs, current_cycle_used):
    """
    Simulates the HOS clocks minute-by-minute to generate logs.
    """
    timeline = []
    events = []
    
    time = 0 # minutes
    remaining_leg1 = leg1_hrs * 60
    remaining_leg2 = leg2_hrs * 60
    
    # Clocks
    driving_clock = 0
    on_duty_clock = 0
    continuous_driving = 0
    remaining_cycle = (MAX_CYCLE_HOURS - current_cycle_used) * 60
    miles_since_fuel = 0
    
    phase = "leg1" # leg1 -> pickup -> leg2 -> dropoff -> complete
    pickup_timer = 60
    dropoff_timer = 60
    
    def add_event(status, duration, desc, location="En route"):
        events.append({
            "status": status,
            "start": format_min_to_time(time - duration),
            "end": format_min_to_time(time),
            "location": location,
            "hours": round(duration / 60, 2),
            "description": desc
        })
        
    def add_time_step(status, min_step=1):
        nonlocal time
        for _ in range(min_step):
            timeline.append(status)
            time += 1

    # Pre-trip inspection (30 mins)
    add_time_step(STATUS_ON, 30)
    on_duty_clock += 30
    remaining_cycle -= 30
    add_event(STATUS_ON, 30, "Pre-Trip Inspection")

    while phase != "complete":
        # 1. 34-hour restart if cycle exhausted
        if remaining_cycle <= 0:
            add_time_step(STATUS_OFF, 2040)
            driving_clock = 0
            on_duty_clock = 0
            continuous_driving = 0
            remaining_cycle = MAX_CYCLE_HOURS * 60
            add_event(STATUS_OFF, 2040, "34-Hour Restart (Cycle Reset)", "Rest stop")
            continue
            
        # 2. 10-hour rest if daily shift limits reached
        if on_duty_clock >= MAX_WINDOW_HOURS * 60 or driving_clock >= MAX_DRIVING_HOURS * 60:
            add_time_step(STATUS_OFF, 600)
            driving_clock = 0
            on_duty_clock = 0
            continuous_driving = 0
            add_event(STATUS_OFF, 600, "10-Hour Rest Break", "Rest stop")
            continue
            
        # 3. 30-min break if 8 hours driven
        if continuous_driving >= BREAK_TRIGGER_HOURS * 60:
            add_time_step(STATUS_OFF, 30)
            on_duty_clock += 30 # OFF duty break does NOT count towards on-duty clock
            continuous_driving = 0
            add_event(STATUS_OFF, 30, "30-Minute Rest Break", "Rest stop")
            continue
            
        # 4. Fuel Stop
        if miles_since_fuel >= FUEL_INTERVAL_MILES:
            if on_duty_clock + 30 > MAX_WINDOW_HOURS * 60:
                add_time_step(STATUS_OFF, 600)
                driving_clock = 0
                on_duty_clock = 0
                continuous_driving = 0
                add_event(STATUS_OFF, 600, "10-Hour Rest Break", "Rest stop")
            else:
                add_time_step(STATUS_ON, 30)
                on_duty_clock += 30
                remaining_cycle -= 30
                miles_since_fuel = 0
                continuous_driving = 0
                add_event(STATUS_ON, 30, "Fueling Stop", "Fuel stop")
            continue

        # 5. Process Leg 1
        if phase == "leg1":
            if remaining_leg1 > 0:
                add_time_step(STATUS_D, 1)
                driving_clock += 1
                on_duty_clock += 1
                continuous_driving += 1
                remaining_cycle -= 1
                miles_since_fuel += (1/60) * AVERAGE_SPEED_MPH
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
                    add_event(STATUS_OFF, 600, "10-Hour Rest Break", "Rest stop")
                else:
                    add_time_step(STATUS_ON, 1)
                    on_duty_clock += 1
                    remaining_cycle -= 1
                    pickup_timer -= 1
            else:
                add_event(STATUS_ON, 60, "Loading Cargo", "Pickup Location")
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
                miles_since_fuel += (1/60) * AVERAGE_SPEED_MPH
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
                    add_event(STATUS_OFF, 600, "10-Hour Rest Break", "Rest stop")
                else:
                    add_time_step(STATUS_ON, 1)
                    on_duty_clock += 1
                    remaining_cycle -= 1
                    dropoff_timer -= 1
            else:
                add_event(STATUS_ON, 60, "Unloading Cargo", "Dropoff Location")
                # Post-trip inspection (15 mins)
                add_time_step(STATUS_ON, 15)
                on_duty_clock += 15
                remaining_cycle -= 15
                add_event(STATUS_ON, 15, "Post-Trip Inspection")
                phase = "complete"

    # Segment the minute-by-minute timeline into daily logs (1440 mins/day)
    total_minutes = len(timeline)
    days_count = (total_minutes + 1439) // 1440
    daily_logs = []
    
    base_date = datetime.date.today()
    rolling_cycle_used = current_cycle_used
    
    for d in range(days_count):
        day_start = d * 1440
        day_end = min((d + 1) * 1440, total_minutes)
        day_timeline = timeline[day_start:day_end]
        
        # Pad last day if incomplete
        if len(day_timeline) < 1440:
            day_timeline.extend([STATUS_OFF] * (1440 - len(day_timeline)))
            
        # Compile events
        day_events = []
        current_status = day_timeline[0]
        start_min = 0
        
        for m in range(1, 1440):
            if day_timeline[m] != current_status:
                duration_hrs = (m - start_min) / 60
                day_events.append({
                    "status": current_status,
                    "start": format_min_to_time(start_min),
                    "end": format_min_to_time(m),
                    "hours": round(duration_hrs, 2),
                    "location": "En route" if current_status == STATUS_D else "Rest stop"
                })
                current_status = day_timeline[m]
                start_min = m
                
        # Append final interval
        duration_hrs = (1440 - start_min) / 60
        day_events.append({
            "status": current_status,
            "start": format_min_to_time(start_min),
            "end": "24:00",
            "hours": round(duration_hrs, 2),
            "location": "En route" if current_status == STATUS_D else "Rest stop"
        })

        # Calculate totals
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

        # HOS Violations check
        on_duty_today = totals['on_duty'] + totals['driving']
        rolling_cycle_used += on_duty_today
        drove_8hrs_without_break = False
        
        # Check if they drove 8 consecutive hours without a 30-min break
        continuous_drive_mins = 0
        for m in range(1440):
            st = day_timeline[m]
            if st == STATUS_D:
                continuous_drive_mins += 1
                if continuous_drive_mins >= 480:
                    drove_8hrs_without_break = True
            else:
                # Any 30 min break resets it
                # We check ahead if this break lasts 30 minutes
                is_break = True
                for b_check in range(30):
                    if m + b_check < 1440 and day_timeline[m + b_check] == STATUS_D:
                        is_break = False
                        break
                if is_break:
                    continuous_drive_mins = 0

        violations = check_hos_violations(totals, rolling_cycle_used, drove_8hrs_without_break)
        
        day_date = base_date + datetime.timedelta(days=d)
        
        # Create remarks
        remarks = []
        for ev in day_events:
            if ev['status'] in [STATUS_ON, STATUS_D]:
                remarks.append(f"{ev['start']} - {ev['location']} ({ev['status']})")

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
        "events": events
    }

def format_min_to_time(minutes):
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"
