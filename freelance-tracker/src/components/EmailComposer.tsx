import { useState, useEffect } from 'react';
import { Send, Mail, Loader2, Paperclip, X, CornerUpLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendEmail } from '@/lib/gmail';
import type { EmailAttachment } from '@/lib/gmail';
import { useGmail } from '@/hooks/useGmail';
import { useCommunications } from '@/hooks/useCommunications';
import { supabase } from '@/lib/supabase';
import { generateInvoicePDF } from '@/components/InvoicePDF';
import type { Invoice, InvoiceItem } from '@/hooks/useInvoices';
import type { Project } from '@/hooks/useProjects';

export interface AttachableInvoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
}

export interface ReplyTarget {
  subject: string | null;
  threadId: string;
  fromEmail: string | null;
}

interface EmailComposerProps {
  /** When omitted the composer runs in standalone mode — not tied to any project. */
  projectId?: string;
  /**
   * Pre-fills the To field and makes it read-only.
   * Omit (or pass undefined) for standalone mode where the user types the recipient.
   */
  clientEmail?: string;
  onSent?: () => void;
  /** Invoices for this project that can be attached as PDFs. Only used when projectId is set. */
  invoices?: AttachableInvoice[];
  /** When set, the composer pre-fills for a threaded reply. */
  replyTo?: ReplyTarget | null;
  /** Called when the user dismisses the reply context. */
  onClearReply?: () => void;
}

export default function EmailComposer({
  projectId,
  clientEmail,
  onSent,
  invoices,
  replyTo,
  onClearReply,
}: EmailComposerProps) {
  const [toEmail, setToEmail] = useState(clientEmail ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Keep to field in sync when clientEmail prop changes (e.g. project switching)
  useEffect(() => {
    setToEmail(clientEmail ?? '');
  }, [clientEmail]);

  // When a reply target arrives, pre-fill the subject line.
  useEffect(() => {
    if (replyTo) {
      const raw = replyTo.subject ?? '';
      setSubject(raw.toLowerCase().startsWith('re:') ? raw : `Re: ${raw}`);
    }
  }, [replyTo]);

  const { isAuthenticated: authenticated, login, loading: gmailLoading } = useGmail();
  const { createCommunication } = useCommunications(projectId);

  const isStandalone = !projectId;
  // In standalone mode the To field is editable; with a fixed clientEmail it's read-only.
  const toIsReadOnly = !isStandalone && !!clientEmail;

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      await login();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect Gmail';
      setError(message);
    } finally {
      setConnecting(false);
    }
  }

  /** Fetches invoice + project data and generates a base64 PDF attachment. */
  async function buildAttachment(): Promise<EmailAttachment | undefined> {
    if (!selectedInvoiceId || !projectId) return undefined;

    const { data: invoiceData, error: invErr } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', selectedInvoiceId)
      .single();
    if (invErr || !invoiceData) throw new Error('Failed to load invoice for attachment');

    const { data: projectData, error: projErr } = await supabase
      .from('projects')
      .select('*, clients(id, name, email, company)')
      .eq('id', projectId)
      .single();
    if (projErr || !projectData) throw new Error('Failed to load project for attachment');

    const rawClient = Array.isArray(projectData.clients)
      ? projectData.clients[0]
      : projectData.clients;

    const clientInfo = {
      id: rawClient?.id ?? '',
      name: rawClient?.name ?? 'Client',
      email: rawClient?.email ?? null,
      company: rawClient?.company ?? null,
    };

    const doc = generateInvoicePDF(
      invoiceData as Invoice,
      (invoiceData.invoice_items ?? []) as InvoiceItem[],
      projectData as Project,
      clientInfo,
    );

    const ab = doc.output('arraybuffer');
    const bytes = new Uint8Array(ab as ArrayBuffer);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary);

    return {
      filename: `${invoiceData.invoice_number}.pdf`,
      data: base64,
      mimeType: 'application/pdf',
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const recipient = toEmail.trim();
    if (!recipient || !subject.trim() || !body.trim()) return;

    setSending(true);
    setError(null);
    try {
      const attachment = await buildAttachment();
      const threadId = replyTo?.threadId;
      const response = await sendEmail(recipient, subject, body, threadId, attachment);

      await createCommunication({
        project_id: projectId ?? null,
        direction: 'sent',
        subject,
        body,
        from_email: 'me',
        to_email: recipient,
        gmail_message_id: response.id,
        gmail_thread_id: response.threadId,
        date: new Date().toISOString(),
      });

      setSubject('');
      setBody('');
      setSelectedInvoiceId(null);
      if (!toIsReadOnly) setToEmail('');
      onClearReply?.();
      onSent?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      setError(message);
    } finally {
      setSending(false);
    }
  }

  // Still checking — show a neutral loading state so we don't flash
  // "Connect Gmail" for users who are already connected.
  if (gmailLoading) {
    return (
      <div className="rounded-[14px] bg-surface p-5 shadow-card">
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span className="text-[12px] text-text-muted">Checking Gmail connection...</span>
        </div>
      </div>
    );
  }

  // Not authenticated — show connect prompt
  if (!authenticated) {
    return (
      <div className="rounded-[14px] bg-surface p-5 shadow-card">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-bg">
            <Mail className="h-5 w-5 text-accent" />
          </div>
          <p className="text-[13px] text-text-secondary text-center">
            Connect your Gmail account to send and sync emails.
          </p>
          {error && (
            <p className="text-[12px] text-negative text-center">{error}</p>
          )}
          <Button
            variant="gradient"
            size="sm"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Mail className="h-3.5 w-3.5" />
                Connect Gmail
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  const selectedInvoice = invoices?.find((i) => i.id === selectedInvoiceId);

  return (
    <div className={isStandalone ? '' : 'rounded-[14px] bg-surface p-5 shadow-card'}>
      {!isStandalone && (
        <div className="mb-4 flex items-center gap-2">
          <Send className="h-4 w-4 text-accent" />
          <h3 className="text-[13px] font-semibold text-text-primary">Compose Email</h3>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Reply-to banner */}
        {replyTo && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-input-bg border border-border">
            <CornerUpLeft className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="text-[12px] text-text-secondary flex-1 truncate">
              Replying to{replyTo.fromEmail ? <span className="font-medium text-text-primary"> {replyTo.fromEmail}</span> : ''}{replyTo.subject ? <>: <span className="italic">{replyTo.subject}</span></> : ''}
            </span>
            {onClearReply && (
              <button
                type="button"
                onClick={onClearReply}
                className="p-0.5 rounded hover:bg-border transition-colors"
                aria-label="Cancel reply"
              >
                <X className="h-3 w-3 text-text-muted" />
              </button>
            )}
          </div>
        )}

        {/* To */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="email-to" className="text-[11px] text-text-muted">
            To
          </Label>
          <Input
            id="email-to"
            type="email"
            value={toEmail}
            readOnly={toIsReadOnly}
            onChange={(e) => !toIsReadOnly && setToEmail(e.target.value)}
            placeholder={isStandalone ? 'recipient@example.com' : ''}
            required
            className={`text-[12px] ${toIsReadOnly ? 'opacity-70 cursor-default bg-input-bg' : ''}`}
          />
        </div>

        {/* Subject */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="email-subject" className="text-[11px] text-text-muted">
            Subject
          </Label>
          <Input
            id="email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject..."
            required
            className="text-[12px]"
          />
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="email-body" className="text-[11px] text-text-muted">
            Message
          </Label>
          <textarea
            id="email-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            required
            rows={5}
            className="w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-[12px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 resize-none"
          />
        </div>

        {/* Invoice attachment picker — only available when tied to a project */}
        {!isStandalone && invoices && invoices.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-text-muted flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Attach Invoice (optional)
            </Label>

            {selectedInvoice ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-accent/40 bg-accent-bg">
                <Paperclip className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="text-[12px] text-accent font-medium flex-1 truncate">
                  {selectedInvoice.invoice_number}.pdf
                  <span className="text-accent/60 font-normal ml-1.5">
                    ${selectedInvoice.total.toLocaleString()}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceId(null)}
                  className="p-0.5 rounded hover:bg-accent/20 transition-colors"
                  aria-label="Remove attachment"
                >
                  <X className="h-3 w-3 text-accent" />
                </button>
              </div>
            ) : (
              <select
                value=""
                onChange={(e) => setSelectedInvoiceId(e.target.value || null)}
                className="flex h-9 w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-[12px] text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">— Select an invoice to attach —</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · ${inv.total.toLocaleString()} · {inv.status}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-[12px] text-negative">{error}</p>
        )}

        {/* Send */}
        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            variant="gradient"
            size="sm"
            disabled={sending || !toEmail.trim() || !subject.trim() || !body.trim()}
          >
            {sending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {selectedInvoiceId ? 'Generating & Sending...' : 'Sending...'}
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {selectedInvoiceId ? 'Send with Invoice' : 'Send Email'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
