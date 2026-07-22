import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";
import {
  LayoutDashboard, Users, Lightbulb, Activity, FileBarChart2,
  ShieldCheck, ChevronRight, ChevronDown, ChevronUp,
  DollarSign, AlertTriangle, CheckCircle2, TrendingDown, Sparkles,
  ArrowUpRight, ArrowDownRight, Bell, Search, Play, Pause, Plus, Info, Target, Heart,
  Clock, Zap, UserX, MessageSquare, X, Globe, LogOut, Brain, TrendingUp, Send, FileText, Mail, MessageCircle,
  Upload, Download, Trash2, ChevronLeft, Filter, SortAsc, SortDesc,
  Package, CreditCard, Wifi, WifiOff, Eye, EyeOff, RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useCustomers } from "./useCustomers";
import { useEvents } from "./useEvents";
import { normalizeRow, applyMapping, getCanonicalForRawKey, CANONICAL_FIELDS } from "./normalizeCustomer";

// ─── FORMULAS & CONSTANTS ─────────────────────────────────────────────────────

const STAGES = ["Onboarding", "Engagement", "Retention", "Loyalty"];

const STAGE_STYLE = {
  Onboarding: { bg:"bg-purple-100", text:"text-purple-700", dot:"#8b5cf6", hex:"#8b5cf6" },
  Engagement: { bg:"bg-blue-100",   text:"text-blue-700",   dot:"#3b82f6", hex:"#3b82f6" },
  Retention:  { bg:"bg-amber-100",  text:"text-amber-700",  dot:"#f59e0b", hex:"#f59e0b" },
  Loyalty:    { bg:"bg-emerald-100",text:"text-emerald-700",dot:"#10b981", hex:"#10b981" },
};

const FORMULAS = [
  {
    key: "retention",
    label: "Retention Rate",
    formula: "((E − N) ÷ S) × 100",
    color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200",
    vars: [
      { v: "E", d: "Customers at end of period" },
      { v: "N", d: "New customers acquired during period" },
      { v: "S", d: "Customers at start of period" },
    ],
  },
  {
    key: "churn",
    label: "Churn Rate",
    formula: "(C ÷ S) × 100",
    color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200",
    vars: [
      { v: "C", d: "Customers lost during period" },
      { v: "S", d: "Customers at start of period" },
    ],
  },
  {
    key: "clv",
    label: "Customer Lifetime Value (CLV)",
    formula: "ARPU ÷ Churn Rate",
    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200",
    vars: [
      { v: "ARPU",       d: "Average Revenue per Customer (annual)" },
      { v: "Churn Rate", d: "Expressed as a decimal (e.g. 0.086)" },
    ],
  },
  {
    key: "nps",
    label: "Net Promoter Score (NPS)",
    formula: "% Promoters − % Detractors",
    color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200",
    vars: [
      { v: "Promoters",  d: "Customers who rated 9–10 (loyal advocates)" },
      { v: "Detractors", d: "Customers who rated 0–6 (at-risk complainers)" },
    ],
  },
];

// Global period defaults used in the Dashboard KPIs
const GLOBAL = { S: 850, N: 62, C: 73, ARPU: 2400, promoters: 42, detractors: 18 };

const computeMetrics = ({ S, N, C, ARPU, promoters, detractors }) => {
  const E = S + N - C;
  const retentionRate = S > 0 ? ((E - N) / S) * 100 : 0;
  const churnRate     = S > 0 ? (C / S) * 100 : 0;
  const clv           = churnRate > 0 ? ARPU / (churnRate / 100) : Infinity;
  const nps           = promoters - detractors;
  return { E, retentionRate, churnRate, clv, nps };
};

// ─── DATA ────────────────────────────────────────────────────────────────────
// All customer data is now stored in Firebase Firestore and retrieved live
// via useCustomers(). Computed chart data is derived from that live array.
// ACTION_IMPACTS is kept here as it is used only in the Simulator (no Firebase dep).

const ACTION_IMPACTS = {
  "No Action":                  { churnReduction: 0,    cost: 0      },
  "Discount Offer (20%)":       { churnReduction: 0.15, cost: 4200   },
  "Feature Training Workshop":  { churnReduction: 0.08, cost: 1800   },
  "Account Manager Assigned":   { churnReduction: 0.22, cost: 6500   },
  "Product Roadmap Preview":    { churnReduction: 0.10, cost: 900    },
  "Custom Pricing Negotiation": { churnReduction: 0.28, cost: 12000  },
};


// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmt     = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact",   maximumFractionDigits: 1 }).format(n);
const fmtFull = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// ─── ATOMS ────────────────────────────────────────────────────────────────────

function HealthBadge({ score }) {
  const cls   = score >= 70 ? "bg-emerald-100 text-emerald-700" : score >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  const label = score >= 70 ? "Healthy"   : score >= 50 ? "At Risk"  : "Critical";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

function TierBadge({ tier }) {
  const map = { Enterprise: "bg-blue-100 text-blue-700", Premium: "bg-purple-100 text-purple-700", Basic: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[tier]}`}>{tier}</span>;
}

function StageBadge({ stage }) {
  const s = STAGE_STYLE[stage] ?? {};
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>{stage}</span>;
}

// ─── FORMULA TOOLTIP ─────────────────────────────────────────────────────────
// Hover the ⓘ icon to reveal the full formula + variable definitions

function FormulaTooltip({ formulaKey, side = "top" }) {
  const [open, setOpen] = useState(false);
  const f = FORMULAS.find(x => x.key === formulaKey);
  if (!f) return null;

  return (
    <div className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors flex-shrink-0 ml-1"
        tabIndex={-1}
      >
        <Info size={10} />
      </button>
      {open && (
        <div className={`absolute z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 pointer-events-none
          ${side === "top" ? "bottom-full left-1/2 -translate-x-1/2 mb-2" : "top-full left-0 mt-2"}`}>
          <p className="text-xs font-bold text-gray-800 mb-2">{f.label}</p>
          <div className={`rounded-lg px-3 py-2 font-mono text-xs font-bold ${f.color} ${f.bg} border ${f.border} mb-2`}>{f.formula}</div>
          <div className="space-y-1">
            {f.vars.map(v => (
              <p key={v.v} className="text-xs text-gray-500">
                <span className="font-bold text-gray-700 font-mono">{v.v}</span> = {v.d}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI CARD WITH FORMULA ────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, formulaHint, formulaKey, color, trend, trendUp }) {
  const semanticColors = {
    "retention": { text: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
    "churn":     { text: "text-rose-600", bg: "bg-rose-50 border-rose-100" },
    "clv":       { text: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
    "nps":       { text: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
  };
  const theme = semanticColors[formulaKey] || { text: "text-slate-600", bg: "bg-slate-50 border-slate-200" };

  return (
    <div className="bg-white rounded-md border border-gray-200 p-4 flex flex-col gap-2 hover:border-gray-300 transition-all duration-150">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
          <FormulaTooltip formulaKey={formulaKey} />
        </div>
        <div className={`w-8 h-8 rounded border flex items-center justify-center ${theme.bg}`}>
          <Icon size={14} className={theme.text} />
        </div>
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 tracking-tight">{value}</p>
        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{formulaHint}</p>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-[11px] font-semibold ${trendUp ? "text-rose-600" : "text-emerald-600"}`}>
          {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend}
        </div>
      )}
    </div>
  );
}

// ─── CUSTOMER TIMELINE COMPONENT ───────────────────────────────────────────────────

const HISTORY_TYPE = {
  support:       { color:"#f43f5e", glow:"rgba(244,63,94,0.7)",   icon:AlertTriangle, label:"Support Ticket"  },
  engagement:    { color:"#3b82f6", glow:"rgba(59,130,246,0.7)",  icon:Activity,      label:"Engagement"      },
  nps:           { color:"#8b5cf6", glow:"rgba(139,92,246,0.7)",  icon:Heart,         label:"NPS / CSAT"      },
  expansion:     { color:"#10b981", glow:"rgba(16,185,129,0.7)",  icon:ArrowUpRight,  label:"Expansion"       },
  communication: { color:"#f59e0b", glow:"rgba(245,158,11,0.7)",  icon:MessageSquare, label:"Touchpoint"       },
  churn_signal:  { color:"#ef4444", glow:"rgba(239,68,68,0.85)",  icon:TrendingDown,  label:"Risk Signal"      },
  onboarding:    { color:"#a855f7", glow:"rgba(168,85,247,0.7)",  icon:Play,          label:"Onboarding"      },
  milestone:     { color:"#06b6d4", glow:"rgba(6,182,212,0.7)",   icon:Sparkles,      label:"Milestone"       },
};

function CustomerTimeline({ events }) {
  const [activeKey, setActiveKey] = useState(null);

  // Group events by YYYY-MM, sorted newest first
  const grouped = {};
  const sorted  = [...events].sort((a, b) => new Date(b.date) - new Date(a.date));
  sorted.forEach(ev => {
    const d = new Date(ev.date);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!grouped[ym]) grouped[ym] = {
      ym, year: d.getFullYear(),
      label: d.toLocaleString("default", { month:"short" }),
      events: [],
    };
    grouped[ym].events.push({ ...ev, _d: d });
  });

  const months  = Object.keys(grouped).sort().reverse();
  const topKey  = activeKey ?? months[0];
  let   prevYear = null;

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-850 uppercase tracking-wider">Activity History</h4>
          <p className="text-[10px] text-slate-450 mt-0.5">{events.length} customer touchpoints recorded</p>
        </div>
        {/* Type legend */}
        <div className="flex gap-x-3 gap-y-1.5 flex-wrap">
          {Object.entries(HISTORY_TYPE).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:v.color }} />
              <span className="text-[9px] font-bold text-slate-500 uppercase">{v.label.split("/")[0].trim()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto" style={{ maxHeight:"420px" }}>
        <div className="relative py-4">
          {/* Vertical spine */}
          <div className="absolute top-0 bottom-0 w-px bg-gray-200" style={{ left:"90px" }} />

          {months.map((ym) => {
            const { year, label, events:mEvts } = grouped[ym];
            const showYear = year !== prevYear;
            prevYear = year;
            const isActive = ym === topKey;

            return (
              <div key={ym}>
                {/* Year separator */}
                {showYear && (
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">{year}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}

                {/* Month row */}
                <div className="flex items-start">
                  {/* Left: date label */}
                  <button
                    onClick={() => setActiveKey(ym === topKey ? null : ym)}
                    className="w-[90px] flex-shrink-0 flex items-center justify-end pr-3 pt-2.5 gap-2 cursor-pointer"
                  >
                    <span className={`text-[11px] font-bold transition-colors ${isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
                      {label}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 border transition-colors ${isActive ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"}`} />
                  </button>

                  {/* Events column */}
                  <div className="ml-4 space-y-2 pb-4 flex-1 pr-4">
                    {mEvts.map((ev, ei) => {
                      const cfg = HISTORY_TYPE[ev.type] ?? HISTORY_TYPE.engagement;
                      const Icon = cfg.icon;
                      const dayStr = ev._d.toLocaleString("default", { month:"short", day:"numeric" });
                      return (
                        <div key={ei} className="flex items-start gap-2.5">
                          {/* Event card */}
                          <div className="flex-1 rounded border border-gray-200 bg-white p-3 hover:border-gray-300 transition-colors">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5">
                                <Icon size={10} style={{ color: cfg.color }} />
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">{dayStr}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 leading-snug">{ev.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{ev.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── PROACTIVE HEALTH CENTER DATA TABLE ──────────────────────────────────────

function ProactiveHealthCenter({ customers = [] }) {
  // Generate alerts based on live customer data
  const alerts = customers.map(c => {
    const isOverdue = c.paymentStatus === "Overdue";
    const risk = isOverdue ? "Critical" : c.churnProbability > 70 ? "Critical" : c.churnProbability > 40 ? "At Risk" : "Healthy";
    const category = isOverdue ? "Overdue Payment" : c.isPremiumActive === false ? "Quiet Payer" : "High Churn Risk";
    
    if (risk === "Healthy") return null;
    
    return {
      id: c.firestoreId || c.email,
      name: c.name,
      category,
      rar: parseFloat(c.totalPaid) || 0,
      risk,
      badgeCls: risk === "Critical" ? "text-rose-700 bg-rose-50 border border-rose-100" : "text-amber-700 bg-amber-50 border border-amber-100",
      actionLabel: risk === "Critical" ? "Assign CSM" : "Outreach"
    };
  }).filter(Boolean).sort((a,b) => b.rar - a.rar).slice(0, 5);

  if (alerts.length === 0) return null;

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
          </span>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Proactive Health Alerts</h3>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold ml-1">
            {alerts.length} action items
          </span>
        </div>
        <p className="text-[10px] text-slate-400">Updates live from Firestore</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/50 text-slate-500 border-b border-gray-200 uppercase font-semibold text-[10px]">
              <th className="px-4 py-2 text-left">Customer Name</th>
              <th className="px-4 py-2 text-left">Risk Category</th>
              <th className="px-4 py-2 text-right">Revenue-at-Risk</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {alerts.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-2 font-bold text-slate-900">{row.name}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.badgeCls}`}>
                      {row.risk}
                    </span>
                    <span className="text-[11px] text-slate-600">{row.category}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right font-mono font-bold text-slate-950">
                  {fmtFull(row.rar)}
                </td>
                <td className="px-4 py-2 text-center">
                  <button className="px-2.5 py-1 text-[10px] font-bold bg-white border border-gray-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded transition-colors shadow-sm cursor-pointer">
                    {row.actionLabel}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── METRICS FORMULA GUIDE ────────────────────────────────────────────────────

function FormulaGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target size={15} className="text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">Metrics Formula Guide</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">4 formulas</span>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-6 pb-5 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {FORMULAS.map(f => (
              <div key={f.key} className={`rounded-xl p-4 border ${f.bg} ${f.border}`}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${f.color}`}>{f.label}</p>
                <p className={`font-mono text-sm font-extrabold mb-3 ${f.color}`}>{f.formula}</p>
                <div className="space-y-1">
                  {f.vars.map(v => (
                    <p key={v.v} className="text-xs text-gray-600">
                      <span className="font-mono font-bold text-gray-800">{v.v}</span> — {v.d}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────

const TREND_DATA = [
  { name: "Mon", value: 20 },
  { name: "Tue", value: 25 },
  { name: "Wed", value: 22 },
  { name: "Thu", value: 28 },
  { name: "Fri", value: 30 },
  { name: "Sat", value: 26 },
  { name: "Sun", value: 34 },
];

function DashboardView({ customers = [] }) {
  const S = customers.length || 1;
  const churned = customers.filter(c => (c.churnProbability || 10) > 80).length;
  const ARPU = customers.reduce((sum, c) => sum + (parseFloat(c.packagePrice) || 0), 0) / S || 0;
  
  const avgHealth = customers.reduce((sum, c) => sum + (c.healthScore || 100), 0) / S;
  const avgChurn = customers.reduce((sum, c) => sum + (c.churnProbability || 10), 0) / S;
  const totalRAR = customers.reduce((sum, c) => sum + (c.revenueAtRisk || 0), 0);
  const avgExpansion = customers.reduce((sum, c) => sum + (c.expansionScore || 0), 0) / S;

  const sortedCustomers = [...customers].sort((a, b) => (parseFloat(b.churnProbability) || 0) - (parseFloat(a.churnProbability) || 0)).slice(0, 10);
  
  const stages = { Onboarding: 0, Engagement: 0, Retention: 0, Loyalty: 0 };
  customers.forEach(c => { if(stages[c.stage] !== undefined) stages[c.stage]++; });
  const lifecycleData = Object.keys(stages).map(k => ({ stage: k, count: stages[k] }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Heart} label="Avg Platform Health" value={`${avgHealth.toFixed(0)}/100`} formulaHint={`Based on usage & NPS`} color="bg-gradient-to-br from-blue-600 to-indigo-600" />
        <KpiCard icon={AlertTriangle} label="Avg Churn Probability" value={`${avgChurn.toFixed(1)}%`} formulaHint={`Based on engagement drop-off`} color="bg-gradient-to-br from-rose-500 to-rose-600" />
        <KpiCard icon={TrendingDown} label="Total Revenue at Risk" value={fmt(totalRAR)} formulaHint={`Sum of (MRR * Churn Risk)`} color="bg-gradient-to-br from-amber-500 to-orange-600" />
        <KpiCard icon={Zap} label="Avg Expansion Score" value={`${avgExpansion.toFixed(0)}/100`} formulaHint={`Upsell readiness`} color="bg-gradient-to-br from-emerald-500 to-teal-600" />
      </div>

      <ProactiveHealthCenter customers={customers} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lifecycle Pipeline */}
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Lifecycle Pipeline</h3>
              <p className="text-[10px] text-slate-400">Live distribution of accounts</p>
            </div>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-gray-200">Total: {S}</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lifecycleData} layout="vertical" margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#475569", fontWeight: "bold" }} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 4, background: "#1e293b", color: "#fff", border: "none" }} />
                <Bar dataKey="count" fill="#475569" barSize={12} radius={[0, 2, 2, 0]}>
                  {lifecycleData.map((entry, index) => <Cell key={`cell-${index}`} fill={STAGE_STYLE[entry.stage]?.hex || "#94a3b8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action List */}
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Priority Action List</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Top accounts by churn probability</p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 h-44">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-slate-500 border-b border-gray-200 uppercase font-semibold text-[10px]">
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Stage</th>
                  <th className="px-4 py-2 text-right">Churn %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedCustomers.map((c) => (
                  <tr key={c.firestoreId || c.email} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 font-bold text-slate-900 truncate max-w-[120px]">{c.name}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border
                        ${c.stage === "Retention" ? "bg-amber-50 text-amber-700 border-amber-100" :
                          c.stage === "Engagement" ? "bg-blue-50 text-blue-700 border-blue-100" :
                          c.stage === "Onboarding" ? "bg-purple-50 text-purple-700 border-purple-100" :
                                                     "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
                        {c.stage}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-mono font-bold ${c.churnProbability > 65 ? "text-rose-600" : "text-amber-600"}`}>
                        {c.churnProbability}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <FormulaGuide />
    </div>
  );
}

// ─── CUSTOMER 360 PROFILE ─────────────────────────────────────────────────────

function StageTracker({ stageIdx }) {
  const stages = ["Onboarding", "Engagement", "Retention", "Loyalty"];
  return (
    <div className="flex items-center justify-between w-full relative py-2 select-none">
      {/* Background connector line */}
      <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200 -z-10" />
      
      {stages.map((s, idx) => {
        const isCurrent = idx === stageIdx;
        const isCompleted = idx < stageIdx;
        const color = isCurrent 
          ? "bg-amber-500 text-white ring-4 ring-amber-150 border-amber-600"
          : isCompleted
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-gray-100 text-slate-400 border-gray-250";
        return (
          <div key={s} className="flex flex-col items-center flex-1 relative z-10">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold transition-all duration-200 ${color}`}>
              {isCompleted ? "✓" : idx + 1}
            </div>
            <span className={`text-[10px] font-bold uppercase mt-2 ${isCurrent ? "text-slate-800" : "text-slate-450"}`}>
              {s}
            </span>
            {isCurrent && (
              <span className="text-[9px] font-bold text-amber-700 mt-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Stuck Here
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StageMetricsPanel({ customer }) {
  const { stage, stageMetrics: m } = customer;
  const s = STAGE_STYLE[stage];

  const groups = {
    Onboarding: [
      { label: "Setup Completion",    value: `${m.setupCompletion}%`,    bar: m.setupCompletion, note: "Target: 100%",           warn: m.setupCompletion < 80 },
      { label: "Time to First Value", value: `${m.timeToFirstValue}d`,   bar: null,              note: "Benchmark: ≤7 days",     warn: m.timeToFirstValue > 7  },
      { label: "Support Tickets",     value: m.supportTickets,           bar: null,              note: "High = onboarding friction", warn: m.supportTickets > 2 },
    ],
    Engagement: [
      { label: "Feature Adoption",    value: `${m.featureAdoption}%`,    bar: m.featureAdoption,  note: "Avg for tier: 55%",     warn: m.featureAdoption < 40  },
      { label: "Sessions / Week",     value: `${m.sessionsPerWeek}×`,    bar: null,               note: "Target: ≥3×/week",      warn: m.sessionsPerWeek < 3   },
      { label: "Feature Usage Gap",   value: `${m.featureGap} unused`,   bar: null,               note: "Paid-but-unused features", warn: m.featureGap > 2      },
    ],
    Retention: [
      { label: "NPS Score",           value: (m.npsScore >= 0 ? "+" : "") + m.npsScore, bar: null, note: "Scale: −100 to +100", warn: m.npsScore < 20         },
      { label: "Support CSAT",        value: `${m.supportCsat}/5`,       bar: m.supportCsat * 20, note: "Target: ≥4.0",          warn: m.supportCsat < 3.5     },
      { label: "Usage Consistency",   value: `${m.usageConsistency}%`,   bar: m.usageConsistency, note: "% of expected sessions", warn: m.usageConsistency < 50 },
    ],
    Loyalty: [
      { label: "Expansion Revenue",   value: fmtFull(m.expansionRevenue), bar: null,              note: "Upsells + add-ons YTD", warn: false },
      { label: "Referrals Given",     value: m.referrals,                 bar: null,              note: "New accounts attributed", warn: false },
      { label: "Feedback Submitted",  value: m.feedbackSubmissions,       bar: null,              note: "NPS + product feedback",  warn: false },
    ],
  };

  const metrics = groups[stage] ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.hex }} />
        <p className={`text-xs font-bold uppercase tracking-widest ${s.text}`}>{stage} Stage Metrics</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map(metric => (
          <div key={metric.label} className="bg-white rounded-md p-3 border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400 font-semibold">{metric.label}</p>
              {metric.warn && <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />}
            </div>
            <p className={`text-base font-bold ${s.text} mb-1`}>{metric.value}</p>
            {metric.bar !== null && (
              <div className="w-full bg-gray-100 rounded-full h-1 mb-1">
                <div className="h-1 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, metric.bar)}%`, background: s.hex }} />
              </div>
            )}
            <p className={`text-[10px] ${s.text} opacity-70`}>{metric.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Customer360View({ customers = [], addCustomers, updateCustomer, clearAllCustomers }) {
  const [mapperData, setMapperData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [flippedId, setFlippedId] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  const formatDateTime = (val) => {
    if (!val) return "—";
    const str = String(val).trim();
    if (str.includes(":") || str.includes("T")) {
      const d = new Date(str.replace(" ", "T"));
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        const secs = String(d.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
      }
      return str;
    }
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return `${str} 09:30:00`;
    }
    return str;
  };

  const getCustomerSparkline = (c) => {
    const sessions = parseFloat(c.sessionsPerWeek) || 0;
    const churn = c.churnProbability || 0;
    const health = c.healthScore ?? 100;
    const isDeclining = churn > 50;
    const isGrowing = (c.expansionScore || 0) > 50 || health > 80;

    const weights = isDeclining 
      ? [2.5, 2.0, 1.4, 0.8, 0.3, 0.05] 
      : isGrowing 
        ? [0.4, 0.55, 0.7, 0.82, 0.92, 1.0] 
        : [0.75, 0.8, 0.85, 0.82, 0.9, 1.0];

    return ["W1", "W2", "W3", "W4", "W5", "W6"].map((wk, i) => ({
      week: wk,
      activity: Math.max(0, Math.round(sessions * weights[i])),
      score: Math.min(100, Math.max(10, Math.round(health * (0.5 + weights[i] * 0.5))))
    }));
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json(ws);
      if (rawData.length === 0) return;
      const parsedRows = rawData.map(row => normalizeRow(row));
      const allOthers = new Set();
      parsedRows.forEach(pr => pr.unmappedKeys.forEach(k => allOthers.add(k)));
      if (allOthers.size > 0) {
        setMapperData({ parsedRows, otherCols: Array.from(allOthers), mapping: {} });
      } else {
        addCustomers(parsedRows.map(pr => pr.canonical));
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const confirmMapping = () => {
    if (!mapperData) return;
    const finalData = mapperData.parsedRows.map(pr => applyMapping(pr.canonical, mapperData.mapping));
    addCustomers(finalData);
    setMapperData(null);
  };

  const getInitials = (name = "") => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase() || "CU";
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch =
        !searchQuery ||
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.package && c.package.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;
      if (activeTab === "active") return c.isPremiumActive;
      if (activeTab === "risk") return (c.churnProbability || 0) > 50;
      if (activeTab === "upsell") return (c.expansionScore || 0) > 60;
      return true;
    });
  }, [customers, searchQuery, activeTab]);

  if (mapperData) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Map Unrecognized Columns</h2>
        <p className="text-xs text-slate-500 mb-6">We found columns that don't match our standard format. Map them below or leave as 'Others'.</p>
        <div className="space-y-4 mb-6">
          {mapperData.otherCols.map(col => (
            <div key={col} className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="w-1/3 text-sm font-semibold text-slate-700 bg-white px-2 py-1 border rounded">{col}</span>
              <span>→</span>
              <select className="flex-1 p-2 border rounded text-sm bg-white" value={mapperData.mapping[col] || "__others__"} onChange={(e) => setMapperData(prev => ({...prev, mapping: {...prev.mapping, [col]: e.target.value}}))}>
                <option value="__others__">Keep in 'Others'</option>
                {CANONICAL_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setMapperData(null)} className="px-4 py-2 border rounded text-sm text-slate-600">Cancel</button>
          <button onClick={confirmMapping} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow-sm">Save to Firebase</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Flip card CSS injected inline */}
      <style>{`
        .flip-card { perspective: 1200px; }
        .flip-card-inner { transition: transform 0.6s cubic-bezier(0.4,0.2,0.2,1); transform-style: preserve-3d; position: relative; width: 100%; height: 100%; }
        .flip-card.flipped .flip-card-inner { transform: rotateY(180deg); }
        .flip-card-front, .flip-card-back { backface-visibility: hidden; -webkit-backface-visibility: hidden; position: absolute; inset: 0; border-radius: 14px; overflow: hidden; }
        .flip-card-back { transform: rotateY(180deg); overflow-y: auto; }
      `}</style>

      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-72">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, company, email, plan..." className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: `All (${customers.length})` },
              { id: "active", label: "Active" },
              { id: "risk", label: "High Risk" },
              { id: "upsell", label: "Upsell Ready" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id ? "bg-slate-900 text-white" : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70"}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {customers.length > 0 && (
            <button onClick={async () => { if (window.confirm(`Delete ALL ${customers.length} records?`)) { if (clearAllCustomers) await clearAllCustomers(customers); setFlippedId(null); } }} className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <Trash2 size={13} /> Clear All
            </button>
          )}
          <label className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm">
            <Upload size={13} /> Import CSV/Excel
            <input type="file" accept=".csv, .xlsx" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {/* Customer Card Grid */}
      {filteredCustomers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCustomers.map((c) => {
            const cardId = c.firestoreId || c.customerId || c.email;
            const isFlipped = flippedId === cardId;
            const churnRisk = c.churnProbability || 0;
            const statusLabel = churnRisk > 50 ? "Review due" : c.isPremiumActive ? "Active" : "Onboarding";
            const statusDotColor = churnRisk > 50 ? "bg-rose-500" : c.isPremiumActive ? "bg-emerald-500" : "bg-blue-500";
            const statusTextColor = churnRisk > 50 ? "text-rose-700 bg-rose-50 border-rose-200" : c.isPremiumActive ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-blue-700 bg-blue-50 border-blue-200";
            const sparklineData = getCustomerSparkline(c);
            const chartColor = churnRisk > 50 ? "#f43f5e" : c.isPremiumActive ? "#10b981" : "#3b82f6";

            return (
              <div 
                key={cardId} 
                className={`h-[390px] rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isFlipped 
                    ? "bg-slate-900 border-slate-700 text-white" 
                    : "bg-white/95 backdrop-blur-md border-slate-200/80 text-slate-900"
                }`}
              >
                {!isFlipped ? (
                  /* ── FRONT: AI Analysis Page (Fixed 390px Height) ── */
                  <div className="p-3.5 flex flex-col justify-between h-full">
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs">
                            {getInitials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 truncate">{c.name || c.email}</h3>
                            <p className="text-[9px] text-slate-400 font-medium truncate">{c.jobTitle ? `${c.jobTitle} · ` : ''}{c.company || 'Customer'}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border flex-shrink-0 ${statusTextColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
                          {statusLabel}
                        </span>
                      </div>

                      {/* AI Metrics Display */}
                      <div className="space-y-1.5 my-2 bg-slate-50/90 rounded-xl p-2 border border-slate-100">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Health Score</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: `${c.healthScore ?? 100}%` }} />
                            </div>
                            <span className="font-extrabold text-slate-800">{c.healthScore ?? 100}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Churn Risk</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${churnRisk}%`, background: churnRisk > 50 ? '#f43f5e' : '#10b981' }} />
                            </div>
                            <span className={`font-extrabold ${churnRisk > 50 ? 'text-rose-600' : 'text-emerald-600'}`}>{churnRisk}%</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Revenue at Risk</span>
                          <span className="font-extrabold text-amber-700">RM{Number(c.revenueAtRisk ?? 0).toFixed(2)}</span>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Expansion Score</span>
                          <span className="font-extrabold text-indigo-700">{c.expansionScore ?? 0}/100</span>
                        </div>
                      </div>

                      {/* Mini AI Activity Trend Chart */}
                      <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100 my-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] uppercase font-bold text-slate-400 flex items-center gap-1">
                            <TrendingUp size={10} style={{ color: chartColor }} /> 6-Wk Usage Trajectory
                          </span>
                          <span className="text-[8px] font-bold text-slate-500">{c.sessionsPerWeek || 0} sess/wk</span>
                        </div>
                        <div className="h-14 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                              <defs>
                                <linearGradient id={`grad-${cardId}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.0}/>
                                </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="score" stroke={chartColor} strokeWidth={2} fillOpacity={1} fill={`url(#grad-${cardId})`} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* AI Strategy */}
                      <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-1.5">
                        <p className="text-[8px] uppercase font-bold text-indigo-500">AI Strategy</p>
                        <p className="text-[9px] font-bold text-indigo-900 leading-snug truncate mt-0.5">{c.aiRecommendation || "Monitor Account"}</p>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                      <span className="text-[9px] font-semibold text-slate-400">{c.package || "Level 1"}</span>
                      <button
                        onClick={() => setFlippedId(cardId)}
                        className="flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        Details <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── BACK: Customer Information Page (Fixed 390px Height) ── */
                  <div className="p-3.5 flex flex-col h-full">
                    {/* Back Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-700/80 flex-shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-white/10 text-white font-bold text-[9px] flex items-center justify-center border border-white/20">
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-white truncate">{c.name}</h3>
                          <p className="text-[9px] text-slate-400 truncate">{c.company || c.email}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setFlippedId(null)}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Scrollable Information Body */}
                    <div className="flex-1 overflow-y-auto py-2 space-y-2.5 text-[9px] pr-1">
                      {/* Financials Summary */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5">
                          <span className="text-[8px] text-emerald-400 font-bold uppercase block">MRR</span>
                          <span className="text-xs font-extrabold text-emerald-300">RM{Number(c.packagePrice || 0).toFixed(2)}</span>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-1.5">
                          <span className="text-[8px] text-blue-400 font-bold uppercase block">Total Paid (LTV)</span>
                          <span className="text-xs font-extrabold text-blue-300">RM{Number(c.totalPaid || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* 1. Basic Info */}
                      <div>
                        <p className="text-[8px] uppercase font-bold text-slate-400 mb-1 tracking-wider border-b border-slate-800 pb-0.5">1. Basic Info</p>
                        <div className="space-y-0.5">
                          <div className="flex justify-between"><span className="text-slate-400">Email:</span><span className="text-slate-200 font-medium truncate max-w-[60%]">{c.email || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Phone:</span><span className="text-slate-200 font-medium">{c.phone || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Role:</span><span className="text-slate-200 font-medium">{c.jobTitle || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Industry:</span><span className="text-slate-200 font-medium">{c.industry || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Company Size:</span><span className="text-slate-200 font-medium">{c.companySize || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Country/TZ:</span><span className="text-slate-200 font-medium">{c.country || "-"} {c.timezone ? `(${c.timezone})` : ''}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Join Date:</span><span className="text-slate-200 font-medium">{c.joinDate || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Source:</span><span className="text-slate-200 font-medium">{c.signupSource || "-"}</span></div>
                        </div>
                      </div>

                      {/* 2. Package & Financials */}
                      <div>
                        <p className="text-[8px] uppercase font-bold text-slate-400 mb-1 tracking-wider border-b border-slate-800 pb-0.5">2. Package & Financials</p>
                        <div className="space-y-0.5">
                          <div className="flex justify-between"><span className="text-slate-400">Package Tier:</span><span className="text-slate-200 font-medium">{c.package || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Billing Cycle:</span><span className="text-slate-200 font-medium">{c.billingCycle || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Payment Status:</span><span className={`font-bold ${c.paymentStatus === 'Overdue' ? 'text-rose-400' : 'text-emerald-400'}`}>{c.paymentStatus || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Last Payment:</span><span className="text-slate-200 font-medium">{c.lastPaymentDate || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Payment Method:</span><span className="text-slate-200 font-medium">{c.paymentMethod || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Discount:</span><span className="text-slate-200 font-medium">{c.discountApplied || "None"}</span></div>
                        </div>
                      </div>

                      {/* 3. Product Usage & Activity */}
                      <div>
                        <p className="text-[8px] uppercase font-bold text-slate-400 mb-1 tracking-wider border-b border-slate-800 pb-0.5">3. Product Usage</p>
                        <div className="space-y-0.5">
                          <div className="flex justify-between"><span className="text-slate-400">Last Login Date:</span><span className="text-slate-200 font-semibold">{formatDateTime(c.lastLoginDate)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Login Frequency:</span><span className="text-slate-200 font-medium">{c.loginFrequency || 0}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Sessions / Wk:</span><span className="text-slate-200 font-medium">{c.sessionsPerWeek || 0}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Core Adoption:</span><span className="text-slate-200 font-medium">{c.coreFeatureAdoption ? `${c.coreFeatureAdoption}%` : "-"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Seats (Active/Total):</span><span className="text-slate-200 font-medium">{c.seatsActive || 0} / {c.seatsLicensed || 0}</span></div>
                        </div>
                      </div>

                      {/* 4. Product Feedback */}
                      <div>
                        <p className="text-[8px] uppercase font-bold text-slate-400 mb-1 tracking-wider border-b border-slate-800 pb-0.5">4. Product Feedback</p>
                        <div className="space-y-0.5">
                          <div className="flex justify-between"><span className="text-slate-400">Feature Requests:</span><span className="text-slate-200 font-medium">{c.customFeatureRequests || "None"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Bugs Submitted:</span><span className="text-slate-200 font-medium">{c.bugReportsSubmitted || 0}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Beta Program:</span><span className="text-slate-200 font-medium">{c.betaProgramParticipant ? "Yes" : "No"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Survey Response:</span><span className="text-slate-200 font-medium">{c.surveyResponses || "-"}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Back Footer */}
                    <div className="pt-2 border-t border-slate-700/80 flex-shrink-0">
                      <button 
                        onClick={() => setFlippedId(null)}
                        className="w-full py-1 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-[9px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        ← Back to AI Analysis
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No customer profiles found</h3>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search filter or import an Excel/CSV dataset above.</p>
        </div>
      )}
    </div>
  );
}

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-semibold text-slate-700 mb-0.5">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="font-semibold text-[11px]" style={{ color: p.color }}>
          {p.dataKey.toUpperCase()}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ─── INSIGHTS VIEW ────────────────────────────────────────────────────────────

function InsightsView({ customers = [] }) {
  const [activeSection, setActiveSection] = useState("segmentation");

  const n = customers.length || 1;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const pct = (v, total) => total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
  const avg = (arr, key) => arr.length ? arr.reduce((s,c)=>s+(parseFloat(c[key])||0),0)/arr.length : 0;
  const fRM = v => `RM${Number(v).toFixed(2)}`;
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));

  // ── 1. Customer Segmentation ─────────────────────────────────────────────────
  const segments = useMemo(() => {
    return customers.map(c => {
      const pkg = (c.package || "").toLowerCase();
      const size = (c.companySize || "").toLowerCase();
      const sessions = parseFloat(c.sessionsPerWeek) || 0;
      const adoption = parseFloat(c.coreFeatureAdoption) || 0;
      const churn = c.churnProbability || 0;
      const nps = parseFloat(c.surveyResponses) || 0;
      if (pkg.includes("4") && (size.includes("500") || size.includes("201"))) return { ...c, segment: "Enterprise" };
      if (churn > 50 || adoption < 30) return { ...c, segment: "At-Risk" };
      if ((c.expansionScore||0) > 60 || adoption > 80) return { ...c, segment: "Champion" };
      if (pkg.includes("2") || pkg.includes("3")) return { ...c, segment: "Growth" };
      return { ...c, segment: "SMB" };
    });
  }, [customers]);

  const segCounts = ["Enterprise","Champion","Growth","SMB","At-Risk"].map(s => ({
    name: s, count: segments.filter(c=>c.segment===s).length,
    revenue: segments.filter(c=>c.segment===s).reduce((a,c)=>a+(parseFloat(c.packagePrice)||0),0),
    color: {Enterprise:"#3b82f6",Champion:"#10b981",Growth:"#8b5cf6",SMB:"#f59e0b","At-Risk":"#f43f5e"}[s]
  }));
  const totalRevenue = segCounts.reduce((a,s)=>a+s.revenue,0);

  const industryRevenue = Object.entries(customers.reduce((acc,c)=>{
    const k = c.industry||"Unknown";
    acc[k]=(acc[k]||0)+(parseFloat(c.totalPaid)||0);
    return acc;
  },{})).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value}));

  // ── 2. Churn Analysis ────────────────────────────────────────────────────────
  const churnTable = [...customers]
    .map(c => ({
      ...c,
      churnScore: c.churnProbability||0,
      revenueRisk: ((c.churnProbability||0)/100)*(parseFloat(c.packagePrice)||0)
    }))
    .sort((a,b)=>b.churnScore-a.churnScore)
    .slice(0,8);

  const churnByPayment = customers.reduce((acc,c)=>{
    const k = c.paymentStatus||"Unknown";
    acc[k]=(acc[k]||0)+1;
    return acc;
  },{});

  // ── 3. CLV Analysis ──────────────────────────────────────────────────────────
  const clvData = [...customers].map(c => {
    const totalPaid = parseFloat(c.totalPaid)||0;
    const price = parseFloat(c.packagePrice)||0;
    const joinDate = c.joinDate ? new Date(String(c.joinDate).replace(/(\d{4})(\d{2})(\d{2})/,"$1-$2-$3")) : null;
    const monthsActive = joinDate ? Math.max(1,Math.round((Date.now()-joinDate.getTime())/(1000*60*60*24*30))) : 12;
    const predictedCLV = price * Math.max(12, monthsActive * 1.2);
    return { ...c, totalPaid, predictedCLV, monthsActive };
  }).sort((a,b)=>b.totalPaid-a.totalPaid);

  // ── 4. Product Adoption ──────────────────────────────────────────────────────
  const featureCount = customers.reduce((acc,c)=>{
    const f = c.lastFeatureUsed||"Other";
    acc[f]=(acc[f]||0)+1;
    return acc;
  },{});
  const featureData = Object.entries(featureCount).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count,pct:pct(count,n)}));

  const adoptionGroups = [
    { label:">80% Adoption", count: customers.filter(c=>parseFloat(c.coreFeatureAdoption)>80).length, color:"#10b981" },
    { label:"50–80%", count: customers.filter(c=>{const a=parseFloat(c.coreFeatureAdoption);return a>=50&&a<=80;}).length, color:"#3b82f6" },
    { label:"<50% Adoption", count: customers.filter(c=>parseFloat(c.coreFeatureAdoption)<50).length, color:"#f43f5e" },
  ];

  // ── 5. Engagement Score ──────────────────────────────────────────────────────
  const engagementData = [...customers].map(c => {
    const freq = clamp(parseFloat(c.loginFrequency)||0,0,30)/30*100;
    const dur = clamp(parseFloat(c.avgSessionDuration)||0,0,60)/60*100;
    const adopt = parseFloat(c.coreFeatureAdoption)||0;
    const seatsRatio = (parseFloat(c.seatsLicensed)||0)>0
      ? clamp(((parseFloat(c.seatsActive)||0)/(parseFloat(c.seatsLicensed)||1))*100,0,100) : 0;
    const score = Math.round(0.3*freq + 0.3*dur + 0.2*adopt + 0.2*seatsRatio);
    return { ...c, engagementScore: score };
  }).sort((a,b)=>b.engagementScore-a.engagementScore);

  // ── 6. Seat Utilization ──────────────────────────────────────────────────────
  const seatData = [...customers].map(c => {
    const licensed = parseFloat(c.seatsLicensed)||0;
    const active = parseFloat(c.seatsActive)||0;
    const util = licensed>0 ? Math.round((active/licensed)*100) : 0;
    return { ...c, seatsLicensed:licensed, seatsActive:active, seatUtil:util };
  }).filter(c=>c.seatsLicensed>0).sort((a,b)=>b.seatUtil-a.seatUtil);

  // ── 7. Upsell Opportunities ──────────────────────────────────────────────────
  const upsellData = [...customers]
    .map(c=>({ ...c, expansionScore: c.expansionScore||0 }))
    .filter(c=>c.expansionScore>50)
    .sort((a,b)=>b.expansionScore-a.expansionScore)
    .slice(0,8);

  // ── 8. NPS / Satisfaction ────────────────────────────────────────────────────
  const promoters = customers.filter(c=>parseFloat(c.surveyResponses||0)>=80).length;
  const passives  = customers.filter(c=>{const s=parseFloat(c.surveyResponses||0);return s>=60&&s<80;}).length;
  const detractors = customers.filter(c=>parseFloat(c.surveyResponses||0)<60).length;
  const npsScore = Math.round((promoters-detractors)/n*100);
  const npsData = [
    { name:"Promoters (≥80)", value:promoters, color:"#10b981" },
    { name:"Passives (60–79)", value:passives, color:"#f59e0b" },
    { name:"Detractors (<60)", value:detractors, color:"#f43f5e" },
  ];

  // ── 9. Payment Behavior ──────────────────────────────────────────────────────
  const billingData = [
    { name:"Monthly", count: customers.filter(c=>(c.billingCycle||"").toLowerCase().includes("month")).length },
    { name:"Annual",  count: customers.filter(c=>(c.billingCycle||"").toLowerCase().includes("ann")).length },
  ];
  const payMethodData = Object.entries(customers.reduce((acc,c)=>{
    const k=c.paymentMethod||"Unknown"; acc[k]=(acc[k]||0)+1; return acc;
  },{})).map(([name,count])=>({name,count}));
  const overdueByMethod = customers.reduce((acc,c)=>{
    if((c.paymentStatus||"").toLowerCase()==="overdue"){
      const k=c.paymentMethod||"Unknown"; acc[k]=(acc[k]||0)+1;
    }
    return acc;
  },{});

  // ── 10. Marketing Channel ────────────────────────────────────────────────────
  const channelData = Object.entries(customers.reduce((acc,c)=>{
    const k=c.signupSource||"Unknown";
    if(!acc[k]) acc[k]={count:0,revenue:0};
    acc[k].count++;
    acc[k].revenue+=(parseFloat(c.totalPaid)||0);
    return acc;
  },{})).map(([name,v])=>({name,...v,avgLTV:v.count?v.revenue/v.count:0})).sort((a,b)=>b.avgLTV-a.avgLTV);

  // ── 11. Health Score ─────────────────────────────────────────────────────────
  const healthBreakdown = [...customers].map(c => {
    const usage     = clamp(((parseFloat(c.sessionsPerWeek)||0)/10)*100,0,100);
    const payment   = (c.paymentStatus||"").toLowerCase()==="active"?100:(c.paymentStatus||"").toLowerCase()==="overdue"?40:0;
    const adoption  = clamp(parseFloat(c.coreFeatureAdoption)||0,0,100);
    const satisfaction = clamp((parseFloat(c.surveyResponses)||0),0,100);
    const support   = clamp(100-(parseFloat(c.bugReportsSubmitted)||0)*10,0,100);
    const overall   = Math.round(0.30*usage+0.20*payment+0.20*adoption+0.20*satisfaction+0.10*support);
    return { ...c, hUsage:Math.round(usage), hPayment:Math.round(payment), hAdoption:Math.round(adoption), hSatisfaction:Math.round(satisfaction), hSupport:Math.round(support), overallHealth:overall };
  }).sort((a,b)=>b.overallHealth-a.overallHealth);

  // ── Section meta ─────────────────────────────────────────────────────────────
  const sections = [
    { id:"segmentation", label:"Segmentation" },
    { id:"churn",        label:"Churn" },
    { id:"clv",          label:"CLV" },
    { id:"adoption",     label:"Adoption" },
    { id:"engagement",   label:"Engagement" },
    { id:"seats",        label:"Seat Util." },
    { id:"upsell",       label:"Upsell" },
    { id:"nps",          label:"NPS" },
    { id:"payment",      label:"Payment" },
    { id:"channel",      label:"Channel" },
    { id:"health",       label:"Health" },
  ];

  const COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#f43f5e","#06b6d4","#ec4899","#84cc16"];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50">
      {/* ── Top Nav Header Bar ── */}
      <div className="bg-white border-b border-slate-200 p-2 flex-shrink-0 flex items-center justify-between gap-1.5 w-full shadow-xs">
        {sections.map(s=>(
          <button key={s.id} onClick={()=>setActiveSection(s.id)}
            className={`flex-1 text-center px-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer truncate ${activeSection===s.id?"bg-indigo-600 text-white shadow-xs font-bold border border-indigo-600":"bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"}`}
            title={s.label}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Main Panel ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ════ 1. CUSTOMER SEGMENTATION ════ */}
        {activeSection==="segmentation" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">Customer Segmentation Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">Understand different types of customers and their behavior.</p>
            </div>

            {/* Segment Cards */}
            <div className="grid grid-cols-5 gap-3">
              {segCounts.map(s=>(
                <div key={s.name} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs text-center">
                  <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">{s.name}</p>
                  <p className="text-2xl font-extrabold" style={{color:s.color}}>{s.count}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">RM{Math.round(s.revenue).toLocaleString()}/mo</p>
                  <p className="text-[9px] font-bold text-slate-400">{pct(s.revenue,totalRevenue)}% of MRR</p>
                </div>
              ))}
            </div>

            {/* Revenue by Package & Industry Charts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Revenue by Package Tier</h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie data={Object.entries(customers.reduce((a,c)=>{const k=c.package||"?";a[k]=(a[k]||0)+(parseFloat(c.packagePrice)||0);return a},{})).map(([name,value])=>({name,value}))}
                        cx="35%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value" label={false}>
                        {["Level 1","Level 2","Level 3","Level 4"].map((k,i)=><Cell key={k} fill={COLORS[i]} stroke="none"/>)}
                      </Pie>
                      <Tooltip formatter={v=>[`RM${v.toLocaleString()}`,"MRR"]} contentStyle={{fontSize:"10px",borderRadius:"6px"}}/>
                      <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{fontSize:"11px",paddingLeft:"10px"}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Revenue by Industry (Total Paid)</h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={industryRevenue} layout="vertical" margin={{left:8}}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3}/>
                      <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>`RM${(v/1000).toFixed(0)}K`}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:9}} width={80}/>
                      <Tooltip formatter={v=>[`RM${v.toLocaleString()}`,"Total Paid"]} contentStyle={{fontSize:"10px",borderRadius:"6px"}}/>
                      <Bar dataKey="value" radius={[0,4,4,0]}>
                        {industryRevenue.map((e,i)=><Cell key={e.name} fill={COLORS[i%COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Segment Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-50 border-b"><h3 className="text-xs font-bold text-slate-700">Customer Segment Directory</h3></div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-50 sticky top-0"><tr>{["Customer","Company","Segment","Package","Health","Churn","MRR"].map(h=><th key={h} className="px-3 py-2 text-left font-bold text-slate-500 uppercase text-[9px]">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {segments.map(c=>(
                      <tr key={c.customerId||c.email} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-900">{c.name}</td>
                        <td className="px-3 py-2 text-slate-500">{c.company}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-full text-white text-[9px] font-bold" style={{background:{Enterprise:"#3b82f6",Champion:"#10b981",Growth:"#8b5cf6",SMB:"#f59e0b","At-Risk":"#f43f5e"}[c.segment]}}>{c.segment}</span></td>
                        <td className="px-3 py-2">{c.package}</td>
                        <td className="px-3 py-2 font-mono">{c.healthScore}</td>
                        <td className="px-3 py-2"><span className={`font-bold ${(c.churnProbability||0)>50?"text-rose-600":"text-emerald-600"}`}>{c.churnProbability}%</span></td>
                        <td className="px-3 py-2 font-mono">RM{parseFloat(c.packagePrice||0).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════ 2. CHURN ANALYSIS ════ */}
        {activeSection==="churn" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">Customer Churn Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">Identify customers likely to leave and quantify revenue at risk.</p>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label:"High Churn Risk (>70%)", value: customers.filter(c=>(c.churnProbability||0)>70).length, color:"text-rose-600", bg:"bg-rose-50" },
                { label:"Medium Risk (40–70%)", value: customers.filter(c=>{const r=c.churnProbability||0;return r>=40&&r<=70;}).length, color:"text-amber-600", bg:"bg-amber-50" },
                { label:"Total Revenue at Risk", value:`RM${customers.reduce((a,c)=>a+(c.revenueAtRisk||0),0).toFixed(0)}`, color:"text-rose-700", bg:"bg-rose-50" },
                { label:"Overdue Payments", value: customers.filter(c=>(c.paymentStatus||"").toLowerCase()==="overdue").length, color:"text-orange-600", bg:"bg-orange-50" },
              ].map(k=>(
                <div key={k.label} className={`rounded-xl border border-slate-200 p-3 shadow-xs ${k.bg}`}>
                  <p className="text-[9px] uppercase font-bold text-slate-500">{k.label}</p>
                  <p className={`text-2xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Churn Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-50 border-b"><h3 className="text-xs font-bold text-slate-700">Top Churn Risk — Revenue Impact Priority</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-50 sticky top-0"><tr>{["Customer","Package","MRR","Churn %","Revenue at Risk","Last Login","Payment"].map(h=><th key={h} className="px-3 py-2 text-left font-bold text-slate-500 uppercase text-[9px]">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {churnTable.map(c=>(
                      <tr key={c.customerId||c.email} className="hover:bg-slate-50">
                        <td className="px-3 py-2"><p className="font-bold text-slate-900">{c.name}</p><p className="text-slate-400">{c.company}</p></td>
                        <td className="px-3 py-2">{c.package}</td>
                        <td className="px-3 py-2 font-mono">RM{parseFloat(c.packagePrice||0).toFixed(0)}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${(c.churnProbability||0)>70?"bg-rose-100 text-rose-700":"bg-amber-100 text-amber-700"}`}>{c.churnProbability}%</span></td>
                        <td className="px-3 py-2 font-mono font-bold text-rose-600">RM{(c.revenueRisk||0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-slate-500">{(c.lastLoginDate||"—").toString().slice(0,10)}</td>
                        <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${(c.paymentStatus||"").toLowerCase()==="overdue"?"bg-rose-100 text-rose-700":"bg-emerald-100 text-emerald-700"}`}>{c.paymentStatus||"—"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Churn Risk Distribution Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-700 mb-3">Churn Risk Distribution by Average Score (Company Size)</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(customers.reduce((acc,c)=>{const k=c.companySize||"?";if(!acc[k])acc[k]={total:0,count:0};acc[k].total+=(c.churnProbability||0);acc[k].count++;return acc},{})).map(([name,v])=>({name,avgChurn:Math.round(v.total/v.count)})).sort((a,b)=>b.avgChurn-a.avgChurn)} margin={{left:0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4}/>
                    <XAxis dataKey="name" tick={{fontSize:9}}/>
                    <YAxis domain={[0,100]} tick={{fontSize:9}} tickFormatter={v=>`${v}%`}/>
                    <Tooltip formatter={v=>[`${v}%`,"Avg Churn Risk"]} contentStyle={{fontSize:"10px",borderRadius:"6px"}}/>
                    <Bar dataKey="avgChurn" fill="#f43f5e" radius={[4,4,0,0]}>
                      {customers.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ════ 3. CLV ANALYSIS ════ */}
        {activeSection==="clv" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">💰 Customer Lifetime Value (CLV)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Find the most valuable customers. CLV = Avg Revenue × Expected Customer Lifetime.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:"Total Revenue (All Time)", value:`RM${clvData.reduce((a,c)=>a+c.totalPaid,0).toLocaleString(undefined,{minimumFractionDigits:0})}` },
                { label:"Avg CLV per Customer", value:`RM${Math.round(clvData.reduce((a,c)=>a+c.totalPaid,0)/n).toLocaleString()}` },
                { label:"Avg MRR per Customer", value:`RM${Math.round(customers.reduce((a,c)=>a+(parseFloat(c.packagePrice)||0),0)/n).toLocaleString()}` },
              ].map(k=>(
                <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-400">{k.label}</p>
                  <p className="text-xl font-extrabold text-slate-900 mt-1">{k.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-50 border-b"><h3 className="text-xs font-bold text-slate-700">CLV Ranking — Most Valuable Customers</h3></div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-50 sticky top-0"><tr>{["Rank","Customer","Industry","Package","Total Paid","MRR","Months Active","Value Tier"].map(h=><th key={h} className="px-3 py-2 text-left font-bold text-slate-500 uppercase text-[9px]">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {clvData.map((c,i)=>{
                      const tier = c.totalPaid>80000?"Very High":c.totalPaid>30000?"High":c.totalPaid>10000?"Medium":"Low";
                      const tc = {VeryHigh:"text-emerald-700 bg-emerald-50",High:"text-blue-700 bg-blue-50",Medium:"text-amber-700 bg-amber-50",Low:"text-slate-600 bg-slate-100"}[tier.replace(" ","")]||"bg-slate-100 text-slate-600";
                      return (
                        <tr key={c.customerId||c.email} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-slate-400">#{i+1}</td>
                          <td className="px-3 py-2"><p className="font-bold text-slate-900">{c.name}</p><p className="text-slate-400">{c.company}</p></td>
                          <td className="px-3 py-2 text-slate-500">{c.industry}</td>
                          <td className="px-3 py-2">{c.package}</td>
                          <td className="px-3 py-2 font-mono font-bold text-emerald-700">RM{c.totalPaid.toLocaleString()}</td>
                          <td className="px-3 py-2 font-mono">RM{(parseFloat(c.packagePrice)||0).toFixed(0)}</td>
                          <td className="px-3 py-2">{c.monthsActive}mo</td>
                          <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tc}`}>{tier}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════ 4. PRODUCT ADOPTION ════ */}
        {activeSection==="adoption" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">📊 Product Adoption Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">Understand whether customers actually use the product and which features drive retention.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {adoptionGroups.map(g=>(
                <div key={g.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs text-center">
                  <p className="text-[9px] uppercase font-bold text-slate-400">{g.label}</p>
                  <p className="text-2xl font-extrabold mt-1" style={{color:g.color}}>{g.count}</p>
                  <p className="text-[9px] text-slate-400">{pct(g.count,n)}% of customers</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Most Used Features (by last feature used)</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureData} layout="vertical" margin={{left:4}}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3}/>
                      <XAxis type="number" tick={{fontSize:9}}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:9}} width={90}/>
                      <Tooltip formatter={v=>[v,"Customers"]} contentStyle={{fontSize:"10px",borderRadius:"6px"}}/>
                      <Bar dataKey="count" radius={[0,4,4,0]}>
                        {featureData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Core Feature Adoption vs Churn Risk</h3>
                <div className="h-56 overflow-y-auto space-y-2">
                  {[...customers].sort((a,b)=>(parseFloat(b.coreFeatureAdoption)||0)-(parseFloat(a.coreFeatureAdoption)||0)).slice(0,10).map(c=>{
                    const adopt = parseFloat(c.coreFeatureAdoption)||0;
                    return (
                      <div key={c.customerId||c.email} className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-500 w-20 shrink-0 truncate">{c.name}</span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${adopt}%`,background:adopt>70?"#10b981":adopt>40?"#f59e0b":"#f43f5e"}}/>
                        </div>
                        <span className="text-[9px] font-bold w-8 text-right">{adopt}%</span>
                        <span className={`text-[8px] font-bold w-6 ${(c.churnProbability||0)>50?"text-rose-500":"text-emerald-500"}`}>{c.churnProbability}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Key Insight */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-xs font-bold text-indigo-800">💡 Key Insight</p>
              <p className="text-xs text-indigo-700 mt-1">
                Customers with &gt;70% core feature adoption have an average churn risk of <strong>{Math.round(avg(customers.filter(c=>parseFloat(c.coreFeatureAdoption)>70),"churnProbability"))}%</strong>, 
                vs <strong>{Math.round(avg(customers.filter(c=>parseFloat(c.coreFeatureAdoption)<=50),"churnProbability"))}%</strong> for those with &lt;50% adoption.
                Feature adoption is the single strongest predictor of retention.
              </p>
            </div>
          </div>
        )}

        {/* ════ 5. ENGAGEMENT SCORE ════ */}
        {activeSection==="engagement" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">⚡ Customer Engagement Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">Engagement Score = 0.3×Login Freq + 0.3×Session Duration + 0.2×Feature Adoption + 0.2×Active Seats Ratio</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:"Highly Engaged (≥70)", value:engagementData.filter(c=>c.engagementScore>=70).length, color:"text-emerald-600" },
                { label:"Moderate (40–69)", value:engagementData.filter(c=>c.engagementScore>=40&&c.engagementScore<70).length, color:"text-amber-600" },
                { label:"Inactive (<40)", value:engagementData.filter(c=>c.engagementScore<40).length, color:"text-rose-600" },
              ].map(k=>(
                <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs text-center">
                  <p className="text-[9px] uppercase font-bold text-slate-400">{k.label}</p>
                  <p className={`text-2xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-50 border-b"><h3 className="text-xs font-bold text-slate-700">Engagement Ranking</h3></div>
              <div className="overflow-y-auto max-h-96 divide-y divide-slate-100">
                {engagementData.map((c,i)=>(
                  <div key={c.customerId||c.email} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <span className="text-[9px] font-bold text-slate-400 w-5">#{i+1}</span>
                    <div className="w-24 shrink-0">
                      <p className="text-[10px] font-bold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[9px] text-slate-400 truncate">{c.company}</p>
                    </div>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{width:`${c.engagementScore}%`,background:c.engagementScore>=70?"#10b981":c.engagementScore>=40?"#f59e0b":"#f43f5e"}}/>
                    </div>
                    <span className="text-[10px] font-extrabold w-10 text-right" style={{color:c.engagementScore>=70?"#10b981":c.engagementScore>=40?"#f59e0b":"#f43f5e"}}>{c.engagementScore}</span>
                    <span className="text-[9px] text-slate-400 w-12 text-right">{c.sessionsPerWeek||0} sess/wk</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ 6. SEAT UTILIZATION ════ */}
        {activeSection==="seats" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">💺 Seat Utilization Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">Seat Utilization % = (Active Seats / Licensed Seats) × 100. Drives upsell & training decisions.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:"Full (≥90%)", value:seatData.filter(c=>c.seatUtil>=90).length, color:"text-emerald-600", action:"→ Upsell more seats" },
                { label:"Moderate (50–89%)", value:seatData.filter(c=>c.seatUtil>=50&&c.seatUtil<90).length, color:"text-blue-600", action:"→ Encourage adoption" },
                { label:"Low (<50%)", value:seatData.filter(c=>c.seatUtil<50).length, color:"text-rose-600", action:"→ Training campaign" },
              ].map(k=>(
                <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-400">{k.label}</p>
                  <p className={`text-2xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
                  <p className="text-[9px] text-slate-500 mt-1 font-semibold">{k.action}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-50 border-b"><h3 className="text-xs font-bold text-slate-700">Seat Utilization by Customer</h3></div>
              <div className="overflow-y-auto max-h-96 divide-y divide-slate-100">
                {seatData.map(c=>(
                  <div key={c.customerId||c.email} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <div className="w-28 shrink-0">
                      <p className="text-[10px] font-bold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[9px] text-slate-400">{c.seatsActive}/{c.seatsLicensed} seats</p>
                    </div>
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${c.seatUtil}%`,background:c.seatUtil>=90?"#10b981":c.seatUtil>=50?"#3b82f6":"#f43f5e"}}/>
                    </div>
                    <span className="text-[10px] font-extrabold w-10 text-right">{c.seatUtil}%</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded w-24 text-center ${c.seatUtil>=90?"bg-emerald-100 text-emerald-700":c.seatUtil>=50?"bg-blue-100 text-blue-700":"bg-rose-100 text-rose-700"}`}>
                      {c.seatUtil>=90?"Upsell Ready":c.seatUtil>=50?"Healthy":"Needs Training"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ 7. UPSELL OPPORTUNITIES ════ */}
        {activeSection==="upsell" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">🚀 Upsell Opportunity Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">Expansion Score = Usage + Satisfaction + Company Size + Seat Utilization. High scores = upgrade candidates.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-[9px] uppercase font-bold text-emerald-600">Upsell Candidates (&gt;50 Expansion)</p>
                <p className="text-3xl font-extrabold text-emerald-700">{upsellData.length}</p>
                <p className="text-xs text-emerald-600 mt-1">Est. additional MRR if upgraded: RM{(upsellData.reduce((a,c)=>a+(parseFloat(c.packagePrice)||0)*0.5,0)).toFixed(0)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-[9px] uppercase font-bold text-blue-600">Full Seat Utilization (≥90%)</p>
                <p className="text-3xl font-extrabold text-blue-700">{seatData.filter(c=>c.seatUtil>=90).length}</p>
                <p className="text-xs text-blue-600 mt-1">Recommend expanded seat packages</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-50 border-b"><h3 className="text-xs font-bold text-slate-700">Top Upsell Targets</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-50 sticky top-0"><tr>{["Customer","Company","Package","Expansion Score","Health","Seats Util","Recommendation"].map(h=><th key={h} className="px-3 py-2 text-left font-bold text-slate-500 uppercase text-[9px]">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {upsellData.map(c=>{
                      const seatUtil = (parseFloat(c.seatsLicensed)||0)>0?Math.round(((parseFloat(c.seatsActive)||0)/(parseFloat(c.seatsLicensed)||1))*100):0;
                      return (
                        <tr key={c.customerId||c.email} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-slate-900">{c.name}</td>
                          <td className="px-3 py-2 text-slate-500">{c.company}</td>
                          <td className="px-3 py-2">{c.package}</td>
                          <td className="px-3 py-2"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold text-[9px]">{c.expansionScore}/100</span></td>
                          <td className="px-3 py-2 font-mono">{c.healthScore}</td>
                          <td className="px-3 py-2 font-mono">{seatUtil}%</td>
                          <td className="px-3 py-2 text-indigo-700 font-semibold">{c.aiRecommendation}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════ 8. NPS / SATISFACTION ════ */}
        {activeSection==="nps" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">⭐ Customer Satisfaction & NPS Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">NPS = %Promoters (≥80) − %Detractors (&lt;60). Survey Response Score used as NPS proxy.</p>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-[9px] uppercase font-bold text-emerald-600">Promoters (≥80)</p>
                <p className="text-2xl font-extrabold text-emerald-700">{promoters}</p>
                <p className="text-[9px] text-emerald-600">{pct(promoters,n)}%</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-[9px] uppercase font-bold text-amber-600">Passives (60–79)</p>
                <p className="text-2xl font-extrabold text-amber-700">{passives}</p>
                <p className="text-[9px] text-amber-600">{pct(passives,n)}%</p>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                <p className="text-[9px] uppercase font-bold text-rose-600">Detractors (&lt;60)</p>
                <p className="text-2xl font-extrabold text-rose-700">{detractors}</p>
                <p className="text-[9px] text-rose-600">{pct(detractors,n)}%</p>
              </div>
              <div className={`${npsScore>=50?"bg-emerald-50 border-emerald-300":npsScore>=0?"bg-amber-50 border-amber-300":"bg-rose-50 border-rose-300"} border rounded-xl p-3 text-center`}>
                <p className="text-[9px] uppercase font-bold text-slate-500">NPS Score</p>
                <p className={`text-2xl font-extrabold ${npsScore>=50?"text-emerald-700":npsScore>=0?"text-amber-700":"text-rose-700"}`}>{npsScore}</p>
                <p className="text-[9px] font-bold text-slate-500">{npsScore>=50?"Excellent":npsScore>=0?"Good":"Needs Attention"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">NPS Breakdown</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie data={npsData} cx="35%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value" label={false}>
                        {npsData.map((e,i)=><Cell key={e.name} fill={e.color} stroke="none"/>)}
                      </Pie>
                      <Tooltip contentStyle={{fontSize:"10px",borderRadius:"6px"}}/>
                      <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{fontSize:"11px",paddingLeft:"10px"}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Survey Score Distribution</h3>
                <div className="h-48 overflow-y-auto space-y-1.5">
                  {[...customers].sort((a,b)=>(parseFloat(b.surveyResponses)||0)-(parseFloat(a.surveyResponses)||0)).map(c=>{
                    const s = parseFloat(c.surveyResponses)||0;
                    return (
                      <div key={c.customerId||c.email} className="flex items-center gap-2">
                        <span className="text-[9px] w-24 truncate text-slate-600">{c.name}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${s}%`,background:s>=80?"#10b981":s>=60?"#f59e0b":"#f43f5e"}}/>
                        </div>
                        <span className="text-[9px] font-bold w-6 text-right">{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ 9. PAYMENT BEHAVIOR ════ */}
        {activeSection==="payment" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">💳 Payment Behavior Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">Analyze payment status, methods, and billing cycle behavior.</p>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label:"Active Payments", value:customers.filter(c=>(c.paymentStatus||"").toLowerCase()==="active").length, color:"text-emerald-600" },
                { label:"Overdue", value:customers.filter(c=>(c.paymentStatus||"").toLowerCase()==="overdue").length, color:"text-rose-600" },
                { label:"Cancelled", value:customers.filter(c=>(c.paymentStatus||"").toLowerCase()==="cancelled").length, color:"text-slate-500" },
                { label:"Annual Billing", value:customers.filter(c=>(c.billingCycle||"").toLowerCase().includes("ann")).length, color:"text-blue-600" },
              ].map(k=>(
                <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-xs">
                  <p className="text-[9px] uppercase font-bold text-slate-400">{k.label}</p>
                  <p className={`text-2xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Payment Method Distribution</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie data={payMethodData} cx="35%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="count" label={false}>
                        {payMethodData.map((e,i)=><Cell key={e.name} fill={COLORS[i%COLORS.length]} stroke="none"/>)}
                      </Pie>
                      <Tooltip contentStyle={{fontSize:"10px",borderRadius:"6px"}}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Annual vs Monthly Comparison</h3>
                <div className="space-y-3 mt-4">
                  {billingData.map(b=>(
                    <div key={b.name}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-slate-700">{b.name} Billing</span>
                        <span className="text-slate-500">{b.count} customers ({pct(b.count,n)}%)</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{width:`${pct(b.count,n)}%`}}/>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1">
                        Avg Total Paid: RM{Math.round(avg(customers.filter(c=>(c.billingCycle||"").toLowerCase().includes(b.name.toLowerCase().slice(0,3))),"totalPaid")).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-[9px] font-bold text-amber-700">⚠️ Overdue by Method</p>
                  {Object.entries(overdueByMethod).map(([k,v])=>(
                    <p key={k} className="text-[9px] text-amber-700">{k}: <strong>{v}</strong> overdue ({pct(v,customers.filter(c=>(c.paymentMethod||"")===k).length||1)}%)</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ 10. MARKETING CHANNEL ════ */}
        {activeSection==="channel" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">📣 Marketing Channel Effectiveness</h2>
              <p className="text-xs text-slate-500 mt-0.5">Which acquisition channel produces the highest quality customers by LTV?</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Average LTV by Acquisition Channel</h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={channelData} margin={{left:0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4}/>
                      <XAxis dataKey="name" tick={{fontSize:9}}/>
                      <YAxis tick={{fontSize:9}} tickFormatter={v=>`RM${(v/1000).toFixed(0)}K`}/>
                      <Tooltip formatter={v=>[`RM${v.toLocaleString()}`,"Avg LTV"]} contentStyle={{fontSize:"10px",borderRadius:"6px"}}/>
                      <Bar dataKey="avgLTV" radius={[4,4,0,0]}>
                        {channelData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Channel Summary</h3>
                <div className="overflow-y-auto max-h-52 space-y-2">
                  {channelData.map((c,i)=>(
                    <div key={c.name} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{background:COLORS[i%COLORS.length]}}/>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-800">{c.name}</p>
                        <p className="text-[9px] text-slate-500">{c.count} customers · Total: RM{c.revenue.toLocaleString()}</p>
                      </div>
                      <p className="text-[10px] font-bold text-indigo-700">RM{Math.round(c.avgLTV).toLocaleString()} LTV</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <p className="text-[9px] text-indigo-700 font-semibold">💡 Best channel by avg LTV: <strong>{channelData[0]?.name||"N/A"}</strong> (RM{Math.round(channelData[0]?.avgLTV||0).toLocaleString()})</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-50 border-b"><h3 className="text-xs font-bold text-slate-700">Customers by Acquisition Channel</h3></div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-50 sticky top-0"><tr>{["Customer","Channel","Package","Total Paid","Health","Churn"].map(h=><th key={h} className="px-3 py-2 text-left font-bold text-slate-500 uppercase text-[9px]">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...customers].sort((a,b)=>(parseFloat(b.totalPaid)||0)-(parseFloat(a.totalPaid)||0)).map(c=>(
                      <tr key={c.customerId||c.email} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-900">{c.name}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold">{c.signupSource||"?"}</span></td>
                        <td className="px-3 py-2">{c.package}</td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-700">RM{(parseFloat(c.totalPaid)||0).toLocaleString()}</td>
                        <td className="px-3 py-2 font-mono">{c.healthScore}</td>
                        <td className="px-3 py-2"><span className={`font-bold ${(c.churnProbability||0)>50?"text-rose-600":"text-emerald-600"}`}>{c.churnProbability}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════ 11. HEALTH SCORE DASHBOARD ════ */}
        {activeSection==="health" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">🏥 Customer Health Score Dashboard</h2>
              <p className="text-xs text-slate-500 mt-0.5">Health = 30% Usage + 20% Payment + 20% Adoption + 20% Satisfaction + 10% Support</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:"Healthy (≥70)", value:healthBreakdown.filter(c=>c.overallHealth>=70).length, color:"text-emerald-600", bg:"bg-emerald-50", border:"border-emerald-200" },
                { label:"Moderate (40–69)", value:healthBreakdown.filter(c=>c.overallHealth>=40&&c.overallHealth<70).length, color:"text-amber-600", bg:"bg-amber-50", border:"border-amber-200" },
                { label:"Critical (<40)", value:healthBreakdown.filter(c=>c.overallHealth<40).length, color:"text-rose-600", bg:"bg-rose-50", border:"border-rose-200" },
              ].map(k=>(
                <div key={k.label} className={`${k.bg} ${k.border} border rounded-xl p-3 text-center shadow-xs`}>
                  <p className="text-[9px] uppercase font-bold text-slate-500">{k.label}</p>
                  <p className={`text-2xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {healthBreakdown.map(c=>{
                const h = c.overallHealth;
                const hColor = h>=70?"#10b981":h>=40?"#f59e0b":"#f43f5e";
                return (
                  <div key={c.customerId||c.email} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{c.name} <span className="text-[9px] text-slate-400 font-normal">· {c.company} · {c.package}</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{background:hColor+"20",color:hColor}}>{h>=70?"Healthy":h>=40?"Moderate":"Critical"}</span>
                        <span className="text-sm font-extrabold" style={{color:hColor}}>{h}/100</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { label:"Usage 30%", value:c.hUsage },
                        { label:"Payment 20%", value:c.hPayment },
                        { label:"Adoption 20%", value:c.hAdoption },
                        { label:"Satisfaction 20%", value:c.hSatisfaction },
                        { label:"Support 10%", value:c.hSupport },
                      ].map(f=>(
                        <div key={f.label}>
                          <p className="text-[8px] text-slate-400 font-semibold mb-0.5">{f.label}</p>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{width:`${f.value}%`,background:f.value>=70?"#10b981":f.value>=40?"#f59e0b":"#f43f5e"}}/>
                          </div>
                          <p className="text-[8px] font-bold text-slate-600 mt-0.5">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


function SimulatorView() {
  const [S, setS]               = useState(GLOBAL.S);
  const [N, setN]               = useState(GLOBAL.N);
  const [C, setC]               = useState(GLOBAL.C);
  const [ARPU, setARPU]         = useState(GLOBAL.ARPU);
  const [promoters, setProm]    = useState(GLOBAL.promoters);
  const [detractors, setDet]    = useState(GLOBAL.detractors);
  const [action, setAction]     = useState("No Action");

  const base = computeMetrics({ S, N, C, ARPU, promoters, detractors });
  const { E, retentionRate, churnRate, clv, nps } = base;

  const impact   = ACTION_IMPACTS[action];
  const C_after  = Math.round(C * (1 - impact.churnReduction));
  const withAct  = computeMetrics({ S, N, C: C_after, ARPU, promoters, detractors });

  const overflow = promoters + detractors > 100;

  const fmtPct = v => `${v.toFixed(1)}%`;
  const fmtClv = v => v === Infinity ? "∞" : fmt(v);
  const fmtNps = v => `${v >= 0 ? "+" : ""}${v}`;

  const rows = [
    { label:"Retention Rate", before:retentionRate,  after:withAct.retentionRate, fmtVal:fmtPct, better:"higher" },
    { label:"Churn Rate",     before:churnRate,      after:withAct.churnRate,     fmtVal:fmtPct, better:"lower"  },
    { label:"CLV",            before:clv,            after:withAct.clv,           fmtVal:fmtClv, better:"higher" },
    { label:"NPS",            before:nps,            after:withAct.nps,           fmtVal:fmtNps, better:"higher" },
  ];

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-md p-4 text-white flex items-center gap-4 shadow-sm">
        <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
          <Activity size={15} />
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider">Metrics &amp; Retention Simulator</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Drag the sliders to see Retention Rate, Churn Rate, CLV and NPS recalculate in real-time using the exact formulas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Input Panel ── */}
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5">Interactive Inputs</h3>
          <p className="text-[10px] text-slate-400 mb-4">Drag sliders to model any business period scenario</p>

          <div className="space-y-4">
            {/* Customer counts */}
            <div className="pb-4 border-b border-gray-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Customer Counts</p>
              <div className="space-y-4">
                <SliderRow label="Start Customers"        formulaVar="S" min={50}  max={5000} step={50}  value={S}    onChange={setS}    formatFn={v => v.toLocaleString()} color="#3b82f6" />
                <SliderRow label="New Customers Acquired" formulaVar="N" min={0}   max={500}  step={5}   value={N}    onChange={setN}    formatFn={v => v.toLocaleString()} color="#10b981" />
                <SliderRow label="Customers Lost"         formulaVar="C" min={0}   max={Math.min(S, 300)} step={1} value={Math.min(C, Math.min(S,300))} onChange={setC} formatFn={v => v.toLocaleString()} color="#f43f5e" />
              </div>
              <p className="text-xs text-slate-500 mt-2.5">
                End customers (E) = S + N − C = <span className="font-bold text-slate-800">{E.toLocaleString()}</span>
              </p>
            </div>

            {/* Revenue */}
            <div className="pb-4 border-b border-gray-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Revenue</p>
              <SliderRow label="Avg. Revenue per Customer (ARPU)" formulaVar="$" min={100} max={10000} step={100} value={ARPU} onChange={setARPU} formatFn={v => `$${v.toLocaleString()}`} color="#8b5cf6" />
            </div>

            {/* NPS */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">NPS Survey Results</p>
              {overflow && (
                <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded p-2">
                  <AlertTriangle size={12} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">Promoters + Detractors = <strong>{promoters + detractors}%</strong> (exceeds 100%). Please adjust.</p>
                </div>
              )}
              <div className="space-y-4">
                <SliderRow label="% Promoters (rated 9–10)" formulaVar="P" min={0} max={100} step={1} value={promoters}   onChange={setProm} formatFn={v => `${v}%`} color="#10b981" />
                <SliderRow label="% Detractors (rated 0–6)" formulaVar="D" min={0} max={100} step={1} value={detractors}  onChange={setDet}  formatFn={v => `${v}%`} color="#f43f5e" />
              </div>
              <p className="text-xs text-slate-550 mt-2">
                Passives (rated 7–8): <span className="font-bold text-slate-700">{Math.max(0, 100 - promoters - detractors)}%</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Output Panel ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5">Real-Time Results</h3>
            <p className="text-[10px] text-slate-400 mb-4">Calculated using the exact formulas — hover the ⓘ icons for details</p>
            <div className="grid grid-cols-2 gap-3">
              <MetricOutputCard
                label="Retention Rate" formulaKey="retention"
                value={`${retentionRate.toFixed(1)}%`}
                breakdown={`((${E}−${N})÷${S})×100`}
                colorClass="text-blue-600" bgClass="bg-blue-50/50" borderClass="border-blue-100"
              />
              <MetricOutputCard
                label="Churn Rate" formulaKey="churn"
                value={`${churnRate.toFixed(1)}%`}
                breakdown={`(${C}÷${S})×100`}
                colorClass="text-rose-600" bgClass="bg-rose-50/50" borderClass="border-rose-100"
              />
              <MetricOutputCard
                label="Subscription CLV" formulaKey="clv"
                value={fmtClv(clv)}
                breakdown={`$${ARPU.toLocaleString()}÷${(churnRate/100).toFixed(4)}`}
                colorClass="text-emerald-600" bgClass="bg-emerald-50/50" borderClass="border-emerald-100"
              />
              <MetricOutputCard
                label="NPS Score" formulaKey="nps"
                value={fmtNps(nps)}
                breakdown={`${promoters}%−${detractors}% = ${fmtNps(nps)}`}
                colorClass="text-purple-600" bgClass="bg-purple-50/50" borderClass="border-purple-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Impact ── */}
      <div className="bg-white rounded-md border border-gray-200 p-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5">Action Impact Simulator</h3>
        <p className="text-[10px] text-slate-400 mb-4">Deploy a retention action and model how it reduces customer churn — watch variables update in real time.</p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Selector + impact */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Retention Action</label>
              <select value={action} onChange={e => setAction(e.target.value)}
                className="w-full bg-white border border-gray-350 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition cursor-pointer">
                {Object.keys(ACTION_IMPACTS).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {action !== "No Action" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/30 border border-emerald-100 rounded p-3">
                  <p className="text-[10px] text-emerald-700 font-bold uppercase">Churn Reduction</p>
                  <p className="text-xl font-bold text-emerald-600 mt-0.5">−{(impact.churnReduction * 100).toFixed(0)}%</p>
                  <p className="text-[10px] text-emerald-500 font-mono mt-0.5">C: {C} → {C_after}</p>
                </div>
                <div className="bg-blue-50/30 border border-blue-100 rounded p-3">
                  <p className="text-[10px] text-blue-700 font-bold uppercase">Intervention Cost</p>
                  <p className="text-xl font-bold text-blue-600 mt-0.5">{fmtFull(impact.cost)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Comparison table */}
          <div className="md:col-span-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Before vs. After — All Metrics</p>
            <div className="rounded border border-gray-205 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-205">
                    {["Metric","Without Action","With Action","Δ Change"].map(h => (
                      <th key={h} className={`px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${h === "Metric" ? "text-left" : "text-center"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map(row => {
                    const beforeInf = row.before === Infinity;
                    const afterInf  = row.after  === Infinity;
                    const delta     = (beforeInf || afterInf) ? null : row.after - row.before;
                    const improved  = delta === null ? false : row.better === "higher" ? delta > 0 : delta < 0;
                    return (
                      <tr key={row.label} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-slate-700">{row.label}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500 font-mono">{row.fmtVal(row.before)}</td>
                        <td className="px-3 py-2.5 text-center font-bold font-mono text-blue-600">{row.fmtVal(row.after)}</td>
                        <td className="px-3 py-2.5 text-center font-bold">
                          {delta === null || delta === 0 ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className={improved ? "text-emerald-600" : "text-rose-600"}>
                              {improved ? "▲" : "▼"} {row.fmtVal(Math.abs(delta))}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {action !== "No Action" && (
              <div className="mt-3 bg-slate-900 rounded p-3 flex items-center justify-between gap-4 flex-wrap text-white">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Net Recovery</p>
                  <p className="text-lg font-bold text-emerald-400 mt-0.5">{fmtFull((C - C_after) * ARPU)}</p>
                  <p className="text-[9px] text-slate-500">({C - C_after} customers × ${ARPU.toLocaleString()} ARPU)</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Intervention Cost</p>
                  <p className="text-lg font-bold text-blue-400 mt-0.5">{fmtFull(impact.cost)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">ROI</p>
                  <p className={`text-lg font-bold mt-0.5 ${(C - C_after) * ARPU > impact.cost ? "text-emerald-400" : "text-rose-400"}`}>
                    {impact.cost > 0
                      ? `${((((C - C_after) * ARPU) / impact.cost) * 100).toFixed(0)}%`
                      : "∞"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Retention Strategy Matrix */}
      <RetentionStrategyMatrix />

    </div>
  );
}

// ─── RETENTION STRATEGY MATRIX DATA ─────────────────────────────────────────

const RETENTION_MATRIX = [
  {
    reason: "Sensitive Cancellation (Business Closure)", stage: "Retention", risk: "Critical", riskCls: "bg-rose-100 text-rose-700",
    icon: "🚪",
    action: "Empathetic Offboarding (Issue refund, cancel gracefully)",
    tactic: "Process partial refunds immediately, suppress automated win-back outreach, and route key accounts to senior leadership.",
    outcome: "+32% future reactivation", urgency: "Immediate",
  },
  {
    reason: "Involuntary / Failed Payment", stage: "Engagement", risk: "High", riskCls: "bg-rose-100 text-rose-700",
    icon: "💳",
    action: "Trigger smart retry/dunning sequence",
    tactic: "Implement machine learning-optimized retries based on decline codes and provide customized in-app payment updates.",
    outcome: "78% recovery success", urgency: "Same day",
  },
  {
    reason: "Disengagement / Value Forgetting", stage: "Engagement", risk: "High", riskCls: "bg-rose-100 text-rose-700",
    icon: "💤",
    action: "Send Personalized 'Year-in-Review' Value Digest",
    tactic: "Generate automated, Spotify-style value digest detailing accumulated ROI metrics, active users, and efficiency gains.",
    outcome: "+26% user activity rise", urgency: "Within 48h",
  },
  {
    reason: "Loyal / High Usage", stage: "Loyalty", risk: "Low", riskCls: "bg-emerald-100 text-emerald-700",
    icon: "🌟",
    action: "Send VIP Reward / Surprise Perk",
    tactic: "Offer complimentary early feature access, personal executive roundtable invitations, and loyalty credits.",
    outcome: "+15% expansion revenue", urgency: "Ongoing",
  },
];

// ─── RETENTION STRATEGY MATRIX COMPONENT ─────────────────────────────────────

function RetentionStrategyMatrix() {
  const [filter, setFilter] = useState("All");
  const stages = ["All", ...STAGES, "All Stages"];
  const uniqueStages = ["All", "Onboarding", "Engagement", "Retention", "Loyalty"];

  const filtered = filter === "All"
    ? RETENTION_MATRIX
    : RETENTION_MATRIX.filter(r => r.stage === filter || r.stage === "All");

  const riskOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const sorted = [...filtered].sort((a, b) => (riskOrder[a.risk] ?? 9) - (riskOrder[b.risk] ?? 9));

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Retention Strategy Matrix</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Maps churn reasons & lifecycle stages to proven prescriptive loyalty tactics</p>
        </div>
        {/* Stage filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {uniqueStages.map(s => {
            const style = s === "All" ? { bg:"bg-gray-100", text:"text-gray-600", active:"bg-gray-800 text-white" } : {
              bg: STAGE_STYLE[s]?.bg ?? "bg-gray-100",
              text: STAGE_STYLE[s]?.text ?? "text-gray-600",
              active: "",
            };
            const isActive = filter === s;
            return (
              <button key={s} onClick={() => setFilter(s)}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer uppercase tracking-wider
                  ${isActive
                    ? (s === "All" ? "bg-slate-900 text-white" : `${STAGE_STYLE[s]?.dot ? "" : "bg-slate-700 text-white"}`)  
                    : `${style.bg} ${style.text} hover:opacity-80`}
                `}
                style={isActive && s !== "All" ? { background: STAGE_STYLE[s]?.hex, color: "#fff" } : {}}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/50 border-b border-gray-200">
              {["Churn Reason", "Stage", "Risk", "Prescriptive Action", "Tactic Detail", "Outcome", "Urgency"].map(h => (
                <th key={h} className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-none">{row.icon}</span>
                    <span className="font-bold text-slate-800 whitespace-nowrap">{row.reason}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.stage === "All" ? (
                    <span className="text-slate-400 italic">Any stage</span>
                  ) : (
                    <span className="text-slate-600 font-medium">{row.stage}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${row.riskCls}`}>{row.risk}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-bold text-blue-700 max-w-[200px]">{row.action}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-600 max-w-[260px] leading-relaxed">{row.tactic}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="font-bold text-emerald-600 whitespace-nowrap">{row.outcome}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold whitespace-nowrap ${
                    row.urgency === "Immediate" || row.urgency === "Same day" ? "text-rose-600" :
                    row.urgency === "Ongoing" ? "text-emerald-600" : "text-amber-600"
                  }`}>{row.urgency}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 bg-slate-50 border-t border-gray-200">
        <p className="text-[10px] text-slate-400">✦ Tactics are evidence-based and drawn from SaaS retention research. Outcomes are indicative averages across similar-sized portfolios.</p>
      </div>
    </div>
  );
}

// ─── REPORTS VIEW ────────────────────────────────────────────────────────────

function ReportsView() {
  const complaints = [
    { 
      text: "API Timeout Errors", 
      mentions: 142, 
      trend: "up", 
      severity: "Critical",
      quote: "Gateway times out during bulk CSV imports, taking up to 12s.",
      history: [10, 24, 45, 80, 142]
    },
    { 
      text: "Confusing UI Update", 
      mentions: 89, 
      trend: "up", 
      severity: "Medium",
      quote: "Where did the dunning configuration move? Spent 20 mins looking.",
      history: [5, 12, 35, 60, 89]
    },
    { 
      text: "Billing & Payment Friction", 
      mentions: 68, 
      trend: "down", 
      severity: "High",
      quote: "My card failed twice without any notification, why was I suspended?",
      history: [90, 85, 75, 70, 68]
    },
    { 
      text: "SSO Login Loop Bugs", 
      mentions: 45, 
      trend: "up", 
      severity: "Critical",
      quote: "Users are looped back to credentials page even after Okta authorization succeeds.",
      history: [2, 10, 18, 25, 45]
    },
    { 
      text: "Missing Report CSV Export", 
      mentions: 24, 
      trend: "down", 
      severity: "Low",
      quote: "I need to export cohort charts to PDF/CSV for my exec meetings.",
      history: [40, 38, 30, 25, 24]
    },
  ];

  const competitors = [
    { name: "RivalTech", mentions: 78, percent: 78, arr: 185000, color: "bg-blue-600", driver: "custom contract pricing & integration support" },
    { name: "OmniSync", mentions: 42, percent: 42, arr: 92500, color: "bg-indigo-500", driver: "enterprise white-labeling features" },
    { name: "ChurnFree", mentions: 29, percent: 29, arr: 54200, color: "bg-purple-500", driver: "cheaper entry tier price" },
    { name: "RetainIQ", mentions: 15, percent: 15, arr: 22000, color: "bg-slate-400", driver: "better dashboard automation widgets" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute -right-4 -bottom-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="relative flex items-start gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-inner">
            <Sparkles size={18} />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Voice of Customer NLP Parser</p>
            <h3 className="text-lg font-bold text-white mb-1">
              Top Customer Mentions & Competitor Signals
            </h3>
            <p className="text-xs text-slate-355 leading-relaxed max-w-2xl text-left">
              NLP-driven analysis highlights critical support frustrations and competitive threats extracted from chat tickets, email logs, and cancellation reviews.
            </p>
          </div>
        </div>
      </div>

      {/* Main Two Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Complaint Tracker */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Complaint Tracker</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Top negative trends and friction points</p>
            </div>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full font-mono">Real-time Feed</span>
          </div>

          <div className="p-5 divide-y divide-gray-100 text-left space-y-3.5">
            {complaints.map((item, idx) => (
              <div key={idx} className="pt-3.5 first:pt-0 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-805 flex items-center gap-2">
                      {item.text}
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                        item.severity === "Critical" ? "bg-rose-100 text-rose-700" :
                        item.severity === "High" ? "bg-amber-100 text-amber-700" :
                        item.severity === "Medium" ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {item.severity}
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-405 font-medium">
                      Mentions: <span className="font-bold text-slate-600 font-mono">{item.mentions}</span> tickets this month
                    </p>
                  </div>
                  
                  {/* Trend & Sparkline */}
                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                    <div className="w-16 h-8 hidden sm:block">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={item.history.map(val => ({ val }))} margin={{ top: 2, bottom: 2 }}>
                          <Line type="monotone" dataKey="val" stroke={item.trend === "up" ? "#ef4444" : "#10b981"} strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-extrabold font-mono flex items-center gap-0.5 ${
                        item.trend === "up" ? "text-rose-650" : "text-emerald-650"
                      }`}>
                        {item.trend === "up" ? "↗" : "↘"}
                        {item.trend === "up" ? "Increasing" : "Decreasing"}
                      </span>
                      <div className="flex gap-2 items-center">
                        <button className="text-[9px] font-bold text-slate-500 hover:text-slate-800 hover:underline transition-all cursor-pointer">
                          Analyze Trend
                        </button>
                        <button className="text-[9px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded transition-all cursor-pointer font-semibold">
                          Route
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-450 italic bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-relaxed">
                  "{item.quote}"
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Competitor Radar (Threat Matrix) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Competitor Radar (Threat Matrix)</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Competitors mentioned in cancellation communications</p>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2.5 py-0.5 rounded font-mono">30-day Window</span>
          </div>

          <div className="p-5 space-y-6 text-left">
            {competitors.map((item, idx) => (
              <div key={idx} className="space-y-2 border-b border-slate-105 pb-4 last:border-b-0 last:pb-0">
                <div className="flex justify-between items-end text-xs">
                  <span className="font-bold text-slate-805">{item.name}</span>
                  <span className="text-[10px] text-slate-550 font-medium">
                    Mentions: <span className="font-bold text-slate-700 font-mono">{item.mentions}</span>
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-[10px] text-slate-405 font-medium">
                  <span>Primary Driver: <strong className="text-slate-600 font-semibold">{item.driver}</strong></span>
                  <span className="font-extrabold text-rose-600 font-mono">${item.arr.toLocaleString()} ARR</span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                  <div className={`h-full rounded-full transition-all duration-500 ${item.color}`} style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}

            <div className="bg-blue-55/40 border border-blue-100 rounded-lg p-3.5 text-[10px] text-slate-650 leading-relaxed text-left flex items-start gap-2.5 mt-2">
              <span className="text-blue-500 font-bold">💡</span>
              <p>
                <strong>Competitive Threat Alert:</strong> Mentions of <strong className="text-slate-800">RivalTech</strong> have increased by 22% compared to last month. Most users indicate RivalTech's custom pricing campaigns as their primary migration driver.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ACTIONS VIEW ────────────────────────────────────────────────────────────

function ActionsView({ resolvedTasks = [], setResolvedTasks, pics, setPics }) {
  const [boardData, setBoardData] = useState({
    product: [
      { id: "p1", title: "Fix API timeout bug affecting 12 accounts", priority: "Critical", impact: "High", rar: 122000, dept: "Product & Engineering Queue", system: "Jira" },
      { id: "p2", title: "Resolve SSO login loop for Enterprise clients", priority: "High", impact: "Medium", rar: 85000, dept: "Product & Engineering Queue", system: "Jira" },
    ],
    sales: [
      { id: "s1", title: "Generate counter-offer campaign for RivalTech move", priority: "High", impact: "High", rar: 69000, dept: "Sales & Marketing Queue", system: "Salesforce" },
      { id: "s2", title: "Setup onboarding pricing revisions", priority: "Medium", impact: "Low", rar: 29000, dept: "Sales & Marketing Queue", system: "Salesforce" },
    ],
    cs: [
      { id: "c1", title: "Schedule manual check-ins with top 5 Enterprise", priority: "Critical", impact: "High", rar: 150000, dept: "Customer Success Queue", system: "Customer Success" },
      { id: "c2", title: "Conduct QBR for Emma Harrison's team", priority: "Medium", impact: "Medium", rar: 41000, dept: "Customer Success Queue", system: "Customer Success" },
    ],
    waiting: []
  });

  const [managingDept, setManagingDept] = useState(null);
  const [editUsers, setEditUsers] = useState([]);

  const [toast, setToast] = useState(null);
  const [selectedBriefTask, setSelectedBriefTask] = useState(null);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [selectedPicIndex, setSelectedPicIndex] = useState(0);

  useEffect(() => {
    if (selectedBriefTask) {
      setSelectedIntegration(null);
      setSelectedPicIndex(0);
    }
  }, [selectedBriefTask]);

  useEffect(() => {
    if (managingDept && pics[managingDept]) {
      setEditUsers(JSON.parse(JSON.stringify(pics[managingDept])));
    }
  }, [managingDept, pics]);

  const getActiveUsers = () => {
    if (!selectedBriefTask) return [];
    if (selectedBriefTask.dept.includes("Product")) return pics.product || [];
    if (selectedBriefTask.dept.includes("Sales")) return pics.sales || [];
    return pics.cs || [];
  };

  const activeUsers = getActiveUsers();
  const currentPic = activeUsers[selectedPicIndex] || activeUsers[0] || { name: "Unassigned", role: "Team Lead", contact: "", email: "" };

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = (task, destSystem, name, role) => {
    if (!task) return;
    setBoardData(prev => {
      const newBoard = { ...prev };
      let foundTask = null;
      for (const colKey of ["product", "sales", "cs"]) {
        const idx = newBoard[colKey].findIndex(t => t.id === task.id);
        if (idx !== -1) {
          foundTask = { ...newBoard[colKey][idx] };
          newBoard[colKey] = newBoard[colKey].filter(t => t.id !== task.id);
          break;
        }
      }
      if (foundTask) {
        const updatedTask = {
          ...foundTask,
          sentTo: name,
          sentRole: role,
          sentApp: destSystem,
          sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: "Pending Response"
        };
        newBoard.waiting = [...newBoard.waiting, updatedTask];
      }
      return newBoard;
    });
    triggerToast(`⚡ Shared brief via ${destSystem} to PIC: ${name} (${role})`);
    setSelectedBriefTask(null);
  };

  const handleResolveTask = (task) => {
    setBoardData(prev => {
      const newBoard = { ...prev };
      newBoard.waiting = newBoard.waiting.filter(t => t.id !== task.id);
      return newBoard;
    });

    const newResolved = {
      id: `res-${Date.now()}`,
      title: task.title,
      dept: task.dept.replace(" Queue", ""),
      pic: task.sentTo,
      resolvedAt: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      rar: task.rar
    };
    setResolvedTasks(prev => [newResolved, ...prev]);
    triggerToast(`✅ Mitigated: preserved $${task.rar.toLocaleString()} ARR!`);
  };

  const handleAddUser = () => {
    setEditUsers(prev => [
      ...prev,
      { id: `u-${Date.now()}-${Math.floor(Math.random()*1000)}`, name: "", role: "", contact: "", email: "" }
    ]);
  };

  const handleRemoveUser = (index) => {
    setEditUsers(prev => prev.filter((_, i) => i !== index));
  };

  const handleUserChange = (index, field, value) => {
    setEditUsers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveUsers = () => {
    const validUsers = editUsers.filter(u => u.name.trim() !== "" || u.role.trim() !== "");
    const finalUsers = validUsers.length > 0 ? validUsers : [{ id: `u-${Date.now()}`, name: "Unassigned PIC", role: "Team Member", contact: "", email: "" }];
    setPics({ ...pics, [managingDept]: finalUsers });
    setManagingDept(null);
    triggerToast(`🟢 Updated routing team for ${managingDept === "product" ? "Product & Engineering" : managingDept === "sales" ? "Sales & Marketing" : "Customer Success"}`);
  };

  // Mock PDF Data based on the selected task
  const getMockPdfDetails = (task) => {
    if (!task) return {};
    
    let diagnosis = "AI-diagnosed retention risks indicate elevated system friction or competitor engagement telemetry.";
    let actionItems = ["Conduct account diagnostics", "Review contact registry"];

    if (task.title.includes("API timeout")) {
      diagnosis = "Valkyrie API gateway telemetry logs report 142 timeout anomalies (HTTP 504 Gateway Timeout) inside client dashboard imports over the last 7 days. Affected accounts: 12 mid-market contracts. Primary root cause: Large payload un-indexed workspace tables.";
      actionItems = [
        "Upgrade database indexes for workspaces payloads",
        "Deploy queue timeout retry buffers to API nodes",
        "Notify key customer success contacts about resolution"
      ];
    } else if (task.title.includes("SSO login loop")) {
      diagnosis = "Okta SSO identity loop triggers redirects on browser credentials. User telemetry indicates users loops between SAML authentication callback and main login page. Affected: Top Tier Enterprise users.";
      actionItems = [
        "Audit SAML redirection assertion callbacks logs",
        "Update Okta integration tokens and renew security certs",
        "Verify browser session cookies timeout persistence configuration"
      ];
    } else if (task.title.includes("counter-offer")) {
      diagnosis = "NLP extraction from cancellation logs signals a 22% surge in RivalTech mentions. Key drivers: RivalTech's custom pricing bundles. Churn probability for this cohort group: 78%. Mid-market portfolio MRR risk: $69,000.";
      actionItems = [
        "Activate automated counter-offer discount campaigns (-15% renewal perks)",
        "Schedule high-touch account calls with renewal executives",
        "Launch competitor pricing positioning collateral in CS help desk"
      ];
    } else if (task.title.includes("pricing revisions")) {
      diagnosis = "Onboarding flow drop-off rate increased. Customer feedback details complexity in billing setup screens and confusing tiered packages configuration.";
      actionItems = [
        "Simplify the tiered pricing registration wizard UI",
        "Establish dunning retry intervals for failing trial cards",
        "Add inline tooltip indicators for billing tiers description"
      ];
    } else if (task.title.includes("manual check-ins")) {
      diagnosis = "Pulsing risk signals detected. Daily active login frequency decreased by 14% this week across top 5 EU Enterprise clients. Health index plummeted below 40/100, which correlates with historical contract terminations.";
      actionItems = [
        "Coordinate manual executive check-in calls within 48 hours",
        "Deliver custom value presentation highlighting system ROI metrics",
        "Propose early pilot access to upcoming automation widgets"
      ];
    } else if (task.title.includes("Conduct QBR")) {
      diagnosis = "Quarterly Business Review is currently 15 days overdue. Client usage pattern is steady but lacks executive sponsorship alignment.";
      actionItems = [
        "Schedule standard executive business review with decision makers",
        "Prepare account value report and product feedback logs",
        "Align client renewal targets with CS expansion plans"
      ];
    }

    return { diagnosis, actionItems };
  };

  const pdfInfo = getMockPdfDetails(selectedBriefTask);

  return (
    <div className="space-y-6 relative">
      {/* Toast Notice */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 animate-bounce text-xs font-semibold select-none">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          {toast}
        </div>
      )}

      {/* Top Header Card */}
      <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute -right-4 -bottom-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="relative flex items-start gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-inner">
            <Activity size={18} />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Action Routing Triage</p>
            <h3 className="text-lg font-bold text-white mb-1">
              Action Routing &amp; Department Briefs
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl text-left">
              Route churn indicators directly to responsible departments. Track critical actions across Product, Sales, and Customer Success queues to resolve revenue risks before contraction.
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
        {/* Column 1: Product & Engineering Queue */}
        <div className="bg-slate-100/60 rounded-xl p-4 border border-gray-200/80 space-y-4">
          <div className="space-y-2 pb-2 border-b border-gray-200 text-left">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Product &amp; Engineering Queue</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-mono">{boardData.product.length} Tasks</span>
            </div>
            {/* Minimalist Profile Card Container */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
              <div className="text-left flex flex-col justify-center">
                <span className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                  {pics.product[0]?.name || "Unassigned"}
                  {pics.product.length > 1 && (
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded font-mono font-semibold">
                      +{pics.product.length - 1} user{pics.product.length > 2 ? 's' : ''}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-normal mt-0.5">{pics.product[0]?.role || "Department Lead"}</span>
              </div>
              <button 
                onClick={() => setManagingDept("product")}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
              >
                Manage Routing
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {boardData.product.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 hover:border-blue-500/50 transition-colors text-left flex flex-col justify-between h-[150px]">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      item.priority === "Critical" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                    }`}>{item.priority}</span>
                    <span className="text-[10px] font-bold text-slate-900 font-mono">${item.rar.toLocaleString()} RAR</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-snug mt-2">{item.title}</p>
                </div>
                <div className="pt-2 border-t border-gray-150">
                  <button 
                    onClick={() => setSelectedBriefTask(item)}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <FileText size={11} />
                    Preview PDF Brief
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Sales & Marketing Queue */}
        <div className="bg-slate-100/60 rounded-xl p-4 border border-gray-200/80 space-y-4">
          <div className="space-y-2 pb-2 border-b border-gray-200 text-left">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Sales &amp; Marketing Queue</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-mono">{boardData.sales.length} Tasks</span>
            </div>
            {/* Minimalist Profile Card Container */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
              <div className="text-left flex flex-col justify-center">
                <span className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                  {pics.sales[0]?.name || "Unassigned"}
                  {pics.sales.length > 1 && (
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded font-mono font-semibold">
                      +{pics.sales.length - 1} user{pics.sales.length > 2 ? 's' : ''}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-normal mt-0.5">{pics.sales[0]?.role || "Department Lead"}</span>
              </div>
              <button 
                onClick={() => setManagingDept("sales")}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
              >
                Manage Routing
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {boardData.sales.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 hover:border-blue-500/50 transition-colors text-left flex flex-col justify-between h-[150px]">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      item.priority === "High" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    }`}>{item.priority}</span>
                    <span className="text-[10px] font-bold text-slate-900 font-mono">${item.rar.toLocaleString()} RAR</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-snug mt-2">{item.title}</p>
                </div>
                <div className="pt-2 border-t border-gray-150">
                  <button 
                    onClick={() => setSelectedBriefTask(item)}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <FileText size={11} />
                    Preview PDF Brief
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Customer Success Queue */}
        <div className="bg-slate-100/60 rounded-xl p-4 border border-gray-200/80 space-y-4">
          <div className="space-y-2 pb-2 border-b border-gray-200 text-left">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Customer Success Queue</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-mono">{boardData.cs.length} Tasks</span>
            </div>
            {/* Minimalist Profile Card Container */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
              <div className="text-left flex flex-col justify-center">
                <span className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                  {pics.cs[0]?.name || "Unassigned"}
                  {pics.cs.length > 1 && (
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded font-mono font-semibold">
                      +{pics.cs.length - 1} user{pics.cs.length > 2 ? 's' : ''}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-normal mt-0.5">{pics.cs[0]?.role || "Department Lead"}</span>
              </div>
              <button 
                onClick={() => setManagingDept("cs")}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
              >
                Manage Routing
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {boardData.cs.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 hover:border-blue-500/50 transition-colors text-left flex flex-col justify-between h-[150px]">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      item.priority === "Critical" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                    }`}>{item.priority}</span>
                    <span className="text-[10px] font-bold text-slate-900 font-mono">${item.rar.toLocaleString()} RAR</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-snug mt-2">{item.title}</p>
                </div>
                <div className="pt-2 border-t border-gray-150">
                  <button 
                    onClick={() => setSelectedBriefTask(item)}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <FileText size={11} />
                    Preview PDF Brief
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 4: Waiting Response Queue */}
        <div className="bg-slate-100/60 rounded-xl p-4 border border-gray-200/80 space-y-4">
          <div className="space-y-2 pb-2 border-b border-gray-200 text-left">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Waiting Response List
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-mono">{boardData.waiting.length} Tasks</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-[10px] text-slate-500 font-medium leading-normal shadow-sm">
              Dispatched briefs awaiting PIC resolution acknowledgment.
            </div>
          </div>
          <div className="space-y-3">
            {boardData.waiting.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-[10px] border-2 border-dashed border-gray-200 rounded-xl bg-white/50 font-mono">
                No active dispatches.
              </div>
            ) : (
              boardData.waiting.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 hover:border-amber-500/50 transition-colors text-left flex flex-col justify-between min-h-[170px]">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-700">
                        {item.priority}
                      </span>
                      <span className="text-[10px] font-bold text-slate-900 font-mono">${item.rar.toLocaleString()} RAR</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 leading-snug mt-2">{item.title}</p>
                    {/* Dispatch metadata details */}
                    <div className="mt-2.5 bg-slate-50 border border-slate-100 rounded-lg p-2 text-[9px] text-slate-500 space-y-1 font-mono leading-relaxed">
                      <p>📢 PIC: <strong className="text-slate-700">{item.sentTo}</strong></p>
                      <p>📲 Channel: <strong className="text-blue-600">{item.sentApp}</strong></p>
                      <p>⏰ Time: <span>{item.sentAt}</span></p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-150">
                    <button 
                      onClick={() => handleResolveTask(item)}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 size={11} />
                      Mark Resolved
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Manage Routing Overlay Modal with Add User Support */}
      {managingDept && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden flex flex-col transition-all transform scale-100 text-slate-800 max-h-[90vh]">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-blue-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider font-mono">
                  Manage Routing: {managingDept === "product" ? "Product & Engineering" : managingDept === "sales" ? "Sales & Marketing" : "Customer Success"}
                </h3>
              </div>
              <button 
                onClick={() => setManagingDept(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 text-left text-xs overflow-y-auto flex-1">
              <p className="text-slate-500 leading-relaxed">
                Configure contact personnel for this department queue. You can add multiple users/workers to receive routed briefs.
              </p>

              {editUsers.map((user, idx) => (
                <div key={user.id || idx} className="bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-3 relative text-left shadow-sm">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider font-mono">
                      User #{idx + 1}
                    </span>
                    {editUsers.length > 1 && (
                      <button
                        onClick={() => handleRemoveUser(idx)}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer transition-colors"
                      >
                        Remove User
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">PIC Name</label>
                      <input
                        type="text"
                        value={user.name}
                        onChange={(e) => handleUserChange(idx, "name", e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-semibold text-xs"
                        placeholder="e.g. Alex Chen"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">PIC Role</label>
                      <input
                        type="text"
                        value={user.role}
                        onChange={(e) => handleUserChange(idx, "role", e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium text-xs"
                        placeholder="e.g. Eng Lead"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Phone / Telegram</label>
                      <input
                        type="text"
                        value={user.contact}
                        onChange={(e) => handleUserChange(idx, "contact", e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-mono text-slate-600 text-xs"
                        placeholder="e.g. +1 (555) 0192"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Email Address</label>
                      <input
                        type="email"
                        value={user.email}
                        onChange={(e) => handleUserChange(idx, "email", e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-mono text-slate-600 text-xs"
                        placeholder="e.g. alex.c@momentum.ai"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add User Button */}
              <button
                onClick={handleAddUser}
                className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 border border-dashed border-blue-300 text-blue-600 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus size={14} />
                + Add User
              </button>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => setManagingDept(null)}
                className="px-4 py-2 border border-gray-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUsers}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-colors shadow-md cursor-pointer"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GORGEOUS PDF MODAL OVERLAY */}
      {selectedBriefTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full border border-slate-700 overflow-hidden flex flex-col h-[85vh] transition-all transform scale-100 text-slate-100">
            {/* Slate PDF Toolbar */}
            <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-rose-500 text-white rounded text-[10px] font-extrabold tracking-wider leading-none shadow-md select-none font-mono">
                  PDF
                </div>
                <span className="text-[11px] font-semibold tracking-wide font-mono truncate max-w-[240px]">
                  Momentum_Brief_{selectedBriefTask.id.toUpperCase()}.pdf
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold select-none">
                <span className="text-[10px] text-slate-400 font-mono">Page 1 of 1</span>
                <span className="h-4 w-px bg-slate-700" />
                <div className="flex gap-2 text-slate-400">
                  <button className="hover:text-white cursor-pointer" title="Zoom Out">-</button>
                  <span className="text-[10px] font-mono">100%</span>
                  <button className="hover:text-white cursor-pointer" title="Zoom In">+</button>
                </div>
                <span className="h-4 w-px bg-slate-700" />
                <button 
                  onClick={() => setSelectedBriefTask(null)}
                  className="hover:text-rose-400 transition-colors p-1 rounded hover:bg-slate-800 cursor-pointer"
                  title="Close PDF Viewer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* simulated paper preview sheet container */}
            <div className="bg-slate-950/40 flex-1 overflow-y-auto p-6 md:p-8 flex justify-center shadow-inner">
              <div className="bg-white shadow-xl w-full max-w-[550px] min-h-[640px] p-8 md:p-10 text-slate-800 flex flex-col text-left space-y-6 border border-gray-300 relative select-text font-serif">
                {/* Paper watermarked line */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900" />

                {/* PDF Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                  <div className="space-y-1">
                    <h1 className="text-sm font-extrabold uppercase tracking-widest text-slate-900 font-mono flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-slate-900 flex items-center justify-center text-white text-[9px] font-bold">M</span>
                      MOMENTUM
                    </h1>
                    <p className="text-[9px] text-slate-400 tracking-wider font-mono">RETENTIVE INTELLIGENCE ENGINE</p>
                  </div>
                  <div className="text-right text-[9px] font-mono text-slate-500 space-y-0.5">
                    <p className="font-bold text-slate-800">REF: BRIEF-{selectedBriefTask.id.toUpperCase()}-2026</p>
                    <p>Generated: 2026-07-22</p>
                    <p>Dispatch: {selectedBriefTask.dept}</p>
                  </div>
                </div>

                {/* Document Title */}
                <div className="space-y-1.5">
                  <span className="text-[8px] font-bold tracking-widest uppercase bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">
                    CHURN ROUTING DISPATCH BRIEF
                  </span>
                  <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                    {selectedBriefTask.title}
                  </h2>
                </div>

                {/* Meta details key value table */}
                <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] font-mono">
                  <div className="space-y-0.5">
                    <p className="text-slate-400">FINANCIAL IMPACT</p>
                    <p className="font-extrabold text-rose-600 text-xs">${selectedBriefTask.rar.toLocaleString()} ARR</p>
                  </div>
                  <div className="space-y-0.5 border-l border-slate-200 pl-3">
                    <p className="text-slate-400">RISK SEVERITY</p>
                    <p className="font-extrabold text-slate-800 text-xs uppercase">{selectedBriefTask.priority}</p>
                  </div>
                  <div className="space-y-0.5 border-l border-slate-200 pl-3">
                    <p className="text-slate-400">TARGET SYSTEM</p>
                    <p className="font-extrabold text-blue-600 text-xs uppercase">{selectedBriefTask.system}</p>
                  </div>
                </div>

                {/* Segment diagnosis */}
                <div className="space-y-2 text-xs">
                  <h3 className="font-bold text-slate-900 tracking-wide font-mono uppercase border-b border-slate-200 pb-1 text-[10px]">
                    1. AI Retention Diagnosis &amp; Telemetry
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-left pl-1 font-sans">
                    {pdfInfo.diagnosis}
                  </p>
                </div>

                {/* Prescriptive action plan */}
                <div className="space-y-2 text-xs">
                  <h3 className="font-bold text-slate-900 tracking-wide font-mono uppercase border-b border-slate-200 pb-1 text-[10px]">
                    2. Mandated Action Items
                  </h3>
                  <ul className="list-decimal list-inside space-y-1.5 pl-1 text-slate-600 font-sans">
                    {pdfInfo.actionItems?.map((item, i) => (
                      <li key={i} className="text-left">
                        <span className="font-semibold text-slate-800">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Disclaimer */}
                <div className="pt-4 border-t border-slate-200 text-[8px] text-slate-400 leading-normal text-left font-mono">
                  This document is auto-compiled from real-time customer health telemetry logs. Approval of this brief will automatically invoke system webhooks to dispatch tickets to the designated queues.
                </div>
              </div>
            </div>

            {/* Share Brief via... section */}
            <div className="bg-slate-900 border-t border-slate-700 p-5 space-y-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  Share Brief via...
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-300 font-medium font-sans">
                  <span>Target Recipient:</span>
                  {activeUsers.length > 1 ? (
                    <select
                      value={selectedPicIndex}
                      onChange={(e) => setSelectedPicIndex(Number(e.target.value))}
                      className="bg-slate-800 border border-slate-700 text-blue-400 font-semibold px-2 py-0.5 rounded focus:outline-none cursor-pointer"
                    >
                      {activeUsers.map((u, i) => (
                        <option key={i} value={i}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  ) : (
                    <strong className="text-blue-400 font-semibold">{currentPic.name} ({currentPic.role})</strong>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-6 py-2">
                {[
                  { id: "whatsapp", name: "WhatsApp", icon: <MessageCircle size={20} />, color: "text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:border-emerald-400 bg-emerald-950/20" },
                  { id: "telegram", name: "Telegram", icon: <Send size={20} />, color: "text-sky-400 hover:text-sky-300 border-sky-500/30 hover:border-sky-400 bg-sky-950/20" },
                  { id: "email", name: "Email", icon: <Mail size={20} />, color: "text-blue-400 hover:text-blue-300 border-blue-500/30 hover:border-blue-400 bg-blue-950/20" },
                  { id: "messenger", name: "Messenger", icon: <MessageSquare size={20} />, color: "text-indigo-400 hover:text-indigo-300 border-indigo-500/30 hover:border-indigo-400 bg-indigo-950/20" },
                ].map((app) => {
                  const isSelected = selectedIntegration === app.id;
                  return (
                    <button
                      key={app.id}
                      onClick={() => setSelectedIntegration(app.id)}
                      title={`Share via ${app.name}`}
                      className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-md ${
                        isSelected 
                          ? "border-blue-500 bg-blue-950 text-blue-400 scale-110 ring-4 ring-blue-500/20 shadow-blue-500/10" 
                          : app.color
                      }`}
                    >
                      {app.icon}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="bg-slate-900 border-t border-slate-700 px-6 py-4 flex justify-between items-center">
              <button 
                onClick={() => setSelectedBriefTask(null)}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300 font-bold rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button 
                disabled={!selectedIntegration}
                onClick={() => {
                  const apps = {
                    whatsapp: "WhatsApp",
                    telegram: "Telegram",
                    email: "Email",
                    messenger: "Messenger",
                  };
                  const selectedApp = apps[selectedIntegration];
                  if (selectedApp) {
                    handleAction(selectedBriefTask, selectedApp, currentPic.name, currentPic.role);
                  }
                }}
                className={`px-6 py-2 font-bold rounded-lg text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 font-semibold ${
                  selectedIntegration
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50"
                }`}
              >
                Approve &amp; Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PLACEHOLDER ──────────────────────────────────────────────────────────────

function PlaceholderView({ title, icon: Icon, description }) {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-3">
      <div className="w-14 h-14 rounded border border-gray-200 bg-slate-50 flex items-center justify-center">
        <Icon size={24} className="text-slate-400" />
      </div>
      <div className="text-center">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-400 mt-1">{description ?? "This section is coming soon."}</p>
      </div>
    </div>
  );
}

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────

const navItems = [
  { id: "dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { id: "customers", label: "Customer 360", icon: Users },
  { id: "insights",   label: "Insights",     icon: Lightbulb       },
  { id: "reports",    label: "Reports",      icon: FileBarChart2   },
  { id: "actions",    label: "Actions",      icon: Activity        },
];

const pageMeta = {
  dashboard:  { title: "Command Center Dashboard", subtitle: "Real-time churn risk command center with formula-backed KPIs" },
  customers:  { title: "Customer 360° Profile",    subtitle: "360° lifecycle tracking for every customer account" },
  insights:   { title: "Segment Insights & Revenue Impact", subtitle: "Cohort Analysis & Segmented Revenue-at-Risk forecasting" },
  reports:    { title: "Voice of Customer & Market Threats", subtitle: "Voice of Customer, NLP complaints tracker, and Competitor threats matrix" },
  actions:    { title: "Action Routing & Department Briefs", subtitle: "Cross-functional routing triage queue and department briefs execution" },
};

// ─── COPILOT CHATBOT WIDGET ───────────────────────────────────────────────────

const COPILOT_RESPONSES = {
  "forecast revenue risk": "I've analyzed the EU segment drop. Churning these 12 accounts would result in $150K ARR contraction. Would you like me to queue the soft-landing playbook to mitigate this?",
  "analyze support sentiment": "Support ticket sentiment analysis reveals high friction under 'API timeout latency' (68% of detractors). Recommend product routing.",
  "draft playbook": "Generated re-engagement sequence containing customized Year-in-Review value recap and meeting scheduling links for EU customers.",
  "how is risk calculated?": "Momentum calculates risk by combining usage consistency (sessions per week), support CSAT scores, open support tickets, and sentiment analysis from transcript text to generate a consolidated health index (0-100).",
  "what playbooks are supported?": "We support pre-built playbooks including 'Soft Landing' downgrades/pauses, automated dunning retries, Spotify-style value recaps, and empathetic offboarding for business closures.",
  "how do crm syncs work?": "Momentum syncs natively with CRM and billing providers (Salesforce, HubSpot, Stripe) using secure APIs. We ingest billing statuses and usage data to flag account anomalies.",
  "how is risk calculated": "Momentum calculates risk by combining usage consistency (sessions per week), support CSAT scores, open support tickets, and sentiment analysis from transcript text to generate a consolidated health index (0-100).",
  "what playbooks are available": "We support pre-built playbooks including 'Soft Landing' downgrades/pauses, automated dunning retries, Spotify-style value recap digests, and empathetic offboarding for business closures.",
  "how do crm syncs work": "Momentum syncs natively with CRM and billing providers (Salesforce, HubSpot, Stripe) using secure APIs. We ingest billing statuses and usage data to flag account anomalies.",
  "how do i prevent failed payments?": "Involuntary churn is intercepted by our Smart Dunning playbook, which triggers smart payment retries and coordinates profile updates before accounts are canceled."
};

function GuardyChatWidget({ isOpen, onClose, onOpen }) {
  const [messages, setMessages] = useState([
    { 
      sender: "copilot", 
      text: "I've detected a 14% drop in login frequency among Enterprise users in the EU this week. Would you like me to draft a re-engagement sequence or forecast the ARR impact?" 
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleSend = (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { sender: "user", text }]);
    if (!textToSend) setInput("");
    setIsTyping(true);

    // AI Response Simulation
    setTimeout(() => {
      setIsTyping(false);
      const cleanText = text.toLowerCase().trim();
      let reply = "I can assist with that. Momentum's AI engine helps you analyze revenue risk, evaluate support sentiment, and draft proactive client playbook alerts. Let me know if you would like me to trigger a specific operation!";
      
      // Match keywords
      for (const [key, val] of Object.entries(COPILOT_RESPONSES)) {
        if (cleanText.includes(key) || key.includes(cleanText)) {
          reply = val;
          break;
        }
      }
      setMessages(prev => [...prev, { sender: "copilot", text: reply }]);
    }, 1000);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onOpen}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 z-50 group"
      >
        <div className="relative">
          <MessageSquare size={22} />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 h-[460px] bg-white rounded-xl border border-gray-200 shadow-2xl z-50 flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-slate-900 p-3.5 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
            <Sparkles size={16} className="stroke-[2.5]" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-extrabold tracking-tight">Momentum AI Copilot</h4>
            <p className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Online
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer transition-colors p-1">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed text-left ${
              m.sender === "user" 
                ? "bg-blue-600 text-white font-medium" 
                : "bg-white border border-gray-200 text-slate-850 shadow-sm"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-slate-400 text-xs shadow-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      <div className="px-3 py-2 border-t border-gray-105 bg-white flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
        {["Forecast Revenue Risk", "Analyze Support Sentiment", "Draft Playbook"].map(q => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            className="text-[10px] bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="p-3 bg-white border-t border-gray-200 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Momentum AI..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-sans"
        />
        <button
          type="submit"
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors flex items-center justify-center"
        >
          <Send size={14} className="stroke-[2.5]" />
        </button>
      </form>
    </div>
  );
}

// ─── LANDING PAGE VIEW ────────────────────────────────────────────────────────

function LandingPageView({ onEnterConsole, onOpenChat }) {
  const [advTab, setAdvTab] = useState("customer");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-4deg); }
          50% { transform: translateY(-12px) rotate(-3deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0px) rotate(6deg); }
          50% { transform: translateY(10px) rotate(5deg); }
        }
        @keyframes float-desktop {
          0%, 100% { transform: translateY(0px) rotate(2deg); }
          50% { transform: translateY(-8px) rotate(1.5deg); }
        }
        .animate-float-phone {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-badge {
          animation: float-reverse 5s ease-in-out infinite;
        }
        .animate-float-browser {
          animation: float-desktop 7s ease-in-out infinite;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* ── Landing Header ── */}
      <header className="h-16 bg-white border-b border-gray-200 px-6 sm:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            {/* Monochromatic solid black abstract M arrow + circle logo */}
            <svg viewBox="0 0 120 70" className="w-10 h-6 text-black inline-block" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="75" cy="30" r="18" stroke="currentColor" strokeWidth="6.5" fill="none" />
              <path d="M15,55 L35,22 L50,45 L62,25 L92,5" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M78,5 H92 V19" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-extrabold text-sm tracking-tight text-slate-900 uppercase">Momentum</span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
            <a href="#advantages" className="hover:text-slate-900 transition-colors">Playbooks</a>
            <a href="#advantages" className="hover:text-slate-900 transition-colors">About Us</a>
          </nav>
        </div>

        {/* Console Link */}
        <button
          onClick={onEnterConsole}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded shadow-sm cursor-pointer transition-colors"
        >
          Launch Command Center Dashboard →
        </button>
      </header>

      {/* ── 1. Hero Section ── */}
      <section className="px-6 sm:px-12 py-12 lg:py-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center bg-white">
        {/* Left Column (Copy & CTAs) */}
        <div className="lg:col-span-6 space-y-6 text-left">

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight">
            Predict churn risk.<br/>
            <span className="bg-[#e4ff6b] text-slate-900 px-3 py-0.5 rounded-sm inline-block mt-2">Protect your revenue.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-lg">
            Empower your CS team to predict risk, automate retention plays, and forecast revenue impact—all in one platform.
          </p>

          {/* Social Proof */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300 overflow-hidden flex items-center justify-center font-bold text-[9px] text-slate-700 select-none">JD</div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-200 overflow-hidden flex items-center justify-center font-bold text-[9px] text-blue-700 select-none">AC</div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-amber-200 overflow-hidden flex items-center justify-center font-bold text-[9px] text-amber-700 select-none">SM</div>
            </div>
            <a href="#advantages" className="text-xs font-bold text-slate-700 underline hover:text-slate-900">See Success Case Studies</a>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3.5 pt-4">
            <button
              onClick={onEnterConsole}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer"
            >
              See It In Action
            </button>
            <button
              onClick={onOpenChat}
              className="px-6 py-3 border border-blue-600 text-blue-600 font-bold rounded-full text-xs hover:bg-blue-50/50 bg-white transition-all text-center cursor-pointer"
            >
              Explore AI Playbooks
            </button>
          </div>
        </div>

        {/* Right Column (Floating UI Mockups) */}
        <div className="lg:col-span-6 relative h-[450px] flex items-center justify-center mt-10 lg:mt-0 select-none">
          {/* Background Card (Desktop View - Wide, tilted, subtle) */}
          <div className="w-[360px] sm:w-[460px] h-[265px] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden animate-float-browser absolute left-4 z-10 opacity-90">
            {/* Window Header */}
            <div className="h-7 bg-slate-50 border-b border-gray-200 px-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[9px] text-slate-400 font-mono ml-4">app.momentum.io/dashboard</span>
            </div>
            {/* Window Content */}
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                <span className="text-[10px] font-extrabold text-slate-800 tracking-tight">Momentum System Status</span>
                <div className="flex gap-2 text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Overview</span>
                  <span>Alerts</span>
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-150 rounded-lg p-3 text-[9px] text-rose-800 space-y-1.5 shadow-sm text-left">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-extrabold uppercase tracking-wide text-[8px] bg-rose-100 px-1 py-0.5 rounded text-rose-700">CRITICAL RISK</span>
                </div>
                <div>
                  <p className="font-extrabold text-slate-900 text-xs">Sarah Jenkins</p>
                  <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                    NPS Score: <span className="font-bold text-rose-600">-12</span> · 3 tickets open · Login down <span className="font-bold text-rose-600">62%</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Foreground Card (Mobile/Widget View - Prominent, overlapping) */}
          <div className="w-[210px] h-[350px] bg-white border border-gray-200 rounded-[2rem] p-3.5 shadow-2xl animate-float-phone absolute right-12 z-20">
            {/* Speaker & camera slot */}
            <div className="w-16 h-4 bg-slate-100 rounded-full mx-auto mb-3.5 border border-gray-200 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
            </div>
            {/* Content list */}
            <div className="space-y-3 font-sans text-left">
              {/* Header card with name */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold text-slate-850">Jane Doe</span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase">CS Director</span>
              </div>
              {/* Blue box for RAR */}
              <div className="bg-blue-600 text-white rounded-xl p-3 shadow-sm space-y-1">
                <p className="text-[8px] text-blue-200 font-extrabold uppercase tracking-wider">AT-RISK REVENUE (RAR)</p>
                <p className="text-base font-extrabold font-mono">$292,860</p>
              </div>
              {/* Sub-metrics */}
              <div className="grid grid-cols-2 gap-1.5 text-[8px]">
                <div className="bg-slate-50 border border-gray-150 rounded-lg p-2">
                  <p className="text-slate-400 font-medium">CSM Actions</p>
                  <p className="font-bold text-slate-700 mt-0.5">12 Done</p>
                </div>
                <div className="bg-slate-50 border border-gray-150 rounded-lg p-2">
                  <p className="text-slate-400 font-medium">Yield Saved</p>
                  <p className="font-bold text-emerald-600 mt-0.5">+$24,400</p>
                </div>
              </div>
              {/* List items */}
              <div className="space-y-2">
                <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Top At-Risk Accounts</p>
                <div className="space-y-1.5">
                  {[
                    { name: "Sarah Jenkins", val: "$116K" },
                    { name: "Marcus Chen", val: "$69K" },
                  ].map(p => (
                    <div key={p.name} className="flex justify-between items-center text-[8px] border-b border-gray-50 pb-1">
                      <span className="font-bold text-slate-700 truncate w-24">👤 {p.name}</span>
                      <span className="font-mono text-rose-600 font-bold">{p.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating Alert Pill (Hovering top right) */}
          <div className="bg-white border border-gray-150 rounded-xl p-3 shadow-2xl animate-float-badge absolute top-8 right-0 z-35 flex items-center gap-2 max-w-[170px] text-left">
            <span className="text-xs">⚠️</span>
            <div className="min-w-[90px]">
              <p className="text-[8px] font-extrabold text-slate-900 leading-tight">Sarah Jenkins</p>
              <p className="text-[7px] text-slate-400 font-semibold leading-relaxed mt-0.5">Sentiment Escalation</p>
            </div>
            <span className="text-[9px] font-bold font-mono text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded ml-1">
              $116K
            </span>
          </div>
        </div>
      </section>

      {/* ── Momentum AI Copilot Feature Section ── */}
      <section className="px-6 sm:px-12 py-16 bg-white select-none">
        <div className="max-w-7xl mx-auto border border-blue-200/60 rounded-3xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-purple-50/70 p-8 sm:p-12 shadow-sm text-center space-y-12">
          {/* Header Area */}
          <div className="flex flex-col items-center max-w-3xl mx-auto space-y-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Sparkles size={22} className="stroke-[2.5]" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Momentum <span className="bg-gradient-to-r from-blue-600 to-indigo-650 bg-clip-text text-transparent">AI Copilot</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-505 leading-relaxed max-w-2xl font-medium">
              Your intelligent retention assistant. Connect your teams, automate proactive interventions, and transform your customer success from reactive to revenue-driving.
            </p>
          </div>

          {/* Feature Grid (3 Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group flex flex-col justify-between text-left">
              <div className="space-y-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <Brain size={20} className="stroke-[2.5]" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Identify Risk Early</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Monitor satisfaction and track usage drops from day one. Let ML models flag at-risk accounts before they escalate.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group flex flex-col justify-between text-left">
              <div className="space-y-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-650 group-hover:scale-110 transition-transform">
                  <Zap size={20} className="stroke-[2.5]" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Trigger Smart Actions</h3>
                <p className="text-xs text-slate-505 leading-relaxed font-medium">
                  Give agents their time back. Automatically route retention tasks to Sales, CS, or Product based on specific churn drivers.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group flex flex-col justify-between text-left">
              <div className="space-y-4">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-650 group-hover:scale-110 transition-transform">
                  <TrendingUp size={20} className="stroke-[2.5]" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Model Financial Impact</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Calculate exactly how much ARR is at risk if a specific segment churns, helping your team focus on high-value interactions.
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action (Bottom) */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button 
              onClick={onEnterConsole}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center gap-1.5 cursor-pointer"
            >
              Explore AI Capabilities <ChevronRight size={14} className="stroke-[3]" />
            </button>
            <button 
              onClick={onOpenChat}
              className="px-6 py-3 border border-slate-300 text-slate-700 font-bold rounded-full text-xs hover:bg-slate-50 bg-white transition-all text-center cursor-pointer font-sans"
            >
              Talk to an AI Expert
            </button>
          </div>
        </div>
      </section>

      {/* ── 2. How Momentum Works Section ── */}
      <section id="how-it-works" className="bg-slate-50 border-y border-gray-200 py-16 lg:py-24 px-6 sm:px-12 select-none">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Centered Heading */}
          <div className="text-center space-y-2">
            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">✦ Workflow</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">How Momentum Works</h2>
            <p className="text-xs text-slate-400">Prevent customer churn in 3 easy steps</p>
          </div>

          {/* Step 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-5xl mx-auto border border-gray-200 rounded-2xl p-6 sm:p-10 bg-white shadow-sm relative">
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-xl font-bold text-slate-900 leading-snug">
                Monitor product health & sentiment signals
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Track critical drop-offs in usage frequency, software integration errors, and negative sentiment. Momentum aggregates these indicators into a unified real-time health score.
              </p>
              <p className="text-[48px] font-extrabold font-mono text-slate-200 mt-6 absolute bottom-2 left-6">01</p>
            </div>
            <div className="lg:col-span-7 flex justify-center">
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 shadow-sm max-w-sm w-full space-y-3">
                <div className="h-44 bg-white rounded-lg p-4 border border-gray-150 flex flex-col justify-between relative">
                  <span className="absolute top-2 left-2 bg-rose-500 text-white font-bold text-[9px] px-2 py-0.5 rounded shadow-sm">Sentiment Alert</span>
                  <div className="mt-8 space-y-1">
                    <h4 className="text-xs font-bold text-slate-850">Marcus Chen</h4>
                    <p className="text-[9px] text-slate-400">BlueSky Analytics · Enterprise</p>
                  </div>
                  <div className="bg-slate-50 border border-gray-205 rounded p-2 text-[10px] text-slate-650 leading-relaxed italic">
                    "Considering cancelling our contract. Support feels completely reactive..."
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-5xl mx-auto border border-gray-200 rounded-2xl p-6 sm:p-10 bg-white shadow-sm relative">
            <div className="lg:col-span-5 lg:order-2 space-y-4">
              <h3 className="text-xl font-bold text-slate-900 leading-snug">
                Execute automated retention playbooks
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Instantly run playbooks like soft-landing pauses, dunning workflows, or Spotify-style personalized value recaps to demonstrate ROI.
              </p>
              <p className="text-[48px] font-extrabold font-mono text-slate-200 mt-6 absolute bottom-2 right-6">02</p>
            </div>
            <div className="lg:col-span-7 lg:order-1 flex justify-center">
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-5 shadow-sm max-w-sm w-full space-y-4 relative overflow-hidden">
                <div className="space-y-1 pb-3 border-b border-gray-150">
                  <p className="text-[10px] text-slate-400">Playbooks matrix</p>
                  <h4 className="text-xs font-bold text-slate-800">Retention Strategy Matrix</h4>
                </div>
                <div className="space-y-2 text-[9px]">
                  <div className="bg-white border border-gray-200 rounded-lg p-2.5 flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-slate-400 font-bold">Failed Payment</p>
                      <p className="font-bold text-blue-700">Trigger smart retry/dunning</p>
                    </div>
                    <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">Active</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-2.5 flex justify-between items-center">
                    <div>
                      <p className="text-slate-400 font-bold">Value Forgetting</p>
                      <p className="font-bold text-slate-700">Personalized 'Year-in-Review' Recap</p>
                    </div>
                    <span className="text-[8px] font-bold text-slate-500 bg-slate-50 border border-gray-205 px-1.5 py-0.5 rounded">Queued</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-5xl mx-auto border border-gray-200 rounded-2xl p-6 sm:p-10 bg-white shadow-sm relative">
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-xl font-bold text-slate-900 leading-snug">
                Simulate revenue outcomes & ROI
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Test playbooks inside our interactive simulator. See exact calculated LTV and net monthly revenue yields saved before deploying playbooks live.
              </p>
              <p className="text-[48px] font-extrabold font-mono text-slate-200 mt-6 absolute bottom-2 left-6">03</p>
            </div>
            <div className="lg:col-span-7 flex justify-center">
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 shadow-sm max-w-sm w-full space-y-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-gray-150">Contraction Simulator</p>
                <div className="h-28 bg-white border border-gray-155 rounded flex items-end p-2 gap-2 justify-between">
                  <div className="bg-blue-100 h-10 w-6 rounded-sm" />
                  <div className="bg-blue-200 h-16 w-6 rounded-sm" />
                  <div className="bg-blue-300 h-20 w-6 rounded-sm" />
                  <div className="bg-blue-600 h-24 w-6 rounded-sm flex items-center justify-center text-[8px] font-bold text-white shadow">Target</div>
                </div>
                <div className="flex justify-between items-center text-[8px] text-slate-400 font-mono">
                  <span>Expansion YieldSaved</span>
                  <span className="font-bold text-emerald-600">+15.0% Saved</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Tailored Advantages Section ── */}
      <section id="advantages" className="bg-white border-t border-gray-200 text-slate-900 py-16 lg:py-24 px-6 sm:px-12 select-none">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Centered Heading */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Tailored Advantages for</h2>
            {/* Nav pills */}
            <div className="flex justify-center gap-1.5 flex-wrap pt-4">
              {["Customer Success Teams", "Finance Directors", "Executive Sponsors"].map(tab => {
                const id = tab.toLowerCase().split(" ")[0];
                const isActive = advTab === id;
                return (
                  <button
                    key={tab}
                    onClick={() => setAdvTab(id)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider transition-all cursor-pointer ${
                      isActive 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-205"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-5xl mx-auto">
            {/* Left Column Mockup */}
            <div className="lg:col-span-5 flex justify-center relative h-[380px] items-center">
              {/* Phone Armani */}
              <div className="w-[200px] h-[340px] bg-white border border-gray-200 rounded-[2rem] p-3.5 shadow-2xl relative z-20">
                <div className="w-16 h-4 bg-slate-100 rounded-full mx-auto mb-3 border border-gray-250 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-slate-300" /></div>
                <div className="space-y-3 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold text-slate-850">Welcome back, Director! 👋</span>
                    <span className="text-[10px]">⚙️</span>
                  </div>
                  <div className="bg-blue-600 text-white rounded p-2.5 shadow-sm space-y-0.5">
                    <p className="text-[8px] text-blue-200 font-medium uppercase tracking-wider">Saved Yield</p>
                    <p className="text-sm font-bold font-mono">$116,440</p>
                    <div className="flex justify-between text-[7px] text-blue-200 border-t border-blue-500/50 pt-1.5 mt-1.5">
                      <span>Safeguarded ACV</span>
                      <span className="font-bold">$422K</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[8px]">
                    <div className="bg-slate-50 border border-gray-200 rounded p-1.5">
                      <p className="text-slate-400">Expansions</p>
                      <p className="font-bold font-mono text-slate-700">$38,000</p>
                    </div>
                    <div className="bg-slate-50 border border-gray-200 rounded p-1.5">
                      <p className="text-slate-400">Net Return</p>
                      <p className="font-bold font-mono text-emerald-600">+$24,400</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Top Safe Portfolios</p>
                    <div className="space-y-1">
                      {[
                        { name: "Sophia Martinez", val: "Loyalty" },
                        { name: "Emma Harrison", val: "Loyalty" },
                      ].map(p => (
                        <div key={p.name} className="flex justify-between items-center text-[7px] border-b border-gray-50 pb-1">
                          <span className="font-bold text-slate-750 truncate w-24">👤 {p.name}</span>
                          <span className="font-semibold text-emerald-600">{p.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating expansion yield card */}
              <div className="absolute top-10 right-2 z-30 bg-[#e4ff6b] border border-gray-300 rounded-xl p-3 shadow-lg flex flex-col justify-center items-center select-none w-28 h-28 transform rotate-[6deg]">
                <p className="text-[24px] font-black text-slate-900 leading-none">+15%</p>
                <p className="text-[8px] font-bold text-slate-800 text-center mt-1.5 uppercase leading-snug">Average CS expansion yield</p>
              </div>
            </div>

            {/* Right Column List */}
            <div className="lg:col-span-7 space-y-6">
              {advTab === "customer" && [
                { num: "01", title: "Proactive Support Outreach", desc: "Flag software errors and sentiment drops before customer tickets are formally opened." },
                { num: "02", title: "Automated CS Playbooks", desc: "Deploy Soft Landings and Spotify-style Value Recaps automatically to targeted client tiers." },
                { num: "03", title: "Accelerated CS Onboarding", desc: "Recognize setup bottlenecks and time-to-first-value markers to guide clients gracefully." }
              ].map(adv => (
                <div key={adv.num} className="flex gap-4 p-4 border border-gray-200 bg-white rounded-xl shadow-sm items-start hover:border-gray-300 transition-colors">
                  <span className="text-xs font-bold font-mono bg-blue-50 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">{adv.num}</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{adv.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{adv.desc}</p>
                  </div>
                </div>
              ))}
              {advTab === "finance" && [
                { num: "01", title: "Smart Dunning sequences", desc: "Intercept failed invoices and trigger card retries automatically to prevent involuntary churn." },
                { num: "02", title: "LTV & ARR Risk Mapping", desc: "Align customer monthly recurring revenue directly to active risk exposure categories." },
                { num: "03", title: "Renewal Risk Safeguards", desc: "Map executive sponsor departures and budget reviews early to protect recurring contract values." }
              ].map(adv => (
                <div key={adv.num} className="flex gap-4 p-4 border border-gray-200 bg-white rounded-xl shadow-sm items-start hover:border-gray-300 transition-colors">
                  <span className="text-xs font-bold font-mono bg-blue-50 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">{adv.num}</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{adv.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{adv.desc}</p>
                  </div>
                </div>
              ))}
              {advTab === "executive" && [
                { num: "01", title: "Live Command Center Overview", desc: "Visual regional interactive maps show support friction hotspots and NLP transcripts at a glance." },
                { num: "02", title: "Interactive Metrics Simulator", desc: "Adjust expansion metrics and see exact calculated LTV and saved revenue effects immediately." },
                { num: "03", title: "Customer 360 Accordion Tracking", desc: "Monitor onboarding, engagement, retention, and loyalty timeline steps on any individual client." }
              ].map(adv => (
                <div key={adv.num} className="flex gap-4 p-4 border border-gray-200 bg-white rounded-xl shadow-sm items-start hover:border-gray-300 transition-colors">
                  <span className="text-xs font-bold font-mono bg-blue-50 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">{adv.num}</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{adv.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{adv.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Meet Guardy Section ── */}
      <section className="bg-slate-50 border-t border-gray-200 text-slate-900 py-16 lg:py-24 px-6 sm:px-12 select-none">
        <div className="max-w-4xl mx-auto text-center space-y-8 relative">
          
          {/* Chat bubbles mockups stack inside a structured chat window box above heading */}
          <div className="flex justify-center mb-10">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden select-none text-left">
              {/* Chat Box Header */}
              <div className="bg-slate-50 border-b border-gray-150 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs">🛡️</div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-800 leading-tight">Guardy AI Co-Pilot</p>
                    <p className="text-[8px] text-emerald-600 flex items-center gap-1 font-semibold leading-none mt-0.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block animate-pulse" /> Active Now
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                </div>
              </div>

              {/* Chat Box Body */}
              <div className="p-4 space-y-4 bg-slate-50/10 min-h-[200px] flex flex-col justify-end">
                {/* User Bubble */}
                <div className="space-y-1 self-start max-w-[85%] text-left">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block ml-1">User Query</span>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none p-2.5 text-[10px] text-slate-750 shadow-sm leading-relaxed">
                    How does Momentum calculate risk?
                  </div>
                </div>

                {/* Guardy Response */}
                <div className="space-y-1 self-end max-w-[85%] text-left">
                  <span className="text-[8px] font-bold text-blue-500 uppercase tracking-wider block mr-1 text-right">Guardy response</span>
                  <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none p-2.5 text-[10px] shadow-md leading-relaxed">
                    We combine usage consistency, support CSAT, and transcript sentiment text to generate real-time health scores...
                  </div>
                </div>

                {/* Suggested suggestion bubble */}
                <div className="border border-gray-200 border-dashed rounded-full px-3 py-1.5 text-[9px] text-slate-500 hover:bg-slate-50 cursor-pointer self-start w-fit bg-white transition-colors">
                  ✨ What playbooks are supported?
                </div>
              </div>

              {/* Chat Box Input Footer */}
              <div className="border-t border-gray-150 p-2.5 bg-slate-50/30 flex items-center gap-2">
                <div className="bg-white border border-gray-200 rounded-full px-3 py-1.5 text-[9px] text-slate-400 flex-grow text-left">
                  Ask Guardy a question...
                </div>
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs shadow-sm">
                  ➔
                </div>
              </div>
            </div>
          </div>

          {/* Heading block */}
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Meet Guardy, Your CS Co-Pilot</h2>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              Have a question about how Momentum works? Guardy is intelligently trained on customer retention strategy, CRM integrations, and is here 24/7 to guide you.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3.5 pt-4">
            <button
              onClick={onOpenChat}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer"
            >
              Chat with Guardy
            </button>
            <button
              onClick={onEnterConsole}
              className="px-6 py-3 border border-gray-300 text-slate-700 font-bold rounded-full text-xs hover:bg-slate-50 bg-white shadow-sm transition-all text-center cursor-pointer"
            >
              Go to Command Center
            </button>
          </div>
        </div>
      </section>

      {/* ── Landing Footer ── */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 px-6 sm:px-12 text-center text-slate-500 space-y-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-slate-900 pb-8">
          <div className="flex items-center gap-2">
            {/* White Monochromatic abstract M arrow + circle logo */}
            <svg viewBox="0 0 120 70" className="w-7 h-5 text-white inline-block" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="75" cy="30" r="18" stroke="currentColor" strokeWidth="6.5" fill="none" />
              <path d="M15,55 L35,22 L50,45 L62,25 L92,5" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M78,5 H92 V19" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-extrabold text-xs tracking-tight text-white uppercase">Momentum</span>
          </div>
          <p className="text-[10px] font-medium font-mono text-slate-450">© 2026 Momentum Technologies. All rights reserved.</p>
        </div>
        <p className="text-[9px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Disclaimer: Momentum B2B customer analytics is built for enterprise portfolio monitoring. Health index estimations are based on simulated telemetry and CRM integration histories.
        </p>
      </footer>
    </div>
  );
}
// ─── LOGIN PAGE VIEW ─────────────────────────────────────────────────────────

function LoginPageView({ onLoginSuccess, onBackToLanding }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-stretch select-none font-sans overflow-hidden">
      {/* Left Pane - Cover Image (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden items-end p-12">
        <img 
          src="/login_cover.jpg" 
          alt="Momentum Business Cover" 
          className="absolute inset-0 w-full h-full object-cover opacity-85"
        />
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-slate-900/10 z-10" />

        {/* Text content over overlay */}
        <div className="relative z-20 space-y-4 max-w-lg text-left">
          <div className="flex items-center gap-2 mb-6">
            {/* White Monochromatic abstract M arrow + circle logo */}
            <svg viewBox="0 0 120 70" className="w-8 h-6 text-white inline-block" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="75" cy="30" r="18" stroke="currentColor" strokeWidth="6.5" fill="none" />
              <path d="M15,55 L35,22 L50,45 L62,25 L92,5" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M78,5 H92 V19" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-extrabold text-sm tracking-tight text-white uppercase">Momentum</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Protect Your Revenue <br />with Confidence.
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Experience a new standard of efficiency through an intelligent, beautifully designed customer retention command center.
          </p>
        </div>
      </div>

      {/* Right Pane - Form Container */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center px-6 sm:px-16 lg:px-24 py-12 relative">
        {/* Back link */}
        <button 
          onClick={onBackToLanding}
          className="absolute top-6 left-6 sm:left-12 flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        >
          ← Back to homepage
        </button>

        <div className="max-w-md w-full mx-auto space-y-6 text-center">
          {/* Logo & Header */}
          <div className="space-y-2">
            {/* Black Monochromatic abstract M arrow + circle logo */}
            <svg viewBox="0 0 120 70" className="w-10 h-6 text-black inline-block" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="75" cy="30" r="18" stroke="currentColor" strokeWidth="6.5" fill="none" />
              <path d="M15,55 L35,22 L50,45 L62,25 L92,5" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M78,5 H92 V19" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Log in or Sign up</h2>
            <p className="text-xs text-slate-450 font-medium">Welcome to Momentum command center</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block ml-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email here"
                  className="w-full px-3.5 py-2.5 border border-gray-205 rounded-lg text-xs text-slate-800 placeholder-gray-450 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-600 transition-all"
                />
                <span className="absolute right-3.5 top-3 text-[10px] text-slate-400">✉️</span>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block ml-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Input your password"
                  className="w-full px-3.5 py-2.5 border border-gray-255 rounded-lg text-xs text-slate-800 placeholder-gray-450 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-600 transition-all"
                />
                <span className="absolute right-3.5 top-3 text-[10px] text-slate-400">🔑</span>
              </div>
            </div>

            {/* Remember Me checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Remember me
              </label>
            </div>

            {/* Actions Stack */}
            <div className="space-y-2.5 pt-3">
              {/* Primary Login Button */}
              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer uppercase tracking-wider text-center"
              >
                Log In
              </button>

              {/* Demo Account Button */}
              <button
                type="button"
                onClick={onLoginSuccess}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer uppercase tracking-wider text-center flex items-center justify-center gap-1.5 animate-pulse"
              >
                ⚡ Log In with Demo Account
              </button>
            </div>
          </form>

          {/* Helper Footer Links */}
          <div className="space-y-2 pt-2 text-[10px] text-slate-400 font-semibold">
            <p>
              Did you forget your password?{" "}
              <a href="#" className="text-blue-600 hover:underline">Reset password</a>
            </p>
            <p>
              Don't have an account?{" "}
              <a href="#" className="text-slate-800 hover:underline">Sign up for free</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [appState, setAppState] = useState("landing"); // "landing" | "login" | "console"
  const [activeTab, setActiveTab] = useState("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  
  const { customers, loading, error, addCustomers, updateCustomer, deleteCustomer, clearAllCustomers } = useCustomers();

  const [pics, setPics] = useState({
    product: [
      { id: "u-prod-1", name: "Alex Chen", role: "Eng Lead", contact: "+1 (555) 0192", email: "alex.c@momentum.ai" }
    ],
    sales: [
      { id: "u-sales-1", name: "Sarah Jenkins", role: "Sales Ops", contact: "+1 (555) 0481", email: "sarah.j@momentum.ai" }
    ],
    cs: [
      { id: "u-cs-1", name: "Marcus Vance", role: "CS Director", contact: "+1 (555) 0722", email: "marcus.v@momentum.ai" }
    ]
  });

  const [resolvedTasks, setResolvedTasks] = useState([
    { id: "res-1", title: "API Timeout Errors during bulk CSV imports", rar: 185000, dept: "Product & Engineering", resolvedAt: "Today, 05:22 PM", pic: "Alex Chen" },
    { id: "res-2", title: "Conduct QBR for Emma Harrison's team", rar: 41000, dept: "Customer Success", resolvedAt: "Today, 04:10 PM", pic: "Marcus Vance" }
  ]);

  const handleTabChange = id => {
    if (id === activeTab) return;
    setTransit(true);
    setTimeout(() => { setActiveTab(id); setTransit(false); }, 180);
  };

  const renderView = () => {
    switch (activeTab) {
      case "dashboard":  return <DashboardView />;
      case "customers":  return <Customer360View />;
      case "insights":   return <InsightsView resolvedTasks={resolvedTasks} />;
      case "actions":    return <ActionsView resolvedTasks={resolvedTasks} setResolvedTasks={setResolvedTasks} pics={pics} setPics={setPics} />;
      case "reports":    return <ReportsView />;
      default: return null;
    }
  };

  const currentNav = navItems.find(n => n.id === activeTab);

  if (appState === "landing") {
    return (
      <>
        <LandingPageView 
          onEnterConsole={() => setAppState("login")} 
          onOpenChat={() => setChatOpen(true)} 
        />
        <GuardyChatWidget 
          isOpen={chatOpen} 
          onClose={() => setChatOpen(false)} 
          onOpen={() => setChatOpen(true)} 
        />
      </>
    );
  }

  if (appState === "login") {
    return (
      <LoginPageView 
        onLoginSuccess={() => setAppState("console")} 
        onBackToLanding={() => setAppState("landing")} 
      />
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900 overflow-hidden relative font-sans">
      {/* ── Left Sidebar (Stripe/Datadog style) ── */}
      <aside className="w-56 h-screen bg-slate-900 border-r border-slate-800 flex flex-col justify-between flex-shrink-0 z-40 text-slate-300">
        <div className="flex flex-col w-full">
          {/* Logo / Header */}
          <div className="h-14 border-b border-slate-800 flex items-center px-4 gap-2 text-white">
            {/* White Monochromatic abstract M arrow + circle logo */}
            <svg viewBox="0 0 120 70" className="w-7 h-5 text-white inline-block" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="75" cy="30" r="18" stroke="currentColor" strokeWidth="6.5" fill="none" />
              <path d="M15,55 L35,22 L50,45 L62,25 L92,5" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M78,5 H92 V19" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-bold text-sm tracking-tight">Momentum</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-2 py-3 w-full">
            {navItems.map(({ id, icon: Icon, label }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => handleTabChange(id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all duration-150 text-left w-full cursor-pointer
                    ${isActive 
                      ? "bg-slate-800 text-white" 
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile */}
        <div className="p-3 border-t border-slate-850 flex items-center justify-between text-slate-300 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-blue-650 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              JD
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">Jane Doe</p>
              <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">CS Director</p>
            </div>
          </div>
          <button
            onClick={() => setAppState("landing")}
            title="Log out to Homepage"
            className="w-8 h-8 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-30">
          {/* Breadcrumbs / Page Title */}
          <div className="flex items-center gap-4 text-xs font-medium">
            <button 
              onClick={() => setAppState("landing")}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-gray-300 rounded font-semibold text-slate-700 transition-colors cursor-pointer text-[10px]"
            >
              ← Back to Momentum Landing
            </button>
            <span className="text-slate-355">|</span>
            <span className="text-slate-400 font-semibold">Console</span>
            <span className="text-slate-305">/</span>
            <span className="text-slate-800 font-bold capitalize">{activeTab}</span>
          </div>

          {/* Right section controls */}
          <div className="flex items-center gap-3">
            {/* Target indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Target: 85% Retention
            </div>
            
            <button className="w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center text-slate-500 transition-all cursor-pointer">
              <Search size={14} />
            </button>
            <button className="w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center text-slate-500 transition-all relative cursor-pointer">
              <Bell size={14} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white" />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <div className="w-7 h-7 rounded bg-slate-100 border border-gray-200 flex items-center justify-center text-slate-700 text-xs font-bold shadow-sm">JD</div>
              <span className="hidden lg:block text-xs font-bold text-slate-700">Jane D.</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 max-w-screen-2xl w-full mx-auto space-y-5">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{pageMeta[activeTab]?.title || activeTab}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{pageMeta[activeTab]?.subtitle}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Live · Updated just now
            </div>
          </div>

          {/* Subview Content with transitioning effect */}
          <div className="transition-all duration-200"
            style={{ opacity: transitioning ? 0 : 1, transform: transitioning ? "translateY(4px)" : "translateY(0)" }}>
            {renderView()}
          </div>
        </main>
      </div>

      {/* Floating Chatbot for support inside dashboard too */}
      <GuardyChatWidget 
        isOpen={chatOpen} 
        onClose={() => setChatOpen(false)} 
        onOpen={() => setChatOpen(true)} 
      />
    </div>
  );
}



