Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://gre/modules/Geometry.jsm');

var core = {
	addon: {
		name: 'NativeShot',
		id: 'NativeShot@jetpack'
	}
};

var gQS = queryStringAsJson(window.location.search.substr(1));
console.log('gQS:', gQS, window.location.search.substr(1));

var gCanBase;
var gCanDim;

var gCtxBase;
var gCtxDim;

const gStyle = {
	dimFill: 'rgba(0, 0, 0, 0.6)',
	lineDash: [3, 3],
	stroke: '#fff',
	lineDashAlt: [0, 3, 0],
	strokeAlt: '#000',
	lineWidth: '1',
	resizePtSize: 7,
	resizePtFill: '#000'
};

var gUsedW;
var gUsedH;

function init() {
	// set globals	
	gCanBase = document.getElementById('canBase');
	gCanDim = document.getElementById('canDim');
	
	gCtxBase = gCanBase.getContext('2d');
	gCtxDim = gCanDim.getContext('2d');
	
	// set dimensions of canvas
	if (gQS.win81ScaleX || gQS.win81ScaleY) {
		gUsedW = Math.ceil(gQS.w / gQS.win81ScaleX);
		gUsedH = Math.ceil(gQS.h / gQS.win81ScaleY);
	}

	
	gCanBase.setAttribute('width', gUsedW);
	gCanBase.setAttribute('height', gUsedH);
	gCanDim.setAttribute('width', gUsedW);
	gCanDim.setAttribute('height', gUsedH);
	
	Services.obs.notifyObservers(null, core.addon.id + '_nativeshot-editor-request', JSON.stringify({
		topic: 'init',
		iMon: gQS.iMon
	}));
	
	var s = new CanvasState(gCanDim);
	s.addDrawable(new Drawable(monToMultiMon.x(40), monToMultiMon.y(40), monToMultiMon.w(50), monToMultiMon.h(50), 'rect')); // The default is gray
	s.addDrawable(new Drawable(monToMultiMon.x(60), monToMultiMon.y(140), monToMultiMon.w(40), monToMultiMon.h(60), 'rect', {fillStyle:'lightskyblue'}));
	// Lets make some partially transparent
	s.addDrawable(new Drawable(monToMultiMon.x(80), monToMultiMon.y(150), monToMultiMon.w(60), monToMultiMon.h(30), 'rect', {fillStyle:'rgba(127, 255, 212, .5)'}));
	s.addDrawable(new Drawable(monToMultiMon.x(125), monToMultiMon.y(80), monToMultiMon.w(30), monToMultiMon.h(80), 'rect', {fillStyle:'rgba(245, 222, 179, .7)'}));
	
	s.addDrawable(new Drawable(monToMultiMon.x(200), monToMultiMon.y(400), monToMultiMon.w(300), monToMultiMon.h(300), 'cutout'));
}

function screenshotXfer(aData) {
	console.log('in screenshotXfer, aData:', aData);
	
	var screenshotImageData = new ImageData(new Uint8ClampedArray(aData.screenshotArrBuf), gQS.w, gQS.h);
	
	// delete gQS.win81ScaleX;
	// delete gQS.win81ScaleY;
	
	if (gQS.win81ScaleX || gQS.win81ScaleY) {
		var canDum = document.createElement('canvas');
		canDum.setAttribute('width', gQS.w);
		canDum.setAttribute('height', gQS.h);
		
		var ctxDum = canDum.getContext('2d');
		ctxDum.putImageData(screenshotImageData, 0, 0);
		
		gCtxBase.scale(1/gQS.win81ScaleX, 1/gQS.win81ScaleY);
		gCtxDim.scale(1/gQS.win81ScaleX, 1/gQS.win81ScaleY);
		
		gCtxBase.drawImage(canDum, 0, 0);
	} else {
		gCtxBase.putImageData(screenshotImageData, 0, 0);
	}
	
	initPalette();
}

var gPaletteStore = {};
var gPaletteLive = {state: {}}; // connection to the react element. i can check state like gPaletteLive.state.sHandleSize
function initPalette() {
	var layout = [ // the tools and order they should show in
		{
			// Handle - from where user can drag palette around
			label: undefined, // for non-special, this is the text cloud that shows on hover
			sub: undefined, // for non-special, this is the submenu items shown on hover. an array of objects
			icon: undefined, // for non-special, the icon that
			special: 'Handle' // this key is for special things that have their own React class
		},
		{
			// Accessibility - from where user increase/decrease size of palette
			special: 'Accessibility'
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
				{
					label: 'Rounded Rectangle',
					icon: '\ue803'
				},
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
	
	var Accessibility = React.createClass({
		// the zoom controls that affect the toolbar
		displayName: 'Accessibility',
		enlarge: function() {
			var cPaletteSize = this.props.sPaletteSize;
			var cHandleSize = this.props.sHandleSize;
			
			var nPaletteSize = cPaletteSize;
			var nHandleSize = cHandleSize;
			
			if (cPaletteSize + 8 <= 56) {
				nPaletteSize = cPaletteSize + 8;
			}
			if (cHandleSize + 3 < 40) {
				nHandleSize = cHandleSize + 3;
			}
			gPaletteStore.setState({
				sPaletteSize: nPaletteSize,
				sHandleSize: nHandleSize
			});
		},
		reduce: function() {
			var cPaletteSize = this.props.sPaletteSize;
			var cHandleSize = this.props.sHandleSize;

			var nPaletteSize = cPaletteSize;
			var nHandleSize = cHandleSize;
			
			if (cPaletteSize - 8 > 0) {
				nPaletteSize = cPaletteSize - 8;
			}
			if (cHandleSize - 3 > 0) {
				nHandleSize = cHandleSize - 3;
			}
			gPaletteStore.setState({
				sPaletteSize: nPaletteSize,
				sHandleSize: nHandleSize
			});
		},
		render: function() {
			// props
			// 		sPaletteSize
			//		sHandleSize

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
		mousedown: function(e) {
			this.x = e.screenX;
			this.y = e.screenY;
			this.pal = document.getElementById('palette');
			this.left = parseInt(this.pal.style.left);
			this.top = parseInt(this.pal.style.top);
			
			// document.body.classList.add('paldrag');
			gCanDim.style.cursor = 'move';
			this.pal.firstChild.style.cursor = 'move';
			
			window.addEventListener('mousemove', this.mousemove, false);
			var tThis = this;
			window.addEventListener('mouseup', function() {
				window.removeEventListener('mouseup', arguments.callee, false);
				window.removeEventListener('mousemove', tThis.mousemove, false);
				gCanDim.style.cursor = '';
				tThis.pal.firstChild.style.cursor = '';
			}, false);
		},
		mousemove: function(e) {
			this.pal.style.left = this.left + (e.screenX - this.x) + 'px';
			this.pal.style.top = this.top + (e.screenY - this.y) + 'px';
		},
		render: function() {
			return React.createElement('div', {className:'phandle pbutton', onMouseDown:this.mousedown},
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
					
						if (gCanState.cutouts.length) {
							if (!gCanState.selection || gCanState.selection != gCanState.cutouts[0]) {
								// gCanState.cutouts[0].select(); // :note::important: i should never call .select on a shape/cutout/etc only the CanvasState.prototype.draw calls .select
								gCanState.selection = gCanState.cutouts[0];
								gCanState.valid = false;
							}
						}
					
					break;
				case 'Clear Selection':
						
						var valid = true;
						if (gCanState.cutouts.length) {
							gCanState.cutouts.length = 0;
							valid = false;
						}
						if (gCanState.selection) {
							gCanState.selection = null;
							valid = false;
						}
						gCanState.valid = valid;
						
						return;
						
					break;
				case 'Shapes':
						if (gCanState.selection) {
							gCanState.selection = null;
							gCanState.valid = false;
						}
					break;
				default:
					// do nothing
			}
			
			gPaletteStore.setState({
				sToolLabel: this.props.pButton.label
			});
		},
		render: function() {
			// props
			//		pButton
			//		sToolLabel
			var cProps = {
				className:'pbutton',
				onClick: this.click
			};
			if (this.props.pButton.sub && this.props.pButton.sub.length) {
				cProps['data-subsel'] = this.props.pButton.sub[0].icon;
			}
			if (this.props.sToolLabel == this.props.pButton.label) {
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
		getInitialState: function() {
			return {
				sPaletteSize: this.props.pPaletteSize, // Accessibility
				sHandleSize: this.props.pHandleSize, // Accessibility
				sToolLabel: 'Select' // the selected tool label
			};
		},
		componentDidMount: function() {
			gPaletteStore.setState = this.setState.bind(this); // need bind here otherwise it doesnt work
		},
		render: function() {
			// props
			// 		pLayout
			// 		pHandleSize
			//		pPaletteSize
			
			var cChildren = [];
			
			var pLayout = this.props.pLayout;
			var iEnd = pLayout.length;
			for (var i=0; i<iEnd; i++) {
				if (pLayout[i].special) {
					if (pLayout[i].special in Specials) { // temp as all specials not yet defined
						var cSpecialProps = {};
						switch (pLayout[i].special) {
							case 'Accessibility':
								
									cSpecialProps.sHandleSize = this.state.sHandleSize;
									cSpecialProps.sPaletteSize = this.state.sPaletteSize;
								
								break;
							default:
								// nothing extra special
						}
						cChildren.push(React.createElement(Specials[pLayout[i].special], cSpecialProps));
					}
				} else {
					cChildren.push(React.createElement(Button, {pButton:pLayout[i], sToolLabel:this.state.sToolLabel}));
				}
			}
			
			var cProps = {
				className:'psubwrap',
				style: {
					fontSize: this.state.sPaletteSize + 'px'
				}
			};
			
			if (this.state.sPaletteSize < 24) {
				cProps.className += ' minfontsize';
			}
			
			if (!gPaletteStore.setState) {
				// not yet mounted
				var pal = document.getElementById('palette');
				pal.style.left = '5px';
				pal.style.top = '75px';
			}
			
			return React.createElement('div', cProps,
				cChildren
			);
		}
	});
	
	gPaletteLive = ReactDOM.render(
		React.createElement(Subwrap, {pLayout:layout, pPaletteSize:40, pHandleSize:7}),
		document.getElementById('palette')
	);
}

window.addEventListener('DOMContentLoaded', init, false);

window.addEventListener('message', function(aWinMsgEvent) {
	console.error('incoming window message to HTML: iMon:', gQS.iMon, 'aWinMsgEvent:', aWinMsgEvent);
	var aData = aWinMsgEvent.data;
	if (aData.topic in window) {
		window[aData.topic](aData);
	} else {
		throw new Error('unknown topic received: ' + aData.topic);
	}
}, false);

// start - canvas functions
// based on http://simonsarris.com/blog/510-making-html5-canvas-useful
// all numbers passed to ctx functions, should be the monToMultiMon-scaled numbers

	// CODE FOR KEEPING TRACK OF OBJECTS

	
	// CODE FOR KEEPING TRACK OF CANVAS STATE
		var gCanState;
		function CanvasState(canvas) {
			// **** First some setup! ****

			this.canvas = canvas;
			this.width = gQS.w; // same as - monToMultiMon.w(canvas.width);
			this.height = gQS.h; // same as - monToMultiMon.h(canvas.height);
			
			this.ctx = canvas.getContext('2d');
			// This complicates things a little but but fixes mouse co-ordinate problems
			// when there's a border or padding. See getMouse for more detail
			// var stylePaddingLeft, stylePaddingTop, styleBorderLeft, styleBorderTop;
			// if(document.defaultView && document.defaultView.getComputedStyle) {
				this.stylePaddingLeft = 0; // parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10) || 0;
				this.stylePaddingTop = 0; // parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10) || 0;
				this.styleBorderLeft = 0; // parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10) || 0;
				this.styleBorderTop = 0; // parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10) || 0;
			// }
			// Some pages have fixed-position bars (like the stumbleupon bar) at the top or left of the page
			// They will mess up mouse coordinates and this fixes that
			// var html = document.body.parentNode;
			this.htmlTop = 0; // html.offsetTop;
			this.htmlLeft = 0; // html.offsetLeft;

			// **** Keep track of state! ****

			this.valid = false; // when set to false, the canvas will redraw everything
			
			// drawn objects
			this.drawables = []; // the collection of things to be drawn
			
			this.shapes = []; // the collection of things to be drawn
			this.cutouts = []; // collection of rectangular areas - representing the selected areas to get drawn
			this.dim = new Drawable(null, null, null, null, 'dim');
			
			// some global vars
			this.dragging = false; // Keep track of when we are dragging
			// the current selected object. In the future we could turn this into an array for multiple selection
			this.selection = null;
			this.dragoffx = 0; // See mousedown and mousemove events for explanation
			this.dragoffy = 0;
			
			this.downx = 0; // when the user mouses down on canvas
			this.downy = 0; // when the user mouses down on canvas
			this.resizing = null; // when mouses down with a tool that can draw, then this is set to `new That`
			
			// **** Then events! ****

			// This is an example of a closure!
			// Right here "this" means the CanvasState. But we are making events on the Canvas itself,
			// and when the events are fired on the canvas the variable "this" is going to mean the canvas!
			// Since we still want to use this particular CanvasState in the events we have to save a reference to it.
			// This is our reference!
			var myState = this;
			gCanState = myState;
			
			//fixes a problem where double clicking causes text to get selected on the canvas
			canvas.addEventListener('selectstart', function (e) {
				e.preventDefault();
				return false;
			}, false);
			
			// keyevent listener
			window.addEventListener('keyup', function(e) {
				console.log('keyup:', e);
				switch (e.key) {
					case 'Delete':
					
							if (!myState.dragging && !myState.resizing) {
								switch (gPaletteLive.state.sToolLabel) {
									case 'Select':
									case 'Shapes':
											if (myState.selection) {
												myState.selection.delete();
												myState.selection = null;
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
			}, false);
			
			// Up, down, and move are for dragging
			canvas.addEventListener('mousedown', function (e) {
				var mouse = myState.getMouse(e);
				var mx = mouse.x;
				var my = mouse.y;
				
				myState.downx = mx;
				myState.downy = my;
				
				return; // :debug:
				
				var tool = gPaletteLive.state.sToolLabel;
				switch (tool) {
					case 'Select':
					
							var cutouts = myState.cutouts;
							var l = cutouts.length;
							for(var i = l - 1; i >= 0; i--) {
								if(cutouts[i].contains(mx, my)) {
									var mySel = cutouts[i];
									// noit: move this shape to the top in the z-index
									cutouts.push(cutouts.splice(i, 1)[0]);
									
									// Keep track of where in the object we clicked
									// so we can move it smoothly (see mousemove)
									myState.dragoffx = mx - mySel.x;
									myState.dragoffy = my - mySel.y;
									myState.dragging = true;
									myState.selection = mySel;
									myState.valid = false;
									return;
								}
							}
							// havent returned means we have failed to select anything.
							// If there was an object selected, we deselect it
							if(myState.selection) {
								myState.selection = null;
								myState.valid = false; // Need to clear the old selection border
								// return; // dont start the draw, as we just want to do a deselect // link938383
							}
							
							// // did not select, OR deselect, so start draw
							// did not select (it is possible that they possibly deselected as i dont return on link938383)
							// not yet supporting multiple Cutouts, otherwise i would check for e.shiftKey e.altKey if they want to add or remove
							if (myState.cutouts.length) {
								myState.cutouts.length = 0;
								myState.valid = false;
							}
							myState.selection = new Cutout(mx, my, 0, 0);
							myState.addCutout(myState.selection);
							myState.resizing = true;
							
						break;
					case 'Shapes':
					
							var shapes = myState.shapes;
							var l = shapes.length;
							for(var i = l - 1; i >= 0; i--) {
								if(shapes[i].contains(mx, my)) {
									var mySel = shapes[i];
									// noit: move this shape to the top in the z-index
									shapes.push(shapes.splice(i, 1)[0]);
									
									// Keep track of where in the object we clicked
									// so we can move it smoothly (see mousemove)
									myState.dragoffx = mx - mySel.x;
									myState.dragoffy = my - mySel.y;
									myState.dragging = true;
									myState.selection = mySel;
									myState.valid = false;
									return;
								}
							}
							// havent returned means we have failed to select anything.
							// If there was an object selected, we deselect it
							if(myState.selection) {
								myState.selection = null;
								myState.valid = false; // Need to clear the old selection border
								return; // dont start the draw, as we just want to do a deselect
							}
							
							// did not select, OR deselect, so start draw
							myState.selection = new Shape(mx, my, 0, 0);
							myState.addShape(myState.selection);
							myState.resizing = true;
					
						break;
					default:
						// do nothing
				}
			}, true);
			canvas.addEventListener('mousemove', function (e) {
				return; // :debug:
				var mouse = myState.getMouse(e);
				var mx = mouse.x;
				var my = mouse.y;
				
				var tool = gPaletteLive.state.sToolLabel;
				switch (tool) {
					case 'Select':
							if (myState.dragging) {
								myState.selection.x = mx - myState.dragoffx;
								myState.selection.y = my - myState.dragoffy;
								myState.valid = false; // Something's dragging so we must redraw
							} else if (myState.resizing) {
								myState.selection.w = mx - myState.downx;
								myState.selection.h = my - myState.downy;
								myState.valid = false;
							}
							
						break;
					case 'Shapes':
					
							if (myState.dragging) {
								// We don't want to drag the object by its top-left corner, we want to drag it
								// from where we clicked. Thats why we saved the offset and use it here
								myState.selection.x = mx - myState.dragoffx;
								myState.selection.y = my - myState.dragoffy;
								myState.valid = false; // Something's dragging so we must redraw
							} else if (myState.resizing) {
								myState.selection.w = mx - myState.downx;
								myState.selection.h = my - myState.downy;
								myState.valid = false;
							}
					
						break;
					default:
						// do nothing
				}
				
			}, true);
			canvas.addEventListener('mouseup', function (e) {
				return; // :debug:
				var tool = gPaletteLive.state.sToolLabel;
				switch (tool) {
					case 'Select':
					
							if (myState.dragging) {
								myState.dragging = false;
							} else if (myState.resizing) {
								if (!myState.selection.w || !myState.selection.h) {
									console.log('myState.selection has no width or height! so deleting it');
									myState.selection.delete();
									// .delete will set state to invalid, if there was a width/height but there obviously wasnt
								} else {
									// make the values positive
									makeDimsPositive(myState.selection); // no need to set valid=false
								}
								myState.resizing = null;
							}
					
						break;
					case 'Shapes':
					
							if (myState.dragging) {
								myState.dragging = false;
							} else if (myState.resizing) {
								if (!myState.selection.w || !myState.selection.h) {
									console.log('myState.selection has no width or height! so deleting it');
									myState.selection.delete();
									// .delete will set state to invalid, if there was a width/height but there obviously wasnt
								} else {
									// make the values positive
									makeDimsPositive(myState.selection); // no need to set valid=false
								}
								myState.resizing = null;
							}
					
						break;
					default:
						// do nothing
				}
			}, true);
			// double click for making new shapes
			canvas.addEventListener('dblclick', function (e) {
				var mouse = myState.getMouse(e);
				myState.addDrawable(new Drawable(mouse.x - monToMultiMon.w(10), mouse.y - monToMultiMon.h(10), monToMultiMon.w(20), monToMultiMon.h(20), 'rect', {fillStyle:'rgba(0,255,0,.6)')});
			}, true);

			// **** Options! ****
			this.Style = {
				Draw: {
					line: {
						lineWidth: monToMultiMon.w(2),
						strokeStyle: 'rgba(0, 0, 255, 1)'
					},
					fill: {
						fillStyle: 'rgba(100, 149, 237, 0.6)'
					},
					dim: {
						fillStyle: 'rgba(0, 0, 0, 0.6)',
					}
				},
				Select: {
					cutout: {
						strokeStyle: 'rgba(0, 0, 255, 1)'
						setLineDash: [0, monToMultiMon.w(3), 0],
						lineWidth: monToMultiMon.w(1)
					},
					shape: {
						lineWidth: monToMultiMon.w(3),
						setLineDash: [0],
						strokeStyle: 'red'
					}
				}
			};
			
			this.interval = 30;
			setInterval(function () {
				myState.draw();
			}, this.interval);
		}
		
		// Add it to the context
		CanvasState.prototype.addDrawable = function (drawable) {
			var drawables = this.drawables;
			switch (drawable.name) {
				case 'dim':
					
						return; // not added to list
					
					break;
				default:
					drawables.push(drawable);
					if (drawable.w && drawable.h) {
						this.valid = false;
					} // else the width and height are 0, no need to invalidate
			}
		}

		// Delete it from the context
		CanvasState.prototype.removeDrawable = function(drawable) {			
			var drawables = this.drawables;
			switch (drawable.name) {
				case 'dim':
					
						return; // not added to list
					
					break;
				default:
					drawables.splice(drawables.indexOf(drawable), 1);
					if (drawable.w && drawable.h) {
						this.valid = false;
					} // else the width and height are 0, no need to invalidate
			}
		}

		// Deletes everything on the canvas
		CanvasState.prototype.clear = function () {
			this.ctx.clearRect(0, 0, this.width, this.height);
		}

		// While draw is called as often as the INTERVAL variable demands,
		// It only ever does something if the canvas gets invalidated by our code
		CanvasState.prototype.draw = function () {
			// if our state is invalid, redraw and validate!
			if(!this.valid) {
				var ctx = this.ctx;
				this.clear();

				// ** Add stuff you want drawn in the background all the time here **
								
				// draw all drawables
				var drawables = this.drawables;
				var l = drawables.length;
				for(var i = 0; i < l; i++) {
					var drawable = drawables[i];
					if (drawable.name == 'cutout') {
						// this is drawn as negative space with `this.dim.draw()`
						continue;
					}
					
					// We can skip the drawing of elements that have moved off the screen:
					if(drawable.x > this.width || drawable.y > this.height ||
						drawable.x + drawable.w < 0 || drawable.y + drawable.h < 0) continue;
					drawable.draw(ctx);
				}

				// draw selection
				if(this.selection != null) {
					if (this.selection.w && this.selection.h) {
						this.selection.select();
					}
				}

				// ** Add stuff you want drawn on top all the time here **

				// draw the dim
				this.dim.draw(ctx);
				
				this.valid = true;
			}
		}


		// Creates an object with x and y defined, set to the mouse position relative to the state's canvas
		// If you wanna be super-correct this can be tricky, we have to worry about padding and borders
		CanvasState.prototype.getMouse = function (e) {
			var element = this.canvas,
				offsetX = 0,
				offsetY = 0,
				mx, my;

			// noit: i dont need this
			// // Compute the total offset
			// if(element.offsetParent !== undefined) {
			// 	do {
			// 		offsetX += element.offsetLeft;
			// 		offsetY += element.offsetTop;
			// 	} while ((element = element.offsetParent));
			// }

			// // Add padding and border style widths to offset
			// // Also add the <html> offsets in case there's a position:fixed bar
			// offsetX += this.stylePaddingLeft + this.styleBorderLeft + this.htmlLeft;
			// offsetY += this.stylePaddingTop + this.styleBorderTop + this.htmlTop;

			// mx = e.pageX - offsetX;
			// my = e.pageY - offsetY;
			
			mx = monToMultiMon.x(e.screenX);
			my = monToMultiMon.y(e.screenY);
			
			// console.log('e.screenX:', e.screenX, 'e.pageX:', e.pageX, 'mx:', mx);

			// We return a simple javascript object (a hash) with x and y defined
			return {
				x: mx,
				y: my
			};
		}
	// CODE FOR MOUSE EVENTS

	
	// CODE FOR DRAWING THE OBJECTS AS THEY ARE MADE AND MOVE AROUND
		// Constructor for the Drawable object
		function Drawable(x, y, w, h, name, aOptions) {
			/* valid name's
				rect,
				rectround
				oval
				dim
				cutout
			*/
			
			// set dimensions
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
				case 'rect':
				case 'rectround':
				case 'oval':
					
						this.Style = {
							Draw: {
								me: {
									fillStyle: aOptions.fillStyle || gCanState.Style.Draw.fill.fillStyle,
									strokeStyle: aOptions.strokeStyle || gCanState.Style.Draw.line.strokeStyle,
									setLineDash: aOptions.setLineDash || gCanState.Style.Draw.line.setLineDash
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
		}
		
		// Draws this shape to a given context
		Drawable.prototype.draw = function(ctx) {
			// set styles
			var curStyle;
			switch (this.name) {
				case 'dim':
					
						curStyle = gCanState.Style.Draw.dim;
					
					break;
				case 'rect':
				case 'rectround':
				case 'oval':
				
						curStyle = this.Style.Draw.me;
				
					break;
				default:
					// not drawable
					return;
			}
			
			// got here so curStyle exists meaning it does get drawn - yeah i know the whole "Drawable" is misleading, some "Drawable's" are not drawn
			applyCtxStyle(curStyle);
			
			// draw it
			switch (this.name) {
				case 'dim':

						var cutouts = gCanState.cutouts;
						if (!cutouts.length) {
							ctx.fillRect(0, 0, gQS.w, gQS.h);
						} else {
							
							// build cutoutsUnionRect
							var cutoutsUnionRect;
							for (var i=0; i<cutouts.length; i++) {
								var cutoutClone = makeDimsPositive(cutouts[i], true);
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
								ctx.fillRect(dimRects[i].x, dimRects[i].y, dimRects[i].width, dimRects[i].height);
							}
						}
				
					break;
				case 'rect':
				
						ctx.fillRect(this.x + this.Style.Draw.me.lineWidth, this.y + this.Style.Draw.me.lineWidth, this.w - this.Style.Draw.me.lineWidth, this.h -  this.Style.Draw.me.lineWidth);
						ctx.strokeRect(this.x + this.Style.Draw.me.lineWidth, this.y + this.Style.Draw.me.lineWidth, this.w - this.Style.Draw.me.lineWidth, this.h -  this.Style.Draw.me.lineWidth);
					
					break;
				default:
					// should never get here, as would have returned earlier, as this one is not drawable
			}
			
			gCanState.valid = false;
		};
		
		// Determine if a point is inside the Drawable's bounds
		Drawable.prototype.contains = function (mx, my) {
			switch (this.name) {
				default:
					// All we have to do is make sure the Mouse X,Y fall in the area between
					// the shape's X and (X + Width) and its Y and (Y + Height)
					return(this.x <= mx) && (this.x + this.w >= mx) &&
						(this.y <= my) && (this.y + this.h >= my);
			}
		}
		
		// User clicked it for either dragging, resizing, or [i dont know yet but definitely for other things during selection]
		Drawable.prototype.select = function() {
			// set styles
			var curStyle;
			switch (this.name) {
				case 'cutout':
					
						curStyle = gCanState.Style.Select.cutout;
					
					break;
				case 'rect':
				case 'rectround':
				case 'oval':
				
						curStyle = this.Style.Select.shape;
				
					break;
				default:
					// not selectable
					return;
			}
			
			// got here so curStyle exists meaning it does get drawn - yeah i know the whole "Drawable" is misleading, some "Drawable's" are not drawn
			applyCtxStyle(curStyle);
			
			// draw the selection of it
			switch (this.name) {
				case 'dim':

						var cutouts = gCanState.cutouts;
						if (!cutouts.length) {
							// no selection
						} else {
							
							// build cutoutsUnionRect
							var cutoutsUnionRect;
							for (var i=0; i<cutouts.length; i++) {
								var cutoutClone = makeDimsPositive(cutouts[i], true);
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
				case 'rect':
				case 'rectround':
				case 'oval':
				
						ctx.strokeRect(this.x, this.y, this.w, this.h);
					
					break;
				default:
					// should never get here, as would have returned earlier, as this one is not drawable
			}
			gCanState.valid = false;
		};

		function makeDimsPositive(aDrawnObject, notByRef) {
			// aDrawObject is Shape, Cutout, 
				// it has x, y, w, h
			// if the w or h are negative, then it makes the w and h positive and adjusts the x y respectively
			if (notByRef) {
				aDrawnObject = {
					x: aDrawnObject.x,
					y: aDrawnObject.y,
					w: aDrawnObject.w,
					h: aDrawnObject.h,
				}
			}
			
			if (aDrawnObject.w < 0) {
				aDrawnObject.x += aDrawnObject.w;
				aDrawnObject.w *= -1;
			}

			if (aDrawnObject.h < 0) {
				aDrawnObject.y += aDrawnObject.h;
				aDrawnObject.h *= -1;
			}
			
			return aDrawnObject;
		}
		
		function applyCtxStyle(aCtx, aStyleObj) {
			// aStyleObj is an object with keys that are properties/methods of aCtx
			for (var p in aStyleObj) {
				if (p.indexOf('set') === 0) {
					// its a func
					aCtx[p].apply(aCtx, aStyleObj[p]);
				} else {
					// else its an attribute
					aCtx[p] = aStyleObj[p];
				}
			}			
		}

// end - canvas functions

var monToMultiMon = {
	// aX is the x on the current monitor (so 0,0 is the top left of the current monitor) - same for aY
	x: function(aX) {
		return gQS.win81ScaleX ? Math.ceil(gQS.x + ((aX - gQS.x) * gQS.win81ScaleX)) : aX;
	},
	y: function(aY) {
		return gQS.win81ScaleY ? Math.ceil(gQS.y + ((aY - gQS.y) * gQS.win81ScaleY)) : aY
	},
	w: function(aW) {
		// width
		return gQS.win81ScaleX ? Math.ceil(aW * gQS.win81ScaleX) : aW;
	},
	h: function(aH) {
		// width
		return gQS.win81ScaleY ? Math.ceil(aH * gQS.win81ScaleY) : aH;
	},
	obj: function(aCoord) {
		// aCoord has a x and a y
		aCoord.x = gQS.win81ScaleX ? Math.ceil(gQS.x + ((aX - gQS.x) * gQS.win81ScaleX)) : aX;
		aCoord.y = gQS.win81ScaleY ? Math.ceil(gQS.y + ((aY - gQS.y) * gQS.win81ScaleY)) : aY;
	},
	// ctxFunc: function(aFuncName, aFuncArgs, )
}
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
		r: parseInt(aHexStr).substring(0,2),16),
		g: parseInt(aHexStr).substring(2,4),16),
		b: parseInt(aHexStr).substring(4,6),16)
	}
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