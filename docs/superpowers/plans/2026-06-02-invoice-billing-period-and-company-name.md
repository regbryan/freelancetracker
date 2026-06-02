# Invoice Billing Period + Company Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit calendar-month "Billing Period" to invoices (captured at creation, editable, rendered on the PDF) and a dedicated company-name field in the invoice FROM block.

**Architecture:** Two nullable `DATE` columns on `invoices` store the period; pure helpers in `src/lib/invoicePeriod.ts` convert between an `<input type="month">` value and first/last-of-month bounds and format the display range. The builder and edit dialog capture the month; the PDF renders the period and a company name read from the freelancer profile in `userStorage`.

**Tech Stack:** React 19 + TypeScript, Vite, Supabase (Postgres), jsPDF/jspdf-autotable, localStorage-backed `userStorage`, custom i18n (`src/lib/i18n.tsx`).

**Testing note:** This repo ships **no unit-test framework** (no vitest/jest/playwright). Per-task verification is therefore `npm run build` (which runs `tsc -b` — a real type-check) and `npm run lint`. The date helpers in Task 2 are pure and self-contained; verify them by type-check and inspection. The feature ends with a mandatory **visual screenshot gate** (Task 10). Run all `npm` commands from the `freelance-tracker/` directory.

**Branch:** `feature/invoice-billing-period` (already created; the design spec is committed there).

---

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `freelance-tracker/supabase_migration_invoice_period.sql` | Create | DDL adding `period_start`/`period_end` |
| `freelance-tracker/src/lib/invoicePeriod.ts` | Create | Pure month↔period helpers + display formatter |
| `freelance-tracker/src/hooks/useInvoices.ts` | Modify | Add period fields to `Invoice` + `InvoiceUpdate` |
| `freelance-tracker/src/lib/i18n.tsx` | Modify | `invPdf.period`, `settings.companyName` (en + es) |
| `freelance-tracker/src/pages/Settings.tsx` | Modify | Company-name profile field |
| `freelance-tracker/src/components/InvoicePDF.tsx` | Modify | Render company name + billing-period line |
| `freelance-tracker/src/components/InvoiceBuilder.tsx` | Modify | Billing-month picker → period on create |
| `freelance-tracker/src/components/InvoiceEditDialog.tsx` | Modify | Edit billing month post-creation |

---

## Task 1: Database migration — period columns

**Files:**
- Create: `freelance-tracker/supabase_migration_invoice_period.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Migration: Add billing period to invoices
-- Run this in the Supabase SQL editor (or via MCP apply_migration).

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end   DATE;
```

- [ ] **Step 2: Apply to the live project**

Apply against Supabase project `pnilvktjzpnyqhnowuhs` using the MCP `apply_migration` tool, name `add_invoice_billing_period`, with the SQL above.

- [ ] **Step 3: Verify the columns exist**

Run this via the MCP `execute_sql` tool:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='invoices'
  and column_name in ('period_start','period_end')
order by column_name;
```

Expected: two rows — `period_end` and `period_start`, both `date`, `is_nullable = YES`.

- [ ] **Step 4: Commit**

```bash
git add freelance-tracker/supabase_migration_invoice_period.sql
git commit -m "feat(invoices): add period_start/period_end columns migration"
```

---

## Task 2: Pure date helpers

**Files:**
- Create: `freelance-tracker/src/lib/invoicePeriod.ts`

These are pure functions (no React, no I/O). They build date strings manually to avoid timezone shifts from `Date` parsing.

- [ ] **Step 1: Create the helpers file**

```typescript
// Pure helpers for invoice billing periods.
// A "month input" is the value of <input type="month">, formatted "YYYY-MM".
// A "period" is an inclusive calendar-month range stored as ISO date strings.

export interface BillingPeriod {
  start: string // YYYY-MM-01
  end: string   // YYYY-MM-<last day>
}

/** "2026-04" -> { start: "2026-04-01", end: "2026-04-30" } */
export function monthInputToPeriod(monthInput: string): BillingPeriod {
  const [yearStr, monthStr] = monthInput.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr) // 1-12
  // Day 0 of the next month is the last day of this month.
  const lastDay = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  const dd = String(lastDay).padStart(2, '0')
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${dd}` }
}

/** "2026-04-01" -> "2026-04". Returns "" for null/empty/malformed input. */
export function dateToMonthInput(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const match = /^(\d{4})-(\d{2})/.exec(dateStr)
  return match ? `${match[1]}-${match[2]}` : ''
}

/** Returns "YYYY-MM" for the latest date in the list, or "" if the list is empty. */
export function latestMonthInput(dateStrings: string[]): string {
  let max = ''
  for (const d of dateStrings) {
    if (d > max) max = d
  }
  return dateToMonthInput(max)
}

/** Current month as "YYYY-MM". */
export function currentMonthInput(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${mm}`
}

/**
 * Human-readable inclusive range, e.g. "April 1 – April 30, 2026".
 * Repeats the year on both sides only when start and end fall in different years.
 */
export function formatBillingPeriod(start: string, end: string, locale: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sameYear = s.getFullYear() === e.getFullYear()
  const endStr = e.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
  const startStr = s.toLocaleDateString(
    locale,
    sameYear
      ? { month: 'long', day: 'numeric' }
      : { month: 'long', day: 'numeric', year: 'numeric' }
  )
  return `${startStr} – ${endStr}`
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS (no type errors). This compiles the new file even though nothing imports it yet.

- [ ] **Step 3: Commit**

```bash
git add freelance-tracker/src/lib/invoicePeriod.ts
git commit -m "feat(invoices): add pure billing-period date helpers"
```

---

## Task 3: Types — period fields on Invoice

**Files:**
- Modify: `freelance-tracker/src/hooks/useInvoices.ts`

- [ ] **Step 1: Add period fields to the `Invoice` interface**

In the `Invoice` interface, add the two fields immediately after the existing `issued_date` line:

```typescript
  issued_date: string | null;
  period_start: string | null;
  period_end: string | null;
```

(Leave `payment_url` and the rest of the interface unchanged. `InvoiceInsert = Omit<Invoice, 'id' | 'created_at' | 'payment_url' | 'projects' | 'invoice_items'>` automatically includes the new fields.)

- [ ] **Step 2: Add period fields to `InvoiceUpdate`**

Change the `InvoiceUpdate` type's `Pick` list to include the period fields:

```typescript
export type InvoiceUpdate = Partial<Pick<Invoice, 'invoice_number' | 'status' | 'tax_rate' | 'total' | 'notes' | 'due_date' | 'issued_date' | 'period_start' | 'period_end'>>;
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: FAIL — `InvoiceBuilder.tsx`'s `createInvoice(...)` insert object is now missing the required `period_start`/`period_end` properties (they are required on `InvoiceInsert`). This is expected and fixed in Task 7. If you are executing strictly task-by-task and want a green build here, proceed to Task 7 before re-running; otherwise note the error is confined to `InvoiceBuilder.tsx`.

> Note for the executor: To keep each task's build green, make the `InvoiceInsert` additions backward-compatible by marking them optional at the insert boundary is **not** done here — instead Task 7 supplies the values. Commit this task's type change together with Task 7 if your workflow requires a green build per commit. Otherwise commit now:

- [ ] **Step 4: Commit**

```bash
git add freelance-tracker/src/hooks/useInvoices.ts
git commit -m "feat(invoices): add period_start/period_end to Invoice types"
```

---

## Task 4: i18n keys

**Files:**
- Modify: `freelance-tracker/src/lib/i18n.tsx`

- [ ] **Step 1: Add the English `invPdf.period` key**

Find the English line `'invPdf.project': 'Project',` and add directly below it:

```typescript
  'invPdf.period': 'Billing Period',
```

- [ ] **Step 2: Add the Spanish `invPdf.period` key**

Find the Spanish line `'invPdf.project': 'Proyecto',` and add directly below it:

```typescript
  'invPdf.period': 'Período de facturación',
```

- [ ] **Step 3: Add the English company-name settings keys**

Find the English line `'settings.freelancerName': 'Freelancer Name',` and add directly above it:

```typescript
  'settings.companyName': 'Company Name',
  'settings.companyPlaceholder': 'Acme Studio LLC',
```

- [ ] **Step 4: Add the Spanish company-name settings keys**

Find the Spanish line `'settings.freelancerName':` (its value is the Spanish for "Freelancer Name") and add directly above it:

```typescript
  'settings.companyName': 'Nombre de la empresa',
  'settings.companyPlaceholder': 'Acme Studio LLC',
```

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: same single pre-existing error from Task 3 in `InvoiceBuilder.tsx` (if Task 7 not yet done); no NEW errors in `i18n.tsx`.

- [ ] **Step 6: Commit**

```bash
git add freelance-tracker/src/lib/i18n.tsx
git commit -m "feat(i18n): add invPdf.period and settings.companyName keys (en/es)"
```

---

## Task 5: Company-name field in Settings

**Files:**
- Modify: `freelance-tracker/src/pages/Settings.tsx`

- [ ] **Step 1: Add `company` to the `FreelancerProfile` interface**

Change the interface (currently lines 13–18) to:

```typescript
interface FreelancerProfile {
  name: string
  company: string
  email: string
  address: string
  phone: string
}
```

- [ ] **Step 2: Add `company` to the `loadProfile` default**

Change the fallback return in `loadProfile()` to include `company`:

```typescript
  return { name: '', company: '', email: '', address: '', phone: '' }
```

(JSON parsed from older saved profiles won't have `company`; `profile.company` will be `undefined`. Step 4 guards the input with `?? ''`.)

- [ ] **Step 3: Render the Company Name input**

Inside the `grid grid-cols-1 md:grid-cols-2 gap-4` block, add a new field directly **before** the existing `prof-name` field (so company appears first):

```tsx
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prof-company" className="text-[12px]">
              {t('settings.companyName')}
            </Label>
            <Input
              id="prof-company"
              placeholder={t('settings.companyPlaceholder')}
              value={profile.company ?? ''}
              onChange={(e) => setProfile({ ...profile, company: e.target.value })}
            />
          </div>
```

- [ ] **Step 4: Include `company` in the profile-completeness count**

Change the `profileFieldCount` line (currently line 154) to include company:

```typescript
  const profileFieldCount = [profile.name, profile.company, profile.email, profile.address, profile.phone]
    .filter((v) => (v ?? '').trim()).length
```

(`handleSaveProfile` already serializes the whole `profile` object, so `company` is persisted with no change there.)

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: no NEW errors in `Settings.tsx` (only the pre-existing Task 3 error in `InvoiceBuilder.tsx` if Task 7 not yet done).

- [ ] **Step 6: Commit**

```bash
git add freelance-tracker/src/pages/Settings.tsx
git commit -m "feat(settings): add company-name field to freelancer profile"
```

---

## Task 6: Render company name + billing period in the PDF

**Files:**
- Modify: `freelance-tracker/src/components/InvoicePDF.tsx`

- [ ] **Step 1: Import the period formatter**

Add to the imports at the top of the file:

```typescript
import { formatBillingPeriod } from '../lib/invoicePeriod'
```

- [ ] **Step 2: Read company from the profile**

The `profile` object is loaded from `userStorage` around line 71. Update its fallback shape to include `company` so TypeScript and runtime agree:

```typescript
  const profile = (() => {
    try {
      const raw = userStorage.get('freelancer_profile')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { name: '', company: '', email: '', phone: '', address: '' }
  })()
```

- [ ] **Step 3: Render company name above the personal name in the FROM block**

Replace the existing FROM name block (the `doc.text(profile.name || t('invPdf.yourName'), fromX, yPos + 7)` section, roughly lines 95–115) with logic that puts the company on top when present. Use this exact replacement:

```typescript
  // From — company name (bold, primary) then personal name (lighter)
  const company = (profile.company ?? '').trim()
  let fromLineY: number
  if (company) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(company, fromX, yPos + 7)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    if (profile.name) {
      doc.text(profile.name, fromX, yPos + 13)
      fromLineY = yPos + 19
    } else {
      fromLineY = yPos + 13
    }
  } else {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(profile.name || t('invPdf.yourName'), fromX, yPos + 7)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    fromLineY = yPos + 13
  }
  if (profile.email) {
    doc.text(profile.email, fromX, fromLineY)
    fromLineY += 5
  }
  if (profile.phone) {
    doc.text(profile.phone, fromX, fromLineY)
    fromLineY += 5
  }
  if (profile.address) {
    const addressLines = doc.splitTextToSize(profile.address, 70)
    doc.text(addressLines, fromX, fromLineY)
  }
```

(This preserves the existing email/phone/address rendering — make sure the original copies of those three blocks are removed so they are not duplicated.)

- [ ] **Step 4: Render the billing-period line and shift the table down**

The current code renders the Project line at `yPos = 88` and starts the line-items table at `yPos = 96`. Replace that section (the Project-name block through the `// --- Line Items Table ---` start) with:

```typescript
  // Project name
  yPos = 88
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`${t('invPdf.project')}: ${project.name}`, margin, yPos)

  // Billing period (only when both dates are present)
  let tableStartY = 96
  if (invoice.period_start && invoice.period_end) {
    doc.text(
      `${t('invPdf.period')}: ${formatBillingPeriod(invoice.period_start, invoice.period_end, locale)}`,
      margin,
      yPos + 6
    )
    tableStartY = 102
  }

  // --- Line Items Table ---
  yPos = tableStartY
```

(Everything below — the `tableRows` mapping and `autoTable({ startY: yPos, ... })` — stays as-is and now starts from the adjusted `yPos`.)

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: no NEW errors in `InvoicePDF.tsx` (only the pre-existing Task 3 error in `InvoiceBuilder.tsx` if Task 7 not yet done).

- [ ] **Step 6: Commit**

```bash
git add freelance-tracker/src/components/InvoicePDF.tsx
git commit -m "feat(invoices): render company name + billing period on invoice PDF"
```

---

## Task 7: Billing-month picker in the Invoice Builder

**Files:**
- Modify: `freelance-tracker/src/components/InvoiceBuilder.tsx`

- [ ] **Step 1: Import the helpers**

Add to the imports:

```typescript
import { monthInputToPeriod, latestMonthInput, currentMonthInput } from '../lib/invoicePeriod'
```

- [ ] **Step 2: Add billing-month state**

Next to the other `useState` declarations (after `const [notes, setNotes] = useState('')`), add:

```typescript
  const [billingMonth, setBillingMonth] = useState('')
```

- [ ] **Step 3: Default the month when entries load (reuse the `initialized` gate)**

Replace the existing one-time init block:

```typescript
  if (!initialized && (entries.length > 0 || unbilledExpenses.length > 0)) {
    setSelectedIds(new Set(entries.map((e) => e.id)))
    setSelectedExpenseIds(new Set(unbilledExpenses.map((e) => e.id)))
    setInitialized(true)
  }
```

with:

```typescript
  if (!initialized && (entries.length > 0 || unbilledExpenses.length > 0)) {
    setSelectedIds(new Set(entries.map((e) => e.id)))
    setSelectedExpenseIds(new Set(unbilledExpenses.map((e) => e.id)))
    const derived = latestMonthInput(entries.map((e) => e.date))
    setBillingMonth(derived || currentMonthInput())
    setInitialized(true)
  }
```

- [ ] **Step 4: Reset billing month on close**

In `handleOpenChange`, inside the `if (!nextOpen) { ... }` block, add alongside the other resets:

```typescript
      setBillingMonth('')
```

- [ ] **Step 5: Render the month picker**

In the invoice-settings grid (the `grid grid-cols-2 gap-4 mt-2` block), add a new field after the Due Date field's closing `</div>` and before the grid's closing `</div>`:

```tsx
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="billing-month">{t('invBuilder.billingMonth')}</Label>
                <Input
                  id="billing-month"
                  type="month"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                />
              </div>
```

- [ ] **Step 6: Add the `invBuilder.billingMonth` i18n key (en + es)**

In `freelance-tracker/src/lib/i18n.tsx`, find the English `'invBuilder.dueDate':` line and add below it:

```typescript
  'invBuilder.billingMonth': 'Billing month',
```

Find the Spanish `'invBuilder.dueDate':` line and add below it:

```typescript
  'invBuilder.billingMonth': 'Mes de facturación',
```

- [ ] **Step 7: Compute the period and include it in `createInvoice`**

In `handleGenerate`, just before the `await createInvoice(` call, add:

```typescript
      const period = billingMonth ? monthInputToPeriod(billingMonth) : null
```

Then change the invoice insert object passed to `createInvoice` to include the period fields (add these two lines after `issued_date: issuedDate,`):

```typescript
          issued_date: issuedDate,
          period_start: period?.start ?? null,
          period_end: period?.end ?? null,
```

- [ ] **Step 8: Type-check (full green expected now)**

Run: `npm run build`
Expected: PASS — the `InvoiceInsert` now supplies `period_start`/`period_end`, clearing the Task 3 error.

- [ ] **Step 9: Lint**

Run: `npm run lint`
Expected: PASS (no new errors/warnings in the edited files).

- [ ] **Step 10: Commit**

```bash
git add freelance-tracker/src/components/InvoiceBuilder.tsx freelance-tracker/src/lib/i18n.tsx
git commit -m "feat(invoices): capture billing month when generating invoices"
```

---

## Task 8: Edit billing month in the Invoice Edit dialog

**Files:**
- Modify: `freelance-tracker/src/components/InvoiceEditDialog.tsx`

- [ ] **Step 1: Import the helpers**

Add to the imports:

```typescript
import { monthInputToPeriod, dateToMonthInput } from '../lib/invoicePeriod'
```

- [ ] **Step 2: Add billing-month state**

After `const [dueDate, setDueDate] = useState('')`, add:

```typescript
  const [billingMonth, setBillingMonth] = useState('')
```

- [ ] **Step 3: Hydrate it when an invoice opens**

In the hydrate `useEffect` (the `if (!open || !invoice) return` block), add:

```typescript
    setBillingMonth(dateToMonthInput(invoice.period_start))
```

- [ ] **Step 4: Persist it on save**

In `handleSave`, compute the period and include it in `updateInvoice`. Add before the `await updateInvoice(` call:

```typescript
      const period = billingMonth ? monthInputToPeriod(billingMonth) : null
```

Add these two properties to the `updateInvoice` payload (after `due_date: dueDate || null,`):

```typescript
        due_date: dueDate || null,
        period_start: period?.start ?? null,
        period_end: period?.end ?? null,
```

- [ ] **Step 5: Render the month picker**

In the `grid grid-cols-2 gap-4` row that holds Issued Date and Due Date, add a third field after the Due Date `</div>` (the grid will wrap it to the next row, which is fine):

```tsx
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-billing-month">{t('invEdit.billingMonth')}</Label>
              <Input
                id="edit-billing-month"
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
              />
            </div>
```

- [ ] **Step 6: Add the `invEdit.billingMonth` i18n key (en + es)**

In `freelance-tracker/src/lib/i18n.tsx`, find the English `'invEdit.dueDate':` line and add below it:

```typescript
  'invEdit.billingMonth': 'Billing month',
```

Find the Spanish `'invEdit.dueDate':` line and add below it:

```typescript
  'invEdit.billingMonth': 'Mes de facturación',
```

- [ ] **Step 7: Type-check + lint**

Run: `npm run build`
Expected: PASS.
Run: `npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add freelance-tracker/src/components/InvoiceEditDialog.tsx freelance-tracker/src/lib/i18n.tsx
git commit -m "feat(invoices): allow editing billing month on existing invoices"
```

---

## Task 9: Backfill the two SiFive invoices

**Files:** none (live-data update via MCP `execute_sql`).

- [ ] **Step 1: Set the periods**

Run via the MCP `execute_sql` tool against project `pnilvktjzpnyqhnowuhs`:

```sql
update invoices set period_start = '2026-04-01', period_end = '2026-04-30'
  where invoice_number = 'INV-2026-001';
update invoices set period_start = '2026-05-01', period_end = '2026-05-31'
  where invoice_number = 'INV-2026-002';
```

- [ ] **Step 2: Verify**

```sql
select invoice_number, period_start, period_end
from invoices
where invoice_number in ('INV-2026-001','INV-2026-002')
order by invoice_number;
```

Expected: INV-2026-001 → 2026-04-01 / 2026-04-30; INV-2026-002 → 2026-05-01 / 2026-05-31.

(No commit — this is data, not code.)

---

## Task 10: Verification — build, lint, visual screenshot gate

**Files:** none (verification only).

- [ ] **Step 1: Full build + lint**

Run: `npm run build`
Expected: PASS.
Run: `npm run lint`
Expected: PASS.

- [ ] **Step 2: Start the dev server**

Use the `preview_start` tool (or `npm run dev`) to launch the app.

- [ ] **Step 3: Confirm a company name is set**

Open Settings, enter a Company Name (e.g. "Inspired Ideation Strategies"), and save. (Needed so the FROM block has a company to render.)

- [ ] **Step 4: Open a SiFive invoice PDF and screenshot it**

Navigate to Invoices, preview/download INV-2026-001. Capture a screenshot of the rendered PDF.

- [ ] **Step 5: Verify against acceptance criteria (write a real critique)**

Confirm and note in writing:
- Billing-period line reads **"Billing Period: April 1 – April 30, 2026"** (and "May 1 – May 31, 2026" for INV-2026-002).
- The FROM block shows the **company name in bold** with the personal name beneath it, and email/phone/address still render in order (no duplication, no overlap with the line-items table).

- [ ] **Step 6: Verify new-invoice capture**

Open the Invoice Builder for a project with unbilled time. Confirm the **Billing month** picker is present and defaults to the latest entry's month. (Do not generate/send unless the user asks.)

- [ ] **Step 7: Verify edit flow**

Open the Edit dialog on an existing invoice, confirm the **Billing month** shows the stored month, change it, save, re-open — confirm it persisted.

- [ ] **Step 8: Final commit (if any verification fixes were made)**

```bash
git add -A
git commit -m "fix(invoices): adjustments from billing-period visual verification"
```

---

## Self-Review

**Spec coverage:**
- Schema (period_start/period_end) → Task 1 ✓
- Types → Task 3 ✓
- Builder month picker → Task 7 ✓
- Edit dialog → Task 8 ✓
- Company name (Settings + PDF FROM) → Tasks 5 & 6 ✓
- PDF billing-period line + `invPdf.period` (en/es) → Tasks 6 & 4 ✓
- Backfill two SiFive invoices → Task 9 ✓
- Visual verification → Task 10 ✓

**Edge cases from spec:** null period → Task 6 Step 4 guards on `period_start && period_end`; empty company → Task 6 Step 3 `else` branch; monthly/expense-only invoices → Task 7 Step 3 falls back to `currentMonthInput()`; locale formatting → `formatBillingPeriod` takes `locale`.

**Type consistency:** helper names (`monthInputToPeriod`, `dateToMonthInput`, `latestMonthInput`, `currentMonthInput`, `formatBillingPeriod`) are used identically across Tasks 6–8. `period_start`/`period_end` naming matches the migration, types, builder, edit dialog, and backfill.

**Build-green caveat:** Task 3 intentionally leaves a transient type error (insert missing required period fields) that Task 7 resolves. Documented in Task 3 Step 3. Executors wanting per-commit green builds should land Tasks 3 and 7 together, or temporarily treat the fields as optional — but the simplest path is to proceed through Task 7.
