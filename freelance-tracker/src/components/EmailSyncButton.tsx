import { useState, useCallback } from 'react';
import { RefreshCw, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { syncEmails } from '@/lib/gmail';
import { useGmail } from '@/hooks/useGmail';
import { useCommunications } from '@/hooks/useCommunications';

interface EmailSyncButtonProps {
  projectId: string;
  clientEmail: string;
  onSynced?: () => void;
}

export default function EmailSyncButton({ projectId, clientEmail, onSynced }: EmailSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated: authenticated, login } = useGmail();
  const { communications, createCommunication } = useCommunications(projectId);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);

    try {
      const emails = await syncEmails(clientEmail);

      // Build a set of existing gmail_message_ids for deduplication
      const existingIds = new Set(
        communications
          .map((c) => c.gmail_message_id)
          .filter((id): id is string => id !== null)
      );

      let newCount = 0;

      for (const email of emails) {
        if (existingIds.has(email.id)) continue;

        const fromLower = email.from.toLowerCase();
        const isSent = !fromLower.includes(clientEmail.toLowerCase());

        await createCommunication({
          project_id: projectId,
          direction: isSent ? 'sent' : 'received',
          subject: email.subject || null,
          body: email.body || null,
          from_email: email.from,
          to_email: email.to,
          gmail_message_id: email.id,
          gmail_thread_id: email.threadId,
          date: email.date ? new Date(email.date).toISOString() : new Date().toISOString(),
        });

        newCount++;
      }

      setMessage(
        newCount > 0
          ? `${newCount} new email${newCount === 1 ? '' : 's'} synced`
          : 'Already up to date'
      );

      onSynced?.();

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setError(msg);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setSyncing(false);
    }
  }, [clientEmail, projectId, communications, createCommunication, onSynced]);

  async function handleConnect() {
    setError(null);
    try {
      await login();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      setError(msg);
    }
  }

  if (!authenticated) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleConnect}>
          <Mail className="h-3.5 w-3.5" />
          <span className="text-[12px]">Connect Gmail first</span>
        </Button>
        {error && (
          <span className="text-[11px] text-negative">{error}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
      >
        {syncing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-[12px]">Syncing...</span>
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="text-[12px]">Sync Emails</span>
          </>
        )}
      </Button>

      {/* Success message */}
      {message && (
        <span className="text-[11px] font-medium text-positive animate-in fade-in duration-200">
          {message}
        </span>
      )}

      {/* Error message */}
      {error && (
        <span className="text-[11px] text-negative">{error}</span>
      )}
    </div>
  );
}
