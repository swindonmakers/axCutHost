
var calibScriptName = '';
var calibEditor;

function calibInit() {

    calibEditor = ace.edit("calibEditor");
    calibEditor.setTheme("ace/theme/chrome");
    calibEditor.getSession().setMode("ace/mode/json");

    $('#calibScriptSelect').change(function() {
        calibScriptName = $('#calibScriptSelect').val();

        var notes = '';

        var data = {};

        try {
            if (calibScriptName != '') {
                if (calibScriptName == 'randomWalk') {
                    notes = calibRandomWalkNotes();
                    data = calibRandomWalkDefaults();
                } else if (calibScriptName == 'bargraphs') {
                    notes = calibBargraphsNotes();
                    data = calibBargraphsDefaults();
                } else if (calibScriptName == 'combs') {
                    notes = calibCombsNotes();
                    data = calibCombsDefaults();
                }


                $('#calibGenBut').show();
            }

        } catch (err) {
            notify(err.message, 'error');
        }

        $('#calibNotes').html(notes);

        calibEditor.setValue(JSON.stringify(data, null, '\t'), -1);
    })


    $('#calibGenBut').click(function() {
        var data = {};
        var gcode = '';
        try {
            data = JSON.parse(calibEditor.getValue());

            if (calibScriptName != '') {
                if (calibScriptName == 'randomWalk') {
                    gcode = calibRandomWalkGen(data);
                } else if (calibScriptName == 'bargraphs') {
                    gcode = calibBargraphsGen(data);
                } else if (calibScriptName == 'combs') {
                    gcode = calibCombsGen(data);
                }
            }

            if (gcode != '') {
                // add gcode to editor
                editor.setValue(gcode, -1);

                simLoadedFilename = calibScriptName + '.gcode';


                // trigger simAll
                $('#simBut').click();

                // switch to playback tab
                $('#tabSimLink').click();
            }

        } catch (err) {
            notify(err.message, 'error');
        }
    });
}




function calibRandomWalkNotes() {
    return '<h3>Random Walk</h3>'+
           '<p>Designed to stress test the mechanics of the cutter by generating lots of short fast moves in random directions.'+
           'Between each cycle, a short L shape is cut in the top-right corner - they should all overlap.</p>'+
           '<dl>'+
                '<dt>walk</dt>'+
                '<dd>Length of random walk segments in mm</dd>'+
                '<dt>cycles</dt>'+
                '<dd>How many cycles of random walk movements</dd>'+
                '<dt>iterations</dt>'+
                '<dd>Number of random walk steps per cycle</dd>'+
                '<dt>z</dt>'+
                '<dd>Bed height</dd>'+
                '<dt>power</dt>'+
                '<dd>Laser power 0-100</dd>'+
                '<dt>speed</dt>'+
                '<dd>mm/sec</dd>'+
                '<dt>bottomLeft</dt>'+
                '<dd>Bottom left of bounding box</dd>'+
                '<dt>topRight</dt>'+
                '<dd>Top right of bounding box, origin of L shape</dd>'+
           '</dl>';
}

function calibRandomWalkDefaults() {
    return {
        walk: 10,
        cycles:10,
        iterations:200,
        z:106,
        power:16,
        speed:170,
        bottomLeft: [50,50],
        topRight: [machine.bedW-50, machine.bedD-50]
    };
}

function calibRandomWalkGen(data) {
    var gcode = '; Random Walk\r\n'+
                'G28 XY\r\n'+
                'G28 Z\r\n' +
                'M669\r\n';

    var walk = data.walk;  // distance of each walk


    for (var i=0; i<data.cycles; i++) {

        // break out and draw an L shape every now and again

        gcode += 'G1 X'+data.topRight[0]+' Y'+data.topRight[1]+'\r\n';
        gcode += genM4(100);
        gcode += 'G1 X'+(data.topRight[0] + data.walk)+'\r\n';
        gcode += 'G1 Y'+(data.topRight[1] + data.walk)+'\r\n';
        gcode += genM5();

        // start
        var x1 = (data.bottomLeft[0] + data.topRight[0]) / 2;
        var y1 = (data.bottomLeft[1] + data.topRight[1]) / 2;

        var lx = x1;
        var ly = y1;

        // move to center of bounds
        gcode += 'G1 X'+x1+' Y'+y1+'\r\n';

        // random walk
        gcode += genM4(16);
        for (var j=0; j<data.iterations; j++) {

            var ang = Math.random() * 2 * Math.PI;
            var x = lx + walk * Math.cos(ang);
            var y = ly + walk * Math.sin(ang);

            // move - clamp with large margins
            gcode += 'G1 X'+clamp(x, data.bottomLeft[0], data.topRight[0]).toFixed(1)+
                     ' Y'+clamp(y, data.bottomLeft[1], data.topRight[1]).toFixed(1);
            gcode += '\r\n';

            lx = x;
            ly = y;
        }
        gcode += genM5();

    }

    // final L shape
    gcode += 'G1 X'+data.topRight[0]+' Y'+data.topRight[1]+'\r\n';
    gcode += genM4(100);
    gcode += 'G1 X'+(data.topRight[0] + data.walk)+'\r\n';
    gcode += 'G1 Y'+(data.topRight[1] + data.walk)+'\r\n';
    gcode += genM5();

    // disarm laser, move to near homing point, home
    gcode += 'M670\r\n' +
             'G1 X'+machine.bedW+' Y'+machine.bedD+' F10000\r\n' +
             'G28 XY\r\n'+
             'G28 Z\r\n';
    console.log(gcode);

    return gcode;
}




function calibBargraphsNotes() {
    return '<h3>Bargraphs</h3>'+
           '<p>Grid of bargraph patterns comparing the effect of varying two parameters, e.g. speed and power</p>'+
           '<dl>'+
                '<dt>gridSize</dt><dd>Number of bargraph blocks wide and high</dd>'+
                '<dt>cellSize</dt><dd>Size of each little bargraph square in mm</dd>'+
                '<dt>cellSpacing</dt><dd>Gap between squares in mm</dd>'+
                '<dt>bottomLeft</dt><dd>Bottom left of bounding box</dd>'+
                '<dt>topRight</dt><dd>Top right of bounding box, origin of L shape</dd>'+
                '<dt>safeZ</dt><dd>Safe z height for travel moves</dd>'+
                '<dt>passes</dt><dd>Array of 1 or more passes - see below for parameters of each pass</dd>'+
                '<dt>anisotropic</dt><dd>true if anisotropic</dd>'+
                '<dt>anisotropicPower</dt><dd>Varies the feed rate in Y axis use &lt;1.0 to make it slower, use &gt;1.0 to make it faster</dd>'+
           '</dl>'+
           '<h4>Pass Parameters</h4><dl>'+
                '<dt>speed</dt><dd>Starting speed in mm/sec</dd>'+
                '<dt>power</dt><dd>Starting laser power 0-100</dd>'+
                '<dt>z</dt><dd>Starting z height</dd>'+
                '<dt>x</dt><dd>Which parameter to vary in x for each bargraph - speed, power or z</dd>'+
                '<dt>y</dt><dd>Which parameter to vary in y for each bargraph</dd>'+
                '<dt>xCells</dt><dd>How many columns in the bargraph</dd>'+
                '<dt>yCells</dt><dd>How many rows in the bargraph</dd>'+
                '<dt>xInc</dt><dd>How much to increment the x-parameter for each cell</dd>'+
                '<dt>yInc</dt><dd>How much to increment the y-parameter for each cell</dd>'+
           '</dl>';
}

function calibBargraphsDefaults() {
    return {
        gridSize: [5, 3],
        cellSize: 10,
        cellSpacing: 3,
        bottomLeft: [30,10],
        topRight: [660, 450],
        safeZ: 55,
        anisotropic:false,
        anisotropicPower: 0.8,
        passes: [
            {
                speed:20,
                power:100,
                z: 108,
                x: 'z',
                y: 'speed',
                xCells:4,
                yCells:4,
                xInc:1,
                yInc:10
            },
            {
                speed:20,
                power:100,
                z: 108,
                x: '',
                y: '',
                xCells:4,
                yCells:4,
                xInc:1,
                yInc:1
            }
        ]
    };
}


function calibBargraphsGen(data) {
    var gcode = '; Bargraphs\r\n'+
                'G28 XY\r\n'+
                'G28 Z\r\n' +
                'M669\r\n'+
                'G1 Z'+clamp(data.safeZ,0,machine.bedH)+'\r\n';

    // bounds
    var x1 = data.bottomLeft[0];
    var y1 = data.bottomLeft[1];
    var x2 = data.topRight[0];
    var y2 = data.topRight[1];

    // cells
    var xSteps = data.gridSize[0];
    var xStep = (x2-x1) / (xSteps-1);
    var xSpacing = data.cellSize + data.cellSpacing;

    var ySteps = data.gridSize[1];
    var yStep = (y2-y1) / (ySteps-1);
    var ySpacing = data.cellSize + data.cellSpacing;

    var anisotropic = data.anisotropic || false;
    var ap = data.anisotropicPower || 1.0;
    if (!anisotropic) ap = 1;




    /*
        speed:20,
        power:100,
        z: 108,
        x: 'z',
        y: 'speed',
        xCells:4,
        yCells:4,
        xInc:1,
        yInc:10
    */


    // Generate grid of bargraphs
    var x = x1;
    for (var i=0; i<xSteps; i++) {

        var y = y1;
        for (var j=0; j<ySteps; j++) {

            //gcode += '; Bargraph '+i+','+j+'\r\n';

            // passes
            for (var m=0; m<data.passes.length; m++) {
                var pass = data.passes[m];

                //gcode += '; Pass '+m+'\r\n';

                // starting values for this bargraph
                var speed = pass.speed;
                var power = pass.power;
                var z = pass.z;

                // x-cells
                for (var k =0; k<pass.xCells; k++) {
                    //gcode += '; Column '+k+'\r\n';

                    // move to start of box
                    gcode += 'G1 X'+clamp(x + k*xSpacing, 0, machine.bedW).toFixed(1)+
                             ' Y'+clamp(y, 0, machine.bedD).toFixed(1);
                    gcode += 'F10000\r\n';

                    // reset y value
                    if (pass.y == 'z') z = pass.z
                    else if (pass.y == 'power') power = pass.power
                    else if (pass.y == 'speed') speed = pass.speed;

                    // y-cells
                    for (var l=0; l<pass.yCells; l++) {
						//
						//gcode += '; Bargraph '+i+','+j+'\r\n';
						//gcode += '; Pass '+m+'\r\n';
						//gcode += '; Column '+k+'\r\n';
                        //gcode += '; Row '+l+'\r\n';
						
						gcode += '; Bargraph: '+i+','+j+' Pass: '+m+' Column: '+k+' Row: '+l+'\r\n';

                        // move to start of box (bottom left corner)
                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' F10000\r\n';

                        // move to z height
                        gcode += 'G1 Z'+clamp(z, 0, 120).toFixed(1) + '\r\n';


                        // start laser
                        gcode += genM4(power);

                        // cut a box, clockwise
                        // move to top left
                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + data.cellSize + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' F'+clamp(speed*60 * ap, 0, 18000).toFixed(0);
                        gcode += '\r\n';

                        // to top right
                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + data.cellSize + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + data.cellSize + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' F'+clamp(speed*60, 0, 18000).toFixed(0);
                        gcode += '\r\n';

                        // to bottom right
                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + data.cellSize + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' F'+clamp(speed*60 * ap, 0, 18000).toFixed(0);
                        gcode += '\r\n';

                        // to bottom left
                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' F'+clamp(speed*60, 0, 18000).toFixed(0);
                        gcode += '\r\n';

                        // stop laser
                        gcode += genM5();

                        // step for y-cells
                        if (pass.y == 'z') z += pass.yInc
                        else if (pass.y == 'power') power += pass.yInc
                        else if (pass.y == 'speed') speed += pass.yInc;
                    }

                    // step for x-cells
                    if (pass.x == 'z') z += pass.xInc
                    else if (pass.x == 'power') power += pass.xInc
                    else if (pass.x == 'speed') speed += pass.xInc;
                }

            }

            y += yStep;
        }

        x += xStep;
    }



    // disarm laser, move to near homing point, home
    gcode += 'M670\r\n' +
             'G1 Z'+clamp(data.safeZ,0,machine.bedH)+'\r\n'
             'G1 X'+machine.bedW+' Y'+machine.bedD+' F10000\r\n' +
             'G28 XY\r\n'+
             'G28 Z\r\n';

    return gcode;
}




function calibCombsNotes() {
    return '<h3>Combs</h3>'+
           '<p>Grid of comb patterns showing the effect of varying one parameter, e.g. speed</p>'+
           '<dl>'+
                '<dt>gridSize</dt><dd>Number of combs wide and high</dd>'+
                '<dt>cellSize</dt><dd>Size of each little bargraph square in mm</dd>'+
                '<dt>cellSpacing</dt><dd>Gap between squares in mm</dd>'+
                '<dt>bottomLeft</dt><dd>Bottom left of bounding box</dd>'+
                '<dt>topRight</dt><dd>Top right of bounding box, origin of L shape</dd>'+
                '<dt>safeZ</dt><dd>Safe z height for travel moves</dd>'+
                '<dt>passes</dt><dd>Array of 1 or more passes - see below for parameters of each pass</dd>'+
           '</dl>'+
           '<h4>Pass Parameters</h4><dl>'+
                '<dt>speed</dt><dd>Starting speed in mm/sec</dd>'+
                '<dt>power</dt><dd>Starting laser power 0-100</dd>'+
                '<dt>z</dt><dd>Starting z height</dd>'+
                '<dt>x</dt><dd>Which parameter to vary in x for each bargraph - speed, power or z</dd>'+
                '<dt>y</dt><dd>Which parameter to vary in y for each bargraph</dd>'+
                '<dt>xCells</dt><dd>How many columns in the bargraph</dd>'+
                '<dt>yCells</dt><dd>How many rows in the bargraph</dd>'+
                '<dt>xInc</dt><dd>How much to increment the x-parameter for each cell</dd>'+
                '<dt>yInc</dt><dd>How much to increment the y-parameter for each cell</dd>'+
           '</dl>';
}

function calibCombsDefaults() {
    return {
        gridSize: [5, 3],
        cellSize: 10,
        cellSpacing: 3,
        bottomLeft: [30,10],
        topRight: [700, 500],
        safeZ: 105,
        passes: [
            {
                speed:20,
                power:100,
                z: 108,
                x: 'z',
                y: 'speed',
                xCells:4,
                yCells:4,
                xInc:1,
                yInc:10
            },
            {
                speed:20,
                power:100,
                z: 108,
                x: '',
                y: '',
                xCells:4,
                yCells:4,
                xInc:1,
                yInc:1
            }
        ]
    };
}


function calibCombsGen(data) {
    var gcode = '; Combs\r\n'+
                'G28 XY\r\n'+
                'G28 Z\r\n' +
                'M669\r\n'+
                'G1 Z'+clamp(data.safeZ,0,machine.bedH)+'\r\n';

    // bounds
    var x1 = data.bottomLeft[0];
    var y1 = data.bottomLeft[1];
    var x2 = data.topRight[0];
    var y2 = data.topRight[1];

    // cells
    var xSteps = data.gridSize[0];
    var xStep = (x2-x1) / (xSteps-1);
    var xSpacing = data.cellSize + data.cellSpacing;

    var ySteps = data.gridSize[1];
    var yStep = (y2-y1) / (ySteps-1);
    var ySpacing = data.cellSize + data.cellSpacing;


    // passes
    for (var k=0; k<data.passes.length; k++) {
        var pass = data.passes[k];

        gcode += '; Pass '+k+'\r\n';

        /*
            speed:20,
            power:100,
            z: 108,
            x: 'z',
            y: 'speed',
            xCells:4,
            yCells:4,
            xInc:1,
            yInc:10
        */


        // Generate grid of bargraphs
        var x = x1;
        for (var i=0; i<xSteps; i++) {

            var y = y1;
            for (var j=0; j<ySteps; j++) {

                gcode += '; Bargraph '+i+','+j+'\r\n';

                // starting values for this bargraph
                var speed = pass.speed;
                var power = pass.power;
                var z = pass.z;

                // x-cells
                for (var k =0; k<pass.xCells; k++) {
                    gcode += '; Column '+k+'\r\n';

                    // move to start of box
                    gcode += 'G1 X'+clamp(x + k*xSpacing, 0, machine.bedW).toFixed(1)+
                             ' Y'+clamp(y, 0, machine.bedD).toFixed(1);
                    gcode += 'F10000\r\n';

                    // y-cells
                    for (var l=0; l<pass.yCells; l++) {
                        gcode += '; Row '+l+'\r\n';

                        // move to start of box
                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' F10000\r\n';

                        // move to z height
                        gcode += 'G1 Z'+clamp(z, 0, 120).toFixed(1) + '\r\n';


                        // start laser
                        gcode += genM4(power);

                        // cut a box, clockwise from top left
                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + 10 + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' F'+clamp(speed*60, 0, 18000).toFixed(0);
                        gcode += '\r\n';

                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + 10 + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + 10 + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += '\r\n';

                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + 10 + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += '\r\n';

                        gcode += 'G1 ';
                        gcode += ' X'+clamp(x + k*xSpacing, 0, machine.bedW).toFixed(1);
                        gcode += ' Y'+clamp(y + l*ySpacing, 0, machine.bedW).toFixed(1);
                        gcode += '\r\n';

                        // stop laser
                        gcode += genM5();

                        // step for y-cells
                        if (pass.y == 'z') z += pass.yInc
                        else if (pass.y == 'power') power += pass.yInc
                        else if (pass.y == 'speed') speed += pass.yInc;
                    }

                    // step for x-cells
                    if (pass.x == 'z') z += pass.xInc
                    else if (pass.x == 'power') power += pass.xInc
                    else if (pass.x == 'speed') speed += pass.xInc;
                }

                y += yStep;
            }

            x += xStep;
        }
    }


    // disarm laser, move to near homing point, home
    gcode += 'M670\r\n' +
             'G1 Z'+clamp(data.safeZ,0,machine.bedH)+'\r\n'
             'G1 X'+machine.bedW+' Y'+machine.bedD+' F10000\r\n' +
             'G28 XY\r\n'+
             'G28 Z\r\n';

    return gcode;
}
