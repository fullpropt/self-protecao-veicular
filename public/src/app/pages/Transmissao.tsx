import { useEffect } from 'react';
import { transmissaoMarkup } from '../legacy/transmissaoMarkup';

type TransmissaoGlobals = {
  initTransmissao?: () => void;
};

export default function Transmissao() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/transmissao');

      if (cancelled) return;

      const win = window as Window & TransmissaoGlobals;
      if (typeof win.initTransmissao === 'function') {
        win.initTransmissao();
      } else if (typeof (mod as { initTransmissao?: () => void }).initTransmissao === 'function') {
        (mod as { initTransmissao?: () => void }).initTransmissao?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: transmissaoMarkup }} />;
}
