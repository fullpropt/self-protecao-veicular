import { useEffect } from 'react';
import { brandName } from '../lib/brand';

export default function Home() {
  useEffect(() => {
    document.title = `${brandName} · Automação e IA no WhatsApp`;
  }, []);

  return (
    <main
      aria-label="Página principal ZapVender"
      style={{
        width: '100%',
        height: '100dvh',
        minHeight: '100vh',
        margin: 0,
        padding: 0,
        backgroundColor: '#020202',
        overflow: 'auto'
      }}
    >
      <iframe
        title="ZapVender"
        src="/landing-bruno/index.html"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block'
        }}
        loading="eager"
        sandbox="allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </main>
  );
}
