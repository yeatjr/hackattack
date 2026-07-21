// ─── Canonical Fields ─────────────────────────────────────────────────────────

export const CANONICAL_FIELDS = [
  "name", "email", "phone", "company", "country", "joinDate",
  "package", "packagePrice", "totalPaid", "lastPaymentDate", "paymentStatus",
  "lastLoginDate", "premiumFeaturesUsed", "lastFeatureUsed", "sessionsPerWeek",
  "usageScore", "churnProbability",
];

// ─── Alias Map ────────────────────────────────────────────────────────────────
// All keys are lowercased with spaces/underscores/dashes removed.
// Maps → canonical field name.

const ALIAS_MAP = {
  // name
  name: "name", custname: "name", customer: "name", fullname: "name",
  customername: "name", clientname: "name", client: "name", cust: "name",
  accountname: "name",
  // email
  email: "email", emailaddress: "email", emai: "email", mail: "email",
  emailid: "email",
  // phone
  phone: "phone", phonenumber: "phone", contact: "phone", mobile: "phone",
  tel: "phone", telephone: "phone", cellphone: "phone", contactnumber: "phone",
  // company
  company: "company", org: "company", organization: "company", account: "company",
  organisation: "company", companyname: "company", firm: "company", businessname: "company",
  // country
  country: "country", region: "country", location: "country", countryregion: "country",
  nation: "country", geography: "country",
  // joinDate
  joindate: "joinDate", signupdate: "joinDate", createdat: "joinDate",
  startdate: "joinDate", created: "joinDate", start: "joinDate",
  registrationdate: "joinDate", membersincedate: "joinDate", accountcreated: "joinDate",
  // package
  package: "package", plan: "package", tier: "package", subscription: "package",
  product: "package", plantype: "package", subscriptionplan: "package", pricingplan: "package",
  // packagePrice
  packageprice: "packagePrice", price: "packagePrice", mrr: "packagePrice",
  monthlyrevenue: "packagePrice", planprice: "packagePrice", monthlyprice: "packagePrice",
  monthlyrate: "packagePrice", subscriptionprice: "packagePrice",
  // totalPaid
  totalpaid: "totalPaid", ltv: "totalPaid", lifetimevalue: "totalPaid",
  totalrevenue: "totalPaid", amountpaid: "totalPaid", revenue: "totalPaid",
  totalspent: "totalPaid", lifetimerevenue: "totalPaid", totalamount: "totalPaid",
  // lastPaymentDate
  lastpaymentdate: "lastPaymentDate", lastbilled: "lastPaymentDate",
  paymentdate: "lastPaymentDate", lastpayment: "lastPaymentDate",
  billingdate: "lastPaymentDate", lastbillingdate: "lastPaymentDate",
  // paymentStatus
  paymentstatus: "paymentStatus", billingstatus: "paymentStatus",
  subscriptionstatus: "paymentStatus", status: "paymentStatus",
  accountstatus: "paymentStatus", billingstate: "paymentStatus",
  // lastLoginDate
  lastlogindate: "lastLoginDate", lastseen: "lastLoginDate", lastactive: "lastLoginDate",
  lastlogin: "lastLoginDate", lastvisit: "lastLoginDate", lastaccess: "lastLoginDate",
  lastactivity: "lastLoginDate",
  // premiumFeaturesUsed
  premiumfeaturesused: "premiumFeaturesUsed", featuresused: "premiumFeaturesUsed",
  activefeatures: "premiumFeaturesUsed", featuresactive: "premiumFeaturesUsed",
  numfeaturesused: "premiumFeaturesUsed", featurecount: "premiumFeaturesUsed",
  featuresutilized: "premiumFeaturesUsed",
  // lastFeatureUsed
  lastfeatureused: "lastFeatureUsed", lastfeature: "lastFeatureUsed",
  recentfeature: "lastFeatureUsed", mostusedfeature: "lastFeatureUsed",
  lastusedfeature: "lastFeatureUsed",
  // sessionsPerWeek
  sessionsperweek: "sessionsPerWeek", weeklysessions: "sessionsPerWeek",
  loginfrequency: "sessionsPerWeek", sessions: "sessionsPerWeek",
  weeklylogins: "sessionsPerWeek", avgweeklysessions: "sessionsPerWeek",
  sessionfrequency: "sessionsPerWeek",
  // usageScore
  usagescore: "usageScore", engagementscore: "usageScore", healthscore: "usageScore",
  health: "usageScore", score: "usageScore", engagementindex: "usageScore",
  healthindex: "usageScore",
  // churnProbability
  churnprobability: "churnProbability", churn: "churnProbability",
  churnrisk: "churnProbability", churnrate: "churnProbability",
  churnpct: "churnProbability", churnpercent: "churnProbability", churnindex: "churnProbability",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeKey(raw) {
  return String(raw).toLowerCase().replace(/[\s_\-\.]+/g, "");
}

function deriveStage(customer) {
  const score = parseFloat(customer.usageScore) || 50;
  const joinDate = customer.joinDate ? new Date(customer.joinDate) : null;
  const daysSinceJoin = joinDate
    ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24))
    : 365;
  if (daysSinceJoin < 30) return "Onboarding";
  if (score >= 70) return "Loyalty";
  if (score >= 50) return "Engagement";
  return "Retention";
}

function deriveIsPremiumActive(customer) {
  const lastLogin = customer.lastLoginDate ? new Date(customer.lastLoginDate) : null;
  const daysSinceLogin = lastLogin
    ? Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;
  const featuresUsed = parseInt(customer.premiumFeaturesUsed, 10) || 0;
  return daysSinceLogin <= 30 && featuresUsed > 0;
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
  return result;
}

/**
 * Returns which canonical field a raw column name maps to (or null if unmapped).
 */
export function getCanonicalForRawKey(rawKey) {
  return ALIAS_MAP[normalizeKey(rawKey)] || null;
}
