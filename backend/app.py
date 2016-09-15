# axCutHost python host
# A derivative / rewrite based on the Lasersaur host

import sys, os, time
from os import listdir
from os.path import isfile, join
import glob, json, argparse, copy
import tempfile
import socket, webbrowser
from wsgiref.simple_server import WSGIRequestHandler, make_server
from bottle import *
from serial_manager import SerialManager
from filereaders import read_svg, read_dxf, read_ngc
from pprint import pprint
import traceback


APPNAME = "axcutapp"
VERSION = ""
COMPANY_NAME = "uk.me.axford"
SERIAL_PORT = None
BITSPERSECOND = 115200
NETWORK_PORT = 4444
HARDWARE = 'x86'  # also: 'beaglebone', 'raspberrypi'
CONFIG_FILE = socket.gethostname() + ".axcutapp.conf"
COOKIE_KEY = 'secret_key_jkn23489hsda'


if os.name == 'nt': #sys.platform == 'win32':
    GUESS_PREFIX = "Arduino"
elif os.name == 'posix':
    if sys.platform == "linux" or sys.platform == "linux2":
        GUESS_PREFIX = "2341"  # match by arduino VID
    else:
        GUESS_PREFIX = "tty.usbmodem"
else:
    GUESS_PREFIX = "no prefix"


def JSONResponse(status, data, msg):
    return json.dumps({'status':status, 'data':data, 'message':msg});


def resources_dir():
    """This is to be used with all relative file access.
       _MEIPASS is a special location for data files when creating
       standalone, single file python apps with pyInstaller.
       Standalone is created by calling from 'other' directory:
       python pyinstaller/pyinstaller.py --onefile app.spec
    """
    if hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    else:
        # root is one up from this file
        return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../'))


def storage_dir():
    directory = ""
    if sys.platform == 'darwin':
        # from AppKit import NSSearchPathForDirectoriesInDomains
        # # NSApplicationSupportDirectory = 14
        # # NSUserDomainMask = 1
        # # True for expanding the tilde into a fully qualified path
        # appdata = path.join(NSSearchPathForDirectoriesInDomains(14, 1, True)[0], APPNAME)
        directory = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', COMPANY_NAME, APPNAME)
    elif sys.platform == 'win32':
        directory = os.path.join(os.path.expandvars('%APPDATA%'), COMPANY_NAME, APPNAME)
    else:
        directory = os.path.join(os.path.expanduser('~'), "." + APPNAME)

    if not os.path.exists(directory):
        os.makedirs(directory)

    return directory


class HackedWSGIRequestHandler(WSGIRequestHandler):
    """ This is a heck to solve super slow request handling
    on the BeagleBone and RaspberryPi. The problem is WSGIRequestHandler
    which does a reverse lookup on every request calling gethostbyaddr.
    For some reason this is super slow when connected to the LAN.
    (adding the IP and name of the requester in the /etc/hosts file
    solves the problem but obviously is not practical)
    """
    def address_string(self):
        """Instead of calling getfqdn -> gethostbyaddr we ignore."""
        # return "(a requester)"
        return str(self.client_address[0])

    def log_request(*args, **kw):
        # if debug:
            # return wsgiref.simple_server.WSGIRequestHandler.log_request(*args, **kw)
        pass


def run_with_callback(host, port):
    """ Start a wsgiref server instance with control over the main loop.
        This is a function that I derived from the bottle.py run()
    """
    debug()
    handler = default_app()
    server = make_server(host, port, handler, handler_class=HackedWSGIRequestHandler)
    server.timeout = 0.01
    server.quiet = False
    print "Persistent storage root is: " + storage_dir()
    print "-----------------------------------------------------------------------------"
    print "Bottle server starting up ..."
    print "Serial is set to %d bps" % BITSPERSECOND
    print "Point your browser to: "
    print "http://%s:%d/      (local)" % ('127.0.0.1', port)
    # if host == '':
    #     try:
    #         print "http://%s:%d/   (public)" % (socket.gethostbyname(socket.gethostname()), port)
    #     except socket.gaierror:
    #         # print "http://beaglebone.local:4444/      (public)"
    #         pass
    print "Use Ctrl-C to quit."
    print "-----------------------------------------------------------------------------"
    print

    # load machine config
    machinefile = open(os.path.join(resources_dir(), 'library/machine.json'), 'rb')
    try:
        obj = json.load(machinefile)
        SerialManager.machine['axesLimits'] = obj['axesLimits']
        SerialManager.machine['homeTo'] = obj['homeTo']
    except ValueError, e:
        raise SystemExit(e)

    # auto-connect on startup, only if serial port is defined
    global SERIAL_PORT
    #if not SERIAL_PORT:
    #    SERIAL_PORT = SerialManager.match_device(GUESS_PREFIX, BITSPERSECOND)
    if SERIAL_PORT:
        try:
            SerialManager.connect(SERIAL_PORT, BITSPERSECOND)
        except:
            print "Cannot open serial connection on port: "+SERIAL_PORT

    # open web-browser
    try:
    #    webbrowser.open_new_tab('http://127.0.0.1:'+str(port))
        pass
    except webbrowser.Error:
        print "Cannot open Webbrowser, please do so manually."
    sys.stdout.flush()  # make sure everything gets flushed
    server.timeout = 0
    while 1:
        try:
            SerialManager.send_queue_as_ready()
            server.handle_request()
            time.sleep(0.0004)
        except KeyboardInterrupt:
            break
    print "\nShutting down..."
    SerialManager.close()



# basic server side includes

def SSIReplace(matchobj):
    # recursively expand includes
    return SSI(matchobj.group(1), os.path.join(resources_dir(), 'frontend'))

def SSI(filename, path):
    # <!--\s*#include\sfile="([a-zA-Z0-9.]+)"\s*-->
    filename = os.path.join(path, filename)
    src = ''
    if os.path.isfile(filename):

        with open(filename, 'r') as f:
            src = f.read()

        if src != '':
            src = re.sub('<!--\s*#include\sfile="([a-zA-Z0-9./]+)"\s*-->', SSIReplace, src)

    else:
        src = '<!-- File not found: '+filename+' -->'

    return src



@route('/css/:path#.+#')
def static_css_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/css'))

@route('/js/:path#.+#')
def static_js_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/js'))

@route('/fonts/:path#.+#')
def static_fonts_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/fonts'))

@route('/img/:path#.+#')
def static_img_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/img'))

@route('/sounds/:path#.+#')
def static_js_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/sounds'))

@route('/favicon.ico')
def favicon_handler():
    return static_file('favicon.ico', root=os.path.join(resources_dir(), 'frontend/img'))



@route('/containment.htm')
def containment_handler():
    return static_file('containment.htm', root=os.path.join(resources_dir(), 'frontend') )



@route('/')
@route('/index.html')
@route('/app.html')
def default_handler():
    return SSI('app.html', os.path.join(resources_dir(), 'frontend') )


def path_to_dict(path):
    d = {'name': os.path.basename(path)}
    if os.path.isdir(path):
        d['type'] = "directory"
        d['children'] = [path_to_dict(os.path.join(path,x)) for x in os.listdir\
(path)]
    else:
        d['type'] = "file"
    return d


@route('/library/list')
def library_list_handler():
    return json.dumps(path_to_dict('library'))


@route('/library/:path#.+#')
def library_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'library'))


@route('/library/save', method='POST')
def library_save_handler():
    try:
        fn = os.path.join(resources_dir(), 'library', request.forms.get('name'))
        data = request.forms.get('data')
        # if os.path.isfile(fn):
        print "saving "+fn

        with open(fn, 'w') as f:
            f.write(data)

        return JSONResponse('success', None, 'Saved: '+request.forms.get('name'))

    except:
        return JSONResponse('error', None, 'Exception: '+traceback.format_exc())


@route('/library/remove', method='POST')
def library_save_handler():
    try:
        fn = os.path.join(resources_dir(), 'library', request.forms.get('name'))
        if os.path.isfile(fn):
            print "Removing "+fn

            os.remove(fn)

            return JSONResponse('success', None, 'Removed: '+request.forms.get('name'))
        else:
            return JSONResponse('error', None, 'File not found: '+fn)

    except:
        return JSONResponse('error', None, 'Exception: '+traceback.format_exc())




@route('/serial/list')
def serial_list():
    return JSONResponse('success', SerialManager.list_devices(BITSPERSECOND), None)

@route('/serial/connect')
def serial_connect():
    if not SerialManager.is_connected():
        try:
            # see if a port has been specified
            reqPort = request.params.get('port')
            global SERIAL_PORT, BITSPERSECOND, GUESS_PREFIX

            if reqPort:
                SERIAL_PORT = reqPort

            if not SERIAL_PORT:
                SERIAL_PORT = SerialManager.match_device(GUESS_PREFIX, BITSPERSECOND)

            SerialManager.connect(SERIAL_PORT, BITSPERSECOND)

            if SerialManager.is_connected:
                # save config for next time
                with open(CONFIG_FILE, "w") as f:
                    f.write(SERIAL_PORT)

            ret = "Serial connected to %s:%d." % (SERIAL_PORT, BITSPERSECOND)
            time.sleep(1.0) # allow some time to receive a prompt/welcome
            SerialManager.flush_input()
            SerialManager.flush_output()
            print ret
            return JSONResponse('success', None, ret)
        except serial.SerialException:
            SERIAL_PORT = None
            print "Failed to connect to serial."
            return JSONResponse('error', None, 'Failed to connect to serial')
        except:
            print "Failed to connect to serial."
            return JSONResponse('error', None, 'Failed to connect to serial')
    else:
        return JSONResponse('error', None, 'Already connected')

@route('/serial/disconnect')
def serial_disconnect():
    if SerialManager.is_connected():
        if SerialManager.close():
            print "Serial disconnected"
            return JSONResponse('success', None, 'Disconnected')
    else: return JSONResponse('error', None, 'Failed to close serial connection')

@route('/serial/isConnected')
def serial_status():
    if SerialManager.is_connected(): return JSONResponse('success', 1, 'Connected')
    else: return JSONResponse('success', 0, 'Not connected')

@route('/device/status')
def device_status():
    return JSONResponse('success',SerialManager.get_hardware_status(), None)

@route('/device/state')
def device_status():
    return JSONResponse('success',SerialManager.get_hardware_state(), None)


@route('/gcodeline')
def gcodeline_handler():
    job_data = request.params.get("gcode")
    if job_data and SerialManager.is_connected():
        numLines = SerialManager.queue_gcode(job_data + "\r\n")
        return JSONResponse('success', None, 'GCode queued, '+str(numLines)+' lines')
    else:
        return JSONResponse('error', None, 'Serial not connected or blank GCode line')

@route('/gcode', method='POST')
def job_submit_handler():
    job_data = request.forms.get('gcode')
    if job_data and SerialManager.is_connected():
        numLines = SerialManager.queue_gcode(job_data + "\r\n")
        return JSONResponse('success', None, 'GCode queued, '+str(numLines)+' lines')
    else:
        return JSONResponse('error', None, 'Serial not connected or blank GCode')


@route('/abort')
def abort_handler():
    SerialManager.queuedLines = []
    return JSONResponse('success', None, 'Aborted - queue empty')

@route('/queue/pause')
def pause_handler():
    if SerialManager.is_connected():
        return JSONResponse('success', SerialManager.set_pause(True), None)
    else:
        return JSONResponse('error', None, 'Serial not connected')

@route('/queue/play')
def play_handler():
    if SerialManager.is_connected():
        return JSONResponse('success', SerialManager.set_pause(False), None)
    else:
        return JSONResponse('error', None, 'Serial not connected')

@route('/queue/status')
def queue_status_handler():
    if SerialManager.is_connected():
        return JSONResponse('success', SerialManager.queue_length(), None)
    else:
        return JSONResponse('error', None, 'Serial not connected')

@route('/queue/eta')
def queue_eta_handler():
    if SerialManager.is_connected():
        return JSONResponse('success', SerialManager.calc_eta(), None)
    else:
        return JSONResponse('error', None, 'Serial not connected')


@route('/queue/top')
def queue_status_handler():
    if SerialManager.is_connected():
        n = request.params.get("n")
        if (not n):
            n = 10
        return JSONResponse('success', SerialManager.top_of_queue(n), None)
    else:
        return JSONResponse('error', None, 'Serial not connected')

@route('/serial/tail')
def log_tail_handler():
    if SerialManager.is_connected():
        n = request.params.get("n")
        if (not n):
            n = 10
        return JSONResponse('success', SerialManager.log_tail(n), None)
    else:
        return JSONResponse('error', None, 'Serial not connected')


### Setup Argument Parser
argparser = argparse.ArgumentParser(description='Run host.', prog='axcutapp')
argparser.add_argument('port', metavar='serial_port', nargs='?', default=False,
                    help='serial port to the cutter')
argparser.add_argument('-v', '--version', action='version', version='%(prog)s ' + VERSION)
argparser.add_argument('-p', '--public', dest='host_on_all_interfaces', action='store_true',
                    default=False, help='bind to all network devices (default: bind to 127.0.0.1)')
argparser.add_argument('-l', '--list', dest='list_serial_devices', action='store_true',
                    default=False, help='list all serial devices currently connected')
argparser.add_argument('-d', '--debug', dest='debug', action='store_true',
                    default=False, help='print more verbose for debugging')
argparser.add_argument('-m', '--match', dest='match',
                    default=GUESS_PREFIX, help='match serial device with this string')
args = argparser.parse_args()



if args.list_serial_devices:
    SerialManager.list_devices(BITSPERSECOND)
else:
    if not SERIAL_PORT:
        if args.port:
            # (1) get the serial device from the argument list
            SERIAL_PORT = args.port
            print "Using serial device '"+ SERIAL_PORT +"' from command line."
        else:
            # (2) get the serial device from the config file
            if os.path.isfile(CONFIG_FILE):
                fp = open(CONFIG_FILE)
                line = fp.readline().strip()
                if len(line) > 3:
                    SERIAL_PORT = line
                    print "Using serial device '"+ SERIAL_PORT +"' from '" + CONFIG_FILE + "'."

    if not SERIAL_PORT:
        print "-----------------------------------------------------------------------------"
        print "WARNING: axCutapp doesn't know what serial device to connect to!"
        print "Make sure the axCut hardware is connectd to the USB interface."
        if os.name == 'nt':
            print "ON WINDOWS: You will also need to setup the virtual com port."
            print "See 'Installing Drivers': http://arduino.cc/en/Guide/Windows"
        print "-----------------------------------------------------------------------------"

        SerialManager.list_devices(BITSPERSECOND)


    # run
    if args.debug:
        debug(True)
        if hasattr(sys, "_MEIPASS"):
            print "Data root is: " + sys._MEIPASS

    # host on all interfaces
    run_with_callback('', NETWORK_PORT)
