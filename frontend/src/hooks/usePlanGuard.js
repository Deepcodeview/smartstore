/**
 * usePlanGuard.js — Plan-based feature access control
 * Starter: Basic detection + email alerts
 * Pro: AI agents + SPC + multi-camera + reports
 * Enterprise: Golden Board + SCADA + company management
 */
import useAppStore from '../store/appStore';

const PLAN_FEATURES = {
  starter: [
    'live-monitor', 'defect-log', 'alerts', 'settings',
  ],
  pro: [
    'live-monitor', 'defect-log', 'alerts', 'settings',
    'multi-camera', 'heatmap', 'active-learning',
    'production', 'production-spc', 'production-shift', 'production-opt',
    'batch-export',
  ],
  enterprise: [
    'live-monitor', 'defect-log', 'alerts', 'settings',
    'multi-camera', 'heatmap', 'active-learning',
    'production', 'production-spc', 'production-shift', 'production-opt',
    'batch-export',
    'golden-board', 'traceability',
    'admin', 'admin-companies', 'admin-usage', 'admin-health',
  ],
  internal: [
    // System admin — all access
    'live-monitor', 'defect-log', 'alerts', 'settings',
    'multi-camera', 'heatmap', 'active-learning',
    'production', 'production-spc', 'production-shift', 'production-opt',
    'batch-export',
    'golden-board', 'traceability',
    'admin', 'admin-companies', 'admin-usage', 'admin-health',
  ],
};

const PLAN_LABELS = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
  internal: 'Internal',
};

export function usePlanGuard() {
  const company = useAppStore(s => s.company);
  const user = useAppStore(s => s.user);
  const plan = (company?.plan || 'starter').toLowerCase();
  const role = user?.role || 'qc_manager';

  const hasAccess = (featureId) => {
    // System admin has access to everything
    if (role === 'system_admin') return true;
    const features = PLAN_FEATURES[plan] || PLAN_FEATURES.starter;
    return features.includes(featureId);
  };

  const isPro = plan === 'pro' || plan === 'enterprise' || plan === 'internal';
  const isEnterprise = plan === 'enterprise' || plan === 'internal';

  const requiredPlan = (featureId) => {
    if (PLAN_FEATURES.starter.includes(featureId)) return 'starter';
    if (PLAN_FEATURES.pro.includes(featureId)) return 'pro';
    return 'enterprise';
  };

  return { plan, hasAccess, isPro, isEnterprise, requiredPlan, planLabel: PLAN_LABELS[plan] || plan };
}

export default usePlanGuard;
