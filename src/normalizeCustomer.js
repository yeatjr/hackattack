// ─── Canonical Fields ─────────────────────────────────────────────────────────

export const CANONICAL_FIELDS = [
  // 1. Basic Info
  "customerId", "name", "email", "phone", "company", "jobTitle",
  "industry", "companySize", "country", "timezone", "joinDate", "signupSource",
  // 2. Package & Financials
  "package", "packagePrice", "billingCycle", "totalPaid", "lastPaymentDate",
  "paymentMethod", "paymentStatus", "discountApplied", "upsellFlag",
  // 3. Product Usage & Activity
  "lastLoginDate", "loginFrequency", "sessionsPerWeek", "avgSessionDuration",
  "featuresUsed", "lastFeatureUsed", "coreFeatureAdoption", "seatsLicensed",
  "seatsActive", "integrationsConnected", "dataVolumeUsed", "mobileVsWebUsage",
  // 4. Product Feedback
  "customFeatureRequests", "bugReportsSubmitted", "betaProgramParticipant", "surveyResponses"
];

// ─── Alias Map ────────────────────────────────────────────────────────────────
// All keys are lowercased with spaces/underscores/dashes removed.
// Maps → canonical field name.

const ALIAS_MAP = {
  // Basic Info
  customerid: "customerId", id: "customerId", custid: "customerId",
  name: "name", fullname: "name", customername: "name", clientname: "name",
  email: "email", emailaddress: "email", mail: "email",
  phone: "phone", phonenumber: "phone", mobile: "phone", tel: "phone",
  company: "company", companyname: "company", organization: "company", org: "company",
  jobtitle: "jobTitle", title: "jobTitle", role: "jobTitle", position: "jobTitle",
  industry: "industry", vertical: "industry", sector: "industry",
  companysize: "companySize", size: "companySize", employees: "companySize", employeecount: "companySize",
  country: "country", region: "country", location: "country",
  timezone: "timezone", tz: "timezone",
  joindate: "joinDate", signupdate: "joinDate", createdat: "joinDate", startdate: "joinDate",
  signupsource: "signupSource", source: "signupSource", acquisitionchannel: "signupSource",

  // Package & Financials
  package: "package", plan: "package", tier: "package", subscription: "package",
  packageprice: "packagePrice", price: "packagePrice", mrr: "packagePrice", monthlyprice: "packagePrice",
  billingcycle: "billingCycle", cycle: "billingCycle", billingperiod: "billingCycle",
  totalpaid: "totalPaid", ltv: "totalPaid", lifetimevalue: "totalPaid", amountpaid: "totalPaid", totalrevenue: "totalPaid",
  lastpaymentdate: "lastPaymentDate", lastpayment: "lastPaymentDate", lastbilled: "lastPaymentDate",
  paymentmethod: "paymentMethod", paymenttype: "paymentMethod",
  paymentstatus: "paymentStatus", billingstatus: "paymentStatus", status: "paymentStatus",
  discountapplied: "discountApplied", discount: "discountApplied", coupon: "discountApplied",
  upsellflag: "upsellFlag", upsellopportunity: "upsellFlag", upsell: "upsellFlag",

  // Product Usage
  lastlogindate: "lastLoginDate", lastlogin: "lastLoginDate", lastactive: "lastLoginDate", lastseen: "lastLoginDate",
  loginfrequency: "loginFrequency", loginsperweek: "loginFrequency", loginspermonth: "loginFrequency",
  sessionsperweek: "sessionsPerWeek", weeklysessions: "sessionsPerWeek",
  avgsessionduration: "avgSessionDuration", sessionduration: "avgSessionDuration", avgtime: "avgSessionDuration",
  featuresused: "featuresUsed", featurecount: "featuresUsed", distinctfeaturesused: "featuresUsed",
  lastfeatureused: "lastFeatureUsed", lastfeature: "lastFeatureUsed", recentfeature: "lastFeatureUsed",
  corefeatureadoption: "coreFeatureAdoption", coreadoption: "coreFeatureAdoption", adoptionrate: "coreFeatureAdoption",
  seatslicensed: "seatsLicensed", totalseats: "seatsLicensed", licenses: "seatsLicensed",
  seatsactive: "seatsActive", activeseats: "seatsActive",
  integrationsconnected: "integrationsConnected", integrations: "integrationsConnected", connectedapps: "integrationsConnected",
  datavolumeused: "dataVolumeUsed", storageused: "dataVolumeUsed", datavolume: "dataVolumeUsed", storage: "dataVolumeUsed",
  mobilevswebusage: "mobileVsWebUsage", platformsplit: "mobileVsWebUsage", devicesplit: "mobileVsWebUsage",

  // Product Feedback
  customfeaturerequests: "customFeatureRequests", featurerequests: "customFeatureRequests", requests: "customFeatureRequests",
  bugreportssubmitted: "bugReportsSubmitted", bugreports: "bugReportsSubmitted", bugs: "bugReportsSubmitted",
  betaprogramparticipant: "betaProgramParticipant", betatester: "betaProgramParticipant", inbeta: "betaProgramParticipant",
  surveyresponses: "surveyResponses", feedback: "surveyResponses", surveys: "surveyResponses", npsscore: "surveyResponses"
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeKey(raw) {
  return String(raw).toLowerCase().replace(/[\s_\-\.]+/g, "");
}

function deriveStage(customer) {
  const joinDate = customer.joinDate ? new Date(customer.joinDate) : null;
  const daysSinceJoin = joinDate
    ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24))
    : 365;
  if (daysSinceJoin < 30) return "Onboarding";
  const features = parseInt(customer.featuresUsed, 10) || 0;
  if (features > 10) return "Loyalty";
  if (features > 3) return "Engagement";
  return "Retention";
}

function deriveIsPremiumActive(customer) {
  const pkg = String(customer.package || "").toLowerCase();
  const status = String(customer.paymentStatus || "").toLowerCase();
  if (status === "cancelled" || status === "inactive" || status === "none") return false;
  return pkg.includes("level") || (pkg !== "free" && pkg !== "basic" && pkg !== "none" && pkg !== "");
}

function deriveAnalytics(c) {
  // Parsing metrics
  const freq = parseFloat(c.loginFrequency) || 0;
  const sessions = parseFloat(c.sessionsPerWeek) || 0;
  const adopt = parseFloat(c.coreFeatureAdoption) || 0;
  const price = parseFloat((c.packagePrice || "").replace(/[^0-9.]/g, "")) || 0;
  const activeSeats = parseFloat(c.seatsActive) || 0;
  const totalSeats = parseFloat(c.seatsLicensed) || 0;
  const isOverdue = String(c.paymentStatus || "").toLowerCase() === "overdue";
  
  // Health Score (0-100)
  let health = 100;
  if (sessions < 2) health -= 20;
  if (adopt < 50) health -= 30;
  if (isOverdue) health -= 20;
  health = Math.max(0, Math.min(100, health));

  // Churn Probability (%)
  let churnRisk = 10;
  if (health < 50) churnRisk += 40;
  if (sessions === 0) churnRisk += 30;
  if (isOverdue) churnRisk += 20;
  churnRisk = Math.max(0, Math.min(100, churnRisk));

  // Revenue at Risk
  const revenueRisk = (churnRisk / 100) * price;

  // Expansion Score
  let expansion = 0;
  const seatUtil = totalSeats > 0 ? (activeSeats / totalSeats) * 100 : 0;
  if (seatUtil > 80) expansion += 50;
  if (adopt > 80) expansion += 30;
  if (health > 80) expansion += 20;

  // AI Recommendation
  let recommendation = "Monitor Account";
  if (churnRisk > 70) recommendation = "Urgent: Schedule Intervention & Offer Discount";
  else if (expansion > 80) recommendation = "Ready for Upsell: Offer Level 4 Plan or More Seats";
  else if (health < 60) recommendation = "Needs Onboarding/Training Workshop";
  else if (health >= 80) recommendation = "Healthy: Ask for Referral or NPS Review";

  return {
    healthScore: health,
    churnProbability: churnRisk,
    revenueAtRisk: revenueRisk,
    expansionScore: expansion,
    aiRecommendation: recommendation
  };
}

// ─── Main normalization function ─────────────────────────────────────────────

/**
 * Normalizes a single raw row from an Excel/CSV file.
 * @param {object} rawRow   - Raw object with original column names
 * @returns {{ canonical: object, unmappedKeys: string[] }}
 */
export function normalizeRow(rawRow) {
  const canonical = { others: {} };
  const unmappedKeys = [];

  for (const [key, value] of Object.entries(rawRow)) {
    if (value === undefined || value === null || String(value).trim() === "") continue;
    const nk = normalizeKey(key);
    if (ALIAS_MAP[nk]) {
      canonical[ALIAS_MAP[nk]] = String(value).trim();
    } else {
      canonical.others[key] = String(value).trim();
      unmappedKeys.push(key);
    }
  }

  canonical.isPremiumActive = deriveIsPremiumActive(canonical);
  canonical.stage = deriveStage(canonical);
  canonical.stageIdx = ["Onboarding", "Engagement", "Retention", "Loyalty"].indexOf(canonical.stage);
  
  // Advanced Analytics
  Object.assign(canonical, deriveAnalytics(canonical));

  return { canonical, unmappedKeys };
}

/**
 * Applies admin-defined extra mappings (from the Column Mapper UI).
 * Moves fields from others → canonical field locations.
 * @param {object} canonical     - Already normalized canonical row
 * @param {object} extraMappings - { originalColumnName: canonicalFieldName | "__others__" }
 * @returns {object} Updated canonical row
 */
export function applyMapping(canonical, extraMappings) {
  const result = { ...canonical, others: { ...canonical.others } };
  for (const [origKey, targetField] of Object.entries(extraMappings)) {
    if (result.others[origKey] !== undefined && targetField && targetField !== "__others__") {
      result[targetField] = result.others[origKey];
      delete result.others[origKey];
    }
  }
  // Re-derive after remapping
  result.isPremiumActive = deriveIsPremiumActive(result);
  result.stage = deriveStage(result);
  result.stageIdx = ["Onboarding", "Engagement", "Retention", "Loyalty"].indexOf(result.stage);
  Object.assign(result, deriveAnalytics(result));
  return result;
}

/**
 * Returns which canonical field a raw column name maps to (or null if unmapped).
 */
export function getCanonicalForRawKey(rawKey) {
  return ALIAS_MAP[normalizeKey(rawKey)] || null;
}
