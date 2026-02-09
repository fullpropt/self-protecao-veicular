import { useEffect } from 'react';
import { funilMarkup } from '../legacy/funilMarkup';

type FunilGlobals = {
  initFunil?: () => void;
};

export default function Funil() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/funil');

      if (cancelled) return;

      const win = window as Window & FunilGlobals;
      if (typeof win.initFunil === 'function') {
        win.initFunil();
      } else if (typeof (mod as { initFunil?: () => void }).initFunil === 'function') {
        (mod as { initFunil?: () => void }).initFunil?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: funilMarkup }} />;
}
