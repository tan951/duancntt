const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticate, authorize, checkOwnership } = require('../middleware/authMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

// Định nghĩa các route
// Đường dẫn gốc sẽ là /api/devices (được khai báo bên index.js)

// GET /api/devices -> Lấy danh sách thiết bị
// POST /api/devices -> Tạo thiết bị mới (yêu cầu đăng nhập)
router.route('/')
    .get(authenticate, apiLimiter, asyncHandler(deviceController.getAllDevices))
    .post(authenticate, apiLimiter, asyncHandler(deviceController.createDevice));

// GET /api/devices/user/:userId -> Lấy thiết bị theo user ID
router.get('/user/:userId', authenticate, apiLimiter, asyncHandler(deviceController.getDevicesByUserId));

// GET /api/devices/deviceId/:deviceId -> Lấy thiết bị theo deviceId
// Phải đặt trước /:id để tránh conflict
router.get('/deviceId/:deviceId', authenticate, apiLimiter, asyncHandler(deviceController.getDeviceByDeviceId));

// PUT /api/devices/:id/config -> Cập nhật cấu hình thiết bị
// Phải đặt trước /:id để tránh conflict
router.put('/:id/config', authenticate, apiLimiter, asyncHandler(deviceController.updateDeviceConfig));

// PUT /api/devices/:id/status -> Cập nhật trạng thái thiết bị (thường từ MQTT)
// Có thể không cần authenticate nếu gọi từ MQTT service
// Không áp dụng rate limiting vì được gọi từ MQTT service
// Phải đặt trước /:id để tránh conflict
router.put('/:id/status', asyncHandler(deviceController.updateDeviceStatus));

// GET /api/devices/:id -> Lấy chi tiết thiết bị
// PUT /api/devices/:id -> Cập nhật thiết bị
// DELETE /api/devices/:id -> Xóa thiết bị
// Phải đặt cuối cùng vì nó match mọi thứ
router.route('/:id')
    .get(authenticate, apiLimiter, asyncHandler(deviceController.getDeviceById))
    .put(authenticate, apiLimiter, asyncHandler(deviceController.updateDevice))
    .delete(authenticate, apiLimiter, asyncHandler(deviceController.deleteDevice));

module.exports = router;

