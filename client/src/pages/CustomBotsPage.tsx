import { useEffect, useRef, useState } from 'react';
import { 
  Bot, Check, ChevronDown, Code, Copy, ExternalLink, FileText, FolderPlus, Globe2, 
  Layers, MessageSquare, Pencil, Plus, RefreshCw, Sparkles, Tag, Trash2, Upload, X, 
  Shield, BookOpen 
} from 'lucide-react';
import { useCustomBots, type CustomBot, type CustomBotDocument } from '../hooks/useCustomBots';
import { ChatArea } from '../components/chat/ChatArea';
import { ChatInput } from '../components/chat/ChatInput';
import { LanguageSelector } from '../components/chat/LanguageSelector';
import { useChat } from '../hooks/useChat';

const accentOptions = [
  { label: 'Amber', value: 'var(--accent)', description: 'Warm and balanced' },
  { label: 'Blue', value: '#3b82f6', description: 'Calm and professional' },
  { label: 'Green', value: '#10b981', description: 'Helpful and supportive' },
  { label: 'Violet', value: '#8b5cf6', description: 'Creative and thoughtful' },
  { label: 'Red', value: '#ef4444', description: 'Bold and decisive' },
];

function BotAvatar({ bot, size = 'md' }: { bot: Pick<CustomBot, 'name' | 'accent'>; size?: 'sm' | 'md' }) {
  const dimension = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-12 w-12 text-lg';
  return <div className={`${dimension} flex shrink-0 items-center justify-center rounded-[var(--radius-md)] border-2 border-[var(--bg-surface)] bg-[var(--bg-surface-hover)] font-bold text-white shadow-sm`} style={{ boxShadow: `0 0 0 2px ${bot.accent}` }} aria-label={`${bot.name} avatar`}>{bot.name.charAt(0).toUpperCase()}</div>;
}

function StatusPill({ status, progress }: { status: string; progress?: number }) {
  const ready = status === 'READY' || status === 'PROCESSED_NO_RAG';
  const failed = status === 'FAILED';
  const percent = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  return <span className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${ready ? 'border-[rgba(76,175,80,0.35)] bg-[rgba(76,175,80,0.1)] text-[var(--success)]' : failed ? 'border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] text-[var(--error)]' : 'border-[rgba(234,166,85,0.35)] bg-[rgba(234,166,85,0.1)] text-[var(--accent)]'}`}>{ready ? 'Ready' : failed ? 'Error' : `Processing ${percent}%`}</span>;
}

const MAX_CUSTOM_BOT_DOCUMENTS = 3;

interface QuestionCategory {
  id: string;
  heading: string;
  questions: string[];
}

function parseQuestionsToCategories(rawQuestions: string[]): QuestionCategory[] {
  const map = new Map<string, string[]>();
  for (const raw of rawQuestions) {
    const line = raw.trim();
    if (!line) continue;

    // Pattern 1: [Category] Question or (Category) Question
    const bracketMatch = line.match(/^\[(.*?)\]\s*(.*)$/) || line.match(/^\((.*?)\)\s*(.*)$/);
    if (bracketMatch && bracketMatch[1] && bracketMatch[2]) {
      const cat = bracketMatch[1].trim();
      const q = bracketMatch[2].trim();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(q);
      continue;
    }

    // Pattern 2: Category: Question
    const colonMatch = line.match(/^([^:\n\r]{2,30}):\s*(.*)$/);
    if (colonMatch && !line.startsWith('http') && colonMatch[1] && colonMatch[2]) {
      const cat = colonMatch[1].trim();
      const q = colonMatch[2].trim();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(q);
      continue;
    }

    // Pattern 3: General / Uncategorized
    const defaultCat = 'General';
    if (!map.has(defaultCat)) map.set(defaultCat, []);
    map.get(defaultCat)!.push(line);
  }

  if (map.size === 0) {
    return [
      { id: 'cat-payments', heading: 'Payments', questions: [] },
      { id: 'cat-profile', heading: 'Profile', questions: [] },
      { id: 'cat-audit', heading: 'Audit Jobs', questions: [] },
    ];
  }

  return Array.from(map.entries()).map(([heading, questions], idx) => ({
    id: `cat-${idx}-${heading.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    heading,
    questions,
  }));
}

function serializeCategories(categories: QuestionCategory[]): string[] {
  const result: string[] = [];
  for (const cat of categories) {
    const heading = cat.heading.trim();
    for (const q of cat.questions) {
      const trimmed = q.trim();
      if (!trimmed) continue;
      if (heading) {
        result.push(`${heading}: ${trimmed}`);
      } else {
        result.push(trimmed);
      }
    }
  }
  return result;
}

function BotModal({ bot, onClose, onSaved }: { bot: CustomBot | null; onClose: () => void; onSaved: (bot: CustomBot) => void }) {
  const [name, setName] = useState(bot?.name || '');
  const [personality, setPersonality] = useState(bot?.personality || '');
  const [accent] = useState(bot?.accent || accentOptions[0].value);
  const [documents, setDocuments] = useState<CustomBotDocument[]>(bot?.documents || []);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [dangerOpen, setDangerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { saveBot, deleteBot, refreshBots } = useCustomBots();

  // Starter questions & topic categories state
  const [categories, setCategories] = useState<QuestionCategory[]>(() =>
    parseQuestionsToCategories(bot?.starter_questions || [])
  );
  const [starterQuestionsRaw, setStarterQuestionsRaw] = useState(() =>
    (bot?.starter_questions || []).join('\n')
  );
  const [questionsMode, setQuestionsMode] = useState<'visual' | 'raw'>('visual');
  const [newHeading, setNewHeading] = useState('');
  const [newQuestionByCat, setNewQuestionByCat] = useState<Record<string, string>>({});

  const totalQuestions = categories.reduce((sum, c) => sum + c.questions.length, 0);

  const handleAddCategory = () => {
    const trimmed = newHeading.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.heading.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Topic "${trimmed}" already exists.`);
      return;
    }
    const newCat: QuestionCategory = {
      id: `cat-${Date.now()}`,
      heading: trimmed,
      questions: [],
    };
    const updated = [...categories, newCat];
    setCategories(updated);
    setStarterQuestionsRaw(serializeCategories(updated).join('\n'));
    setNewHeading('');
    setError('');
  };

  const handleRemoveCategory = (id: string) => {
    const updated = categories.filter((c) => c.id !== id);
    setCategories(updated);
    setStarterQuestionsRaw(serializeCategories(updated).join('\n'));
  };

  const handleUpdateHeading = (id: string, newTitle: string) => {
    const updated = categories.map((c) => (c.id === id ? { ...c, heading: newTitle } : c));
    setCategories(updated);
    setStarterQuestionsRaw(serializeCategories(updated).join('\n'));
  };

  const handleAddQuestion = (catId: string) => {
    const qText = (newQuestionByCat[catId] || '').trim();
    if (!qText) return;
    if (totalQuestions >= 25) {
      setError('Maximum 25 questions reached.');
      return;
    }
    const updated = categories.map((c) => {
      if (c.id === catId) {
        // Strip duplicate prefix if user typed "Topic: question"
        const cleanQ = qText.replace(new RegExp(`^${c.heading}:\\s*`, 'i'), '').trim();
        return { ...c, questions: [...c.questions, cleanQ] };
      }
      return c;
    });
    setCategories(updated);
    setStarterQuestionsRaw(serializeCategories(updated).join('\n'));
    setNewQuestionByCat((prev) => ({ ...prev, [catId]: '' }));
    setError('');
  };

  const handleRemoveQuestion = (catId: string, qIndex: number) => {
    const updated = categories.map((c) => {
      if (c.id === catId) {
        return { ...c, questions: c.questions.filter((_, idx) => idx !== qIndex) };
      }
      return c;
    });
    setCategories(updated);
    setStarterQuestionsRaw(serializeCategories(updated).join('\n'));
  };

  const handleSwitchMode = (targetMode: 'visual' | 'raw') => {
    if (targetMode === questionsMode) return;
    if (targetMode === 'raw') {
      setStarterQuestionsRaw(serializeCategories(categories).join('\n'));
    } else {
      setCategories(parseQuestionsToCategories(starterQuestionsRaw.split('\n')));
    }
    setQuestionsMode(targetMode);
  };

  const uploadFile = async (file: File, targetBot = bot) => {
    if (documents.length >= MAX_CUSTOM_BOT_DOCUMENTS) {
      setError(`This bot can only have ${MAX_CUSTOM_BOT_DOCUMENTS} documents attached at once.`);
      return;
    }
    if (!targetBot) { setPendingFile(file); return; }
    setUploading(true); setError('');
    try {
      const form = new FormData(); form.append('file', file);
      const response = await fetch('/api/documents', { method: 'POST', credentials: 'include', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Upload failed');
      const attached = await fetch(`/api/admin/custom-bots/${targetBot.id}/documents/${data.document.id}`, { method: 'POST', credentials: 'include' });
      if (!attached.ok) {
        const attachmentError = await attached.json().catch(() => ({}));
        throw new Error(attachmentError.detail || 'Could not attach document');
      }
      const attachedBot = await attached.json();
      setDocuments(attachedBot.documents || [...documents, data.document]);
      await refreshBots();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const remainingSlots = MAX_CUSTOM_BOT_DOCUMENTS - documents.length;
    if (remainingSlots <= 0) {
      setError(`This bot can only have ${MAX_CUSTOM_BOT_DOCUMENTS} documents attached at once.`);
      return;
    }
    const selectedFiles = fileList.slice(0, remainingSlots);
    if (selectedFiles.length < fileList.length) {
      setError(`Only ${remainingSlots} document slot(s) remain for this bot. The rest were skipped.`);
    }
    for (const file of selectedFiles) {
      await uploadFile(file, bot);
    }
  };

  useEffect(() => {
    if (!bot || !documents.some((document) => document.status === 'PROCESSING')) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/admin/custom-bots/${bot.id}`, { credentials: 'include' });
      if (response.ok) setDocuments((await response.json()).documents || []);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [bot, documents]);

  const save = async () => {
    if (!name.trim() || !personality.trim()) return;
    try {
      let parsedQuestions: string[] = [];
      if (questionsMode === 'visual') {
        parsedQuestions = serializeCategories(categories).slice(0, 25);
      } else {
        parsedQuestions = starterQuestionsRaw.split('\n').map((q) => q.trim()).filter(Boolean).slice(0, 25);
      }
      const saved = await saveBot({ id: bot?.id, input: { name: name.trim(), personality: personality.trim(), accent, starter_questions: parsedQuestions } });
      if (pendingFile && !bot) await uploadFile(pendingFile, saved);
      onSaved({ ...saved, documents });
      onClose();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save bot'); }
  };

  const removeBot = async () => {
    if (!bot || !window.confirm(`Delete ${bot.name}? This cannot be undone.`)) return;
    await deleteBot(bot.id); onClose();
  };

  const processingDocuments = documents.filter((document) => document.status === 'PROCESSING');
  const processingPercent = processingDocuments.length > 0
    ? Math.round(processingDocuments.reduce((total, document) => total + Math.max(0, Math.min(100, document.progress ?? 0)), 0) / processingDocuments.length)
    : 100;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-6 flex items-start justify-between"><div><h2 className="text-xl font-bold text-[var(--text-primary)]">{bot ? 'Edit Bot' : 'Create Bot'}</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Give your assistant a focused role and source material.</p></div><button onClick={onClose} aria-label="Close" className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button></div>
      {error && <div className="mb-4 rounded-[var(--radius-md)] border border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] p-3 text-sm text-[var(--error)]">{error}</div>}
      <label className="block text-sm font-medium text-[var(--text-primary)]">Bot Name <span className="text-[var(--error)]">*</span><input maxLength={40} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" placeholder="HR Helper" /><span className="mt-1 block text-right text-xs text-[var(--text-muted)]">{name.length}/40</span></label>
      <label className="mt-4 block text-sm font-medium text-[var(--text-primary)]">Personality &amp; Role <span className="text-[var(--error)]">*</span><textarea maxLength={1000} value={personality} onChange={(event) => setPersonality(event.target.value)} rows={5} className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" placeholder={'You are HR Helper, a friendly assistant for employee handbook questions...'} /><span className="mt-1 block text-right text-xs text-[var(--text-muted)]">{personality.length}/1000</span></label>

      {/* Starter Questions & Topics Section */}
      <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-primary)]/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-[var(--accent)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Starter Questions &amp; Topics</span>
              <span className="rounded-full bg-[var(--bg-surface-hover)] px-2 py-0.5 text-[0.7rem] font-medium text-[var(--text-secondary)]">
                {questionsMode === 'visual' ? `${totalQuestions} bubbles in ${categories.length} topics` : 'Raw text mode'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Group questions under headings. In the chat widget, these appear as topic buttons and question bubbles.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleSwitchMode('visual')}
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 font-medium transition-colors ${
                questionsMode === 'visual'
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sparkles size={13} />
              Visual Bubbles
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('raw')}
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 font-medium transition-colors ${
                questionsMode === 'raw'
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Code size={13} />
              Raw Text
            </button>
          </div>
        </div>

        {questionsMode === 'visual' ? (
          <div className="mt-3 space-y-3">
            {/* Add New Topic Row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={newHeading}
                  onChange={(e) => setNewHeading(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                  placeholder="New Topic Heading (e.g. Payments, KYC, Support)..."
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={!newHeading.trim()}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FolderPlus size={14} />
                Add Topic
              </button>
            </div>

            {/* Topic Cards */}
            <div className="space-y-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-sm transition-all"
                >
                  {/* Topic Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)]/60 pb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--bg-surface-hover)] text-xs">
                        📂
                      </span>
                      <input
                        type="text"
                        value={cat.heading}
                        onChange={(e) => handleUpdateHeading(cat.id, e.target.value)}
                        placeholder="Topic Heading"
                        className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[var(--text-primary)] outline-none border-b border-transparent hover:border-[var(--border-subtle)] focus:border-[var(--accent)] transition-colors px-1"
                        title="Click to rename topic heading"
                      />
                      <span className="shrink-0 rounded-full bg-[rgba(200,117,20,0.15)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--accent)]">
                        {cat.questions.length} {cat.questions.length === 1 ? 'question' : 'questions'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat.id)}
                      className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[rgba(250,82,82,0.1)] hover:text-[var(--error)] transition-colors"
                      title={`Delete "${cat.heading}" topic`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Question Bubbles Area */}
                  <div className="mt-2.5">
                    {cat.questions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {cat.questions.map((q, qIdx) => (
                          <div
                            key={qIdx}
                            className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[rgba(200,117,20,0.1)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] shadow-sm hover:border-[var(--accent)] transition-all"
                          >
                            <span className="max-w-[320px] truncate">{q}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(cat.id, qIdx)}
                              className="rounded-full p-0.5 text-[var(--text-muted)] hover:bg-[rgba(250,82,82,0.2)] hover:text-[var(--error)] transition-colors"
                              title="Delete question bubble"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.75rem] italic text-[var(--text-muted)]">
                        No questions under this topic yet. Add one below.
                      </p>
                    )}
                  </div>

                  {/* Inline Add Question Input */}
                  <div className="mt-2.5 flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newQuestionByCat[cat.id] || ''}
                      onChange={(e) =>
                        setNewQuestionByCat((prev) => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddQuestion(cat.id);
                        }
                      }}
                      placeholder={`Add question bubble for "${cat.heading}"...`}
                      className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddQuestion(cat.id)}
                      disabled={!(newQuestionByCat[cat.id] || '').trim()}
                      className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      <Plus size={12} />
                      Add Bubble
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <textarea
              value={starterQuestionsRaw}
              onChange={(e) => setStarterQuestionsRaw(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              placeholder={`Payments: How to check for payment?\nProfile: How do I complete my profile?\nAudit Jobs: How to apply for audit jobs?`}
            />
            <p className="mt-1 text-[0.7rem] text-[var(--text-muted)]">
              Format: <code>Heading: Question text</code> (one per line). Switching to Visual Bubbles will automatically organize them into topics and bubbles.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium text-[var(--text-primary)]">Currently Uploaded Documents</span><span className="inline-flex items-center rounded-full bg-[var(--bg-surface-hover)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">{documents.length + (pendingFile ? 1 : 0)} attached</span></div>{documents.length > 0 || pendingFile ? <div className="space-y-2">{documents.map((document) => { const processing = document.status === 'PROCESSING'; const percent = Math.max(0, Math.min(100, Math.round(document.progress ?? 0))); return <div key={document.id} className="flex min-h-[46px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2"><FileText size={16} className="shrink-0 text-[var(--accent)]" /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{document.filename}</span><div className="shrink-0"><StatusPill status={document.status} progress={document.progress} /></div></div>{processing && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]" role="progressbar" aria-label={`${document.filename} processing progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${percent}%` }} /></div>}</div><button type="button" title="Remove document" onClick={async () => { await fetch(`/api/admin/custom-bots/${bot?.id}/documents/${document.id}`, { method: 'DELETE', credentials: 'include' }); setDocuments((current) => current.filter((item) => item.id !== document.id)); await refreshBots(); }} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={15} /></button></div>; })}{pendingFile && <div key="pending" className="flex min-h-[46px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2"><FileText size={16} className="shrink-0 text-[var(--accent)]" /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{pendingFile.name}</span><div className="shrink-0"><span className="inline-flex items-center rounded-full bg-[rgba(234,166,85,0.15)] px-2 py-0.5 text-[0.65rem] font-medium text-[rgb(234,166,85)]">Pending Save</span></div></div></div><button type="button" title="Remove document" onClick={() => setPendingFile(null)} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={15} /></button></div>}</div> : <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 text-center text-sm text-[var(--text-muted)]">No documents currently uploaded.</div>}</div>
      <div className="mt-5 border-t border-[var(--border-subtle)] pt-5"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium text-[var(--text-primary)]">Upload New Documents</span></div>{processingDocuments.length > 0 && <div className="mb-3 rounded-[var(--radius-md)] border border-[rgba(234,166,85,0.35)] bg-[rgba(234,166,85,0.08)] p-3"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-[var(--text-primary)]">Preparing knowledge for chat</span><span className="font-semibold text-[var(--accent)]">{processingPercent}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${processingPercent}%` }} /></div><p className="mt-1.5 text-xs text-[var(--text-secondary)]">Please wait. The bot will be ready after retrieval indexing finishes.</p></div>}<input ref={inputRef} type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.md" multiple className="hidden" onChange={(event) => { const files = event.target.files; if (files?.length) uploadFiles(files); event.target.value = ''; }} /><button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) uploadFiles(event.dataTransfer.files); }} className={`flex w-full flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed p-6 text-center transition-colors ${dragging ? 'border-[var(--accent)] bg-[var(--bg-surface-hover)]' : 'border-[var(--border-subtle)] bg-[var(--bg-primary)]'} disabled:cursor-not-allowed disabled:opacity-60`}><Upload size={22} className="mb-2 text-[var(--accent)]" /><span className="text-sm font-medium text-[var(--text-primary)]">{uploading ? 'Uploading...' : 'Drop documents here or choose files'}</span><span className="mt-1 text-xs text-[var(--text-muted)]">Supported formats: PDF, DOCX, XLSX, CSV, TXT, MD</span></button></div>
      {bot && <div className="mt-6 border-t border-[var(--border-subtle)] pt-4"><button type="button" onClick={() => setDangerOpen((open) => !open)} className="flex items-center gap-2 text-sm font-medium text-[var(--error)]"><ChevronDown size={16} className={dangerOpen ? 'rotate-180' : ''} />Danger Zone</button>{dangerOpen && <div className="mt-3 flex items-center justify-between rounded-[var(--radius-md)] border border-[rgba(250,82,82,0.35)] p-3"><span className="text-sm text-[var(--text-secondary)]">Delete this custom bot and its associations.</span><button type="button" onClick={removeBot} className="rounded-[var(--radius-md)] border border-[var(--error)] px-3 py-2 text-sm font-medium text-[var(--error)] hover:bg-[rgba(250,82,82,0.1)]">Delete Bot</button></div>}</div>}
      <div className="mt-6 flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4"><button type="button" onClick={onClose} className="rounded-[var(--radius-md)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]">Cancel</button><button type="button" onClick={save} disabled={!name.trim() || !personality.trim()} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"><Check size={16} />{bot ? 'Save Changes' : 'Create Bot'}</button></div>
    </div>
  </div>;
}

export function createSuggestedPromptHandler(sendMessage: (message: string) => void) {
  return (prompt: string) => {
    if (!prompt.trim()) return;
    sendMessage(prompt.trim());
  };
}

function BotChatPanel({ bot, onClose }: { bot: CustomBot; onClose: () => void }) {
  const storageKey = `trpwbot.customBotConversation.${bot.id}`;
  const [conversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(storageKey);
  });
  const { messages, isGenerating, sendMessage, stopGeneration } = useChat(conversationId, `/api/admin/custom-bots/${bot.id}/chat`, storageKey);
  const onSuggestedPrompt = createSuggestedPromptHandler(sendMessage);

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-2xl">
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4">
        <BotAvatar bot={{ ...bot, name: 'bbot', accent: 'var(--accent)' }} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-[var(--accent)]">bbot</h2>
          <p className="text-xs text-[var(--text-secondary)]">Testing {bot.name}</p>
        </div>
        <LanguageSelector compact />
        <button onClick={onClose} aria-label="Close chat" className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <X size={18} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <ChatArea messages={messages} isGenerating={isGenerating} botName="bbot" documentsCount={bot.documents?.length ?? 0} onSuggestedPrompt={onSuggestedPrompt} starterQuestions={bot.starter_questions} />
      </div>
      <div className="relative shrink-0">
        <ChatInput onSendMessage={sendMessage} disabled={isGenerating} isGenerating={isGenerating} onStop={stopGeneration} isNewChat={messages.length === 0} botName="bbot" />
      </div>
    </div>
  );
}

function IntegrationPanel({ bot, onClose, notify }: { bot: CustomBot; onClose: () => void; notify: (message: string) => void }) {
  const { getIntegration, createIntegration, saveIntegration, rotateIntegration, deleteIntegration } = useCustomBots();
  const [integration, setIntegration] = useState<Awaited<ReturnType<typeof getIntegration>> | null>(null);
  const [origins, setOrigins] = useState('');
  const [allowAllOrigins, setAllowAllOrigins] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'script' | 'guide' | 'settings'>('script');

  useEffect(() => {
    getIntegration(bot.id)
      .then((data) => {
        setIntegration(data);
        setEnabled(data.enabled ?? false);
        const originList = data.allowed_origins ?? [];
        if (originList.includes('*') || originList.length === 0) {
          setAllowAllOrigins(true);
          setOrigins('*');
        } else {
          setAllowAllOrigins(false);
          setOrigins(originList.join('\n'));
        }
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load integration settings'))
      .finally(() => setLoading(false));
  }, [bot.id]);

  const originList = () => {
    if (allowAllOrigins) return ['*'];
    return origins.split('\n').map((o) => o.trim()).filter(Boolean);
  };

  const handleQuickEnable = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await createIntegration(bot.id, { enabled: true, allowed_origins: ['*'] });
      setIntegration(data);
      setEnabled(true);
      setAllowAllOrigins(true);
      setOrigins('*');
      if (data.secret) setSecret(data.secret);
      notify(`Embed script generated for ${bot.name}!`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate embed script');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const input = { enabled, allowed_origins: originList().length ? originList() : ['*'] };
      const data = integration?.configured ? await saveIntegration(bot.id, input) : await createIntegration(bot.id, input);
      setIntegration(data);
      if (data.secret) setSecret(data.secret);
      notify('Embed settings saved successfully');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save integration');
    } finally {
      setSaving(false);
    }
  };

  const rotate = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await rotateIntegration(bot.id);
      setSecret(data.secret ?? '');
      notify('Secret rotated. Copy it now.');
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : 'Could not rotate secret');
    } finally {
      setSaving(false);
    }
  };

  const detach = async () => {
    if (!window.confirm(`Detach ${bot.name} from external website access?`)) return;
    await deleteIntegration(bot.id);
    setIntegration({ configured: false });
    setEnabled(false);
    setSecret('');
    notify('External website access detached');
  };

  const copy = async (value: string, key: string, message: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    notify(message);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const apiBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000';
  const embedCode = integration?.public_key
    ? `<!-- TRPW bbot Embed Widget for ${bot.name} -->\n<script\n  src="${apiBaseUrl}/widget.js"\n  data-bot-key="${integration.public_key}"\n  data-api-base="${apiBaseUrl}"\n  defer>\n</script>`
    : '';

  const previewUrl = integration?.public_key ? `${apiBaseUrl}/embed-preview.html?key=${integration.public_key}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs select-none" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4 bg-[var(--bg-surface-hover)]/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <Code size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Website Embed Script
                </h2>
                {integration?.configured && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    enabled 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}>
                    {enabled ? 'Active on Websites' : 'Access Disabled'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Embed <strong>{bot.name}</strong> on any external website, CMS, or portal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        {integration?.configured && (
          <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('script')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'script'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Code size={14} />
              <span>Copy Script</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'guide'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BookOpen size={14} />
              <span>Where to Paste</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Shield size={14} />
              <span>Domain Security</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] p-3 text-xs text-[var(--error)]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-xl bg-[var(--bg-surface-hover)]" />
              <div className="h-32 animate-pulse rounded-xl bg-[var(--bg-surface-hover)]" />
            </div>
          ) : !integration?.configured ? (
            /* First Time / Unconfigured State: 1-Click Generate */
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] p-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] shadow-sm">
                <Globe2 size={28} />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Embed {bot.name} on Your Website
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs text-[var(--text-secondary)] leading-relaxed">
                Generate a single-line embed script tag that you can copy and paste into HTML, WordPress, Webflow, Shopify, Wix, or React.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
                <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] p-2.5 border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                  <Check size={14} className="text-emerald-500 shrink-0" />
                  <span>Floating chat bubble</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] p-2.5 border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                  <Check size={14} className="text-emerald-500 shrink-0" />
                  <span>RAG document memory</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] p-2.5 border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                  <Check size={14} className="text-emerald-500 shrink-0" />
                  <span>11 Indian languages</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] p-2.5 border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                  <Check size={14} className="text-emerald-500 shrink-0" />
                  <span>Zero dependencies</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleQuickEnable}
                disabled={saving}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--accent-hover)] shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Sparkles size={16} />
                {saving ? 'Generating...' : 'Generate Embed Script Now'}
              </button>
            </div>
          ) : activeTab === 'script' ? (
            /* TAB 1: SCRIPT TAG & 1-CLICK COPY */
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Website Embed Code Snippet
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    Zero external dependencies
                  </span>
                </div>

                {/* Code Block Container */}
                <div className="relative rounded-xl border border-white/10 bg-[#070b14] p-4 font-mono text-xs text-sky-300 shadow-inner overflow-hidden group">
                  <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {embedCode}
                  </pre>
                  <button
                    type="button"
                    onClick={() => copy(embedCode, 'script', 'Embed script copied to clipboard!')}
                    className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-all cursor-pointer shadow-sm"
                    title="Copy to clipboard"
                  >
                    {copiedKey === 'script' ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => copy(embedCode, 'script_main', 'Embed script copied to clipboard!')}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-bold text-white hover:bg-[var(--accent-hover)] shadow-md transition-all cursor-pointer active:scale-95"
                >
                  {copiedKey === 'script_main' ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedKey === 'script_main' ? 'Copied to Clipboard!' : 'Copy Script Tag'}</span>
                </button>

                {previewUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(previewUrl, '_blank')}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-all cursor-pointer"
                    title="Open live sandbox to test the widget"
                  >
                    <ExternalLink size={14} className="text-[var(--accent)]" />
                    <span>Test Widget Live ↗</span>
                  </button>
                )}
              </div>

              {/* Features Included Box */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 space-y-2">
                <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider block">
                  What this script adds to your website:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                    <span>Floating bottom-right circular launcher</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Instant RAG answers from {bot.document_count} docs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span>11 Indian languages + Speech-to-text</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                    <span>Starter question bubble recommendations</span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'guide' ? (
            /* TAB 2: WHERE TO PASTE INSTRUCTIONS */
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
                <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1 flex items-center gap-2">
                  <span>🌐</span> Plain HTML / PHP Website
                </h4>
                <p className="text-[var(--text-secondary)] mb-2">
                  Open your <code className="text-[var(--accent)]">index.html</code> or footer template file and paste the script tag right before the closing <code className="text-sky-400">&lt;/body&gt;</code> tag:
                </p>
                <div className="bg-[#070b14] rounded-lg p-2.5 font-mono text-[11px] text-zinc-300">
                  <div className="text-zinc-500">&lt;!-- Your page content --&gt;</div>
                  <div className="text-amber-400 font-bold">&lt;script src="..." data-bot-key="..." defer&gt;&lt;/script&gt;</div>
                  <div className="text-zinc-400">&lt;/body&gt;</div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
                <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1 flex items-center gap-2">
                  <span>📝</span> WordPress
                </h4>
                <p className="text-[var(--text-secondary)]">
                  Go to <strong>Plugins → Add New</strong>, install the free <strong>WPCode (Insert Headers and Footers)</strong> plugin, open <strong>Header &amp; Footer</strong>, and paste the code snippet into the <strong>Footer</strong> box. Click Save.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
                <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1 flex items-center gap-2">
                  <span>🎨</span> Webflow / Wix / Shopify / Squarespace
                </h4>
                <p className="text-[var(--text-secondary)]">
                  Go to your <strong>Site Settings → Custom Code</strong>, scroll down to the <strong>Footer Code / Before &lt;/body&gt;</strong> section, paste the script tag, and publish your website.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
                <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1 flex items-center gap-2">
                  <span>⚛️</span> React / Next.js
                </h4>
                <p className="text-[var(--text-secondary)]">
                  Paste the snippet inside your <code className="text-[var(--accent)]">public/index.html</code> before <code className="text-sky-400">&lt;/body&gt;</code>, or in Next.js <code className="text-[var(--accent)]">_app.tsx</code> / <code className="text-[var(--accent)]">layout.tsx</code> using <code className="text-sky-400">&lt;Script src="..." /&gt;</code>.
                </p>
              </div>
            </div>
          ) : (
            /* TAB 3: DOMAIN SECURITY & SETTINGS */
            <div className="space-y-4">
              {/* External Access Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] p-3.5 bg-[var(--bg-primary)]">
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    Allow External Website Access
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Toggle external chat responses on or off without removing your configuration
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled(!enabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
                    enabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      enabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Origin Restriction Options */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 space-y-3">
                <span className="text-xs font-bold text-[var(--text-primary)] block">
                  Allowed Website Origins
                </span>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[var(--text-primary)]">
                    <input
                      type="radio"
                      name="originType"
                      checked={allowAllOrigins}
                      onChange={() => {
                        setAllowAllOrigins(true);
                        setOrigins('*');
                      }}
                      className="accent-[var(--accent)]"
                    />
                    <div>
                      <span className="font-semibold">Allow any website (*)</span>
                      <span className="block text-[11px] text-[var(--text-muted)]">
                        Recommended for easy embedding or testing across multiple domains
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[var(--text-primary)] pt-1">
                    <input
                      type="radio"
                      name="originType"
                      checked={!allowAllOrigins}
                      onChange={() => {
                        setAllowAllOrigins(false);
                        if (origins === '*') setOrigins('');
                      }}
                      className="accent-[var(--accent)] mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="font-semibold">Restrict to specific website domains</span>
                      <span className="block text-[11px] text-[var(--text-muted)]">
                        Only requests originating from these exact origins will be answered
                      </span>
                    </div>
                  </label>
                </div>

                {!allowAllOrigins && (
                  <div className="pt-2">
                    <textarea
                      value={origins}
                      onChange={(e) => setOrigins(e.target.value)}
                      rows={3}
                      placeholder="https://mycompany.com&#10;https://portal.mycompany.com&#10;http://localhost:3000"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] block mt-1">
                      One origin per line (include scheme, e.g. https://).
                    </span>
                  </div>
                )}
              </div>

              {/* Public Key Display */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Public Integration Key
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text-primary)]">
                    {integration?.public_key}
                  </code>
                  <button
                    type="button"
                    title="Copy public key"
                    onClick={() => copy(integration?.public_key ?? '', 'pubkey', 'Public key copied')}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Secret Key Display */}
              {secret && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">
                    API Secret Key (Copy now - will not be shown again)
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-[var(--text-primary)]">
                      {secret}
                    </code>
                    <button
                      type="button"
                      title="Copy secret"
                      onClick={() => copy(secret, 'secret', 'Secret copied')}
                      className="p-1.5 text-amber-500 hover:text-amber-400 cursor-pointer"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/30 px-6 py-4">
          <div className="flex items-center gap-2">
            {integration?.configured && activeTab === 'settings' && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={rotate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Rotate Secret</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={detach}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--error)] hover:bg-[rgba(250,82,82,0.1)] transition-colors cursor-pointer"
                >
                  Detach
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
            >
              Close
            </button>
            {integration?.configured && activeTab === 'settings' && (
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--accent-hover)] cursor-pointer transition-all shadow-sm"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomBotsPage() {
  const { bots, isLoading, error, toggleBot } = useCustomBots();
  const [modalBot, setModalBot] = useState<CustomBot | null | undefined>(undefined);
  const [chatBot, setChatBot] = useState<CustomBot | null>(null);
  const [integrationBot, setIntegrationBot] = useState<CustomBot | null>(null);
  const [toast, setToast] = useState('');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  const handleToggle = (bot: CustomBot) => { toggleBot({ id: bot.id, active: !bot.is_active }); notify(`${bot.name} is now ${!bot.is_active ? 'active' : 'inactive'}`); };
  return <div className="space-y-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-bold text-[var(--text-primary)]">Custom Bots</h2><p className="mt-1 text-[var(--text-secondary)]">Create focused assistants with their own role and knowledge.</p></div><button onClick={() => setModalBot(null)} className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] hover:shadow-[var(--energy-glow)]"><Plus size={17} />Create Bot</button></div>
    {isLoading ? <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />)}</div> : error ? <div className="rounded-[var(--radius-lg)] border border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] p-5 text-sm text-[var(--error)]">{error instanceof Error ? error.message : 'Could not load custom bots.'}</div> : bots.length === 0 ? <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-20 text-center"><Bot size={48} className="mb-4 text-[var(--accent)]" /><h3 className="text-lg font-semibold text-[var(--text-primary)]">No custom bots yet</h3><p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">Create a focused assistant for a team, workflow, or document collection.</p><button onClick={() => setModalBot(null)} className="mt-5 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">Create your first bot</button></div> : <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{bots.map((bot) => <div key={bot.id} className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]"><div className="flex items-start gap-3"><BotAvatar bot={bot} /><div className="min-w-0 flex-1"><h3 className="truncate font-semibold text-[var(--text-primary)]">{bot.name}</h3><p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{bot.personality}</p></div><button role="switch" aria-checked={bot.is_active} aria-label={`Toggle ${bot.name}`} onClick={() => handleToggle(bot)} className={`relative h-6 w-11 rounded-full transition-colors ${bot.is_active ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface-hover)]'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${bot.is_active ? 'left-6' : 'left-1'}`} /></button></div><div className="mt-5 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-surface-hover)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"><FileText size={13} />{bot.document_count} documents</span><span className={`text-xs font-medium ${bot.is_active ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>{bot.is_active ? 'Active' : 'Inactive'}</span></div>{bot.documents && bot.documents.length > 0 && <div className="mt-3 flex flex-col gap-1.5">{bot.documents.map((doc: any) => <div key={doc.id} className="flex items-center gap-2 rounded bg-[var(--bg-surface-hover)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]"><FileText size={12} className="shrink-0 text-[var(--accent)]" /><span className="truncate">{doc.filename}</span></div>)}</div>}<div className="mt-auto pt-5"><div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4"><button onClick={() => setChatBot(bot)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] cursor-pointer"><MessageSquare size={15} />Chat</button><button onClick={() => setIntegrationBot(bot)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] transition-all cursor-pointer"><Code size={15} />Embed Script</button><button onClick={() => setModalBot(bot)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] cursor-pointer"><Pencil size={15} />Edit</button></div></div></div>)}</div>}
    {modalBot !== undefined && <BotModal bot={modalBot} onClose={() => setModalBot(undefined)} onSaved={() => notify('Bot saved successfully')} />}
    {chatBot && <BotChatPanel bot={chatBot} onClose={() => setChatBot(null)} />}
    {integrationBot && <IntegrationPanel bot={integrationBot} onClose={() => setIntegrationBot(null)} notify={notify} />}
    {toast && <div role="status" className="fixed bottom-6 right-6 z-[70] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-lg"><Check size={15} className="mr-2 inline text-[var(--success)]" />{toast}</div>}
  </div>;
}