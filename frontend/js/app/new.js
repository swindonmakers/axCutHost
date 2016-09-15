
var newState = {
	state: 0,
	kOptCount: 0,
	kOpt: false
};

/*
    Utilities for paper.js
*/

function doThisToPaths(item, cb) {
	if (item.children && item.children.length > 0) {
		for (var i=0; i<item.children.length; i++) {
			if (item._class == 'CompoundPath')
				item.children[i].strokeColor = item.strokeColor;

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


function NewViewModel() {
    var self = this;

    self.loadedFilename = ko.observable('');

    self.selectedMaterial = ko.observable();

    // from imported SVG
	// colour groups get matched up with availableLineTypes using .selectedType
	// paths are linked into colour groups using .srcPaths array
    self.lineTypes = ko.observableArray([]);

	// first level is order, 2nd is z
	self.orderedCurves = [];

    // from selected material
    self.availableLineTypes = ko.observableArray([]);

    self.originX = ko.observable(0);
    self.originY = ko.observable(0);
	self.origin = [0,0]; // for faster reference as numeric values

	// travel move options
	self.doBezierTravelMoves = ko.observable(true);
	self.travelMoveMinSpeed = ko.observable(30);
	self.travelMoveMinAngle = ko.observable(30);
	self.travelMoveLeadInOut = ko.observable(20);


	// bounds of original SVG
	self.width = ko.observable(0);
	self.height = ko.observable(0);

	self.notes = ko.observableArray([]);
	self.textObjects = ko.observableArray([]);

	self.progressLog = ko.observableArray([]);
};

// extend masterVM
masterVM.newVM = new NewViewModel();


// maps a paper.js Point object into machine co-ordinates
function mapPointToMachine(p1,p2) {
	return [
		masterVM.newVM.origin[0] + p1.x + (p2 != undefined ? p2.x : 0),
		masterVM.newVM.origin[1] + machine.bedD - p1.y - (p2 != undefined ? p2.y : 0)
	];
}

// lerp points, assuming 2 part arrays
function lerpPoint(p1,p2,p) {
	return [
		lerp(p1[0], p2[0], p),
		lerp(p1[1], p2[1], p)
	];
}


function newGenGCode_SplitCurves() {
	masterVM.newVM.progressLog.push({text:'Splitting curves', meter:null});

	var lts = masterVM.newVM.lineTypes();

	// for each line type
	for (var i=0; i<lts.length; i++) {
		var lt = lts[i];

		lt.type = lt.selectedType();

		lt.curves = [];

		if (lt.type == undefined || lt.type.passes == undefined) continue;

		// for each path
		for (var j=0; j< lt.srcPaths.length; j++) {
			var p  = lt.srcPaths[j];

			// for each curve within the path
			for (var k=0; k < p.curves.length; k++) {

				var curve = p.curves[k];
				var c = {
					isLinear: curve.isLinear(),
					p1: mapPointToMachine(curve.point1),
					p2: mapPointToMachine(curve.point2),
					h1: null,
					h2: null,
					l: curve.length,
					order: lt.type.order
				};

				if (c.isLinear) {
					// break up long lines into smaller pieces
					if (c.l > machine.maxLineLength) {
						var segments = Math.floor(c.l / machine.maxLineLength,1) + 1;

						// generate segment moves
						var s = c.p1;
						var e = c.p2;
						for (var m=0; m<segments; m++) {

							var c1 = {
								isLinear: c.isLinear,
								p1: lerpPoint(s,e, (m+0.0)/segments),
								p2: lerpPoint(s,e, (m+1.0)/segments),
								h1: null,
								h2: null,
								l: c.l / segments,
								order: c.order
							}
							lt.curves.push(c1);
						}
					} else {
						lt.curves.push(c);
					}

				} else {
					c.h1 = mapPointToMachine(curve.point1, curve.handle1);
					c.h2 = mapPointToMachine(curve.point2, curve.handle2);

					lt.curves.push(c);
				}

			}

		}


		//console.log('curves:',lt.curves.length);
	}

}

function insertSortCurve(c) {
	var oc = masterVM.newVM.orderedCurves;

	// level 1 = order
	var res = $.grep(oc, function(e){ return e.order == c.order; });
	if (res.length == 0) {
		res.push({order: c.order, z:[]})
		oc.push(res[0]);
		oc.sort(function(a, b){return a.order - b.order});
	}

	var o = res[0];

	// level 2
	res = $.grep(o.z, function(e){ return e.z == c.z; });
	if (res.length == 0) {
		res.push({z: c.z, curves: []})
		o.z.push(res[0]);
		o.z.sort(function(a, b){return a.z - b.z});
	}

	res[0].curves.push(c);
}


function newGenGCode_SepPasses() {
	var meter = {
		text:'Seperating out passes and assigning order, feedrate, z and cut power.  Grouping and ordering.',
		meter:ko.observable(0)
	};
	masterVM.newVM.progressLog.push(meter);

	var lts = masterVM.newVM.lineTypes();

	masterVM.newVM.orderedCurves = [];

	// for each line type
	for (var i=0; i<lts.length; i++) {
		var lt = lts[i];

		if (lt.type == undefined || lt.type.passes == undefined || lt.curves == undefined) continue;

		//masterVM.newVM.progressLog.push({text:' Line Type: '+lt.type.type});

		// for each curve
		var numCurves = lt.curves.length;
		for (var k=0; k < numCurves; k++) {
			var c = lt.curves[k];

			meter.meter((k+1.0) / numCurves);

			// for each pass
			for (var j=0; j< lt.type.passes.length; j++) {
				var pass  = lt.type.passes[j];

				if (j == 0) {
					c.power = pass.power;
					c.speed = Math.min(
						mapFeedRate(pass.speed, c.p2[0], c.p2[1]),
						mapFeedRate(pass.speed, c.p1[0], c.p1[1])
					);
					c.z = pass.z;
					c.a = lt.type.anisotropic;
					c.aAxis = lt.type.anisotropicAxis;
					c.aPower = lt.type.anisotropicPower;
					insertSortCurve(c);

				} else {
					// clone
					var c1 = {
						isLinear: c.isLinear,
						p1: c.p1,
						p2: c.p2,
						h1: c.h1,
						h2: c.h2,
						l: c.l,
						a: c.a,
						aAxis: c.aAxis,
						aPower: c.aPower,
						order: c.order + j
					}
					c1.power = pass.power;
					c1.speed =  Math.min(
						mapFeedRate(pass.speed, c1.p2[0], c1.p2[1]),
						mapFeedRate(pass.speed, c1.p1[0], c1.p1[1])
					);
					c1.z = pass.z;
					insertSortCurve(c1);
				}


			}

		}

		//console.log(lt.type.type, ' curves:',lt.curves.length);
	}
}

function annotateStartEndVector(c) {
	c.p1.length = 4;
	var v = calcStartVector(c);
	c.p1[2] = v.x;
	c.p1[3] = v.y;

	c.p2.length = 4;
	v = calcEndVector(c);
	c.p2[2] = v.x;
	c.p2[3] = v.y;
}

function estimateBezierLength(c) {
	var p = [
        c.p1,
        c.h1,
        c.h2,
        c.p2
    ];
	var maxD = 0;
    var sqrD = 0;
    for (var i=1; i<4; i++) {
    	sqrD = (p[i][0] - p[i-1][0])*(p[i][0] - p[i-1][0])  +  (p[i][1] - p[i-1][1])*(p[i][1] - p[i-1][1]);
    	if (sqrD > maxD) {maxD = sqrD; };
    }
    maxD = Math.sqrt(maxD);
	return maxD;
}

function p2pdist(p1,p2) {
	return Math.sqrt(sqr(p2[0] - p1[0]) + sqr(p2[1] - p1[1]));
}

// travelDist function that takes account of bezier travel moves
function travelDist(p1,p2,speed) {
	// vectors need to be annotated for p1 and p2
	if (masterVM.newVM.doBezierTravelMoves()) {
		return estimateBezierLength(constructTravelMove(p1,p2,speed));
	} else {
		return p2pdist(p1,p2);
	}
}

function constructTravelMove(p1,p2,speed) {
	// construct an appropriate curve
	// p1, h1, h2, p2
	var doTravel = p1[0] != p2[0] || p1[1] != p2[1];
	var doBezTravel = (isBezierTravelRequired(p1, p2)) &&
					  (masterVM.newVM.doBezierTravelMoves()) &&
					  (speed > masterVM.newVM.travelMoveMinSpeed());

	//doBezTravel = doTravel && doBezTravel; //&& (startVec.getAngle(endVec) > 1);

	var tc;

	if (doBezTravel) {
		tc = {
			p1: [p1[0], p1[1]],
			h1: [
				p1[0] + p1[2] * masterVM.newVM.bezLeadInOut,
				p1[1] + p1[3] * masterVM.newVM.bezLeadInOut
			],
			h2: [
				p2[0] - p2[2] * masterVM.newVM.bezLeadInOut,
				p2[1] - p2[3] * masterVM.newVM.bezLeadInOut
			],
			p2: [p2[0], p2[1]],
			speed: speed,
			power:0,
			isLinear:false,
			doTravel:true
		};
	} else {
		tc = {
			p1: [p1[0], p1[1]],
			h1: [p1[0], p1[1]],
			h2: [p2[0], p2[1]],
			p2: [p2[0], p2[1]],
			speed: speed,
			power:0,
			isLinear:true,
			doTravel:doTravel
		};
	}

	return tc;
}

function reverseCurve(c) {
	var tmp = c.p1;
	c.p1 = c.p2;
	c.p2 = tmp;

	tmp = c.h1;
	c.h1 = c.h2;
	c.h2 = tmp;

	// reverse start/end vectors
	// TODO: stop being lazy and improve this
	annotateStartEndVector(c);
}

function TSP_Greedy(curves, start, meter) {

	// Sorts the set of curves into a short tour, using a simple, greedy algorithm
	// Algorithm:
	//  1) Take each curve in turn and assign a "greedy" sequence value
	//       All remaining curves are tested to find the one with shortest travel distance
	//  2) Sort the curves in "greedy" sequence

	//masterVM.newVM.progressLog.push({text:'Nearest Neighbour', meter:null});

	// set initial greedy values
	for (var i=0; i<curves.length; i++) {
		curves[i].greedy = -1;
	}

	// assign path ordering values
	greedy = 0;
	lp = start;  // last point
	done = false;
	while (!done && greedy < curves.length) {

		meter.meter((greedy) / curves.length);

		// if lp (lastPoint) is valid
		if (lp != null) {
			// look through all the other paths for one that has an undefined greedy value
			// and that has the closest start or end point
			bc = null;  // best curve
			bd = null;  // best distance
			start = true;
			bstart = true;
			for (var j=0; j<curves.length; j++) {
				if (curves[j].greedy < 0) {
					// check start - from lp to start of candidate curve
					ds = travelDist(lp, curves[j].p1, curves[j].speed);
					// check end - from lp to end of candidate curve, treat as if candidate is reversed
					// by reversing the associated vector
					de = travelDist(lp, [
						curves[j].p2[0],
						curves[j].p2[1],
						-curves[j].p2[2],
						-curves[j].p2[3]
					], curves[j].speed);

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
						bc = curves[j];
						bstart = start;
					}
				}
			}

			// bc should now point to the best curve
			if (bc != null) {
				if (!bstart)
					reverseCurve(bc);

				// as start was the nearest point, then the end of the path is the new lastPoint
				lp = bc.p2;

				bc.greedy = greedy;
				greedy++;
			} else {
				// nothing found, we must be done
				done = true;
			}


		} else {
			// assume the first child is good enough for a starting point
			curves[0].greedy = greedy;
			greedy++;
			lp = curves[0].p2;
		}

	}

	// apply the sort
	curves.sort(function(a,b) {
		return a.greedy - b.greedy;
	});

	return curves;
}


function closestTo(c, p) {
	var ds = p2pdist(c.p1, p);
	var de = p2pdist(c.p2, p);
	return { d: (ds <= de ? ds : de), fwd: (ds <= de ? true : false) }
}

function tourLength(tour) {
	if (tour.length == 0) return 0;

	var l = 0;

	var lastPoint = tour[tour.length-1].p2;

	for (var i=0; i < tour.length; i++) {
		var c = tour[i];

		// calc and cache dist from prev point
		c.travel = travelDist(lastPoint, c.p1, c.speed);

		// add dist from prev point
		l += c.travel;

		// add own length
		l += c.l;

		// cache tour length to end of this curve
		c.tourLength = l;

		lastPoint = c.p2;
	}

	return l;
}

function TSP_FarthestInsertion(curves, start, meter) {

	//masterVM.newVM.progressLog.push({text:'Farthest Insertion', meter:null});

	// set initial values
	var tour = [], stack = [];

	for (var i=0; i<curves.length; i++) {
		curves[i].fi = curves.length;
		curves[i].id = i;
		stack.push(curves[i]);
	}

	// find the closest curve to start
	var best = closestTo(curves[0], start);
	best.c = curves[0];
	for (var i=1; i<curves.length; i++) {
		var ct = closestTo(curves[i], start);
		if (ct.d < best.d) {
			best = ct;
			best.c = curves[i];
		}
	}

	// push first curve onto tour, reverse it if necessary
	if (!best.fwd) reverseCurve(best.c);
	tour.push(best.c);
	stack = stack.filter(function (el) {
		return el.id != best.c.id;
	});


	// whilst there are still items on the stack...
	var tl = 0;
	while (stack.length > 0) {

		// calc tour length so far, and cache associated values
		tl = tourLength(tour);

		// check each curve on stack for the cost of inserting it into the tour
		// at diff positions, find the max cost insertion
		var maxCost = 0;
		var maxIndex = 0;
		var doMaxReverse = false;
		var maxCurve = stack[0];
		for (var i=0; i<stack.length; i++) {
			// candidate curve
			var cc = stack[i];

			// test against each possible position in the tour
			// find the minCost insertion point
			var minCost = 1000000;  // silly big number to start
			var minIndex = 0;  // insert after this point
			var doReverse = false;  // true if minCost requires curve to be reversed
			for (var j=0; j<tour.length; j++) {
				var c1 = tour[j];
				var c2 = j < tour.length-1 ? tour[j+1] : tour[0];

				// insertion cost is:
				//   tour[j].p2 to new curve to tour[j+1].p1

				// cc in current direction
				var cost1 = p2pdist(c1.p2, cc.p1) +
							cc.l +
							p2pdist(cc.p2, c2.p1) -
							c2.travel;

				// cc reversed
				var cost2 = p2pdist(c1.p2, cc.p2) +
							cc.l +
							p2pdist(cc.p1, c2.p1) -
							c2.travel;

				if (cost1 < minCost) {
					minCost = cost1;
					doReverse = false;
					minIndex = j;
				}

				if (cost2 < minCost) {
					minCost = cost2;
					doReverse = true;
					minIndex = j;
				}
			}

			// is this the maximum value so far?
			if (minCost > maxCost) {
				maxCost = minCost;
				maxIndex = minIndex;
				doMaxReverse = doReverse;
				maxCurve = cc;
			}
		}


		// insert the curve with the maximum value at the req position
		if (doMaxReverse) reverseCurve(maxCurve);
		// insert?
		tour.splice(maxIndex+1, 0, maxCurve);
		stack = stack.filter(function (el) {
			return el.id != maxCurve.id;
		});

	}


	//console.log('tour length: ',tourLength(tour));


	// write tour directions to curves
	return tour;
}


function TSP_NearestInsertion(curves, start, meter) {

	//masterVM.newVM.progressLog.push({text:'Nearest Insertion', meter:null});

	//console.log('Num curves at start: ',curves.length);

	// set initial values
	var tour = [], stack = [];

	for (var i=0; i<curves.length; i++) {
		curves[i].id = i;
		stack.push(curves[i]);
	}

	// find the closest curve to start
	var best = closestTo(curves[0], start);
	var bestCurve = curves[0];
	for (var i=1; i<curves.length; i++) {
		var ct = closestTo(curves[i], start);
		if (ct.d < best.d) {
			best = ct;
			bestCurve = curves[i];
		}
	}

	// push first curve onto tour, reverse it if necessary
	if (!best.fwd) reverseCurve(bestCurve);
	tour.push(bestCurve);
	stack = stack.filter(function (el) {
		return el.id != bestCurve.id;
	});


	// whilst there are still items on the stack...
	var tl = 0;
	while (stack.length > 0) {

		// calc tour length so far, and cache associated values
		tl = tourLength(tour);

		// check each curve on stack for the cost of inserting it into the tour
		// at diff positions, find the min cost insertion
		var minCost = 1000000;  // silly big number to start
		var minIndex = 0;  // insert after this point
		var doReverse = false;  // true if minCost requires curve to be reversed
		var minCurve = stack[0];
		for (var i=0; i<stack.length; i++) {
			// candidate curve
			var cc = stack[i];

			// test against each possible position in the tour
			// find the minCost insertion point
			for (var j=0; j<tour.length; j++) {
				var c1 = tour[j];
				var c2 = j < tour.length-1 ? tour[j+1] : tour[0];

				// insertion cost is:
				//   tour[j].p2 to new curve to tour[j+1].p1

				// cc in current direction
				var cost1 = p2pdist(c1.p2, cc.p1) +
							cc.l +
							p2pdist(cc.p2, c2.p1) -
							c2.travel;

				// cc reversed
				var cost2 = p2pdist(c1.p2, cc.p2) +
							cc.l +
							p2pdist(cc.p1, c2.p1) -
							c2.travel;

				if (cost1 < minCost) {
					minCost = cost1;
					doReverse = false;
					minIndex = j;
					minCurve = cc;
				}

				if (cost2 < minCost) {
					minCost = cost2;
					doReverse = true;
					minIndex = j;
					minCurve = cc;
				}
			}
		}


		// insert the curve with the maximum value at the req position
		if (doReverse) reverseCurve(minCurve);
		// insert?
		tour.splice(minIndex+1, 0, minCurve);
		stack = stack.filter(function (el) {
			return el.id != minCurve.id;
		});

	}


	//console.log('tour length: ',tourLength(tour));


	// write tour directions to curves
	return tour;
}


function kOptLength(tour, i, k) {
	// eval length of swap, without actually swapping it!
	var l = 0;
	l += tour[i-1].tourLength;
	l += travelDist(tour[i-1].p2, tour[k].p2, tour[k].speed);
	l += tour[k].tourLength - tour[i].tourLength + tour[i].l;
	l += travelDist(tour[i].p1, tour[k+1].p1, tour[k+1].speed);
	l += tour[tour.length-1].tourLength - tour[k+1].tourLength + tour[k+1].l;
	return l;
}

function kOptSwap(tour, i, k) {
	/*
	1. take route[0] to route[i-1] and add them in order to new_route
       2. take route[i] to route[k] and add them in reverse order to new_route (inc reverse curves)
       3. take route[k+1] to end and add them in order to new_route
       return new_route;
	*/

	var a = tour.slice(0, i);
	var b = tour.slice(i, k+1);
	b.reverse();
	for (var l=0; l<b.length; l++) {
		reverseCurve(b[l]);
	}
	var c = tour.slice(k+1, tour.length);

	return a.concat(b,c);
}

function kOpt(tour, start) {
	/*
	best_distance = calculateTotalDistance(existing_route)
       for (i = 0; i < number of nodes eligible to be swapped - 1; i++) {
           for (k = i + 1; k < number of nodes eligible to be swapped; k++) {
               new_route = 2optSwap(existing_route, i, k)
               new_distance = calculateTotalDistance(new_route)
               if (new_distance < best_distance) {
                   existing_route = new_route
                   goto start_again
               }
           }
       }
	*/

	if (tour.length < 3) return tour;

	var best = tour[tour.length-1].tourLength;
	console.log('best: ',best);
	var bi, bk = 0;
	var alt = best;

	for (var i=1; i< tour.length-3; i++) {
		for (var k=i + 1; k < tour.length-2; k++) {
			alt = kOptLength(tour, i, k);
			if (alt < best) {
				bi = i;
				bk = k;
				best = alt;
			}
		}
	}

	if (bi>0) {
		console.log('alt: ',best,' i/k:',bi,bk);
		return kOptSwap(tour, bi, bk);
	} else {
		console.log('no better option found');
		return tour;
	}
}

function newGenGCode_KOpt() {
	newState.kOpt = true; // true when busy
	console.log('iter:'+newState.kOptCount);

	var oc = masterVM.newVM.orderedCurves;

	var curPos = [machine.bedW, machine.bedD];

	var totalLengthBefore=0, totalLengthAfter = 0;

	// for each pass
	for (var i=0; i<oc.length; i++) {
	//for (var i=0; i<1; i++) {
		var o = oc[i];

		// for each z level
		for (var j=0; j<o.z.length; j++) {
			var z = o.z[j];

			console.log('pass: ',i, 'z: ', z.z);
			totalLengthBefore += tourLength(z.curves);

			z.curves = kOpt(z.curves, curPos);

			totalLengthAfter += tourLength(z.curves);

			if (z.curves.length > 0)
				curPos = z.curves[z.curves.length-1].p2;
		}
	}

	newState.kOptProgress.text(
			'2opt iter: '+ newState.kOptCount +
			' From: '+(totalLengthBefore/1000).toFixed(2)+
			'm to: '+(totalLengthAfter/1000).toFixed(2)
		);

	newState.kOptCount++;
	newState.kOptFinished = totalLengthAfter == totalLengthBefore;
	newState.kOpt = false;

}


function newGenGCode_Optimise() {
	var meter = {text:'Optimising passes', meter:ko.observable(0)};
	masterVM.newVM.progressLog.push(meter);

	var oc = masterVM.newVM.orderedCurves;

	var curPos = [machine.bedW, machine.bedD, 0, 0];

	var totalLengthBefore=0, totalLengthAfter = 0;

	// for each pass
	for (var i=0; i<oc.length; i++) {
		var o = oc[i];
		//console.log('order:',o.order);

		// for each z level
		for (var j=0; j<o.z.length; j++) {
			var z = o.z[j];

			// annotate all curves with start/end vectors
			for (var i=0; i<z.curves.length; i++) {
				annotateStartEndVector(z.curves[i]);
			}

			//console.log('z:',z.z, z.curves.length);

			totalLengthBefore += tourLength(z.curves);

			// apply TSP optimisation
			if ($('#newTSPSelect').val() == 'fi') {
				z.curves = TSP_FarthestInsertion(z.curves, curPos);
			} else if ($('#newTSPSelect').val() == 'ni') {
				z.curves = TSP_NearestInsertion(z.curves, curPos);
			} else {
				z.curves = TSP_Greedy(z.curves, curPos, meter);
			}

			totalLengthAfter += tourLength(z.curves);

			if (z.curves.length > 0)
				curPos = z.curves[z.curves.length-1].p2;
		}
	}


	masterVM.newVM.progressLog.push({
		text:
			'From: '+(totalLengthBefore/1000).toFixed(2)+
			'm to: '+(totalLengthAfter/1000).toFixed(2) +
			'm '+(100*totalLengthAfter/totalLengthBefore).toFixed(1) + '%'
		,meter:null});
}

Number.prototype.toFixedCompact = function(p) {
	var v = this.toFixed(p);
	if ((v % 1).toFixed(1) == '0.0')
		v = this.toFixed(0);
	return v;
}

function calcStartVector(c) {
	var p = new paper.Point(0,0);
	if (c.isLinear) {
		p.x = c.p2[0] - c.p1[0];
		p.y = c.p2[1] - c.p1[1];
	} else {
		p.x = c.h1[0] - c.p1[0];
		p.y = c.h1[1] - c.p1[1];
	}
	p = p.normalize(1);
	return p;
}

function calcEndVector(c) {
	var p = new paper.Point(0,0);
	if (c.isLinear) {
		p.x = c.p2[0] - c.p1[0];
		p.y = c.p2[1] - c.p1[1];
	} else {
		p.x = c.p2[0] - c.h2[0];
		p.y = c.p2[1] - c.h2[1];
	}
	p = p.normalize(1);
	return p;
}

function isBezierTravelRequired(p1, p2) {
	var startVec = new paper.Point(p1[2], p1[3]);
	var endVec = new paper.Point(p2[2], p2[3]);
	var travelVec = new paper.Point(p2[0] - p1[0], p2[1] - p1[1]);

	var someDist = p1[0] != p2[0] || p1[1] != p2[1];
	if ((startVec !== undefined) && (endVec !== undefined)) {
		// compare angle between vectors
		var ang = startVec.getAngle(endVec);
		var ang2 = startVec.getAngle(travelVec);
		//console.log(ang);
		if (ang !== NaN) {
			if (someDist && ang < 1) {
				return !(ang2 < 1);
			} else {
				return (ang >= parseFloat(masterVM.newVM.travelMoveMinAngle()));
			}
		} else {
			console.log('ang NaN', startVec, travelVec, endVec);
			return false;
		}

	} else {
		console.log('err:', p1,p2);
		return false;
	}

}

function newGenGCode_Output() {
	var lastSpeed = 0, lastPower = 0, lastZ = 0;

	function genG1(p, speed, z) {
		var s = 'G1X'+clamp(p[0], 0, machine.bedW).toFixedCompact(1)+
			'Y'+clamp(p[1], 0, machine.bedD).toFixedCompact(1);
		if (z && z != lastZ) {
			s += 'Z'+clamp(z, 0, machine.bedH).toFixedCompact(1);
			lastZ = z;
		}
		if (speed != lastSpeed) {
			s += 'F'+clamp(speed*60, 0, 18000).toFixed(0);
			lastSpeed = speed;
		}
		s += lfcr;
		return s;
	}

	function genG5(c) {
		var s = 'G5'+
			'I'+clamp(c.h1[0], 0, machine.bedW).toFixedCompact(1)+
			'J'+clamp(c.h1[1], 0, machine.bedD).toFixedCompact(1)+
			'K'+clamp(c.h2[0], 0, machine.bedW).toFixedCompact(1)+
			'L'+clamp(c.h2[1], 0, machine.bedD).toFixedCompact(1)+
			'X'+clamp(c.p2[0], 0, machine.bedW).toFixedCompact(1)+
			'Y'+clamp(c.p2[1], 0, machine.bedD).toFixedCompact(1);
		if (c.z !== undefined && c.z != lastZ) {
			s += 'Z'+clamp(c.z, 0, machine.bedH).toFixedCompact(1);
			lastZ = c.z;
		}
		if (c.speed != lastSpeed) {
			s += 'F'+clamp(c.speed*60, 0, 18000).toFixed(0);
			lastSpeed = c.speed;
		}
		s += lfcr;
		return s;
	}


	masterVM.newVM.progressLog.push({text:'Generating final GCode', meter:null});

	var oc = masterVM.newVM.orderedCurves;

	var bezLeadInOut = parseFloat(masterVM.newVM.travelMoveLeadInOut());

	var doWarmUp = $('#newWarmUpBurnCB').is(':checked');

	var errors = {
		cropped: 0
	};

	var gcode = '';

	// Filename
	gcode += '; '+masterVM.newVM.loadedFilename() + lfcr;

	// notes
	for (var i=0; i < masterVM.newVM.notes().length; i++) {
		gcode += '; '+ masterVM.newVM.notes()[i].note + lfcr;
	}

	gcode += ';'+lfcr;

	// material
	gcode += '; Material: '+masterVM.newVM.selectedMaterial().name() + lfcr;

	// Line Type summary
	var lts = masterVM.newVM.selectedMaterial().data.lineTypes;
	for (var i=0; i<lts.length; i++) {
		var lt = lts[i];
		gcode += ';   '+lt.type + lfcr;
		for (var j=0; j<lt.passes.length; j++) {
			var p = lt.passes[j];
			gcode += ';     '+p.power.toFixed(0)+'% Z'+p.z+' '+p.speed.toFixed(0)+'mm/sec' + lfcr;
		}
	}

	// line break
	gcode += ';' + lfcr;

	var minZ = 105;
	var curPos = [machine.bedW, machine.bedD, 0, 0];
	var travelSpeed = machine.travelSpeed;
	if (masterVM.newVM.selectedMaterial().travelSpeed)
		travelSpeed = masterVM.newVM.selectedMaterial().travelSpeed;

	gcode += 'G28 XY\r\n'+
				'G28 Z\r\n' +
				'M669\r\n';

	gcode += genG1(curPos, travelSpeed, minZ);

	if (oc.length > 0) {

		var z = oc[0].z[0];

		// first move to target z
		gcode += genG1(curPos, travelSpeed, z.z);

		// warm up burn - 3sec
		if (doWarmUp) {
			curPos[0] -= 30;
			gcode += '; Warm-up burn - 3sec\r\n';
			gcode += 'M4 S100\r\n'+
					 genG1(curPos, 30/3, z.z)+
					'M5\r\n';
		}
	}

	// for each pass (ordered set of curves)
	for (var i=0; i<oc.length; i++) {
		var o = oc[i];
		gcode += ';Pass:' + i + ', order:' + o.order + lfcr;

		// for each z level
		for (var j=0; j<o.z.length; j++) {
			var z = o.z[j];
			if (z.z < minZ) minZ = z.z;

			gcode += ';Z:'+z.z.toFixed(1) + lfcr;
			gcode += genG1(curPos, travelSpeed, z.z);

			// generate code for curves, inc travel moves
			for (var k=0; k < z.curves.length; k++) {
				var c = z.curves[k];

				//check curve is within bed boundary
				if (c.p1[0] < 0 || c.p1[0] > machine.bedW || c.p1[1] < 0 || c.p1[1] > machine.bedD ||
					c.p2[0] < 0 || c.p2[0] > machine.bedW || c.p2[1] < 0 || c.p2[1] > machine.bedD ) {
					errors.cropped ++;
					continue;
				}

				var tc = constructTravelMove(curPos, c.p1, c.speed);
				if (tc.doTravel) {
					gcode += genM5();
					lastPower = 0;

					if (tc.isLinear) {
						gcode += genG1(c.p1, travelSpeed);
					} else {
						tc.speed = travelSpeed;
						gcode += genG5(tc);
					}
					curPos = c.p1;
				}

				// start cutting
				if (c.power != lastPower) {
					lastPower = c.power;
					gcode += genM4(c.power);
				}

				// modify curve.speed based on anisotropy (already powerMapped at this point!)
				if (c.a == true) {
					// calc approx linear vector for curve
					var v = [ c.p2[0] - c.p1[0],  c.p2[1] - c.p1[1] ];
					var vMag = p2pdist(c.p1, c.p2);
					if (vMag > 0) {
						v[0] = v[0] / vMag;
						v[1] = v[1] / vMag;

						// modify anisotropic component
						if (c.aAxis == 'Y') v[1] = v[1] * c.aPower
						else v[0] = v[0] * c.aPower;

						// calc length of new vector
						vMag = p2pdist([0,0], v);

						// modify curve speed
						c.speed = c.speed * vMag;

					}
				}

				// gen curve
				if (c.isLinear) {
					gcode += genG1(c.p2, c.speed);
				} else {
					gcode += genG5(c);
				}

				curPos = c.p2;
			}

			gcode += genM5();
			lastPower = 0;
		}
	}

	gcode += ';End of passes'+lfcr;

	// move bed down to minZ-5, move head to near homing point
	gcode += 'G1 Z'+clamp(minZ - 5, 0, 120).toFixed(1) + ' F10000\r\n';
	gcode += 'G1 X'+machine.bedW.toFixed(0)+' Y'+machine.bedD.toFixed(0)+'\r\n';

	// disarm laser, move to near homing point, home
	gcode += 'M670\r\n' +
			'G28 XY\r\n'+
			'G28 Z\r\n';

	gcode += ';@say "your laser job '+masterVM.newVM.loadedFilename().slice(0,-4)+' is complete"\r\n';


	if (errors.cropped > 0) {
		notify(errors.cropped + ' curve segments cropped by bed boundary','error');
	}

	if (gcode != '') {
		// add gcode to editor
		editor.setValue(gcode, -1);

		simLoadedFilename = masterVM.newVM.loadedFilename().slice(0,-4) + '.gcode';


		// trigger simAll
		$('#simBut').click();

		// switch to playback tab
		$('#tabSimLink').click();
	}
}


function newGenGCode() {

	var doFullOp = $('#newGenFullOpCB').is(':checked');

	masterVM.newVM.progressLog([]);

	$('#newProgressContainer').fadeIn();

	try {

		masterVM.newVM.origin[0] = parseFloat(masterVM.newVM.originX());
		masterVM.newVM.origin[1] = parseFloat(masterVM.newVM.originY());

		masterVM.newVM.bezLeadInOut = parseFloat(masterVM.newVM.travelMoveLeadInOut());

		var startTime = new Date();

		var count = 0;
		newState.state = 0;
		newState.kOptCount = 0;
		newState.kOptFinished = false;
		Queue([
			function (q) {
				setTimeout(function() {
					newGenGCode_SplitCurves();

					newState.state = 1;
				},50);
				q.next();
			},
			function(q) {
				q.wait(newState.state == 1);
			},
			function (q) {
				setTimeout(function() {
					newGenGCode_SepPasses();
					newState.state = 2;
				},50);
				q.next();
			},
			function(q) {
				q.wait(newState.state == 2);
			},
			function (q) {
				setTimeout(function() {
					newGenGCode_Optimise();
					newState.state = 3;
				},50);
				q.next();
			},
			function(q) {
				q.wait(newState.state == 3);
			},
			function(q) {
				newState.kOptProgress = {text:ko.observable(''), meter:null};
				masterVM.newVM.progressLog.push(newState.kOptProgress);
				q.next();
			},
			function (q) {
				if (!newState.kOpt && doFullOp) {
					newGenGCode_KOpt();
				}
				q.wait(newState.kOptFinished || (newState.kOptCount > 50) || !doFullOp);
			},
			function (q) {
				setTimeout(function() {
					newGenGCode_Output();
					newState.state = 5;
				},50);
				q.next();
			},
			function(q) {
				q.wait(newState.state == 5);
			},
			function (q) {
				var endTime = new Date();
				masterVM.newVM.progressLog.push({text:'Done, '+timeToStr((endTime - startTime)/1000), meter:null});

				// if it took a while
				if ((endTime - startTime)/1000 > 10) {
					var snd = new Audio("sounds/ding.wav"); // buffers automatically when created
					snd.play();
				}

				$('#newProgressSpinner').fadeOut();
				$('#newGenBut').removeClass('disabled');

				q.next();
			}
		]);


	} catch(e) {
		notify('Exception: '+e.message,'error');
	}
}


function newInit() {

    // init paper - hidden canvas
    var canvas = document.getElementById('newCanvas');
    paper.setup(canvas);

    paper.view.on('resize', function(event) {
        paper.view.draw();
    });


    // detect tab coming into view
    $('#tab-new').on('shown', function (e) {
        // treat as resize!
        var cParent = $('#newCanvas').parent();
        paper.view.viewSize = new paper.Size(cParent.innerWidth()-30, 400);
        //paper.view.center = new paper.Point(machine.bedW/2, machine.bedD/2);
    });


	$('#newResetBut').click(function() {

		$('#newSVGFile').val('');

		// clear paper
		paper.project.activeLayer.removeChildren();

		$('#newOtherSections').fadeOut('fast');
		$('#newInfoSection').fadeOut('fast');
		$('#newMaterialSection').fadeOut('fast');

		$('#newProgressContainer').slideUp();

		masterVM.newVM.progressLog([]);

		$('#newResetBut').slideUp();

		$('#newStartSection').slideDown();
	});


    // subscribe to material selection changes
    masterVM.newVM.selectedMaterial.subscribe(function(newValue) {
        // update line types
        var alt = [{type:'ignore', color:undefined}];

        if (newValue != undefined && newValue.data.lineTypes != undefined) {
            for (var i=0; i < newValue.data.lineTypes.length; i++) {
                alt.push(newValue.data.lineTypes[i]);
            }
        }

        masterVM.newVM.availableLineTypes(alt);

        // match lineTypes
		// check each lineType for a potential match to the availableLineTypes
		for (var i=0; i<masterVM.newVM.lineTypes().length; i++) {
			var lt = masterVM.newVM.lineTypes()[i];

            // set to ignore by default
            lt.selectedType(alt[0]);

			if (lt.color != undefined) {
				for (var j=0; j < alt.length; j++) {
                    if (lt.color === alt[j].color) {
                    	lt.selectedType(alt[j]);
						break;
					}
				}
			}
		}


        // update origin
        if (newValue != undefined && newValue.data.origin != undefined) {
            masterVM.newVM.originX(newValue.data.origin[0]);
            masterVM.newVM.originY(newValue.data.origin[1]);
        }

		// progressive disclosure
		if (newValue != null)
			$('#newOtherSections').fadeIn('fast');
    });


    $('#newSVGFile').on("change", function(e) {

		// reset material selection
		masterVM.newVM.selectedMaterial(null);

		// progressive disclosure reset
		$('#newStartSection').slideUp();
		$('#newOtherSections').hide();
		$('#newInfoSection').hide();
		$('#newMaterialSection').hide();
		$('#newResetBut').removeClass('disabled').slideDown();

		var matName = '';

        var fileUploader = this;
        var files = event.target.files;
        if (files.length > 0) {
            var file = files[0];
            if (file.type.match('svg')) {
                masterVM.newVM.loadedFilename(file.name);

                paper.project.activeLayer.position = new paper.Point(0,0);
                paper.project.activeLayer.removeChildren();

                //var b = new paper.Path.Rectangle(0,0,machine.bedW, machine.bedD);
                //b.strokeColor = new paper.Color(1,0,0,0.5);
                //paper.project.activeLayer.addChild(b);

                paper.project.importSVG(file, {expandShapes:true, onLoad:function(item) {
                    var loadedItem = item;

					// hide text objects
					doThisToObjects(loadedItem, 'PointText', function(p) {
						p.visible = false;
					});

					// Determine bounds, ignoring text objects
                    var bounds = [item.bounds.right - item.bounds.left, item.bounds.bottom - item.bounds.top];
					masterVM.newVM.width(bounds[0]);
					masterVM.newVM.height(bounds[1]);

					// do bounds exceed bed area?
					if (bounds[0] > machine.bedW || bounds[1] > machine.bedD) {
						notify('Warning: Bounds exceed bed dimensions','error');
					}

					// position at bottom left of view
					item.transformContent = true;
					var posDelta = new paper.Point(item.bounds.left, item.bounds.bottom - machine.bedD);
					item.position = item.position.subtract(posDelta);


                    // parse text objects, look for notes and a material type
                    var textObjects = [];
					var notes = [];
                    doThisToObjects(loadedItem, 'PointText', function(p) {
                        var c = '';
                        if (p.strokeColor != undefined) {
                            c = p.strokeColor.toCSS(true);
                        } else {
                            c = p.fillColor.toCSS(true);
                        }
						c = c.toUpperCase();

                        var obj;
                        try {
                            obj = JSON.parse(p.content.replace(/[\u201C\u201D]/g, '"'));
                        } catch(err) {
                            notify('Error translating embedded text as JSON: '+p.content, 'error');
                        }

                        if (obj) {
							// position in machine coord frame
							obj.position = [ p.point.x, item.bounds.bottom - p.point.y ];
							obj.asString = JSON.stringify(obj, null, '\t');

							// see if there's a material definition
							if (obj.material != undefined) {
								matName = obj.material;
							}

							textObjects.push(obj);

							if (obj.note != undefined)
								notes.push(obj);
                        }
                    });
					masterVM.newVM.textObjects(textObjects);
					masterVM.newVM.notes(notes);


                    // parse out stroke and fill colours, update lineTypes, match if possible
                    var lt = [];
                    doThisToPaths(loadedItem,  function(p) {
                        var c = "";
                		if (p.strokeColor != undefined) {
                			c = p.strokeColor.toCSS(true);
                		} else {
                			c = p.fillColor.toCSS(true);
                		}
                        c = c.toUpperCase();

                        // see if this is a new colour
                        var res = $.grep(lt, function(e){ return e.color == c; });
                        if (res.length == 0) {
							res.push({color:c, selectedType: ko.observable(), srcPaths: []})
                            lt.push(res[0]);
                        }

						// add path to lt
						res[0].srcPaths.push(p);
        			});

                    masterVM.newVM.lineTypes(lt);


					// look for material match
					if (matName != '') {
						for (var i=0; i < masterVM.materialsVM.materials().length; i++) {
							if (masterVM.materialsVM.materials()[i].name() == matName) {
								masterVM.newVM.selectedMaterial(masterVM.materialsVM.materials()[i]);

								// reveal lintTypes
								$('#newOtherSections').fadeIn('fast');
								break;
							}
						}
					}

					// Progressive disclosure
					$('#newInfoSection').fadeIn('fast');
					$('#newMaterialSection').fadeIn('fast');

                    paper.view.zoom = 1;

                    // scale to imported drawing
                    //var w1  = machine.bedW;
                    //var h1 = machine.bedD;
                    var aspect = bounds[0] / bounds[1];
                    var vw = paper.view.size.width;
                    var vh = paper.view.size.height;
                    var va = vw/vh;

                    var scale = 1;

                    if (aspect > va) {
                        scale = vw / bounds[0];
                    } else {
                        scale = vh / bounds[1];
                    }


                    paper.view.zoom = scale * 0.9;
                    paper.view.center = new paper.Point(bounds[0]/2, machine.bedD - bounds[1]/2);

                    item.fillColor = new paper.Color(0,0,0,0);
                    item.strokeWidth = 1;

                    paper.view.draw();

                }});
            }
        }
    });



	$('#newGenBut').click(function() {
		$('#newGenBut').addClass('disabled');

		$('#newProgressContainer').show();
		$('#newProgressSpinner').fadeIn();

		setTimeout(newGenGCode, 50);
	});


}
