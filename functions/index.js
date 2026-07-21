const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Auth Middleware: Validate API Key
const authenticateAPIKey = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const apiKey = authHeader.split('Bearer ')[1];
  
  try {
    const companiesSnapshot = await db.collection("companies").where("api_key", "==", apiKey).limit(1).get();
    
    if (companiesSnapshot.empty) {
      return res.status(403).json({ error: "Invalid API Key" });
    }
    
    req.company = { id: companiesSnapshot.docs[0].id, ...companiesSnapshot.docs[0].data() };
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(500).json({ error: "Internal Server Error during authentication" });
  }
};

// POST /events endpoint
app.post("/events", authenticateAPIKey, async (req, res) => {
  const { event, customer, subscription, timestamp } = req.body;
  const companyId = req.company.id;

  if (!event || !customer || !customer.id) {
    return res.status(400).json({ error: "Invalid event payload. Requires 'event' and 'customer.id'" });
  }

  try {
    // 1. Store the raw event in the Event Log
    const eventDocRef = await db.collection("events").add({
      company_id: companyId,
      customer_id: customer.id,
      event: event,
      customer_email: customer.email || null,
      subscription_plan: subscription?.plan || null,
      subscription_price: subscription?.price || 0,
      timestamp: timestamp || new Date().toISOString(),
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Update the Customer View table (Materialized View)
    // We update the specific customer with latest info.
    const customerRef = db.collection("customers").doc(customer.id);
    const customerSnapshot = await customerRef.get();
    
    let updates = {
      name: customer.name || customer.email || "Unknown Customer",
      email: customer.email || "unknown@example.com",
      company_id: companyId,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Apply specific business logic based on event type
    switch (event) {
      case "subscription_started":
      case "subscription_renewed":
      case "subscription_upgraded":
        updates.isPremiumActive = true;
        updates.package = subscription?.plan || "Premium";
        updates.packagePrice = subscription?.price || 0;
        // Decrease churn probability on positive events
        updates.churnProbability = customerSnapshot.exists ? Math.max(5, (customerSnapshot.data().churnProbability || 50) - 20) : 10;
        break;
      case "subscription_cancelled":
        updates.isPremiumActive = false;
        updates.churnProbability = 100;
        break;
      case "login":
        updates.lastLoginDate = timestamp || new Date().toISOString();
        break;
      case "feature_used":
        updates.premiumFeaturesUsed = admin.firestore.FieldValue.increment(1);
        updates.usageScore = admin.firestore.FieldValue.increment(5);
        updates.churnProbability = customerSnapshot.exists ? Math.max(5, (customerSnapshot.data().churnProbability || 50) - 5) : 45;
        break;
      default:
        // No specific updates for other events
        break;
    }

    // Merge updates into the customer doc
    await customerRef.set(updates, { merge: true });

    return res.status(200).json({ 
      success: true, 
      message: `Event '${event}' processed successfully`,
      event_id: eventDocRef.id
    });
    
  } catch (error) {
    console.error("Error processing event:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Expose the Express API under 'api/v1' path
exports.api = functions.https.onRequest(app);
