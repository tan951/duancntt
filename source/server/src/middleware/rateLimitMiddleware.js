const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Rate limiting cho authentication endpoints (login, register)
 * Giới hạn: 5 requests / 15 phút / IP
 * Mục đích: Chống brute force attack
 */
exports.authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5, // Tối đa 5 requests trong 15 phút
    message: {
        success: false,
        message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true, // Trả về rate limit info trong headers `RateLimit-*`
    legacyHeaders: false, // Tắt `X-RateLimit-*` headers
    // Sử dụng IP address làm key (hỗ trợ IPv6)
    keyGenerator: ipKeyGenerator,
    // Custom handler khi vượt quá limit
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.',
            retryAfter: Math.ceil(15 * 60) // seconds
        });
    }
});

/**
 * Rate limiting cho API endpoints chung
 * Giới hạn: 100 requests / 15 phút / IP
 * Mục đích: Bảo vệ API khỏi abuse
 */
exports.apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 100, // Tối đa 100 requests trong 15 phút
    message: {
        success: false,
        message: 'Quá nhiều requests. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Nếu đã authenticate, dùng user ID, nếu không dùng IP (hỗ trợ IPv6)
        return req.user ? req.user._id.toString() : ipKeyGenerator(req);
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều requests. Vui lòng thử lại sau 15 phút.',
            retryAfter: Math.ceil(15 * 60)
        });
    }
});

/**
 * Rate limiting cho health data endpoints (nhiều requests hơn)
 * Giới hạn: 200 requests / 15 phút / User
 * Mục đích: Cho phép polling dữ liệu real-time nhưng vẫn bảo vệ server
 */
exports.healthDataLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 200, // Tối đa 200 requests trong 15 phút
    message: {
        success: false,
        message: 'Quá nhiều requests đến dữ liệu sức khỏe. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Dùng user ID nếu đã authenticate, nếu không dùng IP (hỗ trợ IPv6)
        return req.user ? req.user._id.toString() : ipKeyGenerator(req);
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều requests đến dữ liệu sức khỏe. Vui lòng thử lại sau 15 phút.',
            retryAfter: Math.ceil(15 * 60)
        });
    }
});

/**
 * Rate limiting cho refresh token endpoint
 * Giới hạn: 10 requests / 15 phút / IP
 * Mục đích: Chống abuse refresh token
 */
exports.refreshTokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 10, // Tối đa 10 requests trong 15 phút
    message: {
        success: false,
        message: 'Quá nhiều lần refresh token. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Sử dụng IP address làm key (hỗ trợ IPv6)
    keyGenerator: ipKeyGenerator,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều lần refresh token. Vui lòng thử lại sau 15 phút.',
            retryAfter: Math.ceil(15 * 60)
        });
    }
});

/**
 * Rate limiting cho registration endpoint
 * Giới hạn: 3 requests / 1 giờ / IP
 * Mục đích: Chống spam đăng ký
 */
exports.registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: 3, // Tối đa 3 requests trong 1 giờ
    message: {
        success: false,
        message: 'Quá nhiều lần đăng ký. Vui lòng thử lại sau 1 giờ.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Sử dụng IP address làm key (hỗ trợ IPv6)
    keyGenerator: ipKeyGenerator,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều lần đăng ký. Vui lòng thử lại sau 1 giờ.',
            retryAfter: Math.ceil(60 * 60) // 1 giờ
        });
    }
});

/**
 * Rate limiting cho statistics endpoint (tính toán nặng)
 * Giới hạn: 50 requests / 15 phút / User
 * Mục đích: Bảo vệ server khỏi quá tải do tính toán thống kê
 */
exports.statsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 50, // Tối đa 50 requests trong 15 phút
    message: {
        success: false,
        message: 'Quá nhiều requests đến thống kê. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Nếu đã authenticate, dùng user ID, nếu không dùng IP (hỗ trợ IPv6)
        return req.user ? req.user._id.toString() : ipKeyGenerator(req);
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều requests đến thống kê. Vui lòng thử lại sau 15 phút.',
            retryAfter: Math.ceil(15 * 60)
        });
    }
});

