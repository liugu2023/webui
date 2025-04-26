import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControlLabel,
  Checkbox,
  Box,
  LinearProgress,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

function UserAgreement({ open, onClose, isFirstTime = false }) {
  const [checked, setChecked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(isFirstTime ? 10 : 0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open && isFirstTime) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
        setProgress((prev) => {
          if (prev >= 100) {
            return 100;
          }
          return prev + (100 / 10);
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [open, isFirstTime]);

  const handleClose = () => {
    if (!isFirstTime || (checked && timeLeft === 0)) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isFirstTime}
      disableBackdropClick={isFirstTime}
    >
      <DialogTitle>
        使用须知
        {!isFirstTime && (
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body1" color="text.secondary" align="center">
            使用协议正在更新中，敬请期待...
          </Typography>
          {/* 
          <Typography variant="subtitle1" gutterBottom>
            基本说明
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            本服务是燕山大学本地部署的大模型服务，完全在校园网内运行，确保数据安全。
          </Typography>

          <Typography variant="subtitle1" gutterBottom>
            使用限制
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            1. 禁止使用本服务进行任何违法或不当行为
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            2. 禁止生成或传播有害、违法、色情等内容
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            3. 禁止将账号借给他人使用
          </Typography>

          <Typography variant="subtitle1" gutterBottom>
            使用建议
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            1. 如遇到响应较慢的情况，请耐心等待
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            2. 重要对话内容建议及时保存
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            3. 如遇到技术问题，请联系管理员
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            4. 请合理使用系统资源
          </Typography>

          <Typography variant="subtitle1" gutterBottom>
            隐私保护
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            1. 所有对话数据仅保存在本地服务器
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            2. 请勿在对话中分享敏感个人信息
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            3. 请妥善保管您的账号信息
          </Typography>

          <Typography variant="subtitle1" gutterBottom>
            免责声明
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            1. 模型生成的内容仅供参考，不代表学校观点
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            2. 用户需对使用本服务产生的后果负责
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            3. 如发现系统漏洞，请及时报告
          </Typography>

          <Typography variant="subtitle1" gutterBottom>
            联系方式
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            技术支持：xxx@ysu.edu.cn
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            问题反馈：xxx@ysu.edu.cn
          </Typography>
          */}
        </Box>
      </DialogContent>
      {isFirstTime && (
        <DialogActions>
          <FormControlLabel
            control={
              <Checkbox
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={timeLeft > 0}
              />
            }
            label="我已阅读并同意以上使用须知"
          />
          <Button
            onClick={handleClose}
            variant="contained"
            disabled={!checked || timeLeft > 0}
          >
            确认
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

export default UserAgreement; 