# OceanX – Feature Roadmap & Plan

> **Project:** Ocean Vision 3D — an interactive 3D oceanographic digital twin with AI copilot (Nerida), real-time meteorological feeds, ENSO simulation, 22-language i18n support, and a full data-explorer pipeline.

---

## 🗺️ What Already Exists

| Area | Current State |
|---|---|
| **3D Canvas** | Three.js ocean globe with procedural shaders, depth slices, buoy sprites, ADCP/BGC layers |
| **Scroll Story** | Scroll-driven cinematic entry experience (`ScrollOceanExperience`) |
| **World Map** | SVG equirectangular map with pan/zoom, station cards, inspector popup |
| **ENSO Sim** | El Niño / La Niña / Normal 3D globe sim with intensity slider |
| **Dashboard** | KPI cards (fleet, SST, waves, storms, QC score) |
| **Data Explorer** | Paginated table of all CTD/buoy/glider records with CSV/JSON export |
| **AI Copilot** | Nerida — Gemini API + offline fallback engine, voice I/O, tool calling |
| **Modals** | Buoy detail, Anomaly, Fleet, Location, Date Picker, Storm News, Analytic Report, Depth/Pressure, Colorbar, NetCDF Ingestion |
| **i18n** | 22 Indian languages + English via i18next |
| **Weather** | Open-Meteo live API + scientific fallback model |
| **Data** | Static in-situ profiles (Bay of Bengal, Arabian Sea, Equatorial Pacific, etc.) + beach data |

---

## 🚀 Feature Plan

### Phase 1 — Core Enhancements (High Impact, Low Effort)

#### 1.1 Real-Time Data Refresh & Live Ticker (Completed ✅)
**Problem:** Data is initialized once; the "Live" badge shows but values don't auto-refresh.
**Plan:**
- Add a configurable polling interval (30 s / 60 s / 5 min) that re-calls `getAccurateMeteorology()` for the active region.
- Show a countdown ring or pulsing dot on the bottom strip to indicate time until next refresh.
- Animate value transitions with a brief highlight flash when values update.

**Files to touch:** `App.jsx` (add polling `useEffect`), `BottomParameterStrip.jsx` (countdown UI)

---

#### 1.2 Persistent User Preferences (localStorage) (Completed ✅)
**Problem:** Every page reload resets the selected region, parameter, palette, language, and depth.
**Plan:**
- Serialize key state (`selectedParam`, `depth`, `palette`, `activeRegion.id`, `i18n.language`, `simSpeed`) to `localStorage` on change.
- Rehydrate on app init with safe defaults for missing keys.

**Files to touch:** `App.jsx`, new `src/hooks/usePersistedState.js`

---

#### 1.3 Shareable URL Deep-Links
**Problem:** Users cannot share a specific view (region + parameter + depth).
**Plan:**
- Encode `?region=bay_of_bengal&param=sst&depth=100&tab=3D+View` into the URL hash.
- Parse on load to restore state directly.
- Add a **Copy Link** button to the viewport toolbar.

**Files to touch:** `App.jsx`, `ViewportToolbar.jsx`

---

#### 1.4 Keyboard Shortcuts & Accessibility
**Problem:** No keyboard navigation; app is mouse-only.
**Plan:**
- Global shortcut map: `Space` = play/pause, `1-6` = switch parameter, `↑/↓` = depth ±50 m, `Esc` = close modal, `C` = toggle copilot, `M` = world map.
- Show a keyboard shortcut help overlay (`?` key).
- Add `aria-label`, `role`, and focus-trap to all modals.

**Files to touch:** `App.jsx` (global `keydown` handler), new `src/components/ui/KeyboardHelp.jsx`

---

#### 1.5 Animated Data Export
**Problem:** Export in Data Explorer only produces raw CSV/JSON; no visual export.
**Plan:**
- Add **Export as PNG** button on the 3D canvas (uses `renderer.domElement.toDataURL()`).
- Add **Export as SVG** on the World Map (serialize the SVG element).
- Add **Export Report PDF** using `window.print()` with a print stylesheet in the Analytic Report modal (already has `handlePrint` but no CSS).

**Files to touch:** `OceanCanvas.jsx`, `WorldMapView.jsx`, `AnalyticReportModal.jsx`, `index.css` (print styles)

---

### Phase 2 — New Views & Visualizations (Medium Effort)

#### 2.1 Time-Series Chart View
**Problem:** There's no chart view; users can't see historical trends.
**Plan:**
- New tab **"Time Series"** with a lightweight line/area chart (use native Canvas 2D or a minimal charting approach — no heavy library needed).
- Show 24-hour rolling SST, wave height, and wind speed for the active region.
- Support parameter switching and basin overlay (compare up to 3 basins).
- Add a scrubber that syncs with the main `timeHour` animation state.

**Files to touch:** New `src/components/ui/TimeSeriesView.jsx`, `App.jsx`, `Header.jsx`

---

#### 2.2 Vertical Profile Chart Modal
**Problem:** Depth profiles are shown as plain text tables in `BuoyDetailModal`; no visual.
**Plan:**
- Inside `BuoyDetailModal`, add a vertical profile chart: X = parameter value, Y = depth (inverted axis, 0 m at top).
- Plot all 8 depth levels (0–2000 m) as a smooth curve using Canvas 2D.
- Support switching between temperature, salinity, oxygen, chlorophyll tabs.
- Highlight the current selected depth with a horizontal marker line.

**Files to touch:** `BuoyDetailModal.jsx`, new `src/components/ui/DepthProfileChart.jsx`

---

#### 2.3 Storm Track Forecast Map
**Problem:** `StormNewsModal` shows static storm news cards; there's no visual track.
**Plan:**
- Inside `StormNewsModal` (or as a new panel in `WorldMapView`), render an SVG storm track: past track (solid line), forecast cone (shaded polygon), intensity dots colored by Saffir-Simpson category.
- Animate the storm dot along the forecast track on play.
- Use the existing static storm data from `oceanData.js` as the source.

**Files to touch:** `StormNewsModal.jsx`, `WorldMapView.jsx`

---

#### 2.4 Chlorophyll & Oxygen Bloom Overlay (World Map)
**Problem:** World Map only has 6 layer toggles but Chlorophyll and Oxygen layers are UI-only placeholders (no rendered data).
**Plan:**
- Render chlorophyll and oxygen as color-coded SVG `<rect>` tiles on the world map using the per-basin values from `REGIONS`.
- Use a green gradient (0 – 4 mg/m³) for chlorophyll and blue-to-red for oxygen.
- Show a bloom hotspot ring animation for high-chlorophyll regions.

**Files to touch:** `WorldMapView.jsx`

---

#### 2.5 Comparison Mode (Side-by-Side)
**Problem:** Users must navigate tabs to compare two basins.
**Plan:**
- Add a **Split View** button in `ViewportToolbar` that renders two `OceanCanvas` instances side-by-side.
- Each pane has an independent region/parameter selector.
- A diff overlay shows ΔT, ΔS, ΔO₂ between the two scenes.

**Files to touch:** `App.jsx`, `ViewportToolbar.jsx`, `OceanCanvas.jsx` (must accept external renderer options)

---

### Phase 3 — AI & Copilot Upgrades (Medium–High Effort)

#### 3.1 Nerida Proactive Alerts
**Problem:** Nerida only responds to queries; never initiates.
**Plan:**
- After 30 seconds in the 3D view, if `stormProbability > 60`, Nerida auto-opens a floating alert card (not the full panel) with a one-line warning and a "Tell me more" CTA.
- Alert is dismissable and respects a "quiet mode" toggle.
- Throttle: max 1 proactive alert per 10-minute session window.

**Files to touch:** `App.jsx`, `OceanCopilot.jsx`, new `src/components/ai/ProactiveAlertBanner.jsx`

---

#### 3.2 Copilot Conversation Export
**Problem:** Chat history is lost on close.
**Plan:**
- Add a **Download Chat** button (📥) in `CopilotHeader` that exports the full `messages` array as a formatted Markdown file.
- Include session metadata: region, date, parameter, engine source (live vs. offline).

**Files to touch:** `CopilotHeader.jsx`, `CopilotChat.jsx`

---

#### 3.3 Context-Aware Quick Actions
**Problem:** `CopilotQuickActions` shows the same 4 static prompts regardless of the active region or parameter.
**Plan:**
- Dynamically generate quick-action chips based on current state:
  - If `stormProbability > 50`: show "Explain storm risk" and "Show evacuation zones".
  - If `selectedParam === 'chlorophyll'`: show "Find bloom hotspots" and "Compare last month".
  - If ENSO phase is active: show "What does this mean for India's monsoon?".
- Regenerate chips on region/parameter change.

**Files to touch:** `CopilotQuickActions.jsx`, `OceanCopilot.jsx`

---

#### 3.4 Offline Engine — Anomaly Detection
**Problem:** `offlineEngine.js` handles Q&A but has no structured anomaly detection pipeline.
**Plan:**
- Add `detectAnomalies(region)` to `offlineEngine.js` that checks:
  - SST deviation from monthly climatology (> ±1.5 °C → anomaly).
  - Oxygen drop below 2 mg/L at any depth level (hypoxia warning).
  - Salinity spike > 36 PSU (freshwater intrusion anomaly).
- Feed results into `AnomalyModal` and surface them in Dashboard KPIs as live counts.

**Files to touch:** `src/lib/ai/offlineEngine.js`, `AnomalyModal.jsx`, `DashboardView.jsx`

---

### Phase 4 — Data & Connectivity (High Effort)

#### 4.1 Real NetCDF File Parsing (Client-Side)
**Problem:** `NetcdfIngestionModal` has an impressive UI but no actual file parsing; it only simulates ingestion.
**Plan:**
- Integrate `netcdfjs` (pure JS, no WASM dependency) to parse uploaded `.nc` files in the browser.
- Extract `temperature`, `salinity`, `oxygen`, `chlorophyll` variables and depth/lat/lon dimensions.
- Render the parsed data as a new buoy layer in the 3D canvas and Data Explorer.

**Files to touch:** `NetcdfIngestionModal.jsx`, `OceanCanvas.jsx`, `DataExplorerView.jsx`; add `netcdfjs` to `package.json`

---

#### 4.2 Additional Live Data Sources
**Problem:** Only Open-Meteo is used for live data.
**Plan:**
- **ERDDAP integration:** Pull SST grids from `coastwatch.pfeg.noaa.gov/erddap` for selected basins.
- **Copernicus Marine (CMEMS) preview:** Link to WMS tile endpoint for chlorophyll satellite imagery and overlay as a texture on the World Map.
- Wrap both in the same `weatherCache` pattern with 5-minute TTL and graceful fallback.

**Files to touch:** `src/utils/weatherService.js`, `WorldMapView.jsx`, new `src/services/erddapService.js`

---

#### 4.3 Historical Playback Mode
**Problem:** The timeline plays in real-time 24h loops but there's no actual historical data scrubbing.
**Plan:**
- Add a **Date Range Scrubber** in the advanced controls drawer: select any date between 2024-01-01 and today.
- Retrieve historical Open-Meteo data for the selected date using `start_date` / `end_date` params.
- Animate the 3D canvas by interpolating parameter values across the selected date window.

**Files to touch:** `AdvancedControlsDrawer.jsx`, `App.jsx`, `weatherService.js`, `OceanCanvas.jsx`

---

### Phase 5 — Polish & Performance

#### 5.1 Progressive Loading / Skeleton States
**Problem:** Heavy components (ENSO 3D view, Data Explorer with 1000+ rows) show no loading feedback.
**Plan:**
- Add `Suspense` boundaries with skeleton placeholders for each tab's content.
- Lazy-import heavy components: `EnsoSimulationView`, `DataExplorerView`, `WorldMapView` via `React.lazy`.
- This will also shrink the initial JS bundle (currently 2.4 MB).

**Files to touch:** `App.jsx`, new `src/components/ui/SkeletonView.jsx`

---

#### 5.2 Responsive Mobile Layout
**Problem:** The left panel, right analytics panel, and bottom strip overlap on small screens.
**Plan:**
- Collapse left and right panels into a bottom sheet drawer on screens `< 768px`.
- Replace the tab bar with a swipe-based carousel.
- Test on 390px (iPhone 15) and 820px (iPad) viewports.

**Files to touch:** `LeftControlPanel.jsx`, `RightAnalyticsPanel.jsx`, `BottomParameterStrip.jsx`, `Header.jsx`

---

#### 5.3 WebGL Performance Guard
**Problem:** `OceanCanvas.jsx` creates unlimited particle systems; can cause frame drops on integrated GPUs.
**Plan:**
- Detect GPU tier using `renderer.capabilities` (check `maxTextureSize` and `maxFragmentUniforms`).
- On low-tier GPUs, automatically reduce particle count by 50%, disable post-processing, and cap at 30 FPS.
- Show a "Performance mode active" badge.

**Files to touch:** `OceanCanvas.jsx`

---

#### 5.4 Telemetry-Free Analytics (Self-Hosted)
**Problem:** No way to know which features users actually use.
**Plan:**
- Implement a lightweight event counter in `localStorage` (no external service, fully offline).
- Track: tab switches, copilot queries sent, parameter changes, modals opened.
- Show a **Usage Stats** card in the About view for transparency.

**Files to touch:** New `src/utils/analytics.js`, `AboutView.jsx`, various components

---

## 📋 Priority Summary

| # | Feature | Phase | Effort | Impact |
|---|---|---|---|---|
| 1 | Real-time data refresh + live ticker | 1 | Low | 🔥 High |
| 2 | Persistent preferences (localStorage) | 1 | Low | 🔥 High |
| 3 | Vertical profile chart in Buoy Modal | 2 | Medium | 🔥 High |
| 4 | Time-Series Chart View (new tab) | 2 | Medium | 🔥 High |
| 5 | Nerida proactive storm alerts | 3 | Medium | 🔥 High |
| 6 | Context-aware quick actions in Copilot | 3 | Low | ⚡ Medium |
| 7 | Storm track forecast map | 2 | Medium | ⚡ Medium |
| 8 | Shareable URL deep-links | 1 | Low | ⚡ Medium |
| 9 | Keyboard shortcuts + accessibility | 1 | Low | ⚡ Medium |
| 10 | Offline anomaly detection engine | 3 | Medium | ⚡ Medium |
| 11 | Real NetCDF client-side parsing | 4 | High | ⚡ Medium |
| 12 | Historical playback scrubber | 4 | High | 🌊 High (long-term) |
| 13 | Progressive loading / lazy imports | 5 | Low | 🛠 Perf |
| 14 | Mobile responsive layout | 5 | Medium | 🛠 UX |
| 15 | Comparison side-by-side mode | 2 | High | 🌊 High (long-term) |
| 16 | ERDDAP / CMEMS live data | 4 | High | 🌊 High (long-term) |
| 17 | Copilot conversation export | 3 | Low | 🛠 UX |
| 18 | Animated export (PNG/SVG/PDF) | 1 | Low | 🛠 UX |
| 19 | WebGL performance guard | 5 | Low | 🛠 Perf |
| 20 | Self-hosted usage analytics | 5 | Low | 🛠 Insight |

---

## 🏗️ Suggested Build Order

```
Week 1:  Items 2, 1, 8, 13   → foundation & quick wins
Week 2:  Items 3, 4, 6, 18   → visualization & copilot polish
Week 3:  Items 5, 10, 7, 9   → AI upgrades & accessibility
Week 4:  Items 11, 14, 19    → data & performance
Future:  Items 12, 15, 16    → advanced data platform features
```

---

> *Generated by analyzing OceanX source: `src/App.jsx`, all components in `src/components/`, `src/data/`, `src/lib/ai/`, `src/utils/`.*
