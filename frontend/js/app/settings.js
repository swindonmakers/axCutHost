
function drawPowerMap() {
    var c = document.getElementById("powerMapCanvas");
    c.width = machine.bedW/2;
    c.height = machine.bedD/2;
    var ctx = c.getContext("2d");

    ctx.fillStyle = 'rgb(0,0,0)';
    ctx.fillRect(0,0,machine.bedW/2, machine.bedD/2);

    // divide the bed into a regular grid
    var cells = 40;
    var cw = machine.bedW / cells;
    var ch = machine.bedD / cells;
    for (var i=0; i<cells; i++) {
        for (var j=0; j<cells; j++) {
            var x = i * cw;
            var y = j * ch;

            var fs = "hsl("+
                (180 + mapFeedRate(180, x, y)).toFixed(0)+
                ",100%, "+
                (mapFeedRate(50, x, y)).toFixed(0)+
                "%)";
            ctx.fillStyle =fs;
            ctx.fillRect(x/2, (machine.bedD - y - ch)/2, cw/2+1, ch/2+1);
        }
    }

    // place powermap values as text
    ctx.font = "15px Arial";
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    for (var i=0; i<machine.powerMap.length; i++) {
        for (var j=0; j < machine.powerMap.length; j++) {
            var x = 30 + i * (machine.bedW-60)/(machine.powerMap.length-1);
            var y = 20 + j * (machine.bedD-50)/(machine.powerMap.length-1);
            ctx.fillText(machine.powerMap[machine.powerMap.length - j - 1][i], x/2, (machine.bedD - y)/2);
        }
    }


    //mapFeedRate(pass.speed, c.p2[0], c.p2[1]);
}


function settingsInit() {
    // Settings

    $('#listPortsBut').click(function() {
        $('#serialPorts').empty();
        $.ajax({url:"/serial/list", cache: false, success:function( data ) {
            var sp =$('#serialPorts');
            for (var i=0; i<data.data.length; i++) {
                sp.append(
                    '<option value="'+data.data[i]+'">'+data.data[i]+'</option>'
                );
            }
        }, dataType:"json"});
    });

    $('#connectBut').click(function() {
        var port = $('#serialPorts').val();

        if (port != '')
            $.ajax({
                url:"/serial/connect",
                data: {'port':port},
                cache: false,
                success:function( data ) {
                    notify(data.message, data.status);
                },
                dataType:"json"
            });
    });

    $('#disconnectBut').click(function() {
        $.ajax({
            url:"/serial/disconnect",
            cache: false,
            success:function( data ) {
                notify(data.message, data.status);
            },
            dataType:"json"
        });
    });



    // power Map

    drawPowerMap();
}
