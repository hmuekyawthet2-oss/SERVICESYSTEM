# 🏥 Medical Equipment Service Data Entry System v2

A complete service data entry system for managing medical equipment installations, preventive maintenance, and field service workflows.

## 🚀 Quick Start

### 1. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE service_db;"

# Run the schema (creates tables + seed data)
psql -U postgres -d service_db -f backend/src/config/schema.sql

# Create admin user with proper password hash
cd backend
node src/config/seed.js
```

### 2. Backend (port 3001)

```bash
cd backend
cp .env .env.example  # edit with your PostgreSQL credentials
npm install
npm run dev
```

### 3. Frontend (port 3000)

```bash
cd frontend
npm install
npm run dev
```

### 4. Docker (Alternative for PostgreSQL)

```bash
docker run --name medical-pg -e POSTGRES_PASSWORD=your_password -p 5432:5432 -d postgres:16
```

### Default Logins

| Role | Username | Password |
|------|----------|----------|
| Main Admin | `admin` | `admin123` |
| Co-Admin | `technician` | `tech123` |

---

## 📁 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── schema.sql          # Full PostgreSQL schema with indexes
│   │   │   ├── database.js         # Connection pool
│   │   │   └── seed.js             # Admin user seed script
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT authentication middleware
│   │   ├── routes/
│   │   │   ├── auth.js             # Login, register, profile, users
│   │   │   ├── permissions.js      # Role-based permission management
│   │   │   ├── machines.js         # Module A: CRUD + lookups + admin
│   │   │   ├── pmSchedules.js      # Module B: Dashboard + status API
│   │   │   └── serviceTickets.js   # Module C: Tickets + workflow
│   │   ├── services/
│   │   │   └── pmScheduler.js      # PM date calc + color engine
│   │   └── app.js                  # Express entry point
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Auth state, permissions, login/logout
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx        # Login with role display
│   │   │   ├── MachineRegistryPage.jsx
│   │   │   ├── MachineFormPage.jsx  # Training dates, fees, model dropdown
│   │   │   ├── PMDashboardPage.jsx  # Color-coded dashboard
│   │   │   ├── ServiceTicketsPage.jsx # Finished status
│   │   │   ├── TicketFormPage.jsx   # Fees, textarea errors, timestamps
│   │   │   ├── PermissionsPage.jsx  # Main admin manages co-admin access
│   │   │   └── AdminSettingsPage.jsx # Townships, brands, models, types
│   │   ├── components/Layout.jsx
│   │   ├── services/api.js
│   │   └── utils/pmCalculator.js
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🔐 Authentication & Roles

- **Main Admin**: Full access to all modules, user management, and permission settings
- **Co-Admin**: Access controlled by per-tab, per-field permissions set by Main Admin
- JWT-based authentication with 24-hour token expiry
- Main Admin can create/deactivate users and grant/revoke permissions per module

### Permission Tabs
| Tab | Fields |
|-----|--------|
| Machine Registry | Create, Edit, Delete |
| PM Dashboard | View, Complete |
| Service Tickets | Create, Edit, Delete, Close/Finish |
| Settings | View, Edit |

## 🔧 Features

### Module A: Machine Registry
- Full CRUD with validation (unique serial numbers, required fields)
- **Brand → Model dropdown**: Models are linked to brands in Settings; selecting a brand shows its models
- **Training Dates**: Dynamic multi-entry — add as many training sessions as needed, each with a date picker
- **Technician Names**: Supports multiple persons (comma-separated: "Aung Kyaw, Thin Thin, Group A")
- **Fees**: Service Fees, Transportation Fees, Training Fees on each machine

### Module B: PM Dashboard
- Auto-calculated 1st PM (Installation + 6 months) and 2nd PM (1st PM + 6 months)
- **PM Window**: [PM Date - 10 days] to [PM Date + 14 days]
- Dynamic color indicators:
  - 🔵 **Blue**: Upcoming (within 1 month before PM date)
  - 🟢 **Green**: In Window (active PM period)
  - 🔴 **Red**: Overdue (past PM window)
  - ⚪ **Gray**: Scheduled (not yet in active period)
- KPI summary cards with click-to-filter

### Module C: Service Tickets
- Auto-generated Request IDs: `REQ-YYYYMMDD-XXXX`
- **Action Date**: Full date + time picker (datetime-local)
- **Error Type**: Textarea for listing multiple errors
- **Technician Names**: Multiple persons supported
- **Fees**: Service, Transport, and Training fees per ticket
- Workflow: Open → Pending Job → In Progress → **Finished** (green)
- Spare parts logic: Yes → "Pending Job"; No → "Open" (can close directly)

### Admin Settings
- Manage Townships, Brands, Machine Types (inline CRUD)
- **Models Manager**: Models linked to brands — filter by brand, add/edit/delete per brand
- Foreign key protection: Cannot delete entries in use by machines

## 📊 Database Schema (7+ tables)

| Table | Purpose |
|-------|---------|
| `users` | Authentication (main_admin / co_admin) |
| `permissions` | Per-user tab/field access grants |
| `townships` | Location reference data |
| `brands` | Equipment manufacturer brands |
| `models` | Equipment models (linked to brands) |
| `machine_types` | Categories of medical equipment |
| `machines` | Installed equipment registry |
| `training_dates` | Dynamic training sessions per machine |
| `pm_schedules` | Preventive maintenance schedule entries |
| `service_tickets` | Service complaint workflow tickets |

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js, PostgreSQL (pg)
- **Frontend**: React 18, Vite, Tailwind CSS, React Router v6
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Validation**: express-validator
- **Notifications**: react-hot-toast
