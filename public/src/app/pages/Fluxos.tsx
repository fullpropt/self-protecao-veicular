import { useEffect } from 'react';
import { fluxosMarkup } from '../legacy/fluxosMarkup';

type FluxosGlobals = {
  initFluxos?: () => void;
};

export default function Fluxos() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/fluxos');

      if (cancelled) return;

      const win = window as Window & FluxosGlobals;
      if (typeof win.initFluxos === 'function') {
        win.initFluxos();
      } else if (typeof (mod as { initFluxos?: () => void }).initFluxos === 'function') {
        (mod as { initFluxos?: () => void }).initFluxos?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: fluxosMarkup }} />;
}
