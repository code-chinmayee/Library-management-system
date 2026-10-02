const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const DEFAULT_MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/library-management-system';
let fallbackMode = false;

async function connectDB(uri = DEFAULT_MONGO_URI) {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
      socketTimeoutMS: 2000
    });
    console.log('MongoDB connected');
    fallbackMode = false;
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
