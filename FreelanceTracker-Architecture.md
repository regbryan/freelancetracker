# FreelanceTracker - Architecture Document

## Overview

FreelanceTracker is a web app for freelancers that combines time tracking, client communication logging (with Gmail integration), and invoice generation into a single platform. Think of it as a lightweight Salesforce for freelancers — you create a project (like a Salesforce "case"), send emails from within that project, and every response gets logged automatically.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React (Vite + TypeScript) | Single-page app with React Router |
| UI | Tailwind CSS + shadcn/ui | Clean, professional look |
| Backend / DB | Supabase (Postgres) | Already provisioned (see credentials below) |
| Email | Gmail API (OAuth 2.0) | Send from app, auto-log replies |
| Invoice PDF | @react-pdf/renderer or jsPDF | Generate downloadable PDF invoices |
| Hosting | Supabase Edge Functions + Vercel (or Netlify) | Static frontend + serverless functions |

---

## Supabase Project (Already Created)

- **Project Name:** FreelanceTracker
- **Project ID:** `pnilvktjzpnyqhnowuhs`
- **Region:** us-east-1
- **API URL:** `https://pnilvktjzpnyqhnowuhs.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWx2a3RqenBueXFobm93dWhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTg2NjgsImV4cCI6MjA5MDgzNDY2OH0.89acWzgGENbrnj19zU3zELefGsnoQ7DExTXo_6qJ098`
- **Publishable Key:** `sb_publishable_2SCFT-l__RlItBpvwMDA3w_Wk8uatW4`

---

## Database Schema (Already Migrated)

All tables exist in the `public` schema with RLS enabled and permissive "Allow all" policies for MVP.

### clients
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| name | TEXT | required |
| email | TEXT | required — used to match incoming Gmail |
| company | TEXT | optional |
| phone | TEXT | optional |
| hourly_rate | DECIMAL(10,2) | default rate for this client |
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
| status | TEXT | 'active' / 'completed' / 'on_hold' / 'cancelled' |
| hourly_rate | DECIMAL(10,2) | overrides client rate if set |
| created_at | TIMESTAMPTZ | auto |
| updated_at | TIMESTAMPTZ | auto |

### time_entries
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| project_id | UUID (FK → projects) | cascade delete |
| description | TEXT | required — what was done |
| hours | DECIMAL(10,2) | required |
| date | DATE | defaults to today |
| billable | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | auto |

### communications
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| project_id | UUID (FK → projects) | cascade delete |
| direction | TEXT | 'sent' or 'received' |
| subject | TEXT | email subject |
| body | TEXT | email body |
| from_email | TEXT | sender |
| to_email | TEXT | recipient |
| gmail_message_id | TEXT | Gmail API message ID (for dedup) |
| gmail_thread_id | TEXT | Gmail thread ID (for threading) |
| date | TIMESTAMPTZ | when sent/received |
| created_at | TIMESTAMPTZ | auto |

### invoices
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| project_id | UUID (FK → projects) | cascade delete |
| invoice_number | TEXT | required — auto-generated (e.g., INV-2026-001) |
| status | TEXT | 'draft' / 'sent' / 'paid' / 'overdue' |
| subtotal | DECIMAL(10,2) | sum of line items |
| tax_rate | DECIMAL(5,2) | percentage |
| total | DECIMAL(10,2) | subtotal + tax |
| notes | TEXT | optional — appears on invoice |
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
| time_entry_id | UUID (FK → time_entries) | nullable — links to tracked time |
| item_type | TEXT | 'time' / 'expense' / 'flat' |

---

## Application Structure

```
freelance-tracker/
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # Router + layout
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client init
│   │   ├── gmail.ts              # Gmail API helpers
│   │   └── utils.ts              # Formatting, invoice number gen
│   ├── hooks/
│   │   ├── useClients.ts         # CRUD for clients
│   │   ├── useProjects.ts        # CRUD for projects
│   │   ├── useTimeEntries.ts     # CRUD for time entries
│   │   ├── useCommunications.ts  # CRUD + Gmail sync
│   │   └── useInvoices.ts        # CRUD + PDF generation
│   ├── pages/
│   │   ├── Dashboard.tsx          # Overview: active projects, recent time, pending invoices
│   │   ├── Clients.tsx            # Client list + add/edit
│   │   ├── ClientDetail.tsx       # Single client: their projects, total hours, invoices
│   │   ├── Projects.tsx           # Project list
│   │   ├── ProjectDetail.tsx      # THE CORE VIEW — case-like detail page
│   │   ├── TimeTracker.tsx        # Quick time entry + running timer
│   │   └── Invoices.tsx           # Invoice list + generate new
│   └── components/
│       ├── Layout.tsx             # Sidebar nav + top bar
│       ├── ClientForm.tsx         # Add/edit client modal
│       ├── ProjectForm.tsx        # Add/edit project modal
│       ├── TimeEntryForm.tsx      # Log time form
│       ├── TimeEntryList.tsx      # Table of time entries
│       ├── EmailComposer.tsx      # Send email from within a project
│       ├── CommunicationFeed.tsx  # Timeline of sent/received emails on a project
│       ├── InvoiceBuilder.tsx     # Select time entries, preview, generate
│       ├── InvoicePDF.tsx         # PDF template for invoices
│       ├── Timer.tsx              # Start/stop timer widget
│       └── StatsCard.tsx          # Reusable metric card
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── .env
```

---

## Page Specifications

### 1. Dashboard (`/`)
The landing page after login. Shows at-a-glance metrics and quick actions.

**Content:**
- Stats cards: Total unbilled hours, Pending invoice amount, Active projects count, This week's hours
- Recent time entries (last 5)
- Active projects list with hours tracked
- Quick "Log Time" button

### 2. Clients (`/clients`)
List all clients with search/filter capability.

**Content:**
- Table: Name, Company, Email, Active Projects count, Total Hours, Total Billed
- "Add Client" button opens ClientForm modal
- Click a row → ClientDetail page

### 3. Client Detail (`/clients/:id`)
Everything about one client.

**Content:**
- Client info header (name, email, company, default rate) with edit button
- Tabs: Projects | Invoices | Communications
- Projects tab: list of their projects with status badges
- Invoices tab: all invoices for this client across projects
- Communications tab: all emails to/from this client across projects

### 4. Projects (`/projects`)
List all projects with filters by status and client.

**Content:**
- Table: Project Name, Client, Status, Hours Tracked, Last Activity
- Filter by: Status (active/completed/on_hold), Client dropdown
- "New Project" button

### 5. Project Detail (`/projects/:id`) — THE CORE PAGE
This is the Salesforce "case" equivalent. Everything about a project in one view.

**Content:**
- Header: Project name, client name, status badge, hourly rate
- Three-column layout or tabbed:

**Tab 1: Time Tracking**
- "Log Time" form at top (description, hours, date, billable toggle)
- Running timer option (start/stop, auto-calculates hours)
- Time entries table below: Date, Description, Hours, Billable, Actions (edit/delete)
- Summary: Total hours, Billable hours, Unbilled amount

**Tab 2: Communications**
- Email composer at top:
  - To field (pre-filled with client email)
  - Subject field
  - Body (rich text or plain)
  - "Send" button → sends via Gmail API AND logs to communications table
- Communication feed below: chronological timeline of all sent/received emails
  - Each entry shows: direction arrow (sent/received), date, subject, preview of body
  - Click to expand full email body
- "Sync Emails" button → pulls recent Gmail threads with this client and logs new ones

**Tab 3: Invoices**
- "Generate Invoice" button → opens InvoiceBuilder
  - Auto-populates with unbilled time entries (checkboxes to include/exclude)
  - Shows communication summary (count of emails, date range)
  - Preview before generating
- List of past invoices for this project with status

### 6. Time Tracker (`/time`)
Quick-access time logging without navigating to a project.

**Content:**
- Timer widget: project dropdown, description field, start/stop button
- "Quick Log" form: project dropdown, description, hours, date
- Recent entries table (all projects, last 7 days)

### 7. Invoices (`/invoices`)
All invoices across all projects.

**Content:**
- Table: Invoice #, Client, Project, Amount, Status, Issued Date, Due Date
- Filter by: Status, Client, Date range
- Click row → Invoice detail with PDF download
- Bulk actions: Mark as Sent, Mark as Paid

---

## Gmail Integration

### Approach
Use Gmail API via OAuth 2.0. The app will need a Google Cloud project with Gmail API enabled.

### Google Cloud Setup (Manual Step)
1. Go to console.cloud.google.com
2. Create a new project or use existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials (Web application type)
5. Set authorized redirect URI to your app's callback URL
6. Store Client ID and Client Secret in environment variables

### Sending Emails from a Project
When a user composes an email from the Project Detail > Communications tab:

1. User fills in subject + body (To is pre-filled from client email)
2. Frontend calls Gmail API `messages.send` with the composed email
3. On success, insert a row into `communications` table:
   - `project_id`: current project
   - `direction`: 'sent'
   - `subject`, `body`, `from_email`, `to_email`: from the composed email
   - `gmail_message_id`: from the API response
   - `gmail_thread_id`: from the API response
   - `date`: now

### Syncing Incoming Emails (The Auto-Log Feature)
When user clicks "Sync Emails" on a project, or on a scheduled interval:

1. Query the `clients` table to get the client's email address
2. Call Gmail API `messages.list` with query: `from:{client_email} OR to:{client_email}`
3. For each message, check if `gmail_message_id` already exists in `communications`
4. For new messages:
   - Call `messages.get` to fetch full content
   - Determine direction: if `from` contains client email → 'received', else → 'sent'
   - Match to project by `gmail_thread_id` (if we sent the first email from a project, replies share the thread ID)
   - If thread ID doesn't match any project, check if the email subject or metadata matches
   - Insert into `communications` table

### Thread Matching Logic
```
1. Check gmail_thread_id → exact match to existing communication → same project
2. If no thread match → check client email → if only one active project for that client → assign there
3. If multiple active projects → show in an "Unassigned" inbox for manual assignment
```

### Environment Variables
```env
VITE_SUPABASE_URL=https://pnilvktjzpnyqhnowuhs.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GOOGLE_CLIENT_ID=<from Google Cloud Console>
VITE_GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

---

## Invoice Generation

### Flow
1. User clicks "Generate Invoice" on a project
2. InvoiceBuilder component loads:
   - Fetches all unbilled time entries for the project
   - Displays checkboxes for each entry (all checked by default)
   - Shows communication summary: "12 emails exchanged (Mar 1 - Mar 28)"
   - Auto-calculates subtotal from selected entries
   - User can set tax rate, due date, and add notes
3. On "Create Invoice":
   - Generate invoice number: `INV-{YYYY}-{sequential_number}`
   - Create `invoices` row
   - Create `invoice_items` rows (one per selected time entry, plus optional comm summary line)
   - Mark selected time entries as billed (add `invoice_id` column to time_entries — see schema addition below)
4. User can preview and download as PDF

### Invoice PDF Template
Professional invoice with:
- Freelancer info at top (name, email, address — stored in app settings/localStorage)
- Client info (name, company, email)
- Invoice number, issue date, due date
- Line items table: Description | Hours/Qty | Rate | Amount
- Communication summary line: "Client communication (12 emails, Mar 1-28)" with a flat or zero charge
- Subtotal, Tax, Total
- Payment terms / notes at bottom

### Schema Addition Needed
Add a column to track which time entries have been invoiced:
```sql
ALTER TABLE public.time_entries ADD COLUMN invoice_id UUID REFERENCES public.invoices(id);
```

---

## Authentication (Phase 2)

For MVP, the app runs without auth (single user). Phase 2 adds:
- Supabase Auth with email/password or Google OAuth
- RLS policies scoped to `auth.uid()`
- User profile/settings page (freelancer name, address, logo for invoices)
- Add `user_id UUID REFERENCES auth.users(id)` to all tables

---

## Key UX Principles

1. **Project-centric**: Everything revolves around the project. Time, emails, invoices — all accessible from one page.
2. **Minimal clicks**: Log time in 2 clicks. Send an email without leaving the project. Generate an invoice from tracked time in 3 clicks.
3. **Auto-logging**: Emails sent from the app are logged automatically. Incoming replies are synced and matched to the right project by thread ID.
4. **Invoice transparency**: Invoices show exactly what was done (hours) and that communication happened (email summary), building client trust.
5. **Freelancer-first**: No team features, no complexity. One person, their clients, their projects, their time, their money.

---

## Development Order (Suggested)

### Phase 1: Core App (No Gmail)
1. Set up Vite + React + TypeScript + Tailwind + shadcn/ui
2. Initialize Supabase client
3. Build Layout with sidebar navigation
4. Build Clients CRUD (list, add, edit, delete)
5. Build Projects CRUD with client association
6. Build Time Tracking (manual entry + timer)
7. Build Project Detail page with time tracking tab
8. Build Invoice generation from time entries
9. Build Invoice PDF download

### Phase 2: Gmail Integration
10. Set up Google OAuth flow in the app
11. Build EmailComposer component
12. Implement send-and-log (send via Gmail API, log to Supabase)
13. Implement email sync (pull from Gmail, match to projects)
14. Build CommunicationFeed component on Project Detail
15. Add communication summary to invoice generation

### Phase 3: Polish
16. Dashboard with stats and charts
17. Search and filtering across all views
18. Settings page (freelancer profile info for invoices)
19. Responsive design for mobile
20. Add Supabase Auth

---

## Running the App Locally

```bash
# Install dependencies
npm create vite@latest freelance-tracker -- --template react-ts
cd freelance-tracker
npm install @supabase/supabase-js react-router-dom jspdf jspdf-autotable
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Add shadcn/ui
npx shadcn-ui@latest init

# Set up .env
echo "VITE_SUPABASE_URL=https://pnilvktjzpnyqhnowuhs.supabase.co" >> .env
echo "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWx2a3RqenBueXFobm93dWhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTg2NjgsImV4cCI6MjA5MDgzNDY2OH0.89acWzgGENbrnj19zU3zELefGsnoQ7DExTXo_6qJ098" >> .env

# Run
npm run dev
```
