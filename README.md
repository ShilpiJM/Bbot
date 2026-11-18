# TRPW bbot • Enterprise Intelligence & Document Platform

**bbot** is an enterprise-grade AI assistant and document intelligence platform engineered for **TRPW Strategic Partners**. It combines local/offline document grounding, live web search, rich interactive visual diagrams, an interactive document **Canvas**, and presentation-ready multi-format document generation—built with **$0 external paid dependencies**.

---

## 🚀 Recent Capabilities & Features Overview

### 1. 📝 Interactive Canvas & Refinement Engine
- **Split-Screen Workspace**: Open any AI response, report, or SOP in a side-by-side or fullscreen Canvas.
- **Dual Mode**: Seamlessly switch between rendered **Preview** (with rich typography and styled tables) and markdown **Edit** mode.
- **Scrollable Refinement Bar**: Smooth `<` and `>` arrow navigation with one-click actions:
  - *Make it more executive & concise*
  - *Add a structured comparison table*
  - *Check for missing operational steps*
  - *Format as Official SOP*
  - *Convert to Executive Email*
  - *Add Action Checklist & Owners*
  - *Add Key Takeaways summary*
  - *Translate into professional Hindi*

### 2. 🛡️ Corporate Branding, Watermarks & Executive Sign-off
- **TRPW Corporate Branding**: Header styling with **TRPW STRATEGIC PARTNERS • bbot Intelligence** automatically stamped on all generated exports.
- **Dynamic Document Watermarks**: Select classification directly from the Canvas toolbar:
  - `CONFIDENTIAL` (Translucent diagonal watermark in PDF / bold banner in Word)
  - `DRAFT`
  - `INTERNAL ONLY`
  - `APPROVED`
  - `No Watermark`
- **Document Governance & Sign-off Table**: Toggle `[✓] Include Governance Sign-off` to automatically generate formal approval matrices (*Prepared By, Reviewed By, Compliance & Quality Sign-off, Verification Date*).

### 3. 🕒 Canvas Version History & Visual Diff Viewer
- **Automatic Version Snapshotting**: Every time a refinement, template load, or major edit occurs, a new snapshot is saved (`v1`, `v2`, `v3`...).
- **Version History Dropdown**: View timestamped revisions and restore any previous draft with one click.
- **Visual Diff Mode (`GitCompare`)**: Real-time line-by-line diff comparison against the prior draft:
  - <span style="color: #10b981; font-weight: bold;">+ Green</span>: Added lines and new content.
  - <span style="color: #ef4444; font-weight: bold;">- Red</span>: Removed lines (strikethrough).

### 4. ✨ Smart Template Auto-Fill Placeholders Wizard
- **Interactive Placeholder Detection**: Automatically detects bracketed tokens such as `[Your Name]`, `[Start Date]`, `[Manager's Name]`, and `[Department]`.
- **Auto-Fill Wizard**: Click **`✨ Fill Placeholders`** to open an interactive modal:
  - **Smart Pre-Fill**: Auto-populates dates, user name, and company context.
  - **Batch Substitution**: Applies all values across the document in 1 click and automatically saves a new version snapshot.

### 5. 📋 Reusable Templates Library
Quickly accessible from the **Top Right Header** and the **Canvas Toolbar**:
- **Built-in Corporate Templates**:
  1. **HR Leave / WFH Application** (Formal corporate leave request with coverage & handover details)
  2. **Standard Operating Procedure (SOP) Framework** (Objective, Scope, RACI Matrix, Procedures & Escalation levels)
  3. **Client Weekly Status & Milestone Update** (Key achievements, deliverables tracker table & roadmap)
  4. **Incident Post-Mortem & Remediation (P1/P2)** (Outage summary, impact, timeline & root cause analysis)
  5. **Meeting Minutes (MoM) & Action Matrix** (Key decisions, discussion points, owners & deadlines)
  6. **Vendor Request for Quotation (RFQ)** (Procurement requirements, commercial proposal submission & SLAs)
- **Save Custom Templates**: 1-click **`[⭐ Save Template]`** from Canvas to persistently store custom documents in the browser.

### 6. ✉️ Smart Email Dispatcher
- **1-Click Copy Formatted Email**: Copies subject line and formatted message to the clipboard.
- **Open in Gmail Web**: Pre-fills the subject and body in Gmail's web compose interface.
- **Open in Outlook Web (Office 365)**: Direct browser deeplink for Microsoft 365 users.
- **Open in Outlook Desktop App**: Synchronous, protocol-safe anchor trigger that launches desktop Outlook without blank tabs or Chrome blocking.

### 7. 📊 Multi-Format Export Engine ($0 External Cost)
- **Presentation-Grade PDF**: Built with ReportLab, `NumberedCanvas` (Page X of Y), corporate header/footer, and diagonal watermarks.
- **Corporate Excel Spreadsheets (`.xlsx`)**: Built with `openpyxl` with styled navy headers, grid borders, zebra rows, and auto-fitted columns.
- **Formatted Word Documents (`.docx`)**: Built with `python-docx` featuring classification banners, corporate headers, and sign-off tables.

### 8. 🔒 Enterprise Security & State Persistence
- **Sanitized UI Error Handling**: Production errors never leak backend stack traces or internal server details to the frontend.
- **Smart Rate Limiting**: Keyed by authentication JWT cookie and `X-Forwarded-For` proxy headers to eliminate false 429s across shared Render IPs.
- **Persistent Sessions**: Seamlessly navigate between Chat and Visual Studio (`/studio`) without losing the active conversation.

---

## 🏗️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend API** | Python 3.11, FastAPI, Uvicorn, Pydantic |
| **Document Processing** | ReportLab (PDF), openpyxl (Excel), python-docx (Word) |
| **Frontend Client** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| **Markdown & Formatting** | ReactMarkdown, RemarkGFM, RehypeRaw, RehypeSanitize |
| **State & Navigation** | React Router v7, TanStack Query, React Context |
| **Deployment** | Render Cloud Platform (Auto-deploy from GitHub `main`) |

---

## 💻 Local Development Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 20+ and npm

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/itinfraanalyst-spec/Bbot.git
cd Bbot

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install backend dependencies
pip install -r requirements.txt

# Start backend server
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Client Setup
```bash
# In another terminal window
cd client

# Install client packages
npm install

# Start Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🌐 Production Deployment

The project is hosted on **Render** with continuous deployment:
- **Repository**: `https://github.com/itinfraanalyst-spec/Bbot.git`
- **Branch**: `main`
- **Build Command**: `pip install -r requirements.txt && npm --prefix client install && npm --prefix client run build`
- **Start Command**: `uvicorn src.main:app --host 0.0.0.0 --port $PORT`

---

## 📄 License & Attribution
Proprietary & Confidential. Designed for **TRPW Strategic Partners** © 2026. All Rights Reserved.
