const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, trim: true },
  bookTitle: { type: String, required: true, trim: true },
  issueDate: { type: String, required: true },
  returnDate: { type: String, default: '' },
  status: { type: String, default: 'Issued' }
}, { timestamps: true });

module.exports = mongoose.model('Issue', issueSchema);
