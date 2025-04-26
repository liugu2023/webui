import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import Profile from './components/Profile';
import Admin from './components/Admin';

// 生成唯一的标签页ID
const generateTabId = () => {
  return 'tab_' + Math.random().toString(36).substr(2, 9);
};

// 获取当前标签页的token
const getTabToken = () => {
  const tabId = sessionStorage.getItem('tabId') || generateTabId();
  sessionStorage.setItem('tabId', tabId);
  return localStorage.getItem(`token_${tabId}`);
};

// 设置当前标签页的token
const setTabToken = (token) => {
  const tabId = sessionStorage.getItem('tabId') || generateTabId();
  sessionStorage.setItem('tabId', tabId);
  if (token) {
    localStorage.setItem(`token_${tabId}`, token);
  } else {
    localStorage.removeItem(`token_${tabId}`);
  }
};

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const token = getTabToken();
  if (!token) {
    return <Navigate to="/login" />;
  }
  return children;
};

// 管理员路由组件
const AdminRoute = ({ children }) => {
  const token = getTabToken();
  if (!token) {
    return <Navigate to="/login" />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setToken={setTabToken} getToken={getTabToken} />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat getToken={getTabToken} setToken={setTabToken} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile getToken={getTabToken} setToken={setTabToken} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin getToken={getTabToken} setToken={setTabToken} />
            </AdminRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
