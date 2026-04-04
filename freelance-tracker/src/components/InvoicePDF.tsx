import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Invoice, InvoiceItem } from '@/hooks/useInvoices'
import type { Project } from '@/hooks/useProjects'

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
  client: ClientInfo
): jsPDF {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20

  // --- Header ---
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 88, 190) // accent blue
  doc.text('INVOICE', margin, 30)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)

  const headerRightX = pageWidth - margin
  doc.text(`Invoice #: ${invoice.invoice_number}`, headerRightX, 20, { align: 'right' })
  doc.text(
    `Issued: ${invoice.issued_date ? formatDate(invoice.issued_date) : formatDate(new Date().toISOString())}`,
    headerRightX,
    26,
    { align: 'right' }
  )
  if (invoice.due_date) {
    doc.text(`Due: ${formatDate(invoice.due_date)}`, headerRightX, 32, { align: 'right' })
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
      const raw = localStorage.getItem('freelancer_profile')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { name: '', email: '', phone: '', address: '' }
  })()
  const businessLogo = localStorage.getItem('freelancer_logo') || ''

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
  doc.text('FROM', fromX, yPos)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(profile.name || 'Your Name', fromX, yPos + 7)

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
  doc.text('BILL TO', toX, yPos)

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
  doc.text(`Project: ${project.name}`, margin, yPos)

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
    head: [['Description', 'Qty / Hours', 'Rate', 'Amount']],
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
  doc.text('Subtotal:', totalsX - 50, totalsY)
  doc.text(`$${invoice.subtotal.toFixed(2)}`, totalsX, totalsY, { align: 'right' })

  totalsY += 7
  doc.text(`Tax (${invoice.tax_rate}%):`, totalsX - 50, totalsY)
  const taxAmount = invoice.subtotal * (invoice.tax_rate / 100)
  doc.text(`$${taxAmount.toFixed(2)}`, totalsX, totalsY, { align: 'right' })

  totalsY += 3
  doc.setDrawColor(200, 200, 200)
  doc.line(totalsX - 60, totalsY, totalsX, totalsY)

  totalsY += 8
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 88, 190)
  doc.text('Total:', totalsX - 50, totalsY)
  doc.text(`$${invoice.total.toFixed(2)}`, totalsX, totalsY, { align: 'right' })

  // --- Notes ---
  if (invoice.notes) {
    totalsY += 20
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(150, 150, 150)
    doc.text('NOTES', margin, totalsY)

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
  doc.text('Generated by FreelanceTracker', pageWidth / 2, footerY, { align: 'center' })

  return doc
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
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
