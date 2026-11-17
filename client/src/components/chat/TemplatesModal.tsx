import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Search, Bookmark, Copy, Check, Plus, Trash2, 
  ExternalLink, FileText, Sparkles 
} from 'lucide-react';
import clsx from 'clsx';

export interface DocumentTemplate {
  id: string;
  title: string;
  category: 'email' | 'sop' | 'report' | 'meeting' | 'custom';
  description: string;
  content: string;
  isCustom?: boolean;
  createdAt?: string;
}

const BUILT_IN_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'built-in-hr-leave',
    title: 'HR Leave / Work From Home (WFH) Application',
    category: 'email',
    description: 'Formal corporate email for sick leave, casual leave, or remote work approval with handover details.',
    content: `Subject: Leave Application: [Your Name] - [Leave Type] ([Start Date] to [End Date])

Dear [Manager's Name],

I am writing to formally request [Sick / Casual / Annual / WFH] leave from [Start Date] to [End Date] due to [brief reason, e.g. personal commitments / recovery]. I will resume normal duties on [Return Date].

### Work Coverage & Handover
- **Primary Handover Contact:** [Colleague Name] ([Colleague Email])
- **Current Projects Status:**
  - Project Alpha: Deliverables submitted, pending client feedback.
  - Urgent Tasks: Handed over with detailed context and tracker access.
- **Urgent Reachability:** I will have limited email access, but can be contacted via phone at [Your Phone Number] for critical escalations.

Thank you for your consideration and approval.

Warm regards,  
**[Your Name]**  
[Your Designation] | [Department]  
TRPW Strategic Partners`,
  },
  {
    id: 'built-in-sop-framework',
    title: 'Standard Operating Procedure (SOP) Framework',
    category: 'sop',
    description: 'Executive SOP document with Objective, Scope, RACI Matrix, Step-by-Step Procedure, and Escalations.',
    content: `# Standard Operating Procedure (SOP): [Process Name]

**Document Control:**
- **SOP ID:** SOP-OPS-[001]
- **Effective Date:** [YYYY-MM-DD]
- **Owner / Author:** [Author Name / Operations Team]
- **Review Cycle:** Semi-Annual

---

## 1. Objective & Purpose
The objective of this procedure is to standardize the execution of [Process Name], ensuring consistent quality, strict operational compliance, and minimized turnaround time.

## 2. Scope & Applicability
This SOP applies to all members of [Department / Team Name] involved in [Operation / Service Name].

## 3. Roles & RACI Matrix
| Role | Responsibility | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Process Owner | [Name / Title] | Yes | Yes | Yes |
| Operational Lead | [Name / Title] | No | Yes | Yes |
| Team Member | [Name / Title] | No | No | Yes |

## 4. Step-by-Step Execution Procedure
1. **Phase 1: Initiation & Verification**
   - Verify input prerequisites and authorization credentials.
   - Log the ticket/request in the centralized tracking repository.
2. **Phase 2: Execution & Quality Check**
   - Execute standardized actions according to operational checklist.
   - Run peer review or automated validation checks.
3. **Phase 3: Delivery & Sign-off**
   - Deliver artifact to client or designated stakeholder.
   - Obtain formal sign-off and mark task as completed.

## 5. Escalation & Exception Handling
In case of deviations or SLA breaches:
- **Level 1 (0-2 hrs):** Notify Operational Lead ([email/contact]).
- **Level 2 (>4 hrs):** Escalate to Department Head for emergency remediation.`,
  },
  {
    id: 'built-in-client-status',
    title: 'Client Weekly Progress & Milestone Update',
    category: 'email',
    description: 'Executive status email with completed milestones, project tracker table, and next week priorities.',
    content: `Subject: [Project Name] - Weekly Executive Status Update ([Week Date Range])

Dear [Client / Stakeholder Name],

Here is the weekly progress summary for **[Project Name]** covering key milestones achieved, current deliverables, and our priority focus for next week.

### 🎯 Key Highlights & Milestones Completed
- Completed [Milestone 1, e.g., architecture review and security audit sign-off].
- Delivered [Deliverable 2, e.g., interactive dashboard v1.2].
- Verified 100% test pass rate on staging environment.

### 📊 Project Deliverables Tracker
| Deliverable | Owner | Target Date | Status |
|---|---|---|---|
| Core Feature Module | Engineering | [Date] | ✅ Completed |
| Quality & Compliance Sign-off | QA Team | [Date] | 🔄 In Progress |
| Production Release | DevOps | [Date] | ⏳ Scheduled |

### ⚠️ Risks & Blockers
- **Blocker:** None currently. All dependencies are progressing on schedule.

### 🚀 Focus for Next Week
1. Initiate phase 2 production rollout.
2. Conduct user acceptance testing (UAT) review call on [Day, Time].

Please let us know if you have any questions or require additional details.

Best regards,  
**[Your Name]**  
[Your Title] | TRPW Strategic Partners`,
  },
  {
    id: 'built-in-incident-rca',
    title: 'Incident Post-Mortem & Remediation (P1/P2)',
    category: 'report',
    description: 'Standard technical post-mortem detailing executive summary, business impact, timeline, and root cause analysis.',
    content: `# Incident Post-Mortem & Remediation Report

**Incident Details:**
- **Incident Ref:** INC-[2026-001]
- **Severity Level:** P1 - Critical
- **Date & Time:** [YYYY-MM-DD HH:MM IST]
- **Duration of Outage:** [XX minutes]
- **Lead Investigator:** [Name]

---

## 1. Executive Summary
On [Date] at [Time], an operational disruption occurred affecting [Service/Component]. The incident caused [brief description of impact]. The service was fully restored by [Restoration Time] following remediation.

## 2. Business Impact
- **Impacted Systems:** [Services impacted]
- **Affected Users:** [Approx. number or percentage]
- **Data Integrity:** No data corruption or unauthorized data access detected.

## 3. Timeline of Events
| Timestamp | Event Description | Action Taken |
|---|---|---|
| [HH:MM] | Anomaly detected via monitoring alerts | On-call engineer paged |
| [HH:MM] | Triage and root cause isolated | Mitigation patch deployed |
| [HH:MM] | Full service operational status restored | Verification tests passed |

## 4. Root Cause Analysis (RCA)
[Detailed explanation of the underlying trigger and failure chain].

## 5. Preventative Action Items
1. [ ] Implement automated health checks for [component].
2. [ ] Update alerting thresholds to prevent recurring triggers.
3. [ ] Schedule disaster recovery simulation drill by [Target Date].`,
  },
  {
    id: 'built-in-meeting-mom',
    title: 'Meeting Minutes (MoM) & Action Matrix',
    category: 'meeting',
    description: 'Concise executive minutes of meeting with key decisions and assigned action items matrix.',
    content: `# Meeting Minutes & Action Matrix

**Meeting Context:**
- **Topic:** [Project / Sync Discussion Name]
- **Date & Time:** [YYYY-MM-DD HH:MM]
- **Facilitator:** [Name]
- **Attendees:** [List of attendees]

---

## 📌 Executive Summary & Key Decisions
- **Decision 1:** [Key strategic or operational decision taken during the call].
- **Decision 2:** [Approved timeline or change in scope].

## 📋 Discussion Points
1. **Current Status Review:** Reviewed progress against deliverables; all core modules on schedule.
2. **Resource Allocation:** Discussed operational priorities for the upcoming cycle.

## 🎯 Action Items Matrix
| # | Action Item | Assignee / Owner | Due Date | Priority |
|---|---|---|---|---|
| 1 | Prepare final draft of proposal | [Person A] | [Date] | High |
| 2 | Schedule vendor evaluation review | [Person B] | [Date] | Medium |
| 3 | Distribute meeting summary to stakeholders | [Person C] | [Date] | Low |`,
  },
  {
    id: 'built-in-rfq-procurement',
    title: 'Vendor Request for Quotation (RFQ)',
    category: 'email',
    description: 'Procurement email template to request pricing, timelines, and technical bids from vendors.',
    content: `Subject: Request for Quotation (RFQ) - [Service / Equipment Name] - TRPW Strategic Partners

Dear [Vendor Name / Sales Team],

We are inviting quotations for **[Service / Equipment / Software Description]** for TRPW Strategic Partners.

### 📋 Scope of Requirements
- **Specification:** [Detailed specification or quantity]
- **Required Delivery / Start Timeline:** [Target Date]
- **Key Deliverables:**
  1. [Deliverable 1]
  2. [Deliverable 2 with warranty or SLA terms]

### 💼 Quotation Submission Requirements
Kindly provide your formal commercial quotation covering:
- Itemized pricing structure (inclusive of taxes and standard SLA).
- Payment terms and milestone schedule.
- Implementation timeline and post-delivery support terms.

**Deadline for Submission:** [Submission Due Date, e.g., Friday, 5:00 PM IST]

Looking forward to your response.

Sincerely,  
**[Your Name]**  
Procurement & Operations | TRPW Strategic Partners`,
  },
];

const STORAGE_KEY = 'bbot_user_templates';

export interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: DocumentTemplate, mode: 'canvas' | 'chat') => void;
  initialSaveContent?: { title: string; content: string } | null;
  onSavedSuccess?: () => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  initialSaveContent,
  onSavedSuccess,
}) => {
  const [userTemplates, setUserTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // State for creating a new custom template
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'email' | 'sop' | 'report' | 'meeting' | 'custom'>('custom');
  const [newDescription, setNewDescription] = useState('');
  const [newContent, setNewContent] = useState('');

  // Load custom templates from localStorage with full defensive validation
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const sanitized: DocumentTemplate[] = parsed
            .filter((item: any) => item && (typeof item.content === 'string' || typeof item.title === 'string'))
            .map((item: any, idx: number) => ({
              id: item.id || `custom_${Date.now()}_${idx}`,
              title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Custom Template',
              category: item.category || 'custom',
              description: typeof item.description === 'string' ? item.description : 'Custom saved template',
              content: typeof item.content === 'string' ? item.content : '',
              isCustom: true,
              createdAt: item.createdAt || new Date().toISOString(),
            }));
          setUserTemplates(sanitized);
        }
      }
    } catch (e) {
      console.error('Failed to load user templates:', e);
    }
  }, []);

  // When initialSaveContent is provided, switch to creation mode immediately
  useEffect(() => {
    if (initialSaveContent && isOpen) {
      setIsCreating(true);
      setNewTitle(initialSaveContent.title || 'Custom Template');
      setNewContent(initialSaveContent.content || '');
      setNewDescription('Saved from Canvas document');
    }
  }, [initialSaveContent, isOpen]);

  const allTemplates = useMemo(() => {
    return [...userTemplates, ...BUILT_IN_TEMPLATES];
  }, [userTemplates]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(tpl => {
      if (!tpl) return false;
      const matchesCategory = selectedCategory === 'all' 
        ? true 
        : selectedCategory === 'custom' 
        ? Boolean(tpl.isCustom) 
        : tpl.category === selectedCategory;

      const q = (searchQuery || '').toLowerCase().trim();
      const titleStr = (tpl.title || '').toLowerCase();
      const descStr = (tpl.description || '').toLowerCase();
      const contentStr = (tpl.content || '').toLowerCase();

      const matchesSearch = !q 
        || titleStr.includes(q) 
        || descStr.includes(q)
        || contentStr.includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [allTemplates, selectedCategory, searchQuery]);

  // Set default preview to the first available template
  useEffect(() => {
    if (!previewTemplate && filteredTemplates.length > 0) {
      setPreviewTemplate(filteredTemplates[0]);
    }
  }, [filteredTemplates, previewTemplate]);

  const handleSaveCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      alert('Please provide a title and content for the template.');
      return;
    }

    const newTpl: DocumentTemplate = {
      id: `custom_${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      description: newDescription.trim() || 'Custom user template',
      content: newContent.trim(),
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [newTpl, ...userTemplates];
    setUserTemplates(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save template to localStorage:', e);
    }

    setIsCreating(false);
    setNewTitle('');
    setNewDescription('');
    setNewContent('');
    setPreviewTemplate(newTpl);
    if (onSavedSuccess) onSavedSuccess();
  };

  const handleDeleteCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this custom template?')) return;
    const updated = userTemplates.filter(t => t.id !== id);
    setUserTemplates(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    if (previewTemplate?.id === id) {
      setPreviewTemplate(filteredTemplates[0] || null);
    }
  };

  const handleCopy = (rawContent: any, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = typeof rawContent === 'string' ? rawContent : '';
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-5xl h-[88vh] max-h-[820px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500">
              <Bookmark size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Reusable Templates Library
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Standard corporate emails, SOPs, and custom saved documents for 1-click reuse
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>Save New Template</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {isCreating ? (
          /* Create / Save Template Form */
          <form onSubmit={handleSaveCustomTemplate} className="flex-1 flex flex-col p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles size={15} className="text-amber-500" />
                Save Document as Reusable Template
              </h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Template Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Standard Client Escalation Email"
                  className="w-full px-3 py-2 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none cursor-pointer"
                >
                  <option value="email">Email</option>
                  <option value="sop">SOP / Policy</option>
                  <option value="report">Report / Post-Mortem</option>
                  <option value="meeting">Meeting Minutes</option>
                  <option value="custom">General Custom</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Short Description
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief summary of when to use this template"
                className="w-full px-3 py-2 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-[220px]">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Template Content (Markdown & Text) *
              </label>
              <textarea
                required
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Enter markdown template text with placeholders like [Client Name], [Date], etc..."
                className="flex-1 w-full p-3 font-mono text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-md"
              >
                Save Template
              </button>
            </div>
          </form>
        ) : (
          /* Template Browser Layout */
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Left Column: Search, Filter Tabs & Template Cards */}
            <div className="w-full md:w-5/12 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              {/* Search & Categories */}
              <div className="p-3 border-b border-[var(--border-subtle)] space-y-2.5 bg-[var(--bg-surface-hover)]/30">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates (e.g. leave, SOP, report)..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>

                {/* Categories Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'email', label: 'Emails' },
                    { key: 'sop', label: 'SOPs' },
                    { key: 'report', label: 'Reports' },
                    { key: 'meeting', label: 'Meetings' },
                    { key: 'custom', label: `Saved (${userTemplates.length})` },
                  ].map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setSelectedCategory(cat.key)}
                      className={clsx(
                        "px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer",
                        selectedCategory === cat.key
                          ? "bg-[var(--accent)] text-white shadow-xs"
                          : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Card List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 divide-y divide-[var(--border-subtle)]/40">
                {filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]">
                    <FileText size={28} className="opacity-40 mb-2" />
                    <p className="text-xs font-semibold">No templates found</p>
                    <p className="text-[11px] mt-1">Try another search or save a document as a template.</p>
                  </div>
                ) : (
                  filteredTemplates.map(tpl => {
                    const isSelected = previewTemplate?.id === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setPreviewTemplate(tpl)}
                        className={clsx(
                          "pt-2 first:pt-0 p-2.5 rounded-xl transition-all cursor-pointer flex flex-col gap-1 border",
                          isSelected
                            ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border-[var(--accent)] shadow-xs"
                            : "border-transparent hover:bg-[var(--bg-surface-hover)]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-1">
                            {tpl.title}
                          </h4>
                          <span className={clsx(
                            "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wider shrink-0",
                            tpl.isCustom
                              ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                              : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          )}>
                            {tpl.isCustom ? 'Custom' : tpl.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                          {tpl.description}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1">
                          <span>{(tpl?.content || '').split('\n').length} lines</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopy(tpl.content, tpl.id, e)}
                              className="p-1 hover:text-[var(--text-primary)] transition-colors"
                              title="Copy text"
                            >
                              {copiedId === tpl.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            </button>
                            {tpl.isCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCustomTemplate(tpl.id, e)}
                                className="p-1 hover:text-red-500 transition-colors"
                                title="Delete template"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Template Detailed Preview & 1-Click Launchers */}
            <div className="flex-1 flex flex-col bg-[var(--bg-surface)] overflow-hidden">
              {previewTemplate ? (
                <>
                  {/* Preview Header */}
                  <div className="p-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-3 bg-[var(--bg-surface-hover)]/20 shrink-0">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">
                          {previewTemplate.title}
                        </h3>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                          {previewTemplate.category.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {previewTemplate.description}
                      </p>
                    </div>

                    {/* Action Launchers */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTemplate(previewTemplate, 'chat');
                          onClose();
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-surface-hover)] hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all cursor-pointer"
                        title="Paste template directly into chat prompt to ask bbot to fill it out"
                      >
                        <span>Use in Chat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectTemplate(previewTemplate, 'canvas');
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-md"
                        title="Load into Canvas workspace for editing, refining, or exporting to PDF/Excel"
                      >
                        <ExternalLink size={13} />
                        <span>Open in Canvas</span>
                      </button>
                    </div>
                  </div>

                  {/* Preview Content Area */}
                  <div className="flex-1 overflow-y-auto p-5 bg-[var(--bg-surface-hover)]/30">
                    <pre className="font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed select-text bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-subtle)]">
                      {previewTemplate.content}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs">
                  Select a template to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
