function obsHandler_nativeshotEditorLoaded(aSubject, aTopic, aData) {
	
	var iMon = aData; //parseInt(aEditorDOMWindow.location.search.substr('?iMon='.length)); // iMon is my rename of colMonIndex. so its the i in the collMoninfos object
	
	var aEditorDOMWindow = colMon[iMon].E.DOMWindow;
	
	if (!aEditorDOMWindow || aEditorDOMWindow.closed) {
		throw new Error('wtf how is window not existing, the on load observer notifier of panel.xul just sent notification that it was loaded');
	}

	var aHwndPtrStr = getNativeHandlePtrStr(aEditorDOMWindow);
	colMon[iMon].hwndPtrStr = aHwndPtrStr;

	if (core.os.name != 'darwin') {
		aEditorDOMWindow.moveTo(colMon[iMon].x, colMon[iMon].y);
	}
	
	aEditorDOMWindow.focus();
	// if (core.os.name != 'darwin' && core.os.name != 'winnt') {
	if (core.os.name != 'darwin') {
		aEditorDOMWindow.fullScreen = true;
	}
	// if (core.os.name == 'winnt') {
		// aEditorDOMWindow.resizeTo(colMon[iMon].w, colMon[iMon].h);
	// }
	
	// set window on top:
	var aArrHwndPtr = [aHwndPtrStr];
	var aArrHwndPtrOsParams = {};
	aArrHwndPtrOsParams[aHwndPtrStr] = {
		left: colMon[iMon].x,
		top: colMon[iMon].y,
		right: colMon[iMon].x + colMon[iMon].w,
		bottom: colMon[iMon].y + colMon[iMon].h,
		width: colMon[iMon].w,
		height: colMon[iMon].h
	};
	
	// if (core.os.name != 'darwinAAAA') {
		var promise_setWinAlwaysTop = ScreenshotWorker.post('setWinAlwaysOnTop', [aArrHwndPtr, aArrHwndPtrOsParams]);
		promise_setWinAlwaysTop.then(
			function(aVal) {

				// start - do stuff here - promise_setWinAlwaysTop
				if (core.os.name == 'darwin') {
					initOstypes();
					// link98476884
					OSStuff.NSMainMenuWindowLevel = aVal;
					
					var NSWindowString = getNativeHandlePtrStr(aEditorDOMWindow);							
					var NSWindowPtr = ostypes.TYPE.NSWindow(ctypes.UInt64(NSWindowString));

					// var rez_orderFront = ostypes.API('objc_msgSend')(NSWindowPtr, ostypes.HELPER.sel('orderFrontRegardless'));

					
						var rez_setLevel = ostypes.API('objc_msgSend')(NSWindowPtr, ostypes.HELPER.sel('setLevel:'), ostypes.TYPE.NSInteger(OSStuff.NSMainMenuWindowLevel + 1)); // have to do + 1 otherwise it is ove rmneubar but not over the corner items. if just + 0 then its over menubar, if - 1 then its under menu bar but still over dock. but the interesting thing is, the browse dialog is under all of these  // link847455111
						console.log('rez_setLevel:', rez_setLevel.toString());
						
						var newSize = ostypes.TYPE.NSSize(colMon[iMon].w, colMon[iMon].h);
						var rez_setContentSize = ostypes.API('objc_msgSend')(NSWindowPtr, ostypes.HELPER.sel('setContentSize:'), newSize);
						console.log('rez_setContentSize:', rez_setContentSize.toString());
						
						aEditorDOMWindow.moveTo(colMon[iMon].x, colMon[iMon].y); // must do moveTo after setContentsSize as that sizes from bottom left and moveTo moves from top left. so the sizing will change the top left.
						

					/*
					aEditorDOMWindow.setTimeout(function() {
							var aSavePanel = ostypes.API('objc_msgSend')(ostypes.HELPER.class('NSSavePanel'), ostypes.HELPER.sel('savePanel'));
							
							// var rez_setFloatingPanel = ostypes.API('objc_msgSend')(aSavePanel, ostypes.HELPER.sel('setFloatingPanel:'), ostypes.CONST.YES);

							
							var rezFloatingPanel = ostypes.API('objc_msgSend')(aSavePanel, ostypes.HELPER.sel('setLevel:'), ostypes.TYPE.NSInteger(3));

							var rez_savepanel = ostypes.API('objc_msgSend')(aSavePanel, ostypes.HELPER.sel('runModal'));

					}, 2000);
					*/
					
				}
				// end - do stuff here - promise_setWinAlwaysTop
			},
			function(aReason) {
				var rejObj = {name:'promise_setWinAlwaysTop', aReason:aReason};

				//deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_setWinAlwaysTop', aCaught:aCaught};

				//deferred_createProfile.reject(rejObj);
			}
		);
	// } else {
		/*
		// main thread ctypes
		Services.wm.getMostRecentWindow('navigator:browser').setTimeout(function() {
			initOstypes();
			// var NSWindow = ostypes.TYPE.NSWindow(ctypes.UInt64(aHwndPtrStr));
			// // var rez_setLevel = ostypes.API('objc_msgSend')(NSWindow, ostypes.HELPER.sel('setLevel:'), ostypes.TYPE.NSInteger(24)); // long as its NSInteger // 5 for kCGFloatingWindowLevel which is NSFloatingWindowLevel

			// var rez_orderFront = ostypes.API('objc_msgSend')(NSWindow, ostypes.HELPER.sel('orderFrontRegardless'));

			var NSWindowString = getNativeHandlePtrStr(Services.wm.getMostRecentWindow('navigator:browser'));

			var NSWindowString = getNativeHandlePtrStr(aEditorDOMWindow);

										
			var NSWindowPtr = ostypes.TYPE.NSWindow(ctypes.UInt64(NSWindowString));
			var rez_orderFront = ostypes.API('objc_msgSend')(NSWindowPtr, ostypes.HELPER.sel('orderFront:'), ostypes.TYPE.NSInteger(3));

		}, 5000);
		*/
	// }
	
	// setting up the dom base, moved it to above the "os specific special stuff" because some os's might need to modify this (like win81)
	colMon[iMon].E.DOMWindow.postMessage({topic:'screenshotXfer', screenshotArrBuf:colMon[iMon].screenshotArrBuf}, '*', [colMon[iMon].screenshotArrBuf]);
	
	return;
	var w = colMon[iMon].w;
	var h = colMon[iMon].h;
	
	var json = 
	[
		'xul:stack', {id:'contOfCans'},
				['html:canvas', {draggable:'false',id:'canBase',width:w,height:h,style:'display:-moz-box;background:#000 url(' + core.addon.path.images + 'canvas_bg.png) repeat fixed top left;'}],
				['html:canvas', {draggable:'false',id:'canDim',width:w,height:h,style:'display:-moz-box;cursor:crosshair;'}]
	];
	
	// os specific special stuff
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
				
				if (colMon[iMon].win81ScaleX || colMon[iMon].win81ScaleY) { // 122315 - this is no longer just win81, this is also if on // priror to 122315 - win81+ has multi monitor dpi issue while firefox bug 890156 persists // http://stackoverflow.com/a/31500103/1828637 // https://bugzilla.mozilla.org/show_bug.cgi?id=890156
					var win81ScaleX = colMon[iMon].win81ScaleX;
					var win81ScaleY = colMon[iMon].win81ScaleY;
					if (win81ScaleX || win81ScaleY) {
						json.push(['html:canvas', {id:'canDum',style:'display:none;',width:w,height:h}]);
						w = Math.ceil(w / win81ScaleX);
						h = Math.ceil(h / win81ScaleY);

						
						json[2][1].width = w;
						json[2][1].height = h;
						json[2][1].style += 'position:fixed;';
						
						json[3][1].width = w;
						json[3][1].height = h;
						json[3][1].style += 'position:fixed;';
						

					}				
				}
			
			break;
		case 'darwin':
			
				// aEditorDOMWindow.setTimeout(function() {
				// 	//aEditorDOMWindow.focus(); // doesnt work to make take full
				// 	//aEditorDOMWindow.moveBy(0, -10); // doesnt work to make take full
				// 	aEditorDOMWindow.resizeBy(0, 0) // makes it take full. as fullScreen just makes it hide the special ui and resize to as if special ui was there, this makes it resize now that they are gone. no animation takes place on chromeless window, excellent
				// }, 10);
			
			break;
		default:
			// nothing special
	}
	
	// start - postStuff
	// aEditorDOMWindow.setTimeout(function() {
	// insert canvases and menu	
	var doc = aEditorDOMWindow.document;
	var elRef = {};
	doc.documentElement.appendChild(jsonToDOM(json, doc, elRef));
	
	var ctxBase = elRef.canBase.getContext('2d');
	var ctxDim = elRef.canDim.getContext('2d');
	
	// set global E. props
	colMon[iMon].E.canBase = elRef.canBase;
	colMon[iMon].E.canDim = elRef.canDim;
	colMon[iMon].E.ctxBase = ctxBase;
	colMon[iMon].E.ctxDim = ctxDim;
	

	if (win81ScaleX || win81ScaleY) {
		// rescaled for Win81 DPI non aware bug

		var ctxDum = elRef.canDum.getContext('2d');
		ctxDum.putImageData(colMon[iMon].screenshot, 0, 0);
		ctxBase.scale(1/colMon[iMon].win81ScaleX, 1/colMon[iMon].win81ScaleY);
		ctxBase.drawImage(elRef.canDum, 0, 0);
		elRef.canDum.parentNode.removeChild(elRef.canDum);
		//ctxDim.clearRect(elRef.canDim.width, elRef.canDim.height);
		//ctxBase.scale(1/colMon[iMon].win81ScaleX,1/colMon[iMon].win81ScaleY);
		
		ctxDim.scale(1/colMon[iMon].win81ScaleX, 1/colMon[iMon].win81ScaleY);
	} else {
		ctxBase.putImageData(colMon[iMon].screenshot, 0, 0);
	}
	
	ctxDim.fillStyle = gDefDimFillStyle;
	ctxDim.fillRect(0, 0, colMon[iMon].w, colMon[iMon].h);

	var menuElRef = {};

	doc.documentElement.appendChild(jsonToDOM(get_gEMenuDomJson(), doc, menuElRef));

	doc.documentElement.setAttribute('context', 'myMenu1');
	menuElRef.myMenu1.addEventListener('popupshowing', gEPopupShowing, false);
	menuElRef.myMenu1.addEventListener('popuphiding', gEPopupHiding, false);
	// set up up event listeners
	
	aEditorDOMWindow.addEventListener('unload', gEUnload, false);
	aEditorDOMWindow.addEventListener('mousedown', gEMouseDown, false);
	aEditorDOMWindow.addEventListener('mouseup', gEMouseUp, false);
	aEditorDOMWindow.addEventListener('keyup', gEKeyUp, false);
	aEditorDOMWindow.addEventListener('keydown', gEKeyDown, false);
	
	// special per os stuff
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				// make window always on top
				
			break;
		case 'gtk':

				// make window always on top
				
			break;
		
		case 'darwin':
				
				// make window always on top
			
			break;
		default:

	}
	// }, 1000);
	// end - postStuff
}