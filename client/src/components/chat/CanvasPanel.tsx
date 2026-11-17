import React, { useState, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { 
  X, Maximize2, Minimize2, Edit3, Eye, Copy, Check, 
  FileText, FileSpreadsheet, Mail, Sparkles, Loader2, Send,
  ChevronLeft, ChevronRight, Bookmark, BookmarkPlus
} from 'lucide-react';
import clsx from 'clsx';
import { TemplatesModal, type DocumentTemplate } from './TemplatesModal';
import { EmailModal } from './EmailModal';

export interface CanvasArtifact {
  id: string;
  title: string;
  content: string;
  type?: 'document' | 'code' | 'table' | 'report';
}

interface CanvasPanelProps {
  artifact: CanvasArtifact;
  onClose: () => void;
  onSendMessage?: (text: string) => void;
  onUpdateContent?: (newContent: string) => void;
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

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  artifact,
  onClose,
  onSendMessage,
  onUpdateContent,
}) => {
  const [content, setContent] = useState(artifact?.content || '');
  const [title, setTitle] = useState(artifact?.title || 'Interactive Canvas');
  const [isEditing, setIsEditing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | 'docx' | null>(null);

  // Modals
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [templateSavePayload, setTemplateSavePayload] = useState<{ title: string; content: string } | null>(null);

  // Refinement scroll container ref
  const refinementScrollRef = useRef<HTMLDivElement>(null);

  // Sync if artifact prop changes
  React.useEffect(() => {
    setContent(artifact?.content || '');
    setTitle(artifact?.title || 'Interactive Canvas');
  }, [artifact?.content, artifact?.title]);

  const stats = useMemo(() => {
    const safeContent = typeof content === 'string' ? content : '';
    const words = safeContent.trim().split(/\s+/).filter(Boolean).length;
    const chars = safeContent.length;
    const hasTable = safeContent.includes('|') && safeContent.includes('---');
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, hasTable, readMinutes };
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          filename_hint: 'bbot_artifact'
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
      setContent(tpl.content);
      setTitle(tpl.title);
      if (onUpdateContent) onUpdateContent(tpl.content);
    } else if (mode === 'chat' && onSendMessage) {
      onSendMessage(`Please help me fill out and customize this template for our requirements:\n\n### ${tpl.title}\n${tpl.content}`);
    }
  };

  return (
    <div className={clsx(
      "flex flex-col h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl transition-all duration-300 z-30",
      isMaximized ? "fixed inset-0 z-50 w-full" : "w-full"
    )}>
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] shrink-0">
            <FileText size={16} />
          </span>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate max-w-[150px] sm:max-w-[240px]">
              {title}
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {stats.words} words • {stats.readMinutes} min read {stats.hasTable ? '• Contains Table' : ''}
            </span>
          </div>
        </div>

        {/* View Controls & Action Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
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
              onClick={() => setIsEditing(false)}
              className={clsx(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer",
                !isEditing 
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
              onClick={() => setIsEditing(true)}
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

          {/* Export Dropdown / Buttons */}
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={isExporting !== null}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/30 transition-all cursor-pointer"
            title="Export as PDF"
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

          {/* Maximize / Close */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer ml-0.5"
            title={isMaximized ? "Exit fullscreen" : "Fullscreen"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all cursor-pointer"
            title="Close Canvas"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--bg-surface)]">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (onUpdateContent) onUpdateContent(e.target.value);
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
    </div>
  );
};
