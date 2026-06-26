const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true },
  instructor: { type: String, required: true },
  time: { type: String, required: true },
  maxSeats: { type: Number, required: true },
  availableSeats: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);