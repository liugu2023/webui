import React, { useState } from 'react';
import { 
  Container, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box,
  Link
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';

function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log('正在尝试登录...', { username });
      const response = await axios.post(`${config.API_BASE_URL}/api/login`, {
        username,
        password
      });
      
      console.log('登录成功:', response.data);
      setToken(response.data.access_token);
      navigate('/chat');
    } catch (err) {
      console.error('登录失败:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.status === 401 ? '用户名或密码错误' :
                          err.response?.status === 400 ? '请填写所有字段' :
                          err.response?.status === 500 ? '服务器错误' :
                          '登录失败，请稍后重试';
      setError(errorMessage);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          登录
        </Typography>
        
        {error && (
          <Typography color="error" align="center" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="用户名"
            variant="outlined"
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          
          <TextField
            fullWidth
            label="密码"
            type="password"
            variant="outlined"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <Button
            fullWidth
            variant="contained"
            color="primary"
            type="submit"
            sx={{ mt: 3 }}
          >
            登录
          </Button>
          
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Link 
              component="button" 
              variant="body2"
              onClick={() => navigate('/register')}
            >
              还没有账号？立即注册
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

export default Login; 