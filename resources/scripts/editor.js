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
			props: ['mPalHandleMousedown'] // props needed from the react component
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
			label: 'Fullscreen',
			icon: '\ue80e',
			hotkey: 'F', // hotkey does the currently set sub, in this case its fixed to current monitor (i should test which window the mouse is over)
			fixed: 'Current Monitor', // if not fixed, then the last clicked sub is used, if subs exist, and nothing is fixed, the default is the first one in the list
			sub: [
				{
					label: 'Current Monitor',
					fixedOnly: true // do not show as sub
				},
				{
					special: 'Monitors'
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
			sub: [
				{
					special: 'SelectionHistory'
				}
			]
		},
		{
			label: 'Clear Selection',
			icon: '\ue82f'
		},
		{
			special: 'Divider'
		},
		// misc tools
		{
			label: 'Toggle Cursor',
			icon: '\ue822'
		},
		{
			label: 'Zoom View',
			icon: '\ue811',
			sub: [
				{
					special: 'ZoomViewLevel'
				}
			]
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
					label: 'Circle',
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
			sub: [
				{
					label: 'Dropper',
					icon: '\ue82a',
					unfixable: true
				},
				{
					special: 'ColorPicker' // all special subs are unfixable
				},
				{
					special: 'ColorHistory'
				},
				{
					special: 'TransparencyPicker'
				}
			]
		},
		{
			label: 'Line Width',
			icon: 'S',
			sub: [
				{
					special: 'LineWidthPicker'
				}
			]
		},
		{
			label: 'Fill Color',
			icon: 'S',
			sub: [
				{
					label: 'Dropper',
					icon: '\ue82a',
					unfixable: true
				},
				{
					special: 'ColorPicker'
				},
				{
					special: 'ColorHistory'
				},
				{
					special: 'TransparencyPicker'
				}
			]
		},
		{
			special: 'Width'
		},
		{
			special: 'Height'
		},
		{
			special: 'TextTools'
		},
		{
			special: 'Divider'
		},
		// actions
		{
			label: 'Save',
			icon: '\ue804',
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
			icon: '\ue805'
		},
		{
			label: 'Copy',
			icon: '\ue80d'
		},
		{
			label: 'Upload to Cloud',
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
				
				// palette related
				sPalSize: this.props.pPalSize,
				sPalTool: 'Select', // the label of the currently active tool
				sPalToolSub: null, // the active sub label of sPalTool
				sPalX: 5, // :todo: get this from prefs
				sPalY: 75, // :todo: get this from prefs
				sPalDragStart: null // is null when not dragging. when dragging it is {screenX:, screenY:}
			};
		},
		componentDidMount: function() {
			gEditorStore.setState = this.setState.bind(this); // need bind here otherwise it doesnt work - last tested in React 0.14.x
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
				case 'Circle':
					
						console.error('gCState:', gCState);
						this.Style = {
							Draw: {
								me: {
									fillStyle: aOptions.fillStyle || gCState.Style.Draw.fill.fillStyle,
									strokeStyle: aOptions.strokeStyle || gCState.Style.Draw.line.strokeStyle,
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
					case 'Circle':
					
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
							}
					
						break;
					case 'Rectangle':
					
							// console.error('fill args:', this.x + this.Style.Draw.me.lineWidth, this.y + this.Style.Draw.me.lineWidth, this.w - this.Style.Draw.me.lineWidth, this.h - this.Style.Draw.me.lineWidth);
							ctx.fillRect(this.x + this.Style.Draw.me.lineWidth, this.y + this.Style.Draw.me.lineWidth, this.w - this.Style.Draw.me.lineWidth, this.h - this.Style.Draw.me.lineWidth);
							ctx.strokeRect(this.x + this.Style.Draw.me.lineWidth, this.y + this.Style.Draw.me.lineWidth, this.w - this.Style.Draw.me.lineWidth, this.h - this.Style.Draw.me.lineWidth);
							// ctx.fillRect(gCState.rconn.mtmm.x(500), gCState.rconn.mtmm.y(500), gCState.rconn.mtmm.w(100), gCState.rconn.mtmm.h(100));
						
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
					case 'Circle':
					
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
					case 'Circle':
					
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
				// var toolsub = this.state.sPalTool + '-' + (this.state.sPalToolSub || '');
				if (this.cstate.dragging) {
					this.cstate.selection.x = mx - this.cstate.dragoffx;
					this.cstate.selection.y = my - this.cstate.dragoffy;
					this.cstate.valid = false; // Something's dragging so we must redraw
				}
			}
			
		},
		mousedown: function(e) {
			var mouse = this.getMouse(e);
			var mx = mouse.x;
			var my = mouse.y;
			
			this.cstate.downx = mx;
			this.cstate.downy = my;
			
			var toolsub = this.state.sPalTool + '-' + (this.state.sPalToolSub || '');
			
			// if selectable, set a selectFilterFunc
			var selectFilterFunc;
			switch (toolsub) {
				case 'Select-':
				
						selectFilterFunc = function(aToFilter) { return aToFilter.name == 'cutout' };
					
					break;
				case 'Shapes-Rectangle':
				case 'Shapes-Circle':
					
						selectFilterFunc = function(aToFilter) { return ['Rectangle', 'Circle'].indexOf(aToFilter.name) > -1 };
					
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
					this.cstate.valid = false;
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
				// var toolsub = this.state.sPalTool + '-' + (this.state.sPalToolSub || '');
				if (this.cstate.dragging) {
					this.cstate.dragging = false;
				}
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
							setLineDash: [0],
							strokeStyle: 'red'
						}
					}
				};
				
				// now that Style is setup, i can add Drawable's
				(new this.Drawable(this.mtmm.x(500), this.mtmm.y(10), this.mtmm.w(100), this.mtmm.h(100), 'Rectangle')).add();
				// (new this.Drawable(this.mtmm.x(500), this.mtmm.y(10), this.mtmm.w(100), this.mtmm.h(100), 'cutout')).add();
				(new this.Drawable(this.mtmm.x(400), this.mtmm.y(50), this.mtmm.w(100), this.mtmm.h(100), 'cutout')).add();
				this.cstate.dim = new this.Drawable(null, null, null, null, 'dim');
				
				window.addEventListener('mousemove', this.mousemove, false);
				window.addEventListener('mousedown', this.mousedown, false);
				window.addEventListener('mouseup', this.mouseup, false);
				
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
				}
			};
			
			// determine cursor
			if (this.state.sPalDragStart) {
				cCanProps.style.cursor = 'move';
				cPalPalProps.style.cursor = 'move';
			} else {
				if (this.state.sCanMouseMoveCursor) {
					
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
						return;
						
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
						
						return;
						
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
			
			gEditorStore.setState({
				sPalTool: this.props.pButton.label,
				sPalToolSub: 'Rectangle'
			});
		},
		render: function() {
			// props
			//		pButton
			//		sPalTool
			var cProps = {
				className:'pbutton',
				onClick: this.click
			};
			if (this.props.pButton.sub && this.props.pButton.sub.length) {
				cProps['data-subsel'] = this.props.pButton.sub[0].icon;
			}
			if (this.props.sPalTool == this.props.pButton.label) {
				cProps.className += ' pbutton-pressed';
			}
			return React.createElement('div', cProps,
				React.createElement('div', {className:'plabel'},
					React.createElement('span', {},
						this.props.pButton.label
					)
				),
				!this.props.pButton.sub ? undefined : React.createElement(Submenu, {pSub:this.props.pButton.sub},
					this.props.pButton.label
				),
				this.props.pButton.icon
			);
		}
	});
	
	var Submenu = React.createClass({
		displayName: 'Submenu',
		render: function() {
			// props
			// 		pSub
			
			return React.createElement('div', {className:'psub'},
				'sub'
			);
		}
	});
	
	var Specials = {
		Divider: Divider,
		Accessibility: Accessibility,
		Handle: Handle
	};
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
					cChildren.push(React.createElement(Button, {pButton:pPalLayout[i], sPalTool:this.props.sPalTool}));
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
	// delete pQS.win81ScaleX;
	// delete pQS.win81ScaleY;
	
	var pPhys = {}; // stands for pPhysical - meaning the actually used canvas width and height
	if (pQS.win81ScaleX || pQS.win81ScaleY) {
		pPhys.w = Math.ceil(pQS.w / pQS.win81ScaleX);
		pPhys.h = Math.ceil(pQS.h / pQS.win81ScaleY);
	} else {
		pPhys.w = pQS.w;
		pPhys.h = pQS.h;
	}
	
	var initReact = function() {
		ReactDOM.render(
			React.createElement(Editor, {
				// link1818181
				pPalLayout: palLayout,
				pPalSize: 40, // :todo: get from prefs
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

function hexToRgb(aHexStr) {
	if (aHexStr[0] == '#') {
		aHexStr = aHexStr.substr(1);
	}
	aHexStr = cutHex(aHexStr);
	return {
		r: parseInt(aHexStr.substring(0,2),16),
		g: parseInt(aHexStr.substring(2,4),16),
		b: parseInt(aHexStr.substring(4,6),16)
	};
}
function cutHex(aHexStr) {
	return aHexStr.charAt(0) =="#" ? aHexStr.substring(1,7) : aHexStr;
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