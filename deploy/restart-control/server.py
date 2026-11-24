#!/usr/bin/python3
"""A narrow local control socket: no shell and no caller-selected container."""
import hmac,json,logging,os,re,secrets,socket,socketserver,stat,subprocess,threading,time,urllib.request
from pathlib import Path
from http.server import BaseHTTPRequestHandler
CONTAINER='davomat-app-1'
OWNER=8197301287
ROOT=Path(os.environ.get('DAVOMAT_CONTROL_DIR','/opt/davomat/control'))
TOKEN=''
LOCK=threading.Lock()
BUSY=False
STATUS={'phase':'idle'}
LAST_ACCEPTED=0.0
LOG=logging.getLogger('davomat-restart')

def save_status(value):
    global STATUS
    STATUS=value
    temp=ROOT/'status.tmp'
    with open(temp,'w',encoding='utf-8') as f:
        os.chmod(temp,0o600)
        json.dump(value,f)
        f.flush();os.fsync(f.fileno())
    os.replace(temp,ROOT/'status.json')

def notify(text):
    try:
        token=''
        for line in Path('/opt/davomat/secrets/runtime.env').read_text().splitlines():
            if line.startswith('BOT_TOKEN='):
                token=line.split('=',1)[1].strip().strip('"').strip("'")
                break
        if not token:raise RuntimeError('BOT_TOKEN_MISSING')
        body=json.dumps({'chat_id':OWNER,'text':text}).encode()
        request=urllib.request.Request('https://api.telegram.org/bot'+token+'/sendMessage',data=body,headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(request,timeout=10) as r:
            if not json.load(r).get('ok'):raise RuntimeError('NOTICE_REJECTED')
    except Exception:
        LOG.warning('RESTART_NOTICE_UNAVAILABLE')

def execute_restart(request_id):
    global BUSY
    try:
        time.sleep(3) # Let the bot acknowledge the accepted request before stopping it.
        save_status({'phase':'restarting','requestId':request_id,'at':LAST_ACCEPTED})
        result=subprocess.run(['/usr/bin/docker','restart','--time','40',CONTAINER],capture_output=True,text=True,timeout=75,check=False)
        if result.returncode:raise RuntimeError('DOCKER_RESTART_FAILED')
        healthy=False
        for _ in range(60):
            probe=subprocess.run(['/usr/bin/docker','inspect','--format','{{if .State.Health}}{{.State.Health.Status}}{{end}}',CONTAINER],capture_output=True,text=True,timeout=5,check=False)
            if probe.returncode==0 and probe.stdout.strip()=='healthy':healthy=True;break
            time.sleep(1)
        phase='healthy' if healthy else 'not_ready'
        save_status({'phase':phase,'requestId':request_id,'at':LAST_ACCEPTED,'completedAt':time.time()})
        notify('✅ Davomat qayta ishga tushdi. Bot va saqlash holati: ONLINE.' if healthy else '⚠️ Davomat konteyneri qayta ishga tushdi, lekin xizmat tayyorligi tasdiqlanmadi. /status yoki server diagnostikasini tekshiring.')
        LOG.info('RESTART_FINISHED phase=%s',phase)
    except Exception as error:
        save_status({'phase':'failed','requestId':request_id,'at':LAST_ACCEPTED,'code':type(error).__name__})
        LOG.error('RESTART_FAILED code=%s',type(error).__name__)
        notify('⚠️ Davomat restart so‘rovi yakuni tasdiqlanmadi. Server holatini tekshiring; qayta-qayta bosmang.')
    finally:
        with LOCK:BUSY=False

class Handler(BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,*args):pass
    def address_string(self):return 'local'
    def reply(self,status,body):
        raw=json.dumps(body).encode()
        self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.send_header('Connection','close');self.end_headers();self.wfile.write(raw)
        self.close_connection=True
    def authorized(self):
        value=self.headers.get('Authorization','')
        try:return bool(TOKEN) and hmac.compare_digest(value,'Bearer '+TOKEN)
        except TypeError:return False
    def do_GET(self):
        if not self.authorized():return self.reply(403,{'code':'FORBIDDEN'})
        if self.path!='/status':return self.reply(404,{'code':'NOT_FOUND'})
        with LOCK:body={**STATUS,'busy':BUSY,'container':CONTAINER}
        self.reply(200,body)
    def do_POST(self):
        global BUSY,LAST_ACCEPTED
        if not self.authorized():return self.reply(403,{'code':'FORBIDDEN'})
        if self.path!='/restart':return self.reply(404,{'code':'NOT_FOUND'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=1024:raise ValueError()
            data=json.loads(self.rfile.read(length))
            if set(data)!= {'telegramId','requestId'} or type(data['telegramId']) is not int or data['telegramId']!=OWNER or not re.fullmatch('[a-f0-9-]{36}',data['requestId']):raise ValueError()
        except Exception:return self.reply(400,{'code':'INVALID_REQUEST'})
        request_id=data['requestId']
        with LOCK:
            if STATUS.get('requestId')==request_id:return self.reply(202,{'accepted':True,'requestId':request_id,'container':CONTAINER})
            if BUSY or time.time()-LAST_ACCEPTED<90:return self.reply(409,{'code':'RESTART_BUSY'})
            BUSY=True;LAST_ACCEPTED=time.time()
            save_status({'phase':'queued','requestId':request_id,'at':LAST_ACCEPTED})
            threading.Thread(target=execute_restart,args=(request_id,),daemon=True).start()
        self.reply(202,{'accepted':True,'requestId':request_id,'container':CONTAINER})

class Server(socketserver.ThreadingMixIn,socketserver.UnixStreamServer):
    daemon_threads=True
    def get_request(self):
        sock,address=super().get_request();sock.settimeout(5);return sock,address

def main():
    global TOKEN,STATUS,LAST_ACCEPTED
    ROOT.mkdir(mode=0o700,parents=True,exist_ok=True);os.chmod(ROOT,0o700)
    token_file=ROOT/'token'
    if not token_file.exists():
        fd=os.open(token_file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as f:f.write(secrets.token_hex(32)+'\n')
    os.chmod(token_file,0o600);TOKEN=token_file.read_text().strip()
    if not re.fullmatch('[a-f0-9]{64}',TOKEN):raise RuntimeError('INVALID_CONTROL_TOKEN')
    try:
        STATUS=json.loads((ROOT/'status.json').read_text());LAST_ACCEPTED=float(STATUS.get('at',0))
        if STATUS.get('phase') in ('queued','restarting'):save_status({**STATUS,'phase':'interrupted'})
    except FileNotFoundError:pass
    sock=ROOT/'control.sock'
    if sock.exists():
        if not stat.S_ISSOCK(sock.stat().st_mode):raise RuntimeError('UNEXPECTED_SOCKET_PATH')
        sock.unlink()
    with Server(str(sock),Handler) as server:
        os.chmod(sock,0o600);LOG.info('CONTROL_READY container=%s',CONTAINER);server.serve_forever()
if __name__=='__main__':
    logging.basicConfig(level=logging.INFO,format='%(message)s')
    main()
