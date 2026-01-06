const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

// Thời gian sống của tokens
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m'; // 15 phút
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '30d'; // 30 ngày

/**
 * Tạo access token (thời gian sống ngắn)
 * @param {Object} payload - Dữ liệu để encode vào token (thường là user id)
 * @returns {String} Access token
 */
exports.generateAccessToken = (payload) => {
    return jwt.sign(
        { id: payload.id || payload._id },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * Tạo refresh token (thời gian sống dài)
 * @param {Object} payload - Dữ liệu để encode vào token
 * @returns {String} Refresh token
 */
exports.generateRefreshToken = (payload) => {
    return jwt.sign(
        { id: payload.id || payload._id },
        JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
};

/**
 * Verify access token
 * @param {String} token - Access token
 * @returns {Object} Decoded token payload
 */
exports.verifyAccessToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

/**
 * Verify refresh token
 * @param {String} token - Refresh token
 * @returns {Object} Decoded token payload
 */
exports.verifyRefreshToken = (token) => {
    return jwt.verify(token, JWT_REFRESH_SECRET);
};

/**
 * Tính toán thời gian hết hạn của refresh token
 * @returns {Date} Ngày hết hạn
 */
exports.getRefreshTokenExpiry = () => {
    // Parse REFRESH_TOKEN_EXPIRY (ví dụ: "30d" -> 30 ngày)
    let expiryDays = 30; // default
    if (REFRESH_TOKEN_EXPIRY) {
        const match = REFRESH_TOKEN_EXPIRY.match(/^(\d+)([dmy])?$/);
        if (match) {
            const value = parseInt(match[1]);
            const unit = match[2] || 'd';
            if (unit === 'd') {
                expiryDays = value;
            } else if (unit === 'm') {
                expiryDays = value * 30; // tháng -> ngày
            } else if (unit === 'y') {
                expiryDays = value * 365; // năm -> ngày
            }
        }
    }
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    return expiryDate;
};

