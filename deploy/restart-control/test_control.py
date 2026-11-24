import unittest,tempfile,threading,http.client,socket,json,uuid,time
from pathlib import Path
from unittest import mock
import importlib.util
spec=importlib.util.spec_from_file_location('control',Path(__file__).with_name('server.py'))
control=importlib.util.module_from_spec(spec);spec.loader.exec_module(control)
class UnixConnection(http.client.HTTPConnection):
    def __init__(self,path):super().__init__('localhost');self.path=path
    def connect(self):self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.connect(self.path)
class ControlTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();control.ROOT=Path(self.temp.name);control.TOKEN='a'*64;control.STATUS={'phase':'idle'};control.BUSY=False;control.LAST_ACCEPTED=0
        self.server=control.Server(str(control.ROOT/'test.sock'),control.Handler);self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
    def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join();self.temp.cleanup()
    def call(self,path='/restart',data=None,token=None,method='POST'):
        c=UnixConnection(str(control.ROOT/'test.sock'));headers={'Authorization':'Bearer '+(token if token is not None else control.TOKEN),'Content-Type':'application/json'}
        c.request(method,path,json.dumps(data or {}),headers);r=c.getresponse();result=(r.status,json.loads(r.read()));c.close();return result
    def test_auth_and_fixed_scope(self):
        with mock.patch.object(control,'execute_restart') as run:
            self.assertEqual(self.call(token='bad')[0],403)
            self.assertEqual(self.call('/exec')[0],404)
            self.assertEqual(self.call(data={'telegramId':101,'requestId':str(uuid.uuid4())})[0],400)
            self.assertEqual(self.call(data={'telegramId':control.OWNER,'requestId':str(uuid.uuid4()),'container':'provveb-app'})[0],400)
            self.assertEqual(self.call(data={'telegramId':control.OWNER,'requestId':str(uuid.uuid4()),'command':'reboot'})[0],400)
            run.assert_not_called()
    def test_accept_duplicate_and_cooldown(self):
        with mock.patch.object(control,'execute_restart') as run:
            value={'telegramId':control.OWNER,'requestId':str(uuid.uuid4())}
            self.assertEqual(self.call(data=value)[0],202)
            self.assertEqual(self.call(data=value)[0],202)
            self.assertEqual(self.call(data={**value,'requestId':str(uuid.uuid4())})[0],409)
            for _ in range(20):
                if run.call_count:break
                time.sleep(.01)
            self.assertEqual(run.call_count,1)
    def test_exact_docker_command_and_health_notification(self):
        results=[mock.Mock(returncode=0,stdout='davomat-app-1\n'),mock.Mock(returncode=0,stdout='healthy\n')]
        with mock.patch.object(control.subprocess,'run',side_effect=results) as run,mock.patch.object(control.time,'sleep'),mock.patch.object(control,'notify') as notify:
            control.execute_restart(str(uuid.uuid4()))
            self.assertEqual(run.call_args_list[0].args[0],['/usr/bin/docker','restart','--time','40','davomat-app-1'])
            self.assertEqual(control.STATUS['phase'],'healthy');self.assertIn('ONLINE',notify.call_args.args[0]);self.assertFalse(control.BUSY)
    def test_docker_error_does_not_claim_online(self):
        with mock.patch.object(control.subprocess,'run',return_value=mock.Mock(returncode=1)),mock.patch.object(control.time,'sleep'),mock.patch.object(control,'notify') as notify:
            control.execute_restart(str(uuid.uuid4()))
            self.assertEqual(control.STATUS['phase'],'failed');self.assertNotIn('ONLINE',notify.call_args.args[0])
if __name__=='__main__':unittest.main()
