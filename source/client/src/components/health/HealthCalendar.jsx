import { useState } from 'react';
import './HealthCalendar.css';

function HealthCalendar({ healthData, onDateClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Lấy năm và tháng hiện tại
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Tạo object để nhóm dữ liệu theo ngày
  const dataByDate = {};
  healthData.forEach(data => {
    if (data.timestamp) {
      const date = new Date(data.timestamp);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = {
          count: 0,
          heartRate: [],
          spo2: [],
          temperature: [],
          hasWarning: false,
          hasDanger: false
        };
      }
      
      dataByDate[dateKey].count++;
      if (data.heartRate > 0 && data.heartRate >= 30 && data.heartRate <= 220) {
        dataByDate[dateKey].heartRate.push(data.heartRate);
      }
      if (data.spo2 > 0 && data.spo2 >= 70 && data.spo2 <= 100) {
        dataByDate[dateKey].spo2.push(data.spo2);
      }
      if (data.temperature) {
        dataByDate[dateKey].temperature.push(data.temperature);
      }
    }
  });
  
  // Tính toán các giá trị trung bình và kiểm tra cảnh báo dựa trên giá trị trung bình
  Object.keys(dataByDate).forEach(dateKey => {
    const dayData = dataByDate[dateKey];
    dayData.avgHeartRate = dayData.heartRate.length > 0
      ? (dayData.heartRate.reduce((a, b) => a + b, 0) / dayData.heartRate.length).toFixed(1)
      : null;
    dayData.avgSpo2 = dayData.spo2.length > 0
      ? (dayData.spo2.reduce((a, b) => a + b, 0) / dayData.spo2.length).toFixed(1)
      : null;
    dayData.avgTemperature = dayData.temperature.length > 0
      ? (dayData.temperature.reduce((a, b) => a + b, 0) / dayData.temperature.length).toFixed(1)
      : null;
    
    // Kiểm tra cảnh báo dựa trên giá trị trung bình (chính xác hơn)
    // Reset các flag cảnh báo
    dayData.hasWarning = false;
    dayData.hasDanger = false;
    
    // Kiểm tra nhịp tim trung bình
    if (dayData.avgHeartRate) {
      const avgHR = parseFloat(dayData.avgHeartRate);
      // Danger: nhịp tim quá thấp hoặc quá cao (nguy hiểm)
      if (avgHR < 50 || avgHR > 120) {
        dayData.hasDanger = true;
      }
      // Warning: nhịp tim hơi bất thường (cảnh báo)
      else if (avgHR < 60 || avgHR > 100) {
        dayData.hasWarning = true;
      }
    }
    
    // Kiểm tra SpO2 trung bình
    if (dayData.avgSpo2) {
      const avgSpo2 = parseFloat(dayData.avgSpo2);
      // Danger: SpO2 quá thấp (nguy hiểm)
      if (avgSpo2 < 90) {
        dayData.hasDanger = true;
      }
      // Warning: SpO2 hơi thấp (cảnh báo)
      else if (avgSpo2 < 95) {
        dayData.hasWarning = true;
      }
    }
    
    // Lưu ý: Nhiệt độ ở đây là nhiệt độ môi trường, không phải nhiệt độ cơ thể
    // Do đó không cần kiểm tra cảnh báo cho nhiệt độ
  });
  
  // Lấy ngày đầu tiên của tháng
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  // Lấy ngày đầu tiên hiển thị (có thể là ngày cuối tháng trước)
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Đưa về Chủ nhật
  
  // Tạo mảng các ngày trong lịch
  const days = [];
  const current = new Date(startDate);
  const endDate = new Date(lastDayOfMonth);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // Đưa về thứ 7 cuối cùng
  
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  // Chuyển tháng
  const changeMonth = (direction) => {
    setCurrentDate(new Date(year, month + direction, 1));
  };
  
  // Chuyển về tháng hiện tại
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Kiểm tra xem ngày có phải hôm nay không
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };
  
  // Kiểm tra xem ngày có thuộc tháng hiện tại không
  const isCurrentMonth = (date) => {
    return date.getMonth() === month;
  };
  
  // Lấy class cho ngày
  const getDayClass = (date) => {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayData = dataByDate[dateKey];
    
    let classes = 'calendar-day';
    
    if (!isCurrentMonth(date)) {
      classes += ' other-month';
    }
    
    if (isToday(date)) {
      classes += ' today';
    }
    
    if (dayData) {
      classes += ' has-data';
      if (dayData.hasDanger) {
        classes += ' danger';
      } else if (dayData.hasWarning) {
        classes += ' warning';
      } else {
        classes += ' normal';
      }
    }
    
    return classes;
  };
  
  // Xử lý click vào ngày
  const handleDayClick = (date) => {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (dataByDate[dateKey] && onDateClick) {
      onDateClick(dateKey);
    }
  };
  
  // Lấy tooltip text
  const getTooltip = (date) => {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayData = dataByDate[dateKey];
    
    if (!dayData) return null;
    
    return `${dayData.count} lần đo | HR: ${dayData.avgHeartRate || 'N/A'} BPM | SpO2: ${dayData.avgSpo2 || 'N/A'}%`;
  };
  
  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 
                      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  
  return (
    <div className="health-calendar">
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={() => changeMonth(-1)}>
          ‹
        </button>
        <div className="calendar-month-year">
          <h3>{monthNames[month]} {year}</h3>
          <button className="today-btn" onClick={goToToday}>
            Hôm nay
          </button>
        </div>
        <button className="calendar-nav-btn" onClick={() => changeMonth(1)}>
          ›
        </button>
      </div>
      
      <div className="calendar-grid">
        {/* Header các ngày trong tuần */}
        {dayNames.map(day => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}
        
        {/* Các ngày trong tháng */}
        {days.map((date, index) => {
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const dayData = dataByDate[dateKey];
          
          return (
            <div
              key={index}
              className={getDayClass(date)}
              onClick={() => handleDayClick(date)}
              title={getTooltip(date)}
            >
              <span className="day-number">{date.getDate()}</span>
              {dayData && (
                <div className="day-indicator">
                  <span className="day-count">{dayData.count}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-color normal"></span>
          <span>Bình thường</span>
        </div>
        <div className="legend-item">
          <span className="legend-color warning"></span>
          <span>Cảnh báo</span>
        </div>
        <div className="legend-item">
          <span className="legend-color danger"></span>
          <span>Nguy hiểm</span>
        </div>
        <div className="legend-item">
          <span className="legend-color no-data"></span>
          <span>Không có dữ liệu</span>
        </div>
      </div>
    </div>
  );
}

export default HealthCalendar;

