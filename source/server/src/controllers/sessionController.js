const DeviceSession = require('../models/deviceSessionModel');
const Device = require('../models/deviceModel');
const User = require('../models/userModel');

// Helper function để tạo error với status code
const createError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// 1. TẠO SESSION MỚI (Bắt đầu đo)
exports.createSession = async (req, res, next) => {
    try {
        const { deviceId, userId } = req.body;

        // Validate required fields
        if (!deviceId || !userId) {
            const err = createError('Thiếu deviceId hoặc userId', 400);
            return next(err);
        }

        // Kiểm tra device tồn tại
        const device = await Device.findOne({ deviceId });
        if (!device) {
            const err = createError('Không tìm thấy thiết bị', 404);
            return next(err);
        }

        // Kiểm tra user tồn tại
        const user = await User.findById(userId);
        if (!user) {
            const err = createError('Không tìm thấy người dùng', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ owner hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            if (device.owner && device.owner.toString() !== req.user._id.toString() && userId !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền tạo session cho thiết bị này', 403);
                return next(err);
            }
        }

        // Tắt tất cả session active khác của device này (nếu có)
        const endedSessions = await DeviceSession.find({ deviceId, active: true })
            .populate('user', 'username fullName role');
        await DeviceSession.updateMany(
            { deviceId, active: true },
            { active: false, endedAt: new Date() }
        );

        // Tạo session mới
        const newSession = new DeviceSession({
            deviceId,
            user: userId,
            active: true,
            startedAt: new Date()
        });

        const savedSession = await newSession.save();
        await savedSession.populate('user', 'username fullName role');

        // Emit socket event để notify tất cả clients về session mới
        if (global.io) {
            global.io.emit('session:created', {
                session: savedSession,
                deviceId: deviceId
            });
            
            // Emit event cho các session bị kết thúc
            for (const endedSession of endedSessions) {
                // Cập nhật endedAt cho session đã populate
                endedSession.active = false;
                endedSession.endedAt = new Date();
                global.io.emit('session:ended', {
                    session: endedSession,
                    deviceId: deviceId
                });
            }
        }

        res.status(201).json({
            success: true,
            data: savedSession
        });
    } catch (error) {
        // Xử lý duplicate key error (unique constraint)
        if (error.code === 11000) {
            const err = createError('Thiết bị này đã có session đang active', 400);
            return next(err);
        }
        next(error);
    }
};

// 2. LẤY TẤT CẢ SESSION
exports.getAllSessions = async (req, res, next) => {
    try {
        let query = {};

        // Filter theo deviceId nếu có
        if (req.query.deviceId) {
            query.deviceId = req.query.deviceId;
        }

        // Filter theo userId nếu có
        if (req.query.userId) {
            query.user = req.query.userId;
        }

        // Filter theo active nếu có
        if (req.query.active !== undefined) {
            query.active = req.query.active === 'true';
        }

        // Kiểm tra quyền truy cập (chỉ xem được sessions của chính mình hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            if (req.query.userId && req.query.userId !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền xem sessions của người khác', 403);
                return next(err);
            }
            // Nếu không có filter userId, chỉ hiển thị sessions của chính mình
            if (!req.query.userId) {
                query.user = req.user._id;
            }
        }

        const sessions = await DeviceSession.find(query)
            .populate('user', 'username fullName role')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: sessions.length,
            data: sessions
        });
    } catch (error) {
        next(error);
    }
};

// 3. LẤY SESSION THEO ID
exports.getSessionById = async (req, res, next) => {
    try {
        const session = await DeviceSession.findById(req.params.id)
            .populate('user', 'username fullName role phoneNumber');

        if (!session) {
            const err = createError('Không tìm thấy session', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ owner hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            if (session.user._id.toString() !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền xem session này', 403);
                return next(err);
            }
        }

        res.status(200).json({
            success: true,
            data: session
        });
    } catch (error) {
        next(error);
    }
};

// 4. LẤY SESSION ACTIVE CỦA DEVICE
exports.getActiveSessionByDeviceId = async (req, res, next) => {
    try {
        const { deviceId } = req.params;

        const session = await DeviceSession.findOne({ deviceId, active: true })
            .populate('user', 'username fullName role phoneNumber');

        if (!session) {
            const err = createError('Không tìm thấy session active cho thiết bị này', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ owner hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            if (session.user._id.toString() !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền xem session này', 403);
                return next(err);
            }
        }

        res.status(200).json({
            success: true,
            data: session
        });
    } catch (error) {
        next(error);
    }
};

// 5. KẾT THÚC SESSION (Update active = false)
exports.endSession = async (req, res, next) => {
    try {
        const session = await DeviceSession.findById(req.params.id);

        if (!session) {
            const err = createError('Không tìm thấy session', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ owner hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            const sessionUser = await User.findById(session.user);
            if (sessionUser._id.toString() !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền kết thúc session này', 403);
                return next(err);
            }
        }

        session.active = false;
        session.endedAt = new Date();
        const updatedSession = await session.save();
        await updatedSession.populate('user', 'username fullName role');

        // Emit socket event để notify tất cả clients về session kết thúc
        if (global.io) {
            global.io.emit('session:ended', {
                session: updatedSession,
                deviceId: updatedSession.deviceId
            });
        }

        res.status(200).json({
            success: true,
            data: updatedSession,
            message: 'Đã kết thúc session thành công'
        });
    } catch (error) {
        next(error);
    }
};

// 6. CẬP NHẬT SESSION
exports.updateSession = async (req, res, next) => {
    try {
        // Không cho phép thay đổi deviceId hoặc user
        if (req.body.deviceId || req.body.user) {
            const err = createError('Không thể thay đổi deviceId hoặc user', 400);
            return next(err);
        }

        const session = await DeviceSession.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('user', 'username fullName role');

        if (!session) {
            const err = createError('Không tìm thấy session', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ owner hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            const sessionUser = await User.findById(session.user);
            if (sessionUser._id.toString() !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền sửa session này', 403);
                return next(err);
            }
        }

        res.status(200).json({
            success: true,
            data: session
        });
    } catch (error) {
        next(error);
    }
};

// 7. XÓA SESSION
exports.deleteSession = async (req, res, next) => {
    try {
        const session = await DeviceSession.findById(req.params.id);

        if (!session) {
            const err = createError('Không tìm thấy session để xóa', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ owner hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            const sessionUser = await User.findById(session.user);
            if (sessionUser._id.toString() !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền xóa session này', 403);
                return next(err);
            }
        }

        await DeviceSession.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Đã xóa session thành công'
        });
    } catch (error) {
        next(error);
    }
};

