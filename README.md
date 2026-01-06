# Hệ Thống Giám Sát Sức Khỏe IoT

## 🌐 Live Demo

**🔗 Link dự án đã deploy:** [Truy cập ứng dụng](https://duancntt.vercel.app/)

**URL:** https://duancntt.vercel.app/

## 📋 Mô Tả Dự Án

Hệ thống giám sát sức khỏe IoT là một ứng dụng web full-stack cho phép theo dõi và quản lý các chỉ số sức khỏe từ thiết bị IoT theo thời gian thực. Hệ thống bao gồm:

- **Backend Server**: API RESTful với tích hợp MQTT để nhận dữ liệu từ thiết bị IoT
- **Frontend Client**: Giao diện web React hiện đại với biểu đồ trực quan và quản lý dữ liệu
- **Real-time Communication**: Socket.IO để cập nhật dữ liệu theo thời gian thực
- **Database**: MongoDB để lưu trữ dữ liệu người dùng, thiết bị và chỉ số sức khỏe

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   IoT       │  MQTT   │   Backend    │  REST   │   Frontend  │
│   Device    │ ──────> │   Server     │ <────── │   React     │
│             │         │              │         │             │
└─────────────┘         │  - Express   │         │  - Vite     │
                        │  - MongoDB   │         │  - Router   │
                        │  - Socket.IO │         │  - Recharts │
                        └──────────────┘         └─────────────┘
                               │
                               │ Socket.IO
                               │
                               ▼
                        ┌──────────────┐
                        │   Clients    │
                        │  (Real-time) │
                        └──────────────┘
```

## 🚀 Tính Năng Chính

### 1. Quản Lý Người Dùng
- Đăng ký/Đăng nhập với JWT authentication
- Refresh token tự động
- Phân quyền Admin và Patient
- Quản lý thông tin cá nhân (họ tên, giới tính, ngày sinh, SĐT)
- Tự động tính tuổi từ ngày sinh

### 2. Quản Lý Thiết Bị
- Tự động phát hiện thiết bị mới qua MQTT (Auto-provisioning)
- Quản lý thiết bị IoT (thêm, sửa, xóa)
- Gán nhiều chủ sở hữu cho một thiết bị
- Theo dõi trạng thái online/offline
- Cập nhật thời gian hoạt động cuối cùng (lastSeen)
- Cấu hình ngưỡng cảnh báo riêng cho từng thiết bị

### 3. Quản Lý Phiên Đo (Sessions)
- Tạo phiên đo để bắt đầu thu thập dữ liệu
- Kết thúc phiên đo để dừng thu thập
- Chỉ lưu dữ liệu khi có phiên đo đang active
- Lịch sử các phiên đo với phân trang

### 4. Giám Sát Dữ Liệu Sức Khỏe
- **Chỉ số theo dõi:**
  - Nhịp tim (Heart Rate - BPM)
  - Nồng độ oxy trong máu (SpO2 - %)
  - Nhiệt độ môi trường (°C)
  - Áp suất (Pa)
  - Trạng thái hoạt động (IDLE, WALK, RUNNING, IMPACT, UNKNOWN)
  - Giá trị IR (từ cảm biến)

- **Hiển thị dữ liệu:**
  - Xem dạng bảng với phân trang
  - Xem dạng lịch (calendar view) với highlight ngày có dữ liệu
  - Click vào ngày trong lịch để xem chi tiết

- **Lọc và tìm kiếm:**
  - Lọc theo khoảng thời gian (từ ngày - đến ngày)
  - Lọc theo nhịp tim (min-max)
  - Lọc theo SpO2 (min-max)
  - Lọc theo nhiệt độ (min-max)
  - Lọc theo trạng thái hoạt động
  - Lọc theo thiết bị
  - Sắp xếp theo thời gian (mới nhất/cũ nhất)
  - Lọc nhanh: Hôm nay, 7 ngày qua, 30 ngày qua

- **Xuất dữ liệu:**
  - Xuất ra file CSV với UTF-8 encoding
  - Xuất theo khoảng thời gian tùy chọn
  - Xuất tất cả dữ liệu

### 5. Biểu Đồ Trực Quan
- Biểu đồ đường thời gian cho:
  - Nhịp tim (BPM)
  - SpO2 (%)
  - Nhiệt độ (°C)
- Cập nhật real-time khi có dữ liệu mới
- Hiển thị badge "Live" khi đang nhận dữ liệu real-time
- Điều khiển bắt đầu/kết thúc đo trực tiếp từ biểu đồ

### 6. Thống Kê Sức Khỏe
- Thống kê tổng hợp:
  - Nhịp tim: Trung bình, Min, Max
  - SpO2: Trung bình, Min, Max
  - Nhiệt độ: Trung bình, Min, Max
  - Tổng số lần đo
- Lọc thống kê theo:
  - Khoảng thời gian
  - Thiết bị cụ thể
- Tự động làm mới dữ liệu

### 7. Cảnh Báo Sức Khỏe
- Cảnh báo tự động khi phát hiện giá trị bất thường:
  - **Nhịp tim:**
    - ⚠️ Cảnh báo: 40-60 BPM (thấp) hoặc 100-130 BPM (cao)
    - 🚨 Khẩn cấp: 30-40 BPM (rất thấp) hoặc >130 BPM (rất cao)
  - **SpO2:**
    - ⚠️ Cảnh báo: 90-95% (thấp)
    - 🚨 Khẩn cấp: <90% (rất thấp)
  - **Nhiệt độ:**
    - ⚠️ Cảnh báo: <10°C (quá lạnh) hoặc >40°C (quá nóng)
  - **Thiết bị:**
    - ⚠️ Cảnh báo khi nhịp tim và SpO2 đều bằng 0 (vấn đề thiết bị hoặc ngón tay)

### 8. Trang Quản Trị (Admin)
- Quản lý người dùng:
  - Xem danh sách tất cả người dùng
  - Thêm người dùng mới
  - Sửa thông tin người dùng
  - Xóa người dùng (bảo vệ admin cuối cùng)
  - Phân quyền Admin/Patient
- Quản lý thiết bị:
  - Xem danh sách tất cả thiết bị
  - Thêm thiết bị mới
  - Sửa thông tin thiết bị
  - Gán/xóa chủ sở hữu cho thiết bị
  - Xóa thiết bị

### 9. Trang Cá Nhân (Profile)
- Xem và chỉnh sửa thông tin cá nhân
- Cập nhật mật khẩu

## 🛠️ Công Nghệ Sử Dụng

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database (với Mongoose ODM)
- **Socket.IO** - Real-time communication
- **MQTT** - IoT protocol (sử dụng broker EMQX)
- **JWT** - Authentication (jsonwebtoken)
- **bcryptjs** - Password hashing
- **express-rate-limit** - Rate limiting
- **cors** - Cross-Origin Resource Sharing
- **dotenv** - Environment variables

### Frontend
- **React 19** - UI library
- **Vite** - Build tool và dev server
- **React Router DOM** - Client-side routing
- **Recharts** - Chart library
- **Socket.IO Client** - Real-time client
- **CSS3** - Styling với custom properties

## 📁 Cấu Trúc Thư Mục

```
duancntt/
├── server/                 # Backend server
│   ├── index.js           # Entry point, Express app setup
│   ├── package.json       # Dependencies
│   └── src/
│       ├── config/        # Configuration files
│       │   └── connect_db.js    # MongoDB connection
│       ├── controllers/   # Route controllers
│       │   ├── userController.js
│       │   ├── deviceController.js
│       │   ├── sessionController.js
│       │   └── healthController.js
│       ├── middleware/    # Express middleware
│       │   ├── authMiddleware.js      # JWT authentication
│       │   ├── errorMiddleware.js     # Error handling
│       │   └── rateLimitMiddleware.js # Rate limiting
│       ├── models/        # Mongoose models
│       │   ├── userModel.js
│       │   ├── deviceModel.js
│       │   ├── deviceSessionModel.js
│       │   └── healthModel.js
│       ├── routes/        # API routes
│       │   ├── userRoutes.js
│       │   ├── deviceRoutes.js
│       │   ├── sessionRoutes.js
│       │   └── healthRoutes.js
│       ├── services/      # Business logic services
│       │   └── mqttService.js    # MQTT client và data processing
│       └── utils/         # Utility functions
│           └── tokenUtils.js     # JWT token generation
│
└── client/                # Frontend React app
    ├── index.html         # HTML template
    ├── vite.config.js    # Vite configuration
    ├── package.json      # Dependencies
    └── src/
        ├── main.jsx      # React entry point
        ├── App.jsx       # Main app component với routing
        ├── index.css     # Global styles
        ├── pages/        # Page components
        │   ├── LoginPage.jsx
        │   ├── RegisterPage.jsx
        │   ├── DashboardPage.jsx
        │   ├── AdminPage.jsx
        │   └── ProfilePage.jsx
        ├── components/   # Reusable components
        │   ├── ui/       # UI components (Button, Card, Input, etc.)
        │   ├── charts/   # Chart components
        │   │   └── HealthCharts.jsx
        │   └── health/   # Health-related components
        │       └── HealthCalendar.jsx
        ├── context/      # React Context
        │   └── AuthContext.jsx    # Authentication context
        ├── services/     # API services
        │   ├── apiService.js      # REST API client
        │   └── socketService.js   # Socket.IO client
        ├── hooks/        # Custom React hooks
        │   └── useToast.js
        ├── utils/        # Utility functions
        │   └── authUtils.js       # Auth helpers
        └── styles/       # CSS files
            ├── globals.css
            └── theme.css
```

## 🔧 Cài Đặt và Chạy

### Yêu Cầu Hệ Thống
- Node.js >= 16.x
- MongoDB (local hoặc cloud)
- npm hoặc yarn

### 1. Cài Đặt Dependencies

#### Backend
```bash
cd server
npm install
```

#### Frontend
```bash
cd client
npm install
```

### 2. Cấu Hình Environment Variables

#### Backend (server/.env)
```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/iot_health_db
# Hoặc MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/iot_health_db

# Server Port
PORT=3000

# JWT Secret
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# JWT Expiration
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173
```

#### Frontend (client/.env hoặc .env.local)
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3. Chạy Ứng Dụng

#### Terminal 1 - Backend Server
```bash
cd server
npm start
```
Server sẽ chạy tại: `http://localhost:3000`

#### Terminal 2 - Frontend Client
```bash
cd client
npm run dev
```
Client sẽ chạy tại: `http://localhost:5173`

### 4. Build Production

#### Backend
```bash
cd server
npm start
```

#### Frontend
```bash
cd client
npm run build
npm run preview
```

## 📡 Cấu Hình MQTT

Hệ thống sử dụng MQTT broker công cộng EMQX để nhận dữ liệu từ thiết bị IoT.

### Cấu hình trong `server/src/services/mqttService.js`:
```javascript
const BROKER_HOST = 'broker.emqx.io';
const BROKER_PORT = '8883';  // MQTTS (TLS)
const TOPIC_NAME = 'health/sensor/data/Du_An_CNTT';
const SECRET_KEY = 'TanDo_Project_99';  // AES-128-ECB key
```

### Định Dạng Dữ Liệu MQTT

Thiết bị IoT gửi dữ liệu đã được mã hóa AES-128-ECB (Base64) đến topic:
```
health/sensor/data/Du_An_CNTT
```

**Dữ liệu sau khi giải mã:**
```json
{
  "deviceId": "DEVICE_001",
  "heart": {
    "bpm": 75,
    "spo2": 98,
    "ir": 12345
  },
  "motion": "IDLE",
  "env": {
    "temp": 25.5,
    "pressure": 101325
  }
}
```

## 🔐 Bảo Mật

### Authentication & Authorization
- JWT-based authentication với access token và refresh token
- Access token: 15 phút
- Refresh token: 7 ngày
- Tự động refresh token khi hết hạn
- Xóa refresh token khi server restart (bảo mật)

### Rate Limiting
- **Login**: 5 requests/15 phút
- **Register**: 3 requests/15 phút
- **Refresh Token**: 10 requests/15 phút
- **Health Data**: 100 requests/15 phút
- **Statistics**: 20 requests/15 phút
- **API chung**: 200 requests/15 phút

### Password Security
- Mật khẩu được hash bằng bcryptjs (salt rounds: 10)
- Không lưu mật khẩu dạng plain text

### Data Encryption
- Dữ liệu MQTT được mã hóa AES-128-ECB
- HTTPS/MQTTS cho kết nối an toàn

## 📊 Database Schema

### User Model
```javascript
{
  username: String (unique, required),
  password: String (hashed, required),
  fullName: String (required),
  gender: Enum ['male', 'female', 'other'],
  phoneNumber: String,
  dateOfBirth: Date,
  devices: [ObjectId],  // References to Device
  role: Enum ['admin', 'patient'],
  refreshToken: String,
  refreshTokenExpiry: Date,
  createdAt: Date
}
```

### Device Model
```javascript
{
  deviceId: String (unique, required),
  deviceName: String,
  owner: ObjectId,  // Reference to User (legacy)
  owners: [ObjectId],  // References to User (multiple)
  config: {
    maxBpm: Number (default: 130),
    minSpo2: Number (default: 90),
    alertEnabled: Boolean (default: true)
  },
  status: Enum ['online', 'offline'],
  lastSeen: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### DeviceSession Model
```javascript
{
  deviceId: String (required),
  user: ObjectId,  // Reference to User
  device: ObjectId,  // Reference to Device
  active: Boolean (default: true),
  startedAt: Date (default: now),
  endedAt: Date
}
```

### HealthData Model
```javascript
{
  patient: ObjectId (required),  // Reference to User
  deviceId: String (required),
  device: ObjectId,  // Reference to Device
  heartRate: Number (0-255, required),
  spo2: Number (0-100, required),
  irValue: Number (required),
  activityStatus: Enum ['IDLE', 'WALK', 'RUNNING', 'IMPACT', 'UNKNOWN'],
  temperature: Number (required),
  pressure: Number (required),
  timestamp: Date (default: now, indexed),
  // TTL: 30 days (auto-delete)
}
```

## 🔌 API Endpoints

### Authentication
- `POST /api/users/login` - Đăng nhập
- `POST /api/users/refresh` - Refresh access token
- `POST /api/users/logout` - Đăng xuất

### Users
- `GET /api/users` - Lấy danh sách người dùng
- `POST /api/users` - Tạo người dùng mới
- `GET /api/users/:id` - Lấy thông tin người dùng
- `PUT /api/users/:id` - Cập nhật người dùng
- `DELETE /api/users/:id` - Xóa người dùng

### Devices
- `GET /api/devices` - Lấy danh sách thiết bị
- `POST /api/devices` - Tạo thiết bị mới
- `GET /api/devices/:id` - Lấy thông tin thiết bị
- `GET /api/devices/deviceId/:deviceId` - Lấy thiết bị theo deviceId
- `GET /api/devices/user/:userId` - Lấy thiết bị theo user
- `PUT /api/devices/:id` - Cập nhật thiết bị
- `PUT /api/devices/:id/config` - Cập nhật cấu hình thiết bị
- `DELETE /api/devices/:id` - Xóa thiết bị

### Sessions
- `GET /api/sessions` - Lấy danh sách phiên đo
- `POST /api/sessions` - Tạo phiên đo mới
- `GET /api/sessions/:id` - Lấy thông tin phiên đo
- `GET /api/sessions/device/:deviceId/active` - Lấy phiên đo active
- `PUT /api/sessions/:id` - Cập nhật phiên đo
- `PUT /api/sessions/:id/end` - Kết thúc phiên đo
- `DELETE /api/sessions/:id` - Xóa phiên đo

### Health Data
- `GET /api/health` - Lấy danh sách dữ liệu sức khỏe (với filters)
- `GET /api/health/stats` - Lấy thống kê sức khỏe
- `GET /api/health/patient/:id` - Lấy dữ liệu theo patient
- `GET /api/health/device/:deviceId` - Lấy dữ liệu theo device
- `GET /api/health/:id` - Lấy chi tiết dữ liệu
- `DELETE /api/health/:id` - Xóa dữ liệu

## 📡 Socket.IO Events

### Client → Server
- `connection` - Kết nối client
- `disconnect` - Ngắt kết nối

### Server → Client
- `healthData:new` - Dữ liệu sức khỏe mới
- `session:created` - Phiên đo được tạo
- `session:ended` - Phiên đo kết thúc

## 🎨 Giao Diện Người Dùng

### Trang Đăng Nhập
- Form đăng nhập với username/password
- Link đến trang đăng ký
- Validation và error handling

### Trang Đăng Ký
- Form đăng ký với đầy đủ thông tin
- Validation mật khẩu (tối thiểu 6 ký tự)
- Link quay lại đăng nhập

### Dashboard (Patient)
- **Tab Thiết Bị**: Danh sách thiết bị, trạng thái, nút bắt đầu đo
- **Tab Phiên Đo**: Lịch sử phiên đo với phân trang
- **Tab Dữ Liệu Sức Khỏe**: 
  - Xem bảng hoặc lịch
  - Lọc và tìm kiếm
  - Xuất CSV
- **Tab Biểu Đồ**: 
  - Biểu đồ real-time
  - Điều khiển bắt đầu/kết thúc đo
  - Cảnh báo sức khỏe
- **Tab Thống Kê**: 
  - Thống kê tổng hợp
  - Lọc theo thời gian và thiết bị

### Trang Quản Trị (Admin)
- **Tab Người Dùng**: CRUD người dùng
- **Tab Thiết Bị**: CRUD thiết bị, quản lý chủ sở hữu

### Trang Cá Nhân
- Xem và chỉnh sửa thông tin
- Đổi mật khẩu

## 🔄 Luồng Dữ Liệu

### 1. Thu Thập Dữ Liệu từ IoT Device
```
IoT Device → MQTT Broker (EMQX) → MQTT Service → MongoDB → Socket.IO → Frontend
```

### 2. Hiển Thị Dữ Liệu Real-time
```
MQTT Service nhận data → Lưu vào DB → Emit qua Socket.IO → Frontend cập nhật UI
```

### 3. Tạo Phiên Đo
```
User click "Bắt Đầu Đo" → API tạo Session (active=true) → MQTT Service bắt đầu lưu data
```

### 4. Kết Thúc Phiên Đo
```
User click "Kết Thúc Đo" → API cập nhật Session (active=false) → MQTT Service dừng lưu data
```

## ⚙️ Cấu Hình Nâng Cao

### Tự Động Xóa Dữ Liệu
- Dữ liệu sức khỏe tự động xóa sau 30 ngày (TTL index)
- Cấu hình trong `healthModel.js`:
```javascript
healthSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });
```

### Cấu Hình Cảnh Báo
- Ngưỡng cảnh báo mặc định:
  - Nhịp tim: 60-100 BPM (bình thường)
  - SpO2: ≥95% (bình thường)
  - Nhiệt độ: 20-30°C (bình thường)
- Có thể cấu hình riêng cho từng thiết bị

### Rate Limiting
- Cấu hình trong `rateLimitMiddleware.js`
- Có thể điều chỉnh theo nhu cầu

## 🐛 Xử Lý Lỗi

### Backend
- Centralized error handling với `errorMiddleware.js`
- Custom error messages
- HTTP status codes phù hợp

### Frontend
- Error boundaries
- Toast notifications cho lỗi
- Validation forms
- Network error handling

## 📝 Ghi Chú Quan Trọng

1. **Refresh Token**: Tự động xóa khi server restart để bảo mật
2. **Auto-provisioning**: Thiết bị mới tự động được tạo khi gửi dữ liệu lần đầu
3. **Session-based Data Collection**: Chỉ lưu dữ liệu khi có session active
4. **Data TTL**: Dữ liệu tự động xóa sau 30 ngày
5. **Multiple Owners**: Một thiết bị có thể có nhiều chủ sở hữu
6. **Admin Protection**: Không thể xóa admin cuối cùng

## 🚀 Triển Khai Production

### Frontend (Đã Deploy)
- **Live URL**: [https://duancntt.vercel.app/](https://duancntt.vercel.app/)
- **Platform**: Vercel
- **Build**: `npm run build`
- **Deploy**: Tự động deploy khi push code lên repository

### Backend
1. Sử dụng MongoDB Atlas hoặc MongoDB server riêng
2. Cấu hình environment variables
3. Sử dụng process manager (PM2)
4. Enable HTTPS
5. Cấu hình firewall
6. Cấu hình CORS để cho phép frontend từ Vercel

## 📄 License

ISC

## 👤 Tác Giả

Đỗ Duy Tân - Dự án CNTT

## 📞 Liên Hệ

Nếu có thắc mắc hoặc gặp vấn đề, vui lòng tạo issue trên repository.

---

**Lưu ý**: Đảm bảo MongoDB đang chạy trước khi khởi động server. Kiểm tra kết nối MQTT broker nếu thiết bị IoT không gửi được dữ liệu.

