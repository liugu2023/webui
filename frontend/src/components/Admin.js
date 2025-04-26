import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  CircularProgress
} from '@mui/material';
import { Logout, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';

function Admin({ getToken, setToken }) {
  const [announcement, setAnnouncement] = useState('');
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken(null);
    navigate('/login');
  };

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const token = getToken();
        if (!token) {
          navigate('/login');
          return;
        }

        // 获取用户信息
        const userResponse = await axios.get(`${config.API_BASE_URL}/api/user`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsername(userResponse.data.username);

        // 检查是否是管理员
        const adminResponse = await axios.get(`${config.API_BASE_URL}/api/admin/check`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!adminResponse.data.is_admin) {
          navigate('/chat');
          return;
        }

        setIsAdmin(true);
        // 获取公告内容
        const announcementResponse = await axios.get(`${config.API_BASE_URL}/api/admin/announcement`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAnnouncement(announcementResponse.data.content || '');
      } catch (error) {
        console.error('Error checking admin status:', error);
        if (error.response?.status === 401) {
          setToken(null);
          navigate('/login');
        } else {
          navigate('/chat');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [getToken, setToken, navigate]);

  const handleBack = () => {
    navigate('/chat');
  };

  const handleSaveAnnouncement = async () => {
    try {
      const token = getToken();
      await axios.post(
        `${config.API_BASE_URL}/api/admin/announcement`,
        { content: announcement },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      alert('公告更新成功！');
    } catch (error) {
      console.error('Error updating announcement:', error);
      alert('更新公告失败，请重试');
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            公告管理
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1">
              {username}
            </Typography>
            <IconButton onClick={handleLogout} color="primary">
              <Logout />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            公告设置
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="输入公告内容"
            sx={{ mb: 2 }}
          />
          <Button 
            variant="contained" 
            onClick={handleSaveAnnouncement}
            fullWidth
          >
            保存公告
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}

export default Admin; 