# Backend Clarification & API Integration Contract
**Generated from PRN Nurse Backend Source Code & Database Architecture**  
**Date:** September 7, 2026  
**Status:** Authoritative Backend Specifications

---

## Part 1: Resolution of the 7 Critical Mismatches

### 1. Days Format — Full Names, NOT Abbreviations
- **Decision:** Send **FULL DAY NAMES** (`"Monday"`, `"Tuesday"`, `"Wednesday"`, `"Thursday"`, `"Friday"`, `"Saturday"`, `"Sunday"`).
- **Backend Evidence:**
  - `models/Nurse.js`: `availability.days: [{ type: String }]`
  - In `nurseController.js` (`getNurseAvailability`), the availability matching logic explicitly matches against:
    ```javascript
    const allDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    ```
- **Action for Frontend:** Update all availability pickers to send full day strings. Do not send 3-letter abbreviations (`"Mon"`).

---

### 2. `timeSlots` Array
- **Decision:** `timeSlots` is supported and actively saved by the backend.
- **Accepted Values:**
  - `"Morning (8am–12pm)"`
  - `"Afternoon (12pm–5pm)"`
  - `"Night (7pm–7am)"`
- **Backend Evidence:**
  - `PUT /api/nurses/availability` handler in `nurseController.js`:
    ```javascript
    const { days, timeSlots, emergencyAvailable } = req.body;
    if (days) nurse.availability.days = days;
    if (timeSlots) nurse.availability.timeSlots = timeSlots;
    if (emergencyAvailable !== undefined) nurse.availability.emergencyAvailable = emergencyAvailable;
    await nurse.save();
    ```
  - It was empty in the DB because previous frontend calls either passed `timeSlots: []` or omitted the key during Step 7 onboarding.
- **Action for Frontend:** Send the standard strings above in the `timeSlots` array when updating availability.

---

### 3. Booking Status Enum
- **Decision:** The initial status is `"Requested"` (NOT `"Pending"`). The decline status is `"Declined"` (NOT `"Rejected"`).
- **Full Enum List (7 valid statuses from `models/Booking.js`):**
  1. `"Requested"` — Initial status upon booking creation.
  2. `"Accepted"` — Nurse accepted the booking.
  3. `"Declined"` — Nurse rejected the booking.
  4. `"In Progress"` — Service session currently active.
  5. `"Completed"` — Service successfully concluded.
  6. `"Cancelled"` — Cancelled by patient, nurse, or admin.
  7. `"Disputed"` — Incident/dispute raised on the booking.
- **Action for Frontend:** Update UI filters, badges, and state machines to use `"Requested"` and `"Declined"`.

---

### 4. Qualifications: Array vs. Flat Root Fields
- **Decision:** Frontend can send and read qualifications as **flat root fields** or subdocuments.
- **Backend Evidence:**
  - `models/Nurse.js` contains root-level fields:
    - `highestQualification` (String)
    - `graduationYear` (String)
    - `institution` (String)
    - `licensingBody` (String)
    - `licenseNumber` (String)
    - `licenseExpiry` (Date)
  - It also contains `qualifications: [{ degree, institution, year }]`.
  - In `nurseController.js` (`updateProfile`), the allowed fields list includes:
    `highestQualification`, `graduationYear`, `institution`, `licensingBody`, `licenseNumber`, `licenseExpiry`, and `qualifications`.
- **Action for Frontend:**
  - When submitting Step 3, send flat fields:
    ```json
    {
      "highestQualification": "Bachelor of Science in Nursing",
      "licenseNumber": "NUR-12345",
      "licensingBody": "Nursing and Midwifery Council (NMC)",
      "institution": "University of Ghana",
      "graduationYear": "2021",
      "licenseExpiry": "2027-12-31"
    }
    ```
  - When calling `GET /api/nurses/profile`, `licenseNumber` and all fields above are returned directly as flat properties at the root level of the nurse object.

---

### 5. `photoUrl` vs. `profilePhoto`
- **Decision:** Use **`photoUrl`**.
- **Backend Evidence:**
  - Cloudinary upload (`POST /api/upload`) returns:
    ```json
    {
      "message": "File uploaded successfully",
      "fileName": "avatar.jpg",
      "fileUrl": "https://res.cloudinary.com/.../image.jpg"
    }
    ```
  - `bookingController.js` (line 141) and recommendation queries populate `photoUrl`.
  - `models/Nurse.js` defines `photoUrl` with the default avatar.
- **Action for Frontend:** Take `fileUrl` from `POST /api/upload` response and save it as `photoUrl` when calling `PUT /api/nurses/profile`. (You may also pass `profilePhoto: fileUrl` alongside `photoUrl` for legacy safety).

---

### 6. Address vs. GeoJSON Location
- **Decision:** Send **both** `address` (flat string) and `location` (GeoJSON Point with coordinates).
- **Geocoding:** The backend **DOES NOT** auto-geocode addresses. The frontend must supply device GPS or Places API coordinates.
- **Payload Format for Step 6 / Location Updates:**
  ```json
  {
    "address": "East Legon, Accra",
    "location": {
      "type": "Point",
      "coordinates": [-0.1500, 5.6300]
    }
  }
  ```
  *(Important GeoJSON standard: coordinates are `[longitude, latitude]`)*

---

### 7. Patient `medicalInfo` / Health Background
- **Decision:** Send **PLAIN JSON OBJECTS**. No encryption is required.
- **Backend Evidence:**
  - The encrypted string in the DB was an artifact from an old legacy test script.
  - The active `Patient.js` schema defines structured, plain JSON sub-documents:
    - `medicalBackground`: `{ primaryDiagnosis, secondaryConditions, bloodType, knownAllergies, mobilityStatus, homeMedicalEquipment }`
    - `careNeeds`: `{ typeOfCare, specificClinicalTasks, schedule, currentMedications }`
    - `emergencyContact`: `{ name, relationship, phone }`
- **Action for Frontend:** Send plain JSON directly via `PATCH /api/patients/profile`. `GET /api/patients/profile` returns plain JSON directly.

---

## Part 2: Answers to "Still Needs Clarification ❓"

### 1. Authentication Flow & Token Clarification
- **Do `POST /api/auth/login` and `POST /api/auth/register/*` return tokens?**
  - **NO.** The backend does **NOT** return any tokens (`accessToken` or `refreshToken`).
  - `POST /api/auth/login` **does not exist** on the backend anymore (calling it returns `404 Not Found`).
  - `POST /api/auth/refresh` **does not exist** on the backend anymore.
  - In the older, pre-Firebase backend implementation (and the outdated Postman collection), custom JWTs used the key names `accessToken` and `refreshToken`. However, **Firebase Authentication replaced custom JWTs**.
- **How Login & Tokens Work Now:**
  1. Frontend signs in directly via the Firebase Client SDK:
     ```javascript
     const userCredential = await signInWithEmailAndPassword(auth, email, password);
     const token = await userCredential.user.getIdToken();
     ```
  2. The frontend attaches this token to all protected API calls:
     ```http
     Authorization: Bearer <token>
     ```
  3. The backend middleware (`authMiddleware.js`) validates this token using `admin.auth().verifyIdToken(token)`.
- **How Registration Works:**
  1. Frontend creates user in Firebase:
     ```javascript
     const userCredential = await createUserWithEmailAndPassword(auth, email, password);
     const firebaseUid = userCredential.user.uid;
     ```
  2. Frontend syncs the profile to MongoDB by calling `POST /api/auth/register/:role` (e.g. `POST /api/auth/register/patient`) with:
     ```json
     {
       "email": "user@example.com",
       "firebaseUid": "FIREBASE_UID_FROM_CLIENT",
       "fullName": "John Doe",
       "phone": "+233240000000"
     }
     ```
  3. Response from `POST /api/auth/register/*`:
     ```json
     {
       "_id": "60d5ec49f1b2c8b1f8e4e1a1",
       "profileId": "60d5ec49f1b2c8b1f8e4e1a2",
       "fullName": "John Doe",
       "email": "user@example.com",
       "role": "patient",
       "status": "Active"
     }
     ```
     *(No tokens are returned; the client already holds the Firebase token).*
- **User & Profile Details Endpoint:** Call `GET /api/auth/me` with `Authorization: Bearer <firebaseToken>`.
- **Response Shape for `GET /api/auth/me`:**
  ```json
  {
    "_id": "60d5ec49f1b2c8b1f8e4e1a1",
    "profileId": "60d5ec49f1b2c8b1f8e4e1a2",
    "firebaseUid": "FIREBASE_UID_HERE",
    "fullName": "Grace Mensah",
    "email": "grace@example.com",
    "role": "nurse",
    "status": "Active",
    "onboardingComplete": true
  }
  ```
  - **Does it return `onboardingComplete`?** **Yes**, as a boolean.
  - **Does it return both IDs?** **Yes**:
    - `_id`: The User Account ID (from `users` collection)
    - `profileId`: The Nurse/Patient Document ID (from `nurses` or `patients` collection)

---

### 2. Nurse Profile GET (`GET /api/nurses/profile`)
- **Response Wrapping:** The response is **direct** (NOT wrapped). It returns the Nurse object directly (`{ "_id": "...", "fullName": "...", ... }`).
- **`licenseNumber`:** Present as a direct flat field on the root object (`nurse.licenseNumber`).

---

### 3. Nurse Onboarding Steps
- **Step 6 (Location):** Send `{ "address": "...", "location": { "type": "Point", "coordinates": [lng, lat] } }`. The backend does not auto-geocode.
- **Step 7 (Availability):**
  - `days`: `["Monday", "Wednesday", "Friday"]` (Full day names)
  - `timeSlots`: `["Morning (8am–12pm)", "Afternoon (12pm–5pm)", "Night (7pm–7am)"]`
  - `emergencyAvailable`: `true` or `false`

---

### 4. Bookings
- **Valid Status Values:**
  `"Requested"`, `"Accepted"`, `"Declined"`, `"In Progress"`, `"Completed"`, `"Cancelled"`, `"Disputed"`
- **Role-based filtering on `GET /api/bookings`:**
  **Yes**. The endpoint inspects `req.user.role`:
  - If nurse: returns bookings where `nurseId == req.user.profileId`
  - If patient: returns bookings where `patientId == req.user.profileId`
- **Response Shape:** Direct JSON Array of booking objects:
  ```json
  [
    {
      "_id": "60d...",
      "patientId": { "_id": "...", "fullName": "...", "phone": "..." },
      "nurseId": { "_id": "...", "fullName": "...", "phone": "...", "photoUrl": "..." },
      "status": "Requested",
      "careDetails": { ... },
      "schedule": { ... },
      "totalAmount": 250,
      "createdAt": "..."
    }
  ]
  ```

---

### 5. Patient Profile Structure
- **Payload for `PATCH /api/patients/profile`:**
  ```json
  {
    "medicalBackground": {
      "primaryDiagnosis": "Post-Operative Recovery",
      "secondaryConditions": ["Hypertension"],
      "bloodType": "O+",
      "knownAllergies": ["Penicillin"],
      "mobilityStatus": "Assisted with Walker",
      "homeMedicalEquipment": ["BP Monitor"]
    },
    "careNeeds": {
      "typeOfCare": "Wound Care",
      "specificClinicalTasks": ["Dressing Change", "Vitals Check"],
      "schedule": "Daily Morning",
      "currentMedications": ["Amoxicillin 500mg"]
    },
    "emergencyContact": {
      "name": "Kwame Lanor",
      "relationship": "Brother",
      "phone": "+233240000000"
    }
  }
  ```
- Transparent, unencrypted plain JSON.

---

### 6. Notifications
- **Valid Types (`Notification.js`):**
  `"Booking"`, `"System"`, `"Alert"`
- **Available Endpoints:**
  - `GET /api/notifications` — Returns array of up to 50 notifications for the logged-in user.
  - `PATCH /api/notifications/:id/read` — Marks a specific notification as read.

---

### 7. Admin Endpoints
- **`GET /api/admin/verifications`:**
  Returns nurses with `status` in `['Pending', 'Docs Verified', 'Background Cleared']` (or missing status).
- **Single Nurse Document:**
  - Public / Booking View: `GET /api/nurses/:id` (returns profile and 30-day upcoming booked slots; strips nationalId and licenseNumber).
  - Admin Verification View: `GET /api/admin/verifications` lists pending nurses with their `nationalId`, `idPhotoUrl`, `licenseNumber`, and `qualifications`.
- **`GET /api/admin/metrics` returns:**
  ```json
  {
    "totalPatients": 12,
    "totalNurses": 20,
    "activeNurses": 15,
    "pendingReviews": 5,
    "totalBookings": 45,
    "todaysBookings": 3,
    "totalRevenue": 8500,
    "activeEmergencies": 0,
    "openDisputes": 1,
    "nurses": { "active": 15, "pending": 5 },
    "patients": { "total": 12 },
    "bookings": { "active": 10, "today": 3, "total": 45 },
    "revenue": 8500,
    "emergencies": 0,
    "disputes": 1
  }
  ```

---

### 8. Infrastructure & File Uploads
- **Base URLs:**
  - Production: `https://prn-nurse-backend.vercel.app/api`
  - Local Dev: `http://localhost:5000/api`
- **CORS Configuration:** `origin: "*"` (open to all origins).
- **File Upload (`POST /api/upload`):**
  - **Method:** `POST`
  - **Content-Type:** `multipart/form-data`
  - **Form field name:** `file` (must be named `file`)
  - **Max File Size:** `10 MB` (10,485,760 bytes)
  - **Accepted File Types:** Images (`jpg`, `jpeg`, `png`, `webp`) and Documents (`pdf`, `docx`).
  - **Response:**
    ```json
    {
      "message": "File uploaded successfully",
      "fileName": "certificate.pdf",
      "fileUrl": "https://res.cloudinary.com/..."
    }
    ```
