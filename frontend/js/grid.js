// simple spatial grid

function makeGrid(bounds, r, edges) {
	//
	var res = {
		x1: bounds.x - r,
		y1: bounds.y - r,
		x2: bounds.x + bounds.width + r,
		y2: bounds.y + bounds.height + r,
		height: bounds.height + 2*r,
		width: bounds.width + 2*r,
		aspect: (bounds.width + 2*r) / (bounds.height + 2*r)
	}
	
	res.xn = Math.round(res.aspect * Math.sqrt(edges));
	if (res.xn < 1) res.xn = 1;
	if (res.xn > 20) res.xn = 20;
	
	res.yn = Math.round((1.0/res.aspect) * Math.sqrt(edges));
	if (res.yn < 1) res.yn = 1;
	if (res.yn > 20) res.yn = 20;
	
	res.cellWidth = res.width / res.xn;
	res.cellHeight = res.height / res.yn;
	
	res.cells = new Array(res.xn);
	for (var x=0; x<res.xn; x++) {
	   res.cells[x] = new Array(res.yn);
	   
	   for (var y=0; y<res.yn; y++) {
	   		res.cells[x][y] = new Array();
	   }
	   
	}
	
	return res;
}

function drawGrid(g) {

	// outline
	var r = new Path.Rectangle(new Point(g.x1,g.y1), new Point(g.x2,g.y2));
	r.strokeColor = 'red';
	debugGroup.addChild(r);
	
	// rows
	for (var i=0; i<g.yn; i++) {
		var y = (i/(g.yn)) * g.height + g.y1;
		var l = new Path.Line(new Point(g.x1, y), new Point(g.x2, y));
		l.strokeColor = 'red';
		debugGroup.addChild(l);
	}
	
	// cols
	for (var i=0; i<g.xn; i++) {
		var x = (i/(g.xn)) * g.width + g.x1;
		var l = new Path.Line(new Point(x, g.y1), new Point(x, g.y2));
		l.strokeColor = 'red';
		debugGroup.addChild(l);
	}
	
	// cell counts
	for (var x=0; x<g.xn; x++) {
		for (var y=0; y<g.yn; y++) {
			if (g.cells[x][y] && g.cells[x][y].length) {
				var yp = gridCoordToWorldY(g,y);
				var xp = gridCoordToWorldX(g,x);
				
				var c = g.cells[x][y].length;

				var text = new PointText({
					point: new Point(xp + g.cellWidth/2, yp + g.cellHeight/2),
					content: c,
					fillColor: 'black',
					fontFamily: 'Courier New',
					fontSize: 3
				});
		
				debugGroup.addChild(text);
			}
		}
	}
	
}

function drawCell(g,x,y) {
	var x1 = gridCoordToWorldX(g,x);
	var y1 = gridCoordToWorldY(g,y);
	
	var r = new Path.Rectangle(x1,y1,g.cellWidth,g.cellHeight);
	r.strokeColor = null;
	r.fillColor = new Color(1,0,0,0.3);
	debugGroup.addChild(r);
}

function worldToGridCoordX(g, xw) {
	var i= Math.floor((g.xn) * (xw - g.x1) / g.width);
	if (i<0) i=0;
	if (i>g.xn-1) i = g.xn-1;
	return i;
}

function worldToGridCoordY(g, yw) {
	var i= Math.floor((g.yn) * (yw - g.y1) / g.height);
	if (i<0) i=0;
	if (i>g.yn-1) i = g.yn-1;
	return i;
}

// left edge of cell
function gridCoordToWorldX(g, x) {
	return (x/(g.xn)) * g.width + g.x1; 
}

// top edge of cell
function gridCoordToWorldY(g, y) {
	return (y/(g.yn)) * g.height + g.y1; 
}

function addToCell(g,x,y,c) {
	// check curve isn't already in the cell?
	
	g.cells[x][y].push(c);
}

// pass grid and curve
function addToGrid(g, c) {
	// for now, ignore paths!
	if (c.type == 'path') return;
	
	// also ignore anything that isn't linear
	if (!c.isLinear()) return;
	
	// "draw" the line onto the grid using modified DDA
	var xw = c.point1.x;
	var yw = c.point1.y;
	var x = worldToGridCoordX(g, xw);
	var y = worldToGridCoordY(g, yw);
	
	// work out coord of end point!
	var lx = worldToGridCoordX(g, c.point2.x);
	var ly = worldToGridCoordY(g, c.point2.y); 
	
	var v = new Point(c.point2.x - c.point1.x, c.point2.y - c.point1.y);
	v = v.normalize(1);
	
	var stepX = v.x >= 0 ? 1 : -1;
	var stepY = v.y >= 0 ? 1 : -1;
	
	var tDeltaX = g.cellWidth / v.x;
	var tDeltaY = g.cellHeight / v.y;
	
	var tMaxX = 0;
	if (stepX > 0) {
		tMaxX = ((gridCoordToWorldX(g,x) + g.cellWidth) - c.point1.x) / v.x;
	} else {
		tMaxX = ((gridCoordToWorldX(g,x)) - c.point1.x) / v.x;
	}
	
	var tMaxY = 0;
	if (stepY > 0) {
		tMaxY = ((gridCoordToWorldY(g,y) + g.cellHeight) - c.point1.y) / v.y;
	} else {
		tMaxY = ((gridCoordToWorldY(g,y)) - c.point1.y) / v.y;
	}
	
	// update current voxel
	//drawCell(g,x,y);
	
	addToCell(g,x,y,c);
	
	// iterate
	while (true) {
	
		if (tMaxX < tMaxY) {
			tMaxX = tMaxX + tDeltaX;
			x = x + stepX;
		} else {
			tMaxY = tMaxY + tDeltaY;
			y = y + stepY;
		}
		
		// check for exit conditions
		if (x < 0 || x > g.xn-1 || y < 0 || y > g.yn-1) break;
		if ((stepX>0 && x > lx) || (stepX<0 && x < lx) || (stepY>0 && y>ly) || (stepY<0 && y<ly)) break;
		
		//drawCell(g,x,y);
		
		addToCell(g,x,y,c);
		
	}
}


// pass grid and target curve
// quick hack for now!
function getGridNeighbours(g, c) {
	var res = new Array();
	
	// for now, ignore paths!
	if (c.type == 'path') return res;
	
	// also ignore anything that isn't linear
	//if (!c.isLinear()) return res;
	
	
	// get grid coords of c
	var xw = c.point1.x;
	var yw = c.point1.y;
	var x = worldToGridCoordX(g, xw);
	var y = worldToGridCoordY(g, yw);
	
	// gen neighbour limits
	var x1 = x - 1;
	if (x1 < 0) x1 = 0;
	var x2 = x + 1;
	if (x2 > g.xn-1) x2 = g.xn-1;
	
	var y1 = y - 1;
	if (y1 < 0) y1 = 0;
	var y2 = y + 1;
	if (y2 > g.yn-1) y2 = g.yn-1;
	
	// build result list from neighbours
	for (x = x1; x<=x2; x++) {
		for (y=y1; y<=y2; y++) {
			for (var i=0; i<g.cells[x][y].length; i++) {
				var n = g.cells[x][y][i];
				if (n != c) {
					var addIt = true;
					// check not already in result list
					for (var j=0; j<res.length; j++) {
						if (res[j] == n) {
							addIt = false;
							break;
						}
					}
					
					if (addIt) {
						res.push(n);
					}
				}
			}
		}
	}
	
	return res;
}

