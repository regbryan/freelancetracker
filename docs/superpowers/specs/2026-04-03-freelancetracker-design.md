# FreelanceTracker - Design Specification

## Overview

FreelanceTracker is a web app for freelancers that combines time tracking, client communication logging (with Gmail integration), and invoice generation into a single platform. A lightweight Salesforce for freelancers — create a project, send emails from within it, and every response gets logged automatically.

## Key UX Principles

1. **Project-centric**: Everything revolves around the project. Time, emails, invoices — all accessible from one page.
2. **Minimal clicks**: Log time in 2 clicks. Send an email without leaving the project. Generate an invoice from tracked time in 3 clicks.
3. **Auto-logging**: Emails sent from the app are logged automatically. Incoming replies are synced and matched to the right project by thread ID.
4. **Invoice transparency**: Invoices show exactly what was done (hours) and that communication happened (email summary), building client trust.
5. **Freelancer-first**: No team features, no complexity. One person, their clients, their projects, their time, their money.

## Authentication Strategy

**MVP (Phase 1-2):** No authentication. Single-user app. All RLS policies are permissive "Allow all" for development speed.

**Phase 3:** Add Supabase Auth with email/password or Google OAuth. Scope RLS policies to `auth.uid()`. Add `user_id UUID REFERENCES auth.users(id)` to all tables. Build user profile/settings page (freelancer name, address, logo for invoices).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite + TypeScript) |
| UI | Tailwind CSS + shadcn/ui |
| Backend / DB | Supabase (Postgres) — already provisioned |
| Email | Gmail API (OAuth 2.0) |
| Invoice PDF | jsPDF + jspdf-autotable |
| Hosting | Vercel (static frontend) + Supabase Edge Functions |

## Supabase Project

- **Project ID:** `pnilvktjzpnyqhnowuhs`
- **API URL:** `https://pnilvktjzpnyqhnowuhs.supabase.co`
- **Region:** us-east-1
- **Database schema already migrated** — all tables exist with RLS enabled.

## Design System (from Figma)

The visual language is an editorial, airy, modern SaaS aesthetic — NOT a dense dark dashboard.

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#f7f9fb` | Page background |
| Surface | `#ffffff` | Cards, modals |
| Sidebar | `#f8fafc` | Sidebar background |
| Text Primary | `#191c1e` | Headings, bold values |
| Text Secondary | `#424754` | Body text, descriptions |
| Text Muted | `#727785` | Labels, uppercase captions |
| Text Nav | `#64748b` | Inactive nav items |
| Accent Primary | `#0058be` | Primary actions, progress bars, branding |
| Accent Branding | `#1d4ed8` | Sidebar app name |
| Accent Gradient | `#0058be → #2170e4` | Buttons, progress fills |
| Accent Light | `#2563eb` | Active nav text |
| Accent Background | `#dbeafe` | Blue icon backgrounds |
| Border | `#eceef0` | Card dividers, separators |
| Input Background | `#f2f4f6` | Stat pills, input fields |
| Status Active | Green tint `#d1fae5` | Active project icon bg |
| Status Urgent | Orange `#f97316` text, `#ffedd5` bg | Urgent labels |
| Status Danger | `#ba1a1a` | Overdue, remaining warnings |
| Tag Background | `#b6ccff` | Category tags |
| Tag Text | `#405682` | Category tag text |
| Glass Overlay | `rgba(0,88,190,0.05)` | Frosted glass cards |

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| App Branding | Manrope | ExtraBold (800) | 18px |
| Page Title | Manrope | ExtraBold (800) | 36px |
| Section Label | Manrope | Bold (700) | 12px, uppercase, tracking 2.4px |
| Card Title | Manrope | Bold (700) | 20-30px |
| Card Subtitle | Manrope | Regular (400) | 14-18px |
| Stat Label | Manrope | Bold (700) | 10px, uppercase, tracking 0.5px |
| Stat Value | Manrope | Bold (700) | 20px |
| Nav Item | Manrope | SemiBold (600) | 14px |
| Body Text | Manrope | Regular (400) | 14-16px |
| Button Text | Manrope | Bold (700) | 16px |

### Spacing & Radius

| Element | Value |
|---------|-------|
| Card border-radius | 24px |
| Button border-radius | 24px (pill) |
| Nav item border-radius | 24px (pill) |
| Card padding | 32px |
| Page padding | 32px |
| Grid gap | 32px |
| Card shadow | `0px 12px 32px rgba(25,28,30,0.04), 0px 4px 8px rgba(25,28,30,0.02)` |
| Top bar | `backdrop-blur(12px)`, `rgba(255,255,255,0.8)` bg |

### Component Patterns

**Sidebar (256px):**
- "FreelanceTracker" branding in blue (#1d4ed8), ExtraBold
- "Freelance Management" subtitle in muted text
- Nav items: icon + label, pill-shaped (24px radius)
- Active state: white bg + shadow + blue text (#2563eb)
- Inactive state: #64748b text, no bg
- "New Project" gradient button pinned to bottom

**Top Bar (64px):**
- Frosted glass: `backdrop-blur(12px)`, `rgba(255,255,255,0.8)`
- App name "FreelanceTracker" on left, Manrope Bold 20px
- Right: notification bell, help circle, user avatar (32px circle)
- Bottom shadow: `0px 1px 2px rgba(0,0,0,0.05)`

**Stat Pills:**
- Background: `#f2f4f6`, 24px radius
- Icon + label (uppercase 10px bold) + value (20px bold)
- Arranged horizontally in header area

**Cards:**
- White bg, 24px radius, soft layered shadow
- 32px internal padding
- Dividers use border-top `#eceef0`

**Bento Grid:**
- 12-column CSS grid
- Featured card spans 8 cols, AI/insight card spans 4 cols
- Smaller project cards: 3 across (4 cols each)

**Buttons:**
- Primary: gradient `#0058be → #2170e4`, white text, 24px radius, shadow
- Floating action: 64px circle, same gradient, bottom-right positioned

## Screen Specifications

### 1. Projects Page (Figma reference: node 1-748)

**Layout:** Sidebar + Top bar + Main content with bento grid

**Header Section:**
- "YOUR PROJECTS" section label (blue, uppercase, tracked)
- "Active Projects" page title (36px ExtraBold)
- Two stat pills: "Total Tracked Hours: 1,284.5" and "Project Velocity: 94%"

**Featured Project Card (8 cols):**
- Project name large (30px Bold): "Brand Identity Redesign"
- Client name: "Lumina Studios"
- Category tag pill: "Brand Identity" (#b6ccff bg)
- Three metadata columns: Status (dot + text), Deadline (date), Team (stacked avatars)
- Progress bar: label + percentage (24px ExtraBold blue) + gradient fill bar

**Project Insights Card (4 cols) — Phase 3 / Decorative for MVP:**
- Frosted glass: `backdrop-blur(6px)`, `rgba(0,88,190,0.05)` bg
- Decorative blur circle top-right
- "PROJECT INSIGHTS" header with icon
- In MVP: show static summary stats (total hours this month, upcoming deadlines, busiest project)
- Phase 3: could be enhanced with AI-driven forecasting
- Confidence/progress bar at bottom

**Project Cards Row (3 x 4 cols):**
- Each card: icon circle (colored bg), status label (uppercase), project name (20px Bold), client name, metric row (label + bold value), avatar + chevron at bottom
- Status → color mapping:
  - `active` → blue bg `#dbeafe`, label "ACTIVE"
  - `on_hold` → orange bg `#ffedd5`, label "ON HOLD"
  - `completed` → green bg `#d1fae5`, label "COMPLETED"
  - `cancelled` → red bg `#fee2e2`, label "CANCELLED"

### 2. Dashboard Page (`/`)

Stats cards row: Unbilled Hours, Pending Invoices ($), Active Projects, This Week's Hours. Same stat pill style as Projects page.

**Quick "Log Time" button** in top bar area — opens time entry form inline or as modal.

Content split:
- Left: "Recent Time Entries" — compact table (Date, Project, Description, Hours), last 5 entries
- Right: "Active Projects" — list with status, hours, progress indicators
- "Upcoming Milestone" highlight card

### 3. Clients Page (`/clients`)

"Manage Your Portfolio" heading. Table with columns: Name (with avatar), Company, Email, Active Projects, Total Hours, Total Billed. Summary footer: total revenue, total hours, client count.

### 4. Client Detail Page (`/clients/:id`)

Client profile header: avatar, name, company, email, phone. Rate card (green accent): "$100.00/hr" large display, total billed amount.

Three tabs: Projects | Invoices | Communications

**Projects tab:** list of project cards with status badge, total time, billed amount. "New Project" button.

**Invoices tab:** all invoices for this client across projects. Same table format as Invoices page.

**Communications tab:** all emails to/from this client across all projects. Chronological feed showing direction, date, subject, preview.

Bottom stats row: Unbilled Hours, Pending Payment, Client Health score.

### 5. Project Detail Page (`/projects/:id`) — Core Page

Project header with name, status, rate.

Three tabs:

**Time Tracking tab:**
- Active timer display (large digital clock format: 00:00:00)
- Quick log entry form on right (project, description, date/hours, billable toggle)
- Recent entries table below (Date, Project, Description, Hours, Status, Actions)

**Communications tab:**
- Email composer at top: To (pre-filled), Subject, Body, Send button
- Communication feed: chronological timeline of sent/received emails
- "Sync Emails" button to pull from Gmail

**Invoices tab:**
- "Generate Invoice" button → InvoiceBuilder
- Past invoices list with status badges

### 6. Time Tracker Page (`/time`)

Large timer display (01:23:45 format). Project selector + description. Start/Stop/Pause controls.

Quick Log Entry form on right side. Recent entries table (last 7 days, all projects).

### 7. Invoices Page (`/invoices`)

Table: Invoice #, Client, Project, Amount, Status badge, Issued Date, Due Date. Filters by status/client/date. Summary stats at bottom: total amounts by status.

**Bulk actions:** "Mark as Sent", "Mark as Paid" — select multiple invoices via checkboxes and apply status change.

## Database Schema

All tables in `public` schema, RLS enabled, permissive policies for MVP.

### clients
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| name | TEXT | required |
| email | TEXT | required |
| company | TEXT | optional |
| phone | TEXT | optional |
| hourly_rate | DECIMAL(10,2) | default rate |
| notes | TEXT | optional |
| created_at | TIMESTAMPTZ | auto |
| updated_at | TIMESTAMPTZ | auto |

### projects
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| client_id | UUID (FK → clients) | cascade delete |
| name | TEXT | required |
| description | TEXT | optional |
| status | TEXT | active / completed / on_hold / cancelled |
| hourly_rate | DECIMAL(10,2) | overrides client rate |
| created_at | TIMESTAMPTZ | auto |
| updated_at | TIMESTAMPTZ | auto |

### time_entries
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| project_id | UUID (FK → projects) | cascade delete |
| description | TEXT | required |
| hours | DECIMAL(10,2) | required |
| date | DATE | defaults to today |
| billable | BOOLEAN | default true |
| invoice_id | UUID (FK → invoices) | nullable, tracks billing |
| created_at | TIMESTAMPTZ | auto |

### communications
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| project_id | UUID (FK → projects) | cascade delete |
| direction | TEXT | sent / received |
| subject | TEXT | email subject |
| body | TEXT | email body |
| from_email | TEXT | sender |
| to_email | TEXT | recipient |
| gmail_message_id | TEXT | dedup key |
| gmail_thread_id | TEXT | thread matching |
| date | TIMESTAMPTZ | when sent/received |
| created_at | TIMESTAMPTZ | auto |

### invoices
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| project_id | UUID (FK → projects) | cascade delete |
| invoice_number | TEXT | e.g. INV-2026-001 |
| status | TEXT | draft / sent / paid / overdue |
| subtotal | DECIMAL(10,2) | sum of line items |
| tax_rate | DECIMAL(5,2) | percentage |
| total | DECIMAL(10,2) | subtotal + tax |
| notes | TEXT | optional |
| due_date | DATE | payment due date |
| issued_date | DATE | defaults to today |
| created_at | TIMESTAMPTZ | auto |

### invoice_items
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| invoice_id | UUID (FK → invoices) | cascade delete |
| description | TEXT | required |
| quantity | DECIMAL(10,2) | hours or units |
| rate | DECIMAL(10,2) | $/hr or unit price |
| amount | DECIMAL(10,2) | quantity x rate |
| time_entry_id | UUID (FK → time_entries) | nullable |
| item_type | TEXT | time / expense / flat |

## Gmail Integration

### Sending
1. User composes email from Project Detail > Communications tab
2. Frontend calls Gmail API `messages.send`
3. On success, insert into `communications` table with gmail_message_id and gmail_thread_id

### Syncing
1. Query client email from `clients` table
2. Call Gmail API `messages.list` with `from:{email} OR to:{email}`
3. Dedup by gmail_message_id
4. Match to project by gmail_thread_id → client → manual assignment

### Thread Matching
1. gmail_thread_id match → same project
2. No thread match + single active project for client → auto-assign
3. Multiple active projects → "Unassigned" inbox for manual assignment

## Invoice Generation Flow

1. "Generate Invoice" on project → InvoiceBuilder loads unbilled time entries
2. Checkboxes for each entry (all checked by default)
3. Shows communication summary: "{N} emails exchanged ({date range})"
4. Auto-calculate subtotal, set tax rate, due date, notes
5. Generate invoice number: `INV-{YYYY}-{sequential_number}`
6. Create `invoices` row + `invoice_items` rows (one per selected time entry)
7. Add optional communication summary line: "Client communication ({N} emails, {date range})" with flat or zero charge
8. Mark selected time_entries with invoice_id
9. Preview and download as PDF

### Invoice PDF Template

Professional invoice layout:
- **Header:** Freelancer info (name, email, address — from localStorage/settings), logo placeholder
- **Client info:** Name, company, email
- **Invoice meta:** Invoice number, issue date, due date
- **Line items table:** Description | Hours/Qty | Rate | Amount
- **Communication summary line:** "Client communication (12 emails, Mar 1-28)" — flat or zero charge
- **Footer:** Subtotal, Tax (%), Total
- **Notes section:** Payment terms, custom notes

### Timer Persistence

Timer state is stored in `localStorage` so it persists across page navigations and browser refreshes. Stored data: `{ projectId, description, startTime, isRunning }`. When the user returns to any page with a timer widget, it resumes from the stored startTime. On stop, elapsed time is calculated and pre-filled into the time entry form.

## Development Phases

### Phase 1: Core App (No Gmail)
1. Scaffold Vite + React + TypeScript + Tailwind + shadcn/ui
2. Initialize Supabase client
3. Build Layout (sidebar, top bar) matching Figma design system
4. Build Clients CRUD
5. Build Projects CRUD with bento grid layout
6. Build Time Tracking (manual entry + timer)
7. Build Project Detail page with time tracking tab
8. Build Invoice generation + PDF download

### Phase 2: Gmail Integration
9. Google OAuth flow
10. EmailComposer component
11. Send-and-log
12. Email sync + project matching
13. CommunicationFeed on Project Detail

### Phase 3: Polish
14. Dashboard with stats
15. Search and filtering
16. Settings page (freelancer profile for invoices)
17. Responsive design
18. Authentication (Supabase Auth)

## Figma Reference

- **File:** `https://www.figma.com/proto/WhiCz4q5IeimCKo9Q3lhUw/Untitled`
- **Projects Page (primary reference):** node `1-748`
- **Design system extracted from Figma code output** — all colors, fonts, spacing, and component patterns documented above.

## Application Structure

```
freelance-tracker/
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # Router + layout
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client init
│   │   ├── gmail.ts              # Gmail API helpers (Phase 2)
│   │   └── utils.ts              # Formatting, invoice number gen
│   ├── hooks/
│   │   ├── useClients.ts         # CRUD for clients
│   │   ├── useProjects.ts        # CRUD for projects
│   │   ├── useTimeEntries.ts     # CRUD for time entries
│   │   ├── useCommunications.ts  # CRUD + Gmail sync (Phase 2)
│   │   ├── useInvoices.ts        # CRUD + PDF generation
│   │   └── useTimer.ts           # Timer state + localStorage persistence
│   ├── pages/
│   │   ├── Dashboard.tsx          # Overview with stats
│   │   ├── Clients.tsx            # Client list
│   │   ├── ClientDetail.tsx       # Single client with tabs
│   │   ├── Projects.tsx           # Project bento grid
│   │   ├── ProjectDetail.tsx      # Core page with 3 tabs
│   │   ├── TimeTracker.tsx        # Quick time entry + timer
│   │   └── Invoices.tsx           # Invoice list + bulk actions
│   └── components/
│       ├── Layout.tsx             # Sidebar nav + top bar
│       ├── Sidebar.tsx            # Sidebar navigation
│       ├── TopBar.tsx             # Frosted glass top bar
│       ├── ClientForm.tsx         # Add/edit client modal
│       ├── ProjectForm.tsx        # Add/edit project modal
│       ├── ProjectCard.tsx        # Bento grid project card
│       ├── StatPill.tsx           # Reusable stat pill component
│       ├── TimeEntryForm.tsx      # Log time form
│       ├── TimeEntryList.tsx      # Table of time entries
│       ├── Timer.tsx              # Start/stop timer widget
│       ├── EmailComposer.tsx      # Send email (Phase 2)
│       ├── CommunicationFeed.tsx  # Email timeline (Phase 2)
│       ├── InvoiceBuilder.tsx     # Select entries, preview, generate
│       └── InvoicePDF.tsx         # PDF template
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── components.json               # shadcn/ui config
└── .env
```

## Environment Variables

```env
VITE_SUPABASE_URL=https://pnilvktjzpnyqhnowuhs.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
VITE_GOOGLE_CLIENT_ID=<from Google Cloud Console>
```

**Note:** Google Client Secret must NOT be in a `VITE_` variable (Vite exposes those to the browser). Keep it server-side only in a Supabase Edge Function environment variable.

## Running the App Locally

```bash
npm create vite@latest freelance-tracker -- --template react-ts
cd freelance-tracker
npm install @supabase/supabase-js react-router-dom jspdf jspdf-autotable
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Add shadcn/ui
npx shadcn-ui@latest init

# Set up .env with your Supabase URL and anon key
# Run
npm run dev
```
