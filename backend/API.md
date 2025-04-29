# API 文档

## 基础信息

- 基础URL: `http://localhost:5000/api`
- 所有请求都需要在 header 中包含 `Content-Type: application/json`
- 除了登录和注册接口，其他接口都需要在 header 中包含 `Authorization: Bearer <token>`

## 认证相关

### 注册用户

- **URL**: `/register`
- **方法**: `POST`
- **描述**: 注册新用户
- **请求体**:
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string",
    "confirmPassword": "string",
    "is_admin": boolean
  }
  ```
- **响应**:
  - 成功 (201):
    ```json
    {
      "message": "注册成功"
    }
    ```
  - 失败 (400):
    ```json
    {
      "error": "错误信息"
    }
    ```

### 用户登录

- **URL**: `/login`
- **方法**: `POST`
- **描述**: 用户登录并获取访问令牌
- **请求体**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **响应**:
  - 成功 (200):
    ```json
    {
      "access_token": "string",
      "username": "string"
    }
    ```
  - 失败 (401):
    ```json
    {
      "error": "用户名或密码错误"
    }
    ```

## 用户相关

### 获取用户信息

- **URL**: `/user`
- **方法**: `GET`
- **描述**: 获取当前登录用户的信息
- **响应**:
  - 成功 (200):
    ```json
    {
      "username": "string",
      "email": "string",
      "current_model": "string"
    }
    ```
  - 失败 (404):
    ```json
    {
      "error": "用户不存在"
    }
    ```

### 更新用户信息

- **URL**: `/user`
- **方法**: `PUT`
- **描述**: 更新当前登录用户的信息
- **请求体**:
  ```json
  {
    "username": "string",
    "email": "string",
    "current_model": "string"
  }
  ```
- **响应**:
  - 成功 (200):
    ```json
    {
      "message": "更新成功",
      "username": "string",
      "email": "string",
      "current_model": "string"
    }
    ```
  - 失败 (400):
    ```json
    {
      "error": "错误信息"
    }
    ```

## 聊天相关

### 发送聊天消息

- **URL**: `/chat`
- **方法**: `POST`
- **描述**: 发送聊天消息并获取 AI 响应
- **请求体**:
  ```json
  {
    "message": "string",
    "model": "string"
  }
  ```
- **响应**:
  - 成功 (200):
    ```json
    {
      "response": "string"
    }
    ```
  - 失败 (400):
    ```json
    {
      "error": "错误信息"
    }
    ```

### 获取聊天历史

- **URL**: `/history`
- **方法**: `GET`
- **描述**: 获取用户的聊天历史记录
- **响应**:
  - 成功 (200):
    ```json
    [
      {
        "id": "integer",
        "username": "string",
        "user": "string",
        "ai": "string",
        "model": "string",
        "timestamp": "string"
      }
    ]
    ```

### 获取聊天会话列表

- **URL**: `/chat/sessions`
- **方法**: `GET`
- **描述**: 获取用户的所有聊天会话
- **响应**:
  - 成功 (200):
    ```json
    [
      {
        "id": "integer",
        "username": "string",
        "title": "string",
        "messages": "string",
        "createdAt": "string"
      }
    ]
    ```

### 创建聊天会话

- **URL**: `/chat/sessions`
- **方法**: `POST`
- **描述**: 创建新的聊天会话
- **请求体**:
  ```json
  {
    "title": "string",
    "messages": "string"
  }
  ```
- **响应**:
  - 成功 (201):
    ```json
    {
      "id": "integer",
      "title": "string",
      "messages": "string",
      "createdAt": "string"
    }
    ```

### 更新聊天会话

- **URL**: `/chat/sessions/<session_id>`
- **方法**: `PUT`
- **描述**: 更新指定聊天会话的信息
- **请求体**:
  ```json
  {
    "title": "string",
    "messages": "string"
  }
  ```
- **响应**:
  - 成功 (200):
    ```json
    {
      "message": "更新成功"
    }
    ```

### 删除聊天会话

- **URL**: `/chat/sessions/<session_id>`
- **方法**: `DELETE`
- **描述**: 删除指定的聊天会话
- **响应**:
  - 成功 (200):
    ```json
    {
      "message": "删除成功"
    }
    ```

## 管理员相关

### 获取公告

- **URL**: `/admin/announcement`
- **方法**: `GET`
- **描述**: 获取当前活动的公告
- **响应**:
  - 成功 (200):
    ```json
    {
      "content": "string",
      "created_at": "string",
      "display_start": "string",
      "display_end": "string",
      "is_active": "boolean"
    }
    ```

### 更新公告

- **URL**: `/admin/announcement`
- **方法**: `POST`
- **描述**: 更新系统公告（需要管理员权限）
- **请求体**:
  ```json
  {
    "content": "string",
    "display_start": "string",
    "display_end": "string",
    "is_active": "boolean"
  }
  ```
- **响应**:
  - 成功 (200):
    ```json
    {
      "message": "公告更新成功"
    }
    ```

### 获取管理员统计信息

- **URL**: `/admin/stats`
- **方法**: `GET`
- **描述**: 获取系统使用统计信息（需要管理员权限）
- **响应**:
  - 成功 (200):
    ```json
    {
      "total_users": "integer",
      "total_chats": "integer",
      "model_stats": {
        "model_name": {
          "current_users": "integer",
          "total_chats": "integer",
          "last_updated": "string"
        }
      }
    }
    ```

### 检查管理员状态

- **URL**: `/admin/check`
- **方法**: `GET`
- **描述**: 检查当前用户是否为管理员
- **响应**:
  - 成功 (200):
    ```json
    {
      "is_admin": "boolean"
    }
    ```

## 用户协议相关

### 获取用户协议

- **URL**: `/agreement`
- **方法**: `GET`
- **描述**: 获取当前用户协议内容
- **响应**:
  - 成功 (200):
    ```json
    {
      "content": "string",
      "created_at": "string"
    }
    ```

### 更新用户协议

- **URL**: `/agreement`
- **方法**: `POST`
- **描述**: 更新用户协议内容（需要管理员权限）
- **请求体**:
  ```json
  {
    "content": "string"
  }
  ```
- **响应**:
  - 成功 (200):
    ```json
    {
      "message": "协议更新成功"
    }
    ```

## 错误码说明

- 200: 请求成功
- 201: 创建成功
- 400: 请求参数错误
- 401: 未授权
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器内部错误

## 注意事项

1. 所有时间戳使用 ISO 8601 格式
2. 所有需要认证的接口都需要在请求头中包含有效的 JWT token
3. 管理员接口需要用户具有管理员权限
4. 聊天模型支持：gpt-3.5、gpt-4、claude 