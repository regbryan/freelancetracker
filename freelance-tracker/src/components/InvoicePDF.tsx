import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Invoice, InvoiceItem } from '@/hooks/useInvoices'
import type { Project } from '@/hooks/useProjects'
import { translate, type Lang } from '../lib/i18n'
import { userStorage } from '../lib/userStorage'

interface ClientInfo {
  id: string
  name: string
  email?: string | null
  company?: string | null
}

/**
 * Generates a professional invoice PDF using jsPDF + jspdf-autotable.
 * Returns the jsPDF document so the caller can call .save() or .output().
 */
export function generateInvoicePDF(
  invoice: Invoice,
  items: InvoiceItem[],
  project: Project,
  client: ClientInfo,
  lang: Lang = 'en'
): jsPDF {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)

  // --- Header ---
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 88, 190) // accent blue
  doc.text(t('invPdf.title'), margin, 30)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)

  const headerRightX = pageWidth - margin
  doc.text(`${t('invPdf.invoiceNum')}: ${invoice.invoice_number}`, headerRightX, 20, { align: 'right' })
  doc.text(
    `${t('invPdf.issued')}: ${invoice.issued_date ? formatDate(invoice.issued_date, locale) : formatDate(new Date().toISOString(), locale)}`,
    headerRightX,
    26,
    { align: 'right' }
  )
  if (invoice.due_date) {
    doc.text(`${t('invPdf.due')}: ${formatDate(invoice.due_date, locale)}`, headerRightX, 32, { align: 'right' })
  }

  // Status badge
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const statusText = invoice.status.toUpperCase()
  const statusColor = getStatusColor(invoice.status)
  doc.setTextColor(statusColor.r, statusColor.g, statusColor.b)
  doc.text(statusText, headerRightX, 40, { align: 'right' })

  // Divider line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.5)
  doc.line(margin, 46, pageWidth - margin, 46)

  // --- From / To Section ---
  let yPos = 56

  // Load freelancer profile from localStorage
  const profile = (() => {
    try {
      const raw = userStorage.get('freelancer_profile')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { name: '', email: '', phone: '', address: '' }
  })()
  const businessLogo = userStorage.get('freelancer_logo') || ''

  // Add business logo if available
  if (businessLogo) {
    try {
      doc.addImage(businessLogo, 'PNG', margin, yPos - 4, 28, 28)
    } catch { /* ignore invalid images */ }
  }

  const fromX = businessLogo ? margin + 32 : margin

  // From
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(150, 150, 150)
  doc.text(t('invPdf.from'), fromX, yPos)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(profile.name || t('invPdf.yourName'), fromX, yPos + 7)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  let fromLineY = yPos + 13
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

  // To
  const toX = pageWidth / 2 + 10
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(150, 150, 150)
  doc.text(t('invPdf.billTo'), toX, yPos)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(client.name, toX, yPos + 7)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  if (client.company) {
    doc.text(client.company, toX, yPos + 13)
    if (client.email) {
      doc.text(client.email, toX, yPos + 19)
    }
  } else if (client.email) {
    doc.text(client.email, toX, yPos + 13)
  }

  // Project name
  yPos = 88
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`${t('invPdf.project')}: ${project.name}`, margin, yPos)

  // --- Line Items Table ---
  yPos = 96

  const tableRows = items.map((item) => [
    item.description,
    item.quantity.toFixed(2),
    `$${item.rate.toFixed(2)}`,
    `$${item.amount.toFixed(2)}`,
  ])

  autoTable(doc, {
    startY: yPos,
    head: [[t('invPdf.description'), t('invPdf.qtyHours'), t('invPdf.rate'), t('invPdf.amount')]],
    body: tableRows,
    margin: { left: margin, right: margin },
    theme: 'plain',
    headStyles: {
      fillColor: [245, 246, 248],
      textColor: [80, 80, 80],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 5,
    },
    bodyStyles: {
      textColor: [50, 50, 50],
      fontSize: 9,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 30 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252],
    },
  })

  // --- Totals ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? yPos + 40
  const totalsX = pageWidth - margin
  let totalsY = finalY + 12

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(t('invPdf.subtotal'), totalsX - 50, totalsY)
  doc.text(`$${invoice.subtotal.toFixed(2)}`, totalsX, totalsY, { align: 'right' })

  totalsY += 7
  doc.text(t('invPdf.tax', { pct: invoice.tax_rate }), totalsX - 50, totalsY)
  const taxAmount = invoice.subtotal * (invoice.tax_rate / 100)
  doc.text(`$${taxAmount.toFixed(2)}`, totalsX, totalsY, { align: 'right' })

  totalsY += 3
  doc.setDrawColor(200, 200, 200)
  doc.line(totalsX - 60, totalsY, totalsX, totalsY)

  totalsY += 8
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 88, 190)
  doc.text(t('invPdf.total'), totalsX - 50, totalsY)
  doc.text(`$${invoice.total.toFixed(2)}`, totalsX, totalsY, { align: 'right' })

  // --- Notes ---
  if (invoice.notes) {
    totalsY += 20
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(150, 150, 150)
    doc.text(t('invPdf.notes'), margin, totalsY)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2)
    doc.text(noteLines, margin, totalsY + 7)
  }

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 15
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(t('invPdf.generated'), pageWidth / 2, footerY, { align: 'center' })

  return doc
}

function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getStatusColor(status: string): { r: number; g: number; b: number } {
  switch (status) {
    case 'paid':
      return { r: 16, g: 185, b: 129 }
    case 'sent':
      return { r: 0, g: 88, b: 190 }
    case 'overdue':
      return { r: 239, g: 68, b: 68 }
    default:
      return { r: 100, g: 100, b: 100 }
  }
}
