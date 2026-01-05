import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui';
import { PasswordInput } from '../components/ui';
import './ProfilePage.css';

function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, updateUser } = useAuth();
  const { toasts, success, error: showError, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    gender: 'other',
    phoneNumber: '',
    dateOfBirth: '',
    oldPassword: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadUserData();
  }, [navigate, isAuthenticated, user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUserById(user.id || user._id);
      setUserData(response.data);
      setFormData({
        fullName: response.data.fullName || '',
        gender: response.data.gender || 'other',
        phoneNumber: response.data.phoneNumber || '',
        dateOfBirth: response.data.dateOfBirth 
          ? new Date(response.data.dateOfBirth).toISOString().split('T')[0] 
          : '',
        oldPassword: '',
        password: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Error loading user data:', err);
      showError(err.message || 'Lỗi khi tải thông tin người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Kiểm tra mật khẩu nếu có thay đổi
    if (formData.password) {
      // Nếu muốn đổi mật khẩu, phải nhập mật khẩu cũ
      if (!formData.oldPassword) {
        showError('Vui lòng nhập mật khẩu cũ để xác nhận');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        showError('Mật khẩu xác nhận không khớp');
        return;
      }

      if (formData.password.length < 6) {
        showError('Mật khẩu phải có ít nhất 6 ký tự');
        return;
      }
    }

    try {
      setSaving(true);
      const updateData = {
        fullName: formData.fullName,
        gender: formData.gender,
        phoneNumber: formData.phoneNumber || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
      };

      if (formData.password) {
        updateData.oldPassword = formData.oldPassword;
        updateData.password = formData.password;
      }

      const response = await apiService.updateUser(user.id || user._id, updateData);
      
      // Cập nhật user trong context
      if (updateUser) {
        updateUser({
          ...user,
          fullName: response.data.fullName,
        });
      }

      // Reset password fields
      setFormData({
        ...formData,
        oldPassword: '',
        password: '',
        confirmPassword: '',
      });

      success('Cập nhật thông tin thành công!');
    } catch (err) {
      console.error('Error updating profile:', err);
      showError(err.message || 'Lỗi khi cập nhật thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (user?.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return <div className="profile-page loading">Đang tải...</div>;
  }

  return (
    <div className="profile-page">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <header className="profile-header">
        <button onClick={handleBack} className="back-btn">← Quay lại</button>
        <h1>Thông Tin Cá Nhân</h1>
      </header>

      <div className="profile-content">
        <div className="profile-card">
          <form onSubmit={handleSubmit} className="profile-form">
            {/* Thông tin tài khoản (Read-only) */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="username">Tên đăng nhập</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={userData?.username || ''}
                  disabled
                  className="disabled-input"
                />
                <small>Không thể thay đổi</small>
              </div>

              <div className="form-group">
                <label htmlFor="role">Vai trò</label>
                <input
                  type="text"
                  id="role"
                  name="role"
                  value={userData?.role === 'admin' ? 'Admin' : 'Bệnh nhân'}
                  disabled
                  className="disabled-input"
                />
                <small>Không thể thay đổi</small>
              </div>
            </div>

            {/* Thông tin cá nhân */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fullName">Họ và tên *</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="Nhập họ và tên"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phoneNumber">Số điện thoại</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="Nhập số điện thoại"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="gender">Giới tính</label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="dateOfBirth">Ngày sinh</label>
                <input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Tuổi</label>
                <input
                  type="text"
                  value={(() => {
                    if (!formData.dateOfBirth) return '-';
                    const today = new Date();
                    const dob = new Date(formData.dateOfBirth);
                    let age = today.getFullYear() - dob.getFullYear();
                    const monthDiff = today.getMonth() - dob.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                      age--;
                    }
                    return age >= 0 ? `${age} tuổi` : '-';
                  })()}
                  disabled
                  className="disabled-input"
                />
                <small>Tự động tính từ ngày sinh</small>
              </div>
            </div>

            <div className="password-section">
              <h3>Thay đổi mật khẩu</h3>
              <p className="section-description">Để trống nếu không muốn thay đổi mật khẩu</p>

              <PasswordInput
                label="Mật khẩu cũ *"
                id="oldPassword"
                name="oldPassword"
                value={formData.oldPassword}
                onChange={handleChange}
                placeholder="Nhập mật khẩu hiện tại"
                required={!!formData.password}
              />

              <PasswordInput
                label="Mật khẩu mới"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
              />

              <PasswordInput
                label="Xác nhận mật khẩu mới"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Nhập lại mật khẩu mới"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn" disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
              <button type="button" onClick={handleBack} className="cancel-btn">
                Hủy
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;

