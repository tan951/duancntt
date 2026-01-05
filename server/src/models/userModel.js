const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true, 
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false // Mặc định không trả về password khi query
    },
    fullName: {
        type: String,
        required: true
    },
    gender: {
        type: String, 
        enum: ['male', 'female', 'other'],
        default: 'other'
    },
    phoneNumber: {
        type: String
    },
    dateOfBirth: {
        type: Date
    },
    
    // --- QUẢN LÝ THIẾT BỊ ---
    devices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device'
    }],
    
    role: {
        type: String,
        enum: ['admin', 'patient'],
        default: 'patient' 
    },
    refreshToken: {
        type: String,
        default: null
    },
    refreshTokenExpiry: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true }
});

// --- VIRTUAL FIELD: Tự động tính tuổi ---
UserSchema.virtual('age').get(function() {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const dob = new Date(this.dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
});

// --- MIDDLEWARE: Mã hóa mật khẩu ---
UserSchema.pre('save', async function() {
    // Chỉ mã hóa password nếu password được thay đổi
    if (!this.isModified('password')) return;
    
    // Mã hóa password
    const salt = await bcrypt.genSalt(10); 
    this.password = await bcrypt.hash(this.password, salt);
});
  
// --- METHOD: So sánh mật khẩu ---
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};
  
module.exports = mongoose.model('User', UserSchema);