const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  try {
    // Support both MONGODB_URI and MONGO_URI for compatibility with different deployment platforms
    let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zenvest-dummy';
    
    // Try to set DNS servers for SRV resolution - use system DNS first
    // This fixes "querySrv ECONNREFUSED" on networks where default DNS blocks SRV lookups
    try {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
    } catch (e) {
      // Ignore DNS set errors
    }
    
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Log URI without password
    
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.db.databaseName}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Don't exit process - allow server to start for debugging
  }
};

module.exports = connectDB;