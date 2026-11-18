import React, { useState, useRef } from 'react';
import { 
  X, Shield, Type, Image as ImageIcon, Upload, Trash2, 
  CheckSquare, Square, Check 
} from 'lucide-react';
import clsx from 'clsx';

export interface WatermarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  customWatermarkText: string;
  onUpdateCustomText: (text: string) => void;
  watermarkImage: string | null;
  watermarkImageName: string;
  onUpdateWatermarkImage: (dataUrl: string | null, fileName: string) => void;
  includeSignoff: boolean;
  onToggleSignoff: (include: boolean) => void;
}

const PRESET_WATERMARKS = [
  'CONFIDENTIAL', 
  'DRAFT', 
  'INTERNAL ONLY', 
  'APPROVED', 
  'RESTRICTED',
  'LEGAL REVIEW',
  'CLIENT COPY'
];

export const WatermarkModal: React.FC<WatermarkModalProps> = ({
  isOpen,
  onClose,
  customWatermarkText,
  onUpdateCustomText,
  watermarkImage,
  watermarkImageName,
  onUpdateWatermarkImage,
  includeSignoff,
  onToggleSignoff,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateWatermarkImage(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearAll = () => {
    onUpdateCustomText('');
    onUpdateWatermarkImage(null, '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isCustomActive = Boolean(customWatermarkText.trim() || watermarkImage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none">
      <div 
        className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Shield size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Custom Watermark & Branding
                </h3>
                {isCustomActive && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Applied to Canvas, generated PDF, and Word exports
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Tab Selector: Text vs Image */}
          <div className="flex rounded-xl bg-[var(--bg-surface-hover)] p-1 border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                activeTab === 'text'
                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <Type size={14} />
              <span>Text Watermark</span>
              {customWatermarkText.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('image')}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                activeTab === 'image'
                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <ImageIcon size={14} />
              <span>Image / Logo</span>
              {watermarkImage && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </button>
          </div>

          {/* TAB 1: TEXT WATERMARK */}
          {activeTab === 'text' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                  Type Custom Watermark
                </label>
                <input
                  type="text"
                  value={customWatermarkText}
                  onChange={(e) => onUpdateCustomText(e.target.value)}
                  placeholder="e.g. TRPW CONFIDENTIAL, DO NOT DISTRIBUTE..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50"
                  autoFocus
                />
              </div>

              {/* Quick Presets Chips */}
              <div>
                <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">
                  Quick Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_WATERMARKS.map((preset) => {
                    const isSelected = customWatermarkText.trim().toUpperCase() === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => onUpdateCustomText(preset)}
                        className={clsx(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer",
                          isSelected
                            ? "bg-[var(--accent)] text-white border-transparent shadow-xs"
                            : "bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        {preset}
                      </button>
                    );
                  })}
                  {customWatermarkText && (
                    <button
                      type="button"
                      onClick={() => onUpdateCustomText('')}
                      className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 transition-all cursor-pointer"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMAGE / LOGO UPLOAD */}
          {activeTab === 'image' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileUpload}
                className="hidden"
              />

              {watermarkImage ? (
                <div className="flex items-center gap-3 p-3 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl">
                  <div className="w-14 h-14 rounded-lg bg-white/5 border border-[var(--border-subtle)] p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={watermarkImage}
                      alt="Watermark preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate" title={watermarkImageName}>
                      {watermarkImageName || 'watermark_logo.png'}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                      <Check size={12} /> Image Watermark Ready
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      Centered diagonally on export
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateWatermarkImage(null, '');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-2 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                    title="Remove image"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--bg-surface-hover)]/60 rounded-xl text-center cursor-pointer transition-all group"
                >
                  <span className="w-10 h-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Upload size={20} />
                  </span>
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Upload Corporate Logo or Stamp
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] mt-1">
                    PNG, JPG, SVG, WebP (Renders with 18% opacity in PDF center)
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Governance Sign-off Checkbox */}
          <div className="pt-3 border-t border-[var(--border-subtle)]">
            <label 
              onClick={() => onToggleSignoff(!includeSignoff)}
              className="flex items-start gap-2.5 cursor-pointer select-none group"
            >
              <div className="pt-0.5">
                {includeSignoff ? (
                  <CheckSquare size={16} className="text-[var(--accent)]" />
                ) : (
                  <Square size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Include Governance & Executive Sign-off Matrix
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Appends Prepared By, Reviewed By, and Compliance approval table to PDF/DOCX
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40">
          {isCustomActive ? (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
            >
              Reset All
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
