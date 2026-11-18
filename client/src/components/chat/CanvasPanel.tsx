import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { 
  X, Maximize2, Minimize2, Minus, Edit3, Eye, Copy, Check, 
  FileText, FileSpreadsheet, Mail, Sparkles, Loader2, Send,
  ChevronLeft, ChevronRight, Bookmark, BookmarkPlus,
  History, GitCompare, Shield, ChevronDown, CheckSquare, Square, Wand2, RotateCcw
} from 'lucide-react';
import clsx from 'clsx';
import { TemplatesModal, type DocumentTemplate } from './TemplatesModal';
import { EmailModal } from './EmailModal';
import { TemplateAutoFillModal, extractPlaceholders } from './TemplateAutoFillModal';
import { computeLineDiff } from '../../utils/diffHelper';

export interface CanvasArtifact {
  id: string;
  title: string;
  content: string;
  type?: 'document' | 'code' | 'table' | 'report';
}

export interface CanvasVersion {
  id: string;
  timestamp: number;
  label: string;
  content: string;
}

interface CanvasPanelProps {
  artifact: CanvasArtifact;
  onClose: () => void;
  onSendMessage?: (text: string) => void;
  onUpdateContent?: (newContent: string) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onMinimize?: () => void;
}

const sanitizeHtmlSchema: any = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'style', 'className', 'class'],
  },
};

const REFINEMENT_SUGGESTIONS = [
  "Make it more executive & concise",
  "Add a structured comparison table",
  "Check for missing operational steps",
  "Format as Official SOP",
  "Convert to Executive Email",
  "Add Action Checklist & Owners",
  "Add Key Takeaways summary",
  "Translate into professional Hindi",
];

const WATERMARK_OPTIONS = [
  { value: 'NONE', label: 'No Watermark', color: 'text-[var(--text-muted)]' },
  { value: 'CONFIDENTIAL', label: 'CONFIDENTIAL', color: 'text-red-500 font-bold' },
  { value: 'DRAFT', label: 'DRAFT', color: 'text-amber-500 font-bold' },
  { value: 'INTERNAL ONLY', label: 'INTERNAL ONLY', color: 'text-blue-500 font-bold' },
  { value: 'APPROVED', label: 'APPROVED', color: 'text-emerald-500 font-bold' },
] as const;

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  artifact,
  onClose,
  onSendMessage,
  onUpdateContent,
  isMaximized: isMaximizedProp,
  onToggleMaximize: onToggleMaximizeProp,
  onMinimize,
}) => {
  const [content, setContent] = useState(artifact?.content || '');
  const [title, setTitle] = useState(artifact?.title || 'Interactive Canvas');
  const [isEditing, setIsEditing] = useState(false);
  const [isMaximizedInternal, setIsMaximizedInternal] = useState(false);
  const isMax = isMaximizedProp !== undefined ? isMaximizedProp : isMaximizedInternal;
  const toggleMaximize = onToggleMaximizeProp || (() => setIsMaximizedInternal(!isMaximizedInternal));
  const [copied, setCopied] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | 'docx' | null>(null);

  // --- Option 3: Corporate Branding & Watermark Settings ---
  const [watermark, setWatermark] = useState<'NONE' | 'CONFIDENTIAL' | 'DRAFT' | 'INTERNAL ONLY' | 'APPROVED'>('NONE');
  const [includeSignoff, setIncludeSignoff] = useState(false);
  const [showExportSettings, setShowExportSettings] = useState(false);

  // --- Option 2: Version History & Diff Mode ---
  const [versions, setVersions] = useState<CanvasVersion[]>(() => [
    { id: 'v1', timestamp: Date.now(), label: 'Initial Draft', content: artifact?.content || '' }
  ]);
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);

  // --- Option 1: Template Placeholders Auto-Fill ---
  const [isAutoFillModalOpen, setIsAutoFillModalOpen] = useState(false);
  const detectedPlaceholders = useMemo(() => extractPlaceholders(content), [content]);

  // Modals
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [templateSavePayload, setTemplateSavePayload] = useState<{ title: string; content: string } | null>(null);

  // Refinement scroll container ref
  const refinementScrollRef = useRef<HTMLDivElement>(null);

  // Sync if artifact prop changes
  useEffect(() => {
    const newContent = artifact?.content || '';
    setContent(newContent);
    setTitle(artifact?.title || 'Interactive Canvas');

    // Add version snapshot if content is meaningfully different from latest
    setVersions(prev => {
      if (prev.length === 0 || prev[0].content !== newContent) {
        return [
          {
            id: `v${prev.length + 1}`,
            timestamp: Date.now(),
            label: `v${prev.length + 1} (${artifact?.title || 'Update'})`,
            content: newContent,
          },
          ...prev,
        ];
      }
      return prev;
    });
  }, [artifact?.content, artifact?.title]);

  const stats = useMemo(() => {
    const safeContent = typeof content === 'string' ? content : '';
    const words = safeContent.trim().split(/\s+/).filter(Boolean).length;
    const chars = safeContent.length;
    const hasTable = safeContent.includes('|') && safeContent.includes('---');
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, hasTable, readMinutes };
  }, [content]);

  // Compute diff lines between previous version and current content
  const diffLines = useMemo(() => {
    if (!isDiffMode || versions.length < 2) return [];
    const baseContent = versions[1]?.content || versions[versions.length - 1]?.content || '';
    return computeLineDiff(baseContent, content);
  }, [isDiffMode, versions, content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addVersionSnapshot = (newContent: string, reason: string) => {
    if (newContent.trim() === content.trim()) return;
    const nextNum = versions.length + 1;
    const newVer: CanvasVersion = {
      id: `v${nextNum}`,
      timestamp: Date.now(),
      label: `v${nextNum} (${reason})`,
      content: newContent,
    };
    setVersions([newVer, ...versions]);
    setContent(newContent);
    if (onUpdateContent) onUpdateContent(newContent);
  };

  const handleRestoreVersion = (ver: CanvasVersion) => {
    addVersionSnapshot(ver.content, `Restored ${ver.id}`);
    setShowHistoryMenu(false);
    setIsDiffMode(false);
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'docx') => {
    if (isExporting) return;
    setIsExporting(format);

    try {
      const safeContent = typeof content === 'string' ? content : '';
      const firstLine = safeContent.trim().split('\n')[0]?.replace(/[#*`_]/g, '').trim() || '';
      const exportTitle = firstLine.slice(0, 60) || title || 'bbot Document';

      const endpoint = format === 'pdf' 
        ? '/api/export/generate-pdf' 
        : format === 'excel' 
        ? '/api/export/generate-excel' 
        : '/api/export/generate-docx';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content,
          title: exportTitle,
          filename_hint: 'bbot_artifact',
          watermark: watermark === 'NONE' ? null : watermark,
          include_signoff: includeSignoff,
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.download_url) {
          window.open(data.download_url, '_blank');
        }
      } else {
        alert(`Failed to export ${format.toUpperCase()}. Please try again.`);
      }
    } catch (e) {
      console.error(`Export ${format} error:`, e);
      alert(`Export error. Please try again.`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleSendRefinement = (promptText: string) => {
    if (!promptText.trim() || !onSendMessage) return;
    onSendMessage(`Regarding this document ("${title}"):\n${promptText.trim()}`);
    setRefinePrompt('');
  };

  const scrollRefinement = (direction: 'left' | 'right') => {
    if (refinementScrollRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      refinementScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleSelectTemplate = (tpl: DocumentTemplate, mode: 'canvas' | 'chat') => {
    if (mode === 'canvas') {
      addVersionSnapshot(tpl.content, `Template: ${tpl.title.slice(0, 20)}`);
      setTitle(tpl.title);
    } else if (mode === 'chat' && onSendMessage) {
      onSendMessage(`Please help me fill out and customize this template for our requirements:\n\n### ${tpl.title}\n${tpl.content}`);
    }
  };

  return (
    <div className={clsx(
      "flex flex-col h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl transition-all duration-300 z-30",
      isMax ? "fixed inset-0 z-50 w-full" : "w-full"
    )}>
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md shrink-0 select-none">
        {/* Left: Document Identity & Stats */}
        <div className="flex items-center gap-2 shrink-0 max-w-[130px] xs:max-w-[170px] sm:max-w-[220px] md:max-w-[260px] min-w-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] shrink-0">
            <FileText size={16} />
          </span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate" title={title}>
                {title}
              </h3>
              {watermark !== 'NONE' && (
                <span className="hidden xl:inline-flex text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25 shrink-0">
                  {watermark}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono whitespace-nowrap truncate">
              {stats.words} words • {stats.readMinutes} min read
            </span>
          </div>
        </div>

        {/* View Controls & Action Toolbar (Horizontally scrollable without visible scrollbar so it never pushes controls) */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 min-w-0 flex-1 justify-end [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Version History Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHistoryMenu(!showHistoryMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all cursor-pointer"
              title="View document revision history"
            >
              <History size={12} className="text-[var(--accent)]" />
              <span className="hidden sm:inline">v{versions.length}</span>
              <ChevronDown size={10} className="opacity-70" />
            </button>

            {/* History Popover */}
            {showHistoryMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--border-subtle)] px-1">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1">
                    <History size={12} /> Version History
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">{versions.length} drafts</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {versions.map((ver, idx) => (
                    <div
                      key={ver.id}
                      className={clsx(
                        "flex items-center justify-between p-1.5 rounded-lg text-xs transition-all",
                        idx === 0
                          ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] font-semibold"
                          : "hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]"
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-1">
                        <span className="text-[11px] truncate font-medium">{ver.label}</span>
                        <span className="text-[9px] text-[var(--text-muted)]">
                          {new Date(ver.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(ver)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-surface)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border-subtle)] transition-all cursor-pointer shrink-0"
                          title="Restore this version"
                        >
                          <RotateCcw size={10} />
                          <span>Restore</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Diff Mode Toggle (if multiple versions exist) */}
          {versions.length > 1 && (
            <button
              type="button"
              onClick={() => setIsDiffMode(!isDiffMode)}
              className={clsx(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer",
                isDiffMode
                  ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/40 shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-hover)] border-[var(--border-subtle)]"
              )}
              title="Toggle side-by-side / inline diff against previous draft"
            >
              <GitCompare size={12} />
              <span className="hidden sm:inline">Diff</span>
            </button>
          )}

          {/* Templates Library Launcher */}
          <button
            type="button"
            onClick={() => {
              setTemplateSavePayload(null);
              setIsTemplatesModalOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all cursor-pointer"
            title="Browse standard corporate email & document templates"
          >
            <Bookmark size={12} className="text-amber-500" />
            <span className="hidden sm:inline">Templates</span>
          </button>

          {/* Save as Custom Template */}
          <button
            type="button"
            onClick={() => {
              setTemplateSavePayload({ title, content });
              setIsTemplatesModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 border border-transparent hover:border-amber-300 transition-all cursor-pointer"
            title="Save this document as a reusable template"
          >
            <BookmarkPlus size={14} />
          </button>

          {/* Edit / Preview Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setIsDiffMode(false);
              }}
              className={clsx(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer",
                !isEditing && !isDiffMode
                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              title="Preview rendered document"
            >
              <Eye size={12} />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setIsDiffMode(false);
              }}
              className={clsx(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer",
                isEditing 
                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              title="Edit markdown text"
            >
              <Edit3 size={12} />
              <span className="hidden sm:inline">Edit</span>
            </button>
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
            title="Copy content"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>

          {/* Branding & Watermark Settings Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportSettings(!showExportSettings)}
              className={clsx(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer",
                watermark !== 'NONE' || includeSignoff
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-xs"
                  : "bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
              )}
              title="Configure corporate watermark, classification, and governance sign-off"
            >
              <Shield size={12} />
              <span className="hidden sm:inline">Watermark</span>
              <ChevronDown size={10} className="opacity-70" />
            </button>

            {/* Watermark & Governance Settings Menu */}
            {showExportSettings && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-3 z-50 animate-in fade-in">
                <div className="pb-2 border-b border-[var(--border-subtle)] mb-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Shield size={14} className="text-amber-500" />
                    Branding & Watermark
                  </span>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    Applied to generated PDF and Word exports
                  </p>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Document Classification
                    </label>
                    <select
                      value={watermark}
                      onChange={(e) => setWatermark(e.target.value as any)}
                      className="w-full px-2.5 py-1 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none cursor-pointer"
                    >
                      {WATERMARK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-1">
                    <label 
                      onClick={() => setIncludeSignoff(!includeSignoff)}
                      className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-primary)] cursor-pointer select-none"
                    >
                      {includeSignoff ? (
                        <CheckSquare size={14} className="text-[var(--accent)]" />
                      ) : (
                        <Square size={14} className="text-[var(--text-muted)]" />
                      )}
                      <span>Include Governance Sign-off</span>
                    </label>
                    <p className="text-[9px] text-[var(--text-muted)] pl-5 mt-0.5">
                      Adds an executive approval & sign-off table at the end
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 mt-2 border-t border-[var(--border-subtle)] text-right">
                  <button
                    type="button"
                    onClick={() => setShowExportSettings(false)}
                    className="px-2.5 py-1 text-[10px] font-bold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Export Dropdown / Buttons */}
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={isExporting !== null}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/30 transition-all cursor-pointer"
            title="Export as PDF (with TRPW branding and selected watermark)"
          >
            {isExporting === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={isExporting !== null}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30 transition-all cursor-pointer"
            title="Export as Excel spreadsheet"
          >
            {isExporting === 'excel' ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('docx')}
            disabled={isExporting !== null}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30 transition-all cursor-pointer"
            title="Export as Word document (.docx)"
          >
            {isExporting === 'docx' ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            <span className="hidden sm:inline">Word</span>
          </button>

          {/* Smart Email Launcher Button */}
          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 transition-all cursor-pointer"
            title="Draft & Send as Email via Gmail or Outlook"
          >
            <Mail size={12} />
            <span className="hidden sm:inline">Email</span>
          </button>
        </div>

        {/* Pinned Window Controls (Minimize, Maximize/Restore, Close X) - Always visible & never pushed off-screen */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 pl-1.5 sm:pl-2 ml-1 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          {/* Minimize Button */}
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
              title="Minimize Canvas to dock"
            >
              <Minus size={14} />
            </button>
          )}

          {/* Maximize / Restore Button */}
          <button
            type="button"
            onClick={toggleMaximize}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
            title={isMax ? "Restore Split View" : "Maximize Canvas (Fullscreen)"}
          >
            {isMax ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Close Button (X) */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/15 active:scale-95 transition-all cursor-pointer group"
            title="Close Canvas"
          >
            <X size={15} className="group-hover:scale-110 transition-transform stroke-[2.2]" />
          </button>
        </div>
      </div>

      {/* Sub-Header Banner for Template Placeholders (Option 1) */}
      {detectedPlaceholders.length > 0 && (
        <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/25 flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <Sparkles size={13} className="text-amber-500 shrink-0" />
            <span className="font-semibold">
              {detectedPlaceholders.length} template placeholders detected ({detectedPlaceholders.slice(0, 3).join(', ')}{detectedPlaceholders.length > 3 ? '...' : ''})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAutoFillModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-500 transition-all cursor-pointer shadow-xs shrink-0"
          >
            <Wand2 size={12} />
            <span>Fill Placeholders</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--bg-surface)]">
        {isDiffMode ? (
          /* Option 2: Visual Diff Viewer */
          <div className="flex flex-col space-y-1 font-mono text-xs leading-relaxed">
            <div className="p-2 mb-3 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
              <span>Comparing current draft against previous version ({versions[1]?.label || 'Previous'})</span>
              <button
                type="button"
                onClick={() => setIsDiffMode(false)}
                className="text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
              >
                Exit Diff Mode
              </button>
            </div>
            {diffLines.map((line, idx) => (
              <div
                key={idx}
                className={clsx(
                  "px-3 py-1 rounded font-mono text-xs flex items-start gap-2",
                  line.type === 'added' && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-l-2 border-emerald-500 font-semibold",
                  line.type === 'removed' && "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-l-2 border-rose-500 line-through opacity-75",
                  line.type === 'unchanged' && "text-[var(--text-primary)]"
                )}
              >
                <span className="w-4 select-none opacity-50 shrink-0">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                <span className="flex-1 whitespace-pre-wrap">{line.text || ' '}</span>
              </div>
            ))}
          </div>
        ) : isEditing ? (
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (onUpdateContent) onUpdateContent(e.target.value);
            }}
            onBlur={() => {
              // Create snapshot on editor blur if content was edited
              addVersionSnapshot(content, 'Manual Edit');
            }}
            className="w-full h-full min-h-[400px] p-4 bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-mono text-xs sm:text-sm rounded-xl border border-[var(--border-subtle)] focus:border-[var(--accent)] focus:outline-none resize-none leading-relaxed"
            placeholder="Edit document content..."
          />
        ) : (
          <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-[var(--text-primary)]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeHtmlSchema]]}
              components={{
                table({ children, ...props }: any) {
                  return (
                    <div className="overflow-x-auto my-4 w-full border border-[var(--border-subtle)] rounded-lg">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm" {...props}>
                        {children}
                      </table>
                    </div>
                  );
                },
                thead({ children, ...props }: any) {
                  return <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-subtle)]" {...props}>{children}</thead>;
                },
                th({ children, ...props }: any) {
                  return <th className="px-3 py-2 font-semibold text-[var(--text-primary)]" {...props}>{children}</th>;
                },
                td({ children, ...props }: any) {
                  return <td className="px-3 py-2 border-b border-[var(--border-subtle)]" {...props}>{children}</td>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Bottom Refinement Prompt Bar with Visible Scroll Controls */}
      {onSendMessage && (
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 flex flex-col gap-2">
          {/* Quick refinement suggestion bar with scroll arrows and visible scrollbar */}
          <div className="flex items-center gap-1.5 w-full">
            <span className="text-[11px] text-[var(--text-muted)] font-semibold shrink-0 flex items-center gap-1 mr-1">
              <Sparkles size={12} className="text-amber-500" /> Refine:
            </span>

            {/* Left Scroll Button */}
            <button
              type="button"
              onClick={() => scrollRefinement('left')}
              className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer shrink-0 border border-[var(--border-subtle)]"
              title="Scroll left"
            >
              <ChevronLeft size={13} />
            </button>

            {/* Scrollable Chips Container with visible styled scrollbar */}
            <div 
              ref={refinementScrollRef}
              className="flex items-center gap-1.5 overflow-x-auto text-[11px] scroll-smooth pr-6 py-1 select-none"
              style={{
                scrollbarWidth: 'thin',
              }}
            >
              {REFINEMENT_SUGGESTIONS.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendRefinement(suggestion)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--bg-surface-hover)] hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all cursor-pointer font-medium whitespace-nowrap shadow-2xs"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Right Scroll Button */}
            <button
              type="button"
              onClick={() => scrollRefinement('right')}
              className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer shrink-0 border border-[var(--border-subtle)]"
              title="Scroll right"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Custom refinement input */}
          <div className="flex items-center gap-2 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 focus-within:border-[var(--accent)] transition-all">
            <input
              type="text"
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendRefinement(refinePrompt);
                }
              }}
              placeholder="Ask bbot to edit, expand, or format this artifact..."
              className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleSendRefinement(refinePrompt)}
              disabled={!refinePrompt.trim()}
              className="p-1 text-[var(--accent)] disabled:opacity-40 hover:opacity-80 transition-opacity cursor-pointer"
              title="Send refinement instruction"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Smart Email Modal */}
      <EmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        defaultSubject={title}
        defaultBody={content}
      />

      {/* Reusable Templates Modal */}
      <TemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        initialSaveContent={templateSavePayload}
        onSavedSuccess={() => {
          setTemplateSavePayload(null);
        }}
      />

      {/* Smart Template Auto-Fill Placeholders Wizard Modal */}
      <TemplateAutoFillModal
        isOpen={isAutoFillModalOpen}
        onClose={() => setIsAutoFillModalOpen(false)}
        content={content}
        onApply={(filled) => {
          addVersionSnapshot(filled, 'Placeholders Filled');
        }}
      />
    </div>
  );
};
