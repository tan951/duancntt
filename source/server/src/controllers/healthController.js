const mongoose = require('mongoose');
const HealthData = require('../models/healthModel');
const Device = require('../models/deviceModel');
const User = require('../models/userModel');

// Helper function để tạo error với status code
const createError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// 1. LẤY TẤT CẢ HEALTH DATA (với filter)
exports.getAllHealthData = async (req, res, next) => {
    try {
        let query = {};

        // Filter theo patient (userId)
        if (req.query.patient) {
            query.patient = req.query.patient;
        }

        // Filter theo deviceId
        if (req.query.deviceId) {
            query.deviceId = req.query.deviceId;
        }

        // Filter theo device (MongoDB ObjectId)
        if (req.query.device) {
            query.device = req.query.device;
        }

        // Filter theo date range
        if (req.query.startDate || req.query.endDate) {
            query.timestamp = {};
            if (req.query.startDate) {
                // Nếu startDate là format YYYY-MM-DD, set về đầu ngày (00:00:00)
                const startDate = new Date(req.query.startDate);
                startDate.setHours(0, 0, 0, 0);
                query.timestamp.$gte = startDate;
            }
            if (req.query.endDate) {
                // Nếu endDate là format YYYY-MM-DD, set về cuối ngày (23:59:59.999)
                // Nếu endDate đã có thời gian (ISO format), dùng trực tiếp
                let endDate = new Date(req.query.endDate);
                // Kiểm tra xem có phải là format YYYY-MM-DD không (không có thời gian)
                if (req.query.endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Format YYYY-MM-DD: set về cuối ngày (23:59:59.999) theo UTC
                    // Đảm bảo bao gồm cả ngày cuối cùng
                    endDate.setUTCHours(23, 59, 59, 999);
                } else if (req.query.endDate.includes('T')) {
                    // ISO format đã có thời gian, dùng trực tiếp
                    // Không cần thay đổi
                } else {
                    // Fallback: set về cuối ngày
                    endDate.setUTCHours(23, 59, 59, 999);
                }
                query.timestamp.$lte = endDate;
            }
        }

        // Kiểm tra quyền truy cập (chỉ xem được data của chính mình hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            if (req.query.patient && req.query.patient !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền xem dữ liệu sức khỏe của người khác', 403);
                return next(err);
            }
            // Nếu không có filter patient, chỉ hiển thị data của chính mình
            if (!req.query.patient) {
                query.patient = req.user._id;
            }
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const healthData = await HealthData.find(query)
            .populate('patient', 'username fullName role')
            .populate('device', 'deviceId deviceName')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await HealthData.countDocuments(query);

        res.status(200).json({
            success: true,
            count: healthData.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: healthData
        });
    } catch (error) {
        next(error);
    }
};

// 2. LẤY HEALTH DATA THEO ID
exports.getHealthDataById = async (req, res, next) => {
    try {
        const healthData = await HealthData.findById(req.params.id)
            .populate('patient', 'username fullName role phoneNumber')
            .populate('device', 'deviceId deviceName status');

        if (!healthData) {
            const err = createError('Không tìm thấy dữ liệu sức khỏe', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ owner hoặc admin)
        if (req.user && req.user.role !== 'admin') {
            if (healthData.patient._id.toString() !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền xem dữ liệu này', 403);
                return next(err);
            }
        }

        res.status(200).json({
            success: true,
            data: healthData
        });
    } catch (error) {
        next(error);
    }
};

// 3. LẤY HEALTH DATA THEO PATIENT ID
exports.getHealthDataByPatientId = async (req, res, next) => {
    try {
        const patientId = req.params.id;

        // Kiểm tra quyền truy cập (chỉ xem được data của chính mình hoặc admin)
        if (req.user && req.user.role !== 'admin' && patientId !== req.user._id.toString()) {
            const err = createError('Bạn không có quyền xem dữ liệu sức khỏe của người khác', 403);
            return next(err);
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Date range filter
        let dateQuery = {};
        if (req.query.startDate || req.query.endDate) {
            dateQuery.timestamp = {};
            if (req.query.startDate) {
                dateQuery.timestamp.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                dateQuery.timestamp.$lte = new Date(req.query.endDate);
            }
        }

        const query = { patient: patientId, ...dateQuery };

        const healthData = await HealthData.find(query)
            .populate('patient', 'username fullName role')
            .populate('device', 'deviceId deviceName')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await HealthData.countDocuments(query);

        res.status(200).json({
            success: true,
            count: healthData.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: healthData
        });
    } catch (error) {
        next(error);
    }
};

// 4. LẤY HEALTH DATA THEO DEVICE ID
exports.getHealthDataByDeviceId = async (req, res, next) => {
    try {
        const { deviceId } = req.params;

        // Kiểm tra device tồn tại và quyền truy cập
        const device = await Device.findOne({ deviceId });
        if (!device) {
            const err = createError('Không tìm thấy thiết bị', 404);
            return next(err);
        }

        if (req.user && req.user.role !== 'admin') {
            if (device.owner && device.owner.toString() !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền xem dữ liệu của thiết bị này', 403);
                return next(err);
            }
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Date range filter
        let dateQuery = {};
        if (req.query.startDate || req.query.endDate) {
            dateQuery.timestamp = {};
            if (req.query.startDate) {
                dateQuery.timestamp.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                dateQuery.timestamp.$lte = new Date(req.query.endDate);
            }
        }

        const query = { deviceId, ...dateQuery };

        const healthData = await HealthData.find(query)
            .populate('patient', 'username fullName role')
            .populate('device', 'deviceId deviceName')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await HealthData.countDocuments(query);

        res.status(200).json({
            success: true,
            count: healthData.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: healthData
        });
    } catch (error) {
        next(error);
    }
};

// 5. XÓA HEALTH DATA (chỉ admin)
exports.deleteHealthData = async (req, res, next) => {
    try {
        const healthData = await HealthData.findById(req.params.id);

        if (!healthData) {
            const err = createError('Không tìm thấy dữ liệu sức khỏe để xóa', 404);
            return next(err);
        }

        // Kiểm tra quyền truy cập (chỉ admin hoặc owner của data)
        if (req.user && req.user.role !== 'admin') {
            if (healthData.patient.toString() !== req.user._id.toString()) {
                const err = createError('Bạn không có quyền xóa dữ liệu này', 403);
                return next(err);
            }
        }

        await HealthData.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Đã xóa dữ liệu sức khỏe thành công'
        });
    } catch (error) {
        next(error);
    }
};

// 6. LẤY THỐNG KÊ HEALTH DATA
exports.getHealthStatistics = async (req, res, next) => {
    try {
        const { patientId, deviceId, startDate, endDate } = req.query;

        let query = {};
        
        // Convert patientId từ string sang ObjectId
        if (patientId) {
            // Kiểm tra xem patientId có phải là ObjectId hợp lệ không
            if (mongoose.Types.ObjectId.isValid(patientId)) {
                query.patient = new mongoose.Types.ObjectId(patientId);
            } else {
                query.patient = patientId; // Fallback nếu không phải ObjectId
            }
        }
        
        if (deviceId) query.deviceId = deviceId;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                // Nếu startDate là format YYYY-MM-DD, set về đầu ngày (00:00:00)
                let startDateObj;
                // Kiểm tra xem có phải là format YYYY-MM-DD không (không có thời gian)
                if (startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Format YYYY-MM-DD: parse theo local timezone
                    // Server ở GMT+7, nên khi user chọn "2026-01-04":
                    // - Muốn xem dữ liệu từ 2026-01-04 00:00:00 GMT+7
                    // - Trong UTC: 2026-01-03 17:00:00 UTC
                    const [year, month, day] = startDate.split('-').map(Number);
                    // Tạo date theo local timezone (00:00:00 local time)
                    // new Date(2026, 0, 4, 0, 0, 0, 0) tự động convert sang UTC
                    // Kết quả: 2026-01-03T17:00:00.000Z (đây là UTC timestamp của 2026-01-04 00:00:00 GMT+7)
                    startDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
                } else {
                    // ISO format đã có thời gian, parse và set về đầu ngày
                    startDateObj = new Date(startDate);
                    startDateObj.setUTCHours(0, 0, 0, 0);
                }
                query.timestamp.$gte = startDateObj;
                console.log('📊 startDate parsed:', startDate, '->', startDateObj.toISOString(), '(local time:', startDateObj.toString().split('GMT')[0].trim() + ')');
            }
            if (endDate) {
                // Nếu endDate là format YYYY-MM-DD, set về cuối ngày (23:59:59.999)
                // Nếu endDate đã có thời gian (ISO format), dùng trực tiếp
                let endDateObj;
                // Kiểm tra xem có phải là format YYYY-MM-DD không (không có thời gian)
                if (endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Format YYYY-MM-DD: parse theo local timezone
                    // Server ở GMT+7, nên khi user chọn "2026-01-04":
                    // - Muốn xem dữ liệu đến 2026-01-04 23:59:59.999 GMT+7
                    // - Trong UTC: 2026-01-04 16:59:59.999 UTC
                    const [year, month, day] = endDate.split('-').map(Number);
                    // Tạo date theo local timezone (23:59:59.999 local time)
                    // new Date(2026, 0, 4, 23, 59, 59, 999) tự động convert sang UTC
                    // Kết quả: 2026-01-04T16:59:59.999Z (đây là UTC timestamp của 2026-01-04 23:59:59.999 GMT+7)
                    endDateObj = new Date(year, month - 1, day, 23, 59, 59, 999);
                } else if (endDate.includes('T')) {
                    // ISO format đã có thời gian, dùng trực tiếp
                    endDateObj = new Date(endDate);
                } else {
                    // Fallback: parse theo local timezone
                    const [year, month, day] = endDate.split('-').map(Number);
                    endDateObj = new Date(year, month - 1, day, 23, 59, 59, 999);
                }
                query.timestamp.$lte = endDateObj;
                console.log('📊 endDate parsed:', endDate, '->', endDateObj.toISOString(), '(local time:', endDateObj.toString().split('GMT')[0].trim() + ')');
            }
        }

        // Kiểm tra quyền truy cập
        if (req.user && req.user.role !== 'admin') {
            if (patientId && patientId !== req.user._id.toString() && patientId !== req.user._id) {
                const err = createError('Bạn không có quyền xem thống kê của người khác', 403);
                return next(err);
            }
            if (!patientId) {
                // Sử dụng ObjectId từ req.user._id
                query.patient = req.user._id instanceof mongoose.Types.ObjectId 
                    ? req.user._id 
                    : new mongoose.Types.ObjectId(req.user._id);
            }
        }

        console.log('📊 Query for stats:', JSON.stringify(query, null, 2));
        
        // Log chi tiết về date range nếu có
        if (query.timestamp) {
            if (query.timestamp.$gte) {
                console.log('📊 startDate (gte):', query.timestamp.$gte.toISOString());
            }
            if (query.timestamp.$lte) {
                console.log('📊 endDate (lte):', query.timestamp.$lte.toISOString());
            }
        }
        
        // Kiểm tra số lượng documents trước khi aggregate
        const countBeforeAggregate = await HealthData.countDocuments(query);
        console.log('📊 Number of HealthData documents matching query:', countBeforeAggregate);
        
        // Nếu không có documents, log thêm thông tin để debug
        if (countBeforeAggregate === 0) {
            const totalCount = await HealthData.countDocuments({});
            console.log('📊 Total HealthData documents in database:', totalCount);
            
            // Kiểm tra xem có documents nào với patientId này không
            if (query.patient) {
                const patientQuery = { patient: query.patient };
                const patientCount = await HealthData.countDocuments(patientQuery);
                console.log('📊 Documents with this patientId:', patientCount);
                
                // Lấy một số documents mẫu để xem timestamp
                const sampleDocs = await HealthData.find(patientQuery)
                    .sort({ timestamp: -1 })
                    .limit(5)
                    .select('timestamp deviceId heartRate spo2');
                console.log('📊 Sample HealthData documents (latest 5):', sampleDocs.map(d => ({
                    timestamp: d.timestamp?.toISOString(),
                    deviceId: d.deviceId,
                    heartRate: d.heartRate,
                    spo2: d.spo2
                })));
                
                // Nếu có date filter, kiểm tra xem có documents trong khoảng thời gian không
                if (query.timestamp) {
                    const dateRangeQuery = { ...patientQuery };
                    if (query.timestamp.$gte) {
                        dateRangeQuery.timestamp = { $gte: query.timestamp.$gte };
                        const countAfterStart = await HealthData.countDocuments(dateRangeQuery);
                        console.log('📊 Documents after startDate:', countAfterStart);
                    }
                    if (query.timestamp.$lte) {
                        dateRangeQuery.timestamp = { ...dateRangeQuery.timestamp, $lte: query.timestamp.$lte };
                        const countInRange = await HealthData.countDocuments(dateRangeQuery);
                        console.log('📊 Documents in date range:', countInRange);
                    }
                }
            }
        }
        
        // Đếm tổng số documents trước khi filter (để count chính xác)
        const totalCount = await HealthData.countDocuments(query);
        
        const stats = await HealthData.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    // Tính trung bình chỉ từ các giá trị hợp lệ
                    avgHeartRate: {
                        $avg: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$heartRate', 0] },
                                        { $gte: ['$heartRate', 30] },
                                        { $lte: ['$heartRate', 220] }
                                    ]
                                },
                                '$heartRate',
                                null // Bỏ qua giá trị không hợp lệ
                            ]
                        }
                    },
                    minHeartRate: {
                        $min: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$heartRate', 0] },
                                        { $gte: ['$heartRate', 30] },
                                        { $lte: ['$heartRate', 220] }
                                    ]
                                },
                                '$heartRate',
                                null
                            ]
                        }
                    },
                    maxHeartRate: {
                        $max: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$heartRate', 0] },
                                        { $gte: ['$heartRate', 30] },
                                        { $lte: ['$heartRate', 220] }
                                    ]
                                },
                                '$heartRate',
                                null
                            ]
                        }
                    },
                    avgSpo2: {
                        $avg: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$spo2', 0] },
                                        { $gte: ['$spo2', 70] },
                                        { $lte: ['$spo2', 100] }
                                    ]
                                },
                                '$spo2',
                                null // Bỏ qua giá trị không hợp lệ
                            ]
                        }
                    },
                    minSpo2: {
                        $min: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$spo2', 0] },
                                        { $gte: ['$spo2', 70] },
                                        { $lte: ['$spo2', 100] }
                                    ]
                                },
                                '$spo2',
                                null
                            ]
                        }
                    },
                    maxSpo2: {
                        $max: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$spo2', 0] },
                                        { $gte: ['$spo2', 70] },
                                        { $lte: ['$spo2', 100] }
                                    ]
                                },
                                '$spo2',
                                null
                            ]
                        }
                    },
                    // Nhiệt độ không cần filter vì 0 độ C là giá trị hợp lệ
                    avgTemperature: { $avg: '$temperature' },
                    minTemperature: { $min: '$temperature' },
                    maxTemperature: { $max: '$temperature' },
                    count: { $sum: 1 } // Đếm tất cả documents, không chỉ những cái hợp lệ
                }
            }
        ]);

        console.log('📊 Calculated stats:', stats[0]);
        console.log('📊 Total documents count:', totalCount);

        // Xử lý kết quả: thay null bằng 0 và đảm bảo count = totalCount
        const result = stats[0] || {};
        const finalResult = {
            avgHeartRate: result.avgHeartRate ?? 0,
            minHeartRate: result.minHeartRate ?? 0,
            maxHeartRate: result.maxHeartRate ?? 0,
            avgSpo2: result.avgSpo2 ?? 0,
            minSpo2: result.minSpo2 ?? 0,
            maxSpo2: result.maxSpo2 ?? 0,
            avgTemperature: result.avgTemperature ?? 0,
            minTemperature: result.minTemperature ?? 0,
            maxTemperature: result.maxTemperature ?? 0,
            count: totalCount // Luôn dùng totalCount (tổng số documents, không chỉ những cái hợp lệ)
        };

        res.status(200).json({
            success: true,
            data: finalResult
        });
    } catch (error) {
        next(error);
    }
};

