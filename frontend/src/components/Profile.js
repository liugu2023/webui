import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  Box,
  Avatar,
  Button,
  TextField,
  Divider,
  IconButton
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';

function Profile({ getToken, setToken }) {
  const [userInfo, setUserInfo] = useState({
    username: '',
    email: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = getToken();
        const response = await axios.get(`${config.API_BASE_URL}/api/user`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setUserInfo(response.data);
      } catch (error) {
        console.error('Error fetching user info:', error);
        if (error.response?.status === 401) {
          setToken(null);
          navigate('/login');
        }
      }
    };

    fetchUserInfo();
  }, [navigate, getToken, setToken]);

  const handleUpdate = async () => {
    try {
      const token = getToken();
      await axios.put(`${config.API_BASE_URL}/api/user`, userInfo, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setEditMode(false);
      setError('');
    } catch (error) {
      console.error('Error updating user info:', error);
      setError(error.response?.data?.error || '更新失败');
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/chat')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ ml: 2 }}>
            个人资料
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Avatar 
            sx={{ 
              width: 100, 
              height: 100, 
              fontSize: '2.5rem',
              bgcolor: 'primary.main',
              mb: 2
            }}
          >
            {userInfo.username.charAt(0).toUpperCase()}
          </Avatar>
        </Box>

        {error && (
          <Typography color="error" align="center" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            用户名
          </Typography>
          {editMode ? (
            <TextField
              fullWidth
              value={userInfo.username}
              onChange={(e) => setUserInfo({ ...userInfo, username: e.target.value })}
              variant="outlined"
            />
          ) : (
            <Typography variant="body1">
              {userInfo.username}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            邮箱
          </Typography>
          {editMode ? (
            <TextField
              fullWidth
              value={userInfo.email}
              onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
              variant="outlined"
              type="email"
            />
          ) : (
            <Typography variant="body1">
              {userInfo.email}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          {editMode ? (
            <>
              <Button 
                variant="outlined" 
                onClick={() => setEditMode(false)}
                sx={{ mr: 2 }}
              >
                取消
              </Button>
              <Button 
                variant="contained" 
                onClick={handleUpdate}
              >
                保存
              </Button>
            </>
          ) : (
            <Button 
              variant="contained" 
              onClick={() => setEditMode(true)}
            >
              编辑资料
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

export default Profile; 