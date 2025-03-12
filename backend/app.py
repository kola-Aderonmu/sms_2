# 1. Imports
from flask import Flask, Response, stream_with_context, current_app, request, jsonify
from email.mime.text import MIMEText
from flask_mail import Mail, Message
from flask_cors import CORS
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import psutil
from psutil import net_io_counters, net_connections
import sqlite3
import pandas as pd
import io
import time
import json
import logging
import getmac
import smtplib

# 2. App initialization and configurations
app = Flask(__name__)
CORS(app)

# CORS(app, resources={r"/*": {"origins": ["http://localhost:5174", "http://localhost:3000", "http://localhost:5000"]}})

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'gabkola94@gmail.com'
app.config['MAIL_PASSWORD'] = 'ilob lkvo nhnc emke'

mail = Mail(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 3. Constants
ALERT_THRESHOLDS = {
    'cpu': {'warning': 70, 'critical': 85},
    'ram': {'warning': 75, 'critical': 90},
    'disk': {'warning': 80, 'critical': 95}
}

# Initialize alert queue
alert_queue = []

# 4. Database setup
def init_db():
    conn = sqlite3.connect('metrics_history.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS metrics
                 (timestamp TEXT, cpu REAL, ram REAL, disk REAL,
                  network_in REAL, network_out REAL)''')
    conn.commit()
    conn.close()

# 5. NotificationService class
class NotificationService:
    def __init__(self):
        self.email_settings = {
            'smtp_server': 'smtp.gmail.com',
            'smtp_port': 587,
            'sender_email': 'gabkola94@gmail.com',
            'password': 'ilob lkvo nhnc emke',
            'recipient_email': 'adekola.aderonmu@airforce.mil.ng'
        }
        self.last_alert_time = {
            'cpu': 0,
            'ram': 0,
            'disk': 0,
            'system': 0
        }
        self.alert_cooldown = 300

    def should_send_alert(self, metric_type):
        current_time = time.time()
        if (current_time - self.last_alert_time[metric_type]) > self.alert_cooldown:
            self.last_alert_time[metric_type] = current_time
            return True
        return False

    def check_thresholds(self, metrics):
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        alerts = []

        if metrics['cpu_usage_percent'] >= ALERT_THRESHOLDS['cpu']['critical']:
            alerts.append(f"CRITICAL: CPU usage at {metrics['cpu_usage_percent']}%")
        elif metrics['cpu_usage_percent'] >= ALERT_THRESHOLDS['cpu']['warning']:
            alerts.append(f"WARNING: CPU usage at {metrics['cpu_usage_percent']}%")

        if metrics['ram']['percent'] >= ALERT_THRESHOLDS['ram']['critical']:
            alerts.append(f"CRITICAL: RAM usage at {metrics['ram']['percent']}%")
        elif metrics['ram']['percent'] >= ALERT_THRESHOLDS['ram']['warning']:
            alerts.append(f"WARNING: RAM usage at {metrics['ram']['percent']}%")

        if metrics['disk']['percent'] >= ALERT_THRESHOLDS['disk']['critical']:
            alerts.append(f"CRITICAL: Disk usage at {metrics['disk']['percent']}%")
        elif metrics['disk']['percent'] >= ALERT_THRESHOLDS['disk']['warning']:
            alerts.append(f"WARNING: Disk usage at {metrics['disk']['percent']}%")

        if alerts and self.should_send_alert('system'):
            message = f"""
System Alert Report - {current_time}

{chr(10).join(alerts)}

Current System Status:
- CPU Usage: {metrics['cpu_usage_percent']}%
- RAM Usage: {metrics['ram']['percent']}%
- Disk Usage: {metrics['disk']['percent']}%
            """
            self.send_email_alert(message)

    def send_email_alert(self, message):
        msg = MIMEText(message)
        msg['Subject'] = 'System Resource Alert'
        msg['From'] = self.email_settings['sender_email']
        msg['To'] = self.email_settings['recipient_email']

        try:
            with smtplib.SMTP(self.email_settings['smtp_server'], self.email_settings['smtp_port']) as server:
                server.starttls()
                server.login(self.email_settings['sender_email'], self.email_settings['password'])
                server.send_message(msg)
                logger.info("Alert email sent successfully")
        except Exception as e:
            logger.error(f"Failed to send alert email: {str(e)}")

# 6. Helper Functions
def get_connected_macs():
    connected_macs = set()
    try:
        connections = psutil.net_connections(kind='inet')
        for conn in connections:
            if conn.status == 'ESTABLISHED' and conn.raddr:
                try:
                    mac = getmac.get_mac_address(ip=conn.raddr.ip)
                    if mac:
                        connected_macs.add(mac)
                except:
                    continue
    except Exception as e:
        logger.error(f"Error getting MAC addresses: {str(e)}")
    return len(connected_macs)





def get_process_connections():
    connections_info = []
    try:
        current_time = int(time.time() * 1000)
        for conn in psutil.net_connections(kind='inet'):
            try:
                process = psutil.Process(conn.pid)
                connections_info.append({
                    'process_name': process.name(),
                    'pid': conn.pid,
                    'local_address': f"{conn.laddr.ip}:{conn.laddr.port}",
                    'remote_address': f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else "-",
                    'timestamp': current_time,
                    'status': conn.status,
                    'ram_usage': process.memory_percent()
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except Exception as e:
        logger.error(f"Error getting connections: {str(e)}")
    return connections_info

def store_metrics(metrics):
    try:
        conn = sqlite3.connect('metrics_history.db')
        c = conn.cursor()
        c.execute('''INSERT INTO metrics
                     (timestamp, cpu, ram, disk, network_in, network_out)
                     VALUES (?, ?, ?, ?, ?, ?)''',
                  (datetime.now().isoformat(),
                   metrics['cpu_usage_percent'],
                   metrics['ram']['percent'],
                   metrics['disk']['percent'],
                   metrics.get('network_in', 0),
                   metrics.get('network_out', 0)))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error storing metrics: {str(e)}")

def collect_metrics():
    try:
        cpu_usage = psutil.cpu_percent(interval=0.5)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        net_stats = psutil.net_io_counters()

        metrics = {
            'cpu_usage_percent': cpu_usage,
            'ram': {
                'total_gb': round(memory.total / (1024 ** 3), 2),
                'used_gb': round(memory.used / (1024 ** 3), 2),
                'percent': memory.percent
            },
            'disk': {
                'total_gb': round(disk.total / (1024 ** 3), 2),
                'used_gb': round(disk.used / (1024 ** 3), 2),
                'percent': disk.percent
            },
            'connected_nodes': get_connected_macs(),
            'system_connections': get_process_connections(),
            'network_in': round(net_stats.bytes_recv / (1024 * 1024), 2),
            'network_out': round(net_stats.bytes_sent / (1024 * 1024), 2),
            'total_connections': len(psutil.net_connections()),
            'timestamp': int(time.time() * 1000)
        }

        notification_service.check_thresholds(metrics)
        store_metrics(metrics)
        return metrics
    except Exception as e:
        logger.error(f"Error collecting metrics: {str(e)}")
        return None

# 7. Routes
@app.route('/metrics_stream')
def metrics_stream():
    return Response(
        stream_with_context(event_stream()),
        content_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    )

@app.route('/health')
def health_check():
    return {"status": "healthy"}

@app.route('/test_alert')
def test_alert():
    try:
        test_metrics = {
            'cpu_usage_percent': 90,
            'ram': {
                'total_gb': 16,
                'used_gb': 14,
                'percent': 95
            },
            'disk': {
                'total_gb': 500,
                'used_gb': 450,
                'percent': 96
            }
        }
        notification_service.check_thresholds(test_metrics)
        return {"status": "success", "message": "Test alert sent"}
    except Exception as e:
        logger.error(f"Test alert failed: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.route('/generate_report')
def manual_report_generation():
    try:
        create_quarterly_report()
        return jsonify({
            'status': 'success',
            'message': 'Quarterly report generated and sent successfully',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/network_stats')
def get_network_stats():
    try:
        net_stats = psutil.net_io_counters()
        connections = len(psutil.net_connections())
        return jsonify({
            'incoming': round(net_stats.bytes_recv / (1024 * 1024), 2),
            'outgoing': round(net_stats.bytes_sent / (1024 * 1024), 2),
            'connections': connections,
            'packets_received': net_stats.packets_recv,
            'packets_sent': net_stats.packets_sent
        })
    except Exception as e:
        logger.error(f"Error getting network stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/historical_data/<timerange>')
def get_historical_data(timerange):
    try:
        conn = sqlite3.connect('metrics_history.db')
        current_time = datetime.now()
        
        if timerange == '24h':
            time_limit = current_time - timedelta(hours=24)
        elif timerange == '7d':
            time_limit = current_time - timedelta(days=7)
        else:
            time_limit = current_time - timedelta(days=30)
        
        query = '''
        SELECT
            timestamp,
            cpu,
            ram,
            disk,
            network_in,
            network_out
        FROM metrics
        WHERE datetime(timestamp) > datetime(?)
        ORDER BY timestamp ASC
        '''
        
        df = pd.read_sql_query(query, conn, params=(time_limit.isoformat(),))
        
        result = []
        for _, row in df.iterrows():
            result.append({
                'timestamp': row['timestamp'],
                'cpu': float(row['cpu']),
                'ram': float(row['ram']),
                'disk': float(row['disk']),
                'network_in': float(row['network_in']),
                'network_out': float(row['network_out'])
            })
        
        conn.close()
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error fetching historical data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/send_alert', methods=['POST'])
def send_alert():
    data = request.json
    subject = f"System Alert: {data['type'].upper()} Usage Critical"
    body = f"""
    Alert Type: {data['type'].upper()}
    Current Value: {data['value']}%
    Threshold: {data['threshold']}%
    Status: {'CRITICAL' if data['isUrgent'] else 'WARNING'}
    Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    """
    
    try:
        msg = Message(
            subject,
            sender='gabkola94@gmail.com',
            recipients=['gabkola94@gmail.com']
        )
        msg.body = body
        mail.send(msg)
        return jsonify({'status': 'success', 'message': 'Alert email sent successfully'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/alert_stream')
def alert_stream():
    def generate():
        while True:
            if alert_queue:
                alert = alert_queue.pop(0)
                yield f"data: {json.dumps(alert)}\n\n"
            time.sleep(1)
    
    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    )
def create_quarterly_report():
    conn = sqlite3.connect('metrics_history.db')
    
    # Get data for last 3 months
    three_months_ago = datetime.now() - timedelta(days=90)
    query = f"SELECT * FROM metrics WHERE timestamp > '{three_months_ago}'"
    
    # Create DataFrame and generate statistics
    df = pd.read_sql_query(query, conn)
    
    # Generate report
    buffer = io.StringIO()
    df.to_csv(buffer)
    report_content = buffer.getvalue()
    
    # Create email
    msg = Message(
        f"Quarterly System Metrics Report - {datetime.now().strftime('%Y Q%q')}",
        sender='gabkola94@gmail.com',
        recipients=['adekola.aderonmu@airforce.mil.ng']
    )
    
    msg.body = f"""
    Quarterly System Metrics Report
    Period: {three_months_ago.strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}
    
    Average CPU Usage: {df['cpu'].mean():.2f}%
    Average RAM Usage: {df['ram'].mean():.2f}%
    Average Disk Usage: {df['disk'].mean():.2f}%
    """
    
    # Attach CSV file
    msg.attach(
        "quarterly_metrics.csv",
        "text/csv",
        report_content
    )
    
    mail.send(msg)
    conn.close()


def event_stream():
    while True:
        try:
            metrics = collect_metrics()
            if metrics:
                json_data = json.dumps(metrics)
                yield f"data: {json_data}\n\n"
            time.sleep(1)
        except Exception as e:
            logger.error(f"Stream error: {str(e)}")
            time.sleep(1)

# Create notification service instance
notification_service = NotificationService()

# Initialize scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(
    create_quarterly_report,
    'cron',
    month='*/3'
)
scheduler.start()

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, threaded=True)
