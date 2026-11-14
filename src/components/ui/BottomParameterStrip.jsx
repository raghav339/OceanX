import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Radio } from 'lucide-react';
import { PARAMETERS, calculateParameterAtDepth } from '../../data/oceanData';

export default function BottomParameterStrip({ 
  selectedParam, 
  setSelectedParam, 
  activeRegion,
  depth = 50,
  onNavigateToMap,
  refreshInterval = 60,
  onSelectRefreshInterval,
  refreshCountdown = 60,
  isRefreshing = false,
  lastRefreshedAt = null,
  onManualRefresh
}) {
  const { t } = useTranslation();

  const parameterConfigs = [
    {
      id: 'sst',
      title: `${t('parameters.sst', 'Sea Surface Temperature')} (°C)`,
      min: '0',
      max: '32',
      gradient: 'linear-gradient(to right, #001f3f, #0074D9, #00d2be, #2ECC40, #FFDC00, #FF851B, #FF4136)'
    },
    {
      id: 'salinity',
      title: `${t('parameters.salinity', 'Salinity')} (PSU)`,
      min: '30',
      max: '40',
      gradient: 'linear-gradient(to right, #051e3e, #0f4c81, #1b98e0, #56cbf9, #00ffc8)'
    },
    {
      id: 'currents',
      title: `${t('parameters.currents', 'Ocean Currents')} (m/s)`,
      min: '0',
      max: '2.0',
      isArrows: true
    },
    {
      id: 'wave',
      title: `${t('parameters.wave', 'Wave Height')} (m)`,
      min: '0',
      max: '6',
      gradient: 'linear-gradient(to right, #1e1b4b, #4338ca, #8b5cf6, #ec4899, #f43f5e)'
    },
    {
      id: 'chlorophyll',
      title: `${t('parameters.chlorophyll', 'Chlorophyll-a')} (mg/m³)`,
      min: '0.01',
      max: '10',
      gradient: 'linear-gradient(to right, #022c22, #065f46, #059669, #10b981, #a3e635, #fef08a)'
    },
    {
      id: 'oxygen',
      title: `${t('parameters.oxygen', 'Dissolved Oxygen')} (mg/L)`,
      min: '0',
      max: '10',
      gradient: 'linear-gradient(to right, #4a044e, #701a75, #0284c7, #06b6d4, #67e8f9)'
    }
  ];

  // Value transition detection & highlight flash trigger
  const [flashKey, setFlashKey] = useState(0);
  const prevValuesRef = useRef({});
  const [changedParams, setChangedParams] = useState({});

  useEffect(() => {
    if (!lastRefreshedAt) return;
    setFlashKey((k) => k + 1);

    const currentValues = {};
    const changed = {};
    parameterConfigs.forEach((p) => {
      const val = calculateParameterAtDepth(p.id, depth, activeRegion);
      currentValues[p.id] = val;
      if (prevValuesRef.current[p.id] !== undefined && prevValuesRef.current[p.id] !== val) {
        changed[p.id] = true;
      }
    });
    prevValuesRef.current = currentValues;
    setChangedParams(changed);

    const timer = setTimeout(() => {
      setFlashKey(0);
      setChangedParams({});
    }, 1200);

    return () => clearTimeout(timer);
  }, [lastRefreshedAt, activeRegion, depth]);

  // Countdown Ring math
  const ringRadius = 12;
  const circumference = 2 * Math.PI * ringRadius; // ~75.4
  const currentInterval = refreshInterval || 60;
  const safeCountdown = Math.max(0, Math.min(currentInterval, refreshCountdown ?? currentInterval));
  const progress = safeCountdown / currentInterval;
  const strokeDashoffset = circumference * (1 - progress);

  const formattedCountdown = safeCountdown >= 60 
    ? `${Math.floor(safeCountdown / 60)}:${String(safeCountdown % 60).padStart(2, '0')}`
    : `${safeCountdown}s`;

  const lastSyncTimeStr = lastRefreshedAt instanceof Date 
    ? lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Live';

  return (
    <footer className="h-16 px-3.5 py-1.5 flex items-center justify-between gap-2 z-30 select-none bg-[#0A1720]/95 border-t border-[#193544] backdrop-blur-md">
      {/* 1. 6-Parameter Quick Preview Cards */}
      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-0.5 custom-scrollbar">
        {parameterConfigs.map((param) => {
          const isSelected = selectedParam === param.id;
          const isFlashing = flashKey > 0;
          const isValueChanged = changedParams[param.id];

          return (
            <button
              key={param.id}
              onClick={() => setSelectedParam(param.id)}
              className={`relative flex-1 min-w-[130px] max-w-[190px] h-[52px] rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 overflow-hidden flex flex-col justify-between cursor-pointer border ${
                isFlashing ? 'animate-telemetry-flash' : ''
              } ${
                isSelected
                  ? 'bg-[#0C969C]/15 border-[#0C969C]/70 text-[#CCD0CF]'
                  : 'bg-[#0D202B] hover:bg-[#142D3A] border-[#193544] text-[#8FA8B2]'
              }`}
            >
              {/* Header Title & Live Value */}
              <div className="relative z-10 flex items-center justify-between gap-1">
                <span className={`text-[9.5px] font-medium truncate leading-tight ${isSelected ? 'text-[#CCD0CF]' : 'text-[#8FA8B2]'}`}>
                  {param.title}
                </span>
                <span className={`text-[9.5px] font-mono font-bold px-1 py-0.2 rounded border shrink-0 transition-all duration-300 ${
                  isFlashing || isValueChanged
                    ? 'animate-value-flash text-[#00FFC8] bg-[#0C969C]/35 border-[#00FFC8]/70 shadow-[0_0_8px_rgba(0,255,200,0.35)]'
                    : 'text-[#CCD0CF] bg-[#142D3A] border-[#214555]'
                }`}>
                  {calculateParameterAtDepth(param.id, depth, activeRegion)}
                </span>
              </div>

              {/* Visualization / Gradient Bar */}
              <div className="relative z-10 w-full my-0.5">
                {param.isArrows ? (
                  <div className="flex items-center justify-center gap-1.5 text-[#0C969C] text-[11px] font-mono tracking-wider">
                    <span>—→</span>
                    <span>-››</span>
                    <span>-›››</span>
                    <span className="text-[#6BA3BE]">»»»</span>
                  </div>
                ) : (
                  <div
                    className="h-1.5 w-full rounded border border-[#193544]"
                    style={{ background: param.gradient }}
                  />
                )}
              </div>

              {/* Min - Max Scale Labels */}
              <div className="relative z-10 flex items-center justify-between text-[8px] font-mono text-[#637C87]">
                <span>{param.min}</span>
                <span>{param.max}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Phase 1.1: Live Refresh Ticker & Countdown Ring */}
      <div className="h-[52px] px-2.5 py-1 rounded-lg border border-[#193544] bg-[#0D202B] flex items-center justify-between gap-2.5 shrink-0 shadow-sm">
        {/* Countdown Ring & Telemetry Status */}
        <div className="flex items-center gap-2">
          {/* SVG Countdown Progress Ring */}
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0" title={`Next telemetry refresh in ${safeCountdown}s`}>
            <svg className="w-8 h-8 transform -rotate-90">
              <circle
                cx="16"
                cy="16"
                r={ringRadius}
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-[#193544]"
                fill="transparent"
              />
              <circle
                cx="16"
                cy="16"
                r={ringRadius}
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-[#0C969C] transition-all duration-500 ease-linear"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-mono font-bold text-[#CCD0CF]">
              {formattedCountdown}
            </span>
          </div>

          {/* Pulsing Beacon & Last Sync Timestamp */}
          <div className="flex flex-col justify-center min-w-[70px]">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[9.5px] font-bold font-mono tracking-wider text-[#00FFC8] uppercase leading-none">
                {isRefreshing ? 'Syncing...' : 'Live Sync'}
              </span>
            </div>
            <span className="text-[8px] font-mono text-[#637C87] truncate mt-0.5" title={`Last updated: ${lastSyncTimeStr}`}>
              {isRefreshing ? 'Fetching met...' : `Synced ${lastSyncTimeStr}`}
            </span>
          </div>
        </div>

        {/* Polling Interval Selectors & Manual Refresh Button */}
        <div className="flex flex-col items-end justify-between h-full py-0.5">
          {/* Interval Toggle Pills (30s / 60s / 5m) */}
          <div className="flex items-center bg-[#06141B] p-0.5 rounded border border-[#193544] text-[8px] font-mono">
            {[
              { label: '30s', value: 30 },
              { label: '60s', value: 60 },
              { label: '5m', value: 300 }
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSelectRefreshInterval?.(opt.value)}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  currentInterval === opt.value
                    ? 'bg-[#0C969C] text-[#06141B] font-bold shadow-sm'
                    : 'text-[#8FA8B2] hover:text-[#CCD0CF]'
                }`}
                title={`Auto-refresh every ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Force Refresh Now Button */}
          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            title="Force refresh live meteorological observations now"
            className="flex items-center gap-1 text-[8.5px] font-mono text-[#8FA8B2] hover:text-[#00FFC8] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin text-[#00FFC8]' : ''}`} />
            <span>{t('ticker.refresh', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* 3. Interactive Global Mini-Map */}
      <div 
        onClick={onNavigateToMap}
        title="Click to switch to World Satellite Map"
        className="relative w-36 h-[52px] rounded-lg border border-[#193544] hover:border-[#214555] overflow-hidden flex flex-col items-center justify-between p-1 bg-[#0D202B] cursor-pointer transition-colors group shrink-0"
      >
        <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#8FA8B2] px-1">
          <span className="font-semibold text-[#CCD0CF]">Mini Map</span>
          <span className="text-[#0C969C]">Global</span>
        </div>

        {/* Satellite Map thumbnail */}
        <div className="relative w-full flex-1 rounded overflow-hidden border border-[#193544] bg-[#06141B]">
          <img 
            src="/world_map_satellite.jpg" 
            alt="Mini Map" 
            className="w-full h-full object-cover opacity-70 pointer-events-none group-hover:scale-105 transition-transform duration-200"
          />
          {/* Active Viewport Bounding Box */}
          <div className="absolute left-[24%] top-[18%] w-[52%] h-[64%] border border-[#0C969C] border-dashed rounded bg-[#0C969C]/15 pointer-events-none" />
        </div>
      </div>
    </footer>
  );
}
