# Litera – Full-Stack Task Management App

> Ujian Tengah Semester – Pengembangan Aplikasi Berbasis Platform (KP70064006)

---

## Deskripsi Aplikasi

**Litera** adalah aplikasi manajemen tugas full-stack berbasis web dengan fitur:
- 🔐 JWT Authentication (Register, Login, Refresh, Logout)
- ✅ CRUD Tugas dengan filter, search, dan prioritas
- 📁 CRUD Proyek dengan tracking progress
- 📅 Kalender terintegrasi (tugas & proyek muncul di tanggal due-nya)
- ⟁ Time Manage – ranking prioritas tugas otomatis berdasarkan urgensi & deadline
- 🌙 Dark/Light Mode
- 📱 Responsif

---

## Tech Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Backend  | Node.js + Express             |
| Auth     | JWT (access + refresh tokens) |
| Database | MySQL                         |
| Frontend | Vanilla HTML + CSS + JS       |

---

## Cara Menjalankan

### 1. Install & Start Backend

```bash
cd backend
npm install
npm start
```

Backend berjalan di: `http://localhost:3001`

### 2. Buka Frontend

Buka file `frontend/index.html` di browser. Bisa dengan:
- Double-click file langsung (beberapa browser izinkan CORS dari `file://`)
- Menggunakan Live Server (VS Code extension) → `http://127.0.0.1:5500`
- Atau `npx serve frontend`

---

## Struktur Proyek

```
Litera/
├── backend/
│   ├── src/
│   │   ├── index.js               # Entry point Express server
│   │   ├── config/
│   │   │   └── jwt.js             # JWT helpers (sign/verify)
│   │   ├── middleware/
│   │   │   └── auth.js            # JWT authentication middleware
│   │   ├── models/
│   │   │   └── database.js        # In-memory DB + seed data
│   │   ├── controllers/
│   │   │   ├── authController.js  # Register, Login, Refresh, Logout
│   │   │   ├── taskController.js  # CRUD Tasks
│   │   │   └── projectController.js # CRUD Projects
│   │   └── routes/
│   │       ├── auth.js            # /api/auth/*
│   │       └── resources.js       # /api/tasks/*, /api/projects/*
│   ├── .env                       # Environment variables
│   └── package.json
└── frontend/
    ├── index.html                 # Login & Register page
    ├── app.html                   # Main dashboard (semua halaman)
    └── assets/
        └── js/
            └── api.js             # HTTP client + Token service
```

---

## API Endpoints

### Tasks (semua dilindungi JWT)
| Method | Endpoint        | Deskripsi |
|--------|-----------------|-----------|
| GET    | /api/tasks      | List semua task (filter: status, priority, projectId, search) |
| GET    | /api/tasks/:id  | Detail task |
| POST   | /api/tasks      | Buat task baru |
| PUT    | /api/tasks/:id  | Update task |
| DELETE | /api/tasks/:id  | Hapus task |

### Projects (semua dilindungi JWT)
| Method | Endpoint           | Deskripsi |
|--------|--------------------|-----------|
| GET    | /api/projects      | List semua project |
| GET    | /api/projects/:id  | Detail project + tasks |
| POST   | /api/projects      | Buat project baru |
| PUT    | /api/projects/:id  | Update project |
| DELETE | /api/projects/:id  | Hapus project |

---

## Halaman Frontend

| Halaman     | Fitur |
|-------------|-------|
| Login/Register | Form auth, switch tab, error handling |
| Dashboard   | Statistik ringkasan, recent tasks, active projects |
| My Tasks    | Daftar semua task + filter status/priority/project + search |
| Projects    | Grid proyek + filter + progress bar |
| Calendar    | Navigasi bulan, event tugas & proyek berdasarkan due date |
| Time Manage | Ranking prioritas otomatis + distribusi task |

---

## Best Practices yang Diterapkan

- ✅ JWT access token (15m) + refresh token (7d) dengan rotation
- ✅ Password hashing dengan bcrypt (salt rounds: 12)
- ✅ Helmet.js untuk security headers
- ✅ Rate limiting (auth: 20/15min, global: 500/15min)
- ✅ CORS configuration
- ✅ Input validation di controller
- ✅ Error handling middleware
- ✅ Token auto-refresh di frontend (transparent retry)
- ✅ Separation of concerns (routes, controllers, middleware, models)
- ✅ Environment variables untuk secrets (.env)
- ✅ HTTP status codes yang tepat (200, 201, 400, 401, 404, 409, 500)
- ✅ RESTful response format konsisten

---

## Format Response API

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "...", "name": "...", "email": "..." },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

Error response:
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```
