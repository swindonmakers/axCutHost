function doThisToPaths(item, cb) {
	if (item.children && item.children.length > 0) {
		//console.log(item);

		for (var i=0; i<item.children.length; i++) {
			doThisToPaths(item.children[i], cb);
		}
	} else if (item._class == 'Path') {
		cb(item);
	}
}

function doThisToObjects(item, objectType, cb) {
	if (item.children && item.children.length > 0) {
		//console.log(item);

		for (var i=0; i<item.children.length; i++) {
			doThisToObjects(item.children[i], objectType, cb);
		}
	} else if (objectType == '' || item._class == objectType) {
		cb(item);
	}
}

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

function debugCrossHair(p,r,clr,txt) {
	if (!clr) clr = 'red';
	if (!r) r = 1;
	var circ = new Path.Circle({ center: p, radius:r, strokeColor:clr});
	debugGroup.addChild(circ);

	var rot = Math.random()*90;

	var path = new Path({strokeColor:clr});
	path.moveTo(p.add(new Point(0,-r/2)));
	path.lineTo(p.add(new Point(0,r/2)));
	path.rotate(rot);
	debugGroup.addChild(path);

	var path = new Path({strokeColor:clr});
	path.moveTo(p.add(new Point(-r/2,0)));
	path.lineTo(p.add(new Point(r/2,0)));
	path.rotate(rot);
	debugGroup.addChild(path);

	if (txt) {
		var offsetPoint = new Point(Math.random()*1, Math.random()*2-1);

		var text = new PointText({
			point: p.add(offsetPoint),
			content: txt,
			fillColor: clr,
			fontFamily: 'Courier New',
			fontSize: 1
		});

		debugGroup.addChild(text);

		var marker = new Path();
		marker.strokeColor = clr;
		marker.moveTo(p);
		marker.lineTo(p.add(offsetPoint));
		debugGroup.addChild(marker);
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

	if (c && c.point1 && c.point2) {

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

		l = new Path({ strokeColor: new Color(Math.random(),Math.random(),Math.random()) });
		l.moveTo(c.point2.clone());
		l.lineTo(c.point2.add(c.handle2));
		debugGroup.addChild(l);

	}
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

function isCurveConvex(c) {
	// all cross products should be positive
	var m = c.point2.add(c.handle2).subtract(c.point1.add(c.handle1));
	var cr1 = c.handle1.getDirectedAngle(m);
	var cr2 = m.getDirectedAngle(c.handle2.rotate(180));

	/*
	console.log('convexity:',cr1,cr2);

	if (cr1 < 0 || cr2 < 0) {
		var l = new Path({ strokeColor: 'red' });
		l.moveTo(c.point1.add(c.handle1));
		l.lineTo(c.point1.add(c.handle1).add(m));
		debugGroup.addChild(l);

		drawPathHandles(c,'black');
	}
	*/

	return cr1 > 0 && cr2 > 0;
}


function offsetCurve(c, radius) {
	if (c.isLinear()) {
		return offsetLine(c, radius);
	} else {

		// work out tolerance to sampling points near curve parameter=0
		var tbTol = 0.0001;
		var maxT, minT;
		var endNormal, endNormal2;

		do {
			tbTol += 0.0001;

			endNormal = c.getNormalAt(tbTol,true);
			endNormal2 = c.getNormalAt(0.01,true);

		} while(endNormal.subtract(endNormal2).length > c.length * 0.01);
		minT = tbTol;


		// work out tolerance to sampling points near curve parameter=1
		var tTol = 0.0001;

		do {
			tTol += 0.0001;
			maxT = 1/(1 + tTol);

			endNormal = c.getNormalAt(maxT,true);
			endNormal2 = c.getNormalAt(0.99,true);

		} while(endNormal.subtract(endNormal2).length > c.length * 0.01);




		var degenerate = false;
		var regionStart = maxT, regionEnd = 0;
		var regions = [];


		if (!isCurveConvex(c)) {
			// locate start and end of degenerate region, by finding intersections in normal curves
			console.log('looking for degenerate regions');
			var steps = Math.round(20 * c.length / radius);
			steps = 200;
			var ln, lp;



			for (var j=0; j<steps; j++) {
				var t = j/(steps-1  + tTol);

				var n, p;
				p = c.getLocationAt(t,true);
				if (p && p.normal) {
					n = p.normal.normalize(radius);
					p = p.point;
				}

				//console.log(n);

				/*
				var marker = new Path();
				marker.strokeColor = new Color(0,0,0,t);
				marker.moveTo(p);
				marker.lineTo(p.add(n));
				debugGroup.addChild(marker);
				*/

				if (ln && n) {
					// look for intersection
					var intersec = checkLineIntersection(
						lp.x, lp.y,
						lp.add(ln).x, lp.add(ln).y,
						p.x, p.y,
						p.add(n).x, p.add(n).y
					);

					if (intersec.onLine1 && intersec.onLine2) {
						if (t < regionStart) {
							regionStart = t;
						}
						if (t > regionEnd) {
							regionEnd = t;
							if (regionEnd > maxT) regionEnd = maxT;
						}


						//var circ = new Path.Circle({ center: new Point(intersec.x, intersec.y), radius:0.2, strokeColor:'red'});
						//debugGroup.addChild(circ);
					} else if (regionStart < maxT) {
						regions.push({
							start: regionStart,
							end: regionEnd
						});

						//var circ = new Path.Circle({ center: c.getPointAt(regionStart,true), radius:0.2, strokeColor:'blue'});
						//debugGroup.addChild(circ);
						//var circ = new Path.Circle({ center: c.getPointAt(regionEnd,true), radius:0.2, strokeColor:'blue'});
						//debugGroup.addChild(circ);

						regionStart = maxT;
						regionEnd = 0;

					}
				}

				lp = p;
				ln = n;
			}
		} else {
			console.log('convex');
		}


		// build reference curve(s)
		var rc = new CompoundPath();

		if (regionStart <= regionEnd || regions.length > 0) {

			// push last region onto stack
			if (regionStart <= regionEnd) {
				regions.push({
					start: regionStart,
					end: regionEnd
				});
			}

			//var circ = new Path.Circle({ center: c.getPointAt(regionStart,true), radius:0.2, strokeColor:'green'});
			//debugGroup.addChild(circ);
			//var circ = new Path.Circle({ center: c.getPointAt(regionEnd,true), radius:0.2, strokeColor:'green'});
			//debugGroup.addChild(circ);

			degenerate = true;

			// debug
			if (false) {
				for (var i=0; i < regions.length; i++) {
					var circ = new Path.Circle({ center: c.getLocationAt(regions[i].start,true).point, radius:0.2, strokeColor:'red'});
					debugGroup.addChild(circ);

					var circ = new Path.Circle({ center: c.getLocationAt(regions[i].end,true).point, radius:0.2, strokeColor:'red'});
					debugGroup.addChild(circ);
				}
			}


			console.log('degenerate regions: ',regions.length);

			// complex curve, leave out degenerate region(s)

			var c2, c3;

			// first portion of curve
			if (regions[0].start > 0) {
				rc.moveTo(c.point1);

				c2 = c.clone();
				c3 = c2.divide(regions[0].start,true);

				appendCurveToPath(c2, rc);
				rc.children[rc.children.length-1].degenerateRegion = 0;

			}

			// middle/end portions of curve
			for (var i=0; i < regions.length; i++) {
				var region = regions[i];

				if (region.end < maxT) {
					c2 = c.clone();
					c3 = c2.divide(region.end,true);

					if (i < regions.length-1) {
						c2 = c3.divide(regions[i+1].start,true);
					}

					rc.moveTo(c3.point1);

					appendCurveToPath(c3,rc);

					rc.children[rc.children.length-1].degenerateRegion = i;
				}
			}


		} else {
			// simple curve

			rc.moveTo(c.point1);
			rc.cubicCurveTo(c.point1.add(c.handle1), c.point2.add(c.handle2), c.point2);
		}

		var occ = new Path();


		if (regions.length > 0 && regions[0].start == 0) {
			var p1, p2;
			p1 = c.getLocationAt(0,true);
			p2 = c.getLocationAt(regions[0].end, true);
			if (p1 && p1.normal && p2 && p2.normal) {

				p1 = p1.point.add(p1.normal.normalize(radius));
				p2 = p2.point.add(p2.normal.normalize(radius));

				occ.moveTo(p1);
				occ.lineTo(p2);

				/*
				var circ = new Path.Circle({ center: p1, radius:0.2, strokeColor:'blue'});
				debugGroup.addChild(circ);

				var circ = new Path.Circle({ center: p2, radius:0.2, strokeColor:'blue'});
				debugGroup.addChild(circ);
				*/

				//console.log('degenerate start');
			}
		}


		//console.log('sub curves',rc.children.length);

		for (var x=0; x<rc.children.length; x++) {

			var rcc = rc.children[x];


			var oc = new Path();

			var tol = radius/100;

			// rip up and retry approach to curve offsetting
			var maxError = radius;

			var iteration = 0;


			while (maxError > tol) {

				oc.removeSegments();

				// make an offset curve for each ref curve
				for (var i=0; i<rcc.curves.length; i++) {
					var rc1 = rcc.curves[i];
					var oc1 = rc1.clone();


					var v1 = rc1.getNormalAt(tbTol, true);
					v1 = v1.normalize(radius);
					oc1.point1 = oc1.point1.add(v1);


					var v2 = rc1.getNormalAt(maxT, true);
					v2 = v2.normalize(radius);
					oc1.point2 = oc1.point2.add(v2);

					var ccl = rc1.handle1.length + rc1.handle2.length + rc1.handle2.add(rc1.point2).subtract(rc1.handle1.add(rc1.point1)).length;
					var f1 = rc1.handle1.length / ccl;
					var f2 = 1 - rc1.handle2.length / ccl;

					if (f1 < tbTol) f1 = tbTol;
					if (f1 > maxT) f1 = maxT;

					if (f2 < tbTol) f2 = tbTol;
					if (f2 > maxT) f2 = maxT;

					if (rc1.handle1.length > 0) {
						var v = rc1.getNormalAt(f1, true);
						v = v.normalize(radius);
						oc1.handle1 = rc1.handle1.add(v).subtract(v1);
					} else {
						oc1.handle1 = new Point(0,0);
					}


					if (rc1.handle2.length > 0) {
						v = rc1.getNormalAt(f2, true);
						v = v.normalize(radius);
						oc1.handle2 = rc1.handle2.add(v).subtract(v2);
					} else {
						oc1.handle2 = new Point(0,0);
					}

					if (oc.curves.length == 0)
						oc.moveTo(oc1.point1);

					oc.cubicCurveTo(oc1.point1.add(oc1.handle1), oc1.point2.add(oc1.handle2), oc1.point2);
				}

				// evaluate maxError, record position of maxError
				maxError = 0;
				var maxErrorPos = 0;
				var steps = 20;

				steps = Math.round(rcc.length / tol);
				if (steps < 60) {
					steps = 60;
				} else if (steps > 200) {
					steps = 200;
				}
				//console.log(steps);

				for (var i=0; i<steps; i++) {
					var t = i / (steps-1 + tTol + tbTol);
					var p,d;

					if (i == 0) {
						p = rcc.firstSegment;
						d = oc.firstSegment.point;
					} else if (i == steps-1) {
						p = rcc.lastSegment;
						d = oc.lastSegment.point;
					} else {
						p = rcc.getLocationAt(t * rcc.length, false);

						d = oc.getNearestPoint(p.point);
					}
					var dist = p.point.subtract(d);

					var error = radius - dist.length;
					if (error > maxError) {
						maxError = error;
						maxErrorPos = t;
					}
				}


				// if maxError > tol, divide rc at position of maxError
				if (maxError > tol) {
					if (maxErrorPos > 0 && maxErrorPos < 1) {
						var dc = rcc.getLocationAt(maxErrorPos * rcc.length, false);

						/*
						var marker = new Path();
						marker.strokeColor = new Color(1,0,0,1);
						marker.moveTo(dc.point);
						marker.lineTo(oc.getNearestPoint(dc.point));
						debugGroup.addChild(marker);
						*/

						// avoid sub-divisions too close to curve endpoints
						if (dc.offset > tol && dc.offset < rcc.length-tol) {
							dc.curve.divide(dc.parameter, true);
						} else {
							break;
						}
					} else {
						var dc = rcc.getLocationAt(maxErrorPos * rcc.length, false);

						/*
						var marker = new Path();
						marker.strokeColor = new Color(1,0,0,1);
						marker.moveTo(dc.point);
						marker.lineTo(oc.getNearestPoint(dc.point));
						debugGroup.addChild(marker);
						*/

						console.log('maxError out of range', maxErrorPos);

						break;
					}
				}

				iteration++;
				if (iteration > 10) {
					console.log('max sub-division reached', maxError, tol);
					//debugCrossHair(rcc.getPointAt(maxErrorPos * rcc.length, false), 1, 'red');
					break;
				}

			}


			var region;
			if (degenerate)
				region = regions[rcc.degenerateRegion];
			if (x > 0 && degenerate && region.start > 0 && region.end < maxT) {
				//console.log('curve',x,' region',rcc.degenerateRegion);
				var p1, p2;

				p1 = c.getLocationAt(region.start,true);
				p2 = c.getLocationAt(region.end, true);
				if (p1 && p1.normal && p2 && p2.normal) {

					p1 = p1.point.add(p1.normal.normalize(radius));
					p2 = p2.point.add(p2.normal.normalize(radius));

					occ.lineTo(p1);
					occ.lineTo(p2);

					/*
					var circ = new Path.Circle({ center: p1, radius:0.2, strokeColor:'green'});
					debugGroup.addChild(circ);

					var circ = new Path.Circle({ center: p2, radius:0.2, strokeColor:'green'});
					debugGroup.addChild(circ);
					*/
					//console.log('degenerate middle');
				}
			}

			// append oc to output
			//drawPathHandles(rcc, 'red');
			//drawPathHandles(oc, 'blue');

			appendPathToPath(oc, occ);

			oc.remove();
		}

		if (regions.length > 0 && regions[regions.length-1].end == maxT  && degenerate) {
			var p1, p2;
			p1 = c.getLocationAt(regions[regions.length-1].start,true);
			p2 = c.getLocationAt(maxT, true);
			if (p1 && p1.normal && p2 && p2.normal) {

				//console.log(p1,p2);

				p1 = p1.point.add(p1.normal.normalize(radius));
				p2 = p2.point.add(p2.normal.normalize(radius));

				occ.moveTo(p1);
				occ.lineTo(p2);

				/*
				var circ = new Path.Circle({ center: p1, radius:0.2, strokeColor:'red'});
				debugGroup.addChild(circ);

				var circ = new Path.Circle({ center: p2, radius:0.2, strokeColor:'red'});
				debugGroup.addChild(circ);
				*/
				//console.log('degenerate end');
			}
		}


		rc.remove();


		if (degenerate)
			occ.degenerate = true;
		return occ;
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


function appendCurveToPath(c, p) {
	if (c.isLinear()) {
		p.lineTo(c.point2);
	} else {
		p.cubicCurveTo(c.point1.add(c.handle1), c.point2.add(c.handle2), c.point2);
	}
}

function appendPathToPath(p1,p2) {
	if (p1.type =='path') {
		if (p1.curves.length > 0) {
			if (p2 && p2.curves.length == 0) {
				p2.moveTo(p1.firstSegment.point);
			}
			for (var i=0; i<p1.curves.length; i++)
				appendCurveToPath(p1.curves[i], p2);

		}
	} else {
		if (p2 && p2.curves.length == 0) {
			//if (p2.type = 'compound-path')
			//	p2.addChild(new Path());

			p2.moveTo(p1.point1);
		}
		appendCurveToPath(p1,p2);
	}
}

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
		if (c2.segments.length > 0) {
			p2 = c2.firstSegment.point;
		} else {
			return null;
		}
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
		if (v.length < radius/100) {


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
		}
		/*else if (
			Math.abs(p1.subtract(pc).length - radius) > radius/100
			||
			Math.abs(p2.subtract(pc).length - radius) > radius/100
		) {
			// degenerate ??!?

			return null;
		} */
		else {
			//

			//drawCurveControl(c1, 'black');


			// get angle between lines
			var ang = angleBetweenLines(pc, p1, pc, p2);
			var isInside = false;

			//console.log(ang);

			if (ang <= 0 || ang >= 180) {
				//ang = -ang;
				return null;
			}

			//console.log(ang);

			var h1 = p1.subtract(pc);
			h1 = h1.rotate(ang * 0.3);
			h1 = h1.subtract(p1.subtract(pc));

			var h2 = p2.subtract(pc);
			h2 = h2.rotate(-ang * 0.3);
			h2 = h2.subtract(p2.subtract(pc));

			var mh =  p1.subtract(pc);
			mh = mh.rotate(ang/2);
			mh = mh.add(pc);


			var jc = new Path.Arc(p1,mh,p2);
			return jc;

		}
	}
}


function removeOutliers(p1,p2,radius,tol) {
	var farthestPoint, farthestPointDist, farthestPointSrc;
	var removed = 0;

	if (p1.curves.length == 0 || p2.curves.length == 0)
		return {
			dist: null,
			point: null,
			src: null
		};

	for (var j=0; j<p1.segments.length; j++) {

		var np = p2.getNearestLocation(p1.segments[j].point);

		if (!np)
			continue;

		var distToP = np.point.subtract(p1.segments[j].point).length;


		if (distToP > radius + tol) {
			p1.removeSegments(j,j+1);
			removed += 1;

			j--;
		}
	}

	return removed;
}


function getFarthestPointBetweenPaths(p1,p2,radius,tol) {
	var farthestPoint, farthestPointDist, farthestPointSrc;

	farthestPointDist = -1;

	if (p1.curves.length == 0 || p2.curves.length == 0)
		return {
			dist: null,
			point: null,
			src: null
		};

	// check p1 segments against p2
	// this is sloooow.... how about if we only check the 5 points closest to each end?
	for (var j=0; j<p1.segments.length; j++) {
		if (j<5 || j > p1.segments.length-5 || true) {

			var np = p2.getNearestLocation(p1.segments[j].point);

			if (!np)
				continue;

			var distToP = np.point.subtract(p1.segments[j].point).length;


			if (distToP > farthestPointDist) {
				farthestPointDist = distToP;
				farthestPoint = np.point;
				farthestPointSrc = p1.segments[j].point;
			}

			if (distToP > radius + tol) {
				break;
			}

		}

	}

	// debug
	if (false) {
		var sc = new Color(Math.random(),Math.random(),Math.random(), 1);

		var offsetPoint = new Point(Math.random()*2, Math.random()*2);

		var text = new PointText({
			point: farthestPoint.add(offsetPoint),
			content: farthestPointDist.toPrecision(2),
			fillColor: sc,
			fontFamily: 'Courier New',
			fontSize: 2
		});

		debugGroup.addChild(text);

		var marker = new Path();
		marker.strokeColor = sc;
		marker.moveTo(farthestPoint);
		marker.lineTo(farthestPointSrc);
		debugGroup.addChild(marker);
	}

	return {
		dist: farthestPointDist,
		point: farthestPoint,
		src: farthestPointSrc
	};
}

function getNearestPointBetweenPaths(p1,p2,radius,tol) {
	var nearestPoint, nearestPointDist, nearestPointSrc;

	nearestPointDist = radius + 1000;

	if (p1.curves.length == 0 || p2.curves.length == 0)
		return {
			dist: null,
			point: null,
			src: null
		};

	// check p1 segments against p2
	// this is sloooow.... how about if we only check the 5 points closest to each end?
	for (var j=0; j<p1.segments.length; j++) {
		if (j<5 || j > p1.segments.length-5) {

			var np = p2.getNearestLocation(p1.segments[j].point);

			if (!np)
				continue;

			var distToP = np.point.subtract(p1.segments[j].point).length;


			if (distToP < nearestPointDist) {
				nearestPointDist = distToP;
				nearestPoint = np.point;
				nearestPointSrc = p1.segments[j].point;
			}

			if (distToP < radius - tol) {
				break;
			}

			// also test the midpoint of this curve
			if (p1.segments[j].curve) {
				var p3 = p1.segments[j].curve.getPointAt(0.5,true);
				var np = p2.getNearestLocation(p3);
				if (!np)
					continue;

				var distToP = np.point.subtract(p3).length;


				if (distToP < nearestPointDist) {
					nearestPointDist = distToP;
					nearestPoint = np.point;
					nearestPointSrc = p3;
				}

				if (distToP < radius - tol) {
					break;
				}
			}

		}

	}

	// check p2 segments against p1 - slow!!
	if (nearestPointDist > radius-tol && false) {
		console.log('trying it backwards', nearestPointDist);
		for (var j=0; j<p2.segments.length; j++) {

			var np = p1.getNearestLocation(p2.segments[j].point);

			if (!np)
				continue;

			var distToP = np.point.subtract(p2.segments[j].point).length;


			if (distToP < nearestPointDist) {
				nearestPointDist = distToP;
				nearestPoint = p2.segments[j].point;
				nearestPointSrc = np.point;
			}

			if (distToP < radius - tol) {
				console.log('got closer', distToP);
				break;
			}

		}

	}

	// debug
	if (false && distToP < radius - tol) {
		var sc = new Color(Math.random(),Math.random(),Math.random(), 1);

		var offsetPoint = new Point(Math.random()*2, Math.random()*2);

		var text = new PointText({
			point: nearestPoint.add(offsetPoint),
			content: nearestPointDist.toPrecision(3),
			fillColor: sc,
			fontFamily: 'Courier New',
			fontSize: 2
		});

		debugGroup.addChild(text);

		var marker = new Path();
		marker.strokeColor = sc;
		marker.moveTo(nearestPoint);
		marker.lineTo(nearestPointSrc);
		debugGroup.addChild(marker);
	}


	return {
		dist: nearestPointDist,
		point: nearestPoint,
		src: nearestPointSrc
	};
}


function calcOffsetPath(p, radius, progressCallback, stopAfter) {
	var op = new CompoundPath();
	op.strokeColor = new Color(1,0,0,0.3);

	var cc = p.curves.length;
	if (stopAfter && cc > stopAfter)
		cc = stopAfter;

	console.log('calcOffsetPath', cc);

	if (progressCallback) progressCallback('start','calcOffsetPath');

	// create offset curves
	if (progressCallback) progressCallback('start','Generating offset curves');

	for (var i=0; i<cc; i++) {
		var c = p.curves[i];

		// NB: offsetCurve will return a path or curve object
		var oc = offsetCurve(c, radius);

		if (op.curves.length > 0) {
			var lc = op.curves[op.curves.length-1];

			// generate joint
			var jc = createJoint(lc, oc, c.point1, radius);


			if (jc) {
				appendPathToPath(jc, op)
			} else {
				if (oc.type == 'path') {
					if (oc.segments.length > 0 && op.lastSegment.point != oc.firstSegment.point) {
						op.lineTo(oc.firstSegment.point);
					}
				} else {
					if (op.lastSegment.point != oc.point1) {
						op.lineTo(oc.point1);
					}
				}
			}

		}

		// add curve(s) to op
		appendPathToPath(oc, op);

		if (oc.degenerate && op.curves.length > 0)
			op.curves[op.curves.length-1].degenerate = true;

		// discard oc
		if (oc.type == 'path')
			oc.remove();

		if (progressCallback) progressCallback(null,100*i/cc);

	}

	if (progressCallback) progressCallback('end','');

	// join end to beginning
	if (p.closed && op.curves.length && op.curves.length > 0) {

		var lc = op.curves[op.curves.length-1];
		var oc = op.curves[0];
		var c = p.curves[0];

		// generate joint
		var jc = createJoint(lc, oc, c.point1, radius);

		if (jc)
			appendPathToPath(jc, op);

		op.closePath();
	}


	//console.log(op.children.length);

	//return op;

	// show curve numbers?
	if (false)
	for (var i=0; i<op.curves.length; i++) {
		var c = op.curves[i];

		// show end points
		var circ = new Path.Circle({ center: c.point1, radius:1, strokeColor:new Color(0,0,1,0.5)});
		debugGroup.addChild(circ);

		circ = new Path.Circle({ center: c.point2, radius:1, strokeColor:new Color(0,0,1,0.5)});
		debugGroup.addChild(circ);


		var text = new PointText({
			point: c.point1,
			content: i,
			fillColor: 'black',
			fontFamily: 'Courier New',
			fontSize: 3
		});

		debugGroup.addChild(text);

	}

	// show last point
	//var circ = new Path.Circle({ center: op.lastSegment.point, radius:3, strokeColor:new Color(0,0,1,1)});
	//debugGroup.addChild(circ);

	// find (and split at) all self-intersections
	if (progressCallback) progressCallback('start','Evaluating intersections');

	console.log('Evaluating intersections');

	var intersections = [];

	var i=0;
	var aargh = 0;
	while (i<op.curves.length) {

		if (progressCallback) progressCallback(null,100*i/op.curves.length);

		var c1 = op.curves[i];

		var j = i+1;

		while (j<op.curves.length) {

			// avoid looking for self-intersections
			if (j == i) {
				j++;
				continue;
			}

			var c2 = op.curves[j];

			// do c1 and c2 intersect?
			if (c1.bounds.intersects(c2.bounds)) {

				var ci = c1.getIntersections(c2);

				// check intersections, ignore end-points
				for (var k=0; k<ci.length; k++) {
					intersec = ci[k];

					var c1p1 = intersec.point.getDistance(c1.point1,true);
					var c1p2 = intersec.point.getDistance(c1.point2,true);
					var c2p1 = intersec.point.getDistance(c2.point1,true);
					var c2p2 = intersec.point.getDistance(c2.point2,true);

					var atEndOfC1 = c1p1 < 0.000001 || c1p2 < 0.000001;
					var atEndOfC2 = c2p1 < 0.000001 || c2p2 < 0.000001;

					if (!atEndOfC2) {

						intersections.push(intersec);

						c2.splitMe = true;
						if (!c2.splitMeAt) {
							c2.splitMeAt = [];
						}
						c2.splitMeAt.push({param: intersec.intersection.parameter, point: intersec.point});

						/*
						var text = new PointText({
							point: intersec.point,
							content: intersections.length,
							fillColor: 'black',
							fontFamily: 'Courier New',
							fontSize: 3
						});
						debugGroup.addChild(text);
						*/

						//debugCrossHair(intersec.point,0.2,'green');

						aargh += 1;
						if (aargh > 1000) {
							console.log('aaaaargh... too many intersections');
							return null;

						}

					}

					if (!atEndOfC1) {

						intersections.push(intersec);

						//debugCrossHair(intersec.point,0.2,'blue');

						/*
						var text = new PointText({
							point: intersec.point.add(new Point(2,1)),
							content: intersections.length,
							fillColor: 'black',
							fontFamily: 'Courier New',
							fontSize: 3
						});
						debugGroup.addChild(text);
						*/

						c1.splitMe = true;
						if (!c1.splitMeAt) {
							c1.splitMeAt = [];
						}
						c1.splitMeAt.push({param: intersec.parameter, point: intersec.point});
					}

				}

			}

			j++;
		}

		i++;
	}
	if (progressCallback) progressCallback('end','');


	var sop = new CompoundPath();
	sop.strokeColor = new Color(0,1,0,1);

	// split
	for (var i=0; i<op.curves.length; i++) {
		var c = op.curves[i];

		if (c.splitMe) {
			c.splitMeAt.sort(function(a,b) {
				return a.param-b.param;
			});

			var ca;
			var splitC;
			for (var j=0; j<c.splitMeAt.length; j++) {
				var param1 = 0;
				var param2 = c.splitMeAt[j].param;

				if (j > 0) {
					param1 = c.splitMeAt[j-1].param;
				}

				/*
				var sc = new Color(1,0,0,1);
				sc.hue = Math.random()*360;
				debugCrossHair(c.splitMeAt[j].point,1,sc,j.toPrecision(1));
				*/

				splitC = c.clone();

				if (param1 > 0) {

					splitC = splitC.divide(param1, true);
					//splitC = splitC.divide(c.getParameterOf(c.splitMeAt[j-1].point),true);

					if (!splitC)
						splitC = c.clone();

				/*
					var debugP = new Path();
					debugP.strokeColor = new Color(1,0,0,0.5);
					debugP.strokeColor.hue = Math.random() * 360;
					debugP.strokeWidth = 2;

					appendPathToPath(splitC, debugP);

					debugGroup.addChild(debugP);
					view.draw();
					*/

				}

				//debugCrossHair(c.splitMeAt[j].point,0.05,'red');

				if (splitC) {
					if (j>0) {
						param2 = splitC.getParameterOf(c.splitMeAt[j].point);
						if (!param2)
							param2 = splitC.getNearestLocation(c.splitMeAt[j].point).parameter;
					}

					ca = splitC.divide(param2, true);

					if (!ca) {
						//debugCrossHair(c.splitMeAt[j].point,1,'red');
						console.log('no ca:',splitC, param2, j);
					}

					/*
					var debugP = new Path();
					debugP.strokeColor = new Color(1,0,0,0.5);
					debugP.strokeColor.hue = Math.random() * 360;

					appendPathToPath(splitC, debugP);

					debugGroup.addChild(debugP);
					//view.draw();
					*/

					sop.moveTo(splitC.point1);
					appendPathToPath(splitC, sop);
				}

			}
			if (ca) {
				sop.moveTo(ca.point1);
				appendPathToPath(ca, sop);
			}
		} else {
			sop.moveTo(c.point1);
			appendPathToPath(c, sop);
		}
	}



	op.removeChildren();
	op.remove();

	op = sop;

	console.log('Removing unwanted paths');
	if (progressCallback) progressCallback('start','Clipping');

	// merge close points
	joinCloseSegments(op, radius/40);

	// remove junk paths
	var i=0;

	var cc = 0;

	while (i<op.children.length && op.children.length > 0) {
		var op1 = op.children[i];

		var removeChild = false;

		console.log('checking path',i,'/',op.children.length);
		if (progressCallback) progressCallback(null,i/op.children.length);

		var tol = radius/40;
		var nearestPoint = getNearestPointBetweenPaths(op1, p, radius, tol);

		if (nearestPoint.dist && Math.abs(radius - nearestPoint.dist) > tol) {
			removeChild = true;
		} else {
			// check for too far away as well
			//var farthestPoint = getFarthestPointBetweenPaths(op1, p, radius, tol);

			//var removeC = removeOutliers(op1, p ,radius, tol);
			//console.log('removed outliers:',removeC);

		}



		if (removeChild) {
			op.removeChildren(i,i+1);

			/*
			var debugP = new Path();
			debugP.strokeColor = new Color(1,0,0, removeChild?0.3:1);
			debugP.strokeColor.hue = Math.random() * 360;
			debugP.strokeWidth = Math.random()/10;

			appendPathToPath(op1, debugP);

			debugGroup.addChild(debugP);
			*/


			//drawPathHandles(op1, new Color(0,0,0,0.3));

		} else {

			/*
			var debugP = new Path();
			debugP.strokeColor = new Color(1,0,0, removeChild?0.3:1);
			debugP.strokeColor.hue = Math.random() * 360;

			appendPathToPath(op1, debugP);

			debugGroup.addChild(debugP);
			*/

			i++;
		}

		cc++;
	}
	if (progressCallback) progressCallback('end','');

	//op.remove();

	console.log('offsetPath complete');
	if (progressCallback) progressCallback('end','');

	return op;
}




function joinCloseSegments(p, tol) {
	// merge segments closer than tol
	if (!p.segments || !p.segments.length) {
		p.remove();
		return;
	}

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
			var h1 = s1.handleIn.clone();

			// average locations
			var np = new Point( (s1.point.x + s2.point.x)/2, (s1.point.y + s2.point.y)/2 );
			s1.remove();
			s2.point = np;

			s2.handleIn = h1;

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
