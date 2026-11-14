import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Home, 
  Globe, 
  Layers, 
  MapPin, 
  ChevronDown,
  Box,
  Boxes,
  Maximize2,
  Compass,
  Zap,
  Sliders,
  Link2,
  Check,
  Camera
} from 'lucide-react';
import { PARAMETERS, VIEW_MODES } from '../../data/oceanData';
import { COLOR_PALETTES } from './ColorbarSettingsModal';

export default function ViewportToolbar({
  selectedParam,
  viewMode,
  setViewMode,
  onResetCamera,
  onToggleGlobe,
  onOpenLocationModal,
  onOpenWorldMap,
  isStormLayerActive,
  setIsStormLayerActive,
  onOpenColorbarSettings,
  palette = 'turbo',
  isLogScale = false,
  customRanges = {},
  regionName = 'Bay of Bengal',
  regionCoords = '15.297° N, 87.860° E',
  onGetShareUrl,
  onExportPng,
  isoLevel = 0.5,
  setIsoLevel
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExportPng = () => {
    if (onExportPng) {
      onExportPng();
      setExported(true);
      setTimeout(() => setExported(false), 2000);
      return;
    }
    const canvas = document.querySelector('canvas');
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `oceanx-3d-${selectedParam}-${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExported(true);
        setTimeout(() => setExported(false), 2000);
      } catch (err) {
        console.warn('Failed to export canvas snapshot:', err);
      }
    }
  };

  const handleCopyLink = async () => {
    let url = '';
    if (onGetShareUrl) {
      url = onGetShareUrl();
    } else if (typeof window !== 'undefined') {
      url = window.location.href;
    }
    if (!url) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy share link:', err);
    }
  };
  const currentParam = PARAMETERS[selectedParam] || PARAMETERS.sst;

  const activeRange = customRanges[selectedParam] || {
    min: currentParam.min,
    max: currentParam.max
  };

  const activePaletteObj = COLOR_PALETTES.find((p) => p.id === palette) || COLOR_PALETTES[0];
  const activeGradient = palette === 'default' ? currentParam.gradientCss : activePaletteObj.gradientCss;

  // Generate 5 dynamic tick labels
  const ticks = React.useMemo(() => {
    const min = activeRange.min;
    const max = activeRange.max;
    if (isLogScale && min > 0) {
      const logMin = Math.log10(min);
      const logMax = Math.log10(max);
      return [0, 0.25, 0.5, 0.75, 1].map((r) => {
        const val = Math.pow(10, logMin + r * (logMax - logMin));
        return parseFloat(val.toFixed(val < 1 ? 2 : 1));
      });
    }
    return [0, 0.25, 0.5, 0.75, 1].map((r) => {
      const val = min + r * (max - min);
      return parseFloat(val.toFixed(val < 10 ? 1 : 0));
    });
  }, [activeRange, isLogScale]);

  const modeIcons = {
    surface: Layers,
    depth_slice: Box,
    volume: Boxes,
    isosurface: Maximize2,
    vector_field: Compass
  };

  return (
    <>
      {/* 1. Top-Left Location Badge */}
      <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2">
        <div 
          onClick={onOpenLocationModal}
          title="Click to change ocean basin or coordinates"
          className="bg-[#0D202B] px-3 py-1.5 rounded-xl flex items-center gap-2 border border-[#193544] hover:border-[#214555] shadow-sm cursor-pointer transition-colors"
        >
          <div className="p-1 rounded-lg bg-[#142D3A] text-[#0C969C]">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#CCD0CF] flex items-center gap-1.5">
              {regionName}
              <ChevronDown className="w-3 h-3 text-[#637C87]" />
            </div>
            <div className="text-[10px] font-mono text-[#6BA3BE]">
              {regionCoords}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Left Floating Tool Stack */}
      <div className="absolute top-18 left-3.5 z-20 flex flex-col gap-1">
        <div className="bg-[#0D202B] p-1 rounded-xl flex flex-col gap-1 border border-[#193544] shadow-sm">
          <button
            onClick={onResetCamera}
            title="Reset Camera View (Home)"
            className="p-2 rounded-lg text-[#8FA8B2] hover:text-[#CCD0CF] hover:bg-[#142D3A] transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenWorldMap || onToggleGlobe}
            title="Open Interactive World Map"
            className="p-2 rounded-lg text-[#8FA8B2] hover:text-[#CCD0CF] hover:bg-[#142D3A] transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsStormLayerActive && setIsStormLayerActive(!isStormLayerActive)}
            title="Toggle 3D Storm System"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isStormLayerActive
                ? 'bg-[#C85A5A]/20 text-[#CCD0CF] border border-[#C85A5A]/40'
                : 'text-[#8FA8B2] hover:text-[#CCD0CF] hover:bg-[#142D3A]'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenColorbarSettings}
            title="Colorbar Editor, Opacity & 3D Depth Exaggeration"
            className="p-2 rounded-lg text-[#8FA8B2] hover:text-[#CCD0CF] hover:bg-[#142D3A] transition-colors cursor-pointer"
          >
            <Layers className="w-4 h-4" />
          </button>
          {/* Phase 1.5: Export 3D Canvas PNG */}
          <div className="relative">
            <button
              onClick={handleExportPng}
              title={exported ? "PNG Downloaded!" : "Export 3D View as PNG"}
              aria-label="Export 3D View as PNG"
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                exported
                  ? 'bg-[#0C969C]/25 text-[#00FFC8] border border-[#0C969C]/60'
                  : 'text-[#8FA8B2] hover:text-[#CCD0CF] hover:bg-[#142D3A]'
              }`}
            >
              {exported ? <Check className="w-4 h-4 text-[#00FFC8]" /> : <Camera className="w-4 h-4" />}
            </button>
            {exported && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 text-[10.5px] font-mono font-semibold bg-[#0D202B]/95 text-[#00FFC8] border border-[#00FFC8]/50 rounded-lg shadow-xl whitespace-nowrap z-30 flex items-center gap-1.5 backdrop-blur-md">
                <Check className="w-3 h-3 text-[#00FFC8]" />
                <span>PNG Saved!</span>
              </div>
            )}
          </div>
          {/* Phase 1.3: Copy Shareable View Deep-Link */}
          <div className="relative">
            <button
              onClick={handleCopyLink}
              title={copied ? "Link Copied!" : "Copy Shareable View Link (Deep-Link)"}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                copied
                  ? 'bg-[#0C969C]/25 text-[#00FFC8] border border-[#0C969C]/60'
                  : 'text-[#8FA8B2] hover:text-[#CCD0CF] hover:bg-[#142D3A]'
              }`}
            >
              {copied ? <Check className="w-4 h-4 text-[#00FFC8]" /> : <Link2 className="w-4 h-4" />}
            </button>
            {copied && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 text-[10.5px] font-mono font-semibold bg-[#0D202B]/95 text-[#00FFC8] border border-[#00FFC8]/50 rounded-lg shadow-xl whitespace-nowrap z-30 flex items-center gap-1.5 backdrop-blur-md">
                <Check className="w-3 h-3 text-[#00FFC8]" />
                <span>Link Copied!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Top-Right Dynamic Colorbar Legend */}
      <div className="absolute top-3.5 right-3.5 z-20">
        <div 
          onClick={onOpenColorbarSettings}
          title="Click to customize palette, bounds, log scale, or vertical depth exaggeration"
          className="bg-[#0D202B] px-3.5 py-2 rounded-xl border border-[#193544] hover:border-[#214555] shadow-sm min-w-[240px] cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#CCD0CF] mb-1.5">
            <div className="flex items-center gap-1.5">
              <span>{t(`parameters.${currentParam.id}`, currentParam.name)}</span>
              {isLogScale && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-[#142D3A] text-[#6BA3BE] font-mono">log₁₀</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[#6BA3BE] text-[10px]">({currentParam.unit})</span>
              <Sliders className="w-3 h-3 text-[#637C87] group-hover:text-[#0C969C] transition-colors" />
            </div>
          </div>

          {/* Continuous gradient strip */}
          <div
            className="h-2 w-full rounded border border-[#193544] mb-1"
            style={{ background: activeGradient }}
          />

          {/* Scale tick numbers */}
          <div className="flex justify-between text-[9px] font-mono text-[#8FA8B2] font-medium">
            {ticks.map((val, idx) => (
              <span key={idx}>{val}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Center-Bottom 3D View Mode Selector Bar */}
      <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        {/* Isosurface Extraction Threshold Slider (Shown only in isosurface mode) */}
        {viewMode === 'isosurface' && (
          <div className="bg-[#0D202B]/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl flex items-center gap-3 border border-[#0C969C]/40 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#CCD0CF] whitespace-nowrap">
              <Maximize2 className="w-3.5 h-3.5 text-[#00FFC8]" />
              <span>{t('viewModes.isoLevel', 'Iso Level')}:</span>
              <span className="font-mono text-[#00FFC8] w-9 text-right">{Math.round(isoLevel * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.01"
              value={isoLevel}
              onChange={(e) => setIsoLevel && setIsoLevel(parseFloat(e.target.value))}
              aria-label="Isosurface Extraction Threshold Level"
              className="w-28 sm:w-36 h-1.5 bg-[#142D3A] rounded-lg appearance-none cursor-pointer accent-[#0C969C]"
            />
          </div>
        )}

        <div className="bg-[#0D202B] p-1 rounded-xl flex items-center gap-1 border border-[#193544] shadow-sm">
          {VIEW_MODES.map((mode) => {
            const Icon = modeIcons[mode.id] || Layers;
            const isActive = viewMode === mode.id;

            return (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0C969C]/15 text-[#CCD0CF] font-semibold border border-[#0C969C]/45'
                    : 'text-[#8FA8B2] hover:text-[#CCD0CF] hover:bg-[#142D3A] border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0C969C]' : 'text-[#8FA8B2]'}`} />
                <span>{t(`viewModes.${mode.id}`, mode.label)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
