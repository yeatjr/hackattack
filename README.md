<h1 align="center">🌊 Momentum</h1>

<h4 align="center">
  Built for <i>HackAttack — Route to Kampar Momentum</i><br>
  Category 2: Smart Subscription & Customer Experience Optimisation
</h4>

<p align="center">
  <strong>Team:</strong> Yeat Jing Rong, Toh Shee Thong, Yon Yu Ki, Beh Kah Meng
</p>

<div align="center">

| Resource | Link |
|----------|------|
| 🌐 **Live Prototype** | https://hackattack-6d7de.web.app/ |
| 📖 **Documentation** | https://hackattack-6d7de.web.app/ |
| 📽️ **Presentation Video** | https://hackattack-6d7de.web.app/ |
| 🎥 **Demo Video** | https://youtu.be/swGAI40E24w |
| 📊 **Presentation Slides** | https://hackattack-6d7de.web.app/ |
| 📄 **Seed Customer Data** | https://hackattack-6d7de.web.app/ |

</div>

### The retention command center that sees churn coming — before the cancellation email does.

---

## 💡 Inspiration

Somewhere right now, a Customer Success Manager is toggling between six browser tabs — a helpdesk queue, a usage dashboard, a CRM, a spreadsheet of "at-risk accounts," and a Slack thread titled *"can someone check on Acme Corp??"*

None of those tools are broken. But none of them talk to each other either. And in that silence, warning signs quietly pile up: a support ticket here, a login-loop bug there, a competitor's name dropped in a chat transcript. By the time someone connects the dots, the customer has already started evaluating RivalTech.

As we talked to teams about the realities of SaaS Customer Success, one question kept resurfacing, again and again:

> *"What if every early warning sign a customer gives off — technical, financial, emotional — could be seen in one place, before it turns into a cancellation?"*

That question became **Momentum**.

Not another dashboard. Not another inbox to check. A single, living system that turns scattered signals into a quantified financial story — and a coordinated response.

---

## ⚙️ What it does

Momentum doesn't ask CS, Sales, and Product teams to go hunting across five tools for the truth about a customer. It brings the truth to them.

It's built to answer the six questions every retention-minded team asks themselves, every single day:

| 🤔 The question in their head | 🛠️ The Momentum feature that answers it |
|---|---|
| *"Which accounts are quietly slipping away?"* | **Command Center Dashboard** & Proactive Health Alerts |
| *"How much revenue is actually on the line?"* | **Renewal ARR at Risk** & Segment Insights |
| *"Do I really understand this customer's story?"* | **Customer 360** with Cross-View Deep-Linking |
| *"What are customers saying — and who are we losing them to?"* | **Voice of Customer & Competitor Intelligence** (NLP) |
| *"Who owns this, and what happens next?"* | **Action Routing** & PDF Brief Dispatch |
| *"What should I actually do about this account right now?"* | **Guardy AI Assistant** |

Momentum doesn't replace the CSM, the Product lead, or the Sales Ops analyst. It hands each of them the same financially-prioritized truth — so nothing quietly falls through the cracks again.

---

## 🏗️ How we built it

We built Momentum around one philosophy: **turn noise into a number, and a number into a name.**

**The stack behind the story:**

- ⚛️ **React (Vite) + TailwindCSS + Recharts + Lucide React** — an enterprise-grade interface that feels fast, not corporate
- 🔥 **Firebase Cloud Firestore** — real-time, persistent customer records that update the moment something changes
- ☁️ **Firebase Cloud Functions** — serverless health-score evaluation and event logging, running quietly in the background
- 📊 **SheetJS (XLSX) + a custom `normalizeCustomer.js` engine** — turning messy, inconsistent CSV/Excel exports into one clean, canonical schema
- 🧠 **NLP sentiment & key-phrase extraction** — surfacing recurring frustrations and competitor-mention surges buried in raw support text
- 📡 **Multi-channel dispatch webhooks** — so a generated action brief actually lands in WhatsApp, Telegram, Email, or Messenger, not just another dashboard nobody opens

Every module traces one real workflow: a health score drops → we ask *why* → we calculate what it's *worth* → we assign an *owner* → we close the loop with a logged *resolution*.

We weren't building a dashboard people check once a quarter. We were building the thing they open first thing every morning.

---

## Prerequisites
 
Before running the project, judges/evaluators will need:
 
- **Node.js** v18 or later (v20 LTS recommended) and **npm** — [nodejs.org](https://nodejs.org)
- **Git**
- A **Firebase account** (free tier is sufficient) — only required if you want to run your own backend instead of using the hosted prototype
- (Optional) **Firebase CLI** — `npm install -g firebase-tools` — only needed if deploying Cloud Functions/Hosting yourself
> 💡 **Fastest option for judges:** Skip local setup entirely and use the live hosted prototype at **https://hackattack-6d7de.web.app/** with the login/demo account and use the seed customer data.
 
---
 
## 5. Local Setup Instructions
 
### Step 1 — Clone the repository
 
```bash
git clone https://github.com/yeatjr/hackattack.git
cd hackattack
```
 
### Step 2 — Install dependencies
 
```bash
npm install
```
 
This installs the frontend dependencies, including `react`, `firebase`, `recharts`, `lucide-react`, `xlsx`, and `tailwindcss`.
 
### Step 3 — Configure Firebase
 
Momentum uses Firebase (Firestore + Cloud Functions + Hosting) for real-time data sync.
 
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project (or request access to the team's existing project for judging purposes).
2. Enable **Cloud Firestore** (in test mode is fine for evaluation).
3. Enable **Authentication** if the app requires sign-in (Email/Password and/or the demo login).
4. In Project Settings → General, register a Web App and copy the Firebase config object (`apiKey`, `authDomain`, `projectId`, etc.).
5. Add this config to the project — typically via a `src/firebase.js` (or `.env` file, depending on how the project reads config) in the `src/` folder. If the project expects environment variables, create a `.env` file in the root:
```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```
 
> ⚠️ If you were given access to the team's demo Firebase project/credentials for judging, use those directly instead of creating a new project — this avoids re-importing sample data.
 
### Step 4 — Run the frontend locally
 
From the project root:
 
```bash
npm run dev
```
 
Vite will start a local dev server (typically at `http://localhost:5173`). Open that URL in your browser.

---

## 🧩 Challenges we ran into

Momentum wasn't just a technical build — it was a design puzzle wearing a technical costume.

**🗂️ Normalizing chaos.** Every SaaS company measures customer health differently — different column names, different units, different definitions of "at risk." Our normalization pipeline had to flex to absorb wildly inconsistent spreadsheets without flattening the nuance that makes each account unique.

**🧠 Making NLP mean something.** Sentiment analysis is easy. Turning *"the API keeps timing out"* and *"we're comparing you to RivalTech"* into something a Product lead or Sales rep can act on in five seconds — that's the hard part.

**💰 Turning a warning sign into money.** Health scores and churn probabilities are just numbers to an executive — until they're tied to a dollar figure a CRO can act on in a board meeting. Renewal ARR at Risk became the bridge between "something's wrong" and "here's what it's costing us."

**👥 Designing for four audiences at once.** CS Managers, Product/Engineering leads, Sales Ops, and executives all needed the *same* underlying truth — filtered through four completely different lenses.

Every one of these challenges circled back to the same question:

> *"How do we make the data feel like a warning worth acting on — not just another chart to glance at?"*

---
## 🏆 Accomplishments we're proud of

Momentum isn't a pile of charts. It's a **closed loop** — from detection, to financial prioritization, to ownership, to resolution. We're proud we built:

- ✅ A unified **Customer 360** with one-click deep-linking across every module
- ✅ A client-side **CSV/Excel normalization pipeline** mapping raw chaos into a canonical schema
- ✅ **Real-time Firestore sync** with serverless health-score evaluation
- ✅ An **NLP engine** surfacing recurring frustrations and competitor-mention surges from raw support text
- ✅ Automated **Renewal ARR at Risk** and cohort-level revenue impact analytics
- ✅ A **4-queue action-routing Kanban board** with PIC assignment, PDF brief generation, and multi-channel dispatch
- ✅ A **closed-loop mitigation audit log** so leaders can see exactly how much ARR was saved — and by whom

Every screen exists to shrink the distance between *"we noticed something"* and *"we did something about it."*

---

## 📚 What we learned

Churn is rarely a mystery. It's a **visibility problem** wearing a mystery's clothes.

Most warning signs of churn already exist *somewhere* — a spike in tickets, a drop in seat usage, a competitor's name in a chat log. The real failure isn't a lack of data. It's a lack of a shared, timely, financially-framed view of that data.

We also learned that AI earns its keep when it's tied to a *concrete action*, not a vague insight. A sentiment score alone is trivia. A sentiment score attached to a dollar figure, a department, and a named owner — that changes behavior.

And in the end, no one remembers a retention platform for its charts. They remember it for the cancellation it prevented. Technology's job is to make that moment visible before it's too late — not to bury it under one more dashboard.

---

## 🚀 What's next for Momentum

This is just the opening chapter. Our vision: Momentum as the **operating system for proactive customer retention.**

- 🔮 **Predictive churn scoring** powered by machine learning on historical account outcomes
- 🔌 **Native CRM & helpdesk integrations** (Salesforce, HubSpot, Zendesk, Intercom) — no more manual CSV/Excel imports
- 🔍 **Semantic search** across tickets and call transcripts, moving beyond keyword-based NLP
- 📅 **Automated renewal & contract-milestone detection**
- 🤖 **Deeper Guardy AI playbooks**, tailored by industry and account tier
- 📈 **Team-level performance analytics** and forecasting for CS and Sales Ops leadership
- 🤝 A **partner/reseller ecosystem view** for channel-driven retention risk

We're building toward a future where no at-risk customer goes unnoticed, no warning sign gets lost between five different tabs, and every Customer Success team has one system that turns fragmented signals into confident, timely action.

**It all begins with one question:**
*What if the next churn was visible before it happened?*
