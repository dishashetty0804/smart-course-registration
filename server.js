const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const User = require('./models/User');
const Course = require('./models/Course');
const Registration = require('./models/Registration');

const app = express();
const PORT = 3000;

mongoose.connect('mongodb://localhost:27017/courseRegistration')
  .then(async () => {
    console.log('MongoDB connected');
    await seedAdmin();
  })
  .catch(err => console.error('MongoDB error:', err));

async function seedAdmin() {
  const existing = await User.findOne({ role: 'admin' });
  if (!existing) {
    const admin = new User({
      name: 'Admin',
      email: 'admin@university.edu',
      password: 'admin123',
      role: 'admin'
    });
    await admin.save();
    console.log('Admin seeded: admin@university.edu / admin123');
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'course_secret_key_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const user = new User({ name, email, password, role: 'student' });
    await user.save();
    res.json({ message: 'Signup successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user._id;
    req.session.role = user.role;

    res.json({
      message: 'Login successful',
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

// Middleware: auth check
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required' });
  next();
}

// POST /api/addCourse (admin)
app.post('/api/addCourse', requireAdmin, async (req, res) => {
  try {
    const { name, code, instructor, time, maxSeats } = req.body;
    if (!name || !code || !instructor || !time || !maxSeats)
      return res.status(400).json({ error: 'All fields required' });

    const exists = await Course.findOne({ code });
    if (exists) return res.status(400).json({ error: 'Course code already exists' });

    const course = new Course({
      name, code, instructor, time,
      maxSeats: parseInt(maxSeats),
      availableSeats: parseInt(maxSeats)
    });
    await course.save();
    res.json({ message: 'Course added', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/courses
app.get('/api/courses', requireLogin, async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/course/:id (admin)
app.delete('/api/course/:id', requireAdmin, async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    await Registration.deleteMany({ courseId: req.params.id });
    res.json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/registerCourse (student)
app.post('/api/registerCourse', requireLogin, async (req, res) => {
  try {
    if (req.session.role !== 'student')
      return res.status(403).json({ error: 'Students only' });

    const { courseId } = req.body;
    const userId = req.session.userId;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (course.availableSeats <= 0)
      return res.status(400).json({ error: 'No seats available' });

    const duplicate = await Registration.findOne({ userId, courseId });
    if (duplicate) return res.status(400).json({ error: 'Already registered for this course' });

    // Conflict detection
    const myRegistrations = await Registration.find({ userId }).populate('courseId');
    for (const reg of myRegistrations) {
      if (reg.courseId && reg.courseId.time === course.time) {
        return res.status(400).json({
          error: `Time conflict with "${reg.courseId.name}" at ${course.time}`
        });
      }
    }

    const registration = new Registration({ userId, courseId, time: course.time });
    await registration.save();

    course.availableSeats -= 1;
    await course.save();

    // Course Recommendation
    let recommendations = [];
    const nameLower = course.name.toLowerCase();
    if (nameLower.includes('ai') || nameLower.includes('artificial intelligence')) {
      const allCourses = await Course.find();
      recommendations = allCourses
        .filter(c =>
          c._id.toString() !== courseId &&
          (c.name.toLowerCase().includes('machine learning') ||
           c.name.toLowerCase().includes('data science'))
        )
        .map(c => ({ name: c.name, code: c.code }));
    }

    res.json({ message: 'Registered successfully', recommendations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/studentCourses/:userId
app.get('/api/studentCourses/:userId', requireLogin, async (req, res) => {
  try {
    const registrations = await Registration.find({ userId: req.params.userId })
      .populate('courseId');
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalCourses = await Course.countDocuments();
    const totalRegistrations = await Registration.countDocuments();

    const courses = await Course.find();
    const courseStats = await Promise.all(courses.map(async (c) => {
      const enrolled = await Registration.countDocuments({ courseId: c._id });
      return {
        _id: c._id,
        name: c.name,
        code: c.code,
        instructor: c.instructor,
        time: c.time,
        maxSeats: c.maxSeats,
        availableSeats: c.availableSeats,
        enrolled
      };
    }));

    res.json({ totalStudents, totalCourses, totalRegistrations, courseStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/courseStudents/:courseId
app.get('/api/courseStudents/:courseId', requireAdmin, async (req, res) => {
  try {
    const registrations = await Registration.find({ courseId: req.params.courseId })
      .populate('userId', 'name email');
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));