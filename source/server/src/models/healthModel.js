const  mongoose = require('mongoose');

const healthSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device'
    },
    heartRate:{
        type: Number, 
        default: 0,
        min: 0, 
        max: 255,
        required: true
    },
    spo2:{
        type: Number, 
        default: 0,
        min: 0, 
        max: 100,
        required: true
    },
    irValue:{
        type: Number,
        default:0,
        required: true
    },
    activityStatus: {
        type: String,
        enum: ['IDLE', 'WALK', 'RUNNING', 'IMPACT', 'UNKNOWN'],
        default: 'IDLE'
    },
    temperature: {
        type: Number, // °C
        min: -50,
        max: 100,
        required: true
    },
    pressure: {
        type: Number, // Pa
        min: 0,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now, 
        index: true
    }
});

// Tự động xóa bản ghi sau 30 ngày (2592000 giây) để tiết kiệm DB
healthSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('HealthData', healthSchema);