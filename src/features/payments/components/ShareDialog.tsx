import { Copy, Link2, MessageCircle, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { SessionWithParticipants } from '../../../shared/types';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Textarea } from '../../../shared/ui/textarea';
import { buildPaymentMessage, shortSessionLink } from '../shareMessage';

/**
 * Share the payment info: a ready-made message (date, price, numbered names, link) that you can
 * tweak, then copy, send to WhatsApp, or hand to the phone's share sheet.
 */
export function ShareDialog({ session, onClose }: { session: SessionWithParticipants; onClose: () => void }) {
  const origin = window.location.origin;
  const [text, setText] = useState(() => buildPaymentMessage(session, origin));
  const link = shortSessionLink(origin, session.id);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Couldn’t copy automatically. Select the text and copy it.');
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ text });
    } catch {
      /* closed the share sheet: nothing to do */
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Share payment info"
      description="Edit the message if you like, then send it to the group."
    >
      <div className="space-y-4">
        <Textarea
          aria-label="Message to share"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(14, text.split('\n').length + 1)}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          People with an emoji next to their name have their payment approved. The link opens this session on the
          Payments tab.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => copy('Message', text)}>
            <Copy /> Copy message
          </Button>
          <Button
            variant="lime"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')}
          >
            <MessageCircle /> WhatsApp
          </Button>
          {canShare && (
            <Button variant="secondary" onClick={nativeShare}>
              <Share2 /> Share…
            </Button>
          )}
          <Button variant="ghost" onClick={() => copy('Link', link)}>
            <Link2 /> Copy link only
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
