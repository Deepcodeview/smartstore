/**
 * simulation.js — PCB-GUARDIAN Simulation Engine
 *
 * FIX: Each board gets ONE deterministic scan result.
 * - Zone assigned by counter (sequential, not random)
 * - Defects seeded by counter (same board = same result every render)
 * - No "6-times scan illusion"
 *
 * DeepPCB Official YAML:
 *   0: mouse_bite      → MEDIUM   → FLAG
 *   1: spur            → LOW      → LOG
 *   2: missing_hole    → HIGH     → FLAG
 *   3: short           → CRITICAL → REJECT
 *   4: open_circuit    → CRITICAL → REJECT
 *   5: spurious_copper → HIGH     → FLAG
 */

export const DEFECT_CLASSES = {
  0: { name:'mouse_bite',      severity:'MEDIUM',   score:5,  color:'#7C3AED', bgColor:'#F5F3FF', autoAction:'FLAG',   label:'Mouse Bite'      },
  1: { name:'spur',            severity:'LOW',      score:3,  color:'#2563EB', bgColor:'#EFF6FF', autoAction:'LOG',    label:'Spur'            },
  2: { name:'missing_hole',    severity:'HIGH',     score:7,  color:'#D97706', bgColor:'#FFFBEB', autoAction:'FLAG',   label:'Missing Hole'    },
  3: { name:'short',           severity:'CRITICAL', score:10, color:'#DC2626', bgColor:'#FFF5F5', autoAction:'REJECT', label:'Short'           },
  4: { name:'open_circuit',    severity:'CRITICAL', score:10, color:'#DC2626', bgColor:'#FFF5F5', autoAction:'REJECT', label:'Open Circuit'    },
  5: { name:'spurious_copper', severity:'HIGH',     score:6,  color:'#D97706', bgColor:'#FFFBEB', autoAction:'FLAG',   label:'Spurious Copper' },
};

// Single zone per board — "Full Board Scan" because we have 1 camera
// Other labels only shown as sub-analysis steps, not separate scans
export const BOARD_ZONES = ['Full Board Scan'];

// ─── Deterministic seeded random (LCG) ───────────────────────
// Same counter → same board result EVERY time (no illusion of re-scan)
function seededRand(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Decision Rules (single pass, all classes) ───────────────
export function applyDecisionRules(detections, confFlagPct=60, confRejectPct=85) {
  if (!detections.length) return { decision:'APPROVE', lineHalt:false };
  let decision='APPROVE', lineHalt=false;
  for (const d of detections) {
    const cp = d.confidence * 100;
    if (d.severity === 'CRITICAL') {
      if (cp > confRejectPct) { decision='REJECT'; lineHalt=true; break; }
      else if (decision !== 'REJECT') decision='FLAG_FOR_REVIEW';
    } else if (d.severity === 'HIGH') {
      if (decision !== 'REJECT') decision='FLAG_FOR_REVIEW';
    } else if (d.severity === 'MEDIUM') {
      if (cp >= confFlagPct) { if (decision !== 'REJECT') decision='FLAG_FOR_REVIEW'; }
      else if (decision === 'APPROVE') decision='PASS_WITH_LOG';
    } else { // LOW
      if (cp >= confFlagPct) { if (decision !== 'REJECT' && decision !== 'FLAG_FOR_REVIEW') decision='FLAG_FOR_REVIEW'; }
      else if (decision === 'APPROVE') decision='PASS_WITH_LOG';
    }
  }
  return { decision, lineHalt };
}

/**
 * generateInspection — ONE deterministic result per board (fixed by counter seed)
 * No more random() on same board — zone is always "Full Board Scan"
 */
export function generateInspection(counter, confFlagPct=60, confRejectPct=85) {
  const rng     = seededRand(counter * 31337 + 42);
  const boardId = `PCB-${String(10000 + counter).padStart(5,'0')}`;
  const defects = [];

  // 15% boards have defects (realistic: ~85% pass rate)
  if (rng() < 0.15) {
    const n = rng() < 0.25 ? 2 : 1;
    for (let i=0; i<n; i++) {
      const cid  = Math.floor(rng() * 6);
      const conf = parseFloat((0.52 + rng() * 0.46).toFixed(3));
      const cls  = DEFECT_CLASSES[cid];
      const x1   = 10 + rng() * 45;
      const y1   = 10 + rng() * 45;
      defects.push({
        class_id:    cid,
        class_name:  cls.name,
        severity:    cls.severity,
        label:       cls.label,
        confidence:  conf,
        color:       cls.color,
        bgColor:     cls.bgColor,
        auto_action: cls.autoAction,
        bbox: [
          parseFloat(Math.min(x1,82).toFixed(2)),
          parseFloat(Math.min(y1,82).toFixed(2)),
          parseFloat(Math.min(x1+10+rng()*20,92).toFixed(2)),
          parseFloat(Math.min(y1+10+rng()*20,92).toFixed(2)),
        ],
      });
    }
  }

  const { decision, lineHalt } = applyDecisionRules(defects, confFlagPct, confRejectPct);
  const infer_ms = 6 + Math.floor(rng() * 7);

  return {
    board_id:             boardId,
    camera_id:            'CAM-01',
    zone:                 'Full Board Scan',   // FIXED — always 1 scan per board
    decision,
    decision_confidence:  parseFloat((0.80 + rng() * 0.19).toFixed(3)),
    defects_found:        defects,
    total_defects:        defects.length,
    inference_ms:         infer_ms,
    fps:                  24 + Math.floor(rng() * 6),
    line_halt_required:   lineHalt,
    needs_human_review:   decision === 'FLAG_FOR_REVIEW',
    active_learning_saved:decision === 'FLAG_FOR_REVIEW',
    timestamp:            new Date().toISOString(),
    // Production-level metadata
    batch_id:             `BATCH-${String(Math.floor(counter/50)+1).padStart(3,'0')}`,
    shift:                getShift(),
    line_id:              'LINE-A',
    operator_id:          'OP-001',
    golden_board_diff:    defects.length > 0 ? parseFloat((rng()*15+2).toFixed(1)) : 0,
  };
}

function getShift() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14)  return 'Morning';
  if (h >= 14 && h < 22) return 'Afternoon';
  return 'Night';
}

export function generateAlert(inspection) {
  if (!['REJECT','FLAG_FOR_REVIEW'].includes(inspection.decision)) return null;
  const d      = inspection.defects_found[0];
  const isCrit = inspection.decision === 'REJECT';
  const time   = new Date().toLocaleTimeString('en-GB', { hour12:false });
  return {
    id:               `ALT-${Date.now().toString(36).toUpperCase()}`,
    alert_type:       'SINGLE_BOARD',
    severity:         isCrit ? 'CRITICAL' : 'HIGH',
    board_id:         inspection.board_id,
    batch_id:         inspection.batch_id,
    camera_id:        'CAM-01',
    line_id:          inspection.line_id,
    defect_name:      d?.class_name || 'unknown',
    defect_label:     d?.label || 'Unknown',
    defect_severity:  d?.severity || 'UNKNOWN',
    confidence:       d?.confidence || 0,
    decision:         inspection.decision,
    message:          `${isCrit?'🔴':'🟡'} PCB ALERT | ${inspection.board_id} | ${d?.class_name||'defect'} | ${isCrit?'CRITICAL':'HIGH'} | CAM-01 | ${time}`,
    channels:         isCrit ? ['slack','email','sms'] : ['slack','email'],
    escalation_level: 1,
    acknowledged:     false,
    line_halted:      inspection.line_halt_required,
    timestamp:        new Date().toISOString(),
    read:             false,
  };
}

// ─── Production-level stats helpers ──────────────────────────
export function calcDPMO(totalBoards, totalDefects, opps=6) {
  if (!totalBoards) return 0;
  return Math.round((totalDefects/(totalBoards*opps))*1_000_000);
}
export function calcOEE(a=92.4, p=89.1, q=97.2) {
  return parseFloat((a*p*q/10000).toFixed(1));
}
export function sigmaFromDPMO(dpmo) {
  if (dpmo<=3.4)   return '6σ';
  if (dpmo<=233)   return '5σ';
  if (dpmo<=1350)  return '4.5σ';
  if (dpmo<=6210)  return '4σ';
  if (dpmo<=66807) return '3σ';
  return '<3σ';
}
export function calcCpk(ucl, mean, lcl, processMean, sigma) {
  if (!sigma) return 0;
  const cpu = (ucl-processMean)/(3*sigma);
  const cpl = (processMean-lcl)/(3*sigma);
  return parseFloat(Math.min(cpu,cpl).toFixed(2));
}

export const PRODUCTION_LINES = [
  { id:'LINE-A', name:'Line A — SMT',   speed:420, status:'running', oee:87.3, defect_rate:2.1, target:480 },
  { id:'LINE-B', name:'Line B — THT',   speed:310, status:'running', oee:82.1, defect_rate:3.4, target:380 },
  { id:'LINE-C', name:'Line C — Mixed', speed:0,   status:'halted',  oee:0,    defect_rate:0,   target:350 },
  { id:'LINE-D', name:'Line D — QC',    speed:395, status:'running', oee:91.2, defect_rate:1.8, target:420 },
  { id:'LINE-E', name:'Line E — Final', speed:265, status:'running', oee:79.5, defect_rate:4.2, target:320 },
];

export const SUBSCRIPTION_PLANS = [
  {
    id:'starter', name:'Starter', price:'₹11,000', period:'/month', color:'#16a34a', cameras:1, lines:1,
    features:['Agent 1 — Vision Inspector','Agent 2 — Basic Alerts','1 Camera · 1 Line','Basic SPC Charts','Email Support'],
    missing:['Agent 3 — Root Cause (Enterprise)','Agent 4 — Optimizer','SCADA Integration','SMS Alerts','Golden Board Comparison','Traceability QR'],
  },
  {
    id:'pro', name:'Pro', price:'₹38,000', period:'/month', color:'#0057ff', popular:true, cameras:6, lines:5,
    features:['Everything in Starter','Agent 4 — Production Optimizer','Active Learning Retrain','6 Cameras · 5 Lines','OPC-UA / MQTT Integration','Role-based Mobile Alerts','Batch PDF/Excel Reports','Priority Support'],
    missing:['Agent 3 — Root Cause (Enterprise)','SHAP Explainability','Golden Board AI Comparison'],
  },
  {
    id:'enterprise', name:'Enterprise', price:'Custom', period:'pricing', color:'#7c3aed', cameras:'∞', lines:'∞',
    features:['Everything in Pro','Agent 3 — Root Cause Analyst','Golden Board Comparison (AI)','SHAP + GradCAM Explainability','Full SCADA/MES Integration','Traceability QR → Batch Link','Custom Branded Reports','Unlimited Cameras & Lines','Dedicated Support Manager'],
    missing:[],
  },
];
