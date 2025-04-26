#!/usr/bin/env python3
import subprocess
from flask import Flask, jsonify
from flask_restx import Api, Resource
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://192.168.0.129:3000", "http://192.168.0.109:3000", " 10.53.140.230:3000"]}})
api = Api(app, version='1.0', title='SLURM服务状态检查',
    description='检查模型服务状态',
    doc='/api/docs'
)

ns = api.namespace('api', description='服务状态检查')

@ns.route('/check-service')
class CheckService(Resource):
    @api.doc(
        responses={
            200: "成功执行检查",
        },
        description="获取liugu用户提交的服务运行状态和访问信息"
    )
    def get(self):
        """获取服务状态和访问信息"""
        service_info_list = check_qwq_service()
        return jsonify({
            "running": bool(service_info_list),
            "count": len(service_info_list),
            "services": service_info_list
        })

def check_qwq_service():
    """
    检查SLURM队列中是否有liugu用户提交的正在运行的任务
    返回: 任务信息列表
    """
    try:
        # 获取liugu用户提交的正在运行的任务信息
        cmd = "squeue -h -t R -u liugu -o '%i %j %N'"
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True
        )
        
        # 解析输出
        running_info_list = []
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                parts = line.strip().split()
                if len(parts) >= 3:
                    job_id, job_name, node = parts[0], " ".join(parts[1:-1]), parts[-1]
                    running_info = {
                        "job_id": job_id,
                        "job_name": job_name,
                        "node": node,
                        "api": f"http://10.21.22.{200 + int(node[-2:])}:29500"  # 计算节点IP
                    }
                    running_info_list.append(running_info)
        
        print(f"liugu用户任务状态: 找到 {len(running_info_list)} 个运行中的任务")
        return running_info_list
        
    except Exception as e:
        print(f"检查服务状态时出错: {str(e)}")
        return []

if __name__ == '__main__':
    # 添加直接检查功能
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        print("执行手动检查...")
        status = check_qwq_service()
        print(f"检查结果: {status}")
        sys.exit(0)
    
    print("SLURM服务状态检查API已启动")
    print("监听端口：30000")
    app.run(host='0.0.0.0', port=30000) 
