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

> The truck animation intro and full-BG hero video play on first load — showing the cinematic experience before the app transitions into the dispatch dashboard.

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

## Features

### Trip Planner
- Address autocomplete via [Photon (Komoot)](https://photon.komoot.io/) — no API key needed
- Browser geolocation auto-fills the current location field
- Configurable cycle hours (up to 70 hr / 8-day cycle), departure date, driver and vehicle metadata
- Submits to the Django backend which geocodes, routes, and runs the HOS engine
- Route metrics overlay on the map: distance, drive time, ETA, remaining cycle, fuel stops, rest stops

### AI Route Optimization
- Geocoding via **OpenRouteService** (with Nominatim fallback)
- Routing via **ORS HGV profile** (with OSRM fallback) — truck-safe roads only
- Two-leg routing: Current → Pickup → Dropoff
- Route geometry injected into the Leaflet map as a GeoJSON polyline

### HOS Simulation Engine (`hos_engine.py`)
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

The engine returns per-day event logs with `start`, `end`, `status`, `location`, and `hours` for every duty status change — exactly what the ELD canvas needs.

### ELD Log Viewer & PDF Export
- FMCSA-standard 24-hour canvas drawn in pure SVG
- Color-coded status blocks: OFF (gray), SB (purple), D (blue), ON (amber)
- Vertical drop-lines with diamond markers at every status transition
- Per-row totals column with mini progress bars
- Multi-day pagination with day selector
- **PDF/Print export** — generates a full A4 landscape HTML document, one page per day, complete with driver info grid, event table, remarks, and signature line
- Add custom remarks inline without re-running the route

### Routes Page
- Full-screen map with live route overlay
- Route timeline listing every stop with status badges
- Driver Briefing card (load specs, gate procedure, weather alerts)
- Assigned Asset card
- Action buttons: Share Link, Print Manifest, Reschedule (re-queries backend), Cancel Route

### Dispatch History
- Every planned trip is persisted in SQLite via `TripDispatch` model
- `GET /api/history/` returns all past dispatches ordered by creation date

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
│   │   ├── models.py          # TripDispatch model
│   │   ├── serializers.py     # Request validation
│   │   ├── views.py           # PlanTripAPIView, HistoryAPIView
│   │   ├── urls.py
│   │   └── services/
│   │       ├── hos_engine.py  # Core HOS simulation engine
│   │       └── routing.py     # Geocoding + route calculation
│   └── config/
│       └── settings.py
│
└── frontend/
    └── src/
        ├── App.jsx             # Root — tab routing + shared state
        ├── components/
        │   ├── Homepage.jsx    # Landing page with hero video
        │   ├── TripPlanner.jsx # Trip form + map split view
        │   ├── RoutesPage.jsx  # Active dispatch overview
        │   ├── ELDLogsPage.jsx # Log viewer, PDF export
        │   ├── ELDLogSheet.jsx # Individual day SVG canvas
        │   ├── MapContainer.jsx
        │   ├── Sidebar.jsx
        │   └── TruckAnimation.jsx
        ├── services/
        │   └── api.js          # Geocode + route helpers
        └── utils/
            └── eldSolver.js    # Client-side HOS solver (standalone)
```

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

If omitted, the system falls back to OSRM car routing automatically.

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
  "current_location": "Chicago, IL",
  "pickup_location": "Kansas City, MO",
  "dropoff_location": "Denver, CO",
  "current_cycle_used": 14.5
}
```

**Response (abbreviated):**
```json
{
  "dispatch_id": 42,
  "total_miles": 1238.4,
  "total_days": 3,
  "legs": [...],
  "stops": [
    { "type": "start", "location": "Chicago...", "duration_hrs": 0.0, "lat": 41.85, "lng": -87.65 },
    { "type": "fuel",  "location": "Fueling Stop - Mile 1000", "duration_hrs": 0.5, ... },
    { "type": "rest",  "location": "Rest Break (10h Reset) - Mile 605", "duration_hrs": 10.0, ... },
    { "type": "pickup", ... },
    { "type": "dropoff", ... }
  ],
  "daily_logs": [
    {
      "day": 1,
      "date": "2026-07-20",
      "total_miles_today": 605.0,
      "events": [
        { "status": "ON", "start": "00:00", "end": "00:30", "hours": 0.5, "location": "Chicago..." },
        { "status": "D",  "start": "00:30", "end": "11:30", "hours": 11.0, "location": "En route..." },
        ...
      ],
      "totals": { "off_duty": 2.5, "sleeper": 10.0, "driving": 11.0, "on_duty": 0.5 },
      "hos_violations": []
    }
  ],
  "route_geometry": { "type": "LineString", "coordinates": [...] }
}
```

### `GET /api/history/`

Returns all past dispatch records ordered by most recent.

---

## How the HOS Engine Works

1. **Distances** are split 30% (leg 1: current → pickup) / 70% (leg 2: pickup → dropoff) and converted to drive hours at 55 mph average.
2. A **minute-by-minute simulation loop** advances through the trip, checking HOS clocks on every tick:
   - Cycle exhausted → 34-hr restart
   - Shift limit hit → 10-hr reset
   - 8 hrs continuous driving → 30-min break
   - Every 1,000 miles → 30-min fuel stop
3. Each minute appends a status token (`OFF`, `SB`, `D`, `ON`) to a flat timeline array.
4. The timeline is **sliced into 24-hour windows** to produce daily logs.
5. Each daily log gets per-minute **location interpolation** — stop coordinates are calculated by walking the route geometry using the Haversine formula.
6. **HOS violations** are flagged per day (exceeding 11-hr drive, 14-hr window, 70-hr cycle, or missing 30-min break).

---

## Screenshots

> Trip Planner — form + live map

<div align="center">
  <img src="frontend/public/unnamed (1).jpg" alt="Trip Planner" width="780" />
</div>

---

## License

MIT © 2026 Spotter Labs
