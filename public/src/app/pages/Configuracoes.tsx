import { useEffect } from 'react';
import { configuracoesMarkup } from '../legacy/configuracoesMarkup';

type ConfiguracoesGlobals = {
  initConfiguracoes?: () => void;
};

export default function Configuracoes() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/configuracoes');

      if (cancelled) return;

      const win = window as Window & ConfiguracoesGlobals;
      if (typeof win.initConfiguracoes === 'function') {
        win.initConfiguracoes();
      } else if (typeof (mod as { initConfiguracoes?: () => void }).initConfiguracoes === 'function') {
        (mod as { initConfiguracoes?: () => void }).initConfiguracoes?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: configuracoesMarkup }} />;
}
