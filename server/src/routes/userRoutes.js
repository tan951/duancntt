const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticate } = require('../middleware/authMiddleware');
const { 
    authLimiter, 
    refreshTokenLimiter, 
    registerLimiter,
    apiLimiter 
} = require('../middleware/rateLimitMiddleware');

// Định nghĩa các route
// Đường dẫn gốc sẽ là /api/users (được khai báo bên index.js)

// POST /api/users/login -> Đăng nhập (không cần authenticate)
// Áp dụng rate limiting chống brute force
router.post('/login', authLimiter, asyncHandler(userController.loginUser));

// POST /api/users/refresh -> Refresh access token (không cần authenticate)
// Áp dụng rate limiting chống abuse refresh token
router.post('/refresh', refreshTokenLimiter, asyncHandler(userController.refreshToken));

// POST /api/users/logout -> Đăng xuất (không cần authenticate)
router.post('/logout', asyncHandler(userController.logout));

// GET /api/users/ -> Lấy danh sách (không cần authenticate - có thể để public hoặc thêm nếu cần)
// POST /api/users/ -> Tạo mới (không cần authenticate - cho phép đăng ký)
// Áp dụng rate limiting cho đăng ký (chống spam)
router.route('/')
    .get(apiLimiter, asyncHandler(userController.getAllUsers))
    .post(registerLimiter, asyncHandler(userController.createUser));

// GET /api/users/:id -> Lấy chi tiết (cần authenticate)
// PUT /api/users/:id -> Sửa (cần authenticate)
// DELETE /api/users/:id -> Xóa (cần authenticate)
// Áp dụng rate limiting cho các API endpoints
router.route('/:id')
    .get(authenticate, apiLimiter, asyncHandler(userController.getUserById))
    .put(authenticate, apiLimiter, asyncHandler(userController.updateUser))
    .delete(authenticate, apiLimiter, asyncHandler(userController.deleteUser));

module.exports = router;