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
var gCState;
var gZState;
var gColorPickerSetState = {NativeShotEditor:null};
var gFonts;
var gInputNumberId = 0;
var gDroppingCoords = [0,0];
var gDroppingMixCtx;

function unload() {
	// if iMon == 0
	// set the new state object from react to file
	if (gQS.iMon === 0) {
		console.error('sending state object:', gCState.rconn.state);
		var immutableEditorstate = JSON.parse(JSON.stringify(gCState.rconn.state));
		for (var p in immutableEditorstate) {
			if (p.indexOf('sGen') !== 0) {
				var newP = 'p' + p.substr(1); // change first char
				immutableEditorstate[newP] = immutableEditorstate[p];
			}
			delete immutableEditorstate[p];
		}
		
		Services.obs.notifyObservers(null, core.addon.id + '_nativeshot-editor-request', JSON.stringify({
			topic: 'updateEditorState',
			editorstateStr: JSON.stringify(immutableEditorstate),
			iMon: 0
		}));
	}
}

function init(aArrBufAndCore) {
	// console.log('in screenshotXfer, aArrBufAndCore:', aArrBufAndCore);
	
	core = aArrBufAndCore.core;
	gFonts = aArrBufAndCore.fonts;
	var palLayout = [ // the tools and order they should show in
		{
			// Handle - from where user can drag palette around
			label: undefined, // for non-special, this is the text cloud that shows on hover
			sub: undefined, // for non-special, this is the submenu items shown on hover. an array of objects
			icon: undefined, // for non-special, the icon that
			special: 'Handle', // this key is for special things that have their own React class
			props: ['sPalX', 'sPalY'], // props needed from the react component
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
			icon: '\ue82c', // the fontello font code
			sub: [
				{
					label: 'Last Selection',
					icon: '\ue82e',
					unfixable: true
				}
			],
			options: ['DimensionTools']
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
					icon: '\ue800',
					options: ['Color']
				},
				{
					label: 'Marker', // this just its own remembered color and transparency - otherwise its a copy of pencil - im thinking cap the opacity at 10% - 90%
					icon: 'S',
					options: ['Marker Color']
				}
			],
			options: ['LineTools']
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
			],
			options: ['Color', 'Fill Color', 'LineTools', 'DimensionTools']
		},
		{
			label: 'Line',
			icon: '\ue831',
			options: ['Color', 'LineTools', 'ArrowTools']
		},
		{
			label: 'Text', // if click with this tool, then its free type. if click and drag then its contained. if contained, then show sPalFontWrap option
			icon: 'S',
			options: ['TextTools', 'Fill Color']
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
			],
			options: ['BlurTools']
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
					props: {sColor:'sPalLineColor', sAlpha:'sPalLineAlpha', pSetStateName:'$string$NativeShotEditor', pStateAlphaKey:'$string$sPalLineAlpha', pStateColorKey:'$string$sPalLineColor', sGenColorPickerDropping:'sGenColorPickerDropping', sHistory:'sPalBothColorHist', pStateHistoryKey:'$string$sPalBothColorHist'}
				}
			],
			isOption: true
		},
		{
			label: 'Marker Color',
			icon: 'S',
			justClick: true,
			sub: [
				{
					special: 'ColorPicker',
					props: {sColor:'sPalMarkerColor', sAlpha:'sPalMarkerAlpha', pSetStateName:'$string$NativeShotEditor', pStateAlphaKey:'$string$sPalMarkerAlpha', pStateColorKey:'$string$sPalMarkerColor', sGenColorPickerDropping:'sGenColorPickerDropping', sHistory:'sPalMarkerColorHist', pStateHistoryKey:'$string$sPalMarkerColorHist'}
				}
			],
			isOption: true
		},
		{
			special: 'LineTools',
			justClick: true,
			isOption: true,
			props: ['sPalLineWidth']
		},
		{
			special: 'ArrowTools',
			icon: 'S',
			justClick: true,
			isOption: true,
			props: ['sPalArrowStart', 'sPalArrowEnd', 'sPalArrowLength']
		},
		{
			label: 'Fill Color',
			icon: 'S',
			justClick: true,
			sub: [
				{
					special: 'ColorPicker',
					props: {sColor:'sPalFillColor', sAlpha:'sPalFillAlpha', pSetStateName:'$string$NativeShotEditor', pStateAlphaKey:'$string$sPalFillAlpha', pStateColorKey:'$string$sPalFillColor', sGenColorPickerDropping:'sGenColorPickerDropping', sHistory:'sPalBothColorHist', pStateHistoryKey:'$string$sPalBothColorHist'}
				}
			],
			isOption: true
		},
		{
			special: 'DimensionTools',
			justClick: true,
			isOption: true,
			props: ['sGenPalW', 'sGenPalH']
		},
		{
			special: 'TextTools',
			justClick: true,
			isOption: true,
			props: ['sPalFontSize', 'sPalFontFace', 'sPalFontBold', 'sPalFontItalic', 'sPalFontUnderline']
		},
		{
			special: 'BlurTools',
			justClick: true,
			isOption: true,
			props: ['sGenPalTool', 'sPalSeldSubs', 'sPalBlurBlock', 'sPalBlurRadius', 'sGenInputNumberMousing']
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
				// general - these should not be synced to file of editor state
				sGenInputNumberMousing: null, // when mousing, this is set to string of what the cursor should be
				sGenColorPickerDropping: null, // when in drop, it is set to an object {pStateColorKey:'sPalLineColor',initColor:}
				sGenCanMouseMoveCursor: null,
				sGenPalDragStart: null, // is null when not dragging. when dragging it is {screenX:, screenY:}
				sGenPalZoomViewDragStart: null, // is null when not dragging. when dragging it is {screenX, screenY, initX, initY}
				sGenPalTool: 'Select', // the label of the currently active tool
				sGenPalW: 0, // width
				sGenPalH: 0, // height
				
				// all these keys below should be synced to fill of editor state
				
				// canvas realted
				sCanHandleSize: this.props.pCanHandleSize,
				
				// palette related
				sPalSize: this.props.pPalSize,
				sPalSeldSubs: this.props.pPalSeldSubs, // object holding the active sub for each tool label. so key is tool label. value is label of selected sab
				sPalMultiDepresses: this.props.pPalMultiDepresses,
				sPalX: 5, // :todo: get this from prefs
				sPalY: 75, // :todo: get this from prefs

				sPalLineColor: this.props.pPalLineColor,
				sPalLineAlpha: this.props.pPalLineAlpha,
				sPalFillColor: this.props.pPalFillColor,
				sPalFillAlpha: this.props.pPalFillAlpha,
				sPalMarkerColor: this.props.pPalMarkerColor,
				sPalMarkerAlpha: this.props.pPalMarkerAlpha,
				sPalMarkerColorHist: this.props.pPalMarkerColorHist,
				sPalBothColorHist: this.props.pPalBothColorHist,
				
				sPalBlurBlock: this.props.pPalBlurBlock,
				sPalBlurRadius: this.props.pPalBlurRadius,
				
				sPalArrowLength: this.props.pPalArrowLength,
				sPalArrowEnd: this.props.pPalArrowEnd,
				sPalArrowStart: this.props.pPalArrowStart,
				
				sPalZoomViewCoords: this.props.pPalZoomViewCoords,
				sPalZoomViewLevel: this.props.pPalZoomViewLevel,
				
				sPalLineWidth: this.props.pPalLineWidth,
				
				sPalFontSize: this.props.pPalFontSize,
				sPalFontFace: this.props.pPalFontFace,
				sPalFontBold: this.props.pPalFontBold,
				sPalFontItalic: this.props.pPalFontItalic,
				sPalFontUnderline: this.props.pPalFontUnderline
			};
		},
		componentDidMount: function() {
			gEditorStore.setState = this.setState.bind(this); // need bind here otherwise it doesnt work - last tested in React 0.14.x
			gColorPickerSetState.NativeShotEditor = this.setState.bind(this);

			///////////
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
			this.cstate.lining = false; // when picking new end points for a line
			this.cstate.pathing = null; // when drawing with pencil or marker // it is set to a an array of 2 points when not null
			this.cstate.typing = false;
			this.cstate.selection = null;
			this.cstate.selectionHandles = [];
			
			this.cstate.dragoffx = 0; // See mousedown and mousemove events for explanation
			this.cstate.dragoffy = 0;
			
			this.cstate.downx = 0; // when the user mouses down on canvas
			this.cstate.downy = 0; // when the user mouses down on canvas
			
			// **** Options! ****
			// now that Style is setup, i can add Drawable's
			// (new this.Drawable(this.mtmm.x(500), this.mtmm.y(10), this.mtmm.w(100), this.mtmm.h(100), 'Rectangle')).add();
			// (new this.Drawable(this.mtmm.x(500), this.mtmm.y(10), this.mtmm.w(100), this.mtmm.h(100), 'cutout')).add();
			// (new this.Drawable(this.mtmm.x(400), this.mtmm.y(50), this.mtmm.w(100), this.mtmm.h(100), 'cutout')).add();
			
			// (new this.Drawable(this.mtmm.x(500), this.mtmm.y(500), null, null, 'Line', {x2:100, y2:100})).add();
			
			this.cstate.dim = new this.Drawable(null, null, null, null, 'dim');
			
			window.addEventListener('mousemove', this.mousemove, false);
			window.addEventListener('mousedown', this.mousedown, false);
			window.addEventListener('mouseup', this.mouseup, false);
			window.addEventListener('keyup', this.keyup, false);
			window.addEventListener('keydown', this.keydown, false);
			window.addEventListener('dblclick', this.dblclick, false);
			
			this.cstate.interval = setInterval(this.draw, this.props.pCanInterval);
			// start - simon canvas stuff
			///////////
			
			// add listeners
			window.addEventListener('wheel', this.wheel, false);
		},
		componentDidUpdate: function(prevProps, prevState) {
			if (this.cstate && this.cstate.valid) {
				var canValid = true;
				
				if (this.cstate.selection) {
					// if changed stuff affects canvas
					// color is now set by the color widgets. arrow by arrow widget etc.
					var affectsStateVars = {
						handle: ['sCanHandleSize'],
						// fillcolor: ['sPalFillColor', 'sPalFillAlpha'],
						// linecolor: ['sPalLineColor', 'sPalLineAlpha'],
						// linewidth: [],
						// linestyle: [],
						// arrows: []
					};
					var affects = {
						handle: true,
						// fillcolor: false,
						// linecolor: false,
						// linewidth: false,
						// linestyle: false,
						// arrows: false
					};
					// switch (this.cstate.selection.name) {
					// 	case 'Rectangle':
					// 	case 'Oval':
					// 			
					// 			affects.fillcolor = true;
					// 			affects.linecolor = true;
					// 			affects.linewidth = true;
					// 			affects.linestyle = true;
					// 			
					// 		break;
					// 	case 'Line':
					// 			
					// 			affects.fillcolor = true;
					// 			affects.linecolor = true;
					// 			affects.linewidth = true;
					// 			affects.linestyle = true;
					// 			affects.arrows = true;
					// 			
					// 		break;
					// 	default:
					// 		// none
					// }
					
					affectsFor:
					for (var p in affects) {
						if (affects[p]) {
							var cStateVars = affectsStateVars[p];
							var l = cStateVars.length;
							for (var i=0; i<l; i++) {
								var cVarName = cStateVars[i];
								if (prevState[cVarName] != this.state[cVarName]) {
									canValid = false;
									break affectsFor;
								}
							}
						}
					}
				}
				
				this.cstate.valid = canValid;
			}
			//if (this.state.sPalMultiDepresses['Zoom View'] != prevState.sPalMultiDepresses['Zoom View']) {
			//	if (this.state.sPalMultiDepresses['Zoom View']) {
			//		alert('adding wheel');
			//		window.addEventListener('wheel', this.wheel, false);
			//	} else {
			//		alert('removing wheel');
			//		window.removeEventListener('wheel', this.wheel, false);
			//	}
			//}
		},
		////// start - canvas functions
		Drawable: function(x, y, w, h, name, aOptions={}) {

			// set obj props
			this.name = name;
			//this.id = (new Date()).getTime();
			
			// set rest
			switch (name) {
				case 'dim':
					
						// dimensions
						this.x = 0;
						this.y = 0;
						this.w = gQS.w;
						this.h = gQS.h;
						
						// styleables (are a property on ctx like ctx.fillStyle or ctx.setLineDash) if undefined, that it is populated with respect to toolbar
						this.fillStyle = 'rgba(0, 0, 0, 0.6)';
					
					break;
				case 'Line':
				
						// dimensions
						this.x = x;
						this.y = y;
						this.x2 = 'x2' in aOptions ? aOptions.x2 : x;
						this.y2 = 'y2' in aOptions ? aOptions.y2 : y;
						
						// other props
						this.arrowStart = aOptions.arrowStart || gCState.rconn.state.sPalArrowStart;
						this.arrowEnd = aOptions.arrowEnd || gCState.rconn.state.sPalArrowEnd;
						this.arrowLength = aOptions.arrowLength || gCState.rconn.state.sPalArrowLength;
						
						// styleables - if undefined, then it is set to the default value with respect to pal
						this.lineWidth = aOptions.lineWidth; // lineWidth is not set, then it is undefined, and then setStyleablesDefaults will set it to the default value, which respects pal
						this.strokeStyle = aOptions.strokeStyle;
						this.fillStyle = this.strokeStyle; // needed for drawing arrow
						this.setLineDash = aOptions.setLineDash;
						this.lineJoin = aOptions.lineJoin;
				
					break;
				case 'Pencil':
				case 'Marker':
				
						// has to be drawn, i dont allow constructing this with predefiend path. as in i dont offer aOptions.path
						this.path = [x, y];
						
						// styleables
						this.lineWidth = aOptions.lineWidth;
						this.strokeStyle = aOptions.strokeStyle;
						this.setLineDash = aOptions.setLineDash;
						this.lineJoin = aOptions.lineJoin;
				
					break;
				case 'Text':
				
						// dimensions
						this.x = x;
						this.y = y;
						
						// others
						this.chars = '';
						this.index = 0; // the position of the ibeam
						this.fontsize = aOptions.fontsize; // must be a integer. no 'px' but it is assumed as px and used as such throughout
						this.fontface = aOptions.fontface;
						this.fontbold = aOptions.fontbold;
						this.fontitalic = aOptions.fontitalic;
						this.linespacing = 1;
						
						// styleables
						this.fillStyle = aOptions.fillStyle;
						this.textAlign = aOptions.textAlign;
						this.font = undefined; // i need to set it to undefined otherwise setStyleablesDefaults will not set it // user should only set fontsize,fontface,fontbold,fontitalic. the .font will be calculated by setStyleablesDefaults
				
					break;
				case 'Gaussian':
					
						// dimensions
						this.x = x;
						this.y = y;
						this.w = w;
						this.h = h;
						
						// other
						this.level = aOptions.level || gCState.rconn.state.sPalBlurRadius
						
					break;
				case 'Mosaic':
					
						// dimensions
						this.x = x;
						this.y = y;
						this.w = w;
						this.h = h;
						
						// other
						this.level = aOptions.level || gCState.rconn.state.sPalBlurBlock;
				
				case 'cutout':
					
						// dimensions
						this.x = x;
						this.y = y;
						this.w = w;
						this.h = h;
						
					break;
				case 'Rectangle':
				case 'Oval':
					
						// dimensions
						this.x = x;
						this.y = y;
						this.w = w;
						this.h = h;
						
						// styleables
						this.fillStyle = undefined;
						this.strokeStyle = undefined;
						this.lineWidth = undefined;
						this.setLineDash = undefined;
						this.lineJoin = undefined;
					
					break;
				default:
					console.error('no props specified for a drawable with name "' + this.name + '"');
					throw new Error('no props specified for a drawable with name "' + this.name + '"');
			}
			
			// set styleables
			gCState.rconn.setStyleablesDefaults(this);
			
			this.draw = function(ctx) {
				// returns the value i should set gCState.valid to
				
				if (['cutout'].indexOf(this.name) > -1) {
					// not drawable
					console.error('trying to draw an undrawable, this:', this);
					return true;
				}
				
				// do check if it no select should be drawn, if it has 0 dimensions:
				if (('w' in this && !this.w) || ('h' in this && !this.h)) {
				// if (this.name != 'dim' && this.name != 'Line' && !this.w && !this.h) {
					console.error('width or height is 0 so not drawing');
					return true;
				}
				
				// style the ctx
				// console.log('applying styles of this:', this);
				gCState.rconn.applyCtxStyle(this); // whatever keys exist that are in styleables will be styled to ctx
				
				// draw it
				switch (this.name) {
					case 'dim':

							var cutouts = gCState.drawables.filter(function(aToFilter) { return aToFilter.name == 'cutout' });
							if (!cutouts.length) {
								ctx.fillRect(0, 0, this.w, this.h);
							} else {
								
								var fullscreenRect = new Rect(0, 0, this.w, this.h);
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
					
							ctx.fillRect(this.x, this.y, this.w, this.h);
							if (this.lineWidth > 0) {
								ctx.strokeRect(this.x, this.y, this.w, this.h);
							}
						
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
							if (this.lineWidth > 0) {
								ctx.stroke();
							}
						
						break;
					case 'Line':
						
							ctx.beginPath();
							ctx.moveTo(this.x, this.y);
							ctx.lineTo(this.x2, this.y2);
							ctx.stroke();

							if (this.arrowEnd) {
								// end arrow
								canvas_arrow(ctx, this.x, this.y, this.x2, this.y2, this.arrowLength);
							}
							
							if (this.arrowStart) {
								// start arrow
								canvas_arrow(ctx, this.x2, this.y2, this.x, this.y, this.arrowLength)
							}
						
						break;
					case 'Pencil':
					case 'Marker':
						
							ctx.beginPath();
							ctx.moveTo(this.path[0], this.path[1]);
							for (var i=2; i<this.path.length; i+=2) {
								ctx.lineTo(this.path[i], this.path[i+1]);
							}
							ctx.stroke();
						
						break;
					case 'Text':
					
							ctx.fillText(this.chars, this.x, this.y);
					
						break;
					case 'Gaussian':
						
							var positived = gCState.rconn.makeDimsPositive(this, true);
							
							var level = this.level; // gCState.rconn.state.sPalBlurRadius;
							
							// get section of screenshot
							var srcImgData = gCState.rconn.ctx0.getImageData(positived.x, positived.y, positived.w, positived.h);
							
							// apply filter
							imagedata.gaussian_blur(srcImgData, positived.w, positived.h, {
								radius: level
							});
							
							// draw it
							ctx.putImageData(srcImgData, positived.x, positived.y);
						
						break;
					case 'Mosaic':
						
							var positived = gCState.rconn.makeDimsPositive(this, true);
							
							var level = this.level;
							
							// get section of screenshot
							var srcImgData = gCState.rconn.ctx0.getImageData(positived.x, positived.y, positived.w, positived.h);
							
							// apply filter
							imagedata.pixelate(srcImgData, positived.w, positived.h, {
								blockSize: level
							});
							
							// draw it
							ctx.putImageData(srcImgData, positived.x, positived.y);
						
						break;
					default:
						// should never get here, as would have returned earlier, as this one is not drawable
				}
				
				return false;
			};
			
			this.select = function(ctx) {
				// returns the valid value
				
				// console.error('doing select for drawable:', this);
				// set styles - and determine if its selectable
				var curStyle;
				switch (this.name) {
					case 'cutout':
						
							curStyle = {
								lineWidth: 1,
								setLineDash: [0, gCState.rconn.mtmm.w(3), 0],
								strokeStyle: 'black'
							};
						
						break;
					case 'Rectangle':
					case 'Oval':
					case 'Gaussian':
					case 'Mosaic':
					
							curStyle = {
								lineWidth: 1,
								setLineDash: [0, gCState.rconn.mtmm.w(3), 0],
								strokeStyle: 'black'
							};
					
						break;
					case 'Line':
					case 'Pencil':
					case 'Marker':
					
							curStyle = {
								strokeStyle: '#ffffff',
								setLineDash: [],
								lineWidth: 1,
								fillStyle: '#000000'
							};
					
						break;
					case 'Text':
						
							curStyle = {
								strokeStyle: 'black',
								setLineDash: [0, gCState.rconn.mtmm.w(3), 0],
								lineWidth: gCState.rconn.mtmm.w(1)
							};
						
						break;
					default:
						// not selectable
							// dim
						console.warn('this drawable is NOT selectable! tried to select a drawable with name:', this.name, 'drawable obj:', this);
						return true; // so no need to invalidate
				}
				
				// do check if it no select should be drawn, if it has 0 dimensions:
				if (('w' in this && !this.w) || ('h' in this && !this.h)) {
				// if (this.name != 'dim' && this.name != 'Line' && !this.w && !this.h) {
					console.error('width or height is 0 so not drawing');
					return true;
				}
				
				// got here so curStyle exists meaning it does get drawn - yeah i know the whole "Drawable" is misleading, some "Drawable's" are not drawn
				gCState.rconn.applyCtxStyle(curStyle);
				
				// draw the selection of it
				switch (this.name) {
					case 'cutout':
					case 'Rectangle':
					case 'Oval':
					case 'Gaussian':
					case 'Mosaic':
					
							ctx.strokeRect(this.x, this.y, this.w, this.h);
							
							// draw handles
							var handleSize = gCState.rconn.state.sCanHandleSize;
							var half = handleSize / 2;
							
							var selectionHandles = gCState.selectionHandles;
							
							// top left, middle, right
							selectionHandles[0] = {
								x: this.x-half,
								y: this.y-half
							};
							
							selectionHandles[1] = {
								x: this.x+this.w/2-half,
								y: this.y-half
							};
							
							selectionHandles[2] = {
								x: this.x+this.w-half,
								y: this.y-half
							};
							
							//middle left
							selectionHandles[3] = {
								x: this.x-half,
								y: this.y+this.h/2-half
							};
							
							//middle right
							selectionHandles[4] = {
								x: this.x+this.w-half,
								y: this.y+this.h/2-half
							};
							
							//bottom left, middle, right
							selectionHandles[6] = {
								x: this.x+this.w/2-half,
								y: this.y+this.h-half
							};
							
							selectionHandles[5] = {
								x: this.x-half,
								y: this.y+this.h-half
							};
							
							selectionHandles[7] = {
								x: this.x+this.w-half,
								y: this.y+this.h-half
							};
							
							ctx.fillStyle = '#000000';
							ctx.setLineDash([]);
							ctx.strokeStyle = '#ffffff';
							ctx.beginPath();
							for (i = 0; i < 8; i += 1) {
								cur = selectionHandles[i];
								ctx.rect(cur.x, cur.y, handleSize, handleSize);
							};
							
							ctx.fill();
							ctx.stroke();
						
						break;
					case 'Text':
						
							// var linespacingAsPx = this.linespacing * this.size;
							
							var font = gCState.rconn.calcCtxFont(this);
							
							var x;
							var y;
							var h;
							var w;
							var fontsize = this.fontsize; // i expect it to be in px
							if (this.chars.length) {
								var mh = measureHeight(font, fontsize, this.chars, {width:w});
								console.log('mh:', mh);
								w = mh.width;
								// i want to keep the baseline at this.y
								y = mh.relativeTop < 0 ? this.y + mh.relativeTop : this.y;
								h = mh.relativeBot >= 0 ? (this.y + mh.relativeBot) - y : this.y - y;
							} else {
								w = 0;
								h = fontsize;
								y = this.y - fontsize;
							}
							x = this.x;
							
							ctx.strokeRect(this.x, y, w, h);
							
							// draw ibeam
							var ibh = h; // ibeam height
							var ibx;
							if (this.index === 0) {
								ibx = 0;
							} else {
								ibx = ctx.measureText(this.chars.substr(0, this.index)).width;
							}
							var ibw = 3;
							ctx.fillStyle = 'black'; // ibeam color
							ctx.fillRect(this.x + ibx, y, ibw, ibh);
						
						break;
					case 'Line':

							// ctx.beginPath();
							// ctx.arc(this.x, this.y, gCState.rconn.state.sCanHandleSize, 0, 360);
							
							// ctx.fill();
							// ctx.stroke();
							
							// ctx.beginPath();
							// ctx.arc(this.x2, this.y2, gCState.rconn.state.sCanHandleSize, 0, 360);
							
							// ctx.fill();
							// ctx.stroke();
							
							// draw handles
							var handleSize = gCState.rconn.state.sCanHandleSize;
							var half = handleSize / 2;
							
							var selectionHandles = gCState.selectionHandles;
							selectionHandles.length = 2;
							
							selectionHandles[0] = {
								x: this.x-half,
								y: this.y-half
							};
							
							selectionHandles[1] = {
								x: this.x2-half,
								y: this.y2-half
							};
							
							ctx.beginPath();
							for (i = 0; i < 2; i += 1) {
								cur = selectionHandles[i];
								ctx.rect(cur.x, cur.y, handleSize, handleSize);
							};
							ctx.fill();
							ctx.stroke();
						
						break;
					case 'Pencil':
					case 'Marker':
					
							// ctx.beginPath();
							// ctx.arc(this.path[0], this.path[1], gCState.rconn.state.sCanHandleSize, 0, 360);
							
							// ctx.fill();
							// ctx.stroke();
							
							// ctx.beginPath();
							// ctx.arc(this.path[this.path.length - 2], this.path[this.path.length - 1], gCState.rconn.state.sCanHandleSize, 0, 360);
							
							// ctx.fill();
							// ctx.stroke();
							// draw handles
							var handleSize = gCState.rconn.state.sCanHandleSize;
							var half = handleSize / 2;
							
							// var selectionHandles = gCState.selectionHandles;
							// selectionHandles.length = 2;
							
							ctx.beginPath();
							// for (i = 0; i < 2; i += 1) {
								// cur = selectionHandles[i];
								// ctx.rect(cur.x, cur.y, handleSize, handleSize);
							// };
							ctx.rect(this.path[0] - half, this.path[1] - half, handleSize, handleSize);
							ctx.rect(this.path[this.path.length-2] - half, this.path[this.path.length-1] - half, handleSize, handleSize);
							ctx.fill();
							ctx.stroke();
					
						break;
					default:
						console.error('should never get here, as would have returned earlier, as this one is not drawable');
				}
				
				return false;
			};
			
			this.contains = function(mx, my) {
				// returns 0 if not contained. returns 1 if contained in draggable area. returns 2 - 9 if in resizable area
				// is uncontainable
				if (['dim'].indexOf(this.name) > -1) {
					console.error('tried to test contains on an uncontainable! this:', this);
					return;
				}
				
				switch (this.name) {
					case 'Line':
					
							if (gCState.selection && gCState.selection == this) {
								var selectionHandles = gCState.selectionHandles;
								var handleSize = gCState.rconn.state.sCanHandleSize;
								for (var i=0; i<2; i++) {
									if ((selectionHandles[i].x <= mx) && (selectionHandles[i].x + handleSize >= mx) &&
										(selectionHandles[i].y <= my) && (selectionHandles[i].y + handleSize >= my)) {
											return i + 10;
									}
								}
							}
					
							var ctx = gCState.rconn.ctx;
							ctx.beginPath();
							ctx.setLineDash([]);
							ctx.lineWidth = this.lineWidth >= 20 ? this.lineWidth : 20;
							ctx.moveTo(this.x, this.y);
							ctx.lineTo(this.x2, this.y2);
							return ctx.isPointInStroke(mx, my) ? 1 : 0;
					
						break;
					case 'Pencil':
					case 'Marker':
						
							var ctx = gCState.rconn.ctx;
							ctx.setLineDash([]);
							ctx.lineWidth = this.lineWidth >= 20 ? this.lineWidth : 20;
							ctx.beginPath();
							ctx.moveTo(this.path[0], this.path[1]);
							for (var i=2; i<this.path.length; i+=2) {
								ctx.lineTo(this.path[i], this.path[i+1]);
							}
							return ctx.isPointInStroke(mx, my) ? 1 : 0;
						
						break;
					case 'Text':
					
							var ctx = gCState.rconn.ctx;
							
							var font = gCState.rconn.calcCtxFont(this);
							ctx.font = font;
							
							var x;
							var y;
							var h;
							var w;
							var fontsize = this.fontsize; // i expect it to be in px
							if (this.chars.length) {
								var mh = measureHeight(font, fontsize, this.chars, {width:w});
								console.log('mh:', mh);
								w = mh.width;
								// i want to keep the baseline at this.y
								y = mh.relativeTop < 0 ? this.y + mh.relativeTop : this.y;
								h = mh.relativeBot >= 0 ? (this.y + mh.relativeBot) - y : this.y - y;
							} else {
								w = 0;
								h = fontsize;
								y = this.y - fontsize;
							}
							x = this.x;
							
							if ((x <= mx) && (x + w >= mx) &&
								(y <= my) && (y + h >= my)) {
									return 1;
							}
					
						break;
					default:
						// cutout, Rectangle, Oval, Gaussian, Mosaic
					
						// is this selected
						if (gCState.selection && gCState.selection == this) {
							var selectionHandles = gCState.selectionHandles;
							var handleSize = gCState.rconn.state.sCanHandleSize;
							for (var i=0; i<8; i++) {
								if ((selectionHandles[i].x <= mx) && (selectionHandles[i].x + handleSize >= mx) &&
									(selectionHandles[i].y <= my) && (selectionHandles[i].y + handleSize >= my)) {
										return i + 2;
								}
							}
							
							// check if mouse is on the border, if it is then do that resize
							var borderWidth = 2;
							
							// top border
							if ((this.x <= mx) && (this.x + this.w >= mx) &&
								(this.y - borderWidth <= my) && (this.y + borderWidth >= my)) {
									return 3;
							}
							
							// left border
							if ((this.x - borderWidth <= mx) && (this.x + borderWidth >= mx) &&
								(this.y <= my) && (this.h + this.y >= my)) {
									return 5;
							}
							
							// right border
							if ((this.w + this.x - borderWidth <= mx) && (this.w + this.x + borderWidth >= mx) &&
								(this.y <= my) && (this.h + this.y >= my)) {
									return 6;
							}
							
							// bottom border
							if ((this.x <= mx) && (this.x + this.w >= mx) &&
								(this.h + this.y - borderWidth <= my) && (this.h + this.y + borderWidth >= my)) {
									return 8;
							}
						}
						// All we have to do is make sure the Mouse X,Y fall in the area between
						// the shape's X and (X + Width) and its Y and (Y + Height)
						if ((this.x <= mx) && (this.x + this.w >= mx) &&
							(this.y <= my) && (this.y + this.h >= my)) {
								return 1;
						}
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
				
				switch (this.name) {
					case 'Line':
					
							if (this.x == this.x2 && this.y == this.y2) {
								return true;
							} else {
								return false;
							}
					
						break;
					case 'Pencil':
					case 'Marker':
					
							if (this.path.length == 2) {
								return true;
							} else {
								return false;
							}
					
						break;
					case 'Text':
						
							return this.chars.length ? false : true;
						
						break;
					default:
						// cutout, Rectangle, Oval, Gaussian, Mosaic
						if (this.w && this.h) {
							// this.valid = false;
							return false;
						} else {
							// else the width and height are 0, no need to invalidate
							return true;
						}
				}
			};
			
			this.bringtofront = function() {
				// brings the Drawable to the front of the z-index
				var drawables = gCState.drawables;
				drawables.push(drawables.splice(drawables.indexOf(this), 1)[0]);
			};
		},
		dContainsHandles: function(aDrawable, aCtx, aX, aY) {
			// returns true if the handles of the drawable contain aX and aY
			
		},
		dDeleteAll: function(aDrawableNamesArr) {
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
							this.clearSelection();
						}
					}
				} else {
					if (!drawable.delete()) {
						valid = false;
					}
					if (this.cstate.selection && this.cstate.selection == drawable) {
						this.clearSelection();
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
		applyCtxStyle: function(aObj) {
			// aObj is any object with keys that are properties/methods of aCtx that are in this below styleables object
			var styleables = {
				lineWidth: 0,
				fillStyle: 0,
				textAlign: 0,
				lineJoin: 0,
				font: 0,
				setLineDash: 0,
				strokeStyle: 0
			};
			for (var p in aObj) {
				if (p in styleables) {
					if (p.indexOf('set') === 0) {
						// its a func
						this.ctx[p].call(this.ctx, aObj[p]);
					} else {
						// else its an attribute
						this.ctx[p] = aObj[p];
					}
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
			if (this.cstate.pathing && this.cstate.pathing.length) {
				this.cstate.selection.path = this.cstate.selection.path.concat(this.cstate.pathing.splice(0, 2));
			}
			
			var dropping = this.state.sGenColorPickerDropping;
			if (dropping && gDroppingCoords.length) {
				var dy = gDroppingCoords.pop();
				var dx = gDroppingCoords.pop();
				gDroppingMixCtx.drawImage(this.refs.can0, dx, dy, 1, 1, 0, 0, 1, 1);
				gDroppingMixCtx.drawImage(this.refs.can, dx, dy, 1, 1, 0, 0, 1, 1);
				var mixedRGBA = gDroppingMixCtx.getImageData(0, 0, 1, 1).data;
				var newDropperObj = {};
				newDropperObj[dropping.pStateColorKey] = 'rgb(' + mixedRGBA[0] + ', ' + mixedRGBA[1] + ', ' + mixedRGBA[2] + ')'; // rgbToHex(true, mixedRGBA[0], mixedRGBA[0], mixedRGBA[2]);
				gEditorStore.setState(newDropperObj);
				

				// var cDropperColor = this.ctx.getImageData(dx, dy, 1, 1).data;
				// var cDropperColor0 = this.ctx0.getImageData(dx, dy, 1, 1).data;
				// var avgRGBA = arraysAvg(cDropperColor, cDropperColor0);
				// console.log('ok mixed. setting.', 'avgRGBA:', uneval(avgRGBA), 'dim:', uneval(cDropperColor), 'base:', uneval(cDropperColor0), 'mixedRGBA:', uneval(mixedRGBA));
				
			}
			
			if(!this.cstate.valid) {
				
				var ctx = this.ctx;
				this.clear();
				
				// draw all drawables
				var drawables = this.cstate.drawables;
				var l = drawables.length;
				for(var i = 0; i < l; i++) {
					var drawable = drawables[i];
					// console.error('drawable', i, drawable);
					if (drawable.name == 'cutout') {
						// this is drawn as negative space with `this.dim.draw()`
						continue;
					}
					
					// We can skip the drawing of elements that have moved off the screen:
					/*
					switch (drawable.name) {
						case 'Rectangle':
						case 'Oval':
								if (
									drawable.x > this.cstate.width || drawable.y > this.cstate.height || // test top left coord // this is why we need positive coords
									drawable.x + drawable.w < 0 || drawable.y + drawable.h < 0
								   ) {
									console.error('not drawing this drawable:', drawable);
									continue;
								}
							break;
						default:
							// do nothing
					}
					*/
					
					drawable.draw(ctx);
				}
				// console.log('done drawing drawable');

				// draw selection
				if(this.cstate.selection != null) {
					// console.log('ok this.cstate.selection:', this.cstate.selection);
					this.cstate.selection.select(this.ctx);
					// if (this.cstate.selection == this.dim || (this.cstate.selection.w && this.cstate.selection.h)) {
						// console.log('ok selecting');
						// this.cstate.selection.select(this.ctx);
					// }
				}

				// ** Add stuff you want drawn on top all the time here **

				// draw the dim
				this.cstate.dim.draw(ctx);
				
				this.cstate.valid = true;
				if (gZState) { gZState.valid = false; }
			}
		},
		calcCtxFont: function(aDrawable) {
			// returns a string which can be used with ctx.font = ''
			var font = [];
			var fontables = ['fontitalic', 'fontbold', 'fontsize', 'fontface']; // an array not an object, as the order matters
			
			var l = fontables.length;
			for (var i=0; i<l; i++) {
				var fontable = fontables[i];
				if (fontable in aDrawable && aDrawable[fontable] !== undefined) {
					var pushable = aDrawable[fontable];
					
					// custom processing on pushable
					switch (fontable) {
						case 'fontsize':
							
								pushable += 'px';
							
							break;
						case 'fontbold':
							
								pushable = pushable ? 'bold' : undefined;
							
							break;
						case 'fontitalic':
							
								pushable = pushable ? 'italic' : undefined;
							
							break;
						default:
							// no extra processing on pushable
					}
					
					// push it
					font.push(pushable);
				}
			}
			
			if (font.length) {
				// console.log('ok cacled font is:', font.join(' '));
				return font.join(' ');
			} else {
				return undefined; // so setStyleablesDefaults will then set it to the default
			}
		},
		setStyleablesDefaults: function(aDrawable) {
			// the styles and the value is their default value
			
			// specials			
			var fontablesDefaults = {
				fontitalic: gCState.rconn.state.sPalFontItalic,
				fontbold: gCState.rconn.state.sPalFontBold,
				fontunderline: gCState.rconn.state.sPalFontUnderline,
				fontface: gCState.rconn.state.sPalFontFace,
				fontsize: gCState.rconn.state.sPalFontSize
			};
			
			var styleables = {
				lineWidth: gCState.rconn.state.sPalLineWidth,
				fillStyle: colorStrToRGBA(gCState.rconn.state.sPalFillColor, gCState.rconn.state.sPalFillAlpha),
				textAlign: 'left',
				lineJoin: 'butt',
				font: this.calcCtxFont(fontablesDefaults),
				setLineDash: [],
				strokeStyle: aDrawable.name == 'Marker' ? colorStrToRGBA(gCState.rconn.state.sPalMarkerColor, gCState.rconn.state.sPalMarkerAlpha) : colorStrToRGBA(gCState.rconn.state.sPalLineColor, gCState.rconn.state.sPalLineAlpha)
			};
			
			if (aDrawable.name == 'Line') { // non-isomorphic but i gotta
				styleables.fillStyle = styleables.strokeStyle;
			}
			
			// console.log('styleables.font:', styleables.font);
			
			for (var p in styleables) {
				if (p in aDrawable) {
					if (p == 'font') {
						// special case
						aDrawable.font = this.calcCtxFont(aDrawable);
						if (aDrawable.font === undefined) {
							// ok need to set defaults
							console.log('ok NEED TO SET DEFAULTS FONT');
							aDrawable.font = styleables.font;
							for (var pf in fontablesDefaults) {
								aDrawable[pf] = fontablesDefaults[pf];
							}
							console.log('ok set to default font:', aDrawable.font);
						} // else do nothing, it already has one set
					} else {
						// for everything other then 'font'
						if (aDrawable[p] === undefined) {
							// set to default value
							aDrawable[p] = styleables[p];
						} // else ok do nothing, it has a value
					}
				} else {
					delete styleables[p];
				}
			}
			return styleables;
		},
		wheel: function(e) {
			// console.log('wheel:', e.deltaMode, e.deltaX, e.deltaY);
			
			if (this.state.sPalMultiDepresses['Zoom View']) {
				var cLevel = this.state.sPalZoomViewLevel;
				var nLevel;
				if (e.deltaY < 0) {
					nLevel = cLevel + 1;
				} else {
					nLevel = cLevel - 1;
				}
				
				if (nLevel >= 1 && nLevel <= 40) {
					gEditorStore.setState({
						sPalZoomViewLevel: nLevel
					});
					gZState.valid = false;
				}
			}
		},
		mousemove: function(e) {
			var mouse = this.getMouse(e);
			var mx = mouse.x;
			var my = mouse.y;
			
			if (this.state.sPalMultiDepresses['Zoom View']) {
				gZState.mouse = {x:mx, y:my};
				gZState.valid = false;
			}
			
			if (this.state.sGenColorPickerDropping) {
				gDroppingCoords[0] = mx;
				gDroppingCoords[1] = my;
			} else if (this.state.sGenPalDragStart) {
				gEditorStore.setState({
					sPalX: this.state.sGenPalDragStart.sPalX + (e.screenX - this.state.sGenPalDragStart.screenX),
					sPalY: this.state.sGenPalDragStart.sPalY + (e.screenY - this.state.sGenPalDragStart.screenY)
				});
			} else if (this.state.sGenPalZoomViewDragStart) {
				gEditorStore.setState({
					sPalZoomViewCoords: {
						x: this.state.sGenPalZoomViewDragStart.initX + (e.screenX - this.state.sGenPalZoomViewDragStart.screenX),
						y: this.state.sGenPalZoomViewDragStart.initY + (e.screenY - this.state.sGenPalZoomViewDragStart.screenY)
					}
				});
			} else {
				var toolsub = this.state.sGenPalTool + '-' + (this.state.sPalSeldSubs[this.state.sGenPalTool] || '');
				if (this.cstate.dragging) {
					switch (this.cstate.selection.name) {
						case 'Rectangle':
						case 'Oval':
						case 'cutout':
						case 'Gaussian':
						case 'Mosaic':
						case 'Text':
							
								this.cstate.selection.x = mx - this.cstate.dragoffx;
								this.cstate.selection.y = my - this.cstate.dragoffy;
							
							break;
						case 'Line':
						
								var delx = mx - this.cstate.dragdown.mx;
								var dely = my - this.cstate.dragdown.my;
								
								this.cstate.selection.x = this.cstate.dragdown.x + delx;
								this.cstate.selection.y = this.cstate.dragdown.y + dely;
								this.cstate.selection.x2 = this.cstate.dragdown.x2 + delx;
								this.cstate.selection.y2 = this.cstate.dragdown.y2 + dely;
						
							break;
						case 'Pencil':
						case 'Marker':
						
								var delx = mx - this.cstate.dragdown.mx;
								var dely = my - this.cstate.dragdown.my;
								
								this.cstate.selection.path = this.cstate.dragdown.path.map(function(aHalfCoord, aI) {
									return (aI % 2 ? aHalfCoord + dely : aHalfCoord + delx);
								});
						
							break;
						default:
							console.error('deverror: no drag mechnaism defined');
					}
					this.cstate.valid = false; // Something's dragging so we must redraw
				} else if (this.cstate.resizing) {
					var oldx = this.cstate.selection.x;
					var oldy = this.cstate.selection.y;
					
					switch(this.cstate.resizing) {
						case 2:
							this.cstate.selection.x = mx;
							this.cstate.selection.y = my;
							this.cstate.selection.w += oldx - mx;
							this.cstate.selection.h += oldy - my;
							break;
						case 3:
							this.cstate.selection.y = my;
							this.cstate.selection.h += oldy - my;
							break;
						case 4:
							this.cstate.selection.y = my;
							this.cstate.selection.w = mx - oldx;
							this.cstate.selection.h += oldy - my;
							break;
						case 5:
							this.cstate.selection.x = mx;
							this.cstate.selection.w += oldx - mx;
							break;
						case 6:
							this.cstate.selection.w = mx - oldx;
							break;
						case 7:
							this.cstate.selection.x = mx;
							this.cstate.selection.w += oldx - mx;
							this.cstate.selection.h = my - oldy;
							break;
						case 8:
							this.cstate.selection.h = my - oldy;
							break;
						case 9:
							this.cstate.selection.w = mx - oldx;
							this.cstate.selection.h = my - oldy;
							
							if (e.shiftKey) {
								this.cstate.selection.h = this.cstate.selection.w;
							}
							break;
						case 10:
							// lining start
							this.cstate.selection.x = mx;
							this.cstate.selection.y = my;
							break;
						case 11:
							// lining end
							this.cstate.selection.x2 = mx;
							this.cstate.selection.y2 = my;
							break;
						default:
							console.error('should never get here');
					}
					
					gEditorStore.setState({
						sGenPalW: Math.abs(this.cstate.selection.w),
						sGenPalH: Math.abs(this.cstate.selection.h)
					})
					this.cstate.valid = false;
				} else if (this.cstate.lining) {
					if (this.cstate.lining == 10) {
						// lining start
						this.cstate.selection.x = mx;
						this.cstate.selection.y = my;
					} else if (this.cstate.lining == 11) {
						// lining end
						this.cstate.selection.x2 = mx;
						this.cstate.selection.y2 = my;
					}
					this.cstate.valid = false;
				} else if (this.cstate.pathing) {
					this.cstate.pathing[0] = mx;
					this.cstate.pathing[1] = my;
					this.cstate.valid = false;
				} else if (this.cstate.typing) {
					// do nothing
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
						case 'Text-':
							
								dragFilterFunc = function(aToFilter) { return ['Text'].indexOf(aToFilter.name) > -1 };
							
							break;
						case 'Line-':
							
								dragFilterFunc = function(aToFilter) { return aToFilter.name == 'Line' };
							
							break;
						case 'Freedraw-Pencil':
						case 'Freedraw-Marker':
							
								dragFilterFunc = function(aToFilter) { return ['Pencil', 'Marker'].indexOf(aToFilter.name) > -1 };
							
							break;
						case 'Blur-Gaussian':
						case 'Blur-Mosaic':
							
								dragFilterFunc = function(aToFilter) { return ['Gaussian', 'Mosaic'].indexOf(aToFilter.name) > -1 };
							
							break;
						default:
							// do nothing
					}
					
					if (dragFilterFunc) {
						var draggableFound = false;
						var drawables = this.cstate.drawables.filter(dragFilterFunc);
						var l = drawables.length - 1;
						var isContained;
						for (var i=l; i>-1; i--) {
							var drawable = drawables[i];
							isContained = drawable.contains(mx, my);
							if (isContained) {
								// console.error('yes drawable contains:', drawable);
								break;
							}
						}
						if (isContained) {
							var cursor;
							switch (isContained) {
								case 1:
								
										cursor = 'move'; // draggable
									
									break;
								case 2:
								
										cursor = 'nw-resize'; // rect resize
								
									break;
								case 3:
								
										cursor = 'n-resize'; // rect resize
									
									break;
								case 4:
								
										cursor='ne-resize'; // rect resize
									
									break;
								case 5:
								
										cursor = 'w-resize'; // rect resize
								
									break;
								case 6:
								
										cursor = 'e-resize';
								
									break;
								case 7:
									
										cursor = 'sw-resize';
									
									break;
								case 8:
									
										cursor = 's-resize';
									
									break;
								case 9:
								
										cursor = 'se-resize';
								
									break;
								case 10:
								
										cursor = 'grab'; // lining start
								
									break;
								case 11:
								
										cursor = 'grab'; // lining end
								
									break;
								default:
									console.error('should never get here');
							}
							if (cursor) {
								if (this.state.sGenCanMouseMoveCursor != cursor) {
									this.setState({
										sGenCanMouseMoveCursor: cursor
									});
								}
							}
						} else {
							if (this.state.sGenCanMouseMoveCursor) {
								this.setState({
									sGenCanMouseMoveCursor: null
								});
							}
						}
					}
				}
			}
			
		},
		clearSelection: function() {
			// returns new "valid" value
			var wasSel = this.cstate.selection;
			if (!wasSel) {
				// nothing selected
				return true;
			} else {			
				this.cstate.selection = null;
				
				if ('w' in wasSel) {
					gEditorStore.setState({
						sGenPalW: 0,
						sGenPalH: 0
					});
				}
				
				return false;
			}
		},
		mousedown: function(e) {
			var mouse = this.getMouse(e);
			var mx = mouse.x;
			var my = mouse.y;
			
			this.cstate.downx = mx;
			this.cstate.downy = my;
			
			if (e.target == this.refs.can) {
				
				var dropping = this.state.sGenColorPickerDropping;
				if (dropping) {
					var acceptDroppingObj = {};
					acceptDroppingObj.sGenColorPickerDropping = null;
					
					var addColorSetStateObj = {};
					if (this.cstate.selection) {
						switch (this.cstate.selection.name) {
							case 'Marker':
							
									addColorSetStateObj = this.addColorToHistory('sPalMarkerColor', 'sPalMarkerColorHist', true);
									
								break;
							case 'Line':
							case 'Pencil':
							
									addColorSetStateObj = this.addColorToHistory('sPalLineColor', 'sPalBothColorHist', true);
							
								break;
							case 'Text':
							
									addColorSetStateObj = this.addColorToHistory('sPalFillColor', 'sPalBothColorHist', true);
							
								break;
							case 'Rectangle':
							case 'Oval':
							
									addColorSetStateObj = this.addColorToHistory(dropping.pStateColorKey, 'sPalBothColorHist', true);
									
								break;
							default:
								// no related color picker
						}
					}
					
					gEditorStore.setState(overwriteObjWithObj(acceptDroppingObj, addColorSetStateObj));
					gDroppingMixCtx = null;
					
					return; // so we dont do the stuff below
				}
				
				var toolsub = this.state.sGenPalTool + '-' + (this.state.sPalSeldSubs[this.state.sGenPalTool] || '');
				
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
					case 'Line-':
						
							selectFilterFunc = function(aToFilter) { return aToFilter.name == 'Line' };
						
						break;
					case 'Freedraw-Pencil':
					case 'Freedraw-Marker':
						
							selectFilterFunc = function(aToFilter) { return ['Pencil', 'Marker'].indexOf(aToFilter.name) > -1 };
						
						break;
					case 'Blur-Gaussian':
					case 'Blur-Mosaic':
						
							selectFilterFunc = function(aToFilter) { return ['Gaussian', 'Mosaic'].indexOf(aToFilter.name) > -1 };
						
						break;
					case 'Text-':
						
							console.log('ok filtering Text');
							selectFilterFunc = function(aToFilter) { return ['Text'].indexOf(aToFilter.name) > -1 };
						
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
						var isContained = drawables[i].contains(mx, my);
						if (isContained) {
							console.log('ok you clicked in this drawable:', drawables[i]);
							var mySel = drawables[i];
							
							mySel.bringtofront();
							
							if (isContained === 1) {
								// introduced for line dragging
								if (mySel.name == 'Line') {
									this.cstate.dragdown = {
										// the initial x and y the user mouse downed on
										mx: mx,
										my: my,
										// the initial x and y of the drawable
										x: mySel.x,
										y: mySel.y,
										// for line we have x2 and y2
										x2: mySel.x2,
										y2: mySel.y2
									};
								} else 
								// introduced for pencil/marker dragging
								if (['Pencil', 'Marker'].indexOf(mySel.name) > -1) {
									this.cstate.dragdown = {
										// the initial x and y the user mouse downed on
										mx: mx,
										my: my,
										// the initial path
										path: mySel.path.slice()
									}
								}
								// end introduced
								 else {
									// cutout, Rectangle, Oval, Gaussian, Mosaic, Text
									
									// Keep track of where in the object we clicked
									// so we can move it smoothly (see mousemove)
									this.cstate.dragoffx = mx - mySel.x;
									this.cstate.dragoffy = my - mySel.y;
								}
								
								this.cstate.dragging = true;
								this.cstate.selection = mySel;
								this.cstate.valid = false; // this is needed, as if its a newly selected object, then if i dont set this, the selection border wont be drawn
								
								if ('w' in this.cstate.selection) {
									this.setState({
										sGenPalW: this.cstate.selection.w,
										sGenPalH: this.cstate.selection.h
									});
								}
							} else if (isContained >= 2 && isContained <= 9) {
								// rect resizing
								this.cstate.resizing = isContained;
								this.cstate.selection = mySel;
								// this.cstate.valid = false; // not needed for resizing, as resizing only happens after a selection was made
							} else if (isContained >= 10 && isContained <= 11) {
								// lining resizing
								this.cstate.lining = isContained;
							}
							
							return;
						}
					}
					
					if (this.cstate.selection) {
						this.clearSelection();
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
									gCState.rconn.dDeleteAll(['cutout']);
								}
								
								this.cstate.selection = new this.Drawable(mx, my, 0, 0, 'cutout');
							
							break;
						case 'Shapes-Rectangle':
						case 'Shapes-Oval':
						case 'Blur-Gaussian':
						case 'Blur-Mosaic':
							
								this.cstate.selection = new this.Drawable(mx, my, 0, 0, this.state.sPalSeldSubs[this.state.sGenPalTool]);
							
							break;
						case 'Line-':
						
								this.cstate.selection = new this.Drawable(mx, my, null, null, 'Line');
						
							break;
						case 'Freedraw-Pencil':
						case 'Freedraw-Marker':
						
								this.cstate.selection = new this.Drawable(mx, my, null, null, this.state.sPalSeldSubs[this.state.sGenPalTool]);
						
							break;
						case 'Text-':
							
								if (this.cstate.typing) {
									console.log('exiting typing, this was selection:', this.cstate.selection);
									this.clearSelection();
									this.cstate.typing = false;
									this.cstate.valid = false;
								} else {
									this.cstate.selection = new this.Drawable(mx, my, null, null, 'Text');
								}
							
							break;
						default:
							// do nothing
					}
					
					if (this.cstate.selection) {
						this.cstate.selection.add();
						
							switch (this.cstate.selection.name) {
								case 'Marker':
								
										this.addColorToHistory('sPalMarkerColor', 'sPalMarkerColorHist', false);
										
									break;
								case 'Line':
								case 'Pencil':
								
										this.addColorToHistory('sPalLineColor', 'sPalBothColorHist', false);
								
									break;
								case 'Text':
								
										this.addColorToHistory('sPalFillColor', 'sPalBothColorHist', false);
								
									break;
								case 'Rectangle':
								case 'Oval':
								
										var setStateObjLine = this.addColorToHistory('sPalLineColor', 'sPalBothColorHist', true);
										var setStateObjFill = this.addColorToHistory('sPalFillColor', 'sPalBothColorHist', true);
										
										gEditorStore.setState(overwriteObjWithObj(setStateObjLine, setStateObjFill));
										
									break;
								default:
									// no related color picker
							}
						
						// set the proper cstate action bool
						switch (this.cstate.selection.name) {
							case 'cutout':
							case 'Rectangle':
							case 'Oval':
							case 'Gaussian':
							case 'Mosaic':
								
									this.cstate.resizing = 9;
								
								break;
							case 'Line':
								
									this.cstate.lining = 11;
									this.cstate.valid = false; // as i have to draw the selection point
								
								break;
							case 'Pencil':
							case 'Marker':
								
									this.cstate.pathing = [];
									this.cstate.valid = false; // :todo: consider: as i have to draw the selection point
								
								break;
							case 'Text':
								
									this.cstate.typing = true;
									this.cstate.valid = false;
									
								break;
							default:
								console.error('should never get here, well unless maybe i dont know think about it, this.cstate.selection.name:', this.cstate.selection.name);
						}
						return;
					}
				}
			}
		},
		addColorToHistory: function(aStateColorVarOrColor, aStateHistoryVar, justReturnSetStateObj) {
			// aStateColorVarOrColor can be a color.
			// if justReturnSetStateObj is true, it just returns the setStateObj, otherwise it sets it
			if (!aStateColorVarOrColor || !aStateHistoryVar) {
				return;
			}
			// console.log('aStateColorVarOrColor:', aStateColorVarOrColor, 'aStateHistoryVar:', aStateHistoryVar, 'this.state:', this.state);
			var cColor = this.state[aStateColorVarOrColor];
			if (cColor === undefined) {
				cColor = aStateColorVarOrColor;
			}
			if (cColor[0] != '#') {
				cColor = rgbToHex(true, cColor).toUpperCase();
			}
			var cHistory = this.state[aStateHistoryVar].map(function(aEntry) {
				if (aEntry[0] == '#') {
					return aEntry.toUpperCase();
				} else {
					return rgbToHex(true, aEntry).toUpperCase();
				}
			});
			// console.log('cHistory:', cHistory);
			var idxCoInHist = cHistory.indexOf(cColor);
			var immutedHistory;
			if (idxCoInHist == -1) {
				immutedHistory = cHistory.slice();
				immutedHistory.splice(0, 0, cColor);
				if (immutedHistory.length >= 7) {
					immutedHistory.length = 7;
				}
			} else if (idxCoInHist > 0) {
				immutedHistory = cHistory.slice();
				immutedHistory.splice(0, 0, immutedHistory.splice(idxCoInHist, 1)[0]);
			} // else idxCoInHist is 0 so its already in most recent position so do nothing
			
			if (immutedHistory) {
				var setStateObj = {};
				setStateObj[aStateHistoryVar] = immutedHistory;
				if (justReturnSetStateObj) {
					 return setStateObj;
				} else {
					gEditorStore.setState(setStateObj);
				}
			}
		},
		dblclick: function(e) {

			// if selectFilterFunc then lets test if should select or deselect
			if (this.cstate.selection) {
				var isContained = this.cstate.selection.contains(mx, my);
				if (isContained) {
					console.log('ok you clicked in this drawable:', drawables[i]);
					var mySel = drawables[i];
					
					mySel.bringtofront();
					
					if (isContained) {
						
					}
				}
			}
		},
		mouseup: function(e) {
			var mouse = this.getMouse(e);
			var mx = mouse.x;
			var my = mouse.y;

			if (this.state.sGenPalDragStart) {
				gEditorStore.setState({
					sGenPalDragStart: null
				});
			} else if (this.state.sGenPalZoomViewDragStart) {
				gEditorStore.setState({
					sGenPalZoomViewDragStart: null
				});
			} else {
				// if (e.target == this.refs.can) { // its canceling, so even if its not can go ahead and let it go through
					// var toolsub = this.state.sGenPalTool + '-' + (this.state.sPalSeldSubs[this.state.sGenPalTool] || '');
					if (this.cstate.dragging) {
						this.cstate.dragging = false;
						this.cstate.dragoffx = null;
						this.cstate.dragoffy = null;
						this.cstate.dragdown = null;
					} else if (this.cstate.resizing) {
						this.cstate.resizing = false;
						if (!this.cstate.selection.w || !this.cstate.selection.h) {
							// 0 size
							this.cstate.selection.delete();
							this.clearSelection();
						} else {
							this.makeDimsPositive(this.cstate.selection); // no need to set valid=false
						}
					} else if (this.cstate.lining) {
						this.cstate.lining = false;
						if (this.cstate.selection.x == this.cstate.selection.x2 && this.cstate.selection.y == this.cstate.selection.y2) {
							// 0 size
							this.cstate.selection.delete();
							this.clearSelection();
							// need to set valid=false because otherwise the big handle thing is left over
							this.cstate.valid = false;
						}
					} else if (this.cstate.pathing) {
						this.cstate.pathing = null;
						if (this.cstate.selection.path.length == 2) {
							// only two points, meaning just where they moused down
							this.cstate.selection.delete();
							this.clearSelection();
							// :todo: consider: need to set valid=false because otherwise the big handle thing is left over
							this.cstate.valid = false;
						}
					} else if (this.cstate.typing) {
						// do nothing special
					}
				// }
			}
			
			
		},
		keyup: function(e) {
			switch (e.key) {
				case 'Delete':
				
						// if (!this.cstate.dragging && !this.cstate.resizing && !this.cstate.lining && !this.cstate.pathing) {
						//	switch (this.state.sGenPalTool) {
						//		case 'Select':
						//		case 'Shapes':
						//		case 'Line':
						//		case 'Freedraw':
						//		case 'Blur':
										if (this.cstate.selection) {
											if (this.cstate.selection.name == 'Text' && this.cstate.typing) {
												// dont delete it as they are just deleting text
											} else {
												var rez_valid = this.cstate.selection.delete();
												this.clearSelection();
												this.cstate.valid = rez_valid;
											}
										}
						//			break;
						//		default:
						//			// do nothing
						//	}
						// }
				
					break;
				case 'Escape':
						
						var dropping = this.state.sGenColorPickerDropping;
						if (dropping) {
							var cancelDroppingObj = {};
							cancelDroppingObj[dropping.pStateColorKey] = dropping.initColor;
							cancelDroppingObj.sGenColorPickerDropping = null;
							gEditorStore.setState(cancelDroppingObj);							
							gDroppingMixCtx = null;
							
							return; // so we dont close the window
						}
						
						window.close();
				
					break;
				default:
					// do nothing
			}
		},
		keydown: function(e) {
			var mySel = this.cstate.selection;
			if (this.cstate.typing) {
				if (e.key.length == 1) {
					mySel.chars = mySel.chars.substr(0, mySel.index) + e.key + mySel.chars.substr(mySel.index);
					mySel.index++;
					this.cstate.valid = false;
				} else {
					switch (e.key) {
						case 'Backspace':
							
								if (mySel.index > 0) {
									mySel.index--;
									mySel.chars = spliceSlice(mySel.chars, mySel.index, 1);
									this.cstate.valid = false;
								}
							
							break;
						case 'Delete':
							
								if (mySel.index < mySel.chars.length) {
									mySel.chars = spliceSlice(mySel.chars, mySel.index, 1);
									this.cstate.valid = false;
								}
							
							break;
						case 'ArrowLeft':
							
								if (mySel.index > 0) {
									mySel.index--;
									this.cstate.valid = false;
								}
							
							break;
						case 'ArrowRight':
							
								if (mySel.index < mySel.chars.length) {
									mySel.index++;
									this.cstate.valid = false;
								}
							
							break;
						case 'Home':
							
								if (mySel.index > 0) {
									mySel.index = 0;
									this.cstate.valid = false;
								}
							
							break;
						case 'End':
							
								if (mySel.index < mySel.chars.length) {
									mySel.index = mySel.chars.length;
									this.cstate.valid = false;
								}
							
							break;
						default:
							// do nothing special
					}
				}
			// } else if (mySel && !this.cstate.dragging && !this.cstate.resizing && !this.cstate.lining && !this.cstate.pathing && !this.cstate.typing) {
			} else if (mySel && !this.cstate.dragging && !this.cstate.resizing && !this.cstate.lining && !this.cstate.pathing && !this.cstate.typing) {
				// hotkeys for move (and resize if applicable)
				if (e.altKey) {
					// resize
					if ('w' in mySel) {
						var resizeBy = 1; // pixels to move by
						if (e.shiftKey) {
							resizeBy = 10;
						}
						var newW = mySel.w;
						var newH = mySel.h;
						switch (e.key) {
							case 'ArrowDown':
								
									newH -= resizeBy;
								
								break;
							case 'ArrowUp':
								
									newH += resizeBy;
								
								break;
							case 'ArrowRight':
								
									newW += resizeBy;
								
								break;
							case 'ArrowLeft':
								
									newW -= resizeBy;
								
								break;
							default:
								// nothing special
								return;
						}
						var newValid = true;
						if (mySel.w !== newW && newW >= 0) {
							mySel.w = newW;
							newValid = false;
						}
						if (mySel.h !== newH && newH >= 0) {
							mySel.h = newH;
							newValid = false;
						}
						if (!newValid) {
							gCState.valid = false;
							gEditorStore.setState({
								sGenPalW: newW,
								sGenPalH: newH
							})
						}
					}
				} else {
					// move
					var moveBy = 1; // pixels to move by
					if (e.shiftKey) {
						moveBy = 10;
					}

					var moveDirX = 0;
					var moveDirY = 0;
					switch (e.key) {
						case 'ArrowDown':
							
								moveDirY = 1;
							
							break;
						case 'ArrowUp':
							
								moveDirY = -1;
							
							break;
						case 'ArrowRight':
							
								moveDirX = 1;
							
							break;
						case 'ArrowLeft':
							
								moveDirX = -1;
							
							break;
						default:
							// nothing special
							return;
					}
					
					var moveByX = moveBy * moveDirX;
					var moveByY = moveBy * moveDirY;
					
					// determine move type
					if ('x2' in mySel) {
						mySel.x += moveByX;
						mySel.y += moveByY;
						mySel.x2 += moveByX;
						mySel.y2 += moveByY;
					} else if ('path' in mySel) {
						var path = mySel.path;
						var l = path.length;
						for (var i=0; i<l; i++) {
							if (i % 2) {
								path[i] += moveByY;
							} else {
								path[i] += moveByX;
							}
						}
					} else {
						// this is not always true `if ('w' in mySel || ) {` as for text
						mySel.x += moveByX;
						mySel.y += moveByY;
					}
					
					gCState.valid = false;
				}
			}
		},
		////// end - canvas functions
		render: function() {
			// props
			//		see link1818181
			
			var editorWrapProps = {
				className: 'editor'
			};
			
			var cPalProps = overwriteObjWithObj(this.state, this.props);
			
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
			if (this.state.sGenInputNumberMousing) {
				cCanProps.style.cursor = this.state.sGenInputNumberMousing;
				cPalPalProps.style.cursor = this.state.sGenInputNumberMousing;				
				cPalProps.pZoomViewCursor = this.state.sGenInputNumberMousing;
				cPalProps.pPalSubwrapCursor = this.state.sGenInputNumberMousing;
				editorWrapProps.className += ' inputnumber-component-mousing';
			} else if (this.state.sGenPalDragStart) {
				cCanProps.style.cursor = 'move';
				cPalPalProps.style.cursor = 'move';
			} else {
				if (this.state.sGenCanMouseMoveCursor) {
					cCanProps.style.cursor = this.state.sGenCanMouseMoveCursor;
				} else {
					switch (this.state.sGenPalTool) {
						case 'Select':
						case 'Shapes':
						case 'Line':
						case 'Freedraw':
						case 'Blur':
						
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
			
			var zoomViewREl;
			if (this.state.sPalMultiDepresses['Zoom View']) {
				cPalPalProps.mPalZoomViewHandleMousedown = this.mPalZoomViewHandleMousedown;
				zoomViewREl = React.createElement(ZoomView, cPalProps);
			}			
			
			return React.createElement('div', editorWrapProps,
				React.createElement('div', cPalPalProps,
					React.createElement(Subwrap, cPalProps)
				),
				React.createElement('canvas', {id:'canBase', draggable:'false', width:this.props.pPhys.w, height:this.props.pPhys.h, ref:'can0'}),
				React.createElement('canvas', cCanProps),
				zoomViewREl,
				!this.state.sGenInputNumberMousing ? undefined : React.createElement('style', {},
					'.inputnumber-component-mousing input { pointer-events:none; }' // so the cursor doesnt change to text when over this
				)
			);
		},
	});
	
	var ZoomView = React.createClass({
		displayName: 'ZoomView',
		componentDidMount: function() {
			
			this.zstate = {}
			gZState = this.zstate;
			
			this.zstate.rconn = this;
			
			this.ctx = ReactDOM.findDOMNode(this).getContext('2d');
			this.zstate.valid = false;
			this.zstate.mouse = {x:0, y:0};
			this.ctx.mozImageSmoothingEnabled = false;
			this.ctx.ImageSmoothingEnabled = false;
			
			this.zstate.interval = setInterval(this.draw, 30);
			
			var bgimg = new Image();
			bgimg.onload = function() {
				this.bgpatt = this.ctx.createPattern(bgimg, 'repeat');
			}.bind(this);
			bgimg.src = 'chrome://nativeshot/content/resources/images/canvas_bg.png';
		},
		componentWillUnmount: function() {
			clearInterval(this.zstate.interval);
			gZState = null; // so even if bgpat image loads, it will error as it cant set it here as it will be null
		},
		draw: function() {
			if (gCState && gCState.rconn.ctx && !this.zstate.valid) {
				var ctx = this.ctx;
				var width = 300; // of zoomview canvas
				var height = 300;  // of zoomview canvas
				
				// background

				
				var fontHeight = 24;
				var fontHeightPlusPad = fontHeight + 3 + 3; // as i have offset of fillText on height by 3, and then i want 3 on top
				
				var zoomLevel = this.props.sPalZoomViewLevel;
				
				var dWidth = width;
				var dHeight = height - fontHeightPlusPad;
				
				// fill bg of view part
				ctx.fillStyle = this.bgpatt || '#eee';
				ctx.fillRect(0, 0, width, dHeight);
				
				// fill bg of text part
				ctx.fillStyle = '#eee';
				ctx.fillRect(0, dHeight, width, height - dHeight);
				
				// bring in view
				var sx = this.zstate.mouse.x - ((width / 2) * (1 / zoomLevel));
				var sy = this.zstate.mouse.y - ((dHeight / 2) * (1 / zoomLevel));
				var sWidth = width * (1 / zoomLevel);
				var sHeight = dHeight * (1 / zoomLevel);
				
				ctx.drawImage(gCState.rconn.refs.can0, sx, sy, sWidth, sHeight, 0, 0, dWidth, dHeight);
				ctx.drawImage(gCState.rconn.refs.can, sx, sy, sWidth, sHeight, 0, 0, dWidth, dHeight);
				
				// draw grid
				ctx.strokeStyle = '#4A90E2';
				
				ctx.beginPath();
				ctx.lineWidth = 2;
				ctx.moveTo(width/2, 0);
				ctx.lineTo(width/2, dHeight);
				ctx.stroke();

				ctx.beginPath();
				ctx.lineWidth = 2;
				ctx.moveTo(0, dHeight/2);
				ctx.lineTo(width, dHeight/2);
				ctx.stroke();
				
				// write text
				ctx.font = '24px serif';
				ctx.textAlign = 'left';
				ctx.fillStyle = '#000';
				ctx.fillText(this.zstate.mouse.x + ', ' + this.zstate.mouse.y, 5, height - 5);
				
				var zoomPercent = Math.round(zoomLevel * 100) + '%';
				ctx.textAlign = 'right';
				ctx.fillText(zoomPercent, width - 5, height - 5);
				
				// mark valid
				this.zstate.valid = true;
			}
		},
		mousedown: function(e) {
			gEditorStore.setState({
				sGenPalZoomViewDragStart: {screenX:e.screenX, screenY:e.screenY, initX:this.props.sPalZoomViewCoords.x, initY:this.props.sPalZoomViewCoords.y}
			});
		},
		render: function() {
			// props - cPalProps - its all of them
			return React.createElement('canvas', {className:'pzoomview', width:300, height:300, style:{left:this.props.sPalZoomViewCoords.x+'px', top:this.props.sPalZoomViewCoords.y+'px', cursor:this.props.pZoomViewCursor }, onMouseDown:this.mousedown});
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
			if (cHandleSize + 3 <= 25) {
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
			if (cHandleSize - 3 > 7) {
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
		mousedown: function(e) {
			gEditorStore.setState({
				sGenPalDragStart: {screenX:e.screenX, screenY:e.screenY, sPalX:this.props.sPalX, sPalY:this.props.sPalY}
			});
		},
		render: function() {
			// props

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
				case 'Blur':
					
						if (gCState && gCState.selection) {
							switch (gCState.selection.name) {
								case 'Gaussian':
								case 'Mosaic':
									
										if (gCState.selection.name != this.props.sPalSeldSubs[this.props.sGenPalTool]) {
											gCState.selection.name = this.props.sPalSeldSubs[this.props.sGenPalTool]
											gCState.valid = false;
										}
									
									break;
								default:
									// this selection is not affected
							}
						}
					
					break;
				case 'Text':
					
						if (gCState && gCState.selection && gCState.selection.name == 'Text') {
							var newValid = true; // valid based on the tests below
							if (gCState.selection.fontface != this.props.sPalFontFace) {
								gCState.selection.fontface = this.props.sPalFontFace;
								newValid = false;
							}
							if (gCState.selection.fontbold != this.props.sPalFontBold) {
								gCState.selection.fontbold = this.props.sPalFontBold;
								newValid = false;
							}
							if (gCState.selection.fontitalic != this.props.sPalFontItalic) {
								gCState.selection.fontitalic = this.props.sPalFontItalic;
								newValid = false;
							}
							if (gCState.selection.fontsize != this.props.sPalFontSize) {
								gCState.selection.fontsize = this.props.sPalFontSize;
								newValid = false;
							}
							if (!newValid) {
								gCState.selection.font = gCState.rconn.calcCtxFont(gCState.selection);
								gCState.valid = false;
							}
						}
					
					break;
				case 'Color':
					
						if (gCState && gCState.selection) {
							switch (gCState.selection.name) {
								case 'Rectangle':
								case 'Oval':
								case 'Line':
								case 'Pencil':
									
										gCState.selection.strokeStyle = colorStrToRGBA(this.props.sPalLineColor, this.props.sPalLineAlpha);
										gCState.rconn.addColorToHistory('sPalLineColor', 'sPalBothColorHist', false);
										gCState.valid = false;
									
									break;
								default:
									// this selection is not affected
							}
						}
					
					break;
				case 'Fill Color':
					
						if (gCState && gCState.selection) {
							switch (gCState.selection.name) {
								case 'Rectangle':
								case 'Oval':
								case 'Text':
									
										gCState.selection.fillStyle = colorStrToRGBA(this.props.sPalFillColor, this.props.sPalFillAlpha);
										gCState.rconn.addColorToHistory('sPalFillColor', 'sPalBothColorHist', false);
										gCState.valid = false;
									
									break;
								default:
									// this selection is not affected
							}
						}
					
					break;
				case 'Marker Color':
					
						if (gCState && gCState.selection) {
							switch (gCState.selection.name) {
								case 'Marker':
									
										gCState.selection.strokeStyle = colorStrToRGBA(this.props.sPalMarkerColor, this.props.sPalMarkerAlpha);
										gCState.rconn.addColorToHistory('sPalMarkerColor', 'sPalMarkerColorHist', false);										
										gCState.valid = false;
									
									break;
								default:
									// this selection is not affected
							}
						}
					
					break;
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
						// 	gCState.rconn.clearSelection();
						// 	valid = false;
						// }
						// gCanState.valid = valid;
						gCState.valid = gCState.rconn.dDeleteAll(['cutout']);
						
					break;
				case 'Shapes':
				
						if (gCState.selection) {
							gCState.rconn.clearSelection();
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
					sGenPalTool: this.props.pButton.label,
					sGenCanMouseMoveCursor: null
				});
			}
		},
		render: function() {
			// props
			//		pButton
			//		sGenPalTool
			//		sPalSeldSubs
			//		sPalMultiDepresses
			//		sPalLineAlpha
			//		sPalLineColor
			//		sPalFillAlpha
			//		sPalFillColor
			//		sPalMarkerAlpha
			//		sPalMarkerColor
			//		sGenColorPickerDropping
			
			var cProps = {
				className:'pbutton',
				onClick: this.click
			};
			if (this.props.sPalSeldSubs[this.props.pButton.label]) {
				for (var i=0; i<this.props.pButton.sub.length; i++) {
					if (this.props.pButton.sub[i].label == this.props.sPalSeldSubs[this.props.pButton.label]) {
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
				if (this.props.sGenPalTool == this.props.pButton.label) {
					cProps.className += ' pbutton-pressed';
				}
			}
			
			var cButtonIcon;
			if (['Color', 'Fill Color', 'Marker Color'].indexOf(this.props.pButton.label) > -1) {
				var rgbaStr;
				var dropping = this.props.sGenColorPickerDropping;
				if (this.props.pButton.label == 'Color') {
					rgbaStr = colorStrToRGBA(this.props.sPalLineColor, this.props.sPalLineAlpha);
					if (dropping && dropping.pStateColorKey == 'sPalLineColor') {
						cProps.className += ' eyedropper';
					}
				} else if (this.props.pButton.label == 'Fill Color') {
					rgbaStr = colorStrToRGBA(this.props.sPalFillColor, this.props.sPalFillAlpha);
					if (dropping && dropping.pStateColorKey == 'sPalFillColor') {
						cProps.className += ' eyedropper';
					}
				} else {
					// its Marker Color
					rgbaStr = colorStrToRGBA(this.props.sPalMarkerColor, this.props.sPalMarkerAlpha);
					if (dropping && dropping.pStateColorKey == 'sPalMarkerColor') {
						cProps.className += ' eyedropper';
					}
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
				!this.props.pButton.sub ? undefined : React.createElement(Submenu, overwriteObjWithObj({pSub:this.props.pButton.sub}, this.props)/*{sPalSeldSubs:this.props.sPalSeldSubs, pButton:this.props.pButton, pSub:this.props.pButton.sub, sPalLineAlpha:this.props.sPalLineAlpha, sPalLineColor:this.props.sPalLineColor, sPalFillAlpha:this.props.sPalFillAlpha, sPalFillColor:this.props.sPalFillColor, sPalMarkerAlpha:this.props.sPalMarkerAlpha, sPalMarkerColor:this.props.sPalMarkerColor}*/,
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
				var sPalSeldSubs = cloneObject(this.props.sPalSeldSubs);
				sPalSeldSubs[this.props.pButton.label] = this.props.pSubButton.label;
			
				gEditorStore.setState({
					sGenPalTool: this.props.pButton.label,
					sPalSeldSubs: sPalSeldSubs
				});
			}
			
			if (this.props.sGenPalTool == 'Blur') {
				if (gCState && gCState.selection) {
					switch (gCState.selection.name) {
						case 'Gaussian':
						case 'Mosaic':
							
								if (gCState.selection.name != sPalSeldSubs[this.props.sGenPalTool]) {
									gCState.selection.name = sPalSeldSubs[this.props.sGenPalTool];
									gCState.valid = false;
								}
							
							break;
						default:
							// this selection is not affected
					}
				}
			}
		},
		render: function() {
			// props
			//		sPalLineAlpha
			//		sPalLineColor
			//		sPalFillAlpha
			//		sPalFillColor
			//		sPalMarkerAlpha
			//		sPalMarkerColor
			//		sGenColorPickerDropping
			//		pSubButton
			//		pButton
			//		sPalSeldSubs

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

			if (!this.props.pSubButton.special && this.props.sPalSeldSubs[this.props.pButton.label] == this.props.pSubButton.label) {
				cProps.className += ' pbutton-pressed';
			}
			
			return React.createElement('div', cProps,
				this.props.pSubButton.icon
			);
		}
	});
	
	var LineTools = React.createClass({
		displayName: 'LineTools',
		render: function() {
			// props
			//		sPalLineWidth
			return React.createElement('div', {className:'plinetools'},
				React.createElement(InputNumber, {pLabel:'Line Width (px)', pStateVarName:'sPalLineWidth', sPalLineWidth:this.props.sPalLineWidth, pMin:0, pCStateSel:{'Rectangle':'lineWidth', 'Oval':'lineWidth', 'Line':'lineWidth', 'Pencil':'lineWidth', 'Marker':'lineWidth'}})
			);
		}
	});
	
	var BlurTools = React.createClass({
		displayName: 'BlurTools',
		render: function() {
			// props
			//		sPalBlurRadius
			//		sPalBlurBlock
			//		sGenPalTool
			//		sPalSeldSubs
			
			var subtool = this.props.sPalSeldSubs[this.props.sGenPalTool]
			
			var cInputNumberProps = {
				pMin: 1,
				pCStateSel: {'Gaussian':'level', 'Mosaic':'level'},
				key: subtool
			};
			
			if (subtool == 'Mosaic') {
				// Mosaic
				cInputNumberProps.sPalBlurBlock = this.props.sPalBlurBlock;
				cInputNumberProps.pStateVarName = 'sPalBlurBlock';
				cInputNumberProps.pLabel = 'Block Size (px)';
			} else {
				// Gaussian
				cInputNumberProps.sPalBlurRadius = this.props.sPalBlurRadius;
				cInputNumberProps.pStateVarName = 'sPalBlurRadius';
				cInputNumberProps.pLabel = 'Radius (px)';
			}
			
			return React.createElement('div', {className:'pblurlevel'},
				React.createElement(InputNumber, cInputNumberProps)
			);
		}
	});
	
	var DimensionTools = React.createClass({
		displayName: 'DimensionTools',
		render: function() {
			// props
			//		sPalWidth
			//		sPalHeight
			
			return React.createElement('div', {className:'pdimtools'},
				React.createElement(InputNumber, {pLabel:'Width', pMin:0, pStateVarName:'sGenPalW', sGenPalW:this.props.sGenPalW, pCStateSel:{'cutout':'w', 'Rectangle':'w', 'Oval':'w'} }),
				React.createElement(InputNumber, {pLabel:'Height', pMin:0, pStateVarName:'sGenPalH', sGenPalH:this.props.sGenPalH, pCStateSel:{'cutout':'h', 'Rectangle':'h', 'Oval':'h'} })
			)
		}
	});
	
	var TextTools = React.createClass({
		displayName: 'TextTools',
		componentDidUpdate: function(prevProps, prevState) {
			if (gCState && gCState.selection && gCState.selection.name == 'Text') {
				var newValid = true;
				if (prevProps.sPalFontFace != this.props.sPalFontFace) {
					gCState.selection.fontface = this.props.sPalFontFace;
					newValid = false;
				}
				if (prevProps.sPalFontBold != this.props.sPalFontBold) {
					gCState.selection.fontbold = this.props.sPalFontBold;
					newValid = false;
				}
				if (prevProps.sPalFontItalic != this.props.sPalFontItalic) {
					gCState.selection.fontitalic = this.props.sPalFontItalic;
					newValid = false;
				}
				// sPalFontSize is handled by InputNumber
				if (!newValid) {
					gCState.selection.font = gCState.rconn.calcCtxFont(gCState.selection);
					gCState.valid = newValid;
				} // else if its true based on these tests, i dont want to set it to true. because maybe someone somewhere else set it to true
			}
		},
		change: function(e) {
			var setStateObj = {};
			setStateObj.sPalFontFace = e.target.value;
			gEditorStore.setState(setStateObj);
		},
		click: function(aStateVar, e) {
			var setStateObj = {};
			setStateObj[aStateVar] = !this.props[aStateVar];
			gEditorStore.setState(setStateObj);
		},
		render: function() {
			// props
			//		sPalFontFace
			//		sPalFontSize
			//		sPalFontBold
			//		sPalFontItalic
			//		sPalFontUnderline
			//		sPalFontWrap - word warp. null if wrap on word. or string for the ellipsis to use.
			
			var cFontFamilies = gFonts.map(function(aFamily) {
				return React.createElement('option', {style:{fontFamily:aFamily}, value:aFamily},
					aFamily
				);
			});
			// :todo: list all the fonts on the system
			
			return React.createElement('div', {className:'ptexttools'},
				React.createElement('div', {className:'ptexttools-row'},
					React.createElement('div', {},
						// React.createElement('label', {htmlFor:'font_family'},
							// 'Font'
						// ),
						React.createElement('select', {id:'font_family', defaultValue:this.props.sPalFontFace, onChange:this.change},
							cFontFamilies
						)
					)
				),
				React.createElement('div', {className:'ptexttools-row'},
					React.createElement(InputNumber, {pLabel:'Font Size (px)', pStateVarName:'sPalFontSize', sPalFontSize:this.props.sPalFontSize, pMin:1, pCStateSel:{'Text':'fontsize'} }),
					React.createElement('div', {className:'pbutton ptexttools-bold' + (this.props.sPalFontBold ? ' pbutton-pressed' : ''), onClick:this.click.bind(this, 'sPalFontBold')},
						'B'
					),
					React.createElement('div', {className:'pbutton ptexttools-italic' + (this.props.sPalFontItalic ? ' pbutton-pressed' : ''), onClick:this.click.bind(this, 'sPalFontItalic')},
						'I'
					)
					// React.createElement('div', {className:'pbutton ptexttools-italic' },
					// 	'U'
					// )
				)
			)
		}
	});
	
	var ArrowTools = React.createClass({
		displayName: 'ArrowTools',
		checkStart: function() {
			gEditorStore.setState({
				sPalArrowStart: !this.props.sPalArrowStart
			})
		},
		checkEnd: function() {
			gEditorStore.setState({
				sPalArrowEnd: !this.props.sPalArrowEnd
			})
		},
		componentDidUpdate: function(prevProps, prevState) {
			// console.log('arrowtools did update!', 'prevProps:', uneval(prevProps), 'nowProps:', uneval(this.props));
			if (gCState && gCState.selection && gCState.selection.name == 'Line') {
				var newValid = true;
				if (prevProps.sPalArrowStart != this.props.sPalArrowStart) {
					gCState.selection.arrowStart = this.props.sPalArrowStart;
					newValid = false;
				}
				if (prevProps.sPalArrowEnd != this.props.sPalArrowEnd) {
					gCState.selection.arrowEnd = this.props.sPalArrowEnd;
					newValid = false;
				}
				// sPalArrowLength is handled by InputNumber
				if (!newValid) {
					gCState.valid = newValid;
				} // else if its true based on these tests, i dont want to set it to true. because maybe someone somewhere else set it to true
			}
		},
		render: function() {
			// props
			//		sPalArrowStart
			//		sPalArrowEnd
			//		sPalArrowLength
			// //		sPalArrowWidth
			// //		sPalArrowAngle - the concavity feature of photoshop
			
			return React.createElement('div', {className:'parrowtools'},
				React.createElement('div', {className:'parrowtools-checks'},
					React.createElement('div', {},
						React.createElement('input', {id:'arrow_start', type:'checkbox', defaultChecked:this.props.sPalArrowStart, onClick:this.checkStart}),
						React.createElement('label', {htmlFor:'arrow_start'},
							'Start'
						)
					),
					React.createElement('div', {},
						React.createElement('input', {id:'arrow_end', type:'checkbox', defaultChecked:this.props.sPalArrowEnd, onClick:this.checkEnd}),
						React.createElement('label', {htmlFor:'arrow_end'},
							'End'
						)
					)
				),
				React.createElement(InputNumber, {pLabel:'Size', pStateVarName:'sPalArrowLength', sPalArrowLength:this.props.sPalArrowLength, pMin:1, pCStateSel:{'Line':'arrowLength'} })
				// React.createElement('div', {},
				// 	React.createElement('label', {htmlFor:'arrow_length'},
				// 		'Length'
				// 	),
				// 	React.createElement('input', {id:'arrow_length', type:'text'})
				// ),
				// React.createElement('div', {},
				// 	React.createElement('label', {htmlFor:'arrow_width'},
				// 		'Width'
				// 	),
				// 	React.createElement('input', {id:'arrow_width', type:'text'})
				// ),
				// React.createElement('div', {},
				// 	React.createElement('label', {htmlFor:'arrow_angle'},
				// 		'Angle'
				// 	),
				// 	React.createElement('input', {id:'arrow_angle', type:'text'})
				// )
			)
		}
	});
	
	var ColorPicker = React.createClass({
		// to use this, must create a global object called `gColorPickerSetState`. key must be same as what you pass to pSetStateName, this is only place it is used.
		displayName: 'ColorPicker',
		componentDidUpdate: function(prevProps, prevState) {
			// start - very specific to nativeshot
			if (gCState && gCState.selection) {
				if (prevProps.sColor != this.props.sColor || prevProps.sAlpha != this.props.sAlpha) {
					if (this.props.pStateColorKey == 'sPalFillColor') {
						// if currently selection object obeys fillcolor, then apply this new fillcolor
						switch (gCState.selection.name) {
							case 'Rectangle':
							case 'Oval':
							case 'Text':
								
									gCState.selection.fillStyle = colorStrToRGBA(this.props.sColor, this.props.sAlpha);
									gCState.valid = false;
								
								break;
							default:
								// this selection is not affected
						}
					} else if (this.props.pStateColorKey == 'sPalLineColor') {
						// if currently selection object obeys linecolor, then apply this new linecolor
						switch (gCState.selection.name) {
							case 'Rectangle':
							case 'Oval':
							case 'Line':
							case 'Pencil':
								
									gCState.selection.strokeStyle = colorStrToRGBA(this.props.sColor, this.props.sAlpha);
									if (gCState.selection.name == 'Line') { // as fillStyle for line is set equal to that of its strokeStyle
										gCState.selection.fillStyle = colorStrToRGBA(this.props.sColor, this.props.sAlpha);
									}
									gCState.valid = false;
								
								break;
							default:
								// this selection is not affected
						}
					} else if (this.props.pStateColorKey == 'sPalMarkerColor') {
						// if currently selection object obeys markercolor, then apply this new markercolor
						switch (gCState.selection.name) {
							case 'Marker':
								
									gCState.selection.strokeStyle = colorStrToRGBA(this.props.sColor, this.props.sAlpha);
									gCState.valid = false;
								
								break;
							default:
								// this selection is not affected
						}
					}
				}
			}
			// end - very specific to nativeshot
		},
		render: function() {
			// props
			//		sColor // must a be a string of either a hex (#fff, fff, #ffffff, ffffff) OR a string that is understood by the function rgbToHex
			//		sAlpha // must be a percentage so 0 - 100
			//		pStateColorKey
			//		pStateAlphaKey
			//		pSetStateName - a string, it must be the store to use for the pStateColorKey and pStateAlphaKey
			//		sGenColorPickerDropping
			//		sHistory - array of strings for sColor
			//		pStateHistoryKey
			
			// only supports rgb mode
			
			// convert sColor into object of rgb
			var sColor = this.props.sColor + '';
			// console.error('this.props:', this.props);
			var rgb;
			var hex;
			if (sColor[0] == '#' || sColor.length == 3 || sColor.length == 6) {
				hex = sColor;
				if (hex[0] == '#') {
					hex = hex.substr(1);
				}
				rgb = hexToRgb(sColor);
				// console.log('rgb:', rgb);
			} else {
				hex = rgbToHex(false, sColor);
				// console.log('hex:', hex);
				rgb = hexToRgb(hex);
				// console.log('rgb2:', rgb);
			}
			
			var pRgba = rgb;
			pRgba.a = parseInt(this.props.sAlpha);
			
			return React.createElement('div', {className:'colorpicker'},
				React.createElement('div', {className:'colorpicker-inner'},
					React.createElement(ColorPickerChoices, {pStateColorKey:this.props.pStateColorKey, pSetStateName:this.props.pSetStateName, sGenColorPickerDropping:this.props.sGenColorPickerDropping, sColor:this.props.sColor, pStateHistoryKey:this.props.pStateHistoryKey, sHistory:this.props.sHistory}),
					React.createElement(ColorPickerBoard, {pRgba:pRgba}),
					React.createElement(ColorPickerSliders, {pRgba:pRgba}),
					React.createElement(ColorPickerCodes, {pHex:hex, pRgba:pRgba, pStateColorKey:this.props.pStateColorKey, pStateAlphaKey:this.props.pStateAlphaKey, pSetStateName:this.props.pSetStateName})
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
					React.createElement('div', {className:'colorpicker-slider-rainbow'},
						React.createElement('div', {className:'colorpicker-slider-thingy'})
					),
					React.createElement('div', {className:'colorpicker-slider-alpha'},
						React.createElement('div', {className:'colorpicker-slider-thingy', style:{left:'calc(' + this.props.pRgba.a+'% - ' + Math.round(9*(this.props.pRgba.a/100)) + 'px)'} }) /* -5px to counter the width so it doesnt oveflow at 100% */
					)
				),
				React.createElement('div', {style:{backgroundImage:bgImgStr}, className:'colorpicker-sliders-wrap colorpicker-slider-preview'})
			);
		}
	});
	var ColorPickerCodes = React.createClass({
		displayName: 'ColorPickerCodes',
		changehex: function(e) {
			var newValue = e.target.value;
			console.log('newValue:', newValue);
			if (newValue.length == 3 || newValue == 6) {
				var setStateObj = {};
				setStateObj[this.props.pStateColorKey] = newValue;
				gColorPickerSetState[this.props.pSetStateName](setStateObj);
			}
		},
		componentDidUpdate: function(prevProps) {
			if (prevProps.pHex != this.props.pHex) {
				this.refs.hexinput.value = this.props.pHex;
			}
		},
		render: function() {
			// props
			//		pRgba
			//		pStateColorKey
			//		pStateAlphaKey
			//		pSetStateName
			//		pHex
			
			var rgba = this.props.pRgba;
			// var hexColor = rgbToHex(false, rgba.r, rgba.g, rgba.b); // hex color without hash

			var cPropsCommon = {
				className: 'colorpicker-codes-',
				pMin: 0,
				pMouseSens: 3,
				pMax: 255,
			};
			var cPropsR = overwriteObjWithObj({}, cPropsCommon);
			var cPropsG = overwriteObjWithObj({}, cPropsCommon);
			var cPropsB = overwriteObjWithObj({}, cPropsCommon);
			var cPropsA = overwriteObjWithObj({}, cPropsCommon);
			
			
			cPropsR.pLabel = 'R';
			cPropsG.pLabel = 'G';
			cPropsB.pLabel = 'B';
			cPropsA.pLabel = 'A';

			cPropsR.className += 'r';
			cPropsG.className += 'g';
			cPropsB.className += 'b';
			cPropsA.className += 'a';
			
			cPropsA.pMax = 100;
			
			cPropsR[this.props.pStateColorKey] = rgba.r;
			cPropsG[this.props.pStateColorKey] = rgba.g;
			cPropsB[this.props.pStateColorKey] = rgba.b;
			cPropsA[this.props.pStateAlphaKey] = rgba.a; // link38711111
			
			cPropsR.pStateVarName = this.props.pStateColorKey;
			cPropsG.pStateVarName = this.props.pStateColorKey;
			cPropsB.pStateVarName = this.props.pStateColorKey;
			cPropsA.pStateVarName = this.props.pStateAlphaKey;
			
			cPropsR.pStateVarSpecial = {component:'r', rgba:rgba};
			cPropsG.pStateVarSpecial = {component:'g', rgba:rgba};
			cPropsB.pStateVarSpecial = {component:'b', rgba:rgba};
			// no need for special on cPropsA because rgba.a is same as this.props.sAlpha which is the proper in gEditorStore.state[this.pStateAlphaKey] per link38711111
			
			return React.createElement('div', {className:'colorpicker-codes'},
				React.createElement('div', {className:'colorpicker-codes-hex'},
					'Hex',
					React.createElement('input', {ref:'hexinput', type:'text', maxLength:6, defaultValue:this.props.pHex, onChange:this.changehex})
				),
				React.createElement(InputNumber, cPropsR),
				React.createElement(InputNumber, cPropsG),
				React.createElement(InputNumber, cPropsB),
				React.createElement(InputNumber, cPropsA)
			);
		}
	});
	var ColorPickerChoices = React.createClass({
		displayName: 'ColorPickerChoices',
		click: function(aColor) {
			var setStateObj = {};
			setStateObj[this.props.pStateColorKey] = aColor;
			
			var addColorSetStateObj = {};
			if (gCState.selection) {
				switch (gCState.selection.name) {
					case 'Marker':
					
							addColorSetStateObj = gCState.rconn.addColorToHistory(aColor, 'sPalMarkerColorHist', true);
							
						break;
					case 'Line':
					case 'Pencil':
					
							addColorSetStateObj = gCState.rconn.addColorToHistory(aColor, 'sPalBothColorHist', true);
					
						break;
					case 'Text':
					
							addColorSetStateObj = gCState.rconn.addColorToHistory(aColor, 'sPalBothColorHist', true);
					
						break;
					case 'Rectangle':
					case 'Oval':
					
							addColorSetStateObj = gCState.rconn.addColorToHistory(aColor, 'sPalBothColorHist', true);
							
						break;
					default:
						// no related color picker
				}
			}
			
			console.log('addColorSetStateObj:', addColorSetStateObj);
			
			gColorPickerSetState[this.props.pSetStateName](overwriteObjWithObj(setStateObj, addColorSetStateObj));
		},
		dropperClick: function() {
			var mixcan = document.createElement('canvas');
			mixcan.width = 1;
			mixcan.height = 1;
			gDroppingMixCtx = mixcan.getContext('2d');
			
			gColorPickerSetState[this.props.pSetStateName]({
				sGenColorPickerDropping: {
					initColor: this.props.sColor, // the original color before picking. so if user hits Esc i cancel the dropping and restore this color
					pStateColorKey: this.props.pStateColorKey
				}
			});
		},
		render: function() {
			//		pSetStateName
			//		pStateColorKey
			//		pStateDroppingKey
			//		pStateHistoryKey
			//		sHistory
			
			var historyColors = this.props.sHistory;
			var defaultColors = ['#000000', '#ffffff', '#4A90E2', '#D0021B', '#F5A623', '#F8E71C', '#00B050', '#9013FE'];
			if (this.props.pStateColorKey == 'sPalMarkerColor') {
				defaultColors = ['#77ef15', '#ffef15']
			}
			
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
						React.createElement('div', {className:'colorpicker-choices-opt colorpicker-history-icon'},
							'H'
						),
						!historyElements.length ? React.createElement('span', {style:{fontStyle:'italic'}}, 'No recent colors') : historyElements
					),
					React.createElement('div', {className:'colorpicker-choices-default'},
						defaultElements
					)
				),
				React.createElement('div', {className:'colorpicker-choices-wrap colorpicker-choices-dropper', onClick:this.dropperClick},
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
			//		sPalSeldSubs
			//		sPalLineAlpha
			//		sPalLineColor
			//		sPalFillAlpha
			//		sPalFillColor
			//		sGenColorPickerDropping
			//		sPalMarkerAlpha
			//		sPalMarkerColor
			
			var cChildren = [];
			for (var i=0; i<this.props.pSub.length; i++) {
				cChildren.push(React.createElement(SubButton, overwriteObjWithObj({pSubButton:this.props.pSub[i]}, this.props)/*{sPalSeldSubs:this.props.sPalSeldSubs, pButton:this.props.pButton, pSubButton:this.props.pSub[i], sPalLineAlpha:this.props.sPalLineAlpha, sPalLineColor:this.props.sPalLineColor, sPalFillAlpha:this.props.sPalFillAlpha, sPalFillColor:this.props.sPalFillColor, sPalMarkerAlpha:this.props.sPalMarkerAlpha, sPalMarkerColor:this.props.sPalMarkerColor}*/));
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
			
			// start - get active tool options
			// console.log('this.props.sGenPalTool:', this.props.sGenPalTool);
			var activeToolOptions;
			
			
			var activeToolEntry;
			for (var i=0; i<iEnd; i++) {
				var cLayoutEntry = pPalLayout[i];
				if (cLayoutEntry.label == this.props.sGenPalTool || cLayoutEntry.special == this.props.sGenPalTool) {
					activeToolEntry = cLayoutEntry;
					break;
				}
			}
			activeToolOptions = activeToolEntry.options || [];

			// test if activeToolEntry has an active sub, and if it that sub as options
			var activeToolActiveSubLabel = this.props.sPalSeldSubs[activeToolEntry.label];
			if (activeToolActiveSubLabel) {
				// yes it has a sub
				
				// get activeToolActiveSubEntry
				var activeToolActiveSubEntry;
				var activeToolEntrySubs = activeToolEntry.sub;
				var l = activeToolEntrySubs.length;
				for (var j=0; j<l; j++) {
					var activeToolEntrySubEntry = activeToolEntrySubs[j];
					if (activeToolEntrySubEntry.label == activeToolActiveSubLabel || activeToolEntrySubEntry.special == activeToolActiveSubLabel) {
						activeToolActiveSubEntry = activeToolEntrySubEntry;
						break;
					}
				}
				
				// test if activeToolActiveSubEntry has options
				if (activeToolActiveSubEntry.options) {
					activeToolOptions = activeToolOptions.concat(activeToolActiveSubEntry.options);
				}
			}
			// end - get active tool options
			
			for (var i=0; i<iEnd; i++) {
				var cLayoutEntry = pPalLayout[i];
				
				if (cLayoutEntry.isOption) {
					if (activeToolOptions.indexOf(cLayoutEntry.label || cLayoutEntry.special) == -1) {
						continue; // dont show this option
					}
				}
				
				if (cLayoutEntry.special) {
					if (cLayoutEntry.special in Specials) { // temp as all specials not yet defined
						var cSpecialProps = {};
						var cRequestingProps = cLayoutEntry.props;
						if (cRequestingProps) {
							for (var j=0; j<cRequestingProps.length; j++) {
								var cSpecialPropName = cRequestingProps[j];
								cSpecialProps[cSpecialPropName] = this.props[cSpecialPropName]
							}
						}
						cChildren.push(React.createElement(Specials[cLayoutEntry.special], cSpecialProps));
					}
				} else {
					/*
					if (cLayoutEntry.label == 'Clear Selection' && gCState && gCState.drawables) {
						// console.log('gCState:', gCState);
						var cutoutFound = false;
						var drawables = gCState.drawables;
						console.log('doing checks! drawables:', drawables);
						var l = drawables.length;
						for (var j=0; j<l; j++) {
							if (drawables[j].name == 'cutout') {
								cutoutFound = true;
								break;
							}
						}
						if (!cutoutFound) {
							continue; // meaning dont show this button
						}
					}
					*/
					cChildren.push(React.createElement(Button, overwriteObjWithObj({pButton:cLayoutEntry}, this.props)/*{sPalMultiDepresses:this.props.sPalMultiDepresses, sPalSeldSubs:this.props.sPalSeldSubs, pButton:cLayoutEntry, sGenPalTool:this.props.sGenPalTool, sPalLineAlpha:this.props.sPalLineAlpha, sPalLineColor:this.props.sPalLineColor, sPalFillAlpha:this.props.sPalFillAlpha, sPalFillColor:this.props.sPalFillColor, sPalMarkerAlpha:this.props.sPalMarkerAlpha, sPalMarkerColor:this.props.sPalMarkerColor}*/));
				}
			}
			
			var cProps = {
				className:'psubwrap',
				style: {
					fontSize: this.props.sPalSize + 'px',
					cursor: this.props.pPalSubwrapCursor
				}
			};
			
			if (this.props.sGenPalDragStart) {
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
	
	var InputNumber = React.createClass({
		displayName: 'InputNumber',
		wheel: function(e) {
			var newVal;
			// console.log('e:', e.deltaMode, e.deltaY);
			if (e.deltaY < 0) {
				newVal = this.props[this.props.pStateVarName] + this.crement;
			} else {
				newVal = this.props[this.props.pStateVarName] - this.crement;
			}
			
			this.limitTestThenSet(newVal);
			
			e.stopPropagation(); // so it doesnt trigger the wheel event on window. otherwise if ZoomView is showing, then it will change that zoom level
		},
		keydown: function(e) {
			var newVal;
			
			var crement = this.props.pCrement || 1;
			switch (e.key) {
				case 'ArrowUp':
				
						newVal = this.props[this.props.pStateVarName] + this.crement;
				
					break;
				case 'ArrowDown':
					
						newVal = this.props[this.props.pStateVarName] - this.crement;
					
					break;
				default:
					// do nothing
					
					// if its not a number then block it
					if (e.key.length == 1) {
						if (isNaN(e.key) || e.key == ' ') {
							e.preventDefault();
						} else {
							console.log('e.key:', '"' + e.key + '"');
						}
					}
					
					return;
			}
			
			this.limitTestThenSet(newVal);

		},
		limitTestThenSet: function(aNewVal) {
			// returns true if set
			if (this.props.pMin !== undefined && aNewVal < this.props.pMin) {
				return false; // below min limit, dont set it
			} else if (this.props.pMax !== undefined && aNewVal > this.props.pMax) {
				return false; // above min limit, dont set it
			} else {
				
				var newSetValue = this.getSetValue(aNewVal);
				if (this.props[this.props.pStateVarName] === newSetValue) {
					// its already that number
					console.log('already!');
					return true;
				}
				
				var newStateObj = {};
				newStateObj[this.props.pStateVarName] = newSetValue;
				
				gEditorStore.setState(newStateObj);
				
				if (this.props.pCStateSel) {
					var drawablePropToUpdate = this.props.pCStateSel[gCState.selection.name];
					if (gCState && gCState.selection && drawablePropToUpdate) {
						gCState.selection[drawablePropToUpdate] = newSetValue;
						if (drawablePropToUpdate.indexOf('font') === 0) {
							gCState.selection.font = gCState.rconn.calcCtxFont(gCState.selection);
						}
						gCState.valid = false; // so new blur level gets applied
					}
				}
				
				return true;
			}
		},
		mousedown: function(e) {
			this.downx = e.screenX;
			this.downval = this.props[this.props.pStateVarName];
			window.addEventListener('mouseup', this.mouseup, false);
			window.addEventListener('mousemove', this.mousemove, false);
			
			gEditorStore.setState({
				sGenInputNumberMousing: this.cursor
			});
			
			this.sGenInputNumberMousing = this.cursor; // keep track locally otherwise ill need to have whoever uses InputNumber pass in sGenInputNumberMousing as a prop
			
		},
		mousemove: function(e) {
			
			var delX = e.screenX - this.downx;
			
			var delSensitivity = Math.round(delX / this.mousesens);
			
			var newVal = this.downval + delSensitivity;
			
			// console.log('downx:', this.downx, 'screenx:', e.screenX, 'delX:', delX, 'delSensitivity:', delSensitivity);
			
			
			// i do this extra limit test here, as mouse move can move greatly so i might miss the minimum/maximum
			if (this.props.pMin !== undefined && newVal < this.props.pMin) {
				if (this.props[this.props.pStateVarName] !== this.props.pMin) {
					newVal = this.props.pMin;
				}
			} else if (this.props.pMax !== undefined && newVal > this.props.pMax) {
				if (this.props[this.props.pStateVarName] !== this.props.pMax) {
					newVal = this.props.pMax;
				}
			}
			
			if (this.getSetValue(this.props[this.props.pStateVarName]) != newVal) {
				if (!this.limitTestThenSet(newVal)) {
					if (this.sGenInputNumberMousing == this.cursor) {
						this.sGenInputNumberMousing = 'not-allowed';
						gEditorStore.setState({
							sGenInputNumberMousing: 'not-allowed'
						});
					}
				} else {
					if (this.sGenInputNumberMousing != this.cursor) {
						this.sGenInputNumberMousing = this.cursor;
						gEditorStore.setState({
							sGenInputNumberMousing: this.cursor
						});
					}
				}
			}
			
		},
		mouseup: function() {
			window.removeEventListener('mouseup', this.mouseup, false);
			window.removeEventListener('mousemove', this.mousemove, false);
			gEditorStore.setState({
				sGenInputNumberMousing: null
			});
		},
		change: function(e) {
			// cool this doesnt trigger unless user manually changes the field
			console.warn('triggering onchange!');
			// if (!e || !e.target) {
				// return;
			// }
			var newValueStr = e.target.value;
			if (!newValueStr || isNaN(newValueStr)) {
				return;
			}
			var newValue = parseInt(newValueStr);
			
			this.limitTestThenSet(newValue);
			this.lastDomElValue = newValueStr;
		},
		/*
		getReadValue: function() {
			//////////////////// no need see link link8844444 for why
			// if pStateVarName needs special processing to read from pStateVarName and/or set to pStateVarName
			switch (this.props.pStateVarReadSpecial) {
				case 'sPalLineColorRED':

						
				
					break;
				default:
					return this.props[this.props.pStateVarName];
			}
		},
		*/
		getSetValue: function(NEWVAL) {
			// if pStateVarName needs special processing to read from pStateVarName and/or set to pStateVarName
			if (this.props.pStateVarSpecial) {
				// in this switch make sure to return the specially processed value, that should get setState with
				
				// var NEWVAL = this.props[this.props.pStateVarName];
				
				switch (this.props.pStateVarName) {
					case 'sPalLineColor':
					case 'sPalFillColor':
					case 'sPalMarkerColor':

							var specialData = this.props.pStateVarSpecial;
							var rgba = specialData.rgba;
							
							var newRgb = {
								r: rgba.r,
								g: rgba.g,
								b: rgba.b
							};
							newRgb[specialData.component] = NEWVAL;
							return 'rgb(' + newRgb.r + ', ' + newRgb.g + ', ' + newRgb.b + ')';
					
						break;
					default:
						console.error('pStateVarName of "' + this.props.pStateVarName +'" is marked as special but no special getSetValue mechanism defined');
						throw new Error('pStateVarName of "' + this.props.pStateVarName +'" is marked as special but no special getSetValue mechanism defined');
				}
			} else {
				return NEWVAL;
			}
			
		},
		componentDidMount: function() {
			this.lastDomElValue = this.props[this.props.pStateVarName];
		},
		componentDidUpdate: function(prevProps) {
			// console.log('did update, prevProps:', prevProps);
			var newPropVal = this.props[this.props.pStateVarName];
			if (newPropVal != this.lastDomElValue) {
				if (prevProps.value != newPropVal) {
					this.refs.input.value = newPropVal;
					// console.log('ok updated input to', newPropVal);
					this.lastDomElValue = newPropVal;
				}
			}
			// else { console.log('no need to update input value as it matches lastDomElValue'); }
		},
		render: function() {
			// props
			//		sGenInputNumberMousing
			//		pStateVarName
			//		pLabel
			//		pMin
			//		pMax
			//		pMouseSens 0 default:10px
			//		pCrement - number to increment/decrement by - default:1
			// //		pCanvasStateObj
			//		[pStateVarName]
			//		pCursor - css cursor when mouse moving. default is ew-resize
			//		pStateVarSpecial - set it to anything other then false/undefined/null so it get get the special set value with getSetValue. i figured NO NEED for getReadValue as i pass in the special read value as [pStateVarName] so it updates the input properly link8844444
			//		pCStateSel - optional. array.
			//		
			
			this.crement = this.props.pCrement || 1;
			this.mousesens = this.props.pMouseSens || 10;
			this.cursor = this.props.pCursor || 'ew-resize';
			
			if (!this.domId) { // this is why gInputNumberId cant be -1. i cant have a id of 0
				gInputNumberId++;
				this.domId = gInputNumberId;
			}
			return React.createElement('div', {className:'inputnumber', onWheel:this.wheel},
				React.createElement('label', {htmlFor:'inputnumber_' + this.domId, className:'inputnumber-label', onMouseDown:this.mousedown},
					this.props.pLabel
				),
				React.createElement('input', {id:'inputnumber_' + this.domId, ref:'input', type:'text', onWheel:this.wheel, onKeyDown:this.keydown, onChange:this.change, defaultValue:this.props[this.props.pStateVarName], maxLength:(this.props.pMax === undefined ? undefined : (this.props.pMax+'').length) })
			);
		}
	})
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
	
	var Specials = {
		Divider: Divider,
		Accessibility: Accessibility,
		Handle: Handle,
		ColorPicker: ColorPicker,
		TextTools: TextTools,
		ArrowTools: ArrowTools,
		DimensionTools: DimensionTools,
		LineTools: LineTools,
		BlurTools: BlurTools
	};
	
	var editorstateStr = aArrBufAndCore.editorstateStr;
	var editorstate;
	if (!editorstateStr) {
		// need to use defaults
		
		var palSeldSubs = {};
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
					palSeldSubs[palLayout[i].label] = hasFixableSubs;
				}
			}
		}
		
		editorstate = {
			pPalSize: 40,
			pPalSeldSubs: palSeldSubs,
			pPalMultiDepresses: {}, // if its depressed, then the tool label is the key and the value is true
			
			pPalLineColor: 'rgb(208, 2, 27)',
			pPalLineAlpha: 100,
			pPalBothColorHist: [],
			pPalFillColor: 'rgb(74, 144, 226)',
			pPalFillAlpha: 100,
			pPalMarkerColor: '#ffef15',
			pPalMarkerAlpha: 50,
			pPalMarkerColorHist: [],
			
			pPalBlurBlock: 5,
			pPalBlurRadius: 10,
			
			pPalZoomViewCoords: {x:20, y:300},
			pPalZoomViewLevel: 8,
			
			pPalArrowLength: 24,
			pPalArrowEnd: false,
			pPalArrowStart: false,
			
			pPalLineWidth: 12,
			
			pPalFontSize: 24,
			pPalFontFace: 'Arial',
			pPalFontBold: undefined,
			pPalFontItalic: undefined,
			pPalFontUnderline: undefined,
			
			pCanHandleSize: 19,
			pPalSeldSubs: palSeldSubs
		};
	} else {
		editorstate = JSON.parse(editorstateStr);
	}
	var initProps = editorstate;
	console.log('initProps:', initProps);
	initProps.pQS = pQS;
	initProps.pScreenshotArrBuf = aArrBufAndCore.screenshotArrBuf;
	initProps.pPhys = pPhys;
	initProps.pCanInterval = 30;
	initProps.pPalLayout = palLayout; // link1818181

	console.log('initProps:', initProps);
	
	var initReact = function() {
		window.addEventListener('unload', unload, false);
		
		ReactDOM.render(
			React.createElement(Editor, initProps),
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

// imagedata manipulation functions
var imagedata = {
	grayscale: function(aImageData) {
		var data = aImageData.data;
		for (var i = 0; i < data.length; i += 4) {
			var avg = (data[i] + data[i +1] + data[i +2]) / 3;
			data[i]     = avg; // red
			data[i + 1] = avg; // green
			data[i + 2] = avg; // blue
		}
	},
	invert: function(aImageData) {
		var data = aImageData.data;
		for (var i = 0; i < data.length; i += 4) {
			data[i]     = 255 - data[i];     // red
			data[i + 1] = 255 - data[i + 1]; // green
			data[i + 2] = 255 - data[i + 2]; // blue
		}
	},
	pixelate: function(aImageData, w, h, aOptions={}) {
		// http://stackoverflow.com/a/36678815/1828637
		
		var optionsDefaults = {
			blockSize: 10
		};
		validateOptionsObj(aOptions, optionsDefaults);
		
		var data = aImageData.data;
		
		var wmax = ((w / aOptions.blockSize) | 0) * aOptions.blockSize;
		var wrest = w - wmax;

		var hmax = ((h / aOptions.blockSize) | 0) * aOptions.blockSize;
		var hrest = h - hmax;

		var hh = aOptions.blockSize;

		for (var y = 0; y < h; y += aOptions.blockSize) {
			var ww = aOptions.blockSize;
			if (y == hmax) hh = hrest;

			for (var x = 0; x < w; x += aOptions.blockSize) {
				var n = 4 * (w * y + x);
				var r = data[n];
				var g = data[n + 1];
				var b = data[n + 2];
				var a = data[n + 3];

				if (x == wmax) ww = wrest;

				for (var j = 0; j < hh; j++) {
					var m = n + 4 * (w * j);

					for (var i = 0; i < ww; i++) {
						data[m++] = r;
						data[m++] = g;
						data[m++] = b;
						data[m++] = a;
					}
				}
			}
		}
	},
	gaussian_blur: function(aImageData, width, height, aOptions={}) {
		// http://www.quasimondo.com/StackBlurForCanvas/StackBlurDemo.html
		// http://www.quasimondo.com/StackBlurForCanvas/StackBlur.js
		
		var optionsDefaults = {
			radius: 10
		};
		validateOptionsObj(aOptions, optionsDefaults);
		
		var pixels = aImageData.data;
		var radius = aOptions.radius;
				
		var x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum,
		r_out_sum, g_out_sum, b_out_sum,
		r_in_sum, g_in_sum, b_in_sum,
		pr, pg, pb, rbs;
				
		var div = radius + radius + 1;
		var w4 = width << 2;
		var widthMinus1  = width - 1;
		var heightMinus1 = height - 1;
		var radiusPlus1  = radius + 1;
		var sumFactor = radiusPlus1 * ( radiusPlus1 + 1 ) / 2;
		
		var stackStart = new BlurStack();
		var stack = stackStart;
		for ( i = 1; i < div; i++ )
		{
			stack = stack.next = new BlurStack();
			if ( i == radiusPlus1 ) var stackEnd = stack;
		}
		stack.next = stackStart;
		var stackIn = null;
		var stackOut = null;
		
		yw = yi = 0;
		
		var mul_sum = mul_table[radius];
		var shg_sum = shg_table[radius];
		
		for ( y = 0; y < height; y++ )
		{
			r_in_sum = g_in_sum = b_in_sum = r_sum = g_sum = b_sum = 0;
			
			r_out_sum = radiusPlus1 * ( pr = pixels[yi] );
			g_out_sum = radiusPlus1 * ( pg = pixels[yi+1] );
			b_out_sum = radiusPlus1 * ( pb = pixels[yi+2] );
			
			r_sum += sumFactor * pr;
			g_sum += sumFactor * pg;
			b_sum += sumFactor * pb;
			
			stack = stackStart;
			
			for( i = 0; i < radiusPlus1; i++ )
			{
				stack.r = pr;
				stack.g = pg;
				stack.b = pb;
				stack = stack.next;
			}
			
			for( i = 1; i < radiusPlus1; i++ )
			{
				p = yi + (( widthMinus1 < i ? widthMinus1 : i ) << 2 );
				r_sum += ( stack.r = ( pr = pixels[p])) * ( rbs = radiusPlus1 - i );
				g_sum += ( stack.g = ( pg = pixels[p+1])) * rbs;
				b_sum += ( stack.b = ( pb = pixels[p+2])) * rbs;
				
				r_in_sum += pr;
				g_in_sum += pg;
				b_in_sum += pb;
				
				stack = stack.next;
			}
			
			
			stackIn = stackStart;
			stackOut = stackEnd;
			for ( x = 0; x < width; x++ )
			{
				pixels[yi]   = (r_sum * mul_sum) >> shg_sum;
				pixels[yi+1] = (g_sum * mul_sum) >> shg_sum;
				pixels[yi+2] = (b_sum * mul_sum) >> shg_sum;
				
				r_sum -= r_out_sum;
				g_sum -= g_out_sum;
				b_sum -= b_out_sum;
				
				r_out_sum -= stackIn.r;
				g_out_sum -= stackIn.g;
				b_out_sum -= stackIn.b;
				
				p =  ( yw + ( ( p = x + radius + 1 ) < widthMinus1 ? p : widthMinus1 ) ) << 2;
				
				r_in_sum += ( stackIn.r = pixels[p]);
				g_in_sum += ( stackIn.g = pixels[p+1]);
				b_in_sum += ( stackIn.b = pixels[p+2]);
				
				r_sum += r_in_sum;
				g_sum += g_in_sum;
				b_sum += b_in_sum;
				
				stackIn = stackIn.next;
				
				r_out_sum += ( pr = stackOut.r );
				g_out_sum += ( pg = stackOut.g );
				b_out_sum += ( pb = stackOut.b );
				
				r_in_sum -= pr;
				g_in_sum -= pg;
				b_in_sum -= pb;
				
				stackOut = stackOut.next;

				yi += 4;
			}
			yw += width;
		}

		
		for ( x = 0; x < width; x++ )
		{
			g_in_sum = b_in_sum = r_in_sum = g_sum = b_sum = r_sum = 0;
			
			yi = x << 2;
			r_out_sum = radiusPlus1 * ( pr = pixels[yi]);
			g_out_sum = radiusPlus1 * ( pg = pixels[yi+1]);
			b_out_sum = radiusPlus1 * ( pb = pixels[yi+2]);
			
			r_sum += sumFactor * pr;
			g_sum += sumFactor * pg;
			b_sum += sumFactor * pb;
			
			stack = stackStart;
			
			for( i = 0; i < radiusPlus1; i++ )
			{
				stack.r = pr;
				stack.g = pg;
				stack.b = pb;
				stack = stack.next;
			}
			
			yp = width;
			
			for( i = 1; i <= radius; i++ )
			{
				yi = ( yp + x ) << 2;
				
				r_sum += ( stack.r = ( pr = pixels[yi])) * ( rbs = radiusPlus1 - i );
				g_sum += ( stack.g = ( pg = pixels[yi+1])) * rbs;
				b_sum += ( stack.b = ( pb = pixels[yi+2])) * rbs;
				
				r_in_sum += pr;
				g_in_sum += pg;
				b_in_sum += pb;
				
				stack = stack.next;
			
				if( i < heightMinus1 )
				{
					yp += width;
				}
			}
			
			yi = x;
			stackIn = stackStart;
			stackOut = stackEnd;
			for ( y = 0; y < height; y++ )
			{
				p = yi << 2;
				pixels[p]   = (r_sum * mul_sum) >> shg_sum;
				pixels[p+1] = (g_sum * mul_sum) >> shg_sum;
				pixels[p+2] = (b_sum * mul_sum) >> shg_sum;
				
				r_sum -= r_out_sum;
				g_sum -= g_out_sum;
				b_sum -= b_out_sum;
				
				r_out_sum -= stackIn.r;
				g_out_sum -= stackIn.g;
				b_out_sum -= stackIn.b;
				
				p = ( x + (( ( p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1 ) * width )) << 2;
				
				r_sum += ( r_in_sum += ( stackIn.r = pixels[p]));
				g_sum += ( g_in_sum += ( stackIn.g = pixels[p+1]));
				b_sum += ( b_in_sum += ( stackIn.b = pixels[p+2]));
				
				stackIn = stackIn.next;
				
				r_out_sum += ( pr = stackOut.r );
				g_out_sum += ( pg = stackOut.g );
				b_out_sum += ( pb = stackOut.b );
				
				r_in_sum -= pr;
				g_in_sum -= pg;
				b_in_sum -= pb;
				
				stackOut = stackOut.next;
				
				yi += width;
			}
		}
		
	}
};

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
	// returned is in lower case
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
			// console.log('rgb:', rgb);
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
		// console.log('rgb:', rgb);
	} else {
		var hexFirst = rgbToHex(false, sColor);
		// console.log('hexFirst:', hexFirst);
		rgb = hexToRgb(hexFirst);
		// console.log('rgb2:', rgb);
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

// rev1 - https://gist.github.com/Noitidart/c4ab4ca10ff5861c720b
function validateOptionsObj(aOptions, aOptionsDefaults) {
	// ensures no invalid keys are found in aOptions, any key found in aOptions not having a key in aOptionsDefaults causes throw new Error as invalid option
	for (var aOptKey in aOptions) {
		if (!(aOptKey in aOptionsDefaults)) {
			console.error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value, aOptionsDefaults:', aOptionsDefaults, 'aOptions:', aOptions);
			throw new Error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value');
		}
	}
	
	// if a key is not found in aOptions, but is found in aOptionsDefaults, it sets the key in aOptions to the default value
	for (var aOptKey in aOptionsDefaults) {
		if (!(aOptKey in aOptions)) {
			aOptions[aOptKey] = aOptionsDefaults[aOptKey];
		}
	}
}

function arraysAvg(...intarr) {
	// intarr should all be same lenght
	// returns an array that is the avg of each element
	var sumarr = intarr[0];
	var l = sumarr.length;
	for (var i=1; i<intarr.length; i++) {
		var cIntarr = intarr[i];
		for (var j=0; j<l; j++) {
			sumarr[j] += cIntarr[j];
		}
	}
	
	var ial = intarr.length;
	for (var i=0; i<l; i++) {
		sumarr[i] /= ial;
	}
	
	return sumarr;
}

function arraysSum(...intarr) {
	// intarr should all be same lenght
	// returns an array that is the sum of each element
	
	var sumarr = intarr[0];
	var l = sumarr.length;
	for (var i=1; i<intarr.length; i++) {
		var cIntarr = intarr[i];
		for (var j=0; j<l; j++) {
			sumarr[j] += cIntarr[j];
		}
	}
	console.log('sumarr:', sumarr);
	return sumarr;
}

function spliceSlice(str, index, count, add) {
  return str.slice(0, index) + (add || "") + str.slice(index + count);
}

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
	for (var y=0; y<=yEnd; y++) {
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
		height: (botBound - topBound) + 1,
		width: w
	};
}

function canvas_arrow(context, fromx, fromy, tox, toy, headlen){
    // // var headlen = 10;   // length of head in pixels
    // var angle = Math.atan2(toy-fromy,tox-fromx);
    // context.moveTo(fromx, fromy);
    // context.lineTo(tox, toy);
    // 
	// // context.moveTo(tox, toy);
	// // context.lineTo(tox, toy);
	// 
	// // context.moveTo(tox, toy);
    // context.lineTo(tox-headlen*Math.cos(angle-Math.PI/6),toy-headlen*Math.sin(angle-Math.PI/6));
    // context.moveTo(tox, toy);
    // context.lineTo(tox-headlen*Math.cos(angle+Math.PI/6),toy-headlen*Math.sin(angle+Math.PI/6));
	
	// below is based on http://stackoverflow.com/a/36805543/1828637
	var x_center = tox;
	var y_center = toy;
	
	var r = headlen;
	
	var angle = Math.atan2(toy-fromy,tox-fromx); // this angle calc is taken from http://stackoverflow.com/a/6333775/1828637

	context.beginPath();
	
	// do these if you want to stroke it without a baseline
	// angle += (1/3)*(2*Math.PI);
	// angle += (1/3)*(2*Math.PI);
	
	var x = r*Math.cos(angle) + x_center;
	var y = r*Math.sin(angle) + y_center;

	context.moveTo(x, y);
	
	angle += (1/3)*(2*Math.PI)
	x = r*Math.cos(angle) + x_center;
	y = r*Math.sin(angle) + y_center;
	
	context.lineTo(x, y);
	
	angle += (1/3)*(2*Math.PI)
	x = r*Math.cos(angle) + x_center;
	y = r*Math.sin(angle) + y_center;
	
	context.lineTo(x, y);
	
	context.closePath();
	
	context.fill();
	// context.stroke();
}

// Converts from degrees to radians.
function radians(degrees) {
  return degrees * Math.PI / 180;
};
 
// Converts from radians to degrees.
function degrees(radians) {
  return radians * 180 / Math.PI;
};

/////////// stackblur


function BlurStack()
{
	this.r = 0;
	this.g = 0;
	this.b = 0;
	this.a = 0;
	this.next = null;
}

var mul_table = [
        512,512,456,512,328,456,335,512,405,328,271,456,388,335,292,512,
        454,405,364,328,298,271,496,456,420,388,360,335,312,292,273,512,
        482,454,428,405,383,364,345,328,312,298,284,271,259,496,475,456,
        437,420,404,388,374,360,347,335,323,312,302,292,282,273,265,512,
        497,482,468,454,441,428,417,405,394,383,373,364,354,345,337,328,
        320,312,305,298,291,284,278,271,265,259,507,496,485,475,465,456,
        446,437,428,420,412,404,396,388,381,374,367,360,354,347,341,335,
        329,323,318,312,307,302,297,292,287,282,278,273,269,265,261,512,
        505,497,489,482,475,468,461,454,447,441,435,428,422,417,411,405,
        399,394,389,383,378,373,368,364,359,354,350,345,341,337,332,328,
        324,320,316,312,309,305,301,298,294,291,287,284,281,278,274,271,
        268,265,262,259,257,507,501,496,491,485,480,475,470,465,460,456,
        451,446,442,437,433,428,424,420,416,412,408,404,400,396,392,388,
        385,381,377,374,370,367,363,360,357,354,350,347,344,341,338,335,
        332,329,326,323,320,318,315,312,310,307,304,302,299,297,294,292,
        289,287,285,282,280,278,275,273,271,269,267,265,263,261,259];
        
   
var shg_table = [
	     9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 
		17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19, 
		19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20,
		20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21,
		21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
		21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22, 
		22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
		22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23, 
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 
		23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24 ];