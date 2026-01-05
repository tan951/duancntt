const mongoose = require('mongoose');
require('dotenv').config(); 

const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_health_db';

    mongoose.set('strictQuery', false);

    // SỬA Ở ĐÂY: Xóa bỏ object { useNewUrlParser: true, ... }
    const conn = await mongoose.connect(MONGODB_URI);

    console.log(`✅ Đã kết nối MongoDB thành công: ${conn.connection.host}`);
    
  } catch (error) {
    console.error(`❌ Lỗi kết nối MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;