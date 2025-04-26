from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta, datetime
import bcrypt
from dotenv import load_dotenv
import os
import sqlite3
from contextlib import closing
import json
from functools import wraps
import jwt

load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True)

# JWT配置
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
jwt = JWTManager(app)

# 数据库配置
DATABASE = 'users.db'

def init_db():
    with closing(sqlite3.connect(DATABASE)) as db:
        with open('schema.sql', 'r') as f:
            db.cursor().executescript(f.read())
        db.commit()

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

# 支持的模型列表
AVAILABLE_MODELS = ['gpt-3.5', 'gpt-4', 'claude']

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirmPassword')
    is_admin = data.get('is_admin', False)  # 默认为非管理员

    if not all([username, email, password, confirm_password]):
        return jsonify({'error': '请填写所有字段'}), 400

    if password != confirm_password:
        return jsonify({'error': '两次输入的密码不一致'}), 400

    db = get_db()
    cursor = db.cursor()
    
    # 检查用户名是否已存在
    cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
    if cursor.fetchone():
        return jsonify({'error': '用户名已存在'}), 400

    # 创建新用户
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    cursor.execute('''
        INSERT INTO users (username, email, password, current_model, is_admin)
        VALUES (?, ?, ?, ?, ?)
    ''', (username, email, hashed_password, 'gpt-3.5', is_admin))
    db.commit()
    
    return jsonify({'message': '注册成功'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    print(f'收到登录请求 - 用户名: {username}')

    if not all([username, password]):
        print('登录失败: 缺少必要字段')
        return jsonify({'error': '请填写所有字段'}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()

    if not user:
        print(f'登录失败: 用户 {username} 不存在')
        return jsonify({'error': '用户名或密码错误'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user['password']):
        print(f'登录失败: 用户 {username} 密码错误')
        return jsonify({'error': '用户名或密码错误'}), 401

    print(f'用户 {username} 登录成功')
    access_token = create_access_token(identity=username)
    return jsonify({
        'access_token': access_token,
        'username': username
    }), 200

@app.route('/api/user', methods=['GET'])
@jwt_required()
def get_user():
    current_user = get_jwt_identity()
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ?', (current_user,))
    user = cursor.fetchone()
    
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    
    return jsonify({
        'username': user['username'],
        'email': user['email'],
        'current_model': user['current_model']
    })

@app.route('/api/user', methods=['PUT'])
@jwt_required()
def update_user():
    current_user = get_jwt_identity()
    data = request.json
    new_username = data.get('username')
    new_email = data.get('email')
    new_model = data.get('current_model')

    if not all([new_username, new_email]):
        return jsonify({'error': '请填写所有字段'}), 400

    db = get_db()
    cursor = db.cursor()

    # 检查新用户名是否已被其他用户使用
    if new_username != current_user:
        cursor.execute('SELECT id FROM users WHERE username = ?', (new_username,))
        if cursor.fetchone():
            return jsonify({'error': '用户名已存在'}), 400

    # 检查模型是否有效
    if new_model and new_model not in AVAILABLE_MODELS:
        return jsonify({'error': '无效的模型'}), 400

    # 更新用户信息
    cursor.execute('''
        UPDATE users 
        SET username = ?, email = ?, current_model = ?
        WHERE username = ?
    ''', (new_username, new_email, new_model or 'gpt-3.5', current_user))
    db.commit()
    
    return jsonify({
        'message': '更新成功',
        'username': new_username,
        'email': new_email,
        'current_model': new_model or 'gpt-3.5'
    })

@app.route('/api/chat', methods=['POST'])
@jwt_required()
def chat():
    current_user = get_jwt_identity()
    data = request.json
    message = data.get('message', '')
    model = data.get('model', 'gpt-3.5')
    
    if not message:
        return jsonify({'error': '消息不能为空'}), 400
    
    if model not in AVAILABLE_MODELS:
        return jsonify({'error': '无效的模型'}), 400
    
    # 更新用户当前使用的模型
    db = get_db()
    cursor = db.cursor()
    cursor.execute('UPDATE users SET current_model = ? WHERE username = ?', (model, current_user))
    
    # 更新模型使用统计
    update_model_stats(model, True)  # 开始使用
    
    # 这里可以添加与AI模型的交互逻辑
    response = f"AI ({model}): 我收到了你的消息: {message}"
    
    # 保存到历史记录
    cursor.execute('''
        INSERT INTO chat_history (username, user, ai, model, timestamp)
        VALUES (?, ?, ?, ?, ?)
    ''', (current_user, message, response, model, str(datetime.now())))
    
    # 更新模型使用统计
    cursor.execute('''
        UPDATE model_stats 
        SET total_chats = total_chats + 1
        WHERE model_name = ?
    ''', (model,))
    
    db.commit()
    
    return jsonify({
        'response': response,
        'history': get_history()
    })

@app.route('/api/history', methods=['GET'])
@jwt_required()
def get_history():
    current_user = get_jwt_identity()
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM chat_history WHERE username = ? ORDER BY timestamp DESC', (current_user,))
    history = cursor.fetchall()
    
    return jsonify([{
        'id': row['id'],
        'user': row['user'],
        'ai': row['ai'],
        'model': row['model'],
        'timestamp': row['timestamp']
    } for row in history])

@app.route('/api/chat/sessions', methods=['GET'])
@jwt_required()
def get_chat_sessions():
    try:
        current_user = get_jwt_identity()
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT * FROM chat_sessions WHERE username = ?', (current_user,))
        sessions = cursor.fetchall()
        
        result = []
        for row in sessions:
            try:
                # 尝试解析 messages 字段
                if row['messages']:
                    try:
                        messages = json.loads(row['messages'])
                    except json.JSONDecodeError:
                        # 如果解析失败，尝试修复格式
                        messages_str = row['messages'].replace("'", '"')
                        try:
                            messages = json.loads(messages_str)
                        except json.JSONDecodeError:
                            messages = []
                else:
                    messages = []
                
                result.append({
                    'id': row['id'],
                    'title': row['title'],
                    'messages': messages,
                    'createdAt': row['createdAt']
                })
            except Exception as e:
                print(f"Error processing session {row['id']}: {str(e)}")
                continue
        
        return jsonify(result)
    except Exception as e:
        print(f"Error in get_chat_sessions: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/sessions', methods=['POST'])
@jwt_required()
def create_chat_session():
    try:
        current_user = get_jwt_identity()
        data = request.json
        title = data.get('title', '新对话')
        messages = data.get('messages', [])
        
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            INSERT INTO chat_sessions (username, title, messages, createdAt)
            VALUES (?, ?, ?, ?)
        ''', (current_user, title, json.dumps(messages, ensure_ascii=False), str(datetime.now())))
        db.commit()
        
        session_id = cursor.lastrowid
        return jsonify({
            'id': session_id,
            'title': title,
            'messages': messages,
            'createdAt': str(datetime.now())
        })
    except Exception as e:
        print(f"Error in create_chat_session: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/sessions/<int:session_id>', methods=['PUT'])
@jwt_required()
def update_chat_session(session_id):
    try:
        current_user = get_jwt_identity()
        data = request.json
        title = data.get('title')
        messages = data.get('messages')
        
        db = get_db()
        cursor = db.cursor()
        
        # 检查会话是否存在且属于当前用户
        cursor.execute('SELECT * FROM chat_sessions WHERE id = ? AND username = ?', (session_id, current_user))
        session = cursor.fetchone()
        if not session:
            return jsonify({'error': '会话不存在'}), 404
        
        # 更新会话
        if title is not None:
            cursor.execute('UPDATE chat_sessions SET title = ? WHERE id = ?', (title, session_id))
        if messages is not None:
            cursor.execute('UPDATE chat_sessions SET messages = ? WHERE id = ?', 
                         (json.dumps(messages, ensure_ascii=False), session_id))
        db.commit()
        
        return jsonify({
            'id': session_id,
            'title': title or session['title'],
            'messages': messages or json.loads(session['messages']) if session['messages'] else [],
            'createdAt': session['createdAt']
        })
    except Exception as e:
        print(f"Error in update_chat_session: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
def delete_chat_session(session_id):
    try:
        current_user = get_jwt_identity()
        db = get_db()
        cursor = db.cursor()
        
        # 检查会话是否存在且属于当前用户
        cursor.execute('SELECT * FROM chat_sessions WHERE id = ? AND username = ?', (session_id, current_user))
        session = cursor.fetchone()
        if not session:
            return jsonify({'error': '会话不存在'}), 404
        
        # 删除会话
        cursor.execute('DELETE FROM chat_sessions WHERE id = ?', (session_id,))
        db.commit()
        
        return jsonify({'message': '删除成功'})
    except Exception as e:
        print(f"Error in delete_chat_session: {str(e)}")
        return jsonify({'error': str(e)}), 500

# JWT验证装饰器
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(' ')[1]
        
        if not token:
            return jsonify({'message': '缺少token'}), 401
        
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user = data['username']
        except:
            return jsonify({'message': '无效的token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# 管理员验证装饰器
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(' ')[1]
        
        if not token:
            return jsonify({'message': '缺少token'}), 401
        
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user = data['username']
            
            # 检查用户是否是管理员
            conn = sqlite3.connect(DATABASE)
            c = conn.cursor()
            c.execute('SELECT is_admin FROM users WHERE username = ?', (current_user,))
            result = c.fetchone()
            conn.close()
            
            if not result or not result[0]:
                return jsonify({'message': '需要管理员权限'}), 403
                
        except:
            return jsonify({'message': '无效的token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# 获取公告内容
@app.route('/api/admin/announcement', methods=['GET'])
@jwt_required()
def get_announcement():
    try:
        db = get_db()
        cursor = db.cursor()
        # 只获取15分钟内的最新公告
        cursor.execute('''
            SELECT content FROM announcements 
            WHERE datetime(created_at) > datetime('now', '-15 minutes')
            ORDER BY created_at DESC LIMIT 1
        ''')
        result = cursor.fetchone()
        
        print('Announcement query result:', result)
        print('Result type:', type(result))
        print('Result keys:', result.keys() if result else None)
        print('Result values:', list(result) if result else None)
        
        if result:
            content = result['content']
            print('Content:', content)
            return jsonify({'content': content})
        else:
            print('No announcement found')
            return jsonify({'content': ''})
    except Exception as e:
        print('Error in get_announcement:', str(e))
        return jsonify({'content': ''}), 500

# 更新公告内容
@app.route('/api/admin/announcement', methods=['POST'])
@jwt_required()
def update_announcement():
    current_user = get_jwt_identity()
    db = get_db()
    cursor = db.cursor()
    
    # 检查用户是否是管理员
    cursor.execute('SELECT is_admin FROM users WHERE username = ?', (current_user,))
    result = cursor.fetchone()
    if not result or not result['is_admin']:
        return jsonify({'error': '需要管理员权限'}), 403
    
    content = request.json.get('content', '')
    cursor.execute('INSERT INTO announcements (content) VALUES (?)', (content,))
    db.commit()
    
    return jsonify({'message': '公告更新成功'})

# 获取统计数据
@app.route('/api/admin/stats', methods=['GET'])
@jwt_required()
@admin_required
def get_stats():
    return jsonify({'message': 'success'})

# 更新模型使用统计
def update_model_stats(model_name, is_start=True):
    pass

@app.route('/api/admin/check', methods=['GET'])
@jwt_required()
def check_admin_status():
    current_user = get_jwt_identity()
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT is_admin FROM users WHERE username = ?', (current_user,))
    result = cursor.fetchone()
    
    if not result:
        return jsonify({'error': '用户不存在'}), 404
        
    return jsonify({'is_admin': bool(result['is_admin'])})

@app.route('/api/agreement', methods=['GET'])
def get_agreement():
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT content FROM user_agreement ORDER BY created_at DESC LIMIT 1')
        result = cursor.fetchone()
        
        if result:
            return jsonify({'content': result[0]})
        else:
            return jsonify({'content': '默认协议内容'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/agreement', methods=['POST'])
@jwt_required()
@admin_required
def update_agreement():
    try:
        data = request.get_json()
        content = data.get('content')
        if not content:
            return jsonify({'error': '协议内容不能为空'}), 400
            
        db = get_db()
        cursor = db.cursor()
        cursor.execute('INSERT INTO user_agreement (content) VALUES (?)', (content,))
        db.commit()
        
        return jsonify({'message': '协议内容更新成功'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(host='0.0.0.0', port=50000, debug=True) 