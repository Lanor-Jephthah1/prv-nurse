# PRV NURSE
## A Robust, Cloud-Native Home Healthcare Placement Engine Integrating Zero-Knowledge Firebase Authentication, Concurrency-Controlled Booking Telemetry, Aspect-Based Sentiment Analysis, and Bayesian Nurse Ranking

**A Final Year Thesis Submitted to the Department of Computer and Electrical Engineering**  
**University of Energy and Natural Resources (UENR), Sunyani, Ghana**  
**Degree:** Bachelor of Science in Computer Engineering (2025 / 2026 Academic Year)  
**Authors:** LANOR JEPHTHAH KWAME, JOSEY, NICK, MEGA  

---

## TABLE OF CONTENTS
- [CHAPTER 1: INTRODUCTION](#chapter-1-introduction)
  - [1.1 Abstract](#11-abstract)
  - [1.2 Project Background & Socio-Economic Context](#12-project-background--socio-economic-context)
  - [1.3 Problem Statement](#13-problem-statement)
  - [1.4 Research Objectives: Conception vs. Realized System](#14-research-objectives-conception-vs-realized-system)
  - [1.5 Scope, Delimitations & Production Assumptions](#15-scope-delimitations--production-assumptions)
- [CHAPTER 2: LITERATURE REVIEW & SYSTEM EVOLUTION](#chapter-2-literature-review--system-evolution)
  - [2.1 Decentralized Home Healthcare in Sub-Saharan Africa](#21-decentralized-home-healthcare-in-sub-saharan-africa)
  - [2.2 Natural Language Processing in Healthcare Quality Assurance](#22-natural-language-processing-in-healthcare-quality-assurance)
  - [2.3 Ranking Algorithms: Moving from XGBoost to In-Database Bayesian Scoring](#23-ranking-algorithms-moving-from-xgboost-to-in-database-bayesian-scoring)
  - [2.4 Comparative Analysis of Related Systems](#24-comparative-analysis-of-related-systems)
- [CHAPTER 3: PRODUCTION SYSTEM ARCHITECTURE & METHODOLOGY](#chapter-3-production-system-architecture--methodology)
  - [3.1 System Topology & Infrastructure Planes](#31-system-topology--infrastructure-planes)
  - [3.2 Core Subsystem Implementation Modules](#32-core-subsystem-implementation-modules)
    - [3.2.1 Zero-Password Firebase Identity Pipeline](#321-zero-password-firebase-identity-pipeline)
    - [3.2.2 5-Stage Patient Clinical Intake & Draft Patcher](#322-5-stage-patient-clinical-intake--draft-patcher)
    - [3.2.3 Volatile Memory Cloudinary Document Streaming](#323-volatile-memory-cloudinary-document-streaming)
    - [3.2.4 Concurrency-Controlled Booking & Dual Approval Protocol](#324-concurrency-controlled-booking--dual-approval-protocol)
    - [3.2.5 30-Day Predictive Availability Engine & Slot Fading](#325-30-day-predictive-availability-engine--slot-fading)
    - [3.2.6 In-Database Bayesian Average Ranking & Distance Attenuation](#326-in-database-bayesian-average-ranking--distance-attenuation)
    - [3.2.7 Aspect-Based Sentiment Analysis & Small-N Privacy Shield](#327-aspect-based-sentiment-analysis--small-n-privacy-shield)
  - [3.3 Database Architecture & Mongoose Schemata](#33-database-architecture--mongoose-schemata)
- [CHAPTER 4: API SPECIFICATIONS & SYSTEM CONTRACTS](#chapter-4-api-specifications--system-contracts)
- [CHAPTER 5: VERIFICATION, DEPLOYMENT & RESULTS](#chapter-5-verification-deployment--results)
- [CHAPTER 6: RISK ASSESSMENT, ETHICAL SAFEGUARDS & FUTURE WORK](#chapter-6-risk-assessment-ethical-safeguards--future-work)
- [REFERENCES](#references)

---

# CHAPTER 1: INTRODUCTION

## 1.1 Abstract
In Ghana and across sub-Saharan Africa, a paradoxical healthcare imbalance persists: thousands of fully certified, licensed nursing professionals complete rigorous tertiary training annually but remain unposted due to fiscal public sector wage constraints. Concurrently, tens of thousands of families caring for elderly dependents, post-surgical patients, and individuals managing chronic conditions struggle to secure vetted, dependable home nursing.

This thesis presents the design, algorithmic formulation, and production implementation of **PRV Nurse**—a high-concurrency, cloud-native digital health platform engineered to formalize the decentralized home healthcare market in Ghana. Moving beyond early theoretical drafts, the completed platform implements:
1. **Zero-Password Firebase Identity Management** verifying cryptographically signed Google ID tokens statelessly.
2. **Volatile Memory Streaming** via Multer and Cloudinary SDK, overcoming serverless read-only filesystem barriers.
3. **Atomic Booking Concurrency Protection** with automated `409 Conflict` overlap detection and a Dual-Approval Completion protocol.
4. **In-Database Bayesian Average Ranking** combined with geospatial Haversine attenuation ($WR = \frac{v}{v+m} R + \frac{m}{v+m} C$) directly inside MongoDB to eliminate cold-start provider bias.
5. **Aspect-Based Sentiment Analysis** using AFINN natural language scoring, dynamic clinical badge extraction, and a Small-N Privacy Shield that guarantees patient anonymity.

The production system is deployed globally as serverless functions on Vercel connected to MongoDB Atlas, establishing a reproducible, scalable paradigm for mobile healthcare placement in developing economies.

## 1.4 Research Objectives: Conception vs. Realized System

| Feature Area | Initial Proposal Conception (Old Thesis) | Realized Production Implementation |
| :--- | :--- | :--- |
| **Authentication** | MongoDB password storage with bcrypt (12 rounds) and custom JWT signing. | Zero-Password Firebase Authentication verifying Google cryptographically signed ID tokens statelessly. |
| **Document Storage** | AWS S3 signed URLs with disk caching. | Volatile memory streaming via Multer and Cloudinary SDK, bypassing serverless read-only filesystem barriers. |
| **Patient Care Intake** | Single flat form capturing generic medical notes and phone numbers. | 5-Stage Clinical Intake Pipeline with deep nested Mongoose schemas and partial PATCH draft-saving capability. |
| **Provider Matching** | External Python/FastAPI microservice executing offline-trained XGBoost trees. | Native in-database Bayesian Average Ranking ($WR$) and Haversine distance attenuation executed directly in MongoDB aggregation pipeline. |
| **Booking Concurrency**| Linear state machine without overlap validation. | Atomic 409 Conflict overlap interceptors and Dual-Signoff protocol (both parties must digitally approve completion). |
| **Quality Assessment** | Standard 1–5 star manual rating with plain text comment string. | Category-by-category AFINN NLP Sentiment Analysis, automatic trait extraction (badges), toxic auto-flagging, and Small-N Privacy Shield. |

---

# CHAPTER 2: LITERATURE REVIEW & SYSTEM EVOLUTION

## 2.3 Ranking Algorithms: Moving from XGBoost to In-Database Bayesian Scoring
The early architectural specification for this project proposed an isolated Python FastAPI microservice utilizing an XGBoost regression model to rank candidate nurses. During production engineering, three fundamental drawbacks emerged:
1. **Cold-Start Microservice Latency:** Python serverless containers required 3 to 8 seconds of container initialization (cold boot) to load scientific libraries (`numpy`, `pandas`, `xgboost`), violating mobile responsiveness.
2. **Inter-Service Network Overhead:** Marshalling candidate nurse documents from Node.js over HTTPS to a Python service introduced unnecessary bandwidth penalties.
3. **Cold-Start Data Scarcity:** XGBoost requires substantial historical interaction datasets. For a newly launched platform in Ghana, training data is fundamentally sparse.

The production system solves this by computing a **Bayesian Average** directly inside MongoDB's `$geoNear` aggregation pipeline:

$$\text{Weighted Score (WR)} = \left( \frac{v}{v + m} \right) R + \left( \frac{m}{v + m} \right) C$$

Where:
- $R$ = Average user rating of the individual nurse
- $v$ = Total count of completed, verified reviews for that nurse
- $m$ = Minimum threshold of reviews required to be considered statistically reliable ($m = 3$)
- $C$ = Global prior mean rating across the entire healthcare ecosystem ($C = 4.0$)

---

# CHAPTER 3: PRODUCTION SYSTEM ARCHITECTURE & METHODOLOGY

## 3.1 System Topology
The system follows an event-driven, decoupled cloud topology:
1. **Presentation Tier:** React 18 + Tailwind CSS PWA with role-based routing (`Nurse Portal`, `Patient Portal`, `Admin Dashboard`).
2. **Application Tier:** Node.js / Express deployed as serverless functions on Vercel Edge.
3. **Data Tier:** MongoDB Atlas with `2dsphere` geospatial indexing and connection pooling.
4. **Third-Party Services:** Google Firebase Admin SDK (Identity), Cloudinary API (Media CDN).

## 3.2 Key Modules

### 3.2.1 Concurrency-Controlled Booking & Dual Approval
Before confirming any booking, the engine scans existing bookings to prevent overlaps:
- Status must be in `['Accepted', 'In Progress']`.
- Schedule time ranges and slots are checked for intersections.
- Conflicting requests immediately trigger `HTTP 409 Conflict`.
- Completion requires mutual sign-off (`patientApproved === true && nurseApproved === true`).

### 3.2.2 30-Day Predictive Availability Engine
The `/api/nurses/:id/availability?date=YYYY-MM-DD` endpoint maps working days against active accepted bookings and returns each slot's state (`isAvailable`, `isBooked`, `status: "Booked" | "Available" | "Day Off"`), allowing the client to render booked slots as faded-out and unselectable.

### 3.2.3 Aspect-Based Sentiment Analysis & Small-N Privacy Shield
Feedback is submitted per category (Punctuality, Professionalism, Compassion, Clinical Skills). The backend:
1. Analyzes each category sentence using the AFINN lexicon.
2. Calculates comparative valence $(-1.0 \le V \le +1.0)$.
3. Computes the composite rating $(1 \le \text{Stars} \le 5)$.
4. Automatically awards badges (`Punctual`, `Professional`, `Compassionate`) directly into `Nurse.skills`.
5. Masks reviews if total reviews $< 3$ to prevent the nurse from identifying the patient in low-volume scenarios.
6. Auto-flags toxic comments ($\le -3$) for admin quarantine.

---

# CHAPTER 4: API SPECIFICATIONS & SYSTEM CONTRACTS

| HTTP Method | Route Endpoint | Authorization | Function |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public (Firebase Token) | Syncs verified Firebase UID to MongoDB user record. |
| `GET` | `/api/auth/me` | Private (All Roles) | Validates active Google ID token and returns role profile. |
| `PATCH` | `/api/patients/profile` | Private (Patient) | Saves progressive 5-stage clinical onboarding drafts. |
| `GET` | `/api/nurses/nearby` | Private (Patient) | Executes Bayesian-ranked geospatial feed queries. |
| `GET` | `/api/nurses/:id/availability` | Public / Patient | Returns calendar date availability and faded booked slots. |
| `POST` | `/api/bookings` | Private (Patient) | Submits care booking with atomic 409 conflict detection. |
| `PATCH` | `/api/bookings/:id/status` | Private (Nurse/Patient) | Executes state transitions and dual completion signoff. |
| `POST` | `/api/reviews` | Private (Patient) | Submits category sentences for AFINN NLP evaluation. |
| `GET` | `/api/nurses/:nurseId/reviews` | Public | Returns anonymized reviews under Small-N threshold rules. |
| `POST` | `/api/upload` | Private (All Roles) | Streams file buffers to Cloudinary via volatile RAM. |

---

# CHAPTER 5: VERIFICATION, DEPLOYMENT & RESULTS
Live integration testing against `https://prn-nurse-backend.vercel.app`:
- **Health Check:** `GET /api/health` $\rightarrow$ `200 OK` (`{"status":"Platform is running smoothly"}`).
- **Token Intercept:** `GET /api/auth/me` without token $\rightarrow$ `401 Unauthorized` (`{"message":"Not authorized, no Firebase token provided"}`).
- **Zero-Password Identity:** Google ID tokens verified statelessly via Firebase Admin.
- **Availability Engine:** Validated date projection correctly identifies booked vs. open slots.
- **Concurrency Guard:** Overlapping booking attempts rejected with `409 Conflict`.
- **Anonymity Shield:** Reviews below threshold return `{"hidden": true, "reviews": []}`.

---

# CHAPTER 6: RISK ASSESSMENT & ETHICAL SAFEGUARDS

| Risk Category | Severity | Mitigation |
| :--- | :--- | :--- |
| **Database Credential Breach** | Critical | Removed all passwords from MongoDB; identity delegated to Firebase. |
| **Serverless Filesystem Crash**| High | In-memory Multer buffer streaming to Cloudinary. Zero disk I/O. |
| **Attribution Retaliation** | High | Small-N Privacy Shield hides reviews until $N \ge 3$; scrubbed IDs. |
| **Toxic Feedback Defamation** | Medium | Automated AFINN threshold ($\le -3$) quarantines defamatory reviews. |
| **Geographic Cold-Start Bias** | Medium | Bayesian prior ($m=3, C=4.0$) + distance attenuation in MongoDB `$geoNear`. |

---

# REFERENCES
1. World Health Organization, "Home-based long-term care," WHO, Tech. Rep. WHO/NMH/CCL/00.2, 2020.
2. S. Reinhard, C. Levine, and S. Samis, "Home alone: Family caregivers providing complex chronic care," AARP, Rep., 2012.
3. Ghana Statistical Service, "2021 Population and Housing Census: General Report," Accra, Ghana, 2022.
4. A. K. Boateng and M. Agyeman, "Nursing workforce challenges in Ghana," Ghana Med. J., vol. 53, no. 2, pp. 120–128, 2019.
5. G. Parker, M. Van Alstyne, and S. Choudary, *Platform Revolution*. W. W. Norton, 2016.
6. F. A. Nielsen, "A new ANEW: Evaluation of a word list for sentiment analysis in microblogs," in *Proc. ESWC*, 2011.
7. Nursing and Midwifery Council of Ghana, "Guidelines for Registration and Licensing," Accra, Ghana, 2020.
8. B. Korir, "Digital credential verification in professional services," in *Proc. 7th ACM SIGCAS*, 2021.
9. OpenJS Foundation, "Node.js documentation," 2024.
10. Google LLC, "Firebase Admin Node.js SDK documentation," 2024.
11. MongoDB Inc., "MongoDB Manual: Geospatial Queries ($geoNear)," 2024.
12. Cloudinary Ltd., "Node.js SDK integration and memory buffer upload streams," 2024.
