import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControlLabel,
  Switch
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

function AnnouncementDialog({ open, onClose, onSubmit, initialData }) {
  const [content, setContent] = useState('');
  const [displayStart, setDisplayStart] = useState(new Date());
  const [displayEnd, setDisplayEnd] = useState(new Date(Date.now() + 15 * 60000)); // 默认15分钟后
  const [isActive, setIsActive] = useState(true);

  // 当传入的初始数据变化时，更新表单值
  useEffect(() => {
    if (initialData) {
      setContent(initialData.content || '');
      setDisplayStart(initialData.display_start ? new Date(initialData.display_start) : new Date());
      setDisplayEnd(initialData.display_end ? new Date(initialData.display_end) : new Date(Date.now() + 15 * 60000));
      setIsActive(initialData.is_active !== undefined ? initialData.is_active : true);
    }
  }, [initialData, open]);

  const handleSubmit = () => {
    onSubmit({
      content,
      display_start: displayStart.toISOString(),
      display_end: displayEnd.toISOString(),
      is_active: isActive
    });
    handleClose();
  };

  const handleClose = () => {
    // 如果不是编辑模式，重置表单
    if (!initialData) {
      setContent('');
      setDisplayStart(new Date());
      setDisplayEnd(new Date(Date.now() + 15 * 60000));
      setIsActive(true);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initialData ? '编辑公告' : '创建公告'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="公告内容"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="开始时间"
              value={displayStart}
              onChange={(newValue) => setDisplayStart(newValue)}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
            <Box sx={{ height: 16 }} />
            <DateTimePicker
              label="结束时间"
              value={displayEnd}
              onChange={(newValue) => setDisplayEnd(newValue)}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </LocalizationProvider>
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            }
            label="立即启用"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!content.trim() || !displayStart || !displayEnd}
        >
          {initialData ? '更新' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AnnouncementDialog; 