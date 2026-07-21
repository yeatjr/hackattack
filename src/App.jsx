import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import {
  LayoutDashboard, Users, Lightbulb, Activity, FileBarChart2,
  Settings, ShieldCheck, ChevronRight, ChevronDown, ChevronUp,
  DollarSign, AlertTriangle, CheckCircle2, TrendingDown, Sparkles,
  ArrowUpRight, ArrowDownRight, Bell, Search, Play, Pause, Plus, Info, Target, Heart,
  Clock, Zap, UserX, MessageSquare, X, Globe, LogOut, Brain, TrendingUp, Send,
} from "lucide-react";

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

// ─── DUMMY DATA ───────────────────────────────────────────────────────────────

const customers = [
  {
    id: 1,  name: "Sarah Jenkins",      tier: "Enterprise", churn: 82, ltv: 142000, rar: 116440, action: "Empathetic Offboarding: Route to human, suppress automated emails",   health: 23, segment: "At-Risk",
    stage: "Retention", stageIdx: 2,
    stageMetrics: { npsScore: -12, supportCsat: 2.1, usageConsistency: 22 },
    events: ["Missed renewal meeting","3 support tickets filed in 7 days","Login frequency down 62%"],
  },
  {
    id: 2,  name: "Marcus Chen",        tier: "Enterprise", churn: 71, ltv: 98000,  rar: 69580,  action: "Offer flexible pause/downgrade (Soft Landing)",                            health: 34, segment: "At-Risk",
    stage: "Retention", stageIdx: 2,
    stageMetrics: { npsScore: 2, supportCsat: 2.8, usageConsistency: 41 },
    events: ["Downgrade inquiry via live chat","Low usage on Analytics module","QBR scheduled for next week"],
  },
  {
    id: 3,  name: "Elena Rostova",      tier: "Premium",    churn: 65, ltv: 54000,  rar: 35100,  action: "Trigger 'Spotify-style' Personalized Value Recap (Show ROI)",              health: 41, segment: "Quiet Payer",
    stage: "Engagement", stageIdx: 1,
    stageMetrics: { featureAdoption: 28, sessionsPerWeek: 1.4, featureGap: 5 },
    events: ["Only 2 of 7 Premium features used","Last session: 8 days ago","No API usage detected"],
  },
  {
    id: 4,  name: "David Miller",       tier: "Premium",    churn: 58, ltv: 47000,  rar: 27260,  action: "Trigger automated dunning management for failed card",                     health: 49, segment: "Quiet Payer",
    stage: "Engagement", stageIdx: 1,
    stageMetrics: { featureAdoption: 35, sessionsPerWeek: 2.1, featureGap: 4 },
    events: ["Automation feature never activated","Session duration declining","Budget review flagged in CRM"],
  },
  {
    id: 5,  name: "Sarah Montgomery",   tier: "Enterprise", churn: 54, ltv: 110000, rar: 59400,  action: "Offer flexible pause/downgrade (Soft Landing)",                            health: 52, segment: "At-Risk",
    stage: "Retention", stageIdx: 2,
    stageMetrics: { npsScore: 18, supportCsat: 3.2, usageConsistency: 58 },
    events: ["Champion left the company","New admin user onboarding","Positive QBR last quarter"],
  },
  {
    id: 6,  name: "Oliver Vance",       tier: "Basic",      churn: 47, ltv: 12000,  rar: 5640,   action: "Offer flexible pause/downgrade (Soft Landing)",                            health: 60, segment: "Casual",
    stage: "Onboarding", stageIdx: 0,
    stageMetrics: { setupCompletion: 62, timeToFirstValue: 14, supportTickets: 4 },
    events: ["Setup only 62% complete","Team members not yet invited","First value milestone not reached"],
  },
  {
    id: 7,  name: "Sophia Martinez",    tier: "Premium",    churn: 39, ltv: 38000,  rar: 14820,  action: "Grant VIP early access / Anniversary Perk (Loyalty)",                      health: 67, segment: "Power User",
    stage: "Loyalty", stageIdx: 3,
    stageMetrics: { expansionRevenue: 8400, referrals: 2, feedbackSubmissions: 7 },
    events: ["Referred Lucas Vance","Submitted 3 feature requests","Enrolled in beta program"],
  },
  {
    id: 8,  name: "Lucas Vance",        tier: "Basic",      churn: 31, ltv: 8000,   rar: 2480,   action: "Trigger 'Spotify-style' Personalized Value Recap (Show ROI)",              health: 72, segment: "Casual",
    stage: "Engagement", stageIdx: 1,
    stageMetrics: { featureAdoption: 55, sessionsPerWeek: 3.2, featureGap: 1 },
    events: ["Arrived via Sophia Martinez referral","Strong basic feature usage","Ready for upgrade conversation"],
  },
  {
    id: 9,  name: "Emma Harrison",      tier: "Enterprise", churn: 24, ltv: 88000,  rar: 21120,  action: "Grant VIP early access / Anniversary Perk (Loyalty)",                      health: 79, segment: "Power User",
    stage: "Loyalty", stageIdx: 3,
    stageMetrics: { expansionRevenue: 22000, referrals: 4, feedbackSubmissions: 12 },
    events: ["Expanded to 2 additional teams","Submitted roadmap feedback","Attended annual user conference"],
  },
  {
    id: 10, name: "Jonathan Reynolds", tier: "Basic",      churn: 18, ltv: 6000,   rar: 1080,   action: "Grant VIP early access / Anniversary Perk (Loyalty)",                      health: 88, segment: "Power User",
    stage: "Loyalty", stageIdx: 3,
    stageMetrics: { expansionRevenue: 1200, referrals: 1, feedbackSubmissions: 3 },
    events: ["Consistent weekly usage","Gave NPS score of 10","Exploring Premium upgrade"],
  },
];

const lifecycleData = STAGES.map(s => ({
  stage: s,
  count: customers.filter(c => c.stage === s).length,
  color: STAGE_STYLE[s].hex,
}));

const sentimentData = [
  { month: "Jan", positive: 65, negative: 35 },
  { month: "Feb", positive: 60, negative: 40 },
  { month: "Mar", positive: 55, negative: 45 },
  { month: "Apr", positive: 50, negative: 50 },
  { month: "May", positive: 48, negative: 52 },
  { month: "Jun", positive: 53, negative: 47 },
  { month: "Jul", positive: 58, negative: 42 },
];

const featureAdoptionData = [
  { feature: "Analytics",    basic: 30, premium: 60, enterprise: 90 },
  { feature: "Automation",   basic: 15, premium: 45, enterprise: 85 },
  { feature: "API Access",   basic: 5,  premium: 30, enterprise: 78 },
  { feature: "Reporting",    basic: 40, premium: 55, enterprise: 70 },
  { feature: "Integrations", basic: 20, premium: 50, enterprise: 88 },
];

const clusterData = [
  { name: "Power Users",  value: 22, color: "#3b82f6" },
  { name: "Quiet Payers", value: 31, color: "#f59e0b" },
  { name: "Casual Users", value: 27, color: "#8b5cf6" },
  { name: "At-Risk",      value: 20, color: "#f43f5e" },
];

const ACTION_IMPACTS = {
  "No Action":                  { churnReduction: 0,    cost: 0      },
  "Discount Offer (20%)":       { churnReduction: 0.15, cost: 4200   },
  "Feature Training Workshop":  { churnReduction: 0.08, cost: 1800   },
  "Account Manager Assigned":   { churnReduction: 0.22, cost: 6500   },
  "Product Roadmap Preview":    { churnReduction: 0.10, cost: 900    },
  "Custom Pricing Negotiation": { churnReduction: 0.28, cost: 12000  },
};

// ─── CUSTOMER HISTORY DATA ──────────────────────────────────────────────────

const CUSTOMER_HISTORIES = {
  1: [ // Sarah Jenkins
    { date:"2024-11-15", type:"churn_signal",  title:"Login Frequency Dropped 62%",             detail:"Weekly logins fell from 18 to 7 — flagged by health scoring engine." },
    { date:"2024-11-12", type:"support",       title:"Support Ticket #4821 Opened",             detail:"API timeout errors on Salesforce sync. Resolved by engineering in 6h." },
    { date:"2024-10-28", type:"communication", title:"QBR Attempt — No Response",               detail:"CSM sent QBR invite; champion did not respond within 5 business days." },
    { date:"2024-10-10", type:"support",       title:"Support Ticket #4652 — Integration Bug", detail:"Data import pipeline failing for 3rd-party connector. Escalated to L2." },
    { date:"2024-09-22", type:"nps",           title:"NPS Survey Submitted: 3/10",              detail:"\"Support feels reactive. We expected a more proactive partner.\"" },
    { date:"2024-09-05", type:"churn_signal",  title:"Competitor Demo Scheduled",              detail:"CRM note: Champion booked a demo with Competitor X. Risk escalated." },
    { date:"2024-08-20", type:"communication", title:"QBR Held — 2 Risk Flags Raised",          detail:"Usage down 40%. Account team flagged contract renewal risk in CRM." },
    { date:"2024-08-01", type:"expansion",     title:"Annual Contract Renewed",                 detail:"12-month renewal at $142k. Negotiated 5% discount to retain account." },
    { date:"2024-06-15", type:"communication", title:"CSM Reassigned",                          detail:"Previous CSM resigned. Account transitioned to new success manager." },
    { date:"2024-04-10", type:"engagement",    title:"Feature Adoption Report Sent",            detail:"Only 3 of 8 Enterprise features active. Training recommended." },
    { date:"2024-02-05", type:"milestone",     title:"1-Year Customer Anniversary",            detail:"Automated milestone email sent. No response received from champion." },
    { date:"2024-01-15", type:"onboarding",    title:"Enterprise Certification Completed",     detail:"Admin team completed all 5 onboarding modules. Setup score: 91%." },
    { date:"2023-11-01", type:"expansion",     title:"Upgraded to Enterprise Tier",             detail:"Upgraded from Premium — added SSO, advanced analytics, and API access." },
    { date:"2023-09-15", type:"onboarding",    title:"Account Created",                        detail:"Initial setup completed. Assigned CSM and onboarding success plan." },
  ],
  2: [ // Marcus Chen
    { date:"2024-11-10", type:"churn_signal",  title:"Downgrade Inquiry via Live Chat",        detail:"User asked about cancelling Analytics add-on. CSM alerted immediately." },
    { date:"2024-10-22", type:"engagement",    title:"Analytics Module Usage Declined",        detail:"Monthly active users on Analytics fell from 12 to 4 over 30 days." },
    { date:"2024-10-05", type:"communication", title:"QBR Scheduled for Next Week",             detail:"CSM confirmed attendance of 3 stakeholders. Risk deck prepared." },
    { date:"2024-09-18", type:"nps",           title:"NPS Survey Submitted: 6/10",              detail:"\"Reporting is good but we feel we're outgrowing the platform.\"" },
    { date:"2024-08-30", type:"support",       title:"Support Ticket — Dashboard Bug",         detail:"Dashboard KPIs showing stale data. Fixed in next day's patch release." },
    { date:"2024-07-15", type:"expansion",     title:"5 Seats Added",                          detail:"Data science team added to account. Total users now 18." },
    { date:"2024-05-20", type:"milestone",     title:"First Automated Report Sent",            detail:"Account reached reporting automation milestone after 60 days." },
    { date:"2024-03-01", type:"onboarding",    title:"Account Created",                        detail:"Enterprise signup via direct sales. Full onboarding session booked." },
  ],
  3: [ // Elena Rostova
    { date:"2024-11-08", type:"engagement",    title:"Last Session: 8 Days Ago",               detail:"No login detected in 8 days. Automated re-engagement email triggered." },
    { date:"2024-10-14", type:"churn_signal",  title:"Feature Usage Gap Detected",             detail:"5 of 7 Premium features never activated. Health score dropped to 41." },
    { date:"2024-09-25", type:"support",       title:"API Activation Ticket Filed",            detail:"User unsure how to connect API. L1 support provided documentation." },
    { date:"2024-08-12", type:"communication", title:"Feature Training Offered — Declined",    detail:"CSM offered workshop; champion said \"not a priority right now\"." },
    { date:"2024-07-01", type:"nps",           title:"NPS Survey Submitted: 7/10",              detail:"\"The product is good but we haven't had time to explore everything.\"" },
    { date:"2024-05-18", type:"onboarding",    title:"Onboarding Completed",                   detail:"Setup wizard finished. Only core modules configured (2/7)." },
    { date:"2024-04-02", type:"onboarding",    title:"Account Created",                        detail:"Premium signup. Initial contact made by inside sales team." },
  ],
  4: [ // David Miller
    { date:"2024-11-05", type:"churn_signal",  title:"Budget Review Flagged in CRM",           detail:"Account champion mentioned Q1 budget cuts in email. CSM alerted." },
    { date:"2024-10-18", type:"engagement",    title:"Automation Feature Never Activated",     detail:"30 days post-onboarding — Automation module still at 0% usage." },
    { date:"2024-09-30", type:"support",       title:"Import Failure — 7 Errors in 5 Days",   detail:"Recurring CSV import failures. Root cause: malformed column headers." },
    { date:"2024-08-20", type:"nps",           title:"NPS Survey: 5/10",                        detail:"\"Useful but some workflows are unnecessarily complicated.\"" },
    { date:"2024-07-10", type:"onboarding",    title:"Onboarding Completed",                   detail:"Setup score 78%. Automation module skipped by user during setup." },
    { date:"2024-06-15", type:"onboarding",    title:"Account Created",                        detail:"Premium signup via marketing webinar lead." },
  ],
  5: [ // Sarah Montgomery
    { date:"2024-11-02", type:"communication", title:"New Admin User Onboarding Started",      detail:"Previous champion (Sarah M.) left. Re-onboarding initiated for new admin." },
    { date:"2024-10-25", type:"churn_signal",  title:"Champion Left the Company",              detail:"Sarah M. (primary champion) resigned. Account now at heightened risk." },
    { date:"2024-09-10", type:"nps",           title:"NPS Survey: 7/10",                        detail:"\"Solid platform. Our team is still getting used to the advanced features.\"" },
    { date:"2024-07-18", type:"communication", title:"Positive QBR — Strong ROI Reported",    detail:"Champion shared 34% productivity gain. Upsell conversation initiated." },
    { date:"2024-05-05", type:"expansion",     title:"Enterprise Add-On Purchased",           detail:"Added advanced security module. ACV increased by $18,000." },
    { date:"2024-02-20", type:"milestone",     title:"Power User Milestone Hit",               detail:"7 of 9 Enterprise features active. Team usage at 85% weekly." },
    { date:"2023-11-10", type:"onboarding",    title:"Account Created",                        detail:"Enterprise deal closed. Full white-glove onboarding scheduled." },
  ],
  6: [ // Oliver Vance
    { date:"2024-11-14", type:"churn_signal",  title:"Day 14 — First Value Not Reached",      detail:"Setup only 62% complete. Time-to-first-value deadline missed." },
    { date:"2024-11-10", type:"support",       title:"Support Ticket — Team Invite Issue",    detail:"User couldn't invite team members. Permissions bug identified and fixed." },
    { date:"2024-11-05", type:"onboarding",    title:"Onboarding Email Series Started",       detail:"5-email drip sequence initiated. Open rate: 80%." },
    { date:"2024-11-01", type:"onboarding",    title:"Account Created",                       detail:"Basic plan signup via self-serve. Onboarding wizard started." },
  ],
  7: [ // Sophia Martinez
    { date:"2024-11-01", type:"expansion",     title:"Enrolled in Beta Program",              detail:"Invited to test v2 reporting engine. Provided detailed feedback within 48h." },
    { date:"2024-10-12", type:"milestone",     title:"3 Feature Requests Shipped",            detail:"Product team delivered 3 of Sophia Martinez's roadmap requests." },
    { date:"2024-09-05", type:"expansion",     title:"Referred Lucas Vance",                  detail:"Successful referral — Lucas Vance signed Basic plan. $8k ACV added." },
    { date:"2024-07-20", type:"nps",           title:"NPS Survey: 9/10",                       detail:"\"Best-in-class for our use case. Would recommend to any SaaS team.\"" },
    { date:"2024-05-10", type:"communication", title:"Co-Marketing Case Study Published",     detail:"Joint success story published on blog — 2.4k views in first week." },
    { date:"2024-01-15", type:"milestone",     title:"2-Year Loyalty Milestone",             detail:"Recognised with personalised gift and dedicated roadmap session." },
    { date:"2023-06-01", type:"onboarding",    title:"Account Created",                       detail:"Premium plan. Self-serve signup with immediate feature adoption." },
  ],
  8: [ // Lucas Vance
    { date:"2024-10-30", type:"engagement",    title:"Upgrade Conversation Initiated",        detail:"CSM reached out re: Premium upgrade. Champion requested pricing deck." },
    { date:"2024-10-01", type:"milestone",     title:"Strong Basic Feature Usage",            detail:"All 4 Basic-tier features activated. Weekly usage consistently above benchmark." },
    { date:"2024-09-15", type:"onboarding",    title:"Arrived via Sophia Martinez Referral",  detail:"Referred by Sophia Martinez. Onboarded within 3 days of signup." },
    { date:"2024-09-10", type:"onboarding",    title:"Account Created",                       detail:"Basic plan self-serve signup. Initial setup completed same day." },
  ],
  9: [ // Emma Harrison
    { date:"2024-11-05", type:"expansion",     title:"Submitted Roadmap Feedback",           detail:"Submitted 12 detailed feature requests via roadmap portal." },
    { date:"2024-10-20", type:"expansion",     title:"Expanded to 2 Additional Teams",      detail:"Finance and Operations teams onboarded. Seat count grew from 22 to 41." },
    { date:"2024-09-14", type:"milestone",     title:"Annual User Conference Attended",      detail:"CEO and 3 team leads attended. Spoke on retention ROI panel." },
    { date:"2024-07-01", type:"nps",           title:"NPS Survey: 10/10",                     detail:"\"Momentum has been transformative. We've cut churn by 38% year-over-year.\"" },
    { date:"2024-04-15", type:"expansion",     title:"$22k Expansion Revenue Locked In",    detail:"Advanced AI module purchased. Multi-year deal at preferred pricing." },
    { date:"2024-01-10", type:"communication", title:"Executive Sponsor Call Held",          detail:"VP of CS held C-level call. Roadmap alignment and expansion goals confirmed." },
    { date:"2023-06-01", type:"expansion",     title:"Upgraded to Enterprise",              detail:"Upgraded from Premium after 6 months. Full SSO and API integration live." },
    { date:"2022-11-20", type:"onboarding",    title:"Account Created",                      detail:"Enterprise signup via strategic partnership program." },
  ],
  10: [ // Jonathan Reynolds
    { date:"2024-10-28", type:"nps",           title:"NPS Survey: 10/10",                     detail:"\"Simple, powerful, and the support team is always there when we need them.\"" },
    { date:"2024-09-15", type:"engagement",    title:"Exploring Premium Upgrade",            detail:"User browsed Premium pricing page 4 times. Upgrade intent signal detected." },
    { date:"2024-07-04", type:"milestone",     title:"Consistent Weekly Usage — 6 Months",  detail:"6 consecutive months of above-benchmark weekly activity. Loyalty badge awarded." },
    { date:"2024-05-18", type:"expansion",     title:"1 Referral Sent",                      detail:"Referred a colleague's startup. Referral bonus credit applied to account." },
    { date:"2024-03-01", type:"onboarding",    title:"Onboarding Completed",                 detail:"All Basic features activated within first week. Setup score: 100%." },
    { date:"2024-02-10", type:"onboarding",    title:"Account Created",                      detail:"Basic plan self-serve. Onboarding chatbot guided full setup in one session." },
  ],
};

// ─── PROACTIVE HEALTH CENTER DATA ────────────────────────────────────────────

const HEALTH_ALERTS_DATA = [
  {
    id: "onboarding",
    title: "Onboarding Bottleneck",
    icon: Clock,
    prevention: "Prevents underestimating onboarding complexity",
    description: "New accounts not reaching Time-to-First-Value within 14 days",
    actionLabel: "Send Onboarding Nudge",
    borderColor: "border-amber-400",
    headerBg:   "bg-amber-50",
    textColor:  "text-amber-700",
    badgeCls:   "bg-amber-100 text-amber-700",
    btnCls:     "bg-amber-500 hover:bg-amber-600 text-white",
    dotColor:   "bg-amber-400",
    accounts: [
      { name: "Oliver Vance",      detail: "Day 14 · Setup only 62% complete",  meta: "Basic"   },
      { name: "Leo Sterling",      detail: "Day 18 · Setup only 45% complete",  meta: "Basic"   },
      { name: "Grace Kelly",       detail: "Day 11 · Setup 71%, no team invite", meta: "Premium" },
    ],
  },
  {
    id: "friction",
    title: "Predictive Friction",
    icon: Zap,
    prevention: "Prevents reactive support — outreach before tickets are filed",
    description: "Customers with repeated software errors signalling imminent friction",
    actionLabel: "Trigger Proactive Outreach",
    borderColor: "border-rose-400",
    headerBg:   "bg-rose-50",
    textColor:  "text-rose-700",
    badgeCls:   "bg-rose-100 text-rose-700",
    btnCls:     "bg-rose-500 hover:bg-rose-600 text-white",
    dotColor:   "bg-rose-400",
    accounts: [
      { name: "Elena Rostova", detail: "12 errors in 7 days · API timeout",  meta: "High" },
      { name: "David Miller",   detail: "7 errors in 5 days · Import failed",  meta: "Med"  },
      { name: "Lucas Vance",   detail: "4 errors in 3 days · Auth loop",     meta: "Low"  },
    ],
  },
  {
    id: "orphaned",
    title: "Orphaned Accounts",
    icon: UserX,
    prevention: "Prevents post-sale abandonment",
    description: "Active accounts with zero company communication in 30+ days",
    actionLabel: "Schedule Check-In",
    borderColor: "border-blue-400",
    headerBg:   "bg-blue-50",
    textColor:  "text-blue-700",
    badgeCls:   "bg-blue-100 text-blue-700",
    btnCls:     "bg-blue-500 hover:bg-blue-600 text-white",
    dotColor:   "bg-blue-400",
    accounts: [
      { name: "Jonathan Reynolds", detail: "38 days silent · Last: Email open",   meta: "Basic"      },
      { name: "Emma Harrison",     detail: "33 days silent · Last: QBR meeting",  meta: "Enterprise" },
      { name: "Lucas Vance",       detail: "31 days silent · Last: Onboarding",   meta: "Basic"      },
    ],
  },
  {
    id: "sentiment",
    title: "Sentiment Escalation",
    icon: MessageSquare,
    prevention: "Prevents ignoring negative feedback signals",
    description: "NLP-flagged accounts with urgent negative feedback requiring human follow-up",
    actionLabel: "Assign to CSM Queue",
    borderColor: "border-purple-400",
    headerBg:   "bg-purple-50",
    textColor:  "text-purple-700",
    badgeCls:   "bg-purple-100 text-purple-700",
    btnCls:     "bg-purple-500 hover:bg-purple-600 text-white",
    dotColor:   "bg-purple-400",
    accounts: [
      { name: "Sarah Jenkins",      detail: "\"Support is completely unresponsive...\"",    meta: "Critical" },
      { name: "Marcus Chen",        detail: "\"Considering cancelling our contract...\"",  meta: "High"     },
      { name: "David Miller",       detail: "\"Regression broke our entire workflow...\"", meta: "High"     },
    ],
  },
];

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

function ProactiveHealthCenter() {
  const [alerts, setAlerts] = useState([
    { id: 1, name: "Sarah Jenkins",      category: "Sentiment Escalation",   rar: 116440, risk: "Critical", badgeCls: "text-rose-700 bg-rose-50 border border-rose-100", actionLabel: "Assign CSM" },
    { id: 2, name: "Marcus Chen",        category: "Sentiment Escalation",   rar: 69580,  risk: "Critical", badgeCls: "text-rose-700 bg-rose-50 border border-rose-100", actionLabel: "Assign CSM" },
    { id: 3, name: "Elena Rostova",      category: "Predictive Friction",    rar: 35100,  risk: "At Risk",  badgeCls: "text-amber-700 bg-amber-50 border border-amber-100", actionLabel: "Outreach" },
    { id: 4, name: "Oliver Vance",       category: "Onboarding Bottleneck",  rar: 5640,   risk: "At Risk",  badgeCls: "text-amber-700 bg-amber-50 border border-amber-100", actionLabel: "Send Nudge" },
    { id: 5, name: "Emma Harrison",      category: "Orphaned Account",       rar: 21120,  risk: "At Risk",  badgeCls: "text-amber-700 bg-amber-50 border border-amber-100", actionLabel: "Schedule QBR" },
  ]);

  const handleAction = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

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
        <p className="text-[10px] text-slate-400">Updates live</p>
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
                  <button
                    onClick={() => handleAction(row.id)}
                    className="px-2.5 py-1 text-[10px] font-bold bg-white border border-gray-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded transition-colors shadow-sm cursor-pointer"
                  >
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

function DashboardView() {
  const { S, N, C, ARPU, promoters, detractors } = GLOBAL;
  const { E, retentionRate, churnRate, clv, nps } = computeMetrics(GLOBAL);
  const sortedCustomers = [...customers].sort((a, b) => b.rar - a.rar);
  const [runningId, setRunningId] = useState(null);

  return (
    <div className="space-y-6">
      {/* ── 1. KPI Cards (Very Top) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={ShieldCheck}  label="Retention Rate"    formulaKey="retention"
          value={`${retentionRate.toFixed(1)}%`}
          formulaHint={`((${E}−${N})÷${S})×100`}
          color="bg-gradient-to-br from-blue-600 to-indigo-600"
          trend="−1.2 pts vs last period"  trendUp={true}
        />
        <KpiCard
          icon={TrendingDown} label="Churn Rate"        formulaKey="churn"
          value={`${churnRate.toFixed(1)}%`}
          formulaHint={`(${C}÷${S})×100`}
          color="bg-gradient-to-br from-rose-500 to-rose-600"
          trend="+0.8 pts vs last period"  trendUp={true}
        />
        <KpiCard
          icon={DollarSign}   label="Subscription CLV"  formulaKey="clv"
          value={clv === Infinity ? "∞" : fmt(clv)}
          formulaHint={`$${ARPU.toLocaleString()}÷${(churnRate / 100).toFixed(3)}`}
          color="bg-gradient-to-br from-emerald-500 to-teal-600"
          trend="+$820 vs last quarter"    trendUp={false}
        />
        <KpiCard
          icon={Heart}        label="Net Promoter Score" formulaKey="nps"
          value={`${nps >= 0 ? "+" : ""}${nps}`}
          formulaHint={`${promoters}%−${detractors}% = ${nps >= 0 ? "+" : ""}${nps}`}
          color="bg-gradient-to-br from-purple-500 to-violet-600"
          trend="+3 pts vs last survey"    trendUp={false}
        />
      </div>

      {/* ── 2. Proactive Health Center Table ── */}
      <ProactiveHealthCenter />

      {/* ── 3. Charts Grid (Lifecycle & Completed Interventions) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lifecycle Pipeline Card */}
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Lifecycle Pipeline</h3>
              <p className="text-[10px] text-slate-400">Distribution of accounts by milestone stage</p>
            </div>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-gray-200">
              Total base: {customers.length}
            </span>
          </div>
          
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lifecycleData} layout="vertical" margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#475569", fontWeight: "bold" }} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 4, background: "#1e293b", color: "#fff", border: "none" }} />
                <Bar dataKey="count" fill="#475569" barSize={12} radius={[0, 2, 2, 0]}>
                  {lifecycleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STAGE_STYLE[entry.stage].hex} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Completed Interventions Card */}
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Intervention Success Trend</h3>
              <p className="text-[10px] text-slate-400">Churn prevention activities & saves over 7 days</p>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
              +10% recovery rate
            </span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValueB2b" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <Tooltip 
                  contentStyle={{ background: "#1e293b", border: "none", borderRadius: "4px", color: "#fff", fontSize: "10px" }}
                />
                <Area type="monotone" dataKey="value" stroke="#475569" strokeWidth={2} fillOpacity={1} fill="url(#colorValueB2b)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── 4. Priority Action List Table (Full Width) ── */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Priority Action List</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">High-risk accounts sorted descending by Revenue-at-Risk</p>
          </div>
          <button className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded shadow-sm transition-colors cursor-pointer">
            Run Batch Action
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-gray-200 uppercase font-semibold text-[10px]">
                <th className="px-4 py-2.5 text-left">Customer Name</th>
                <th className="px-4 py-2.5 text-left">Lifecycle Stage</th>
                <th className="px-4 py-2.5 text-right">Churn Probability (%)</th>
                <th className="px-4 py-2.5 text-right">Revenue-at-Risk ($)</th>
                <th className="px-4 py-2.5 text-left pl-6">Suggested Action</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedCustomers.map((c) => {
                const isRunning = runningId === c.id;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border
                        ${c.stage === "Retention" ? "bg-amber-50 text-amber-700 border-amber-100" :
                          c.stage === "Engagement" ? "bg-blue-50 text-blue-700 border-blue-100" :
                          c.stage === "Onboarding" ? "bg-purple-50 text-purple-700 border-purple-100" :
                                                     "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
                        {c.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-mono font-bold ${c.churn > 65 ? "text-rose-600" : c.churn > 45 ? "text-amber-600" : "text-emerald-600"}`}>
                          {c.churn}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">
                      {fmtFull(c.rar)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs pl-6 max-w-[280px] truncate">
                      {c.action}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => setRunningId(isRunning ? null : c.id)}
                        className={`px-3 py-1 text-[10px] font-bold rounded border transition-colors shadow-sm cursor-pointer
                          ${isRunning 
                            ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200" 
                            : "bg-white border-gray-300 text-slate-700 hover:bg-slate-50"}`}
                      >
                        {isRunning ? "Stop" : "Resolve"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. Formula Guide Accordion ── */}
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

function Customer360View() {
  const [selectedId, setSelectedId] = useState(customers[0].id);
  const customer = customers.find(c => c.id === selectedId);

  // Grouped stages accordion state
  const [openStages, setOpenStages] = useState({
    Onboarding: true,
    Engagement: true,
    Retention: true,
    Loyalty: true,
  });

  const toggleStage = (stage) => {
    setOpenStages(prev => ({ ...prev, [stage]: !prev[stage] }));
  };

  const getAiRecommendation = (c) => {
    switch (c.id) {
      case 1:
        return {
          diagnosis: "Contract renewal risk identified. Customer has missed the last two renewal meetings and usage has plummeted 62% in the last 14 days.",
          actionLabel: "Route to CSM Escalation",
        };
      case 2:
        return {
          diagnosis: "Price sensitivity signal detected. Customer made a downgrade query on live chat and features are underutilized.",
          actionLabel: "Send 'Soft Landing' Offer",
        };
      case 3:
        return {
          diagnosis: "Value forgetting gap. Elena Rostova is using only 2 of their 7 Premium features and has been inactive for 8 days.",
          actionLabel: "Generate Year-in-Review Digest",
        };
      case 4:
        return {
          diagnosis: "Billing error detected. Smart retry failed for recurring invoice. Immediate payment profile update required.",
          actionLabel: "Trigger Dunning Sequence",
        };
      case 5:
        return {
          diagnosis: "Account orphaned. High risk of contraction as champion left the company and new users have not completed re-onboarding.",
          actionLabel: "Assign Emergency CSM",
        };
      case 6:
        return {
          diagnosis: "Onboarding bottleneck. Client has setup only 62% of their portal within the first 14 days, risking early churn.",
          actionLabel: "Trigger Product Tour",
        };
      case 7:
        return {
          diagnosis: "High-loyalty expansion indicator. Strong referral rate and high feedback participation suggest upsell readiness.",
          actionLabel: "Grant Early Beta Access",
        };
      default:
        return {
          diagnosis: `Customer is in ${c.stage} stage with health index at ${c.health}. Standard retention protocol recommended.`,
          actionLabel: "Send Value Digest",
        };
    }
  };

  const groupedCustomers = {
    Onboarding: customers.filter(c => c.stage === "Onboarding"),
    Engagement: customers.filter(c => c.stage === "Engagement"),
    Retention: customers.filter(c => c.stage === "Retention"),
    Loyalty: customers.filter(c => c.stage === "Loyalty"),
  };

  const rec = customer ? getAiRecommendation(customer) : null;

  return (
    <div className="flex gap-6 items-start">
      {/* Sidebar collapsible stages list */}
      <div className="w-64 flex-shrink-0 bg-white rounded-md border border-gray-200 overflow-hidden select-none sticky top-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-slate-50">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Account Directory</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{customers.length} accounts mapped</p>
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-210px)] divide-y divide-gray-200">
          {Object.entries(groupedCustomers).map(([stageName, list]) => {
            const isOpen = openStages[stageName];
            return (
              <div key={stageName} className="flex flex-col">
                <button
                  onClick={() => toggleStage(stageName)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-gray-200 text-left text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-400 font-bold w-3 inline-block">{isOpen ? "▼" : "▶"}</span>
                    <span className="uppercase tracking-wider text-[10px]">{stageName}</span>
                    <span className="text-[9px] text-slate-400 font-semibold">({list.length})</span>
                  </span>
                </button>
                
                {isOpen && (
                  <div className="divide-y divide-gray-100 bg-white">
                    {list.map(c => {
                      const sel = c.id === selectedId;
                      const mrr = Math.round(c.ltv / 12);
                      const healthColor = c.health < 40 ? "bg-rose-500" : c.health < 60 ? "bg-amber-500" : "bg-emerald-500";
                      return (
                        <button key={c.id} onClick={() => setSelectedId(c.id)}
                          className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-slate-50/50 cursor-pointer flex items-center justify-between ${sel ? "bg-slate-50" : ""}`}
                          style={{ borderLeft: sel ? `3px solid #2563eb` : "3px solid transparent" }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${healthColor}`} />
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${sel ? "text-blue-650" : "text-slate-800"}`}>{c.name}</p>
                              <p className="text-[9px] text-slate-400 font-semibold uppercase">{c.tier}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-650 flex-shrink-0">
                            ${mrr.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 360 Profile */}
      {customer && (
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-slate-100 border border-gray-200 flex items-center justify-center text-slate-700 font-bold text-base shadow-sm">
                  {customer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{customer.name}</h2>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[9px] font-bold bg-slate-100 text-slate-700 border border-gray-200 px-2 py-0.5 rounded uppercase">
                      {customer.segment}
                    </span>
                    <TierBadge tier={customer.tier} />
                    <HealthBadge score={customer.health} />
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Revenue-at-Risk</p>
                <p className="text-lg font-bold font-mono text-rose-600 mt-0.5">
                  {fmtFull(customer.rar)}
                </p>
              </div>
            </div>

            {/* Stage Tracker */}
            <div className="border border-gray-200 rounded p-4 bg-slate-50/50">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-4">Customer Lifecycle Journey</p>
              <StageTracker stageIdx={customer.stageIdx} />
            </div>
          </div>

          {/* AI Recommendation Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-md p-4 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">AI Recommendation Engine</span>
              </div>
              <h4 className="text-xs font-bold text-slate-200">DIAGNOSIS</h4>
              <p className="text-xs text-slate-350 leading-relaxed max-w-xl">
                {rec.diagnosis}
              </p>
            </div>
            <button className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded shadow transition-colors cursor-pointer w-full sm:w-auto text-center">
              {rec.actionLabel}
            </button>
          </div>

          {/* Stage-Specific Metrics */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <StageMetricsPanel customer={customer} />
          </div>

          {/* Account Stats + Recent Signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1.5 font-semibold">Account Metrics</p>
              <div className="space-y-0.5">
                {[
                  { label: "Churn Probability", value: `${customer.churn}%`, cls: customer.churn > 65 ? "text-rose-600" : customer.churn > 45 ? "text-amber-600" : "text-emerald-600" },
                  { label: "Lifetime Value",    value: fmtFull(customer.ltv), cls: "text-blue-600" },
                  { label: "Customer Segment",  value: customer.segment,      cls: "text-purple-600" },
                  { label: "Health Score",      value: `${customer.health}/100`, cls: "text-slate-700" },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 text-xs">
                    <span className="text-slate-500">{r.label}</span>
                    <span className={`font-bold ${r.cls}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-md border border-gray-200 p-4">
              <p className="text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1.5 font-semibold">Recent Signals</p>
              <div className="space-y-1.5">
                {customer.events.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 inline-block"
                      style={{ background: STAGE_STYLE[customer.stage].hex }} />
                    <p className="text-xs text-slate-600 leading-relaxed">{ev}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2.5 border-t border-gray-100 text-xs">
                <p className="text-slate-500"><span className="font-bold text-slate-700">Recommended Action:</span> {customer.action}</p>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <CustomerTimeline events={CUSTOMER_HISTORIES[customer.id] ?? []} />
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

function InsightsView() {
  const cohortRiskData = [
    { name: "Europe Enterprise Tier", accounts: 12, probability: 25, loss: 150000, color: "#3b82f6" },
    { name: "Basic Plan Users", accounts: 142, probability: 48, loss: 116400, color: "#a855f7" },
    { name: "Stuck in Onboarding", accounts: 89, probability: 65, loss: 92860, color: "#f43f5e" },
    { name: "High Ticket Inquiries", accounts: 18, probability: 30, loss: 78500, color: "#10b981" },
    { name: "Inactive Integrations", accounts: 42, probability: 75, loss: 54200, color: "#f59e0b" },
  ];

  const totalLoss = cohortRiskData.reduce((acc, curr) => acc + curr.loss, 0);

  return (
    <div className="space-y-6">
      {/* Top Card: Summary */}
      <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute -right-4 -bottom-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="relative flex items-start gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-inner">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Momentum Macro Forecast</p>
            <h3 className="text-lg font-bold text-white mb-1">
              Total Segment Revenue At-Risk: <span className="text-yellow-300 font-mono">${totalLoss.toLocaleString()}</span> ARR
            </h3>
            <p className="text-xs text-slate-350 leading-relaxed max-w-2xl">
              Cohort-level analysis flags <strong>Europe Enterprise Tier</strong> and <strong>Basic Plan Users</strong> as our highest financial risks. Standardized playbooks could salvage up to 60% of this exposure.
            </p>
          </div>
        </div>
      </div>

      {/* Cohort Risk Analysis Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Cohort Risk Analysis</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Macro segmentation metrics and risk classification</p>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded font-mono">5 Active Cohorts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200 text-slate-400">
                <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-left">Cohort Name</th>
                <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-center">Total Accounts</th>
                <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-center">Churn Probability</th>
                <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-right">Forecasted Revenue Loss (ARR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {cohortRiskData.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                    {row.name}
                  </td>
                  <td className="px-5 py-3.5 text-center font-semibold text-slate-600 font-mono">{row.accounts}</td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-slate-700 font-bold font-mono">{row.probability}%</span>
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full rounded-full" style={{ width: `${row.probability}%`, backgroundColor: row.color }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-extrabold text-slate-900 text-sm font-mono">
                    ${row.loss.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Chart Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-0.5">Revenue Impact chart</h3>
          <p className="text-[10px] text-slate-400 mb-6">Visual comparison of forecasted ARR loss per cohort segment</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={cohortRiskData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b", fontWeight: 600 }} stroke="#e2e8f0" />
            <YAxis tickFormatter={(v) => `$${v/1000}k`} tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
            <Tooltip 
              formatter={(value) => [`$${value.toLocaleString()}`, "Forecasted ARR Loss"]}
              labelStyle={{ fontWeight: "bold", color: "#0f172a" }}
              contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            />
            <Bar dataKey="loss">
              {cohortRiskData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} radius={[4, 4, 0, 0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SliderRow({ label, formulaVar, min, max, step, value, onChange, formatFn, color = "#3b82f6" }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <label className="font-bold text-slate-700 flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-100 border border-gray-200 text-slate-700 font-mono text-[10px] font-bold">{formulaVar}</span>
          {label}
        </label>
        <span className="font-bold text-slate-900">{formatFn(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        style={{ accentColor: color }}
      />
      <div className="flex justify-between text-[9px] font-semibold text-slate-400 mt-0.5 font-mono">
        <span>{formatFn(min)}</span><span>{formatFn(max)}</span>
      </div>
    </div>
  );
}

function MetricOutputCard({ label, formulaKey, value, breakdown, colorClass, bgClass, borderClass }) {
  return (
    <div className={`rounded border ${borderClass} ${bgClass} p-3`}>
      <div className="flex items-center gap-1 mb-1.5">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>{label}</p>
        <FormulaTooltip formulaKey={formulaKey} side="bottom" />
      </div>
      <p className={`text-2xl font-bold tracking-tight ${colorClass} mb-1`}>{value}</p>
      <p className="text-[10px] text-slate-500 font-mono leading-relaxed">{breakdown}</p>
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
                      <button className="text-[9px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 px-2 py-0.5 rounded transition-all cursor-pointer font-semibold">
                        Route
                      </button>
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

function ActionsView() {
  const [boardData, setBoardData] = useState({
    product: [
      { id: "p1", title: "Fix API timeout bug affecting 12 accounts", priority: "Critical", impact: "High", rar: 122000 },
      { id: "p2", title: "Resolve SSO login loop for Enterprise clients", priority: "High", impact: "Medium", rar: 85000 },
    ],
    sales: [
      { id: "s1", title: "Generate counter-offer campaign for RivalTech move", priority: "High", impact: "High", rar: 69000 },
      { id: "s2", title: "Setup onboarding pricing revisions", priority: "Medium", impact: "Low", rar: 29000 },
    ],
    cs: [
      { id: "c1", title: "Schedule manual check-ins with top 5 Enterprise", priority: "Critical", impact: "High", rar: 150000 },
      { id: "c2", title: "Conduct QBR for Emma Harrison's team", priority: "Medium", impact: "Medium", rar: 41000 },
    ],
  });

  const [toast, setToast] = useState(null);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = (taskTitle, actionType) => {
    if (actionType === "brief") {
      triggerToast(`📄 Department Brief generated for "${taskTitle}"`);
    } else if (actionType === "sync") {
      triggerToast(`⚡ Synced "${taskTitle}" to Jira / Salesforce`);
    }
  };

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
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Action Routing Triage</p>
            <h3 className="text-lg font-bold text-white mb-1">
              Cross-Functional Department Briefs
            </h3>
            <p className="text-xs text-slate-355 leading-relaxed max-w-2xl text-left">
              Route churn indicators directly to responsible departments. Track critical actions across Product, Sales, and Customer Success queues to resolve revenue risks before contraction.
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Column 1: Product & Engineering */}
        <div className="bg-slate-100/60 rounded-xl p-4 border border-gray-200/80 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Product &amp; Engineering</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-205 px-2 py-0.5 rounded-full font-mono">{boardData.product.length} Tasks</span>
          </div>
          <div className="space-y-3">
            {boardData.product.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 hover:border-blue-500/50 transition-colors text-left">
                <div className="flex justify-between items-start gap-2">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    item.priority === "Critical" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }`}>{item.priority}</span>
                  <span className="text-[10px] font-bold text-slate-900 font-mono">${item.rar.toLocaleString()} RAR</span>
                </div>
                <p className="text-xs font-bold text-slate-800 leading-snug">{item.title}</p>
                <div className="flex gap-2 pt-2 border-t border-gray-150">
                  <button 
                    onClick={() => handleAction(item.title, "brief")}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Brief
                  </button>
                  <button 
                    onClick={() => handleAction(item.title, "sync")}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Sync Jira
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Sales & Marketing */}
        <div className="bg-slate-100/60 rounded-xl p-4 border border-gray-200/80 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Sales &amp; Marketing</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-205 px-2 py-0.5 rounded-full font-mono">{boardData.sales.length} Tasks</span>
          </div>
          <div className="space-y-3">
            {boardData.sales.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 hover:border-blue-500/50 transition-colors text-left">
                <div className="flex justify-between items-start gap-2">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    item.priority === "High" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                  }`}>{item.priority}</span>
                  <span className="text-[10px] font-bold text-slate-900 font-mono">${item.rar.toLocaleString()} RAR</span>
                </div>
                <p className="text-xs font-bold text-slate-805 leading-snug">{item.title}</p>
                <div className="flex gap-2 pt-2 border-t border-gray-150">
                  <button 
                    onClick={() => handleAction(item.title, "brief")}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Brief
                  </button>
                  <button 
                    onClick={() => handleAction(item.title, "sync")}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Sync Salesforce
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Customer Success */}
        <div className="bg-slate-100/60 rounded-xl p-4 border border-gray-200/80 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Customer Success</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-205 px-2 py-0.5 rounded-full font-mono">{boardData.cs.length} Tasks</span>
          </div>
          <div className="space-y-3">
            {boardData.cs.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 hover:border-blue-500/50 transition-colors text-left">
                <div className="flex justify-between items-start gap-2">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    item.priority === "Critical" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                  }`}>{item.priority}</span>
                  <span className="text-[10px] font-bold text-slate-900 font-mono">${item.rar.toLocaleString()} RAR</span>
                </div>
                <p className="text-xs font-bold text-slate-805 leading-snug">{item.title}</p>
                <div className="flex gap-2 pt-2 border-t border-gray-150">
                  <button 
                    onClick={() => handleAction(item.title, "brief")}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Brief
                  </button>
                  <button 
                    onClick={() => handleAction(item.title, "sync")}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Sync CS
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
  { id: "customers",  label: "Customer 360", icon: Users           },
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
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab]     = useState("dashboard");
  const [transitioning, setTransit]   = useState(false);

  const handleTabChange = id => {
    if (id === activeTab) return;
    setTransit(true);
    setTimeout(() => { setActiveTab(id); setTransit(false); }, 180);
  };

  const renderView = () => {
    switch (activeTab) {
      case "dashboard":  return <DashboardView />;
      case "customers":  return <Customer360View />;
      case "insights":   return <InsightsView />;
      case "actions":    return <ActionsView />;
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


