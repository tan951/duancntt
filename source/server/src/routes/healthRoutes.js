const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticate } = require('../middleware/authMiddleware');
const { 
    healthDataLimiter, 
    statsLimiter,
    apiLimiter 
} = require('../middleware/rateLimitMiddleware');

// Định nghĩa các route
// Đường dẫn gốc sẽ là /api/health (được khai báo bên index.js)

// GET /api/health/stats -> Lấy thống kê health data
// Phải đặt trước /:id để tránh conflict
// Áp dụng rate limiting riêng cho stats (tính toán nặng)
router.get('/stats', authenticate, statsLimiter, asyncHandler(healthController.getHealthStatistics));

// GET /api/health -> Lấy danh sách health data (với filter)
// Áp dụng rate limiting cho health data (cho phép nhiều requests hơn vì real-time)
router.get('/', authenticate, healthDataLimiter, asyncHandler(healthController.getAllHealthData));

// GET /api/health/patient/:id -> Lấy health data theo patient ID
// Phải đặt trước /:id để tránh conflict
router.get('/patient/:id', authenticate, healthDataLimiter, asyncHandler(healthController.getHealthDataByPatientId));

// GET /api/health/device/:deviceId -> Lấy health data theo device ID
// Phải đặt trước /:id để tránh conflict
router.get('/device/:deviceId', authenticate, healthDataLimiter, asyncHandler(healthController.getHealthDataByDeviceId));

// GET /api/health/:id -> Lấy chi tiết health data
// DELETE /api/health/:id -> Xóa health data
router.route('/:id')
    .get(authenticate, apiLimiter, asyncHandler(healthController.getHealthDataById))
    .delete(authenticate, apiLimiter, asyncHandler(healthController.deleteHealthData));

module.exports = router;

