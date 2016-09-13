
simScale = 0.5;
simShowTravelMoves = true;
simAnimate = true;
simLastRow = 0;

simState = {
    pos: [0,0,0],
    armed:false,
    power:0,  // 0 - 100
    laserOn:false,
    feed:1000,   // in mm/min
    elapsed:0, // seconds
    cutting:0,  // seconds
    PCE:0  // percentage 0-100
};

simGCode = '';  // copied from editor

var editor;

simLoadedFilename = '';

simAnnotations = [];  // line annotations, fed back to editor


function simInit() {

    editor = ace.edit("editor");
    editor.setTheme("ace/theme/chrome");
    editor.getSession().setMode("ace/mode/gcode");

    // detect tab coming into view
    $('#tab-sim').on('shown', function (e) {
        // treat as resize!
        simOnResize();
    });


    var fileInput = document.getElementById('loadGCodeInput');
    fileInput.addEventListener('change', function (event) {
        var fileUploader = this;
        var files = event.target.files;
        if (files.length > 0) {
            var file = files[0];
            if (file.name.endsWith('gcode')) {

                simLoadedFilename = file.name;

                var reader = new FileReader();

                reader.onload = function(e) {
                    editor.setValue(reader.result, -1);

                    $('#simBut').click();
                };

                reader.readAsText(file);
            }
        }
    });

    $('#simSaveBut').click(function() {
        window.URL = window.URL || window.webkitURL;

		var src = editor.getValue();

		var blob = new Blob([src], {type: 'text/plain'});

		var link = $('#simDownload');
        link.html(simLoadedFilename);
		link.attr('href',window.URL.createObjectURL(blob));
        if (simLoadedFilename == '')
            simLoadedFilename = 'new.gcode';
		link.attr('download',simLoadedFilename);
        //link.show();


		//link.show();
        document.getElementById("simDownload").click();
    });


    $('#playbackBut').click(function() {
        // POST gcode to cutter
        var src = editor.getValue();

        $.ajax({
            url:"gcode",
            cache: false,
            data:{'gcode':src},
            method:'POST',
            success:function( data ) {
                notify(data.message, data.status);
            },
            dataType:'json'
        });
    });

    /*
    $( "#editorResizer" ).resizable({
        resize: function( event, ui ) {
          editor.resize();
        }
      });
      */

    simOnResize();

    var simSplitter = $("#simSplitter");
    simSplitter.splitter();


    $(window).on('resize', function(){
       //simOnResize();
    });


    editor.getSession().selection.on('changeCursor', function(e) {
        // if live enabled, then draw to cursor
        if ($('#simLiveUpdate').is(':checked')) {
            simToCursor();
        }
    });


    $('#simBut').click(function() {

        simAll();

    });

/*
    $('#simToCursorBut').click(function() {

        simShowTravelMoves = ($('#simTravelMovesCheckbox').is(':checked'));

        simSetScale();

        simDrawBed();

        simResetState();

        var gcode = editor.getValue();
        simToLine(gcode, editor.selection.getCursor().row);

    });
*/
}

function simOnResize() {
    var simSplitter = $("#simSplitter");
    simSplitter.height($(window).height()-90);
    simSplitter.trigger("resize");
}


function simSetScale() {
    var canvas = document.getElementById('simCanvas');
    canvas.width = $(canvas).parent().width();
    simScale = canvas.width / machine.bedW;
    canvas.height = simScale * machine.bedD + 1;
}


function simAll() {
    simShowTravelMoves = ($('#simTravelMovesCheckbox').is(':checked'));
    simAnimate = ($('#simAnimate').is(':checked'));

    simSetScale();

    simDrawBed();

    simResetState();

    simGCode = editor.getValue();
    if (simAnimate) {
        simLastRow = 0;
        simAnimator();
    } else
        simToLine(simGCode);
}

function simAnimator() {
    simLastRow++;
    var lastElapsed = simState.elapsed;
    var startTime = new Date();
    // draw at least 10 seconds worth of elapsed (100ms)
    // draw at least one line
    var linesRemaining = simToLine(simGCode, simLastRow, true);

    while (linesRemaining > 0 && (simState.elapsed - lastElapsed) < 1) {
        simLastRow++;
        linesRemaining = simToLine(simGCode, simLastRow, true);
    }

    if (linesRemaining > 0) {
        var dur = simState.elapsed - lastElapsed;
        dur = dur * 100;  // now in milliseconds, 1 sec becomes 100 ms

        var endTime = new Date();
        var realDur = (endTime - startTime) * 1000;

        setTimeout("simAnimator();", Math.floor(dur - realDur));
    }

}

function simToCursor() {
    var simRow = editor.selection.getCursor().row;
    if (simRow == simLastRow) return;

    simLastRow = simRow;

    simShowTravelMoves = ($('#simTravelMovesCheckbox').is(':checked'));

    simSetScale();

    simDrawBed();

    simResetState();

    var gcode = editor.getValue();
    simToLine(gcode, editor.selection.getCursor().row);
}


function simToLine(gcode, lineNo, animating) {
    animating = false || animating;

    // split gcode into lines
    var lines = gcode.split('\n');

    // process all lines?
    if (animating) {
        if (lineNo > 0 && lineNo < lines.length) {
            simLine(lines[lineNo-1], lineNo);
        }
    } else {
        for (var i = 0; i<lines.length; i++) {
            simLine(lines[i], i);

            if(lineNo >0 && i>=lineNo)
                break;
        }

        simLastRow = lines.length;
    }


    simState.PCE = 100 * simState.cutting / simState.elapsed;

    var s = 'Total: '+timeToStr(simState.elapsed) + ', '+
            'Cutting: '+timeToStr(simState.cutting) + ', ' +
            'PCE: '+(simState.PCE).toFixed(0) + '% ';

    $('#simInfo').html(s);

    // return lines remaining
    return lines.length - lineNo;
}

function simTestFire(pwr, dur) {
    // draw move
    var canvas = document.getElementById('simCanvas');
    var ctx = canvas.getContext('2d');
    ctx.lineWidth = 1 * simScale;
    ctx.strokeStyle = 'rgba(0,255,0,'+pwr/100+')';

    ctx.beginPath();
    ctx.arc(simState.pos[0] * simScale, (machine.bedD - simState.pos[1]) * simScale, simScale * 3, 0, Math.PI*2, true);
    ctx.stroke();
    simState.elapsed += dur/1000;
    simState.cutting += dur/1000;
}

function simLineTo(newPos) {

    // draw move
    var canvas = document.getElementById('simCanvas');
    var ctx = canvas.getContext('2d');
    ctx.lineWidth = 1 * simScale;
    if (simState.laserOn) {
        //ctx.lineWidth += simScale * simState.power/200;
        ctx.strokeStyle = 'rgba(255,0,0,'+simState.power/100+')';
    } else
        ctx.strokeStyle = 'rgba(0,0,255,0.3)';

    if (simState.laserOn || simShowTravelMoves) {
        ctx.beginPath();
        ctx.moveTo(simState.pos[0] * simScale, (machine.bedD - simState.pos[1]) * simScale);
        ctx.lineTo(newPos[0] * simScale, (machine.bedD - newPos[1]) * simScale);
        ctx.stroke();
    }

    // after move
    var distMoved = Math.sqrt(
        sqr(newPos[0] - simState.pos[0]) +
        sqr(newPos[1] - simState.pos[1]) +
        sqr(newPos[2] - simState.pos[2])
    );
    simState.pos = newPos;
    if (distMoved > 0 && simState.feed > 0) {
        simState.elapsed += distMoved / (simState.feed / 60);
        if (simState.laserOn)
        simState.cutting += distMoved / (simState.feed / 60);
    } else {
        //console.log(distMoved, simState);
    }
}


function simBezierTo(newPos, handle1, handle2) {

    p = [
        [simState.pos[0], simState.pos[1]],
        [handle1[0], handle1[1]],
        [handle2[0], handle2[1]],
        [newPos[0], newPos[1]]
    ];

    var steps = 10;
    var stepsPerUnit = 1;  // approx segments per mm
    var stepsPerUnitSqr = 0.5 * 0.5;

    var f= [0,0];  // next position
    var lf = [0,0];  // last position
    var fd=[0,0];
    var fdd=[0,0];
    var fddd=[0,0];
    var fdd_per_2=[0,0];
    var fddd_per_2=[0,0];
    var fddd_per_6=[0,0];
    var t = 1.0;
    var temp;

    // calc num steps from estimate of curve length
    var maxD = 0;
    var sqrD = 0;
    for (var i=1; i<4; i++) {
    	sqrD = (p[i][0] - p[i-1][0])*(p[i][0] - p[i-1][0])  +  (p[i][1] - p[i-1][1])*(p[i][1] - p[i-1][1]);
    	if (sqrD > maxD) {maxD = sqrD; };
    }
    maxD = Math.sqrt(maxD);
    if (maxD > 0) {
    	steps = Math.round((3 * maxD  * stepsPerUnit));
    }
    if (steps < 1) steps = 1;
    if (steps > 200) steps = 200;

    // init Forward Differencing algo
    //---------------------------------------
    t = 1.0 / steps;
    temp = t*t;
    for (var i=0; i<2; i++) {
        f[i] = p[0][i];
        lf[i] = p[0][i];
        fd[i] = 3 * (p[1][i] - p[0][i]) * t;
        fdd_per_2[i] = 3 * (p[0][i] - 2 * p[1][i] + p[2][i]) * temp;
        fddd_per_2[i] = 3 * (3 * (p[1][i] - p[2][i]) + p[3][i] - p[0][i]) * temp * t;

        fddd[i] = fddd_per_2[i] + fddd_per_2[i];
        fdd[i] = fdd_per_2[i] + fdd_per_2[i];
        fddd_per_6[i] = (fddd_per_2[i] * (1.0 / 3));
    }

    // iterate through curve
    //---------------------------------------
    for (var loop=0; loop < steps; loop++) {
        // check if move is of sufficient length to bother with
        if ((f[0]-lf[0])*(f[0]-lf[0]) + (f[1]-lf[1])*(f[1]-lf[1]) >= stepsPerUnitSqr) {
            //plan_buffer_line(f[0], f[1], current_position[2], current_position[3], feed_rate, extruder);
            simLineTo([f[0], f[1], newPos[2] ]);
            lf[0] = f[0];
            lf[1] = f[1];
    }

    // update f
    for (var i=0; i<2; i++) {
      f[i] = f[i] + fd[i] + fdd_per_2[i] + fddd_per_6[i];
      fd[i] = fd[i] + fdd[i] + fddd_per_2[i];
      fdd[i] = fdd[i] + fddd[i];
      fdd_per_2[i] = fdd_per_2[i] + fddd_per_2[i];
    }
    }

    // make sure we get to the end of the curve precisely
    simLineTo(newPos);

}


function simLine(gcode, lineNo) {
    gcode = gcode.trim();

    // skip blank lines and comments
    if (gcode == '') return;
    if (gcode[0] == ';') return;

    // parse codes and values
    codes = simParseCodes(gcode);

    error = '';

    if ('G' in codes) {
        codes.G = Math.round(codes.G);

        switch (codes.G) {
            case 1:  // move
                // before move
                if ('F' in codes)
                    simState.feed = clamp(codes.F,1,25000);

                var newPos = simState.pos.slice();
                if ('X' in codes)
                    newPos[0] = clamp(codes.X,0,machine.bedW);
                if ('Y' in codes)
                    newPos[1] = clamp(codes.Y,0,machine.bedD);
                if ('Z' in codes)
                    newPos[2] = clamp(codes.Z,0,machine.bedH);

                simLineTo(newPos);

                break;

            case 5:  // bezier
                // of form: G5 X240.8 Y128.2 I256.9 J155.5 K246.3 L128.2 F3719

                if ('F' in codes)
                    simState.feed = clamp(codes.F,1,25000);

                var newPos = simState.pos.slice();
                if ('X' in codes)
                    newPos[0] = clamp(codes.X,0,machine.bedW);
                if ('Y' in codes)
                    newPos[1] = clamp(codes.Y,0,machine.bedD);
                if ('Z' in codes)
                    newPos[2] = clamp(codes.Z,0,machine.bedH);

                var handle1 = simState.pos.slice();
                if ('I' in codes)
                    handle1[0] = clamp(codes.I,0,machine.bedW);
                if ('J' in codes)
                    handle1[1] = clamp(codes.J,0,machine.bedD);

                var handle2 = newPos.slice();
                if ('K' in codes)
                    handle2[0] = clamp(codes.K,0,machine.bedW);
                if ('L' in codes)
                    handle2[1] = clamp(codes.L,0,machine.bedD);

                simBezierTo(newPos, handle1, handle2);

                break;

            case 28:  // home
                // which axes to home?
                if ('X' in codes)
                    simState.pos[0] = machine.bedW;
                if ('Y' in codes)
                    simState.pos[1] = machine.bedD;
                if ('Z' in codes)
                    simState.pos[2] = machine.bedH;
                simState.elapsed += 10;  // guess
                // TODO: better estimate of time to home
                break;

            default:
                error = 'Unknown G Code';
        }
    } else if ('M' in codes) {
        codes.M = Math.round(codes.M);

        switch (codes.M) {
            case 4: // laser on
                if (simState.armed) {
                    simState.laserOn = true;
                    if ('S' in codes) {
                        simState.power = clamp(codes.S,0,100);
                    }
                } else {
                    error = 'Attempting to turn laser on before arming';
                }
                break;

            case 5: // laser off
                simState.laserOn = false;
                break;

            case 669: // arm
                simState.armed=true;
                break;

            case 670: // disarm
                simState.armed=false;
                break;

            case 671: // testfire
                if (simState.armed) {
                    if ('S' in codes && 'P' in codes) {
                        var power = clamp(codes.S,0,100);
                        var dur = codes.P;
                        simTestFire(power, dur);
                    }
                }
                break;

            default:
                error = 'Unknown M Code';
        }

    } else {
        // error
        error = 'Error - No G or M Code';
    }

    if (error != '') {
        simAnnotations = simAnnotations.filter(function (el) {
    		return el.row != lineNo;
    	});
        simAnnotations.push({
                  row: lineNo,
                  column: 1,
                  text: error,
                  type: "error"
              });
        editor.getSession().setAnnotations(simAnnotations);
    }
}

function simParseCodes(gcode) {
    codes = {};

    var codePat = /[A-Z]/;
    var valPat = /[0-9\.\-]/;

    code = '';
    codeValue = '';

    for (var i=0; i<gcode.length; i++) {
        if (codePat.test(gcode[i])) {
            // store last code
            if (code != '')
                codes[code] = Number(codeValue);

            // reset
            code = gcode[i];
            codeValue = '';
        }

        if (valPat.test(gcode[i])) {
            if (code != '')
                codeValue += gcode[i];
        }
    }
    // store last code if valid
    if (code != '')
        codes[code] = Number(codeValue);

    return codes;
}


function simResetState() {
    simState.pos = [machine.bedW, machine.bedD, machine.bedH];
    simState.armed = false;
    simState.power = 0;
    simState.laserOn = false;
    simState.feed = 1000;
    simState.elapsed = 0;
    simState.cutting = 0;
    simState.PCE = 0;
    simAnnotations = [];
}

function simDrawBed() {
  var canvas = document.getElementById('simCanvas');
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(255,255,255)';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.strokeRect(0,0,machine.bedW * simScale, machine.bedD * simScale);


  if($('#simGridlinesCheckbox').is(':checked')) {
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    // draw grid lines
    ctx.lineWidth = 1 * simScale;
    for (x = 0; x <= Math.floor(machine.bedW/100); x++) {
        ctx.beginPath();
        ctx.moveTo(x*100 * simScale, 0);
        ctx.lineTo(x*100 * simScale, machine.bedD * simScale);
        ctx.stroke();
    }
    for (y = 0; y <= Math.floor(machine.bedD/100); y++) {
        ctx.beginPath();
        ctx.moveTo(0, (machine.bedD - y*100) * simScale);
        ctx.lineTo(machine.bedW * simScale, (machine.bedD - y*100) * simScale);
        ctx.stroke();
    }
  }
}
