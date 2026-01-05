import { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './HealthCharts.css';

// Màu sắc hiện đại cho biểu đồ
const COLORS = {
  heartRate: '#e74c3c',      // Đỏ - Nhịp tim
  spo2: '#3498db',           // Xanh dương - SpO2
  temperature: '#f39c12',    // Cam - Nhiệt độ
  pressure: '#9b59b6',       // Tím - Áp suất
  activity: ['#2ecc71', '#3498db', '#e67e22', '#e74c3c', '#95a5a6'], // Xanh lá, xanh dương, cam, đỏ, xám
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Factory function để tạo CustomActiveDot với color và unit
const createCustomActiveDot = (color, unit = '', dataKey) => {
  return (props) => {
    const { cx, cy, payload, value } = props;
    
    // Ưu tiên lấy giá trị từ payload vì nó chính xác hơn
    // payload chứa toàn bộ data point object
    const displayValue = payload?.[dataKey] !== undefined && payload?.[dataKey] !== null
      ? payload[dataKey]
      : (value !== undefined && value !== null ? value : null);
    
    // Chỉ ẩn nếu giá trị không tồn tại (undefined/null), không ẩn giá trị 0
    if (displayValue === undefined || displayValue === null) {
      // Fallback: hiển thị dot mặc định nếu không có giá trị
      return <circle cx={cx} cy={cy} r={7} fill={color} stroke="#fff" strokeWidth={2} />;
    }
    
    // Xử lý giá trị 0 một cách rõ ràng
    const formattedValue = typeof displayValue === 'number' 
      ? (displayValue === 0 ? '0' : (displayValue % 1 === 0 ? displayValue.toString() : displayValue.toFixed(1)))
      : displayValue.toString();
    
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill={color} stroke="#fff" strokeWidth={2} />
        {/* Background cho text để dễ đọc */}
        <rect
          x={cx - 25}
          y={cy - 32}
          width={50}
          height={16}
          fill="rgba(255, 255, 255, 0.9)"
          stroke={color}
          strokeWidth={1}
          rx={4}
        />
        <text
          x={cx}
          y={cy - 20}
          fill={color}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {formattedValue}{unit}
        </text>
      </g>
    );
  };
};

const HealthCharts = ({ healthData }) => {
  // Tạo dữ liệu placeholder để hiển thị khung biểu đồ
  const createPlaceholderData = () => {
    const now = new Date();
    return Array.from({ length: 20 }, (_, i) => {
      const time = new Date(now.getTime() - (19 - i) * 60000); // Mỗi phút
      return {
        time: formatDateTime(time),
        heartRate: 0,
        spo2: 0,
        temperature: 0,
        pressure: 0,
        fullTime: time
      };
    });
  };

  // Sử dụng useMemo để tối ưu performance và tránh re-render không cần thiết
  const { chartData, activityData } = useMemo(() => {
    const hasData = healthData && healthData.length > 0;

    if (hasData) {
      // Dữ liệu thật - loại bỏ duplicate timestamps và sắp xếp
      // Nếu có duplicate, giữ lại điểm mới nhất
      const uniqueDataMap = new Map();
      healthData.forEach(item => {
        const key = item.timestamp;
        if (!uniqueDataMap.has(key) || new Date(item.timestamp) > new Date(uniqueDataMap.get(key).timestamp)) {
          uniqueDataMap.set(key, item);
        }
      });
      
      const uniqueData = Array.from(uniqueDataMap.values());
      const sortedData = uniqueData
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(-50); // Giữ 50 điểm gần nhất để animation mượt mà
      
      const processedChartData = sortedData.map((item, index) => ({
        time: formatDateTime(item.timestamp),
        heartRate: item.heartRate ?? 0,
        spo2: item.spo2 ?? 0,
        temperature: item.temperature ?? 0,
        pressure: item.pressure ?? 0,
        fullTime: item.timestamp,
        // Sử dụng timestamp làm id để Recharts có thể track các điểm
        id: item.timestamp || `${item._id}-${index}`
      }));

      // Tính toán trạng thái hoạt động
      const activityCounts = healthData.reduce((acc, item) => {
        const status = item.activityStatus || 'UNKNOWN';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const processedActivityData = Object.entries(activityCounts).map(([name, value]) => ({
        name: name === 'IDLE' ? 'Nghỉ ngơi' : 
              name === 'WALKING' ? 'Đi bộ' : 
              name === 'RUNNING' ? 'Chạy' : 
              name === 'IMPACT' ? 'Tác động' : 'Không xác định',
        value
      }));

      return {
        chartData: processedChartData,
        activityData: processedActivityData
      };
    } else {
      // Dữ liệu placeholder
      return {
        chartData: createPlaceholderData(),
        activityData: [{ name: 'Chờ dữ liệu', value: 1 }]
      };
    }
  }, [healthData]); // Chỉ re-compute khi healthData thay đổi

  return (
    <div className="health-charts">
      <div className="charts-grid">
        {/* Biểu đồ Nhịp Tim */}
        <div className="chart-card">
          <h3>❤️ Nhịp Tim (BPM)</h3>
          <div className="metric-display" style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <div className="metric-value-large" style={{ color: COLORS.heartRate, fontSize: '2.5rem', fontWeight: 800 }}>
              {chartData.length > 0 ? Math.round(chartData[chartData.length - 1].heartRate) : '0'}
              <span style={{ fontSize: '1.2rem', fontWeight: 600, marginLeft: '0.5rem' }}>BPM</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart 
              data={chartData} 
              margin={{ top: 30, right: 30, left: 0, bottom: 0 }}
              syncId="health-charts"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis 
                dataKey="time" 
                stroke="#999"
                fontSize={11}
                tick={{ fill: '#666' }}
                angle={-35}
                textAnchor="end"
                height={70}
              />
              <YAxis 
                stroke="#999"
                fontSize={12}
                tick={{ fill: '#666' }}
                domain={[0, 'auto']}
                label={{ value: 'BPM', angle: -90, position: 'insideLeft', style: { fill: COLORS.heartRate, fontWeight: 600 } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: `2px solid ${COLORS.heartRate}`,
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                labelStyle={{ fontWeight: 600, color: '#333' }}
                content={({ active, payload, label, activeIndex }) => {
                  if (active && payload && payload.length > 0) {
                    // Sử dụng activeIndex để lấy đúng điểm từ chartData
                    let dataPoint = null;
                    let value = 0;
                    let timeLabel = label;
                    
                    if (activeIndex !== undefined && activeIndex !== null && chartData[activeIndex]) {
                      // Lấy điểm từ chartData dựa trên activeIndex
                      dataPoint = chartData[activeIndex];
                      value = dataPoint.heartRate ?? 0;
                      timeLabel = dataPoint.time || label;
                    } else {
                      // Fallback: lấy từ payload
                      const payloadItem = payload[0];
                      value = payloadItem.value !== undefined && payloadItem.value !== null
                        ? payloadItem.value
                        : (payloadItem.payload?.heartRate ?? 0);
                      timeLabel = payloadItem.payload?.time || label;
                    }
                    
                    return (
                      <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        border: `2px solid ${COLORS.heartRate}`,
                        borderRadius: '12px',
                        padding: '10px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}>
                        <p style={{ fontWeight: 600, color: '#333', margin: '0 0 5px 0' }}>{timeLabel}</p>
                        <p style={{ margin: 0, color: COLORS.heartRate }}>
                          <span style={{ fontWeight: 600 }}>Nhịp tim:</span> {value} BPM
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '15px' }} />
              <Line
                type="monotone"
                dataKey="heartRate"
                stroke={COLORS.heartRate}
                strokeWidth={3}
                dot={{ r: 5, fill: COLORS.heartRate, strokeWidth: 2, stroke: '#fff' }}
                activeDot={false}
                name="Nhịp tim"
                isAnimationActive={true}
                animationDuration={300}
                animationEasing="ease-out"
                label={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Biểu đồ SpO2 */}
        <div className="chart-card">
          <h3>💧 SpO2 - Nồng Độ Oxy (%)</h3>
          <div className="metric-display" style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <div className="metric-value-large" style={{ color: COLORS.spo2, fontSize: '2.5rem', fontWeight: 800 }}>
              {chartData.length > 0 ? Math.round(chartData[chartData.length - 1].spo2) : '0'}
              <span style={{ fontSize: '1.2rem', fontWeight: 600, marginLeft: '0.5rem' }}>%</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis 
                dataKey="time" 
                stroke="#999"
                fontSize={11}
                tick={{ fill: '#666' }}
                angle={-35}
                textAnchor="end"
                height={70}
              />
              <YAxis 
                stroke="#999"
                fontSize={12}
                tick={{ fill: '#666' }}
                domain={[0, 'auto']}
                label={{ value: 'SpO2 (%)', angle: -90, position: 'insideLeft', style: { fill: COLORS.spo2, fontWeight: 600 } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: `2px solid ${COLORS.spo2}`,
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                labelStyle={{ fontWeight: 600, color: '#333' }}
                content={({ active, payload, label, activeIndex }) => {
                  if (active && payload && payload.length > 0) {
                    // Sử dụng activeIndex để lấy đúng điểm từ chartData
                    let dataPoint = null;
                    let value = 0;
                    let timeLabel = label;
                    
                    if (activeIndex !== undefined && activeIndex !== null && chartData[activeIndex]) {
                      // Lấy điểm từ chartData dựa trên activeIndex
                      dataPoint = chartData[activeIndex];
                      value = dataPoint.spo2 ?? 0;
                      timeLabel = dataPoint.time || label;
                    } else {
                      // Fallback: lấy từ payload
                      const payloadItem = payload[0];
                      value = payloadItem.value !== undefined && payloadItem.value !== null
                        ? payloadItem.value
                        : (payloadItem.payload?.spo2 ?? 0);
                      timeLabel = payloadItem.payload?.time || label;
                    }
                    
                    return (
                      <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        border: `2px solid ${COLORS.spo2}`,
                        borderRadius: '12px',
                        padding: '10px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}>
                        <p style={{ fontWeight: 600, color: '#333', margin: '0 0 5px 0' }}>{timeLabel}</p>
                        <p style={{ margin: 0, color: COLORS.spo2 }}>
                          <span style={{ fontWeight: 600 }}>SpO2:</span> {value}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '15px' }} />
              <Line
                type="monotone"
                dataKey="spo2"
                stroke={COLORS.spo2}
                strokeWidth={3}
                dot={{ r: 5, fill: COLORS.spo2, strokeWidth: 2, stroke: '#fff' }}
                activeDot={false}
                name="SpO2"
                isAnimationActive={true}
                animationDuration={300}
                animationEasing="ease-out"
                label={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Nhiệt Độ & Áp Suất - Hiển thị số */}
        <div className="chart-card metrics-card">
          <h3>🌡️ Môi Trường</h3>
          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)' }}>
                🌡️
              </div>
              <div className="metric-info">
                <div className="metric-label">Nhiệt Độ</div>
                <div className="metric-value" style={{ color: COLORS.temperature }}>
                  {chartData.length > 0 ? chartData[chartData.length - 1].temperature.toFixed(1) : '0.0'}
                  <span className="metric-unit">°C</span>
                </div>
              </div>
            </div>
            
            <div className="metric-item">
              <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)' }}>
                🌍
              </div>
              <div className="metric-info">
                <div className="metric-label">Áp Suất</div>
                <div className="metric-value" style={{ color: COLORS.pressure }}>
                  {chartData.length > 0 ? (chartData[chartData.length - 1].pressure / 1000).toFixed(1) : '0.0'}
                  <span className="metric-unit">kPa</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Biểu đồ Trạng Thái Hoạt Động */}
        <div className="chart-card">
          <h3>🏃 Trạng Thái Hoạt Động</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={activityData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={110}
                innerRadius={60}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={3}
                isAnimationActive={true}
                animationDuration={300}
                animationEasing="ease-out"
              >
                {activityData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS.activity[index % COLORS.activity.length]}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '2px solid #667eea',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: 500 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default HealthCharts;

