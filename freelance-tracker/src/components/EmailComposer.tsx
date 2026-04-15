import { useState } from 'react';
import { Send, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendEmail } from '@/lib/gmail';
import { useGmail } from '@/hooks/useGmail';
import { useCommunications } from '@/hooks/useCommunications';

interface EmailComposerProps {
  projectId: string;
  clientEmail: string;
  onSent?: () => void;
}

export default function EmailComposer({ projectId, clientEmail, onSent }: EmailComposerProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const { isAuthenticated: authenticated, login } = useGmail();
  const { createCommunication } = useCommunications(projectId);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    setSending(true);
    setError(null);
    try {
      const response = await sendEmail(clientEmail, subject, body);

      await createCommunication({
        project_id: projectId,
        direction: 'sent',
        subject,
        body,
        from_email: 'me',
        to_email: clientEmail,
        gmail_message_id: response.id,
        gmail_thread_id: response.threadId,
        date: new Date().toISOString(),
      });

      setSubject('');
      setBody('');
      onSent?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      setError(message);
    } finally {
      setSending(false);
    }
  }

  // Not authenticated — show connect button
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

  return (
    <div className="rounded-[14px] bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Send className="h-4 w-4 text-accent" />
        <h3 className="text-[13px] font-semibold text-text-primary">Compose Email</h3>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* To field */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="email-to" className="text-[11px] text-text-muted">
            To
          </Label>
          <Input
            id="email-to"
            type="email"
            value={clientEmail}
            readOnly
            className="bg-input-bg text-[12px] opacity-70 cursor-default"
          />
        </div>

        {/* Subject field */}
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

        {/* Body field */}
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
            rows={4}
            className="w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-[12px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 resize-none"
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-[12px] text-negative">{error}</p>
        )}

        {/* Send button */}
        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            variant="gradient"
            size="sm"
            disabled={sending || !subject.trim() || !body.trim()}
          >
            {sending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
