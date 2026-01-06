const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { verifyAccessToken } = require('../utils/tokenUtils');

/**
 * Middleware xác thực người dùng qua JWT token
 * Kiểm tra token trong header Authorization: Bearer <token>
 */
exports.authenticate = async (req, res, next) => {
    try {
        // Lấy token từ header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Không có token xác thực. Vui lòng đăng nhập.'
            });
        }

        // Lấy token (bỏ phần "Bearer ")
        const token = authHeader.substring(7);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ.'
            });
        }

        // Xác thực access token
        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Access token đã hết hạn. Vui lòng refresh token.',
                    code: 'TOKEN_EXPIRED'
                });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token không hợp lệ.'
                });
            }
            throw error;
        }

        // Tìm user từ token
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Người dùng không tồn tại.'
            });
        }

        // Gắn user vào request để sử dụng ở các route tiếp theo
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ.'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token đã hết hạn. Vui lòng đăng nhập lại.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Lỗi xác thực: ' + error.message
        });
    }
};

/**
 * Middleware kiểm tra quyền truy cập (role-based)
 * Chỉ cho phép các role được chỉ định truy cập
 * @param {...String} roles - Danh sách các role được phép (ví dụ: 'admin', 'patient')
 */
exports.authorize = (...roles) => {
    return (req, res, next) => {
        // Kiểm tra xem đã có req.user chưa (phải gọi authenticate trước)
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Chưa xác thực người dùng.'
            });
        }

        // Kiểm tra role
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Người dùng với role '${req.user.role}' không có quyền truy cập tài nguyên này.`
            });
        }

        next();
    };
};

/**
 * Middleware kiểm tra quyền sở hữu
 * Chỉ cho phép user sở hữu tài nguyên hoặc admin truy cập
 */
exports.checkOwnership = (req, res, next) => {
    // Kiểm tra xem đã có req.user chưa
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Chưa xác thực người dùng.'
        });
    }

    // Admin có quyền truy cập tất cả
    if (req.user.role === 'admin') {
        return next();
    }

    // Kiểm tra xem user có phải là chủ sở hữu không
    const resourceUserId = req.params.id || req.body.userId;
    
    if (resourceUserId && resourceUserId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền truy cập tài nguyên này.'
        });
    }

    next();
};

