<!DOCTYPE html>
<html>
<head>
<title>Page Title</title>
<script>
function measureHeight(aFont, aSize, aChars, aOptions={}) {
	// if you do pass aOptions.ctx, keep in mind that the ctx properties will be changed and not set back. so you should have a devoted canvas for this
	var defaultOptions = {
		width: undefined, // if you specify a width then i wont have to use measureText to get the width
		canAndCtx: undefined // set it to object {can:,ctx:} // if not provided, i will make one
	};
	
	
	// validateOptionsObj(aOptions, defaultOptions); // not needed because all defaults are undefined
	
	// assuming for now that getImageData works on a canvas of height and width 0
	var can;
	var ctx; 
	if (!aOptions.canAndCtx) {
		can = document.createElement('canvas');;
		can.mozOpaque = 'true';
		ctx = can.getContext('2d');
		
		// can.style.position = 'absolute';
		// can.style.zIndex = 10000;
		// can.style.left = 0;
		// can.style.top = 0;
		document.body.appendChild(can);
	} else {
		can = aOptions.canAndCtx.can;
		ctx = aOptions.canAndCtx.ctx;
	}
	
		
	var w = aOptions.width;
	if (!w) {
		ctx.textBaseline = 'alphabetic';
		ctx.textAlign = 'left';	
		ctx.font = aFont;
		w = ctx.measureText(aChars).width;
	}
	
	w = Math.ceil(w); // needed as i use w in the calc for the loop, it needs to be a whole number
	
	// must set width/height, as it wont paint outside of the bounds
	can.width = w;
	can.height = aSize * 3;
	
	ctx.font = aFont; // need to set the .font again, because after changing width/height it makes it forget for some reason
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';	
	
	ctx.fillStyle = 'white';
	
	console.log('w:', w);
	
	var yBaseline = aSize*2;
	ctx.fillText(aChars, 0, yBaseline);
	
	var data = ctx.getImageData(0, 0, w, aSize*3).data;
	console.log('data:', data);

	var botBound = -1; // start at baseline, and then go below to see if anything is there
	var topBound = -1;
	var firstRow = -1;
	var lastRow = -1;
	
	var y = yBaseline + 1;
	console.log('yBaseline:', yBaseline);
	
	var firstRowWithNonBlackFound = false;
	var yFirstRowNonBlack;
	// find top most row with no white. starting at the baseline
	measureHeightY:
	while (true) {
		y--;
		if (y < 0) {
			console.log('breaking due to no find 1');
			break;
		}
		// console.log('checking row:', y);
		for (var x = 0; x < w; x += 1) {
			var n = 4 * (w * y + x);
			var r = data[n];
			var g = data[n + 1];
			var b = data[n + 2];
			// var a = data[n + 3];
			
			// console.log('r+g+b:', r);
			// console.log('y:', y);
			
			if (r+g+b > 0) { // non black px found
				if (!firstRowWithNonBlackFound) {
					firstRowWithNonBlackFound = true;
					yFirstRowNonBlack = y;
					console.log('ok first search: non-black on row:', y);
				}
				break;
			}
			if (firstRowWithNonBlackFound) {
				if (r === 0 && x == w - 1) {
					topBound = y + 1;
					break measureHeightY;
				}
			}
		}
	}
	
	if (!firstRowWithNonBlackFound) {
		throw new Error('could not find a row with non-black, this should never happen');
	}
	
	var y = yFirstRowNonBlack - 1; // because i know yFirstRowNonBlack has black for sure, due to search block above, the first iteration will find non-black
	console.log('starting next search on y:', y);
	
	firstRowWithNonBlackFound = false;
	// find the bottom most row with no white, starting at the baseline
	measureHeightY:
	while (true) {
		y++
		if (y > aSize * 3) {
			console.log('breaking due to no find 2');
			break;
		}
		// console.log('checking row:', y);
		for (var x = 0; x < w; x += 1) {
			var n = 4 * (w * y + x);
			var r = data[n];
			var g = data[n + 1];
			var b = data[n + 2];
			// var a = data[n + 3];
			
			if (r+g+b > 0) { // non black px found on this y/row
				if (!firstRowWithNonBlackFound) {
					firstRowWithNonBlackFound = true;
					console.log('ok second search: non-black on row:', y);
				}
				break; // go to next row
			}
			if (firstRowWithNonBlackFound) {
				if (r === 0 && x == w - 1) { // ok no non-blacks on this row
					botBound = y-1;
					break measureHeightY;
				}
			}
		}
	}
	
	// by bot i mean "bottom of bounding square" and by top i mean "top of bounding square" per the image here - http://www.whatwg.org/specs/web-apps/current-work/images/baselines.png - from - https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_text
	return {
		nonRelBot: botBound, // bottom most row having non-black
		nonRelTop: topBound, // top most row having non-black
		nonRelBaseline: yBaseline,
		
		relativeBot: botBound - yBaseline, // relative to baseline of 0 // bottom most row having non-black
		relativeTop: topBound - yBaseline, // relative to baseline of 0 // top most row having non-black
		height: botBound - topBound
	};
}
</script>
</head>
<body style="background-color:steelblue;">
<canvas id="can"></canvas>
<h1>This is a Heading</h1>
<p>This is a paragraph.</p>
<input type="button" value="reuse can" onClick="console.log(measureHeight('40px serif', 40, 'rg', {canAndCtx:{can:document.getElementById('can'), ctx:document.getElementById('can').getContext('2d')}}))">
<input type="button" value="dont reuse can" onClick="console.log(measureHeight('40px serif', 40, 'rg'))">
</body>
</html>
