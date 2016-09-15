
var lfcr = '\r\n';

// Models

/*
powerMap: [
    [1,      1,     1,     0.7,  0.7],
    [1,      1,     1,     0.9,  0.7],
    [1,      0.9,   0.95,  0.9,  0.6],
    [0.95,   0.8,   0.8,   0.8,  0.4],
    [0.85,   0.7,   0.7,   0.70, 0.4]
],
*/

// Machine defaults...  to be overridden by settings in library/machine.json
var machine = {
    bedW: 890,
    bedD: 620,
    bedH: 100,
    homeTo: [890,620,100],
    powerMap: [
		[1,    1,    1,   0.8,  0.6],
		[1,    1,    1,   0.9,  0.6],
		[1,    1,    1,   0.9,  0.5],
		[1,    0.9,  0.9,   0.9,  0.4],
		[0.8,  0.8,  0.8,   0.6,  0.4]
	],
	maxLineLength: 50 // mm
};


function MachineViewModel() {
    // Data
    var self = this;
    self.status = {
        ready: ko.observable(false),
        paused: ko.observable(false),
        queuedLines: ko.observable(0)
    };
    self.connected = ko.observable(false);
    self.queueTop = ko.observable('');
    self.logTail = ko.observable('');

};

masterVM = {
    machineVM: new MachineViewModel()
};


function loadMachineConfig() {
    $.ajax({ url: "library/machine.json", cache: false,
    success: function(data){
      machine.bedW = data.axesLimits[0];
      machine.bedD = data.axesLimits[1];
      machine.bedH = data.axesLimits[2];
      machine.powerMap = data.powerMap;
      machine.homeTo = data.homeTo;
      machine.maxLineLength = data.maxLineLength;
    },
    error: function() {
        //?
    },
    dataType: "json"});
}


// GCode generation

function genM4(pwr) {
    return 'M4 S'+clamp(pwr,0,100) + '\r\n';
}

function genM5() {
    return 'M5\r\n';
}



// Connection poller
(function connectionPoller(){
   setTimeout(function(){
      $.ajax({
          url: "serial/isConnected",
          cache: false,
          success: function(data){
              masterVM.machineVM.connected(data.data == 1);

              connectionPoller();
          },
          error: function() {
              connectionPoller();
          },
          dataType: "json"});
      },
      1100);
})();


// Status poller
(function statusPoller(){
   setTimeout(function(){
      $.ajax({ url: "device/status", cache: false,
      success: function(data){
        masterVM.machineVM.status.ready(data.data.ready);
        masterVM.machineVM.status.paused(data.data.paused);
        masterVM.machineVM.status.queuedLines(data.data.queuedLines);

        statusPoller();
      },
      error: function() {
          statusPoller();
      },
      dataType: "json"});
  }, 1000);
})();

// queueTop poller
(function queueTopPoller(){
   setTimeout(function(){
      $.ajax({ url: "queue/top", cache: false,
      success: function(data){
        masterVM.machineVM.queueTop(data.data);

        queueTopPoller();
      },
      error: function() {
          queueTopPoller();
     },
      dataType: "json"});
  }, 1200);
})();

// logTail poller
(function logTailPoller(){
   setTimeout(function(){
      $.ajax({ url: "serial/tail", cache: false,
      success: function(data){
        masterVM.machineVM.logTail(data.data);

        logTailPoller();
      },
      error: function() {
          logTailPoller();
      },
      dataType: "json"});
  }, 1300);
})();



// Utilities

function notify(msg, t) {
    if (!t) t = 'success';
    if (t == 'error') t = 'danger';

    $.notify({
        message: msg
    },{
        type: t,
        delay: 3000,
        offset: {
            x: 20,
            y: 70
        },
        animate: {
    		enter: 'animated fadeInDown',
    		exit: 'animated fadeOutUp'
    	}
    });
}


function timeToStr(duration) {
    // takes a duration in seconds, returns nicely formatted
    minutes = parseInt(duration / 60, 10);
    seconds = parseInt(duration % 60, 10);

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    return minutes + ":" + seconds;
}


function ETATimer(duration, display) {
    $(display).hide();

    var timer = duration, minutes, seconds, count;
    var hidden = true;
    count = 0;
    var ETAI = setInterval(function () {
        display.text(timeToStr(timer));

        count++;

        if (timer > 0 && hidden) {
            hidden = false;
            $(display).fadeIn('slow');
        }

        if (!masterVM.machineVM.status.paused()) {
            if ((timer < 1 || masterVM.machineVM.status.queuedLines() == 0) && !hidden) {
                timer = 0;
                hidden = true;
                $(display).fadeOut('slow');
            } else if (timer > 0) {
                timer--;
            }
        }

        if (count % 10 == 1 || (hidden && masterVM.machineVM.status.queuedLines() > 0)) {
            $.ajax({
                url:"queue/eta",
                cache: false,
                success:function( data ) {
                    timer = data.data * 60;
                },
                dataType:'json'
            });
        }

    }, 1000);
}


var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };

  function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
  }


// Init and UI

$(document).ready(function(){

    ETATimer(0, $('#ETA'));

    // tabs
	$('ul.tabs li').click(function(){
		var tab_id = $(this).attr('data-tab');

		$('ul.tabs li').removeClass('active');
		$('.tab-content').removeClass('active');

		$(this).addClass('active');
		$("#"+tab_id).addClass('active');

        // trigger event on tab container
        $("#"+tab_id).trigger('shown');

        // scroll to top
		$('html, body').animate({
		    scrollTop: 0
		}, 500);
	});



    // Global
    $('#abortBut').click(function() {
        $.ajax({
            url:"/abort",
            cache: false,
            success:function(data) {
                // now queue a disarm
                $.ajax({
                    url:"/gcodeline",
                    data: {'gcode':'M670'}
                });

                notify(data.message, data.status);
            },
            dataType:'json'
        });
    });


    $('#pauseBut').click(function() {

        if (masterVM.machineVM.status.paused()) {
            $.ajax({
                url:"/queue/play",
                cache: false,
                success:function(data) {

                },
                dataType:'json'
            });

        } else {
            $.ajax({
                url:"/queue/pause",
                cache: false,
                success:function(data) {

                },
                dataType:'json'
            });
        }


    });

    // load machine config
    loadMachineConfig();

    controlInit();

    newInit();

    simInit();

    matInit();

    calibInit();

    settingsInit();


    // tooltips
    $('[data-toggle="tooltip"]').tooltip()

    // finally, apply bindings
    ko.applyBindings(masterVM);
})

function sqr(a) {
    return a*a;
}

function clamp(val, min, max){
    return Math.max(min, Math.min(max, val));
}

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

if(typeof(String.prototype.trim) === "undefined")
{
    String.prototype.trim = function()
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}


function Queue(q) {"use strict";
  // (C) WebReflection - Mit Style License
  var
    next = function next() {
      return (callback = q.shift()) ? !!callback(q) || !0 : !1;
    },
    callback
  ;
  (q.wait = function wait(condition, delay) {
    condition || callback && q.unshift(callback);
    setTimeout(q.next = next, delay || 0);
  })(1);
  return q;
}


function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}


// a is start value, b is end, p ranges 0-1
function lerp(a,b,p) {
    return a + (b-a)*p;
}


// maodifies the feed rate based on the power map
function mapFeedRate(f, x, y) {

    powerMapSize = machine.powerMap.length;

    // work out cell size
    var xs = (machine.bedW) / (powerMapSize-1);
    var ys = (machine.bedD) / (powerMapSize-1);

    // get coords of top-left in power map array
    var i = Math.floor(clamp(x / xs, 0, powerMapSize-2));
    var j = Math.floor(clamp(y / ys, 0, powerMapSize-2));

    // get lerp ratios
    var k = (x - (i*xs)) / xs;
    var l = (y - (j*ys)) / ys;

    // do the x lerps, invert y !
    var pms = powerMapSize - 1;
    var x1 = lerp( machine.powerMap[pms - j][i], machine.powerMap[pms-j][i+1], k);
    var x2 = lerp( machine.powerMap[pms - (j+1)][i], machine.powerMap[pms-(j+1)][i+1], k);

    // do the y lerp
    var y1 = lerp(x1, x2, l);

    return f * y1;
}
