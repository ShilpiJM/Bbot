import React, { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, Check, Wand2 } from 'lucide-react';

export interface TemplateAutoFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onApply: (filledContent: string) => void;
  defaultUserName?: string;
}

export function extractPlaceholders(text: string): string[] {
  if (!text) return [];
  // Matches tokens like [Your Name], [Start Date], [Department], [Manager's Name], [Process Name]
  const regex = /\[([A-Z][a-zA-Z0-9\s/_\-']{1,40})\]/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    // Exclude markdown check-boxes like [ ] or [x]
    if (raw === '[ ]' || raw === '[x]' || raw === '[X]') continue;
    matches.add(raw);
  }
  return Array.from(matches);
}

export const TemplateAutoFillModal: React.FC<TemplateAutoFillModalProps> = ({
  isOpen,
  onClose,
  content,
  onApply,
  defaultUserName = 'User',
}) => {
  const placeholders = useMemo(() => extractPlaceholders(content), [content]);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {};
      const todayStr = new Date().toISOString().split('T')[0];

      placeholders.forEach((ph) => {
        const lower = ph.toLowerCase();
        if (lower.includes('your name') || lower.includes('author name')) {
          initial[ph] = defaultUserName;
        } else if (lower.includes('date')) {
          initial[ph] = todayStr;
        } else if (lower.includes('department')) {
          initial[ph] = 'Strategic Operations';
        } else if (lower.includes('manager')) {
          initial[ph] = 'Reporting Manager';
        } else {
          initial[ph] = '';
        }
      });
      setValues(initial);
    }
  }, [isOpen, placeholders, defaultUserName]);

  if (!isOpen) return null;

  const handleSmartAutoFill = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const filled: Record<string, string> = { ...values };
    placeholders.forEach((ph) => {
      const lower = ph.toLowerCase();
      if (!filled[ph] || filled[ph].trim() === '') {
        if (lower.includes('your name') || lower.includes('author')) {
          filled[ph] = defaultUserName;
        } else if (lower.includes('end date') || lower.includes('return date')) {
          filled[ph] = nextWeek;
        } else if (lower.includes('start date') || lower.includes('date')) {
          filled[ph] = todayStr;
        } else if (lower.includes('department')) {
          filled[ph] = 'Strategic Operations';
        } else if (lower.includes('project')) {
          filled[ph] = 'Enterprise Modernization';
        } else if (lower.includes('company') || lower.includes('organization')) {
          filled[ph] = 'TRPW Strategic Partners';
        } else if (lower.includes('manager')) {
          filled[ph] = 'Director of Operations';
        } else {
          filled[ph] = ph.replace(/[\[\]]/g, '');
        }
      }
    });
    setValues(filled);
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    let updated = content;
    Object.entries(values).forEach(([placeholder, replacement]) => {
      if (replacement && replacement.trim()) {
        updated = updated.split(placeholder).join(replacement.trim());
      }
    });
    onApply(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-xl max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                Fill Template Placeholders
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                {placeholders.length} interactive fields detected in this template
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleApply} className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--border-subtle)]/50">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Document Fields
            </span>
            <button
              type="button"
              onClick={handleSmartAutoFill}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 transition-all cursor-pointer"
            >
              <Wand2 size={12} />
              <span>Smart Pre-Fill</span>
            </button>
          </div>

          {placeholders.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">
              No bracketed placeholders (like [Your Name]) found in this document.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {placeholders.map((ph) => {
                const cleanLabel = ph.replace(/[\[\]]/g, '');
                return (
                  <div key={ph} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 bg-[var(--bg-surface-hover)]/30 p-2 rounded-xl border border-[var(--border-subtle)]">
                    <label className="text-xs font-medium text-[var(--text-primary)] font-mono shrink-0 sm:w-1/3 truncate" title={ph}>
                      {cleanLabel}
                    </label>
                    <input
                      type="text"
                      value={values[ph] || ''}
                      onChange={(e) => setValues({ ...values, [ph]: e.target.value })}
                      placeholder={`Enter ${cleanLabel}...`}
                      className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={placeholders.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-md disabled:opacity-40"
            >
              <Check size={14} />
              <span>Apply to Document</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
