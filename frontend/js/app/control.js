
var customControls = {};
var gcodeCommands = [];

function controlInit() {
    $('#safeHomeAllBut').click(function() {
        $.ajax({
            url:"/gcode",
            method:'POST',
            cache: false,
            data: {'gcode':'M670\r\nG91\r\nG1 Z-5\r\nG90\r\nG28 XY\r\nG28 Z\r\n'},
            success:function( data ) {

            },
            dataType:"json"
        });
    });

    $('#homeAllBut').click(function() {
        $.ajax({
            url:"/gcode",
            method:'POST',
            cache: false,
            data: {'gcode':'M670\r\nG28 XY\r\nG28 Z\r\n'},
            success:function( data ) {

            },
            dataType:"json"
        });
    });

    $('#homeXBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'M670\r\nG28 X'}
        });
    });

    $('#homeYBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'M670\r\nG28 Y'}
        });
    });

    $('#homeZBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'M670\r\nG28 Z'}
        });
    });


    $('#armBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'M669'}
        });
    });

    $('#disarmBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'M670'}
        });
    });

    $('#testfireBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'M671 S50 P100'}
        });
    });


    $('#topLeftBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'G1 X0 Y630'}
        });
    });

    $('#topRightBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'G1 X850 Y630'}
        });
    });

    $('#bottomLeftBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'G1 X0 Y0'}
        });
    });

    $('#bottomRightBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'G1 X850 Y0'}
        });
    });


    $('#gcodeEntry').keyup(function(e){
        if(e.keyCode == 13)
        {
            if (!validateManualGCode()) return;

            var gcode = $(this).val();
            if (gcode != '')
                $.ajax({
                    url:"/gcodeline",
                    cache: false,
                    data: {'gcode':gcode},
                    success:function() {
                        notify(gcode + ' queued');
                    }
                });
        } else {
            // run through validator
            validateManualGCode();
        }
    });

    $('#headCrashBut').click(function() {
        $.ajax({
            url:"/gcodeline",
            cache: false,
            data: {'gcode':'M670\r\nG92 Z120\r\nG1 Z60 F10000'}
        });
    });


    $.getJSON("/library/gcode.json", function(d) {
        if (d.commands)
            gcodeCommands = d.commands;

        var h = '';
        for (var i=0; i<gcodeCommands.length; i++) {
            c = gcodeCommands[i];
            h += '<li><b>'+c.code+'</b>: '+escapeHtml(c.desc)+'</li>';
        }

        $("#controlGCodeCommands").html(h);
    });


    // custom controls
    // load json descriptor
    $.getJSON("/library/control.json", function(d) {

        customControls = d;

        var cg = $('#controlGroups');

        // dynamic binding
        cg.delegate('button.btn-dynamic', 'click',function(e) {
            var gcode = decodeURI($(this).attr('data-gcode')) || '';
            var filename = $(this).attr('data-file');
            if (filename != undefined) {
                // get file
                $.ajax({
                    url:"/library/" + filename,
                    cache: false,
                    success: function(data) {
                        // queue script
                        $.ajax({
                            url:"gcode",
                            data:{'gcode':data},
                            method:'POST',
                            cache: false,
                            success:function( d2 ) {
                                notify(d2.message, d2.status);
                            },
                            dataType:'json'
                        });
                    },
                    error: function(e) {
                        notify('GCode file not found: '+filename, 'error')
                    }
                });
            } else
                $.ajax({
                    url:"/gcodeline",
                    cache: false,
                    data: {'gcode':gcode}
                });
            event.preventDefault();
        });

        try {
            for (var i=0; i<d.groups.length; i++) {
                var g = d.groups[i];

                var ng = '<div class="form-group">';
                ng += '<label class="col-sm-2 control-label">'+g.label+'</label>'
                ng += '<div class="col-sm-10">'+lfcr;

                for (var j=0; j<g.buttons.length; j++) {
                    var b = g.buttons[j];
                    var nb = '';

                    if (b.file != undefined) {
                        nb = '<button '+
                                  ' id="controlDynamic'+i+'_'+j+'"'+
                                  ' type="button" class="btn btn-'+b.type+' btn-md btn-dynamic" '+
                                  ' data-file="'+b.file+'"'+
                                  ' >';
                        nb += b.label;
                        nb += '</button>'+lfcr;
                    } else {
                        nb = '<button '+
                                  ' id="controlDynamic'+i+'_'+j+'"'+
                                  ' type="button" class="btn btn-'+b.type+' btn-md btn-dynamic" '+
                                  ' data-gcode="'+encodeURI(b.commands)+'"'+
                                  ' >';
                        nb += b.label;
                        nb += '</button>'+lfcr;
                    }


                    ng += nb;
                }

                ng += '</div></div>';
                cg.append(ng);

            }
        } catch(e) {
            notify('Error loading custom controls: '+e.message,'error')
        }
    });

}


function lookupCommand(code) {
    var desc = '';

    for (var i=0; i<gcodeCommands.length; i++) {
        var cmd = gcodeCommands[i];
        if (cmd.code == code) {
            desc = cmd.desc;
            break;
        }
    }

    return desc;
}


function validateManualGCode() {
    var gcode = $('#gcodeEntry').val();
    var valid = true;
    var error = '';
    var desc = '';

    var codes = simParseCodes(gcode);

    if ('G' in codes) {
        codes.G = Math.round(codes.G);

        // look for match in gcodeCommands
        var desc = lookupCommand('G' + codes.G);
        if (desc != '') error += 'Command: '+escapeHtml(desc) + '<br>'

        switch (codes.G) {
            case 0:
            case 1:
            case 5:

                if ('F' in codes) {
                    if (codes.F < 1 || codes.F > 20000) {
                        valid = false;
                        error += 'F out of range<br>';
                    }
                }

                if ('X' in codes) {
                    if (codes.X < 0 || codes.X > machine.bedW) {
                        valid = false;
                        error += 'X out of range<br>';
                    }
                }

                if ('Y' in codes) {
                    if (codes.Y < 0 || codes.Y > machine.bedD) {
                        valid = false;
                        error += 'Y out of range<br>';
                    }
                }

                if ('Z' in codes) {
                    if (codes.Z < 0 || codes.Z > machine.bedH) {
                        valid = false;
                        error += 'Z out of range<br>';
                    }
                }

                break;

            case 28:  // home

                break;

        }

    } else if ('M' in codes) {
        codes.M = Math.round(codes.M);

        // look for match in gcodeCommands
        var desc = lookupCommand('M' + codes.M);
        if (desc != '') error += 'Command: '+escapeHtml(desc) + '<br>'

        switch (codes.M) {
            case 4:
                if ('S' in codes) {
                    if (codes.S < 1 || codes.S > 100) {
                        valid = false;
                        error += 'S (power) out of range<br>';
                    }
                } else {
                    error += 'Warning: S (power) not specified, cutter will use last value<br>';
                }
                break;
            case 671:
                if ('S' in codes) {
                    if (codes.S < 1 || codes.S > 100) {
                        valid = false;
                        error += 'S (power) out of range<br>';
                    }
                } else {
                    valid = false;
                    error += 'S (power) not specified<br>';
                }

                if ('P' in codes) {
                    if (codes.P < 1 || codes.P > 10000) {
                        valid = false;
                        error += 'P (milliseconds) out of range<br>';
                    }
                } else {
                    valid = false;
                    error += 'P (milliseconds) not specified<br>';
                }
                break;
        }

    } else if (gcode.length > 0 && gcode[0] == ';') {

    } else if (gcode != '') {
        valid = false;
        error = 'Unknown command';
    }

    $('#controlGCodeInfo').html(error);

    if (valid) {
        $('#gcodeEntry').parent().addClass('has-success').removeClass('has-error');
    } else {
        $('#gcodeEntry').parent().removeClass('has-success').addClass('has-error');
    }

    return valid;
}
