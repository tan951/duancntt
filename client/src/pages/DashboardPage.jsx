import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socketService';
import { authUtils } from '../utils/authUtils';
import HealthCharts from '../components/charts/HealthCharts';
import HealthCalendar from '../components/health/HealthCalendar';
import './DashboardPage.css';

function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [devices, setDevices] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [healthData, setHealthData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Khôi phục activeTab từ localStorage hoặc mặc định là 'charts'
  const [activeTab, setActiveTabState] = useState(() => {
    const savedTab = localStorage.getItem('dashboardActiveTab');
    return savedTab || 'charts';
  });

  // Wrapper function để lưu activeTab vào localStorage khi thay đổi
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    localStorage.setItem('dashboardActiveTab', tab);
  };

  // Lưu healthViewMode vào localStorage khi thay đổi
  const handleViewModeChange = async (mode) => {
    const previousMode = healthViewMode;
    setHealthViewMode(mode);
    localStorage.setItem('healthViewMode', mode);
    
    // Nếu chuyển từ table sang calendar, reload tất cả dữ liệu để đảm bảo có dữ liệu mới nhất
    if (previousMode === 'table' && mode === 'calendar') {
      console.log('📅 Switching to calendar view: Reloading all data');
      try {
        setLoading(true);
        const healthParams = { 
          patient: user.id || user._id,
          limit: 50000 // Load tất cả dữ liệu cho calendar
        };
        const healthResponse = await apiService.getHealthData(healthParams);
        setHealthData(healthResponse.data || []);
      } catch (err) {
        console.error('Error reloading data for calendar view:', err);
        setError(err.message || 'Lỗi khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    }
  };

  // Xử lý click vào ngày trong calendar
  const handleCalendarDateClick = async (dateKey) => {
    console.log('📅 Calendar date clicked:', dateKey);
    setSelectedDate(dateKey);
    // Chuyển sang table view và filter theo ngày đã chọn
    handleViewModeChange('table');
    
    // Set filter
    const newFilters = {
      ...filters,
      startDate: dateKey,
      endDate: dateKey
    };
    setFilters(newFilters);
    
    // Load lại dữ liệu từ API với filter theo ngày để đảm bảo có dữ liệu
    // Quan trọng: endDate phải là cuối ngày (23:59:59) để lấy hết dữ liệu trong ngày
    try {
      setLoading(true);
      
      // Tạo endDate với thời gian cuối ngày (23:59:59.999)
      const endDateObj = new Date(dateKey);
      endDateObj.setHours(23, 59, 59, 999);
      const endDateISO = endDateObj.toISOString().split('T')[0] + 'T23:59:59.999Z';
      
      const params = {
        patient: user.id || user._id,
        startDate: dateKey, // Format: YYYY-MM-DD (sẽ là 00:00:00)
        endDate: endDateISO, // Format: YYYY-MM-DDTHH:mm:ss.sssZ (23:59:59.999)
        limit: 10000 // Load đủ dữ liệu cho ngày đó
      };
      
      console.log('📅 Loading data with params:', params);
      const healthResponse = await apiService.getHealthData(params);
      console.log('📅 Loaded data count:', healthResponse.data?.length || 0);
      setHealthData(healthResponse.data || []);
      setCurrentHealthPage(1);
    } catch (err) {
      console.error('❌ Error loading health data with date filter:', err);
      setError(err.message || 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const [realTimeData, setRealTimeData] = useState(null);
  const chartsRef = useRef(null);
  const sessionsRef = useRef([]); // Ref để lưu sessions cho socket listener
  
  // Pagination state cho sessions
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Số sessions hiển thị mỗi trang
  
  // Pagination state cho health data
  const [currentHealthPage, setCurrentHealthPage] = useState(1);
  const healthItemsPerPage = 10; // Số health data hiển thị mỗi trang

  // State cho xuất file với khoảng thời gian
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // State cho filter dữ liệu sức khỏe
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    heartRateMin: '',
    heartRateMax: '',
    spo2Min: '',
    spo2Max: '',
    temperatureMin: '',
    temperatureMax: '',
    activityStatus: '',
    deviceId: ''
  });

  // State cho sắp xếp dữ liệu sức khỏe
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' hoặc 'oldest'

  // State cho view mode của health data (table hoặc calendar)
  const [healthViewMode, setHealthViewMode] = useState(() => {
    const savedMode = localStorage.getItem('healthViewMode');
    return savedMode || 'table';
  });
  
  // State cho ngày được chọn trong calendar
  const [selectedDate, setSelectedDate] = useState(null);
  
  // State cho cảnh báo sức khỏe (hiển thị trong charts section)
  const [healthAlerts, setHealthAlerts] = useState([]);
  const alertTimeoutsRef = useRef(new Map()); // Lưu timeout IDs cho mỗi cảnh báo
  const deviceIssueAlertIdRef = useRef(null); // Lưu ID của cảnh báo thiết bị (không tự động tắt)

  // State cho filter thống kê
  const [statsFilters, setStatsFilters] = useState({
    startDate: '',
    endDate: '',
    deviceId: ''
  });
  const [loadingStats, setLoadingStats] = useState(false);
  // State để lưu ngày mới nhất có dữ liệu (từ API)
  const [maxHealthDataDate, setMaxHealthDataDate] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    // Load dữ liệu ban đầu dựa trên view mode đã lưu
    const savedViewMode = localStorage.getItem('healthViewMode') || 'table';
    loadData(savedViewMode === 'calendar');
    
    // Reset về trang 1 khi chuyển tab
    setCurrentPage(1);
    setCurrentHealthPage(1);

    // Kết nối Socket.IO để nhận dữ liệu real-time
    const token = authUtils.getAuthToken();
    if (token) {
      socketService.connect(token);

      // Lắng nghe dữ liệu sức khỏe mới
      socketService.on('healthData:new', async (newHealthData) => {
        // Kiểm tra nếu dữ liệu thuộc về user hiện tại
        if (newHealthData.patient && (newHealthData.patient._id === user?.id || newHealthData.patient === user?.id)) {
          setRealTimeData(newHealthData);
          
          // Kiểm tra giá trị bất thường và hiển thị cảnh báo khi đang đo (có session active)
          const activeSession = sessionsRef.current.find(session => session.active === true);
          
          // Chỉ cảnh báo khi đang đo (có session active)
          if (activeSession) {
            checkAbnormalValues(newHealthData);
          }
          
          // Cập nhật maxHealthDataDate nếu dữ liệu mới có ngày mới hơn
          // Sử dụng hàm helper để đảm bảo logic nhất quán
          if (newHealthData.timestamp) {
            updateMaxHealthDataDate([newHealthData]);
          }
          
          // Nếu đang ở calendar view, reload lại tất cả dữ liệu để đảm bảo calendar cập nhật
          const savedViewMode = localStorage.getItem('healthViewMode') || 'table';
          if (savedViewMode === 'calendar') {
            console.log('📅 Calendar view: Reloading all data for new health data');
            // Reload tất cả dữ liệu để calendar cập nhật
            try {
              const healthParams = { 
                patient: user.id || user._id,
                limit: 50000 // Load tất cả dữ liệu cho calendar
              };
              const healthResponse = await apiService.getHealthData(healthParams);
              setHealthData(healthResponse.data || []);
            } catch (err) {
              console.error('Error reloading health data for calendar:', err);
              // Fallback: thêm dữ liệu mới vào state
              setHealthData((prevData) => {
                // Kiểm tra xem dữ liệu đã tồn tại chưa (tránh duplicate)
                const exists = prevData.some(d => d._id === newHealthData._id || 
                  (d.timestamp === newHealthData.timestamp && d.deviceId === newHealthData.deviceId));
                if (exists) return prevData;
                return [newHealthData, ...prevData];
              });
            }
          } else {
            // Table view: chỉ thêm dữ liệu mới vào đầu mảng
            setHealthData((prevData) => {
              // Kiểm tra xem dữ liệu đã tồn tại chưa (tránh duplicate)
              const exists = prevData.some(d => d._id === newHealthData._id || 
                (d.timestamp === newHealthData.timestamp && d.deviceId === newHealthData.deviceId));
              if (exists) return prevData;
              
              // Thêm dữ liệu mới vào đầu mảng và giới hạn 100 phần tử (10 trang)
              const updated = [newHealthData, ...prevData];
              return updated.slice(0, 100);
            });
          }
        }
      });

      // Lắng nghe khi session được tạo hoặc kết thúc
      socketService.on('session:created', async (data) => {
        // Reload sessions để cập nhật UI
        try {
          const sessionsResponse = await apiService.getSessions({ userId: user.id || user._id });
          setSessions(sessionsResponse.data || []);
        } catch (err) {
          console.error('Error reloading sessions:', err);
        }
      });

      socketService.on('session:ended', async (data) => {
        // Reload sessions để cập nhật UI
        try {
          const sessionsResponse = await apiService.getSessions({ userId: user.id || user._id });
          setSessions(sessionsResponse.data || []);
        } catch (err) {
          console.error('Error reloading sessions:', err);
        }
      });

      return () => {
        socketService.off('healthData:new');
        socketService.off('session:created');
        socketService.off('session:ended');
      };
    }
  }, [navigate, isAuthenticated, user]);

  // Tự động load stats khi chuyển sang tab stats (chỉ một lần)
  useEffect(() => {
    if (activeTab === 'stats' && user && isAuthenticated && !loadingStats && !stats) {
      console.log('📊 Auto-loading stats when switching to stats tab');
      loadStats(statsFilters);
    }
  }, [activeTab]);

  // Hàm kiểm tra giá trị bất thường và hiển thị cảnh báo
  const checkAbnormalValues = (healthData) => {
    const warnings = [];
    
    // Kiểm tra đặc biệt: nếu cả nhịp tim và SpO2 đều bằng 0
    if ((healthData.heartRate === 0 || healthData.heartRate === undefined || healthData.heartRate === null) &&
        (healthData.spo2 === 0 || healthData.spo2 === undefined || healthData.spo2 === null)) {
      // Nếu chưa có cảnh báo thiết bị, thêm vào (không có timeout - hiển thị liên tục)
      if (!deviceIssueAlertIdRef.current) {
        const alertId = `device-issue-${Date.now()}`;
        deviceIssueAlertIdRef.current = alertId;
        const alertMessage = '⚠️ Cảnh báo: Kiểm tra ngón tay hoặc vấn đề thiết bị';
        
        // Thêm cảnh báo vào danh sách (không có timeout)
        setHealthAlerts(prev => {
          // Kiểm tra xem cảnh báo đã tồn tại chưa
          if (prev.some(a => a.id === alertId)) {
            return prev;
          }
          return [...prev, { id: alertId, message: alertMessage, type: 'error' }];
        });
      }
      return; // Dừng lại, không kiểm tra các giá trị khác
    } else {
      // Nếu giá trị không còn bằng 0, xóa cảnh báo thiết bị nếu có
      if (deviceIssueAlertIdRef.current) {
        const alertId = deviceIssueAlertIdRef.current;
        setHealthAlerts(prev => prev.filter(a => a.id !== alertId));
        deviceIssueAlertIdRef.current = null;
      }
    }
    
    // Kiểm tra nhịp tim
    // Bỏ qua: 0-30 BPM
    // Đỏ (error): 30-40 BPM, >130 BPM
    // Vàng (warning): 40-60 BPM, 100-130 BPM
    if (healthData.heartRate !== undefined && healthData.heartRate !== null && healthData.heartRate > 30) {
      if (healthData.heartRate >= 30 && healthData.heartRate <= 40) {
        warnings.push({
          type: 'error',
          message: `⚠️ Cảnh báo: Nhịp tim thấp (${healthData.heartRate} BPM). Giá trị bình thường: 60-100 BPM.`
        });
      } else if (healthData.heartRate > 40 && healthData.heartRate < 60) {
        warnings.push({
          type: 'warning',
          message: `⚠️ Cảnh báo: Nhịp tim thấp (${healthData.heartRate} BPM). Giá trị bình thường: 60-100 BPM.`
        });
      } else if (healthData.heartRate > 130) {
        warnings.push({
          type: 'error',
          message: `⚠️ Cảnh báo: Nhịp tim rất cao (${healthData.heartRate} BPM). Giá trị bình thường: 60-100 BPM.`
        });
      } else if (healthData.heartRate > 100 && healthData.heartRate <= 130) {
        warnings.push({
          type: 'warning',
          message: `⚠️ Cảnh báo: Nhịp tim hơi cao (${healthData.heartRate} BPM). Giá trị bình thường: 60-100 BPM.`
        });
      }
    }
    
    // Kiểm tra SpO2
    // Đỏ (error): < 90%
    // Vàng (warning): 90-95%
    if (healthData.spo2 !== undefined && healthData.spo2 !== null) {
      if (healthData.spo2 < 90) {
        warnings.push({
          type: 'error',
          message: `🚨 Khẩn cấp: Nồng độ oxy trong máu rất thấp (${healthData.spo2}%). Vui lòng tham khảo ý kiến bác sĩ ngay!`
        });
      } else if (healthData.spo2 >= 90 && healthData.spo2 < 95) {
        warnings.push({
          type: 'warning',
          message: `⚠️ Cảnh báo: Nồng độ oxy trong máu thấp (${healthData.spo2}%). Giá trị bình thường: ≥ 95%.`
        });
      }
    }
    
    // Kiểm tra nhiệt độ môi trường
    // Bình thường: 20-30°C
    // Quá lạnh: < 10°C
    // Quá nóng: > 40°C
    if (healthData.temperature !== undefined && healthData.temperature !== null) {
      if (healthData.temperature < 10) {
        warnings.push({
          type: 'error',
          message: `⚠️ Cảnh báo: Nhiệt độ môi trường quá thấp (${healthData.temperature.toFixed(1)}°C). Nhiệt độ bình thường: 20-30°C.`
        });
      } else if (healthData.temperature > 40) {
        warnings.push({
          type: 'error',
          message: `⚠️ Cảnh báo: Nhiệt độ môi trường quá cao (${healthData.temperature.toFixed(1)}°C). Nhiệt độ bình thường: 20-30°C.`
        });
      }
    }
    
    // Lưu cảnh báo vào state để hiển thị trong UI (kiểu ngăn xếp)
    if (warnings.length > 0) {
      // Thêm từng cảnh báo mới vào danh sách với timeout riêng
      warnings.forEach((warning, index) => {
        const alertId = `${Date.now()}-${index}-${Math.random()}`;
        
        // Thêm cảnh báo vào danh sách (bao gồm type)
        setHealthAlerts(prev => [...prev, { id: alertId, message: warning.message, type: warning.type || 'error' }]);
        
        // Tự động xóa cảnh báo sau 3 giây
        const timeoutId = setTimeout(() => {
          setHealthAlerts(prev => prev.filter(a => a.id !== alertId));
          alertTimeoutsRef.current.delete(alertId);
        }, 3000);
        
        // Lưu timeout ID
        alertTimeoutsRef.current.set(alertId, timeoutId);
      });
    }
  };

  // Hàm helper để cập nhật maxHealthDataDate từ dữ liệu
  const updateMaxHealthDataDate = (dataArray) => {
    if (!dataArray || dataArray.length === 0) return;
    
    // Tìm ngày mới nhất từ dữ liệu (dùng local date để match với date picker)
    let latestDate = null;
    dataArray.forEach(item => {
      if (item.timestamp) {
        const date = new Date(item.timestamp);
        // Dùng local date để tạo dateKey (YYYY-MM-DD) theo local timezone
        // Điều này đảm bảo match với date picker input
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!latestDate || dateKey > latestDate) {
          latestDate = dateKey;
        }
      }
    });
    
    if (latestDate) {
      setMaxHealthDataDate(prevMaxDate => {
        if (!prevMaxDate || latestDate > prevMaxDate) {
          console.log('📅 Updated max health data date to:', latestDate);
          return latestDate;
        }
        return prevMaxDate;
      });
    }
  };

  // Load ngày mới nhất có dữ liệu từ API khi chuyển sang tab stats
  useEffect(() => {
    const loadMaxDate = async () => {
      if (activeTab === 'stats' && user && isAuthenticated) {
        try {
          // Load 100 bản ghi mới nhất để tìm ngày mới nhất
          const params = {
            patient: user.id || user._id,
            limit: 100
          };
          const response = await apiService.getHealthData(params);
          if (response.data && response.data.length > 0) {
            updateMaxHealthDataDate(response.data);
          } else {
            // Fallback: dùng từ healthData state nếu có
            updateMaxHealthDataDate(healthData);
          }
        } catch (err) {
          console.error('Error loading max date:', err);
          // Fallback: dùng từ healthData state nếu có
          updateMaxHealthDataDate(healthData);
        }
      }
    };
    
    loadMaxDate();
  }, [activeTab, user, isAuthenticated]);

  // Cập nhật sessionsRef mỗi khi sessions state thay đổi
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Cập nhật maxHealthDataDate khi healthData thay đổi (bao gồm cả dữ liệu mới từ socket)
  useEffect(() => {
    if (healthData.length > 0) {
      updateMaxHealthDataDate(healthData);
    }
  }, [healthData.length]);

  // Tự động load dữ liệu phù hợp khi chuyển đổi view mode
  useEffect(() => {
    if (activeTab === 'health' && user && isAuthenticated && !loading) {
      if (healthViewMode === 'calendar') {
        // Calendar view: Load tất cả dữ liệu
        // Chỉ load nếu chưa có dữ liệu hoặc có ít hơn 100 bản ghi (có thể chỉ load 100 bản ghi đầu)
        if (healthData.length === 0 || healthData.length <= 100) {
          console.log('📅 Loading all data for calendar view');
          loadData(true); // loadAll = true để load tất cả dữ liệu
        }
      } else if (healthViewMode === 'table') {
        // Table view: Chỉ load 5-10 trang (50-100 bản ghi với 10 items/page)
        // Chỉ load nếu đang có quá nhiều dữ liệu (có thể từ calendar view)
        if (healthData.length > 100) {
          console.log('📋 Loading limited data for table view (5-10 pages)');
          loadData(false); // loadAll = false để chỉ load 100 bản ghi
        }
      }
    }
  }, [activeTab, healthViewMode]);

  const loadData = async (loadAll = false) => {
    try {
      setLoading(true);
      
      // Nếu loadAll = true, load tất cả dữ liệu (limit rất lớn) - cho calendar view
      // Nếu không, chỉ load 100 bản ghi (10 trang) - cho table view
      const healthParams = { 
        patient: user.id || user._id,
        limit: loadAll ? 50000 : 100 // Calendar: tất cả, Table: 10 trang (100 items với 10 items/page)
      };
      
      // Chạy song song tất cả API calls để nhanh hơn
      const [devicesResponse, sessionsResponse, healthResponse] = await Promise.all([
        apiService.getDevicesByUserId(user.id || user._id),
        apiService.getSessions({ userId: user.id || user._id }), // Lấy tất cả sessions, không chỉ active
        apiService.getHealthData(healthParams)
      ]);

      setDevices(devicesResponse.data || []);
      setSessions(sessionsResponse.data || []);
      setHealthData(healthResponse.data || []);
      
      // Load stats với filter hiện tại
      await loadStats(statsFilters);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message || 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Load thống kê với filter
  const loadStats = async (filters = {}) => {
    try {
      setLoadingStats(true);
      const params = {
        patientId: user.id || user._id
      };
      
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.deviceId) params.deviceId = filters.deviceId;
      
      console.log('📊 Loading stats with params:', params);
      const statsResponse = await apiService.getHealthStatistics(params);
      console.log('📊 Stats response:', statsResponse);
      console.log('📊 Stats response type:', typeof statsResponse);
      console.log('📊 Stats response keys:', statsResponse ? Object.keys(statsResponse) : 'null');
      
      // apiRequest trả về data trực tiếp, không phải { data: ... }
      // Nếu response có structure { success: true, data: {...} }, thì lấy data
      // Nếu response là data trực tiếp, dùng luôn
      let statsData = null;
      
      if (statsResponse) {
        if (statsResponse.data && typeof statsResponse.data === 'object') {
          // Trường hợp { success: true, data: {...} }
          statsData = statsResponse.data;
        } else if (statsResponse.avgHeartRate !== undefined || statsResponse.count !== undefined) {
          // Trường hợp data trực tiếp
          statsData = statsResponse;
        }
      }
      
      if (statsData) {
        console.log('📊 Setting stats:', statsData);
        setStats(statsData);
      } else {
        console.warn('📊 No stats data, setting default');
        // Nếu không có data, set về object mặc định với count = 0
        setStats({
          avgHeartRate: 0,
          minHeartRate: 0,
          maxHeartRate: 0,
          avgSpo2: 0,
          minSpo2: 0,
          maxSpo2: 0,
          avgTemperature: 0,
          minTemperature: 0,
          maxTemperature: 0,
          count: 0
        });
      }
    } catch (err) {
      console.error('❌ Error loading stats:', err);
      console.error('❌ Error details:', err.response?.data || err.message);
      setError(err.message || 'Lỗi khi tải thống kê');
      // Khi có lỗi, vẫn set stats về object mặc định để UI không bị lỗi
      setStats({
        avgHeartRate: 0,
        minHeartRate: 0,
        maxHeartRate: 0,
        avgSpo2: 0,
        minSpo2: 0,
        maxSpo2: 0,
        avgTemperature: 0,
        minTemperature: 0,
        maxTemperature: 0,
        count: 0
      });
    } finally {
      setLoadingStats(false);
    }
  };

  // Load dữ liệu theo filter từ API
  const handleApplyFilters = async () => {
    try {
      setLoading(true);
      const params = {
        patient: user.id || user._id,
        limit: 10000 // Load nhiều để đảm bảo có đủ dữ liệu
      };
      
      if (filters.startDate) {
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        // Đảm bảo endDate bao gồm cả ngày cuối cùng
        // Nếu filters.endDate là format YYYY-MM-DD, giữ nguyên format đó
        // Backend sẽ tự động xử lý để set về cuối ngày (23:59:59.999)
        // Gửi format YYYY-MM-DD để backend xử lý đúng timezone
        params.endDate = filters.endDate;
      }

      console.log('🔍 Applying filters with params:', params);
      const healthResponse = await apiService.getHealthData(params);
      console.log('🔍 Loaded filtered data count:', healthResponse.data?.length || 0);
      setHealthData(healthResponse.data || []);
      setCurrentHealthPage(1); // Reset về trang 1
      setShowFilterModal(false); // Đóng modal sau khi áp dụng
    } catch (err) {
      console.error('Error loading health data with filters:', err);
      setError(err.message || 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFilterModal = () => {
    // Tự động set ngày bắt đầu và kết thúc nếu có dữ liệu
    const { minDate, maxDate } = getHealthDataDateRange();
    if (minDate && maxDate && !filters.startDate && !filters.endDate) {
      setFilters({
        ...filters,
        startDate: minDate,
        endDate: maxDate
      });
    }
    setShowFilterModal(true);
  };

  const handleCloseFilterModal = () => {
    setShowFilterModal(false);
  };

  const handleLogout = () => {
    // Xóa activeTab khỏi localStorage khi logout
    localStorage.removeItem('dashboardActiveTab');
    logout();
    navigate('/login');
  };

  const handleCreateSession = async (deviceId) => {
    try {
      await apiService.createSession({
        deviceId,
        userId: user.id,
      });
      // Reload data để cập nhật UI
      await loadData();
      // Tự động chuyển sang tab biểu đồ
      setActiveTab('charts');
      // UI sẽ tự động hiển thị button "Kết Thúc Đo"
    } catch (err) {
      console.error('Lỗi khi tạo phiên đo:', err);
      setError(err.message || 'Lỗi khi tạo phiên đo');
    }
  };

  const handleEndSession = async (sessionId) => {
    try {
      await apiService.endSession(sessionId);
      // Reload data để cập nhật UI
      await loadData();
      // Reset về trang 1 sau khi kết thúc session
      setCurrentPage(1);
      // UI sẽ tự động hiển thị button "Bắt Đầu Đo"
    } catch (err) {
      console.error('Lỗi khi kết thúc phiên đo:', err);
      setError(err.message || 'Lỗi khi kết thúc phiên đo');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const handleExportHealthData = () => {
    if (healthData.length === 0) {
      setError('Không có dữ liệu để xuất');
      return;
    }

    // Bắt buộc phải chọn khoảng thời gian
    if (!exportStartDate && !exportEndDate) {
      setError('Vui lòng chọn khoảng thời gian để xuất dữ liệu');
      return;
    }

    // Lọc dữ liệu theo khoảng thời gian đã chọn
    const filteredData = healthData.filter(data => {
      if (!data.timestamp) return false;
      
      const dataDate = new Date(data.timestamp);
      dataDate.setHours(0, 0, 0, 0);
      
      if (exportStartDate) {
        const startDate = new Date(exportStartDate);
        startDate.setHours(0, 0, 0, 0);
        if (dataDate < startDate) return false;
      }
      
      if (exportEndDate) {
        const endDate = new Date(exportEndDate);
        endDate.setHours(23, 59, 59, 999);
        if (dataDate > endDate) return false;
      }
      
      return true;
    });

    if (filteredData.length === 0) {
      setError('Không có dữ liệu trong khoảng thời gian đã chọn');
      setShowExportModal(false);
      return;
    }

    try {
      // Tạo header CSV
      const headers = ['Thời gian', 'Nhịp tim (BPM)', 'SpO2 (%)', 'Nhiệt độ (°C)', 'Áp suất (Pa)', 'Trạng thái', 'Thiết bị'];
      
      // Chuyển đổi dữ liệu thành CSV
      const csvRows = [
        headers.join(','), // Header row
        ...filteredData.map(data => {
          const activityStatus = data.activityStatus === 'IDLE' ? 'Nghỉ ngơi' :
                                data.activityStatus === 'WALKING' ? 'Đi bộ' :
                                data.activityStatus === 'RUNNING' ? 'Chạy' :
                                data.activityStatus === 'IMPACT' ? 'Tác động' : 'Không xác định';
          
          return [
            formatDate(data.timestamp),
            data.heartRate || '',
            data.spo2 || '',
            data.temperature || '',
            data.pressure ? data.pressure.toFixed(2) : '',
            activityStatus,
            data.deviceId || ''
          ].map(field => {
            // Escape commas và quotes trong dữ liệu
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
              return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
          }).join(',');
        })
      ];

      // Tạo nội dung CSV
      const csvContent = csvRows.join('\n');
      
      // Tạo BOM cho UTF-8 để Excel hiển thị tiếng Việt đúng
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Tạo link download
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Tạo tên file với timestamp và khoảng thời gian
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      let fileName = `du_lieu_suc_khoe_${timestamp}`;
      if (exportStartDate || exportEndDate) {
        const startStr = exportStartDate ? exportStartDate.replace(/-/g, '') : 'all';
        const endStr = exportEndDate ? exportEndDate.replace(/-/g, '') : 'all';
        fileName = `du_lieu_suc_khoe_${startStr}_${endStr}_${timestamp}`;
      }
      link.setAttribute('download', `${fileName}.csv`);
      
      // Trigger download
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(url);
      
      // Đóng modal và reset
      setShowExportModal(false);
      setExportStartDate('');
      setExportEndDate('');
    } catch (err) {
      console.error('Lỗi khi xuất file:', err);
      setError('Lỗi khi xuất file: ' + err.message);
    }
  };

  const handleOpenExportModal = () => {
    // Tự động set ngày bắt đầu là ngày đầu tiên có dữ liệu và ngày kết thúc là ngày cuối cùng có dữ liệu
    const { minDate, maxDate } = getDataDateRange();
    if (minDate && maxDate) {
      setExportStartDate(minDate);
      setExportEndDate(maxDate);
    }
    setShowExportModal(true);
  };

  const handleCloseExportModal = () => {
    setShowExportModal(false);
    setExportStartDate('');
    setExportEndDate('');
  };

  const handleExportAllHealthData = () => {
    if (healthData.length === 0) {
      setError('Không có dữ liệu để xuất');
      return;
    }

    try {
      // Tạo header CSV
      const headers = ['Thời gian', 'Nhịp tim (BPM)', 'SpO2 (%)', 'Nhiệt độ (°C)', 'Áp suất (Pa)', 'Trạng thái', 'Thiết bị'];
      
      // Chuyển đổi tất cả dữ liệu thành CSV
      const csvRows = [
        headers.join(','), // Header row
        ...healthData.map(data => {
          const activityStatus = data.activityStatus === 'IDLE' ? 'Nghỉ ngơi' :
                                data.activityStatus === 'WALKING' ? 'Đi bộ' :
                                data.activityStatus === 'RUNNING' ? 'Chạy' :
                                data.activityStatus === 'IMPACT' ? 'Tác động' : 'Không xác định';
          
          return [
            formatDate(data.timestamp),
            data.heartRate || '',
            data.spo2 || '',
            data.temperature || '',
            data.pressure ? data.pressure.toFixed(2) : '',
            activityStatus,
            data.deviceId || ''
          ].map(field => {
            // Escape commas và quotes trong dữ liệu
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
              return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
          }).join(',');
        })
      ];

      // Tạo nội dung CSV
      const csvContent = csvRows.join('\n');
      
      // Tạo BOM cho UTF-8 để Excel hiển thị tiếng Việt đúng
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Tạo link download
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Tạo tên file với timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.setAttribute('download', `du_lieu_suc_khoe_tat_ca_${timestamp}.csv`);
      
      // Trigger download
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(url);
      
      // Đóng modal và reset
      setShowExportModal(false);
      setExportStartDate('');
      setExportEndDate('');
    } catch (err) {
      console.error('Lỗi khi xuất file:', err);
      setError('Lỗi khi xuất file: ' + err.message);
    }
  };

  // Lấy ngày đầu tiên và ngày cuối cùng từ dữ liệu
  const getDataDateRange = () => {
    if (healthData.length === 0) {
      return { minDate: null, maxDate: null };
    }
    
    const dates = healthData
      .map(d => d.timestamp ? new Date(d.timestamp) : null)
      .filter(d => d !== null)
      .sort((a, b) => a - b);
    
    if (dates.length === 0) {
      return { minDate: null, maxDate: null };
    }
    
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    
    return {
      minDate: minDate.toISOString().split('T')[0],
      maxDate: maxDate.toISOString().split('T')[0]
    };
  };

  // Format ngày theo định dạng dd/mm
  const formatDateShort = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  // Tính số lượng bản ghi sẽ được xuất
  const getFilteredDataCount = () => {
    // Bắt buộc phải chọn khoảng thời gian
    if (!exportStartDate && !exportEndDate) {
      return 0;
    }
    
    return healthData.filter(data => {
      if (!data.timestamp) return false;
      
      const dataDate = new Date(data.timestamp);
      dataDate.setHours(0, 0, 0, 0);
      
      if (exportStartDate) {
        const startDate = new Date(exportStartDate);
        startDate.setHours(0, 0, 0, 0);
        if (dataDate < startDate) return false;
      }
      
      if (exportEndDate) {
        const endDate = new Date(exportEndDate);
        endDate.setHours(23, 59, 59, 999);
        if (dataDate > endDate) return false;
      }
      
      return true;
    }).length;
  };

  // Lấy chuỗi mô tả khoảng thời gian
  const getDateRangeText = () => {
    if (!exportStartDate && !exportEndDate) {
      return 'tất cả';
    }
    
    if (exportStartDate && exportEndDate) {
      return `từ ${formatDateShort(exportStartDate)} đến ${formatDateShort(exportEndDate)}`;
    }
    
    if (exportStartDate) {
      return `từ ${formatDateShort(exportStartDate)}`;
    }
    
    if (exportEndDate) {
      return `đến ${formatDateShort(exportEndDate)}`;
    }
    
    return 'tất cả';
  };

  // Lọc và sắp xếp dữ liệu sức khỏe
  const getFilteredHealthData = () => {
    let filtered = [...healthData];

    // Lọc theo khoảng thời gian - So sánh bằng string để tránh timezone issues
    if (filters.startDate || filters.endDate) {
      filtered = filtered.filter(data => {
        if (!data.timestamp) return false;
        
        // Parse date từ timestamp và chuyển thành string YYYY-MM-DD
        const dataDate = new Date(data.timestamp);
        const dataDateStr = `${dataDate.getFullYear()}-${String(dataDate.getMonth() + 1).padStart(2, '0')}-${String(dataDate.getDate()).padStart(2, '0')}`;
        
        // So sánh string date để chính xác hơn, tránh timezone issues
        if (filters.startDate && dataDateStr < filters.startDate) {
          return false;
        }
        if (filters.endDate && dataDateStr > filters.endDate) {
          return false;
        }
        
        return true;
      });
    }

    // Lọc theo nhịp tim
    if (filters.heartRateMin) {
      filtered = filtered.filter(data => data.heartRate >= parseFloat(filters.heartRateMin));
    }
    if (filters.heartRateMax) {
      filtered = filtered.filter(data => data.heartRate <= parseFloat(filters.heartRateMax));
    }

    // Lọc theo SpO2
    if (filters.spo2Min) {
      filtered = filtered.filter(data => data.spo2 >= parseFloat(filters.spo2Min));
    }
    if (filters.spo2Max) {
      filtered = filtered.filter(data => data.spo2 <= parseFloat(filters.spo2Max));
    }

    // Lọc theo nhiệt độ
    if (filters.temperatureMin) {
      filtered = filtered.filter(data => data.temperature >= parseFloat(filters.temperatureMin));
    }
    if (filters.temperatureMax) {
      filtered = filtered.filter(data => data.temperature <= parseFloat(filters.temperatureMax));
    }

    // Lọc theo trạng thái hoạt động
    if (filters.activityStatus) {
      filtered = filtered.filter(data => data.activityStatus === filters.activityStatus);
    }

    // Lọc theo thiết bị
    if (filters.deviceId) {
      filtered = filtered.filter(data => data.deviceId === filters.deviceId);
    }

    // Sắp xếp theo thời gian
    filtered.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      
      if (sortOrder === 'newest') {
        return timeB - timeA; // Mới nhất trước
      } else {
        return timeA - timeB; // Cũ nhất trước
      }
    });

    return filtered;
  };

  // Reset filters và reload tất cả dữ liệu
  const resetFilters = async () => {
    // Reset filter state
    setFilters({
      startDate: '',
      endDate: '',
      heartRateMin: '',
      heartRateMax: '',
      spo2Min: '',
      spo2Max: '',
      temperatureMin: '',
      temperatureMax: '',
      activityStatus: '',
      deviceId: ''
    });
    setCurrentHealthPage(1);
    
    // Đóng modal lọc
    setShowFilterModal(false);
    
    // Reload lại tất cả dữ liệu từ API (không filter)
    try {
      setLoading(true);
      const savedViewMode = localStorage.getItem('healthViewMode') || 'table';
      const loadAll = savedViewMode === 'calendar';
      
      const healthParams = { 
        patient: user.id || user._id,
        limit: loadAll ? 50000 : 100 // Calendar: tất cả, Table: 10 trang
      };
      
      console.log('🔄 Resetting filters: Reloading all data');
      const healthResponse = await apiService.getHealthData(healthParams);
      console.log('🔄 Reloaded data count:', healthResponse.data?.length || 0);
      setHealthData(healthResponse.data || []);
    } catch (err) {
      console.error('Error reloading data after reset filters:', err);
      setError(err.message || 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Kiểm tra có filter đang active không
  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== '');
  };

  // Lấy danh sách device IDs unique từ healthData
  const getUniqueDeviceIds = () => {
    const deviceIds = [...new Set(healthData.map(data => data.deviceId).filter(Boolean))];
    return deviceIds;
  };

  // Reset pagination khi filter thay đổi hoặc khi filtered data thay đổi
  useEffect(() => {
    const filteredData = getFilteredHealthData();
    const totalPages = Math.ceil(filteredData.length / healthItemsPerPage);
    if (currentHealthPage > totalPages && totalPages > 0) {
      setCurrentHealthPage(1);
    }
  }, [filters, healthData]);

  // Lấy ngày đầu tiên và ngày cuối cùng từ dữ liệu (dùng local date để match với date picker)
  const getHealthDataDateRange = () => {
    if (healthData.length === 0) {
      return { minDate: null, maxDate: null };
    }
    
    const dateKeys = new Set();
    healthData.forEach(d => {
      if (d.timestamp) {
        const date = new Date(d.timestamp);
        // Dùng local date để tạo dateKey (YYYY-MM-DD) theo local timezone
        // Điều này đảm bảo match với date picker input
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        dateKeys.add(dateKey);
      }
    });
    
    if (dateKeys.size === 0) {
      return { minDate: null, maxDate: null };
    }
    
    const sortedDates = Array.from(dateKeys).sort();
    
    return {
      minDate: sortedDates[0],
      maxDate: sortedDates[sortedDates.length - 1]
    };
  };

  if (loading) {
    return <div className="dashboard-page loading">Đang tải...</div>;
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>Bảng Điều Khiển</h1>
        <div className="header-actions">
          <span className="user-info">
            Xin chào{' '}
            <Link to="/profile" className="user-name-link">
              {user?.fullName || user?.username}
            </Link>
          </span>
          <button onClick={handleLogout} className="logout-btn">Đăng xuất</button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-content">
        <div className="tabs">
          <button
            className={activeTab === 'devices' ? 'active' : ''}
            onClick={() => setActiveTab('devices')}
          >
            Thiết Bị
          </button>
          <button
            className={activeTab === 'sessions' ? 'active' : ''}
            onClick={() => setActiveTab('sessions')}
          >
            Phiên Đo
          </button>
          <button
            className={activeTab === 'health' ? 'active' : ''}
            onClick={() => setActiveTab('health')}
          >
            Dữ Liệu Sức Khỏe
          </button>
          <button
            className={activeTab === 'charts' ? 'active' : ''}
            onClick={() => setActiveTab('charts')}
          >
            Biểu Đồ
          </button>
          <button
            className={activeTab === 'stats' ? 'active' : ''}
            onClick={() => setActiveTab('stats')}
          >
            Thống Kê
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'devices' && (
            <div className="devices-section">
              <h2>Danh Sách Thiết Bị</h2>
              {devices.length === 0 ? (
                <p>Bạn chưa có thiết bị nào.</p>
              ) : (
                <div className="devices-grid">
                  {devices.map((device) => (
                    <div key={device._id} className="device-card">
                      <h3>{device.deviceName || device.deviceId}</h3>
                      <p><strong>ID:</strong> {device.deviceId}</p>
                      <p><strong>Trạng thái:</strong> 
                        <span className={device.status === 'online' ? 'status-online' : 'status-offline'}>
                          {device.status === 'online' ? ' Đang hoạt động' : ' Offline'}
                        </span>
                      </p>
                      {device.lastSeen && (
                        <p><strong>Lần cuối:</strong> {formatDate(device.lastSeen)}</p>
                      )}
                      <button
                        onClick={() => handleCreateSession(device.deviceId)}
                        className="action-btn"
                        disabled={device.status !== 'online'}
                      >
                        Bắt Đầu Đo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="sessions-section">
              <h2>Danh Sách Phiên Đo</h2>
              {sessions.length === 0 ? (
                <p>Chưa có phiên đo nào.</p>
              ) : (
                <>
                  {/* Tính toán dữ liệu phân trang */}
                  {(() => {
                    const totalPages = Math.ceil(sessions.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const currentSessions = sessions.slice(startIndex, endIndex);
                    
                    return (
                      <>
                        <div className="sessions-list">
                          {currentSessions.map((session) => (
                            <div key={session._id} className="session-card">
                              <h3>Phiên đo - {session.deviceId}</h3>
                              <p><strong>Bắt đầu:</strong> {formatDate(session.startedAt)}</p>
                              {session.endedAt && (
                                <p><strong>Kết thúc:</strong> {formatDate(session.endedAt)}</p>
                              )}
                              <p><strong>Trạng thái:</strong> 
                                <span className={session.active ? 'status-online' : 'status-offline'}>
                                  {session.active ? ' Đang hoạt động' : ' Đã kết thúc'}
                                </span>
                              </p>
                              {session.user && (
                                <p><strong>Người dùng:</strong> {session.user.fullName || session.user.username}</p>
                              )}
                              {session.active && (
                                <button
                                  onClick={() => handleEndSession(session._id)}
                                  className="action-btn danger"
                                >
                                  Kết Thúc Phiên
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div className="pagination">
                            <button
                              className="pagination-btn"
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                            >
                              ‹
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                              // Hiển thị tối đa 7 số trang
                              if (totalPages <= 7) {
                                return (
                                  <button
                                    key={page}
                                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(page)}
                                  >
                                    {page}
                                  </button>
                                );
                              }
                              
                              // Logic hiển thị thông minh cho nhiều trang
                              if (
                                page === 1 ||
                                page === totalPages ||
                                (page >= currentPage - 1 && page <= currentPage + 1)
                              ) {
                                return (
                                  <button
                                    key={page}
                                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(page)}
                                  >
                                    {page}
                                  </button>
                                );
                              }
                              
                              // Hiển thị dấu ... khi cần
                              if (page === currentPage - 2 || page === currentPage + 2) {
                                return <span key={page} className="pagination-ellipsis">...</span>;
                              }
                              
                              return null;
                            })}
                            
                            <button
                              className="pagination-btn"
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {activeTab === 'health' && (
            <div className="health-section">
              <div className="health-header">
                <h2>Dữ Liệu Sức Khỏe Gần Đây</h2>
                <div className="health-header-actions">
                  {/* Toggle View Mode */}
                  <div className="view-toggle">
                    <button
                      className={`view-toggle-btn ${healthViewMode === 'table' ? 'active' : ''}`}
                      onClick={() => handleViewModeChange('table')}
                      title="Xem dạng bảng"
                    >
                      📋 Bảng
                    </button>
                    <button
                      className={`view-toggle-btn ${healthViewMode === 'calendar' ? 'active' : ''}`}
                      onClick={() => handleViewModeChange('calendar')}
                      title="Xem dạng lịch"
                    >
                      📅 Lịch
                    </button>
                  </div>
                  
                  {healthViewMode === 'table' && (
                    <>
                      <div className="sort-control">
                        <label htmlFor="sort-order">Sắp xếp:</label>
                        <select
                          id="sort-order"
                          value={sortOrder}
                          onChange={(e) => {
                            setSortOrder(e.target.value);
                            setCurrentHealthPage(1); // Reset về trang 1 khi đổi sort
                          }}
                          className="sort-select"
                        >
                          <option value="newest">Mới nhất → Cũ nhất</option>
                          <option value="oldest">Cũ nhất → Mới nhất</option>
                        </select>
                      </div>
                      <button
                        onClick={handleOpenFilterModal}
                        className={`filter-btn ${hasActiveFilters() ? 'active' : ''}`}
                        title="Lọc dữ liệu"
                      >
                        🔍 Lọc {hasActiveFilters() && `(${Object.values(filters).filter(v => v !== '').length})`}
                      </button>
                      {healthData.length > 0 && (
                        <button
                          onClick={handleOpenExportModal}
                          className="export-btn"
                          title="Xuất dữ liệu ra file CSV"
                        >
                          📥 Xuất File
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Filter Modal */}
              {showFilterModal && (
                <div className="export-modal-overlay" onClick={handleCloseFilterModal}>
                  <div className="export-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="export-modal-header">
                      <h3>🔍 Bộ Lọc Dữ Liệu</h3>
                      <button className="close-btn" onClick={handleCloseFilterModal}>×</button>
                    </div>
                    <div className="export-modal-body">
                      <p className="export-info">Chọn các tiêu chí để lọc và tải dữ liệu từ server:</p>
                      {(() => {
                        // Nếu chưa có dữ liệu, lấy date range từ tháng trước đến hôm nay
                        const { minDate, maxDate } = healthData.length > 0 
                          ? getHealthDataDateRange() 
                          : (() => {
                              const today = new Date();
                              const lastMonth = new Date(today);
                              lastMonth.setMonth(today.getMonth() - 1);
                              return {
                                minDate: lastMonth.toISOString().split('T')[0],
                                maxDate: today.toISOString().split('T')[0]
                              };
                            })();
                        return (
                          <>
                            {/* Date Range Filter */}
                            <div className="date-range-selector">
                              <div className="date-input-group">
                                <label htmlFor="filter-start-date">Từ ngày:</label>
                                <div className="date-input-wrapper">
                                  <input
                                    type="date"
                                    id="filter-start-date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                    min={minDate || undefined}
                                    max={filters.endDate || maxDate || undefined}
                                  />
                                  {filters.startDate && (
                                    <button
                                      type="button"
                                      className="clear-date-btn"
                                      onClick={() => setFilters({ ...filters, startDate: '' })}
                                      title="Xóa ngày bắt đầu"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="date-input-group">
                                <label htmlFor="filter-end-date">Đến ngày:</label>
                                <div className="date-input-wrapper">
                                  <input
                                    type="date"
                                    id="filter-end-date"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                    min={filters.startDate || minDate || undefined}
                                    max={maxDate || undefined}
                                  />
                                  {filters.endDate && (
                                    <button
                                      type="button"
                                      className="clear-date-btn"
                                      onClick={() => setFilters({ ...filters, endDate: '' })}
                                      title="Xóa ngày kết thúc"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quick Date Filters */}
                            <div className="filter-group" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                              <label>Lọc nhanh:</label>
                              <div className="quick-filters">
                                <button
                                  className="quick-filter-btn"
                                  onClick={() => {
                                    const today = new Date();
                                    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                    setFilters({
                                      ...filters,
                                      startDate: startOfToday.toISOString().split('T')[0],
                                      endDate: today.toISOString().split('T')[0]
                                    });
                                  }}
                                >
                                  Hôm nay
                                </button>
                                <button
                                  className="quick-filter-btn"
                                  onClick={() => {
                                    const today = new Date();
                                    // Đảm bảo lấy ngày hôm nay theo local time, không phải UTC
                                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                    
                                    const weekAgo = new Date(today);
                                    weekAgo.setDate(today.getDate() - 6); // 7 ngày bao gồm cả hôm nay: 6 ngày trước + hôm nay
                                    const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
                                    
                                    setFilters({
                                      ...filters,
                                      startDate: weekAgoStr,
                                      endDate: todayStr
                                    });
                                  }}
                                >
                                  7 ngày qua
                                </button>
                                <button
                                  className="quick-filter-btn"
                                  onClick={() => {
                                    const today = new Date();
                                    // Đảm bảo lấy ngày hôm nay theo local time, không phải UTC
                                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                    
                                    const monthAgo = new Date(today);
                                    monthAgo.setDate(today.getDate() - 29); // 30 ngày bao gồm cả hôm nay: 29 ngày trước + hôm nay
                                    const monthAgoStr = `${monthAgo.getFullYear()}-${String(monthAgo.getMonth() + 1).padStart(2, '0')}-${String(monthAgo.getDate()).padStart(2, '0')}`;
                                    
                                    setFilters({
                                      ...filters,
                                      startDate: monthAgoStr,
                                      endDate: todayStr
                                    });
                                  }}
                                >
                                  30 ngày qua
                                </button>
                              </div>
                            </div>

                            {/* Heart Rate Filter */}
                            <div className="filter-group" style={{ marginBottom: '1rem' }}>
                              <label>Nhịp tim (BPM):</label>
                              <div className="range-inputs">
                                <input
                                  type="number"
                                  placeholder="Từ"
                                  value={filters.heartRateMin}
                                  onChange={(e) => setFilters({ ...filters, heartRateMin: e.target.value })}
                                  min="0"
                                  max="255"
                                />
                                <span>đến</span>
                                <input
                                  type="number"
                                  placeholder="Đến"
                                  value={filters.heartRateMax}
                                  onChange={(e) => setFilters({ ...filters, heartRateMax: e.target.value })}
                                  min="0"
                                  max="255"
                                />
                              </div>
                            </div>

                            {/* SpO2 Filter */}
                            <div className="filter-group" style={{ marginBottom: '1rem' }}>
                              <label>SpO2 (%):</label>
                              <div className="range-inputs">
                                <input
                                  type="number"
                                  placeholder="Từ"
                                  value={filters.spo2Min}
                                  onChange={(e) => setFilters({ ...filters, spo2Min: e.target.value })}
                                  min="0"
                                  max="100"
                                />
                                <span>đến</span>
                                <input
                                  type="number"
                                  placeholder="Đến"
                                  value={filters.spo2Max}
                                  onChange={(e) => setFilters({ ...filters, spo2Max: e.target.value })}
                                  min="0"
                                  max="100"
                                />
                              </div>
                            </div>

                            {/* Temperature Filter */}
                            <div className="filter-group" style={{ marginBottom: '1rem' }}>
                              <label>Nhiệt độ (°C):</label>
                              <div className="range-inputs">
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="Từ"
                                  value={filters.temperatureMin}
                                  onChange={(e) => setFilters({ ...filters, temperatureMin: e.target.value })}
                                  min="-50"
                                  max="100"
                                />
                                <span>đến</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="Đến"
                                  value={filters.temperatureMax}
                                  onChange={(e) => setFilters({ ...filters, temperatureMax: e.target.value })}
                                  min="-50"
                                  max="100"
                                />
                              </div>
                            </div>

                            {/* Activity Status Filter */}
                            <div className="filter-group" style={{ marginBottom: '1rem' }}>
                              <label>Trạng thái hoạt động:</label>
                              <select
                                value={filters.activityStatus}
                                onChange={(e) => setFilters({ ...filters, activityStatus: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '2px solid var(--border-color)' }}
                              >
                                <option value="">Tất cả</option>
                                <option value="IDLE">Nghỉ ngơi</option>
                                <option value="WALKING">Đi bộ</option>
                                <option value="RUNNING">Chạy</option>
                                <option value="IMPACT">Tác động</option>
                                <option value="UNKNOWN">Không xác định</option>
                              </select>
                            </div>

                            {/* Device Filter */}
                            {getUniqueDeviceIds().length > 0 && (
                              <div className="filter-group" style={{ marginBottom: '1rem' }}>
                                <label>Thiết bị:</label>
                                <select
                                  value={filters.deviceId}
                                  onChange={(e) => setFilters({ ...filters, deviceId: e.target.value })}
                                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '2px solid var(--border-color)' }}
                                >
                                  <option value="">Tất cả thiết bị</option>
                                  {getUniqueDeviceIds().map(deviceId => (
                                    <option key={deviceId} value={deviceId}>{deviceId}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Warning about TTL */}
                            <div className="export-summary" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                              <p style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>
                                ⚠️ <strong>Lưu ý:</strong> Dữ liệu tự động xóa sau 30 ngày.
                              </p>
                            </div>

                            {/* Filter Actions */}
                            <div className="export-actions">
                              <button
                                onClick={resetFilters}
                                className="clear-all-btn"
                              >
                                🔄 Xóa Tất Cả
                              </button>
                              <button
                                onClick={handleApplyFilters}
                                className="confirm-export-btn"
                                disabled={!filters.startDate && !filters.endDate}
                              >
                                ✅ Áp Dụng & Tải Dữ Liệu
                              </button>
                              <button
                                onClick={handleCloseFilterModal}
                                className="cancel-btn"
                              >
                                Hủy
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal xuất file với tùy chọn khoảng thời gian */}
              {showExportModal && (
                <div className="export-modal-overlay" onClick={handleCloseExportModal}>
                  <div className="export-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="export-modal-header">
                      <h3>Xuất Dữ Liệu Sức Khỏe</h3>
                      <button className="close-btn" onClick={handleCloseExportModal}>×</button>
                    </div>
                    <div className="export-modal-body">
                      <p className="export-info">Chọn khoảng thời gian để xuất dữ liệu:</p>
                      {(() => {
                        const { minDate, maxDate } = getDataDateRange();
                        return (
                          <div className="date-range-selector">
                            <div className="date-input-group">
                              <label htmlFor="export-start-date">Từ ngày:</label>
                              <div className="date-input-wrapper">
                                <input
                                  type="date"
                                  id="export-start-date"
                                  value={exportStartDate}
                                  onChange={(e) => setExportStartDate(e.target.value)}
                                  min={minDate || undefined}
                                  max={exportEndDate || maxDate || undefined}
                                />
                                {exportStartDate && (
                                  <button
                                    type="button"
                                    className="clear-date-btn"
                                    onClick={() => setExportStartDate('')}
                                    title="Xóa ngày bắt đầu"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="date-input-group">
                              <label htmlFor="export-end-date">Đến ngày:</label>
                              <div className="date-input-wrapper">
                                <input
                                  type="date"
                                  id="export-end-date"
                                  value={exportEndDate}
                                  onChange={(e) => setExportEndDate(e.target.value)}
                                  min={exportStartDate || minDate || undefined}
                                  max={maxDate || undefined}
                                />
                                {exportEndDate && (
                                  <button
                                    type="button"
                                    className="clear-date-btn"
                                    onClick={() => setExportEndDate('')}
                                    title="Xóa ngày kết thúc"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="export-summary">
                        <p>
                          <strong>Số bản ghi sẽ xuất:</strong> {getFilteredDataCount()}
                        </p>
                        {getFilteredDataCount() === 0 && !exportStartDate && !exportEndDate && (
                          <p className="export-warning">⚠️ Vui lòng chọn khoảng thời gian để xuất dữ liệu</p>
                        )}
                        {getFilteredDataCount() === 0 && (exportStartDate || exportEndDate) && (
                          <p className="export-warning">⚠️ Không có dữ liệu trong khoảng thời gian đã chọn</p>
                        )}
                      </div>
                      <div className="export-actions">
                        <button
                          onClick={handleExportAllHealthData}
                          className="export-all-btn"
                          disabled={healthData.length === 0}
                        >
                          📥 Xuất Tất Cả
                        </button>
                        <button
                          onClick={() => {
                            setExportStartDate('');
                            setExportEndDate('');
                          }}
                          className="clear-all-btn"
                          disabled={!exportStartDate && !exportEndDate}
                        >
                          Xóa tất cả
                        </button>
                        <button
                          onClick={handleExportHealthData}
                          className="confirm-export-btn"
                          disabled={getFilteredDataCount() === 0}
                        >
                          📥 Xuất File
                        </button>
                        <button
                          onClick={handleCloseExportModal}
                          className="cancel-btn"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {healthData.length === 0 ? (
                <p>Chưa có dữ liệu sức khỏe.</p>
              ) : healthViewMode === 'calendar' ? (
                <HealthCalendar 
                  healthData={healthData} 
                  onDateClick={handleCalendarDateClick}
                />
              ) : (
                <>
                  {/* Tính toán dữ liệu phân trang với filter */}
                  {(() => {
                    const filteredData = getFilteredHealthData();
                    const totalHealthPages = Math.ceil(filteredData.length / healthItemsPerPage);
                    const startHealthIndex = (currentHealthPage - 1) * healthItemsPerPage;
                    const endHealthIndex = startHealthIndex + healthItemsPerPage;
                    const currentHealthData = filteredData.slice(startHealthIndex, endHealthIndex);
                    
                    return (
                      <>
                        <table className="health-table">
                          <thead>
                            <tr>
                              <th>Thời gian</th>
                              <th>Nhịp tim (BPM)</th>
                              <th>SpO2 (%)</th>
                              <th>Nhiệt độ (°C)</th>
                              <th>Áp suất (Pa)</th>
                              <th>Trạng thái</th>
                              <th>Thiết bị</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentHealthData.map((data) => (
                              <tr key={data._id}>
                                <td>{formatDate(data.timestamp)}</td>
                                <td>{data.heartRate || '-'}</td>
                                <td>{data.spo2 || '-'}</td>
                                <td>{data.temperature || '-'}</td>
                                <td>{data.pressure ? data.pressure.toFixed(2) : '-'}</td>
                                <td>
                                  <span className={`activity-status activity-${(data.activityStatus || 'UNKNOWN').toLowerCase()}`}>
                                    {data.activityStatus === 'IDLE' ? 'Nghỉ ngơi' :
                                     data.activityStatus === 'WALKING' ? 'Đi bộ' :
                                     data.activityStatus === 'RUNNING' ? 'Chạy' :
                                     data.activityStatus === 'IMPACT' ? 'Tác động' : 'Không xác định'}
                                  </span>
                                </td>
                                <td>{data.deviceId || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {/* Pagination */}
                        {totalHealthPages > 1 && (
                          <div className="pagination">
                            <button
                              className="pagination-btn"
                              onClick={() => setCurrentHealthPage(prev => Math.max(1, prev - 1))}
                              disabled={currentHealthPage === 1}
                            >
                              ‹
                            </button>
                            
                            {Array.from({ length: totalHealthPages }, (_, i) => i + 1).map((page) => {
                              // Hiển thị tối đa 7 số trang
                              if (totalHealthPages <= 7) {
                                return (
                                  <button
                                    key={page}
                                    className={`pagination-btn ${currentHealthPage === page ? 'active' : ''}`}
                                    onClick={() => setCurrentHealthPage(page)}
                                  >
                                    {page}
                                  </button>
                                );
                              }
                              
                              // Logic hiển thị thông minh cho nhiều trang
                              if (
                                page === 1 ||
                                page === totalHealthPages ||
                                (page >= currentHealthPage - 1 && page <= currentHealthPage + 1)
                              ) {
                                return (
                                  <button
                                    key={page}
                                    className={`pagination-btn ${currentHealthPage === page ? 'active' : ''}`}
                                    onClick={() => setCurrentHealthPage(page)}
                                  >
                                    {page}
                                  </button>
                                );
                              }
                              
                              // Hiển thị dấu ... khi cần
                              if (page === currentHealthPage - 2 || page === currentHealthPage + 2) {
                                return <span key={page} className="pagination-ellipsis">...</span>;
                              }
                              
                              return null;
                            })}
                            
                            <button
                              className="pagination-btn"
                              onClick={() => setCurrentHealthPage(prev => Math.min(totalHealthPages, prev + 1))}
                              disabled={currentHealthPage === totalHealthPages}
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="charts-section">
              <div className="charts-header">
                <h2>Biểu Đồ Chỉ Số Sức Khỏe {realTimeData && <span className="realtime-badge">Live</span>}</h2>
                
                <div className="measurement-controls">
                  <div className="device-selector">
                    <label>Thiết bị:</label>
                    <select 
                      value={devices[0]?._id || ''}
                      onChange={(e) => {
                        // Có thể thêm logic chọn thiết bị nếu cần
                      }}
                      disabled={devices.length === 0}
                    >
                      {devices.length === 0 ? (
                        <option value="">Không có thiết bị</option>
                      ) : (
                        devices.map(device => (
                          <option key={device._id} value={device._id}>
                            {device.deviceName || device.deviceId} - {device.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  
                  <div className="control-buttons">
                    {(() => {
                      // Kiểm tra xem có session nào đang active không
                      const activeSession = sessions.find(session => session.active === true);
                      
                      if (!activeSession) {
                        // Không có session active, hiển thị button "Bắt Đầu Đo"
                        return (
                          <button
                            onClick={() => devices[0] && handleCreateSession(devices[0].deviceId)}
                            className="start-btn"
                            disabled={!devices[0] || devices[0].status !== 'online'}
                          >
                            ▶️ Bắt Đầu Đo
                          </button>
                        );
                      } else {
                        // Có session active, hiển thị button "Kết Thúc Đo"
                        return (
                          <button
                            onClick={() => handleEndSession(activeSession._id)}
                            className="stop-btn"
                          >
                            ⏹️ Kết Thúc Đo
                          </button>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
              
              {/* Hiển thị cảnh báo sức khỏe */}
              {healthAlerts.length > 0 && (
                <div className="health-alerts-container">
                  {healthAlerts.map((alert) => (
                    <div key={alert.id} className={`health-alert health-alert-${alert.type || 'error'}`}>
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}
              
              <HealthCharts healthData={healthData} />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="stats-section">
              <div className="stats-header">
                <h2>Thống Kê Sức Khỏe</h2>
                <div className="stats-actions">
                  <button 
                    onClick={() => loadStats(statsFilters)} 
                    className="refresh-stats-btn"
                    disabled={loadingStats}
                  >
                    {loadingStats ? '⏳ Đang tải...' : '🔄 Làm mới'}
                  </button>
                </div>
              </div>

              {/* Bộ lọc thống kê */}
              <div className="stats-filters">
                {(() => {
                  // Lấy ngày cuối cùng có dữ liệu - ưu tiên từ API, fallback từ healthData state
                  const { maxDate: maxDateFromState } = getHealthDataDateRange();
                  const maxDate = maxHealthDataDate || maxDateFromState || undefined;
                  return (
                    <>
                      <div className="filter-group">
                        <label htmlFor="stats-start-date">Từ ngày:</label>
                        <input
                          type="date"
                          id="stats-start-date"
                          value={statsFilters.startDate}
                          onChange={(e) => setStatsFilters({ ...statsFilters, startDate: e.target.value })}
                          max={statsFilters.endDate || maxDate || undefined}
                        />
                      </div>
                      <div className="filter-group">
                        <label htmlFor="stats-end-date">Đến ngày:</label>
                        <input
                          type="date"
                          id="stats-end-date"
                          value={statsFilters.endDate}
                          onChange={(e) => setStatsFilters({ ...statsFilters, endDate: e.target.value })}
                          min={statsFilters.startDate || undefined}
                          max={maxDate || undefined}
                        />
                      </div>
                    </>
                  );
                })()}
                <div className="filter-group">
                  <label htmlFor="stats-device">Thiết bị:</label>
                  <select
                    id="stats-device"
                    value={statsFilters.deviceId}
                    onChange={(e) => setStatsFilters({ ...statsFilters, deviceId: e.target.value })}
                  >
                    <option value="">Tất cả thiết bị</option>
                    {devices.map(device => (
                      <option key={device._id} value={device.deviceId}>
                        {device.name || device.deviceId}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => loadStats(statsFilters)}
                  className="apply-filter-btn"
                  disabled={loadingStats}
                >
                  Áp dụng
                </button>
                <button
                  onClick={() => {
                    setStatsFilters({ startDate: '', endDate: '', deviceId: '' });
                    loadStats({ startDate: '', endDate: '', deviceId: '' });
                  }}
                  className="reset-filter-btn"
                  disabled={loadingStats}
                >
                  Đặt lại
                </button>
              </div>

              {/* Hiển thị khoảng thời gian đang thống kê */}
              {(statsFilters.startDate || statsFilters.endDate) && (
                <div className="stats-time-range">
                  <p>
                    📅 Khoảng thời gian: 
                    {statsFilters.startDate ? ` Từ ${new Date(statsFilters.startDate).toLocaleDateString('vi-VN')}` : ' Từ đầu'}
                    {statsFilters.endDate ? ` đến ${new Date(statsFilters.endDate).toLocaleDateString('vi-VN')}` : ' đến nay'}
                    {statsFilters.deviceId && ` | Thiết bị: ${devices.find(d => d.deviceId === statsFilters.deviceId)?.name || statsFilters.deviceId}`}
                  </p>
                </div>
              )}

              {loadingStats ? (
                <div className="loading-stats">
                  <div className="loading-spinner"></div>
                  <p>Đang tải thống kê...</p>
                </div>
              ) : !stats ? (
                <div className="no-stats">
                  <div className="no-stats-icon">⏳</div>
                  <h3>Đang tải dữ liệu...</h3>
                  <p>Vui lòng đợi trong giây lát.</p>
                </div>
              ) : !stats.count || stats.count === 0 ? (
                <div className="no-stats">
                  <div className="no-stats-icon">📊</div>
                  <h3>Chưa có dữ liệu thống kê</h3>
                  <p>
                    {statsFilters.startDate || statsFilters.endDate || statsFilters.deviceId
                      ? 'Không tìm thấy dữ liệu trong khoảng thời gian hoặc thiết bị đã chọn.'
                      : 'Hiện tại chưa có dữ liệu sức khỏe để thống kê. Hãy bắt đầu đo sức khỏe để có dữ liệu thống kê.'}
                  </p>
                  {(statsFilters.startDate || statsFilters.endDate || statsFilters.deviceId) && (
                    <button
                      onClick={() => {
                        setStatsFilters({ startDate: '', endDate: '', deviceId: '' });
                        loadStats({ startDate: '', endDate: '', deviceId: '' });
                      }}
                      className="view-all-stats-btn"
                    >
                      Xem tất cả dữ liệu
                    </button>
                  )}
                </div>
              ) : (
                <div className="stats-grid">
                  <div className="stat-card heart-rate">
                    <div className="stat-icon">❤️</div>
                    <h3>Nhịp Tim</h3>
                    <p className="stat-value">{stats.avgHeartRate?.toFixed(1) || 0} <span className="stat-unit">BPM</span></p>
                    <div className="stat-details">
                      <span className="stat-min">Min: {stats.minHeartRate || 0} BPM</span>
                      <span className="stat-max">Max: {stats.maxHeartRate || 0} BPM</span>
                    </div>
                  </div>
                  <div className="stat-card spo2">
                    <div className="stat-icon">🫁</div>
                    <h3>SpO2</h3>
                    <p className="stat-value">{stats.avgSpo2?.toFixed(1) || 0} <span className="stat-unit">%</span></p>
                    <div className="stat-details">
                      <span className="stat-min">Min: {stats.minSpo2 || 0}%</span>
                      <span className="stat-max">Max: {stats.maxSpo2 || 0}%</span>
                    </div>
                  </div>
                  <div className="stat-card temperature">
                    <div className="stat-icon">🌡️</div>
                    <h3>Nhiệt Độ</h3>
                    <p className="stat-value">{stats.avgTemperature?.toFixed(1) || 0} <span className="stat-unit">°C</span></p>
                    <div className="stat-details">
                      <span className="stat-min">Min: {stats.minTemperature?.toFixed(1) || (stats.avgTemperature ? stats.avgTemperature.toFixed(1) : 0)}°C</span>
                      <span className="stat-max">Max: {stats.maxTemperature?.toFixed(1) || (stats.avgTemperature ? stats.avgTemperature.toFixed(1) : 0)}°C</span>
                    </div>
                  </div>
                  <div className="stat-card count">
                    <div className="stat-icon">📊</div>
                    <h3>Tổng Số Đo</h3>
                    <p className="stat-value">{stats.count || 0} <span className="stat-unit">lần</span></p>
                    <div className="stat-details">
                      <span className="stat-info">Tổng số bản ghi dữ liệu</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

