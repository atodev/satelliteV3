# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A pure-frontend satellite tracker for **Starlink Direct-to-Cell (DTC)** satellites. No backend — all data fetched client-side from CelesTrak.

**Stack:** Cesium.js (3D globe) + satellite.js (SGP4 orbital propagation) + CelesTrak API (TLE data)

## Architecture

Single-page app with no build step intended — plain HTML/JS files served statically.

Key data flow:
1. Fetch TLE data from CelesTrak for Starlink DTC constellation
2. Parse TLEs with satellite.js and propagate positions in real time
3. Render satellite positions on a Cesium globe
4. On hover: display a tooltip/popup with satellite version, specs, and image

## Starlink DTC Details

- **POC target:** Starlink DTC at 550 km orbit (existing constellation, use for initial testing)
- **Primary interest:** 330 km orbit (lower DTC orbit planned for V3)
- **V3 satellites:** Expected first launch Q4 2026; ~150 Mbps data throughput
- Satellite versions (V1, V2, V3) should be visually distinguished and shown in the hover popup

## CelesTrak API

Starlink TLEs are available from CelesTrak's GP data endpoint. Filter by object name prefix `STARLINK` and cross-reference with DTC designation. The relevant group name for CelesTrak queries is likely `starlink`.

## Cesium Setup

Cesium requires an access token (free tier available). The token should be set via `Cesium.Ion.defaultAccessToken`. Keep the token in a config constant at the top of the main JS file — do not hardcode into logic.

## Key Constraints

- No backend, no bundler required — keep it runnable by opening `index.html` directly or via a simple static server
- Mouse-over popups should include: satellite name, version (V1/V2/V3), orbit altitude, and a representative image
