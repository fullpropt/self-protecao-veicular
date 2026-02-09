import { useEffect } from 'react';
import { whatsappMarkup } from '../legacy/whatsappMarkup';

type WhatsappGlobals = {
  initWhatsapp?: () => void;
};

export default function Whatsapp() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const mod = await import('../../pages/whatsapp');

      if (cancelled) return;

      const win = window as Window & WhatsappGlobals;
      if (typeof win.initWhatsapp === 'function') {
        win.initWhatsapp();
      } else if (typeof (mod as { initWhatsapp?: () => void }).initWhatsapp === 'function') {
        (mod as { initWhatsapp?: () => void }).initWhatsapp?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: whatsappMarkup }} />;
}
