'use strict';

// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('resource://gre/modules/workers/require.js');

// Globals
const core = { // have to set up the main keys that you want when aCore is merged from mainthread in init
	addon: {
		path: {
			content: 'chrome://nativeshot/content/',
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	},
	firefox: {}
};

var OSStuff = {}; // global vars populated by init, based on OS

// Imports that use stuff defined in chrome
// I don't import ostypes_*.jsm yet as I want to init core first, as they use core stuff like core.os.isWinXP etc
// imported scripts have access to global vars on MainWorker.js
importScripts(core.addon.path.content + 'modules/cutils.jsm');
importScripts(core.addon.path.content + 'modules/ctypes_math.jsm');

// Setup PromiseWorker
var PromiseWorker = require(core.addon.path.content + 'modules/workers/PromiseWorker.js');

var worker = new PromiseWorker.AbstractWorker();
worker.dispatch = function(method, args = []) {
	return self[method](...args);
},
worker.postMessage = function(...args) {
	self.postMessage(...args);
};
worker.close = function() {
	self.close();
};
worker.log = function(...args) {
	dump('Worker: ' + args.join(' ') + '\n');
};
self.addEventListener('message', msg => worker.handleMessage(msg));

////// end of imports and definitions

function init(objCore) {

	
	// merge objCore into core
	// core and objCore is object with main keys, the sub props
	
	for (var p in objCore) {
		/* // cant set things on core as its const
		if (!(p in core)) {
			core[p] = {};
		}
		*/
		
		for (var pp in objCore[p]) {
			core[p][pp] = objCore[p][pp];
		}
	}

	// if (core.os.toolkit == 'gtk2') {
		// core.os.name = 'gtk';
	// }
	
	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.content + 'modules/ostypes_win.jsm');
			break
		case 'gtk':
			importScripts(core.addon.path.content + 'modules/ostypes_x11.jsm');
			break;
		case 'darwin':
			importScripts(core.addon.path.content + 'modules/ostypes_mac.jsm');
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
	// OS Specific Init
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				OSStuff.hiiii = true;
				
			break;
		case 'gtk':
				
				// ostypes.API('gdk_threads_init')();
				
			break;
		default:
			// do nothing special
	}
	
	return true;
}

// Start - Addon Functionality
function setWinAlwaysOnTop(aArrHwndPtrStr, aOptions) {
	// aArrHwndPtrStr is an array of multiple hwnds, each of them will get set to always on top
	// aOptions holds keys that are hwndPtrStr in aArr and hold params like, left, right, top, left needed for x11 strut partial stuff OR for SetWindowPos for winapi
	/* example:
		aArrHwndPtrStr = ['0x1234', '0x999'];
		aOptions = {
			'0x1234': {left:0, top:0, ...},
			'0x999': {left:0, top:0, ...}
		}
	*/
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
			
				
				for (var i=0; i<aArrHwndPtrStr.length; i++) {

					var hwndPtr = ostypes.TYPE.HWND.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					
					//var rez_setTop = ostypes.API('SetWindowPos')(aHwnd, ostypes.CONST.HWND_TOPMOST, aOptions[aArrHwndPtrStr[i]].left, aOptions[aArrHwndPtrStr[i]].top, aOptions[aArrHwndPtrStr[i]].width, aOptions[aArrHwndPtrStr[i]].height, ostypes.CONST.SWP_NOSIZE | ostypes.CONST.SWP_NOMOVE | ostypes.CONST.SWP_NOREDRAW);
					var rez_setTop = ostypes.API('SetWindowPos')(hwndPtr, ostypes.CONST.HWND_TOPMOST, 0, 0, 0, 0, ostypes.CONST.SWP_NOSIZE | ostypes.CONST.SWP_NOMOVE/* | ostypes.CONST.SWP_NOREDRAW*/); // window wasnt moved so no need for SWP_NOREDRAW, the NOMOVE and NOSIZE params make it ignore x, y, cx, and cy

				}
				
			break;
		case 'gtk':
				
				// http://stackoverflow.com/a/4347486/5062337
				// do this stuff up here as if it doesnt exist it will throw now, rather then go through set allocate xevent then find out when setting xevent.xclient data that its not available
				var atom_wmStateAbove = ostypes.HELPER.cachedAtom('_NET_WM_STATE_ABOVE');
				var atom_wmState = ostypes.HELPER.cachedAtom('_NET_WM_STATE');

				
				for (var i=0; i<aArrHwndPtrStr.length; i++) {

					var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					
					var xevent = ostypes.TYPE.XEvent();

					
					xevent.xclient.type = ostypes.CONST.ClientMessage;
					xevent.xclient.serial = 0;
					xevent.xclient.send_event = ostypes.CONST.True;
					xevent.xclient.display = ostypes.HELPER.cachedXOpenDisplay();
					xevent.xclient.window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					xevent.xclient.message_type = atom_wmState;
					xevent.xclient.format = 32; // because xclient.data is long, i defined that in the struct union
					xevent.xclient.data = ostypes.TYPE.long.array(5)([ostypes.CONST._NET_WM_STATE_ADD, atom_wmStateAbove, 0, 0, 0]);
					


					
					var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top

				}
				
				ostypes.API('XFlush')(ostypes.HELPER.cachedXOpenDisplay()); // will not set on top if you dont do this
				
				/*
				for (var i=0; i<aArrHwndPtrStr.length; i++) {

					var gdkWinPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					var gtkWinPtr = ostypes.HELPER.gdkWinPtrToGtkWinPtr(gdkWinPtr);
					ostypes.API('gtk_window_set_keep_above')(gtkWinPtr, 1);
				}
				*/
				
				/*
				// try changing STRUT and STRUT_PARTIAL
				var atom_wmStrut = ostypes.HELPER.cachedAtom('_NET_WM_STRUT_PARTIAL');
				var atom_wmStrutPartial = ostypes.HELPER.cachedAtom('_NET_WM_STRUT_PARTIAL');
				
				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					var Window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					
					var dataJS = [
						0,
						0,
						0,
						0
					];
					var dataC = ostypes.TYPE.unsigned_long.array(dataJS.length)(dataJS);
					var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
					var dataFormat = 32; // cuz unsigned_long
					var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), atom_wmStrut, ostypes.CONST.XA_CARDINAL, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);

				}
				*/
				/*
				// try changing WM_WINDOW_TYPE properties
				var atom_wmWindowType = ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE');
				var atom_wmWindowTypeDock = ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE_DOCK');
				
				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					var Window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					
					var dataJS = [
						atom_wmWindowTypeDock
					];
					var dataC = ostypes.TYPE.Atom.array(dataJS.length)(dataJS);
					var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
					var dataFormat = 32; // cuz unsigned_long
					var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), atom_wmWindowType, ostypes.CONST.XA_ATOM, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);

				}
				*/
				/*
				// try changing WM_STATE properties
				var atom_wmWmState = ostypes.HELPER.cachedAtom('_NET_WM_STATE');
				var atom_wmStateAbove = ostypes.HELPER.cachedAtom('_NET_WM_STATE_ABOVE');
				var atom_wmStateFullscreen = ostypes.HELPER.cachedAtom('_NET_WM_STATE_FULLSCREEN');
				var atom_wmStateAttn = ostypes.HELPER.cachedAtom('_NET_WM_STATE_DEMANDS_ATTENTION');;
				
				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					var Window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					
					var dataJS = [
						atom_wmStateAbove,
						atom_wmStateFullscreen,
						atom_wmStateAttn
					];
					var dataC = ostypes.TYPE.unsigned_long.array(dataJS.length)(dataJS);
					var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
					var dataFormat = 32; // cuz unsigned_long
					var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), atom_wmState, ostypes.CONST.XA_ATOM, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);

				}
				*/
			break;
		case 'darwin':
				
				/*
				// for (var i=0; i<aArrHwndPtrStr.length; i++) {

				// 	var aNSWindow = ctypes.voidptr_t(ctypes.UInt64(aArrHwndPtrStr[i]));

				// 	var nil = ctypes.voidptr_t(ctypes.UInt64('0x0')); // due to 3rd arg of objc_msgSend being variadic i have to set type, i cant just pass null
				// 	var rez_orderFront = ostypes.API('objc_msgSend')(aNSWindow, ostypes.HELPER.sel('windowNumber'));

				// }
				
				// METHOD: performSelectorOnMainThread:withObject:waitUntilDone:
				
				// make a class to hold my methods:
				var needsRegistration; // meaning registerClassPair, alloc, and init will be called and stored
				// unregister, unalloc, etc all `OSSTuff.setWinAlwaysOnTop_****` and delete js key pairs from OSStuff if you want it re-registered later on
				
				var NSObject = ostypes.HELPER.class('NSObject');
				
				if (!OSStuff.setWinAlwaysOnTop_class) {
					throw new Error('setWinAlwaysOnTop_class was not previously cleaned up!!')
				}
				// if (!OSStuff.setWinAlwaysOnTop_class) {
					var needsRegistration = true;
					OSStuff.setWinAlwaysOnTop_class = ostypes.API('objc_allocateClassPair')(NSObject, 'setWinAlwaysOnTop_class', 0);
					if (OSStuff.setWinAlwaysOnTop_class.isNull()) {

						throw new Error('setWinAlwaysOnTop_class is null, so objc_allocateClassPair failed');
					}
				// } else {

					// needsRegistration = false;
				// }
								
				OSStuff.setWinAlwaysOnTop_jsMethods = {}; // holds key of aArrHwndPtrStr and value is js method
				
				var IMP_for_mainThreadSelector = ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, []);
				
				OSStuff.setWinAlwaysOnTop_jsMethods[aArrHwndPtrStr[0]] = function() {

					// delete OSStuff.setWinAlwaysOnTop_jsMethods[aArrHwndPtrStr[0]]; // cuz i made this single shots // i should delete class when no more methods are left
					// delete OSStuff.setWinAlwaysOnTop_cMethods[aArrHwndPtrStr[0]]; // cuz i made this single shots // i should delete class when no more methods are left
				};
				
				OSStuff.setWinAlwaysOnTop_cMethods = {};
				OSStuff.setWinAlwaysOnTop_cMethods[aArrHwndPtrStr[0]] = IMP_for_mainThreadSelector.ptr(OSStuff.setWinAlwaysOnTop_jsMethods[aArrHwndPtrStr[0]]);
				
				OSStuff.setWinAlwaysOnTop_methodSelectors = {};
				OSStuff.setWinAlwaysOnTop_methodSelectors[aArrHwndPtrStr[0]] = ostypes.API('sel_registerName')(aArrHwndPtrStr[0]);
				
				var rez_class_addMethod = ostypes.API('class_addMethod')(OSStuff.setWinAlwaysOnTop_class, OSStuff.setWinAlwaysOnTop_methodSelectors[aArrHwndPtrStr[0]], OSStuff.setWinAlwaysOnTop_cMethods[aArrHwndPtrStr[0]], 'v');
				
				if (needsRegistration) {
					ostypes.API('objc_registerClassPair')(OSStuff.setWinAlwaysOnTop_class);				
					OSStuff.setWinAlwaysOnTop_allocation = ostypes.API('objc_msgSend')(OSStuff.setWinAlwaysOnTop_class, ostypes.HELPER.sel('alloc'));
					OSStuff.setWinAlwaysOnTop_instance = ostypes.API('objc_msgSend')(OSStuff.setWinAlwaysOnTop_allocation, ostypes.HELPER.sel('init'));
				}
				
				var rez_perform = ostypes.API('objc_msgSend')(OSStuff.setWinAlwaysOnTop_instance, ostypes.HELPER.sel('performSelectorOnMainThread:withObject:waitUntilDone:'), ostypes.HELPER.sel(aArrHwndPtrStr[0]), ostypes.CONST.NIL, ostypes.CONST.YES);

				
				// after all callbacks done then clean up class
				// ostypes.API('objc_msgSend')(OSStuff.setWinAlwaysOnTop_instance, ostypes.HELPER.sel('release'));
				// ostypes.API('objc_disposeClassPair')(OSStuff.setWinAlwaysOnTop_class);
				// delete OSStuff.setWinAlwaysOnTop_cMethods
				// delete OSStuff.setWinAlwaysOnTop_jsMethods
				// delete OSStuff.setWinAlwaysOnTop_allocation
				// delete OSStuff.setWinAlwaysOnTop_instance
				// delete OSStuff.setWinAlwaysOnTop_class
				
				*/
				
				/*
				// METHOD: dispatch_async( dispatch_get_main_queue(), ^(void)
				var rez_mainQ = ostypes.API('dispatch_get_main_queue'); // do not do () on this one

				
				OSStuff.js_cb = function() {

					return undefined;
				};
				
				OSStuff.c_cb = ostypes.TYPE.dispatch_block_t(OSStuff.js_cb);
				
				ostypes.API('dispatch_sync')(rez_mainQ, OSStuff.c_cb);
				*/
				/*
				// METHOD: perform no js method
				var aNSWindow = ctypes.voidptr_t(ctypes.UInt64(aArrHwndPtrStr[0]));
				var rez_perform = ostypes.API('objc_msgSend')(aNSWindow, ostypes.HELPER.sel('performSelectorOnMainThread:withObject:waitUntilDone:'), ostypes.HELPER.sel('orderFront:'), ostypes.CONST.NIL, ostypes.CONST.YES);
				*/
				
				/*
				// METHOD: do on main thread with this key
				var rez_getKey = ostypes.API('CGWindowLevelForKey')(ostypes.CONST.kCGDockWindowLevelKey);

				return parseInt(cutils.jscGetDeepest(rez_getKey));
				*/
				
				// METHOD: dont set on top just focus app, this has that ugly scroll side affect if user is focused on another desktop on that monitor due to full screen app or something
				focusSelfApp();
				
			break;
		default:

	}
}

function focusWindows(aArrHwndPtrStr) {
	// aArrHwndPtrStr is an array of hwnd's and the windows in it will be focused in order
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
			
				
				
				
			break;
		case 'gtk':
				
				
				
			break;
		case 'darwin':
				
				
				
			break;
		default:

	}
}

function focusSelfApp() {
	// makes the firefox you run this code from the active app, like brings it forward
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
			
				
				
				
			break;
		case 'gtk':
				
				
				
			break;
		case 'darwin':
				
				var NSApplication = ostypes.HELPER.class('NSApplication');
				var sharedApplication = ostypes.HELPER.sel('sharedApplication');
				var NSApp = ostypes.API('objc_msgSend')(NSApplication, sharedApplication);
				
				// [NSApp activateIgnoringOtherApps:YES];
				var rez_actIgOthrApps = ostypes.API('objc_msgSend')(NSApp, ostypes.HELPER.sel('activateIgnoringOtherApps:'), ostypes.CONST.YES);

				
			break;
		default:

	}
}

var gTimer;
function shootAllMons() {
	
	var collMonInfos = [];
	if (gTimer) {
		clearTimeout(gTimer);
	}
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
		
				// start - get all monitor resolutions
				var iDevNum = -1;
				while (true) {
					iDevNum++;
					var lpDisplayDevice = ostypes.TYPE.DISPLAY_DEVICE();
					lpDisplayDevice.cb = ostypes.TYPE.DISPLAY_DEVICE.size;
					var rez_EnumDisplayDevices = ostypes.API('EnumDisplayDevices')(null, iDevNum, lpDisplayDevice.address(), 0);

					
					if (cutils.jscEqual(rez_EnumDisplayDevices, 0)) { // ctypes.winLastError != 0
						// iDevNum is greater than the largest device index.
						break;
					}
					
					var StateFlags = parseInt(cutils.jscGetDeepest(lpDisplayDevice.StateFlags));
					

					if (StateFlags & ostypes.CONST.DISPLAY_DEVICE_MIRRORING_DRIVER) {
						// skip this one, its a mirror monitor (like vnc or webex)
					} else if (StateFlags & ostypes.CONST.DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) {

						
						var dm = ostypes.TYPE.DEVMODE(); // SIZEOF_DEVMODE = 220 on 32bit fx Win8.1 64bit when I do insepction though dm.size is set to 188

						//dm.dmFields = ostypes.CONST.DM_PELSWIDTH;
						//dm.dmSize = ostypes.TYPE.DEVMODE.size;


						var rez_EnumDisplaySettings = ostypes.API('EnumDisplaySettings')(lpDisplayDevice.DeviceName, ostypes.CONST.ENUM_CURRENT_SETTINGS, dm.address());


						


						
						collMonInfos.push({
							x: parseInt(cutils.jscGetDeepest(dm.u.dmPosition.x)),
							y: parseInt(cutils.jscGetDeepest(dm.u.dmPosition.y)),
							w: parseInt(cutils.jscGetDeepest(dm.dmPelsWidth)),
							h: parseInt(cutils.jscGetDeepest(dm.dmPelsHeight)),
							screenshot: null, // for winnt, each collMonInfos entry has screenshot data
							otherInfo: {
								nBPP: parseInt(cutils.jscGetDeepest(dm.dmBitsPerPel)),
								lpszDriver: null,
								lpszDevice: lpDisplayDevice.DeviceName
							}
						});
						
						if (StateFlags & ostypes.CONST.DISPLAY_DEVICE_PRIMARY_DEVICE) {
							collMonInfos[collMonInfos.length-1].primary = true;
						}
					}
				}
				// end - get all monitor resolutions
		
				// start - take shot of each monitor
				for (var s=0; s<collMonInfos.length; s++) {

					var hdcScreen = ostypes.API('CreateDC')(collMonInfos[s].otherInfo.lpszDriver, collMonInfos[s].otherInfo.lpszDevice, null, null);

					if (ctypes.winLastError != 0) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcScreen, winLastError: "' + ctypes.winLastError + '" and hdcScreen: "' + hdcScreen.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					if (core.os.version >= 6.3) { // for scale purposes for non dpi aware process due to bug 890156
						collMonInfos[s].otherInfo.scaledWidth = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.HORZRES)));
						collMonInfos[s].otherInfo.scaledHeight = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.VERTRES)));
						var win81ScaleX = collMonInfos[s].w / collMonInfos[s].otherInfo.scaledWidth;
						var win81ScaleY = collMonInfos[s].h / collMonInfos[s].otherInfo.scaledHeight;
						if (win81ScaleX != 1) {
							collMonInfos[s].win81ScaleX = win81ScaleX;
						}
						if (win81ScaleY != 1) {
							collMonInfos[s].win81ScaleY = win81ScaleY;
						}
					}
					
					var w = collMonInfos[s].w;
					var h = collMonInfos[s].h;

					var modW = w % 4;
					var useW = modW != 0 ? w + (4-modW) : w;

					
					var arrLen = useW * h * 4;
					var imagedata = new ImageData(useW, h);
					
					var hdcMemoryDC = ostypes.API('CreateCompatibleDC')(hdcScreen); 

					if (ctypes.winLastError != 0) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcMemoryDC, winLastError: "' + ctypes.winLastError + '" and hdcMemoryDC: "' + hdcMemoryDC.toString(),
							winLastError: ctypes.winLastError
						});
					}


					// CreateDIBSection stuff
					var bmi = ostypes.TYPE.BITMAPINFO();
					bmi.bmiHeader.biSize = ostypes.TYPE.BITMAPINFOHEADER.size;
					bmi.bmiHeader.biWidth = w;
					bmi.bmiHeader.biHeight = -1 * h; // top-down
					bmi.bmiHeader.biPlanes = 1;
					bmi.bmiHeader.biBitCount = collMonInfos[s].otherInfo.nBPP; // 32
					bmi.bmiHeader.biCompression = ostypes.CONST.BI_RGB;
					// bmi.bmiHeader.biXPelsPerMeter = dpiX;
					// bmi.bmiHeader.biYPelsPerMeter = dpiY;
					
					// delete collMonInfos[s].nBPP; // mainthread has no more need for this
					
					var pixelBuffer = ostypes.TYPE.BYTE.ptr();

					// CreateDIBSection stuff
					
					var hbmp = ostypes.API('CreateDIBSection')(hdcScreen, bmi.address(), ostypes.CONST.DIB_RGB_COLORS, pixelBuffer.address(), null, 0); 
					if (hbmp.isNull()) { // do not check winLastError when using v5, it always gives 87 i dont know why, but its working

						throw new Error({
							name: 'os-api-error',
							message: 'Failed hbmp, winLastError: "' + ctypes.winLastError + '" and hbmp: "' + hbmp.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var rez_SO = ostypes.API('SelectObject')(hdcMemoryDC, hbmp);

					if (ctypes.winLastError != 0) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_SO, winLastError: "' + ctypes.winLastError + '" and rez_SO: "' + rez_SO.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var rez_BB = ostypes.API('BitBlt')(hdcMemoryDC, 0, 0, w, h, hdcScreen, 0, 0, ostypes.CONST.SRCCOPY);

					if (ctypes.winLastError != 0) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_BB, winLastError: "' + ctypes.winLastError + '" and rez_BB: "' + rez_BB.toString(),
							winLastError: ctypes.winLastError
						});
					}
					

					

					ostypes.API('memcpy')(imagedata.data, pixelBuffer, arrLen);

					
					// swap bytes to go from BRGA to RGBA
					// Reorganizing the byte-order is necessary as canvas can only hold data in RGBA format (little-endian, ie. ABGR in the buffer). Here is one way to do this:

					var dataRef = imagedata.data;
					var pos = 0;
					while (pos < arrLen) {
						var B = dataRef[pos];

						dataRef[pos] = dataRef[pos+2];
						dataRef[pos+2] = B;

						pos += 4;
					}

					
					collMonInfos[s].screenshot = imagedata;
					
					// release memory of screenshot stuff
					//delete collMonInfos[s].otherInfo;
					// lpDisplayDevice = null;
					dm = null;
					// imagedata = null;
					
					var rez_DelDc1 = ostypes.API('DeleteDC')(hdcScreen);

					
					var rez_DelDc2 = ostypes.API('DeleteDC')(hdcMemoryDC);

					
					var rez_DelObj1 = ostypes.API('DeleteObject')(hbmp);

				}
				
				// end - take shot of each monitor
		
				/*
				// get dpi for all monitors so can draw to canvas properly:
				var jsMonitorEnumProc = function(hMonitor, hdcMonitor, lprcMonitor, dwData) {

					// rezArr.push({
						// xTopLeft: parseInt(cutils.jscGetDeepest(lprcMonitor.contents.left)),
						// yTopLeft: parseInt(cutils.jscGetDeepest(lprcMonitor.contents.top))
					// });
					// rezArr[rezArr.length - 1].nWidth = parseInt(cutils.jscGetDeepest(lprcMonitor.contents.right)) - rezArr[rezArr.length - 1].xTopLeft;
					// rezArr[rezArr.length - 1].nHeight = parseInt(cutils.jscGetDeepest(lprcMonitor.contents.bottom)) - rezArr[rezArr.length - 1].yTopLeft;
					
					// get device name
					var cMonInfo = ostypes.TYPE.MONITORINFOEX();
					cMonInfo.cbSize = ostypes.TYPE.MONITORINFOEX.size;
					var rez_GetMonitorInfo = ostypes.API('GetMonitorInfo')(hMonitor, cMonInfo.address());

					if (cutils.jscEqual(rez_GetMonitorInfo, 0)) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_GetMonitorInfo, winLastError: "' + ctypes.winLastError + '" and rez_GetMonitorInfo: "' + rez_GetMonitorInfo.toString(),
							winLastError: ctypes.winLastError
						});
					}
					// rezArr[rezArr.length-1].argsCreateDC = {
						// lpszDriver: null,
						// lpszDevice: cMonInfo.szDevice
					// };
					
					var dpiX = ostypes.TYPE.UINT();
					var dpiY = ostypes.TYPE.UINT();
					var rez_GetDPI = ostypes.API('GetDpiForMonitor')(hMonitor, ostypes.CONST.MDT_Raw_DPI, dpiX.address(), dpiY.address());



					
					var foundLPSZ = false;
					for (var z=0; z<collMonInfos.length; z++) {
						if (collMonInfos[z].otherInfo.lpszDevice.toString() == cMonInfo.szDevice.toString()) {
							foundLPSZ = true;
							collMonInfos[z].dpiX = parseInt(cutils.jscGetDeepest(dpiX));
							collMonInfos[z].dpiY = parseInt(cutils.jscGetDeepest(dpiY));
							break;
						}
					}
					if (!foundLPSZ) {

					}
					return true; // continue enumeration
				}
				var cMonitorEnumProc = ostypes.TYPE.MONITORENUMPROC.ptr(jsMonitorEnumProc);
				var rez_EnumDisplayMonitors = ostypes.API('EnumDisplayMonitors')(null, null, cMonitorEnumProc, 0);
				*/
				

				for (var i=0; i<collMonInfos.length; i++) {
					delete collMonInfos[i].otherInfo;

				}
				
			break;
		case 'gtk':

				// start - get all monitor resolutions
				var screen = ostypes.API('XRRGetScreenResources')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(ostypes.HELPER.cachedXOpenDisplay()));


				var noutputs = parseInt(cutils.jscGetDeepest(screen.contents.noutput));


				var screenOutputs = ctypes.cast(screen.contents.outputs, ostypes.TYPE.RROutput.array(noutputs).ptr).contents;
				for (var i=noutputs-1; i>=0; i--) {
					var info = ostypes.API('XRRGetOutputInfo')(ostypes.HELPER.cachedXOpenDisplay(), screen, screenOutputs[i]);
					if (cutils.jscEqual(info.connection, ostypes.CONST.RR_Connected)) {
						var ncrtcs = parseInt(cutils.jscGetDeepest(info.contents.ncrtc));
						var infoCrtcs = ctypes.cast(info.contents.crtcs, ostypes.TYPE.RRCrtc.array(ncrtcs).ptr).contents;
						for (var j=ncrtcs-1; j>=0; j--) {
							var crtc_info = ostypes.API('XRRGetCrtcInfo')(ostypes.HELPER.cachedXOpenDisplay(), screen, infoCrtcs[j]);


							collMonInfos.push({
								x: parseInt(cutils.jscGetDeepest(crtc_info.contents.x)),
								y: parseInt(cutils.jscGetDeepest(crtc_info.contents.y)),
								w: parseInt(cutils.jscGetDeepest(crtc_info.contents.width)),
								h: parseInt(cutils.jscGetDeepest(crtc_info.contents.height)),
								screenshot: null // for gtk, i take the big canvas and protion to each mon
							});

							ostypes.API('XRRFreeCrtcInfo')(crtc_info);
						}
					}
					ostypes.API('XRRFreeOutputInfo')(info);
				}
				ostypes.API('XRRFreeScreenResources')(screen);

				var monStrs = [];
				for (var i=0; i<collMonInfos.length; i++) {
					if (!collMonInfos[i].w || !collMonInfos[i].h)  {// test if 0 width height
						collMonInfos.splice(i, 1);
						i--;
					} else {
						var monStr = collMonInfos[i].w + 'x' + collMonInfos[i].h + '+' + collMonInfos[i].x + '+' + collMonInfos[i].y;
						if (monStrs.indexOf(monStr) == -1) {
							monStrs.push(monStr);
						} else {
							collMonInfos.splice(i, 1);
							i--;
						}
					}
				}

				// end - get all monitor resolutions
				
				// start - take shot of all monitors and push to just first element of collMonInfos
				// https://github.com/BoboTiG/python-mss/blob/a4d40507c492962d59fcb97a509ede1f4b8db634/mss.py#L116

				// enum_display_monitors
				// this call to XGetWindowAttributes grab one screenshot of all monitors
				var gwa = ostypes.TYPE.XWindowAttributes();
				var rez_XGetWinAttr = ostypes.API('XGetWindowAttributes')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), gwa.address());

				
				var fullWidth = parseInt(cutils.jscGetDeepest(gwa.width));
				var fullHeight = parseInt(cutils.jscGetDeepest(gwa.height));
				var originX = parseInt(cutils.jscGetDeepest(gwa.x));
				var originY = parseInt(cutils.jscGetDeepest(gwa.y));
				

				
				// get_pixels
				var allplanes = ostypes.API('XAllPlanes')();

				
				var ZPixmap = 2;

				var ximage = ostypes.API('XGetImage')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), originX, originY, fullWidth, fullHeight, allplanes, ZPixmap);


				var fullLen = 4 * fullWidth * fullHeight;
				

				var imagedata = new ImageData(fullWidth, fullHeight);



				ostypes.API('memcpy')(imagedata.data.buffer, ximage.contents.data, fullLen);

				
				var iref = imagedata.data;
				
				/*

				for (var i=0; i<fullLen; i=i+4) {
					var B = iref[i];
					iref[i] = iref[i+2];
					iref[i+2] = B;
				}

				*/
				// end - take shot of all monitors and push to just first element of collMonInfos
				
				// start - because took a single screenshot of alllll put togather, lets portion out the imagedata

				for (var i=0; i<collMonInfos.length; i++) {
					var screenUseW = collMonInfos[i].w;
					var screenUseH = collMonInfos[i].h;
					

					var screnImagedata = new ImageData(screenUseW, screenUseH);
					var siref = screnImagedata.data;
					
					var si = 0;
					for (var y=collMonInfos[i].y; y<collMonInfos[i].y+screenUseH; y++) {
						for (var x=collMonInfos[i].x; x<collMonInfos[i].x+screenUseW; x++) {
							var pix1 = (fullWidth*y*4) + (x * 4);
							var B = iref[pix1];
							siref[si] = iref[pix1+2];
							siref[si+1] = iref[pix1+1];
							siref[si+2] = B;
							siref[si+3] = 255;
							si += 4;
						}
					}
					collMonInfos[i].screenshot = screnImagedata;
				}

				// end - because took a single screenshot of alllll put togather, lets portion out the imagedata
			
			break;
		case 'darwin':
				
				// start - get monitor resolutions
				var displays = ostypes.TYPE.CGDirectDisplayID.array(32)(); // i guess max possible monitors is 32
				var count = ostypes.TYPE.uint32_t();


				
				var maxDisplays = displays.constructor.size / ostypes.TYPE.CGDirectDisplayID.size;
				var activeDspys = displays; // displays.address() didnt work it threw `expected type pointer, got ctypes.uint32_t.array(32).ptr(ctypes.UInt64("0x11e978080"))` // the arg in declare is `self.TYPE.CGDirectDisplayID.ptr,	// *activeDisplays` // without .address() worked
				var dspyCnt = count.address();

				
				var rez_CGGetActiveDisplayList = ostypes.API('CGGetActiveDisplayList')(maxDisplays, activeDspys, dspyCnt);

				if (!cutils.jscEqual(rez_CGGetActiveDisplayList, ostypes.CONST.kCGErrorSuccess)) {

					throw new Error({
						name: 'os-api-error',
						message: 'Failed , errno: "' + ctypes.errno + '" and : "' + rez_CGGetActiveDisplayList.toString(),
						errno: ctypes.errno
					});
				}
				
				count = parseInt(cutils.jscGetDeepest(count));

				var i_nonMirror = {};
				
				var rect = ostypes.CONST.CGRectNull;

				for (var i=0; i<count; i++) {
					// if display is secondary mirror of another display, skip it

					
					var rez_CGDisplayMirrorsDisplay = ostypes.API('CGDisplayMirrorsDisplay')(displays[i]);					


					if (!cutils.jscEqual(rez_CGDisplayMirrorsDisplay, ostypes.CONST.kCGNullDirectDisplay)) { // If CGDisplayMirrorsDisplay() returns 0 (a.k.a. kCGNullDirectDisplay), then that means the display is not mirrored.
						continue;
					}
					i_nonMirror[i] = null;
					
					var rez_CGDisplayBounds = ostypes.API('CGDisplayBounds')(displays[i]);

					
					collMonInfos.push({
						x: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.origin.x)),
						y: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.origin.y)),
						w: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.size.width)),
						h: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.size.height)),
						screenshot: null // for darwin, i take the big canvas and protion to each mon
					});
					
					rect = ostypes.API('CGRectUnion')(rect, rez_CGDisplayBounds);

				}
				// start - get monitor resolutions
				
				// start - take one big screenshot of all monitors
				if (Object.keys(i_nonMirror).length == 0) {
					// what on earth, no monitors that arent mirrors?
					return []; // as there is nothing to screenshot
				}
				
				/*
				NSBitmapImageRep* imageRep = [[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL
                                                                         pixelsWide:CGRectGetWidth(rect)
                                                                         pixelsHigh:CGRectGetHeight(rect)
                                                                      bitsPerSample:8
                                                                    samplesPerPixel:4
                                                                           hasAlpha:YES
                                                                           isPlanar:NO
                                                                     colorSpaceName:NSCalibratedRGBColorSpace
                                                                       bitmapFormat:0
                                                                        bytesPerRow:0
                                                                       bitsPerPixel:32];
				*/
				var myNSStrings;
				var allocNSBIP;
				try {
					myNSStrings = new ostypes.HELPER.nsstringColl();
					
					var rez_width = ostypes.API('CGRectGetWidth')(rect);

					
					var rez_height = ostypes.API('CGRectGetHeight')(rect);

					
					var NSBitmapImageRep = ostypes.HELPER.class('NSBitmapImageRep');
					allocNSBIP = ostypes.API('objc_msgSend')(NSBitmapImageRep, ostypes.HELPER.sel('alloc'));

		
					var imageRep = ostypes.API('objc_msgSend')(allocNSBIP, ostypes.HELPER.sel('initWithBitmapDataPlanes:pixelsWide:pixelsHigh:bitsPerSample:samplesPerPixel:hasAlpha:isPlanar:colorSpaceName:bitmapFormat:bytesPerRow:bitsPerPixel:'),  // https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ApplicationKit/Classes/NSBitmapImageRep_Class/index.html#//apple_ref/occ/instm/NSBitmapImageRep/initWithBitmapDataPlanes:pixelsWide:pixelsHigh:bitsPerSample:samplesPerPixel:hasAlpha:isPlanar:colorSpaceName:bitmapFormat:bytesPerRow:bitsPerPixel:
						ostypes.TYPE.unsigned_char.ptr.ptr(null),								// planes
						ostypes.TYPE.NSInteger(rez_width),										// pixelsWide
						ostypes.TYPE.NSInteger(rez_height),										// pixelsHigh
						ostypes.TYPE.NSInteger(8),												// bitsPerSample
						ostypes.TYPE.NSInteger(4),												// samplesPerPixel
						ostypes.CONST.YES,														// hasAlpha
						ostypes.CONST.NO,														// isPlanar
						myNSStrings.get('NSCalibratedRGBColorSpace'),							// colorSpaceName
						ostypes.TYPE.NSBitmapFormat(0),											// bitmapFormat
						ostypes.TYPE.NSInteger(4 * rez_width),												// bytesPerRow
						ostypes.TYPE.NSInteger(32)												// bitsPerPixel
					);

					if (imageRep.isNull()) { // im guessing this is how to error check it
						throw new Error({
							name: 'os-api-error',
							message: 'Failed imageRep, errno: "' + ctypes.errno + '" and : "' + imageRep.toString(),
							errno: ctypes.errno
						});
					}
					
					// NSGraphicsContext* context = [NSGraphicsContext graphicsContextWithBitmapImageRep:imageRep];
					var NSGraphicsContext = ostypes.HELPER.class('NSGraphicsContext');
					var context = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('graphicsContextWithBitmapImageRep:'), imageRep);

					if (context.isNull()) { // im guessing this is how to error check it
						throw new Error({
							name: 'os-api-error',
							message: 'Failed context, errno: "' + ctypes.errno + '" and : "' + context.toString(),
							errno: ctypes.errno
						});
					}
					
					// [NSGraphicsContext saveGraphicsState];
					var rez_saveGraphicsState = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('saveGraphicsState'));

					
					// [NSGraphicsContext setCurrentContext:context];
					var rez_setCurrentContext = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('setCurrentContext:'), context);

					
					// CGContextRef cgcontext = [context graphicsPort];
					var cgcontext = ostypes.API('objc_msgSend')(context, ostypes.HELPER.sel('graphicsPort'));

					
					// CGContextClearRect(cgcontext, CGRectMake(0, 0, CGRectGetWidth(rect), CGRectGetHeight(rect)));
					var rez_width2 = ostypes.API('CGRectGetWidth')(rect);

					
					var rez_height2 = ostypes.API('CGRectGetHeight')(rect);

					
					var rez_CGRectMake = ostypes.API('CGRectMake')(0, 0, rez_width2, rez_height2);

					
					var casted_cgcontext = ctypes.cast(cgcontext, ostypes.TYPE.CGContextRef);
					var rez_CGContextClearRect = ostypes.API('CGContextClearRect')(casted_cgcontext, rez_CGRectMake); // returns void


					
					for (var i in i_nonMirror) { // if display is secondary mirror of another display, skip it

						// CGRect displayRect = CGDisplayBounds(displays[i]);
						var displayRect = ostypes.API('CGDisplayBounds')(displays[i]);

						

						// CGImageRef image = CGDisplayCreateImage(displays[i]);
						var image = ostypes.API('CGDisplayCreateImage')(displays[i]);

						if (image.isNull()) {

							continue;
						}
						
						// CGRect dest = CGRectMake(displayRect.origin.x - rect.origin.x,
						//               displayRect.origin.y - rect.origin.y,
						//               displayRect.size.width,
						//               displayRect.size.height);
						var dest = ostypes.API('CGRectMake')(
							displayRect.origin.x - rect.origin.x,
							displayRect.origin.y - rect.origin.y,
							displayRect.size.width,
							displayRect.size.height
						);

						
						// CGContextDrawImage(cgcontext, dest, image);
						ostypes.API('CGContextDrawImage')(casted_cgcontext, dest, image); // reutrns void

						
						// CGImageRelease(image);
						ostypes.API('CGImageRelease')(image); // returns void

						
					}
					
					// [[NSGraphicsContext currentContext] flushGraphics];
					var rez_currentContext = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('currentContext'));

					
					var rez_flushGraphics = ostypes.API('objc_msgSend')(rez_currentContext, ostypes.HELPER.sel('flushGraphics'));

					
					// [NSGraphicsContext restoreGraphicsState];
					var rez_restoreGraphicsState = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('restoreGraphicsState'));

					// end - take one big screenshot of all monitors
					
					// start - try to get byte array
					// [imageRep bitmapData]
					var rgba_buf = ostypes.API('objc_msgSend')(imageRep, ostypes.HELPER.sel('bitmapData'));

					
					var bitmapBytesPerRow = rez_width * 4;
					var bitmapByteCount = bitmapBytesPerRow * rez_height;
					
					// var rgba_arr = ctypes.cast(rgba_buf, ostypes.TYPE.unsigned_char.array(bitmapByteCount).ptr).contents;

					

					var imagedata = new ImageData(rez_width, rez_height);



					ostypes.API('memcpy')(imagedata.data.buffer, rgba_buf, bitmapByteCount);

					// end - try to get byte array
				} finally {

					if (allocNSBIP) {
						var rez_relNSBPI = ostypes.API('objc_msgSend')(allocNSBIP, ostypes.HELPER.sel('release'));

					}
					if (myNSStrings) {
						myNSStrings.releaseAll()
					}

				}
				// end - take one big screenshot of all monitors
				
				// start - because took a single screenshot of alllll put togather, lets portion out the imagedata

				var iref = imagedata.data;
				var fullWidth = rez_width;
				for (var i=0; i<collMonInfos.length; i++) {
					var screenUseW = collMonInfos[i].w;
					var screenUseH = collMonInfos[i].h;
					
					var screnImagedata = new ImageData(screenUseW, screenUseH);
					var siref = screnImagedata.data;
					
					var si = 0;
					for (var y=collMonInfos[i].y; y<collMonInfos[i].y+screenUseH; y++) {
						for (var x=collMonInfos[i].x; x<collMonInfos[i].x+screenUseW; x++) {
							var pix1 = (fullWidth*y*4) + (x * 4);
							//var B = iref[pix1];
							siref[si] = iref[pix1];
							siref[si+1] = iref[pix1+1];
							siref[si+2] = iref[pix1+2];
							siref[si+3] = 255;
							si += 4;
						}
					}
					collMonInfos[i].screenshot = screnImagedata;
				}

				// end - because took a single screenshot of alllll put togather, lets portion out the imagedata
				
			break;
		default:
			throw new Error('os not supported ' + core.os.name);
	}
	
	gTimer = setTimeout(function() {
		collMonInfos = null;
	}, 3000)
	
	return collMonInfos;
}

// End - Addon Functionality

var txtEn = new TextEncoder()
var pth = OS.Path.join(OS.Constants.Path.desktopDir, 'logit.txt');

function logit(txt) {
	var valOpen = OS.File.open(pth, {write: true, append: true});
	var valWrite = valOpen.write(txtEn.encode(txt + '\n'));
	valOpen.close();
}