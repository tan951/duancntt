import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer, ConfirmModal } from '../components/ui';
import './AdminPage.css';

function AdminPage() {
  const navigate = useNavigate();
  const { user, logout, isAdmin, isAuthenticated } = useAuth();
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const { toasts, success, error: showError, removeToast } = useToast();
  
  // Confirm delete states
  const [confirmDelete, setConfirmDelete] = useState({
    isOpen: false,
    type: null, // 'user' or 'device'
    id: null,
    name: '',
  });

  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    gender: 'other',
    phoneNumber: '',
    dateOfBirth: '',
    role: 'patient',
  });

  const [deviceFormData, setDeviceFormData] = useState({
    deviceId: '',
    deviceName: '',
    owner: '',
    status: 'offline',
  });

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/login');
      return;
    }
    loadData();
  }, [navigate, isAuthenticated, isAdmin]);

  // Helper function để sắp xếp users: admin lên đầu
  const sortUsers = (usersList) => {
    return [...usersList].sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return 0;
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Chỉ load users và devices
      const [usersResponse, devicesResponse] = await Promise.all([
        apiService.getUsers(),
        apiService.getDevices(),
      ]);

      // Sắp xếp users: admin lên đầu, sau đó là patient
      setUsers(sortUsers(usersResponse.data || []));
      setDevices(devicesResponse.data || []);

    } catch (err) {
      setError(err.message || 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleUserFormChange = (e) => {
    setUserFormData({
      ...userFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const userData = {
        ...userFormData,
        phoneNumber: userFormData.phoneNumber || undefined,
        dateOfBirth: userFormData.dateOfBirth || undefined,
        password: userFormData.password || undefined,
      };
      
      const response = await apiService.register(userData);
      // Cập nhật state ngay lập tức và sắp xếp lại
      setUsers((prev) => sortUsers([...prev, response.data]));
      setShowUserForm(false);
      setUserFormData({
        username: '',
        password: '',
        fullName: '',
        gender: 'other',
        phoneNumber: '',
        dateOfBirth: '',
        role: 'patient',
      });
      success('Tạo người dùng thành công!');
    } catch (err) {
      console.error('Error creating user:', err);
      showError(err.message || 'Lỗi khi tạo người dùng');
    }
  };

  const handleEditUser = (userData) => {
    setEditingUser(userData);
    setUserFormData({
      username: userData.username,
      password: '',
      fullName: userData.fullName,
      gender: userData.gender || 'other',
      phoneNumber: userData.phoneNumber || '',
      dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth).toISOString().split('T')[0] : '',
      role: userData.role || 'patient',
    });
    setShowUserForm(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const userData = {
        fullName: userFormData.fullName,
        gender: userFormData.gender,
        phoneNumber: userFormData.phoneNumber || undefined,
        dateOfBirth: userFormData.dateOfBirth || undefined,
        role: userFormData.role,
      };
      
      if (userFormData.password) {
        userData.password = userFormData.password;
      }
      
      const response = await apiService.updateUser(editingUser._id, userData);
      // Cập nhật state ngay lập tức và sắp xếp lại
      setUsers((prev) => sortUsers(prev.map((u) => u._id === editingUser._id ? response.data : u)));
      setShowUserForm(false);
      setEditingUser(null);
      setUserFormData({
        username: '',
        password: '',
        fullName: '',
        gender: 'other',
        phoneNumber: '',
        dateOfBirth: '',
        role: 'patient',
      });
      success('Cập nhật người dùng thành công!');
    } catch (err) {
      console.error('Error updating user:', err);
      showError(err.message || 'Lỗi khi cập nhật người dùng. Vui lòng kiểm tra lại.');
    }
  };

  const handleDeleteUser = (user) => {
    // Kiểm tra nếu là admin và chỉ còn 1 admin thì không cho xóa
    if (user.role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount < 2) {
        showError('Không thể xóa admin cuối cùng. Hệ thống cần ít nhất 1 admin.');
        return;
      }
    }
    setConfirmDelete({
      isOpen: true,
      type: 'user',
      id: user._id,
      name: user.fullName || user.username,
    });
  };

  const confirmDeleteUser = async () => {
    // Kiểm tra lại trước khi xóa để đảm bảo không xóa admin cuối cùng
    const userToDelete = users.find(u => u._id === confirmDelete.id);
    if (userToDelete && userToDelete.role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount < 2) {
        setConfirmDelete({ isOpen: false, type: null, id: null, name: '' });
        showError('Không thể xóa admin cuối cùng. Hệ thống cần ít nhất 1 admin.');
        return;
      }
    }
    try {
      await apiService.deleteUser(confirmDelete.id);
      // Cập nhật state ngay lập tức
      setUsers((prev) => prev.filter((u) => u._id !== confirmDelete.id));
      setConfirmDelete({ isOpen: false, type: null, id: null, name: '' });
      success('Xóa người dùng thành công!');
    } catch (err) {
      console.error('Error deleting user:', err);
      setConfirmDelete({ isOpen: false, type: null, id: null, name: '' });
      showError(err.message || 'Lỗi khi xóa người dùng');
    }
  };

  const handleDeleteDevice = (device) => {
    setConfirmDelete({
      isOpen: true,
      type: 'device',
      id: device._id,
      name: device.deviceName || device.deviceId,
    });
  };

  const confirmDeleteDevice = async () => {
    try {
      await apiService.deleteDevice(confirmDelete.id);
      // Cập nhật state ngay lập tức
      setDevices((prev) => prev.filter((d) => d._id !== confirmDelete.id));
      setConfirmDelete({ isOpen: false, type: null, id: null, name: '' });
      success('Xóa thiết bị thành công!');
    } catch (err) {
      console.error('Error deleting device:', err);
      setConfirmDelete({ isOpen: false, type: null, id: null, name: '' });
      showError(err.message || 'Lỗi khi xóa thiết bị');
    }
  };

  const handleDeviceFormChange = (e) => {
    setDeviceFormData({
      ...deviceFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateDevice = async (e) => {
    e.preventDefault();
    try {
      const deviceData = {
        deviceId: deviceFormData.deviceId,
        deviceName: deviceFormData.deviceName || deviceFormData.deviceId,
        owner: deviceFormData.owner || undefined,
        status: deviceFormData.status,
      };
      
      const response = await apiService.createDevice(deviceData);
      // Cập nhật state ngay lập tức
      setDevices((prev) => [...prev, response.data]);
      setShowDeviceForm(false);
      setDeviceFormData({
        deviceId: '',
        deviceName: '',
        owner: '',
        status: 'offline',
      });
      success('Tạo thiết bị thành công!');
    } catch (err) {
      console.error('Error creating device:', err);
      showError(err.message || 'Lỗi khi tạo thiết bị');
    }
  };

  const handleEditDevice = (deviceData) => {
    setEditingDevice(deviceData);
    setDeviceFormData({
      deviceId: deviceData.deviceId,
      deviceName: deviceData.deviceName || '',
      owner: '', // Không pre-select, để có thể thêm owner mới
      status: deviceData.status || 'offline',
    });
    setShowDeviceForm(true);
  };

  const handleUpdateDevice = async (e) => {
    e.preventDefault();
    try {
      const deviceData = {
        deviceName: deviceFormData.deviceName,
        status: deviceFormData.status,
      };

      // Nếu có chọn owner mới, thêm vào owners array
      if (deviceFormData.owner) {
        deviceData.addOwner = deviceFormData.owner;
      }
      
      await apiService.updateDevice(editingDevice._id, deviceData);
      // Reload data để đảm bảo owners được populate đúng
      await loadData();
      setShowDeviceForm(false);
      setEditingDevice(null);
      setDeviceFormData({
        deviceId: '',
        deviceName: '',
        owner: '',
        status: 'offline',
      });
      success(deviceFormData.owner ? 'Đã thêm chủ sở hữu mới!' : 'Cập nhật thiết bị thành công!');
    } catch (err) {
      console.error('Error updating device:', err);
      showError(err.message || 'Lỗi khi cập nhật thiết bị');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  if (loading) {
    return <div className="admin-page loading">Đang tải...</div>;
  }

  return (
    <div className="admin-page">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title={confirmDelete.type === 'user' ? 'Xác nhận xóa người dùng' : 'Xác nhận xóa thiết bị'}
        message={
          confirmDelete.type === 'user'
            ? `Bạn có chắc chắn muốn xóa người dùng "${confirmDelete.name}"? Hành động này không thể hoàn tác.`
            : `Bạn có chắc chắn muốn xóa thiết bị "${confirmDelete.name}"? Hành động này không thể hoàn tác.`
        }
        confirmText="Xóa"
        cancelText="Hủy"
        onConfirm={confirmDelete.type === 'user' ? confirmDeleteUser : confirmDeleteDevice}
        onCancel={() => setConfirmDelete({ isOpen: false, type: null, id: null, name: '' })}
        type="danger"
      />
      
      <header className="admin-header">
        <h1>Quản Trị Hệ Thống</h1>
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

      <div className="admin-content">
        <div className="tabs">
          <button
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            Người Dùng
          </button>
          <button
            className={activeTab === 'devices' ? 'active' : ''}
            onClick={() => setActiveTab('devices')}
          >
            Thiết Bị
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'users' && (
            <div className="users-section">
              <div className="section-header">
                <h2>Quản Lý Người Dùng</h2>
                <button onClick={() => {
                  setShowUserForm(true);
                  setEditingUser(null);
                  setUserFormData({
                    username: '',
                    password: '',
                    fullName: '',
                    gender: 'other',
                    phoneNumber: '',
                    dateOfBirth: '',
                    role: 'patient',
                  });
                }} className="add-btn">
                  + Thêm Người Dùng
                </button>
              </div>

              {showUserForm && (
                <div className="modal" onClick={() => {
                  setShowUserForm(false);
                  setEditingUser(null);
                  setUserFormData({
                    username: '',
                    password: '',
                    fullName: '',
                    gender: 'other',
                    phoneNumber: '',
                    dateOfBirth: '',
                    role: 'patient',
                  });
                }}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <h3>{editingUser ? 'Sửa Người Dùng' : 'Thêm Người Dùng Mới'}</h3>
                    <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
                      {!editingUser && (
                        <div className="form-group">
                          <label>Tên đăng nhập *</label>
                          <input
                            type="text"
                            name="username"
                            value={userFormData.username}
                            onChange={handleUserFormChange}
                            required
                          />
                        </div>
                      )}
                      <div className="form-group">
                        <label>Họ và tên *</label>
                        <input
                          type="text"
                          name="fullName"
                          value={userFormData.fullName}
                          onChange={handleUserFormChange}
                          required
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Mật khẩu {editingUser ? '(để trống nếu không đổi)' : '*'}</label>
                          <input
                            type="password"
                            name="password"
                            value={userFormData.password}
                            onChange={handleUserFormChange}
                            required={!editingUser}
                          />
                        </div>
                        <div className="form-group">
                          <label>Vai trò</label>
                          <select
                            name="role"
                            value={userFormData.role}
                            onChange={handleUserFormChange}
                          >
                            <option value="patient">Bệnh nhân</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Giới tính</label>
                          <select
                            name="gender"
                            value={userFormData.gender}
                            onChange={handleUserFormChange}
                          >
                            <option value="male">Nam</option>
                            <option value="female">Nữ</option>
                            <option value="other">Khác</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Ngày sinh</label>
                          <input
                            type="date"
                            name="dateOfBirth"
                            value={userFormData.dateOfBirth}
                            onChange={handleUserFormChange}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Số điện thoại</label>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={userFormData.phoneNumber}
                          onChange={handleUserFormChange}
                          placeholder="Nhập số điện thoại"
                        />
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="modal-submit-btn">
                          {editingUser ? 'Cập Nhật' : 'Tạo Mới'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserForm(false);
                            setEditingUser(null);
                            setUserFormData({
                              username: '',
                              password: '',
                              fullName: '',
                              gender: 'other',
                              phoneNumber: '',
                              dateOfBirth: '',
                              role: 'patient',
                            });
                          }}
                          className="cancel-btn"
                        >
                          Hủy
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Vai trò</th>
                    <th>Giới tính</th>
                    <th>Tuổi</th>
                    <th>SĐT</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const adminCount = users.filter(user => user.role === 'admin').length;
                    const canDeleteAdmin = adminCount >= 2;
                    const isAdmin = u.role === 'admin';
                    const showDeleteButton = !isAdmin || (isAdmin && canDeleteAdmin);
                    
                    return (
                      <tr key={u._id}>
                        <td>{u.fullName}</td>
                        <td>{u.role === 'admin' ? 'Admin' : 'Bệnh nhân'}</td>
                        <td>{u.gender === 'male' ? 'Nam' : u.gender === 'female' ? 'Nữ' : 'Khác'}</td>
                        <td>{u.age !== null && u.age !== undefined ? `${u.age} tuổi` : '-'}</td>
                        <td>{u.phoneNumber || '-'}</td>
                        <td>
                          <button onClick={() => handleEditUser(u)} className="edit-btn">Sửa</button>
                          {showDeleteButton && (
                            <button onClick={() => handleDeleteUser(u)} className="delete-btn">Xóa</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'devices' && (
            <div className="devices-section">
              <div className="section-header">
                <h2>Quản Lý Thiết Bị</h2>
                <button onClick={() => {
                  setShowDeviceForm(true);
                  setEditingDevice(null);
                  setDeviceFormData({
                    deviceId: '',
                    deviceName: '',
                    owner: '',
                    status: 'offline',
                  });
                }} className="add-btn">
                  + Thêm Thiết Bị
                </button>
              </div>

              {showDeviceForm && (
                <div className="modal" onClick={() => {
                  setShowDeviceForm(false);
                  setEditingDevice(null);
                  setDeviceFormData({
                    deviceId: '',
                    deviceName: '',
                    owner: '',
                    status: 'offline',
                  });
                }}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <h3>{editingDevice ? 'Sửa Thiết Bị' : 'Thêm Thiết Bị Mới'}</h3>
                    <form onSubmit={editingDevice ? handleUpdateDevice : handleCreateDevice}>
                      {!editingDevice && (
                        <div className="form-group">
                          <label>Device ID *</label>
                          <input
                            type="text"
                            name="deviceId"
                            value={deviceFormData.deviceId}
                            onChange={handleDeviceFormChange}
                            required
                            placeholder="Nhập Device ID"
                          />
                        </div>
                      )}
                      <div className="form-group">
                        <label>Tên thiết bị</label>
                        <input
                          type="text"
                          name="deviceName"
                          value={deviceFormData.deviceName}
                          onChange={handleDeviceFormChange}
                          placeholder="Nhập tên thiết bị"
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>{editingDevice ? 'Thêm chủ sở hữu mới' : 'Chủ sở hữu'}</label>
                          {editingDevice && (
                            <div style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#666', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                              <strong>Chủ sở hữu hiện tại:</strong>
                              {(() => {
                                const currentOwners = editingDevice.owners || [];
                                let ownersList = [];
                                if (currentOwners.length > 0) {
                                  ownersList = currentOwners;
                                } else if (editingDevice.owner) {
                                  ownersList = [editingDevice.owner];
                                }
                                
                                if (ownersList.length === 0) {
                                  return <div style={{ marginTop: '4px' }}>Chưa có</div>;
                                }
                                
                                return (
                                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {ownersList.map((owner, idx) => {
                                      const ownerId = owner._id || owner;
                                      const ownerName = owner.fullName || owner.username || owner;
                                      return (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                                          <span>{ownerName}</span>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                // Gọi API để xóa owner và nhận device đã cập nhật
                                                const response = await apiService.updateDevice(editingDevice._id, { removeOwner: ownerId });
                                                
                                                // Cập nhật editingDevice ngay từ response để UI cập nhật ngay
                                                if (response && response.data) {
                                                  setEditingDevice(response.data);
                                                  // Đồng thời cập nhật devices state
                                                  setDevices(prev => prev.map(d => d._id === editingDevice._id ? response.data : d));
                                                }
                                                
                                                success('Đã xóa chủ sở hữu khỏi thiết bị!');
                                              } catch (err) {
                                                console.error('Error removing owner:', err);
                                                showError(err.message || 'Lỗi khi xóa chủ sở hữu');
                                              }
                                            }}
                                            className="delete-btn"
                                            style={{ padding: '2px 8px', fontSize: '0.8rem', margin: 0 }}
                                            title="Xóa chủ sở hữu"
                                          >
                                            Xóa
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                          <select
                            name="owner"
                            value={deviceFormData.owner}
                            onChange={handleDeviceFormChange}
                            required={!editingDevice}
                          >
                            <option value="">-- Chọn người dùng --</option>
                            {users
                              .filter((user) => {
                                // Nếu đang edit, loại bỏ các owners đã có
                                if (editingDevice) {
                                  const currentOwners = editingDevice.owners || [];
                                  const ownerIds = currentOwners.map(o => (o._id || o).toString());
                                  // Nếu không có owners nhưng có owner, thêm owner vào danh sách loại bỏ
                                  if (ownerIds.length === 0 && editingDevice.owner) {
                                    ownerIds.push((editingDevice.owner._id || editingDevice.owner).toString());
                                  }
                                  return user.role === 'patient' && !ownerIds.includes(user._id);
                                }
                                return user.role === 'patient';
                              })
                              .map((user) => (
                                <option key={user._id} value={user._id}>
                                  {user.fullName || user.username}
                                </option>
                              ))}
                          </select>
                          {editingDevice && (
                            <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                              Chọn người dùng để thêm vào danh sách chủ sở hữu
                            </small>
                          )}
                        </div>
                        <div className="form-group">
                          <label>Trạng thái</label>
                          <select
                            name="status"
                            value={deviceFormData.status}
                            onChange={handleDeviceFormChange}
                          >
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="modal-submit-btn">
                          {editingDevice ? 'Cập Nhật' : 'Tạo Mới'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeviceForm(false);
                            setEditingDevice(null);
                            setDeviceFormData({
                              deviceId: '',
                              deviceName: '',
                              owner: '',
                              status: 'offline',
                            });
                          }}
                          className="cancel-btn"
                        >
                          Hủy
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên thiết bị</th>
                    <th>Chủ sở hữu</th>
                    <th>Trạng thái</th>
                    <th>Lần cuối</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device._id}>
                      <td>{device.deviceName || device.deviceId || '-'}</td>
                      <td>
                        {(() => {
                          const owners = device.owners || [];
                          if (owners.length > 0) {
                            return (
                              <div>
                                {owners.map((owner, idx) => {
                                  // Nếu owner là ObjectId string, tìm trong users list
                                  let ownerData = owner;
                                  if (typeof owner === 'string' || (owner && !owner.fullName && !owner.username)) {
                                    ownerData = users.find(u => u._id === (owner._id || owner));
                                  }
                                  
                                  return (
                                    <span key={idx}>
                                      {ownerData?.fullName || ownerData?.username || owner}
                                      {idx < owners.length - 1 ? ', ' : ''}
                                    </span>
                                  );
                                })}
                                <span style={{ marginLeft: '8px', color: '#666', fontSize: '0.9rem' }}>
                                  ({owners.length})
                                </span>
                              </div>
                            );
                          } else if (device.owner) {
                            // Nếu owner là ObjectId string, tìm trong users list
                            let ownerData = device.owner;
                            if (typeof device.owner === 'string' || (device.owner && !device.owner.fullName && !device.owner.username)) {
                              ownerData = users.find(u => u._id === (device.owner._id || device.owner));
                            }
                            return ownerData?.fullName || ownerData?.username || device.owner;
                          }
                          return '-';
                        })()}
                      </td>
                      <td>
                        <span className={device.status === 'online' ? 'status-online' : 'status-offline'}>
                          {device.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td>{device.lastSeen ? formatDate(device.lastSeen) : '-'}</td>
                      <td>
                        <button onClick={() => handleEditDevice(device)} className="edit-btn">Sửa</button>
                        <button onClick={() => handleDeleteDevice(device)} className="delete-btn">
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default AdminPage;

