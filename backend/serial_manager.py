
import os
import sys, traceback
import time
import serial
from serial.tools import list_ports
from collections import deque
import re
import subprocess
import copy
import math
import json


def sqr(a):
    return a*a

class SerialManagerClass:

    def __init__(self):
        self.device = None

        self.rx_buffer = ""
        self.tx_buffer = ""
        self.tx_index = 0
        self.remoteXON = True

        self.queuedLines = []  # send queue
        self.log = []  # recent serial log
        self.logSize = 100  # how many lines to keep

        self.RX_CHUNK_SIZE = 16

        self.CTS = True
        self.resend = 0
        self.resendCount = 0
        self.lastLineNo = 0
        self.lastCmdRaw = ""
        self.lastLastCmdRaw = ""  # the one before the last line!

        # used for calculating percentage done
        self.job_active = False

        # cutter state
        self.cutter_state = {}

        # status flags
        self.status = {}
        self.reset_status()

        # machine config
        self.machine = {
            'axesLimits': [100,100,100],
            'homeTo': [100,100,100]
        }




    def reset_cutter_state(self):
        self.cutter_state = {
            'pos': [0,0,0],
            'armed':False,
            'power':0,  # 0 - 100
            'laserOn':False,
            'feed':1000,   # in mm/min
            'elapsed':0 # seconds
        }

    def parse_codes(self, gcode):
        codes = {}
        codePat = re.compile('[A-Z]');
        valPat = re.compile('[0-9\.\-]');

        code = ''
        codeValue = ''

        for c in gcode:
            if (codePat.match(c)):
                # store last code
                if code != '' and codeValue != '':
                    codes[code] = float(codeValue)

                # reset
                code = c
                codeValue = ''

            if (valPat.match(c)):
                if code != '':
                    codeValue += c

        # store last code if valid
        if code != '' and codeValue != '':
            codes[code] = float(codeValue)

        return codes

    def update_state(self, c):
        codes = self.parse_codes(c)

        if 'G' in codes:
            codes['G'] = int(codes['G'])
            g = codes['G']

            if g == 1 or g == 5:
                if 'F' in codes:
                    self.cutter_state['feed'] = codes['F']

                if 'X' in codes:
                    self.cutter_state['pos'][0] = codes['X']
                if 'Y' in codes:
                    self.cutter_state['pos'][1] = codes['Y']
                if 'Z' in codes:
                    self.cutter_state['pos'][2] = codes['Z']

            elif g == 28:
                if 'X' in codes:
                    self.cutter_state['pos'][0] = self.machine['homeTo'][0]
                if 'Y' in codes:
                    self.cutter_state['pos'][1] = self.machine['homeTo'][1]
                if 'Z' in codes:
                    self.cutter_state['pos'][2] = self.machine['homeTo'][2]


        elif 'M' in codes:
            codes['M'] = int(codes['M'])
            m = codes['M']

            if m == 4:
                if self.cutter_state['armed']:
                    self.cutter_state['laserOn'] = True
                    if 'S' in codes:
                        self.cutter_state['power'] = codes['S']
                else:
                    print "Error, attempting to turn on laser before arming"

            elif m == 5:
                self.cutter_state['laserOn'] = False

            elif m == 669:
                self.cutter_state['armed'] = True

            elif m == 670:
                self.cutter_state['armed'] = False


        else:
            print "No G or M on line"



    def calc_eta(self):
        state = copy.copy(self.cutter_state);
        state['elapsed'] = 0

        for line in self.queuedLines:
            codes = self.parse_codes(self.strip_comments(line))

            if 'G' in codes:
                codes['G'] = int(codes['G'])
                g = codes['G']

                if g == 1 or g == 5:
                    if 'F' in codes:
                        state['feed'] = codes['F']

                    newX = state['pos'][0]
                    newY = state['pos'][1]
                    newZ = state['pos'][2]

                    if 'X' in codes:
                        newX = codes['X']
                    if 'Y' in codes:
                        newY = codes['Y']
                    if 'Z' in codes:
                        newZ = codes['Z']

                    # calc line length
                    ll = math.sqrt(sqr(newX - state['pos'][0]) + sqr(newY - state['pos'][1]) + sqr(newZ - state['pos'][2]))

                    # add 5% extra...
                    state['elapsed'] += 1.05 * ll / (state['feed'] / 60)
                    state['pos'][0] = newX
                    state['pos'][1] = newY
                    state['pos'][2] = newZ

                elif g == 28:
                    if 'X' in codes:
                        state['pos'][0] = self.machine['homeTo'][0]
                    if 'Y' in codes:
                        state['pos'][1] = self.machine['homeTo'][1]
                    if 'Z' in codes:
                        state['pos'][2] = self.machine['homeTo'][2]

                    state['elapsed'] += 10.0



        return state['elapsed'] / 60;




    def reset_status(self):
        self.status = {
            'ready': True  # turns True by querying status
            ,'paused': False  # this is also a control flag
            ,'pauseRequested': False
            ,'queuedLines':0
            ,'resendCount':0
        }

        self.reset_cutter_state()




    def add_to_log(self, s):
        self.log.append(s)
        while (len(self.log) > self.logSize):
            self.log.pop(0)

    def list_devices(self, baudrate):
        ports = []
        if os.name == 'posix':
            iterator = sorted(list_ports.grep('tty'))
            print "Found ports:"
            for port, desc, hwid in iterator:
                ports.append(port)
                print "%-20s" % (port,)
                print "    desc: %s" % (desc,)
                print "    hwid: %s" % (hwid,)
        else:
            # iterator = sorted(list_ports.grep(''))  # does not return USB-style
            # scan for available ports. return a list of tuples (num, name)
            available = []
            for i in range(24):
                try:
                    s = serial.Serial(port=i, baudrate=baudrate)
                    ports.append(s.portstr)
                    available.append( (i, s.portstr))
                    s.close()
                except serial.SerialException:
                    pass
            print "Found ports:"
            for n,s in available: print "(%d) %s" % (n,s)
        return ports


    def connect(self, port, baudrate):
        self.rx_buffer = ""
        self.tx_buffer = ""
        self.tx_index = 0
        self.remoteXON = True
        self.CTS = True;
        self.queuedLines = []
        self.lastCmdRaw = ""
        self.lastLastCmdRaw = ""
        self.reset_status()

        # Create serial device with both read timeout set to 0.
        # This results in the read() being non-blocking
        # Write on the other hand uses a large timeout but should not be blocking
        # much because we ask it only to write TX_CHUNK_SIZE at a time.
        # BUG WARNING: the pyserial write function does not report how
        # many bytes were actually written if this is different from requested.
        # Work around: use a big enough timeout and a small enough chunk size.
        self.device = serial.Serial(port, baudrate, timeout=0, writeTimeout=1)


    def close(self):
        if self.device:
            try:
                self.device.flushOutput()
                self.device.flushInput()
                self.device.close()
                self.device = None
            except:
                self.device = None
            self.status['ready'] = False
            return True
        else:
            return False

    def is_connected(self):
        return bool(self.device)

    def get_hardware_status(self):
        self.status['queuedLines'] = len(self.queuedLines)
        self.status['resendCount'] = self.resendCount
        return self.status

    def get_cutter_state(self):
        return self.cutter_state


    def flush_input(self):
        if self.device:
            self.device.flushInput()

    def flush_output(self):
        if self.device:
            self.device.flushOutput()


    def queue_gcode(self, gcode):
        lines = gcode.split('\n')
        for line in lines:
            line = line.strip()

            if line == '':
                continue

            self.queuedLines.append(line)

        if len(self.queuedLines) > 0:
            # Not ready, as about to be busy
            self.status['ready'] = False
            self.job_active = True
            print "Job queued and active - "+str(len(self.queuedLines))+" lines"
        else:
            print "Nothing queued"

        return len(self.queuedLines)

    def queue_length(self):
        return len(self.queuedLines)

    def top_of_queue(self, n):
        top = self.queuedLines[0:n]
        return '\r\n'.join(top)

    def log_tail(self, n):
        tail = self.log[-n:]
        return '\r\n'.join(tail);

    def cancel_queue(self):
        self.tx_buffer = ""
        self.queuedLines = []
        self.tx_index = 0
        self.job_active = False

    def is_queue_empty(self):
        return len(self.queuedLines) == 0


    def set_pause(self, flag):
        if flag:  # pause
            self.status['pauseRequested'] = True
            print "Pause Requested"
        else:     # unpause
            self.status['pauseRequested'] = False
            self.status['paused'] = False
            print "Playing"


    def send_queue_as_ready(self):
        """Continuously call this to keep processing queue."""

        if self.status['pauseRequested'] and not self.cutter_state['laserOn']:
            self.status['paused'] = True
            self.status['pauseRequested'] = False
            print "Paused"

        if self.device and not self.status['paused']:
            try:
                ### receiving
                chars = self.device.read(self.RX_CHUNK_SIZE)
                if len(chars) > 0:
                    #print "Received: "+chars + "\r\n"
                    self.rx_buffer += chars
                    while(1):  # process all lines in buffer
                        posNewline = self.rx_buffer.find('\n')
                        if posNewline == -1:
                            break  # no more complete lines
                        else:  # we got a line
                            line = self.rx_buffer[:posNewline]
                            self.rx_buffer = self.rx_buffer[posNewline+1:]
                        self.add_to_log(line)
                        self.process_status_line(line)
                else:
                    if not self.CTS:
                        time.sleep(0.0001)  # not CTS, rest a bit

                ### sending
                if len(self.queuedLines) > 0 or self.resend > 0:
                    if self.resend > 0:

                        print "Resending " + str(self.lastLineNo) + " = " + self.lastCmdRaw

                        self.SendCMD()
                        self.resend = 0;
                        self.resendCount += 1

                    elif self.CTS:
                        # pop next command
                        self.lastLastCmdRaw = self.lastCmdRaw
                        c = self.process_comments(self.queuedLines.pop(0))
                        if c != '':
                            self.lastCmdRaw = c
                            self.lastLineNo += 1
                            self.SendCMD()

                else:
                    if self.job_active:
                        print "Queue Emptied\r\n"
                        self.tx_buffer = ""
                        self.tx_index = 0
                        self.job_active = False
                        # ready whenever a job is done
                        self.status['ready'] = True
            except OSError:
                print "OSError"
                traceback.print_exc()
                # Serial port appears closed => reset
                self.close()
            except ValueError:
                print "ValueError"
                traceback.print_exc()
                # Serial port appears closed => reset
                self.close()
        else:
            if not self.device:
                # serial disconnected
                self.status['ready'] = False


    def AddCRC(self):
        cmd = "N" + str(self.lastLineNo) + self.lastCmdRaw
        return cmd + "*" + str(self.CRC16(cmd))


    def SendCMD(self):
        # assume code will succeed and update state
        self.update_state(self.lastCmdRaw)

        c = self.AddCRC()
        self.CTS = False
        print "Sending: "+ c
        self.add_to_log(c)
        c += "\r\n"
        actuallySent = self.device.write(c)

        print "Sent "+str(len(c))+" bytes of "+str(actuallySent)+" bytes"


    def strip_comments(self, c):
        parts = str.split(c, ';')

        return str.replace(str.strip(parts[0]), ' ','')


    def process_comments(self, c):

        parts = str.split(c, ';')

        if len(parts) > 1:
            cmt = str.strip(parts[1])
            print "Comment: " + cmt

            if cmt != '' and cmt[0] == '@':
                print "Shell result:"
                try:
                    subprocess.call(cmt[1:], shell=True)
                except OSError:
                    print "OSError"
                    traceback.print_exc()



        return str.replace(str.strip(parts[0]), ' ','')


    def process_status_line(self, line):
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

        if line == 'ok':
            self.CTS = True
        elif len(line) > 6 and line[:6] == "Resend":
            # either resend one or two lines

            reqLine = int(line[8:])

            if (reqLine != self.lastLineNo):
                # must need to send two lines

                if self.lastLastCmdRaw == "":
                    print "Forcing line number change"
                    # nothing to resend, force update line number instead
                    self.lastLineNo = reqLine

                else:
                    print "Line before last requested!!"

                    # push last line back into queue
                    self.queuedLines.insert(0, self.lastCmdRaw)

                    # reset last line to lastlastline
                    self.lastCmdRaw = self.lastLastCmdRaw
                    self.lastLineNo = reqLine
                    self.lastLastCmdRaw = ""  # can't do this again!

            self.resend = 1


    # CRC 16 Stuff

    auchCRCHi = [
    0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81,
    0x40, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0,
    0x80, 0x41, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x00, 0xC1, 0x81, 0x40, 0x01,
    0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x01, 0xC0, 0x80, 0x41,
    0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x00, 0xC1, 0x81,
    0x40, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x01, 0xC0,
    0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x01,
    0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40,
    0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81,
    0x40, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0,
    0x80, 0x41, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x00, 0xC1, 0x81, 0x40, 0x01,
    0xC0, 0x80, 0x41, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41,
    0x00, 0xC1, 0x81, 0x40, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81,
    0x40, 0x01, 0xC0, 0x80, 0x41, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0,
    0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x01,
    0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81, 0x40, 0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41,
    0x00, 0xC1, 0x81, 0x40, 0x01, 0xC0, 0x80, 0x41, 0x01, 0xC0, 0x80, 0x41, 0x00, 0xC1, 0x81,
    0x40
    ] ;

    auchCRCLo = [
    0x00, 0xC0, 0xC1, 0x01, 0xC3, 0x03, 0x02, 0xC2, 0xC6, 0x06, 0x07, 0xC7, 0x05, 0xC5, 0xC4,
    0x04, 0xCC, 0x0C, 0x0D, 0xCD, 0x0F, 0xCF, 0xCE, 0x0E, 0x0A, 0xCA, 0xCB, 0x0B, 0xC9, 0x09,
    0x08, 0xC8, 0xD8, 0x18, 0x19, 0xD9, 0x1B, 0xDB, 0xDA, 0x1A, 0x1E, 0xDE, 0xDF, 0x1F, 0xDD,
    0x1D, 0x1C, 0xDC, 0x14, 0xD4, 0xD5, 0x15, 0xD7, 0x17, 0x16, 0xD6, 0xD2, 0x12, 0x13, 0xD3,
    0x11, 0xD1, 0xD0, 0x10, 0xF0, 0x30, 0x31, 0xF1, 0x33, 0xF3, 0xF2, 0x32, 0x36, 0xF6, 0xF7,
    0x37, 0xF5, 0x35, 0x34, 0xF4, 0x3C, 0xFC, 0xFD, 0x3D, 0xFF, 0x3F, 0x3E, 0xFE, 0xFA, 0x3A,
    0x3B, 0xFB, 0x39, 0xF9, 0xF8, 0x38, 0x28, 0xE8, 0xE9, 0x29, 0xEB, 0x2B, 0x2A, 0xEA, 0xEE,
    0x2E, 0x2F, 0xEF, 0x2D, 0xED, 0xEC, 0x2C, 0xE4, 0x24, 0x25, 0xE5, 0x27, 0xE7, 0xE6, 0x26,
    0x22, 0xE2, 0xE3, 0x23, 0xE1, 0x21, 0x20, 0xE0, 0xA0, 0x60, 0x61, 0xA1, 0x63, 0xA3, 0xA2,
    0x62, 0x66, 0xA6, 0xA7, 0x67, 0xA5, 0x65, 0x64, 0xA4, 0x6C, 0xAC, 0xAD, 0x6D, 0xAF, 0x6F,
    0x6E, 0xAE, 0xAA, 0x6A, 0x6B, 0xAB, 0x69, 0xA9, 0xA8, 0x68, 0x78, 0xB8, 0xB9, 0x79, 0xBB,
    0x7B, 0x7A, 0xBA, 0xBE, 0x7E, 0x7F, 0xBF, 0x7D, 0xBD, 0xBC, 0x7C, 0xB4, 0x74, 0x75, 0xB5,
    0x77, 0xB7, 0xB6, 0x76, 0x72, 0xB2, 0xB3, 0x73, 0xB1, 0x71, 0x70, 0xB0, 0x50, 0x90, 0x91,
    0x51, 0x93, 0x53, 0x52, 0x92, 0x96, 0x56, 0x57, 0x97, 0x55, 0x95, 0x94, 0x54, 0x9C, 0x5C,
    0x5D, 0x9D, 0x5F, 0x9F, 0x9E, 0x5E, 0x5A, 0x9A, 0x9B, 0x5B, 0x99, 0x59, 0x58, 0x98, 0x88,
    0x48, 0x49, 0x89, 0x4B, 0x8B, 0x8A, 0x4A, 0x4E, 0x8E, 0x8F, 0x4F, 0x8D, 0x4D, 0x4C, 0x8C,
    0x44, 0x84, 0x85, 0x45, 0x87, 0x47, 0x46, 0x86, 0x82, 0x42, 0x43, 0x83, 0x41, 0x81, 0x80,
    0x40
    ] ;


    def CRC16 (self, puchMsg):
        usDataLen = len(puchMsg)
        uchCRCHi = 0xff
        uchCRCLo = 0xff
        uIndex = 0;
        i= 0;
        while(usDataLen > 0):
            usDataLen -= 1
            uIndex = uchCRCLo ^ ord(puchMsg[i])
            i += 1
            uchCRCLo = uchCRCHi ^ self.auchCRCHi[uIndex]
            uchCRCHi = self.auchCRCLo[uIndex]

        return (uchCRCHi << 8 | uchCRCLo) & 0xFFFF;



# singelton
SerialManager = SerialManagerClass()
