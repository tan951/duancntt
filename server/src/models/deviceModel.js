const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true, 
        trim: true
    },

    deviceName: {
        type: String,
        default: 'Thiết bị sức khỏe'
    },

    // Người sở hữu thiết bị (tham chiếu đến User) - giữ để tương thích
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Cho phép null khi thiết bị chưa được gán
    },

    // Danh sách người sở hữu thiết bị (một thiết bị có thể có nhiều owners)
    owners: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        default: [] // Mảng rỗng nếu chưa có owner nào
    },

    // Cài đặt ngưỡng cảnh báo riêng cho thiết bị này
    config: {
        maxBpm: { type: Number, default: 130 }, // Tim trên 120 báo động
        minSpo2: { type: Number, default: 90 }, // SpO2 dưới 94 báo động
        alertEnabled: { type: Boolean, default: true }
    },

    // Trạng thái online/offline (Cập nhật mỗi khi nhận gói tin MQTT)
    status: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    },
    
    lastSeen: {
        type: Date // Thời điểm cuối cùng thiết bị gửi tin
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Device', DeviceSchema);