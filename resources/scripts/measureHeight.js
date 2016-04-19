<!DOCTYPE html>
<html>
	<head>
		<title>Page Title</title>
		<script>
			function measureHeight(aFont, aSize, aChars, aOptions={}) {
				// if you do pass aOptions.ctx, keep in mind that the ctx properties will be changed and not set back. so you should have a devoted canvas for this
				// if you dont pass in a width to aOptions, it will return it to you in the return object
				// the returned width is Math.ceil'ed
				console.error('aChars: "' + aChars + '"');
				var defaultOptions = {
					width: undefined, // if you specify a width then i wont have to use measureText to get the width
					canAndCtx: undefined, // set it to object {can:,ctx:} // if not provided, i will make one
					range: 3
				};
				
				aOptions.range = aOptions.range || 3; // multiples the aSize by this much
				
				if (aChars === '') {
					// no characters, so obviously everything is 0
					return {
						relativeBot: 0,
						relativeTop: 0,
						height: 0,
						width: 0
					};
					// otherwise i will get IndexSizeError: Index or size is negative or greater than the allowed amount error somewhere below
				}
				
				// validateOptionsObj(aOptions, defaultOptions); // not needed because all defaults are undefined
				
				var can;
				var ctx; 
				if (!aOptions.canAndCtx) {
					can = document.createElement('canvas');;
					can.mozOpaque = 'true'; // improved performanceo on firefox i guess
					ctx = can.getContext('2d');
					
					// can.style.position = 'absolute';
					// can.style.zIndex = 10000;
					// can.style.left = 0;
					// can.style.top = 0;
					// document.body.appendChild(can);
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
				can.height = aSize * aOptions.range;
				
				ctx.font = aFont; // need to set the .font again, because after changing width/height it makes it forget for some reason
				ctx.textBaseline = 'alphabetic';
				ctx.textAlign = 'left';	
				
				ctx.fillStyle = 'white';
				
				console.log('w:', w);
				
				var avgOfRange = (aOptions.range + 1) / 2;
				var yBaseline = Math.ceil(aSize * avgOfRange);
				console.log('yBaseline:', yBaseline);
				
				ctx.fillText(aChars, 0, yBaseline);
				
				var yEnd = aSize * aOptions.range;
				
				var data = ctx.getImageData(0, 0, w, yEnd).data;
				// console.log('data:', data)
				
				var botBound = -1;
				var topBound = -1;
				
				// measureHeightY:
				for (y=0; y<=yEnd; y++) {
					for (var x = 0; x < w; x += 1) {
						var n = 4 * (w * y + x);
						var r = data[n];
						var g = data[n + 1];
						var b = data[n + 2];
						// var a = data[n + 3];
						
						if (r+g+b > 0) { // non black px found
							if (topBound == -1) { 
								topBound = y;
							}
							botBound = y; // break measureHeightY; // dont break measureHeightY ever, keep going, we till yEnd. so we get proper height for strings like "`." or ":" or "!"
							break;
						}
					}
				}
				
				return {
					relativeBot: botBound - yBaseline, // relative to baseline of 0 // bottom most row having non-black
					relativeTop: topBound - yBaseline, // relative to baseline of 0 // top most row having non-black
					height: botBound - topBound,
					width: w
				};
			}
		</script>
	</head>
	<body style="background-color:steelblue;">
		<input type="button" value="reuse can" onClick="console.log(measureHeight('40px serif', 40, 'rg', {canAndCtx:{can:document.getElementById('can'), ctx:document.getElementById('can').getContext('2d')}}))">
		<input type="button" value="dont reuse can" onClick="console.log(measureHeight('40px serif', 40, 'rg'))">
		<canvas id="can"></canvas>
		<br>
	</body>
</html>
