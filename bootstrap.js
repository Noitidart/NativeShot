// Imports
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
Cu.import('resource://gre/modules/ctypes.jsm'); // needed for GTK+
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Promise.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.importGlobalProperties(['btoa']);

// Globals
const core = {
	addon: {
		name: 'NativeShot',
		id: 'NativeShot@jetpack',
		path: {
			name: 'nativeshot',
			content: 'chrome://nativeshot/content/',
			locale: 'chrome://nativeshot/locale/',
			resources: 'chrome://nativeshot/content/resources/',
			images: 'chrome://nativeshot/content/resources/images/'
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	}
};

var PromiseWorker;
var bootstrap = this;
var OSStuff = {};
const NS_HTML = 'http://www.w3.org/1999/xhtml';
const cui_cssUri = Services.io.newURI(core.addon.path.resources + 'cui.css', null, null);
var collCanMonInfos;

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'global.properties?' + Math.random()); /* Randomize URI to work around bug 719376 */ });

function extendCore() {
	// adds some properties i use to core
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			core.os.version = parseFloat(Services.sysinfo.getProperty('version'));
			// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
			if (core.os.version == 6.0) {
				core.os.version_name = 'vista';
			}
			if (core.os.version >= 6.1) {
				core.os.version_name = '7+';
			}
			if (core.os.version == 5.1 || core.os.version == 5.2) { // 5.2 is 64bit xp
				core.os.version_name = 'xp';
			}
			break;
			
		case 'darwin':
			var userAgent = myServices.hph.userAgent;
			//console.info('userAgent:', userAgent);
			var version_osx = userAgent.match(/Mac OS X 10\.([\d\.]+)/);
			//console.info('version_osx matched:', version_osx);
			
			if (!version_osx) {
				throw new Error('Could not identify Mac OS X version.');
			} else {
				var version_osx_str = version_osx[1];
				var ints_split = version_osx[1].split('.');
				if (ints_split.length == 1) {
					core.os.version = parseInt(ints_split[0]);
				} else if (ints_split.length >= 2) {
					core.os.version = ints_split[0] + '.' + ints_split[1];
					if (ints_split.length > 2) {
						core.os.version += ints_split.slice(2).join('');
					}
					core.os.version = parseFloat(core.os.version);
				}
				// this makes it so that 10.10.0 becomes 10.100
				// 10.10.1 => 10.101
				// so can compare numerically, as 10.100 is less then 10.101
				
				//core.os.version = 6.9; // note: debug: temporarily forcing mac to be 10.6 so we can test kqueue
			}
			break;
		default:
			// nothing special
	}
	
	core.os.toolkit = Services.appinfo.widgetToolkit.toLowerCase();
	core.os.xpcomabi = Services.appinfo.XPCOMABI;
	
	core.firefox = {};
	core.firefox.version = Services.appinfo.version;
	
	console.log('done adding to core, it is now:', core);
}

//start obs stuff
var observers = {
	'nativeshot-editor-loaded': { // this trick detects actual load of iframe from bootstrap scope
		observe: function (aSubject, aTopic, aData) {
			obsHandler_nativeshotEditorLoaded(aSubject, aTopic, aData);
		},
		reg: function () {
			Services.obs.addObserver(observers['nativeshot-editor-loaded'], core.addon.id + '_nativeshot-editor-loaded', false);
		},
		unreg: function () {
			Services.obs.removeObserver(observers['nativeshot-editor-loaded'], core.addon.id + '_nativeshot-editor-loaded');
		}
	}
};
//end obs stuff

// START - Addon Functionalities
// start - observer handlers
var collEditorDOMWindows = [];
function obsHandler_nativeshotEditorLoaded(aSubject, aTopic, aData) {
			console.error('yeaaa loaddded');
			
			var aEditorDOMWindow;
			var aEditorFound = false;
			for (var i=0; i<collEditorDOMWindows.length; i++) {
				aEditorDOMWindow = collEditorDOMWindows[i].get();
				if (!aEditorDOMWindow || aEditorDOMWindow.closed) {
					collEditorDOMWindows.splice(i, 1);
					continue;
				}
				if (aEditorDOMWindow.document.readyState == 'complete') {
					collEditorDOMWindows.splice(i, 1);
					aEditorFound = true;
					break;
				}
			}		
	
			if (!aEditorFound) {
				console.error('WARNNNNING could not found editor dom window');
				return;
			}
			
			aEditorDOMWindow.focus();
			var doc = aEditorDOMWindow.document;			
			var can = doc.createElementNS(NS_HTML, 'canvas');
			var ctx = can.getContext('2d');
			
			switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
				case 'winnt':
				case 'winmo':
				case 'wince':
						
						var topLeftMostX = 0;
						var topLeftMostY = 0;
						var fullWidth = 0;
						var fullHeight = 0;
						for (var s=0; s<collCanMonInfos.length; s++) {
							fullWidth += collCanMonInfos[s].nWidth;
							fullHeight += collCanMonInfos[s].nHeight;
							
							if (collCanMonInfos[s].yTopLeft < topLeftMostY) {
								topLeftMostY = collCanMonInfos[s].yTopLeft;
							}
							if (collCanMonInfos[s].xTopLeft < topLeftMostX) {
								topLeftMostX = collCanMonInfos[s].xTopLeft;
							}
						}

						console.info('topLeftMostX:', topLeftMostX, 'topLeftMostY:', topLeftMostY, 'fullWidth:', fullWidth, 'fullHeight:', fullHeight, '_END_');

						can.width = fullWidth; // just a note from left over stuff, i can do collCanMonInfos[s].idat.width now but this tells me some stuff: cannot do `collCanMonInfos.width` because DIB widths are by 4's so it might have padding, so have to use real width
						can.height = fullHeight;

						for (var s=0; s<collCanMonInfos.length; s++) {
							ctx.putImageData(collCanMonInfos[s].idat, collCanMonInfos[s].xTopLeft + Math.abs(topLeftMostX), collCanMonInfos[s].yTopLeft + Math.abs(topLeftMostY));
						}

						aEditorDOMWindow.resizeTo(fullWidth, fullHeight);
						aEditorDOMWindow.moveTo(topLeftMostX, topLeftMostY);
						
					break;
				case 'gtk':
					
						var aHwndStr = aEditorDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIWebNavigation)
										.QueryInterface(Ci.nsIDocShellTreeItem)
										.treeOwner
										.QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIBaseWindow)
										.nativeHandle;

						var promise_makeWinFullAllMon = MainWorker.post('makeWinFullAllMon', [aHwndStr]);
						promise_makeWinFullAllMon.then(
							function(aVal) {
								console.log('Fullfilled - promise_makeWinFullAllMon - ', aVal);
								// start - do stuff here - promise_makeWinFullAllMon
								aEditorDOMWindow.setTimeout(function() {
									aEditorDOMWindow.fullScreen = true;
								}, 1000);
								// end - do stuff here - promise_makeWinFullAllMon
							},
							function(aReason) {
								var rejObj = {name:'promise_makeWinFullAllMon', aReason:aReason};
								console.error('Rejected - promise_makeWinFullAllMon - ', rejObj);
								//deferred_createProfile.reject(rejObj);
							}
						).catch(
							function(aCaught) {
								var rejObj = {name:'promise_makeWinFullAllMon', aCaught:aCaught};
								console.error('Caught - promise_makeWinFullAllMon - ', rejObj);
								//deferred_createProfile.reject(rejObj);
							}
						);
						
						can.width = collCanMonInfos[0].nWidth;
						can.height = collCanMonInfos[0].nHeight;
						
						ctx.putImageData(collCanMonInfos[0].idat, collCanMonInfos[0].xTopLeft, collCanMonInfos[0].yTopLeft);

					break;
				
				case 'darwin':
					
						
					
					break;
				default:
					console.error('os not supported');
			}
			
			ctx.fillStyle = 'rgba(0,0,0,.6)';
			ctx.fillRect(0, 0, can.width, can.height);
			
			can.style.background = '#000 url(' + core.addon.path.images + 'canvas_bg.png) repeat fixed top left'
			
			aEditorDOMWindow.setTimeout(function() {
				console.error('ok appending now');
				//doc.documentElement.appendChild(can);
				//aEditorDOMWindow.fullscreen = true;
			}, 1000);
			
			console.timeEnd('mainthread');
			console.timeEnd('takeShot');
}
// end - observer handlers
var _cache_get_gtk_ctypes; // {lib:theLib, declared:theFunc, TYPE:types}
function get_gtk_ctypes() {
	if (!_cache_get_gtk_ctypes) {
		_cache_get_gtk_ctypes = {
			lib: ctypes.open('libgdk-x11-2.0.so.0'),
			TYPE: {
				GdkPixbuf: ctypes.StructType('GdkPixbuf'),
				GdkDrawable: ctypes.StructType('GdkDrawable'),
				GdkColormap: ctypes.StructType('GdkColormap'),
				int: ctypes.int
			}
		};
		_cache_get_gtk_ctypes.gdk_pixbuf_get_from_drawable = _cache_get_gtk_ctypes.lib.declare('gdk_pixbuf_get_from_drawable', ctypes.default_abi,
			_cache_get_gtk_ctypes.TYPE.GdkPixbuf.ptr,	// return
			_cache_get_gtk_ctypes.TYPE.GdkPixbuf.ptr,	// *dest
			_cache_get_gtk_ctypes.TYPE.GdkDrawable.ptr,	// *src
			_cache_get_gtk_ctypes.TYPE.GdkColormap.ptr,	// *cmap
			_cache_get_gtk_ctypes.TYPE.int,				// src_x
			_cache_get_gtk_ctypes.TYPE.int,				// src_y
			_cache_get_gtk_ctypes.TYPE.int,				// dest_x
			_cache_get_gtk_ctypes.TYPE.int,				// dest_y
			_cache_get_gtk_ctypes.TYPE.int,				// width
			_cache_get_gtk_ctypes.TYPE.int				// height
		);
	}
	return _cache_get_gtk_ctypes;
}

function takeShot(aDOMWin) {
	console.log('taking shot');
	
	console.time('takeShot');
	
	var do_drawToCanvas = function(aVal) {
		// aVal is of form `ImageData { width: 1024, height: 1280, data: Uint8ClampedArray[5242880] }`
		console.timeEnd('chromeworker');
		console.time('mainthread');
		
		collCanMonInfos = aVal;
		
		switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
			case 'winnt':
			case 'winmo':
			case 'wince':
				
					
				
				break;
			case 'gtk':
				
					
				
				break;
			
			case 'darwin':
				
					
				
				break;
			default:
				console.error('os not supported');
		}
		
		var aEditorDOMWindow = Services.ww.openWindow(null, core.addon.path.content + 'panel.xul', '_blank', 'chrome,alwaysRaised,width=100,height=100,screenX=10,screenY=10', null);
		collEditorDOMWindows.push(Cu.getWeakReference(aEditorDOMWindow));
		console.info('aEditorDOMWindow:', aEditorDOMWindow);
	};
	
	if (core.os.toolkit.indexOf('gtk') == 0) {
		var ctypesGTK = get_gtk_ctypes();
		var do_gtkMainThreadStart = function(aVal) {
			var rootGdkDrawable = ctypesGTK.TYPE.GdkDrawable.ptr(ctypes.UInt64(aVal.rootGdkDrawable_strPtr));
			console.info('rootGdkDrawable:', rootGdkDrawable, 'x_orig:', aVal.x_orig, 'y_orig:', aVal.y_orig, 'width:', aVal.width, 'height:', aVal.height, '_END_');
			var screenshot = ctypesGTK.gdk_pixbuf_get_from_drawable(null, rootGdkDrawable, null, aVal.x_orig, aVal.y_orig, 0, 0, aVal.width, aVal.height);
			if (ctypes.errno != 11) {
				console.error('Failed gdk_pixbuf_get_from_drawable, errno:', ctypes.errno);
				throw new Error({
					name: 'os-api-error',
					message: 'Failed gdk_pixbuf_get_from_drawable, errno: "' + ctypes.errno + '" and : "' + rootGdkDrawable.toString(),
					errno: ctypes.errno
				});
			}
						
			ctypesGTK.screenshot = screenshot;
			
			var screenshot_ptrStr = screenshot.toString().match(/.*"(.*?)"/)[1];
			ctypesGTK.screenshot_ptrStr = screenshot_ptrStr;
			
			console.info('screenshot:', screenshot.toString(), 'screenshot_ptrStr:', screenshot_ptrStr);
			
			do_gtkMainThreadFinish(screenshot_ptrStr);
		};
		
		var do_gtkMainThreadFinish = function(aVal) {
			var promise_shootSectGtkWrapUp = MainWorker.post('shootMon', [1, {
				doGtkWrapUp: true,
				screenshot_ptrStr: aVal
			}]);
			promise_shootSectGtkWrapUp.then(
				function(aVal) {
					console.log('Fullfilled - promise_shootSectGtkWrapUp - ', aVal);
					// start - do stuff here - promise_shootSectGtkWrapUp
					// aVal is of form `ImageData { width: 1024, height: 1280, data: Uint8ClampedArray[5242880] }`
					delete ctypesGTK.screenshot;
					delete ctypesGTK.screenshot_ptrStr;
					do_drawToCanvas(aVal);
					// end - do stuff here - promise_shootSectGtkWrapUp
				},
				function(aReason) {
					var rejObj = {name:'promise_shootSectGtkWrapUp', aReason:aReason};
					console.error('Rejected - promise_shootSectGtkWrapUp - ', rejObj);
					Services.prompt.alert(aDOMWin, 'NativeShot - Exception', 'An exception occured while taking screenshot, see Browser Console for more information');
					//deferred_createProfile.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promise_shootSectGtkWrapUp', aCaught:aCaught};
					console.error('Caught - promise_shootSectGtkWrapUp - ', rejObj);
					//deferred_createProfile.reject(rejObj);
					Services.prompt.alert(aDOMWin, 'NativeShot - Error', 'An error occured while taking screenshot, see Browser Console for more information');
				}
			);
		};
	}
	
	console.time('chromeworker');
	var promise_shootSect = MainWorker.post('shootMon', [1]);
	promise_shootSect.then(
		function(aVal) {
			console.log('Fullfilled - promise_shootSect - ', aVal);
			// start - do stuff here - promise_shootSect
			if (core.os.toolkit.indexOf('gtk') == 0) {
				do_gtkMainThreadStart(aVal);
			} else {
				// aVal is of form `ImageData { width: 1024, height: 1280, data: Uint8ClampedArray[5242880] }`
				do_drawToCanvas(aVal);
			}
			// end - do stuff here - promise_shootSect
		},
		function(aReason) {
			var rejObj = {name:'promise_shootSect', aReason:aReason};
			console.warn('Rejected - promise_shootSect - ', rejObj);
			Services.prompt.alert(aDOMWin, 'NativeShot - Exception', 'An exception occured while taking screenshot, see Browser Console for more information');
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_shootSect', aCaught:aCaught};
			console.error('Caught - promise_shootSect - ', rejObj);
			Services.prompt.alert(aDOMWin, 'NativeShot - Error', 'An error occured while taking screenshot, see Browser Console for more information');
		}
	);	
	
}

// END - Addon Functionalities

/*start - windowlistener*/
var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {
		
		// Load into any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				windowListener.loadIntoWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					windowListener.loadIntoWindow(aDOMWindow);
				}, false);
			}
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		/*
		for (var u in unloaders) {
			unloaders[u]();
		}
		*/
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.loadSheet(cui_cssUri, domWinUtils.AUTHOR_SHEET);
		}
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.removeSheet(cui_cssUri, domWinUtils.AUTHOR_SHEET);
		}
	}
};
/*end - windowlistener*/

function install() {}
function uninstall() {}

function startup(aData, aReason) {
	core.addon.aData = aData;
	extendCore();
	
	PromiseWorker = Cu.import(core.addon.path.content + 'modules/PromiseWorker.jsm').BasePromiseWorker;
	
	var promise_getMainWorker = SIPWorker('MainWorker', core.addon.path.content + 'modules/workers/MainWorker.js');
	promise_getMainWorker.then(
		function(aVal) {
			console.log('Fullfilled - promise_getMainWorker - ', aVal);
			// start - do stuff here - promise_getMainWorker
			// end - do stuff here - promise_getMainWorker
		},
		function(aReason) {
			var rejObj = {
				name: 'promise_getMainWorker',
				aReason: aReason
			};
			console.warn('Rejected - promise_getMainWorker - ', rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {
				name: 'promise_getMainWorker',
				aCaught: aCaught
			};
			console.error('Caught - promise_getMainWorker - ', rejObj);
		}
	);
	
	CustomizableUI.createWidget({
		id: 'cui_nativeshot',
		defaultArea: CustomizableUI.AREA_NAVBAR,
		label: myServices.sb.GetStringFromName('cui_nativeshot_lbl'),
		tooltiptext: myServices.sb.GetStringFromName('cui_nativeshot_tip'),
		onCommand: function(aEvent) {
			var aDOMWin = aEvent.target.ownerDocument.defaultView;
			if (aEvent.shiftKey == 1) {
				// default time delay queue
				aDOMWin.setTimeout(function() {
					takeShot(aDOMWin);
				}, 5000);
			} else {
				// imemdiate freeze
				takeShot(aDOMWin);
			}
		}
	});
	
	//windowlistener more
	windowListener.register();
	//end windowlistener more
	
	//start observers stuff more
	for (var o in observers) {
		observers[o].reg();
	}
	//end observers stuff more
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }
	
	CustomizableUI.destroyWidget('cui_nativeshot');
	
	//windowlistener more
	windowListener.unregister();
	//end windowlistener more
	
	//start observers stuff more
	for (var o in observers) {
		observers[o].unreg();
	}
	//end observers stuff more
	
	Cu.unload(core.addon.path.content + 'modules/PromiseWorker.jsm');
	
	if (_cache_get_gtk_ctypes) { // for GTK+
		_cache_get_gtk_ctypes.lib.close();
	}
}

// start - common helper functions
function Deferred() {
	if (Promise && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (PromiseUtils && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else if (Promise) {
		try {
			/* A method to resolve the associated Promise with the value passed.
			 * If the promise is already settled it does nothing.
			 *
			 * @param {anything} value : This value is used to resolve the promise
			 * If the value is a Promise then the associated promise assumes the state
			 * of Promise passed as value.
			 */
			this.resolve = null;

			/* A method to reject the assocaited Promise with the value passed.
			 * If the promise is already settled it does nothing.
			 *
			 * @param {anything} reason: The reason for the rejection of the Promise.
			 * Generally its an Error object. If however a Promise is passed, then the Promise
			 * itself will be the reason for rejection no matter the state of the Promise.
			 */
			this.reject = null;

			/* A newly created Pomise object.
			 * Initially in pending state.
			 */
			this.promise = new Promise(function(resolve, reject) {
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this));
			Object.freeze(this);
		} catch (ex) {
			console.error('Promise not available!', ex);
			throw new Error('Promise not available!');
		}
	} else {
		throw new Error('Promise not available!');
	}
}

function SIPWorker(workerScopeName, aPath, aCore=core) {
	// "Start and Initialize PromiseWorker"
	// returns promise
		// resolve value: jsBool true
	// aCore is what you want aCore to be populated with
	// aPath is something like `core.addon.path.content + 'modules/workers/blah-blah.js'`
	
	// :todo: add support and detection for regular ChromeWorker // maybe? cuz if i do then ill need to do ChromeWorker with callback
	
	var deferredMain_SIPWorker = new Deferred();

	if (!(workerScopeName in bootstrap)) {
		bootstrap[workerScopeName] = new PromiseWorker(aPath);
		
		if ('addon' in aCore && 'aData' in aCore.addon) {
			delete aCore.addon.aData; // we delete this because it has nsIFile and other crap it, but maybe in future if I need this I can try JSON.stringify'ing it
		}
		
		var promise_initWorker = bootstrap[workerScopeName].post('init', [aCore]);
		promise_initWorker.then(
			function(aVal) {
				console.log('Fullfilled - promise_initWorker - ', aVal);
				// start - do stuff here - promise_initWorker
				deferredMain_SIPWorker.resolve(true);
				// end - do stuff here - promise_initWorker
			},
			function(aReason) {
				var rejObj = {name:'promise_initWorker', aReason:aReason};
				console.warn('Rejected - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initWorker', aCaught:aCaught};
				console.error('Caught - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		);
		
	} else {
		deferredMain_SIPWorker.reject('Something is loaded into bootstrap[workerScopeName] already');
	}
	
	return deferredMain_SIPWorker.promise;
	
}
// end - common helper functions