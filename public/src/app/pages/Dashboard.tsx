import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import { brandLogoUrl, brandName } from '../lib/brand';

type DashboardGlobals = {
  initDashboard?: () => void;
  initOnboardingCard?: () => void;
  loadDashboardData?: () => void;
  loadCustomEvents?: (options?: { silent?: boolean }) => void;
  toggleOnboardingStep?: (stepId: string, checked?: boolean) => void;
  selectOnboardingVideoStep?: (stepId: string) => void;
  goToOnboardingStep?: (stepId: string) => void;
  resetOnboardingChecklist?: () => void;
  openOnboardingVideoModal?: () => void;
  closeOnboardingVideoModal?: () => void;
  openModal?: (id: string) => void;
  closeModal?: (id: string) => void;
  openCustomEventModal?: (id?: number) => void;
  saveCustomEvent?: () => void;
  deleteCustomEvent?: (id: number) => void;
  exportLeads?: () => void;
  confirmReset?: () => void;
  filterLeads?: () => void;
  toggleSelectAll?: () => void;
  importLeads?: () => void;
  saveLead?: () => void;
  updateLead?: () => void;
  logout?: () => void;
};

function readDashboardHeaderUserName() {
  if (typeof window === 'undefined') return 'Usuário';

  const userName = String(window.sessionStorage.getItem('selfDashboardUser') || '').trim();
  return userName || 'Usuário';
}

function formatDashboardHeaderDate(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function DashboardStyles() {
  return (
    <style>{`
        .dashboard-react .sidebar .nav-link:not(.active) {
          background: transparent !important;
          border: 1px solid transparent !important;
          box-shadow: none !important;
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
        }
        .dashboard-botconversa { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 24px; }
        @media (max-width: 900px) { .dashboard-botconversa { grid-template-columns: 1fr; } }
        .stats-period-card, .stats-general-card, .events-personalized-card { position: relative; overflow: hidden; background: var(--surface); border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); padding: 24px; border: 1px solid var(--border-color); }
        .stats-period-card h3, .stats-general-card h3, .events-personalized-card h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #f5fbf8; }
        .stats-period-card {
          border-color: rgba(var(--primary-rgb), 0.2);
          background: linear-gradient(180deg, rgba(18, 36, 58, 0.98) 0%, rgba(14, 29, 47, 0.98) 100%);
          box-shadow:
            0 22px 48px rgba(2, 8, 20, 0.28),
            inset 0 1px 0 rgba(var(--primary-rgb), 0.14),
            0 0 0 1px rgba(var(--primary-rgb), 0.06),
            0 0 18px rgba(var(--primary-rgb), 0.08);
        }
        .stats-period-card::after {
          content: '';
          position: absolute;
          inset: auto 24px 24px 24px;
          height: 1px;
          background: rgba(var(--primary-rgb), 0.22);
          pointer-events: none;
        }
        .stats-period-controls {
          display: grid;
          grid-template-columns: minmax(140px, 1fr) minmax(140px, 1fr) minmax(180px, 1fr) auto;
          gap: 10px;
          align-items: center;
          margin-bottom: 20px;
        }
        .stats-period-controls .form-input,
        .stats-period-controls .form-select {
          width: 100%;
          min-width: 0;
          height: 40px;
          padding: 0 12px;
          box-sizing: border-box;
        }
        .chart-type-toggle {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: var(--surface-muted);
          justify-self: end;
        }
        .chart-type-toggle .chart-btn {
          min-width: 88px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          color: var(--gray-600);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        .chart-type-toggle .chart-btn.active {
          background: rgba(var(--primary-rgb), 0.22);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: #eafff4;
        }
        .chart-type-toggle .chart-btn .icon {
          width: 14px;
          height: 14px;
        }
        .chart-type-toggle .chart-btn .chart-btn-label {
          line-height: 1;
        }
        .stats-period-chart {
          position: relative;
          min-height: 228px;
          padding: 16px 14px 10px;
          border-radius: 18px;
          border: 1px solid rgba(var(--primary-rgb), 0.22);
          background: linear-gradient(180deg, rgba(23, 42, 66, 0.98) 0%, rgba(16, 31, 51, 0.98) 100%);
          box-shadow:
            inset 0 1px 0 rgba(var(--primary-rgb), 0.16),
            0 0 0 1px rgba(var(--primary-rgb), 0.04),
            inset 0 0 28px rgba(var(--primary-rgb), 0.04);
        }
        .stats-period-chart::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: none;
          pointer-events: none;
        }
        .stats-period-chart canvas {
          position: relative;
          z-index: 1;
        }
        @media (max-width: 900px) {
          .stats-period-controls {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .stats-period-controls .chart-type-toggle {
            grid-column: 1 / -1;
            justify-self: start;
          }
          .account-health-summary-row {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .account-health-summary-side {
            justify-self: start;
          }
          .account-health-detail-grid {
            grid-template-columns: 1fr;
          }
          .account-health-risk {
            justify-items: start;
            min-width: 0;
          }
          .account-health-risk-text {
            text-align: left;
          }
          .account-health-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .account-health-ops {
            grid-template-columns: 1fr;
          }
          .account-health-dispatch-row {
            grid-template-columns: 1fr;
          }
        }
        .stats-general-card { display: flex; flex-direction: column; gap: 0; }
        .stats-general-card h3 { text-align: left; margin-bottom: 10px; }
        .stats-general-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 12px 0;
          border-bottom: 1px solid var(--gray-100);
        }
        .stats-general-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .stats-general-label {
          font-size: 13px;
          color: var(--gray-600);
          line-height: 1.3;
        }
        .stats-general-value {
          font-weight: 700;
          font-size: 18px;
          margin-left: 12px;
          flex-shrink: 0;
        }
        .dashboard-react .stats-grid .stat-card {
          position: relative;
          overflow: hidden;
          border-color: rgba(var(--primary-rgb), 0.16);
          background: transparent !important;
          box-shadow:
            0 0 0 1px rgba(var(--primary-rgb), 0.08),
            0 0 16px rgba(var(--primary-rgb), 0.08);
        }
        .dashboard-react .stats-grid .stat-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.72) 0%, rgba(var(--primary-rgb), 0.26) 38%, rgba(255, 255, 255, 0.22) 100%);
          opacity: 0.72;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .dashboard-react .stats-grid .stat-card:hover {
          box-shadow:
            0 0 0 1px rgba(var(--primary-rgb), 0.12),
            0 0 18px rgba(var(--primary-rgb), 0.12);
        }
        .dashboard-react .stats-grid .stat-icon {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 15px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(255, 255, 255, 0.03);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 12px 24px rgba(1, 3, 7, 0.22);
          color: rgba(235, 241, 245, 0.9);
        }
        .dashboard-react .stats-grid .stat-icon::after {
          content: '';
          position: absolute;
          top: 8px;
          right: 8px;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: rgba(var(--primary-rgb), 0.42);
          box-shadow: 0 0 10px rgba(var(--primary-rgb), 0.16);
        }
        .dashboard-react .stats-grid .stat-icon .icon {
          width: 20px;
          height: 20px;
        }
        .dashboard-react .stats-grid .stat-icon.primary,
        .dashboard-react .stats-grid .stat-icon.success,
        .dashboard-react .stats-grid .stat-icon.warning,
        .dashboard-react .stats-grid .stat-icon.info {
          background: rgba(255, 255, 255, 0.03);
          color: rgba(235, 241, 245, 0.9);
        }
        .dashboard-react .stats-grid .stat-icon.primary::after {
          background: rgba(var(--primary-rgb), 0.42);
        }
        .dashboard-react .stats-grid .stat-icon.success::after {
          background: rgba(var(--primary-rgb), 0.38);
        }
        .dashboard-react .stats-grid .stat-icon.warning::after {
          background: rgba(226, 232, 240, 0.3);
        }
        .dashboard-react .stats-grid .stat-icon.info::after {
          background: rgba(129, 140, 248, 0.24);
        }
        .dashboard-react .stats-grid .stat-content,
        .dashboard-react .stats-grid .stat-icon {
          position: relative;
          z-index: 1;
        }
        .dashboard-react .stats-grid .stat-value {
          color: #f3fbff;
          letter-spacing: -0.03em;
        }
        .dashboard-react .stats-grid .stat-label {
          color: rgba(214, 228, 239, 0.62);
        }
        .dashboard-react .stats-grid .stat-change {
          border: 1px solid transparent;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .dashboard-react .stats-grid .stat-change.positive {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(74, 222, 128, 0.12);
        }
        .dashboard-react .stats-grid .stat-change.negative {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(248, 113, 113, 0.12);
        }
        .dashboard-react .funnel-container {
          position: relative;
          overflow: hidden;
          border-color: rgba(var(--primary-rgb), 0.2);
          background: linear-gradient(180deg, rgba(18, 36, 58, 0.98) 0%, rgba(14, 29, 47, 0.98) 100%);
          box-shadow:
            0 18px 42px rgba(2, 8, 20, 0.22),
            inset 0 1px 0 rgba(var(--primary-rgb), 0.14),
            0 0 0 1px rgba(var(--primary-rgb), 0.05),
            0 0 18px rgba(var(--primary-rgb), 0.06);
        }
        .dashboard-react .funnel-container::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: none;
          pointer-events: none;
        }
        .dashboard-react .funnel-title,
        .dashboard-react .funnel-stages {
          position: relative;
          z-index: 1;
        }
        .dashboard-react .funnel-title {
          color: #f3fbff;
          gap: 12px;
        }
        .dashboard-react .funnel-title .icon {
          color: rgba(var(--primary-rgb), 0.82);
        }
        .dashboard-react .funnel-stage {
          position: relative;
          overflow: hidden;
          padding: 22px 16px 20px;
          border-radius: 18px;
          border-color: rgba(var(--primary-rgb), 0.18);
          background: linear-gradient(180deg, rgba(23, 40, 62, 0.94) 0%, rgba(17, 31, 48, 0.94) 100%);
          box-shadow:
            inset 0 1px 0 rgba(var(--primary-rgb), 0.1),
            0 12px 28px rgba(2, 6, 23, 0.16);
        }
        .dashboard-react .funnel-stage::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: none;
          pointer-events: none;
        }
        .dashboard-react .funnel-stage:hover {
          border-color: rgba(var(--primary-rgb), 0.18);
          background: linear-gradient(180deg, rgba(23, 40, 62, 0.94) 0%, rgba(17, 31, 48, 0.94) 100%);
        }
        .dashboard-react .funnel-stage.active {
          border-color: rgba(var(--primary-rgb), 0.32);
          background: linear-gradient(180deg, rgba(28, 47, 73, 0.96) 0%, rgba(20, 35, 54, 0.96) 100%);
          box-shadow:
            inset 0 1px 0 rgba(var(--primary-rgb), 0.22),
            0 18px 36px rgba(2, 8, 20, 0.22),
            0 0 0 1px rgba(var(--primary-rgb), 0.08);
        }
        .dashboard-react .funnel-value,
        .dashboard-react .funnel-label,
        .dashboard-react .funnel-percent {
          position: relative;
          z-index: 1;
        }
        .dashboard-react .funnel-value {
          color: #29f3c2;
          text-shadow: 0 0 18px rgba(41, 243, 194, 0.14);
          letter-spacing: -0.04em;
        }
        .dashboard-react .funnel-label {
          color: rgba(213, 232, 224, 0.66);
        }
        .dashboard-react .funnel-percent {
          color: #59f7d1;
        }
        .dashboard-react .funnel-arrow {
          color: rgba(var(--primary-rgb), 0.56);
          font-size: 18px;
          font-weight: 500;
          transform: translateY(-4px);
        }
        .account-health-card {
          margin-bottom: 24px;
          background: linear-gradient(180deg, rgba(18, 36, 58, 0.98) 0%, rgba(14, 29, 47, 0.98) 100%);
          border-radius: var(--border-radius-lg);
          box-shadow:
            var(--shadow-md),
            inset 0 1px 0 rgba(var(--primary-rgb), 0.14),
            0 0 0 1px rgba(var(--primary-rgb), 0.05),
            0 0 18px rgba(var(--primary-rgb), 0.06);
          padding: 24px;
          border: 1px solid rgba(var(--primary-rgb), 0.18);
        }
        .account-health-header {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .account-health-header h3 {
          margin: 0 0 6px;
          font-size: 18px;
        }
        .account-health-list {
          display: grid;
          gap: 14px;
        }
        .account-health-account {
          position: relative;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(18, 36, 58, 0.94) 0%, rgba(14, 29, 47, 0.94) 100%);
          box-shadow:
            inset 0 1px 0 rgba(var(--primary-rgb), 0.14),
            0 10px 22px rgba(2, 8, 20, 0.16),
            0 0 0 1px rgba(var(--primary-rgb), 0.05);
          overflow: hidden;
        }
        .account-health-account::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.85), rgba(var(--primary-rgb), 0.55));
          opacity: 0.7;
        }
        .account-health-account.is-critical::before {
          background: linear-gradient(180deg, rgba(248, 113, 113, 0.9), rgba(251, 191, 36, 0.5));
        }
        .account-health-account.is-attention::before {
          background: linear-gradient(180deg, rgba(250, 204, 21, 0.85), rgba(45, 212, 191, 0.45));
        }
        .account-health-account.is-healthy::before {
          background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.85), rgba(var(--primary-rgb), 0.45));
        }
        .account-health-account.is-paused::before {
          background: linear-gradient(180deg, rgba(148, 163, 184, 0.8), rgba(71, 85, 105, 0.5));
        }
        .account-health-account.has-block-signal::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at right top, rgba(250, 204, 21, 0.08), transparent 32%);
          pointer-events: none;
        }
        .account-health-account-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          padding: 18px 18px 14px;
        }
        .account-health-account-title {
          min-width: 0;
          flex: 1;
        }
        .account-health-account-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .account-health-account-name {
          font-size: 16px;
          font-weight: 700;
          color: #f5fbf8;
        }
        .account-health-pill,
        .account-health-risk-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }
        .account-health-pill.is-connected {
          border-color: rgba(34, 197, 94, 0.34);
          color: #d6ffe6;
          background: rgba(34, 197, 94, 0.12);
        }
        .account-health-pill.is-warming {
          border-color: rgba(250, 204, 21, 0.34);
          color: #fff1b3;
          background: rgba(250, 204, 21, 0.12);
        }
        .account-health-pill.is-offline {
          border-color: rgba(248, 113, 113, 0.3);
          color: #ffd6d6;
          background: rgba(248, 113, 113, 0.12);
        }
        .account-health-pill.is-paused {
          border-color: rgba(148, 163, 184, 0.28);
          color: #d7e4ef;
          background: rgba(71, 85, 105, 0.18);
        }
        .account-health-risk {
          display: grid;
          justify-items: end;
          gap: 6px;
          min-width: 220px;
        }
        .account-health-risk-badge.is-critical {
          border-color: rgba(248, 113, 113, 0.34);
          color: #ffd7d7;
          background: rgba(248, 113, 113, 0.14);
        }
        .account-health-risk-badge.is-attention {
          border-color: rgba(250, 204, 21, 0.34);
          color: #fff1b3;
          background: rgba(250, 204, 21, 0.14);
        }
        .account-health-risk-badge.is-healthy {
          border-color: rgba(34, 197, 94, 0.34);
          color: #d6ffe6;
          background: rgba(34, 197, 94, 0.14);
        }
        .account-health-risk-badge.is-paused {
          border-color: rgba(148, 163, 184, 0.28);
          color: #d7e4ef;
          background: rgba(71, 85, 105, 0.18);
        }
        .account-health-risk-text {
          font-size: 12px;
          color: rgba(214, 228, 239, 0.74);
          text-align: right;
          line-height: 1.45;
        }
        .account-health-metrics,
        .account-health-ops {
          display: grid;
          gap: 12px;
          padding: 0 18px 16px;
        }
        .account-health-metrics {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .account-health-ops {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .account-health-metric,
        .account-health-op {
          min-width: 0;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(var(--primary-rgb), 0.12);
          background: linear-gradient(180deg, rgba(27, 46, 72, 0.88) 0%, rgba(21, 37, 58, 0.88) 100%);
        }
        .account-health-metric-label,
        .account-health-op-label {
          display: block;
          margin-bottom: 8px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(214, 228, 239, 0.58);
        }
        .account-health-metric-value,
        .account-health-op-value {
          display: block;
          font-size: 22px;
          font-weight: 700;
          color: #f4fbf8;
          line-height: 1.1;
        }
        .account-health-metric-sub,
        .account-health-op-sub {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: rgba(214, 228, 239, 0.68);
          line-height: 1.4;
        }
        .account-health-dispatches {
          border-top: 1px solid rgba(148, 163, 184, 0.14);
          padding: 16px 18px 18px;
        }
        .account-health-dispatches-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
          font-size: 12px;
          color: rgba(214, 228, 239, 0.72);
        }
        .account-health-dispatches-head strong {
          font-size: 13px;
          color: #f4fbf8;
        }
        .account-health-dispatch-list {
          display: grid;
          gap: 10px;
        }
        .account-health-dispatch-row {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(110px, 0.7fr));
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(27, 46, 72, 0.86) 0%, rgba(21, 37, 58, 0.86) 100%);
          border: 1px solid rgba(var(--primary-rgb), 0.1);
        }
        .account-health-dispatch-main {
          min-width: 0;
        }
        .account-health-dispatch-name {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #f4fbf8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .account-health-dispatch-meta {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: rgba(214, 228, 239, 0.64);
        }
        .account-health-dispatch-stat {
          min-width: 0;
          text-align: left;
        }
        .account-health-dispatch-stat strong {
          display: block;
          font-size: 18px;
          color: #f4fbf8;
        }
        .account-health-dispatch-stat span {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          color: rgba(214, 228, 239, 0.62);
        }
        .account-health-empty {
          padding: 18px;
          border-radius: 14px;
          border: 1px dashed rgba(148, 163, 184, 0.24);
          color: rgba(214, 228, 239, 0.72);
          text-align: center;
          font-size: 13px;
        }
        .account-health-footnote {
          margin: 14px 0 0;
          font-size: 12px;
          color: rgba(214, 228, 239, 0.6);
        }
        .account-health-account {
          transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
        }
        .account-health-account.is-critical {
          background: linear-gradient(180deg, rgba(23, 30, 44, 0.98) 0%, rgba(18, 25, 39, 0.98) 100%);
        }
        .account-health-account.is-attention {
          background: linear-gradient(180deg, rgba(18, 36, 58, 0.94) 0%, rgba(14, 29, 47, 0.94) 100%);
        }
        .account-health-account.is-healthy {
          background: linear-gradient(180deg, rgba(18, 36, 58, 0.94) 0%, rgba(14, 29, 47, 0.94) 100%);
        }
        .account-health-account.is-paused {
          background: linear-gradient(180deg, rgba(22, 34, 51, 0.92) 0%, rgba(16, 28, 43, 0.92) 100%);
        }
        .account-health-account[open] {
          border-color: rgba(var(--primary-rgb), 0.28);
          background: linear-gradient(180deg, rgba(21, 40, 63, 0.98) 0%, rgba(16, 31, 51, 0.98) 100%);
        }
        .account-health-account.is-critical[open] {
          border-color: rgba(248, 113, 113, 0.26);
          background: linear-gradient(180deg, rgba(28, 31, 44, 0.98) 0%, rgba(24, 26, 38, 0.98) 100%);
        }
        .account-health-account.is-attention[open] {
          border-color: rgba(250, 204, 21, 0.24);
          background: linear-gradient(180deg, rgba(22, 41, 64, 0.98) 0%, rgba(18, 34, 56, 0.98) 100%);
        }
        .account-health-account.is-healthy[open] {
          border-color: rgba(var(--primary-rgb), 0.22);
          background: linear-gradient(180deg, rgba(22, 41, 64, 0.98) 0%, rgba(18, 34, 56, 0.98) 100%);
        }
        .account-health-summary-row {
          list-style: none;
          display: grid;
          grid-template-columns: minmax(240px, 1.2fr) minmax(280px, 1.8fr) auto;
          gap: 14px;
          align-items: center;
          padding: 14px 16px;
          cursor: pointer;
        }
        .account-health-summary-row::-webkit-details-marker {
          display: none;
        }
        .account-health-summary-row::marker {
          content: '';
        }
        .account-health-summary-row:hover {
          background: rgba(var(--primary-rgb), 0.06);
        }
        .account-health-summary-main {
          min-width: 0;
          display: flex;
          align-items: center;
        }
        .account-health-summary-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          min-width: 0;
        }
        .account-health-summary-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 16px;
          justify-content: flex-start;
          align-items: flex-start;
        }
        .account-health-metric-chip {
          display: grid;
          gap: 2px;
          flex: 0 0 94px;
          min-width: 94px;
          padding: 0;
          border: none;
          border-radius: 0;
          background: none;
          box-shadow: none;
        }
        .account-health-metric-chip-label {
          display: block;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(214, 228, 239, 0.52);
        }
        .account-health-metric-chip-value {
          display: block;
          font-size: 16px;
          font-weight: 700;
          color: #f4fbf8;
          line-height: 1.1;
        }
        .account-health-summary-side {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          justify-self: end;
        }
        .account-health-summary-caret {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid rgba(var(--primary-rgb), 0.16);
          background: rgba(var(--primary-rgb), 0.05);
          transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
        }
        .account-health-summary-caret::before {
          content: '';
          width: 8px;
          height: 8px;
          border-right: 1.8px solid rgba(214, 255, 240, 0.82);
          border-bottom: 1.8px solid rgba(214, 255, 240, 0.82);
          transform: rotate(45deg) translateY(-1px);
        }
        .account-health-account[open] .account-health-summary-caret {
          transform: rotate(180deg);
        }
        .account-health-details {
          padding: 0 16px 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }
        .account-health-detail-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding-top: 14px;
        }
        .account-health-detail-card {
          min-width: 0;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: linear-gradient(180deg, rgba(25, 41, 63, 0.88) 0%, rgba(19, 33, 52, 0.88) 100%);
        }
        .account-health-detail-card.is-response,
        .account-health-detail-card.is-rhythm,
        .account-health-detail-card.is-insight {
          background: linear-gradient(180deg, rgba(25, 41, 63, 0.88) 0%, rgba(19, 33, 52, 0.88) 100%);
          border-color: rgba(148, 163, 184, 0.14);
        }
        .account-health-detail-card-title {
          display: block;
          margin-bottom: 10px;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(214, 228, 239, 0.54);
        }
        .account-health-detail-list {
          display: grid;
          gap: 8px;
        }
        .account-health-detail-item {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          color: rgba(214, 228, 239, 0.68);
        }
        .account-health-detail-item strong {
          color: #f4fbf8;
          font-size: 14px;
          text-align: right;
        }
        .account-health-detail-text {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(228, 239, 244, 0.82);
        }
        .account-health-dispatches {
          margin-top: 14px;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
        }
        .account-health-dispatches-head {
          margin-bottom: 10px;
        }
        .account-health-dispatch-row {
          grid-template-columns: minmax(0, 1.8fr) repeat(3, minmax(90px, 0.5fr));
          padding: 10px 12px;
          border-radius: 12px;
        }
        .events-personalized-card {
          border-color: transparent;
          background: linear-gradient(180deg, rgba(21, 26, 33, 0.98) 0%, rgba(15, 19, 25, 0.98) 100%);
          box-shadow:
            0 24px 52px rgba(1, 2, 6, 0.34),
            0 0 22px rgba(var(--primary-rgb), 0.035),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        .events-personalized-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(var(--primary-rgb), 0.12) 52%, rgba(148, 163, 184, 0.08) 100%);
          opacity: 0.38;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .events-header { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .events-header h3 { margin: 0; }
        .events-controls { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; margin-left: auto; flex-wrap: wrap; }
        .events-summary { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 12px; color: rgba(214, 228, 239, 0.58); }
        .events-summary strong { color: #f5fbf8; }
        .events-list { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; }
        .events-row { position: relative; overflow: hidden; display: grid; gap: 8px; padding: 10px 12px; border: 1px solid transparent; border-radius: 12px; background: linear-gradient(180deg, rgba(28, 34, 42, 0.95) 0%, rgba(21, 26, 33, 0.95) 100%); box-shadow: 0 10px 24px rgba(1, 3, 7, 0.18), 0 0 14px rgba(var(--primary-rgb), 0.025); }
        .events-row::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(var(--primary-rgb), 0.1) 55%, rgba(148, 163, 184, 0.06) 100%);
          opacity: 0.34;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .events-row-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .events-row-main { min-width: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .events-row-name { font-weight: 700; color: #f5fbf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
        .events-row-key { display: none; }
        .events-row-side { display: inline-flex; align-items: center; gap: 10px; margin-left: auto; flex-shrink: 0; }
        .events-row-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
        .events-row-count { display: inline-flex; align-items: baseline; gap: 4px; white-space: nowrap; }
        .events-row-count strong { font-size: 18px; font-weight: 800; color: #f5fbf8; line-height: 1; }
        .events-row-count span { font-size: 11px; color: rgba(214, 228, 239, 0.56); }
        .events-row-last { font-size: 12px; color: rgba(214, 228, 239, 0.6); white-space: nowrap; line-height: 1.2; }
        .events-row-actions { display: inline-flex; gap: 6px; }
        .events-loading, .events-error { position: relative; z-index: 1; padding: 14px; text-align: center; border: 1px dashed rgba(148, 163, 184, 0.2); border-radius: 10px; color: rgba(214, 228, 239, 0.62); }
        .info-icon { cursor: help; opacity: 0.7; }
        .events-empty { position: relative; z-index: 1; text-align: center; padding: 40px 20px; color: rgba(214, 228, 239, 0.62); }
        .events-empty-emoji { width: 48px; height: 48px; display: block; margin: 0 auto 16px; opacity: 0.6; background-color: var(--gray-400); }
        .custom-event-status { display: inline-flex; align-items: center; font-size: 11px; border-radius: 999px; padding: 2px 8px; border: 1px solid rgba(148, 163, 184, 0.24); color: rgba(214, 228, 239, 0.64); background: rgba(255, 255, 255, 0.03); white-space: nowrap; line-height: 1.2; }
        .custom-event-status.active { border-color: rgba(var(--primary-rgb), 0.45); color: #d8f4e6; background: rgba(var(--primary-rgb), 0.13); }
        .custom-event-status.inactive { border-color: rgba(148, 163, 184, 0.3); color: rgba(214, 228, 239, 0.62); }
        .events-personalized-card.is-sidebar {
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }
        .events-personalized-card.is-sidebar .events-header {
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .events-personalized-card.is-sidebar .events-controls {
          width: 100%;
          margin-left: 0;
          justify-content: flex-end;
        }
        .events-personalized-card.is-sidebar .events-controls .form-select {
          min-width: 0;
          flex: 1 1 150px;
        }
        .events-personalized-card.is-sidebar #customEventsList {
          flex: 1 1 auto;
        }
        .events-personalized-card.is-sidebar .events-list {
          gap: 8px;
        }
        .events-personalized-card.is-sidebar .events-row {
          padding: 10px 12px;
        }
        .events-personalized-card.is-sidebar .events-row-head {
          gap: 8px;
        }
        .events-personalized-card.is-sidebar .events-row-name,
        .events-personalized-card.is-sidebar .events-row-last {
          white-space: normal;
        }
        .events-personalized-card.is-sidebar .events-row-side {
          gap: 8px;
        }
        .events-personalized-card.is-sidebar .events-row-meta {
          gap: 4px;
        }
        .events-personalized-card.is-sidebar .events-empty {
          padding: 24px 12px;
        }
        .onboarding-card {
          position: relative;
          overflow: hidden;
          margin-bottom: 24px;
          padding: 22px;
          border-radius: var(--border-radius-lg);
          border: 1px solid rgba(0, 240, 255, 0.22);
          box-shadow:
            0 18px 42px rgba(2, 6, 23, 0.34),
            inset 0 1px 0 rgba(143, 255, 225, 0.04);
          background:
            radial-gradient(circle at 14% 16%, rgba(0, 240, 255, 0.18), transparent 34%),
            radial-gradient(circle at 78% 8%, rgba(143, 255, 225, 0.1), transparent 24%),
            linear-gradient(90deg, rgba(4, 64, 90, 0.34), rgba(6, 26, 46, 0.14) 34%, rgba(4, 13, 26, 0) 62%),
            linear-gradient(165deg, rgba(6, 22, 42, 0.98), rgba(4, 13, 28, 0.99));
        }
        .onboarding-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .onboarding-card-controls {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .dashboard-subtitle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .dashboard-subtitle-row p {
          margin: 0;
        }
        .onboarding-toggle-btn {
          width: 30px;
          height: 30px;
          border: 1px solid rgba(0, 240, 255, 0.22);
          border-radius: 999px;
          background: rgba(4, 14, 29, 0.82);
          color: #dffdf7;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          line-height: 1;
          padding: 0;
        }
        .onboarding-toggle-btn:hover {
          border-color: rgba(143, 255, 225, 0.42);
          background: rgba(0, 240, 255, 0.12);
        }
        .onboarding-dismiss-btn,
        .onboarding-restore-btn {
          width: 30px;
          height: 30px;
          border: 1px solid rgba(0, 240, 255, 0.22);
          border-radius: 999px;
          background: rgba(4, 14, 29, 0.82);
          color: rgba(231, 248, 242, 0.88);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          transition:
            background 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            color 0.18s ease;
        }
        .onboarding-dismiss-btn {
          font-size: 16px;
        }
        .onboarding-restore-btn {
          font-size: 17px;
          box-shadow:
            0 0 0 1px rgba(0, 240, 255, 0.04),
            0 0 18px rgba(0, 240, 255, 0.08);
        }
        .onboarding-dismiss-btn:hover,
        .onboarding-restore-btn:hover {
          border-color: rgba(143, 255, 225, 0.42);
          background: rgba(0, 240, 255, 0.12);
          color: #f4fffd;
          box-shadow:
            0 0 0 1px rgba(0, 240, 255, 0.06),
            0 0 20px rgba(0, 240, 255, 0.14);
        }
        .onboarding-toggle-btn:focus-visible {
          outline: 2px solid rgba(0, 240, 255, 0.34);
          outline-offset: 2px;
        }
        .onboarding-dismiss-btn:focus-visible,
        .onboarding-restore-btn:focus-visible {
          outline: 2px solid rgba(0, 240, 255, 0.34);
          outline-offset: 2px;
        }
        .onboarding-card-header h3 {
          margin: 0;
          font-size: 20px;
          display: inline-block;
          background: linear-gradient(90deg, #00f0ff 0%, #8fffe1 50%, #00f0ff 100%);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 10px rgba(0, 240, 255, 0.16));
        }
        .onboarding-card-header p {
          margin: 6px 0 0;
          font-size: 13px;
          color: rgba(220, 236, 243, 0.8);
        }
        .onboarding-grid {
          display: grid;
          grid-template-columns: minmax(340px, 1.02fr) minmax(320px, 0.98fr);
          gap: 16px;
          align-items: start;
        }
        .onboarding-content {
          display: block;
        }
        .onboarding-card.is-collapsed .onboarding-content {
          display: none;
        }
        .onboarding-spotlight {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
        }
        .onboarding-spotlight-card {
          position: relative;
          overflow: hidden;
          padding: 18px;
          border-radius: 18px;
          border: 1px solid rgba(var(--primary-rgb), 0.22);
          background:
            radial-gradient(circle at right top, rgba(var(--primary-rgb), 0.12), transparent 28%),
            linear-gradient(180deg, rgba(11, 27, 46, 0.94) 0%, rgba(7, 18, 33, 0.96) 100%);
          box-shadow:
            inset 0 1px 0 rgba(var(--primary-rgb), 0.12),
            0 18px 36px rgba(2, 8, 20, 0.22);
        }
        .onboarding-video-meta {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 0;
        }
        .onboarding-video-head {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .onboarding-video-kicker {
          display: inline-flex;
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
        .onboarding-video-status {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(7, 18, 32, 0.78);
          color: rgba(214, 228, 239, 0.82);
          font-size: 11px;
          font-weight: 700;
        }
        .onboarding-video-title {
          margin: 0;
          color: #f4fbf8;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.15;
        }
        .onboarding-video-description {
          margin: 0;
          color: rgba(204, 225, 233, 0.86);
          font-size: 13px;
          line-height: 1.5;
        }
        .onboarding-preview-card {
          position: relative;
          margin-top: 14px;
        }
        .onboarding-preview-button {
          width: 100%;
          display: block;
          padding: 0;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }
        .onboarding-preview-button:focus-visible {
          outline: 2px solid rgba(var(--primary-rgb), 0.4);
          outline-offset: 3px;
          border-radius: 20px;
        }
        .onboarding-preview-surface {
          position: relative;
          overflow: hidden;
          min-height: 292px;
          border-radius: 20px;
          border: 1px solid rgba(var(--primary-rgb), 0.22);
          background: linear-gradient(180deg, rgba(7, 18, 33, 0.98) 0%, rgba(3, 9, 19, 0.98) 100%);
          box-shadow:
            inset 0 1px 0 rgba(var(--primary-rgb), 0.08),
            0 20px 38px rgba(2, 8, 20, 0.2);
        }
        .onboarding-preview-backdrop {
          position: absolute;
          inset: 0;
          background-position: center;
          background-size: cover;
          filter: blur(22px) saturate(0.95);
          opacity: 0.4;
          transform: scale(1.08);
        }
        .onboarding-preview-surface::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(4, 11, 21, 0.28) 0%, rgba(2, 6, 12, 0.8) 100%),
            linear-gradient(90deg, rgba(2, 8, 17, 0.3) 0%, rgba(2, 8, 17, 0) 35%, rgba(2, 8, 17, 0.32) 100%);
          pointer-events: none;
        }
        .onboarding-preview-media {
          position: relative;
          z-index: 1;
          min-height: 292px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 18px 86px;
        }
        .onboarding-preview-poster {
          width: min(42%, 220px);
          min-width: 150px;
          aspect-ratio: 9 / 16;
          object-fit: cover;
          border-radius: 26px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(4, 12, 24, 0.9);
          box-shadow:
            0 24px 42px rgba(2, 6, 23, 0.5),
            0 0 0 1px rgba(var(--primary-rgb), 0.12);
        }
        .onboarding-video-placeholder {
          position: relative;
          z-index: 2;
          min-height: 292px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 6px;
          text-align: center;
          padding: 24px;
          color: rgba(220, 236, 243, 0.82);
          font-size: 13px;
        }
        .onboarding-preview-play {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 18px;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 18px;
          border: 1px solid rgba(var(--primary-rgb), 0.2);
          background: rgba(4, 13, 25, 0.86);
          color: #f4fbf8;
          box-shadow:
            inset 0 1px 0 rgba(var(--primary-rgb), 0.08),
            0 16px 28px rgba(2, 8, 20, 0.24);
        }
        .onboarding-preview-play-icon {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: linear-gradient(135deg, rgba(17, 212, 143, 0.96), rgba(32, 240, 192, 0.92));
          color: #062219;
          box-shadow: 0 14px 24px rgba(17, 212, 143, 0.2);
        }
        .onboarding-preview-play-copy {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .onboarding-preview-play-label {
          color: #f4fbf8;
          font-size: 14px;
          font-weight: 700;
        }
        .onboarding-preview-play-hint {
          color: rgba(209, 236, 244, 0.76);
          font-size: 12px;
        }
        .onboarding-spotlight-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }
        .onboarding-spotlight-actions .btn {
          min-height: 42px;
        }
        .onboarding-spotlight-note {
          margin-top: 2px;
          color: rgba(204, 225, 233, 0.72);
          font-size: 12px;
          line-height: 1.45;
        }
        .onboarding-sidebar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
        }
        .onboarding-progress {
          margin: 0;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(var(--primary-rgb), 0.18);
          background: rgba(8, 21, 38, 0.62);
        }
        .onboarding-progress-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .onboarding-progress-text {
          font-size: 13px;
          color: rgba(226, 242, 248, 0.88);
        }
        .onboarding-progress-track {
          width: 100%;
          height: 9px;
          border-radius: 999px;
          background: rgba(13, 31, 51, 0.9);
          border: 1px solid rgba(var(--primary-rgb), 0.2);
          overflow: hidden;
        }
        .onboarding-progress-fill {
          height: 100%;
          width: 0;
          border-radius: inherit;
          background: linear-gradient(90deg, #11d48f 0%, #20f0c0 100%);
          transition: width 0.25s ease;
        }
        .onboarding-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .onboarding-step {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 10px;
          align-items: flex-start;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(var(--primary-rgb), 0.16);
          background: rgba(8, 21, 38, 0.72);
          transition:
            border-color 0.18s ease,
            background 0.18s ease,
            box-shadow 0.18s ease;
        }
        .onboarding-step.is-active {
          border-color: rgba(var(--primary-rgb), 0.34);
          box-shadow:
            inset 0 0 0 1px rgba(var(--primary-rgb), 0.16),
            0 0 0 1px rgba(var(--primary-rgb), 0.06);
          background: rgba(11, 28, 46, 0.82);
        }
        .onboarding-step.is-complete {
          border-color: rgba(17, 212, 143, 0.28);
          box-shadow: inset 0 0 0 1px rgba(17, 212, 143, 0.08);
          background: rgba(12, 35, 55, 0.72);
        }
        .onboarding-step-select {
          width: 100%;
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 0;
          border: 0;
          background: transparent;
          text-align: left;
          color: inherit;
          cursor: pointer;
        }
        .onboarding-step-select:focus-visible {
          outline: 2px solid rgba(var(--primary-rgb), 0.34);
          outline-offset: 2px;
          border-radius: 12px;
        }
        .onboarding-step-index {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(7, 18, 32, 0.72);
          color: rgba(214, 228, 239, 0.82);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .onboarding-step.is-active .onboarding-step-index {
          border-color: rgba(var(--primary-rgb), 0.3);
          background: rgba(var(--primary-rgb), 0.16);
          color: #eafff4;
        }
        .onboarding-step.is-complete .onboarding-step-index {
          border-color: rgba(17, 212, 143, 0.3);
          background: rgba(17, 212, 143, 0.12);
          color: #d8fff0;
        }
        .onboarding-step-info {
          min-width: 0;
          padding-top: 2px;
        }
        .onboarding-step-title {
          margin: 0;
          color: #e7f8f2;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.3;
        }
        .onboarding-step-description {
          display: none;
          margin: 4px 0 0;
          color: rgba(194, 214, 224, 0.86);
          font-size: 12px;
          line-height: 1.45;
        }
        .onboarding-step.is-active .onboarding-step-description {
          display: block;
        }
        .onboarding-step .checkbox-wrapper {
          margin-top: 4px;
          margin-right: 0;
        }
        .onboarding-step-action {
          display: none;
          min-width: 118px;
          justify-content: center;
        }
        .onboarding-step.is-active .onboarding-step-action {
          display: inline-flex;
        }
        .onboarding-actions {
          margin-top: 4px;
          display: flex;
          justify-content: flex-end;
        }
        .onboarding-video-modal {
          width: min(940px, calc(100vw - 32px));
          border-radius: 22px;
          border: 1px solid rgba(var(--primary-rgb), 0.22);
          background:
            radial-gradient(circle at right top, rgba(var(--primary-rgb), 0.12), transparent 24%),
            linear-gradient(180deg, rgba(11, 27, 46, 0.98) 0%, rgba(5, 14, 27, 0.98) 100%);
          box-shadow:
            0 30px 80px rgba(2, 8, 20, 0.5),
            inset 0 1px 0 rgba(var(--primary-rgb), 0.1);
        }
        .onboarding-video-modal .modal-header {
          align-items: flex-start;
        }
        .onboarding-video-modal-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .onboarding-video-modal-frame-wrap {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 72vh;
          max-height: 780px;
          padding: 18px;
          border-radius: 22px;
          border: 1px solid rgba(var(--primary-rgb), 0.18);
          background:
            radial-gradient(circle at center, rgba(var(--primary-rgb), 0.12), transparent 40%),
            linear-gradient(180deg, rgba(4, 11, 21, 0.96) 0%, rgba(2, 7, 14, 0.98) 100%);
          overflow: hidden;
        }
        .onboarding-video-modal-frame-shell {
          position: relative;
          width: min(360px, 100%);
          aspect-ratio: 9 / 16;
          border-radius: 30px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          overflow: hidden;
          background: #02070f;
          box-shadow:
            0 28px 52px rgba(2, 6, 23, 0.56),
            0 0 0 1px rgba(var(--primary-rgb), 0.08);
        }
        .onboarding-video-frame {
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
          background: #02070f;
        }
        .onboarding-video-modal-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 8px;
          text-align: center;
          padding: 20px;
          color: rgba(220, 236, 243, 0.82);
          font-size: 13px;
        }
        .onboarding-video-modal-note {
          margin: 0;
          color: rgba(204, 225, 233, 0.7);
          font-size: 12px;
          line-height: 1.45;
        }
        @media (max-width: 980px) {
          .onboarding-grid {
            grid-template-columns: 1fr;
          }
          .onboarding-video-modal-frame-wrap {
            min-height: auto;
          }
        }
        @media (max-width: 768px) {
          .events-create-btn,
          .events-empty-create-btn { display: none !important; }
        }
        @media (max-width: 640px) {
          .dashboard-subtitle-row {
            align-items: flex-start;
          }
          .dashboard-botconversa { gap: 14px; margin-bottom: 16px; }
          .stats-period-card, .stats-general-card, .events-personalized-card, .account-health-card { padding: 12px; border-radius: 12px; }
          .stats-period-card h3, .stats-general-card h3, .events-personalized-card h3, .account-health-card h3 { margin-bottom: 12px; font-size: 15px; }
          .onboarding-card { padding: 14px; border-radius: 12px; margin-bottom: 16px; }
          .onboarding-card-header { margin-bottom: 12px; }
          .onboarding-card-header h3 { font-size: 18px; }
          .onboarding-spotlight-card { padding: 14px; border-radius: 14px; }
          .onboarding-video-title { font-size: 20px; }
          .onboarding-preview-surface,
          .onboarding-preview-media,
          .onboarding-video-placeholder { min-height: 236px; }
          .onboarding-preview-media { padding-bottom: 82px; }
          .onboarding-preview-poster { min-width: 132px; border-radius: 20px; }
          .onboarding-preview-play { left: 14px; right: 14px; bottom: 14px; padding: 10px 12px; }
          .onboarding-preview-play-icon { width: 36px; height: 36px; }
          .onboarding-spotlight-actions { flex-direction: column; }
          .onboarding-spotlight-actions .btn { width: 100%; justify-content: center; }
          .onboarding-step { grid-template-columns: auto minmax(0, 1fr); }
          .onboarding-step-action { grid-column: 2; justify-self: flex-start; min-width: 0; }
          .onboarding-actions { justify-content: flex-start; }
          .onboarding-video-modal { width: min(100vw - 20px, 480px); }
          .onboarding-video-modal-frame-wrap { padding: 10px; border-radius: 16px; }
          .onboarding-video-modal-frame-shell { border-radius: 22px; }
          .dashboard-react .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }
          .dashboard-react .stats-grid .stat-card {
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            gap: 8px;
            min-width: 0;
            padding: 12px;
            border-radius: 12px;
          }
          .dashboard-react .stats-grid .stat-icon {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
          }
          .dashboard-react .stats-grid .stat-icon .icon {
            width: 16px;
            height: 16px;
          }
          .dashboard-react .stats-grid .stat-content {
            width: 100%;
            min-width: 0;
            text-align: left;
          }
          .dashboard-react .stats-grid .stat-value { font-size: 20px; }
          .dashboard-react .stats-grid .stat-label { font-size: 11px; line-height: 1.2; }
          .dashboard-react .stats-grid .stat-change {
            margin-top: 6px;
            font-size: 10px;
            padding: 2px 6px;
          }
          .dashboard-react .funnel-stage {
            border-radius: 14px;
            padding: 18px 14px 16px;
          }
          .dashboard-react .funnel-arrow {
            transform: none;
          }
          .stats-period-controls {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            align-items: stretch;
          }
          .stats-period-controls .form-input,
          .stats-period-controls .form-select {
            width: 100%;
            min-width: 0;
            height: 42px;
            padding: 0 12px;
            font-size: 12px;
            line-height: 1.2;
            border-radius: 12px;
            box-sizing: border-box;
            font-variant-numeric: tabular-nums;
            overflow: hidden;
          }
          .stats-period-controls input[type="date"] {
            padding-left: 8px;
            padding-right: 24px;
            font-size: 11px;
            letter-spacing: -0.01em;
          }
          .stats-period-controls input[type="date"]::-webkit-datetime-edit {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding: 0;
          }
          .stats-period-controls input[type="date"]::-webkit-datetime-edit-text,
          .stats-period-controls input[type="date"]::-webkit-datetime-edit-day-field,
          .stats-period-controls input[type="date"]::-webkit-datetime-edit-month-field,
          .stats-period-controls input[type="date"]::-webkit-datetime-edit-year-field {
            padding: 0;
          }
          .stats-period-controls input[type="date"]::-webkit-calendar-picker-indicator {
            opacity: 0.9;
            cursor: pointer;
            margin-left: 4px;
          }
          .stats-period-controls .form-select {
            padding-left: 8px;
            padding-right: 24px;
            font-size: 11px;
            text-overflow: ellipsis;
            background-position: right 8px center;
            background-size: 9px;
          }
          .stats-period-controls .chart-type-toggle {
            grid-column: 1 / -1;
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            padding: 0;
            border: none;
            border-radius: 0;
            background: transparent;
            justify-self: stretch;
          }
          .stats-period-controls .chart-type-toggle .chart-btn {
            width: 100%;
            min-height: 40px;
            min-width: 0;
            border: 1px solid var(--border-color);
            background: var(--surface-muted);
          }
          .stats-period-chart canvas { max-height: 150px !important; }
          .stats-general-card {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            align-items: stretch;
          }
          .stats-general-card h3 {
            grid-column: 1 / -1;
            text-align: center;
            margin-bottom: 4px;
          }
          .stats-general-item {
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            gap: 4px;
            padding: 8px 6px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            border-bottom: 1px solid var(--border-color);
            background: rgba(15, 23, 42, 0.24);
          }
          .stats-general-item:last-child { padding-bottom: 8px; }
          .stats-general-label { font-size: 12px; }
          .stats-general-value { font-size: 18px; margin-left: 0; }
          .events-header { gap: 8px; margin-bottom: 12px; }
          .events-controls { width: 100%; margin-left: 0; }
          .events-controls .form-select, .events-controls .btn { width: 100%; }
          .stats-period-chart { min-height: 190px; padding: 12px 10px 8px; border-radius: 14px; }
          .events-row-head { align-items: flex-start; }
          .events-row-main { min-width: 0; }
          .events-row-side { width: 100%; justify-content: space-between; }
          .events-row-meta { gap: 4px; }
          .events-row-count, .events-row-last { white-space: normal; }
          .events-row-actions { justify-content: flex-end; }
          .events-empty { padding: 20px 10px; }
          .events-empty-emoji { width: 34px; height: 34px; margin-bottom: 10px; }
          .account-health-summary-row,
          .account-health-details { padding-left: 12px; padding-right: 12px; }
          .account-health-summary-metrics { gap: 6px 12px; }
          .account-health-metric-chip { min-width: calc(50% - 6px); flex: 0 0 calc(50% - 6px); }
          .account-health-summary-side { width: 100%; justify-content: space-between; }
          .account-health-detail-card,
          .account-health-dispatches { padding: 12px; }
        }
      `}</style>
  );
}

function DashboardHeader({
  currentDate,
  headerUserName,
  isOnboardingDismissed,
  onRestoreOnboarding
}: {
  currentDate: string;
  headerUserName: string;
  isOnboardingDismissed: boolean;
  onRestoreOnboarding: () => void;
}) {
  return (
    <div className="page-header">
      <div className="page-title">
        <h1>Painel de Controle</h1>
        <div className="dashboard-subtitle-row">
          <p>
            Bem-vindo, <span>{headerUserName}</span> |{' '}
            <span>{currentDate}</span>
          </p>
          {isOnboardingDismissed ? (
            <button
              type="button"
              className="onboarding-restore-btn"
              onClick={onRestoreOnboarding}
              title="Reativar primeiros passos"
              aria-label="Reativar primeiros passos"
            >
              <span aria-hidden="true">+</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatsPeriod() {
  const globals = window as Window & DashboardGlobals;

  return (
    <div className="dashboard-botconversa">
      <div className="stats-period-card">
        <h3>Estatísticas por período</h3>
        <div className="stats-period-controls">
          <input type="date" className="form-input" id="statsStartDate" />
          <input type="date" className="form-input" id="statsEndDate" />
          <select className="form-select" id="statsMetric" defaultValue="mensagens">
            <option value="novos_contatos">Novos Contatos</option>
            <option value="mensagens">Mensagens</option>
            <option value="interacoes">Interações</option>
          </select>
          <div className="chart-type-toggle">
            <button type="button" className="chart-btn active" data-chart-type="line" title="Gráfico de linhas">
              <span className="icon icon-chart-line icon-sm"></span>
              <span className="chart-btn-label">Linha</span>
            </button>
            <button type="button" className="chart-btn" data-chart-type="bar" title="Gráfico de barras">
              <span className="icon icon-chart-bar icon-sm"></span>
              <span className="chart-btn-label">Barras</span>
            </button>
          </div>
        </div>
        <div className="stats-period-chart" id="statsPeriodChart">
          <canvas id="statsChart" style={{ maxHeight: '200px' }}></canvas>
        </div>
      </div>
      <div className="events-personalized-card is-sidebar">
        <div className="events-header">
          <h3>
            Eventos personalizados{' '}
            <span
              className="info-icon"
              title="Crie eventos personalizados, integre-os em fluxos com o Bloco de Ação e rastreie suas estatísticas."
            >
              <span className="icon icon-info icon-sm"></span>
            </span>
          </h3>
          <div className="events-controls">
            <select className="form-select" id="customEventsPeriod" style={{ width: 'auto' }}>
              <option value="this_month">Este mês</option>
              <option value="week">Semana</option>
              <option value="year">Ano</option>
              <option value="last_30_days">Últimos 30 dias</option>
            </select>
            <button className="btn btn-primary btn-sm events-create-btn" type="button" onClick={() => globals.openCustomEventModal?.()}>
              Criar
            </button>
          </div>
        </div>
        <div id="customEventsList">
          <div className="events-loading">Carregando eventos personalizados...</div>
        </div>
      </div>
    </div>
  );
}

function AccountHealthCard() {
  return (
    <section className="account-health-card">
      <div className="account-health-header">
        <div>
          <h3>Saúde das contas de disparo</h3>
        </div>
      </div>
      <div className="account-health-list" id="accountHealthList">
        <div className="account-health-empty">Carregando saúde das contas...</div>
      </div>
    </section>
  );
}

const ONBOARDING_STEPS = [
  {
    id: 'connect_whatsapp',
    title: 'Conecte seu WhatsApp',
    description: 'Abra a tela de WhatsApp e conecte a primeira sessão.',
    actionLabel: 'Conectar'
  },
  {
    id: 'configure_accounts',
    title: 'Revise suas contas',
    description: 'Abra Configurações para conferir nome, status e disponibilidade das contas.',
    actionLabel: 'Abrir contas'
  },
  {
    id: 'open_inbox',
    title: 'Abra o Inbox',
    description: 'Inicie uma conversa para testar o atendimento.',
    actionLabel: 'Abrir inbox'
  },
  {
    id: 'create_first_contact',
    title: 'Cadastre um contato',
    description: 'Crie um contato de teste para validar o fluxo.',
    actionLabel: 'Abrir contatos'
  },
  {
    id: 'create_tags',
    title: 'Crie tags',
    description: 'Cadastre etiquetas para segmentar contatos e campanhas.',
    actionLabel: 'Abrir tags'
  },
  {
    id: 'configure_dynamic_fields',
    title: 'Configure campos dinâmicos',
    description: 'Cadastre variáveis personalizadas para enriquecer contatos, mensagens e fluxos.',
    actionLabel: 'Abrir campos'
  },
  {
    id: 'create_campaign',
    title: 'Monte uma campanha',
    description: 'Configure uma campanha simples e revise as métricas.',
    actionLabel: 'Abrir campanhas'
  },
  {
    id: 'create_automation',
    title: 'Publique uma automação',
    description: 'Monte uma automação e valide o disparo com um teste rápido.',
    actionLabel: 'Abrir automações'
  }
] as const;

function buildOnboardingCollapseStorageKey() {
  const userId = String(sessionStorage.getItem('selfDashboardUserId') || '').trim();
  if (userId) return `zapvender_dashboard_onboarding_collapsed_v1:user:${userId}`;

  const email = String(sessionStorage.getItem('selfDashboardUserEmail') || '').trim().toLowerCase();
  if (email) return `zapvender_dashboard_onboarding_collapsed_v1:email:${email}`;

  const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
  const suffix = token ? token.slice(-14) : 'anon';
  return `zapvender_dashboard_onboarding_collapsed_v1:token:${suffix}`;
}

function buildOnboardingDismissedStorageKey() {
  const userId = String(sessionStorage.getItem('selfDashboardUserId') || '').trim();
  if (userId) return `zapvender_dashboard_onboarding_dismissed_v1:user:${userId}`;

  const email = String(sessionStorage.getItem('selfDashboardUserEmail') || '').trim().toLowerCase();
  if (email) return `zapvender_dashboard_onboarding_dismissed_v1:email:${email}`;

  const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
  const suffix = token ? token.slice(-14) : 'anon';
  return `zapvender_dashboard_onboarding_dismissed_v1:token:${suffix}`;
}

function readStoredOnboardingFlag(storageKey: string) {
  try {
    return localStorage.getItem(storageKey) === '1';
  } catch (_) {
    return false;
  }
}

function OnboardingCard({
  isDismissed,
  onDismissedChange
}: {
  isDismissed: boolean;
  onDismissedChange: (nextValue: boolean) => void;
}) {
  const globals = window as Window & DashboardGlobals;
  const collapseStorageKey = buildOnboardingCollapseStorageKey();
  const dismissStorageKey = buildOnboardingDismissedStorageKey();
  const [isCollapsed, setIsCollapsed] = useState(() => readStoredOnboardingFlag(collapseStorageKey));
  const wasDismissedRef = useRef(isDismissed);

  useEffect(() => {
    try {
      localStorage.setItem(collapseStorageKey, isCollapsed ? '1' : '0');
    } catch (_) {
      // ignore storage failures
    }
  }, [collapseStorageKey, isCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(dismissStorageKey, isDismissed ? '1' : '0');
    } catch (_) {
      // ignore storage failures
    }
  }, [dismissStorageKey, isDismissed]);

  useEffect(() => {
    if (wasDismissedRef.current && !isDismissed) {
      const rehydrateOnboarding = () => {
        globals.initOnboardingCard?.();
      };

      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(rehydrateOnboarding);
      } else {
        window.setTimeout(rehydrateOnboarding, 0);
      }
    }

    wasDismissedRef.current = isDismissed;
  }, [globals, isDismissed]);

  const handleDismiss = () => {
    setIsCollapsed(false);
    onDismissedChange(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <section className={`onboarding-card${isCollapsed ? ' is-collapsed' : ''}`} id="dashboardOnboardingCard">
      <div className="onboarding-card-header">
        <div>
          <h3>Primeiros passos no ZapVender</h3>
          <p>Use este checklist para configurar sua conta e acelerar a ativação.</p>
        </div>
        <div className="onboarding-card-controls">
          <span className="badge badge-success" id="onboardingCompletedBadge" style={{ display: 'none' }}>
            Checklist concluído
          </span>
          <button
            type="button"
            className="onboarding-toggle-btn"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? 'Exibir primeiros passos' : 'Ocultar primeiros passos'}
            aria-label={isCollapsed ? 'Exibir primeiros passos' : 'Ocultar primeiros passos'}
            aria-expanded={!isCollapsed}
          >
            <span aria-hidden="true">{isCollapsed ? '\u25B8' : '\u25BE'}</span>
          </button>
          <button
            type="button"
            className="onboarding-dismiss-btn"
            onClick={handleDismiss}
            title="Fechar primeiros passos"
            aria-label="Fechar primeiros passos"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      </div>

      <div className="onboarding-content">
        <div className="onboarding-grid">
          <div className="onboarding-spotlight">
            <div className="onboarding-spotlight-card">
              <div className="onboarding-video-meta">
                <div className="onboarding-video-head">
                  <span className="onboarding-video-kicker" id="onboardingVideoKicker">Etapa 1 de 8</span>
                  <span className="onboarding-video-status" id="onboardingVideoStatus">Próxima recomendada</span>
                </div>
                <p className="onboarding-video-title" id="onboardingVideoTitle">Conecte seu WhatsApp</p>
                <p className="onboarding-video-description" id="onboardingVideoDescription">Selecione uma etapa para abrir o guia rápido correspondente.</p>
              </div>

              <div className="onboarding-preview-card">
                <button
                  type="button"
                  className="onboarding-preview-button"
                  id="onboardingVideoPreviewButton"
                  onClick={() => globals.openOnboardingVideoModal?.()}
                >
                  <div className="onboarding-preview-surface">
                    <div className="onboarding-preview-backdrop" id="onboardingVideoPosterBackdrop"></div>
                    <div className="onboarding-preview-media">
                      <img
                        id="onboardingVideoPosterImage"
                        className="onboarding-preview-poster"
                        alt="Prévia do guia da etapa"
                        style={{ display: 'none' }}
                      />
                    </div>
                    <div className="onboarding-video-placeholder" id="onboardingVideoPlaceholder">
                      <strong id="onboardingVideoPlaceholderTitle">Guia indisponível</strong>
                      <span id="onboardingVideoHint">Estamos preparando o passo a passo desta etapa.</span>
                    </div>
                    <div className="onboarding-preview-play">
                      <span className="onboarding-preview-play-icon">
                        <span className="icon icon-play icon-sm"></span>
                      </span>
                      <span className="onboarding-preview-play-copy">
                        <span className="onboarding-preview-play-label" id="onboardingVideoCtaLabel">Assistir guia rápido</span>
                        <span className="onboarding-preview-play-hint">Abra em destaque e avance com segurança.</span>
                      </span>
                    </div>
                  </div>
                </button>
              </div>

              <div className="onboarding-spotlight-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  id="onboardingVideoPlayButton"
                  onClick={() => globals.openOnboardingVideoModal?.()}
                >
                  Assistir guia
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  id="onboardingStepActionButton"
                >
                  Abrir etapa
                </button>
              </div>

              <p className="onboarding-spotlight-note" id="onboardingSpotlightNote">
                Assista ao guia da etapa selecionada e depois marque a checklist quando concluir.
              </p>
            </div>
          </div>

          <div className="onboarding-sidebar">
            <div className="onboarding-progress">
              <div className="onboarding-progress-head">
                <span className="onboarding-progress-text" id="onboardingProgressText">0/8 etapas concluídas</span>
              </div>
              <div className="onboarding-progress-track">
                <div className="onboarding-progress-fill" id="onboardingProgressFill"></div>
              </div>
            </div>

            <div className="onboarding-steps">
              {ONBOARDING_STEPS.map((step, index) => (
                <div className="onboarding-step" id={`onboarding-row-${step.id}`} data-onboarding-step-id={step.id} key={step.id}>
                  <label className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      id={`onboarding-step-${step.id}`}
                      onChange={(event) => globals.toggleOnboardingStep?.(step.id, event.currentTarget.checked)}
                    />
                    <span className="checkbox-custom"></span>
                  </label>

                  <button
                    type="button"
                    className="onboarding-step-select"
                    onClick={() => globals.selectOnboardingVideoStep?.(step.id)}
                  >
                    <span className="onboarding-step-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="onboarding-step-info">
                      <span className="onboarding-step-title">{step.title}</span>
                      <span className="onboarding-step-description">{step.description}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline btn-sm onboarding-step-action"
                    onClick={() => globals.goToOnboardingStep?.(step.id)}
                  >
                    {step.actionLabel}
                  </button>
                </div>
              ))}
            </div>

            <div className="onboarding-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => globals.resetOnboardingChecklist?.()}
              >
                Reiniciar checklist
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OnboardingVideoModal() {
  const globals = window as Window & DashboardGlobals;

  return (
    <div className="modal-overlay" id="onboardingVideoModal">
      <div className="modal modal-lg onboarding-video-modal">
        <div className="modal-header">
          <div>
            <span className="onboarding-video-kicker" id="onboardingVideoModalKicker">Guia da etapa</span>
            <h3 className="modal-title" id="onboardingVideoModalTitle">Conecte seu WhatsApp</h3>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={() => globals.closeOnboardingVideoModal?.()}
          >
            {'\u00D7'}
          </button>
        </div>
        <div className="modal-body onboarding-video-modal-body">
          <div className="onboarding-video-modal-frame-wrap">
            <div className="onboarding-video-modal-frame-shell">
              <iframe
                id="onboardingVideoFrame"
                className="onboarding-video-frame"
                title="Guia de primeiros passos"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                style={{ display: 'none' }}
              ></iframe>
              <div className="onboarding-video-modal-placeholder" id="onboardingVideoModalPlaceholder">
                <strong id="onboardingVideoModalPlaceholderTitle">Guia indisponível</strong>
                <span id="onboardingVideoModalHint">Não foi possível abrir este guia agora.</span>
              </div>
            </div>
          </div>
          <p className="onboarding-video-modal-note">
            O passo a passo abre em foco para você acompanhar a configuração sem poluir o dashboard.
          </p>
        </div>
        <div className="modal-footer">
          <a
            id="onboardingVideoOpenLink"
            className="btn btn-outline btn-sm"
            href="#/dashboard"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'none' }}
          >
            Abrir em janela separada
          </a>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => globals.closeOnboardingVideoModal?.()}
          >
            Fechar guia
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsCards() {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon primary"><span className="icon icon-user"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="totalLeads">0</div>
          <div className="stat-label">Total de Leads</div>
          <div className="stat-change positive" id="leadsChange">+0%</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon success"><span className="icon icon-check"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="completedLeads">0</div>
          <div className="stat-label">Concluídos</div>
          <div className="stat-change positive" id="completedChange">+0%</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon warning"><span className="icon icon-spark"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="pendingLeads">0</div>
          <div className="stat-label">Em Andamento</div>
          <div className="stat-change negative" id="pendingChange">-0%</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon info"><span className="icon icon-chart-line"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="conversionRate">0.0%</div>
          <div className="stat-label">Conversão</div>
          <div className="stat-change positive" id="conversionChange">+0%</div>
        </div>
      </div>
    </div>
  );
}

function Funnel() {
  return (
    <div className="funnel-container">
      <div className="funnel-title"><span className="icon icon-funnel icon-sm"></span> Funil de Conversão</div>
      <div className="funnel-stages" id="funnelStages">
        <div className="funnel-stage" data-stage="1">
          <div className="funnel-value" id="funnel1">0</div>
          <div className="funnel-label">Etapa 1</div>
          <div className="funnel-percent">100%</div>
        </div>
        <div className="funnel-arrow">&rarr;</div>
        <div className="funnel-stage" data-stage="2">
          <div className="funnel-value" id="funnel2">0</div>
          <div className="funnel-label">Etapa 2</div>
          <div className="funnel-percent" id="funnel2Percent">0%</div>
        </div>
        <div className="funnel-arrow">&rarr;</div>
        <div className="funnel-stage" data-stage="3">
          <div className="funnel-value" id="funnel3">0</div>
          <div className="funnel-label">Etapa 3</div>
          <div className="funnel-percent" id="funnel3Percent">0%</div>
        </div>
        <div className="funnel-arrow">&rarr;</div>
        <div className="funnel-stage" data-stage="4">
          <div className="funnel-value" id="funnel4">0</div>
          <div className="funnel-label">Concluído</div>
          <div className="funnel-percent" id="funnel4Percent">0%</div>
        </div>
      </div>
    </div>
  );
}

function LeadsTable() {
  const globals = window as Window & DashboardGlobals;

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-title"><span className="icon icon-contacts icon-sm"></span> Leads Recentes</div>
        <div className="table-filters contacts-table-filters">
          <div className="search-box contacts-search-box">
            <span className="search-icon icon icon-search icon-sm"></span>
            <input
              type="text"
              id="searchLeads"
              placeholder="Buscar..."
              onKeyUp={() => globals.filterLeads?.()}
            />
          </div>
          <select
            className="form-select contacts-filter-select"
            id="filterStatus"
            onChange={() => globals.filterLeads?.()}
          >
            <option value="">Todos os Status</option>
            <option value="1">Novo</option>
            <option value="2">Em Andamento</option>
            <option value="3">Concluído</option>
            <option value="4">Perdido</option>
          </select>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>
                <label className="checkbox-wrapper">
                  <input type="checkbox" id="selectAll" onChange={() => globals.toggleSelectAll?.()} />
                  <span className="checkbox-custom"></span>
                </label>
              </th>
              <th>Contato</th>
              <th>WhatsApp</th>
              <th>Status</th>
              <th>Tags</th>
              <th>Última Interação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="leadsTableBody">
            <tr>
              <td colSpan={7} className="table-empty">
                <div className="table-empty-icon icon icon-empty icon-lg"></div>
                <p>Carregando leads...</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadModals() {
  const globals = window as Window & DashboardGlobals;

  return (
    <>
      <div className="modal-overlay" id="importModal">
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-import icon-sm"></span> Importar Leads</h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('importModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Arquivo CSV</label>
              <input type="file" className="form-input" id="importFile" accept=".csv,.txt" />
              <p className="form-help">
                Formato esperado: nome, telefone, veículo, placa (separados por vírgula)
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Ou cole os dados aqui</label>
              <textarea
                className="form-textarea"
                id="importText"
                rows={10}
                placeholder={`nome,telefone,veiculo,placa\nJoão Silva,27999999999,Honda Civic 2020,ABC1234\nMaria Santos,27988888888,Toyota Corolla 2021,XYZ5678`}
              ></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Tag para importação (opcional)</label>
              <input
                type="text"
                className="form-input"
                id="importTag"
                placeholder="Ex: Prioridade, Premium, Indicação"
              />
              <p className="form-help">Aplicada em todos os leads importados.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('importModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.importLeads?.()}>
              Importar
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="addLeadModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Adicionar Lead</h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('addLeadModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <form id="addLeadForm">
              <div className="form-group">
                <label className="form-label required">Nome</label>
                <input type="text" className="form-input" id="leadName" required placeholder="Nome completo" />
              </div>
              <div className="form-group">
                <label className="form-label required">WhatsApp</label>
                <input type="tel" className="form-input" id="leadPhone" required placeholder="27999999999" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Veículo</label>
                  <input type="text" className="form-input" id="leadVehicle" placeholder="Ex: Honda Civic 2020" />
                </div>
                <div className="form-group">
                  <label className="form-label">Placa</label>
                  <input type="text" className="form-input" id="leadPlate" placeholder="ABC1234" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" id="leadEmail" placeholder="email@exemplo.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Status Inicial</label>
                <select className="form-select" id="leadStatus">
                  <option value="1">Novo</option>
                  <option value="2">Em Andamento</option>
                </select>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('addLeadModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.saveLead?.()}>
              Salvar Lead
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="editLeadModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-edit icon-sm"></span> Editar Lead</h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('editLeadModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <form id="editLeadForm">
              <input type="hidden" id="editLeadId" />
              <div className="form-group">
                <label className="form-label required">Nome</label>
                <input type="text" className="form-input" id="editLeadName" required />
              </div>
              <div className="form-group">
                <label className="form-label required">WhatsApp</label>
                <input type="tel" className="form-input" id="editLeadPhone" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Veículo</label>
                  <input type="text" className="form-input" id="editLeadVehicle" />
                </div>
                <div className="form-group">
                  <label className="form-label">Placa</label>
                  <input type="text" className="form-input" id="editLeadPlate" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" id="editLeadEmail" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" id="editLeadStatus">
                  <option value="1">Novo</option>
                  <option value="2">Em Andamento</option>
                  <option value="3">Concluído</option>
                  <option value="4">Perdido</option>
                </select>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('editLeadModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.updateLead?.()}>
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="customEventModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title" id="customEventModalTitle">
              <span className="icon icon-add icon-sm"></span> Novo Evento
            </h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('customEventModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <form id="customEventForm">
              <input type="hidden" id="customEventId" />
              <div className="form-group">
                <label className="form-label required">Nome do evento</label>
                <input type="text" className="form-input" id="customEventName" placeholder="Ex.: Conversa Qualificada" />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição (opcional)</label>
                <textarea
                  className="form-textarea"
                  id="customEventDescription"
                  rows={3}
                  placeholder="Explique quando este evento deve ser disparado"
                ></textarea>
              </div>
              <div className="form-group">
                <label className="checkbox-wrapper" style={{ gap: '8px' }}>
                  <input type="checkbox" id="customEventActive" defaultChecked />
                  <span className="checkbox-custom"></span>
                  Evento ativo
                </label>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('customEventModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.saveCustomEvent?.()}>
              Salvar Evento
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(() =>
    readStoredOnboardingFlag(buildOnboardingDismissedStorageKey())
  );
  const dashboardUserName = readDashboardHeaderUserName();
  const dashboardCurrentDate = formatDashboardHeaderDate();

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/dashboard');

      if (cancelled) return;

      const win = window as Window & DashboardGlobals;
      if (typeof win.initDashboard === 'function') {
        win.initDashboard();
      } else if (typeof (mod as { initDashboard?: () => void }).initDashboard === 'function') {
        (mod as { initDashboard?: () => void }).initDashboard?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & DashboardGlobals;
  const toggleSidebar = () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
  };

  return (
    <div className="dashboard-react">
      <DashboardStyles />
      <button className="mobile-menu-toggle" type="button" onClick={toggleSidebar}>
        {'\u2630'}
      </button>
      <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></Link>
        </div>

        <nav className="sidebar-nav">
                            <div className="nav-section">
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/dashboard" className="nav-link active"><span className="icon icon-dashboard"></span>Painel de Controle</Link></li>
                          <li className="nav-item"><Link to="/contatos" className="nav-link"><span className="icon icon-contacts"></span>Contatos</Link></li>
                          <li className="nav-item"><Link to="/campanhas" className="nav-link"><span className="icon icon-campaigns"></span>Campanhas</Link></li>
                      </ul>
                  </div>

                  <div className="nav-section">
                      <div className="nav-section-title">Conversas</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/inbox" className="nav-link">
                  <span className="icon icon-inbox"></span>
                  Inbox
                  <span className="badge" style={{ display: 'none' }}>0</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Automação</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/automacao" className="nav-link">
                  <span className="icon icon-automation"></span>
                  Automação
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/fluxos" className="nav-link">
                  <span className="icon icon-flows"></span>
                  Fluxos de Conversa
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/funil" className="nav-link">
                  <span className="icon icon-funnel"></span>
                  Funil de Vendas
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Sistema</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/whatsapp" className="nav-link">
                  <span className="icon icon-whatsapp"></span>
                  WhatsApp
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/configuracoes" className="nav-link">
                  <span className="icon icon-settings"></span>
                  Configurações
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="whatsapp-status">
            <span className="status-indicator disconnected"></span>
            <span className="whatsapp-status-text">Desconectado</span>
          </div>
          <button className="btn-logout" type="button" onClick={() => globals.logout?.()}>
            Sair
          </button>
        </div>
      </aside>
      <main className="main-content">
        <DashboardHeader
          currentDate={dashboardCurrentDate}
          headerUserName={dashboardUserName}
          isOnboardingDismissed={isOnboardingDismissed}
          onRestoreOnboarding={() => setIsOnboardingDismissed(false)}
        />
        <OnboardingCard
          isDismissed={isOnboardingDismissed}
          onDismissedChange={setIsOnboardingDismissed}
        />
        <StatsPeriod />
        <AccountHealthCard />
        <StatsCards />
        <Funnel />
      </main>
      <OnboardingVideoModal />
      <LeadModals />
    </div>
  );
}
