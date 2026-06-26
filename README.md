# EduRegister — Smart Course Registration System

A full-stack web application for intelligent university course registration with conflict detection, seat management, and AI-powered course recommendations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, Tailwind CSS, Vanilla JavaScript |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Sessions | express-session (cookie-based) |

---

## Project Structure

```
smart-course-registration/
├── server.js                  # Express server + all REST API routes
├── package.json
├── models/
│   ├── User.js                # User schema (student / admin)
│   ├── Course.js              # Course schema
│   └── Registration.js        # Registration schema
└── public/
    ├── index.html             # Login page (student + admin toggle)
    ├── dashboard.html         # Student portal
    ├── admin.html             # Admin panel
    └── script.js              # All frontend logic (fetch, routing, UI)
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- [MongoDB](https://www.mongodb.com/try/download/community) running locally on default port `27017`

---

## Setup & Installation

**1. Clone or download the project**

```bash
cd smart-course-registration
```

**2. Install dependencies**

```bash
npm install
```

**3. Start MongoDB** (if not already running)

```bash
# macOS / Linux
mongod

# Windows
"C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe"
```

**4. Start the server**

```bash
node server.js
```

**5. Open in browser**

```
http://localhost:3000
```

The admin account is automatically seeded into the database on first run.

---

## Default Credentials

### Admin
| Field | Value |
|---|---|
| Email | `admin@university.edu` |
| Password | `admin123` |

> Admin login is available via the **Admin** tab on the login page. There is no admin signup — credentials are seeded automatically.

### Students
Register a new account via the **Student** tab → **Sign up** link on the login page.

---

## REST API Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/signup` | Public | Register a new student |
| `POST` | `/api/login` | Public | Login (student or admin) |
| `POST` | `/api/logout` | Authenticated | Destroy session |
| `GET` | `/api/courses` | Authenticated | Get all courses |
| `POST` | `/api/addCourse` | Admin only | Add a new course |
| `DELETE` | `/api/course/:id` | Admin only | Delete a course + its registrations |
| `POST` | `/api/registerCourse` | Student only | Register for a course |
| `GET` | `/api/studentCourses/:userId` | Authenticated | Get a student's enrolled courses |
| `GET` | `/api/admin/stats` | Admin only | Get platform-wide analytics |
| `GET` | `/api/courseStudents/:courseId` | Admin only | Get students enrolled in a course |

---

## Database Schemas

### User
```js
{
  name:      String   // required
  email:     String   // required, unique, lowercase
  password:  String   // required (plaintext for simplicity)
  role:      String   // "student" | "admin"
  createdAt: Date
  updatedAt: Date
}
```

### Course
```js
{
  name:           String   // required
  code:           String   // required, unique, uppercase
  instructor:     String   // required
  time:           String   // required, e.g. "Mon/Wed 9:00–10:30"
  maxSeats:       Number   // required
  availableSeats: Number   // auto-set to maxSeats on creation
  createdAt:      Date
  updatedAt:      Date
}
```

### Registration
```js
{
  userId:    ObjectId  // ref: User
  courseId:  ObjectId  // ref: Course
  time:      String    // copied from course at registration time
  createdAt: Date
  updatedAt: Date
}
```

---

## Features

### Student Portal

**Overview Tab**
- Stat cards: total available courses, enrolled courses, total open seats
- Quick-look course grid with seat progress bars

**All Courses Tab**
- Full course catalog with instructor, time slot, and live seat counts
- Color-coded seat bars (green → orange when nearly full)
- Register button with instant feedback

**My Courses Tab**
- List of all enrolled courses with time chip and seat info

**Recommendations Tab**
- Automatically populated when the student is enrolled in an AI-related course
- Suggests Machine Learning and Data Science courses from the catalog

---

### Admin Panel

**Analytics Tab**
- Total students, total courses, total registrations
- Per-course enrollment table with seats remaining

**Manage Courses Tab**
- Full course table with status badges
- View enrolled students in a modal (name + email)
- Delete course (also removes all related registrations)

**Add Course Tab**
- Form to add a new course with name, code, instructor, time slot, and max seats
- `availableSeats` is automatically set equal to `maxSeats`

---

## Smart Backend Logic

### Conflict Detection
When a student attempts to register for a course, the server checks all their existing registrations. If any registered course shares the same `time` value, registration is blocked with a descriptive error message.

```
Error: "Time conflict with "Machine Learning" at Mon/Wed 9:00–10:30"
```

### Seat Management
- `availableSeats` is decremented by 1 on every successful registration
- Registration is blocked if `availableSeats === 0`
- Seats are not restored on course deletion (registrations are wiped)

### Duplicate Prevention
A unique check on `(userId, courseId)` prevents a student from registering for the same course twice.

### AI Course Recommendations
If the registered course name contains `"ai"` or `"artificial intelligence"` (case-insensitive), the API scans the catalog and returns any courses whose name contains `"machine learning"` or `"data science"` as recommendations. These are returned in the API response and surfaced in the frontend Recommendations tab.

---

## Frontend Behaviour

- All API calls use the native `fetch()` API — no external HTTP libraries
- Logged-in user (id, name, email, role) is stored in `localStorage`
- On login: students are redirected to `dashboard.html`, admins to `admin.html`
- Visiting any dashboard page without a valid session redirects to `index.html`
- Toast alerts appear top-right for all success, error, and info events

---

## Alert Messages

| Event | Type |
|---|---|
| Successful registration | ✅ Success |
| Duplicate registration | ⚠️ Error |
| Time slot conflict | ⚠️ Error |
| No seats available | ⚠️ Error |
| AI course recommendation | 💡 Info |
| Course added / deleted | ✅ Success |
| Login failure | ⚠️ Error |

---

## Running in Development (with auto-restart)

```bash
npm install -g nodemon
nodemon server.js
```

---

## Notes

- Passwords are stored as plaintext for simplicity. In production, use `bcrypt`.
- Sessions use a hardcoded secret (`course_secret_key_2024`). Use an environment variable in production.
- No `.env` file is required for local development.
- The app runs entirely on `localhost:3000` with no build step.

---

## License

MIT — free to use and modify.