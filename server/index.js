const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./src/config/connect_db');

// Import Routes
const userRoutes = require('./src/routes/userRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');
const healthRoutes = require('./src/routes/healthRoutes');

// Import Error Middleware
const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');

const app = express();
const server = http.createServer(app);

// 1. Kết nối Database và xóa refresh tokens khi server restart
(async () => {
  try {
    await connectDB();
    
    // Khi server restart, xóa tất cả refresh tokens để buộc user đăng nhập lại
    const User = require('./src/models/userModel');
    await User.updateMany(
      {},
      { 
        $set: { 
          refreshToken: null,
          refreshTokenExpiry: null
        } 
      }
    );
    console.log('🔄 Đã xóa tất cả refresh tokens sau khi server restart');
  } catch (err) {
    console.error('❌ Lỗi khi khởi động server:', err);
    process.exit(1);
  }
})();

// 2. Socket.IO Configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Lưu io instance để sử dụng trong các module khác
global.io = io;

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// --- THÊM DÒNG NÀY ĐỂ CHẠY MQTT WORKER ---
require('./src/services/mqttService'); 
// -----------------------------------------

// 3. Middleware
// CORS configuration - cho phép client kết nối từ localhost:5173 (Vite dev server)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); 

// 4. Routes
app.use('/api/users', userRoutes); 
app.use('/api/devices', deviceRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/health', healthRoutes); 

// 5. Error Middleware
app.use(notFound); 
app.use(errorHandler); 

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready`);
});