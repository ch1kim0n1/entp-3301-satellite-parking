# UTD Resources

Downloaded public UTD campus and parking reference data.

## Files

- `Parking_Map_services.pdf` — official UTD main campus parking map from `services.utdallas.edu/download/Parking_Map.pdf`.
- `UTD-Parking-Map_ATC.pdf` — color-coded parking map (ATC/Arts & Technology Center).
- `Parking_Map_labs.pdf` — UTD labs parking map.
- `UTD_parking_services.html` — UTD Parking & Transportation landing page.
- `garage_availability.html` — raw HTML from the live garage availability page.
- `garage_availability.json` — parsed live availability counts for PS1, PS3, PS4.
- `GAIA_research.html` — GAIA Lab research page (UAS, smart campus geodatabase).
- `GAIA_uas.html` — GAIA Lab UAS/drone team page.
- `utd_naip_plus.tif` — USGS NAIP Plus aerial GeoTIFF covering the UTD campus area (~2.2 x 2.7 km, 4000x4000 px, Web Mercator / EPSG:3857).

## Notes

- The NAIP image is public domain USGS data.
- The live garage counts are public but volatile; the JSON file represents a snapshot.
- GAIA Lab UAV orthomosaic (2.4 cm GSD) is described in a 2025 Data in Brief article but is not freely downloadable. See `UAV_dataset_note.md`.
