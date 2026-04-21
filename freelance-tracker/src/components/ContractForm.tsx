import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { getDefaultTemplate, fillTemplate } from '@/lib/contractTemplates'
import { useI18n } from '../lib/i18n'
import { userStorage } from '../lib/userStorage'

export interface ContractFormData {
  clientId: string
  projectId?: string
  title: string
  content: string
}

interface ContractFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: { id: string; client_id: string; project_id?: string | null; title: string; content: string } | null
  clients: { id: string; name: string; company?: string | null }[]
  projects: { id: string; name: string }[]
  onSave: (data: ContractFormData) => Promise<void>
}

export default function ContractForm({
  open,
  onOpenChange,
  contract,
  clients,
  projects,
  onSave,
}: ContractFormProps) {
  const { t, lang } = useI18n()
  const isEdit = Boolean(contract)

  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setClientId(contract?.client_id ?? '')
      setProjectId(contract?.project_id ?? '')
      setTitle(contract?.title ?? '')
      setContent(contract?.content ?? '')
    }
  }, [open, contract])

  function handleUseTemplate() {
    const template = getDefaultTemplate()

    // Load freelancer profile from localStorage
    let freelancerName = ''
    let freelancerCompany = ''
    try {
      const raw = userStorage.get('freelancer_profile')
      if (raw) {
        const profile = JSON.parse(raw)
        freelancerName = profile.name || ''
        freelancerCompany = profile.company || ''
      }
    } catch { /* ignore */ }

    // Find selected client
    const selectedClient = clients.find((c) => c.id === clientId)
    const clientName = selectedClient?.name || ''
    const clientCompany = selectedClient?.company || ''

    // Find selected project
    const selectedProject = projects.find((p) => p.id === projectId)
    const projectName = selectedProject?.name || ''

    const filled = fillTemplate(template.content, {
      freelancer_name: freelancerName,
      freelancer_address: freelancerCompany,
      client_name: clientName,
      client_company: clientCompany || '',
      scope: t('contractForm.scopePlaceholder'),
      payment_terms: t('contractForm.paymentPlaceholder'),
      date: new Date().toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    })

    setContent(filled)
    if (!title && template.name) {
      setTitle(template.name)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        clientId,
        projectId: projectId || undefined,
        title,
        content,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('contractForm.editTitle') : t('contractForm.addTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('contractForm.editDesc')
              : t('contractForm.addDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contract-title" className="text-[12px]">
              {t('contractForm.title')} <span className="text-negative">*</span>
            </Label>
            <Input
              id="contract-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('contractForm.titlePlaceholder')}
              required
            />
          </div>

          {/* Client & Project — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-client" className="text-[12px]">
                {t('contractForm.client')} <span className="text-negative">*</span>
              </Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger id="contract-client">
                  <SelectValue placeholder={t('contractForm.selectClient')} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-project" className="text-[12px]">
                {t('contractForm.project')}
              </Label>
              <Select value={projectId || 'none'} onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}>
                <SelectTrigger id="contract-project">
                  <SelectValue placeholder={t('contractForm.none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('contractForm.none')}</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="contract-content" className="text-[12px]">
                {t('contractForm.content')} <span className="text-negative">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseTemplate}
              >
                {t('contractForm.useTemplate')}
              </Button>
            </div>
            <textarea
              id="contract-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('contractForm.contentPlaceholder')}
              rows={12}
              required
              className="w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="gradient" disabled={saving || !clientId || !title || !content}>
              {saving ? t('contractForm.saving') : isEdit ? t('contractForm.saveChanges') : t('contractForm.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
