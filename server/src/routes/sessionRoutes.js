const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticate } = require('../middleware/authMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

// Định nghĩa các route
// Đường dẫn gốc sẽ là /api/sessions (được khai báo bên index.js)

// GET /api/sessions -> Lấy danh sách sessions
// POST /api/sessions -> Tạo session mới (bắt đầu đo)
router.route('/')
    .get(authenticate, apiLimiter, asyncHandler(sessionController.getAllSessions))
    .post(authenticate, apiLimiter, asyncHandler(sessionController.createSession));

// GET /api/sessions/device/:deviceId/active -> Lấy session active của device
// Phải đặt trước /:id để tránh conflict
router.get('/device/:deviceId/active', authenticate, apiLimiter, asyncHandler(sessionController.getActiveSessionByDeviceId));

// PUT /api/sessions/:id/end -> Kết thúc session
// Phải đặt trước /:id để tránh conflict
router.put('/:id/end', authenticate, apiLimiter, asyncHandler(sessionController.endSession));

// GET /api/sessions/:id -> Lấy chi tiết session
// PUT /api/sessions/:id -> Cập nhật session
// DELETE /api/sessions/:id -> Xóa session
router.route('/:id')
    .get(authenticate, apiLimiter, asyncHandler(sessionController.getSessionById))
    .put(authenticate, apiLimiter, asyncHandler(sessionController.updateSession))
    .delete(authenticate, apiLimiter, asyncHandler(sessionController.deleteSession));

module.exports = router;

