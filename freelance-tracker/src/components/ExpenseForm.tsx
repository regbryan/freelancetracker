import { useEffect, useState, useRef } from 'react'
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
import { Camera, Loader2 } from 'lucide-react'

export interface ExpenseFormData {
  projectId: string
  description: string
  amount: number
  date: string
  category: string
  receiptUrl?: string
}

interface ExpenseFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: {
    id: string
    projectId: string
    description: string
    amount: number
    date: string
    category: string
    receiptUrl?: string
  } | null
  projectId?: string
  projects?: { id: string; name: string }[]
  categories?: string[]
  onSave: (data: ExpenseFormData) => Promise<void>
}

const DEFAULT_CATEGORIES = [
  'Software',
  'Travel',
  'Meals',
  'Office Supplies',
  'Equipment',
  'Subscriptions',
  'Marketing',
  'Professional Services',
  'General',
]

export default function ExpenseForm({
  open,
  onOpenChange,
  expense,
  projectId: fixedProjectId,
  projects = [],
  categories = [],
  onSave,
}: ExpenseFormProps) {
  const isEdit = Boolean(expense)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [projectId, setProjectId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])].sort()
  const filteredCategories = allCategories.filter((c) =>
    c.toLowerCase().includes(category.toLowerCase()),
  )

  useEffect(() => {
    if (open) {
      setProjectId(expense?.projectId ?? fixedProjectId ?? '')
      setDescription(expense?.description ?? '')
      setAmount(expense?.amount != null ? String(expense.amount) : '')
      setDate(expense?.date ?? new Date().toISOString().split('T')[0])
      setCategory(expense?.category ?? '')
      setReceiptUrl(expense?.receiptUrl ?? '')
      setScanError(null)
      setShowCategoryDropdown(false)
    }
  }, [open, expense, fixedProjectId])

  async function handleReceiptCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setScanError('Image must be under 10MB')
      return
    }

    setScanning(true)
    setScanError(null)

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const apiUrl = import.meta.env.VITE_CALENDAR_API_URL || ''
      if (!apiUrl) throw new Error('API not configured')

      const res = await fetch(`${apiUrl}/api/parse-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse receipt')

      if (data.amount) setAmount(String(data.amount))
      if (data.description) setDescription(data.description)
      if (data.date) setDate(data.date)
      if (data.category) setCategory(data.category)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan receipt')
    } finally {
      setScanning(false)
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        projectId,
        description,
        amount: Number(amount),
        date,
        category: category || 'General',
        receiptUrl: receiptUrl || undefined,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const showProjectSelector = !fixedProjectId && projects.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the expense details below.'
              : 'Add a new expense or scan a receipt to auto-fill.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Receipt Scanner */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px]">Scan Receipt</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="flex items-center gap-1.5"
              >
                {scanning ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Camera size={12} />
                    Take Photo / Upload
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleReceiptCapture}
              />
            </div>
            {scanError && (
              <p className="text-negative text-[11px]">{scanError}</p>
            )}
          </div>

          {/* Project (only in global view) */}
          {showProjectSelector && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-project" className="text-[12px]">
                Project <span className="text-negative">*</span>
              </Label>
              <Select value={projectId} onValueChange={setProjectId} required>
                <SelectTrigger id="exp-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-desc" className="text-[12px]">
              Description <span className="text-negative">*</span>
            </Label>
            <Input
              id="exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Adobe Creative Cloud subscription"
              required
            />
          </div>

          {/* Amount & Date — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-amount" className="text-[12px]">
                Amount <span className="text-negative">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">
                  $
                </span>
                <Input
                  id="exp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-date" className="text-[12px]">
                Date <span className="text-negative">*</span>
              </Label>
              <Input
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Category (combobox) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-category" className="text-[12px]">
              Category
            </Label>
            <div className="relative">
              <Input
                id="exp-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value)
                  setShowCategoryDropdown(true)
                }}
                onFocus={() => setShowCategoryDropdown(true)}
                onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 150)}
                placeholder="e.g. Software, Travel..."
                autoComplete="off"
              />
              {showCategoryDropdown && filteredCategories.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-card z-20 max-h-32 overflow-y-auto">
                  {filteredCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-[12px] text-text-primary hover:bg-input-bg transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setCategory(c)
                        setShowCategoryDropdown(false)
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Receipt URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-receipt" className="text-[12px]">
              Receipt URL
            </Label>
            <Input
              id="exp-receipt"
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={saving || !description || !amount || (!fixedProjectId && !projectId)}
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
