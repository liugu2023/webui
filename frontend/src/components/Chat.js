import React, { useState, useEffect, useRef } from 'react';
import { 
  TextField, 
  Button, 
  Paper, 
  Typography, 
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Avatar,
  AppBar,
  Toolbar,
  Collapse,
  ListItemButton
} from '@mui/material';
import { Logout, Menu, ExpandLess, ExpandMore, Refresh, AdminPanelSettings, Stop } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';
import UserAgreement from './UserAgreement';
import config from '../config';

function Chat({ getToken, setToken }) {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [username, setUsername] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentModel, setCurrentModel] = useState('');
  const [models, setModels] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showAgreement, setShowAgreement] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const navigate = useNavigate();
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // 检查是否已经同意过使用须知
    const hasAgreed = localStorage.getItem('hasAgreedToTerms');
    if (!hasAgreed) {
      setShowAgreement(true);
    }
  }, []);

  const handleAgreementClose = () => {
    setShowAgreement(false);
    localStorage.setItem('hasAgreedToTerms', 'true');
  };

  useEffect(() => {
    const fetchModels = async () => {
      try {
        console.log('开始获取模型状态...');
        console.log('API地址:', `${config.MODEL_SERVICE_URL}/api/check-service`);
        
        // 固定的模型名称列表
        const modelNames = ['QwQ', 'Qwen2.5', 'DS-R1'];
        console.log('固定的模型列表:', modelNames);
        
        // 获取运行中的模型信息
        const response = await axios.get(`${config.MODEL_SERVICE_URL}/api/check-service`);
        console.log('API响应数据:', response.data);
        const runningModels = response.data.services || [];
        console.log('运行中的模型:', runningModels);
        
        // 更新模型状态
        const newModels = modelNames.map(modelName => {
          const runningModel = runningModels.find(m => m.job_name === modelName);
          console.log(`处理模型 ${modelName}:`, runningModel ? '找到运行状态' : '未运行');
          if (runningModel) {
            return {
              name: modelName,
              api: runningModel.api,
              node: runningModel.node,
              running: true,
              status: runningModel.status || 'running'
            };
          }
          return {
            name: modelName,
            api: '',
            node: '未部署',
            running: false,
            status: 'stopped'
          };
        });

        console.log('更新后的模型列表:', newModels);
        setModels(newModels);
        if (!currentModel && newModels.length > 0) {
          console.log('设置当前模型为:', newModels[0].name);
          setCurrentModel(newModels[0].name);
        }
      } catch (error) {
        console.error('获取模型状态失败:', error);
        console.error('错误详情:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: error.config
        });
      }
    };

    fetchModels();
    const interval = setInterval(fetchModels, 30000);
    return () => clearInterval(interval);
  }, [currentModel]);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = getToken();
        const response = await axios.get(`${config.API_BASE_URL}/api/user`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setUsername(response.data.username);
        
        // 获取用户信息后立即加载聊天记录
        await loadChatSessions();
      } catch (error) {
        console.error('Error fetching user info:', error);
        if (error.response?.status === 401) {
          setToken(null);
          navigate('/login');
        }
      }
    };

    fetchUserInfo();
  }, [getToken, setToken, navigate]);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const token = getToken();
        console.log('Token:', token); // 输出token
        
        if (!token) {
          console.log('No token available');
          return;
        }
        
        console.log('Fetching announcement...');
        const response = await axios.get(`${config.API_BASE_URL}/api/admin/announcement`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        console.log('Announcement response:', response.data);
        const content = response.data.content;
        console.log('Setting announcement content:', content);
        setAnnouncement(content || '');
      } catch (error) {
        console.error('Error fetching announcement:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          headers: error.response?.headers
        });
        setAnnouncement('');
      }
    };

    fetchAnnouncement();
    // 每5秒更新一次公告
    const interval = setInterval(fetchAnnouncement, 5000);
    return () => clearInterval(interval);
  }, [getToken]);

  // 当聊天历史变化时自动保存
  useEffect(() => {
    let saveTimeout;
    const saveWithDebounce = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          await saveCurrentSession();
        } catch (error) {
          console.error('Error saving session:', error);
        }
      }, 1000); // 1秒后保存，避免过于频繁的保存
    };

    saveWithDebounce();
    return () => clearTimeout(saveTimeout);
  }, [chatHistory, currentSessionId, chatSessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleStopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsResponding(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;

    // 检查是否有正在进行的回复
    if (isResponding) {
      alert('请等待当前回复完成后再发送新消息');
      return;
    }

    try {
      const currentModelInfo = models.find(m => m.name === currentModel);
      
      if (!currentModelInfo) {
        throw new Error('No model selected');
      }

      // 如果没有当前会话，创建一个新会话
      if (!currentSessionId) {
        const newSession = {
          title: '新对话',
          messages: [],
          createdAt: new Date()
        };
        const savedSession = await saveSessionToBackend(newSession);
        setChatSessions(prev => [savedSession, ...prev]);
        setCurrentSessionId(savedSession.id);
      }

      // 添加用户消息到历史记录
      const userMessage = { role: 'user', content: message };
      const newChatHistory = [...chatHistory, userMessage];
      setChatHistory(newChatHistory);
      setMessage('');

      // 立即保存用户消息
      await saveCurrentSession();

      // 添加一个空的助手消息用于流式更新
      const assistantMessage = { role: 'assistant', content: '' };
      setChatHistory(prev => [...prev, assistantMessage]);
      setIsResponding(true);

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();

      const response = await fetch(`${currentModelInfo.api}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            ...newChatHistory.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          ],
          temperature: 0.7,
          stream: true
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentContent = '';
      let lastSaveTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]?.delta?.content) {
                const newContent = parsed.choices[0].delta.content;
                currentContent += newContent;
                setChatHistory(prev => {
                  const newHistory = [...prev];
                  const lastMessage = newHistory[newHistory.length - 1];
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.content = currentContent;
                  }
                  return newHistory;
                });

                // 每2秒保存一次，避免过于频繁的保存
                const now = Date.now();
                if (now - lastSaveTime > 2000) {
                  await saveCurrentSession();
                  lastSaveTime = now;
                }
              }
            } catch (e) {
              console.error('Error parsing stream data:', e);
            }
          }
        }
      }

      // 最后保存一次完整的对话
      await saveCurrentSession();
    } catch (error) {
      console.error('Error sending message:', error);
      // 如果发生错误，移除空的助手消息
      setChatHistory(prev => prev.filter(msg => !(msg.role === 'assistant' && !msg.content)));
    } finally {
      setIsResponding(false);
    }
  };

  const handleModelChange = (modelName) => {
    if (chatHistory.length === 0) {
      setCurrentModel(modelName);
    } else {
      // 如果聊天记录不为空，提示用户需要创建新对话
      alert('请先创建新对话后再切换模型');
    }
  };

  const handleLogout = () => {
    setToken(null);
    navigate('/login');
  };

  const toggleThoughts = (index) => {
    setExpandedThoughts(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const renderMessageContent = (content, index) => {
    const thoughtMatch = content.match(/<think>(.*?)<\/think>/s);
    if (thoughtMatch) {
      const thoughtContent = thoughtMatch[1];
      const mainContent = content.replace(/<think>.*?<\/think>/s, '').trim();
      return (
        <Box>
          <Typography 
            variant="body1" 
            sx={{ 
              fontFamily: 'SimSun, serif', 
              color: 'black',
              whiteSpace: 'pre-wrap'
            }}
          >
            {mainContent}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <ListItemButton 
              onClick={() => toggleThoughts(index)}
              sx={{ p: 0 }}
            >
              <Typography variant="caption" color="text.secondary">
                思考过程
              </Typography>
              {expandedThoughts[index] ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={expandedThoughts[index]}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 1, 
                  mt: 1,
                  bgcolor: 'grey.100',
                  whiteSpace: 'pre-wrap'
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'SimSun, serif' }}>
                  {thoughtContent}
                </Typography>
              </Paper>
            </Collapse>
          </Box>
        </Box>
      );
    }
    return (
      <Typography 
        variant="body1" 
        sx={{ 
          fontFamily: 'SimSun, serif', 
          color: 'black',
          whiteSpace: 'pre-wrap'
        }}
      >
        {content}
      </Typography>
    );
  };

  // 从后端加载聊天会话
  const loadChatSessions = async () => {
    try {
      const token = getToken();
      const response = await axios.get(`${config.API_BASE_URL}/api/chat/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        withCredentials: true
      });
      // 确保每个会话的messages都是数组，并且格式正确
      const sessions = response.data.map(session => ({
        ...session,
        messages: Array.isArray(session.messages) ? session.messages.map(msg => ({
          role: msg.role || (msg.user ? 'user' : 'assistant'),
          content: msg.content || msg.text || ''
        })) : []
      }));
      console.log('Loaded sessions:', sessions);
      setChatSessions(sessions);
      
      // 如果有会话，设置第一个为当前会话并显示其消息
      if (sessions.length > 0) {
        const firstSession = sessions[0];
        setCurrentSessionId(firstSession.id);
        setChatHistory(firstSession.messages);
        console.log('Set initial session:', firstSession.id, 'Messages:', firstSession.messages);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
    }
  };

  // 切换会话
  const switchSession = async (sessionId) => {
    // 检查当前是否有正在进行的回复
    if (isResponding) {
      alert('请等待当前回复完成后再切换对话');
      return;
    }

    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      // 确保消息数组存在且格式正确
      const messages = Array.isArray(session.messages) ? session.messages : [];
      setCurrentSessionId(sessionId);
      setChatHistory(messages);
      
      // 滚动到底部
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // 保存会话到后端
  const saveSessionToBackend = async (session) => {
    try {
      const token = getToken();
      const sessionWithUsername = {
        ...session,
        username: username,
        messages: Array.isArray(session.messages) ? session.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })) : []
      };
      
      console.log('Saving session:', sessionWithUsername);
      
      if (session.id) {
        const response = await axios.put(`${config.API_BASE_URL}/api/chat/sessions/${session.id}`, sessionWithUsername, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          withCredentials: true
        });
        console.log('Save response:', response.data);
        return response.data;
      } else {
        const response = await axios.post(`${config.API_BASE_URL}/api/chat/sessions`, sessionWithUsername, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          withCredentials: true
        });
        console.log('Create response:', response.data);
        return response.data;
      }
    } catch (error) {
      console.error('Error saving session:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      throw error;
    }
  };

  // 创建新会话
  const createNewSession = async () => {
    const newSession = {
      title: '新对话',
      messages: [],
      createdAt: new Date()
    };
    try {
      const savedSession = await saveSessionToBackend(newSession);
      setChatSessions(prev => [savedSession, ...prev]);
      setCurrentSessionId(savedSession.id);
      setChatHistory([]);  // 清空当前聊天记录
    } catch (error) {
      console.error('Error creating new session:', error);
    }
  };

  // 更新会话标题
  const updateSessionTitle = async (sessionId, title) => {
    try {
      const session = chatSessions.find(s => s.id === sessionId);
      if (session) {
        const updatedSession = { ...session, title };
        await saveSessionToBackend(updatedSession);
        setChatSessions(prev => 
          prev.map(s => s.id === sessionId ? updatedSession : s)
        );
      }
    } catch (error) {
      console.error('Error updating session title:', error);
    }
  };

  // 保存当前会话
  const saveCurrentSession = async () => {
    if (currentSessionId) {
      const session = chatSessions.find(s => s.id === currentSessionId);
      if (session) {
        console.log('Current chat history:', chatHistory); // 添加日志
        const updatedSession = { 
          ...session, 
          messages: chatHistory,
          updatedAt: new Date().toISOString()
        };
        try {
          const savedSession = await saveSessionToBackend(updatedSession);
          console.log('Saved session:', savedSession); // 添加日志
          setChatSessions(prev => 
            prev.map(s => s.id === currentSessionId ? savedSession : s)
          );
        } catch (error) {
          console.error('Error saving current session:', error);
        }
      }
    }
  };

  const handleRefreshModels = async () => {
    if (isRefreshing) {
      console.log('刷新按钮已被禁用，正在刷新中...');
      return;
    }
    
    console.log('开始手动刷新模型状态...');
    setIsRefreshing(true);
    try {
      console.log('API地址:', `${config.MODEL_SERVICE_URL}/api/check-service`);
      
      // 固定的模型名称列表
      const modelNames = ['QwQ', 'Qwen2.5', 'DS-R1'];
      console.log('固定的模型列表:', modelNames);
      
      // 获取运行中的模型信息
      const response = await axios.get(`${config.MODEL_SERVICE_URL}/api/check-service`);
      console.log('API响应数据:', response.data);
      const runningModels = response.data.services || [];
      console.log('运行中的模型:', runningModels);
      
      // 更新模型状态
      const newModels = modelNames.map(modelName => {
        const runningModel = runningModels.find(m => m.job_name === modelName);
        console.log(`处理模型 ${modelName}:`, runningModel ? '找到运行状态' : '未运行');
        if (runningModel) {
          return {
            name: modelName,
            api: runningModel.api,
            node: runningModel.node,
            running: true,
            status: runningModel.status || 'running'
          };
        }
        return {
          name: modelName,
          api: '',
          node: '未部署',
          running: false,
          status: 'stopped'
        };
      });

      console.log('刷新后的模型列表:', newModels);
      setModels(newModels);
      if (!currentModel && newModels.length > 0) {
        console.log('设置当前模型为:', newModels[0].name);
        setCurrentModel(newModels[0].name);
      }
    } catch (error) {
      console.error('获取模型状态失败:', error);
      console.error('错误详情:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
    } finally {
      setTimeout(() => {
        console.log('刷新状态重置');
        setIsRefreshing(false);
      }, 500);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      const token = getToken();
      await axios.delete(`${config.API_BASE_URL}/api/chat/sessions/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // 从本地状态中移除会话
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // 如果删除的是当前会话，切换到第一个可用会话或清空
      if (sessionId === currentSessionId) {
        const remainingSessions = chatSessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          setCurrentSessionId(remainingSessions[0].id);
          setChatHistory(remainingSessions[0].messages);
        } else {
          setCurrentSessionId(null);
          setChatHistory([]);
        }
      }
    } catch (error) {
      console.error('删除会话失败:', error);
      alert('删除会话失败，请重试');
    }
  };

  const handleBackToHome = async () => {
    // 清空当前聊天记录
    setChatHistory([]);
    // 清空当前会话ID
    setCurrentSessionId(null);
    // 清空当前选中的模型
    setCurrentModel('');
    // 清空当前会话标题
    setMessage('');
    // 重新获取模型列表
    await handleRefreshModels();
  };

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const response = await axios.get(`${config.API_BASE_URL}/api/admin/check`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setIsAdmin(response.data.is_admin);
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    checkAdminStatus();
  }, [getToken]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey) {
        // Ctrl + Enter 换行
        e.preventDefault(); // 阻止默认行为
        const cursorPosition = e.target.selectionStart;
        const textBefore = message.substring(0, cursorPosition);
        const textAfter = message.substring(cursorPosition);
        const newMessage = textBefore + '\r\n' + textAfter;
        setMessage(newMessage);
        // 等待状态更新后设置光标位置
        setTimeout(() => {
          const input = e.target;
          input.selectionStart = cursorPosition + 2; // +2 因为 \r\n 是两个字符
          input.selectionEnd = cursorPosition + 2;
          input.focus();
        }, 0);
      } else {
        // 普通回车发送
        e.preventDefault();
        if (!isResponding && message.trim()) {
          handleSend();
        }
      }
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100%',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <UserAgreement 
        open={showAgreement} 
        onClose={handleAgreementClose} 
      />
      <Box sx={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '50px',
        bgcolor: 'primary.main',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden'
      }}>
        <Box sx={{
          display: 'inline-block',
          animation: 'marquee 15s linear infinite',
          '@keyframes marquee': {
            '0%': {
              transform: 'translateX(100%)'
            },
            '100%': {
              transform: 'translateX(-100%)'
            }
          }
        }}>
          <Typography 
            variant="body1" 
            sx={{ 
              px: 2,
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              whiteSpace: 'nowrap'
            }}
          >
            公告：{announcement || '暂无公告'}
          </Typography>
        </Box>
      </Box>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onModelChange={handleModelChange}
        currentModel={currentModel}
        models={models}
        chatSessions={chatSessions}
        currentSessionId={currentSessionId}
        onSwitchSession={switchSession}
        onCreateNewSession={createNewSession}
        onUpdateTitle={updateSessionTitle}
        onRefreshModels={handleRefreshModels}
        onDeleteSession={handleDeleteSession}
        onBackToHome={handleBackToHome}
        chatHistory={chatHistory}
        isResponding={isResponding}
        isRefreshing={isRefreshing}
      />
      
      <Box sx={{ 
        position: 'absolute',
        top: '50px',
        left: sidebarOpen ? '280px' : 0,
        right: 0,
        bottom: 0,
        display: 'flex', 
        flexDirection: 'column',
        transition: 'left 0.3s ease-in-out',
        bgcolor: 'background.paper'
      }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              sx={{ mr: 2 }}
            >
              <Menu />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {currentSessionId ? (chatSessions.find(s => s.id === currentSessionId)?.title || '新对话') : ''}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isAdmin && (
                <IconButton 
                  onClick={() => navigate('/admin')} 
                  color="primary"
                  title="管理员面板"
                >
                  <AdminPanelSettings />
                </IconButton>
              )}
              <IconButton 
                onClick={() => navigate('/profile')}
                color="primary"
              >
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  {username.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              <IconButton onClick={handleLogout} color="primary">
                <Logout />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <List>
            {chatHistory.map((chat, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemText
                    primary={chat.role === 'user' ? '用户' : 'AI助手'}
                    secondary={renderMessageContent(chat.content, index)}
                    sx={{ 
                      textAlign: chat.role === 'user' ? 'right' : 'left',
                      maxWidth: '80%',
                      margin: chat.role === 'user' ? '0 0 0 auto' : '0 auto 0 0',
                      '& .MuiTypography-root': {
                        whiteSpace: 'pre-wrap'
                      }
                    }}
                  />
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
            <div ref={messagesEndRef} />
          </List>
        </Box>

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter发送，Ctrl+Enter换行)"
              disabled={isResponding}
              inputProps={{
                style: { 
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'break-word',
                  lineHeight: '1.5'
                }
              }}
              sx={{
                '& .MuiInputBase-root': {
                  lineHeight: '1.5',
                  '& textarea': {
                    whiteSpace: 'pre-wrap'
                  }
                }
              }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {isResponding ? (
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleStopResponse}
                  startIcon={<Stop />}
                >
                  停止
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleSend}
                  disabled={!message.trim()}
                >
                  发送
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default Chat; 