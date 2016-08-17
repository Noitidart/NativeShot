// var core = {
// 	addon: {
// 		name: 'NativeShot',
// 		id: 'NativeShot@jetpack',
// 		path: {
// 			scripts: 'chrome://nativeshot/content/resources/scripts/',
// 			styles: 'chrome://nativeshot/content/resources/styles/'
// 		},
// 		cache_key: Math.random()
// 	}
// };

var gSetStateObj;
var gEditorStore = {};
var gCanStore = {};
var gCState;
var gZState;
var gColorPickerSetState = {NativeShotEditor:null};
var gFonts;
var gInputNumberId = 0;
var gDroppingCoords = [0,0];
var gDroppingMixCtx;
var gCanMeasureHeight;
var gCtxMeasureHeight;
var gWidthRef;
var gHeightRef;
var gWinArr;
var gHotkeyRef = {};
var gMX = 0;
var gMY = 0;
var gMTime = 0;

function unload(aBoolDontCloseSelf) {
	// when triggered by event listener, aBoolDontCloseSelf is event, which qualifies as true
	removeUnload(); // because if aBoolDontCloseSelf is true, then unload() will trigger from call, and then when closed it will trigger again

	var immutableEditorstate = JSON.parse(JSON.stringify(gCanStore.rconn.state));
	for (var p in immutableEditorstate) {
		if (p.indexOf('sGen') !== 0) {
			var newP = 'p' + p.substr(1); // change first char
			immutableEditorstate[newP] = immutableEditorstate[p];
		}
		delete immutableEditorstate[p];
	}

	// callInBootstrap('broadcastToOthers', {
	// 	topic: 'removeUnloadAndClose',
	// 	iMon: tQS.iMon
	// });

	callInBootstrap('exitEditors', {
		iMon: aBoolDontCloseSelf ? tQS.iMon : null,
		editorstate: immutableEditorstate
	});
	// callInBootstrap('afterEditorsExited');
}

function removeUnload() {
	// called before closing, as otherwise the unload of this will trigger
	window.removeEventListener('unload', unload, false);
}

function reactSetState(aData) {
	var updatedStates = JSON.parse(aData.updatedStates);
	gEditorStore.setState(updatedStates, true);
}

function canSetState(aData) {
	// console.log('in canSetState, aData:', aData);
	var newCanState = JSON.parse(aData.cstate);

	if (newCanState.selection) {
		if (!newCanState.drawables) {
			console.error('if canSetState includes selection it MUST include drawables with it as well');
			throw new Error('if canSetState includes selection it MUST include drawables with it as well');
			// because the reference needs to be same as i affect this.selection.PROPERTY as if it were the object in the drawable
		}
		newCanState.selection = newCanState.drawables[gCanStore.rconn.dIndexOf(newCanState.selection, newCanState.drawables)];
	}

	for (var p in newCanState) {
		// if (p == 'valid') {
			// continue;
		// }
		gCState[p] = newCanState[p];
	}
	// gCState = JSON.parse(aData.cstate);

	// gCanStore.setCanState(false, true);
}

function zcanInvalidate(aData) {
	if (gZState) {
		gZState.mouse = aData.mouse;
		gZState.setInvalid(true);
	}
}

var gAction;
var gSub;
var gBoolClose;
function initCompositeForAction(aAction, aSub, boolClose) {
	if (!gCompositesArr) {
		gAction = aAction;
		gSub = aSub;
		gBoolClose = boolClose;
		var cutouts = gCState.drawables.filter(function(aToFilter) { return aToFilter.name == 'cutout' });
		if (!cutouts.length) {
			// alert('no selection made!');
		} else {

			var cutoutsAsRects = [];
			var l = cutouts.length;

			// figure out which monitors to request from - and bulid gCompositesArr
			gCompositesArr = [];
			for (var i=0; i<l; i++) {
				var cCutout = cutouts[i];
				var cEntry = {
					cutout: cCutout,
					id: i,
					data: {} // need to set which monitors need to provide this data, and then request those monitors to send it
				};

				gCompositesArr.push(cEntry);

				// figure out here which monitors to request from
				var allMonDim = tQS.allMonDim;
				var cCutoutRect = new Rect(cCutout.x, cCutout.y, cCutout.w, cCutout.h);
				for (var j=0; j<allMonDim.length; j++) {
					var iMon = j;
					var cRectMon = new Rect(allMonDim[j].x, allMonDim[j].y, allMonDim[j].w, allMonDim[j].h);
					var cCommonRect = cRectMon.intersect(cCutoutRect);
					if (!cCommonRect.isEmpty()) { // if its empty, then that means no intersection
						cEntry.data[iMon] = {
							arrbuf: null,
							subcutout: {x:cCommonRect.x, y:cCommonRect.y, w:cCommonRect.width, h:cCommonRect.height}
						}
					}
				}
			}

			console.log('need to request from:', JSON.parse(JSON.stringify(gCompositesArr)));

			// send requests to all the monitors
			for (var i=0; i<l; i++) {
				var cEntry = gCompositesArr[i];
				var cData = cEntry.data;

				for (var p in cData) { // p is iMon
					var requestLoad = {
						requestingMon: tQS.iMon,
						subcutout: cData[p].subcutout,
						id: cEntry.id
					};
					if (p == tQS.iMon) {
						setTimeout(function(aReqLoad) {
							requestCompositeData(aReqLoad);
						}.bind(null, requestLoad), false);
					} else {
						requestLoad.topic = 'requestCompositeData';
						callInBootstrap('broadcastToSpecific', Object.assign({
							toMon: p, // as p is target iMon
							iMon: tQS.iMon
						}, requestLoad));
					}
				}
			}

			callInBootstrap('addSelectionToHistory', {
				cutoutsArr: cutouts,
				iMon: tQS.iMon
			});

		}
	} else {
		alert('cannot make do another action as previous action is still in progress');
	}
}

function requestCompositeData(aData) {
	// emites a fullfillCompositeRequest to requestingMon
	console.log('incoming requestCompositeData, aData:', aData);
	var subcutout = aData.subcutout;
	console.log('getImageData with subcutout:', subcutout);
	// link1818111116
	var x = Math.round(subcutout.x - tQS.x);
	var y = Math.round(subcutout.y - tQS.y);
	var w = Math.round(subcutout.w);
	var h = Math.round(subcutout.h);
	console.log('sub:', subcutout.x, subcutout.y, subcutout.w, subcutout.h);
	console.log('get:', x, y, w, h);
	// var subImagedata = gCanStore.rconn.oscalectx0.getImageData(x, y, w, h);
	var requestingMon = aData.requestingMon;
	var cutoutid = aData.id;

	var subDrawctx;
	var subDrawdata;
	subDrawctx = gCanStore.rconn.oscalectx1;

	subDrawctx.clearRect(tQS.x, tQS.y, tQS.w, tQS.h);
	// subDrawctx.putImageData(subImagedata, subcutout.x, subcutout.y);
	subDrawctx.drawImage(gCanStore.rconn.oscalecan0, subcutout.x, subcutout.y, subcutout.w, subcutout.h, subcutout.x, subcutout.y, subcutout.w, subcutout.h);

	gCanStore.oscalectx1_draw = true;
	gCanStore.rconn.draw();

	subDrawdata = subDrawctx.getImageData(subcutout.x, subcutout.y, subcutout.w, subcutout.h);

	// send it back to requesting monitor
	var fullfillLoad = {
		id: cutoutid,
		arrBuf: subDrawdata.data.buffer,
		fromMon: tQS.iMon,
		__XFER: ['arrBuf']
	};
	if (requestingMon == tQS.iMon) {
		fullfillCompositeRequest(fullfillLoad);
	} else {
		fullfillLoad.topic = 'fullfillCompositeRequest';
		callInBootstrap('broadcastToSpecific', Object.assign({
			toMon: requestingMon,
			iMon: tQS.iMon
		}, fullfillLoad));
	}

}

var gCompositesArr; // array // each element is an object // when an array, other actions are not allowed
/*
{
	cutout: aCutout
	id: generated id for the cutout
	data: {
		__iMon__: null // when request fullfilled the null goes to {arrbuf: ArrayBuffer, subcutout:{x,y,w,h}}
	}
}
*/
function fullfillCompositeRequest(aData) {
	console.log('incoming fullfillCompositeRequest, aData:', aData);

	var cId = aData.id;
	var cMon = aData.fromMon;
	var cArrBuf = aData.arrBuf;

	var compositesArr = gCompositesArr;

	var l = compositesArr.length;
	for (var i=0; i<l; i++) {
		var cEntry = compositesArr[i];
		if (cEntry.id === cId) {
			console.log('id match on cEntry:', cEntry);
			cEntry.data[cMon].arrbuf = cArrBuf;
			break;
		}
	}

	// check if all requests were fullfilled - meaning if any "null arrbuf" entires in data
	var allRequestsFullfilled = true;
	commArrLoop:
	for (var i=0; i<l; i++) {
		var cEntry = compositesArr[i];
		for (var p in cEntry.data) { // p is iMon
			if (!cEntry.data[p].arrbuf) {
				console.log('arrbuf for cutout id "' + cEntry.id + '" and monitor "' + p + '" not yet delivered, compositesArr:', compositesArr);
				allRequestsFullfilled = false;
				break commArrLoop;
			}
		}
	}

	if (allRequestsFullfilled) {
		gCompositesArr = undefined;
		var action = gAction;
		var sub = gSub;
		var boolclose = gBoolClose;
		gAction = undefined;
		gSub = undefined;
		gBoolClose = undefined;

		// create composited rect
		var compositeRect;
		for (var i=0; i<l; i++) {
			var cEntry = compositesArr[i];
			var cCutout = cEntry.cutout;

			// var cutoutClone = this.makeDimsPositive(cCutout, true); // is already positive, so no need here

			var cRect = new Rect(cCutout.x, cCutout.y, cCutout.w, cCutout.h);


			if (!compositeRect) {
				compositeRect = cRect;
			} else {
				compositeRect = compositeRect.union(cRect);
			}
		}


		var can = document.createElement('canvas');
		var ctx = can.getContext('2d');
		// can.width = mmtm.w(compositeRect.width);
		// can.height = mmtm.h(compositeRect.height);
		can.width = compositeRect.width;
		can.height = compositeRect.height;

		// put all the image datas in the right spot on this ctx
		var allMonDim = tQS.allMonDim;
		for (var i=0; i<l; i++) {
			var cEntry = compositesArr[i];
			var cData = cEntry.data;
			for (var p in cData) {
				var iMon = p;
				var cSubData = cData[iMon];
				var subcutout = cSubData.subcutout;
				// link1818111116
				var x = Math.round(subcutout.x - allMonDim[iMon].x);
				var y = Math.round(subcutout.y - allMonDim[iMon].y);
				var w = Math.round(subcutout.w);
				var h = Math.round(subcutout.h);

				var subImagedata = new ImageData(new Uint8ClampedArray(cSubData.arrbuf), w, h);
				ctx.putImageData(subImagedata, subcutout.x - compositeRect.x, subcutout.y - compositeRect.y);
			}
		}

		// send data to bootstrap


		// determeint oauthServiceName
		var oauthServiceName;

		switch (action) {
			case formatStringFromNameCore('just_copy', 'main'):
			case formatStringFromNameCore('just_print', 'main'):

					oauthServiceName = action.toLowerCase();

				break;
			case formatStringFromNameCore('just_save', 'main'):

					if (sub == formatStringFromNameCore('browse', 'main')) {
						oauthServiceName = 'savebrowse';
					} else if (sub == formatStringFromNameCore('quick', 'main')) {
						oauthServiceName = 'savequick';
					}
					// if (!boolclose && oauthServiceName == 'savebrowse') {
					// 	oauthServiceName = 'save-browse-canvas';
					// }

				break;
			case formatStringFromNameCore('just_upload', 'main'):

					switch (sub) {
						case formatStringFromNameCore('imguranon', 'main'):

								oauthServiceName = 'imguranon';

							break;
						case formatStringFromNameCore('imgur', 'main'):

								oauthServiceName = 'imgur';

							break;
						case formatStringFromNameCore('gdrive', 'main'):

								oauthServiceName = 'gdrive';

							break;
						case formatStringFromNameCore('dropbox', 'main'):

								oauthServiceName = 'dropbox';

							break;
						default:
							console.error('should never get here unrecognized sub:', sub);
					}

				break;
			case formatStringFromNameCore('just_search', 'main'):

					switch (sub) {
						case formatStringFromNameCore('tineye', 'main'):

								oauthServiceName = 'tineye';

							break;
						case formatStringFromNameCore('just_google', 'main'):

								oauthServiceName = 'googleimages';

							break;
						case formatStringFromNameCore('bing', 'main'):

								oauthServiceName = 'bing';

							break;
						default:
							console.error('should never get here unrecognized sub:', sub);
					}

				break;
			case formatStringFromNameCore('share', 'main'):
			case formatStringFromNameCore('text_recognition', 'main'):

					switch(sub) {
						case formatStringFromNameCore('gocr', 'main'):
								oauthServiceName = 'gocr';
							break;
						case formatStringFromNameCore('ocrad', 'main'):
								oauthServiceName = 'ocrad';
							break;
						case formatStringFromNameCore('tesseract', 'main'):
								oauthServiceName = 'tesseract';
							break;
						case formatStringFromNameCore('ocrall', 'main'):
							oauthServiceName = 'ocrall';
					}


				break;
			default:
				console.error('no bootstrap action specified, action:', action, 'sub:', sub);
				return;
		}

		var postAction = function() {
			if (boolclose) {
				unload(false);
			}
		};

		// holds oauthServiceName which is serviceid
		var shot = {
			sessionid: gQS.sessionid,
			actionid: Date.now(),
			serviceid: oauthServiceName,
			width: compositeRect.width,
			height: compositeRect.height
		};

		// set up action_options
		if (oauthServiceName == 'savebrowse') {
			if (!boolclose) {
				shot.action_options = {
					imon: tQS.iMon
				};
			}
		}

		var postDataGen = function() {
			var cb = function(aArg2) {
				var { __PROGRESS } = aArg2;

				if (__PROGRESS) {
					// update editor about its progress
				}

			};
			callInBootstrap('processAction', shot, boolclose ? undefined : cb);

			if (boolclose) {
				unload(false);
			}
		};

		switch (core.nativeshot.services[oauthServiceName].datatype) {
			case 'png_dataurl':
					shot.dataurl = can.toDataURL('image/png', '');
					postDataGen();
				break;
			case 'plain_arrbuf':
					shot.arrbuf = ctx.getImageData(0, 0, compositeRect.width, compositeRect.height).data.buffer;
					shot.__XFER = ['arrbuf'];
					postDataGen();
				break;
			case 'png_arrbuf':
					(can.toBlobHD || can.toBlob).call(can, function(b) {
						var r = new FileReader();
						r.onloadend = function() {
							shot.arrbuf = r.result;
							shot.__XFER = ['arrbuf'];
							postDataGen();
						};
						r.readAsArrayBuffer(b);
					}, 'image/png');
				break;
		}

		// debug - put this canvas on the document
		// can.style.position = 'absolute';
		// can.style.zIndex = '9999';
		// can.style.top = 0;
		// can.style.left = 0;
		// document.body.appendChild(can);

		// gCanStore.rconn.oscalecan1.style.position = 'absolute';
		// gCanStore.rconn.oscalecan1.style.zIndex = '99999';
		// gCanStore.rconn.oscalecan1.style.top = 0;
		// gCanStore.rconn.oscalecan1.style.left = 0;
		// document.body.appendChild(gCanStore.rconn.oscalecan1);

		// setTimeout(function() {
			// document.body.removeChild(can);
			// // document.body.removeChild(gCanStore.rconn.oscalecan1);
		// }, 5000);
	}
}

// start - paste copied_drawable stuff
var gPasteDrawableResponses = null; // object, with key being the monitors requested from
function initPasteDrawable() {
	// check if request already in process
	if (gPasteDrawableResponses) {
		// paste already in progress
		return;
	}

	// start process
	if (!gCState.copied_drawable) {
		console.log('nothing in copied_drawable');
		return;
	}

	// ok continue
	gPasteDrawableResponses = {};

	// populate gPasteDrawableResponses with the monitors i need a response from
	var allMonDim = tQS.allMonDim;
	for (var toMon=0; toMon<allMonDim.length; toMon++) {
		gPasteDrawableResponses[toMon] = null;
	}

	// ask all monitors for their gMX and gMY and gMTime
	var requestLoad = {
		topic: 'respondPasteDrawableRequest',
		requestingMon: tQS.iMon
	};
	for (var toMon=0; toMon<allMonDim.length; toMon++) {
		if (toMon == tQS.iMon) {
			setTimeout(function() {
				respondPasteDrawableRequest(requestLoad);
			}, 0);
		} else {
			callInBootstrap('broadcastToSpecific', Object.assign({
				toMon,
				iMon: tQS.iMon
			}, requestLoad));
		}
	}
}
function respondPasteDrawableRequest(aData) {
	// emits a fullfillPasteDrawableRequest to requestingMon
	// if all requests fullfilled then it does the paste

	var requestingMon = aData.requestingMon;

	var responseLoad = {
		topic: 'completePasteDrawableRequest',
		fromMon: tQS.iMon,
		mx: gMX,
		my: gMY,
		mtime: gMTime
	};
	if (requestingMon == tQS.iMon) {
		completePasteDrawableRequest(responseLoad);
	} else {
		callInBootstrap('broadcastToSpecific', Object.assign({
			toMon: requestingMon,
			iMon: tQS.iMon
		}, responseLoad));
	}
}

function completePasteDrawableRequest(aData) {
	// called multiple times on the requesting mon, so called by respondPasteDrawableRequest, when all responses are in gPasteDrawableResponses, then it does the paste

	var fromMon = aData.fromMon;

	// update gPasteDrawableResponses
	gPasteDrawableResponses[fromMon] = {
		mx: aData.mx,
		my: aData.my,
		mtime: aData.mtime
	};

	// check if all responses fullfilled
	for (var p in gPasteDrawableResponses) {
		if (!gPasteDrawableResponses[p]) {
			return; // all responses not yet fullfilled so exit to not complete
		}
	}

	// got here, so all were fullfilled
	// find the latest time
	var latestTimeEntry;
	for (var p in gPasteDrawableResponses) {
		var cEntry = gPasteDrawableResponses[p];
		if (!latestTimeEntry || cEntry.mtime > latestTimeEntry.mtime) {
			latestTimeEntry = gPasteDrawableResponses[p];
		}
	}

	// paste drawable
	var clonedDrawable = JSON.parse(gCState.copied_drawable);
	clonedDrawable.id = gCState.nextid++;

	// translate the paste to where the mouse is currently
	if ('w' in clonedDrawable || 'chars' in clonedDrawable) {
		clonedDrawable.x = latestTimeEntry.mx;
		clonedDrawable.y = latestTimeEntry.my;
	} else if ('path' in clonedDrawable) {
		var path = clonedDrawable.path;
		var dx = latestTimeEntry.mx - path[0];
		var dy = latestTimeEntry.my - path[1];
		var l = path.length;
		for (var i=0; i<l; i++) {
			if (i % 2) {
				path[i] += dy;
			} else {
				path[i] += dx;
			}
		}
	} else if ('x2' in clonedDrawable) {
		var dx = latestTimeEntry.mx - clonedDrawable.x;
		var dy = latestTimeEntry.my - clonedDrawable.y;
		clonedDrawable.x += dx;
		clonedDrawable.x2 += dx;
		clonedDrawable.y += dy;
		clonedDrawable.y2 += dy;
	}
	else { console.error('what the heck??? no translate for this drawable?? clonedDrawable:', clonedDrawable); }

	console.log('clonedDrawable:', clonedDrawable);

	gPasteDrawableResponses = null;

	gCanStore.rconn.dAdd(clonedDrawable);
	gCanStore.setCanState(false);
}
// end - paste copied_drawable stuff

function insertTextFromClipboard(aData) {
	if (gCState.typing) {
		var mySel = gCState.selection; // if in typing mode, obviously a selection is there
		mySel.chars = mySel.chars.substr(0, mySel.index) + aData.text + mySel.chars.substr(mySel.index);
		mySel.index += aData.text.length;
		gCanStore.setCanState(false);
	}
}

function makeSelection(aData) {
	// aData.cutoutsArr is an array of cutout objects
	console.log('incoming makeSelection, aData:', aData);
	gCanStore.rconn.dDeleteAll(['cutout']);
	for (var i=0; i<aData.cutoutsArr.length; i++) {
		gCState.drawables.push(aData.cutoutsArr[i]);
	}
	gCState.selection = null;
	gCanStore.setCanState(false);
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
			props: ['sCanHandleSize', 'sPalSize', 'sGenAltKey']
		},
		{
			special: 'Divider'
		},
		// selection tools
		{
			label: formatStringFromNameCore('select', 'main'),
			icon: '\ue831', // the fontello font code
			sub: [
				{
					label: formatStringFromNameCore('last_selection', 'main'),
					icon: '\ue822',
					unfixable: true
				}
			],
			options: ['DimensionTools'],
			hotkey: 'm'
		},
		{
			label: formatStringFromNameCore('fullscreen', 'main'), // by default it selects the current monitor
			icon: '\ue80d',
			hotkey: 'ca', // hotkey does the currently set sub, in this case its fixed to current monitor (i should test which window the mouse is over)
			justClick: true,
			// this sub is specially added
			// sub: [
			// 	{
			// 		special: 'Monitors' // allow single monitor selecting or multiple
			// 	}
			// ]
		},
		{
			label: formatStringFromNameCore('window_wand', 'main'),
			icon: '\ue832',
			hotkey: 'w'
		},
		{
			label: formatStringFromNameCore('clear_selection', 'main'),
			justClick: true,
			icon: '\ue825',
			hotkey: 'd'
		},
		{
			special: 'Divider'
		},
		// misc tools
		//{
		//	label: 'Toggle Cursor',
		//	icon: '\ue834',
		//	multiDepress: true
		//},
		{
			label: formatStringFromNameCore('zoom_view', 'main'),
			icon: '\ue80f',
			multiDepress: true,
			hotkey: 'z'
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
			label: formatStringFromNameCore('freedraw', 'main'),
			icon: '\ue82d',
			hotkey: 'f',
			sub: [
				{
					label: formatStringFromNameCore('pencil', 'main'),
					icon: '\ue800',
					options: [formatStringFromNameCore('color', 'main')]
				},
				{
					label: formatStringFromNameCore('marker', 'main'), // this just its own remembered color and transparency - otherwise its a copy of pencil - im thinking cap the opacity at 10% - 90%
					icon: '\ueae9',
					options: [formatStringFromNameCore('marker_color', 'main')]
				}
			],
			options: ['LineTools']
		},
		{
			label: formatStringFromNameCore('shapes', 'main'),
			icon: '\ue827',
			hotkey: 's',
			sub: [
				{
					label: formatStringFromNameCore('rectangle', 'main'),
					icon: '\ue81b'
				},
				// { // discontinued this, as i plan to offer a border radius option for when Rectangle is selected
				// 	label: 'Rounded Rectangle',
				// 	icon: '\ue803'
				// },
				{
					label: formatStringFromNameCore('oval', 'main'),
					icon: '\ue83d'
				}
			],
			options: [formatStringFromNameCore('color', 'main'), formatStringFromNameCore('fill_color', 'main'), 'LineTools', 'DimensionTools']
		},
		{
			label: formatStringFromNameCore('line', 'main'),
			icon: '\ue82e',
			hotkey: 'l',
			options: [formatStringFromNameCore('color', 'main'), 'LineTools', 'ArrowTools']
		},
		{
			label: formatStringFromNameCore('text', 'main'), // if click with this tool, then its free type. if click and drag then its contained. if contained, then show sPalFontWrap option
			icon: '\ueae8',
			options: ['TextTools', formatStringFromNameCore('fill_color', 'main')],
			hotkey: 't'
		},
		{
			label: formatStringFromNameCore('blur', 'main'),
			icon: '\ue807',
			sub: [
				{
					label: formatStringFromNameCore('gaussian', 'main'),
					icon: '\ue814'
				},
				{
					label: formatStringFromNameCore('mosaic', 'main'),
					icon: '\ue819',
					options: ['Word Break / Ellipsis']
				}
			],
			options: ['BlurTools', 'DimensionTools'],
			hotkey: 'b'
		},
		{
			special: 'Divider'
		},
		// options
		{
			label: formatStringFromNameCore('color', 'main'),
			icon: 'S',
			justClick: true,
			sub: [
				{
					special: 'ColorPicker',
					props: {sGenInputNumberMousing:'sGenInputNumberMousing', sColor:'sPalLineColor', sAlpha:'sPalLineAlpha', pSetStateName:'$string$NativeShotEditor', pStateAlphaKey:'$string$sPalLineAlpha', pStateColorKey:'$string$sPalLineColor', sGenColorPickerDropping:'sGenColorPickerDropping', sHistory:'sPalBothColorHist', pStateHistoryKey:'$string$sPalBothColorHist'}
				}
			],
			isOption: true
		},
		{
			label: formatStringFromNameCore('marker_color', 'main'),
			icon: 'S',
			justClick: true,
			sub: [
				{
					special: 'ColorPicker',
					props: {sGenInputNumberMousing:'sGenInputNumberMousing', sColor:'sPalMarkerColor', sAlpha:'sPalMarkerAlpha', pSetStateName:'$string$NativeShotEditor', pStateAlphaKey:'$string$sPalMarkerAlpha', pStateColorKey:'$string$sPalMarkerColor', sGenColorPickerDropping:'sGenColorPickerDropping', sHistory:'sPalMarkerColorHist', pStateHistoryKey:'$string$sPalMarkerColorHist'}
				}
			],
			isOption: true
		},
		{
			special: 'LineTools',
			justClick: true,
			isOption: true,
			props: ['sPalLineWidth', 'sGenPalTool', 'sPalSeldSubs', 'sPalRectRadius']
		},
		{
			special: 'ArrowTools',
			icon: 'S',
			justClick: true,
			isOption: true,
			props: ['sPalArrowStart', 'sPalArrowEnd', 'sPalArrowLength']
		},
		{
			label: formatStringFromNameCore('fill_color', 'main'),
			icon: 'S',
			justClick: true,
			sub: [
				{
					special: 'ColorPicker',
					props: {sGenInputNumberMousing:'sGenInputNumberMousing', sColor:'sPalFillColor', sAlpha:'sPalFillAlpha', pSetStateName:'$string$NativeShotEditor', pStateAlphaKey:'$string$sPalFillAlpha', pStateColorKey:'$string$sPalFillColor', sGenColorPickerDropping:'sGenColorPickerDropping', sHistory:'sPalBothColorHist', pStateHistoryKey:'$string$sPalBothColorHist'}
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
			label: formatStringFromNameCore('just_save', 'main'),
			icon: '\ue803',
			hotkey: 'cs',
			justClick: true,
			sub: [
				{
					label: formatStringFromNameCore('quick', 'main'),
					icon: '\ue81c'
				},
				{
					label: formatStringFromNameCore('browse', 'main'),
					icon: '\ueaed'
				}
			]
		},
		{
			label: formatStringFromNameCore('just_print', 'main'),
			justClick: true,
			icon: '\ue804',
			hotkey: 'cp'
		},
		{
			label: formatStringFromNameCore('just_copy', 'main'),
			justClick: true,
			icon: '\ue80c',
			hotkey: 'cc'
		},
		{
			label: formatStringFromNameCore('just_upload', 'main'),
			justClick: true,
			icon: '\ue84e',
			hotkey: 'cu',
			sub: [
				{
					label: formatStringFromNameCore('imguranon', 'main'),
					icon: '\ue829'
				},
				{
					label: formatStringFromNameCore('imgur', 'main'),
					icon: '\ue826'
				},
				{
					label: formatStringFromNameCore('dropbox', 'main'),
					icon: '\ue808'
				},
				{
					label: formatStringFromNameCore('gdrive', 'main'),
					icon: '\ue833'
				}
			]
		},
		{
			label: formatStringFromNameCore('just_share', 'main'),
			justClick: true,
			icon: '\ue81e',
			hotkey: 'cm',
			sub: [
				{
					label: formatStringFromNameCore('twitter', 'main'),
					icon: '\ue802'
				},
				{
					label: formatStringFromNameCore('facebook', 'main'),
					icon: '\ue801'
				}
			]
		},
		{
			label: formatStringFromNameCore('just_search', 'main'),
			justClick: true,
			icon: '\ue81f',
			hotkey: 'cf',
			sub: [
				{
					label: formatStringFromNameCore('tineye', 'main'),
					icon: '\ue84f'
				},
				{
					label: formatStringFromNameCore('just_google', 'main'),
					icon: '\ue80e'
				},
				{
					label: formatStringFromNameCore('bing', 'main'),
					icon: '\ueaeb'
				}
			]
		},
		{
			label: formatStringFromNameCore('text_recognition', 'main'),
			justClick: true,
			icon: '\ueafd',
			hotkey: 'cr',
			sub: [
				{
					label: formatStringFromNameCore('ocrall', 'main'),
					icon: '\ue848'
				},
				{
					label: formatStringFromNameCore('gocr', 'main'),
					icon: '\ueafa'
				},
				{
					label: formatStringFromNameCore('ocrad', 'main'),
					icon: '\ue840'
				},
				{
					label: formatStringFromNameCore('tesseract', 'main'),
					icon: '\ue841'
				}
			]
		},
		// {
		// 	special: 'Divider'
		// },
		// {
		// 	label: 'Undo',
		// 	justClick: true,
		// 	icon: '\ue80b',
		// 	sub: [
		// 		{
		// 			label: 'Undo All',
		// 			icon: '\ue80c',
		// 			unfixable: true // never allow this to get fixed
		// 		},
		// 		{
		// 			special: 'UndoHistory'
		// 		}
		// 	]
		// },
		// {
		// 	label: 'Redo',
		// 	justClick: true,
		// 	icon: '\ue80a',
		// 	sub: [
		// 		{
		// 			label: 'Redo All',
		// 			icon: 'S',
		// 			unfixable: true // never allow this to get fixed
		// 		},
		// 		{
		// 			special: 'RedoHistory'
		// 		}
		// 	]
		// },
		{
			special: 'Divider'
		},
		{
			label: formatStringFromNameCore('close', 'main'),
			justClick: true,
			icon: '\ue835',
			hotkey: 'Escape' // currently doesnt work with the hotkey algo
		}
	];

	var gBroadcastTimeout;
	var Editor = React.createClass({
		displayName: 'Editor',
		getInitialState: function() {
			return {
				// general - these should not be synced to file of editor state
				sGenInputNumberMousing: null, // when mousing, this is set to string of what the cursor should be
				sGenColorPickerDropping: null, // when in drop, it is set to an object {pStateColorKey:'sPalLineColor',initColor:}
				sGenCanMouseMoveCursor: null,
				sGenPalDragStart: null, // is null when not dragging. when dragging it is {clientX:, clientY:}
				sGenPalZoomViewDragStart: null, // is null when not dragging. when dragging it is {clientX, clientY, initX, initY}
				sGenPalTool: formatStringFromNameCore('select', 'main'), // the label of the currently active tool
				sGenPalW: 0, // width
				sGenPalH: 0, // height
				sGenAltKey: false,
				sGenShiftKey: false,

				// all these keys below should be synced to fill of editor state

				// canvas realted
				sCanHandleSize: this.props.pCanHandleSize,

				// palette related
				sPalSize: this.props.pPalSize,
				sPalSeldSubs: this.props.pPalSeldSubs, // object holding the active sub for each tool label. so key is tool label. value is label of selected sab
				sPalMultiDepresses: this.props.pPalMultiDepresses,
				sPalX: this.props.pPalX,
				sPalY: this.props.pPalY,

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
				sPalRectRadius: this.props.pPalRectRadius,

				sPalFontSize: this.props.pPalFontSize,
				sPalFontFace: this.props.pPalFontFace,
				sPalFontBold: this.props.pPalFontBold,
				sPalFontItalic: this.props.pPalFontItalic,
				sPalFontUnderline: this.props.pPalFontUnderline
			};
		},
		componentDidMount: function() {
			var oSetState = this.setState.bind(this);
			// var needsBroadcast = false;
			this.setState = function(aObj, isBroadcast, fromDraw) {
				var shouldBroadcast;
				if (!fromDraw && aObj.setStateFromMouseMove) {
						if (!gSetStateObj) {
							gSetStateObj = aObj;
						} else {
							spliceObj(gSetStateObj, aObj);
						}
						// currently, whenever i set setStateFromMouseMove, i dont have a isBroadcast false, so no need for this
						// if (!isBroadcast && !needsBroadcast) {
							// needsBroadcast = true; // as this is a local global
						// }
						return;
				} else if (!fromDraw && !aObj.setStateFromMouseMove) {
						if (gSetStateObj) {
							spliceObj(gSetStateObj, aObj);
							aObj = gSetStateObj;
							gSetStateObj = null;
							delete aObj.setStateFromMouseMove;
						}
						// shouldBroadcast = !isBroadcast && needsBroadcast
						shouldBroadcast = !isBroadcast;
				} else if (fromDraw) {
					aObj = gSetStateObj;
					gSetStateObj = null;
					delete aObj.setStateFromMouseMove;
					// shouldBroadcast = !isBroadcast && needsBroadcast;
					// shouldBroadcast = !isBroadcast; // useless really, as when fromDraw the broadcast param is never specified
					shouldBroadcast = true;
				} else {
					console.error('should never ever get here!!');
					throw new Error('should never ever get here!!');
					shouldBroadcast = !isBroadcast;
				}
				if (shouldBroadcast) {
					// needsBroadcast = false;
					// clearTimeout(gBroadcastTimeout);
					// gBroadcastTimeout = setTimeout(function() {
						callInBootstrap('broadcastToOthers', {
							topic: 'reactSetState',
							updatedStates: JSON.stringify(aObj),
							iMon: tQS.iMon
						});

						// triggerNSCommEvent{
							// topic: 'broadcastToOthers',
							// postMsgObj: {
								// topic: 'reactSetState',
								// updatedStates: JSON.stringify(aObj)
							// },
							// iMon: tQS.iMon
						// });
					// }, 30);
				}
				oSetState(aObj);
			}.bind(this);
			gEditorStore.setState = this.setState.bind(this); // need bind here otherwise it doesnt work - last tested in React 0.14.x
			gColorPickerSetState.NativeShotEditor = this.setState.bind(this);

			gCanStore.setCanState = this.setCanState;

			///////////
			this.ctx = new MyContext(this.refs.can.getContext('2d'));
			this.ctx0 = this.refs.can0.getContext('2d');

			var screenshotImageData = new ImageData(new Uint8ClampedArray(this.props.pScreenshotArrBuf), this.props.pQS.w, this.props.pQS.h);

			if (this.props.pQS.win81ScaleX || this.props.pQS.win81ScaleY) {
				var canDum = document.createElement('canvas');
				canDum.setAttribute('width', tQS.w);
				canDum.setAttribute('height', tQS.h);

				var ctxDum = canDum.getContext('2d');
				ctxDum.putImageData(screenshotImageData, 0, 0);

				this.ctx0.scale(1/tQS.win81ScaleX, 1/tQS.win81ScaleY);
				// this.ctx.scale(1/tQS.win81ScaleX, 1/tQS.win81ScaleY);

				this.ctx0.drawImage(canDum, 0, 0);

				this.oscalecan0 = canDum;
				this.oscalectx0 = ctxDum;
			} else {
				this.ctx0.putImageData(screenshotImageData, 0, 0);
				this.oscalecan0 = this.refs.can0;
				this.oscalectx0 = this.ctx0;
			}

			// for drawing composite
			var canDimDum = document.createElement('canvas');
			var ctxDimDum = canDimDum.getContext('2d');
			canDimDum.setAttribute('width', tQS.w);
			canDimDum.setAttribute('height', tQS.h);
			this.oscalecan1 = canDimDum;
			this.oscalectx1 = new MyContext(ctxDimDum);
			this.oscalectx1.setScaleOff();

			this.cstate = {}; // state personal to this canvas. meaning not to be shared with other windows
			gCState = this.cstate;

			gCState.nextid = 0; // next id for drawable

			gCanStore.rconn = this; // connectio to the react component

			this.cstate.copied_drawable = null;

			// start - simon canvas stuff
			this.cstate.valid = false;
			gCanStore.oscalectx1_draw = false;

			// this.cstate.width = mmtm.w(this.props.pQS.w);
			// this.cstate.height = mmtm.h(this.props.pQS.h);

			this.cstate.drawables = []; // the collection of things to be drawn

			this.cstate.dragging = false; // Keep track of when we are dragging
			this.cstate.resizing = 0; // when mouses down with a tool that can draw
			this.cstate.lining = false; // when picking new end points for a line
			this.cstate.pathing = null; // when drawing with pencil or marker // it is set to a an array of 2 points when not null
			this.cstate.typing = false;
			this.cstate.selection = null;
			this.cstate.selectionHandles = [];

			this.cstate.dragoffx = 0; // See mousedown and mousemove events for explanation
			this.cstate.dragoffy = 0;

			this.cstate.downx = 0; // when the user mouses down on canvas
			this.cstate.downy = 0; // when the user mouses down on canvas

			this.cstate.downedInMon = -1;

			// **** Options! ****
			// now that Style is setup, i can add Drawable's

			this.cstate.dim = this.newDrawable(null, null, null, null, 'dim');
			console.log('this.cstate.dim:', this.cstate.dim);

			window.addEventListener('mousemove', this.mousemove, false);
			window.addEventListener('mousedown', this.mousedown, false);
			window.addEventListener('mouseup', this.mouseup, false);
			window.addEventListener('keyup', this.keyup, false);
			window.addEventListener('keydown', this.keydown, false);
			window.addEventListener('dblclick', this.dblclick, false);

			gCanStore.interval = setInterval(this.draw, this.props.pCanInterval);
			// start - simon canvas stuff
			///////////

			// add listeners
			window.addEventListener('wheel', this.wheel, false);
		},
		componentDidUpdate: function(prevProps, prevState) {
			var canValid = true;

				if (this.cstate.selection) {
					// if changed stuff affects canvas draw, then adjust the drawing and invalidate

					// invalidate due to handle change?
					if (prevState.sCanHandleSize != this.state.sCanHandleSize) {
						canValid = false;
					}

					// did any properties change that affects selected drawable? if so then update the properties of the drawable and invalidate
					var mySel = this.cstate.selection;

					var affectsStateVars = {
						fillStyle: ['sPalFillColor', 'sPalFillAlpha'],
						strokeStyle: mySel.name == formatStringFromNameCore('marker', 'main') ? ['sPalMarkerColor', 'sPalMarkerAlpha'] : ['sPalLineColor', 'sPalLineAlpha'],
						lineWidth: 'sPalLineWidth',
						// lineStyle: ,
						arrowStart: 'sPalArrowStart',
						arrowEnd: 'sPalArrowEnd',
						arrowLength: 'sPalArrowLength',
						fontface: 'sPalFontFace',
						fontbold: 'sPalFontBold',
						fontitalic: 'sPalFontItalic',
						fontsize: 'sPalFontSize',
						w: 'sGenPalW',
						h: 'sGenPalH',
						blurradius: 'sPalBlurRadius',
						blurblock: 'sPalBlurBlock'
					};

					// special for line
					var isText;
					if (mySel.name == formatStringFromNameCore('line', 'main')) {
						delete affectsStateVars.fillStyle;
					} else if (mySel.name == formatStringFromNameCore('text', 'main')) {
						isText = true;
					} else if (mySel.name == formatStringFromNameCore('rectangle', 'main')) {
						affectsStateVars.radius = 'sPalRectRadius';
					}

					// special stuff, for when resizing
					if (this.cstate.resizing) {
						delete affectsStateVars.w;
						delete affectsStateVars.h;
					}

					// start original block1929293055
					for (var p in mySel) {
						// console.log('on sel prop:', p);
						if (p in affectsStateVars) {
							// console.warn('in sel - testing diff');
							if (p == 'strokeStyle' || p == 'fillStyle') {
									var cColorVarName = affectsStateVars[p][0];
									var cAlphaVarName = affectsStateVars[p][1];

									if (prevState[cColorVarName] != this.state[cColorVarName] || prevState[cAlphaVarName] != this.state[cAlphaVarName]) {
										// console.log('mismatch on', cVarName, 'old:', prevState[cVarName], 'new:', this.state[cVarName]);
										var newColor = colorStrToCssRgba(this.state[cColorVarName], this.state[cAlphaVarName]);
										if (mySel[p] !== newColor) {
											canValid = false;
											mySel[p] = newColor;
											if (p == 'strokeStyle' && mySel.name == formatStringFromNameCore('line', 'main')) {
												mySel.fillStyle = newColor; // needed for arrow
											}
										}
									}
							} else {
								var cVarName = affectsStateVars[p];
								if (prevState[cVarName] != this.state[cVarName]) {
									// console.log('mismatch on', cVarName, 'old:', prevState[cVarName], 'new:', this.state[cVarName]);
									if (mySel[p] !== this.state[cVarName]) {
										// console.log('sending update on it');
										canValid = false;
										mySel[p] = this.state[cVarName];
										if (isText && p.indexOf('font') === 0) {
											mySel.font = this.calcCtxFont(mySel);
										}
									}
								}
							}
						}
					}
					// end original block1929293055

					// check if need to convert shape. like if rect was selected, and now made it oval. or gaussian and now mosaic - only for tools with a submenu
					if (prevState.sGenPalTool == this.state.sGenPalTool && prevState.sPalSeldSubs[prevState.sGenPalTool] != this.state.sPalSeldSubs[prevState.sGenPalTool]) {
						// exclude Freedraw submenu
						if (prevState.sGenPalTool != formatStringFromNameCore('freedraw', 'main')) {
							var nameOfDrawableOfPrevSubTool = prevState.sPalSeldSubs[prevState.sGenPalTool];
							var nameOfDrawableOfNowSubTool = this.state.sPalSeldSubs[prevState.sGenPalTool];
							if (mySel.name == nameOfDrawableOfPrevSubTool) {
								mySel.name = nameOfDrawableOfNowSubTool;
								canValid = false;
								if (nameOfDrawableOfPrevSubTool == formatStringFromNameCore('mosaic', 'main')) {
									delete mySel.blurblock;
									mySel.blurradius = this.state.sPalBlurRadius;
								} else if (nameOfDrawableOfPrevSubTool == formatStringFromNameCore('gaussian', 'main')) {
									delete mySel.blurradius;
									mySel.blurblock = this.state.sPalBlurBlock;
								} else if (nameOfDrawableOfPrevSubTool == formatStringFromNameCore('rectangle', 'main')) {
									delete mySel.radius;
								} else if (nameOfDrawableOfPrevSubTool == formatStringFromNameCore('oval', 'main')) {
									mySel.radius = this.state.sPalRectRadius;
								}
							}
						}
					}

				}

			// if pal tool changed, clear selection
			if (this.cstate && prevState.sGenPalTool && this.cstate.selection && prevState.sGenPalTool != this.state.sGenPalTool) {
				// clear selection
				var validPostClear = this.clearSelection();
				if (!validPostClear && canValid) {
					canValid = validPostClear;
				}
			}

			// if pal tool sub tool changes, and dropping was in progress, then cancel the dropping
			if (prevState.sGenPalTool != this.state.sGenPalTool || prevState.sPalSeldSubs[prevState.sGenPalTool] != this.state.sPalSeldSubs[prevState.sGenPalTool]) {
				this.cancelDropping();
			}

			// clean up when dropper is canceled
			if (prevState.sGenColorPickerDropping && !this.state.sGenColorPickerDropping) {
				gDroppingMixCtx = null;
			}

			//if (this.state.sPalMultiDepresses[formatStringFromNameCore('zoom_view', 'main')] != prevState.sPalMultiDepresses[formatStringFromNameCore('zoom_view', 'main')]) {
			//	if (this.state.sPalMultiDepresses[formatStringFromNameCore('zoom_view', 'main')]) {
			//		alert('adding wheel');
			//		window.addEventListener('wheel', this.wheel, false);
			//	} else {
			//		alert('removing wheel');
			//		window.removeEventListener('wheel', this.wheel, false);
			//	}
			//}

			// update canvas if it is in need of it
			gCanStore.setCanState(canValid, true); // dont broadcast this one, as the setting of the react state will trigger componentUpdate there, which will trigger this set can state
		},
		////// start - canvas functions
		newDrawable: function(x, y, w, h, name, aOptions={}) {

			var DRAWABLE = {};

			// set obj props
			DRAWABLE.name = name;
			DRAWABLE.id = this.cstate.nextid++;

			// set rest
			switch (name) {
				case 'dim':

						// dimensions
						// DRAWABLE.x = 0;
						// DRAWABLE.y = 0;
						// DRAWABLE.w = 100;
						// DRAWABLE.h = 100;

						// styleables (are a property on ctx like ctx.fillStyle or ctx.setLineDash) if undefined, that it is populated with respect to toolbar
						DRAWABLE.fillStyle = 'rgba(0, 0, 0, 0.6)';

					break;
				case formatStringFromNameCore('line', 'main'):

						// dimensions
						DRAWABLE.x = x;
						DRAWABLE.y = y;
						DRAWABLE.x2 = 'x2' in aOptions ? aOptions.x2 : x;
						DRAWABLE.y2 = 'y2' in aOptions ? aOptions.y2 : y;

						// other props
						DRAWABLE.arrowStart = aOptions.arrowStart || this.state.sPalArrowStart;
						DRAWABLE.arrowEnd = aOptions.arrowEnd || this.state.sPalArrowEnd;
						DRAWABLE.arrowLength = aOptions.arrowLength || this.state.sPalArrowLength;

						// styleables - if undefined, then it is set to the default value with respect to pal
						DRAWABLE.lineWidth = aOptions.lineWidth; // lineWidth is not set, then it is undefined, and then setStyleablesDefaults will set it to the default value, which respects pal
						DRAWABLE.strokeStyle = aOptions.strokeStyle;
						DRAWABLE.fillStyle = DRAWABLE.strokeStyle; // needed for drawing arrow
						DRAWABLE.setLineDash = aOptions.setLineDash;
						DRAWABLE.lineJoin = aOptions.lineJoin;

					break;
				case formatStringFromNameCore('pencil', 'main'):
				case formatStringFromNameCore('marker', 'main'):

						// has to be drawn, i dont allow constructing DRAWABLE with predefiend path. as in i dont offer aOptions.path
						DRAWABLE.path = [x, y];

						// styleables
						DRAWABLE.lineWidth = aOptions.lineWidth;
						DRAWABLE.strokeStyle = aOptions.strokeStyle;
						DRAWABLE.setLineDash = aOptions.setLineDash;
						DRAWABLE.lineJoin = aOptions.lineJoin;

					break;
				case formatStringFromNameCore('text', 'main'):

						// dimensions
						DRAWABLE.x = x;
						DRAWABLE.y = y;

						// others
						DRAWABLE.chars = '';
						DRAWABLE.index = 0; // the position of the ibeam
						DRAWABLE.fontsize = aOptions.fontsize; // must be a integer. no 'px' but it is assumed as px and used as such throughout
						DRAWABLE.fontface = aOptions.fontface;
						DRAWABLE.fontbold = aOptions.fontbold;
						DRAWABLE.fontitalic = aOptions.fontitalic;
						DRAWABLE.linespacing = 1;

						// styleables
						DRAWABLE.fillStyle = aOptions.fillStyle;
						DRAWABLE.textAlign = aOptions.textAlign;
						DRAWABLE.font = undefined; // i need to set it to undefined otherwise setStyleablesDefaults will not set it // user should only set fontsize,fontface,fontbold,fontitalic. the .font will be calculated by setStyleablesDefaults

					break;
				case formatStringFromNameCore('gaussian', 'main'):

						// dimensions
						DRAWABLE.x = x;
						DRAWABLE.y = y;
						DRAWABLE.w = w;
						DRAWABLE.h = h;

						// other
						DRAWABLE.blurradius = aOptions.level || this.state.sPalBlurRadius

					break;
				case formatStringFromNameCore('mosaic', 'main'):

						// dimensions
						DRAWABLE.x = x;
						DRAWABLE.y = y;
						DRAWABLE.w = w;
						DRAWABLE.h = h;

						// other
						DRAWABLE.blurblock = aOptions.level || this.state.sPalBlurBlock;
					break;
				case 'cutout':

						// dimensions
						DRAWABLE.x = x;
						DRAWABLE.y = y;
						DRAWABLE.w = w;
						DRAWABLE.h = h;

					break;
				case formatStringFromNameCore('rectangle', 'main'):
				case formatStringFromNameCore('oval', 'main'):

						// dimensions
						DRAWABLE.x = x;
						DRAWABLE.y = y;
						DRAWABLE.w = w;
						DRAWABLE.h = h;

						// styleables
						DRAWABLE.fillStyle = undefined;
						DRAWABLE.strokeStyle = undefined;
						DRAWABLE.lineWidth = undefined;
						DRAWABLE.setLineDash = undefined;
						DRAWABLE.lineJoin = undefined;

						if (name == formatStringFromNameCore('rectangle', 'main')) {
							DRAWABLE.radius = aOptions.radius || this.state.sPalRectRadius;
						}

					break;
				default:
					console.error('no props specified for a drawable with name "' + DRAWABLE.name + '"');
					throw new Error('no props specified for a drawable with name "' + DRAWABLE.name + '"');
			}

			// set styleables
			this.setStyleablesDefaults(DRAWABLE);

			return DRAWABLE;
		},
		dDraw: function(aDrawable) {
			// returns the value i should set this.cstate.valid to

			if (['cutout'].indexOf(aDrawable.name) > -1) {
				// not drawable
				console.error('trying to draw an undrawable, aDrawable:', aDrawable);
				return true;
			}

			// do check if it no select should be drawn, if it has 0 dimensions:
			if (('w' in aDrawable && !aDrawable.w) || ('h' in aDrawable && !aDrawable.h)) {
			// if (aDrawable.name != 'dim' && aDrawable.name != formatStringFromNameCore('line', 'main') && !aDrawable.w && !aDrawable.h) {
				console.error('width or height is 0 so not drawing, aDrawable:', aDrawable);
				return true;
			}

			// style the this.ctx
			// console.log('applying styles of aDrawable:', aDrawable);
			this.applyCtxStyle(aDrawable); // whatever keys exist that are in styleables will be styled to this.ctx

			// draw it
			switch (aDrawable.name) {
				case 'dim':

						var cutouts = this.cstate.drawables.filter(function(aToFilter) { return aToFilter.name == 'cutout' });
						if (!cutouts.length) {
							this.ctx.fillRect(tQS.x, tQS.y, tQS.w, tQS.h);
						} else {

							var fullscreenRect = new Rect(tQS.x, tQS.y, tQS.w, tQS.h);
							var cutoutsAsRects = [];
							var l = cutouts.length;
							for (var i=0; i<l; i++) {
								var cutout = cutouts[i];
								var cutoutClone = this.makeDimsPositive(cutout, true);
								cutoutsAsRects.push(new Rect(cutoutClone.x, cutoutClone.y, cutoutClone.w, cutoutClone.h));
							}
							var dimRects = subtractMulti(fullscreenRect, cutoutsAsRects);
							for (var i=0; i<dimRects.length; i++) {
								this.ctx.fillRect(dimRects[i].x, dimRects[i].y, dimRects[i].width, dimRects[i].height);
							}
						}

					break;
				case formatStringFromNameCore('rectangle', 'main'):

						if (!aDrawable.radius) {
							this.ctx.fillRect(aDrawable.x, aDrawable.y, aDrawable.w, aDrawable.h);
							if (aDrawable.lineWidth > 0) {
								this.ctx.strokeRect(aDrawable.x, aDrawable.y, aDrawable.w, aDrawable.h);
							}
						} else {
							var posd = this.makeDimsPositive(aDrawable, true);
							roundRect(this.ctx, posd.x, posd.y, posd.w, posd.h, aDrawable.radius, true, aDrawable.lineWidth ? true : false);
							// roundRect(this.ctx, aDrawable.x, aDrawable.y, aDrawable.w, aDrawable.h, aDrawable.radius, true, aDrawable.lineWidth ? true : false);
						}

					break;
				case formatStringFromNameCore('oval', 'main'):

						// per jsbin from here - http://stackoverflow.com/a/2173084/1828637

						var w = aDrawable.w;
						var h = aDrawable.h;
						var x = aDrawable.x;
						var y = aDrawable.y;

						var kappa = .5522848,
							ox = (w / 2) * kappa, // control point offset horizontal
							oy = (h / 2) * kappa, // control point offset vertical
							xe = x + w,           // x-end
							ye = y + h,           // y-end
							xm = x + w / 2,       // x-middle
							ym = y + h / 2;       // y-middle

						// this.ctx.save();
						this.ctx.beginPath();
						this.ctx.moveTo(x, ym);
						this.ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
						this.ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
						this.ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
						this.ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);

						// this.ctx.quadraticCurveTo(x,y,xm,y);
						// this.ctx.quadraticCurveTo(xe,y,xe,ym);
						// this.ctx.quadraticCurveTo(xe,ye,xm,ye);
						// this.ctx.quadraticCurveTo(x,ye,x,ym);

						this.ctx.fill();
						if (aDrawable.lineWidth > 0) {
							this.ctx.stroke();
						}

					break;
				case formatStringFromNameCore('line', 'main'):

						this.ctx.beginPath();
						this.ctx.moveTo(aDrawable.x, aDrawable.y);
						this.ctx.lineTo(aDrawable.x2, aDrawable.y2);
						this.ctx.stroke();

						if (aDrawable.arrowEnd) {
							// end arrow
							canvas_arrow(this.ctx, aDrawable.x, aDrawable.y, aDrawable.x2, aDrawable.y2, aDrawable.arrowLength);
						}

						if (aDrawable.arrowStart) {
							// start arrow
							canvas_arrow(this.ctx, aDrawable.x2, aDrawable.y2, aDrawable.x, aDrawable.y, aDrawable.arrowLength)
						}

					break;
				case formatStringFromNameCore('pencil', 'main'):
				case formatStringFromNameCore('marker', 'main'):

						this.ctx.beginPath();
						this.ctx.moveTo(aDrawable.path[0], aDrawable.path[1]);
						for (var i=2; i<aDrawable.path.length; i+=2) {
							this.ctx.lineTo(aDrawable.path[i], aDrawable.path[i+1]);
						}
						this.ctx.stroke();

					break;
				case formatStringFromNameCore('text', 'main'):

						this.ctx.fillText(aDrawable.chars, aDrawable.x, aDrawable.y);

					break;
				case formatStringFromNameCore('gaussian', 'main'):

						var positived = this.makeDimsPositive(aDrawable, true);

						var level = aDrawable.blurradius; // this.state.sPalBlurRadius;

						// get section of screenshot
						var srcCtx;
						var srcImgData;
						if (gCanStore.oscalectx1_draw) {
							srcCtx = this.oscalectx0; // this one is not an instance of MyContext
							srcImgData = srcCtx.getImageData(Math.round(positived.x - tQS.x), Math.round(positived.y - tQS.y), Math.round(positived.w), Math.round(positived.w));

							// apply filter
							imagedata.gaussian_blur(srcImgData, Math.round(positived.w), Math.round(positived.h), {
								radius: level
							});
						} else {
							srcCtx = this.ctx0;
							srcImgData = srcCtx.getImageData(mmtm.x(positived.x), mmtm.y(positived.y), mmtm.w(positived.w), mmtm.h(positived.h)); // no need for rouning as mmtm gets back without the scale

							// apply filter
							imagedata.gaussian_blur(srcImgData, mmtm.w(positived.w), mmtm.h(positived.h), { // // no need for rounding as mmtm gets back without the scale
								radius: Math.round(mmtm.w(level))
							});
						}

						// draw it
						this.ctx.putImageData(srcImgData, positived.x, positived.y);

					break;
				case formatStringFromNameCore('mosaic', 'main'):

						var positived = this.makeDimsPositive(aDrawable, true);

						var level = aDrawable.blurblock;

						// get section of screenshot
						var srcCtx;
						var srcImgData;
						if (gCanStore.oscalectx1_draw) {
							srcCtx = this.oscalectx0; // this one is not an instance of MyContext so i need to subtract tQS.# myself and round
							srcImgData = srcCtx.getImageData(Math.round(positived.x - tQS.x), Math.round(positived.y - tQS.y), Math.round(positived.w), Math.round(positived.w));

							// apply filter
							imagedata.pixelate(srcImgData, Math.round(positived.w), Math.round(positived.h), {
								blockSize: level
							});
						} else {
							srcCtx = this.ctx0;
							srcImgData = srcCtx.getImageData(mmtm.x(positived.x), mmtm.y(positived.y), mmtm.w(positived.w), mmtm.h(positived.h)); // no need for rouning as mmtm gets back without the scale

							// apply filter
							imagedata.pixelate(srcImgData, mmtm.w(positived.w), mmtm.h(positived.h), {
								blockSize: Math.round(mmtm.w(level))
							});
						}

						// draw it
						this.ctx.putImageData(srcImgData, positived.x, positived.y);

					break;
				default:
					// should never get here, as would have returned earlier, as aDrawable one is not drawable
			}

			return false;
		},
		dSelect: function(aDrawable) {
			// returns the valid value

			// console.error('doing select for drawable:', aDrawable);
			// set styles - and determine if its selectable
			var curStyle;
			switch (aDrawable.name) {
				case 'cutout':

						curStyle = {
							lineWidth: 1,
							setLineDash: [0, 3, 0],
							strokeStyle: 'black'
						};

					break;
				case formatStringFromNameCore('rectangle', 'main'):
				case formatStringFromNameCore('oval', 'main'):
				case formatStringFromNameCore('gaussian', 'main'):
				case formatStringFromNameCore('mosaic', 'main'):

						curStyle = {
							lineWidth: 1,
							setLineDash: [0, 3, 0],
							strokeStyle: 'black'
						};

					break;
				case formatStringFromNameCore('line', 'main'):
				case formatStringFromNameCore('pencil', 'main'):
				case formatStringFromNameCore('marker', 'main'):

						curStyle = {
							strokeStyle: '#ffffff',
							setLineDash: [],
							lineWidth: 1,
							fillStyle: '#000000'
						};

					break;
				case formatStringFromNameCore('text', 'main'):

						curStyle = {
							strokeStyle: 'black',
							setLineDash: [0, 3, 0],
							lineWidth: 1
						};

					break;
				default:
					// not selectable
						// dim
					console.warn('aDrawable drawable is NOT selectable! tried to select a drawable with name:', aDrawable.name, 'drawable obj:', aDrawable);
					return true; // so no need to invalidate
			}

			// do check if it no select should be drawn, if it has 0 dimensions:
			if (('w' in aDrawable && !aDrawable.w) || ('h' in aDrawable && !aDrawable.h)) {
			// if (aDrawable.name != 'dim' && aDrawable.name != formatStringFromNameCore('line', 'main') && !aDrawable.w && !aDrawable.h) {
				console.error('width or height is 0 so not drawing');
				return true;
			}

			// got here so curStyle exists meaning it does get drawn - yeah i know the whole "Drawable" is misleading, some "Drawable's" are not drawn
			this.applyCtxStyle(curStyle);

			// draw the selection of it
			switch (aDrawable.name) {
				case 'cutout':
				case formatStringFromNameCore('rectangle', 'main'):
				case formatStringFromNameCore('oval', 'main'):
				case formatStringFromNameCore('gaussian', 'main'):
				case formatStringFromNameCore('mosaic', 'main'):

						if (this.state.sCanHandleSize > 0) {
							this.ctx.strokeRect(aDrawable.x, aDrawable.y, aDrawable.w, aDrawable.h);
						}

						// draw handles
						var handleSize = Math.abs(this.state.sCanHandleSize);

						var half = handleSize / 2;

						var selectionHandles = this.cstate.selectionHandles;

						// top left, middle, right
						selectionHandles[0] = {
							x: aDrawable.x-half,
							y: aDrawable.y-half
						};

						selectionHandles[1] = {
							x: aDrawable.x+aDrawable.w/2-half,
							y: aDrawable.y-half
						};

						selectionHandles[2] = {
							x: aDrawable.x+aDrawable.w-half,
							y: aDrawable.y-half
						};

						//middle left
						selectionHandles[3] = {
							x: aDrawable.x-half,
							y: aDrawable.y+aDrawable.h/2-half
						};

						//middle right
						selectionHandles[4] = {
							x: aDrawable.x+aDrawable.w-half,
							y: aDrawable.y+aDrawable.h/2-half
						};

						//bottom left, middle, right
						selectionHandles[6] = {
							x: aDrawable.x+aDrawable.w/2-half,
							y: aDrawable.y+aDrawable.h-half
						};

						selectionHandles[5] = {
							x: aDrawable.x-half,
							y: aDrawable.y+aDrawable.h-half
						};

						selectionHandles[7] = {
							x: aDrawable.x+aDrawable.w-half,
							y: aDrawable.y+aDrawable.h-half
						};

						if (aDrawable.name != 'cutout' || (aDrawable.name == 'cutout' && this.state.sCanHandleSize > 0)) {
							this.ctx.fillStyle = '#000000';
							this.ctx.setLineDash([]);
							this.ctx.strokeStyle = '#ffffff';
							this.ctx.beginPath();
							for (i = 0; i < 8; i += 1) {
								cur = selectionHandles[i];
								this.ctx.rect(cur.x, cur.y, handleSize, handleSize);
							}

							this.ctx.fill();
							this.ctx.stroke();
						}

					break;
				case formatStringFromNameCore('text', 'main'):

						// var linespacingAsPx = aDrawable.linespacing * aDrawable.size;

						var font = this.calcCtxFont(aDrawable);

						var x;
						var y;
						var h;
						var w;
						var fontsize = aDrawable.fontsize; // i expect it to be in px
						if (aDrawable.chars.length) {
							var mh = measureHeight(font, fontsize, aDrawable.chars, {width:w, ctx:gCtxMeasureHeight, can:gCanMeasureHeight});
							// console.log('mh:', mh);
							w = mh.width;
							// i want to keep the baseline at aDrawable.y
							y = mh.relativeTop < 0 ? aDrawable.y + mh.relativeTop : aDrawable.y;
							h = mh.relativeBot >= 0 ? (aDrawable.y + mh.relativeBot) - y : aDrawable.y - y;
						} else {
							w = 0;
							h = fontsize;
							y = aDrawable.y - fontsize;
						}
						x = aDrawable.x;

						// if (this.state.sCanHandleSize > 0) {
							this.ctx.strokeRect(aDrawable.x, y, w, h);
						// }

						if (this.cstate.typing) {
							// draw ibeam
							var ibh = h; // ibeam height
							var ibx;
							if (aDrawable.index === 0) {
								ibx = 0;
							} else {
								ibx = this.ctx.measureText(aDrawable.chars.substr(0, aDrawable.index)).width;
							}
							var ibw = 3;
							this.ctx.fillStyle = 'black'; // ibeam color
							this.ctx.fillRect(aDrawable.x + ibx, y, ibw, ibh);
						}

					break;
				case formatStringFromNameCore('line', 'main'):

						// this.ctx.beginPath();
						// this.ctx.arc(aDrawable.x, aDrawable.y, this.state.sCanHandleSize, 0, 360);

						// this.ctx.fill();
						// this.ctx.stroke();

						// this.ctx.beginPath();
						// this.ctx.arc(aDrawable.x2, aDrawable.y2, this.state.sCanHandleSize, 0, 360);

						// this.ctx.fill();
						// this.ctx.stroke();

						// draw handles
						var handleSize = Math.abs(this.state.sCanHandleSize);
						var half = handleSize / 2;

						var selectionHandles = this.cstate.selectionHandles;
						selectionHandles.length = 2;

						selectionHandles[0] = {
							x: aDrawable.x-half,
							y: aDrawable.y-half
						};

						selectionHandles[1] = {
							x: aDrawable.x2-half,
							y: aDrawable.y2-half
						};

						this.ctx.beginPath();
						for (i = 0; i < 2; i += 1) {
							cur = selectionHandles[i];
							this.ctx.rect(cur.x, cur.y, handleSize, handleSize);
						};
						this.ctx.fill();
						this.ctx.stroke();

					break;
				case formatStringFromNameCore('pencil', 'main'):
				case formatStringFromNameCore('marker', 'main'):

						// this.ctx.beginPath();
						// this.ctx.arc(aDrawable.path[0], aDrawable.path[1], this.state.sCanHandleSize, 0, 360);

						// this.ctx.fill();
						// this.ctx.stroke();

						// this.ctx.beginPath();
						// this.ctx.arc(aDrawable.path[aDrawable.path.length - 2], aDrawable.path[aDrawable.path.length - 1], this.state.sCanHandleSize, 0, 360);

						// this.ctx.fill();
						// this.ctx.stroke();
						// draw handles
						var handleSize = Math.abs(this.state.sCanHandleSize);
						var half = handleSize / 2;

						// var selectionHandles = this.cstate.selectionHandles;
						// selectionHandles.length = 2;

						this.ctx.beginPath();
						// for (i = 0; i < 2; i += 1) {
							// cur = selectionHandles[i];
							// this.ctx.rect(cur.x, cur.y, handleSize, handleSize);
						// };
						this.ctx.rect(aDrawable.path[0] - half, aDrawable.path[1] - half, handleSize, handleSize);
						this.ctx.rect(aDrawable.path[aDrawable.path.length-2] - half, aDrawable.path[aDrawable.path.length-1] - half, handleSize, handleSize);
						this.ctx.fill();
						this.ctx.stroke();

					break;
				default:
					console.error('should never get here, as would have returned earlier, as aDrawable one is not drawable');
			}

			return false;
		},
		dContains: function(aDrawable, mx, my) {
			// returns 0 if not contained. returns 1 if contained in draggable area. returns 2 - 9 if in resizable area etc
			// is uncontainable
			if (['dim'].indexOf(aDrawable.name) > -1) {
				console.error('tried to test contains on an uncontainable! aDrawable:', aDrawable);
				return;
			}

			switch (aDrawable.name) {
				case formatStringFromNameCore('line', 'main'):

						if (this.cstate.selection && this.cstate.selection.id == aDrawable.id) {
							var selectionHandles = this.cstate.selectionHandles;
							var handleSize = Math.abs(this.state.sCanHandleSize);
							for (var i=0; i<2; i++) {
								if ((selectionHandles[i].x <= mx) && (selectionHandles[i].x + handleSize >= mx) &&
									(selectionHandles[i].y <= my) && (selectionHandles[i].y + handleSize >= my)) {
										return i + 10;
								}
							}
						}

						this.ctx.beginPath();
						this.ctx.setLineDash([]);
						this.ctx.lineWidth = aDrawable.lineWidth >= 20 ? aDrawable.lineWidth : 20;
						this.ctx.moveTo(aDrawable.x, aDrawable.y);
						this.ctx.lineTo(aDrawable.x2, aDrawable.y2);
						return this.ctx.isPointInStroke(mx, my) ? 1 : 0;

					break;
				case formatStringFromNameCore('pencil', 'main'):
				case formatStringFromNameCore('marker', 'main'):

						this.ctx.setLineDash([]);
						this.ctx.lineWidth = aDrawable.lineWidth >= 20 ? aDrawable.lineWidth : 20;
						this.ctx.beginPath();
						this.ctx.moveTo(aDrawable.path[0], aDrawable.path[1]);
						for (var i=2; i<aDrawable.path.length; i+=2) {
							this.ctx.lineTo(aDrawable.path[i], aDrawable.path[i+1]);
						}
						return this.ctx.isPointInStroke(mx, my) ? 1 : 0;

					break;
				case formatStringFromNameCore('text', 'main'):

						var font = this.calcCtxFont(aDrawable);
						this.ctx.font = font;

						var x;
						var y;
						var h;
						var w;
						var fontsize = aDrawable.fontsize; // i expect it to be in px
						if (aDrawable.chars.length) {
							var mh = measureHeight(font, fontsize, aDrawable.chars, {width:w, ctx:gCtxMeasureHeight, can:gCanMeasureHeight});
							// console.log('mh:', mh);
							w = mh.width;
							// i want to keep the baseline at aDrawable.y
							y = mh.relativeTop < 0 ? aDrawable.y + mh.relativeTop : aDrawable.y;
							h = mh.relativeBot >= 0 ? (aDrawable.y + mh.relativeBot) - y : aDrawable.y - y;
						} else {
							w = 0;
							h = fontsize;
							y = aDrawable.y - fontsize;
						}
						x = aDrawable.x;

						if ((x <= mx) && (x + w >= mx) &&
							(y <= my) && (y + h >= my)) {
								return 1;
						}

					break;
				default:
					// cutout, Rectangle, Oval, Gaussian, Mosaic

					// is aDrawable selected
					if (this.cstate.selection && this.cstate.selection.id == aDrawable.id) {
						var selectionHandles = this.cstate.selectionHandles;
						var handleSize = Math.abs(this.state.sCanHandleSize);
						for (var i=0; i<8; i++) {
							if ((selectionHandles[i].x - handleSize <= mx) && (selectionHandles[i].x + handleSize >= mx) &&
								(selectionHandles[i].y - handleSize <= my) && (selectionHandles[i].y + handleSize >= my)) {
									return i + 2;
							}
						}

						// check if mouse is on the border, if it is then do that resize
						var borderWidth = 10;

						// top border
						if ((aDrawable.x <= mx) && (aDrawable.x + aDrawable.w >= mx) &&
							(aDrawable.y - borderWidth <= my) && (aDrawable.y + borderWidth >= my)) {
								return 3;
						}

						// left border
						if ((aDrawable.x - borderWidth <= mx) && (aDrawable.x + borderWidth >= mx) &&
							(aDrawable.y <= my) && (aDrawable.h + aDrawable.y >= my)) {
								return 5;
						}

						// right border
						if ((aDrawable.w + aDrawable.x - borderWidth <= mx) && (aDrawable.w + aDrawable.x + borderWidth >= mx) &&
							(aDrawable.y <= my) && (aDrawable.h + aDrawable.y >= my)) {
								return 6;
						}

						// bottom border
						if ((aDrawable.x <= mx) && (aDrawable.x + aDrawable.w >= mx) &&
							(aDrawable.h + aDrawable.y - borderWidth <= my) && (aDrawable.h + aDrawable.y + borderWidth >= my)) {
								return 8;
						}
					}
					// All we have to do is make sure the Mouse X,Y fall in the area between
					// the shape's X and (X + Width) and its Y and (Y + Height)
					if ((aDrawable.x <= mx) && (aDrawable.x + aDrawable.w >= mx) &&
						(aDrawable.y <= my) && (aDrawable.y + aDrawable.h >= my)) {
							return 1;
					}
			}
		},
		dAdd: function(aDrawable) {
			// returns new valid value
			this.cstate.drawables.push(aDrawable);

			if (aDrawable.w && aDrawable.h) {
				// this.cstate.valid = false;
				return false;
			} else {
				// else the width and height are 0, no need to invalidate
				return true;
			}
		},
		dDelete: function(aDrawable) {
			// returns new valid value

			var drawables = this.cstate.drawables;
			switch (aDrawable.name) {
				case 'dim':

						// not added to list

					break;
				default:
					drawables.splice(this.dIndexOf(aDrawable), 1);
			}

			switch (aDrawable.name) {
				case formatStringFromNameCore('line', 'main'):

						if (aDrawable.x == aDrawable.x2 && aDrawable.y == aDrawable.y2) {
							return true;
						} else {
							return false;
						}

					break;
				case formatStringFromNameCore('pencil', 'main'):
				case formatStringFromNameCore('marker', 'main'):

						if (aDrawable.path.length == 2) {
							return true;
						} else {
							return false;
						}

					break;
				case formatStringFromNameCore('text', 'main'):

						return aDrawable.chars.length ? false : true;

					break;
				default:
					// cutout, Rectangle, Oval, Gaussian, Mosaic
					if (aDrawable.w && aDrawable.h) {
						// aDrawable.valid = false;
						return false;
					} else {
						// else the width and height are 0, no need to invalidate
						return true;
					}
			}
		},
		dBringToFront: function(aDrawable) {
			// brings the Drawable to the front of the z-index
			var drawables = this.cstate.drawables;
			drawables.push(drawables.splice(this.dIndexOf(aDrawable), 1)[0]);
		},
		dIndexOf: function(aDrawable, aDrawablesArr) {
			var drawables;
			if (aDrawablesArr) {
				drawables = aDrawablesArr;
			} else {
				drawables = this.cstate.drawables;
			}
			var l = drawables.length;
			for (var i=0; i<l; i++) {
				if (drawables[i].id == aDrawable.id) {
					return i;
				}
			}
			return -1;
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
						if (!this.dDelete(drawable)) {
							valid = false;
						}
						if (this.cstate.selection && this.cstate.selection == drawable) {
							this.clearSelection();
						}
					}
				} else {
					if (!this.dDelete(drawable)) {
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
		getMouse: function(e) {
			var mx = mtmm.x(e.clientX);
			var my = mtmm.y(e.clientY);

			return {
				x: mx,
				y: my
			};
		},
		clear: function() {
			this.ctx.clearRect(tQS.x, tQS.y, tQS.w, tQS.h);
		},
		draw: function() {
			if (gSetStateObj) {
				this.setState(null, null, true);
			}
			if (this.cstate.pathing && this.cstate.pathing.length) {
				this.cstate.selection.path = this.cstate.selection.path.concat(this.cstate.pathing.splice(0, 2));
			}

			var dropping = this.state.sGenColorPickerDropping;
			if (dropping && gDroppingCoords.length) {
				var dy = gDroppingCoords.pop();
				var dx = gDroppingCoords.pop();

				if (!gDroppingMixCtx) {
					var mixcan = document.createElement('canvas');
					mixcan.width = 1;
					mixcan.height = 1;
					gDroppingMixCtx = mixcan.getContext('2d');
				}

				gDroppingMixCtx.drawImage(this.refs.can0, mmtm.x(dx), mmtm.y(dy), 1, 1, 0, 0, 1, 1);
				gDroppingMixCtx.drawImage(this.refs.can, mmtm.x(dx), mmtm.y(dy), 1, 1, 0, 0, 1, 1);
				var mixedRGBA = gDroppingMixCtx.getImageData(0, 0, 1, 1).data;
				var newDropperObj = {};
				newDropperObj[dropping.pStateColorKey] = 'rgb(' + mixedRGBA[0] + ', ' + mixedRGBA[1] + ', ' + mixedRGBA[2] + ')'; // rgbToHex(true, mixedRGBA[0], mixedRGBA[0], mixedRGBA[2]);
				gEditorStore.setState(newDropperObj);


				// var cDropperColor = this.ctx.getImageData(dx, dy, 1, 1).data;
				// var cDropperColor0 = this.ctx0.getImageData(dx, dy, 1, 1).data;
				// var avgRGBA = arraysAvg(cDropperColor, cDropperColor0);
				// console.log('ok mixed. setting.', 'avgRGBA:', uneval(avgRGBA), 'dim:', uneval(cDropperColor), 'base:', uneval(cDropperColor0), 'mixedRGBA:', uneval(mixedRGBA));

			}

			if(!this.cstate.valid || gCanStore.oscalectx1_draw) {

				if (gCanStore.oscalectx1_draw) {
					this.actualCtx = this.ctx;
					this.ctx = this.oscalectx1;
				}

				var ctx = this.ctx;
				if (!gCanStore.oscalectx1_draw) {
					this.clear();
				}

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
						case formatStringFromNameCore('rectangle', 'main'):
						case formatStringFromNameCore('oval', 'main'):
								if (
									drawable.x > this.cstate.width || drawable.y > this.cstate.height || // test top left coord // this is why we need positive coords // THIS NEEDS REVISIT based on mtmm and mmtm
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

					this.dDraw(drawable);
				}
				// console.log('done drawing drawable');

				if (!gCanStore.oscalectx1_draw) {
					// draw selection
					if(this.cstate.selection != null) {
						// console.log('ok this.cstate.selection:', this.cstate.selection);
						this.dSelect(this.cstate.selection);
						// if (this.cstate.selection == this.dim || (this.cstate.selection.w && this.cstate.selection.h)) {
							// console.log('ok selecting');
							// this.cstate.selection.select(this.ctx);
						// }
					}
				}

				// ** Add stuff you want drawn on top all the time here **

				if (gCanStore.oscalectx1_draw) {
					gCanStore.oscalectx1_draw = false;
					this.ctx = this.actualCtx;
					return;
				}

				// draw the dim
				this.dDraw(this.cstate.dim);

				this.cstate.valid = true; // do not use gCanStore.setCanState here
				if (gZState) { gZState.setInvalid(); }

				// alt method to link38378777577
				if (this.cstate.resizing >= 2 && this.cstate.resizing <= 9) {
					gWidthRef.value = Math.abs(this.cstate.selection.w);
					gHeightRef.value = Math.abs(this.cstate.selection.h);
				}
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
		setCanState: function(isValid, dontBroadcast, forceBroadcast) {
			if (!isValid) {
				this.cstate.valid = false;
			}

			if (!isValid || forceBroadcast) {
				if (!dontBroadcast || forceBroadcast) {
					callInBootstrap('broadcastToOthers', {
						topic: 'canSetState',
						cstate: JSON.stringify(this.cstate),
						iMon: tQS.iMon
					});
				}
			}
		},
		setStyleablesDefaults: function(aDrawable) {
			// the styles and the value is their default value

			// specials
			var fontablesDefaults = {
				fontitalic: this.state.sPalFontItalic,
				fontbold: this.state.sPalFontBold,
				fontunderline: this.state.sPalFontUnderline,
				fontface: this.state.sPalFontFace,
				fontsize: this.state.sPalFontSize
			};

			var styleables = {
				lineWidth: this.state.sPalLineWidth,
				fillStyle: colorStrToCssRgba(gCanStore.rconn.state.sPalFillColor, this.state.sPalFillAlpha),
				textAlign: 'left',
				lineJoin: 'butt',
				font: this.calcCtxFont(fontablesDefaults),
				setLineDash: [],
				strokeStyle: aDrawable.name == formatStringFromNameCore('marker', 'main') ? colorStrToCssRgba(this.state.sPalMarkerColor, this.state.sPalMarkerAlpha) : colorStrToCssRgba(this.state.sPalLineColor, this.state.sPalLineAlpha)
			};

			if (aDrawable.name == formatStringFromNameCore('line', 'main')) { // non-isomorphic but i gotta
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

			if (this.state.sPalMultiDepresses[formatStringFromNameCore('zoom_view', 'main')]) {
				var cLevel = this.state.sPalZoomViewLevel;
				var nLevel;
				if (e.deltaY < 0) {
					nLevel = cLevel + 1;
				} else {
					nLevel = cLevel - 1;
				}

				if (nLevel >= 1 && nLevel <= 32) {
					gEditorStore.setState({
						sPalZoomViewLevel: nLevel
					});
					gZState.setInvalid();
				}
			}
		},
		mousemove: function(e) {
			// console.log('mousemove on mon:', tQS.iMon);
			if (this.cstate.downedInMon > -1 && tQS.iMon !== this.cstate.downedInMon) {
				console.warn('ignoring mousemove as it is not in monitor downed in');
				return;
			}

			var mouse = this.getMouse(e);
			var mx = mouse.x;
			var my = mouse.y;
			gMX = mx;
			gMY = my;
			gMTime = Date.now();
			// console.log('mm:', mx, my, 'm:', mmtm.x(mx), mmtm.y(my));
			if (this.state.sPalMultiDepresses[formatStringFromNameCore('zoom_view', 'main')]) {
				gZState.mouse = {x:mx, y:my};
				gZState.setInvalid();
			}

			if (this.state.sGenColorPickerDropping) {
				gDroppingCoords[0] = mx;
				gDroppingCoords[1] = my;
			} else if (this.state.sGenPalDragStart) {
				var sPalX = this.state.sGenPalDragStart.sPalX;
				var sPalY = this.state.sGenPalDragStart.sPalY;

				var win81ScaleX = this.state.sGenPalDragStart.monDim.win81ScaleX || 1;
				var win81ScaleY = this.state.sGenPalDragStart.monDim.win81ScaleY || 1;

				sPalX += win81ScaleX * (e.clientX - this.state.sGenPalDragStart.clientX);
				sPalY += win81ScaleY * (e.clientY - this.state.sGenPalDragStart.clientY);

				gEditorStore.setState({
					sPalX: sPalX,
					sPalY: sPalY,
					setStateFromMouseMove: true
				});
			} else if (this.state.sGenPalZoomViewDragStart) {
				gEditorStore.setState({
					sPalZoomViewCoords: {
						x: this.state.sGenPalZoomViewDragStart.initX + (e.clientX - this.state.sGenPalZoomViewDragStart.clientX),
						y: this.state.sGenPalZoomViewDragStart.initY + (e.clientY - this.state.sGenPalZoomViewDragStart.clientY)
					},
					setStateFromMouseMove: true
				});
			} else {
				var toolsub = this.state.sGenPalTool + '-' + (this.state.sPalSeldSubs[this.state.sGenPalTool] || '');
				if (this.cstate.dragging) {
					switch (this.cstate.selection.name) {
						case formatStringFromNameCore('rectangle', 'main'):
						case formatStringFromNameCore('oval', 'main'):
						case 'cutout':
						case formatStringFromNameCore('gaussian', 'main'):
						case formatStringFromNameCore('mosaic', 'main'):
						case formatStringFromNameCore('text', 'main'):

								this.cstate.selection.x = mx - this.cstate.dragoffx;
								this.cstate.selection.y = my - this.cstate.dragoffy;

							break;
						case formatStringFromNameCore('line', 'main'):

								var delx = mx - this.cstate.dragdown.mx;
								var dely = my - this.cstate.dragdown.my;

								this.cstate.selection.x = this.cstate.dragdown.x + delx;
								this.cstate.selection.y = this.cstate.dragdown.y + dely;
								this.cstate.selection.x2 = this.cstate.dragdown.x2 + delx;
								this.cstate.selection.y2 = this.cstate.dragdown.y2 + dely;

							break;
						case formatStringFromNameCore('pencil', 'main'):
						case formatStringFromNameCore('marker', 'main'):

								var delx = mx - this.cstate.dragdown.mx;
								var dely = my - this.cstate.dragdown.my;

								this.cstate.selection.path = this.cstate.dragdown.path.map(function(aHalfCoord, aI) {
									return (aI % 2 ? aHalfCoord + dely : aHalfCoord + delx);
								});

							break;
						default:
							console.error('deverror: no drag mechnaism defined');
					}
					gCanStore.setCanState(false); // Something's dragging so we must redraw
				} else if (this.cstate.resizing) {
					var oldx = this.cstate.selection.x;
					var oldy = this.cstate.selection.y;
					// console.log('this.cstate.resizing:', this.cstate.resizing, tQS.iMon);
					switch(this.cstate.resizing) {
						case 2:
							this.cstate.selection.x = mx;
							this.cstate.selection.y = my;
							this.cstate.selection.w += oldx - mx;
							// this.cstate.selection.h += oldy - my;


							if (e.shiftKey) {
								// draw sqaure
								var oldh = this.cstate.selection.h + oldy - my;
								this.cstate.selection.y = my + (oldh - this.cstate.selection.w);
								this.cstate.selection.h += oldy - this.cstate.selection.y;
							} else {
								this.cstate.selection.h += oldy - my;
							}

							break;
						case 3:
							this.cstate.selection.y = my;
							this.cstate.selection.h += oldy - my;
							break;
						case 4:
							this.cstate.selection.y = my;
							this.cstate.selection.w = mx - oldx;
							// this.cstate.selection.h += oldy - my;

							if (e.shiftKey) {
								// draw sqaure
								var oldh = this.cstate.selection.h + oldy - my;
								this.cstate.selection.y = my + (oldh - this.cstate.selection.w);
								this.cstate.selection.h += oldy - this.cstate.selection.y;
							} else {
								this.cstate.selection.h += oldy - my;
							}
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

							if (e.shiftKey) {
								// draw sqaure
								this.cstate.selection.h = this.cstate.selection.w;
							}
							break;
						case 8:
							this.cstate.selection.h = my - oldy;
							break;
						case 9:
							this.cstate.selection.w = mx - oldx;
							this.cstate.selection.h = my - oldy;

							if (e.shiftKey) {
								// draw sqaure
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

					// link38378777577
					// gEditorStore.setState({
					// 	sGenPalW: Math.abs(this.cstate.selection.w),
					// 	sGenPalH: Math.abs(this.cstate.selection.h),
					// 	setStateFromMouseMove: true
					// });
					gCanStore.setCanState(false);
				} else if (this.cstate.lining) {
					var sxkey, sykey, exkey, eykey;
					if (this.cstate.lining == 10) {
						// lining start
						sxkey = 'x2';
						sykey = 'y2';
						exkey = 'x';
						eykey = 'y';
					} else if (this.cstate.lining == 11) {
						// lining end
						sxkey = 'x';
						sykey = 'y';
						exkey = 'x2';
						eykey = 'y2';
					}

					var ex, ey;
					if (e.shiftKey) {
						var sx = this.cstate.selection[sxkey];
						var sy = this.cstate.selection[sykey];
						var length = pointsDistance(sx, sy, mx, my);

						// find nearest angle by 45deg
						var angle = degrees(pointsAngle(sx, sy, mx, my));
						var useAngle = closestNumber(angle, [-180, -135, -90, -45, 0, 45, 90, 135, 180]);

						ex = sx + (length * Math.cos(radians(useAngle)));
						ey = sy + (length * Math.sin(radians(useAngle)));

						// console.log('length:', length, 'angle:', angle, 'useAngle:', useAngle, 'sx:', sx, 'sy:', sy, 'ex:', ex, 'ey:', ey);
					} else {
						ex = mx;
						ey = my;
					}

					this.cstate.selection[exkey] = ex;
					this.cstate.selection[eykey] = ey;

					gCanStore.setCanState(false);
				} else if (this.cstate.pathing) {
					this.cstate.pathing[0] = mx;
					this.cstate.pathing[1] = my;
					gCanStore.setCanState(false);
				}
				// else if (this.cstate.typing) {
					// do nothing
				//}
				else {
					// just moving, see if mouse is over a resize point, or a drag point
					var dragFilterFunc;
					switch (toolsub) {
						case formatStringFromNameCore('select', 'main') + '-':

								dragFilterFunc = function(aToFilter) { return aToFilter.name == 'cutout' };

							break;
						case formatStringFromNameCore('shapes', 'main') + '-' + formatStringFromNameCore('rectangle', 'main'):
						case formatStringFromNameCore('shapes', 'main') + '-' + formatStringFromNameCore('oval', 'main'):

								dragFilterFunc = function(aToFilter) { return [formatStringFromNameCore('rectangle', 'main'), formatStringFromNameCore('oval', 'main')].indexOf(aToFilter.name) > -1 };

							break;
						case formatStringFromNameCore('text', 'main') + '-':

								dragFilterFunc = function(aToFilter) { return [formatStringFromNameCore('text', 'main')].indexOf(aToFilter.name) > -1 };

							break;
						case formatStringFromNameCore('line', 'main') + '-':

								dragFilterFunc = function(aToFilter) { return aToFilter.name == formatStringFromNameCore('line', 'main') };

							break;
						case formatStringFromNameCore('freedraw', 'main') + '-' + formatStringFromNameCore('pencil', 'main'):
						case formatStringFromNameCore('freedraw', 'main') + '-' + formatStringFromNameCore('marker', 'main'):

								dragFilterFunc = function(aToFilter) { return [formatStringFromNameCore('pencil', 'main'), formatStringFromNameCore('marker', 'main')].indexOf(aToFilter.name) > -1 };

							break;
						case formatStringFromNameCore('blur', 'main') + '-' + formatStringFromNameCore('gaussian', 'main'):
						case formatStringFromNameCore('blur', 'main') + '-' + formatStringFromNameCore('mosaic', 'main'):

								dragFilterFunc = function(aToFilter) { return [formatStringFromNameCore('gaussian', 'main'), formatStringFromNameCore('mosaic', 'main')].indexOf(aToFilter.name) > -1 };

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
							isContained = this.dContains(drawable, mx, my);
							// console.log('isContained:', isContained, 'drawable:', drawable)
							if (isContained) {
								// console.error('yes drawable contains:', drawable);
								break;
							}
						}
						if (isContained) {
							var cursor;
							switch (isContained) {
								case 1:

										if (drawable.name == formatStringFromNameCore('text', 'main') && gCState.typing && gCState.selection == drawable) {
											cursor = 'text'; // typing
										} else {
											cursor = 'move'; // draggable
										}

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
			if (e.button != 0) { return }

			var mouse = this.getMouse(e);
			var mx = mouse.x;
			var my = mouse.y;

			this.cstate.downx = mx;
			this.cstate.downy = my;

			this.cstate.downedInMon = tQS.iMon;
			if (e.target == this.refs.can) {

				var dropping = this.state.sGenColorPickerDropping;
				if (dropping) {
					var acceptDroppingObj = {};
					acceptDroppingObj.sGenColorPickerDropping = null;

					var addColorSetStateObj = {};
					if (this.cstate.selection) {
						switch (this.cstate.selection.name) {
							case formatStringFromNameCore('marker', 'main'):

									addColorSetStateObj = this.addColorToHistory('sPalMarkerColor', 'sPalMarkerColorHist', true);

								break;
							case formatStringFromNameCore('line', 'main'):
							case formatStringFromNameCore('pencil', 'main'):

									addColorSetStateObj = this.addColorToHistory('sPalLineColor', 'sPalBothColorHist', true);

								break;
							case formatStringFromNameCore('text', 'main'):

									addColorSetStateObj = this.addColorToHistory('sPalFillColor', 'sPalBothColorHist', true);

								break;
							case formatStringFromNameCore('rectangle', 'main'):
							case formatStringFromNameCore('oval', 'main'):

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
					case formatStringFromNameCore('select', 'main') + '-':

							selectFilterFunc = function(aToFilter) { return aToFilter.name == 'cutout' };

						break;
					case formatStringFromNameCore('shapes', 'main') + '-' + formatStringFromNameCore('rectangle', 'main'):
					case formatStringFromNameCore('shapes', 'main') + '-' + formatStringFromNameCore('oval', 'main'):

							selectFilterFunc = function(aToFilter) { return [formatStringFromNameCore('rectangle', 'main'), formatStringFromNameCore('oval', 'main')].indexOf(aToFilter.name) > -1 };

						break;
					case formatStringFromNameCore('line', 'main') + '-':

							selectFilterFunc = function(aToFilter) { return aToFilter.name == formatStringFromNameCore('line', 'main') };

						break;
					case formatStringFromNameCore('freedraw', 'main') + '-' + formatStringFromNameCore('pencil', 'main'):
					case formatStringFromNameCore('freedraw', 'main') + '-' + formatStringFromNameCore('marker', 'main'):

							selectFilterFunc = function(aToFilter) { return [formatStringFromNameCore('pencil', 'main'), formatStringFromNameCore('marker', 'main')].indexOf(aToFilter.name) > -1 };

						break;
					case formatStringFromNameCore('blur', 'main') + '-' + formatStringFromNameCore('gaussian', 'main'):
					case formatStringFromNameCore('blur', 'main') + '-' + formatStringFromNameCore('mosaic', 'main'):

							selectFilterFunc = function(aToFilter) { return [formatStringFromNameCore('gaussian', 'main'), formatStringFromNameCore('mosaic', 'main')].indexOf(aToFilter.name) > -1 };

						break;
					case formatStringFromNameCore('text', 'main') + '-':

							console.log('ok filtering Text');
							selectFilterFunc = function(aToFilter) { return [formatStringFromNameCore('text', 'main')].indexOf(aToFilter.name) > -1 };

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
						var isContained = this.dContains(drawables[i], mx, my);
						if (isContained) {
							console.log('ok you clicked in this drawable:', drawables[i]);
							var mySel = drawables[i];

							this.dBringToFront(mySel);

							if (isContained === 1) {
								// introduced for line dragging
								if (mySel.name == formatStringFromNameCore('line', 'main')) {
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
								if ([formatStringFromNameCore('pencil', 'main'), formatStringFromNameCore('marker', 'main')].indexOf(mySel.name) > -1) {
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

								// non-isomorphic stuff needed for if selecting another text element
								if (this.cstate.selection && this.cstate.selection.name == formatStringFromNameCore('text', 'main')) {
									if (this.cstate.selection == mySel) {
										if (this.cstate.typing) {
											// stop here, user is in typing mode, this should do highlighting :todo:
											return;
										} // else continue, as it is dragging
									} else {
										// else continue, as they have selected ANOTHER Text element, so let them select and drag that
										if (this.cstate.typing) {
											this.cstate.typing = false;
										}
									}
								}
								this.cstate.dragging = true;
								this.cstate.selection = mySel;
								gCanStore.setCanState(false); // this is needed, as if its a newly selected object, then if i dont set this, the selection border wont be drawn

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
						console.log('ok removing from selection this:', this.cstate.selection);
						this.clearSelection();
						if (this.cstate.typing) {
							this.cstate.typing = false; // this was below setCanState // testing if i put up here if its ok
							gCanStore.setCanState(false);
							return; // as i want to get them out of typing mode
						} else {
							gCanStore.setCanState(false);
						}
					}
				}

				// test if we should create a new Drawable and set it to resizing
				if (!this.cstate.selection) {
					switch (toolsub) {
						case formatStringFromNameCore('select', 'main') + '-':

								if (!e.altKey) {
									// remove all previous cutouts
									this.dDeleteAll(['cutout']);
								}

								this.cstate.selection = this.newDrawable(mx, my, 0, 0, 'cutout');

							break;
						case formatStringFromNameCore('shapes', 'main') + '-' + formatStringFromNameCore('rectangle', 'main'):
						case formatStringFromNameCore('shapes', 'main') + '-' + formatStringFromNameCore('oval', 'main'):
						case formatStringFromNameCore('blur', 'main') + '-' + formatStringFromNameCore('gaussian', 'main'):
						case formatStringFromNameCore('blur', 'main') + '-' + formatStringFromNameCore('mosaic', 'main'):

								this.cstate.selection = this.newDrawable(mx, my, 0, 0, this.state.sPalSeldSubs[this.state.sGenPalTool]);

							break;
						case formatStringFromNameCore('line', 'main') + '-':

								this.cstate.selection = this.newDrawable(mx, my, null, null, formatStringFromNameCore('line', 'main'));

							break;
						case formatStringFromNameCore('freedraw', 'main') + '-' + formatStringFromNameCore('pencil', 'main'):
						case formatStringFromNameCore('freedraw', 'main') + '-' + formatStringFromNameCore('marker', 'main'):

								this.cstate.selection = this.newDrawable(mx, my, null, null, this.state.sPalSeldSubs[this.state.sGenPalTool]);

							break;
						case formatStringFromNameCore('text', 'main') + '-':

								// if (this.cstate.typing) {
									// console.log('exiting typing, this was selection:', this.cstate.selection);
									// this.clearSelection();
									// this.cstate.typing = false;
									// this.cstate.valid = false;
								// } else {
									this.cstate.selection = this.newDrawable(mx, my, null, null, formatStringFromNameCore('text', 'main'));
								// }

							break;
						default:
							// do nothing
					}

					// if selection exists, then it was newly created, lets add it
					if (this.cstate.selection) {
						this.dAdd(this.cstate.selection);

						// add color to history as it was just added
						switch (this.cstate.selection.name) {
							case formatStringFromNameCore('marker', 'main'):

									this.addColorToHistory('sPalMarkerColor', 'sPalMarkerColorHist', false);

								break;
							case formatStringFromNameCore('line', 'main'):
							case formatStringFromNameCore('pencil', 'main'):

									this.addColorToHistory('sPalLineColor', 'sPalBothColorHist', false);

								break;
							case formatStringFromNameCore('text', 'main'):

									this.addColorToHistory('sPalFillColor', 'sPalBothColorHist', false);

								break;
							case formatStringFromNameCore('rectangle', 'main'):
							case formatStringFromNameCore('oval', 'main'):

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
							case formatStringFromNameCore('rectangle', 'main'):
							case formatStringFromNameCore('oval', 'main'):
							case formatStringFromNameCore('gaussian', 'main'):
							case formatStringFromNameCore('mosaic', 'main'):

									this.cstate.resizing = 9;
									gCanStore.setCanState(false); // to update on mouse down? for updating other windows?

								break;
							case formatStringFromNameCore('line', 'main'):

									this.cstate.lining = 11;
									gCanStore.setCanState(false); // as i have to draw the selection point

								break;
							case formatStringFromNameCore('pencil', 'main'):
							case formatStringFromNameCore('marker', 'main'):

									this.cstate.pathing = [];
									gCanStore.setCanState(false); // :todo: consider: as i have to draw the selection point

								break;
							case formatStringFromNameCore('text', 'main'):

									this.cstate.typing = true; // special, because i just added it, i enter typing mode link11911111
									gCanStore.setCanState(false);

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
				cColor = rgbToHex(true, cColor);
			}
			cColor = cColor.toUpperCase();
			var cHistory = this.state[aStateHistoryVar].map(function(aEntry) {
				if (aEntry[0] == '#') {
					return aEntry.toUpperCase();
				} else {
					return rgbToHex(true, aEntry).toUpperCase();
				}
			});
			var idxCoInHist = cHistory.indexOf(cColor);
			console.log('cColor:', cColor, 'cHistory:', cHistory, 'idxCoInHist:', idxCoInHist);
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
			if (e.target == this.refs.can) {
				var mouse = this.getMouse(e);
				var mx = mouse.x;
				var my = mouse.y;

				// if selectFilterFunc then lets test if should select or deselect
				var mySel = this.cstate.selection;
				if (mySel) {
					if (mySel.name == 'cutout') {
						return;
					}
					var isContained = this.dContains(mySel, mx, my); // dim is not selectable so this will not trigger for it. it will be false. but for cutout it will. and we want to ignore cutout
					if (isContained) {
						var propToStateDict = {
							lineWidth: 'sPalLineWidth',
							arrowLength: 'sPalArrowLength',
							arrowEnd: 'sPalArrowEnd',
							arrowStart: 'sPalArrowStart',
							fontsize: 'sPalFontSize',
							fontbold: 'sPalFontBold',
							fontitalic: 'sPalFontItalic',
							fontface: 'sPalFontFace',
							blurblock: 'sPalBlurBlock',
							blurradius: 'sPalBlurRadius',
							radius: 'sPalRectRadius',
							fillStyle: 'sPalFill', // partial as i do alpha too
							strokeStyle: mySel.name == formatStringFromNameCore('marker', 'main') ? 'sPalMarker' : 'sPalLine'  // partial as i do alpha too
						};
						var setStateObj = {};
						for (var p in propToStateDict) {
							if (p in mySel) {
								var stateVar = propToStateDict[p];
								switch (p) {
									case 'fillStyle':
									case 'strokeStyle':

											if (mySel.name == formatStringFromNameCore('line', 'main') && p == 'fillStyle') {
												continue; // skip this one, as for line fillStyle is matched strokeStyle
											}

											var stateVarColor = stateVar + 'Color';
											var stateVarAlpha = stateVar + 'Alpha';

											console.log('mySel[p]:', mySel[p], 'where p:', p);
											console.log('sending aAlpha as:', mySel[p]);
											var selRgba = colorStrToCssRgba(mySel[p], mySel[p], true);
											selRgba.a *= 100;
											console.log('sending 0 in as aAlpha');
											var stateColorRGB = colorStrToCssRgba(this.state[stateVarColor], 0, true);
											console.log('stateColorRGB:', stateColorRGB);
											var stateAlpha = this.state[stateVarAlpha];

											if (selRgba.r !== stateColorRGB.r || selRgba.g !== stateColorRGB.g || selRgba.b !== stateColorRGB.b) {
												setStateObj[stateVarColor] = 'rgb(' + selRgba.r + ', ' + selRgba.g + ', ' + selRgba.b + ')';
											}
											if (selRgba.a !== stateAlpha) {
												setStateObj[stateVarAlpha] = selRgba.a;
											}

										break;
									default:
										if (this.state[stateVar] !== mySel[p]) {
											setStateObj[stateVar] = mySel[p];
										}
								}
							}
						}
						// special case for blur, if they have Mosaic tool active, and then they go to Gaussian, then i have to change the subtool
						if (this.state.sGenPalTool == formatStringFromNameCore('blur', 'main')) {
							var shouldBeSubTool = mySel.name;
							if (this.state.sPalSeldSubs.Blur != shouldBeSubTool) {
								var sPalSeldSubs = cloneObject(this.state.sPalSeldSubs);
								sPalSeldSubs.Blur = shouldBeSubTool;
								setStateObj.sPalSeldSubs = sPalSeldSubs;
							}
						}
						if (objectHasKeys(setStateObj)) {
							this.setState(setStateObj);
						}
					}

					// put into typing mode
					if (mySel.name == formatStringFromNameCore('text', 'main')) {
						if (!this.cstate.typing) {
							this.cstate.typing = true;
							gCanStore.setCanState(false);
						}
					}
				}
			}
		},
		mouseup: function(e) {
			if (e.button != 0) { return }

			console.log('mouseup in imon:', tQS.iMon);
			this.cstate.downedInMon = -1;

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
						gCanStore.setCanState(false); // to update on mouse up?
					} else if (this.cstate.resizing) {
						this.cstate.resizing = 0;
						console.error('due to mouseup, resizing set to 0 to stop', tQS.iMon);
						if (!this.cstate.selection.w || !this.cstate.selection.h) {
							// 0 size
							this.dDelete(this.cstate.selection);
							this.clearSelection();
						} else {
							this.makeDimsPositive(this.cstate.selection); // no need to set valid=false
						}
						gCanStore.setCanState(false); // to update on mouse up?
					} else if (this.cstate.lining) {
						this.cstate.lining = false;
						if (this.cstate.selection.x == this.cstate.selection.x2 && this.cstate.selection.y == this.cstate.selection.y2) {
							// 0 size
							this.dDelete(this.cstate.selection);
							this.clearSelection();
							// need to set valid=false because otherwise the big handle thing is left over
							gCanStore.setCanState(false);
						}
						gCanStore.setCanState(false); // to update on mouse up?
					} else if (this.cstate.pathing) {
						this.cstate.pathing = null;
						if (this.cstate.selection.path.length == 2) {
							// only two points, meaning just where they moused down
							this.dDelete(this.cstate.selection);
							this.clearSelection();
							// :todo: consider: need to set valid=false because otherwise the big handle thing is left over
							gCanStore.setCanState(false);
						}
						gCanStore.setCanState(false); // to update on mouse up?
					} else if (this.cstate.typing) {
						// do nothing special
					}
				// }

				if (e.target == this.refs.can) {
					if (this.state.sGenPalTool == formatStringFromNameCore('window_wand', 'main')) {
						var x = mtmm.x(e.clientX);
						var y = mtmm.y(e.clientY);
						// alert('look for window at coords: ' + x + ', ' + y);

						// discontinued the first_nativeshot_canvas_found method because it seems on Windows, even though i execute fetchAllWin after last window is opened, sometimes it runs and completes before these windows become visible

						// var first_nativeshot_canvas_found = false;
						var l = gWinArr.length;
						// console.log('now going through l:', l, 'gWinArr:', gWinArr);
						for (var i=0; i<l; i++) {
							var cwin = gWinArr[i];
							// if (cwin.title == 'nativeshot_canvas') {
								// first_nativeshot_canvas_found = true;
								// continue;
							// }

							// if (!first_nativeshot_canvas_found) {
								// continue; // find nativeshot_canvas first then start paying attention to windows, as context menu is above, on osx also the cursor gets a window and its element 0
							// }

							if (x >= cwin.left && x <= cwin.right && y >= cwin.top && y <= cwin.bottom) {


								if (!e.shiftKey) {
									gCanStore.rconn.dDeleteAll(['cutout']);
								}
								var cCutout = gCanStore.rconn.newDrawable(cwin.left, cwin.top, cwin.width, cwin.height, 'cutout');
								gCanStore.rconn.dAdd(cCutout);
								// if (this.props.sGenPalTool == formatStringFromNameCore('select', 'main')) {
								// 	gCState.selection = cCutout;
								// 	gEditorStore.setState({
								// 		sGenPalW: tQS.w,
								// 		sGenPalH: tQS.h
								// 	});
								// }
								gCanStore.setCanState(false); // as i for sure added a new cutout


								break;
							}
							// else { console.log(x, ',', y, 'not in win:', cwin); }
						}

						// if (!cCutout) {
							// alert('didnt click window');
						// }
					}
				}
			}


		},
		keyup: function(e) {
			switch (e.key) {
				case 'Alt':

						if (this.state.sGenAltKey) {
							this.setState({
								sGenAltKey: false
							});
						}

					break;
				case 'Shift':

						if (this.state.sGenShiftKey) {
							this.setState({
								sGenShiftKey: false
							});
						}

					break;
			}
		},
		cancelDropping: function() {
			// returns true if canceled
			var dropping = this.state.sGenColorPickerDropping;
			if (dropping) {
				var cancelDroppingObj = {};
				cancelDroppingObj[dropping.pStateColorKey] = dropping.initColor;
				cancelDroppingObj.sGenColorPickerDropping = null;
				gEditorStore.setState(cancelDroppingObj);

				return true; // so we dont close the window
			}
		},
		keydown: function(e) {
			var newValid = true;

			var mySel = this.cstate.selection;

			// high priority "returning" keydown's
			switch (e.key) {
				case 'Alt':

						if (!e.repeat && !this.state.sGenAltKey) {
							this.setState({
								sGenAltKey: true
							});
						}

					break;
				case 'Shift':

						if (!e.repeat && !this.state.sGenShiftKey) {
							this.setState({
								sGenShiftKey: true
							});
						}

					break;
				case 'Escape':

						var canceledDropping = this.cancelDropping();
						if (canceledDropping) {
							return; // so we dont close the window
						}

						unload(false);
						return;

					break;
			}

			if (this.cstate.typing) {
				if (e.key.length == 1) {
					// support pasting
					if (e.key.toLowerCase() == 'v' && ((core.os.name == 'darwin' && e.metaKey) || (core.os.name != 'darwin' && e.ctrlKey))) {
							// request paste
							callInBootstrap('insertTextFromClipboard', {
								iMon: tQS.iMon
							});
					} else if (e.key.toLowerCase() == 'd' && ((core.os.name == 'darwin' && e.metaKey) || (core.os.name != 'darwin' && e.ctrlKey))) {
						// deselect
						if ((core.os.name == 'darwin' && e.metaKey) || (core.os.name != 'darwin' && e.ctrlKey)) {
							this.cstate.typing = false;
							newValid = false;
							this.clearSelection()
						}
					} else {
						// insert single char
						mySel.chars = mySel.chars.substr(0, mySel.index) + e.key + mySel.chars.substr(mySel.index);
						mySel.index++;
						newValid = false;
					}
				} else {
					switch (e.key) {
						case 'Backspace':

								if (mySel.index > 0) {
									mySel.index--;
									mySel.chars = spliceSlice(mySel.chars, mySel.index, 1);
									newValid = false;
								}

							break;
						case 'Delete':

								if (mySel.index < mySel.chars.length) {
									mySel.chars = spliceSlice(mySel.chars, mySel.index, 1);
									newValid = false;
								}

							break;
						case 'ArrowLeft':

								if (mySel.index > 0) {
									mySel.index--;
									newValid = false;
								}

							break;
						case 'ArrowRight':

								if (mySel.index < mySel.chars.length) {
									mySel.index++;
									newValid = false;
								}

							break;
						case 'Home':

								if (!e.repeat) {
									if (mySel.index > 0) {
										mySel.index = 0;
										newValid = false;
									}
								}

							break;
						case 'End':

								if (!e.repeat) {
									if (mySel.index < mySel.chars.length) {
										mySel.index = mySel.chars.length;
										newValid = false;
									}
								}

							break;
						default:
							// do nothing special
					}
				}
			// } else if (mySel && !this.cstate.dragging && !this.cstate.resizing && !this.cstate.lining && !this.cstate.pathing && !this.cstate.typing) {
			} else if (!this.cstate.dragging && !this.cstate.resizing && !this.cstate.lining && !this.cstate.pathing && !this.cstate.typing) {
				// hotkeys for move (and resize if applicable)
				if (mySel) {
					if (e.altKey) {
						// resize
						if ('w' in mySel) {
							var resizeBy = mtmm.w(1); // pixels to move by // :todo: detect if its a resize in h then use mtmm.h
							if (e.shiftKey) {
								resizeBy = mtmm.w(10); // :todo: detect if its a resize in h then use mtmm.h
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
							}
							if (newW !== mySel.w || newH !== mySel.h) {
								var widthOrHeightChanged = false; // because if not greater then 0 i dont accept it
								if (mySel.w !== newW && newW >= 0) {
									mySel.w = newW;
									widthOrHeightChanged = true;
								}
								if (mySel.h !== newH && newH >= 0) {
									mySel.h = newH;
									widthOrHeightChanged = true;
								}
								if (widthOrHeightChanged) {
									newValid = false;
									// parallel to link38378777577 - not exactly the same but it has similar lagginess
									gWidthRef.value = Math.abs(this.cstate.selection.w);
									gHeightRef.value = Math.abs(this.cstate.selection.h);
									// gEditorStore.setState({
									// 	sGenPalW: newW,
									// 	sGenPalH: newH
									// });
								}
							}
						}
					} else {
						// move
						var moveBy = mtmm.w(1); // cant use mtmm.x because otehrwise that will move it with offset // pixels to move by // :todo: detect if its a move in y then use mtmm.y
						if (e.shiftKey) {
							moveBy = mtmm.w(10); // :todo: detect if its a move in y then use mtmm.h
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
							case 'Delete':

									if (!e.repeat) {
										if (!this.dDelete(mySel)) {
											this.clearSelection();
											newValid = false;
										}
									}

								break;
							case 'D':
							case 'd':

									if (!e.repeat) {
										if ((core.os.name == 'darwin' && e.metaKey) || (core.os.name != 'darwin' && e.ctrlKey)) {
											if (!this.clearSelection()) {
												newValid = false;
											}
										}
									}

								break;
						}

						if (moveDirX || moveDirY) {
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

							newValid = false;
						}
					}

					// other hotkeys during selection
					switch (e.key) {
						case 'C':
						case 'c':
						case 'ç': // mac with caps lock off
						case 'Ç': // mac with caps lock on

								// ac - alt+c
								// console.log('c hit', 'repeat:', e.repeat, 'meta:', e.metaKey, 'ctrl:', e.ctrlKey, 'shift:', e.shiftKey, 'alt:', e.altKey);
								if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.altKey) {
									// copy drawable
									this.cstate.copied_drawable = JSON.stringify(mySel);
									this.setCanState(true, false, true);
								}

							break;
						// default:
							// console.log('key during sel hit:', e.key, 'keyCode:', e.keyCode, 'repeat:', e.repeat, 'meta:', e.metaKey, 'ctrl:', e.ctrlKey, 'shift:', e.shiftKey, 'alt:', e.altKey);
					}
				}

				// other hotkeys
				switch (e.key) {
					case 'V':
					case 'v':
					case '√': // mac with caps lock on or off

							// av - alt+v
							if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.altKey) {
								initPasteDrawable();
							}

						break;
				}

				// hotkeys tied to buttons in palette
				// console.log('e:', e);
				if (!e.repeat) {
					// test hotkeys
					var key = e.key;
					if (key) {
						key = key.toLowerCase();
						console.log('testing key:', key);
						var testKey = function(aHotkey, aEntry) {
							var triggerEntry = function() {
								var evt = document.createEvent('MouseEvents');
								evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, e.altKey, e.shiftKey, false, 0, null); // a.altKey needed for reduce/englarge
								gHotkeyRef[aHotkey].dispatchEvent(evt);
							};

							// shift modifier is ignored, as i use that for multi action
							if (aHotkey.length == 2) {
								// first letter is a modifier
								if (key == aHotkey[1]) {
									if (aHotkey[0] == 'a') {
										// requires alt key
										if (e.altKey && !e.metaHotkey && !e.ctrlKey) {
											triggerEntry();
										}
									} else if (aHotkey[0] == 'c') {
										// requires ctrl key on non-mac, and meta key on mac
										if (core.os.name == 'darwin') {
											if (e.metaHotkey && !e.ctrlKey && !e.altKey) {
												triggerEntry();
											}
										} else {
											if (e.ctrlKey && !e.metaHotkey && !e.altKey) {
												triggerEntry();
											}
										}
									}
								}
							} else if (aHotkey.length === 1) {
								if (aHotkey == key) {
									// requires no modifiers
									if (!e.metaHotkey && !e.altKey && !e.ctrlKey) {
										triggerEntry();
									}
								}
							}
						}

						var layout = [
							...this.props.pPalLayout,
							{ hotkey: 'c+' },
							{ hotkey: 'a+' },
							{ hotkey: 'c=' },
							{ hotkey: 'a=' },
							{ hotkey: 'c-' },
							{ hotkey: 'a-' },
							{ hotkey: 'a–' }, // mac alt- caps off or on
							{ hotkey: 'a≠' }, // mac alt+ caps off or on
						];

						var l = layout.length;

						// if aa in hotkey, then add the mac alt a stuff
						for (var i=0; i<l; i++) {
							var entry = layout[i];
							if (entry.hotkey && entry.hotkey == 'aa') {
								layout.push({ hotkey: 'aå' });
								layout.push({ hotkey: 'aÅ' });
								gHotkeyRef['aå'] = gHotkeyRef['aa'];
								gHotkeyRef['aÅ'] = gHotkeyRef['aa'];
								l = layout.length;
								break;
							}
						}

						for (var i=0; i<l; i++) {
							var entry = layout[i];
							if (entry.hotkey) {
								testKey(entry.hotkey, entry);
							}
							var sub = entry.sub;
							if (sub) {
								var l2 = sub.length;
								for (var j=0; j<l2; j++) {
									var subentry = sub[j];
									if (subentry.hotkey) {
										console.log('subentry with hotkey:', subentry);
										testKey(subentry.hotkey, subentry);
									}
								}
							}
						}
					}
				}
			}

			gCanStore.setCanState(newValid);
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
					left: mmtm.x(this.state.sPalX) + 'px',
					top: mmtm.y(this.state.sPalY) + 'px'
				},
				ref: 'pal'
			};

			// determine cursor
			if (this.state.sGenInputNumberMousing) {
				cCanProps.style.cursor = this.state.sGenInputNumberMousing;
				cPalPalProps.style.cursor = this.state.sGenInputNumberMousing;
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
						case formatStringFromNameCore('select', 'main'):
						case formatStringFromNameCore('shapes', 'main'):
						case formatStringFromNameCore('line', 'main'):
						case formatStringFromNameCore('freedraw', 'main'):
						case formatStringFromNameCore('blur', 'main'):

								cCanProps.style.cursor = 'crosshair';

							break;
						case formatStringFromNameCore('window_wand', 'main'):

								cCanProps.style.cursor = 'pointer';

							break;
						default:
							// nothing
					}
				}
			}

			var zoomViewREl;
			if (this.state.sPalMultiDepresses[formatStringFromNameCore('zoom_view', 'main')]) {
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

	var gZoomViewW = mtmm.w(200); // in mon, so without scaling. so thats why i use mtmm.w // i cant use mtmm.x as that will put the screenX and screenY offset of 0, 0 equivalent
	var gZoomViewH = mtmm.h(200);

	var ZoomView = React.createClass({
		displayName: 'ZoomView',
		componentDidMount: function() {

			this.zstate = {}
			gZState = this.zstate;

			this.zstate.rconn = this;

			this.ctx = ReactDOM.findDOMNode(this).getContext('2d');
			this.zstate.visible = false;
			this.zstate.valid = false;
			this.zstate.mouse = {x:0, y:0};
			this.ctx.mozImageSmoothingEnabled = false;
			this.ctx.imageSmoothingEnabled = false;

			this.zstate.setInvalid = function(isBroadcast) {
				if (!isBroadcast) {
					callInBootstrap('broadcastToOthers', {
						topic: 'zcanInvalidate',
						mouse: this.zstate.mouse,
						iMon: tQS.iMon
					});
				}
				this.zstate.valid = false;
			}.bind(this);

			this.offsets = {
				// x: this.refs.view.offsetLeft,
				// y: this.refs.view.offsetTop,
				invalidxy: true,
				// w: this.refs.view.offsetWidth, // gZoomViewW + 10, // + 10 for the 5px border on each side
				// h: this.refs.view.offsetHeight, // gZoomViewH + 10,
				desc: 'botlef' // toplef, toprit, botrit
			};
			console.log('viewOffsets:', this.offsets);
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
			if (gCState && gCanStore.rconn.ctx && !this.zstate.valid) {
				var ctx = this.ctx;
				var width = gZoomViewW; // of zoomview canvas
				var height = gZoomViewH;  // of zoomview canvas

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

				ctx.drawImage(gCanStore.rconn.refs.can0, mmtm.x(sx), mmtm.y(sy), mmtm.w(sWidth), mmtm.h(sHeight), 0, 0, dWidth, dHeight);
				ctx.drawImage(gCanStore.rconn.refs.can, mmtm.x(sx), mmtm.y(sy), mmtm.w(sWidth), mmtm.h(sHeight), 0, 0, dWidth, dHeight);

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
				ctx.font = '24px Arial';
				ctx.textAlign = 'left';
				ctx.fillStyle = '#000';
				ctx.fillText((this.zstate.mouse.x - tQS.x) + ', ' + (this.zstate.mouse.y - tQS.y), 5, height - 5);

				var zoomPercent = Math.round(zoomLevel * 100) + '%';
				ctx.textAlign = 'right';
				ctx.fillText(zoomPercent, width - 5, height - 5);

				// mark valid
				this.zstate.valid = true;

				// dom visibility
				var shouldBeVisible = false;
				// console.log('offsets:', this.offsets, 'mouse:', this.zstate.mouse);
				if ((tQS.x <= this.zstate.mouse.x) && (tQS.x + tQS.w >= this.zstate.mouse.x) &&
					(tQS.y <= this.zstate.mouse.y) && (tQS.y + tQS.h >= this.zstate.mouse.y)) {
						shouldBeVisible = true;
				}
				// console.log('shouldBeVisible', tQS.iMon, shouldBeVisible, 'this.zstate.visible:', this.zstate.visible);
				if (this.zstate.visible != shouldBeVisible) {
					this.zstate.visible = shouldBeVisible;
					this.refs.view.style.display = shouldBeVisible ? '' : 'none';
				}

				if (shouldBeVisible) {
					// dom positioning of the view

					if (this.offsets.invalidxy) {
						delete this.offsets.invalidxy;
						this.offsets.x = this.refs.view.offsetLeft;
						this.offsets.y = this.refs.view.offsetTop;

						if (!this.offsets.w) {
							this.offsets.w = this.refs.view.offsetWidth;
							this.offsets.h = this.refs.view.offsetHeight;
						}
					}

					var cX = mmtm.x(this.zstate.mouse.x);
					var cY = mmtm.y(this.zstate.mouse.y);
					var pad = 50;
					var padX = mtmm.w(pad);
					var padY = mtmm.h(pad);

					var viewMinX = this.offsets.x - padX;
					var viewMaxX = this.offsets.x + this.offsets.w + padX;
					var viewMinY = this.offsets.y - padY;
					var viewMaxY = this.offsets.y + this.offsets.h + padY;

					console.log('view is in x of:', viewMinX, '-', viewMaxX, 'and y of:', viewMinY, '-', viewMaxY, 'AND MON MOUSE IS IN:', cX, cY);

					if ((this.offsets.x - padX <= cX) && (this.offsets.x + this.offsets.w + padX >= cX) &&
						(this.offsets.y - padY <= cY) && (this.offsets.y + this.offsets.h + padY >= cY)) {
							if (this.offsets.desc == 'botlef') {
								this.offsets.desc = 'botrit';
								this.refs.view.style.right = '5%';
								this.refs.view.style.left = '';
							} else {
								this.offsets.desc = 'botlef';
								this.refs.view.style.left = '5%';
								this.refs.view.style.right = '';
							}
							this.offsets.invalidxy = false;
							this.offsets.x = this.refs.view.offsetLeft;
							this.offsets.y = this.refs.view.offsetTop;
							// console.log('this.offsets:', this.offsets);
					}
				}
			}
		},
		// mousedown: function(e) {
		// 	gEditorStore.setState({
		// 		sGenPalZoomViewDragStart: {clientX:e.clientX, clientY:e.clientY, initX:this.props.sPalZoomViewCoords.x, initY:this.props.sPalZoomViewCoords.y}
		// 	});
		// },
		render: function() {
			// props - cPalProps - its all of them
			// return React.createElement('canvas', {className:'pzoomview', width:gZoomViewW, height:gZoomViewH, style:{left:this.props.sPalZoomViewCoords.x+'px', top:this.props.sPalZoomViewCoords.y+'px' }, onMouseDown:this.mousedown});
			return React.createElement('canvas', {ref:'view', className:'pzoomview', width:gZoomViewW, height:gZoomViewH, style:{display:'none', bottom:'5%', left: '5%'} });
		}
	});

	////////// start - palette components
	var Accessibility = React.createClass({
		// the zoom controls that affect the toolbar
		displayName: 'Accessibility',
		enlarge: function(e) {
			if (e.altKey) {
				// sCanHandleSize
				var max = 34;
				var del = 2;
				var cHandleSize = this.props.sCanHandleSize;

				var nHandleSize = cHandleSize;
				if (cHandleSize + del <= max) {
					if (nHandleSize < 0) {
						// i decided only one step below 0, and thats when no border is drawn so it is at min, so abs it
						nHandleSize = Math.abs(nHandleSize);
					} else {
						nHandleSize = cHandleSize + del;
					}
					gEditorStore.setState({
						sCanHandleSize: nHandleSize
					});
				}
			} else {
				// sPalSize
				var max = 58;
				var del = 2;
				var cPaletteSize = this.props.sPalSize;
				var nPaletteSize = cPaletteSize;
				if (cPaletteSize + del <= max) {
					nPaletteSize = cPaletteSize + del;
					gEditorStore.setState({
						sPalSize: nPaletteSize,
					});
				}
			}
		},
		reduce: function(e) {
			if (e.altKey) {
				// sCanHandleSize
				var min = 6;
				var del = 2;
				var cHandleSize = this.props.sCanHandleSize;

				var nHandleSize = cHandleSize;

				if (nHandleSize == min) {
					// i decided only one step below 0 and thats when nothing drawn
					nHandleSize = min * -1;
					gEditorStore.setState({
						sCanHandleSize: nHandleSize
					});
				} else if (cHandleSize - del >= min) {
					nHandleSize = cHandleSize - del;
					gEditorStore.setState({
						sCanHandleSize: nHandleSize
					});
				}
			} else {
				// sPalSize
				var min = 12;
				var del = 2;
				var cPaletteSize = this.props.sPalSize;
				var nPaletteSize = cPaletteSize;
				if (cPaletteSize - del >= min) {
					nPaletteSize = cPaletteSize - del;
					gEditorStore.setState({
						sPalSize: nPaletteSize,
					});
				}
			}
		},
		componentDidMount: function() {
			gHotkeyRef['c+'] = this.refs.enlarge;
			gHotkeyRef['a+'] = this.refs.enlarge;
			gHotkeyRef['c='] = this.refs.enlarge;
			gHotkeyRef['a='] = this.refs.enlarge;
			gHotkeyRef['c-'] = this.refs.reduce;
			gHotkeyRef['a-'] = this.refs.reduce;
		},
		render: function() {
			// props
			// 		sPalSize
			//		sCanHandleSize
			//		sGenAltKey
			var { sGenAltKey } = this.props;

			return React.createElement('div', {className:'paccessibility'},
				React.createElement('div', {className: 'pbutton', onClick:this.enlarge, ref:'enlarge'},
					React.createElement('div', {className:'plabel'},
						React.createElement('span', {},
							!sGenAltKey ? formatStringFromNameCore('enlarge_palette', 'main') : formatStringFromNameCore('enlarge_handles', 'main')
						)
					),
					'\ue818'
				),
				React.createElement('div', {className: 'pbutton', onClick:this.reduce, ref:'reduce'},
					React.createElement('div', {className:'plabel plabelbot'},
						React.createElement('span', {},
							!sGenAltKey ? formatStringFromNameCore('shrink_palette', 'main') : formatStringFromNameCore('shrink_handles', 'main')
						)
					),
					'\ue817'
				)
			);
		}
	});

	var Handle = React.createClass({
		// user can drag around the palette with this
		displayName: 'Handle',
		mousedown: function(e) {
			if (e.button != 0) { return }

			gEditorStore.setState({
				sGenPalDragStart: {clientX:e.clientX, clientY:e.clientY, sPalX:this.props.sPalX, sPalY:this.props.sPalY, monDim:{win81ScaleX:tQS.win81ScaleX, win81ScaleY:tQS.win81ScaleY} }
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

	var gChangingSubToolTo;
	var Button = React.createClass({
		displayName: 'Button',
		click: function(e) {

			var affectsStateVars = {};
			var affectsSelNames = [];

			switch (this.props.pButton.label) {
				// start - actions
				case formatStringFromNameCore('just_save', 'main'):
				case formatStringFromNameCore('just_copy', 'main'):
				case formatStringFromNameCore('just_print', 'main'):
				case formatStringFromNameCore('upload', 'main'):
				case formatStringFromNameCore('just_share', 'main'):
				case formatStringFromNameCore('just_search', 'main'):
				case formatStringFromNameCore('text_recognition', 'main'):

					var cSubTool = gChangingSubToolTo || this.props.sPalSeldSubs[this.props.pButton.label];
					initCompositeForAction(this.props.pButton.label, cSubTool, !e.shiftKey);

					break;
				// end - actions
				// start - on click reapply styles
				case formatStringFromNameCore('blur', 'main'):

						var cSubTool = this.props.sPalSeldSubs[this.props.pButton.label];
						if (cSubTool == formatStringFromNameCore('gaussian', 'main')) {
							affectsSelNames.push(formatStringFromNameCore('gaussian', 'main'));
							affectsStateVars.blurradius = 'sPalBlurRadius';
						} else {
							affectsSelNames.push(formatStringFromNameCore('mosaic', 'main'));
							affectsStateVars.blurblock = 'sPalBlurBlock';
						}

					break;
				case formatStringFromNameCore('line', 'main'):

						affectsSelNames.push(formatStringFromNameCore('line', 'main'));
						affectsStateVars.strokeStyle = ['sPalLineColor', 'sPalLineAlpha'];
						affectsStateVars.lineWidth = 'sPalLineWidth';
						affectsStateVars.arrowStart = 'sPalArrowStart';
						affectsStateVars.arrowEnd = 'sPalArrowEnd';
						affectsStateVars.arrowLength = 'sPalArrowLength';

					break;
				case formatStringFromNameCore('freedraw', 'main'):

						affectsStateVars.lineWidth = 'sPalLineWidth';
						var cSubTool = this.props.sPalSeldSubs[this.props.pButton.label];
						if (cSubTool == formatStringFromNameCore('pencil', 'main')) {
							affectsSelNames.push(formatStringFromNameCore('pencil', 'main'));
							affectsStateVars.strokeStyle = ['sPalLineColor', 'sPalLineAlpha'];
						} else {
							affectsSelNames.push(formatStringFromNameCore('marker', 'main'));
							affectsStateVars.strokeStyle = ['sPalMarkerColor', 'sPalMarkerAlpha'];
						}

					break;
				case formatStringFromNameCore('shapes', 'main'):

						affectsSelNames.push(formatStringFromNameCore('rectangle', 'main'));
						affectsSelNames.push(formatStringFromNameCore('oval', 'main'));
						affectsStateVars.strokeStyle = ['sPalLineColor', 'sPalLineAlpha'];
						affectsStateVars.lineWidth = 'sPalLineWidth';
						affectsStateVars.fillStyle = ['sPalFillColor', 'sPalFillAlpha'];

						var cSubTool = this.props.sPalSeldSubs[this.props.pButton.label];
						if (cSubTool == formatStringFromNameCore('rectangle', 'main')) {
							affectsStateVars.radius = 'sPalRectRadius';
						}
					break;
				case formatStringFromNameCore('text', 'main'):

						affectsSelNames.push(formatStringFromNameCore('text', 'main'));
						affectsStateVars.fillStyle = ['sPalFillColor', 'sPalFillAlpha'];
						affectsStateVars.fontface = 'sPalFontFace';
						affectsStateVars.fontbold = 'sPalFontBold';
						affectsStateVars.fontitalic = 'sPalFontItalic';
						affectsStateVars.fontsize = 'sPalFontSize';

					break;
				case formatStringFromNameCore('marker_color', 'main'):

						affectsSelNames.push(formatStringFromNameCore('marker', 'main'));
						affectsStateVars.strokeStyle = ['sPalMarkerColor', 'sPalMarkerAlpha'];

					break;
				case formatStringFromNameCore('color', 'main'):

						affectsSelNames.push(formatStringFromNameCore('rectangle', 'main'));
						affectsSelNames.push(formatStringFromNameCore('oval', 'main'));
						affectsSelNames.push(formatStringFromNameCore('pencil', 'main'));
						affectsSelNames.push(formatStringFromNameCore('line', 'main'));
						affectsStateVars.strokeStyle = ['sPalLineColor', 'sPalLineAlpha'];

					break;
				case formatStringFromNameCore('fill_color', 'main'):

						affectsSelNames.push(formatStringFromNameCore('rectangle', 'main'));
						affectsSelNames.push(formatStringFromNameCore('oval', 'main'));
						affectsSelNames.push(formatStringFromNameCore('text', 'main'));
						affectsStateVars.fillStyle = ['sPalFillColor', 'sPalFillAlpha'];

					break;
				// end - on click reapply styles
				case formatStringFromNameCore('close', 'main'):

						unload(false);

					break;
				case formatStringFromNameCore('select', 'main'):

						// if (gCState.cutouts.length) {
						// 	if (!gCState.selection || gCState.selection != gCState.cutouts[0]) {
						// 		// gCState.cutouts[0].select(); // :note::important: i should never call .select on a shape/cutout/etc only the CanvasState.prototype.draw calls .select
						// 		gCState.selection = gCState.cutouts[0];
						// 		gCState.valid = false;
						// 	}
						// }

					break;
				case formatStringFromNameCore('clear_selection', 'main'):

						gCanStore.setCanState(gCanStore.rconn.dDeleteAll(['cutout']));

					break;
				case formatStringFromNameCore('fullscreen', 'main'):

						if (!e.shiftKey) {
							gCanStore.rconn.dDeleteAll(['cutout']);
						}
						var cCutout = gCanStore.rconn.newDrawable(tQS.x, tQS.y, tQS.w, tQS.h, 'cutout');
						gCanStore.rconn.dAdd(cCutout);
						if (this.props.sGenPalTool == formatStringFromNameCore('select', 'main')) {
							gCState.selection = cCutout;
							gEditorStore.setState({
								sGenPalW: tQS.w,
								sGenPalH: tQS.h
							});
						}
						gCanStore.setCanState(false); // as i for sure added a new cutout

					break;
				default:
					// do nothing
			}

			// if selection, do affectsStateVars stuff
			if (!gChangingSubToolTo && affectsSelNames.length) {
				var canValid = true;

				if (gCState && gCState.selection && affectsSelNames.indexOf(gCState.selection.name) > -1) {
					var mySel = gCState.selection;

					var isText;
					if (mySel.name == formatStringFromNameCore('text', 'main')) {
						isText = true;
					}

					// start copy of block1929293055
					for (var p in mySel) {
						// console.log('on sel prop:', p);
						if (p in affectsStateVars) {
							// console.warn('in sel - testing diff');
							if (p == 'strokeStyle' || p == 'fillStyle') {
									var cColorVarName = affectsStateVars[p][0];
									var cAlphaVarName = affectsStateVars[p][1];

									// console.log('mismatch on', cVarName, 'old:', prevState[cVarName], 'new:', gCanStore.rconn.state[cVarName]);
									var newColor = colorStrToCssRgba(gCanStore.rconn.state[cColorVarName], gCanStore.rconn.state[cAlphaVarName]);
									if (mySel[p] !== newColor) {
										canValid = false;
										mySel[p] = newColor;
										if (p == 'strokeStyle' && mySel.name == formatStringFromNameCore('line', 'main')) {
											mySel.fillStyle = newColor; // needed for arrow
										}
									}
							} else {
								var cVarName = affectsStateVars[p];
								if (mySel[p] !== gCanStore.rconn.state[cVarName]) {
									// console.log('sending update on it');
									canValid = false;
									mySel[p] = gCanStore.rconn.state[cVarName];
									if (isText && p.indexOf('font') === 0) {
										mySel.font = gCanStore.rconn.calcCtxFont(mySel);
									}
								}
							}
						}
					}
					// end copy of block1929293055

					gCanStore.setCanState(canValid);
				}
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
				// if (gCState.selection) {
				// 	gCanStore.rconn.clearSelection();
				// 	gCanStore.setCanState(false);
				// }
			}

			if (gChangingSubToolTo) { // make sure to not return above
				gChangingSubToolTo = null;
			}
		},
		setLabelText: function(aNewTxt, aKey) {
			// if aNewTxt is undefined, then it resets it
			if (aNewTxt) {
				this.settingKey = aKey;
				this.refs.plabel.textContent = aNewTxt;
			} else {
				if (aKey == this.settingKey) {
					var origLabel = this.props.pButton.label;
					if (this.isActionButton && !this.props.sGenShiftKey) {
						origLabel += formatStringFromNameCore('and_close', 'main');
					}
					this.refs.plabel.textContent = origLabel;
				}
			}
		},
		componentDidMount: function() {

			// if its an action button, then append to label " & Close" - i can do this in did mount, because when mount for sure alt is not pressed, well pretty sure so yea no big
			if ([formatStringFromNameCore('just_save', 'main'), formatStringFromNameCore('just_print', 'main'), formatStringFromNameCore('just_copy', 'main'), formatStringFromNameCore('upload', 'main'), formatStringFromNameCore('just_share', 'main'), formatStringFromNameCore('just_search', 'main'), formatStringFromNameCore('text_recognition', 'main')].indexOf(this.props.pButton.label) > -1) {
				this.isActionButton = true;
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
			//		sGenShiftKey - should only if its an action type button. but right now i send it to all, no plans to make it not send to all.

			var cProps = {
				className:'pbutton',
				onClick: this.click
			};

			if (this.props.pButton.hotkey) {
				cProps.ref = function(domEl) {
					gHotkeyRef[this.props.pButton.hotkey] = domEl;
				}.bind(this);
			}

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
			if ([formatStringFromNameCore('color', 'main'), formatStringFromNameCore('fill_color', 'main'), formatStringFromNameCore('marker_color', 'main')].indexOf(this.props.pButton.label) > -1) {
				var rgbaStr;
				var dropping = this.props.sGenColorPickerDropping;
				if (this.props.pButton.label == formatStringFromNameCore('color', 'main')) {
					rgbaStr = colorStrToCssRgba(this.props.sPalLineColor, this.props.sPalLineAlpha);
					if (dropping && dropping.pStateColorKey == 'sPalLineColor') {
						cProps.className += ' eyedropper';
					}
				} else if (this.props.pButton.label == formatStringFromNameCore('fill_color', 'main')) {
					rgbaStr = colorStrToCssRgba(this.props.sPalFillColor, this.props.sPalFillAlpha);
					if (dropping && dropping.pStateColorKey == 'sPalFillColor') {
						cProps.className += ' eyedropper';
					}
				} else {
					// formatStringFromNameCore('marker_color', 'main')					rgbaStr = colorStrToCssRgba(this.props.sPalMarkerColor, this.props.sPalMarkerAlpha);
					if (dropping && dropping.pStateColorKey == 'sPalMarkerColor') {
						cProps.className += ' eyedropper';
					}
				}
				var bgImgStr = 'linear-gradient(to right, ' + rgbaStr + ', ' + rgbaStr + '), url("chrome://nativeshot/content/resources/images/trans5x5.png")';
				cButtonIcon = React.createElement('div', {style:{backgroundImage:bgImgStr}, className:'pbutton-icon-color'});
			} else {
				cButtonIcon = this.props.pButton.icon;
			}

			// determine submenu
			var cSubmenu;
			if (this.props.pButton.sub) {
				cSubmenu = React.createElement(Submenu, overwriteObjWithObj({pSub:this.props.pButton.sub, setLabelText:this.setLabelText}, this.props)/*{sPalSeldSubs:this.props.sPalSeldSubs, pButton:this.props.pButton, pSub:this.props.pButton.sub, sPalLineAlpha:this.props.sPalLineAlpha, sPalLineColor:this.props.sPalLineColor, sPalFillAlpha:this.props.sPalFillAlpha, sPalFillColor:this.props.sPalFillColor, sPalMarkerAlpha:this.props.sPalMarkerAlpha, sPalMarkerColor:this.props.sPalMarkerColor}*/,
					this.props.pButton.label
				);
			}

			var origLabel = this.props.pButton.label;
			if (this.isActionButton && !this.props.sGenShiftKey) {
				origLabel += formatStringFromNameCore('and_close', 'main');
			}

			return React.createElement('div', cProps,
				React.createElement('div', {className:'plabel'},
					React.createElement('span', {ref:'plabel'},
						origLabel
					)
				),
				cSubmenu,
				cButtonIcon
			);
		}
	});

	var SubButton = React.createClass({
		hoverout: function() {
			console.log('hover outted');
			this.props.setLabelText(null, this.props.pSubButton.label);
		},
		hoverover: function() {
			console.log('hover overed');
			this.props.setLabelText(this.props.pSubButton.label, this.props.pSubButton.label);
		},
		hoverlistener: function(e) {
			console.log('hoverlistener, name:', e.propertyName);
			if (e.propertyName == 'min-width') {
				// mouse outted
				this.hoverout();
			} else if (e.propertyName == 'min-height') {
				// mouse overed
				this.hoverover();
			}
		},
		click: function(e) {
			var dontStopPropagation = false;

			if (this.props.pButton.label == formatStringFromNameCore('fullscreen', 'main')) {
				// alert(this.props.pSubButton.label);
				if (!e.shiftKey) {
					gCanStore.rconn.dDeleteAll(['cutout']);
				}
				var cCutout;
				var cSubLabel = this.props.pSubButton.label;
				var allMonDim = tQS.allMonDim;
				if (this.props.pSubButton.label == formatStringFromNameCore('all_monitors', 'main')) {
					var allmonRect = new Rect(0, 0, 0, 0);
					var imonRects = [];
					var l = allMonDim.length;
					for (var i=0; i<l; i++) {
						var cMon = allMonDim[i];
						allmonRect = allmonRect.union(new Rect(cMon.x, cMon.y, cMon.w, cMon.h));
					}
					console.log('allmonRect:', allmonRect);
					cCutout = gCanStore.rconn.newDrawable(allmonRect.x, allmonRect.y, allmonRect.width, allmonRect.height, 'cutout');
				} else {
					var iMon = this.props.pSubButton.icontext - 1;
					cCutout = gCanStore.rconn.newDrawable(allMonDim[iMon].x, allMonDim[iMon].y, allMonDim[iMon].w, allMonDim[iMon].h, 'cutout');
				}
				gCanStore.rconn.dAdd(cCutout);
				if (this.props.sGenPalTool == formatStringFromNameCore('select', 'main')) {
					gCState.selection = cCutout;
					gEditorStore.setState({
						sGenPalW: cCutout.w,
						sGenPalH: cCutout.h
					});
				}
				gCanStore.setCanState(false); // as i for sure added a new cutout
			}

			if ([formatStringFromNameCore('just_save', 'main'), formatStringFromNameCore('upload', 'main'), formatStringFromNameCore('just_share', 'main'), formatStringFromNameCore('just_search', 'main'), formatStringFromNameCore('text_recognition', 'main')].indexOf(this.props.pButton.label) > -1) {
				dontStopPropagation = true;
				gChangingSubToolTo = this.props.pSubButton.label;
			} else if (this.props.pButton.label == formatStringFromNameCore('blur', 'main')) {
				// if (formatStringFromNameCore('blur', 'main') == this.props.sGenPalTool) {
					dontStopPropagation = true;
					gChangingSubToolTo = this.props.pSubButton.label;
				// }
			} else if (this.props.pButton.label == formatStringFromNameCore('shapes', 'main')) {
				dontStopPropagation = true;
				gChangingSubToolTo = this.props.pSubButton.label;
			}

			if (this.props.pSubButton.label == formatStringFromNameCore('last_selection', 'main')) {
				var cutouts = gCState.drawables.filter(function(aToFilter) { return aToFilter.name == 'cutout' });
				callInBootstrap('selectPreviousSelection', {
					cutoutsArr: cutouts.length ? cutouts : null,
					iMon: tQS.iMon
				});
			}

			if (!this.props.pSubButton.unfixable) {
				var sPalSeldSubs = cloneObject(this.props.sPalSeldSubs);
				sPalSeldSubs[this.props.pButton.label] = this.props.pSubButton.label;

				var setStateObj = {
					sPalSeldSubs: sPalSeldSubs
				};

				if (!this.props.pButton.justClick) {
					setStateObj.sGenPalTool = this.props.pButton.label;
				}

				gEditorStore.setState(setStateObj);
			}

			if (!dontStopPropagation) {
				e.stopPropagation();
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
			//		setLabelText

			var cProps = {
				className:'pbutton hoverlistener',
				onClick: this.click,
				onTransitionEnd: this.hoverlistener
			};

			if (this.props.pSubButton.icontext) {
				// cProps['data-icontext'] = this.props.pSubButton.icontext;
			}

			if (this.props.pSubButton.hotkey) {
				cProps.ref = function(domEl) {
					gHotkeyRef[this.props.pSubButton.hotkey] = domEl;
				}.bind(this);
			}

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
			//		sGenPalTool
			//		sPalSeldSubs
			return React.createElement('div', {className:'plinetools'},
				React.createElement(InputNumber, {pLabel:formatStringFromNameCore('line_width_px', 'main'), pStateVarName:'sPalLineWidth', sPalLineWidth:this.props.sPalLineWidth, pMin:0, pCStateSel:{[formatStringFromNameCore('rectangle', 'main')]:'lineWidth', [formatStringFromNameCore('oval', 'main')]:'lineWidth', [formatStringFromNameCore('line', 'main')]:'lineWidth', [formatStringFromNameCore('pencil', 'main')]:'lineWidth', [formatStringFromNameCore('marker', 'main')]:'lineWidth'}}),
				this.props.sGenPalTool == formatStringFromNameCore('shapes', 'main') && this.props.sPalSeldSubs.Shapes == formatStringFromNameCore('rectangle', 'main') ? React.createElement(InputNumber, {pLabel:formatStringFromNameCore('line_radius_px', 'main'), pStateVarName:'sPalRectRadius', sPalRectRadius:this.props.sPalRectRadius, pMin:0 }) : undefined
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
				pCStateSel: {[formatStringFromNameCore('gaussian', 'main')]:'blurradius', [formatStringFromNameCore('mosaic', 'main')]:'blurblock'},
				key: subtool
			};

			if (subtool == formatStringFromNameCore('mosaic', 'main')) {
				// Mosaic
				cInputNumberProps.sPalBlurBlock = this.props.sPalBlurBlock;
				cInputNumberProps.pStateVarName = 'sPalBlurBlock';
				cInputNumberProps.pLabel = formatStringFromNameCore('block_size_px', 'main');
			} else {
				// Gaussian
				cInputNumberProps.sPalBlurRadius = this.props.sPalBlurRadius;
				cInputNumberProps.pStateVarName = 'sPalBlurRadius';
				cInputNumberProps.pLabel = formatStringFromNameCore('radius_px', 'main');
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
				React.createElement(InputNumber, {pLabel:formatStringFromNameCore('width', 'main'), pMin:0, pStateVarName:'sGenPalW', sGenPalW:this.props.sGenPalW, pCStateSel:{'cutout':'w', [formatStringFromNameCore('rectangle', 'main')]:'w', [formatStringFromNameCore('oval', 'main')]:'w', [formatStringFromNameCore('gaussian', 'main')]:'w', [formatStringFromNameCore('mosaic', 'main')]:'w'}, pCrement:mtmm.w(1) }),
				React.createElement(InputNumber, {pLabel:formatStringFromNameCore('height', 'main'), pMin:0, pStateVarName:'sGenPalH', sGenPalH:this.props.sGenPalH, pCStateSel:{'cutout':'h', [formatStringFromNameCore('rectangle', 'main')]:'h', [formatStringFromNameCore('oval', 'main')]:'h', [formatStringFromNameCore('gaussian', 'main')]:'w', [formatStringFromNameCore('mosaic', 'main')]:'w'}, pCrement:mtmm.h(1) })
			)
		}
	});

	var TextTools = React.createClass({
		displayName: 'TextTools',
		componentDidUpdate: function(prevProps, prevState) {
			//// if (gCState && gCState.selection && gCState.selection.name == formatStringFromNameCore('text', 'main')) {
			//// 	var newValid = true;
			//// 	if (prevProps.sPalFontFace != this.props.sPalFontFace) {
			//// 		gCState.selection.fontface = this.props.sPalFontFace;
			//// 		newValid = false;
			//// 	}
			//// 	if (prevProps.sPalFontBold != this.props.sPalFontBold) {
			//// 		gCState.selection.fontbold = this.props.sPalFontBold;
			//// 		newValid = false;
			//// 	}
			//// 	if (prevProps.sPalFontItalic != this.props.sPalFontItalic) {
			//// 		gCState.selection.fontitalic = this.props.sPalFontItalic;
			//// 		newValid = false;
			//// 	}
			//// 	// sPalFontSize is handled by InputNumber
			//// 	if (!newValid) {
			//// 		gCState.selection.font = gCanStore.rconn.calcCtxFont(gCState.selection);
			//// 		gCanStore.setCanState(newValid);
			//// 	} // else if its true based on these tests, i dont want to set it to true. because maybe someone somewhere else set it to true
			//// }
			if (prevProps.sPalFontFace != this.props.sPalFontFace) {
				this.refs.selectface.selectedIndex = gFonts.indexOf(this.props.sPalFontFace);
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

			return React.createElement('div', {className:'ptexttools'},
				React.createElement('div', {className:'ptexttools-row'},
					React.createElement('div', {},
						// React.createElement('label', {htmlFor:'font_family'},
							// 'Font'
						// ),
						React.createElement('select', {id:'font_family', defaultValue:this.props.sPalFontFace, onChange:this.change, ref:'selectface'},
							cFontFamilies
						)
					)
				),
				React.createElement('div', {className:'ptexttools-row'},
					React.createElement(InputNumber, {pLabel:formatStringFromNameCore('font_size_px', 'main'), pStateVarName:'sPalFontSize', sPalFontSize:this.props.sPalFontSize, pMin:1, pCStateSel:{[formatStringFromNameCore('text', 'main')]:'fontsize'} }),
					React.createElement('div', {className:'pbutton ptexttools-bold' + (this.props.sPalFontBold ? ' pbutton-pressed' : ''), onClick:this.click.bind(this, 'sPalFontBold')},
						formatStringFromNameCore('bold_short', 'main')
					),
					React.createElement('div', {className:'pbutton ptexttools-italic' + (this.props.sPalFontItalic ? ' pbutton-pressed' : ''), onClick:this.click.bind(this, 'sPalFontItalic')},
						formatStringFromNameCore('italics_short', 'main')
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
			//// if (gCState && gCState.selection && gCState.selection.name == formatStringFromNameCore('line', 'main')) {
			//// 	var newValid = true;
			//// 	if (prevProps.sPalArrowStart != this.props.sPalArrowStart) {
			//// 		gCState.selection.arrowStart = this.props.sPalArrowStart;
			//// 		newValid = false;
			//// 	}
			//// 	if (prevProps.sPalArrowEnd != this.props.sPalArrowEnd) {
			//// 		gCState.selection.arrowEnd = this.props.sPalArrowEnd;
			//// 		newValid = false;
			//// 	}
			//// 	// sPalArrowLength is handled by InputNumber
			//// 	gCanStore.setCanState(newValid); // else if its true based on these tests, i dont want to set it to true. because maybe someone somewhere else set it to true
			//// }
			if (prevProps.sPalArrowStart != this.props.sPalArrowStart) {
				this.refs.checkstart.checked = this.props.sPalArrowStart;
			}
			if (prevProps.sPalArrowEnd != this.props.sPalArrowEnd) {
				this.refs.checkend.checked = this.props.sPalArrowEnd;
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
						React.createElement('input', {id:'arrow_start', type:'checkbox', defaultChecked:this.props.sPalArrowStart, onClick:this.checkStart, ref:'checkstart'}),
						React.createElement('label', {htmlFor:'arrow_start'},
							formatStringFromNameCore('start', 'main')
						)
					),
					React.createElement('div', {},
						React.createElement('input', {id:'arrow_end', type:'checkbox', defaultChecked:this.props.sPalArrowEnd, onClick:this.checkEnd, ref:'checkend'}),
						React.createElement('label', {htmlFor:'arrow_end'},
							formatStringFromNameCore('end', 'main')
						)
					)
				),
				React.createElement(InputNumber, {pLabel:formatStringFromNameCore('size', 'main'), pStateVarName:'sPalArrowLength', sPalArrowLength:this.props.sPalArrowLength, pMin:1, pCStateSel:{[formatStringFromNameCore('line', 'main')]:'arrowLength'} })
				// React.createElement('div', {},
				// 	React.createElement('label', {htmlFor:'arrow_length'},
				// 		'Length'
				// 	),
				// 	React.createElement('input', {id:'arrow_length', type:'text'})
				// ),
				// React.createElement('div', {},
				// 	React.createElement('label', {htmlFor:'arrow_width'},
				// 		formatStringFromNameCore('width', 'main')
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
			//// if (gCState && gCState.selection) {
			//// 	if (prevProps.sColor != this.props.sColor || prevProps.sAlpha != this.props.sAlpha) {
			//// 		if (this.props.pStateColorKey == 'sPalFillColor') {
			//// 			// if currently selection object obeys fillcolor, then apply this new fillcolor
			//// 			switch (gCState.selection.name) {
			//// 				case formatStringFromNameCore('rectangle', 'main'):
			//// 				case formatStringFromNameCore('oval', 'main'):
			//// 				case formatStringFromNameCore('text', 'main'):
			////
			//// 						gCState.selection.fillStyle = colorStrToCssRgba(this.props.sColor, this.props.sAlpha);
			//// 						gCanStore.setCanState(false);
			////
			//// 					break;
			//// 				default:
			//// 					// this selection is not affected
			//// 			}
			//// 		} else if (this.props.pStateColorKey == 'sPalLineColor') {
			//// 			// if currently selection object obeys linecolor, then apply this new linecolor
			//// 			switch (gCState.selection.name) {
			//// 				case formatStringFromNameCore('rectangle', 'main'):
			//// 				case formatStringFromNameCore('oval', 'main'):
			//// 				case formatStringFromNameCore('line', 'main'):
			//// 				case formatStringFromNameCore('pencil', 'main'):
			////
			//// 						gCState.selection.strokeStyle = colorStrToCssRgba(this.props.sColor, this.props.sAlpha);
			//// 						if (gCState.selection.name == formatStringFromNameCore('line', 'main')) { // as fillStyle for line is set equal to that of its strokeStyle
			//// 							gCState.selection.fillStyle = colorStrToCssRgba(this.props.sColor, this.props.sAlpha);
			//// 						}
			//// 						gCanStore.setCanState(false);
			////
			//// 					break;
			//// 				default:
			//// 					// this selection is not affected
			//// 			}
			//// 		} else if (this.props.pStateColorKey == 'sPalMarkerColor') {
			//// 			// if currently selection object obeys markercolor, then apply this new markercolor
			//// 			switch (gCState.selection.name) {
			//// 				case formatStringFromNameCore('marker', 'main'):
			////
			//// 						gCState.selection.strokeStyle = colorStrToCssRgba(this.props.sColor, this.props.sAlpha);
			//// 						gCanStore.setCanState(false);
			////
			//// 					break;
			//// 				default:
			//// 					// this selection is not affected
			//// 			}
			//// 		}
			//// 	}
			//// }
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
			//		sGenInputNumberMousing

			// only supports rgb mode
			var {sColor, sAlpha, pStateColorKey, pStateAlphaKey, pSetStateName, sGenColorPickerDropping, sHistory, pStateHistoryKey, sGenInputNumberMousing} = this.props;

			// convert sColor into object of rgb
			sColor = this.props.sColor + ''; // make it a string
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
			var pHex = hex;

			var pHsv = rgb2hsv(pRgba.r, pRgba.g, pRgba.b);

			return React.createElement('div', { className:'colorpicker' + (sGenInputNumberMousing ? ' mousing' : '') },
				React.createElement('div', {className:'colorpicker-inner'},
					React.createElement(ColorPickerChoices, {pStateColorKey, pSetStateName, sGenColorPickerDropping, sColor, pStateHistoryKey, sHistory}),
					React.createElement(ColorPickerBoard, {pHsv, pStateColorKey, pSetStateName}),
					React.createElement(ColorPickerSliders, {pRgba, pStateColorKey, pStateAlphaKey, pSetStateName, pHsv}),
					React.createElement(ColorPickerCodes, {pHex, pRgba, pStateColorKey, pStateAlphaKey, pSetStateName})
				)
			);
		}
	});

	var ColorPickerBoard = React.createClass({
		displayName: 'ColorPickerBoard',
		mousedown: function(e) {
			if (e.button !== 0) { return }

			if (!this.brect) {
				this.brect = ReactDOM.findDOMNode(this).getBoundingClientRect();
			}
			console.log('brect:', this.brect);

			var x = e.clientX - this.brect.left;
			var y = e.clientY - this.brect.top;
			var newHsv = {
				h: this.props.pHsv.h,
				s: parseInt(x / this.brect.width * 100, 10),
				v: parseInt((1 - y / this.brect.height) * 100, 10),
			};
			// console.log('newHsv:', newHsv);

			var newRgb = HSVtoRGB(newHsv.h/360, newHsv.s/100, newHsv.v/100);
			var newHex = rgbToHex(true, newRgb.r, newRgb.g, newRgb.b);
			gEditorStore.setState({
				[this.props.pStateColorKey]: newHex,
				sGenInputNumberMousing: 'crosshair'
			});
			this.sGenInputNumberMousing = 'crosshair';
			window.addEventListener('mouseup', this.mouseup, false);
			window.addEventListener('mousemove', this.mousemove, false);
		},
		mousemove: function(e) {

			var x = e.clientX - this.brect.left;
			var y = e.clientY - this.brect.top;
			var newHsv = {
				h: this.props.pHsv.h,
				s: parseInt(x / this.brect.width * 100, 10),
				v: parseInt((1 - y / this.brect.height) * 100, 10),
			};
			// console.log('newHsv:', newHsv);

			if (newHsv.s < 0 || newHsv.s > 100 || newHsv.v < 0 || newHsv.v > 100) {
				if (this.sGenInputNumberMousing != 'not-allowed') {
					this.sGenInputNumberMousing = 'not-allowed';
					gEditorStore.setState({
						sGenInputNumberMousing: 'not-allowed'
					});
				}
			} else {

				var newRgb = HSVtoRGB(newHsv.h/360, newHsv.s/100, newHsv.v/100);
				var newHex = rgbToHex(true, newRgb.r, newRgb.g, newRgb.b);


				var newStateObj = {
					[this.props.pStateColorKey]: newHex,
					setStateFromMouseMove: true
				};

				if (this.sGenInputNumberMousing != 'crosshair') {
					this.sGenInputNumberMousing = 'crosshair';
					newStateObj.sGenInputNumberMousing = 'crosshair';
				}

				gEditorStore.setState(newStateObj);
			}

		},
		mouseup: function(e) {
			if (e.button != 0) { return }

			gEditorStore.setState({
				sGenInputNumberMousing: null
			});

			delete this.sGenInputNumberMousing;

			window.removeEventListener('mouseup', this.mouseup, false);
			window.removeEventListener('mousemove', this.mousemove, false);
		},
		render: function() {
			// props
			var {pHsv} = this.props;

			var thingyX = pHsv.s;
			var thingyY = pHsv.v;

			var pBgRgb = HSVtoRGB(pHsv.h/360, 1, 1);

			var hexBg = rgbToHex(true, pBgRgb.r, pBgRgb.g, pBgRgb.b);

			return React.createElement('div', {className:'colorpicker-board', onMouseDown:this.mousedown},
				React.createElement('div', {className:'colorpicker-board-thingy', style:{left:thingyX+'%', bottom:thingyY+'%'} }),
				React.createElement('div', {className:'colorpicker-board-color', style:{backgroundColor:hexBg} }),
				React.createElement('div', {className:'colorpicker-board-white'}),
				React.createElement('div', {className:'colorpicker-board-black'})
			);
		}
	});
	var ColorPickerSliders = React.createClass({
		displayName: 'ColorPickerSliders',
		mousedown: function(colorOrAlpha, e) {
			console.log('e:', e);
			// colorOrAlpha true for color
			// false for alpha
			if (e.button != 0) { return }

			console.log('entered mousedown');

			this.colorOrAlpha = colorOrAlpha;

			var brect;
			if (colorOrAlpha) {
				brect = this.refs.alpha.getBoundingClientRect();
			} else {
				brect = this.refs.hue.getBoundingClientRect();
			}
			// brect: DOMRect { x: 597.2166748046875, y: 300.3999938964844, width: 170, height: 12, top: 300.3999938964844, right: 767.2166748046875, bottom: 312.3999938964844, left: 597.2166748046875 }
			console.log('brect:', brect);

			this.widthx = brect.width;
			this.minx = brect.x;
			this.maxx = brect.right;

			var downx = e.clientX - this.minx;
			var perx = Math.round(downx / this.widthx * 100);
			// console.log('downx:', downx, '%:', perx);

			this.sGenInputNumberMousing = null;

			this.limitTestThenSet(perx);

			window.addEventListener('mouseup', this.mouseup, false);
			window.addEventListener('mousemove', this.mousemove, false);

		},
		mousemove: function(e) {

			var downx = e.clientX - this.minx;
			var perx = Math.round(downx / this.widthx * 100);
			// console.log('downx:', downx, '%:', perx);

			this.limitTestThenSet(perx);

		},
		limitTestThenSet: function(aNewVal) {
			// returns true if set

			// figure out current value
			var cval;
			if (this.colorOrAlpha) {
				cval = Math.round(this.props.pHsv.h / 360 * 100); // percentHue
				console.log('current hue:', cval, this.props.pHsv);
			} else {
				cval = this.props.pRgba.a;
			}

			if (aNewVal < 0 && cval != 0) { // set to min if not at min
				aNewVal = 0;
			} else if (aNewVal > 100 && cval != 100) { // set to max
				aNewVal = 100;
			}

			if (aNewVal < 0 || aNewVal > 100) {
				if (this.sGenInputNumberMousing != 'not-allowed') {
					this.sGenInputNumberMousing = 'not-allowed';
					gEditorStore.setState({
						sGenInputNumberMousing: 'not-allowed'
					});
				}
				return false; // below min limit, or above max limit, dont set it
			} else {

				if (cval === aNewVal) {
					// its already that number
					console.log('already!');
					return true;
				}

				var newStateObj = {}
				if (this.colorOrAlpha) {
					console.log(aNewVal / 100, this.props.pHsv.s / 100, this.props.pHsv.v / 100);
					var newRgb = HSVtoRGB(aNewVal / 100, this.props.pHsv.s / 100, this.props.pHsv.v / 100);
					console.log('newRgb:', newRgb);
					var newHex = rgbToHex(true, newRgb.r, newRgb.g, newRgb.b);
					console.log('newHex:', newHex);
					newStateObj[this.props.pStateColorKey] = newHex;
				} else {
					newStateObj[this.props.pStateAlphaKey] = aNewVal;
				}

				// if (this.sGenInputNumberMousing) {
					if (this.sGenInputNumberMousing != 'ew-resize') {
						this.sGenInputNumberMousing = 'ew-resize';
						newStateObj.sGenInputNumberMousing = this.sGenInputNumberMousing;
					}
					newStateObj.setStateFromMouseMove = true;
				// }

				gEditorStore.setState(newStateObj);

				return true;
			}
		},
		mouseup: function(e) {
			if (e.button != 0) { return }

			gEditorStore.setState({
				sGenInputNumberMousing: null
			});
			delete this.sGenInputNumberMousing;
			delete this.downval;


			window.removeEventListener('mouseup', this.mouseup, false);
			window.removeEventListener('mousemove', this.mousemove, false);
			// gEditorStore.setState({
				// sGenInputNumberMousing: null
			// });
		},
		render: function() {
			// props
			// var {pHsv, pRgba, pStateColorKey, pStateAlphaKey, pSetStateName} = this.props;
			var {pRgba, pHsv} = this.props;

			var rgbaStr = 'rgba(' + pRgba.r + ', ' + pRgba.g + ', ' + pRgba.b + ', ' + (pRgba.a/100) + ')';
			var colorBgImgStr = 'linear-gradient(to right, ' + rgbaStr + ', ' + rgbaStr + '), url("chrome://nativeshot/content/resources/images/trans5x5.png")';

			var alphaBgImgStr = 'linear-gradient(to right, rgba(' + pRgba.r + ', ' + pRgba.g + ', ' + pRgba.b + ', 0), rgb(' + pRgba.r + ', ' + pRgba.g + ', ' + pRgba.b + ')), url("chrome://nativeshot/content/resources/images/trans5x5.png")';


			var percentHue = Math.round(pHsv.h / 360 * 100);

			return React.createElement('div', {className:'colorpicker-sliders'},
				React.createElement('div', {className:'colorpicker-sliders-wrap'},
					React.createElement('div', {className:'colorpicker-slider-rainbow', ref:'hue', onMouseDown:this.mousedown.bind(this, true) },
						React.createElement('div', {className:'colorpicker-slider-thingy', style:{left:'calc(' + percentHue+'% - ' + Math.round(9*(percentHue/100)) + 'px)'} }) /* -9px to counter the width so it doesnt oveflow at 100% */
					),
					React.createElement('div', {className:'colorpicker-slider-alpha', ref:'alpha', onMouseDown:this.mousedown.bind(this, false), style:{backgroundImage:alphaBgImgStr} },
						React.createElement('div', {className:'colorpicker-slider-thingy', style:{left:'calc(' + pRgba.a+'% - ' + Math.round(9*(pRgba.a/100)) + 'px)'} }) /* -9px to counter the width so it doesnt oveflow at 100% */
					)
				),
				React.createElement('div', {style:{backgroundImage:colorBgImgStr}, className:'colorpicker-sliders-wrap colorpicker-slider-preview'})
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


			cPropsR.pLabel = formatStringFromNameCore('red_short', 'main');
			cPropsG.pLabel = formatStringFromNameCore('green_short', 'main');
			cPropsB.pLabel = formatStringFromNameCore('blue_short', 'main');
			cPropsA.pLabel = formatStringFromNameCore('alpha_short', 'main');

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
					formatStringFromNameCore('hex', 'main'),
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
					case formatStringFromNameCore('marker', 'main'):

							addColorSetStateObj = gCanStore.rconn.addColorToHistory(aColor, 'sPalMarkerColorHist', true);

						break;
					case formatStringFromNameCore('line', 'main'):
					case formatStringFromNameCore('pencil', 'main'):

							addColorSetStateObj = gCanStore.rconn.addColorToHistory(aColor, 'sPalBothColorHist', true);

						break;
					case formatStringFromNameCore('text', 'main'):

							addColorSetStateObj = gCanStore.rconn.addColorToHistory(aColor, 'sPalBothColorHist', true);

						break;
					case formatStringFromNameCore('rectangle', 'main'):
					case formatStringFromNameCore('oval', 'main'):

							addColorSetStateObj = gCanStore.rconn.addColorToHistory(aColor, 'sPalBothColorHist', true);

						break;
					default:
						// no related color picker
				}
			}

			console.log('addColorSetStateObj:', addColorSetStateObj);

			gColorPickerSetState[this.props.pSetStateName](overwriteObjWithObj(setStateObj, addColorSetStateObj));
		},
		dropperClick: function() {
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
						React.createElement('div', {className:'colorpicker-choices-opt colorpicker-history-icon'}),
						!historyElements.length ? React.createElement('div', {className:'colorpicker-history-none'}) : historyElements
					),
					React.createElement('div', {className:'colorpicker-choices-default'},
						defaultElements
					)
				),
				React.createElement('div', {className:'colorpicker-choices-wrap colorpicker-choices-dropper', onClick:this.dropperClick},
					'\ue824'
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
			//		setLabelText

			var cChildren = [];

			// iterate through this.props.pSub
			for (var i=0; i<this.props.pSub.length; i++) {
				cChildren.push(React.createElement(SubButton, overwriteObjWithObj({pSubButton:this.props.pSub[i], setLabelText:this.props.setLabelText}, this.props)/*{sPalSeldSubs:this.props.sPalSeldSubs, pButton:this.props.pButton, pSubButton:this.props.pSub[i], sPalLineAlpha:this.props.sPalLineAlpha, sPalLineColor:this.props.sPalLineColor, sPalFillAlpha:this.props.sPalFillAlpha, sPalFillColor:this.props.sPalFillColor, sPalMarkerAlpha:this.props.sPalMarkerAlpha, sPalMarkerColor:this.props.sPalMarkerColor}*/));
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
					if (cLayoutEntry.label == formatStringFromNameCore('clear_selection', 'main') && gCState && gCState.drawables) {
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
		getStateVarVal: function() {
			var { pStateVarName } = this.props;
			if (pStateVarName != 'sGenPalH' && pStateVarName != 'sGenPalW') {
				return this.props[this.props.pStateVarName];
			} else {
				if (pStateVarName == 'sGenPalH') {
					return parseFloat(gHeightRef.value);
				} else if (pStateVarName == 'sGenPalW') {
					return parseFloat(gWidthRef.value);
				}
			}
		},
		wheel: function(e) {
			var newVal;
			// console.log('e:', e.deltaMode, e.deltaY);

			if (e.deltaY < 0) {
				newVal = this.getStateVarVal() + this.crement;
			} else {
				newVal = this.getStateVarVal() - this.crement;
			}

			this.limitTestThenSet(newVal);

			e.stopPropagation(); // so it doesnt trigger the wheel event on window. otherwise if ZoomView is showing, then it will change that zoom level
		},
		keydown: function(e) {
			var newVal;

			switch (e.key) {
				case 'ArrowUp':

						newVal = this.getStateVarVal() + this.crement;

					break;
				case 'ArrowDown':

						newVal = this.getStateVarVal() - this.crement;

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

				if (this.sGenInputNumberMousing) {
					newStateObj.setStateFromMouseMove = true;
				}

				gEditorStore.setState(newStateObj);

				//// if (this.props.pCStateSel) {
				//// 	var drawablePropToUpdate = this.props.pCStateSel[gCState.selection.name];
				//// 	if (gCState && gCState.selection && drawablePropToUpdate) {
				//// 		gCState.selection[drawablePropToUpdate] = newSetValue;
				//// 		if (drawablePropToUpdate.indexOf('font') === 0) {
				//// 			gCState.selection.font = gCanStore.rconn.calcCtxFont(gCState.selection);
				//// 		}
				//// 		gCanStore.setCanState(false); // so new blur level gets applied
				//// 	}
				//// }

				return true;
			}
		},
		mousedown: function(e) {
			if (e.button != 0) { return }

			this.downx = e.clientX;
			this.downval = this.getStateVarVal();
			window.addEventListener('mouseup', this.mouseup, false);
			window.addEventListener('mousemove', this.mousemove, false);

			gEditorStore.setState({
				sGenInputNumberMousing: this.cursor
			});



			this.sGenInputNumberMousing = this.cursor; // keep track locally otherwise ill need to have whoever uses InputNumber pass in sGenInputNumberMousing as a prop

		},
		mousemove: function(e) {

			var delX = e.clientX - this.downx;

			var delSensitivity = Math.round(delX / this.mousesens);

			var newVal = this.downval + (delSensitivity * this.crement);

			// console.log('downx:', this.downx, 'clientX:', e.clientX, 'delX:', delX, 'delSensitivity:', delSensitivity);


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
		mouseup: function(e) {
			if (e.button != 0) { return }

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
			if (this.props.pLabel == formatStringFromNameCore('width', 'main')) {
				console.error('mounted width');
				gWidthRef = this.refs.input;
			} else if (this.props.pLabel == formatStringFromNameCore('height', 'main')) {
				console.error('mounted height');
				gHeightRef = this.refs.input;
			}
		},
		componentWillUnmount: function() {
			if (this.props.pLabel == formatStringFromNameCore('width', 'main')) {
				gWidthRef = null;
			} else if (this.props.pLabel == formatStringFromNameCore('height', 'main')) {
				gHeightRef = null;
			}
		},
		componentDidUpdate: function(prevProps) {
			// console.log('did update, prevProps:', prevProps);
			var newPropVal = this.props[this.props.pStateVarName];
			if (newPropVal != this.lastDomElValue) {
				// if (prevProps.value != newPropVal) {
					this.refs.input.value = newPropVal;
					// console.log('ok updated input to', newPropVal, 'pLabel:', this.props.pLabel);
					this.lastDomElValue = newPropVal;
				// }
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
			pPalSize: 38,
			pPalSeldSubs: palSeldSubs,
			pPalMultiDepresses: {}, // if its depressed, then the tool label is the key and the value is true

			pPalLineColor: 'rgb(208, 2, 27)',
			pPalLineAlpha: 100,
			pPalBothColorHist: [],
			pPalFillColor: 'rgb(74, 144, 226)',
			pPalFillAlpha: 75,
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
			pPalRectRadius: 5,

			pPalFontSize: 24,
			pPalFontFace: 'Arial',
			pPalFontBold: undefined,
			pPalFontItalic: undefined,
			pPalFontUnderline: undefined,

			pCanHandleSize: 18,

			pPalX: 5, // link239285555
			pPalY: 50 // link239285555
		};
	} else {
		editorstate = JSON.parse(editorstateStr);
	}

	// make sure pPalX and pPalY are on a monitor. if that monitor is no longer here, then use the defaults, which is near 0,0 which is on primary monitor which is always there
	var pPalCoordsOnVisibleMon = false;
	var pPalX = editorstate.pPalX; // i dont do mmtm here or on `var pPalY` because pal position is relative to 0,0
	var pPalY = editorstate.pPalY;
	// console.log('pPal:', pPalX, ', ', pPalY, 'from prespective of primary monitor meaning 0,0. this iMon:', tQS.iMon);
	var allMonDim = tQS.allMonDim;
	var l = allMonDim.length;
	for (var i=0; i<l; i++) {
		var cMonDim = allMonDim[i];
		if (pPalX >= cMonDim.x && pPalX <= cMonDim.x + cMonDim.w &&
			pPalY >= cMonDim.y && pPalY <= cMonDim.y + cMonDim.h) {
				// setTimeout(function() {
					// alert('yes pal is on visible mon of iMon: ' + i);
					// console.log('yes pal is on vis mon of iMon:', i, cMonDim);
				// }, 1000);
				pPalCoordsOnVisibleMon = true;
				break;
		}
	}
	if (!pPalCoordsOnVisibleMon) {
		// console.log('pPal coords not on any visible monitor, here are all the dimensions:', allMonDim);
		editorstate.pPalX = 5; // link239285555
		editorstate.pPalY = 50; // link239285555
	}

	// determine if Fullscreen button should have a submenu
	if (tQS.allMonDim.length > 1) {
		var l = palLayout.length;
		for (var i=0; i<l; i++) {
			var entry = palLayout[i];
			if (entry.label == formatStringFromNameCore('fullscreen', 'main')) {
				entry.sub = [
						{
							label: formatStringFromNameCore('all_monitors', 'main'),
							icon: '\ue843',
							unfixable: true,
							hotkey: 'aa'
						}
				];

				// individual monitor subbuttons
				var allMonDim = tQS.allMonDim;
				var l2 = allMonDim.length;

				for (var j=0; j<l2; j++) {
					if (j !== tQS.iMon) {
						entry.sub.push({
							label: formatStringFromNameCore('monitor_x', 'main', [(j + 1)]),
							icon: getMonitorSvg(j),
							icontext: (j + 1),
							unfixable: true
						});
					}
				}

				break;
			}
		}
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


var mtmm = { // short for monToMultiMon - multimon means WITH the scale and WITH the screenX screenY offset
	// converts clientX to proper screenX
	x: function(aX) {
		return tQS.x + (tQS.win81ScaleX ? aX * tQS.win81ScaleX : aX);
	},
	y: function(aY) {
		return tQS.y + (tQS.win81ScaleY ? aY * tQS.win81ScaleY : aY);
	},
	w: function(aW) {
		return tQS.win81ScaleX ? (aW * tQS.win81ScaleX) : aW;
	},
	h: function(aH) {
		return tQS.win81ScaleY ? (aH * tQS.win81ScaleY) : aH;
	}
};

var mmtm = { // short for multiMonToMon - mon means without the scale, and without the screenX screenY offset
	x: function(aX) {
		return tQS.win81ScaleX ? (aX - tQS.x) / tQS.win81ScaleX : aX;
	},
	y: function(aY) {
		return tQS.win81ScaleY ? (aY - tQS.y) / tQS.win81ScaleY : aY;
	},
	w: function(aW) {
		return tQS.win81ScaleX ? (aW / tQS.win81ScaleX) : aW;
	},
	h: function(aH) {
		return tQS.win81ScaleY ? (aH / tQS.win81ScaleY) : aH;
	}
};

var mmtmNOSCALE = {
	x: function(aX) {
		return Math.round(aX - tQS.x);
	},
	y: function(aY) {
		return Math.round(aY - tQS.y);
	},
	w: function(aW) {
		return Math.round(aW);
	},
	h: function(aH) {
		return Math.round(aH);
	}
};

function getMonitorSvg(num) {
	switch (num) {
		case 0:
			return '\ue844';
		case 1:
			return '\ue84a';
		case 2:
			return '\ue849';
		case 3:
			return '\ue850';
		case 4:
			return '\ue847';
		case 5:
			return '\ue846';
		case 6:
			return '\ue845';
		case 7:
			return '\ue84c';
		case 8:
			return '\ue84b';
		default:
			return '\ue80d';
	}
}

function MyContext(ctx) {

	this.MMIFIED = true;
	this.setScaleOff = function() {
		this.conv = mmtmNOSCALE;
	}
	this.setScaleOn = function() {
		this.conv = mmtm;
	}
	this.conv = mmtm;

    // Methods

	this.beginPath = ctx.beginPath.bind(ctx);
	this.closePath = ctx.closePath.bind(ctx);
	this.stroke = ctx.stroke.bind(ctx);
	this.fill = ctx.fill.bind(ctx);
	this.createPattern = ctx.createPattern.bind(ctx);

	this.measureText = function(text) {
		var om = ctx.measureText(text);
		return {
			width: mtmm.w(om.width)
		};
	};

	this.clearRect = function(x, y, w, h) {
		ctx.clearRect(this.conv.x(x), this.conv.y(y), this.conv.w(w), this.conv.h(h));
	};

	this.drawImage = function(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {
		ctx.drawImage(image, this.conv.x(sx), this.conv.y(sy), this.conv.w(sWidth), this.conv.h(sHeight), this.conv.x(dx), this.conv.y(dy), this.conv.w(dWidth), this.conv.h(dHeight));
	};

	this.isPointInStroke = function(x, y) {
		return ctx.isPointInStroke(this.conv.x(x), this.conv.y(y));
	};

	this.arc = function(x, y, radius, startAngle, endAngle, anticlockwise) {
		ctx.arc(this.conv.x(x), this.conv.y(y), this.conv.w(radius), startAngle, endAngle, anticlockwise);
	};

	this.putImageData = function(imagedata, dx, dy) {
		ctx.putImageData(imagedata, this.conv.x(dx), this.conv.y(dy));
	};

	this.getImageData = function(x, y, w, h) {
		return ctx.getImageData(this.conv.x(x), this.conv.y(y), this.conv.w(w), this.conv.h(h));
	};

	this.fillText = function(text, x, y) {
		ctx.fillText(text, this.conv.x(x), this.conv.y(y));
	};

    this.lineTo = function(x, y) {
		ctx.lineTo(this.conv.x(x), this.conv.y(y));
	};

	this.moveTo = function(x, y) {
		ctx.moveTo(this.conv.x(x), this.conv.y(y));
	};

	this.setLineDash = function(segments) {
		var l = segments.length;
		for (var i=0; i<l; i++) {
			segments[i] = this.conv.w(segments[i]);
		}
		ctx.setLineDash(segments);
	};

	this.fillRect = function(x, y, w, h) {
		ctx.fillRect(this.conv.x(x), this.conv.y(y), this.conv.w(w), this.conv.h(h));
	};

	this.strokeRect = function(x, y, w, h) {
		ctx.strokeRect(this.conv.x(x), this.conv.y(y), this.conv.w(w), this.conv.h(h));
	};

	this.rect = function(x, y, w, h) {
		ctx.rect(this.conv.x(x), this.conv.y(y), this.conv.w(w), this.conv.h(h));
	};

	this.bezierCurveTo = function(cp1x, cp1y, cp2x, cp2y, x, y) {
		ctx.bezierCurveTo(this.conv.x(cp1x), this.conv.y(cp1y), this.conv.x(cp2x), this.conv.y(cp2y), this.conv.x(x), this.conv.y(y));
	};

	this.quadraticCurveTo = function(cpx, cpy, x, y) {
		ctx.quadraticCurveTo(this.conv.x(cpx), this.conv.y(cpy), this.conv.x(x), this.conv.y(y));
	};

    // Properties

    Object.defineProperty(this, 'lineWidth', {
        get: function() {return ctx.lineWidth},
        set: function(value) {
            // do something magic with value
			ctx.lineWidth = this.conv.w(value);
        }
    });

	var fontsizePatt = /\d+px/;
    Object.defineProperty(this, 'font', {
        get: function() { return ctx.font },
        set: function(value) {
			var fontsize = fontsizePatt.exec(value)[0];
			ctx.font = value.replace(fontsize, this.conv.w(parseInt(fontsize)) + 'px');
		}
    });

    Object.defineProperty(this, 'strokeStyle', {
        get: function() { return ctx.strokeStyle },
        set: function(value) { ctx.strokeStyle = value }
    });

    Object.defineProperty(this, 'fillStyle', {
        get: function() { return ctx.fillStyle },
        set: function(value) { ctx.fillStyle = value }
    });

    Object.defineProperty(this, 'mozImageSmoothingEnabled', {
        get: function() { return ctx.mozImageSmoothingEnabled },
        set: function(value) { ctx.mozImageSmoothingEnabled = value }
    });

    Object.defineProperty(this, 'imageSmoothingEnabled', {
        get: function() { return ctx.imageSmoothingEnabled },
        set: function(value) { ctx.imageSmoothingEnabled = value }
    });


}


// start - pre-init
var query_str = window.location.href.substr('about:nativeshot?'.length);
// console.log('editor.js query_str:', query_str);
var tQS = queryStringAsJson(query_str);
tQS.allMonDim = JSON.parse(decodeURIComponent(tQS.allMonDimStr));
delete tQS.allMonDimStr;

if (!('win81ScaleX' in tQS)) {
	tQS.win81ScaleX = 1;
	tQS.win81ScaleY = 1;
}

// delete tQS.win81ScaleX;
// delete tQS.win81ScaleY;

console.log('tQS:', tQS);
var gQS = tQS;

var gBsComm = new Comm.client.content(
	()=>console.log('handshake done client side')
);
var { callInMainworker, callInBootstrap } = CommHelper.content;
var myEvent = document.createEvent('CustomEvent');
myEvent.initCustomEvent('nscomm', true, true, gQS.iMon);
window.dispatchEvent(myEvent);

function receiveWinArr(aData) {
	// for window wand
	gWinArr = aData.winArr;
	console.log('got gWinArr:', gWinArr);
}

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
	asJsonStringify = asJsonStringify.replace(/"(-?\d+(?:.\d+)?|true|false)"/g, function($0, $1) { return $1; });
	// console.log('asJsonStringify:', asJsonStringify);
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

function colorStrToCssRgba(aColorStr, aAlpha, retObj) {
	// if regObj false, then returns 'rgba(#, #, #, #)', else returns object of rgba
	// if aAlpha is a number -- CANNOT be 0 to 1 IT MUST BE 0 to 100 OR a string like rgba(2, 2, 2, 100)
	// HOWEVER if aAlpha is a str then must be 0 to 1

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
	if (isNaN(aAlpha)) {
		// then its a string
		console.log('aAlpha:', aAlpha);
		aAlpha = /\.?\d+(?!.*\d)/.exec(aAlpha);
		if (!aAlpha) {
			throw new Error('no number in aAlpha: ' + aAlpha);
		}
		aAlpha = aAlpha[0] * 100;
	}
	sAlpha = aAlpha / 100;

	var pRgba = rgb;
	pRgba.a = sAlpha;

	if (retObj) {
		return pRgba;
	} else {
		return 'rgba(' + pRgba.r + ', ' + pRgba.g + ', ' + pRgba.b + ', ' + pRgba.a + ')';
	}
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
	// console.error('aChars: "' + aChars + '"');
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

	// console.log('w:', w);

	var avgOfRange = (aOptions.range + 1) / 2;
	var yBaseline = Math.ceil(aSize * avgOfRange);
	// console.log('yBaseline:', yBaseline);

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

/**
 * Draws a rounded rectangle using the current state of the canvas.
 * If you omit the last three params, it will draw a rectangle
 * outline with a 5 pixel border radius
 * @param {CanvasRenderingContext2D} ctx
 * @param {Number} x The top left x coordinate
 * @param {Number} y The top left y coordinate
 * @param {Number} width The width of the rectangle
 * @param {Number} height The height of the rectangle
 * @param {Number} [radius = 5] The corner radius; It can also be an object
 *                 to specify different radii for corners
 * @param {Number} [radius.tl = 0] Top left
 * @param {Number} [radius.tr = 0] Top right
 * @param {Number} [radius.br = 0] Bottom right
 * @param {Number} [radius.bl = 0] Bottom left
 * @param {Boolean} [fill = false] Whether to fill the rectangle.
 * @param {Boolean} [stroke = true] Whether to stroke the rectangle.
 */
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
	if(typeof stroke == 'undefined') {
		stroke = true;
	}
	if(typeof radius === 'undefined') {
		radius = 5;
	}
	if(typeof radius === 'number') {
		radius = {
			tl: radius,
			tr: radius,
			br: radius,
			bl: radius
		};
	} else {
		var defaultRadius = {
			tl: 0,
			tr: 0,
			br: 0,
			bl: 0
		};
		for(var side in defaultRadius) {
			radius[side] = radius[side] || defaultRadius[side];
		}
	}
	ctx.beginPath();
	ctx.moveTo(x + radius.tl, y);
	ctx.lineTo(x + width - radius.tr, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
	ctx.lineTo(x + width, y + height - radius.br);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
	ctx.lineTo(x + radius.bl, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
	ctx.lineTo(x, y + radius.tl);
	ctx.quadraticCurveTo(x, y, x + radius.tl, y);
	ctx.closePath();
	if(fill) {
		ctx.fill();
	}
	if(stroke) {
		ctx.stroke();
	}

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

function objectHasKeys(aObject) {
	for (var p in aObject) {
		return true;
	}
	return false;
}

function rgb2hsv (r, g, b) {
	http://stackoverflow.com/a/8023734/1828637
    var rr, gg, bb,
        r = r / 255,
        g = g / 255,
        b = b / 255,
        h, s,
        v = Math.max(r, g, b),
        diff = v - Math.min(r, g, b),
        diffc = function(c){
            return (v - c) / 6 / diff + 1 / 2;
        };

    if (diff == 0) {
        h = s = 0;
    } else {
        s = diff / v;
        rr = diffc(r);
        gg = diffc(g);
        bb = diffc(b);

        if (r === v) {
            h = bb - gg;
        }else if (g === v) {
            h = (1 / 3) + rr - bb;
        }else if (b === v) {
            h = (2 / 3) + gg - rr;
        }
        if (h < 0) {
            h += 1;
        }else if (h > 1) {
            h -= 1;
        }
    }
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        v: Math.round(v * 100)
    };
}

/* accepts parameters
 * h  Object = {h:x, s:y, v:z}
 * OR
 * h, s, v
*/
function HSVtoRGB(h, s, v) {
	// http://stackoverflow.com/a/17243070/1828637
	// This code expects 0 <= h, s, v <= 1, if you're using degrees or radians, remember to divide them out.
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

function pointsDistance(x1, y1, x2, y2) {
	// http://snipplr.com/view/47207/distance-between-two-points/
	var xs = 0;
	var ys = 0;

	xs = x1 - x2;
	xs = xs * xs;

	ys = y2 - y1;
	ys = ys * ys;

	return Math.sqrt( xs + ys );
}

function pointsAngle(x1, y1, x2, y2){
	// http://snipplr.com/view/47060/
	var dx = x2 - x1;
	var dy = y2 - y1;
	return Math.atan2(dy, dx);
}

function closestNumber(num, arr) {
	// http://stackoverflow.com/a/8584940/1828637
	var curr = arr[0];
	var diff = Math.abs (num - curr);
	for (var val = 0; val < arr.length; val++) {
		var newdiff = Math.abs (num - arr[val]);
		if (newdiff < diff) {
			diff = newdiff;
			curr = arr[val];
		}
	}
	return curr;
}

function closestNumberBinary(num, arr) {
	// http://stackoverflow.com/a/8584940/1828637
	var mid;
	var lo = 0;
	var hi = arr.length - 1;
	while(hi - lo > 1) {
		mid = Math.floor((lo + hi) / 2);
		if(arr[mid] < num) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	if(num - arr[lo] <= arr[hi] - num) {
		return arr[lo];
	}
	return arr[hi];
}
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

function formatStringFromNameCore(aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements) {
	// 051916 update - made it core.addon.l10n based
    // formatStringFromNameCore is formating only version of the worker version of formatStringFromName, it is based on core.addon.l10n cache

	try { var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n][aLocalizableStr]; if (!cLocalizedStr) { throw new Error('localized is undefined'); } } catch (ex) { console.error('formatStringFromNameCore error:', ex, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements); } // remove on production

	var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n][aLocalizableStr];
	// console.log('cLocalizedStr:', cLocalizedStr, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements);
    if (aReplacements) {
        for (var i=0; i<aReplacements.length; i++) {
            cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
        }
    }

    return cLocalizedStr;
}
