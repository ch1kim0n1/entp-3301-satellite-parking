# Satellite Parking Occupancy System

A map-based application where a user selects a parking area on a MapLibre map, the backend loads overhead imagery, runs a vehicle/occupancy detector, and returns a GeoJSON overlay showing which parking spaces are occupied or available.

## Core idea

1. User draws or selects a parking area on a satellite map.
2. Backend receives a GeoJSON `Polygon`.
3. Imagery is resolved by a pluggable provider (static test image, local drone image, Planet archive, Planet tasking).
4. Parking-space geometry is built from OpenStreetMap plus optional manual corrections.
5. A vision model detects vehicles.
6. Each parking space is intersected with detections to determine occupancy.
7. MapLibre renders occupied spaces in red, free spaces in green, and uncertain spaces in gray.

## Documentation map

- `ARCHITECTURE.md` — end-to-end system design
- `MVP.md` — the minimum viable product to build first
- `TECH_STACK.md` — languages, libraries, and OSS references
- `API.md` — request/response contracts
- `COORDINATES.md` — satellite image ↔ geographic coordinate math
- `ROADMAP.md` — suggested build order

## License / attribution

This repository contains original application code plus reference copies of open-source projects in `OSS/`. Refer to `TECH_STACK.md` and each upstream project for license terms. SMART_PARK is included for study only; its license is currently listed as TBD, so no code is copied directly from it.
