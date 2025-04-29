import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Tooltip
} from '@mui/material';
import { Logout, ArrowBack, Add, Edit, Delete, Event, Schedule, CheckCircle, Cancel } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { format } from 'date-fns';
import axios from 'axios';
import config from '../config';
import AnnouncementDialog from './AnnouncementDialog';

function Admin({ getToken, setToken }) {
  const [announcements, setAnnouncements] = useState([]);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken(null);
    navigate('/login');
  };

  const loadAnnouncements = async () => {
    try {
      const token = getToken();
      const response = await axios.get(`${config.API_BASE_URL}/api/admin/announcements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnnouncements(response.data);
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
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
        await loadAnnouncements();
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

  const handleCreateAnnouncement = async (data) => {
    try {
      const token = getToken();
      await axios.post(
        `${config.API_BASE_URL}/api/admin/announcement`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      await loadAnnouncements();
      alert('公告创建成功！');
    } catch (error) {
      console.error('Error creating announcement:', error);
      alert('创建公告失败，请重试');
    }
  };

  const handleEditAnnouncement = async (data) => {
    try {
      const token = getToken();
      await axios.put(
        `${config.API_BASE_URL}/api/admin/announcement/${currentAnnouncement.id}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      await loadAnnouncements();
      alert('公告更新成功！');
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating announcement:', error);
      alert('更新公告失败，请重试');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('确定要删除这条公告吗？')) {
      return;
    }
    
    try {
      const token = getToken();
      await axios.delete(
        `${config.API_BASE_URL}/api/admin/announcement/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      await loadAnnouncements();
      alert('公告删除成功！');
    } catch (error) {
      console.error('Error deleting announcement:', error);
      alert('删除公告失败，请重试');
    }
  };

  const handleEditClick = (announcement) => {
    setCurrentAnnouncement(announcement);
    setEditDialogOpen(true);
  };

  // 检查公告是否过期
  const isExpired = (endTime) => {
    return new Date(endTime) < new Date();
  };

  // 检查公告是否尚未开始
  const isNotStarted = (startTime) => {
    return new Date(startTime) > new Date();
  };

  // 处理显示状态
  const getDisplayStatus = (announcement) => {
    const expired = isExpired(announcement.display_end);
    const notStarted = isNotStarted(announcement.display_start);
    const isActive = announcement.is_active && !expired && !notStarted;
    
    if (expired) {
      return {
        status: "已过期",
        color: "error",
        border: "error.main"
      };
    } else if (notStarted) {
      return {
        status: "未开始",
        color: "info",
        border: "info.main"
      };
    } else if (isActive) {
      return {
        status: "正在显示",
        color: "success",
        border: "success.main"
      };
    } else {
      return {
        status: "已禁用",
        color: "warning",
        border: "warning.main"
      };
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
        <Paper sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              公告列表
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setDialogOpen(true)}
              color="primary"
              size="large"
            >
              创建公告
            </Button>
          </Box>

          <Grid container spacing={3}>
            {announcements.map((announcement) => {
              const status = getDisplayStatus(announcement);
              
              return (
                <Grid item xs={12} md={6} key={announcement.id}>
                  <Card 
                    elevation={3}
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderLeft: `5px solid ${status.border}`,
                    }}
                  >
                    <CardContent sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6" component="div" gutterBottom noWrap sx={{ maxWidth: '70%' }}>
                          {announcement.content.length > 40 
                            ? `${announcement.content.substring(0, 40)}...` 
                            : announcement.content}
                        </Typography>
                        <Chip 
                          label={status.status} 
                          color={status.color}
                          size="small"
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {announcement.content}
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Event sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                        <Typography variant="body2" color="text.secondary">
                          开始: {format(new Date(announcement.display_start), 'yyyy-MM-dd HH:mm:ss')}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Schedule sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                        <Typography variant="body2" color="text.secondary">
                          结束: {format(new Date(announcement.display_end), 'yyyy-MM-dd HH:mm:ss')}
                        </Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                      <Tooltip title="编辑">
                        <IconButton 
                          onClick={() => handleEditClick(announcement)}
                          color="primary"
                          size="small"
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton 
                          onClick={() => handleDeleteAnnouncement(announcement.id)}
                          color="error"
                          size="small"
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {announcements.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Typography variant="body1" color="text.secondary">
                暂无公告，点击"创建公告"按钮添加新公告
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      <AnnouncementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateAnnouncement}
      />

      {currentAnnouncement && (
        <AnnouncementDialog
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setCurrentAnnouncement(null);
          }}
          onSubmit={handleEditAnnouncement}
          initialData={currentAnnouncement}
        />
      )}
    </Box>
  );
}

export default Admin; 