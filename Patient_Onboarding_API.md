# Patient Onboarding API Guide (5-Step Flow)

**PRN Nurse Platform — Backend Integration Contract**  
**Target:** Frontend Development Team  
**Base URL:** `https://prn-nurse-backend.vercel.app/api` (or `http://localhost:5000/api`)  

---

## 📌 Architecture Overview

Patient onboarding in PRN Nurse does **not** require separate individual URLs for each step. Instead, it follows a clean RESTful design:

* **Registration:** `POST /api/auth/register/patient` (initial account sync).
* **Onboarding Steps (1 to 5):** `PATCH /api/patients/profile` (or `PUT /api/patients/profile`).
* **Authentication:** All profile requests require:
  ```http
  Authorization: Bearer <firebaseIdToken>
  Content-Type: application/json
  ```
Because `PATCH` is supported, the frontend can submit fields step-by-step as the user proceeds through the stepper, or submit all steps at the end.

---

## Step 0: Registration (Initial Account Sync)

Called immediately after the user signs up with Firebase Authentication (`createUserWithEmailAndPassword`).

* **Endpoint:** `POST /api/auth/register/patient`
* **Access:** Public (No token required)
* **Request Body:**
  ```json
  {
    "email": "ama.mensah@example.com",
    "firebaseUid": "FIREBASE_UID_FROM_SDK",
    "fullName": "Ama Mensah",
    "phone": "+233201234567"
  }
  ```
* **Response (HTTP 201):**
  ```json
  {
    "_id": "60d5ec49f1b2c8b1f8e4e1a1",
    "profileId": "60d5ec49f1b2c8b1f8e4e1a2",
    "fullName": "Ama Mensah",
    "email": "ama.mensah@example.com",
    "role": "patient",
    "status": "Active"
  }
  ```
  *(Patient document is now initialized in MongoDB with `onboardingComplete: false`).*

---

## Step 1: Personal Details

* **Endpoint:** `PATCH /api/patients/profile`
* **Header:** `Authorization: Bearer <firebaseIdToken>`
* **Request Body:**
  ```json
  {
    "fullName": "Ama Mensah",
    "dob": "1988-04-12",
    "gender": "Female",
    "photoUrl": "https://res.cloudinary.com/uig70kmd/image/upload/v1/prn-nurse/avatars/patient1.jpg",
    "bookingRelationship": "Self"
  }
  ```
* **Valid Gender Options:** `"Male"`, `"Female"`, `"Other"`, `"Prefer not to say"`.
* **Photo Upload:** Upload file to `POST /api/upload` (form key `file`), retrieve `fileUrl`, and send as `photoUrl`.

---

## Step 2: Contact, Location & Emergency Contact

* **Endpoint:** `PATCH /api/patients/profile`
* **Header:** `Authorization: Bearer <firebaseIdToken>`
* **Request Body:**
  ```json
  {
    "phone": "+233201234567",
    "email": "ama.mensah@example.com",
    "address": "House No. 14, Boundary Road",
    "region": "Greater Accra",
    "city": "East Legon",
    "landmark": "Near American House",
    "ghanaPostGps": "GA-123-4567",
    "location": {
      "type": "Point",
      "coordinates": [-0.1500, 5.6300]
    },
    "emergencyContact": {
      "fullName": "Kwame Mensah",
      "relationship": "Brother",
      "primaryPhone": "+233241234567",
      "alternativePhone": "+233501234567"
    }
  }
  ```
  *(Note on Coordinates: GeoJSON format requires `[longitude, latitude]`).*

---

## Step 3: Medical Background

* **Endpoint:** `PATCH /api/patients/profile`
* **Header:** `Authorization: Bearer <firebaseIdToken>`
* **Request Body:**
  ```json
  {
    "medicalBackground": {
      "primaryDiagnosis": "Post-Operative Recovery",
      "secondaryConditions": ["Hypertension", "Type 2 Diabetes"],
      "bloodType": "O+",
      "knownAllergies": ["Penicillin", "Latex"],
      "mobilityStatus": "Needs Assistance",
      "homeMedicalEquipment": ["Wheelchair", "BP Monitor"]
    }
  }
  ```

> **Note on `medicalBackground` vs `medicalInfo`:**  
> The active 5-step onboarding schema uses `medicalBackground`.  
> If an older screen still submits `medicalInfo: { ... }`, the backend controller accepts both (`patientController.js:57-58`). For new onboarding flows, use `medicalBackground`.

---

## Step 4: Care Needs & Medications

* **Endpoint:** `PATCH /api/patients/profile`
* **Header:** `Authorization: Bearer <firebaseIdToken>`
* **Request Body:**
  ```json
  {
    "careNeeds": {
      "typeOfCare": "Wound Care & Dressing",
      "specificClinicalTasks": [
        "Surgical wound dressing change",
        "Medication administration",
        "Vitals monitoring (BP, Blood Glucose)"
      ],
      "schedule": {
        "frequency": "Daily",
        "preferredShiftSlots": [
          "Morning (8am–12pm)"
        ]
      },
      "currentMedications": [
        {
          "drugName": "Lisinopril",
          "dosage": "10mg",
          "instructions": "Once daily after breakfast"
        },
        {
          "drugName": "Metformin",
          "dosage": "500mg",
          "instructions": "Twice daily with meals"
        }
      ]
    }
  }
  ```

---

## Step 5: Preferences & Finalization

* **Endpoint:** `PATCH /api/patients/profile`
* **Header:** `Authorization: Bearer <firebaseIdToken>`
* **Request Body:**
  ```json
  {
    "preferences": {
      "nurseGenderPreference": "Female",
      "preferredLanguage": ["English", "Twi"],
      "budgetRange": "50-100 GHS/hr",
      "specialInstructions": "Please call before arrival as the gate is usually locked."
    },
    "onboardingComplete": true
  }
  ```

> **What happens when `onboardingComplete: true` is sent?**  
> 1. In MongoDB, `patient.onboardingComplete` is set to `true`.  
> 2. The associated User account status is confirmed as `Active`.  
> 3. Future calls to `GET /api/auth/me` will return `onboardingComplete: true`, routing the patient directly to the patient home/dashboard.

---

## 🔍 Profile & State Verification Endpoints

### 1. Fetch Complete Patient Profile
* **Endpoint:** `GET /api/patients/profile`
* **Header:** `Authorization: Bearer <firebaseIdToken>`
* **Response:** Returns the full Patient document with all 5 steps populated.

### 2. Check Auth & Onboarding Status
* **Endpoint:** `GET /api/auth/me`
* **Header:** `Authorization: Bearer <firebaseIdToken>`
* **Response:**
  ```json
  {
    "_id": "60d5ec49f1b2c8b1f8e4e1a1",
    "profileId": "60d5ec49f1b2c8b1f8e4e1a2",
    "fullName": "Ama Mensah",
    "email": "ama.mensah@example.com",
    "role": "patient",
    "status": "Active",
    "onboardingComplete": true
  }
  ```
  The frontend checks `data.onboardingComplete`:
  - If `false` $\rightarrow$ Redirect to Onboarding Stepper.
  - If `true` $\rightarrow$ Redirect to Patient Home Dashboard.
