import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Typography,
  Box,
  ListItemButton,
  TextField,
  InputAdornment,
  Collapse,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  ExpandLess,
  ExpandMore,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Home as HomeIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import UserAgreement from './UserAgreement';

function Sidebar({ 
  open, 
  onClose, 
  onModelChange, 
  currentModel, 
  models,
  chatSessions,
  currentSessionId,
  onSwitchSession,
  onCreateNewSession,
  onUpdateTitle,
  onRefreshModels,
  onDeleteSession,
  onBackToHome,
  chatHistory,
  isResponding,
  isRefreshing
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showModelDetails, setShowModelDetails] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [showAllModelsInfo, setShowAllModelsInfo] = useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const handleEditClick = (session) => {
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleTitleSubmit = async (sessionId) => {
    if (editTitle.trim()) {
      await onUpdateTitle(sessionId, editTitle);
    }
    setEditingSessionId(null);
  };

  const handleDeleteClick = (session) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (sessionToDelete) {
      await onDeleteSession(sessionToDelete.id);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  const handleAgreementClose = () => {
    setShowAgreement(false);
  };

  const handleModelDetailsClick = (model) => {
    setSelectedModel(model);
    setShowModelDetails(true);
  };

  const handleModelDetailsClose = () => {
    setShowModelDetails(false);
    setSelectedModel(null);
  };

  const handleAllModelsInfoClick = () => {
    setShowAllModelsInfo(true);
  };

  const handleAllModelsInfoClose = () => {
    setShowAllModelsInfo(false);
  };

  return (
    <>
      <UserAgreement 
        open={showAgreement} 
        onClose={handleAgreementClose}
        isFirstTime={false}
      />
      <Drawer
        variant="persistent"
        anchor="left"
        open={open}
        sx={{
          width: 280,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, justifyContent: 'space-between' }}>
          <Typography variant="h6">模型列表</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={handleAllModelsInfoClick} size="small" title="查看所有模型信息">
              <InfoIcon />
            </IconButton>
            <IconButton 
              onClick={onRefreshModels} 
              size="small"
              title="刷新模型状态"
              sx={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': {
                    transform: 'rotate(0deg)',
                  },
                  '100%': {
                    transform: 'rotate(360deg)',
                  },
                },
              }}
            >
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={onClose}>
              <ChevronLeftIcon />
            </IconButton>
          </Box>
        </Box>
        <Divider />
        <List>
          {models.map((model) => (
            <ListItem key={model.name} disablePadding>
              <ListItemButton
                selected={currentModel === model.name}
                onClick={() => onModelChange(model.name)}
                disabled={chatHistory.length > 0 || !model.running}
                sx={{
                  opacity: model.running ? 1 : 0.5,
                  '&.Mui-disabled': {
                    opacity: 0.5,
                  }
                }}
              >
                <ListItemText 
                  primary={model.name} 
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: model.running ? 'success.main' : 'text.secondary',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}
                      >
                        {model.running ? '● 运行中' : '○ 未运行'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {model.node}
                      </Typography>
                      {chatHistory.length > 0 && (
                        <Typography variant="caption" color="error" display="block">
                          需要清空对话才能切换
                        </Typography>
                      )}
                      {!model.running && (
                        <Typography variant="caption" color="error" display="block">
                          模型未运行
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleModelDetailsClick(model);
                  }}
                >
                  <InfoIcon />
                </IconButton>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<HomeIcon />}
            onClick={onBackToHome}
            fullWidth
            sx={{ 
              backgroundColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.dark',
              }
            }}
          >
            回到主页面
          </Button>
        </Box>
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, justifyContent: 'space-between' }}>
          <Typography variant="h6">聊天历史</Typography>
          <IconButton 
            onClick={onCreateNewSession}
            disabled={isResponding}
            title={isResponding ? "模型正在回复中，请稍后再试" : "新建聊天"}
            sx={{
              opacity: isResponding ? 0.5 : 1
            }}
          >
            <AddIcon />
          </IconButton>
        </Box>
        <List>
          {chatSessions.map((session) => (
            <React.Fragment key={session.id}>
              <ListItem disablePadding>
                {editingSessionId === session.id ? (
                  <Box sx={{ display: 'flex', width: '100%', p: 1 }}>
                    <TextField
                      size="small"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleTitleSubmit(session.id);
                        }
                      }}
                      autoFocus
                    />
                    <IconButton 
                      size="small" 
                      onClick={() => handleTitleSubmit(session.id)}
                    >
                      <CheckIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <ListItemButton
                    selected={currentSessionId === session.id}
                    onClick={() => onSwitchSession(session.id)}
                    disabled={isResponding}
                  >
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography>{session.title}</Typography>
                          <Box>
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(session);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(session);
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItemButton>
                )}
              </ListItem>
            </React.Fragment>
          ))}
        </List>
        <Box sx={{ mt: 'auto', p: 2, textAlign: 'center' }}>
          <Button
            variant="text"
            size="small"
            onClick={() => setShowAgreement(true)}
            sx={{ color: 'text.secondary' }}
          >
            查看使用协议
          </Button>
        </Box>
      </Drawer>
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          确定要删除会话 "{sessionToDelete?.title}" 吗？
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>取消</Button>
          <Button onClick={handleDeleteConfirm} color="error">删除</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={showModelDetails}
        onClose={handleModelDetailsClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>模型详情</DialogTitle>
        <DialogContent>
          {selectedModel && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                基本信息
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  模型名称: {selectedModel.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  运行状态: {selectedModel.running ? '运行中' : '未运行'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  运行节点: {selectedModel.node}
                </Typography>
              </Box>
              <Typography variant="subtitle1" gutterBottom>
                模型描述
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedModel.name.includes('QwQ') ? 
                  'QwQ是一个强大的中文大语言模型，擅长处理中文对话和文本生成任务。' :
                  selectedModel.name.includes('Qwen2.5') ?
                  'Qwen2.5是阿里云开发的多模态大语言模型，支持图像理解和文本生成。' :
                  '该模型正在开发中，即将上线。'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleModelDetailsClose}>关闭</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={showAllModelsInfo}
        onClose={handleAllModelsInfoClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>所有模型信息</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              模型总览
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                总模型数量: {models.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                运行中模型: {models.filter(m => m.running).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                可用节点: {[...new Set(models.filter(m => m.running).map(m => m.node))].join(', ') || '无'}
              </Typography>
            </Box>
            <Typography variant="subtitle1" gutterBottom>
              模型列表
            </Typography>
            <Box sx={{ mb: 2 }}>
              {models.map((model) => (
                <Box key={model.name} sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2">
                    {model.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    状态: {model.running ? '运行中' : '未运行'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    节点: {model.node}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAllModelsInfoClose}>关闭</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Sidebar; 