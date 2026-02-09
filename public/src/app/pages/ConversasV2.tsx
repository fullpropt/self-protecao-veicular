import { useEffect } from 'react';
import { conversasV2Markup } from '../legacy/conversasV2Markup';

type ConversasV2Globals = {
  initConversasV2?: () => void;
};

export default function ConversasV2() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/config');
      const mod = await import('../../pages/conversas-v2');

      if (cancelled) return;

      const win = window as Window & ConversasV2Globals;
      if (typeof win.initConversasV2 === 'function') {
        win.initConversasV2();
      } else if (typeof (mod as { initConversasV2?: () => void }).initConversasV2 === 'function') {
        (mod as { initConversasV2?: () => void }).initConversasV2?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: conversasV2Markup }} />;
}
