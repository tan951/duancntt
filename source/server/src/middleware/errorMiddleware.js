/**
 * Middleware xử lý lỗi toàn cục
 * Bắt tất cả các lỗi từ các route và controller
 */

/**
 * Middleware xử lý lỗi không đồng bộ (async errors)
 * Bọc các async function để tự động catch lỗi
 */
exports.asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Middleware xử lý lỗi 404 - Không tìm thấy route
 */
exports.notFound = (req, res, next) => {
    const error = new Error(`Không tìm thấy route: ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

/**
 * Middleware xử lý lỗi chính (error handler)
 * Phải được đặt cuối cùng trong app.js/index.js
 */
exports.errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log lỗi để debug
    console.error('Error:', err);

    // Lỗi Mongoose - ObjectId không hợp lệ
    if (err.name === 'CastError') {
        const message = 'Tài nguyên không tồn tại';
        error = {
            statusCode: 404,
            message
        };
    }

    // Lỗi Mongoose - Trùng lặp key (duplicate key)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field} đã tồn tại. Vui lòng chọn giá trị khác.`;
        error = {
            statusCode: 400,
            message
        };
    }

    // Lỗi Mongoose - Validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = {
            statusCode: 400,
            message
        };
    }

    // Lỗi JWT
    if (err.name === 'JsonWebTokenError') {
        const message = 'Token không hợp lệ';
        error = {
            statusCode: 401,
            message
        };
    }

    // Lỗi JWT hết hạn
    if (err.name === 'TokenExpiredError') {
        const message = 'Token đã hết hạn. Vui lòng đăng nhập lại.';
        error = {
            statusCode: 401,
            message
        };
    }

    // Trả về lỗi
    const statusCode = error.statusCode || err.statusCode || 500;
    const message = error.message || 'Lỗi máy chủ nội bộ';

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

/**
 * Middleware xử lý lỗi validation
 * Sử dụng với express-validator hoặc các thư viện validation khác
 */
exports.validationError = (req, res, next) => {
    // Nếu có lỗi validation từ express-validator
    const errors = req.validationErrors;
    if (errors && errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Dữ liệu không hợp lệ',
            errors: errors
        });
    }
    next();
};

