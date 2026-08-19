<h1 align="center">PRN Nurse API Backend</h1>

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
</div>

<br />

A robust, secure, and highly scalable Node.js backend infrastructure powering the PRN Nurse application. This platform bridges the gap between patients seeking specialized care and qualified nursing professionals, featuring comprehensive booking mechanisms, strict onboarding contracts, and geospatial discovery.

---

## Table of Contents
- [Core Architecture](#core-architecture)
- [Key Features](#key-features)
- [Directory Structure](#directory-structure)
- [Local Installation](#local-installation)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Security Standards](#security-standards)

---

## Core Architecture

The system is built on a RESTful architecture utilizing **Express.js** and **Mongoose**, deployed as stateless Serverless Functions on **Vercel**. 

- **Geospatial Processing:** Leverages MongoDB's `2dsphere` indexing to match nurses with patients based on precise geographic coordinates and travel radius limits.
- **Stateless Authentication:** Implements JWT-based authorization, segregating access control strictly across `Admin`, `Nurse`, and `Patient` roles.
- **Volatile Memory Streaming:** File uploads bypass disk storage completely. Binary data is ingested via `multer` into memory buffers and piped securely via read streams directly to the Cloudinary API.

## Key Features

- **Multi-Tiered Access Control:** Role-based endpoints ensuring strict data boundaries between users.
- **Dynamic 9-Step Onboarding:** A structured pipeline guiding nurses through credential verification, skill assessments, and contractual agreements before account activation.
- **Medical Document Verification:** Secure, direct integration with Cloudinary for handling National IDs, Passports, and Proof of Address documentation.
- **Comprehensive Booking Engine:** Supports complex care scheduling, including granular duration limits, shift assignments, and automated frequency mappings for recurring care logic.
- **Administrative Telemetry:** A centralized dashboard granting administrators oversight into system health, metric trends, user flagging, and emergency escalations.

## Directory Structure

```text
backend/
├── controllers/    # Business logic and database mutations
├── middleware/     # Request interception (JWT validation, Role guards)
├── models/         # Mongoose schema definitions and constraints
├── routes/         # Express endpoint definitions and router mapping
├── utils/          # Core utilities and abstraction layers
└── server.js       # Entry point and express instantiation
```

## Local Installation

Ensure that you have Node.js (v18+) and npm installed on your development machine.

1. **Clone the repository**
   ```bash
   git clone https://github.com/Lanor-Jephthah1/prv-nurse.git
   cd prv-nurse/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the server**
   ```bash
   npm run dev
   ```
   The application will boot and listen for requests on `http://localhost:5000`.

## Environment Configuration

Create a `.env` file at the root of the `backend` directory. The application requires the following key-value pairs to function correctly:

```env
# Server Configuration
PORT=5000

# Database Connectivity
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority

# Security
JWT_SECRET=<cryptographic_jwt_signing_key>

# Cloudinary Integration
CLOUDINARY_CLOUD_NAME=<cloud_identifier>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>
```

## Deployment

The application is configured for seamless deployment to **Vercel**.

- **Production Endpoint:** `https://prn-nurse-backend.vercel.app`
- **API Prefix:** All active routes are prefixed with `/api` (e.g., `https://prn-nurse-backend.vercel.app/api/auth/login`).

Continuous deployment is triggered automatically upon commits pushed to the `main` branch.

## Security Standards

- **Cryptographic Hashing:** User passwords are encrypted using `bcryptjs` utilizing salt rounds prior to database persistence.
- **Endpoint Protection:** Routes are heavily protected; authorization headers require a well-formed `Bearer <token>` which is verified against the system's secret signature.
- **Payload Sanitization:** The controller layer aggressively normalizes incoming JSON payloads from the client layer to prevent database validation crashes or injection anomalies.
- **Zero-Disk Uploads:** Sensitive medical and identity documentation never touches the host server's local file system, ensuring compliance with strict data-at-rest security principles.

---

## Contributing

While this is primarily a closed-source platform, we welcome issue reports and bug fixes. If you discover a security vulnerability or have a feature request:
1. Open an Issue outlining the problem.
2. Fork the repository.
3. Submit a Pull Request with your proposed changes.

## License

&copy; 2026 PRN Nurse. All Rights Reserved. 

Unauthorized copying of this file, via any medium, is strictly prohibited. Proprietary and confidential.

## Support & Contact

For technical inquiries, system outages, or administrative support, please contact the repository maintainers or file an issue in the tracker.
