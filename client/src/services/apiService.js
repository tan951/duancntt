const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Helper function to get auth token from sessionStorage
const getAuthToken = () => {
  return sessionStorage.getItem('accessToken');
};

// Helper function to get refresh token from sessionStorage
const getRefreshToken = () => {
  return sessionStorage.getItem('refreshToken');
};

// Helper function to refresh access token
const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(data.message || 'Failed to refresh token');
    }

    // Lưu access token mới
    if (data.accessToken) {
      sessionStorage.setItem('accessToken', data.accessToken);
      if (data.user) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
      }
    }

    return data.accessToken;
  } catch (error) {
    // Nếu refresh token hết hạn, xóa tất cả và yêu cầu đăng nhập lại
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    throw error;
  }
};

// Helper function to make API requests
const apiRequest = async (endpoint, options = {}, retry = true) => {
  const token = getAuthToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    // Network error - server có thể đã tắt
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      // Tạo một error đặc biệt để client có thể detect server down
      const serverDownError = new Error('SERVER_DOWN');
      serverDownError.isServerDown = true;
      serverDownError.originalError = error;
      throw serverDownError;
    }
    throw error;
  }
  
  let data;
  try {
    data = await response.json();
  } catch (e) {
    // Nếu không parse được JSON và status không phải 200, có thể server đã tắt
    if (!response.ok && response.status >= 500) {
      const serverDownError = new Error('SERVER_DOWN');
      serverDownError.isServerDown = true;
      throw serverDownError;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Nếu access token hết hạn và có refresh token, thử refresh
  if (response.status === 401 && data.code === 'TOKEN_EXPIRED' && retry) {
    try {
      const newAccessToken = await refreshAccessToken();
      // Retry request với access token mới
      config.headers.Authorization = `Bearer ${newAccessToken}`;
      const retryResponse = await fetch(url, config);
      const retryData = await retryResponse.json();
      
      if (!retryResponse.ok || retryData.success === false) {
        throw new Error(retryData.message || `HTTP error! status: ${retryResponse.status}`);
      }
      
      return retryData;
    } catch (refreshError) {
      // Nếu refresh thất bại, throw error để client xử lý (redirect to login)
      throw new Error('Session expired. Please login again.');
    }
  }

  if (!response.ok || (data.success === false)) {
    // Nếu status là 500 hoặc cao hơn, có thể server đang gặp vấn đề
    if (response.status >= 500) {
      const serverDownError = new Error('SERVER_DOWN');
      serverDownError.isServerDown = true;
      throw serverDownError;
    }
    throw new Error(data.message || `HTTP error! status: ${response.status}`);
  }

  return data;
};

// API methods
export const apiService = {
  // User endpoints
  login: (username, password) =>
    apiRequest('/users/login', {
      method: 'POST',
      body: { username, password },
    }),

  register: (userData) =>
    apiRequest('/users', {
      method: 'POST',
      body: userData,
    }),

  getUsers: () => apiRequest('/users'),

  getUserById: (id) => apiRequest(`/users/${id}`),

  updateUser: (id, userData) =>
    apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: userData,
    }),

  deleteUser: (id) =>
    apiRequest(`/users/${id}`, {
      method: 'DELETE',
    }),

  // Device endpoints
  getDevices: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/devices${queryString ? `?${queryString}` : ''}`);
  },

  getDeviceById: (id) => apiRequest(`/devices/${id}`),

  getDeviceByDeviceId: (deviceId) => apiRequest(`/devices/deviceId/${deviceId}`),

  getDevicesByUserId: (userId) => apiRequest(`/devices/user/${userId}`),

  createDevice: (deviceData) =>
    apiRequest('/devices', {
      method: 'POST',
      body: deviceData,
    }),

  updateDevice: (id, deviceData) =>
    apiRequest(`/devices/${id}`, {
      method: 'PUT',
      body: deviceData,
    }),

  updateDeviceConfig: (id, configData) =>
    apiRequest(`/devices/${id}/config`, {
      method: 'PUT',
      body: configData,
    }),

  deleteDevice: (id) =>
    apiRequest(`/devices/${id}`, {
      method: 'DELETE',
    }),

  // Session endpoints
  getSessions: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/sessions${queryString ? `?${queryString}` : ''}`);
  },

  getSessionById: (id) => apiRequest(`/sessions/${id}`),

  getActiveSessionByDeviceId: (deviceId) =>
    apiRequest(`/sessions/device/${deviceId}/active`),

  createSession: (sessionData) =>
    apiRequest('/sessions', {
      method: 'POST',
      body: sessionData,
    }),

  endSession: (id) =>
    apiRequest(`/sessions/${id}/end`, {
      method: 'PUT',
    }),

  updateSession: (id, sessionData) =>
    apiRequest(`/sessions/${id}`, {
      method: 'PUT',
      body: sessionData,
    }),

  deleteSession: (id) =>
    apiRequest(`/sessions/${id}`, {
      method: 'DELETE',
    }),

  // Health data endpoints
  getHealthData: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/health${queryString ? `?${queryString}` : ''}`);
  },

  getHealthDataById: (id) => apiRequest(`/health/${id}`),

  getHealthDataByPatientId: (patientId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/health/patient/${patientId}${queryString ? `?${queryString}` : ''}`);
  },

  getHealthDataByDeviceId: (deviceId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/health/device/${deviceId}${queryString ? `?${queryString}` : ''}`);
  },

  getHealthStatistics: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/health/stats${queryString ? `?${queryString}` : ''}`);
  },

  deleteHealthData: (id) =>
    apiRequest(`/health/${id}`, {
      method: 'DELETE',
    }),

  // Auth endpoints
  refreshToken: (refreshToken) =>
    apiRequest('/users/refresh', {
      method: 'POST',
      body: { refreshToken },
    }, false), // Không retry khi refresh token

  logout: (refreshToken) =>
    apiRequest('/users/logout', {
      method: 'POST',
      body: { refreshToken },
    }, false), // Không retry khi logout
};

