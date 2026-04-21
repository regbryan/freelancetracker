import { useState, useEffect, useRef } from 'react';
import {
  Send, Mail, Loader2, Paperclip, X, CornerUpLeft,
  Bold, Italic, Underline, List, Link2,
} from 'lucide-react';
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
import { useI18n } from '../lib/i18n';

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

// ---------------------------------------------------------------------------
// Editor serializer — walks the contenteditable DOM and produces clean HTML.
// Avoids innerHTML reads; only textContent is used to extract text nodes.
// ---------------------------------------------------------------------------

function serializeEditorHtml(el: HTMLElement): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const elem = node as Element;
    const tag = elem.tagName.toLowerCase();
    const children = Array.from(elem.childNodes).map(walk).join('');

    switch (tag) {
      case 'b':
      case 'strong':    return `<strong>${children}</strong>`;
      case 'i':
      case 'em':        return `<em>${children}</em>`;
      case 'u':         return `<u>${children}</u>`;
      case 'br':        return '<br>';
      case 'ul':        return `<ul>${children}</ul>`;
      case 'ol':        return `<ol>${children}</ol>`;
      case 'li':        return `<li>${children}</li>`;
      case 'a':         return `<a href="${elem.getAttribute('href') ?? ''}">${children}</a>`;
      case 'div':
      case 'p':         return children ? `<p>${children}</p>` : '<br>';
      default:          return children;
    }
  }
  return Array.from(el.childNodes).map(walk).join('');
}

function clearEditorContent(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// ---------------------------------------------------------------------------
// Formatting toolbar definition
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EmailComposer({
  projectId,
  clientEmail,
  onSent,
  invoices,
  replyTo,
  onClearReply,
}: EmailComposerProps) {
  const { t, lang } = useI18n();
  const TOOLBAR = [
    { cmd: 'bold',                  Icon: Bold,      title: t('emailComposer.bold')       },
    { cmd: 'italic',                Icon: Italic,    title: t('emailComposer.italic')     },
    { cmd: 'underline',             Icon: Underline, title: t('emailComposer.underline')  },
    { cmd: 'insertUnorderedList',   Icon: List,      title: t('emailComposer.bulletList') },
  ];
  const [toEmail, setToEmail] = useState(clientEmail ?? '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [bodyHasContent, setBodyHasContent] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setToEmail(clientEmail ?? ''); }, [clientEmail]);

  useEffect(() => {
    if (replyTo) {
      const raw = replyTo.subject ?? '';
      setSubject(raw.toLowerCase().startsWith('re:') ? raw : `Re: ${raw}`);
    }
  }, [replyTo]);

  const { isAuthenticated: authenticated, login, loading: gmailLoading } = useGmail();
  const { createCommunication } = useCommunications(projectId);

  const isStandalone = !projectId;
  const toIsReadOnly = !isStandalone && !!clientEmail;

  // ---------------------------------------------------------------------------
  // Rich text commands — onMouseDown + preventDefault keeps focus in the editor
  // ---------------------------------------------------------------------------

  function execCmd(cmd: string, value?: string) {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
  }

  function handleLink() {
    const url = window.prompt(t('emailComposer.promptUrl'));
    if (url) execCmd('createLink', url.startsWith('http') ? url : `https://${url}`);
  }

  // ---------------------------------------------------------------------------
  // File attachments
  // ---------------------------------------------------------------------------

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    setUploadedFiles((prev) => [...prev, ...incoming]);
    e.target.value = '';
  }

  function removeFile(idx: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---------------------------------------------------------------------------
  // Gmail connect
  // ---------------------------------------------------------------------------

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      await login();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('emailComposer.failedConnect'));
    } finally {
      setConnecting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Invoice PDF builder
  // ---------------------------------------------------------------------------

  async function buildInvoiceAttachment(): Promise<EmailAttachment | undefined> {
    if (!selectedInvoiceId) return undefined;

    const { data: invoiceData, error: invErr } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', selectedInvoiceId)
      .single();
    if (invErr || !invoiceData) throw new Error(t('emailComposer.failedLoadInvoice'));

    const invoiceProjectId = projectId ?? invoiceData.project_id;
    if (!invoiceProjectId) throw new Error(t('emailComposer.invoiceNoProject'));

    const { data: projectData, error: projErr } = await supabase
      .from('projects')
      .select('*, clients(id, name, email, company)')
      .eq('id', invoiceProjectId)
      .single();
    if (projErr || !projectData) throw new Error(t('emailComposer.failedLoadProject'));

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
      lang,
    );

    const ab = doc.output('arraybuffer');
    const bytes = new Uint8Array(ab as ArrayBuffer);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);

    return {
      filename: `${invoiceData.invoice_number}.pdf`,
      data: btoa(binary),
      mimeType: 'application/pdf',
    };
  }

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  async function doSend() {
    if (!bodyRef.current) return;
    const recipient = toEmail.trim();
    const htmlBody = serializeEditorHtml(bodyRef.current);
    const textContent = bodyRef.current.textContent?.trim() ?? '';
    if (!recipient || !subject.trim() || !textContent || sending) return;

    setSending(true);
    setError(null);
    try {
      const allAttachments: EmailAttachment[] = [];

      const invoiceAtt = await buildInvoiceAttachment();
      if (invoiceAtt) allAttachments.push(invoiceAtt);

      for (const file of uploadedFiles) {
        allAttachments.push({
          filename: file.name,
          data: await fileToBase64(file),
          mimeType: file.type || 'application/octet-stream',
        });
      }

      const response = await sendEmail(
        recipient,
        subject,
        htmlBody,
        replyTo?.threadId,
        allAttachments.length > 0 ? allAttachments : undefined,
        cc.trim() || undefined,
        bcc.trim() || undefined,
      );

      await createCommunication({
        project_id: projectId ?? null,
        direction: 'sent',
        subject,
        body: bodyRef.current.textContent ?? textContent,
        from_email: 'me',
        to_email: recipient,
        gmail_message_id: response.id,
        gmail_thread_id: response.threadId,
        date: new Date().toISOString(),
      });

      // Reset form
      setSubject('');
      setCc(''); setBcc('');
      setShowCc(false); setShowBcc(false);
      setSelectedInvoiceId(null);
      setUploadedFiles([]);
      setBodyHasContent(false);
      if (!toIsReadOnly) setToEmail('');
      clearEditorContent(bodyRef.current);
      onClearReply?.();
      onSent?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('emailComposer.failedSend'));
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / unauthenticated states
  // ---------------------------------------------------------------------------

  if (gmailLoading) {
    return (
      <div className="rounded-[14px] bg-surface p-5 shadow-card">
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span className="text-[12px] text-text-muted">{t('emailComposer.checking')}</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="rounded-[14px] bg-surface p-5 shadow-card">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-bg">
            <Mail className="h-5 w-5 text-accent" />
          </div>
          <p className="text-[13px] text-text-secondary text-center">
            {t('emailComposer.connectPrompt')}
          </p>
          {error && <p className="text-[12px] text-negative text-center">{error}</p>}
          <Button variant="gradient" size="sm" onClick={handleConnect} disabled={connecting}>
            {connecting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('emailComposer.connecting2')}</>
              : <><Mail className="h-3.5 w-3.5" />{t('emailComposer.connectGmail')}</>}
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Composer
  // ---------------------------------------------------------------------------

  const selectedInvoice = invoices?.find((i) => i.id === selectedInvoiceId);

  return (
    <div className={isStandalone ? '' : 'rounded-[14px] bg-surface p-5 shadow-card'}>
      {!isStandalone && (
        <div className="mb-4 flex items-center gap-2">
          <Send className="h-4 w-4 text-accent" />
          <h3 className="text-[13px] font-semibold text-text-primary">{t('emailComposer.compose')}</h3>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); doSend(); }} className="flex flex-col gap-3">

        {/* Reply banner */}
        {replyTo && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-input-bg border border-border">
            <CornerUpLeft className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="text-[12px] text-text-secondary flex-1 truncate">
              {t('emailComposer.replyingTo')}
              {replyTo.fromEmail && <span className="font-medium text-text-primary"> {replyTo.fromEmail}</span>}
              {replyTo.subject && <>: <span className="italic">{replyTo.subject}</span></>}
            </span>
            {onClearReply && (
              <button type="button" onClick={onClearReply} className="p-0.5 rounded hover:bg-border transition-colors" aria-label={t('emailComposer.cancelReply')}>
                <X className="h-3 w-3 text-text-muted" />
              </button>
            )}
          </div>
        )}

        {/* To */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-to" className="text-[11px] text-text-muted">{t('emailComposer.to')}</Label>
            <div className="flex gap-2">
              {!showCc && (
                <button type="button" onClick={() => setShowCc(true)} className="text-[11px] text-accent hover:underline">
                  {t('emailComposer.cc')}
                </button>
              )}
              {!showBcc && (
                <button type="button" onClick={() => setShowBcc(true)} className="text-[11px] text-accent hover:underline">
                  {t('emailComposer.bcc')}
                </button>
              )}
            </div>
          </div>
          <Input
            id="email-to"
            type="email"
            value={toEmail}
            readOnly={toIsReadOnly}
            onChange={(e) => !toIsReadOnly && setToEmail(e.target.value)}
            placeholder={isStandalone ? t('emailComposer.toPlaceholder') : ''}
            required
            className={`text-[12px] ${toIsReadOnly ? 'opacity-70 cursor-default bg-input-bg' : ''}`}
          />
        </div>

        {/* CC */}
        {showCc && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-cc" className="text-[11px] text-text-muted">{t('emailComposer.cc')}</Label>
              <button type="button" onClick={() => { setShowCc(false); setCc(''); }} className="text-text-muted hover:text-text-secondary transition-colors" aria-label={t('emailComposer.removeCc')}>
                <X className="h-3 w-3" />
              </button>
            </div>
            <Input id="email-cc" type="text" value={cc} onChange={(e) => setCc(e.target.value)} placeholder={t('emailComposer.ccPlaceholder')} className="text-[12px]" />
          </div>
        )}

        {/* BCC */}
        {showBcc && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-bcc" className="text-[11px] text-text-muted">{t('emailComposer.bcc')}</Label>
              <button type="button" onClick={() => { setShowBcc(false); setBcc(''); }} className="text-text-muted hover:text-text-secondary transition-colors" aria-label={t('emailComposer.removeBcc')}>
                <X className="h-3 w-3" />
              </button>
            </div>
            <Input id="email-bcc" type="text" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder={t('emailComposer.bccPlaceholder')} className="text-[12px]" />
          </div>
        )}

        {/* Subject */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="email-subject" className="text-[11px] text-text-muted">{t('emailComposer.subject')}</Label>
          <Input
            id="email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('emailComposer.subjectPlaceholder')}
            required
            className="text-[12px]"
          />
        </div>

        {/* Body — rich text editor */}
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-text-muted">{t('emailComposer.message')}</Label>

          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-t-[12px] border border-b-0 border-border bg-input-bg">
            {TOOLBAR.map(({ cmd, Icon, title }) => (
              <button
                key={cmd}
                type="button"
                title={title}
                onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }}
                className="p-1.5 rounded-[6px] hover:bg-border transition-colors text-text-muted hover:text-text-primary"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
            <button
              type="button"
              title={t('emailComposer.insertLink')}
              onMouseDown={(e) => { e.preventDefault(); handleLink(); }}
              className="p-1.5 rounded-[6px] hover:bg-border transition-colors text-text-muted hover:text-text-primary"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Editable body */}
          <div className="relative">
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  doSend();
                }
              }}
              onInput={(e) =>
                setBodyHasContent((e.currentTarget.textContent?.trim() ?? '').length > 0)
              }
              className="min-h-[120px] w-full rounded-b-[12px] border border-border bg-input-bg px-3 py-2 text-[12px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              style={{ wordBreak: 'break-word' }}
            />
            {!bodyHasContent && (
              <div className="pointer-events-none absolute top-2 left-3 text-[12px] text-text-muted select-none">
                {t('emailComposer.writeMessage')}{' '}
                <span className="opacity-50">{t('emailComposer.ctrlEnterToSend')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Attachments */}
        <div className="flex flex-col gap-2">
          {/* Invoice picker */}
          {invoices && invoices.length > 0 && (
            selectedInvoice ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-accent/40 bg-accent-bg">
                <Paperclip className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="text-[12px] text-accent font-medium flex-1 truncate">
                  {selectedInvoice.invoice_number}.pdf
                  <span className="text-accent/60 font-normal ml-1.5">${selectedInvoice.total.toLocaleString()}</span>
                </span>
                <button type="button" onClick={() => setSelectedInvoiceId(null)} className="p-0.5 rounded hover:bg-accent/20 transition-colors" aria-label={t('emailComposer.removeAttachment')}>
                  <X className="h-3 w-3 text-accent" />
                </button>
              </div>
            ) : (
              <select
                value=""
                onChange={(e) => setSelectedInvoiceId(e.target.value || null)}
                className="flex h-9 w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-[12px] text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">{t('emailComposer.attachInvoiceOption')}</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · ${inv.total.toLocaleString()} · {inv.status}
                  </option>
                ))}
              </select>
            )
          )}

          {/* Uploaded files */}
          {uploadedFiles.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-border bg-input-bg">
              <Paperclip className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <span className="text-[12px] text-text-secondary flex-1 truncate">{file.name}</span>
              <span className="text-[11px] text-text-muted shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeFile(idx)} className="p-0.5 rounded hover:bg-border transition-colors" aria-label={t('emailComposer.removeFile')}>
                <X className="h-3 w-3 text-text-muted" />
              </button>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <p className="text-[12px] text-negative">{error}</p>}

        {/* Footer: attach + send */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-secondary transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {t('emailComposer.attachFile')}
            </button>
          </div>

          <Button
            type="submit"
            variant="gradient"
            size="sm"
            disabled={sending || !toEmail.trim() || !subject.trim() || !bodyHasContent}
          >
            {sending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('emailComposer.sending')}</>
              : <><Send className="h-3.5 w-3.5" />{t('emailComposer.send')}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
