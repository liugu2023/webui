import time
import random
from datetime import datetime, timedelta
import os
import subprocess
import json
import logging
from typing import List, Tuple, Optional, Dict

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('./logs/model_rotator.log'),
        logging.StreamHandler()
    ]
)

# 配置参数
CHECK_INTERVAL_NO_TASK = 30     # 无任务时的检查间隔（30秒）
CHECK_INTERVAL_ONE_TASK = 300   # 有一个任务时的检查间隔（5分钟）
CHECK_INTERVAL_TWO_TASKS = 43200  # 有两个任务时的检查间隔（12小时）
MODEL_SERVICE_PORT = 29500  # 模型服务端口
NODE_IP_BASE = "10.21.22.200"  # 节点IP基础地址

# 可用节点列表
AVAILABLE_NODES = ["compute01", "compute04", "compute05"]

# 模型配置
MODEL_CONFIGS = {
    'QwQ-32B': {
        'script_name': 'qwq32b.slurm',
        'model_path': '/archive/liugu/model/QwQ-32B/QwQ-32B-Q8_0.gguf',
        'port': 29500
    },
    'Qwen2.5-32B': {
        'script_name': 'qwen25.slurm',
        'model_path': '/archive/liugu/model/Qwen2.5-32B/Qwen25-VL-32B-Instruct-Q8_0.gguf',
        'port': 29500
    },
    'DS-R1': {
        'script_name': 'dsr1.slurm',
        'model_path': '/archive/liugu/model/DS-R1-32B/DeepSeek-R1-Distill-Qwen-32B-Q8_0.gguf',
        'port': 29500,
        'enabled': True  # 启用DS-R1模型
    },
    'Skywork': {
        'script_name': 'skywork.slurm',
        'model_path': '/archive/liugu/model/Skywork/Skywork-Q8_0.gguf',  # 待更新实际路径
        'port': 29500,
        'enabled': False  # 标记为未启用
    }
}

# 支持的模型列表（只包含已启用的模型）
SUPPORTED_MODELS = [model for model, config in MODEL_CONFIGS.items() if config.get('enabled', True)]

# 模型轮换顺序
MODEL_ROTATION_ORDER = ['DS-R1', 'Qwen2.5-32B', 'QwQ-32B']

# 模型状态管理
model_states = {
    model: {
        'is_available': False,
        'node_name': None,
        'job_id': None,
        'last_health_check': None,
        'last_rotation_time': None  # 添加最后轮换时间
    }
    for model in SUPPORTED_MODELS
}

# 轮换时间间隔（秒）
ROTATION_INTERVAL = 3600  # 1小时轮换一次

def generate_model_script(model_name: str, node_name: str) -> str:
    """生成模型启动脚本"""
    config = MODEL_CONFIGS[model_name]
    node_number = int(node_name.replace("compute", ""))
    api_ip = f"{NODE_IP_BASE[:-3]}{200 + node_number}"
    
    # 使用短名称作为作业名称
    short_name = model_name.split('-')[0]
    
    script = f"""#!/bin/bash
#SBATCH -J {short_name}       # 作业名称
#SBATCH -p dlq                   # 分区名称
#SBATCH --time=1-00:00:00           # 运行时间限制（24小时）
#SBATCH -N 1                      # 节点数
#SBATCH -n 12                      # 任务数
#SBATCH --mem=50G                 # 内存需求
#SBATCH --nodelist={node_name}      # 指定节点名称
#SBATCH --gres=gpu:2              # GPU需求
#SBATCH -o ./logs/{short_name}_%j.out            # 标准输出日志
#SBATCH -e ./logs/{short_name}_%j.err            # 错误日志

# 创建日志目录（如果不存在）
mkdir -p ./logs

source /archive/liugu/venv_llama.cpp/bin/activate
# 运行程序
/archive/liugu/llama.cpp-server-3090/build/bin/llama-server \\
  -m {config['model_path']} \\
  -ngl 100 \\
  -fa \\
  -ctk q8_0 \\
  -ctv q8_0 \\
  --host {api_ip} \\
  --port {config['port']} \\
  -np 4 \\
  -t 12 \\
  -c 40960
"""
    return script

def submit_model_job(model_name: str, node_name: str) -> Optional[str]:
    """提交模型作业"""
    try:
        script_content = generate_model_script(model_name, node_name)
        script_path = MODEL_CONFIGS[model_name]['script_name']
        
        # 写入脚本文件
        with open(script_path, 'w') as f:
            f.write(script_content)
        
        # 提交作业
        result = subprocess.run(
            f"sbatch {script_path}",
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            job_id = result.stdout.strip().split()[-1]
            logging.info(f"模型 {model_name} 在节点 {node_name} 上提交成功，作业ID: {job_id}")
            return job_id
        else:
            logging.error(f"模型 {model_name} 提交失败: {result.stderr}")
            return None
    except Exception as e:
        logging.error(f"提交模型作业时发生错误: {str(e)}")
        return None

def check_node_status(node_name: str) -> Tuple[bool, List[str]]:
    """检查节点状态"""
    try:
        result = subprocess.run(
            f"scontrol show node {node_name}",
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            logging.error(f"节点 {node_name} 检查失败: {result.stderr}")
            return (False, [])
        
        node_info = result.stdout.strip()
        is_available = all([
            "State=IDLE" in node_info,
            "CPUAlloc=0" in node_info,
            "AllocMem=0" in node_info
        ])
        
        logging.info(f"节点 {node_name} 状态: {'可用' if is_available else '不可用'}")
        return (is_available, [])
    except Exception as e:
        logging.error(f"节点状态检查失败: {str(e)}")
        return (False, [])

def check_model_service(node_name: str, model_name: str) -> bool:
    """检查模型服务是否正常运行"""
    try:
        node_number = int(node_name.replace("compute", ""))
        api_ip = f"{NODE_IP_BASE[:-3]}{200 + node_number}"
        port = MODEL_CONFIGS[model_name]['port']
        
        result = subprocess.run(
            f"curl -s http://{api_ip}:{port}/health",
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            try:
                health_data = json.loads(result.stdout)
                return health_data.get('status', '') == 'ok'
            except json.JSONDecodeError:
                return False
        return False
    except Exception as e:
        logging.error(f"检查模型服务状态失败: {str(e)}")
        return False

def find_available_nodes() -> List[str]:
    """查找可用的计算节点"""
    available_nodes = []
    for node_name in AVAILABLE_NODES:
        is_available, _ = check_node_status(node_name)
        if is_available:
            available_nodes.append(node_name)
            logging.info(f"找到可用节点: {node_name}")
        else:
            logging.info(f"节点 {node_name} 当前不可用")
    return available_nodes

def check_squeue_status() -> Dict[str, str]:
    """检查所有作业的状态"""
    try:
        result = subprocess.run(
            "squeue -u liugu -o '%.18i %.9P %.8j %.8u %.2t %.10M %.6D %R'",
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            # 解析squeue输出
            jobs = {}
            lines = result.stdout.strip().split('\n')[1:]  # 跳过标题行
            for line in lines:
                parts = line.split()
                if len(parts) >= 8:
                    job_id = parts[0]
                    job_name = parts[2]
                    status = parts[4]
                    node = parts[7]
                    jobs[job_name] = {
                        'job_id': job_id,
                        'status': status,
                        'node': node
                    }
            return jobs
        return {}
    except Exception as e:
        logging.error(f"检查squeue状态失败: {str(e)}")
        return {}

def should_rotate_model(model_name: str) -> bool:
    """检查是否应该轮换模型"""
    state = model_states[model_name]
    if state['last_rotation_time'] is None:
        return True
    
    # 检查是否达到轮换时间间隔
    time_since_last_rotation = (datetime.now() - state['last_rotation_time']).total_seconds()
    return time_since_last_rotation >= ROTATION_INTERVAL

def get_next_model_to_rotate() -> Optional[str]:
    """获取下一个应该轮换的模型"""
    current_time = datetime.now()
    
    # 首先检查是否有模型需要轮换
    for model_name in MODEL_ROTATION_ORDER:
        if model_name in SUPPORTED_MODELS and should_rotate_model(model_name):
            logging.info(f"模型 {model_name} 需要轮换，上次轮换时间: {model_states[model_name]['last_rotation_time']}")
            return model_name
    
    # 如果没有模型需要轮换，返回轮换顺序中的第一个模型
    for model_name in MODEL_ROTATION_ORDER:
        if model_name in SUPPORTED_MODELS:
            return model_name
    
    return None

def get_job_start_time(job_id: str) -> Optional[datetime]:
    """获取作业的开始时间"""
    try:
        result = subprocess.run(
            f"sacct -j {job_id} --format=JobID,Start,State -n",
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if line.strip():
                    parts = line.split('|')
                    if len(parts) >= 3:
                        job_id_part, start_time, state = parts
                        if state.strip() == 'RUNNING':
                            try:
                                return datetime.strptime(start_time.strip(), '%Y-%m-%dT%H:%M:%S')
                            except ValueError:
                                logging.error(f"无法解析时间格式: {start_time}")
        return None
    except Exception as e:
        logging.error(f"获取作业开始时间失败: {str(e)}")
        return None

def get_pending_jobs() -> Dict[str, Dict]:
    """获取所有等待中的作业及其节点信息"""
    try:
        result = subprocess.run(
            "squeue -t PD -o '%.18i %.9P %.8j %.8u %.2t %.10M %.6D %R'",
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            pending_jobs = {}
            lines = result.stdout.strip().split('\n')[1:]  # 跳过标题行
            for line in lines:
                parts = line.split()
                if len(parts) >= 8:
                    job_id = parts[0]
                    job_name = parts[2]
                    node = parts[7]
                    pending_jobs[job_name] = {
                        'job_id': job_id,
                        'node': node
                    }
            return pending_jobs
        return {}
    except Exception as e:
        logging.error(f"获取等待中作业失败: {str(e)}")
        return {}

def should_stop_model_for_pending(model_name: str, node_name: str) -> bool:
    """检查是否应该停止模型以为等待中的任务让路"""
    state = model_states[model_name]
    if not state['job_id']:
        return False
    
    # 获取模型运行时间
    start_time = get_job_start_time(state['job_id'])
    if not start_time:
        return False
    
    running_time = datetime.now() - start_time
    if running_time < timedelta(hours=12):
        return False
    
    # 获取等待中的作业
    pending_jobs = get_pending_jobs()
    
    # 检查是否有等待中的作业指定了该节点
    for job_name, job_info in pending_jobs.items():
        if job_info['node'] == node_name:
            logging.info(f"发现等待中的作业 {job_name} 指定了节点 {node_name}，且模型 {model_name} 已运行 {running_time.total_seconds()/3600:.1f} 小时")
            return True
    
    return False

def stop_model_job(model_name: str) -> bool:
    """停止模型作业"""
    state = model_states[model_name]
    if not state['job_id']:
        return False
    
    try:
        result = subprocess.run(
            f"scancel {state['job_id']}",
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            logging.info(f"成功停止模型 {model_name} 的作业 {state['job_id']}")
            state['is_available'] = False
            state['job_id'] = None
            state['node_name'] = None
            return True
        else:
            logging.error(f"停止模型 {model_name} 失败: {result.stderr}")
            return False
    except Exception as e:
        logging.error(f"停止模型作业时发生错误: {str(e)}")
        return False

def rotate_models():
    """轮换模型可用状态"""
    try:
        # 获取当前所有作业状态
        job_status = check_squeue_status()
        logging.info("当前作业状态:")
        for job_name, status in job_status.items():
            logging.info(f"作业 {job_name}: ID={status['job_id']}, 状态={status['status']}, 节点={status['node']}")
        
        # 统计当前运行中的模型数量
        running_models = sum(1 for job_info in job_status.values() if job_info['status'] in ['R', 'PD'])
        logging.info(f"当前运行中的模型数量: {running_models}")
        
        # 获取已使用的节点
        used_nodes = set(job_info['node'] for job_info in job_status.values() if job_info['status'] in ['R', 'PD'])
        logging.info(f"当前已使用的节点: {', '.join(used_nodes) if used_nodes else '无'}")
        
        # 检查是否需要为等待中的任务停止模型
        for model_name, state in model_states.items():
            if state['is_available'] and state['node_name']:
                if should_stop_model_for_pending(model_name, state['node_name']):
                    logging.info(f"模型 {model_name} 需要为等待中的任务让路")
                    if stop_model_job(model_name):
                        running_models -= 1
                        used_nodes.remove(state['node_name'])
        
        # 获取下一个应该轮换的模型
        next_model = get_next_model_to_rotate()
        if next_model:
            logging.info(f"下一个应该轮换的模型: {next_model}")
        else:
            logging.info("没有需要轮换的模型")
        
        # 根据squeue状态更新模型可用性
        for model_name in SUPPORTED_MODELS:
            state = model_states[model_name]
            logging.info(f"\n检查模型 {model_name} 的状态:")
            
            # 检查该模型是否有正在运行的作业
            short_name = model_name.split('-')[0]
            matching_job = None
            
            # 查找匹配的作业
            for job_name, job_info in job_status.items():
                if job_name.startswith(short_name):
                    matching_job = job_info
                    break
            
            if matching_job:
                state['job_id'] = matching_job['job_id']
                state['node_name'] = matching_job['node']
                state['is_available'] = matching_job['status'] in ['R', 'PD']
                state['last_health_check'] = datetime.now()
                logging.info(f"模型 {model_name} 在节点 {matching_job['node']} 上运行，状态: {matching_job['status']}")
                
                # 如果这个模型是下一个要轮换的模型，并且已经运行了一段时间，则考虑停止它
                if model_name == next_model and should_rotate_model(model_name):
                    logging.info(f"模型 {model_name} 需要轮换，准备停止当前作业")
                    # 这里可以添加停止作业的逻辑
                    # 例如: subprocess.run(f"scancel {state['job_id']}", shell=True)
            else:
                logging.info(f"模型 {model_name} 当前没有运行中的作业")
                
                # 如果这个模型是下一个要轮换的模型，并且有可用节点，则启动它
                if model_name == next_model and running_models < 2:
                    logging.info(f"准备启动模型 {model_name} 进行轮换")
                    all_available_nodes = find_available_nodes()
                    available_nodes = [node for node in all_available_nodes if node not in used_nodes]
                    
                    if available_nodes:
                        new_node = available_nodes[0]
                        logging.info(f"找到可用节点 {new_node}，准备启动模型")
                        job_id = submit_model_job(model_name, new_node)
                        if job_id:
                            state['node_name'] = new_node
                            state['job_id'] = job_id
                            state['is_available'] = True
                            state['last_health_check'] = datetime.now()
                            state['last_rotation_time'] = datetime.now()  # 更新最后轮换时间
                            logging.info(f"模型 {model_name} 已在节点 {new_node} 上启动，作业ID: {job_id}")
                            running_models += 1
                            used_nodes.add(new_node)
                    else:
                        logging.info(f"没有可用节点来启动模型 {model_name}")
                        state['is_available'] = False
                        state['last_health_check'] = datetime.now()
                elif running_models < 2 and model_name in MODEL_ROTATION_ORDER:
                    # 如果不是下一个要轮换的模型，但当前运行模型数量少于2个，也可以启动
                    logging.info(f"当前运行模型数量({running_models})小于2，尝试启动模型 {model_name}")
                    all_available_nodes = find_available_nodes()
                    available_nodes = [node for node in all_available_nodes if node not in used_nodes]
                    
                    if available_nodes:
                        new_node = available_nodes[0]
                        logging.info(f"找到可用节点 {new_node}，准备启动模型")
                        job_id = submit_model_job(model_name, new_node)
                        if job_id:
                            state['node_name'] = new_node
                            state['job_id'] = job_id
                            state['is_available'] = True
                            state['last_health_check'] = datetime.now()
                            state['last_rotation_time'] = datetime.now()  # 更新最后轮换时间
                            logging.info(f"模型 {model_name} 已在节点 {new_node} 上启动，作业ID: {job_id}")
                            running_models += 1
                            used_nodes.add(new_node)
                    else:
                        logging.info(f"没有可用节点来启动模型 {model_name}")
                        state['is_available'] = False
                        state['last_health_check'] = datetime.now()
                else:
                    logging.info(f"模型 {model_name} 当前不需要启动")
                    state['is_available'] = False
                    state['last_health_check'] = datetime.now()
        
        # 获取当前可用的模型
        available_models = [model for model, state in model_states.items() if state['is_available']]
        logging.info(f"\n模型轮换完成，当前可用模型: {', '.join(available_models) if available_models else '无'}")
        
        return running_models
    except Exception as e:
        logging.error(f"轮换模型时发生错误: {str(e)}")
        raise

def main():
    """主函数，定期轮换模型"""
    try:
        logging.info("模型轮换服务已启动...")
        logging.info(f"模型轮换顺序: {', '.join(MODEL_ROTATION_ORDER)}")
        logging.info(f"轮换时间间隔: {ROTATION_INTERVAL} 秒")
        
        while True:
            try:
                running_models = rotate_models()
                
                # 根据运行中的模型数量确定检查间隔
                if running_models == 0:
                    check_interval = CHECK_INTERVAL_NO_TASK
                elif running_models == 1:
                    check_interval = CHECK_INTERVAL_ONE_TASK
                else:
                    check_interval = CHECK_INTERVAL_TWO_TASKS
                
                logging.info(f"下次检查将在 {check_interval} 秒后进行")
                time.sleep(check_interval)
            except Exception as e:
                logging.error(f"轮换过程中发生错误: {str(e)}")
                time.sleep(30)  # 发生错误时等待30秒后重试
    except Exception as e:
        logging.error(f"服务启动失败: {str(e)}")
        raise

if __name__ == '__main__':
    main() 
