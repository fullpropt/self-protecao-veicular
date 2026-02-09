import { useEffect } from 'react';
import { inboxMarkup } from '../legacy/inboxMarkup';

type InboxGlobals = {
  initInbox?: () => void;
};

export default function Inbox() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/inbox');

      if (cancelled) return;

      const win = window as Window & InboxGlobals;
      if (typeof win.initInbox === 'function') {
        win.initInbox();
      } else if (typeof (mod as { initInbox?: () => void }).initInbox === 'function') {
        (mod as { initInbox?: () => void }).initInbox?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: inboxMarkup }} />;
}