import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Keyboard, Play, Compass, Layers, Sparkles, Sliders, ArrowUp, ArrowDown } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

export default function KeyboardHelp({ isOpen, onClose }) {
  const { t } = useTranslation();
  const modalRef = useRef(null);

  useFocusTrap(isOpen, modalRef, onClose);

  if (!isOpen) return null;

  const shortcutSections = [
    {
      title: t('shortcuts.simulation', 'Workstation & Timeline'),
      icon: Play,
      items: [
        { keys: ['Space'], desc: t('shortcuts.playPause', 'Play / Pause timeline simulation') },
        { keys: ['?'], desc: t('shortcuts.toggleHelp', 'Toggle keyboard shortcut help overlay') },
        { keys: ['Esc'], desc: t('shortcuts.closeModal', 'Close active modal, drawer, or dialog') }
      ]
    },
    {
      title: t('shortcuts.parameters', 'Oceanographic Parameters (1 – 6)'),
      icon: Layers,
      items: [
        { keys: ['1'], desc: t('parameters.sst', 'Sea Surface Temperature (SST)') },
        { keys: ['2'], desc: t('parameters.salinity', 'Salinity (PSU)') },
        { keys: ['3'], desc: t('parameters.currents', 'Ocean Currents Velocity') },
        { keys: ['4'], desc: t('parameters.wave', 'Significant Wave Height') },
        { keys: ['5'], desc: t('parameters.chlorophyll', 'Chlorophyll-a Concentration') },
        { keys: ['6'], desc: t('parameters.oxygen', 'Dissolved Oxygen Layer') }
      ]
    },
    {
      title: t('shortcuts.navigation', 'Depth Layer & Navigation'),
      icon: Sliders,
      items: [
        { keys: ['↑'], desc: t('shortcuts.depthUp', 'Step depth shallower (-50 m)') },
        { keys: ['↓'], desc: t('shortcuts.depthDown', 'Step depth deeper (+50 m)') },
        { keys: ['M'], desc: t('shortcuts.worldMap', 'Toggle World Satellite Map View') },
        { keys: ['C'], desc: t('shortcuts.copilot', 'Toggle Nerida AI Ocean Copilot') }
      ]
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-help-title"
        aria-describedby="keyboard-help-desc"
        onClick={(e) => e.stopPropagation()}
        className="glass-panel rounded-3xl p-6 border border-[#0C969C]/40 shadow-glow-cyan max-w-2xl w-full relative bg-[#0D202B]/95 text-[#CCD0CF]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label={t('common.close', 'Close dialog')}
          className="absolute top-4 right-4 p-2 rounded-xl bg-[#142D3A] text-[#8FA8B2] hover:text-[#CCD0CF] hover:bg-[#183746] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#0C969C]/20 border border-[#0C969C]/40 flex items-center justify-center text-[#0C969C]">
            <Keyboard className="w-6 h-6" />
          </div>
          <div>
            <h2 id="keyboard-help-title" className="text-lg font-black text-[#CCD0CF] tracking-wide flex items-center gap-2">
              <span>{t('shortcuts.title', 'Keyboard Navigation & Shortcuts')}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0C969C]/20 text-[#00FFC8] border border-[#0C969C]/40">
                PRO HOTKEYS
              </span>
            </h2>
            <p id="keyboard-help-desc" className="text-xs text-[#8FA8B2] font-mono">
              {t('shortcuts.subtitle', 'Navigate the 3D ocean digital twin without leaving your keyboard')}
            </p>
          </div>
        </div>

        {/* Shortcut Groups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
          {shortcutSections.map((sec, idx) => {
            const Icon = sec.icon;
            const isFullSpan = idx === 1;

            return (
              <div 
                key={sec.title}
                className={`bg-[#06141B]/90 rounded-2xl p-3.5 border border-[#193544] ${isFullSpan ? 'md:col-span-2' : ''}`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#0C969C] uppercase tracking-wider mb-2.5">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{sec.title}</span>
                </div>

                <div className="space-y-2">
                  {sec.items.map((item) => (
                    <div key={item.desc} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#CCD0CF] font-medium leading-tight">{item.desc}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k) => (
                          <kbd
                            key={k}
                            className="min-w-[24px] px-2 py-0.8 rounded-lg bg-[#0D202B] border border-[#214555] font-mono font-bold text-center text-[11px] text-[#00FFC8] shadow-sm inline-block"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note & Got it Button */}
        <div className="flex items-center justify-between pt-3 border-t border-[#193544] text-[11px] font-mono text-[#637C87]">
          <span>{t('shortcuts.note', 'Shortcuts are automatically paused inside search & text inputs.')}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#0C969C] hover:bg-[#168FA0] text-[#06141B] font-bold text-xs transition-colors cursor-pointer"
          >
            {t('common.gotIt', 'Got it')}
          </button>
        </div>
      </div>
    </div>
  );
}
