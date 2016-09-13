// evaluate and build a tree reflecting path containment


function isPathContainedBy(p1, p2) {
	// is p1 contained by p2?
	if (p2.bounds._containsRectangle(p1.bounds)) {

		// test for containment

		// check every point in p1 for containment within p2
		// all must be contained!
		var contains = 0;
		for (var i=0; i<p1.segments.length; i++) {
			var point = p1.segments[i].point;

			if (p2.contains(point)) {
				 contains+=1;
			} else {
				break;
			}
		}

		return contains == p1.segments.length;

	} else return false;
}

function buildContainmentTree(root) {
	var tree = new TreeModel();
	var ct = tree.parse({id:null, path:null})// the containment tree

	doThisToPaths(root, function(item) {

		var tn = tree.parse({id:item.id, path:item});

		// locate a suitable place to insert this node

		var insertNode = ct.all(function (node) {
			if (node.model.path) {
				return isPathContainedBy(item, node.model.path);
			} else return false;
		});

		if (insertNode && insertNode.length > 0) {

			var insertDepth = 0;
			var iNode;
			for (var i=0; i<insertNode.length; i++) {
				var depth = insertNode[i].getPath().length;
				if (depth > insertDepth) {
					insertDepth = depth;
					iNode = insertNode[i];
				}
			}

			if (iNode)
				iNode.addChild(tn);

		} else {
			ct.addChild(tn);
		}

		// now see if any siblings need to be consumed
		var consumeNodes = ct.all(function (node) {
			if (node.model.path && node.parent == tn.parent) {
				return isPathContainedBy(node.model.path, item);
			} else return false;
		});

		if (consumeNodes && consumeNodes.length > 0) {
			for (var i=0; i<consumeNodes.length-1; i++) {
				var dropped = consumeNodes[i].drop();

				tn.addChild(dropped);
			}
		}
	});

	return ct;
}

// set paths to cw/ccw based on depth within containment tree
function setPathDirectionInContainmentTree(ct, reverse) {
	//console.log('setting direction',ct.model.id);

	if (ct.model.path && ct.model.path.segments.length > 0) {
		var depth = ct.getPath().length;
		var dir =!(depth % 2) ^ !reverse;

		if (ct.model.path.clockwise != dir) {
			ct.model.path.reverse();
		}
	}

	for (var i=0; i<ct.children.length; i++) {
		var node = ct.children[i];

		setPathDirectionInContainmentTree(node, reverse);
	}
}

function debugContainmentTree(ct) {
	ct.walk(function (node) {
		if (node.model.path) {
    		var p = new Path();
    		p.strokeColor = new Color(1,0,0,1);
    		p.strokeColor.hue = (node.getPath().length/6 * 360);
    		appendPathToPath(node.model.path, p);
    		debugGroup.addChild(p);

    		// show containment
    		if (node.model.path.segments.length > 0) {
				var point = node.model.path.segments[0].point
				var circ = new Path.Circle({ center: point, radius:1, strokeColor:'red'});
				debugGroup.addChild(circ);

				if (node.parent.model.path) {
					var m = node.parent.model.path.getNearestPoint(point);

					if (m) {
						var p = new Path();
						p.strokeColor = 'black';
						p.moveTo(point);
						p.lineTo(m);
						debugGroup.addChild(p);
					}
				}
			}
    	}
    });
}

function sierpSortContainmentTree(ct) {

	if (ct.children.length == 0) return;

	var bounds;
	if (ct.model.path) {
		bounds = ct.model.path.bounds;
	} else {
		// compute bounds!
		bounds = new Rectangle(0,0,0,0);
		for (var i=0; i<ct.children.length; i++) {
			var node = ct.children[i];
			if (node.model.path) {
				var b2 = node.model.path.bounds;
				if (b2.left < bounds.left) bounds.left = b2.left;
				if (b2.top < bounds.top) bounds.top = b2.top;
				if (b2.right > bounds.right) bounds.right = b2.right;
				if (b2.bottom > bounds.bottom) bounds.bottom = b2.bottom;
			}
		}
	}

	for (var i=0; i<ct.children.length; i++) {
		var node = ct.children[i];
		if (node.model.path && node.model.path.segments.length > 0) {
			var p = node.model.path;
			//node.model.sierp = bestSierpPosForPath(p, bounds);
			node.model.sierp = sierpPos(p.segments[0].point, bounds);
		}

		sierpSortContainmentTree(node);
	}

	ct.children.sort(function(a,b) {
		if (a.model.sierp && b.model.sierp) {
			return a.model.sierp - b.model.sierp;
		} else {
			return 0;
		}
	});
}


function greedySortContainmentTree(ct) {
	if (ct.children.length == 0) return;

	// set initial greedy values
	for (var i=0; i<ct.children.length; i++) {
		var node = ct.children[i];
		node.model.greedy = -1;
	}

	// assign path ordering values
	greedy = 0;
	lp = null;  // last point
	done = false;
	while (!done && greedy < ct.children.length) {

		// if lp (lastPoint) is valid
		if (lp != null) {
			// look through all the other paths for one that has an undefined greedy value
			// and that has the closest start or end point
			bp = null;  // best path
			bc = null;  // best child
			bd = null;  // best distance
			start = true;
			bstart = true;
			for (var j=0; j<ct.children.length; j++) {
				if (ct.children[j].model.greedy < 0) {
					// check start and end
					p2 = ct.children[j].model.path;
					ds = lp.getDistance(p2.firstSegment.point, true);
					if (p2.closed) {
						de = ds;
					} else {
						de = lp.getDistance(p2.lastSegment.point, true);
					}
					d = 0;
					if (ds <= de) {
						start = true;
						d = ds;
					} else {
						d = de;
						start = false;
					}

					if ((bd == null) || (bd != null && d < bd)) {
						bd = d;
						bp = p2;
						bc = ct.children[j];
						bstart = start;
					}
				}
			}

			// bp should now point to the best path, bc to the associated ct node
			if (bc != null) {
				if (!bstart) {
					bp.reverse();
				}
				// as start was the nearest point, then the end of the path is the new lastPoint
				// unless it's a closed path
				if (bc.model.path.closed)
					lp = bc.model.path.firstSegment.point
				else
					lp = bc.model.path.lastSegment.point;

				bc.model.greedy = greedy;
				greedy++;
			} else {
				// nothing found, we must be done
				done = true;
			}


		} else {
			// assume the first child is good enough for a starting point
			ct.children[0].model.greedy = greedy;
			greedy++;
			if (ct.children[0].model.path.closed)
				lp = ct.children[0].model.path.firstSegment.point.clone()
			else
				lp = ct.children[0].model.path.lastSegment.point.clone();
		}

	}

	// apply the sort
	ct.children.sort(function(a,b) {
		return a.model.greedy - b.model.greedy;
	});

	// RECURSE
	// sort paths of child node
	for (var i=0; i<ct.children.length; i++) {
		var node = ct.children[i];

		greedySortContainmentTree(node);
	}
}



function debugOrderingCT(ct, c) {
	if (ct.children.length > 0) {
		var path = new Path();
		path.strokeColor = new Color(c);
		path.strokeColor.alpha = 0.2;
		//path.strokeColor.hue = (ct.getPath().length/6 * 360);
		debugGroup.addChild(path);

		debugCrossHair(ct.children[0].model.path.firstSegment.point.clone(),2, path.strokeColor);

		for (var i=0; i<ct.children.length; i++) {
			var node = ct.children[i];
			if (node.model.path && node.model.path.segments.length > 0) {
				var p = node.model.path;

				var lp = p.lastSegment.point;
				if (p.closed) lp = p.firstSegment.point;


				if (i>0) {
					path.lineTo(p.firstSegment.point);

					// start a new debug path
					path = new Path();
					path.strokeColor = new Color(c);
					path.strokeColor.alpha = 0.2;
					debugGroup.addChild(path);
					path.moveTo(lp);
				} else {
					path.moveTo(lp);
				}

				// add arrows for each curve
				for (var j=0; j < p.curves.length; j++) {
					crv = p.curves[j];
					var vector = crv.getTangentAt(0.5, true);
					var arrowVector = vector.normalize(2);
					var point2 = crv.getPointAt(0.5, true);
					var path2 = new Path({
						segments: [
						point2.add(arrowVector.rotate(145)),
						point2,
						point2.add(arrowVector.rotate(-145))
						],
						fillColor: path.strokeColor,
						strokeWidth: 1,
					});
					debugGroup.addChild(path2);
				}

			}

			debugOrderingCT(node, c);
		}
	}
}


function debugSierp(item) {
	// pass in an svg item

	var numPoints = 1000;

	var points = [];

	var maxSierp = 0;

	for (var i=0; i<numPoints; i++) {
		var point = new Point(
			item.bounds.x + item.bounds.width*Math.random(),
			item.bounds.y + item.bounds.height*Math.random()
		);

		var sierp = sierpPos(
			point.x,
			point.y,
			item.bounds
		);

		point.sierp = sierp;
		points.push(point);

		if (sierp > maxSierp) maxSierp = sierp;
	}

	points.sort(function(a,b) {
		return a.sierp - b.sierp;
	});

	var p = new Path();
	p.strokeColor = 'black';
	p.moveTo(points[0]);
	for (var i=0; i <points.length; i++) {
		p.lineTo(points[i]);
	}
	debugGroup.addChild(p);
}


function bestSierpPosForPath(p, parentBounds) {
	// search for lowest sierpPos within path segments
	var sp = -1;
	for (var i=0; i <p.segments.length; i++) {
		sp2 = sierpPos(p.segments[i].point, parentBounds);
		if (sp2 < sp || sp < 0) sp = sp2;
	}
	return sp;
}

function sierpPos(point, bounds) {
	var x1 = Math.round(point.x - bounds.left);
	var y1 = Math.round(point.y - bounds.top);
	var maxInput = bounds.width > bounds.height? bounds.width : bounds.height;
	maxInput = Math.round(maxInput);
	var result = 0;
	var loopIndex = maxInput;
	var oldx = 0;

	if (x1 > y1 ) {
		result++;
		x1 = maxInput - x1;
		y1 = maxInput - y1;
	}

	while (loopIndex > 0) {
		result += result;
		if ( x1 + y1 > maxInput) {
			result++;
			oldx = x1;
			x1 = maxInput - y1;
			y1 = oldx;
		}

		x1 += x1;
		y1 += y1;

		result += result;
		if (y1 > maxInput) {
			result++;
			oldx = x1;
			x1 = y1 - maxInput;
			y1 = maxInput - oldx;
		}
		loopIndex = Math.floor(loopIndex / 2);
	}
	return result;
}
