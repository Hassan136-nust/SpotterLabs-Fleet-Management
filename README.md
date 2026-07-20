<div align="center">
  <img src="frontend/public/spotter.ai_logo.png" alt="Spotter.ai Logo" width="180" />
  
  <h1>Spotter.ai</h1>
  <p><strong>Next-generation logistics dispatch engine with AI route optimization and FMCSA-compliant ELD log generation.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Django-6.0-092E20?style=flat&logo=django&logoColor=white" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black" />
    <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white" />
    <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat" />
  </p>
</div>

---

## Demo

<div align="center">
  <img src="frontend/public/unnamed (1).jpg" alt="Spotter.ai App Preview" width="860" />
</div>

---

## What Is Spotter.ai?

Spotter.ai is a **full-stack fleet management and trip planning platform** built for commercial trucking dispatchers and drivers. Enter three locations and your available cycle hours — the system geocodes each point, calculates an HGV-optimized route, then runs a **minute-by-minute HOS (Hours of Service) simulation** that produces:

- A fully detailed **FMCSA-compliant ELD log** for every driving day
- All required **stops** — fuel, mandatory 30-min breaks, 10-hr resets, 34-hr cycle restarts
- A live **Leaflet map** with route polyline and color-coded stop pins
- An on-demand **PDF export** of driver logs formatted for roadside inspections

---

## Table of Contents

- [System Architecture](#system-architecture)
- [End-to-End Request Flow](#end-to-end-request-flow)
- [How the HOS Engine Works](#how-the-hos-engine-works)
- [Route Geometry & Stop Interpolation](#route-geometry--stop-interpolation)
- [ELD Canvas Rendering](#eld-canvas-rendering)
- [PDF Export Pipeline](#pdf-export-pipeline)
- [State Management](#state-management)
- [Geocoding & Routing Fallback Chain](#geocoding--routing-fallback-chain)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [License](#license)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React 19)                         │
│                                                                     │
│  TruckAnimation  ──►  Homepage  ──►  TripPlanner  ──►  RoutesPage  │
│                                            │              │         │
│                                     ELDLogsPage ◄─────────┘         │
│                                            │                        │
│                              Leaflet Map (MapContainer)             │
│                              SVG ELD Canvas (ELDLogsPage)           │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │  POST /api/plan-trip/
                                   │  GET  /api/history/
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DJANGO 6 REST API                             │
│                                                                     │
│  PlanTripAPIView                                                    │
│    │                                                                │
│    ├─► routing.geocode_address()  ──► ORS Geocode / Nominatim       │
│    ├─► routing.get_hgv_route()   ──► ORS HGV    / OSRM             │
│    └─► hos_engine.plan_trip()                                       │
│              │                                                      │
│              ├─► run_hos_simulation()   (minute-by-minute loop)     │
│              ├─► get_coordinate_at_distance()  (Haversine)          │
│              └─► check_hos_violations()                             │
│                                                                     │
│  TripDispatch  ──►  SQLite  db.sqlite3                              │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    External APIs (no key required by default)
                    ├─ Photon / Komoot  (address autocomplete)
                    ├─ Nominatim / OSM  (geocoding fallback)
                    └─ OSRM             (routing fallback)
```

The frontend is a **pure SPA** — no server-side rendering. All shared state (trip plan, ELD results, driver info) lives in `App.jsx` and flows down as props so every tab stays in sync without a global state library.

---

## End-to-End Request Flow

Here is exactly what happens from the moment the user clicks **GENERATE ROUTE** to the moment the map and ELD logs appear.

### Step 1 — Frontend form submission (`TripPlanner.jsx`)

```
User fills in:
  current_location  = "Chicago, IL"
  pickup_location   = "Kansas City, MO"
  dropoff_location  = "Denver, CO"
  cycleHours        = 70          ← remaining hours in the 70-hr cycle
  driverInfo        = { name, id, truck, ... }

handleCalculateRoute() sends:
  POST http://localhost:8000/api/plan-trip/
  {
    "current_location":  "Chicago, IL",
    "pickup_location":   "Kansas City, MO",
    "dropoff_location":  "Denver, CO",
    "current_cycle_used": 0          ← 70 - cycleHours = hours already used
  }
```

### Step 2 — Request validation (`serializers.py`)

`TripPlanRequestSerializer` validates all four fields. `current_cycle_used` is clamped to `[0, 70]`. If anything is missing or out of range, a `400` is returned before any external API call is made.

### Step 3 — Geocoding three locations (`routing.py → geocode_address`)

Each of the three address strings is geocoded independently:

```
"Chicago, IL"      →  { lat: 41.85, lon: -87.65, display_name: "Chicago, Cook County, IL..." }
"Kansas City, MO"  →  { lat: 39.09, lon: -94.57, display_name: "Kansas City, Jackson County..." }
"Denver, CO"       →  { lat: 39.73, lon: -104.98, display_name: "Denver, Denver County, CO..." }
```

Primary: **OpenRouteService Geocode API** (if `OPENROUTE_SERVICE_API_KEY` is set in settings).  
Fallback: **Nominatim (OpenStreetMap)** — always available, no key required.

If any of the three locations fail to geocode, the view returns a descriptive `400` error before routing is attempted.

### Step 4 — Two-leg routing (`routing.py → get_hgv_route`)

Two separate route calls are made:

```
Leg 1:  Chicago → Kansas City
Leg 2:  Kansas City → Denver
```

Each call returns `distance_meters`, `duration_seconds`, and a **GeoJSON LineString** geometry (a list of `[lon, lat]` coordinate pairs representing the road path).

Primary: **ORS HGV (Heavy Goods Vehicle) profile** — routes avoid low bridges, weight-restricted roads, and urban restrictions.  
Fallback: **OSRM car profile** — standard road routing.

The two results are merged into a single `combined_route`:
```python
combined_route = {
    "distance_meters": leg1.distance + leg2.distance,
    "duration_seconds": leg1.duration + leg2.duration,
    "geometry": {
        "type": "LineString",
        "coordinates": leg1.coords + leg2.coords   # concatenated path
    }
}
```

### Step 5 — HOS simulation (`hos_engine.py → plan_trip → run_hos_simulation`)

`plan_trip()` converts the combined distance to miles and splits it:

```
total_miles = distance_meters × 0.000621371

leg1_miles  = total_miles × 0.30   (current → pickup)
leg2_miles  = total_miles × 0.70   (pickup  → dropoff)

leg1_drive_hours = leg1_miles / 55 mph
leg2_drive_hours = leg2_miles / 55 mph
```

Then `run_hos_simulation()` runs the core loop (see [How the HOS Engine Works](#how-the-hos-engine-works)).

### Step 6 — Coordinate injection & DB save (`views.py`)

Before the response is sent, the view:

1. Finds the `pickup` and `dropoff` stop objects in `trip_plan['stops']` and injects their real geocoded `lat`/`lng` (the engine only knows mile markers, not real coords for named stops).
2. Attaches `route_geometry` to the plan dict for the frontend map.
3. Saves a `TripDispatch` record to SQLite with all summary fields + full JSON blobs for stops, logs, and geometry.
4. Adds `dispatch_id` to the response so the frontend can reference this record.

### Step 7 — Frontend state update & rendering (`TripPlanner.jsx`)

On a successful response the frontend does five things in sequence:

```javascript
setLocations(...)        // pins the three map markers
setRouteGeometry(...)    // draws the polyline on the Leaflet map
setPlannedStops(...)     // populates the Route Nodes Preview list
setMetrics(...)          // updates the 6-metric dashboard overlay
onEldSolved(...)         // lifts ELD data to App.jsx → ELDLogsPage
```

The ELD data passed upward is a normalized array of daily log objects, each containing an `events` array that the SVG canvas can render directly.

---

## How the HOS Engine Works

The engine lives entirely in `backend/api/services/hos_engine.py`. It is a **deterministic, rule-based simulator** — not ML — that perfectly replicates what a compliant driver would do.

### Clock Variables

At the start of a trip the engine initialises five independent clocks:

| Variable | Meaning | Resets when |
|---|---|---|
| `driving_clock` | Minutes driven this shift | After 10-hr sleeper rest |
| `on_duty_clock` | Minutes on-duty this shift | After 10-hr sleeper rest |
| `continuous_driving` | Minutes driven without a 30-min break | After any ≥30-min non-driving period |
| `remaining_cycle` | Minutes left in the 70-hr/8-day cycle | After 34-hr restart |
| `miles_since_fuel` | Miles since the last fuel stop | After every fuel stop |

### The Main Simulation Loop

The loop runs `while phase != "complete"` and checks priorities in strict order on every iteration:

```
Priority 1 — Is the 70-hr cycle exhausted?
    YES → insert 34-hr OFF-DUTY restart, reset all clocks + cycle

Priority 2 — Has the 14-hr on-duty window OR 11-hr driving limit been reached?
    YES → insert 10-hr SLEEPER BERTH rest, reset shift clocks

Priority 3 — Has the driver been driving continuously for 8 hrs without a break?
    YES → insert 30-min OFF-DUTY break, reset continuous_driving

Priority 4 — Has the truck travelled 1,000 miles since the last fuel stop?
    YES → insert 30-min ON-DUTY fuel stop
         (if on-duty clock is too close to the 14-hr limit, rest first)

Priority 5 — Normal progress
    phase == "leg1"   → advance 1 minute as DRIVING
    phase == "pickup" → advance 1 minute as ON-DUTY (loading cargo)
    phase == "leg2"   → advance 1 minute as DRIVING
    phase == "dropoff"→ advance 1 minute as ON-DUTY (unloading cargo)
    phase complete    → exit loop
```

The 1-minute granularity means the output is accurate to the minute. Every minute appends a single status token (`OFF`, `SB`, `D`, or `ON`) to a flat `timeline` list.

### Phase Transitions

```
start
  │
  ▼
[leg1 driving]  ── 30-min pre-trip inspection (ON) prepended before first drive
  │
  ├── fuel stops, rest breaks, cycle resets inserted automatically
  │
  ▼
phase = "pickup"
  │
  ▼
[1-hr loading] (ON-duty, picks up cargo)
  │
  ▼
phase = "leg2"
  │
  ├── same fuel/rest/reset rules apply
  │
  ▼
phase = "dropoff"
  │
  ▼
[1-hr unloading] + [15-min post-trip inspection] (both ON-duty)
  │
  ▼
phase = "complete" → loop exits
```

### Converting the Timeline to Daily Logs

After the loop, the flat `timeline` list (potentially thousands of minutes long) is sliced into **1,440-minute (24-hour) windows**:

```python
for d in range(days_count):
    day_timeline = timeline[d*1440 : (d+1)*1440]
    # pad last day with OFF if trip ends before midnight
```

Each window is then **run-length encoded** into event objects:

```
[D, D, D, D, D, D, D, SB, SB, SB, ...]
→ { status: "D",  start: "00:30", end: "11:30", hours: 11.0 }
   { status: "SB", start: "11:30", end: "21:30", hours: 10.0 }
   ...
```

### Location Interpolation per Stop

Each stop inserted during the simulation only knows its **mile marker** (how far along the route it occurred). Converting that to real GPS coordinates uses `get_coordinate_at_distance()`:

```python
def get_coordinate_at_distance(coordinates, target_miles):
    # Walk the GeoJSON coordinate list segment by segment
    # accumulate Haversine distance until cumulative >= target_miles
    # interpolate linearly between the two bounding points
    return [lat, lon]
```

The Haversine formula accounts for Earth's curvature when computing segment lengths, so stop pins land on the road at the correct geographic position.

### HOS Violation Checking

After each day is built, `check_hos_violations()` scans four conditions:

```python
if totals["driving"] > 11:         → "Exceeds 11hr driving limit"
if on_duty + driving > 14:         → "Exceeds 14hr on-duty window"
if rolling_cycle_used > 70:        → "Exceeds 70hr/8-day cycle limit"
if drove_8hrs_without_30min_break: → "Missing 30-min break after 8hr driving"
```

Violations are returned in `daily_logs[n].hos_violations` and can be surfaced in the UI.

---

## Route Geometry & Stop Interpolation

The route geometry is a GeoJSON `LineString` — an ordered list of `[lon, lat]` pairs tracing the actual road path:

```json
{
  "type": "LineString",
  "coordinates": [
    [-87.6298, 41.8781],
    [-87.7021, 41.8654],
    ...thousands of points...
    [-104.9903, 39.7392]
  ]
}
```

**On the backend**, this geometry is used by `get_coordinate_at_distance()` to pin every stop precisely on the road.

**On the frontend**, `MapContainer.jsx` receives the same geometry and passes it to Leaflet as a `Polyline` layer. Marker pins use different icons/colors by stop type:

| Stop type | Map marker color |
|---|---|
| `start` | Blue |
| `pickup` | Green |
| `dropoff` | Red |
| `fuel` | Orange |
| `rest` | Purple |

---

## ELD Canvas Rendering

The ELD grid is drawn entirely in **SVG** — no canvas API, no third-party chart library.

### Grid Construction (`ELDLogsPage.jsx → ELDCanvas`)

```
Total SVG width  = LEFT_LABEL(130) + GRID_WIDTH(1248) + RIGHT_COL(72) = 1450px
Total SVG height = TOP_LABEL(32)   + GRID_HEIGHT(208) + 30            = 270px

GRID_WIDTH  = 52px per hour × 24 hours = 1248px
GRID_HEIGHT = 52px per row  × 4 rows   = 208px

Rows (top to bottom):
  OFF  (Off Duty)
  SB   (Sleeper Berth)
  D    (Driving)
  ON   (On Duty — Not Driving)
```

### Converting Events to Pixel Blocks

Each event's `start` and `end` time strings are converted to X positions:

```javascript
function timeToX(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return (h + m / 60) * HOUR_WIDTH;   // HOUR_WIDTH = 52px
}

// "06:30" → (6 + 30/60) × 52 = 338px from the grid's left edge
```

Each event becomes a filled `<rect>` at the correct row Y and spanning from `x1` to `x2`. A bright top-accent stripe (`height=4px`) gives each block a neon edge effect. Time range labels appear inside blocks wider than 44px.

### Status Transition Drop-Lines

When consecutive events are on different rows, a vertical white line connects them:

```javascript
if (prevRowIdx !== rowIdx) {
    // draw vertical <line> from the top of the higher row
    // to the bottom of the lower row at x = x1 of the new event
    // add a diamond <polygon> marker at the transition point
}
```

This reproduces the standard FMCSA paper log line drawing style in SVG.

### Totals Column

The right column (`RIGHT_COL = 72px`) shows per-row hour totals computed by summing event durations. A mini progress bar under each value shows proportion of the theoretical max (e.g. 11 hrs for Driving). The footer cell turns green with a `✓` if all four rows sum to exactly 24 hrs (within 0.3 hr tolerance), or red with `!` if there's a gap.

---

## PDF Export Pipeline

When the user clicks **Download / Print PDF** in `ELDLogsPage.jsx`:

1. `buildPrintHTML()` is called with the full `logs` array, resolved driver info, and shipping doc number.
2. The function generates a **complete standalone HTML string** — one `<div class="page-break">` per day.
3. Each page contains:
   - A `@page { size: A4 landscape }` CSS rule
   - A 10-column driver info grid (date, name, ID, truck, co-driver, carrier, office, shipping doc, miles, 24hr start)
   - A **self-contained inline SVG** built from the same event data as the on-screen canvas but using print-safe colors on a white background
   - A totals strip (OFF / SB / D / ON / 24-HR TOTAL)
   - An events table with status, start, end, duration, location columns
   - A remarks section
   - A signature line with the driver's name pre-filled in a serif font
4. The HTML string is opened in a new browser window via `window.open()`.
5. `window.print()` is called after a 600ms delay (to allow the DOM to paint).
6. The browser's native print dialog opens — the user can save as PDF or send to a printer.

No server round-trip, no external PDF library. The entire document is built client-side in memory.

---

## State Management

Spotter.ai uses **React's built-in state only** — no Redux, Zustand, or Context API. All shared state lives in `App.jsx` and flows down as props.

```
App.jsx
│
├── eldResult         ← full HOS simulation output from backend
├── driverInfo        ← driver/carrier form fields
└── tripPlanState     ← everything about the current trip
    ├── inputs        (form field strings)
    ├── locations     (geocoded lat/lon for each of the 3 points)
    ├── routeGeometry (GeoJSON LineString for Leaflet)
    ├── metrics       (distance, driveTime, eta, remainingCycle, ...)
    └── plannedStops  (array of stop objects)
```

`tripPlanState` is a single object updated via `setTripPlanState(prev => ({ ...prev, [key]: newVal }))` pattern. This means switching tabs (Plan Trip → Routes → ELD Logs) never loses the computed route — the map, timeline, and logs all read from the same source of truth.

`eldResult` is set by `TripPlanner` (via `onEldSolved` callback) and consumed by `ELDLogsPage`. This is the bridge between the route calculation and the log viewer.

---

## Geocoding & Routing Fallback Chain

Both the frontend and backend independently resolve addresses and routes. Here is the full chain:

```
FRONTEND (address autocomplete while typing)
  └─► Photon API (komoot.io)
        · Free, no key, returns city/state/country suggestions
        · Used only for UI suggestions — not for the final route calculation

BACKEND (geocoding on form submit)
  └─► Try 1: OpenRouteService Geocode API
        · Requires OPENROUTE_SERVICE_API_KEY in settings.py
        · Returns structured label + coordinates
  └─► Try 2 (fallback): Nominatim (OpenStreetMap)
        · No key required
        · User-Agent header set to identify the app

BACKEND (routing)
  └─► Try 1: OpenRouteService HGV Profile
        · Truck-safe routing (avoids low clearances, weight limits, urban bans)
        · Requires OPENROUTE_SERVICE_API_KEY
  └─► Try 2 (fallback): OSRM Car Profile
        · Standard road routing, no truck restrictions
        · Completely free, no key
```

If both attempts fail for any step, the view returns a clear error message to the frontend rather than silently producing wrong data.

---

## Features

### Trip Planner
- Address autocomplete via Photon — no API key needed
- Browser geolocation auto-fills the current location on mount via `navigator.geolocation`
- Reverse geocode on detected coordinates via Photon reverse endpoint
- Configurable: cycle hours (1–70), departure date, driver name/ID, truck number, co-driver, carrier, main office
- All driver info persists across tab navigation and flows into ELD log headers
- Route metrics overlay on the map: distance, estimated drive time, ETA date/time, remaining cycle hours, fuel stop count, rest stop count

### AI Route Optimization
- Dual-leg routing (Current → Pickup, Pickup → Dropoff) calculated separately then merged
- HGV profile prioritizes truck-legal roads
- Full GeoJSON polyline rendered on Leaflet map

### HOS Simulation Engine
Full minute-by-minute simulation of US FMCSA property-carrier rules:

| Rule | Limit |
|---|---|
| Driving | 11 hrs/shift |
| On-duty window | 14 hrs/shift |
| 30-min break trigger | After 8 hrs continuous driving |
| Shift reset | 10 hrs sleeper berth |
| Cycle | 70 hrs / 8 days |
| Cycle restart | 34 hrs off-duty |
| Fuel stops | Every 1,000 miles (30 min ON-duty) |
| Pickup / Dropoff | 1 hr each (ON-duty) |
| Pre-trip inspection | 30 min ON-duty at trip start |
| Post-trip inspection | 15 min ON-duty at destination |

### ELD Log Viewer & PDF Export
- FMCSA-standard 24-hour canvas drawn in pure SVG
- Color-coded status blocks: OFF (gray), SB (purple), D (blue), ON (amber)
- Vertical drop-lines with diamond markers at every status transition
- Per-row totals column with mini progress bars and 24-hr sum validation
- Multi-day pagination with prev/next day selector
- PDF/Print export — full A4 landscape HTML document, one page per day
- Add custom remarks inline without re-running the route

### Routes Page
- Full-screen Leaflet map with live route polyline and stop markers
- Route timeline listing every stop with status badges and duration
- Driver Briefing card (load specs, gate procedure, weather alerts)
- Assigned Asset card (truck model, health status)
- Action buttons: Share Link (copies URL), Print Manifest, Reschedule (re-queries backend with new date), Cancel Route (clears all shared state)

### Dispatch History
- Every planned trip is persisted to SQLite via the `TripDispatch` model
- Stores full JSON blobs: stops, daily logs, and route geometry
- `GET /api/history/` returns all records ordered by most recent creation date

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 8 |
| Map | Leaflet 1.9 |
| Animation | GSAP 3 |
| Icons | react-icons 5 |
| Backend framework | Django 6 + Django REST Framework |
| Database | SQLite (dev) |
| Geocoding | OpenRouteService / Nominatim |
| Routing | ORS HGV / OSRM |
| Address autocomplete | Photon (Komoot) |

---

## Project Structure

```
spotter/
├── backend/
│   ├── api/
│   │   ├── models.py           # TripDispatch model — persists every trip
│   │   ├── serializers.py      # Request validation (cycle_used clamped 0–70)
│   │   ├── views.py            # PlanTripAPIView, HistoryAPIView
│   │   ├── urls.py
│   │   └── services/
│   │       ├── hos_engine.py   # Core HOS simulation engine (600+ lines)
│   │       └── routing.py      # Geocoding + HGV route calculation
│   └── config/
│       └── settings.py
│
└── frontend/
    └── src/
        ├── App.jsx              # Root — tab routing + all shared state
        ├── components/
        │   ├── Homepage.jsx     # Landing page with hero background video
        │   ├── TripPlanner.jsx  # Trip form + map split view, calls backend
        │   ├── RoutesPage.jsx   # Active dispatch overview + action buttons
        │   ├── ELDLogsPage.jsx  # Log viewer, PDF export, remarks editor
        │   ├── ELDLogSheet.jsx  # Individual day SVG canvas (simpler variant)
        │   ├── MapContainer.jsx # Leaflet map wrapper
        │   ├── Sidebar.jsx      # Tab navigation
        │   └── TruckAnimation.jsx  # GSAP intro animation on first load
        ├── services/
        │   └── api.js           # Nominatim geocode + OSRM route helpers
        └── utils/
            └── eldSolver.js     # Self-contained client-side HOS solver
```

> `eldSolver.js` is a standalone JavaScript port of the Python HOS engine. It was built for offline use cases and is not currently wired to the main UI (the app uses the backend engine), but can be imported independently.

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- pip

### Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# Install dependencies
pip install django djangorestframework django-cors-headers requests

# Run migrations
python manage.py migrate

# Start the dev server
python manage.py runserver
```

The API will be available at `http://localhost:8000`.

#### Optional: OpenRouteService API Key

For truck-specific HGV routing (avoids low bridges, weight limits), add your ORS key to `backend/config/settings.py`:

```python
OPENROUTE_SERVICE_API_KEY = 'your-key-here'
```

If omitted, the system automatically falls back to OSRM car routing — the app works without it.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## API Reference

### `POST /api/plan-trip/`

Plan a trip and generate HOS logs.

**Request body:**
```json
{
  "current_location":   "Chicago, IL",
  "pickup_location":    "Kansas City, MO",
  "dropoff_location":   "Denver, CO",
  "current_cycle_used": 14.5
}
```

| Field | Type | Description |
|---|---|---|
| `current_location` | string | Driver's starting point |
| `pickup_location` | string | Where cargo is loaded |
| `dropoff_location` | string | Final destination |
| `current_cycle_used` | float `[0–70]` | Hours already used in the current 70-hr cycle |

**Success response `200`:**
```json
{
  "dispatch_id": 42,
  "total_miles": 1238.4,
  "total_days": 3,
  "legs": [
    { "from": "Chicago...", "to": "Kansas City...", "miles": 371.5, "drive_hours": 6.8 },
    { "from": "Kansas City...", "to": "Denver...", "miles": 866.9, "drive_hours": 15.8 }
  ],
  "stops": [
    { "type": "start",   "location": "Chicago...",              "duration_hrs": 0.0,  "lat": 41.85,  "lng": -87.65 },
    { "type": "rest",    "location": "Shift Rest - Mile 605",   "duration_hrs": 10.0, "lat": 40.12,  "lng": -93.23 },
    { "type": "pickup",  "location": "Kansas City...",          "duration_hrs": 1.0,  "lat": 39.09,  "lng": -94.57 },
    { "type": "fuel",    "location": "Fueling Stop - Mile 996", "duration_hrs": 0.5,  "lat": 39.45,  "lng": -100.21 },
    { "type": "dropoff", "location": "Denver...",               "duration_hrs": 1.0,  "lat": 39.73,  "lng": -104.98 }
  ],
  "daily_logs": [
    {
      "day": 1,
      "date": "2026-07-20",
      "total_miles_today": 605.0,
      "events": [
        { "status": "ON", "start": "00:00", "end": "00:30", "hours": 0.5, "location": "Chicago, IL", "description": "Pre-Trip Inspection" },
        { "status": "D",  "start": "00:30", "end": "11:30", "hours": 11.0, "location": "En route to Kansas City, MO" },
        { "status": "SB", "start": "11:30", "end": "21:30", "hours": 10.0, "location": "Rest Area — Mile 605" }
      ],
      "totals": { "off_duty": 2.5, "sleeper": 10.0, "driving": 11.0, "on_duty": 0.5 },
      "remarks": ["00:00 — Chicago, IL (On Duty: Pre-Trip Inspection, 0.5h)", "..."],
      "hos_violations": []
    }
  ],
  "route_geometry": {
    "type": "LineString",
    "coordinates": [[-87.629, 41.878], ..., [-104.990, 39.739]]
  }
}
```

**Error responses:**

| Code | Cause |
|---|---|
| `400` | Validation failure, geocoding failure, or routing failure |
| `500` | Unexpected error in the HOS simulation engine |

---

### `GET /api/history/`

Returns all past dispatch records ordered by most recent first.

**Response `200`:**
```json
[
  {
    "id": 42,
    "current_location": "Chicago, Cook County, Illinois...",
    "pickup_location": "Kansas City, Jackson County, Missouri...",
    "dropoff_location": "Denver, Denver County, Colorado...",
    "cycle_hours": 70.0,
    "distance_miles": 1238.4,
    "drive_hours": 22.6,
    "eta": "06:45",
    "eta_date": "2026-07-22",
    "created_at": "2026-07-20 14:32:01"
  }
]
```

---

## Screenshots

<div align="center">
  <img src="frontend/public/unnamed (1).jpg" alt="Trip Planner — form + live map" width="780" />
</div>

---

## License

MIT © 2026 Spotter Labs
