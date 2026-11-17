import React, { useState, useEffect } from 'react';
import { X, Mail, Copy, Check, ExternalLink, Send } from 'lucide-react';

export interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSubject: string;
  defaultBody: string;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  defaultSubject,
  defaultBody,
}) => {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [copied, setCopied] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Clean up markdown hashes from subject if present
      const cleanSubj = (defaultSubject || '').replace(/[#*`_]/g, '').trim();
      setSubject(cleanSubj || 'bbot Document');
      setBody(defaultBody || '');
      setCopyNotice(null);
    }
  }, [isOpen, defaultSubject, defaultBody]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    try {
      navigator.clipboard.writeText(fullText);
      setCopied(true);
      setCopyNotice('Email content and subject copied to clipboard!');
      setTimeout(() => {
        setCopied(false);
        setCopyNotice(null);
      }, 3500);
    } catch {
      alert('Unable to access clipboard. Please copy manually.');
    }
  };

  const handleOpenOutlookApp = () => {
    const safeContent = body || '';
    const safeBody = safeContent.length > 1500 
      ? safeContent.slice(0, 1500) + '\n\n[... Full content copied to clipboard. Press Ctrl+V to paste full message ...]'
      : safeContent;

    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(safeBody)}`;

    // SYNCHRONOUS DOM anchor click to preserve active user gesture in Chrome/Windows
    const link = document.createElement('a');
    link.href = mailtoUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Also copy full text to clipboard without blocking user gesture
    try {
      navigator.clipboard.writeText(safeContent);
    } catch {}

    setCopyNotice('Launching Outlook / Mail App! (Full email is also copied to clipboard)');
  };

  const handleOpenOutlookWeb = () => {
    const safeContent = body || '';
    const safeBody = safeContent.length > 1500 
      ? safeContent.slice(0, 1500) + '\n\n[... Full content copied to clipboard. Press Ctrl+V to paste full message ...]'
      : safeContent;

    const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipient)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(safeBody)}`;
    window.open(outlookWebUrl, '_blank', 'noopener,noreferrer');

    try {
      navigator.clipboard.writeText(safeContent);
    } catch {}

    setCopyNotice('Opening Outlook Web! (Full email is also copied to clipboard)');
  };

  const handleOpenGmail = () => {
    const safeContent = body || '';
    const safeBody = safeContent.length > 1500 
      ? safeContent.slice(0, 1500) + '\n\n[... Full content copied to your clipboard. Paste (Ctrl+V) to insert full text ...]'
      : safeContent;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(safeBody)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');

    try {
      navigator.clipboard.writeText(safeContent);
    } catch {}

    setCopyNotice('Opening Gmail! (Full email is also copied to clipboard)');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-2xl sm:max-w-3xl max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header Bar - Fixed & Always Visible */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
              <Mail size={18} />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-snug">
                Draft & Send Email
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Launch Outlook (Desktop or Web), Gmail, or copy formatted text
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice Banner */}
        {copyNotice && (
          <div className="px-5 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 shrink-0 animate-in fade-in">
            <Check size={14} className="shrink-0" />
            <span>{copyNotice}</span>
          </div>
        )}

        {/* Form Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-0">
          {/* Recipient */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              To (Recipient Email - Optional)
            </label>
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. colleague@company.com or client@trpwpartners.com"
              className="w-full px-3 py-2 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Subject Line *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full px-3 py-2 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Body Editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Email Message Body
              </label>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {(body || '').length} characters • {((body || '').trim().split(/\s+/).filter(Boolean)).length} words
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="w-full h-40 sm:h-48 p-3 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] font-mono leading-relaxed focus:border-[var(--accent)] focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer Actions - Fixed & High Visibility */}
        <div className="px-4 sm:px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] transition-all cursor-pointer shadow-xs"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            <span>{copied ? 'Copied Full Email!' : 'Copy Formatted Email'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Gmail Web */}
            <button
              type="button"
              onClick={handleOpenGmail}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/30 transition-all cursor-pointer shadow-xs"
              title="Open draft directly in Gmail Web"
            >
              <ExternalLink size={13} />
              <span>Gmail</span>
            </button>

            {/* Outlook Web (Office 365) */}
            <button
              type="button"
              onClick={handleOpenOutlookWeb}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30 transition-all cursor-pointer shadow-xs"
              title="Open draft in Outlook 365 Web in your browser"
            >
              <ExternalLink size={13} />
              <span>Outlook Web</span>
            </button>

            {/* Outlook Desktop App */}
            <button
              type="button"
              onClick={handleOpenOutlookApp}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-md"
              title="Launch Outlook or default desktop Mail application directly on your computer"
            >
              <Send size={13} />
              <span>Open Outlook App</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
