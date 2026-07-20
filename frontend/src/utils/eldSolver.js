/**
 * ELD Solver - HOS (Hours of Service) Simulation Engine
 * Follows US Interstate Property-Carrying Driver rules:
 * - 11-Hour Driving Limit
 * - 14-Hour On-Duty Limit
 * - 8-Hour Limit (30-min break required before driving again)
 * - 10 consecutive hours off-duty to reset 11/14-hour limits
 * - 70 hours/8 days cycle limit (34-hour restart resets this to 70)
 * - Fueling every 1,000 miles (takes 30 mins, counts as ON-duty)
 * - Pickup/Drop-off takes 1 hour each (counts as ON-duty)
 */

export const STATUS = {
  OFF: 'OFF', // Off Duty
  SB: 'SB',   // Sleeper Berth
  D: 'D',     // Driving
  ON: 'ON'    // On Duty, Not Driving
};

export function solveELDLogs({
  currentCycleUsed, // Hours
  leg1Distance,     // Meters
  leg1Duration,     // Seconds
  leg2Distance,     // Meters
  leg2Duration,     // Seconds
  startTime = new Date() // Start date/time of trip
}) {
  // Convert legs to miles and hours
  const milesToKm = 0.000621371; // meters to miles
  const distance1 = leg1Distance * milesToKm;
  const duration1 = leg1Duration / 3600; // hours
  const distance2 = leg2Distance * milesToKm;
  const duration2 = leg2Duration / 3600; // hours

  // Calculate average driving speeds (mph)
  const speed1 = duration1 > 0 ? distance1 / duration1 : 55;
  const speed2 = duration2 > 0 ? distance2 / duration2 : 55;

  // Simulator state
  let time = 0; // minutes
  let currentStatus = STATUS.OFF;
  let remainingDriving = duration1 + duration2;
  let remainingLeg1Driving = duration1;
  let remainingLeg2Driving = duration2;

  // Clocks in minutes
  let drivingClock = 0;
  let onDutyClock = 0;
  let continuousDriving = 0; // minutes driven since last 30+ min break
  let remainingCycle = (70 - currentCycleUsed) * 60; // minutes remaining in 70h cycle
  let milesSinceFuel = 0;

  // Track milestones
  let phase = 'leg1'; // leg1 -> pickup -> leg2 -> dropoff -> complete
  let pickupTimer = 60; // 1 hour loading (minutes)
  let dropoffTimer = 60; // 1 hour unloading (minutes)

  // Timeline array (minute-by-minute log status)
  const timeline = [];
  const events = [];

  const addEvent = (status, durationMin, description, locationName = '') => {
    events.push({
      startMin: time - durationMin,
      endMin: time,
      durationMin,
      status,
      description,
      location: locationName
    });
  };

  const addTimeStep = (status, min = 1) => {
    for (let i = 0; i < min; i++) {
      timeline.push(status);
      time++;
    }
  };

  // Helper: perform off-duty break (10 hours sleep/rest)
  const perform10HourRest = (reason) => {
    addTimeStep(STATUS.SB, 600); // 10 hours sleeper berth
    drivingClock = 0;
    onDutyClock = 0;
    continuousDriving = 0;
    addEvent(STATUS.SB, 600, `10-Hour Rest Break (${reason})`);
  };

  // Helper: perform 34-hour cycle restart
  const perform34HourRestart = () => {
    addTimeStep(STATUS.OFF, 2040); // 34 hours off duty
    drivingClock = 0;
    onDutyClock = 0;
    continuousDriving = 0;
    remainingCycle = 70 * 60; // Reset cycle to 70 hours
    addEvent(STATUS.OFF, 2040, '34-Hour Restart (70-Hour Cycle Reset)');
  };

  // Helper: perform 30-minute break
  const perform30MinBreak = () => {
    addTimeStep(STATUS.OFF, 30);
    onDutyClock += 30; // Wait, 30-min break is OFF-duty, so it does NOT increment on-duty clock
    continuousDriving = 0;
    addEvent(STATUS.OFF, 30, '30-Minute Rest Break');
  };

  // Helper: perform fueling
  const performFueling = () => {
    addTimeStep(STATUS.ON, 30);
    onDutyClock += 30;
    remainingCycle -= 30;
    milesSinceFuel = 0;
    addEvent(STATUS.ON, 30, 'Fueling Stop (30 mins)');
  };

  // Start with 15 mins On-Duty Pre-Trip inspection
  addTimeStep(STATUS.ON, 15);
  onDutyClock += 15;
  remainingCycle -= 15;
  addEvent(STATUS.ON, 15, 'Pre-Trip Inspection');

  // Main simulation loop
  while (phase !== 'complete') {
    // 1. Check Cycle Hours. If exhausted, take 34-hour restart
    if (remainingCycle <= 0) {
      perform34HourRestart();
      continue;
    }

    // 2. Check 14-Hour Duty Clock or 11-Hour Driving Clock
    // If we have reached or are very close to these limits, we must rest 10 hours
    if (onDutyClock >= 14 * 60 || drivingClock >= 11 * 60) {
      perform10HourRest('Duty clock limit reached');
      continue;
    }

    // 3. Check 8-Hour driving limit for 30-minute break
    if (continuousDriving >= 8 * 60) {
      perform30MinBreak();
      continue;
    }

    // 4. Check if we need to fuel (every 1000 miles)
    if (milesSinceFuel >= 1000) {
      // If we are about to hit 14h duty or 11h driving, rest first
      if (onDutyClock + 30 >= 14 * 60) {
        perform10HourRest('Pre-fueling rest');
      } else {
        performFueling();
      }
      continue;
    }

    // 5. Normal processing of stages
    if (phase === 'leg1') {
      if (remainingLeg1Driving > 0) {
        // Drive for 1 minute
        const minToDrive = 1;
        addTimeStep(STATUS.D, minToDrive);
        
        drivingClock += minToDrive;
        onDutyClock += minToDrive;
        continuousDriving += minToDrive;
        remainingCycle -= minToDrive;
        
        const milesDriven = (minToDrive / 60) * speed1;
        milesSinceFuel += milesDriven;
        remainingLeg1Driving -= (minToDrive / 60);
      } else {
        // Arrived at Pickup
        addEvent(STATUS.D, Math.round(duration1 * 60), 'Transit to Pickup Location');
        phase = 'pickup';
      }
    } 
    else if (phase === 'pickup') {
      if (pickupTimer > 0) {
        // Load cargo for 1 minute
        const minToLoad = 1;
        // Check if loading fits in 14h clock, otherwise must rest
        if (onDutyClock + minToLoad > 14 * 60) {
          perform10HourRest('Split loading rest');
          continue;
        }
        
        addTimeStep(STATUS.ON, minToLoad);
        onDutyClock += minToLoad;
        remainingCycle -= minToLoad;
        pickupTimer -= minToLoad;
      } else {
        addEvent(STATUS.ON, 60, 'Loading Cargo (Pickup)');
        phase = 'leg2';
      }
    } 
    else if (phase === 'leg2') {
      if (remainingLeg2Driving > 0) {
        // Drive for 1 minute
        const minToDrive = 1;
        addTimeStep(STATUS.D, minToDrive);
        
        drivingClock += minToDrive;
        onDutyClock += minToDrive;
        continuousDriving += minToDrive;
        remainingCycle -= minToDrive;
        
        const milesDriven = (minToDrive / 60) * speed2;
        milesSinceFuel += milesDriven;
        remainingLeg2Driving -= (minToDrive / 60);
      } else {
        // Arrived at Dropoff
        addEvent(STATUS.D, Math.round(duration2 * 60), 'Transit to Dropoff Location');
        phase = 'dropoff';
      }
    } 
    else if (phase === 'dropoff') {
      if (dropoffTimer > 0) {
        // Unload cargo for 1 minute
        const minToUnload = 1;
        if (onDutyClock + minToUnload > 14 * 60) {
          perform10HourRest('Split unloading rest');
          continue;
        }
        
        addTimeStep(STATUS.ON, minToUnload);
        onDutyClock += minToUnload;
        remainingCycle -= minToUnload;
        dropoffTimer -= minToUnload;
      } else {
        addEvent(STATUS.ON, 60, 'Unloading Cargo (Dropoff)');
        // 15 min Post-Trip inspection
        addTimeStep(STATUS.ON, 15);
        onDutyClock += 15;
        remainingCycle -= 15;
        addEvent(STATUS.ON, 15, 'Post-Trip Inspection');
        
        phase = 'complete';
      }
    }
  }

  // Segment the timeline into 24-hour days (1440 minutes each)
  const totalMinutes = timeline.length;
  const daysCount = Math.ceil(totalMinutes / 1440);
  const dailyLogs = [];

  for (let d = 0; d < daysCount; d++) {
    const dayStartMin = d * 1440;
    const dayEndMin = Math.min((d + 1) * 1440, totalMinutes);
    const dayTimeline = [];
    
    // Fill day timeline
    for (let m = dayStartMin; m < (d + 1) * 1440; m++) {
      if (m < totalMinutes) {
        dayTimeline.push(timeline[m]);
      } else {
        // Pad the last day with OFF duty to fill full 24 hours
        dayTimeline.push(STATUS.OFF);
      }
    }

    // Calculate totals for each status in this day
    const totals = { OFF: 0, SB: 0, D: 0, ON: 0 };
    dayTimeline.forEach(st => {
      totals[st] = (totals[st] || 0) + 1; // counts in minutes
    });

    // Convert totals to hours
    const totalsHours = {
      OFF: totals.OFF / 60,
      SB: totals.SB / 60,
      D: totals.D / 60,
      ON: totals.ON / 60
    };

    // Calculate status transitions for drawing lines
    // transitions = list of { status, durationMin }
    const intervals = [];
    let currentInterval = { status: dayTimeline[0], durationMin: 1 };
    
    for (let m = 1; m < 1440; m++) {
      if (dayTimeline[m] === currentInterval.status) {
        currentInterval.durationMin++;
      } else {
        intervals.push(currentInterval);
        currentInterval = { status: dayTimeline[m], durationMin: 1 };
      }
    }
    intervals.push(currentInterval);

    // Day timestamp
    const dayDate = new Date(startTime.getTime() + d * 24 * 60 * 60 * 1000);

    dailyLogs.push({
      dayNumber: d + 1,
      dateString: dayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      totals: totalsHours,
      intervals
    });
  }

  // Return the logs and events
  return {
    dailyLogs,
    events,
    totalDurationMin: time,
    totalDistanceMiles: distance1 + distance2
  };
}
