import { useEffect } from 'react';
import { flowBuilderMarkup } from '../legacy/flowBuilderMarkup';

type FlowBuilderGlobals = {
  initFlowBuilder?: () => void;
};

export default function FlowBuilder() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/config');
      const mod = await import('../../pages/flow-builder');

      if (cancelled) return;

      const win = window as Window & FlowBuilderGlobals;
      if (typeof win.initFlowBuilder === 'function') {
        win.initFlowBuilder();
      } else if (typeof (mod as { initFlowBuilder?: () => void }).initFlowBuilder === 'function') {
        (mod as { initFlowBuilder?: () => void }).initFlowBuilder?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: flowBuilderMarkup }} />;
}
