# GAIA UAV Orthomosaic — Access Note

The highest-quality available imagery for UTD is the GAIA Lab UAV dataset described in:

- Tian, S., & Qiu, F. (2025). UAV-derived building heights and floor counts for the University of Texas at Dallas (July 2025 dataset). Data in Brief, 63, 112263. DOI: 10.1016/j.dib.2025.112263
- PubMed: https://pubmed.ncbi.nlm.nih.gov/41403960/

## What it contains

- True orthomosaic at 0.024 m GSD (2.4 cm per pixel)
- DSM and DTM rasters
- 373 drone images
- Building footprints and CSV tables

## Why it is useful

This resolution is far better than NAIP (~30–60 cm). It would let the MVP detect individual cars and parking-space lines with high accuracy.

## Why it is not downloaded here

The dataset appears to be linked to the Elsevier/ScienceDirect Data in Brief article and is not directly downloadable without access to the article or an associated data repository. The DOI redirect lands on a paywalled ScienceDirect page.

## How to get it

1. Check whether the UTD GAIA Lab can share the orthomosaic directly: https://gaia.utdallas.edu/uas/
2. Access the article/data through a UTD library or institutional login.
3. If obtained, convert to GeoTIFF and place it in this folder, then update `README.md`.

For the MVP, use `utd_naip_plus.tif` as the `StaticTestProvider` image.
