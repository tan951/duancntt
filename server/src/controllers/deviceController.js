const Device = require('../models/deviceModel');
const User = require('../models/userModel');

// Helper function để tạo error với status code
const createError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// 1. TẠO THIẾT BỊ MỚI (Create)
exports.createDevice = async (req, res, next) => {
    try {
        // Nếu có user đăng nhập, tự động gán owner
        if (req.user) {
            req.body.owner = req.user._id;
        }

        // Validate owner tồn tại
        if (req.body.owner) {
            const owner = await User.findById(req.body.owner);
            if (!owner) {
                const err = createError('Người dùng sở hữu không tồn tại', 404);
                return next(err);
            }
        } else {
            const err = createError('Thiếu thông tin người sở hữu thiết bị', 400);
            return next(err);
        }

        const newDevice = new Device(req.body);
        const savedDevice = await newDevice.save();

        // Cập nhật devices array trong User model
        await User.findByIdAndUpdate(req.body.owner, {
            $push: { devices: savedDevice._id }
        });

        res.status(201).json({
            success: true,
            data: savedDevice
        });
    } catch (error) {
        next(error);
    }
};

// 2. LẤY TẤT CẢ THIẾT BỊ (Read All)
exports.getAllDevices = async (req, res, next) => {
    try {
        // Nếu có user đăng nhập, chỉ lấy devices của user đó (trừ admin)
        let query = {};
        if (req.user && req.user.role !== 'admin') {
            // Query devices có user trong owners array hoặc owner field
            query.$or = [
                { owners: req.user._id },
                { owner: req.user._id }
            ];
        }

        // Có thể filter theo owner từ query params
        if (req.query.owner && (req.user?.role === 'admin' || req.query.owner === req.user?._id.toString())) {
            query.$or = [
                { owners: req.query.owner },
                { owner: req.query.owner }
            ];
        }

        // Filter theo status nếu có
        if (req.query.status) {
            query.status = req.query.status;
        }

        const devices = await Device.find(query)
            .populate('owners', 'username fullName role')
            .populate('owner', 'username fullName role')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: devices.length,
            data: devices
        });
    } catch (error) {
        next(error);
    }
};

// 3. LẤY 1 THIẾT BỊ THEO ID (Read One)
exports.getDeviceById = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id)
            .populate('owner', 'username fullName role phoneNumber');

        if (!device) {
            const err = createError('Không tìm thấy thiết bị', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ owner hoặc admin)
        // Nếu device chưa có owner (null), chỉ admin mới được xem
        if (req.user && req.user.role !== 'admin') {
            if (!device.owner) {
                const err = createError('Bạn không có quyền truy cập thiết bị này', 403);
                return next(err);
            }
            const ownerId = device.owner._id ? device.owner._id.toString() : device.owner.toString();
            if (ownerId !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền truy cập thiết bị này', 403);
                return next(err);
            }
        }

        res.status(200).json({
            success: true,
            data: device
        });
    } catch (error) {
        next(error);
    }
};

// 4. LẤY THIẾT BỊ THEO DEVICE ID (deviceId)
exports.getDeviceByDeviceId = async (req, res, next) => {
    try {
        const device = await Device.findOne({ deviceId: req.params.deviceId })
            .populate('owner', 'username fullName role phoneNumber');

        if (!device) {
            const err = createError('Không tìm thấy thiết bị', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ owner hoặc admin)
        // Nếu device chưa có owner (null), chỉ admin mới được xem
        if (req.user && req.user.role !== 'admin') {
            if (!device.owner) {
                const err = createError('Bạn không có quyền truy cập thiết bị này', 403);
                return next(err);
            }
            const ownerId = device.owner._id ? device.owner._id.toString() : device.owner.toString();
            if (ownerId !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền truy cập thiết bị này', 403);
                return next(err);
            }
        }

        res.status(200).json({
            success: true,
            data: device
        });
    } catch (error) {
        next(error);
    }
};

// 5. LẤY THIẾT BỊ THEO USER ID
exports.getDevicesByUserId = async (req, res, next) => {
    try {
        const userId = req.params.userId;

        // Kiểm tra quyền truy cập (chỉ xem được devices của chính mình hoặc admin)
        if (req.user && req.user.role !== 'admin' && userId !== req.user._id.toString()) {
            const err = createError('Bạn không có quyền xem thiết bị của người khác', 403);
            return next(err);
        }

        // Query devices có user trong owners array hoặc owner field
        const devices = await Device.find({
            $or: [
                { owners: userId },
                { owner: userId }
            ]
        })
            .populate('owners', 'username fullName role')
            .populate('owner', 'username fullName role')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: devices.length,
            data: devices
        });
    } catch (error) {
        next(error);
    }
};

// 6. CẬP NHẬT THIẾT BỊ (Update)
exports.updateDevice = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id);

        if (!device) {
            const err = createError('Không tìm thấy thiết bị để sửa', 404);
            return next(err);
        }

        // Kiểm tra quyền sở hữu (chỉ owners hoặc owner hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            // Kiểm tra trong owners array trước
            if (device.owners && device.owners.length > 0) {
                const isOwner = device.owners.some(owner => {
                    const ownerId = owner._id ? owner._id.toString() : owner.toString();
                    return ownerId === req.user._id.toString();
                });
                if (!isOwner) {
                    const err = createError('Bạn không có quyền sửa thiết bị này', 403);
                    return next(err);
                }
            } else if (device.owner) {
                // Fallback về owner nếu owners rỗng
                const ownerId = device.owner._id ? device.owner._id.toString() : device.owner.toString();
                if (ownerId !== req.user._id.toString()) {
                    const err = createError('Bạn không có quyền sửa thiết bị này', 403);
                    return next(err);
                }
            } else {
                const err = createError('Bạn không có quyền sửa thiết bị này', 403);
                return next(err);
            }
        }

        // Xử lý thêm owner vào owners array
        if (req.body.addOwner) {
            const ownerIdToAdd = req.body.addOwner;
            
            // Validate owner tồn tại
            const owner = await User.findById(ownerIdToAdd);
            if (!owner) {
                const err = createError('Người dùng sở hữu không tồn tại', 404);
                return next(err);
            }

            // Lấy owners hiện tại
            let currentOwners = device.owners || [];
            // Nếu owners rỗng nhưng có owner, thêm owner vào owners
            if (currentOwners.length === 0 && device.owner) {
                currentOwners = [device.owner];
            }

            // Kiểm tra owner đã có trong owners chưa
            const ownerIds = currentOwners.map(o => (o._id || o).toString());
            if (ownerIds.includes(ownerIdToAdd.toString())) {
                const err = createError('Người dùng này đã là chủ sở hữu của thiết bị', 400);
                return next(err);
            }

            // Thêm owner mới vào owners array
            currentOwners.push(ownerIdToAdd);
            req.body.owners = currentOwners;
            delete req.body.addOwner; // Xóa addOwner khỏi body

            // Cập nhật devices array trong User model cho owner mới
            await User.findByIdAndUpdate(ownerIdToAdd, {
                $push: { devices: device._id }
            });
        }

        // Xử lý xóa owner khỏi owners array
        if (req.body.removeOwner) {
            const ownerIdToRemove = req.body.removeOwner;
            
            // Validate owner tồn tại
            const owner = await User.findById(ownerIdToRemove);
            if (!owner) {
                const err = createError('Người dùng không tồn tại', 404);
                return next(err);
            }

            // Lấy owners hiện tại
            let currentOwners = device.owners || [];
            // Nếu owners rỗng nhưng có owner, thêm owner vào owners
            if (currentOwners.length === 0 && device.owner) {
                currentOwners = [device.owner];
            }

            // Kiểm tra owner có trong owners không
            const ownerIds = currentOwners.map(o => (o._id || o).toString());
            if (!ownerIds.includes(ownerIdToRemove.toString())) {
                const err = createError('Người dùng này không phải là chủ sở hữu của thiết bị', 400);
                return next(err);
            }

            // Xóa owner khỏi owners array
            currentOwners = currentOwners.filter(o => {
                const oId = (o._id || o).toString();
                return oId !== ownerIdToRemove.toString();
            });
            req.body.owners = currentOwners;
            delete req.body.removeOwner; // Xóa removeOwner khỏi body

            // Cập nhật devices array trong User model cho owner bị xóa
            await User.findByIdAndUpdate(ownerIdToRemove, {
                $pull: { devices: device._id }
            });
        }

        // Không cho phép thay đổi owner trừ admin (giữ để tương thích)
        if (req.body.owner && req.user?.role !== 'admin') {
            delete req.body.owner;
        }

        const updatedDevice = await Device.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        ).populate('owners', 'username fullName role').populate('owner', 'username fullName role');

        res.status(200).json({
            success: true,
            data: updatedDevice
        });
    } catch (error) {
        next(error);
    }
};

// 7. CẬP NHẬT CẤU HÌNH THIẾT BỊ (Update Config)
exports.updateDeviceConfig = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id);

        if (!device) {
            const err = createError('Không tìm thấy thiết bị', 404);
            return next(err);
        }

        // Kiểm tra quyền sở hữu (chỉ owner hoặc admin)
        // Nếu device chưa có owner (null), chỉ admin mới được sửa cấu hình
        if (req.user && req.user.role !== 'admin') {
            if (!device.owner) {
                const err = createError('Bạn không có quyền sửa cấu hình thiết bị này', 403);
                return next(err);
            }
            const ownerId = device.owner._id ? device.owner._id.toString() : device.owner.toString();
            if (ownerId !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền sửa cấu hình thiết bị này', 403);
                return next(err);
            }
        }

        // Cập nhật config
        if (req.body.maxBpm !== undefined) device.config.maxBpm = req.body.maxBpm;
        if (req.body.minSpo2 !== undefined) device.config.minSpo2 = req.body.minSpo2;
        if (req.body.alertEnabled !== undefined) device.config.alertEnabled = req.body.alertEnabled;

        const updatedDevice = await device.save();
        await updatedDevice.populate('owner', 'username fullName role');

        res.status(200).json({
            success: true,
            data: updatedDevice
        });
    } catch (error) {
        next(error);
    }
};

// 8. CẬP NHẬT TRẠNG THÁI THIẾT BỊ (Update Status) - Thường được gọi từ MQTT
exports.updateDeviceStatus = async (req, res, next) => {
    try {
        const { status, lastSeen } = req.body;

        if (!status || !['online', 'offline'].includes(status)) {
            const err = createError('Trạng thái không hợp lệ. Phải là "online" hoặc "offline"', 400);
            return next(err);
        }

        const device = await Device.findByIdAndUpdate(
            req.params.id,
            {
                status,
                lastSeen: lastSeen || new Date()
            },
            { new: true }
        ).populate('owner', 'username fullName role');

        if (!device) {
            const err = createError('Không tìm thấy thiết bị', 404);
            return next(err);
        }

        res.status(200).json({
            success: true,
            data: device
        });
    } catch (error) {
        next(error);
    }
};

// 9. XÓA THIẾT BỊ (Delete)
exports.deleteDevice = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id);

        if (!device) {
            const err = createError('Không tìm thấy thiết bị để xóa', 404);
            return next(err);
        }

        // Kiểm tra quyền sở hữu (chỉ owner hoặc admin)
        // Nếu device chưa có owner (null), chỉ admin mới được xóa
        if (req.user && req.user.role !== 'admin') {
            if (!device.owner) {
                const err = createError('Bạn không có quyền xóa thiết bị này', 403);
                return next(err);
            }
            const ownerId = device.owner._id ? device.owner._id.toString() : device.owner.toString();
            if (ownerId !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền xóa thiết bị này', 403);
                return next(err);
            }
        }

        // Xóa device khỏi devices array trong User model (chỉ nếu có owner)
        if (device.owner) {
            const ownerId = device.owner._id ? device.owner._id.toString() : device.owner.toString();
            await User.findByIdAndUpdate(ownerId, {
                $pull: { devices: device._id }
            });
        }

        await Device.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Đã xóa thiết bị thành công'
        });
    } catch (error) {
        next(error);
    }
};


