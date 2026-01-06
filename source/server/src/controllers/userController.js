const User = require('../models/userModel');
const Device = require('../models/deviceModel');
const bcrypt = require('bcryptjs');
const {
    generateAccessToken,
    generateRefreshToken,
    getRefreshTokenExpiry
} = require('../utils/tokenUtils');

// 1. ĐĂNG KÝ (Tạo User)
exports.createUser = async (req, res, next) => {
    try {
        const userData = { ...req.body };

        // Đảm bảo role mặc định là 'patient' nếu không được chỉ định
        // Chỉ admin mới có thể tạo user với role 'admin'
        if (!userData.role) {
            userData.role = 'patient';
        } else if (userData.role === 'admin') {
            // Kiểm tra nếu người tạo không phải admin thì không cho phép tạo admin
            if (!req.user || req.user.role !== 'admin') {
                const err = new Error('Chỉ admin mới có quyền tạo tài khoản admin');
                err.statusCode = 403;
                return next(err);
            }
        }

        const newUser = new User(userData);
        const savedUser = await newUser.save();

        // ========================================
        // TỰ ĐỘNG GÁN THIẾT BỊ SẴN CÓ CHO PATIENT
        // KHÔNG TẠO THIẾT BỊ MỚI - CHỈ GÁN THIẾT BỊ ĐÃ TỒN TẠI
        // ========================================
        if (savedUser.role === 'patient') {
            try {
                // Tìm một thiết bị sẵn có (ưu tiên thiết bị không có owners)
                let availableDevice = await Device.findOne({ 
                    $or: [
                        { owners: { $exists: false } },
                        { owners: { $size: 0 } },
                        { owners: [] }
                    ]
                });
                
                // Nếu không có thiết bị trống, lấy thiết bị đầu tiên (có thể đã có owners - nhiều user dùng chung)
                if (!availableDevice) {
                    availableDevice = await Device.findOne().sort({ createdAt: 1 });
                }
                
                if (availableDevice) {
                    // Thêm user vào owners array (nếu chưa có)
                    if (!availableDevice.owners) {
                        availableDevice.owners = [];
                    }
                    
                    // Kiểm tra xem user đã có trong owners chưa
                    const userIdString = savedUser._id.toString();
                    const isAlreadyOwner = availableDevice.owners.some(ownerId => {
                        const ownerIdString = ownerId._id ? ownerId._id.toString() : ownerId.toString();
                        return ownerIdString === userIdString;
                    });
                    
                    if (!isAlreadyOwner) {
                        availableDevice.owners.push(savedUser._id);
                    }
                    
                    // Set status = offline khi gán cho user mới (theo yêu cầu)
                    availableDevice.status = 'offline';
                    await availableDevice.save();
                    
                    // Cập nhật devices array trong User (nếu chưa có)
                    const user = await User.findById(savedUser._id);
                    if (user && (!user.devices || !user.devices.includes(availableDevice._id))) {
                        await User.findByIdAndUpdate(savedUser._id, {
                            $push: { devices: availableDevice._id }
                        });
                    }
                    
                    console.log(`✅ Đã gán thiết bị ${availableDevice.deviceId} (sẵn có, status=offline) cho patient ${savedUser.username}`);
                } else {
                    console.warn(`⚠️ Không có thiết bị nào sẵn có để gán cho patient ${savedUser.username}`);
                    // Không throw error, vẫn cho phép tạo user thành công
                }
            } catch (deviceError) {
                console.error('⚠️ Lỗi khi gán thiết bị tự động:', deviceError.message);
                // Không throw error, vẫn cho phép tạo user thành công
            }
        }

        // Ẩn mật khẩu khi trả về
        const userResponse = savedUser.toObject();
        delete userResponse.password;

        res.status(201).json({
            success: true,
            data: userResponse
        });
    } catch (error) {
        next(error); // Chuyển lỗi sang errorMiddleware xử lý
    }
};

// 2. ĐĂNG NHẬP (Lấy Token) -> MỚI THÊM
exports.loginUser = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        // Validate
        if (!username || !password) {
            const err = new Error('Vui lòng nhập tài khoản và mật khẩu');
            err.statusCode = 400;
            return next(err);
        }

        // Tìm user (lấy cả password để so sánh - dùng select('+password') để override select: false)
        const user = await User.findOne({ username }).select('+password');
        if (!user) {
            const err = new Error('Tài khoản không tồn tại');
            err.statusCode = 401;
            return next(err);
        }

        // So sánh pass
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            const err = new Error('Mật khẩu sai');
            err.statusCode = 401;
            return next(err);
        }

        // Tạo Access Token và Refresh Token
        const accessToken = generateAccessToken({ id: user._id });
        const refreshToken = generateRefreshToken({ id: user._id });
        const refreshTokenExpiry = getRefreshTokenExpiry();

        // Lưu refresh token vào database
        user.refreshToken = refreshToken;
        user.refreshTokenExpiry = refreshTokenExpiry;
        await user.save();

        res.status(200).json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
};

// 3. LẤY TẤT CẢ USER
exports.getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

// 4. LẤY 1 USER THEO ID
exports.getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password').populate('devices');
        if (!user) {
            const err = new Error('Không tìm thấy người dùng');
            err.statusCode = 404;
            return next(err);
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

// 5. CẬP NHẬT USER
exports.updateUser = async (req, res, next) => {
    try {
        // Tạo bản sao của req.body để không thay đổi object gốc
        const updateData = { ...req.body };

        // Kiểm tra nếu có yêu cầu thay đổi role
        if (updateData.role !== undefined) {
            // Chỉ admin mới được phép thay đổi role
            if (!req.user || req.user.role !== 'admin') {
                const err = new Error('Chỉ admin mới có quyền thay đổi role');
                err.statusCode = 403;
                return next(err);
            }
        }

        // Tìm user trước (cần để kiểm tra mật khẩu cũ nếu có)
        let user = await User.findById(req.params.id).select('+password');
        if (!user) {
            const err = new Error('Không tìm thấy người dùng để sửa');
            err.statusCode = 404;
            return next(err);
        }

        // Nếu có yêu cầu thay đổi mật khẩu, phải kiểm tra mật khẩu cũ
        if (updateData.password) {
            if (!updateData.oldPassword) {
                const err = new Error('Vui lòng nhập mật khẩu cũ để xác nhận');
                err.statusCode = 400;
                return next(err);
            }

            // Kiểm tra mật khẩu cũ có đúng không
            const isOldPasswordValid = await user.comparePassword(updateData.oldPassword);
            if (!isOldPasswordValid) {
                const err = new Error('Mật khẩu cũ không đúng');
                err.statusCode = 401;
                return next(err);
            }

            // Hash mật khẩu mới trước khi lưu
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(updateData.password, salt);
            
            // Set password đã hash vào user object
            user.password = hashedPassword;
            // Đánh dấu password đã được modified để đảm bảo lưu vào DB
            user.markModified('password');
            
            // Xóa password khỏi updateData vì đã set trực tiếp vào user
            delete updateData.password;
            // Xóa oldPassword khỏi updateData (không lưu vào DB)
            delete updateData.oldPassword;
        }

        // Cập nhật các field khác (nếu có)
        if (Object.keys(updateData).length > 0) {
            Object.assign(user, updateData);
        }

        // Lưu user (password đã được hash ở trên)
        await user.save();

        // Trả về user đã cập nhật (không bao gồm password)
        const updatedUser = await User.findById(req.params.id).select('-password');
        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        next(error);
    }
};

// 6. XÓA USER
exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            const err = new Error('Không tìm thấy người dùng để xóa');
            err.statusCode = 404;
            return next(err);
        }
        res.status(200).json({ success: true, message: 'Đã xóa thành công' });
    } catch (error) {
        next(error);
    }
};

// 7. REFRESH TOKEN - Lấy access token mới từ refresh token
exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            const err = new Error('Refresh token không được cung cấp');
            err.statusCode = 400;
            return next(err);
        }

        const { verifyRefreshToken } = require('../utils/tokenUtils');
        
        // Verify refresh token
        let decoded;
        try {
            decoded = verifyRefreshToken(refreshToken);
        } catch (error) {
            const err = new Error('Refresh token không hợp lệ hoặc đã hết hạn');
            err.statusCode = 401;
            return next(err);
        }

        // Tìm user và kiểm tra refresh token trong database
        const user = await User.findById(decoded.id);
        if (!user) {
            const err = new Error('Người dùng không tồn tại');
            err.statusCode = 401;
            return next(err);
        }

        // Kiểm tra refresh token có khớp với database không
        if (user.refreshToken !== refreshToken) {
            const err = new Error('Refresh token không hợp lệ');
            err.statusCode = 401;
            return next(err);
        }

        // Kiểm tra refresh token có hết hạn không
        if (user.refreshTokenExpiry && new Date() > user.refreshTokenExpiry) {
            // Xóa refresh token đã hết hạn
            user.refreshToken = null;
            user.refreshTokenExpiry = null;
            await user.save();
            
            const err = new Error('Refresh token đã hết hạn. Vui lòng đăng nhập lại');
            err.statusCode = 401;
            return next(err);
        }

        // Tạo access token mới
        const accessToken = generateAccessToken({ id: user._id });

        res.status(200).json({
            success: true,
            accessToken,
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
};

// 8. LOGOUT - Xóa refresh token
exports.logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            const err = new Error('Refresh token không được cung cấp');
            err.statusCode = 400;
            return next(err);
        }

        // Tìm user có refresh token này và xóa nó
        const user = await User.findOne({ refreshToken });
        if (user) {
            user.refreshToken = null;
            user.refreshTokenExpiry = null;
            await user.save();
        }

        res.status(200).json({
            success: true,
            message: 'Đăng xuất thành công'
        });
    } catch (error) {
        next(error);
    }
};