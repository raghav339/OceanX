import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/ui/Header';
import ScrollOceanExperience from './components/ui/ScrollOceanExperience';
import AdvancedControlsDrawer from './components/ui/AdvancedControlsDrawer';
import LeftControlPanel from './components/ui/LeftControlPanel';
import ViewportToolbar from './components/ui/ViewportToolbar';
import RightAnalyticsPanel from './components/ui/RightAnalyticsPanel';
import BottomParameterStrip from './components/ui/BottomParameterStrip';
import BuoyDetailModal from './components/ui/BuoyDetailModal';
import AnomalyModal from './components/ui/AnomalyModal';
import FleetModal from './components/ui/FleetModal';
import LocationModal from './components/ui/LocationModal';
import DatePickerModal from './components/ui/DatePickerModal';
import StormNewsModal from './components/ui/StormNewsModal';
import WorldMapView from './components/ui/WorldMapView';
import OceanCanvas from './components/canvas/OceanCanvas';
import AnalyticReportModal from './components/ui/AnalyticReportModal';
import DepthPressureModal from './components/ui/DepthPressureModal';
import DashboardView from './components/ui/DashboardView';
import DataExplorerView from './components/ui/DataExplorerView';
import AboutView from './components/ui/AboutView';
import EnsoSimulationView from './components/ui/EnsoSimulationView';
import ColorbarSettingsModal from './components/ui/ColorbarSettingsModal';
import NetcdfIngestionModal from './components/ui/NetcdfIngestionModal';
import KeyboardHelp from './components/ui/KeyboardHelp';
import OceanCopilot from './components/ai/OceanCopilot';
import { REGIONS, createLocationData } from './data/oceanData';
import { getFormattedCurrentDate, getCurrentUtcTimeHour } from './utils/dateUtils';
import { getAccurateMeteorology } from './utils/weatherService';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from './i18n/languages';
import { usePersistedState, getPersistedValue, setPersistedValue } from './hooks/usePersistedState';
import { parseUrlState, updateUrlHash, getShareableUrl, VALID_PARAMS, VALID_TABS } from './utils/deepLink';

export default function App() {
  const { i18n } = useTranslation();

  // Phase 1.3: Restore initial view mode / tab from URL deep-link if present, else fallback
  const [activeTab, setActiveTab] = useState(() => {
    const url = parseUrlState();
    if (url?.tab && VALID_TABS.includes(url.tab)) return url.tab;
    return 'Story View';
  });
  const [selectedParam, setSelectedParam] = usePersistedState('oceanx_pref_param', 'sst', {
    validator: (v) => typeof v === 'string' && VALID_PARAMS.includes(v)
  });
  const [depth, setDepth] = usePersistedState('oceanx_pref_depth', 50, {
    validator: (v) => typeof v === 'number' && !isNaN(v) && v >= 0 && v <= 6000
  });
  const [viewMode, setViewMode] = useState('depth_slice');
  const [timeHour, setTimeHour] = useState(() => getCurrentUtcTimeHour());
  const [isPlaying, setIsPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = usePersistedState('oceanx_pref_sim_speed', 1, {
    validator: (v) => typeof v === 'number' && !isNaN(v) && v > 0 && v <= 10
  });
  const [selectedBuoy, setSelectedBuoy] = useState(null);
  const [copilotExternalPrompt, setCopilotExternalPrompt] = useState(null);
  const [isFocusMode, setIsFocusMode] = usePersistedState('oceanx_pref_focus_mode', false, {
    validator: (v) => typeof v === 'boolean'
  });

  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isControlsDrawerOpen, setIsControlsDrawerOpen] = useState(false);
  const oceanCanvasRef = useRef(null);

  const handleToggleFocusMode = useCallback((val) => {
    setIsFocusMode((prev) => {
      const next = typeof val === 'boolean' ? val : !prev;
      if (next) {
        setIsCopilotOpen(false);
      }
      return next;
    });
  }, [setIsFocusMode, setIsCopilotOpen]);

  // Dynamic Colorbar, Palette, Layer Opacity & 3D Vertical Exaggeration State
  const [palette, setPalette] = usePersistedState('oceanx_pref_palette', 'turbo', {
    validator: (v) => typeof v === 'string' && v.trim().length > 0
  });
  const [layerOpacity, setLayerOpacity] = useState(0.95);
  const [verticalExaggeration, setVerticalExaggeration] = useState(1.0);
  const [isLogScale, setIsLogScale] = useState(false);
  const [isoLevel, setIsoLevel] = useState(0.5);
  const [customRanges, setCustomRanges] = useState({});

  // Dynamic ENSO (El Niño / La Niña / Normal) Simulation State
  const [ensoState, setEnsoState] = useState({
    phase: 'elnino', // 'normal' | 'elnino' | 'lanina'
    intensity: 0.75, // 0.1 to 1.0
    isPlaying: true
  });

  // Dynamic Location & Meteorological Threat State (Initializes from URL deep-link, persisted preference, or default)
  const [selectedDate, setSelectedDate] = useState(() => getFormattedCurrentDate());
  const [activeRegion, setActiveRegion] = useState(() => {
    const url = parseUrlState();
    const currentDate = getFormattedCurrentDate();
    if (url?.region && REGIONS[url.region]) {
      return {
        ...REGIONS[url.region],
        date: currentDate
      };
    }
    const saved = getPersistedValue('oceanx_pref_region', 'bay_of_bengal');
    if (typeof saved === 'string' && REGIONS[saved]) {
      return {
        ...REGIONS[saved],
        date: currentDate
      };
    }
    if (typeof saved === 'object' && saved !== null && typeof saved.lat === 'number' && typeof saved.lon === 'number') {
      return createLocationData(saved.lat, saved.lon, saved.name, currentDate);
    }
    return {
      ...REGIONS.bay_of_bengal,
      date: currentDate
    };
  });
  const [isStormLayerActive, setIsStormLayerActive] = useState(false);

  // Phase 1.3: Rehydrate initial deep-link parameters on mount
  useEffect(() => {
    const url = parseUrlState();
    if (!url) return;
    if (url.param && VALID_PARAMS.includes(url.param)) {
      setSelectedParam(url.param);
    }
    if (typeof url.depth === 'number' && !isNaN(url.depth)) {
      setDepth(url.depth);
    }
  }, [setSelectedParam, setDepth]);

  // Phase 1.3: Encode current view (region + param + depth + tab) into URL hash
  useEffect(() => {
    updateUrlHash({
      region: activeRegion?.id,
      param: selectedParam,
      depth: depth,
      tab: activeTab
    });
  }, [activeRegion?.id, selectedParam, depth, activeTab]);

  // Phase 1.3: Listen to browser hash changes (back/forward history and manual hash edits)
  useEffect(() => {
    const handleHashChange = () => {
      const url = parseUrlState();
      if (!url) return;
      if (url.tab && VALID_TABS.includes(url.tab)) {
        setActiveTab(url.tab);
      }
      if (url.param && VALID_PARAMS.includes(url.param)) {
        setSelectedParam(url.param);
      }
      if (typeof url.depth === 'number' && !isNaN(url.depth)) {
        setDepth(url.depth);
      }
      if (url.region && REGIONS[url.region]) {
        setActiveRegion((prev) => {
          if (prev?.id === url.region) return prev;
          return {
            ...REGIONS[url.region],
            date: getFormattedCurrentDate()
          };
        });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [setSelectedParam, setDepth]);

  // Phase 1.3: Helper to get shareable deep-link URL
  const getShareUrl = useCallback(() => {
    return getShareableUrl({
      region: activeRegion?.id,
      param: selectedParam,
      depth: depth,
      tab: activeTab
    });
  }, [activeRegion?.id, selectedParam, depth, activeTab]);

  // Phase 1.2: Serialize activeRegion to localStorage on change
  useEffect(() => {
    if (!activeRegion) return;
    if (activeRegion.id && REGIONS[activeRegion.id]) {
      setPersistedValue('oceanx_pref_region', activeRegion.id);
    } else if (typeof activeRegion.lat === 'number' && typeof activeRegion.lon === 'number') {
      setPersistedValue('oceanx_pref_region', {
        id: activeRegion.id || 'custom',
        lat: activeRegion.lat,
        lon: activeRegion.lon,
        name: activeRegion.name || 'Custom Location'
      });
    }
  }, [activeRegion, activeRegion?.id, activeRegion?.lat, activeRegion?.lon, activeRegion?.name]);

  // Phase 1.2: Rehydrate and synchronize i18n language preference
  useEffect(() => {
    try {
      const savedLang = getPersistedValue('oceanx_pref_language', null) || getPersistedValue('ocenova-language', null);
      if (savedLang && i18n && i18n.language !== savedLang && SUPPORTED_LANGUAGES.some((l) => l.code === savedLang)) {
        i18n.changeLanguage(savedLang);
      }
    } catch (_) {}
  }, [i18n]);

  useEffect(() => {
    if (!i18n?.language) return;
    setPersistedValue('oceanx_pref_language', i18n.language);
  }, [i18n?.language]);

  // Modals
  const [isAnomalyModalOpen, setIsAnomalyModalOpen] = useState(false);
  const [isFleetModalOpen, setIsFleetModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false);
  const [isStormNewsModalOpen, setIsStormNewsModalOpen] = useState(false);
  const [isAnalyticReportOpen, setIsAnalyticReportOpen] = useState(false);
  const [isDepthPressureOpen, setIsDepthPressureOpen] = useState(false);
  const [isColorbarSettingsOpen, setIsColorbarSettingsOpen] = useState(false);
  const [isNetcdfIngestionOpen, setIsNetcdfIngestionOpen] = useState(false);
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState(false);

  // Phase 1.4: Global Keyboard Shortcuts & Accessibility Handler
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ignore keystrokes when typing into interactive inputs
      const target = e.target;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable ||
        target?.getAttribute?.('role') === 'textbox'
      ) {
        return;
      }

      // 1. Esc: Close any active modal, drawer, or help overlay
      if (e.key === 'Escape') {
        if (isKeyboardHelpOpen) setIsKeyboardHelpOpen(false);
        else if (isLocationModalOpen) setIsLocationModalOpen(false);
        else if (isDatePickerModalOpen) setIsDatePickerModalOpen(false);
        else if (isStormNewsModalOpen) setIsStormNewsModalOpen(false);
        else if (isAnomalyModalOpen) setIsAnomalyModalOpen(false);
        else if (isFleetModalOpen) setIsFleetModalOpen(false);
        else if (selectedBuoy) setSelectedBuoy(null);
        else if (isAnalyticReportOpen) setIsAnalyticReportOpen(false);
        else if (isDepthPressureOpen) setIsDepthPressureOpen(false);
        else if (isColorbarSettingsOpen) setIsColorbarSettingsOpen(false);
        else if (isNetcdfIngestionOpen) setIsNetcdfIngestionOpen(false);
        else if (isControlsDrawerOpen) setIsControlsDrawerOpen(false);
        else if (isCopilotOpen) setIsCopilotOpen(false);
        return;
      }

      // 2. ?: Toggle Keyboard Help Overlay
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsKeyboardHelpOpen((prev) => !prev);
        return;
      }

      // Check if any modal is open before processing view/control shortcuts
      const isAnyModalOpen = isKeyboardHelpOpen || isAnomalyModalOpen || isFleetModalOpen ||
        isLocationModalOpen || isDatePickerModalOpen || isStormNewsModalOpen ||
        isAnalyticReportOpen || isDepthPressureOpen || isColorbarSettingsOpen ||
        isNetcdfIngestionOpen || selectedBuoy !== null || isControlsDrawerOpen;

      if (isAnyModalOpen) return;

      // 3. Space: Play / Pause simulation timeline
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
        return;
      }

      // 4. Numbers 1 – 6: Switch active parameter
      const paramMap = {
        '1': 'sst',
        '2': 'salinity',
        '3': 'currents',
        '4': 'wave',
        '5': 'chlorophyll',
        '6': 'oxygen'
      };
      if (paramMap[e.key]) {
        e.preventDefault();
        setSelectedParam(paramMap[e.key]);
        return;
      }

      // 5. Arrow Up / Down: Adjust depth by ±50 m
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDepth((prev) => Math.max(0, prev - 50));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDepth((prev) => Math.min(2000, prev + 50));
        return;
      }

      // 6. C: Toggle AI Ocean Copilot
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsCopilotOpen((prev) => !prev);
        return;
      }

      // 7. M: Toggle World Map / 3D Workstation
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'Map View' ? '3D View' : 'Map View'));
        return;
      }

      // 8. F: Toggle Full Workstation / Focus Mode (in 3D View)
      if (e.key === 'f' || e.key === 'F') {
        if (activeTab === '3D View') {
          e.preventDefault();
          handleToggleFocusMode();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isKeyboardHelpOpen, isAnomalyModalOpen, isFleetModalOpen, isLocationModalOpen,
    isDatePickerModalOpen, isStormNewsModalOpen, isAnalyticReportOpen, isDepthPressureOpen,
    isColorbarSettingsOpen, isNetcdfIngestionOpen, selectedBuoy, isControlsDrawerOpen,
    isCopilotOpen, setSelectedParam, setDepth, activeTab, handleToggleFocusMode
  ]);

  // Real-time animation timeline ticker
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimeHour((prev) => {
        const next = prev + 0.05 * simSpeed;
        return next >= 24 ? 0 : next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, simSpeed]);

  // Phase 1.1: Real-Time Data Refresh & Telemetry Polling State
  // Configurable polling interval: 30s / 60s / 300s (5 min) - persisted across reloads
  const [refreshInterval, setRefreshInterval] = usePersistedState('oceanx_pref_refresh_interval', 60, {
    validator: (v) => typeof v === 'number' && [30, 60, 300].includes(v)
  });
  const [refreshCountdown, setRefreshCountdown] = useState(refreshInterval);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());

  const activeRegionRef = useRef(activeRegion);
  useEffect(() => {
    activeRegionRef.current = activeRegion;
  }, [activeRegion]);

  const fetchMeteorologyForRegion = useCallback(async (targetRegion, force = false) => {
    if (!targetRegion?.lat || !targetRegion?.lon) return;
    setIsRefreshing(true);
    try {
      const targetLat = targetRegion.lat;
      const targetLon = targetRegion.lon;
      const liveMet = await getAccurateMeteorology(targetLat, targetLon, new Date(), targetRegion.sst, force);
      if (liveMet) {
        setActiveRegion((prev) => {
          if (!prev || Math.abs(prev.lat - targetLat) > 0.001 || Math.abs(prev.lon - targetLon) > 0.001) {
            return prev;
          }

          return {
            ...prev,
            isLive: liveMet.isLive,
            sst: liveMet.sst ?? prev.sst,
            currentSpeed: liveMet.currentSpeed ?? prev.currentSpeed,
            waveHeight: liveMet.waveHeight ?? prev.waveHeight,
            pressure: liveMet.pressure ?? prev.pressure,
            windSpeedKmH: liveMet.windSpeedKmH ?? prev.windSpeedKmH,
            rainProbability: liveMet.rainProbability,
            rainRate: liveMet.rainRate,
            stormProbability: liveMet.stormProbability,
            activeStorm: {
              ...prev.activeStorm,
              name: liveMet.isLive ? `${liveMet.weatherLabel} (${liveMet.stormCategory})` : prev.activeStorm?.name,
              category: liveMet.stormCategory,
              windSpeed: `${liveMet.windSpeedKmH} km/h`,
              pressure: `${liveMet.pressure} hPa`,
              rainfallForecast: `Precipitation chance: ${liveMet.rainProbability}% | Rain rate: ${liveMet.rainRate} mm/h (${liveMet.weatherLabel})`
            }
          };
        });
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      console.warn('Live marine weather fetch failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Sync when active coordinates change
  const activeCoordsKey = `${activeRegion?.lat?.toFixed(3)}_${activeRegion?.lon?.toFixed(3)}`;
  const prevCoordsKeyRef = useRef(activeCoordsKey);

  useEffect(() => {
    if (prevCoordsKeyRef.current !== activeCoordsKey) {
      prevCoordsKeyRef.current = activeCoordsKey;
      if (activeRegionRef.current) {
        fetchMeteorologyForRegion(activeRegionRef.current, false);
      }
      setRefreshCountdown(refreshInterval);
    }
  }, [activeCoordsKey, refreshInterval, fetchMeteorologyForRegion]);

  // Initial fetch on mount
  useEffect(() => {
    if (activeRegionRef.current) {
      fetchMeteorologyForRegion(activeRegionRef.current, false);
    }
  }, [fetchMeteorologyForRegion]);

  // Periodic polling countdown ticker (Phase 1.1)
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          if (activeRegionRef.current) {
            fetchMeteorologyForRegion(activeRegionRef.current, true);
          }
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [refreshInterval, fetchMeteorologyForRegion]);

  const handleSelectRefreshInterval = (newInterval) => {
    setRefreshInterval(newInterval);
    setRefreshCountdown(newInterval);
  };

  const handleManualRefresh = () => {
    setRefreshCountdown(refreshInterval);
    if (activeRegionRef.current) {
      fetchMeteorologyForRegion(activeRegionRef.current, true);
    }
  };

  const formatCurrentTime = (h) => {
    const hh = String(Math.floor(h)).padStart(2, '0');
    const mm = String(Math.floor((h % 1) * 60)).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const handleCustomCoords = (arg1, arg2) => {
    if (typeof arg1 === 'object' && arg1 !== null) {
      setActiveRegion(arg1);
    } else {
      const lat = typeof arg1 === 'number' ? arg1 : parseFloat(arg1);
      const lon = typeof arg2 === 'number' ? arg2 : parseFloat(arg2);
      if (!isNaN(lat) && !isNaN(lon)) {
        const newRegion = createLocationData(lat, lon, null, selectedDate);
        setActiveRegion(newRegion);
      }
    }
  };

  const handleSelectDate = (dateStr) => {
    setSelectedDate(dateStr);
    if (activeRegion) {
      const updated = createLocationData(activeRegion.lat, activeRegion.lon, activeRegion.name, dateStr);
      setActiveRegion(updated);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#06141B] text-[#CCD0CF] flex flex-col overflow-hidden select-none">
      {/* 1. Top Lightweight Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentTime={formatCurrentTime(timeHour)}
        selectedDate={selectedDate}
        onOpenDatePicker={() => setIsDatePickerModalOpen(true)}
        activeRegion={activeRegion}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenStormNews={() => setIsStormNewsModalOpen(true)}
        onOpenAlerts={() => setIsAnomalyModalOpen(true)}
        onOpenAnalyticReport={() => setIsAnalyticReportOpen(true)}
        onOpenDepthPressure={() => setIsDepthPressureOpen(true)}
        onOpenNetcdfIngestion={() => setIsNetcdfIngestionOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenControls={() => setIsControlsDrawerOpen(true)}
        onOpenKeyboardHelp={() => setIsKeyboardHelpOpen(true)}
        isFocusMode={isFocusMode && activeTab === '3D View'}
        onToggleFocusMode={handleToggleFocusMode}
      />

      {/* 2. Main Central Workstation or Views */}
      {activeTab === 'Story View' ? (
        /* CLEAN, MODERN SCROLL-DRIVEN 3D OCEAN EXPERIENCE */
        <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
          {/* A. Fixed 3D Ocean Digital Twin Background */}
          <div className="absolute inset-0 z-0 bg-[#06141B]">
            <OceanCanvas
              selectedParam={selectedParam}
              depth={depth}
              viewMode={viewMode}
              isoLevel={isoLevel}
              activeRegion={activeRegion}
              isStormLayerActive={isStormLayerActive}
              onSelectBuoy={(buoy) => setSelectedBuoy(buoy)}
              selectedBuoy={selectedBuoy}
              isPlaying={isPlaying}
              simSpeed={simSpeed}
              ensoState={ensoState}
              palette={palette}
              layerOpacity={layerOpacity}
              verticalExaggeration={verticalExaggeration}
              isLogScale={isLogScale}
            />
            {/* Soft vertical gradient for content legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#06141B]/70 via-transparent to-[#06141B]/85 pointer-events-none" />
          </div>

          {/* B. Scroll-driven Progressive Story Overlay */}
          <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
            <ScrollOceanExperience
              activeRegion={activeRegion}
              setActiveRegion={setActiveRegion}
              selectedParam={selectedParam}
              setSelectedParam={setSelectedParam}
              depth={depth}
              setDepth={setDepth}
              viewMode={viewMode}
              setViewMode={setViewMode}
              timeHour={timeHour}
              selectedDate={selectedDate}
              isStormLayerActive={isStormLayerActive}
              setIsStormLayerActive={setIsStormLayerActive}
              onOpenControls={() => setIsControlsDrawerOpen(true)}
              onOpenCopilot={() => setIsCopilotOpen(true)}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onOpenStormNews={() => setIsStormNewsModalOpen(true)}
              onOpenFleetModal={() => setIsFleetModalOpen(true)}
              onOpenAlerts={() => setIsAnomalyModalOpen(true)}
              onOpenAnalyticReport={() => setIsAnalyticReportOpen(true)}
              onOpenDepthPressure={() => setIsDepthPressureOpen(true)}
              onSwitchToWorkstation={() => setActiveTab('3D View')}
            />
          </div>

          {/* C. Floating ⚙ Controls Trigger at Bottom Left */}
          <div className="fixed bottom-6 left-6 z-30">
            <button
              onClick={() => setIsControlsDrawerOpen(true)}
              title="Open Advanced Controls Drawer"
              className="px-3.5 py-2 rounded-xl bg-[#0D202B]/95 hover:bg-[#142D3A] border border-[#193544] hover:border-[#214555] text-[#CCD0CF] text-xs font-medium shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md transition-all cursor-pointer flex items-center gap-2 group"
            >
              <span className="group-hover:rotate-45 transition-transform text-[#6BA3BE]">⚙</span>
              <span>Controls</span>
            </button>
          </div>
        </div>
      ) : activeTab === 'Dashboard' ? (
        <DashboardView
          onSelectRegion={(reg) => {
            setActiveRegion(reg);
          }}
          activeRegion={activeRegion}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onOpenAnalyticReport={() => setIsAnalyticReportOpen(true)}
          onOpenFleetModal={() => setIsFleetModalOpen(true)}
          onOpenStormNews={() => setIsStormNewsModalOpen(true)}
          onOpenAlerts={() => setIsAnomalyModalOpen(true)}
        />
      ) : activeTab === 'Map View' ? (
        <div className="relative flex-1 overflow-hidden">
          <WorldMapView
            activeRegion={activeRegion}
            onSelectRegion={(reg) => {
              setActiveRegion(reg);
              setActiveTab('Story View');
            }}
            onCustomCoords={(coordsObj) => {
              handleCustomCoords(coordsObj);
              setActiveTab('Story View');
            }}
            onBackTo3D={() => setActiveTab('Story View')}
          />
        </div>
      ) : activeTab === 'Data Explorer' ? (
        <DataExplorerView
          onSelectRegion={(reg) => {
            setActiveRegion(reg);
            setActiveTab('Story View');
          }}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onOpenNetcdfIngestion={() => setIsNetcdfIngestionOpen(true)}
        />
      ) : activeTab === 'About' ? (
        <AboutView
          onNavigateTab={(tab) => setActiveTab(tab)}
          onOpenAnalyticReport={() => setIsAnalyticReportOpen(true)}
        />
      ) : activeTab === 'El Niño Simulation' ? (
        <EnsoSimulationView
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      ) : (
        /* Classic Multi-Panel Workstation View (for power users) */
        <div className="relative flex-1 flex overflow-hidden">
          {/* Left Parameter, Location, Depth & Time Control Cockpit */}
          <div
            className={`focus-mode-transition overflow-hidden flex-shrink-0 flex flex-col ${
              isFocusMode
                ? 'w-0 opacity-0 -translate-x-6 pointer-events-none'
                : 'w-72 opacity-100 translate-x-0'
            }`}
            style={{ willChange: 'width, transform, opacity' }}
            aria-hidden={isFocusMode}
          >
            <LeftControlPanel
              selectedParam={selectedParam}
              setSelectedParam={setSelectedParam}
              depth={depth}
              setDepth={setDepth}
              timeHour={timeHour}
              setTimeHour={setTimeHour}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              simSpeed={simSpeed}
              setSimSpeed={setSimSpeed}
              activeRegion={activeRegion}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onCustomCoords={handleCustomCoords}
              selectedDate={selectedDate}
              onOpenDatePicker={() => setIsDatePickerModalOpen(true)}
              onOpenStormNews={() => setIsStormNewsModalOpen(true)}
              isStormLayerActive={isStormLayerActive}
              setIsStormLayerActive={setIsStormLayerActive}
              onOpenDepthPressure={() => setIsDepthPressureOpen(true)}
              onAskCopilot={(prompt) => setCopilotExternalPrompt(prompt)}
            />
          </div>

          {/* Center 3D Ocean Digital Twin Viewport */}
          <main
            className={`relative flex-1 h-full overflow-hidden bg-[#06141B] focus-mode-transition ${
              isFocusMode
                ? 'rounded-none my-0 mx-0 border-0 shadow-none'
                : 'rounded-2xl my-1.5 mx-1 border border-[#193544] shadow-md'
            }`}
          >
            <OceanCanvas
              ref={oceanCanvasRef}
              selectedParam={selectedParam}
              depth={depth}
              viewMode={viewMode}
              isoLevel={isoLevel}
              activeRegion={activeRegion}
              isStormLayerActive={isStormLayerActive}
              onSelectBuoy={(buoy) => setSelectedBuoy(buoy)}
              selectedBuoy={selectedBuoy}
              isPlaying={isPlaying}
              simSpeed={simSpeed}
              ensoState={ensoState}
              palette={palette}
              layerOpacity={layerOpacity}
              verticalExaggeration={verticalExaggeration}
              isLogScale={isLogScale}
            />

            {/* Floating Viewport HUD Overlays */}
            <ViewportToolbar
              selectedParam={selectedParam}
              viewMode={viewMode}
              setViewMode={setViewMode}
              isoLevel={isoLevel}
              setIsoLevel={setIsoLevel}
              isFocusMode={isFocusMode}
              onToggleFocusMode={handleToggleFocusMode}
              onOpenControls={() => setIsControlsDrawerOpen(true)}
              onResetCamera={() => {}}
              onToggleGlobe={() => setActiveTab('Map View')}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onOpenWorldMap={() => setActiveTab('Map View')}
              isStormLayerActive={isStormLayerActive}
              setIsStormLayerActive={setIsStormLayerActive}
              onOpenColorbarSettings={() => setIsColorbarSettingsOpen(true)}
              palette={palette}
              isLogScale={isLogScale}
              customRanges={customRanges}
              regionName={activeRegion?.name}
              regionCoords={activeRegion?.coords}
              onGetShareUrl={getShareUrl}
              onExportPng={() => oceanCanvasRef.current?.exportPng()}
            />
          </main>

          {/* Right In-Situ & Model Validation, Storm & AI Anomaly Analytics */}
          <div
            className={`focus-mode-transition overflow-hidden flex-shrink-0 flex flex-col ${
              isFocusMode
                ? 'w-0 opacity-0 translate-x-6 pointer-events-none'
                : 'w-80 opacity-100 translate-x-0'
            }`}
            style={{ willChange: 'width, transform, opacity' }}
            aria-hidden={isFocusMode}
          >
            <RightAnalyticsPanel
              onOpenAnomalyModal={() => setIsAnomalyModalOpen(true)}
              onOpenFleetModal={() => setIsFleetModalOpen(true)}
              activeRegion={activeRegion}
              onOpenStormNews={() => setIsStormNewsModalOpen(true)}
              onOpenAnalyticReport={() => setIsAnalyticReportOpen(true)}
              onOpenDepthPressure={() => setIsDepthPressureOpen(true)}
              depth={depth}
              ensoState={ensoState}
              onFocusPacific={() => setActiveTab('El Niño Simulation')}
              onAskCopilot={(prompt) => setCopilotExternalPrompt(prompt)}
            />
          </div>
        </div>
      )}

      {/* 3. Bottom 6-Parameter Strip (rendered on 3D Workstation and Map View) */}
      <div
        className={`focus-mode-transition overflow-hidden shrink-0 ${
          isFocusMode && activeTab === '3D View'
            ? 'max-h-0 opacity-0 pointer-events-none -translate-y-4'
            : (activeTab === '3D View' || activeTab === 'Map View')
              ? 'max-h-24 opacity-100 translate-y-0'
              : 'max-h-0 opacity-0 pointer-events-none hidden'
        }`}
        aria-hidden={isFocusMode && activeTab === '3D View'}
      >
        {(activeTab === '3D View' || activeTab === 'Map View') && (
          <BottomParameterStrip
            selectedParam={selectedParam}
            setSelectedParam={setSelectedParam}
            activeRegion={activeRegion}
            depth={depth}
            onNavigateToMap={() => setActiveTab('Map View')}
            refreshInterval={refreshInterval}
            onSelectRefreshInterval={handleSelectRefreshInterval}
            refreshCountdown={refreshCountdown}
            isRefreshing={isRefreshing}
            lastRefreshedAt={lastRefreshedAt}
            onManualRefresh={handleManualRefresh}
          />
        )}
      </div>

      {/* 4. Advanced Controls Slide-Over Drawer */}
      <AdvancedControlsDrawer
        isOpen={isControlsDrawerOpen}
        onClose={() => setIsControlsDrawerOpen(false)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isoLevel={isoLevel}
        setIsoLevel={setIsoLevel}
        depth={depth}
        setDepth={setDepth}
        selectedParam={selectedParam}
        setSelectedParam={setSelectedParam}
        palette={palette}
        setPalette={setPalette}
        layerOpacity={layerOpacity}
        setLayerOpacity={setLayerOpacity}
        verticalExaggeration={verticalExaggeration}
        setVerticalExaggeration={setVerticalExaggeration}
        isLogScale={isLogScale}
        setIsLogScale={setIsLogScale}
        timeHour={timeHour}
        setTimeHour={setTimeHour}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        simSpeed={simSpeed}
        setSimSpeed={setSimSpeed}
        selectedDate={selectedDate}
        onOpenDatePicker={() => setIsDatePickerModalOpen(true)}
        activeRegion={activeRegion}
        onCustomCoords={handleCustomCoords}
        isStormLayerActive={isStormLayerActive}
        setIsStormLayerActive={setIsStormLayerActive}
        onOpenStormNews={() => setIsStormNewsModalOpen(true)}
        onOpenFleetModal={() => setIsFleetModalOpen(true)}
        onOpenAlerts={() => setIsAnomalyModalOpen(true)}
        onOpenDepthPressure={() => setIsDepthPressureOpen(true)}
        onOpenNetcdfIngestion={() => setIsNetcdfIngestionOpen(true)}
        onOpenAnalyticReport={() => setIsAnalyticReportOpen(true)}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
      />

      {/* 5. Interactive Modals (100% Preserved) */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        activeRegion={activeRegion}
        onSelectRegion={(reg) => setActiveRegion(reg)}
        onCustomCoords={handleCustomCoords}
      />

      <DatePickerModal
        isOpen={isDatePickerModalOpen}
        onClose={() => setIsDatePickerModalOpen(false)}
        currentDate={selectedDate}
        onSelectDate={handleSelectDate}
      />

      <StormNewsModal
        isOpen={isStormNewsModalOpen}
        onClose={() => setIsStormNewsModalOpen(false)}
        activeRegion={activeRegion}
        isStormLayerActive={isStormLayerActive}
        setIsStormLayerActive={setIsStormLayerActive}
      />

      <BuoyDetailModal
        buoy={selectedBuoy}
        onClose={() => setSelectedBuoy(null)}
      />

      <AnomalyModal
        isOpen={isAnomalyModalOpen}
        onClose={() => setIsAnomalyModalOpen(false)}
      />

      <FleetModal
        isOpen={isFleetModalOpen}
        onClose={() => setIsFleetModalOpen(false)}
        onSelectBuoy={(buoy) => setSelectedBuoy(buoy)}
      />

      <AnalyticReportModal
        isOpen={isAnalyticReportOpen}
        onClose={() => setIsAnalyticReportOpen(false)}
        activeRegion={activeRegion}
        selectedDate={selectedDate}
        currentTime={formatCurrentTime(timeHour)}
      />

      <DepthPressureModal
        isOpen={isDepthPressureOpen}
        onClose={() => setIsDepthPressureOpen(false)}
        currentLat={activeRegion?.lat || 15.297}
        currentLon={activeRegion?.lon || 87.860}
        initialDepth={depth}
        onApplyDepth={(newDepth) => setDepth(newDepth)}
      />

      <ColorbarSettingsModal
        isOpen={isColorbarSettingsOpen}
        onClose={() => setIsColorbarSettingsOpen(false)}
        selectedParam={selectedParam}
        setSelectedParam={setSelectedParam}
        palette={palette}
        setPalette={setPalette}
        layerOpacity={layerOpacity}
        setLayerOpacity={setLayerOpacity}
        verticalExaggeration={verticalExaggeration}
        setVerticalExaggeration={setVerticalExaggeration}
        isLogScale={isLogScale}
        setIsLogScale={setIsLogScale}
        customRanges={customRanges}
        setCustomRanges={setCustomRanges}
      />

      <NetcdfIngestionModal
        isOpen={isNetcdfIngestionOpen}
        onClose={() => setIsNetcdfIngestionOpen(false)}
        onApplyIngestedDataset={(dataset) => {
          setActiveRegion((prev) => ({
            ...prev,
            name: `${prev.name.split(' (')[0]} (${dataset.format})`
          }));
        }}
      />

      {/* Phase 1.4: Accessible Keyboard Navigation Guide */}
      <KeyboardHelp
        isOpen={isKeyboardHelpOpen}
        onClose={() => setIsKeyboardHelpOpen(false)}
      />

      {/* 6. AI Ocean Copilot Floating Intelligence Dock & Drawer */}
      <OceanCopilot
        activeRegion={activeRegion}
        selectedParam={selectedParam}
        setSelectedParam={setSelectedParam}
        depth={depth}
        setDepth={setDepth}
        viewMode={viewMode}
        setViewMode={setViewMode}
        timeHour={timeHour}
        selectedDate={selectedDate}
        isStormLayerActive={isStormLayerActive}
        setIsStormLayerActive={setIsStormLayerActive}
        ensoState={ensoState}
        setActiveRegion={setActiveRegion}
        setActiveTab={setActiveTab}
        onCustomCoords={handleCustomCoords}
        setIsAnomalyModalOpen={setIsAnomalyModalOpen}
        setIsFleetModalOpen={setIsFleetModalOpen}
        setIsLocationModalOpen={setIsLocationModalOpen}
        setIsDatePickerModalOpen={setIsDatePickerModalOpen}
        setIsStormNewsModalOpen={setIsStormNewsModalOpen}
        setIsAnalyticReportOpen={setIsAnalyticReportOpen}
        setIsDepthPressureOpen={setIsDepthPressureOpen}
        setIsColorbarSettingsOpen={setIsColorbarSettingsOpen}
        setIsNetcdfIngestionOpen={setIsNetcdfIngestionOpen}
        externalPrompt={copilotExternalPrompt}
        onClearExternalPrompt={() => setCopilotExternalPrompt(null)}
        isOpen={isCopilotOpen}
        setIsOpen={setIsCopilotOpen}
        isFocusMode={isFocusMode && activeTab === '3D View'}
      />
    </div>
  );
}
