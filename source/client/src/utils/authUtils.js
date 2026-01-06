// Authentication utility functions
// Sử dụng sessionStorage thay vì localStorage để mỗi tab có session riêng

export const authUtils = {
  setAuthToken: (accessToken) => {
    if (accessToken) {
      sessionStorage.setItem('accessToken', accessToken);
    } else {
      sessionStorage.removeItem('accessToken');
    }
  },

  getAuthToken: () => {
    return sessionStorage.getItem('accessToken');
  },

  setRefreshToken: (refreshToken) => {
    if (refreshToken) {
      sessionStorage.setItem('refreshToken', refreshToken);
    } else {
      sessionStorage.removeItem('refreshToken');
    }
  },

  getRefreshToken: () => {
    return sessionStorage.getItem('refreshToken');
  },

  setUser: (user) => {
    if (user) {
      sessionStorage.setItem('user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('user');
    }
  },

  getUser: () => {
    const userStr = sessionStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: () => {
    return !!authUtils.getAuthToken();
  },

  isAdmin: () => {
    const user = authUtils.getUser();
    return user && user.role === 'admin';
  },

  logout: () => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
  },
};

