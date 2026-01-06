const mqtt = require('mqtt');
const crypto = require('crypto');
const mongoose = require('mongoose');

// 1. IMPORT CONFIG & MODELS
const connectDB = require('../config/connect_db'); 
const Device = require('../models/deviceModel');
const HealthData = require('../models/healthModel');
const DeviceSession = require('../models/deviceSessionModel');

// 2. KẾT NỐI DATABASE (Nếu chạy độc lập)
// Nếu file này được require vào index.js (nơi đã connect DB), nó sẽ bỏ qua bước này.
if (mongoose.connection.readyState === 0) {
    console.log('🔌 MQTT Service: Đang khởi tạo kết nối Database...');
    connectDB();
}

// 3. CẤU HÌNH MQTT
const BROKER_HOST = 'broker.emqx.io';
const BROKER_PORT = '8883';
const TOPIC_NAME  = 'health/sensor/data/Du_An_CNTT';
const SECRET_KEY  = 'TanDo_Project_99'; // 16 bytes
const ALG         = 'aes-128-ecb';

const connectUrl = `mqtts://${BROKER_HOST}:${BROKER_PORT}`;

const client = mqtt.connect(connectUrl, {
    clean: true,
    connectTimeout: 4000,
    rejectUnauthorized: false,
    clientId: `NodeJS_Saver_${Math.random().toString(16).substr(2, 8)}`
});

// --- HÀM GIẢI MÃ ---
function decryptData(encryptedBase64) {
    try {
        const decipher = crypto.createDecipheriv(ALG, SECRET_KEY, null);
        decipher.setAutoPadding(false);
        let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        // Xử lý Padding
        const lastBrace = decrypted.lastIndexOf('}');
        if (lastBrace !== -1) decrypted = decrypted.substring(0, lastBrace + 1);
        
        return JSON.parse(decrypted);
    } catch (err) {
        return null;
    }
}

// --- SỰ KIỆN KẾT NỐI ---
client.on('connect', () => {
    console.log('✅ MQTT Worker: Đã kết nối Broker & Sẵn sàng lưu Data!');
    client.subscribe(TOPIC_NAME);
});

// --- LOGIC LƯU DATA VÀO DB ---
client.on('message', async (topic, message) => {
    // 1. Giải mã
    const data = decryptData(message.toString());

    // ================================================================
    // 👉 [MỚI THÊM] LOG DATA RA MÀN HÌNH ĐỂ KIỂM TRA
    // ================================================================
    console.log('\n--------------------------------------------------');
    console.log(`📩 NHẬN DATA LÚC: ${new Date().toLocaleTimeString()}`);
    if (data) {
        console.log('✅ NỘI DUNG GIẢI MÃ:', JSON.stringify(data, null, 2));
    } else {
        console.log('❌ KHÔNG THỂ GIẢI MÃ (Dữ liệu rác hoặc sai Key)');
    }
    console.log('--------------------------------------------------\n');
    // ================================================================

    if (!data || !data.deviceId) return; // Dữ liệu lỗi -> Bỏ qua

    try {
        // ---------------------------------------------------------
        // BƯỚC 1: TÌM HOẶC TẠO THIẾT BỊ (AUTO PROVISIONING)
        // ---------------------------------------------------------
        let device = await Device.findOne({ deviceId: data.deviceId });

        if (!device) {
            console.log(`✨ Phát hiện thiết bị mới: ${data.deviceId}. Đang tạo record...`);
            device = new Device({
                deviceId: data.deviceId,
                deviceName: `Device-${data.deviceId}`,
                status: 'online',
                lastSeen: new Date(),
                owner: null // Chưa gán owner cứng
            });
            await device.save();
        } else {
            // Cập nhật lastSeen để biết thiết bị còn sống
            await Device.findByIdAndUpdate(device._id, { 
                status: 'online', 
                lastSeen: new Date() 
            });
        }

        // ---------------------------------------------------------
        // BƯỚC 2: KIỂM TRA PHIÊN (SESSION) ĐỂ XÁC ĐỊNH NGƯỜI BỆNH
        // ---------------------------------------------------------
        // Chỉ lưu dữ liệu nếu có bác sĩ/y tá đã bấm "Bắt đầu đo" (Active = true)
        const activeSession = await DeviceSession.findOne({ 
            deviceId: data.deviceId, 
            active: true 
        });

        if (!activeSession) {
            console.log(`⚠️ BỎ QUA: Thiết bị ${data.deviceId} chưa có phiên đo (No Active Session).`);
            return; 
        }

        // ---------------------------------------------------------
        // BƯỚC 3: LƯU CHỈ SỐ SỨC KHỎE
        // ---------------------------------------------------------
        const healthRecord = new HealthData({
            patient: activeSession.user, // Lấy User ID từ session đang active
            deviceId: data.deviceId,
            device: device._id,
            
            // Lấy dữ liệu an toàn (tránh crash nếu null)
            heartRate: data.heart?.bpm || 0,
            spo2: data.heart?.spo2 || 0,
            irValue: data.heart?.ir || 0,
            activityStatus: data.motion || 'UNKNOWN',
            temperature: data.env?.temp || 0,
            pressure: data.env?.pressure || 0,
            
            timestamp: new Date()
        });

        await healthRecord.save();
        console.log(`💾 [ĐÃ LƯU] Dev: ${data.deviceId} -> User: ${activeSession.user} | BPM: ${data.heart?.bpm}`);

        // ---------------------------------------------------------
        // BƯỚC 4: EMIT REAL-TIME DATA QUA SOCKET.IO
        // ---------------------------------------------------------
        if (global.io) {
            // Populate patient và device trước khi emit
            const populatedRecord = await HealthData.findById(healthRecord._id)
                .populate('patient', 'username fullName role')
                .populate('device', 'deviceId deviceName status');
            
            // Emit cho tất cả clients hoặc chỉ client của patient đó
            global.io.emit('healthData:new', populatedRecord);
            console.log(`📡 [SOCKET] Đã emit dữ liệu mới cho client`);
        }

    } catch (err) {
        console.error('❌ Database Save Error:', err.message);
    }
});

client.on('error', (err) => console.error('❌ MQTT Error:', err.message));

module.exports = client;