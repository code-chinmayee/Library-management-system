const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

let fallbackMode = false;

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/library-management-system');
    console.log('MongoDB connected');
    return { connected: true, fallbackMode: false };
  } catch (error) {
    fallbackMode = true;
    console.warn('MongoDB unavailable, using in-memory data store:', error.message);
    return { connected: false, fallbackMode: true };
  }
}

function isFallbackMode() {
  return fallbackMode;
}

module.exports = { connectDB, isFallbackMode };
