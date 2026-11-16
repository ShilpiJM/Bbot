import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { 
  X, Maximize2, Minimize2, Edit3, Eye, Copy, Check, 
  FileText, FileSpreadsheet, Mail, Sparkles, Loader2, Send 
} from 'lucide-react';
import clsx from 'clsx';

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

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  artifact,
  onClose,
  onSendMessage,
  onUpdateContent,
}) => {
  const [content, setContent] = useState(artifact.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | 'docx' | 'email' | null>(null);

  // Sync if artifact changes
  React.useEffect(() => {
    setContent(artifact.content);
  }, [artifact.content]);

  const stats = useMemo(() => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    const hasTable = content.includes('|') && content.includes('---');
    const readMinutes = Math.ceil(words / 200);
    return { words, chars, hasTable, readMinutes };
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'docx' | 'email') => {
    if (isExporting) return;
    setIsExporting(format);

    try {
      const firstLine = content.trim().split('\n')[0].replace(/[#*`_]/g, '').trim();
      const title = firstLine.slice(0, 60) || artifact.title || 'bbot Document';

      if (format === 'email') {
        const emailBody = encodeURIComponent(content);
        const emailSubject = encodeURIComponent(title);
        navigator.clipboard.writeText(`Subject: ${title}\n\n${content}`);
        window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`, '_blank');
      } else {
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
            title,
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
    onSendMessage(`Regarding this document ("${artifact.title}"):\n${promptText.trim()}`);
    setRefinePrompt('');
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
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate max-w-[180px] sm:max-w-[280px]">
              {artifact.title || 'Interactive Canvas'}
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {stats.words} words • {stats.readMinutes} min read {stats.hasTable ? '• Contains Table' : ''}
            </span>
          </div>
        </div>

        {/* View Controls & Action Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Edit / Preview Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] mr-1">
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

          <button
            type="button"
            onClick={() => handleExport('email')}
            disabled={isExporting !== null}
            className="p-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 transition-all cursor-pointer"
            title="Draft as Email"
          >
            <Mail size={13} />
          </button>

          {/* Maximize / Close */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer ml-1"
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

      {/* Bottom Refinement Prompt Bar */}
      {onSendMessage && (
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 flex flex-col gap-2">
          {/* Quick refinement suggestion chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
            <span className="text-[var(--text-muted)] font-semibold shrink-0 flex items-center gap-1">
              <Sparkles size={11} className="text-amber-500" /> Refine:
            </span>
            {[
              "Make it more executive & concise",
              "Add a structured comparison table",
              "Check for missing operational steps",
              "Translate into professional Hindi",
            ].map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendRefinement(suggestion)}
                className="shrink-0 px-2.5 py-0.5 rounded-full bg-[var(--bg-surface-hover)] hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all cursor-pointer font-medium"
              >
                {suggestion}
              </button>
            ))}
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
    </div>
  );
};
