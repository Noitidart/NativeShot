Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://gre/modules/Geometry.jsm');

var core = {
	addon: {
		name: 'NativeShot',
		id: 'NativeShot@jetpack',
		path: {
			scripts: 'chrome://nativeshot/content/resources/scripts/',
			styles: 'chrome://nativeshot/content/resources/styles/'
		},
		cache_key: Math.random()
	}
};

var gEditorStore = {};
var gCState = {};
var gColorPickerSetState = {NativeShotEditor:null};

function init(aArrBufAndCore) {
	// console.log('in screenshotXfer, aArrBufAndCore:', aArrBufAndCore);
	
	core = aArrBufAndCore.core;
	
	var palLayout = [ // the tools and order they should show in
		{
			// Handle - from where user can drag palette around
			label: undefined, // for non-special, this is the text cloud that shows on hover
			sub: undefined, // for non-special, this is the submenu items shown on hover. an array of objects
			icon: undefined, // for non-special, the icon that
			special: 'Handle', // this key is for special things that have their own React class
			props: ['mPalHandleMousedown'], // props needed from the react component
			multiDepress: false, // meaning if this is clicked, then no other tool should be held. if true, then this can be depressed while others are depressed
			justClick: false, // if true, then this is just clicked. not depressable
		},
		{
			// Accessibility - from where user increase/decrease size of palette
			special: 'Accessibility',
			props: ['sCanHandleSize', 'sPalSize']
		},
		{
			special: 'Divider'
		},
		// selection tools
		{
			label: 'Select',
			icon: '\ue82c' // the fontello font code
		},
		{
			label: 'Fullscreen', // by default it selects the current monitor
			icon: '\ue80e',
			hotkey: 'F', // hotkey does the currently set sub, in this case its fixed to current monitor (i should test which window the mouse is over)
			// alt+F for all monitors
			justClick: true,
			sub: [
				{
					special: 'Monitors' // allow single monitor selecting or multiple
				}
			]
		},
		{
			label: 'Window Wand',
			icon: '\ue826'
		},
		{
			label: 'Last Selection',
			icon: '\ue82e',
			justClick: true,
			sub: [
				{
					special: 'SelectionHistory'
				}
			]
		},
		{
			label: 'Clear Selection',
			justClick: true,
			icon: '\ue82f'
		},
		{
			special: 'Divider'
		},
		// misc tools
		{
			label: 'Toggle Cursor',
			icon: '\ue822',
			multiDepress: true
		},
		{
			label: 'Zoom View',
			icon: '\ue811',
			multiDepress: true,
			/* sub: [ // i decided i will put this ZoomViewLevel into the widget itself
				{
					special: 'ZoomViewLevel'
				}
			]
			*/
		},
		{
			special: 'Divider'
		},
		// draw tools
		{
			label: 'Freedraw',
			icon: '\ue830',
			sub: [
				{
					label: 'Pencil',
					icon: '\ue800'
				},
				{
					label: 'Highlighter', // this just its own remembered color and transparency - otherwise its a copy of pencil - im thinking cap the opacity at 10% - 90%
					icon: 'S'
				}
			]
		},
		{
			label: 'Shapes',
			icon: '\ue834',
			sub: [
				{
					label: 'Rectangle',
					icon: '\ue81d'
				},
				// { // discontinued this, as i plan to offer a border radius option for when Rectangle is selected
				// 	label: 'Rounded Rectangle',
				// 	icon: '\ue803'
				// },
				{
					label: 'Oval',
					icon: '\ue81f'
				}
			]
		},
		{
			label: 'Line',
			icon: '\ue831',
			options: ['Arrow']
		},
		{
			label: 'Text',
			icon: 'S',
			sub: [
				{
					label: 'Free',
					icon: 'S'
				},
				{
					label: 'Container',
					icon: 'S',
					options: ['Word Break / Ellipsis']
				}
			]
		},
		{
			label: 'Blur',
			icon: '\ue808',
			sub: [
				{
					label: 'Gaussian',
					icon: '\ue816'
				},
				{
					label: 'Mosaic',
					icon: '\ue81b',
					options: ['Word Break / Ellipsis']
				}
			]
		},
		{
			special: 'Divider'
		},
		// options
		{
			label: 'Color',
			icon: 'S',
			justClick: true,
			sub: [
				{
					special: 'ColorPicker',
					props: {sColor:'sPalLineColor', sAlpha:'sPalLineAlpha', pSetStateName:'$string$NativeShotEditor', pStateAlphaKey:'$string$sPalLineAlpha', pStateColorKey:'$string$sPalLineColor'}
				}
			]
		},
		{
			label: 'Line Width',
			icon: 'S',
			justClick: true,
			sub: [
				{
					special: 'LineWidthPicker'
				}
			]
		},
		{
			label: 'Fill Color',
			icon: 'S',
			justClick: true,
			sub: [
				{
					special: 'ColorPicker',
					props: {sColor:'sPalFillColor', sAlpha:'sPalFillAlpha', pSetStateName:'$string$NativeShotEditor', pStateAlphaKey:'$string$sPalFillAlpha', pStateColorKey:'$string$sPalFillColor'}
				}
			]
		},
		{
			special: 'Width',
			justClick: true
		},
		{
			special: 'Height',
			justClick: true
		},
		{
			special: 'TextTools',
			justClick: true
		},
		{
			special: 'Divider'
		},
		// actions
		{
			label: 'Save',
			icon: '\ue804',
			justClick: true,
			sub: [
				{
					label: 'Quick',
					icon: '\ue81e'
				},
				{
					label: 'Browse',
					icon: '\ue825'
				}
			]
		},
		{
			label: 'Print',
			justClick: true,
			icon: '\ue805'
		},
		{
			label: 'Copy',
			justClick: true,
			icon: '\ue80d'
		},
		{
			label: 'Upload to Cloud',
			justClick: true,
			icon: '\ue833',
			sub: [
				{
					label: 'Imgur Anonymous',
					icon: '\ue829'
				},
				{
					label: 'Imgur',
					icon: '\ue828'
				},
				{
					label: 'Dropbox',
					icon: '\ue809'
				},
				{
					label: 'Google Drive',
					icon: '\ue827'
				}
			]
		},
		{
			label: 'Share to Social Media',
			justClick: true,
			icon: 'S',
			sub: [
				{
					label: 'Twitter',
					icon: '\ue802'
				},
				{
					label: 'Facebook',
					icon: '\ue801'
				}
			]
		},
		{
			label: 'Similar Image Search',
			justClick: true,
			icon: '\ue821',
			sub: [
				{
					label: 'Tineye',
					icon: 'S'
				},
				{
					label: 'Google',
					icon: '\ue810'
				},
				{
					label: 'Bing',
					icon: 'S'
				}
			]
		},
		{
			label: 'Text Recognition',
			justClick: true,
			icon: 'S',
			sub: [
				{
					label: 'Tesseract',
					icon: 'S'
				},
				{
					label: 'GOCR',
					icon: 'S'
				},
				{
					label: 'OCRAD',
					icon: 'S'
				}
			]
		},
		{
			special: 'Divider'
		},
		{
			label: 'Undo',
			justClick: true,
			icon: '\ue80b',
			sub: [
				{
					label: 'Undo All',
					icon: '\ue80c',
					unfixable: true // never allow this to get fixed
				},
				{
					special: 'UndoHistory'
				}
			]
		},
		{
			label: 'Redo',
			justClick: true,
			icon: '\ue80a',
			sub: [
				{
					label: 'Redo All',
					icon: 'S',
					unfixable: true // never allow this to get fixed
				},
				{
					special: 'RedoHistory'
				}
			]
		},
		{
			special: 'Divider'
		},
		{
			label: 'Close',
			justClick: true,
			icon: '\ue82f',
			hotkey: 'Esc'
		}
	];
	
	
	var Editor = React.createClass({
		displayName: 'Editor',
		getInitialState: function() {
			return {
				// general
				sMounted: false,
				
				// canvas realted
				sCanHandleSize: this.props.pCanHandleSize,
				sCanMouseMoveCursor: null,
				
				// palette related
				sPalSize: this.props.pPalSize,
				sPalTool: 'Select', // the label of the currently active tool
				sPalToolSubs: this.props.pPalToolSubs, // object holding the active sub for each tool label. so key is tool label. value is label of selected sab
				sPalMultiDepresses: this.props.pPalMultiDepresses,
				sPalX: 5, // :todo: get this from prefs
				sPalY: 75, // :todo: get this from prefs
				sPalDragStart: null, // is null when not dragging. when dragging it is {screenX:, screenY:}
				
				sPalLineColor: this.props.pPalLineColor,
				sPalLineAlpha: this.props.pPalLineAlpha,
				sPalFillColor: this.props.pPalFillColor,
				sPalFillAlpha: this.props.pPalFillAlpha
			};
		},
		componentDidMount: function() {
			gEditorStore.setState = this.setState.bind(this); // need bind here otherwise it doesnt work - last tested in React 0.14.x
			gColorPickerSetState.NativeShotEditor = this.setState.bind(this);
			this.setState({
				sMounted: true
			});
		},
		mPalHandleMousedown: function(e) {
			gEditorStore.setState({
				sPalDragStart: {screenX:e.screenX, screenY:e.screenY, sPalX:this.state.sPalX, sPalY:this.state.sPalY}
			});
		},
		////// start - canvas functions
		Drawable: function(x, y, w, h, name, aOptions={}) {

			switch (name) {
				case 'dim':
					
						this.x = 0;
						this.y = 0;
						this.w = gQS.w;
						this.h = gQS.h;
					
					break;
				default:
					this.x = x;
					this.y = y;
					this.w = w;
					this.h = h;
			}
			this.name = name;
			
			// set other props
			
			switch (name) {
				case 'Rectangle':
				case 'Oval':
					
						console.error('gCState:', gCState);
						this.Style = {
							Draw: {
								me: {
									fillStyle: aOptions.fillStyle || colorStrToRGBA(gCState.rconn.state.sPalFillColor, gCState.rconn.state.sPalFillAlpha), //gCState.Style.Draw.fill.fillStyle,
									strokeStyle: aOptions.strokeStyle || colorStrToRGBA(gCState.rconn.state.sPalLineColor, gCState.rconn.state.sPalLineAlpha), // gCState.Style.Draw.line.strokeStyle,
									setLineDash: aOptions.setLineDash || gCState.Style.Draw.line.setLineDash,
									lineWidth: aOptions.lineWidth || gCState.Style.Draw.line.lineWidth,
								}
							}
						}
					
					break;
				default:
					this.x = x;
					this.y = y;
					this.w = w;
					this.h = h;
			}
			
			this.draw = function(ctx) {
				// returns the valid value
				
				if (this.name != 'dim' && !this.w && !this.h) {
					return true;
				}
				
				// set styles
				var curStyle;
				switch (this.name) {
					case 'dim':
						
							curStyle = gCState.Style.Draw.dim;
						
						break;
					case 'Rectangle':
					case 'Oval':
					
							curStyle = this.Style.Draw.me;
					
						break;
					default:
						// not drawable
						return true; // so valid is no need to update to false
				}
				
				// got here so curStyle exists meaning it does get drawn - yeah i know the whole "Drawable" is misleading, some "Drawable's" are not drawn
				gCState.rconn.applyCtxStyle(curStyle);				
				
				// draw it
				switch (this.name) {
					case 'dim':

							var cutouts = gCState.drawables.filter(function(aToFilter) { return aToFilter.name == 'cutout' });
							if (!cutouts.length) {
								ctx.fillRect(0, 0, gQS.w, gQS.h);
							} else {
								
								/*
								// build cutoutsUnionRect
								var cutoutsUnionRect;
								for (var i=0; i<cutouts.length; i++) {
									var cutoutClone = gCState.rconn.makeDimsPositive(cutouts[i], true);
									var unionRect = new Rect(cutoutClone.x, cutoutClone.y, cutoutClone.w, cutoutClone.h);
									if (!i) {
										cutoutsUnionRect = unionRect;
									} else {
										cutoutsUnionRect = cutoutsUnionRect.union(unionRect);
									}
								}
								
								var fullscreenRect = new Rect(0, 0, gQS.w, gQS.h);
								
								var dimRects = fullscreenRect.subtract(cutoutsUnionRect);
								
								for (var i=0; i<dimRects.length; i++) {
									ctx.fillRect(dimRects[i].x, dimRects[i].y, dimRects[i].width, dimRects[i].height);
								}
								*/
								
								var fullscreenRect = new Rect(0, 0, gQS.w, gQS.h);
								var cutoutsAsRects = [];
								cutouts.forEach(function(cutout) {
									var cutoutClone = gCState.rconn.makeDimsPositive(cutout, true);
									cutoutsAsRects.push(new Rect(cutoutClone.x, cutoutClone.y, cutoutClone.w, cutoutClone.h));
								});
								var dimRects = subtractMulti(fullscreenRect, cutoutsAsRects);
								for (var i=0; i<dimRects.length; i++) {
									ctx.fillRect(dimRects[i].x, dimRects[i].y, dimRects[i].width, dimRects[i].height);
								}
							}
					
						break;
					case 'Rectangle':
					
							
							// var lw = this.Style.Draw.me.lineWidth;
							// var lw2 = lw * 2;
							// // ctx.rect(this.x, this.y, this.w, this.h);
							// // ctx.rect(this.x+lw, this.y+lw, this.w-lw2, this.h-lw2);  // offset position and size
							// // ctx.fill('evenodd');                      // !important
							// // ctx.strokeRect(this.x, this.y, this.w, this.h);
							// 
							// ctx.fillRect(this.x + lw, this.y + lw, this.w - lw2, this.h - lw2);
							// ctx.strokeRect(this.x + lw, this.y + lw, this.w - lw2, this.h - lw2);
							ctx.fillRect(this.x, this.y, this.w, this.h);
							ctx.strokeRect(this.x, this.y, this.w, this.h);
						
						break;
					case 'Oval':
						
							// per jsbin from here - http://stackoverflow.com/a/2173084/1828637
							
							var w = this.w;
							var h = this.h;
							var x = this.x;
							var y = this.y;
							
							var kappa = .5522848,
								ox = (w / 2) * kappa, // control point offset horizontal
								oy = (h / 2) * kappa, // control point offset vertical
								xe = x + w,           // x-end
								ye = y + h,           // y-end
								xm = x + w / 2,       // x-middle
								ym = y + h / 2;       // y-middle

							// ctx.save();
							ctx.beginPath();
							ctx.moveTo(x, ym);
							ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
							ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
							ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
							ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
							
							// ctx.quadraticCurveTo(x,y,xm,y);
							// ctx.quadraticCurveTo(xe,y,xe,ym);
							// ctx.quadraticCurveTo(xe,ye,xm,ye);
							// ctx.quadraticCurveTo(x,ye,x,ym);

							ctx.fill();
							ctx.stroke();
						
						break;
					default:
						// should never get here, as would have returned earlier, as this one is not drawable
				}
				
				return false;
			};
			
			this.select = function(ctx) {
				// returns the valid value
				
				if (this.name != 'dim' && !this.w && !this.h) {
					return true;
				}
				
				// set styles
				var curStyle;
				switch (this.name) {
					case 'cutout':
						
							curStyle = gCState.Style.Select.cutout;
						
						break;
					case 'Rectangle':
					case 'Oval':
					
							curStyle = gCState.Style.Select.shape;
					
						break;
					default:
						// not selectable
						return true; // so no need to invalidate
				}
				
				// got here so curStyle exists meaning it does get drawn - yeah i know the whole "Drawable" is misleading, some "Drawable's" are not drawn
				gCState.rconn.applyCtxStyle(curStyle);
				
				// draw the selection of it
				switch (this.name) {
					case 'dim':

							var cutouts = gCState.drawables.filter(function(aToFilter) { return aToFilter.name == 'cutout' });
							if (!cutouts.length) {
								// no selection
							} else {
								
								// build cutoutsUnionRect
								var cutoutsUnionRect;
								for (var i=0; i<cutouts.length; i++) {
									var cutoutClone = gCState.rconn.makeDimsPositive(cutouts[i], true);
									var unionRect = new Rect(cutoutClone.x, cutoutClone.y, cutoutClone.w, cutoutClone.h);
									if (!i) {
										cutoutsUnionRect = unionRect
									} else {
										cutoutsUnionRect.union(unionRect);
									}
								}
								
								var fullscreenRect = new Rect(0, 0, gQS.w, gQS.h);
								
								var dimRects = fullscreenRect.subtract(cutoutsUnionRect);
								
								for (var i=0; i<dimRects.length; i++) {
									ctx.strokeRect(dimRects[i].x, dimRects[i].y, dimRects[i].width, dimRects[i].height);
								}
							}
					
						break;
					case 'cutout':
					case 'Rectangle':
					case 'Oval':
					
							ctx.strokeRect(this.x, this.y, this.w, this.h);
						
						break;
					default:
						// should never get here, as would have returned earlier, as this one is not drawable
				}
				
				return false;
			};
			
			this.contains = function(mx, my) {
				switch (this.name) {
					case 'dim':
						
							return false; // i think i dont need this
						
						break;
					default:
						// All we have to do is make sure the Mouse X,Y fall in the area between
						// the shape's X and (X + Width) and its Y and (Y + Height)
						return(this.x <= mx) && (this.x + this.w >= mx) &&
							(this.y <= my) && (this.y + this.h >= my);
				}
			};
			
			// adds it to the drawables array, meaning it should get painted
			this.add = function() {
				// returns new valid value
				gCState.drawables.push(this);
				
				if (this.w && this.h) {
					// this.valid = false;
					return false;
				} else {
					// else the width and height are 0, no need to invalidate
					return true;
				}
			};
			
			// removes from the drawables array
			this.delete = function() {
				// returns new valid value
				
				var drawables = gCState.drawables;
				switch (this.name) {
					case 'dim':
						
							// not added to list
						
						break;
					default:
						drawables.splice(drawables.indexOf(this), 1);
				}
				
				if (this.w && this.h) {
					// this.valid = false;
					return false;
				} else {
					// else the width and height are 0, no need to invalidate
					return true;
				}
			};
			
			this.bringtofront = function() {
				// brings the Drawable to the front of the z-index
				var drawables = gCState.drawables;
				drawables.push(drawables.splice(drawables.indexOf(this), 1)[0]);
			};
		},
		deleteAll: function(aDrawableNamesArr) {
			// does .delete() for all that are found with the name
			var valid = true;
			var drawables = this.cstate.drawables;
			var l = drawables.length - 1;
			for (var i=l; i>-1; i--) {
				var drawable = drawables[i];
				if (aDrawableNamesArr) {
					if (aDrawableNamesArr.indexOf(drawable.name) > -1) {
						if (!drawable.delete()) {
							valid = false;
						}
						if (this.cstate.selection && this.cstate.selection == drawable) {
							this.cstate.selection = null;
						}
					}
				} else {
					if (!drawable.delete()) {
						valid = false;
					}
					if (this.cstate.selection && this.cstate.selection == drawable) {
						this.cstate.selection = null;
					}
				}
			}
			return valid;
		},
		makeDimsPositive: function(aDrawable, notByRef) {
			// aDrawObject is Shape, Cutout, 
				// it has x, y, w, h
			// if the w or h are negative, then it makes the w and h positive and adjusts the x y respectively
			if (notByRef) {
				aDrawable = {
					x: aDrawable.x,
					y: aDrawable.y,
					w: aDrawable.w,
					h: aDrawable.h,
				}
			}
			
			if (aDrawable.w < 0) {
				aDrawable.x += aDrawable.w;
				aDrawable.w *= -1;
			}

			if (aDrawable.h < 0) {
				aDrawable.y += aDrawable.h;
				aDrawable.h *= -1;
			}
			
			return aDrawable;
		},
		applyCtxStyle: function(aStyleObj) {
			// aStyleObj is an object with keys that are properties/methods of aCtx
			for (var p in aStyleObj) {
				if (p.indexOf('set') === 0) {
					// its a func
					this.ctx[p].call(this.ctx, aStyleObj[p]);
				} else {
					// else its an attribute
					this.ctx[p] = aStyleObj[p];
				}
			}			
		},
		mtmm: { // short for monToMultiMon
			x: function(aX) {
				return tQS.win81ScaleX ? Math.ceil(tQS.x + ((aX - tQS.x) * tQS.win81ScaleX)) : aX;
			},
			y: function(aY) {
				return tQS.win81ScaleY ? Math.ceil(tQS.y + ((aY - tQS.y) * tQS.win81ScaleY)) : aY
			},
			w: function(aW) {
				// width
				return tQS.win81ScaleX ? Math.ceil(aW * tQS.win81ScaleX) : aW;
			},
			h: function(aH) {
				// width
				return tQS.win81ScaleY ? Math.ceil(aH * tQS.win81ScaleY) : aH;
			}
		},
		getMouse: function(e) {
			var mx = this.mtmm.x(e.screenX);
			var my = this.mtmm.y(e.screenY);
			
			return {
				x: mx,
				y: my
			};
		},
		clear: function() {
			this.ctx.clearRect(0, 0, this.cstate.width, this.cstate.height);
		},
		draw: function() {
			if(!this.cstate.valid) {
				var ctx = this.ctx;
				this.clear();
				
				// draw all drawables
				var drawables = this.cstate.drawables;
				var l = drawables.length;
				for(var i = 0; i < l; i++) {
					var drawable = drawables[i];
					if (drawable.name == 'cutout') {
						// this is drawn as negative space with `this.dim.draw()`
						continue;
					}
					
					// We can skip the drawing of elements that have moved off the screen:
					if(drawable.x > this.cstate.width || drawable.y > this.cstate.height ||
						drawable.x + drawable.w < 0 || drawable.y + drawable.h < 0) continue;
					drawable.draw(ctx);
				}
				console.log('done drawing drawable');

				// draw selection
				if(this.cstate.selection != null) {
					console.log('ok this.cstate.selection:', this.cstate.selection);
					if (this.cstate.selection == this.dim || (this.cstate.selection.w && this.cstate.selection.h)) {
						console.log('ok selecting');
						this.cstate.selection.select(this.ctx);
					}
				}

				// ** Add stuff you want drawn on top all the time here **

				// draw the dim
				this.cstate.dim.draw(ctx);
				
				this.cstate.valid = true;
			}
		},
		mousemove: function(e) {
			var mouse = this.getMouse(e);
			var mx = mouse.x;
			var my = mouse.y;
			
			if (this.state.sPalDragStart) {
				gEditorStore.setState({
					sPalX: this.state.sPalDragStart.sPalX + (e.screenX - this.state.sPalDragStart.screenX),
					sPalY: this.state.sPalDragStart.sPalY + (e.screenY - this.state.sPalDragStart.screenY)
				});
				return;
			} else {
				var toolsub = this.state.sPalTool + '-' + (this.state.sPalToolSubs[this.state.sPalTool] || '');
				if (this.cstate.dragging) {
					this.cstate.selection.x = mx - this.cstate.dragoffx;
					this.cstate.selection.y = my - this.cstate.dragoffy;
					this.cstate.valid = false; // Something's dragging so we must redraw
				} else if (this.cstate.resizing) {
					this.cstate.selection.w = mx - this.cstate.downx;
					this.cstate.selection.h = my - this.cstate.downy;
					this.cstate.valid = false;
				} else {
					// just moving, see if mouse is over a resize point, or a drag point
					var dragFilterFunc;
					switch (toolsub) {
						case 'Select-':
						
								dragFilterFunc = function(aToFilter) { return aToFilter.name == 'cutout' };
							
							break;
						case 'Shapes-Rectangle':
						case 'Shapes-Oval':
							
								dragFilterFunc = function(aToFilter) { return ['Rectangle', 'Oval'].indexOf(aToFilter.name) > -1 };
							
							break;
						default:
							// do nothing
					}
					
					if (dragFilterFunc) {
						var draggableFound = false;
						var drawables = this.cstate.drawables.filter(dragFilterFunc);
						var l = drawables.length - 1;
						for (var i=l; i>-1; i--) {
							var drawable = drawables[i];
							if (drawable.contains(mx, my)) {
								draggableFound = true;
								break;
							}
						}
						if (draggableFound) {
							if (this.state.sCanMouseMoveCursor != 'move') {
								this.setState({
									sCanMouseMoveCursor: 'move'
								});
							}
						} else {
							if (this.state.sCanMouseMoveCursor) {
								this.setState({
									sCanMouseMoveCursor: null
								});
							}
						}
					}
				}
			}
			
		},
		mousedown: function(e) {
			var mouse = this.getMouse(e);
			var mx = mouse.x;
			var my = mouse.y;
			
			this.cstate.downx = mx;
			this.cstate.downy = my;
			
			if (e.target == this.refs.can) {
				var toolsub = this.state.sPalTool + '-' + (this.state.sPalToolSubs[this.state.sPalTool] || '');
				
				// if selectable, set a selectFilterFunc
				var selectFilterFunc;
				switch (toolsub) {
					case 'Select-':
					
							selectFilterFunc = function(aToFilter) { return aToFilter.name == 'cutout' };
						
						break;
					case 'Shapes-Rectangle':
					case 'Shapes-Oval':
						
							selectFilterFunc = function(aToFilter) { return ['Rectangle', 'Oval'].indexOf(aToFilter.name) > -1 };
						
						break;
					default:
						// do nothing
				}
				
				// if selectFilterFunc then lets test if should select or deselect
				if (selectFilterFunc) {
					var drawables = gCState.drawables.filter(selectFilterFunc);
					// console.log('iterating drawables:', drawables);
					var l = drawables.length;
					for(var i=l-1; i>=0; i--) {
						if(drawables[i].contains(mx, my)) {
							console.log('ok you clicked in this drawable:', drawables[i]);
							var mySel = drawables[i];
							
							mySel.bringtofront();
							
							// Keep track of where in the object we clicked
							// so we can move it smoothly (see mousemove)
							this.cstate.dragoffx = mx - mySel.x;
							this.cstate.dragoffy = my - mySel.y;
							this.cstate.dragging = true;
							this.cstate.selection = mySel;
							this.cstate.valid = false;
							return;
						}
					}
					
					if (this.cstate.selection) {
						this.cstate.selection = null;
						console.log('ok removing from selection this:', this);
						this.cstate.valid = false;
					}
				}
				
				// test if we should create a new Drawable and set it to resizing
				if (!this.cstate.selection) {
					switch (toolsub) {
						case 'Select-':
						
								if (!e.shiftKey) {
									// remove all previous cutouts
									gCState.rconn.deleteAll(['cutout']);
								}
								
								this.cstate.selection = new this.Drawable(mx, my, 0, 0, 'cutout');
							
							break;
						case 'Shapes-Rectangle':
						case 'Shapes-Oval':
							
								this.cstate.selection = new this.Drawable(mx, my, 0, 0, this.state.sPalToolSubs[this.state.sPalTool]);
							
							break;
						default:
							// do nothing
					}
					
					if (this.cstate.selection) {
						this.cstate.selection.add();
						this.cstate.resizing = true;
						return;
					}
				}
			}
		},
		mouseup: function(e) {
			var mouse = this.getMouse(e);
			var mx = mouse.x;
			var my = mouse.y;

			if (this.state.sPalDragStart) {
				gEditorStore.setState({
					sPalDragStart: null
				});
				return;
			} else {
				// if (e.target == this.refs.can) { // its canceling, so even if its not can go ahead and let it go through
					// var toolsub = this.state.sPalTool + '-' + (this.state.sPalToolSubs[this.state.sPalTool] || '');
					if (this.cstate.dragging) {
						this.cstate.dragging = false;
					} else if (this.cstate.resizing) {
						this.cstate.resizing = false;
						if (!this.cstate.selection.w || !this.cstate.selection.h) {
							// 0 size
							this.cstate.selection.delete();
							this.cstate.selection = null;
						} else {
							this.makeDimsPositive(this.cstate.selection); // no need to set valid=false
						}
					}
				// }
			}
			
			
		},
		keydown: function(e) {
			switch(e.key) {
				
				default:
					// do nothing
			}
		},
		keyup: function(e) {
			switch (e.key) {
				case 'Delete':
				
						if (!this.cstate.dragging && !this.cstate.resizing) {
							switch (this.state.sPalTool) {
								case 'Select':
								case 'Shapes':
										if (this.cstate.selection) {
											var rez_valid = this.cstate.selection.delete();
											this.cstate.selection = null;
											this.cstate.valid = rez_valid;
										}
									break;
								default:
									// do nothing
							}
						}
				
					break;
				case 'Escape':
				
						window.close();
				
					break;
				default:
					// do nothing
			}
		},
		////// end - canvas functions
		render: function() {
			// props
			//		see link1818181
			
			if (this.state.sMounted && this.canInited) {

			} else if (this.state.sMounted && !this.canInited) {
				this.canInited = true;
				
				this.ctx = this.refs.can.getContext('2d');
				this.ctx0 = this.refs.can0.getContext('2d');
				
				var screenshotImageData = new ImageData(new Uint8ClampedArray(this.props.pScreenshotArrBuf), this.props.pQS.w, this.props.pQS.h);
				
				if (this.props.pQS.win81ScaleX || this.props.pQS.win81ScaleY) {
					var canDum = document.createElement('canvas');
					canDum.setAttribute('width', this.props.pQS.w);
					canDum.setAttribute('height', this.props.pQS.h);
					
					var ctxDum = canDum.getContext('2d');
					ctxDum.putImageData(screenshotImageData, 0, 0);
					
					this.ctx0.scale(1/this.props.pQS.win81ScaleX, 1/this.props.pQS.win81ScaleY);
					this.ctx.scale(1/this.props.pQS.win81ScaleX, 1/this.props.pQS.win81ScaleY);
					
					this.ctx0.drawImage(canDum, 0, 0);
				} else {
					this.ctx0.putImageData(screenshotImageData, 0, 0);
				}
				
				this.cstate = {}; // state personal to this canvas. meaning not to be shared with other windows
				gCState = this.cstate;
				
				this.cstate.rconn = this; // connectio to the react component
				
				// start - simon canvas stuff
				this.cstate.valid = false;
				
				this.cstate.width = this.props.pQS.w; // same as - monToMultiMon.w(this.refs.can.width);
				this.cstate.height = this.props.pQS.h; // same as - monToMultiMon.h(this.refs.can.height);
				
				this.cstate.drawables = []; // the collection of things to be drawn
				
				this.cstate.dragging = false; // Keep track of when we are dragging
				this.cstate.resizing = false; // when mouses down with a tool that can draw
				this.cstate.selection = null;
				
				this.cstate.dragoffx = 0; // See mousedown and mousemove events for explanation
				this.cstate.dragoffy = 0;
				
				this.cstate.downx = 0; // when the user mouses down on canvas
				this.cstate.downy = 0; // when the user mouses down on canvas
				
				// **** Options! ****
				var mtmm = this.mtmm;
				this.cstate.Style = {
					Draw: {
						line: {
							lineWidth: mtmm.w(0),
							setLineDash: [],
							strokeStyle: 'rgba(255, 0, 0, 1)',
						},
						fill: {
							fillStyle: 'rgba(100, 149, 237, 1)'
						},
						dim: {
							fillStyle: 'rgba(0, 0, 0, 0.6)'
						}
					},
					Select: {
						cutout: {
							lineWidth: mtmm.w(1),
							setLineDash: [0, mtmm.w(3), 0],
							strokeStyle: 'rgba(0, 0, 255, 1)'
						},
						shape: {
							lineWidth: mtmm.w(3),
							setLineDash: [0, mtmm.w(3), 0],
							strokeStyle: 'springgreen'
						}
					}
				};
				
				// now that Style is setup, i can add Drawable's
				(new this.Drawable(this.mtmm.x(500), this.mtmm.y(10), this.mtmm.w(100), this.mtmm.h(100), 'Rectangle')).add();
				(new this.Drawable(this.mtmm.x(500), this.mtmm.y(10), this.mtmm.w(100), this.mtmm.h(100), 'cutout')).add();
				// (new this.Drawable(this.mtmm.x(400), this.mtmm.y(50), this.mtmm.w(100), this.mtmm.h(100), 'cutout')).add();
				this.cstate.dim = new this.Drawable(null, null, null, null, 'dim');
				
				window.addEventListener('mousemove', this.mousemove, false);
				window.addEventListener('mousedown', this.mousedown, false);
				window.addEventListener('mouseup', this.mouseup, false);
				window.addEventListener('keyup', this.keyup, false);
				
				this.cstate.interval = setInterval(this.draw, this.props.pCanInterval);
				// start - simon canvas stuff
			} else {
				// this.state.sMounted is false
			}
			
			var cPalProps = overwriteObjWithObj(this.state, this.props);
			cPalProps.mPalHandleMousedown = this.mPalHandleMousedown;
			
			var cCanProps = {
				id: 'canDim',
				draggable: 'false',
				width: this.props.pPhys.w,
				height: this.props.pPhys.h,
				ref: 'can',
				style: {}
			};
			
			var cPalPalProps = {
				id:'palette',
				style: {
					left: this.state.sPalX + 'px',
					top: this.state.sPalY + 'px'
				},
				ref: 'pal'
			};
			
			// determine cursor
			if (this.state.sPalDragStart) {
				cCanProps.style.cursor = 'move';
				cPalPalProps.style.cursor = 'move';
			} else {
				if (this.state.sCanMouseMoveCursor) {
					cCanProps.style.cursor = this.state.sCanMouseMoveCursor;
				} else {
					switch (this.state.sPalTool) {
						case 'Select':
						case 'Shapes':
						case 'Line':
						
								cCanProps.style.cursor = 'crosshair';
						
							break;
						case 'Window Wand':
						
								cCanProps.style.cursor = 'pointer';
						
							break;
						default:
							// nothing
					}
				}
			}
			
			return React.createElement('div', {className:'editor'},
				React.createElement('div', cPalPalProps,
					React.createElement(Subwrap, cPalProps)
				),
				React.createElement('canvas', {id:'canBase', draggable:'false', width:this.props.pPhys.w, height:this.props.pPhys.h, ref:'can0'}),
				React.createElement('canvas', cCanProps)
			);
		}
	});
	
	////////// start - palette components
	var Accessibility = React.createClass({
		// the zoom controls that affect the toolbar
		displayName: 'Accessibility',
		enlarge: function() {
			var cPaletteSize = this.props.sPalSize;
			var cHandleSize = this.props.sCanHandleSize;
			
			var nPaletteSize = cPaletteSize;
			var nHandleSize = cHandleSize;
			
			if (cPaletteSize + 8 <= 56) {
				nPaletteSize = cPaletteSize + 8;
			}
			if (cHandleSize + 3 < 40) {
				nHandleSize = cHandleSize + 3;
			}
			gEditorStore.setState({
				sPalSize: nPaletteSize,
				sCanHandleSize: nHandleSize
			});
		},
		reduce: function() {
			var cPaletteSize = this.props.sPalSize;
			var cHandleSize = this.props.sCanHandleSize;

			var nPaletteSize = cPaletteSize;
			var nHandleSize = cHandleSize;
			
			if (cPaletteSize - 8 > 0) {
				nPaletteSize = cPaletteSize - 8;
			}
			if (cHandleSize - 3 > 0) {
				nHandleSize = cHandleSize - 3;
			}
			gEditorStore.setState({
				sPalSize: nPaletteSize,
				sCanHandleSize: nHandleSize
			});
		},
		render: function() {
			// props
			// 		sPalSize
			//		sCanHandleSize

			return React.createElement('div', {className:'paccessibility'},
				React.createElement('div', {className: 'pbutton', onClick:this.enlarge},
					'\ue81a'
				),
				React.createElement('div', {className: 'pbutton', onClick:this.reduce},
					'\ue819'
				)
			);
		}
	});
	
	var Handle = React.createClass({
		// user can drag around the palette with this
		displayName: 'Handle',
		render: function() {
			// props
			//		mPalHandleMousedown

			return React.createElement('div', {className:'phandle pbutton', onMouseDown:this.props.mPalHandleMousedown},
				React.createElement('div', {className:'phandle-visual'}),
				// React.createElement('div', {className:'phandle-visual'}),
				React.createElement('div', {className:'phandle-visual'})
			);
		}
	});
	
	var Divider = React.createClass({
		displayName: 'Divider',
		render: function() {
			return React.createElement('div', {className:'pdivider'});
		}
	});
	
	var Button = React.createClass({
		displayName: 'Button',
		click: function() {
			switch (this.props.pButton.label) {
				case 'Close':
						
						window.close();
						
					break;
				case 'Select':
					
						// if (gCanState.cutouts.length) {
						// 	if (!gCanState.selection || gCanState.selection != gCanState.cutouts[0]) {
						// 		// gCanState.cutouts[0].select(); // :note::important: i should never call .select on a shape/cutout/etc only the CanvasState.prototype.draw calls .select
						// 		gCanState.selection = gCanState.cutouts[0];
						// 		gCanState.valid = false;
						// 	}
						// }
					
					break;
				case 'Clear Selection':
						
						// var valid = true;
						// if (gCanState.cutouts.length) {
						// 	gCanState.cutouts.length = 0;
						// 	valid = false;
						// }
						// if (gCanState.selection) {
						// 	gCanState.selection = null;
						// 	valid = false;
						// }
						// gCanState.valid = valid;
						gCState.valid = gCState.rconn.deleteAll(['cutout']);
						
					break;
				case 'Shapes':
				
						if (gCState.selection) {
							gCState.selection = null;
							gCState.valid = false;
						}
					
					break;
				default:
					// do nothing
			}
			
			if (this.props.pButton.multiDepress) {
				var sPalMultiDepresses = cloneObject(this.props.sPalMultiDepresses);
				if (sPalMultiDepresses[this.props.pButton.label]) {
					delete sPalMultiDepresses[this.props.pButton.label];
				} else {
					sPalMultiDepresses[this.props.pButton.label] = true;
				}
				gEditorStore.setState({
					sPalMultiDepresses: sPalMultiDepresses
				});
			} else if (this.props.pButton.justClick) {
				
			} else {
				// depress it and undepress other non-multiDepress
				gEditorStore.setState({
					sPalTool: this.props.pButton.label
				});
			}
		},
		render: function() {
			// props
			//		pButton
			//		sPalTool
			//		sPalToolSubs
			//		sPalMultiDepresses
			//		sPalLineAlpha
			//		sPalLineColor
			//		sPalFillAlpha
			//		sPalFillColor
			
			var cProps = {
				className:'pbutton',
				onClick: this.click
			};
			if (this.props.sPalToolSubs[this.props.pButton.label]) {
				for (var i=0; i<this.props.pButton.sub.length; i++) {
					if (this.props.pButton.sub[i].label == this.props.sPalToolSubs[this.props.pButton.label]) {
						cProps['data-subsel'] = this.props.pButton.sub[i].icon;
					}
				}
			}
			if (this.props.pButton.multiDepress) {
				if (this.props.sPalMultiDepresses[this.props.pButton.label]) {
					cProps.className += ' pbutton-pressed';
				}
			} else if (this.props.pButton.justClick) {
				
			} else {
				if (this.props.sPalTool == this.props.pButton.label) {
					cProps.className += ' pbutton-pressed';
				}
			}
			
			var cButtonIcon;
			if (this.props.pButton.label == 'Color' || this.props.pButton.label == 'Fill Color') {
				var rgbaStr;
				if (this.props.pButton.label == 'Color') {
					rgbaStr = colorStrToRGBA(this.props.sPalLineColor, this.props.sPalLineAlpha);
				} else {
					rgbaStr = colorStrToRGBA(this.props.sPalFillColor, this.props.sPalFillAlpha);
				}
				var bgImgStr = 'linear-gradient(to right, ' + rgbaStr + ', ' + rgbaStr + '), url("data:image/png;base64,R0lGODdhCgAKAPAAAOXl5f///ywAAAAACgAKAEACEIQdqXt9GxyETrI279OIgwIAOw==")';
				cButtonIcon = React.createElement('div', {style:{backgroundImage:bgImgStr}, className:'pbutton-icon-color'});
			} else {
				cButtonIcon = this.props.pButton.icon;
			}
			
			return React.createElement('div', cProps,
				React.createElement('div', {className:'plabel'},
					React.createElement('span', {},
						this.props.pButton.label
					)
				),
				!this.props.pButton.sub ? undefined : React.createElement(Submenu, {sPalToolSubs:this.props.sPalToolSubs, pButton:this.props.pButton, pSub:this.props.pButton.sub, sPalLineAlpha:this.props.sPalLineAlpha, sPalLineColor:this.props.sPalLineColor, sPalFillAlpha:this.props.sPalFillAlpha, sPalFillColor:this.props.sPalFillColor},
					this.props.pButton.label
				),
				cButtonIcon
			);
		}
	});
	
	var SubButton = React.createClass({
		click: function(e) {
			e.stopPropagation(); // so it doesnt trigger the setState due to click on the pbutton
			
			if (!this.props.pSubButton.unfixable) {
				var sPalToolSubs = cloneObject(this.props.sPalToolSubs);
				sPalToolSubs[this.props.pButton.label] = this.props.pSubButton.label;
			
				gEditorStore.setState({
					sPalTool: this.props.pButton.label,
					sPalToolSubs: sPalToolSubs
				});
			}
		},
		render: function() {
			// props
			//		sPalLineAlpha
			//		sPalLineColor
			//		sPalFillAlpha
			//		sPalFillColor
			//		pSubButton
			//		pButton
			//		sPalToolSubs

			var cProps = {
				className:'pbutton',
				onClick: this.click
			};
			
			if (this.props.pSubButton.special) {
				if (this.props.pSubButton.special in Specials) { // temp as all specials not yet defined
					var cSpecialProps = {};
					var cRequestingProps = this.props.pSubButton.props;
					if (cRequestingProps) {
						if (Array.isArray(cRequestingProps)) {
							// its an array, so the asName (meaning what it should be sent to the component we are creating as. AND the isName meaning what it is in this this.props is the same) link388391111
							for (var j=0; j<cRequestingProps.length; j++) {
								var cSpecialPropName = cRequestingProps[j];
								cSpecialProps[cSpecialPropName] = this.props[cSpecialPropName];
							}
						} else {
							// its an object, so the key is what to send it as, and the value is what it is in the this.props // link388391111
							// if value in object starts with $string$ then that actual string is passed
							for (var p in cRequestingProps) {
								var cSpecialProp_asName = p;
								var cSpecialProp_isName = cRequestingProps[p];
								var cSpecialProp_val;
								if (cSpecialProp_isName.indexOf('$string') === 0) {
									cSpecialProp_val = cSpecialProp_isName.substr('$string$'.length);
								} else {
									cSpecialProp_val = this.props[cSpecialProp_isName];
								}
								cSpecialProps[cSpecialProp_asName] = cSpecialProp_val;
							}
						}
					}
					return React.createElement(Specials[this.props.pSubButton.special], cSpecialProps);
				}
			}

			if (!this.props.pSubButton.special && this.props.sPalToolSubs[this.props.pButton.label] == this.props.pSubButton.label) {
				cProps.className += ' pbutton-pressed';
			}
			
			return React.createElement('div', cProps,
				this.props.pSubButton.icon
			);
		}
	});
	
	var ColorPicker = React.createClass({
		// to use this, must create a global object called `gColorPickerSetState`. key must be same as what you pass to pSetStateName, this is only place it is used.
		displayName: 'ColorPicker',
		render: function() {
			// props
			//		sColor // must a be a string of either a hex (#fff, fff, #ffffff, ffffff) OR a string that is understood by the function rgbToHex
			//		sAlpha // must be a percentage so 0 - 100
			//		pStateColorKey
			//		pStateAlphaKey
			//		pSetStateName - a string, it must be the store to use for the pStateColorKey and pStateAlphaKey
			
			// only supports rgb mode
			
			// convert sColor into object of rgb
			var sColor = this.props.sColor + '';
			var rgb;
			if (sColor[0] == '#' || sColor.length == 3 || sColor.length == 6) {
				rgb = hexToRgb(sColor);
				console.log('rgb:', rgb);
			} else {
				var hexFirst = rgbToHex(false, sColor);
				console.log('hexFirst:', hexFirst);
				rgb = hexToRgb(hexFirst);
				console.log('rgb2:', rgb);
			}
			
			var pRgba = rgb;
			pRgba.a = parseInt(this.props.sAlpha);
			
			return React.createElement('div', {className:'colorpicker'},
				React.createElement('div', {className:'colorpicker-inner'},
					React.createElement(ColorPickerChoices, {pStateColorKey:this.props.pStateColorKey, pSetStateName:this.props.pSetStateName}),
					React.createElement(ColorPickerBoard, {pRgba:pRgba}),
					React.createElement(ColorPickerSliders, {pRgba:pRgba}),
					React.createElement(ColorPickerCodes, {pRgba:pRgba})
				)
			);
		}
	});
	
	var ColorPickerBoard = React.createClass({
		displayName: 'ColorPickerBoard',
		render: function() {
			return React.createElement('div', {className:'colorpicker-board'},
				React.createElement('div', {className:'colorpicker-board-color'}),
				React.createElement('div', {className:'colorpicker-board-white'}),
				React.createElement('div', {className:'colorpicker-board-black'})
			);
		}
	});
	var ColorPickerSliders = React.createClass({
		displayName: 'ColorPickerSliders',
		render: function() {
			// props
			//		pRgba
			
			var rgba = this.props.pRgba;
			var rgbaStr = 'rgba(' + rgba.r + ', ' + rgba.g + ', ' + rgba.b + ', ' + (rgba.a/100) + ')';
			var bgImgStr = 'linear-gradient(to right, ' + rgbaStr + ', ' + rgbaStr + '), url("data:image/png;base64,R0lGODdhCgAKAPAAAOXl5f///ywAAAAACgAKAEACEIQdqXt9GxyETrI279OIgwIAOw==")';
			
			return React.createElement('div', {className:'colorpicker-sliders'},
				React.createElement('div', {className:'colorpicker-sliders-wrap'},
					React.createElement('div', {className:'colorpicker-slider-rainbow'}),
					React.createElement('div', {className:'colorpicker-slider-alpha'})
				),
				React.createElement('div', {style:{backgroundImage:bgImgStr}, className:'colorpicker-sliders-wrap colorpicker-slider-preview'})
			);
		}
	});
	var ColorPickerCodes = React.createClass({
		displayName: 'ColorPickerCodes',
		render: function() {
			// props
			//		pRgba
			
			var rgba = this.props.pRgba;
			var hexColor = rgbToHex(false, rgba.r, rgba.g, rgba.b); // hex color without hash
			
			return React.createElement('div', {className:'colorpicker-codes'},
				React.createElement('div', {className:'colorpicker-codes-hex'},
					React.createElement('input', {type:'text', maxLength:6, defaultValue:hexColor, key:hexColor}),
					'Hex'
				),
				React.createElement('div', {className:'colorpicker-codes-r'},
					React.createElement('input', {type:'text', maxLength:3, defaultValue:rgba.r, key:rgba.r}),
					React.createElement('span', {},
						'R'
					)
				),
				React.createElement('div', {className:'colorpicker-codes-g'},
					React.createElement('input', {type:'text', maxLength:3, defaultValue:rgba.g, key:rgba.g}),
					React.createElement('span', {},
						'G'
					)
				),
				React.createElement('div', {className:'colorpicker-codes-b'},
					React.createElement('input', {type:'text', maxLength:3, defaultValue:rgba.b, key:rgba.b}),
					React.createElement('span', {},
						'B'
					)
				),
				React.createElement('div', {className:'colorpicker-codes-a'},
					React.createElement('input', {type:'text', maxLength:3, defaultValue:rgba.a, key:rgba.a}),
					React.createElement('span', {},
						'A'
					)
				)
			);
		}
	});
	var ColorPickerChoices = React.createClass({
		displayName: 'ColorPickerChoices',
		click: function(aColor) {
			var setStateObj = {};
			setStateObj[this.props.pStateColorKey] = aColor;
			
			gColorPickerSetState[this.props.pSetStateName](setStateObj);
		},
		render: function() {
			//		pSetStateName
			//		pStateColorKey
			
			var historyColors = ['#D0021B', '#F5A623', '#F8E71C'];
			var defaultColors = ['#B8E986', '#9B9B9B', '#9013FE', '#4A90E2'];
			
			var historyElements = [];
			var defaultElements = [];
			
			historyColors.forEach(function(color) {
				historyElements.push(React.createElement('div', {className:'colorpicker-choices-opt', style:{backgroundColor:color}, onClick:this.click.bind(this, color)}));
			}.bind(this));

			defaultColors.forEach(function(color) {
				defaultElements.push(React.createElement('div', {className:'colorpicker-choices-opt', style:{backgroundColor:color}, onClick:this.click.bind(this, color)}));
			}.bind(this));
			
			return React.createElement('div', {className:'colorpicker-choices'},
				React.createElement('div', {className:'colorpicker-choices-wrap'},
					React.createElement('div', {className:'colorpicker-choices-history'},
						historyElements
					),
					React.createElement('div', {className:'colorpicker-choices-default'},
						defaultElements
					)
				),
				React.createElement('div', {className:'colorpicker-choices-wrap colorpicker-choices-dropper'},
					'\ue82a'
				)
			);
		}
	});
	
	var Submenu = React.createClass({
		displayName: 'Submenu',
		render: function() {
			// props
			// 		pSub
			//		pButton
			//		sPalToolSubs
			//		sPalLineAlpha
			//		sPalLineColor
			//		sPalFillAlpha
			//		sPalFillColor
			
			var cChildren = [];
			for (var i=0; i<this.props.pSub.length; i++) {
				cChildren.push(React.createElement(SubButton, {sPalToolSubs:this.props.sPalToolSubs, pButton:this.props.pButton, pSubButton:this.props.pSub[i], sPalLineAlpha: this.props.sPalLineAlpha, sPalLineColor: this.props.sPalLineColor, sPalFillAlpha: this.props.sPalFillAlpha, sPalFillColor: this.props.sPalFillColor}));
			}
			
			return React.createElement('div', {className:'psub'},
				cChildren
			);
		}
	});
	
	var Subwrap = React.createClass({
		displayName: 'Subwrap',
		render: function() {
			// props
			// 		merged this.state and this.props of `Editor` component
			
			var cChildren = [];
			
			var pPalLayout = this.props.pPalLayout;
			var iEnd = pPalLayout.length;
			for (var i=0; i<iEnd; i++) {
				if (pPalLayout[i].special) {
					if (pPalLayout[i].special in Specials) { // temp as all specials not yet defined
						var cSpecialProps = {};
						var cRequestingProps = pPalLayout[i].props;
						if (cRequestingProps) {
							for (var j=0; j<cRequestingProps.length; j++) {
								var cSpecialPropName = cRequestingProps[j];
								cSpecialProps[cSpecialPropName] = this.props[cSpecialPropName]
							}
						}
						cChildren.push(React.createElement(Specials[pPalLayout[i].special], cSpecialProps));
					}
				} else {
					cChildren.push(React.createElement(Button, {sPalMultiDepresses:this.props.sPalMultiDepresses, sPalToolSubs:this.props.sPalToolSubs, pButton:pPalLayout[i], sPalTool:this.props.sPalTool, sPalLineAlpha:this.props.sPalLineAlpha, sPalLineColor:this.props.sPalLineColor, sPalFillAlpha:this.props.sPalFillAlpha, sPalFillColor:this.props.sPalFillColor}));
				}
			}
			
			var cProps = {
				className:'psubwrap',
				style: {
					fontSize: this.props.sPalSize + 'px'
				}
			};
			
			if (this.props.sPalDragStart) {
				cProps.style.cursor = 'move';
			}
			
			if (this.props.sPalSize < 24) {
				cProps.className += ' minfontsize';
			}
			
			return React.createElement('div', cProps,
				cChildren
			);
		}
	});
	////////// end - palette components
	
	var pQS = tQS; //queryStringAsJson(window.location.search.substr(1));
	
	// to test no scaling
	delete pQS.win81ScaleX;
	delete pQS.win81ScaleY;
	
	var pPhys = {}; // stands for pPhysical - meaning the actually used canvas width and height
	if (pQS.win81ScaleX || pQS.win81ScaleY) {
		pPhys.w = Math.ceil(pQS.w / pQS.win81ScaleX);
		pPhys.h = Math.ceil(pQS.h / pQS.win81ScaleY);
	} else {
		pPhys.w = pQS.w;
		pPhys.h = pQS.h;
	}
	
	var palToolSubs = {};
	for (var i=0; i<palLayout.length; i++) {
		if (palLayout[i].sub) {
			var hasFixableSubs = false;
			for (var j=0; j<palLayout[i].sub.length; j++) {
				if (!('special' in palLayout[i].sub[j]) && !('unfixable' in palLayout[i].sub[j])) {
					hasFixableSubs = palLayout[i].sub[j].label;
					break;
				}
			}
			if (hasFixableSubs) {
				palToolSubs[palLayout[i].label] = hasFixableSubs;
			}
		}
	}
	
	var palMultiDepresses = {}; // if its depressed, then the tool label is the key and the value is true

	var palLineColor = 'rgb(74, 144, 226)'; // :todo: get from prefs
	var palLineAlpha = 100; // :todo: get from prefs
	var palFillColor = 'rgb(208, 2, 27)'; // :todo: get from prefs
	var palFillAlpha = 100; // :todo: get from prefs
	
	var Specials = {
		Divider: Divider,
		Accessibility: Accessibility,
		Handle: Handle,
		ColorPicker: ColorPicker
	};
	
	var initReact = function() {
		ReactDOM.render(
			React.createElement(Editor, {
				// link1818181
				pPalLayout: palLayout,
				pPalSize: 40, // :todo: get from prefs
				pPalToolSubs: palToolSubs, // :todo: get from prefs
				pPalMultiDepresses: palMultiDepresses, // :todo: get from prefs
				
				pPalLineColor: palLineColor, 
				pPalLineAlpha: palLineAlpha,
				pPalFillColor: palFillColor,
				pPalFillAlpha: palFillAlpha,
				
				pCanHandleSize: 7, // :todo: get from prefs
				pCanInterval: 30, // ms
				
				pScreenshotArrBuf: aArrBufAndCore.screenshotArrBuf, // i hold it, as i plan to transfer it back to ChromeWorker in future
				
				pQS: pQS,
				pPhys: pPhys // the actually used height/width on this canvas
			}),
			document.getElementById('react_wrap') // document.body
		);
	};
	
	// console.log('document.readyState:', document.readyState);
	if (document.readyState != 'complete') {
		window.addEventListener('DOMContentLoaded', initReact, false);
	} else {
		initReact();
	}
}

// start - pre-init

var tQS = queryStringAsJson(window.location.search.substr(1)); // temp, as i dont deal with gQS anymore.
var gQS = tQS;
window.addEventListener('message', function(aWinMsgEvent) {
	console.error('incoming window message to HTML: iMon:', tQS.iMon, 'aWinMsgEvent:', aWinMsgEvent);
	var aData = aWinMsgEvent.data;
	if (aData.topic in window) {
		window[aData.topic](aData);
	} else {
		throw new Error('unknown topic received: ' + aData.topic);
	}
}, false);

// link9999191911111
Services.obs.notifyObservers(null, core.addon.id + '_nativeshot-editor-request', JSON.stringify({
	topic: 'init',
	iMon: tQS.iMon
}));

/*
// while bootstrap is responding to the request from link9999191911111 ill load in other stuff
var editorCss = document.createElement('link');
editorCss.setAttribute('href', core.addon.path.styles + 'editor.css');
editorCss.setAttribute('ref', 'stylesheet');
editorCss.setAttribute('type', 'text/css');
document.head.appendChild(editorCss);

if (typeof(React) == 'undefined') {
	Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-with-addons.js?' + core.addon.cache_key);
	Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-dom.js?' + core.addon.cache_key);
}
else { console.error('devwarn!!!! React is already in here!!!') }
*/

// end - pre-init

// common functions

// rev3 - https://gist.github.com/Noitidart/725a9c181c97cfc19a99e2bf1991ebd3
function queryStringAsJson(aQueryString) {
	var asJsonStringify = aQueryString;
	asJsonStringify = asJsonStringify.replace(/&/g, '","');
	asJsonStringify = asJsonStringify.replace(/=/g, '":"');
	asJsonStringify = '{"' + asJsonStringify + '"}';
	asJsonStringify = asJsonStringify.replace(/"(\d+(?:.\d+)?|true|false)"/g, function($0, $1) { return $1; });
	
	return JSON.parse(asJsonStringify);
}

function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(withHash, rOrStr, g, b) {
	var r;
	if (g === undefined) { // meaning only provided one arg
		var rgb = /(\d+)\D+(\d+)\D+(\d+)/.exec(rOrStr);
		if (!rgb) {
			throw new Error('rgbToHex failed, invalid string of "' + rOrStr + '"');
		} else {
			console.log('rgb:', rgb);
			r = parseInt(rgb[1]);
			g = parseInt(rgb[2]);
			b = parseInt(rgb[3]);
		}
	} else {
		r = rOrStr;
	}
	
	var withoutHash = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
	if (withHash) {
		return '#' + withoutHash;
	} else {
		return withoutHash;
	}
}

function colorStrToRGBA(aColorStr, aAlpha) {
	// returns 'rgba(#, #, #, #)'
	// aAlpha can be 0 to 1 or 0 to 100
	
	var sColor = aColorStr;
	
	var rgb;
	if (sColor[0] == '#' || sColor.length == 3 || sColor.length == 6) {
		rgb = hexToRgb(sColor);
		console.log('rgb:', rgb);
	} else {
		var hexFirst = rgbToHex(false, sColor);
		console.log('hexFirst:', hexFirst);
		rgb = hexToRgb(hexFirst);
		console.log('rgb2:', rgb);
	}
	
	var sAlpha;
	if (aAlpha <= 1) {
		sAlpha = aAlpha;
	} else {
		sAlpha = aAlpha / 100;
	}
	
	var pRgba = rgb;
	pRgba.a = sAlpha;
	
	return 'rgba(' + pRgba.r + ', ' + pRgba.g + ', ' + pRgba.b + ', ' + pRgba.a + ')';
}

// rev1 - https://gist.github.com/Noitidart/6c866a4fa964354d4ab8540a96ca4d0f
function spliceObj(obj1, obj2) {
	/**
	 * By reference. Adds all of obj2 keys to obj1. Overwriting any old values in obj1.
	 * Was previously called `usurpObjWithObj`
	 * @param obj1
	 * @param obj2
	 * @returns undefined
	 */
	for (var attrname in obj2) { obj1[attrname] = obj2[attrname]; }
}
function overwriteObjWithObj(obj1, obj2){
	/**
	 * No by reference. Creates a new object. With all the keys/values from obj2. Adds in the keys/values that are in obj1 that were not in obj2.
	 * @param obj1
	 * @param obj2
	 * @returns obj3 a new object based on obj1 and obj2
	 */

    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

function subtractMulti(aTargetRect, aSubtractRectsArr) {
	// http://stackoverflow.com/a/36641104/1828637
	
    var keptParts = [aTargetRect];
    for (var i = 0; i < aSubtractRectsArr.length; i++) {
        var keptPartsPartial = [];
        for(var j = 0; j < keptParts.length; j++) {
            keptPartsPartial = keptPartsPartial.concat(keptParts[j].subtract(aSubtractRectsArr[i]));
        }
        keptParts = keptPartsPartial;
    }

    return keptParts;
}

function cloneObject(aObj) {
	return JSON.parse(JSON.stringify(aObj));
}