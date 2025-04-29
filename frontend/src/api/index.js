import axios from 'axios';
import config from '../config';

// 创建axios实例
const api = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: 10000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 用户相关API
export const userApi = {
  // 登录
  login: (username, password) => 
    api.post('/api/login', { username, password }),
  
  // 注册
  register: (userData) => 
    api.post('/api/register', userData),
  
  // 获取用户信息
  getUserInfo: () => 
    api.get('/api/user'),
  
  // 更新用户信息
  updateUserInfo: (userData) => 
    api.put('/api/user', userData),
};

// 聊天相关API
export const chatApi = {
  // 获取聊天会话列表
  getChatSessions: () => 
    api.get('/api/chat/sessions'),
  
  // 创建新会话
  createSession: () => 
    api.post('/api/chat/sessions'),
  
  // 更新会话标题
  updateSessionTitle: (sessionId, title) => 
    api.put(`/api/chat/sessions/${sessionId}`, { title }),
  
  // 删除会话
  deleteSession: (sessionId) => 
    api.delete(`/api/chat/sessions/${sessionId}`),
  
  // 保存会话
  saveSession: (sessionId, data) => 
    api.post(`/api/chat/sessions/${sessionId}`, data),
};

// 模型相关API
export const modelApi = {
  // 获取模型状态
  getModelStatus: () => 
    axios.get(`${config.MODEL_SERVICE_URL}/api/check-service`),
};

// 管理员相关API
export const adminApi = {
  // 检查管理员权限
  checkAdminStatus: () => 
    api.get('/api/admin/check'),
  
  // 获取公告列表
  getAnnouncements: () => 
    api.get('/api/admin/announcements'),
  
  // 创建公告
  createAnnouncement: (data) => 
    api.post('/api/admin/announcements', data),
  
  // 更新公告
  updateAnnouncement: (id, data) => 
    api.put(`/api/admin/announcements/${id}`, data),
  
  // 删除公告
  deleteAnnouncement: (id) => 
    api.delete(`/api/admin/announcements/${id}`),
  
  // 获取当前公告
  getCurrentAnnouncement: () => 
    api.get('/api/admin/announcement'),
};

export default {
  userApi,
  chatApi,
  modelApi,
  adminApi,
}; 