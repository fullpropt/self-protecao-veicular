import { useEffect } from 'react';
import { automacaoMarkup } from '../legacy/automacaoMarkup';

type AutomacaoGlobals = {
  initAutomacao?: () => void;
};

export default function Automacao() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/automacao');

      if (cancelled) return;

      const win = window as Window & AutomacaoGlobals;
      if (typeof win.initAutomacao === 'function') {
        win.initAutomacao();
      } else if (typeof (mod as { initAutomacao?: () => void }).initAutomacao === 'function') {
        (mod as { initAutomacao?: () => void }).initAutomacao?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: automacaoMarkup }} />;
}
