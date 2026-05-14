# Vision AI Platform — Multi-Tenant Flow & Architecture

> Target state: a SaaS platform where many companies can onboard, each company has
> multiple branches, and each branch has its own DVRs/NVRs, cameras, deployments,
> and events. A **company admin** sees every branch; a **branch user** sees only
> their own branch. All event screenshots land in cloud storage so everything is
> viewable from a single browser, regardless of which branch server recorded it.

---

## 1. High-Level Concept

```
┌────────────────────────────────────────────────────────────────┐
│                        PLATFORM (SaaS)                         │
│                                                                │
│   ┌──────────────┐      ┌──────────────┐      ┌────────────┐   │
│   │  Company A   │      │  Company B   │      │ Company C  │   │
│   │              │      │              │      │            │   │
│   │ ┌──────────┐ │      │ ┌──────────┐ │      │ ┌────────┐ │   │
│   │ │ Branch 1 │ │      │ │ Branch 1 │ │      │ │ Branch │ │   │
│   │ │  DVR+cam │ │      │ │  NVR+cam │ │      │ │  1..N  │ │   │
│   │ └──────────┘ │      │ └──────────┘ │      │ └────────┘ │   │
│   │ ┌──────────┐ │      │ ┌──────────┐ │      │            │   │
│   │ │ Branch 2 │ │      │ │ Branch 2 │ │      │            │   │
│   │ └──────────┘ │      │ └──────────┘ │      │            │   │
│   │ ┌──────────┐ │      └──────────────┘      └────────────┘   │
│   │ │ Branch 3 │ │                                             │
│   │ └──────────┘ │                                             │
│   └──────────────┘                                             │
│                                                                │
│   Cloud storage (S3 / Wasabi / MinIO) for event screenshots    │
└────────────────────────────────────────────────────────────────┘
```

Each tenant's data is isolated at the DB level, enforced by a single FastAPI
dependency that injects `company_id` / `branch_id` filters into every query.

---

## 2. Roles & Access

| Role            | Scope                          | What they see                                                   |
|-----------------|--------------------------------|-----------------------------------------------------------------|
| `super_admin`   | Entire platform (you)          | All companies, billing, ops — not exposed in normal UI          |
| `company_admin` | One company, all branches      | Every branch's devices, cameras, deployments, events            |
| `branch_user`   | One branch within one company  | Only their branch's devices, cameras, deployments, events       |

Rule of thumb: if `user.branch_id IS NULL` → company-wide view. Else → branch-scoped.

---

## 3. Database Schema (target state)

### New tables

```
companies                  branches                  users
─────────                  ────────                  ─────
id           PK            id              PK        id               PK
name                       company_id      FK        email            UNIQUE
slug         UNIQUE        name                      password_hash
logo_url                   location                  role             ENUM(company_admin, branch_user)
created_at                 phone                     company_id       FK (always set)
status       ENUM          created_at                branch_id        FK (NULL for company_admin)
                           UNIQUE(company_id,name)   last_login_at
                                                     created_at
```

### Modified existing tables (add tenancy FKs)

```
devices                    events (denormalized for fast filtering)
───────                    ──────
+ branch_id   FK           + company_id   FK   (indexed)
                           + branch_id    FK   (indexed)
                           + cloud_url    TEXT (S3 object URL, replaces/augments
                                                screenshot_path)
```

`cameras`, `deployments` stay untouched — they inherit tenancy through
`Camera → Device → Branch → Company`.

### Why denormalize `company_id` / `branch_id` onto `events`

Events become the largest, hottest table. With tenancy columns directly on the
row, listing filters are a single-table index scan. Without them, every event
query has to join through `camera → device → branch`. You're already
denormalizing `camera_name` / `device_name` on events for the same reason.

---

## 4. End-to-End User Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1 — COMPANY SIGNUP (public page)                                   │
│  • /signup → creates `companies` row                                    │
│  • Also creates first `users` row with role=company_admin               │
│  • Sends verification email                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2 — COMPANY ADMIN LOGS IN                                          │
│  • JWT issued with {user_id, company_id, branch_id:null, role}          │
│  • Lands on CompanyDashboard                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3 — CREATE BRANCHES                                                │
│  • /branches (UI) → POST /branches {name, location}                     │
│  • Row written with company_id from token                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4 — CREATE BRANCH USERS                                            │
│  • /users (UI) → POST /users {email, branch_id, role:branch_user}       │
│  • Invite link emailed; user sets password on first login               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5 — BRANCH USER (or admin) LOGS IN                                 │
│  • Token carries company_id + branch_id                                 │
│  • Sidebar tabs enabled: Devices / Cameras / Models / Deploy / Events   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 6 — REGISTER DVR / NVR  (tab: Devices)                             │
│  • POST /devices {name, ip, username, password, rtsp_port, type}        │
│  • Backend attaches branch_id from token                                │
│  • GET /devices/{id}/streams probes 1..32 channels, auto-creates        │
│    cameras rows                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 7 — VIEW CAMERAS  (tab: Cameras)                                   │
│  • GET /cameras returns only this user's branch cameras                 │
│  • Live MJPEG grid via /stream/{camera_id}                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 8 — UPLOAD / VIEW MODELS  (tab: Models)                            │
│  • Models can be global (shared across tenants) OR company-scoped       │
│  • POST /models (multipart: weights + inference.py)                     │
│  • company_id attached; global models have company_id=NULL              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 9 — DEPLOY  (tab: Deploy)                                          │
│  • User picks: device → camera → model                                  │
│  • POST /deployments {camera_id, model_id}                              │
│  • Backend: validates camera belongs to user's branch                   │
│  • Spawns 24/7 InferenceWorker (reader + inference threads)             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 10 — EVENTS  (tab: Events)                                         │
│  • Worker calls fire_event() on detection                               │
│  • Screenshot uploaded to S3 (cloud_url) + local cache                  │
│  • POST /events {..., company_id, branch_id, cloud_url}                 │
│  • GET /events filtered by token's scope                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Request → Data Flow (tenancy enforcement)

```
                         ┌─────────────────────┐
   Browser  ───(JWT)───► │  FastAPI endpoint   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Depends(get_user) │  ← decodes JWT
                         └──────────┬──────────┘
                                    │  user = {id, company_id, branch_id, role}
                                    ▼
                         ┌─────────────────────┐
                         │ Depends(scope_filter)│ ← builds SQL filter
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Query with filter  │
                         │  (company or branch)│
                         └──────────┬──────────┘
                                    │
                                    ▼
                               Tenant data only
```

Single dependency `current_scope()` returns a reusable `(company_id, branch_id_or_none)`
tuple; every list/detail/write endpoint uses it. One place to get right, no
tenant leak through misread code.

---

## 6. Cloud Storage — why and how

### Why
Right now screenshots live in `backend/events/screenshots/` on the branch's
local server. If a company admin wants to see events from three branches, each
branch's server has to be internet-reachable. That breaks the moment a branch
is behind NAT or its box is off.

### How
Every `fire_event()` does:

```
1. save local JPEG (unchanged — keeps the local cache working)
2. upload to S3 (or Wasabi / MinIO / R2): 
      key = {company_slug}/{branch_id}/{yyyy}/{mm}/{dd}/{event_uuid}.jpg
3. POST /events with cloud_url + screenshot_path
```

Frontend preference: if `cloud_url` is present, render from cloud. Else fall
back to the local `/events/image/{filename}` endpoint. This keeps older events
working during the migration and survives a branch going offline.

### Provider choice
- **S3** — default, most ecosystem support.
- **Wasabi / Cloudflare R2** — same API, cheaper egress. Worth it for video/image-heavy workloads.
- **MinIO** — self-hosted, useful if the company wants data on-prem.

All four speak the S3 API, so one `boto3` client covers everything — provider
is just an env var.

---

## 7. API — new + modified endpoints

### New: Auth & tenancy

| Method | Path                | Purpose                                 | Auth           |
|--------|---------------------|-----------------------------------------|----------------|
| POST   | /signup             | Create company + first company_admin    | public         |
| POST   | /login              | Issue JWT                               | public         |
| POST   | /branches           | Create branch                           | company_admin  |
| GET    | /branches           | List branches in my company             | any            |
| DELETE | /branches/{id}      | Remove branch                           | company_admin  |
| POST   | /users              | Invite a branch user                    | company_admin  |
| GET    | /users              | List users in my company                | company_admin  |
| DELETE | /users/{id}         | Remove user                             | company_admin  |
| GET    | /me                 | Current user + scope                    | any            |

### Modified (all now scope-filtered)

Every existing route in `backend/main.py` gets a `Depends(current_scope)`:

- `GET/POST/DELETE /devices`
- `GET /devices/{id}/streams`
- `GET /cameras`, `GET /stream/{camera_id}`, `GET /snapshot/{camera_id}`
- `GET/POST/DELETE /models`  (models can be global; write requires company_admin)
- `GET/POST/DELETE /deployments`
- `GET/POST/DELETE /events`, `GET /events/image/{filename}`

Writes validate that referenced resources belong to the caller's scope *before*
touching anything.

---

## 8. Frontend — screens & routing

```
/                          → redirect by auth state
/signup                    → Company signup form
/login                     → Login
/
  ├── /dashboard           → role-aware overview
  ├── /branches            → (company_admin only) CRUD branches
  ├── /users               → (company_admin only) invite/manage users
  ├── /devices             → existing Devices.jsx, now scoped
  ├── /cameras             → existing StreamsView.jsx
  ├── /models              → existing MLModels.jsx
  ├── /deploy              → existing Deploy.jsx
  ├── /events              → existing Events.jsx (with cloud_url rendering)
  └── /settings            → profile, company settings
```

### Sidebar changes

- Header: company logo + name, branch selector for `company_admin`
  (a dropdown to "view as branch X" that filters the whole UI).
- Items hidden/shown based on role from `/me`.
- Current sidebar stays; just gated by role.

### Auth plumbing

- JWT in `localStorage` (simple start) or httpOnly cookie (better).
- Axios interceptor adds `Authorization: Bearer <token>`.
- A `<ProtectedRoute>` wrapper + `<RoleGate role="company_admin">` component.

---

## 9. Component Architecture

```
┌─────────────────────── FRONTEND (React) ────────────────────────┐
│                                                                 │
│   AuthProvider ── JWT, current user, scope                      │
│        │                                                        │
│        ├── Router                                               │
│        │     ├── Public:  /signup, /login                       │
│        │     └── Protected:  /dashboard, /devices, ...          │
│        │                                                        │
│        └── ApiClient (axios)                                    │
│              ↓ Authorization header                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │  HTTPS
┌─────────────────────────▼───────────────────────────────────────┐
│                      BACKEND (FastAPI)                          │
│                                                                 │
│   Middleware:   CORS, request-id                                │
│   Depends:      get_user → current_scope                        │
│                                                                 │
│   Routers:                                                      │
│     ├── auth_router       (signup, login, me)                   │
│     ├── tenancy_router    (companies, branches, users)          │
│     ├── devices_router    (devices + stream discovery)          │
│     ├── cameras_router    (list, MJPEG, snapshot)               │
│     ├── models_router     (upload, delete)                      │
│     ├── deployments_router(start/stop InferenceWorker)          │
│     └── events_router     (create, list, image proxy)           │
│                                                                 │
│   Background:                                                   │
│     ├── FrameGrabber      (per camera, shared reader)           │
│     ├── InferenceWorker   (per deployment, reader + model)      │
│     └── EventUploader     (async S3 upload queue)               │
│                                                                 │
│   Storage:                                                      │
│     ├── SQLite / Postgres (metadata)                            │
│     ├── Local disk        (short-lived cache: frames, JPEGs)    │
│     └── S3 / R2 / MinIO   (durable event screenshots, models)   │
└─────────────────────────────────────────────────────────────────┘
```

### Why Postgres (eventually)
SQLite with `NullPool` is fine for a single branch server. Once you have
multiple companies and concurrent writes across long-lived MJPEG connections,
the single-writer lock becomes a bottleneck. Migrate to Postgres when you hit
it — the SQLAlchemy models don't change.

---

## 10. Migration from current single-tenant DB

You already have real data in `vision.db`. Don't lose it.

```
1. Create companies, branches, users tables (empty).
2. Insert one row: company "Default Co", slug "default".
3. Insert one row: branch "Main", company_id = 1.
4. Add branch_id column to devices; backfill all existing rows with branch_id=1.
5. Add company_id + branch_id + cloud_url to events; backfill from device→branch.
6. Create first company_admin user row; have them reset password on first login.
7. Ship the JWT-protected version of the API. Old endpoints stop working
   without a token — a breaking change, so announce it.
```

Single Alembic migration handles 1–5. Steps 6–7 are a release.

---

## 11. Build Order (suggested)

1. **DB models + Alembic migration** for companies / branches / users +
   add FKs. Backfill script for existing rows.
2. **Auth**: JWT signup/login, `get_user` + `current_scope` dependencies.
   Wire `/me`.
3. **Scope every existing endpoint.** Add the filter; add 403s where role
   doesn't permit the action.
4. **Company admin UI**: Branches page, Users page, branch selector in sidebar.
5. **Role gating** across existing pages.
6. **S3 uploader** in `fire_event()`; add `cloud_url` rendering in Events.jsx.
7. **(later) Postgres migration** when SQLite starts hurting.
8. **(later) Model marketplace**: flag `company_id=NULL` models as "global"
   so every tenant can deploy them without re-uploading.

Each step is shippable on its own, so you don't have a multi-week "nothing
works" window.

---

## 12. Open Questions (decide before coding)

- **Self-signup or gated?** Any company can sign up, or you manually create
  them? (Affects Step 1 and abuse risk.)
- **Email provider?** Signup verification + user invites need SMTP / SES /
  Resend / Postmark.
- **Where does the inference actually run?** Each branch's own box, or
  centralized GPU servers pulling RTSP? Big cost/latency trade-off — branch
  boxes = more hardware, central = one fat GPU but needs reachable RTSP.
- **Billing?** Per-camera, per-deployment, per-event? Not urgent, but the
  schema should allow a `subscriptions` / `usage` table later.
- **Data retention?** How long do event screenshots live in S3? 30 days?
  Forever? This is the main cloud cost driver.

Answer these before Step 1 — some change the schema.
