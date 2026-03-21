import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import './shared.css';
import Automacao from './pages/Automacao';
import AdminDashboard from './pages/AdminDashboard';
import Campanhas from './pages/Campanhas';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CompleteRegistration from './pages/CompleteRegistration';
import Configuracoes from './pages/Configuracoes';
import Contatos from './pages/Contatos';
import Conversas from './pages/Conversas';
import ConversasV2 from './pages/ConversasV2';
import Dashboard from './pages/Dashboard';
import FlowBuilder from './pages/FlowBuilder';
import Fluxos from './pages/Fluxos';
import Funil from './pages/Funil';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Login from './pages/Login';
import Planos from './pages/Planos';
import PreCheckout from './pages/PreCheckout';
import PublicCheckout from './pages/PublicCheckout';
import Transmissao from './pages/Transmissao';
import Whatsapp from './pages/Whatsapp';

function GlobalOnboardingTour() {
  return (
    <>
      <style>{`
        .onboarding-floating-tour {
          position: fixed;
          right: 24px;
          bottom: 24px;
          width: min(390px, calc(100vw - 32px));
          z-index: 12000;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px;
          border-radius: 20px;
          border: 1px solid rgba(var(--primary-rgb), 0.22);
          background:
            radial-gradient(circle at top right, rgba(var(--primary-rgb), 0.14), transparent 34%),
            linear-gradient(180deg, rgba(8, 20, 36, 0.94) 0%, rgba(4, 12, 23, 0.98) 100%);
          box-shadow:
            0 28px 54px rgba(2, 8, 20, 0.42),
            inset 0 1px 0 rgba(var(--primary-rgb), 0.1);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          opacity: 0;
          pointer-events: none;
          transform: translate3d(0, 18px, 0) scale(0.98);
          transition:
            opacity 180ms ease,
            transform 180ms ease;
        }
        body.onboarding-presentation-mode::after {
          content: 'Modo tour ativo';
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 11900;
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid rgba(var(--primary-rgb), 0.34);
          background: rgba(4, 14, 18, 0.88);
          color: #ddfff3;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          box-shadow: 0 14px 28px rgba(2, 8, 20, 0.24);
          pointer-events: none;
        }
        .onboarding-floating-tour.is-open {
          opacity: 1;
          pointer-events: auto;
          transform: translate3d(0, 0, 0) scale(1);
        }
        .onboarding-floating-tour-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .onboarding-floating-tour-meta {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .onboarding-video-kicker {
          display: inline-flex;
          width: fit-content;
          max-width: 100%;
          align-self: flex-start;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid rgba(var(--primary-rgb), 0.24);
          background: rgba(10, 27, 44, 0.76);
          color: rgba(209, 236, 244, 0.88);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .onboarding-floating-tour-title {
          margin: 0;
          color: #f4fbf8;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.25;
        }
        .onboarding-floating-tour-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .onboarding-tour-nav-btn,
        .onboarding-tour-close-btn {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid rgba(var(--primary-rgb), 0.22);
          background: rgba(4, 14, 29, 0.82);
          color: rgba(234, 248, 244, 0.88);
          line-height: 1;
          padding: 0;
          cursor: pointer;
          transition:
            border-color 180ms ease,
            background 180ms ease,
            color 180ms ease;
        }
        .onboarding-tour-nav-btn {
          font-size: 16px;
          font-weight: 700;
        }
        .onboarding-tour-nav-btn:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .onboarding-tour-nav-btn:hover:not(:disabled),
        .onboarding-tour-close-btn:hover {
          border-color: rgba(var(--primary-rgb), 0.38);
          background: rgba(0, 240, 255, 0.12);
          color: #f4fffd;
        }
        .onboarding-tour-nav-btn:focus-visible,
        .onboarding-tour-close-btn:focus-visible {
          outline: 2px solid rgba(var(--primary-rgb), 0.4);
          outline-offset: 2px;
        }
        .onboarding-floating-player {
          position: relative;
        }
        .onboarding-video-shell {
          position: relative;
          overflow: hidden;
          aspect-ratio: 16 / 9;
          border-radius: 18px;
          border: 1px solid rgba(var(--primary-rgb), 0.2);
          background: linear-gradient(180deg, rgba(7, 18, 33, 0.98) 0%, rgba(3, 9, 19, 0.98) 100%);
          box-shadow:
            inset 0 1px 0 rgba(var(--primary-rgb), 0.08),
            0 18px 32px rgba(2, 8, 20, 0.24);
          isolation: isolate;
        }
        .onboarding-preview-backdrop {
          position: absolute;
          inset: 0;
          z-index: 0;
          background-position: center;
          background-size: cover;
          filter: saturate(0.94);
          opacity: 0.38;
          transform: scale(1.04);
        }
        .onboarding-video-shell::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(4, 11, 21, 0.08) 0%, rgba(2, 6, 12, 0.14) 48%, rgba(2, 6, 12, 0.84) 100%),
            linear-gradient(90deg, rgba(2, 8, 17, 0.24) 0%, rgba(2, 8, 17, 0.02) 40%, rgba(2, 8, 17, 0.28) 100%);
          pointer-events: none;
          z-index: 1;
        }
        .onboarding-video-frame {
          position: absolute;
          inset: 0;
          z-index: 2;
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
          background: #02070f;
        }
        .onboarding-video-element {
          object-fit: contain;
          pointer-events: none;
        }
        .onboarding-video-placeholder {
          position: absolute;
          inset: 0;
          z-index: 4;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 8px;
          text-align: center;
          padding: 24px;
          background: linear-gradient(180deg, rgba(2, 7, 15, 0.56) 0%, rgba(2, 7, 15, 0.84) 100%);
          color: rgba(220, 236, 243, 0.82);
          font-size: 13px;
        }
        .onboarding-video-shell.is-ready .onboarding-video-placeholder {
          display: none;
        }
        .onboarding-video-controls {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 6;
          pointer-events: auto;
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          padding: 14px;
          background: linear-gradient(180deg, rgba(2, 7, 15, 0) 0%, rgba(2, 7, 15, 0.18) 10%, rgba(2, 7, 15, 0.9) 54%, rgba(2, 7, 15, 0.96) 100%);
        }
        .onboarding-video-control-btn {
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border-radius: 999px;
          border: 1px solid rgba(var(--primary-rgb), 0.18);
          background: rgba(10, 25, 42, 0.88);
          color: #eaf8f4;
          pointer-events: auto;
          transition: border-color 180ms ease, background 180ms ease, transform 180ms ease, opacity 180ms ease;
        }
        .onboarding-video-control-btn:hover:not(:disabled) {
          border-color: rgba(var(--primary-rgb), 0.34);
          background: rgba(12, 31, 49, 0.96);
          transform: translateY(-1px);
        }
        .onboarding-video-control-btn:disabled {
          opacity: 0.56;
          cursor: not-allowed;
          transform: none;
        }
        .onboarding-video-control-btn:focus-visible {
          outline: 2px solid rgba(var(--primary-rgb), 0.42);
          outline-offset: 2px;
        }
        .onboarding-video-control-btn.is-primary {
          width: 44px;
          height: 44px;
          border-color: rgba(17, 212, 143, 0.28);
          background: linear-gradient(135deg, rgba(17, 212, 143, 0.98), rgba(32, 240, 192, 0.92));
          color: #062219;
          box-shadow: 0 14px 24px rgba(17, 212, 143, 0.18);
        }
        .onboarding-video-control-btn.is-primary:hover:not(:disabled) {
          border-color: rgba(17, 212, 143, 0.4);
          background: linear-gradient(135deg, rgba(28, 223, 154, 0.98), rgba(48, 245, 199, 0.94));
        }
        .onboarding-video-timeline {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
        }
        .onboarding-video-sound-icon {
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .onboarding-video-sound-icon svg {
          width: 18px;
          height: 18px;
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .onboarding-video-sound-off {
          display: none;
        }
        .onboarding-video-control-btn.is-muted .onboarding-video-sound-wave {
          display: none;
        }
        .onboarding-video-control-btn.is-muted .onboarding-video-sound-off {
          display: inline;
        }
        .onboarding-video-time {
          color: rgba(218, 236, 243, 0.82);
          font-size: 11px;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .onboarding-video-progress {
          width: 100%;
          margin: 0;
          appearance: none;
          -webkit-appearance: none;
          accent-color: rgb(var(--primary-rgb));
          cursor: pointer;
          pointer-events: auto;
          height: 4px;
          border-radius: 999px;
          background: rgba(220, 236, 243, 0.16);
        }
        .onboarding-video-progress:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .onboarding-video-progress::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #20f0c0;
          border: 2px solid #03251c;
          box-shadow: 0 0 0 4px rgba(32, 240, 192, 0.12);
        }
        .onboarding-video-progress::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #20f0c0;
          border: 2px solid #03251c;
          box-shadow: 0 0 0 4px rgba(32, 240, 192, 0.12);
        }
        .onboarding-video-ended-overlay {
          position: absolute;
          inset: 0;
          z-index: 7;
          display: none;
          align-items: flex-end;
          padding: 14px;
          background: linear-gradient(180deg, rgba(2, 7, 15, 0.08) 0%, rgba(2, 7, 15, 0.24) 42%, rgba(2, 7, 15, 0.84) 100%);
        }
        .onboarding-video-ended-overlay.is-visible {
          display: flex;
        }
        .onboarding-video-ended-card {
          width: 100%;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid rgba(var(--primary-rgb), 0.18);
          background: rgba(4, 13, 25, 0.84);
          box-shadow:
            inset 0 1px 0 rgba(var(--primary-rgb), 0.08),
            0 18px 28px rgba(2, 8, 20, 0.24);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .onboarding-video-ended-kicker {
          display: inline-flex;
          margin-bottom: 8px;
          color: rgba(143, 255, 225, 0.88);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .onboarding-video-ended-title {
          display: block;
          color: #f4fbf8;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.3;
        }
        .onboarding-video-ended-hint {
          display: block;
          margin-top: 4px;
          color: rgba(208, 228, 237, 0.8);
          font-size: 12px;
          line-height: 1.45;
        }
        .onboarding-video-ended-actions {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          min-width: 0;
        }
        .onboarding-video-ended-btn {
          flex: 1 1 0;
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid rgba(var(--primary-rgb), 0.18);
          background: rgba(10, 25, 42, 0.88);
          color: #eaf8f4;
          font-size: 12px;
          font-weight: 700;
          transition:
            border-color 0.18s ease,
            background 0.18s ease,
            transform 0.18s ease,
            opacity 0.18s ease;
        }
        .onboarding-video-ended-btn:hover:not(:disabled) {
          border-color: rgba(var(--primary-rgb), 0.34);
          background: rgba(12, 31, 49, 0.96);
          transform: translateY(-1px);
        }
        .onboarding-video-ended-btn:disabled {
          opacity: 0.48;
          cursor: not-allowed;
          transform: none;
        }
        .onboarding-video-ended-btn.is-primary {
          border-color: rgba(17, 212, 143, 0.28);
          background: linear-gradient(135deg, rgba(17, 212, 143, 0.98), rgba(32, 240, 192, 0.92));
          color: #062219;
          box-shadow: 0 14px 24px rgba(17, 212, 143, 0.16);
        }
        .onboarding-video-ended-btn.is-primary:hover:not(:disabled) {
          border-color: rgba(32, 240, 192, 0.42);
          background: linear-gradient(135deg, rgba(32, 240, 192, 1), rgba(92, 255, 214, 0.96));
          color: #041811;
          box-shadow: 0 16px 28px rgba(17, 212, 143, 0.22);
        }
        .onboarding-video-ended-btn:focus-visible {
          outline: 2px solid rgba(var(--primary-rgb), 0.34);
          outline-offset: 2px;
        }
        .onboarding-tour-target-active {
          position: relative !important;
          z-index: 2500 !important;
          box-shadow:
            0 0 0 2px rgba(var(--primary-rgb), 0.82),
            0 0 0 9999px rgba(2, 7, 15, 0.66),
            0 18px 32px rgba(2, 8, 20, 0.28) !important;
          border-radius: var(--onboarding-tour-radius, 16px) !important;
          animation: onboardingTourPulse 1.6s ease-in-out infinite;
        }
        .onboarding-tour-target-active.onboarding-tour-target-active-soft {
          box-shadow:
            0 0 0 2px rgba(var(--primary-rgb), 0.82),
            0 18px 32px rgba(2, 8, 20, 0.28) !important;
        }
        .onboarding-tour-target-ambient {
          position: relative !important;
          z-index: 2490 !important;
          box-shadow:
            0 0 0 9999px rgba(2, 7, 15, 0.66),
            0 18px 32px rgba(2, 8, 20, 0.22) !important;
          border-radius: var(--onboarding-tour-radius, 16px) !important;
        }
        .onboarding-tour-spotlight-card {
          display: none !important;
        }
        .onboarding-tour-spotlight-card.is-visible {
          display: none !important;
        }
        .onboarding-tour-spotlight-kicker {
          color: rgba(143, 255, 225, 0.88);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .onboarding-tour-spotlight-title {
          color: #f4fbf8;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.35;
        }
        .onboarding-tour-spotlight-hint {
          color: rgba(208, 228, 237, 0.8);
          font-size: 12px;
          line-height: 1.45;
        }
        @keyframes onboardingTourPulse {
          0%, 100% {
            box-shadow:
              0 0 0 2px rgba(var(--primary-rgb), 0.82),
              0 0 0 9999px rgba(2, 7, 15, 0.66),
              0 18px 32px rgba(2, 8, 20, 0.28);
          }
          50% {
            box-shadow:
              0 0 0 4px rgba(var(--primary-rgb), 0.88),
              0 0 0 9999px rgba(2, 7, 15, 0.72),
              0 20px 36px rgba(2, 8, 20, 0.32);
          }
        }
        @media (max-width: 980px) {
          .onboarding-floating-tour {
            right: 18px;
            bottom: 18px;
          }
        }
        @media (max-width: 640px) {
          body.onboarding-presentation-mode::after {
            top: 12px;
            font-size: 10px;
            padding: 6px 12px;
            max-width: calc(100vw - 24px);
          }
          .onboarding-floating-tour {
            left: 12px;
            right: 12px;
            bottom: 12px;
            width: auto;
            padding: 12px;
            border-radius: 16px;
          }
          .onboarding-floating-tour-title {
            font-size: 16px;
          }
          .onboarding-video-shell {
            border-radius: 16px;
          }
          .onboarding-video-controls {
            padding: 12px;
            gap: 8px;
          }
          .onboarding-video-control-btn {
            width: 36px;
            height: 36px;
          }
          .onboarding-video-control-btn.is-primary {
            width: 40px;
            height: 40px;
          }
          .onboarding-video-ended-actions {
            flex-direction: column;
          }
          .onboarding-tour-spotlight-card {
            width: calc(100vw - 24px);
          }
        }
      `}</style>

      <div className="onboarding-floating-tour" id="onboardingFloatingTour" aria-live="polite">
        <div className="onboarding-floating-tour-head">
          <div className="onboarding-floating-tour-meta">
            <span className="onboarding-video-kicker" id="onboardingVideoKicker">Etapa 1 de 8</span>
            <p className="onboarding-floating-tour-title" id="onboardingVideoTitle">Conecte seu WhatsApp</p>
          </div>

          <div className="onboarding-floating-tour-actions">
            <button
              type="button"
              className="onboarding-tour-nav-btn"
              id="onboardingTourPrevButton"
              title="Etapa anterior"
              aria-label="Etapa anterior"
            >
              <span aria-hidden="true">&larr;</span>
            </button>

            <button
              type="button"
              className="onboarding-tour-nav-btn"
              id="onboardingTourReplayButton"
              title="Ver novamente"
              aria-label="Ver novamente"
              hidden
            >
              <span aria-hidden="true">&#8635;</span>
            </button>

            <button
              type="button"
              className="onboarding-tour-nav-btn"
              id="onboardingTourNextButton"
              title="Próxima etapa"
              aria-label="Próxima etapa"
            >
              <span aria-hidden="true">&rarr;</span>
            </button>

            <button
              type="button"
              className="onboarding-tour-close-btn"
              id="onboardingTourCloseButton"
              title="Fechar tour"
              aria-label="Fechar tour"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </div>

        <div className="onboarding-floating-player">
          <div className="onboarding-video-shell" id="onboardingVideoShell">
            <div className="onboarding-preview-backdrop" id="onboardingVideoPosterBackdrop"></div>
            <video
              id="onboardingVideoElement"
              className="onboarding-video-frame onboarding-video-element"
              title="Tour guiado do ZapVender"
              playsInline
              preload="metadata"
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              style={{ display: 'none' }}
            ></video>

            <div className="onboarding-video-placeholder" id="onboardingVideoPlaceholder">
              <strong id="onboardingVideoPlaceholderTitle">Carregando tour</strong>
              <span id="onboardingVideoHint">Seu vídeo vai aparecer aqui em instantes.</span>
            </div>

            <div className="onboarding-video-controls" id="onboardingVideoControls">
              <button
                type="button"
                className="onboarding-video-control-btn is-primary"
                id="onboardingVideoToggleButton"
                disabled
                aria-label="Reproduzir vídeo"
                title="Reproduzir vídeo"
              >
                <span className="icon icon-play icon-sm" id="onboardingVideoToggleIcon"></span>
              </button>

              <button
                type="button"
                className="onboarding-video-control-btn"
                id="onboardingVideoMuteButton"
                disabled
                aria-label="Silenciar vídeo"
                title="Silenciar vídeo"
              >
                <span className="onboarding-video-sound-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 10v4h4l5 4V6l-5 4H5z"></path>
                    <path className="onboarding-video-sound-wave" d="M18 9a4 4 0 0 1 0 6"></path>
                    <path className="onboarding-video-sound-wave" d="M20.5 7a7 7 0 0 1 0 10"></path>
                    <path className="onboarding-video-sound-off" d="M18 9l4 6"></path>
                    <path className="onboarding-video-sound-off" d="M22 9l-4 6"></path>
                  </svg>
                </span>
              </button>

              <div className="onboarding-video-timeline">
                <span className="onboarding-video-time" id="onboardingVideoCurrentTime">00:00</span>
                <input
                  type="range"
                  id="onboardingVideoProgress"
                  className="onboarding-video-progress"
                  min={0}
                  max={1000}
                  step={1}
                  defaultValue={0}
                  disabled
                />
                <span className="onboarding-video-time" id="onboardingVideoDuration">00:00</span>
              </div>
            </div>

            <div className="onboarding-video-ended-overlay" id="onboardingVideoEndedOverlay" aria-live="polite">
              <div className="onboarding-video-ended-card">
                <span className="onboarding-video-ended-kicker">Etapa concluída</span>
                <strong className="onboarding-video-ended-title" id="onboardingVideoEndedTitle">Pronto para seguir</strong>
                <span className="onboarding-video-ended-hint" id="onboardingVideoEndedHint">
                  Vá para o próximo vídeo do tour quando quiser.
                </span>
                <div className="onboarding-video-ended-actions">
                  <button
                    type="button"
                    className="onboarding-video-ended-btn"
                    id="onboardingVideoPrevButton"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="onboarding-video-ended-btn is-primary"
                    id="onboardingVideoNextButton"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="onboarding-tour-spotlight-card" id="onboardingSpotlightCard" aria-live="polite">
        <span className="onboarding-tour-spotlight-kicker" id="onboardingSpotlightKicker">Destaque</span>
        <strong className="onboarding-tour-spotlight-title" id="onboardingSpotlightTitle">Veja este ponto</strong>
        <span className="onboarding-tour-spotlight-hint" id="onboardingSpotlightHint">O tour vai destacar recursos reais da tela enquanto o vídeo avança.</span>
      </div>
    </>
  );
}

export default function App() {
  const location = useLocation();

  function syncMobileMenuVisibilityByScroll() {
    const isMobileViewport = window.matchMedia('(max-width: 1024px)').matches;
    const shouldHideMenu = isMobileViewport && window.scrollY > 2 && !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('mobile-menu-hidden-by-scroll', shouldHideMenu);
  }

  const closeSidebar = () => {
    const sidebar = document.querySelector('.sidebar') as HTMLElement | null;
    const overlay = document.querySelector('.sidebar-overlay') as HTMLElement | null;

    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
    document.body.classList.remove('sidebar-open');
    syncMobileMenuVisibilityByScroll();
  };

  const syncSidebarAccessibility = () => {
    const sidebar = document.querySelector('.sidebar') as HTMLElement | null;
    const isOpen = Boolean(sidebar?.classList.contains('open'));
    const toggles = document.querySelectorAll('.mobile-menu-toggle');

    toggles.forEach((toggle) => {
      if (!(toggle instanceof HTMLButtonElement)) return;
      toggle.type = 'button';
      toggle.setAttribute('aria-label', isOpen ? 'Fechar menu de navegacao' : 'Abrir menu de navegacao');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.body.classList.toggle('sidebar-open', isOpen);
    syncMobileMenuVisibilityByScroll();
  };

  const syncApplicationAdminSidebarShortcut = () => {
    const isApplicationAdmin = sessionStorage.getItem('selfDashboardIsAppAdmin') === '1';
    const sidebars = document.querySelectorAll('.sidebar');
    const isAdminDashboardRoute = location.pathname === '/admin-dashboard';

    sidebars.forEach((sidebarEl) => {
      if (!(sidebarEl instanceof HTMLElement)) return;
      const footer = sidebarEl.querySelector('.sidebar-footer');
      if (!(footer instanceof HTMLElement)) return;

      let wrapper = footer.querySelector('.sidebar-admin-access');
      if (!(wrapper instanceof HTMLElement)) {
        wrapper = null;
      }

      if (!isApplicationAdmin) {
        wrapper?.remove();
        return;
      }

      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'sidebar-admin-access';
        footer.insertBefore(wrapper, footer.firstChild || null);
      }

      let link = wrapper.querySelector('a');
      if (!(link instanceof HTMLAnchorElement)) {
        link = document.createElement('a');
        link.href = '#/admin-dashboard';
        link.className = 'nav-link sidebar-admin-link';
        link.innerHTML = '<span class="icon icon-building"></span>Admin da Aplicação';
        wrapper.appendChild(link);
      }

      link.classList.toggle('active', isAdminDashboardRoute);
      if (isAdminDashboardRoute) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  useEffect(() => {
    const root = document.documentElement;
    let frameId: number | null = null;

    const applyViewportSize = () => {
      const viewport = window.visualViewport;
      const rawHeight = viewport && Number.isFinite(viewport.height) && viewport.height > 0
        ? viewport.height
        : window.innerHeight;
      const rawWidth = viewport && Number.isFinite(viewport.width) && viewport.width > 0
        ? viewport.width
        : window.innerWidth;
      const nextHeight = Math.max(1, Math.round(rawHeight));
      const nextWidth = Math.max(1, Math.round(rawWidth));
      root.style.setProperty('--app-mobile-vh', `${nextHeight}px`);
      root.style.setProperty('--app-mobile-vw', `${nextWidth}px`);
    };

    const scheduleApplyViewportSize = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = null;
        applyViewportSize();
      });
    };

    scheduleApplyViewportSize();
    window.addEventListener('resize', scheduleApplyViewportSize);
    window.addEventListener('orientationchange', scheduleApplyViewportSize);
    window.visualViewport?.addEventListener('resize', scheduleApplyViewportSize);
    window.visualViewport?.addEventListener('scroll', scheduleApplyViewportSize);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', scheduleApplyViewportSize);
      window.removeEventListener('orientationchange', scheduleApplyViewportSize);
      window.visualViewport?.removeEventListener('resize', scheduleApplyViewportSize);
      window.visualViewport?.removeEventListener('scroll', scheduleApplyViewportSize);
    };
  }, []);

  useEffect(() => {
    (window as Window & { refreshWhatsAppStatus?: () => void }).refreshWhatsAppStatus?.();
    (window as Window & { refreshOnboardingTourSurface?: () => void }).refreshOnboardingTourSurface?.();
    closeSidebar();
    syncSidebarAccessibility();
    syncApplicationAdminSidebarShortcut();
    syncMobileMenuVisibilityByScroll();
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const onScrollOrResize = () => {
      syncMobileMenuVisibilityByScroll();
    };

    onScrollOrResize();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('.mobile-menu-toggle')) {
        window.setTimeout(() => {
          syncSidebarAccessibility();
        }, 0);
        return;
      }

      if (target.closest('.sidebar-overlay')) {
        closeSidebar();
        return;
      }

      if (target.closest('.sidebar .nav-link') && window.matchMedia('(max-width: 1024px)').matches) {
        closeSidebar();
      }
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };

    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeyDown);

    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Planos />} />
        <Route path="/planos" element={<Planos />} />
        <Route path="/venda" element={<Planos />} />
        <Route path="/pre-checkout" element={<PreCheckout />} />
        <Route path="/checkout/:planKey" element={<PublicCheckout />} />
        <Route path="/login" element={<Login />} />
        <Route path="/checkout/sucesso" element={<CheckoutSuccess />} />
        <Route path="/finalizar-cadastro" element={<CompleteRegistration />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/contatos" element={<Contatos />} />
        <Route path="/campanhas" element={<Campanhas />} />
        <Route path="/automacao" element={<Automacao />} />
        <Route path="/fluxos" element={<Fluxos />} />
        <Route path="/flow-builder" element={<FlowBuilder />} />
        <Route path="/funil" element={<Funil />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/conversas" element={<Conversas />} />
        <Route path="/conversas-v2" element={<ConversasV2 />} />
        <Route path="/transmissao" element={<Transmissao />} />
        <Route path="/whatsapp" element={<Whatsapp />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Routes>
      <GlobalOnboardingTour />
    </>
  );
}
