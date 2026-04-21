import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Contract, ContractSignature } from '@/hooks/useContracts'
import { translate, type Lang } from '../lib/i18n'
import { userStorage } from '../lib/userStorage'

// Suppress unused import warning — autoTable attaches itself to jsPDF as a side effect
void autoTable

/**
 * Generates a professional contract PDF using jsPDF.
 * Returns the jsPDF document so the caller can call .save() or .output().
 */
export function generateContractPDF(
  contract: Contract,
  signature?: ContractSignature,
  lang: Lang = 'en'
): jsPDF {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)

  // --- Header ---
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 88, 190) // accent blue
  doc.text(t('contractPdf.title'), margin, 30)

  // Contract title & date
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(contract.title, margin, 42)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`${t('contractPdf.date')}: ${formatDate(contract.created_at, locale)}`, margin, 50)

  // Divider line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.5)
  doc.line(margin, 55, pageWidth - margin, 55)

  // --- From / To Section ---
  let yPos = 65

  // Load freelancer profile from localStorage
  const profile = (() => {
    try {
      const raw = userStorage.get('freelancer_profile')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { name: '', email: '', phone: '', address: '', company: '' }
  })()

  // FROM
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(150, 150, 150)
  doc.text(t('contractPdf.from'), margin, yPos)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(profile.name || t('contractPdf.yourName'), margin, yPos + 7)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  let fromLineY = yPos + 13
  if (profile.company) {
    doc.text(profile.company, margin, fromLineY)
    fromLineY += 5
  }
  if (profile.email) {
    doc.text(profile.email, margin, fromLineY)
    fromLineY += 5
  }
  if (profile.phone) {
    doc.text(profile.phone, margin, fromLineY)
    fromLineY += 5
  }
  if (profile.address) {
    const addressLines = doc.splitTextToSize(profile.address, 70)
    doc.text(addressLines, margin, fromLineY)
  }

  // TO
  const toX = pageWidth / 2 + 10
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(150, 150, 150)
  doc.text(t('contractPdf.to'), toX, yPos)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(contract.clients?.name || t('contractPdf.client'), toX, yPos + 7)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  let toLineY = yPos + 13
  if (contract.clients?.company) {
    doc.text(contract.clients.company, toX, toLineY)
    toLineY += 5
  }
  if (contract.clients?.email) {
    doc.text(contract.clients.email, toX, toLineY)
  }

  // Project reference
  if (contract.projects?.name) {
    yPos = 100
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`${t('contractPdf.project')}: ${contract.projects.name}`, margin, yPos)
    yPos += 10
  } else {
    yPos = 100
  }

  // Divider
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  // --- Contract Content ---
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)

  const contentWidth = pageWidth - margin * 2
  const lines = doc.splitTextToSize(contract.content, contentWidth)
  const lineHeight = 5
  const maxYBeforeNewPage = pageHeight - 40

  for (let i = 0; i < lines.length; i++) {
    if (yPos > maxYBeforeNewPage) {
      doc.addPage()
      yPos = margin
    }
    doc.text(lines[i], margin, yPos)
    yPos += lineHeight
  }

  // --- Signature Section ---
  yPos += 15

  if (yPos > pageHeight - 70) {
    doc.addPage()
    yPos = margin
  }

  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  if (signature) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(150, 150, 150)
    doc.text(t('contractPdf.signedBy'), margin, yPos)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(signature.signer_name, margin, yPos + 7)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`${t('contractPdf.signedOn')}: ${formatDate(signature.signed_at, locale)}`, margin, yPos + 14)

    // Add signature image
    if (signature.signature_data) {
      try {
        doc.addImage(signature.signature_data, 'PNG', margin, yPos + 18, 60, 25)
      } catch { /* ignore invalid signature images */ }
    }
  } else {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(200, 200, 200)
    doc.text(t('contractPdf.awaiting'), margin, yPos + 7)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(t('contractPdf.notSigned'), margin, yPos + 14)
  }

  // --- Footer ---
  const footerY = pageHeight - 15
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(t('contractPdf.generated'), pageWidth / 2, footerY, { align: 'center' })

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
