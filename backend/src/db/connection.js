/**
 * MongoDB connection. Optional: if MONGODB_URI is not set, app runs without DB
 * and normalization falls back to in-memory taxonomy.
 */
const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    console.warn('MONGODB_URI not set; resume normalization will use fallback.');
    return null;
  }
  if (isConnected) return mongoose.connection;
  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('MongoDB connected');
    return mongoose.connection;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    return null;
  }
}

module.exports = { connectDB };
