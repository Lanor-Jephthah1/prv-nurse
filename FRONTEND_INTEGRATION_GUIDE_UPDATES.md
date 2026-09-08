# PRV Nurse Backend API — Frontend Integration Guide & Updates
**Date:** September 8, 2026  
**Status:** Live on Production (`prn-nurse-backend.vercel.app`)

---

## 📌 Summary of Today's Backend Upgrades

1. **Authentication & Registration Security**
   - Registration endpoints now require Firebase Bearer Token (`Authorization: Bearer <token>`).
   - `firebaseUid` is cryptographically extracted from the token (preventing UID spoofing and dummy accounts).
   - Database purged of 87 legacy documents missing `firebaseUid` (eliminating false `400 "User already exists"`).
   - Collision/Duplicate errors now cleanly return `409 Conflict` instead of `500 Server Error`.

2. **Strict Booking Overlap & Conflict Prevention**
   - Nurses can no longer accept multiple bookings that overlap in calendar day, shift, or time duration.
   - Both booking creation (`POST /api/bookings`) and acceptance (`PATCH /api/bookings/:id/status`) enforce conflict rejection (`409 Conflict`).
   - Handles case-insensitive statuses (`"Accepted"` / `"accepted"`).
   - Empty slot arrays (`timeSlots: []`) or unspecified hours no longer bypass collision checks.

3. **Dual-Approval & Automated Nurse Earnings**
   - The `Nurse` profile schema now contains `earnings` and `totalEarnings`.
   - When both the patient and the nurse approve completion, `booking.status` becomes `"Completed"` and the nurse's earnings automatically increment by `booking.totalAmount`.
   - Creates a disbursed `Payment` transaction record for accounting and platform metrics.

4. **Patient Booking Cancellation**
   - Patients can cancel their pending booking requests or active bookings.
   - Flexible endpoints provided: `PATCH /api/bookings/:id/cancel`, `POST /api/bookings/:id/cancel`, `DELETE /api/bookings/:id`, or `PATCH /api/bookings/:id/status` with `{ "status": "Cancelled" }`.
   - Cancelling automatically frees up the nurse's schedule on that date and notifies the nurse.

---

## 1. Authentication & Registration Flow

### ⚠️ CRITICAL BREAKING CHANGE: Authorization Header Required on Registration

Previously, registration endpoints were unauthenticated and accepted `firebaseUid` in the JSON request body. **This has changed.**

Registration endpoints now verify the Firebase token and automatically extract the verified user ID.

#### Endpoints:
- `POST /api/auth/register/patient`
- `POST /api/auth/register/nurse`
- `POST /api/auth/register/admin`

#### Headers Required:
```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
```

#### Frontend Implementation Example (Axios / Fetch):
```javascript
import { getAuth } from "firebase/auth";

const auth = getAuth();
const firebaseUser = auth.currentUser;

// 1. Obtain the Firebase JWT token
const token = await firebaseUser.getIdToken();

// 2. Call backend registration endpoint with the token in headers
const response = await axios.post(
  "https://prn-nurse-backend.vercel.app/api/auth/register/patient",
  {
    fullName: "Kofi Mensah",
    email: firebaseUser.email,
    phone: "+233240000000"
    // Note: firebaseUid is automatically extracted from Bearer token
  },
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);
```

#### Response Codes:
- `201 Created`: User successfully registered in database.
- `400 Bad Request`: Missing required profile fields (`fullName`, `email`, etc.).
- `401 Unauthorized`: Missing or expired Firebase Bearer token.
- `409 Conflict`: A user with this email or Firebase UID already exists in the database.

---

## 2. Booking Overlap & Conflict Engine

### Behavior:
- When a booking is in status `"Accepted"` or `"In Progress"`, that nurse is marked as **occupied** for that date and shift.
- If another booking is requested or accepted for that nurse on the same date/shift, the backend blocks it with `409 Conflict`.

### Shifts Recognized:
The backend intelligently recognizes and prevents overlaps across shift aliases:
- **Morning:** `"Morning"`, `"Morning (8am–12pm)"`, `"8am-12pm"`
- **Afternoon:** `"Afternoon"`, `"Afternoon (12pm–5pm)"`, `"12pm-5pm"`
- **Night / Evening:** `"Night"`, `"Night (7pm–7am)"`, `"Evening"`
- **Full Day / 24 Hours:** Blocks all shifts for that date.
- **Unspecified / Empty Slot (`[]`):** If no slot is specified, the booking occupies the entire date for that nurse.

### Example Conflict Response (Status `409 Conflict`):
```json
{
  "message": "Cannot accept booking: You have already accepted another booking on 9/10/2026 for Morning (8am–12pm). Nurses cannot take overlapping bookings.",
  "conflictingBookingId": "66dd812b..."
}
```

---

## 3. Booking Completion & Nurse Earnings

### Dual Approval Mechanism
Bookings require mutual confirmation to transition to `Completed`:
1. Nurse clicks "Mark as Completed":
   ```http
   PATCH /api/bookings/:id/status
   Authorization: Bearer <TOKEN>
   Content-Type: application/json

   { "status": "Completed" }
   ```
   *If patient has not yet approved:*
   ```json
   {
     "message": "Approval recorded. Waiting for the other party. Total Amount: 150",
     "booking": {
       "status": "In Progress",
       "completionApprovals": {
         "nurseApproved": true,
         "patientApproved": false
       }
     }
   }
   ```

2. Patient clicks "Confirm Completed":
   ```http
   PATCH /api/bookings/:id/status
   Authorization: Bearer <TOKEN>
   Content-Type: application/json

   { "status": "Completed" }
   ```
   *Both parties have now approved:*
   - `booking.status` transitions to `"Completed"`.
   - `nurse.earnings` is automatically credited with `booking.totalAmount`.
   - A `Payment` record with status `"Disbursed"` is automatically created.

### Nurse Profile Earnings Display
When the nurse loads their profile (`GET /api/nurses/profile` or `GET /api/auth/me`), the updated earnings are available:
```json
{
  "_id": "66dd812b...",
  "fullName": "Ama Serwaa",
  "earnings": 450,
  "totalEarnings": 450,
  "status": "Active"
}
```

---

## 4. Patient Booking Cancellation

Patients can cancel a pending booking request (`status: "Requested"`) or an accepted booking.

### Option A: Dedicated Cancel Endpoint (Recommended)
```http
PATCH /api/bookings/:id/cancel
Authorization: Bearer <PATIENT_OR_NURSE_TOKEN>
```
*(Also supports `POST /api/bookings/:id/cancel` and `DELETE /api/bookings/:id`)*

### Option B: Status Update Endpoint
```http
PATCH /api/bookings/:id/status
Authorization: Bearer <PATIENT_OR_NURSE_TOKEN>
Content-Type: application/json

{
  "status": "Cancelled"
}
```

### Response (`200 OK`):
```json
{
  "message": "Booking request successfully cancelled.",
  "booking": {
    "_id": "66dd812b...",
    "status": "Cancelled",
    ...
  }
}
```

### Edge Cases Handled:
- If booking is already `Completed` or `Cancelled`, returns `400 Bad Request`.
- If caller is neither the booking's patient, assigned nurse, nor admin, returns `403 Forbidden`.
- Automatically releases the nurse's calendar slot for other patients to book.
- Sends an in-app notification to the nurse informing them of the cancellation.

---

## 5. Quick Reference: Expected Request/Response Standards

| Flow | Method | Endpoint | Required Headers | Key Body Parameters | Success Code |
|---|---|---|---|---|---|
| Register Patient | `POST` | `/api/auth/register/patient` | `Authorization: Bearer <token>` | `fullName`, `phone`, `email` | `201 Created` |
| Register Nurse | `POST` | `/api/auth/register/nurse` | `Authorization: Bearer <token>` | `fullName`, `phone`, `email` | `201 Created` |
| Create Booking | `POST` | `/api/bookings` | `Authorization: Bearer <token>` | `nurseId`, `schedule`, `agreedRate`, `totalAmount` | `201 Created` |
| Accept Booking | `PATCH` | `/api/bookings/:id/status` | `Authorization: Bearer <token>` | `{"status": "Accepted"}` | `200 OK` (or `409` if conflict) |
| Complete Booking | `PATCH` | `/api/bookings/:id/status` | `Authorization: Bearer <token>` | `{"status": "Completed"}` | `200 OK` |
| Cancel Booking | `PATCH` | `/api/bookings/:id/cancel` | `Authorization: Bearer <token>` | None | `200 OK` |
| Get My Bookings | `GET` | `/api/bookings` | `Authorization: Bearer <token>` | None | `200 OK` |
| Nurse Profile & Earnings | `GET` | `/api/nurses/profile` | `Authorization: Bearer <token>` | None | `200 OK` |
