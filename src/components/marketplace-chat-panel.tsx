'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { MarketplaceMessage, MarketplacePartyPreview } from '@/lib/marketplace';
import { SellerProfileChip } from '@/components/seller-profile-chip';
import { useI18n } from '@/i18n/I18nProvider';

type Props = {
  threadId: string;
  title?: string;
  subtitle?: string;
  otherParty?: MarketplacePartyPreview;
};

export function MarketplaceChatPanel({ threadId, title, subtitle, otherParty }: Props) {
  const { dict } = useI18n();
  const c = dict.marketplace.chat;
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/marketplace/chat/threads/${threadId}/messages`);
    const data = await res.json();
    if (res.ok) {
      setMessages(data.messages ?? []);
    }
    setLoading(false);
  }, [threadId]);

  useEffect(() => {
    setLoading(true);
    loadMessages();
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/marketplace/chat/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setText('');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[320px]">
      {(title || subtitle || otherParty) && (
        <div className="border-b px-4 py-3 shrink-0 space-y-2">
          {otherParty && <SellerProfileChip party={otherParty} size="md" />}
          {title && <p className="font-semibold text-sm">{title}</p>}
          {subtitle && !otherParty && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[200px] max-h-[360px]">
        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">{c.loading}</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">{c.empty}</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex', msg.isMine ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
                  msg.isMine
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}
              >
                {msg.body}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 flex gap-2 shrink-0">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={c.placeholder}
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button size="icon" disabled={sending || !text.trim()} onClick={handleSend}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}