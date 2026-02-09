import { useEffect } from 'react';
import { conversasMarkup } from '../legacy/conversasMarkup';

type ConversasGlobals = {
  initConversas?: () => void;
};

export default function Conversas() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/config');
      const mod = await import('../../pages/conversas');

      if (cancelled) return;

      const win = window as Window & ConversasGlobals;
      if (typeof win.initConversas === 'function') {
        win.initConversas();
      } else if (typeof (mod as { initConversas?: () => void }).initConversas === 'function') {
        (mod as { initConversas?: () => void }).initConversas?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: conversasMarkup }} />;
}
