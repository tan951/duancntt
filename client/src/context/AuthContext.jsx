import { createContext, useContext, useState, useEffect } from 'react';
import { authUtils } from '../utils/authUtils';
import { apiService } from '../services/apiService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const SESSION_KEY = 'app_session_active';
      const SESSION_TIMESTAMP_KEY = 'app_session_timestamp';
      
      // Sử dụng localStorage để chia sẻ giữa các tab
      // Kiểm tra xem có session active trong localStorage không
      const hasActiveSession = localStorage.getItem(SESSION_KEY);
      const sessionTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
      
      const accessToken = authUtils.getAuthToken();
      const refreshToken = authUtils.getRefreshToken();
      const currentUser = authUtils.getUser();

      // Nếu không có session active flag → kiểm tra xem có phải là lần mở lại chương trình không
      if (!hasActiveSession) {
        // Nếu có session trong localStorage nhưng không có flag
        if (accessToken || refreshToken || currentUser) {
          if (sessionTimestamp) {
            const timestamp = parseInt(sessionTimestamp, 10);
            const now = Date.now();
            // Nếu timestamp cũ hơn 10 giây → đây là lần mở lại chương trình (đã đóng browser)
            // 10 giây là đủ để phân biệt giữa tab mới (timestamp sẽ được cập nhật ngay) và mở lại chương trình
            if (now - timestamp > 10000) {
              authUtils.logout();
              localStorage.removeItem(SESSION_TIMESTAMP_KEY);
              setUser(null);
              setLoading(false);
              return;
            }
            // Nếu timestamp còn mới (< 10 giây), có thể là tab khác vẫn đang mở
            // Tạo lại flag và tiếp tục
            localStorage.setItem(SESSION_KEY, 'true');
            localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
          } else {
            // Có session nhưng không có timestamp → đây là lần mở lại chương trình
            authUtils.logout();
            setUser(null);
            setLoading(false);
            return;
          }
        } else {
          // Không có session, không làm gì cả
          setLoading(false);
          return;
        }
      }
      
      // Cập nhật timestamp để đánh dấu tab này đang active
      localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());

      // Helper function để decode JWT và kiểm tra expiry
      const decodeJWT = (token) => {
        if (!token) return null;
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          return JSON.parse(jsonPayload);
        } catch (error) {
          return null;
        }
      };

      // Helper function để kiểm tra token có hết hạn không
      const isTokenExpired = (token) => {
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.exp) return true;
        return decoded.exp * 1000 < Date.now();
      };

      // Nếu không có token nào, không có session
      if (!accessToken && !refreshToken) {
        setLoading(false);
        return;
      }

      // Kiểm tra session còn hợp lệ không (cho cả reload và tab mới)
      // Nếu có user trong localStorage, set user trước
      if (currentUser) {
        setUser(currentUser);
      }

      // Kiểm tra access token
      if (accessToken && !isTokenExpired(accessToken)) {
        // Access token còn hợp lệ
        // Cập nhật timestamp để đánh dấu tab này đang active
        localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
        setLoading(false);
        return;
      }

      // Access token hết hạn hoặc không có, thử refresh
      if (refreshToken) {
        try {
          const response = await apiService.refreshToken(refreshToken);
          if (response.success && response.accessToken) {
            // Cập nhật access token mới
            authUtils.setAuthToken(response.accessToken);
            if (response.user) {
              authUtils.setUser(response.user);
              setUser(response.user);
            }
            // Cập nhật timestamp để đánh dấu tab này đang active
            localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
          }
        } catch (error) {
          // Kiểm tra xem có phải server down không
          if (error.isServerDown || error.message === 'SERVER_DOWN') {
            console.error('Server is down, logging out...');
            // Server đã tắt, xóa session và yêu cầu đăng nhập lại
            authUtils.logout();
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_TIMESTAMP_KEY);
            setUser(null);
            setLoading(false);
            return;
          }
          // Refresh token hết hạn hoặc không hợp lệ, xóa tất cả
          console.error('Failed to refresh token:', error);
          authUtils.logout();
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(SESSION_TIMESTAMP_KEY);
          setUser(null);
        }
      } else {
        // Không có refresh token, xóa access token
        authUtils.logout();
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_TIMESTAMP_KEY);
        setUser(null);
      }

      setLoading(false);
    };

    initializeAuth();

    // Lắng nghe sự kiện storage để đồng bộ giữa các tab
    const handleStorageChange = (e) => {
      if (e.key === 'app_session_active' && !e.newValue) {
        // Nếu flag session bị xóa ở tab khác, không làm gì (có thể là logout)
      }
    };

    // Lắng nghe sự kiện beforeunload để xóa flag khi đóng browser
    // Tuy nhiên, điều này cũng xảy ra khi đóng tab, nên cần cẩn thận
    const handleBeforeUnload = () => {
      // Chỉ xóa flag nếu đây là tab cuối cùng
      // Sử dụng một cơ chế đếm tab (phức tạp) hoặc đơn giản là không xóa
      // Thay vào đó, sử dụng timestamp để detect
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cập nhật timestamp định kỳ để đánh dấu tab đang active
    // Đồng thời kiểm tra server còn hoạt động không
    const heartbeatInterval = setInterval(async () => {
      const SESSION_KEY = 'app_session_active';
      if (localStorage.getItem(SESSION_KEY)) {
        localStorage.setItem('app_session_timestamp', Date.now().toString());
        
        // Kiểm tra server còn hoạt động không bằng cách gọi một API đơn giản
        // Chỉ kiểm tra nếu có user đang đăng nhập
        const currentUser = authUtils.getUser();
        if (currentUser) {
          try {
            // Gọi một API đơn giản để kiểm tra server (ví dụ: get user info)
            // Nếu server down, sẽ throw error và logout
            await apiService.getUserById(currentUser.id || currentUser._id);
          } catch (error) {
            // Nếu server down, logout và xóa session
            if (error.isServerDown || error.message === 'SERVER_DOWN') {
              console.error('Server is down detected in heartbeat, logging out...');
              authUtils.logout();
              localStorage.removeItem(SESSION_KEY);
              localStorage.removeItem('app_session_timestamp');
              setUser(null);
              // Redirect về login sẽ được xử lý bởi ProtectedRoute
            }
          }
        }
      }
    }, 10000); // Kiểm tra mỗi 10 giây

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeatInterval);
    };
  }, []);

  const login = (accessToken, userData, refreshToken) => {
    authUtils.setAuthToken(accessToken);
    if (refreshToken) {
      authUtils.setRefreshToken(refreshToken);
    }
    authUtils.setUser(userData);
    setUser(userData);
    // Đánh dấu session đang active trong localStorage (shared giữa các tab)
    localStorage.setItem('app_session_active', 'true');
    localStorage.setItem('app_session_timestamp', Date.now().toString());
  };

  const logout = async () => {
    // Gọi API logout để xóa refresh token trên server
    const refreshToken = authUtils.getRefreshToken();
    if (refreshToken) {
      try {
        await apiService.logout(refreshToken);
      } catch (error) {
        console.error('Error logging out:', error);
        // Vẫn tiếp tục xóa local storage dù API call thất bại
      }
    }
    authUtils.logout();
    localStorage.removeItem('app_session_active');
    localStorage.removeItem('app_session_timestamp');
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    authUtils.setUser(userData);
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

