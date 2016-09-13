function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

function angleBetweenLines(p1,p2,p3,p4) {
	var v1 = p2.subtract(p1);
	var v2 = p4.subtract(p3);
	return v1.getDirectedAngle(v2);
}

function angleBetweenCurves(c1,c2) {
	var p1, p4;
	if (c1.isLinear()) {
		p1 = c1.point1.clone();
	} else {
		p1 = c1.handle2.clone();
	}
	if (c2.isLinear()) {
		p4 = c2.point2.clone();
	} else {
		p4 = c2.handle1.clone();
	}
	return angleBetweenLines(p1, c1.point2, c2.point1, p4);
}

function offsetLine(c, radius) {
	var oc = c.clone();
	var v = c.point2.subtract(c.point1);
	v = v.rotate(-90);
	v = v.normalize(radius);
	oc.point1 = oc.point1.add(v);
	oc.point2 = oc.point2.add(v);
	return oc;
}

function drawCurveControl(c, clr) {

	if (c.isLinear()) return;

	var p1 = new Path.Circle({
		center: c.point1.clone(), 
		radius: 2.7,
		strokeColor:'orange'
	});
	var p2 = new Path.Circle({
		center: c.point2.clone(), 
		radius: 1.7,
		strokeColor:'red'
	});
	var h1 = new Path.Circle({
		center: c.point1.add(c.handle1), 
		radius: 2.3,
		strokeColor:'green'
		});
	var h2 = new Path.Circle({
		center: c.point2.add(c.handle2), 
		radius: 2,
		strokeColor:clr
	});
	
	var l = new Path({ strokeColor: clr });
	l.moveTo(c.point1.clone());
	l.lineTo(c.point1.add(c.handle1));
	l.lineTo(c.point2.add(c.handle2));
	l.lineTo(c.point2.clone());
	
	debugGroup.addChild(p1);
	debugGroup.addChild(p2);
	debugGroup.addChild(h1);
	debugGroup.addChild(h2);
	debugGroup.addChild(l);
}

function drawControlCurves(p, clr) {
	if (p.type == 'path') {

		for (var i=0; i<p.curves.length; i++) {
			var c = p.curves[i];
		
			if (!c.isLinear()) {
				drawCurveControl(c, clr);
			}
		}
	} else {
		drawCurveControl(p,clr);
	}
}

function drawPathPoints(p, clr) {
	for (var i=0; i<p.curves.length; i++) {
		var c = p.curves[i];
		
		var p1 = new Path.Circle({
			center: c.point1.clone(), 
			radius: 1,
			strokeColor:clr,
			strokeWidth: 0.2
		});
		
		debugGroup.addChild(p1);
	}
}

function drawCurveHandles(c, clr) {
	
	var p1 = new Path.Circle({
		center: c.point1.clone(), 
		radius: 1,
		strokeColor:clr
	});
	var p2 = new Path.Circle({
		center: c.point2.clone(), 
		radius: 1,
		strokeColor:clr
	});
	debugGroup.addChild(p1);
	debugGroup.addChild(p2);
	
	if (c.isLinear()) return;
 
	var h1 = new Path.Circle({
		center: c.point1.add(c.handle1), 
		radius: 1,
		strokeColor:clr
		});
	var h2 = new Path.Circle({
		center: c.point2.add(c.handle2), 
		radius: 1,
		strokeColor:clr
	});
	debugGroup.addChild(h1);
	debugGroup.addChild(h2);

	
	var l = new Path({ strokeColor: clr });
	l.moveTo(c.point1.clone());
	l.lineTo(c.point1.add(c.handle1));
	debugGroup.addChild(l);
	
	l = new Path({ strokeColor: clr });
	l.moveTo(c.point2.clone());
	l.lineTo(c.point2.add(c.handle2));
	debugGroup.addChild(l);
}

function drawPathHandles(p, clr) {
	if (p.type == 'path') {

		for (var i=0; i<p.curves.length; i++) {
			var c = p.curves[i];
		
			if (!c.isLinear()) {
				drawCurveHandles(c, clr);
			}
		}
	} else {
		drawCurveHandles(p,clr);
	}
}


function offsetCurve(c, radius) {
	if (c.isLinear()) {
		return offsetLine(c, radius);
	} else {
		// reference curve(s)
		var rc = new Path();
		rc.moveTo(c.point1);
		rc.cubicCurveTo(c.point1.add(c.handle1), c.point2.add(c.handle2), c.point2);
		
		var oc = new Path();
		
		var tol = 0.5;
		
		// rip up and retry approach to curve offsetting
		var maxError = radius;
		
		var iteration = 0;
		
		
		while (maxError > tol) {
			
			oc.removeSegments();
			
			// make an offset curve for each ref curve
			for (var i=0; i<rc.curves.length; i++) {
				var rc1 = rc.curves[i];
				var oc1 = rc1.clone();
		
				
				var v1 = rc1.getNormalAt(0, true);
				v1 = v1.normalize(radius);
				oc1.point1 = oc1.point1.add(v1);
		
				var v2 = rc1.getNormalAt(1, true);
				v2 = v2.normalize(radius);
				oc1.point2 = oc1.point2.add(v2);
		
				var ccl = rc1.handle1.length + rc1.handle2.length + rc1.handle2.add(rc1.point2).subtract(rc1.handle1.add(rc1.point1)).length;
				var f1 = rc1.handle1.length / ccl;
				var f2 = 1 - rc1.handle2.length / ccl;
		
				var v = rc1.getNormalAt(f1, true);
				v = v.normalize(radius);
				oc1.handle1 = rc1.handle1.add(v).subtract(v1);
		
				v = rc1.getNormalAt(f2, true);
				v = v.normalize(radius);
				oc1.handle2 = rc1.handle2.add(v).subtract(v2);
				
				// check to see if handles are getting too close to their end points
				if (oc1.handle1.length < 0.5) {
					//oc1.handle1 = new Point(0,0);
				}
				if (oc1.handle2.length < 0.5) {
					//oc1.handle2 = new Point(0,0);
				}
				
				// compare curvature at extremes
				if (Math.abs(rc1.getCurvatureAt(0,true) - oc1.getCurvatureAt(0,true)) > 0.5) {
					//oc1.handle1 = new Point(0,0);
					//var circ = new Path.Circle({ center: oc1.point1, radius:1, strokeColor:'blue'});
				}
				
				if (Math.abs(rc1.getCurvatureAt(1,true) - oc1.getCurvatureAt(1,true)) > 0.5) {
					//oc1.handle2 = new Point(0,0);
					//var circ = new Path.Circle({ center: oc1.point2, radius:1, strokeColor:'blue'});
				}
				
				// compare angle of handles to check if offset curves have become twisted back on themselves
				if (Math.abs(rc1.handle1.getDirectedAngle(oc1.handle1)) > 20 || Math.abs(rc1.handle2.getDirectedAngle(oc1.handle2)) > 20) {
					//console.log('h1',rc1.handle1.getDirectedAngle(oc1.handle1));
					//console.log('h2',rc1.handle2.getDirectedAngle(oc1.handle2));
					
					// TODO: improve this!
					
					// zero the handles
					//oc1.handle1 = new Point(0,0);
					//oc1.handle2 = new Point(0,0);
				}
				
				
				if (oc.curves.length == 0) 
					oc.moveTo(oc1.point1);
					
				oc.cubicCurveTo(oc1.point1.add(oc1.handle1), oc1.point2.add(oc1.handle2), oc1.point2);
				
			
			}
			
			// look for self intersections
			// ?????
			
			
			// evaluate maxError, record position of maxError
			maxError = 0;
			var maxErrorPos = 0;
			var steps = 20;
			for (var i=0; i<steps; i++) {
				var t = (1 + i)/(1 + steps);
				
				var p = rc.getLocationAt(t, true);
				//var circ = new Path.Circle({ center: p.point.clone(), radius:3, strokeColor:'blue'});
		
				var d = oc.getLocationAt(t, true);
				//circ = new Path.Circle({ center: d.point.clone(), radius:3, strokeColor:'blue'});
				
				var dist = p.point.subtract(d.point);
				
				var error = Math.abs(dist.length - radius);
				if (error > maxError) {
					maxError = error;
					maxErrorPos = t;
				}
			}
			
			
			// if maxError > tol, divide rc at position of maxError
			if (maxError > tol) {
				
				var dc = rc.getLocationAt(maxErrorPos, true);
				dc.curve.divide(dc.paramter);
			}
			
			iteration++;
			if (iteration > 4)
				break;
			
		}
		
		//console.log('done', iteration, maxError, maxErrorPos);
		
		//var circ = new Path.Circle({ center: c.getPointAt(f1, true), radius:3, strokeColor:'blue'});
		//circ = new Path.Circle({ center: c.getPointAt(f2, true), radius:3, strokeColor:'blue'});
		
		//drawControlCurves(oc, 'black');
		//drawControlCurves(rc, 'grey');
		
		rc.remove();
		
		return oc;
	}
}

function checkLineIntersection(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
	// if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
	var denominator, a, b, numerator1, numerator2, result = {
		x: null,
		y: null,
		onLine1: false,
		onLine2: false
	};
	denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
	if (denominator == 0) {
		return result;
	}
	a = line1StartY - line2StartY;
	b = line1StartX - line2StartX;
	numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
	numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
	a = numerator1 / denominator;
	b = numerator2 / denominator;

	// if we cast these lines infinitely in both directions, they intersect here:
	result.x = line1StartX + (a * (line1EndX - line1StartX));
	result.y = line1StartY + (a * (line1EndY - line1StartY));
/*
		// it is worth noting that this should be the same as:
		x = line2StartX + (b * (line2EndX - line2StartX));
		y = line2StartX + (b * (line2EndY - line2StartY));
		*/
	// if line1 is a segment and line2 is infinite, they intersect if:
	if (a > 0 && a < 1) {
		result.onLine1 = true;
	}
	// if line2 is a segment and line1 is infinite, they intersect if:
	if (b > 0 && b < 1) {
		result.onLine2 = true;
	}
	// if line1 and line2 are segments, they intersect if both of the above are true
	return result;
};

function createJoint(c1, c2, pc, radius) {
	// returns a curve object linking c1 and c2, or null if no joint required
	// c2 may be a path!
	// pc should be the point at the center of the arc
	
	var p1;
	if (c1.type =='path') {
		p1 = c1.lastSegment.point;
	} else {
		p1 = c1.point2;
	}
	
	var p2;
	if (c2.type == 'path') {
		p2 = c2.firstSegment.point;
	} else {
		p2 = c2.point1;
	}
	
	//console.log(c1.index, c1, c2);
	
	if (p1 == p2) {
		//console.log('coincident endpoints', c1.index);
		return null;
	} else {
		
		// get distance between points
		var v = p2.subtract(p1);
		if (v.length < 1) {
			
			// align endpoints, move start of c2 to align with end of c1
			p2 = p2.subtract(v);
			
			// also adjust associated handle by the delta, in case it's really nearby
			var h1;
			if (c2.type == 'path') {
				h1 = c2.firstSegment.handle1;
			} else {
				h1 = c2.handle1;
			}
			if (h1 && h1.length > 0) {
				h1 = h1.subtract(v);
			}
			
			
			
			//console.log('merging points',c1.index);
			
			//var circ = new Path.Circle({ center: c2.point1, radius:4, strokeColor:'blue'});
			//debugGroup.addChild(circ);
		
			return null;
		} else {				
			//
			
			//drawCurveControl(c1, 'black');
			
		
			// get angle between lines
			var ang = angleBetweenLines(pc, p1, pc, p2);
			var isInside = false;
							
			if (ang < 0) {
				ang = -ang;
			}
	
			var h1 = p1.subtract(pc);
			h1 = h1.rotate(ang * 0.3);
			h1 = h1.subtract(p1.subtract(pc));
	
			var h2 = p2.subtract(pc);
			h2 = h2.rotate(-ang * 0.3);
			h2 = h2.subtract(p2.subtract(pc));
			
			//console.log(c1.index, h1.getDirectedAngle(h2));
			
			// check to see if joint isInside (e.g. loops back on itself)
			if (h1.getDirectedAngle(h2) > 0 || true) {
				/*
				console.log('ang',h1.getDirectedAngle(h2));
			
				var path = new Path({strokeColor:'red', strokeWidth: 0.2});
				path.moveTo(p1);
				path.cubicCurveTo(p1.add(h1), p2.add(h2), p2);
				*/
				
				
				// flatten handles - seems sensible
				h1 = new Point(0,0);
				h2 = new Point(0,0);
				
				// final condition, do the two incoming curves intersect?!
				var path1 = new Path();
				path1.moveTo(c1.point1);
				appendCurveToPath(c1, path1);
				
				// create path for c2 (if necessary)
				if (c2.type == 'path') {
					var ci = path1.getIntersections(c2);
				} else {
					var path2 = new Path();
					path2.strokeColor = 'red';
					path2.moveTo(c2.point1);
					appendCurveToPath(c2,path2);
					
					var ci = path1.getIntersections(path2);
					
					path2.remove();
				}
				
				path1.remove();
				
				if (ci.length > 0) {
					isInside = true;
					
					// find nearest intersection
					var ni = ci[0];
					var nearest = c1.point2.getDistance(ni.point);
					for (var i=0; i<ci.length; i++) {
						var dist = c1.point2.getDistance(ci[i].point);
						if (dist < nearest) {
							nearest = dist;
							ni = ci[i];
						}
					}
					
					// trim curves to intersection
					
					// remove end of c1
					var sc = c1.split(ni.parameter, true);
					if (sc) {
						
						// zero outbound handle
						c1.segment2.handle2 = new Point(0,0);
						
						//drawCurveControl(c1,'yellow');
						
						//var circ = new Path.Circle({ center: ni.point, radius:4, strokeColor:'red'});
						//debugGroup.addChild(circ);
						
						sc.remove();
					}
					
					// remove beginning of c2
					
					try {
						
						if (c2.type =='path') {
							sc = c2.split(ni.intersection.index, ni.intersection.parameter);
						} else {
							
							var path2 = new Path();
							path2.moveTo(c2.point1);
							appendCurveToPath(c2,path2);
							
							//console.log(path2);
							
							sc = path2.split(ni.intersection.offset);
							
							//console.log(sc);
						
							if (path2)
								path2.remove();
						}
						
					} catch(e) {
						console.log('error',c2, ni);
						var circ = new Path.Circle({ center: ni.point, radius:3, strokeColor:'red'});
					}
					
					//console.log(sc);
					
					if (sc) {
						
						// replace c2 with sc
						
						
						//c2.remove();
						
						//console.log('before',c2);
						
						if (c2.type == 'path') {
							c2.removeSegments();
						
							//console.log('after',c2);
						
							if (sc && sc.curves.length > 0) {
						
								c2.moveTo(sc.firstCurve.point1);
								for (var i=0; i<sc.curves.length; i++)
									appendCurveToPath(sc.curves[i], c2);
						
							}
						
							sc.remove();
						} else {
							c2 = sc;
						}
						
						//drawControlCurves(c2,'yellow');
						
						/*
						c2.point1 = sc.curves[0].point1.clone();
						c2.handle1 = sc.curves[0].handle1.clone();
						c2.handle2 = sc.curves[0].handle2.clone();
						c2.point2 = sc.curves[0].point2.clone();
						*/
						
						
						//sc.remove();
						
					}
				}
				
				
			}
			
			
			if (isInside) {
				return null;
			} else {
			
				var jc = new Curve(p1,h1,h2,p2);
				jc.isInside = isInside;
				return jc;
			}	
		}
	}
}

function appendCurveToPath(c, p) {
	if (c.isLinear()) {
		p.lineTo(c.point2);
	} else {
		p.cubicCurveTo(c.point1.add(c.handle1), c.point2.add(c.handle2), c.point2);
	}
}

function calcOffsetPath(p, radius, progressCallback, stopAfter) {
	var op = new Path();
	op.strokeColor = new Color(1,0,0,0.3);
	
	var cc = p.curves.length;
	if (stopAfter && cc > stopAfter)
		cc = stopAfter;
		
		
	
	// create offset curves and joints
	if (progressCallback) progressCallback('Generating offset curves');
	
	for (var i=0; i<cc; i++) {
		var c = p.curves[i];
		
		// NB: offsetCurve may return a path object or a single curve
		var oc = offsetCurve(c, radius);
		
		if (op.curves.length > 0) {
			var lc = op.curves[op.curves.length-1];
		
			// generate joint
			if (oc.type == 'path') {
				
				//if (i == (stopAfter-1)) drawControlCurves(oc, 'black');
				
				//var jc = createJoint(lc, oc.curves[0], c.point1, radius);
				var jc = createJoint(lc, oc, c.point1, radius);
				
				//drawControlCurves(oc, 'black');
				
			} else {
				
				//if (i == (stopAfter-1)) drawCurveControl(oc, 'black');
				
				var jc = createJoint(lc, oc, c.point1, radius);
				
				//drawCurveControl(oc, 'black');
				//if (i == (stopAfter-1)) drawCurveControl(oc, 'black');
			
			}
			
			
			
			if (jc) {
				op.cubicCurveTo(jc.handle1.add(jc.point1), jc.handle2.add(jc.point2), jc.point2);
				
				if (jc.isInside) op.curves[op.curves.length-1].isInside = jc.isInside;
			}
			
		} else {
			if (oc.type=='path') {
				op.moveTo(oc.curves[0].point1);
			} else {
				op.moveTo(oc.point1);
			}
		}
		
		// add curve(s) to op
		if (oc.type == 'path') {
			for (var j=0; j<oc.curves.length; j++) {
				op.cubicCurveTo(
					oc.curves[j].handle1.add(oc.curves[j].point1), 
					oc.curves[j].handle2.add(oc.curves[j].point2), 
					oc.curves[j].point2);
			}
		} else {
			op.cubicCurveTo(oc.handle1.add(oc.point1), oc.handle2.add(oc.point2), oc.point2);
		}
		
		// discard oc
		if (oc.type == 'path')
			oc.remove();
			
		if (progressCallback) progressCallback(100*i/cc);
		
	}
	
	// join end to beginning
	if (p.closed) {
	
		/*
		//var oc = op.curves[0];
		var lc = op.curves[op.curves.length-1];
		
		// generate joint
		var jc = createJoint(lc, op, p.curves[0].point1, radius);
		if (jc) {
			op.cubicCurveTo(jc.handle1.add(jc.point1), jc.handle2.add(jc.point2), jc.point2);
			
			if (jc.isInside) op.curves[op.curves.length-1].isInside = jc.isInside;
		}
		*/
		
		// lazy solution
		op.closePath();
	}
	
	// find (and divide at) all self-intersections
	if (progressCallback) progressCallback('Evaluating intersections');
	
	var intersections = [];
	
	var i=0;
	var aargh = 0;
	var restart = false;
	while (i<op.curves.length) {
		if (progressCallback) progressCallback(100*i/op.curves.length);
		
		var c1 = op.curves[i];
	
		var j=i+1;
		while (j<op.curves.length) {
			var c2 = op.curves[j];
			
			// do c1 and c2 intersect?
			if (c1.bounds.intersects(c2.bounds)) {
			
				var ci = c1.getIntersections(c2);
			
				// check intersections, ignore end-points
				for (var k=0; k<ci.length; k++) {
					intersec = ci[k];
					if (intersec.point.getDistance(c1.point1,true)>0.001 && 
						intersec.point.getDistance(c1.point2,true)>0.001 && 
						intersec.point.getDistance(c2.point1,true)>0.001 && 
						intersec.point.getDistance(c2.point2,true)>0.001) {
					
						intersections.push(intersec);
					
						// divide c1 and c2 at intersection
						var nc = c1.divide(intersec.parameter, true);
						if (c1.isInside) nc.isInside = c1.isInside;
						
						nc = c2.divide(intersec.intersection.parameter, true);
						if (c2.isInside) nc.isInside = c2.isInside;
					
						//console.log('restart',i,j, intersec);
					
						aargh += 1;
						if (aargh > 200) {
							console.log('aaaaargh... too many intersections');
							return null;
						
						}
					
						// restart algorithm
						restart = true;
						break;
					}
				
				}
			
			}
			
			if (restart) {
				break;
			} else {
				j++;	
			}
		}
		
		if (restart) {
			i = 0;
			restart = false;
		} else {
			i++;
		}
	}
	
	
	// debug intersections
	if (false)
	for (var i=0; i<intersections.length; i++) {
		var ic = new Path.Circle({
			center: intersections[i].point,
			radius: 3,
			strokeColor: new Color(1,0,0,0.6)
		});
	}
	
	// show curve numbers?
	if (false)
	for (var i=0; i<op.curves.length; i++) {
		var c = op.curves[i];
		
		var text = new PointText({
			point: c.getLocationAt(0.5, true).point,
			content: i,
			fillColor: 'black',
			fontFamily: 'Courier New',
			fontSize: 2
		});
	}
	
	
	
	// if intersections, find a convex point to start
	var firstCurve = 0;
	if (intersections.length > 0) {
		for (var i=0; i<op.curves.length; i++) {
			var c = op.curves[i];
			
			// decide if segment1 of c is convex
			if (c.segment1.handleIn && c.segment1.handleOut && c.segment1.handleIn.length > 0 && c.segment1.handleOut.length > 0) {
				var cr = c.segment1.handleIn.cross(c.segment1.handleOut);
			
				//console.log('cross',i, cr);
			
				if (cr <= 0) {
					firstCurve = i;
					break;
				}
			}
		
		}
	}
	
	if (progressCallback) progressCallback('Generating final offset curve');
	
	//console.log(firstCurve, op.curves.length);
	
	// walk the outline, discarding segments within self-intersecting regions
	var circ = new Path.Circle({ center: op.curves[firstCurve].point1, radius:2, strokeColor:'blue'});
	
	var fop = new CompoundPath();
	fop.strokeColor = new Color(0,0,1,0.5);
	if (op.curves.length> 0) {
		fop.moveTo(op.curves[firstCurve].point1);
	
		var inOut = true;  //  true if out, false if in
		for (var i=0; i<op.curves.length; i++) {
			if (progressCallback) progressCallback(100*i/op.curves.length);
			
			var index = firstCurve + i;
			if (index > op.curves.length-1) {
				index -= op.curves.length;
			}
			var c = op.curves[index];
		
			if (intersections.length > 0) {
				
				if (inOut) {
					appendCurveToPath(c, fop);
				} else {
					
					fop.moveTo(c.point2);
				}
			
				// does this segment end on an intersection?
				var endsOnIntersection = false;
				
				for (var j=0; j<intersections.length; j++) {
					var intersec = intersections[j];
				
					
					
					if (intersec.point.getDistance(c.point2, true) < 0.01) {
						//console.log(i,j, intersec.point.getDistance(c.point2, true));
						
						endsOnIntersection = true;
						break;
					}					
				}
				
				if (endsOnIntersection) {
					inOut = !inOut;
				}
		
			} else {
				// append to fop
				appendCurveToPath(c, fop);
			}
		
		}
	}
	
	//drawPathPoints(op, 'orange');
	
	// return the final result
	//op.remove();
	debugGroup.addChild(op);

	//fop.remove();

	return fop;
}




function joinCloseSegments(p, tol) {
	// merge segments closer than tol
	
	var mergeCount = 0;
	
	var i=0;
	while (i<p.segments.length) {
	
		var j = i+1;
		if (j>p.segments.length-1) {
			j=0;
		}
		
		var s1 = p.segments[i];
		var s2 = p.segments[j];
		
		// merge?
		if (s1.point.subtract(s2.point).length < tol) {
		
			// store s1 handle1
			var h1 = s1.handle1;
			
			// average locations
			var np = s1.point.add(s2.point).divide(2);
			s1.remove();
			s2.point = np;
			
			s2.handle1 = h1;
			
			i--;
			
			mergeCount++;
		}
		
		i++;
	}
	
	return mergeCount;
}

function removeCloseHandles(p, tol) {
	// zero handles closer than tol
	
	var mergeCount = 0;
	
	for (var i=0; i<p.curves.length; i++) {
	
		var c = p.curves[i];
		
		if (!c.isLinear()) {
			// merge?
			if (c.handle1.length < tol * c.length) {
				c.handle1 = new Point(0,0);
				mergeCount++;
			}
			
			if (c.handle2.length < tol * c.length) {
				c.handle2 = new Point(0,0);
				mergeCount++;
			}
		}
	}
	
	return mergeCount;
}