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
	//console.log('in worker init');
	
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
function getAllWin(aOptions) {
	// returns an array of objects a list of all the windows in z order front to back:
	/*
		[
			{
				hwnd: window handle, hwnd for windows, gdkWindow* for gtk, nswindow for mac,
				pid: process id, if set getPid to true
				title: window title name, set getTitle true,
				bounds: window rect, set getBounds true,
				icon: custom icon for the window, set getIcon true,
			},
			{},
		]
	*/
	/*
	aOptions = {
		filterVisible: bool, will only contain windows that are visible,
		filterActiveWorkspace: bool, set to true if you want only the windows on the active workspace from each monitor,
		getPid: bool, set to true if u want it,
		getTitle: bool, set to true if you want it,
		getBounds: bool, set to true if you want it,
		getIcon: bool, set to true if you want to test if window has custom icon, if it does it returns its byte data? maybe hwnd? not sure maybe different per os, but if it doesnt have custom icon then key is present but set to null, // NOT YET SUPPORTED
		getAlwaysTop: bool, set to true if you want to test if window is set to always on top, // NOT YET SUPPORTED
		hwndAsPtr: bool, set to true if you want the hwnd to be ptr, otherwise it will be string of pointer, i recall that the loop would jack up and pointers would be bad so by default it will give strings, should verify and fix why the pointers were bad if they are aug 7 2015
	}
	*/
	
	var rezWinArr = [];
	
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
			
				if (aOptions.getPid) {
					var PID = ostypes.TYPE.DWORD();
				}
				
				if (aOptions.getTitle) {
					var lpStringMax = 500; // i dont think there is a max length to this so lets just go with 500
					var lpString = ostypes.TYPE.LPTSTR.targetType.array(lpStringMax)();
				}
				
				if (aOptions.getBounds) {
					var lpRect = ostypes.TYPE.RECT();
				}
				
				var f = 0;
				var SearchPD = function(hwnd, lparam) {
					f++;
					var thisWin = {};
					
					thisWin.hwnd = aOptions.hwndAsPtr ? hwnd : cutils.strOfPtr(hwnd);
					
					if (aOptions.filterVisible) {
						var hwndStyle = ostypes.API('GetWindowLongPtr')(hwnd, ostypes.CONST.GWL_STYLE);
						hwndStyle = parseInt(cutils.jscGetDeepest(hwndStyle));
						if (hwndStyle & ostypes.CONST.WS_VISIBLE) {
							
						} else {
							// window is not visible
							return true; // continue iterating // do not push thisWin into rezWinArr
						}
					}
					
					if (aOptions.getPid) {
						var rez_GWTPI = ostypes.API('GetWindowThreadProcessId')(hwnd, PID.address());
						thisWin.pid = cutils.jscGetDeepest(PID);
					}
					
					if (aOptions.getTitle) {
						var rez_lenNotInclNullTerm = ostypes.API('GetWindowText')(hwnd, lpString, lpStringMax);
						thisWin.title = lpString.readString();
						var lenParseInt = parseInt(cutils.jscGetDeepest(rez_lenNotInclNullTerm)); // i dont think the rez_lenNotInclNullTerm will exceed lpStringMax even if truncated
						for (var i=0; i<=lenParseInt; i++) { // need <= as len is till the last char, we need to reset it so we can reuse this var, otherwise if we read next thing into same buffer and its length is shorter, then we'll have left over chars from previous tagged on to the current
							lpString[i] = 0;
						}
					}
					
					if (aOptions.getBounds) {
						var rez_rect = ostypes.API('GetWindowRect')(hwnd, lpRect.address());
						thisWin.left = parseInt(cutils.jscGetDeepest(lpRect.left));
						thisWin.top = parseInt(cutils.jscGetDeepest(lpRect.top));
						thisWin.bottom = parseInt(cutils.jscGetDeepest(lpRect.bottom));
						thisWin.right = parseInt(cutils.jscGetDeepest(lpRect.right));
						
						thisWin.width = thisWin.right - thisWin.left;
						thisWin.height = thisWin.bottom - thisWin.top;
					}
					
					/*
					//console.log(['PID.value: ', PID.value, PID.value == aProfilePID].join(' '));
					if (cutils.jscEqual(PID, tPid)) {
						var hwndStyle = ostypes.API('GetWindowLongPtr')(hwnd, ostypes.CONST.GWL_STYLE);
						if (cutils.jscEqual(hwndStyle, 0)) {
							throw new Error('Failed to GetWindowLongPtr');
						}
						hwndStyle = parseInt(cutils.jscGetDeepest(hwndStyle));
						
						// debug block
						foundInOrder.push([cutils.strOfPtr(hwnd) + ' - ' + debugPrintAllStylesOnIt(hwndStyle)]); //debug
						if (!focusThisHwnd && (hwndStyle & ostypes.CONST.WS_VISIBLE) && (hwndStyle & ostypes.CONST.WS_CAPTION)) {
							foundInOrder.push('the hwnd above this row is what i will focus');
							focusThisHwnd = cutils.strOfPtr(hwnd); // for some reason if i set this to just hwnd, the global var of focusThisHwnd is getting cut shortend to just 0x2 after this enum is complete later on, even though on find it is 0x10200 so weird!!
						}
						// end // debug block
						return true; // keep iterating as debug
					}
					*/
					
					rezWinArr.push(thisWin);
					
					return true; // keep iterating
				}
				var SearchPD_ptr = ostypes.TYPE.WNDENUMPROC.ptr(SearchPD);
				var wnd = ostypes.TYPE.LPARAM();
				var rez_EnuMWindows = ostypes.API('EnumWindows')(SearchPD_ptr, wnd);
			
				console.info('total windows enumed:', f);
			break;
		case 'gtk':
			
				var xqRoot = ostypes.TYPE.Window();
				var xqParent = ostypes.TYPE.Window();
				var xqChildArr = ostypes.TYPE.Window.ptr();
				var nChilds = ostypes.TYPE.unsigned_int();
				
				var gpTypeReturned = ostypes.TYPE.Atom();
				var gpFormatReturned = ostypes.TYPE.int();
				var gpNItemsReturned = ostypes.TYPE.unsigned_long();
				var gpBytesAfterReturn = ostypes.TYPE.unsigned_long();
				var gpItemsArr = ostypes.TYPE.unsigned_char.ptr();
				
				var geoRoot = ostypes.TYPE.Window();
				var geoX = ostypes.TYPE.int();
				var geoY = ostypes.TYPE.int();
				var geoW = ostypes.TYPE.unsigned_int();
				var geoH = ostypes.TYPE.unsigned_int();
				var geoBorderWidth = ostypes.TYPE.unsigned_int();
				var geoDepth = ostypes.TYPE.unsigned_int();
				
				var wAttr = ostypes.TYPE.XWindowAttributes();
				
				var processWin = function(w) {
					if (aOptions.filterVisible) {
						var rez_WA = ostypes.API('XGetWindowAttributes')(ostypes.HELPER.cachedXOpenDisplay(), w, wAttr.address());
						console.info('wAttr.map_state:', wAttr.map_state.toString());
						if (!cutils.jscEqual(wAttr.map_state, ostypes.CONST.IsViewable)) {
							return; // continue as this is a hidden window, do not list features, do not dig this window
						}
					}
					
					var thisWin = {};
					// fetch props on thisWin
					
					thisWin.hwndXid = parseInt(cutils.jscGetDeepest(w));
					
					if (aOptions.getPid) {
						var rez_pid = ostypes.API('XGetWindowProperty')(ostypes.HELPER.cachedXOpenDisplay(), w, ostypes.HELPER.cachedAtom('_NET_WM_PID'), 0, 1, ostypes.CONST.False, ostypes.CONST.XA_CARDINAL, gpTypeReturned.address(), gpFormatReturned.address(), gpNItemsReturned.address(), gpBytesAfterReturn.address(), gpItemsArr.address());
						if (ostypes.HELPER.getWinProp_ReturnStatus(ostypes.CONST.XA_CARDINAL, gpTypeReturned, gpFormatReturned, gpBytesAfterReturn) == 1) {
							var jsN = parseInt(cutils.jscGetDeepest(gpNItemsReturned));
							if (jsN == 0) {
								thisWin.pid = null; // set to null as this window did not have a pid, but i add the key indicating i tested for it and the window had the proerty
							} else {
								//console.info('gpItemsArr:', gpItemsArr.toString(), 'casted:', ctypes.cast(gpItemsArr, ostypes.TYPE.CARD32).toString(), 'casted to single el:', ctypes.cast(gpItemsArr, ostypes.TYPE.CARD32.array(1).ptr).contents.toString()); // "gpItemsArr:" "ctypes.unsigned_char.ptr(ctypes.UInt64("0x7f229409d710"))" "casted:" "ctypes.unsigned_int(2483672848)" "casted to single el:" "ctypes.unsigned_int.array(1)([2212])" // showing that it must be cast and not just to type cuz its single element, but to array of 1 element
								thisWin.pid = parseInt(cutils.jscGetDeepest(ctypes.cast(gpItemsArr, ostypes.TYPE.CARD32.array(1).ptr).contents[0]));
							}
							ostypes.API('XFree')(gpItemsArr);
						} else {
							thisWin.pid = undefined; // window didnt even have property
						}
					}
					
					if (aOptions.getTitle) {
						var rez_title = ostypes.API('XGetWindowProperty')(ostypes.HELPER.cachedXOpenDisplay(), w, ostypes.HELPER.cachedAtom('_NET_WM_NAME'), 0, 256 /* this number times 4 is maximum ctypes.char that can be returned*/, ostypes.CONST.False, ostypes.HELPER.cachedAtom('UTF8_STRING'), gpTypeReturned.address(), gpFormatReturned.address(), gpNItemsReturned.address(), gpBytesAfterReturn.address(), gpItemsArr.address());
						if (ostypes.HELPER.getWinProp_ReturnStatus(ostypes.HELPER.cachedAtom('UTF8_STRING'), gpTypeReturned, gpFormatReturned, gpBytesAfterReturn) == 1) {
							var jsN = parseInt(cutils.jscGetDeepest(gpNItemsReturned));
							if (jsN == 0) {
								thisWin.title = ''; // window had property but not title
							} else {
								thisWin.title = ctypes.cast(gpItemsArr, ostypes.TYPE.char.array(jsN).ptr).contents.readString();
							}
							ostypes.API('XFree')(gpItemsArr);
						} else {
							thisWin.title = undefined; // window didnt even have property
						}
					}
					
					if (aOptions.getBounds) {
						if (aOptions.filterVisible) {
							// then get the info from wAttr as its already available
							thisWin.left = parseInt(cutils.jscGetDeepest(wAttr.x));
							thisWin.top = parseInt(cutils.jscGetDeepest(wAttr.y));
							
							var borderWidth = parseInt(cutils.jscGetDeepest(wAttr.border_width));
							thisWin.borderWidth = borderWidth;
							
							thisWin.width = parseInt(cutils.jscGetDeepest(wAttr.width))/* + borderWidth*/;
							thisWin.height = parseInt(cutils.jscGetDeepest(wAttr.height))/* + borderWidth*/;
							
							thisWin.right = thisWin.left + thisWin.width;
							thisWin.bottom = thisWin.top + thisWin.height;
						} else {
							var rez_bounds = ostypes.API('XGetGeometry')(ostypes.HELPER.cachedXOpenDisplay(), w, geoRoot.address(), geoX.address(), geoY.address(), geoW.address(), geoH.address(), geoBorderWidth.address(), geoDepth.address());
							thisWin.left = parseInt(cutils.jscGetDeepest(geoX));
							thisWin.top = parseInt(cutils.jscGetDeepest(geoY));
							
							var borderWidth = parseInt(cutils.jscGetDeepest(wAttr.border_width));
							thisWin.borderWidth = borderWidth;
							
							thisWin.width = parseInt(cutils.jscGetDeepest(wAttr.width))/* + borderWidth*/;
							thisWin.height = parseInt(cutils.jscGetDeepest(wAttr.height))/* + borderWidth*/;
							
							thisWin.right = thisWin.left + thisWin.width;
							thisWin.bottom = thisWin.top + thisWin.height;
						}
					}
					
					rezWinArr.splice(0, 0, thisWin);
					
					// dig the win even if it doesnt qualify
					var rez_XQ = ostypes.API('XQueryTree')(ostypes.HELPER.cachedXOpenDisplay(), w, xqRoot.address(), xqParent.address(), xqChildArr.address(), nChilds.address()); // interesting note about XQueryTree and workspaces: "The problem with this approach is that it will only return windows on the same virtual desktop.  In the case of multiple virtual desktops, windows on other virtual desktops will be ignored." source: http://www.experts-exchange.com/Programming/System/Q_21443252.html
					
					var jsNC = parseInt(cutils.jscGetDeepest(nChilds));
					
					if (jsNC > 0) {
						var jsChildArr = ctypes.cast(xqChildArr, ostypes.TYPE.Window.array(jsNC).ptr).contents;
						
						// for (var i=jsNC-1; i>-1; i--) {
						for (var i=0; i<jsNC; i++) {
							var wChild = jsChildArr[i];
							processWin(wChild);
						}
						
						ostypes.API('XFree')(xqChildArr);
					}
				}
				
				processWin(ostypes.HELPER.cachedDefaultRootWindow());
			
			break;
		case 'darwin':
			
				var cfarr_win = ostypes.API('CGWindowListCopyWindowInfo')(ostypes.CONST.kCGWindowListOptionOnScreenOnly, ostypes.CONST.kCGNullWindowID);
				try {
					var myNSStrings = new ostypes.HELPER.nsstringColl();
					
					var cnt_win = ostypes.API('CFArrayGetCount')(cfarr_win);
					console.info('cnt_win:', cnt_win);
					cnt_win = parseInt(cutils.jscGetDeepest(cnt_win));
					console.info('cnt_win:', cnt_win);
					
					for (var i=0; i<cnt_win; i++) {
						var thisWin = {};
						var c_win = ostypes.API('CFArrayGetValueAtIndex')(cfarr_win, i);
						
						if (aOptions.getTitle) {
							var windowName = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowName')); // (NSString *)[window objectForKey:@"kCGWindowName"];
							var windowNameLen = ostypes.API('objc_msgSend')(windowName, ostypes.HELPER.sel('length'));
							// console.info('windowNameLen:', windowNameLen);
							windowNameLen = ctypes.cast(windowNameLen, ostypes.TYPE.NSUInteger);
							// console.info('windowNameLen casted:', windowNameLen);
							windowNameLen = parseInt(cutils.jscGetDeepest(windowNameLen));
							// console.info('windowNameLen casted parseInted:', windowNameLen);
							
							if (windowNameLen == 0) { // can be 0 as its stated that kCGWindowName is an optional source: https://developer.apple.com/library/mac/documentation/Carbon/Reference/CGWindow_Reference/Constants/Constants.html#//apple_ref/doc/constant_group/Required_Window_List_Keys
								thisWin.title = '';
							} else {
								var utf8str = ostypes.API('objc_msgSend')(windowName, ostypes.HELPER.sel('UTF8String'));
								var str_casted = ctypes.cast(utf8str, ostypes.TYPE.char.array(windowNameLen+1).ptr).contents; // +1 as it doesnt include the null char, and readString needs that
								// console.info('str_casted:', str_casted.toString());
								thisWin.title = str_casted.readString();
							}
						}
						
						if (aOptions.getPid) {
							var rez_pid = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowOwnerPID'));
							console.info('rez_pid:', rez_pid.toString());
							
							// rez_pid = ctypes.cast(rez_pid, ostypes.TYPE.NSInteger);
							// console.info('rez_pid casted:', rez_pid);
							
							// rez_pid = parseInt(cutils.jscGetDeepest(rez_pid));
							// console.info('rez_pid casted parseInted:', rez_pid);
							// thisWin.pid = rez_pid;
							
							var int_pid = ostypes.API('objc_msgSend')(rez_pid, ostypes.HELPER.sel('integerValue'));
							int_pid = ctypes.cast(int_pid, ostypes.TYPE.NSInteger);
							// console.info('int_pid casted:', int_pid);
							
							int_pid = parseInt(cutils.jscGetDeepest(int_pid));
							// console.info('int_pid casted parseInted:', int_pid);
							thisWin.pid = int_pid;
						}
						
						/*
						// start debug i just want to see if fullscreen apps have a different workspace number
						// if (aOptions.getPid) {
							var rez_ws = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowWorkspace'));

							var int_ws = ostypes.API('objc_msgSend')(rez_ws, ostypes.HELPER.sel('integerValue'));
							int_ws = ctypes.cast(int_ws, ostypes.TYPE.NSInteger);
							int_ws = parseInt(cutils.jscGetDeepest(int_ws));
							thisWin.ws = int_ws;
						// }
						*/
						
						if (aOptions.getBounds) {
							var rez_bs = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowBounds'));
							console.info('rez_bs:', rez_bs);
							
							var bounds = ostypes.TYPE.CGRect();
							rez_bs = ctypes.cast(rez_bs, ostypes.TYPE.CFDictionaryRef);
							console.info('rez_bs casted:', rez_bs);
							
							var rez_makeBounds = ostypes.API('CGRectMakeWithDictionaryRepresentation')(rez_bs, bounds.address());
							console.info('rez_makeBounds:', rez_makeBounds.toString());
							
							console.info('bounds:', bounds.toString());
							
							thisWin.left = parseInt(cutils.jscGetDeepest(bounds.origin.x));
							thisWin.top = parseInt(cutils.jscGetDeepest(bounds.origin.y));
							thisWin.width = parseInt(cutils.jscGetDeepest(bounds.size.width));
							thisWin.height = parseInt(cutils.jscGetDeepest(bounds.size.height));

							thisWin.right = thisWin.left + thisWin.width;
							thisWin.bottom = thisWin.top + thisWin.height;
						}
						
						rezWinArr.push(thisWin);
					}

				} finally {
					ostypes.API('CFRelease')(cfarr_win);
					
					if (myNSStrings) {
						myNSStrings.releaseAll()
					}
				}
			
			break;
		default:
			console.error('os not supported');
	}
	
	return rezWinArr;
	
}

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
					console.error('info:', aArrHwndPtrStr[i]);
					var hwndPtr = ostypes.TYPE.HWND.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					
					//var rez_setTop = ostypes.API('SetWindowPos')(aHwnd, ostypes.CONST.HWND_TOPMOST, aOptions[aArrHwndPtrStr[i]].left, aOptions[aArrHwndPtrStr[i]].top, aOptions[aArrHwndPtrStr[i]].width, aOptions[aArrHwndPtrStr[i]].height, ostypes.CONST.SWP_NOSIZE | ostypes.CONST.SWP_NOMOVE | ostypes.CONST.SWP_NOREDRAW);
					var rez_setTop = ostypes.API('SetWindowPos')(hwndPtr, ostypes.CONST.HWND_TOPMOST, 0, 0, 0, 0, ostypes.CONST.SWP_NOSIZE | ostypes.CONST.SWP_NOMOVE/* | ostypes.CONST.SWP_NOREDRAW*/); // window wasnt moved so no need for SWP_NOREDRAW, the NOMOVE and NOSIZE params make it ignore x, y, cx, and cy
					console.info('rez_setTop:', rez_setTop);
				}
				
			break;
		case 'gtk':
				
				// http://stackoverflow.com/a/4347486/5062337
				// do this stuff up here as if it doesnt exist it will throw now, rather then go through set allocate xevent then find out when setting xevent.xclient data that its not available
				var atom_wmStateAbove = ostypes.HELPER.cachedAtom('_NET_WM_STATE_ABOVE');
				var atom_wmState = ostypes.HELPER.cachedAtom('_NET_WM_STATE');
				console.log('aArrHwndPtrStr:', aArrHwndPtrStr);
				
				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					console.error('info:', aArrHwndPtrStr[i]);
					var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					var XWindow = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					
					
					var xevent = ostypes.TYPE.XEvent();
					console.info('xevent:', uneval(xevent));
					
					xevent.xclient.type = ostypes.CONST.ClientMessage;
					xevent.xclient.serial = 0;
					xevent.xclient.send_event = ostypes.CONST.True;
					xevent.xclient.display = ostypes.HELPER.cachedXOpenDisplay();
					xevent.xclient.window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					xevent.xclient.message_type = atom_wmState;
					xevent.xclient.format = 32; // because xclient.data is long, i defined that in the struct union
					xevent.xclient.data = ostypes.TYPE.long.array(5)([ostypes.CONST._NET_WM_STATE_ADD, atom_wmStateAbove, 0, 0, 0]);
					
					console.info('xevent.xclient.addressOfField(data):', xevent.xclient.addressOfField('data'));
					console.info('xevent.xclient.addressOfField(data).addressOfElement(0):', xevent.xclient.data.addressOfElement(0));
					
					var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top
					console.log('rez_SendEv always on top:', rez_SendEv, rez_SendEv.toString());

					// xevent.xclient.data[1] = ostypes.HELPER.cachedAtom('_NET_WM_STATE_STICKY');
					// var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top
					// console.log('rez_SendEv sticky:', rez_SendEv, rez_SendEv.toString());
					
					// xevent.xclient.data[1] = ostypes.HELPER.cachedAtom('_NET_WM_STATE_FULLSCREEN');
					// var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top
					// console.log('rez_SendEv sticky:', rez_SendEv, rez_SendEv.toString());

					/*
					// testing XListProperties
					var numAtoms = ostypes.TYPE.int();
					var rez_ListProp = ostypes.API('XListProperties')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, numAtoms.address());
					console.info('rez_ListProp:', rez_ListProp.toString());
					console.info('numAtoms:', numAtoms);
					//if (cutils.jscEqual(rez_ListProp, ostypes.CONST.BadWindow)) { // need to figure out how to test this, it seems when rez_ListProp is null, so im not sure how to get BadWindow its just not returning it // throw new Error('XListProperties failed with reason BadWindow'); // }
					if (rez_ListProp.isNull()) {
						// then probably failed
						throw new Error('XListProperties probably failed with BadWindow BUT is possible the window really has no properties set on it in which case i should not throw error on this line');
					}
					
					var atomsJS = ctypes.cast(rez_ListProp, ostypes.TYPE.Atom.array(parseInt(cutils.jscGetDeepest(numAtoms))).ptr).contents;
					console.info('atomsJS:', atomsJS);
					var atomsC = rez_ListProp;
					numAtoms = parseInt(cutils.jscGetDeepest(numAtoms));
					
					// ostypes.API('XFree')(rez_ListProp); // must be done
					
					// test XGetAtomNames
					
					// // var atomsJS = [
					// // 	1,
					// // 	2,
					// // 	3
					// // ];
					// // var numAtoms = atomsJS.length;
					// // var atomsC = ostypes.TYPE.Atom.array(atomsJS.length)(atomsJS);
					
					
					var atomNames = ostypes.TYPE.char.ptr.array(numAtoms)();
					console.info('atomNames:', atomNames.toString())
					var rez_GetANames = ostypes.API('XGetAtomNames')(ostypes.HELPER.cachedXOpenDisplay(), atomsC, numAtoms, atomNames);
					console.info('rez_GetANames:', rez_GetANames.toString());
					if (cutils.jscEqual(rez_GetANames, 0)) {
						throw new Error('failed XGetAtomNames');
					}
					console.info('atomNames:', atomNames.toString())
					
					for (var i=0; i<atomNames.length; i++) {
						console.log('ATOM INFO - ', 'int:', atomsJS[i], 'atom name:', atomNames[i].readString());
						//ostypes.API('XFree')(atomNames[i]);
					}
					
					// doing XFree on atomNames seemed to cause an eventual crash, so i did XFree on each element and that seemed to not crash, i am now trying to see if I can do a XFreeStringList instead of XFree on each item
					//ostypes.API('XFreeStringList')(atomNames);
					
					// XFreeStringList crashes it almost immediately
					// XFree on atomNames crashes it eventually
					// XFree on each element seems the only crash free way
					ostypes.API('XFreeStringList')(atomNames);
					ostypes.API('XFree')(rez_ListProp); // must be done

					return;
					
					// https://github.com/HarveyHunt/barney/blob/bf43fef9ce95d1f7e2150973c2a28e0970bd8dfb/barney/bar.py#L199				
					// the reason this XChangeProperty on _NET_WM_STATE is not working is because explained here: "http://standards.freedesktop.org/wm-spec/wm-spec-1.3.html#idm140130317612768" --> "A Client wishing to change the state of a window MUST send a _NET_WM_STATE client message to the root window (see below). The Window Manager MUST keep this property updated to reflect the current state of the window." meaning the WM will handle setting this, and I should be ADDing this from XSendEvent
					var dataJS = [
						ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE_DOCK')
					];
					var dataC = ostypes.TYPE.Atom.array(dataJS.length)(dataJS);
					var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
					var dataFormat = 32; // cuz unsigned_long
					var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE'), ostypes.CONST.XA_ATOM, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
					console.info('rez_XChg:', rez_XChg.toString());

					// make window show on all desktops
					var dataJS = [
						ostypes.TYPE.Atom('0xFFFFFFFF') // means all desktops
					];
					var dataC = ostypes.TYPE.Atom.array(dataJS.length)(dataJS);
					var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
					var dataFormat = 32; // cuz unsigned_long
					var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, ostypes.HELPER.cachedAtom('_NET_WM_DESKTOP'), ostypes.CONST.XA_CARDINAL, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
					console.info('rez_XChg:', rez_XChg.toString());
					
					// // change window title
					// var dataJS = [
					// 	String.charCodeAt('r'),
					// 	String.charCodeAt('a'),
					// 	String.charCodeAt('w'),
					// ];
					// var dataC = ostypes.TYPE.unsigned_char.array(dataJS.length)(dataJS);
					// var dataCCasted = dataC; // no need to cast as it is already 8 byte //ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
					// var dataFormat = 8; // cuz unsigned_long
					// var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, ostypes.HELPER.cachedAtom('_NET_WM_NAME'), ostypes.HELPER.cachedAtom('UTF8_STRING'), dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
					// console.info('rez_XChg:', rez_XChg.toString());
					*/
				}
				
				ostypes.API('XFlush')(ostypes.HELPER.cachedXOpenDisplay()); // will not set on top if you dont do this, wont even change window title name which was done via XChangeProperty, MUST FLUSH
				
				/*
				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					console.error('info:', aArrHwndPtrStr[i]);
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
					console.info('rez_XChg:', rez_XChg.toString());
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
					console.info('rez_XChg:', rez_XChg.toString());
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
					console.info('rez_XChg:', rez_XChg.toString());
				}
				*/
			break;
		case 'darwin':
				
				/*
				// for (var i=0; i<aArrHwndPtrStr.length; i++) {
				// 	console.error('info:', aArrHwndPtrStr[i]);
				// 	var aNSWindow = ctypes.voidptr_t(ctypes.UInt64(aArrHwndPtrStr[i]));
				// 	console.error('att 6');
				// 	var nil = ctypes.voidptr_t(ctypes.UInt64('0x0')); // due to 3rd arg of objc_msgSend being variadic i have to set type, i cant just pass null
				// 	var rez_orderFront = ostypes.API('objc_msgSend')(aNSWindow, ostypes.HELPER.sel('windowNumber'));
				// 	console.info('rez_orderFront:', rez_orderFront);
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
						console.info('setWinAlwaysOnTop_class:', class_NoitOnScrnSvrDelgt.toString());
						throw new Error('setWinAlwaysOnTop_class is null, so objc_allocateClassPair failed');
					}
				// } else {
					// console.log('setWinAlwaysOnTop_class already exists');
					// needsRegistration = false;
				// }
								
				OSStuff.setWinAlwaysOnTop_jsMethods = {}; // holds key of aArrHwndPtrStr and value is js method
				
				var IMP_for_mainThreadSelector = ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, []);
				
				OSStuff.setWinAlwaysOnTop_jsMethods[aArrHwndPtrStr[0]] = function() {
					console.log('setWinAlwaysOnTop_jsMethods ' + 0 + ' called');
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
				console.error('perform done!!');
				
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
				console.info('rez_mainQ:', rez_mainQ.toString());
				
				OSStuff.js_cb = function() {
					console.error('in js_cb');
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
				console.info('got key:', cutils.jscGetDeepest(rez_getKey));
				return parseInt(cutils.jscGetDeepest(rez_getKey));
				*/
				
				// METHOD: dont set on top just focus app, this has that ugly scroll side affect if user is focused on another desktop on that monitor due to full screen app or something
				focusSelfApp();
				
			break;
		default:
			console.error('os not supported');
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
			console.error('os not supported');
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
				console.info('rez_actIgOthrApps:', rez_actIgOthrApps);
				
			break;
		default:
			console.error('os not supported');
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
					//console.info('rez_EnumDisplayDevices:', rez_EnumDisplayDevices.toString(), uneval(rez_EnumDisplayDevices), cutils.jscGetDeepest(rez_EnumDisplayDevices));
					
					if (cutils.jscEqual(rez_EnumDisplayDevices, 0)) { // ctypes.winLastError != 0
						// iDevNum is greater than the largest device index.
						break;
					}
					
					var StateFlags = parseInt(cutils.jscGetDeepest(lpDisplayDevice.StateFlags));
					
					console.info('lpDisplayDevice.DeviceName:', lpDisplayDevice.DeviceName.readString()); // "\\.\DISPLAY1" till "\\.\DISPLAY4"
					if (StateFlags & ostypes.CONST.DISPLAY_DEVICE_MIRRORING_DRIVER) {
						// skip this one, its a mirror monitor (like vnc or webex)
					} else if (StateFlags & ostypes.CONST.DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) {
						console.log('is monitor');
						
						var dm = ostypes.TYPE.DEVMODE(); // SIZEOF_DEVMODE = 220 on 32bit fx Win8.1 64bit when I do insepction though dm.size is set to 188
						console.info('dm.size:', ostypes.TYPE.DEVMODE.size);
						//dm.dmFields = ostypes.CONST.DM_PELSWIDTH;
						//dm.dmSize = ostypes.TYPE.DEVMODE.size;

						console.log('iDevNum:', iDevNum, lpDisplayDevice.DeviceName.readString());
						var rez_EnumDisplaySettings = ostypes.API('EnumDisplaySettings')(lpDisplayDevice.DeviceName, ostypes.CONST.ENUM_CURRENT_SETTINGS, dm.address());
						//console.info('rez_EnumDisplaySettings:', rez_EnumDisplaySettings.toString(), uneval(rez_EnumDisplaySettings), cutils.jscGetDeepest(rez_EnumDisplaySettings));
						//console.info('dm:', dm.toString());
						
						console.info('dmDeviceName:', dm.dmDeviceName, 'dmSpecVersion:', dm.dmSpecVersion, 'dmDriverVersion:', dm.dmDriverVersion, 'dmSize:', dm.dmSize, 'dmDriverExtra:', dm.dmDriverExtra, 'dmFields:', dm.dmFields, 'dmColor:', dm.dmColor, 'dmDuplex:', dm.dmDuplex, 'dmYResolution:', dm.dmYResolution, 'dmTTOption:', dm.dmTTOption, 'dmCollate:', dm.dmCollate, 'dmFormName:', dm.dmFormName, 'dmLogPixels:', dm.dmLogPixels, 'dmBitsPerPel:', dm.dmBitsPerPel, 'dmPelsWidth:', dm.dmPelsWidth, 'dmPelsHeight:', dm.dmPelsHeight, 'dmDisplayFlags:', dm.dmDisplayFlags, 'dmDisplayFrequency:', dm.dmDisplayFrequency, 'dmICMMethod:', dm.dmICMMethod, 'dmICMIntent:', dm.dmICMIntent, 'dmMediaType:', dm.dmMediaType, 'dmDitherType:', dm.dmDitherType, 'dmReserved1:', dm.dmReserved1, 'dmReserved2:', dm.dmReserved2, 'dmPanningWidth:', dm.dmPanningWidth, 'dmPanningHeight:', dm.dmPanningHeight, '_END_');
						console.info('dmPosition:', dm.u.dmPosition, 'dmDisplayOrientation:', dm.u.dmDisplayOrientation, 'dmDisplayFixedOutput:', dm.u.dmDisplayFixedOutput, '_END_');
						
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
					console.time('shot of screen ' + s);
					var hdcScreen = ostypes.API('CreateDC')(collMonInfos[s].otherInfo.lpszDriver, collMonInfos[s].otherInfo.lpszDevice, null, null);
					//console.info('hdcScreen:', hdcScreen.toString(), uneval(hdcScreen), cutils.jscGetDeepest(hdcScreen));
					if (ctypes.winLastError != 0) {
						//console.error('Failed hdcScreen, winLastError:', ctypes.winLastError);
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
					console.error('using w:', w, 'h:', h);
					var modW = w % 4;
					var useW = modW != 0 ? w + (4-modW) : w;
					console.log('useW:', useW, 'realW:', w);
					
					var arrLen = useW * h * 4;
					var imagedata = new ImageData(useW, h);
					
					var hdcMemoryDC = ostypes.API('CreateCompatibleDC')(hdcScreen); 
					//console.info('hdcMemoryDC:', hdcMemoryDC.toString(), uneval(hdcMemoryDC), cutils.jscGetDeepest(hdcMemoryDC));
					if (ctypes.winLastError != 0) {
						//console.error('Failed hdcMemoryDC, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcMemoryDC, winLastError: "' + ctypes.winLastError + '" and hdcMemoryDC: "' + hdcMemoryDC.toString(),
							winLastError: ctypes.winLastError
						});
					}

					console.error('using nBPP:', collMonInfos[s].otherInfo.nBPP);
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
					//console.info('PRE pixelBuffer:', pixelBuffer.toString(), 'pixelBuffer.addr:', pixelBuffer.address().toString());
					// CreateDIBSection stuff
					
					var hbmp = ostypes.API('CreateDIBSection')(hdcScreen, bmi.address(), ostypes.CONST.DIB_RGB_COLORS, pixelBuffer.address(), null, 0); 
					if (hbmp.isNull()) { // do not check winLastError when using v5, it always gives 87 i dont know why, but its working
						console.error('Failed hbmp, winLastError:', ctypes.winLastError, 'hbmp:', hbmp.toString(), uneval(hbmp), cutils.jscGetDeepest(hbmp));
						throw new Error({
							name: 'os-api-error',
							message: 'Failed hbmp, winLastError: "' + ctypes.winLastError + '" and hbmp: "' + hbmp.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var rez_SO = ostypes.API('SelectObject')(hdcMemoryDC, hbmp);
					//console.info('rez_SO:', rez_SO.toString(), uneval(rez_SO), cutils.jscGetDeepest(rez_SO));
					if (ctypes.winLastError != 0) {
						//console.error('Failed rez_SO, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_SO, winLastError: "' + ctypes.winLastError + '" and rez_SO: "' + rez_SO.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var rez_BB = ostypes.API('BitBlt')(hdcMemoryDC, 0, 0, w, h, hdcScreen, 0, 0, ostypes.CONST.SRCCOPY);
					//console.info('rez_BB:', rez_BB.toString(), uneval(rez_BB), cutils.jscGetDeepest(rez_BB));
					if (ctypes.winLastError != 0) {
						//console.error('Failed rez_BB, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_BB, winLastError: "' + ctypes.winLastError + '" and rez_BB: "' + rez_BB.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					console.timeEnd('shot of screen ' + s);
					
					console.time('memcpy');
					ostypes.API('memcpy')(imagedata.data, pixelBuffer, arrLen);
					console.timeEnd('memcpy');
					
					// swap bytes to go from BRGA to RGBA
					// Reorganizing the byte-order is necessary as canvas can only hold data in RGBA format (little-endian, ie. ABGR in the buffer). Here is one way to do this:
					console.time('BGRA -> RGBA');
					var dataRef = imagedata.data;
					var pos = 0;
					while (pos < arrLen) {
						var B = dataRef[pos];

						dataRef[pos] = dataRef[pos+2];
						dataRef[pos+2] = B;

						pos += 4;
					}
					console.timeEnd('BGRA -> RGBA');
					
					collMonInfos[s].screenshot = imagedata;
					
					// release memory of screenshot stuff
					//delete collMonInfos[s].otherInfo;
					// lpDisplayDevice = null;
					dm = null;
					// imagedata = null;
					
					var rez_DelDc1 = ostypes.API('DeleteDC')(hdcScreen);
					console.log('rez_DelDc1:', rez_DelDc1);
					
					var rez_DelDc2 = ostypes.API('DeleteDC')(hdcMemoryDC);
					console.log('rez_DelDc2:', rez_DelDc2);
					
					var rez_DelObj1 = ostypes.API('DeleteObject')(hbmp);
					console.log('rez_DelObj1:', rez_DelObj1);
				}
				
				// end - take shot of each monitor
		
				/*
				// get dpi for all monitors so can draw to canvas properly:
				var jsMonitorEnumProc = function(hMonitor, hdcMonitor, lprcMonitor, dwData) {
					console.log('in jsMonitorEnumProc', 'hMonitor:', hMonitor.toString(), 'lprcMonitor:', lprcMonitor.contents.toString()); // link3687324
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
					console.info('rez_GetMonitorInfo:', rez_GetMonitorInfo.toString(), uneval(rez_GetMonitorInfo), cutils.jscGetDeepest(rez_GetMonitorInfo));
					if (cutils.jscEqual(rez_GetMonitorInfo, 0)) {
						console.error('Failed rez_GetMonitorInfo, winLastError:', ctypes.winLastError);
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
					console.info('rez_GetDPI:', rez_GetDPI.toString());
					console.info('dpiX:', dpiX.toString());
					console.info('dpiY:', dpiY.toString());
					
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
						console.error('warning! could not find item in collMonInfos for lpszDevice of:', cMonInfo.szDevice.toString());
					}
					return true; // continue enumeration
				}
				var cMonitorEnumProc = ostypes.TYPE.MONITORENUMPROC.ptr(jsMonitorEnumProc);
				var rez_EnumDisplayMonitors = ostypes.API('EnumDisplayMonitors')(null, null, cMonitorEnumProc, 0);
				*/
				
				console.error('going to del');
				for (var i=0; i<collMonInfos.length; i++) {
					delete collMonInfos[i].otherInfo;
					console.error('delled otherInfo');
				}
				
			break;
		case 'gtk':

				// start - get all monitor resolutions
				var screen = ostypes.API('XRRGetScreenResources')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(ostypes.HELPER.cachedXOpenDisplay()));
				//console.info('screen:', screen.contents, screen.contents.toString());

				var noutputs = parseInt(cutils.jscGetDeepest(screen.contents.noutput));
				//console.info('noutputs:', noutputs);

				var screenOutputs = ctypes.cast(screen.contents.outputs, ostypes.TYPE.RROutput.array(noutputs).ptr).contents;
				for (var i=noutputs-1; i>=0; i--) {
					var info = ostypes.API('XRRGetOutputInfo')(ostypes.HELPER.cachedXOpenDisplay(), screen, screenOutputs[i]);
					if (cutils.jscEqual(info.connection, ostypes.CONST.RR_Connected)) {
						var ncrtcs = parseInt(cutils.jscGetDeepest(info.contents.ncrtc));
						var infoCrtcs = ctypes.cast(info.contents.crtcs, ostypes.TYPE.RRCrtc.array(ncrtcs).ptr).contents;
						for (var j=ncrtcs-1; j>=0; j--) {
							var crtc_info = ostypes.API('XRRGetCrtcInfo')(ostypes.HELPER.cachedXOpenDisplay(), screen, infoCrtcs[j]);
							console.info('screen #' + i + ' mon#' + j + ' details:', crtc_info.contents.x, crtc_info.contents.y, crtc_info.contents.width, crtc_info.contents.height);

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
				console.info('json.stringify pre clean:', JSON.stringify(collMonInfos));
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
				console.info('json.stringify post clean:', JSON.stringify(collMonInfos), collMonInfos);
				// end - get all monitor resolutions
				
				// start - take shot of all monitors and push to just first element of collMonInfos
				// https://github.com/BoboTiG/python-mss/blob/a4d40507c492962d59fcb97a509ede1f4b8db634/mss.py#L116

				// enum_display_monitors
				// this call to XGetWindowAttributes grab one screenshot of all monitors
				var gwa = ostypes.TYPE.XWindowAttributes();
				var rez_XGetWinAttr = ostypes.API('XGetWindowAttributes')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), gwa.address());
				console.info('gwa:', gwa.toString());
				
				var fullWidth = parseInt(cutils.jscGetDeepest(gwa.width));
				var fullHeight = parseInt(cutils.jscGetDeepest(gwa.height));
				var originX = parseInt(cutils.jscGetDeepest(gwa.x));
				var originY = parseInt(cutils.jscGetDeepest(gwa.y));
				
				console.info('fullWidth:', fullWidth, 'fullHeight:', fullHeight, 'originX:', originX, 'originY:', originY, '_END_');
				
				// get_pixels
				var allplanes = ostypes.API('XAllPlanes')();
				console.info('allplanes:', allplanes.toString());
				
				var ZPixmap = 2;

				var ximage = ostypes.API('XGetImage')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), originX, originY, fullWidth, fullHeight, allplanes, ZPixmap);
				console.info('width:', ximage.contents.width.toString(), 'height:', ximage.contents.height.toString(), 'xoffset:', ximage.contents.xoffset.toString(), 'format:', ximage.contents.format.toString(), 'data:', ximage.contents.data.toString(), 'byte_order:', ximage.contents.byte_order.toString(), 'bitmap_unit:', ximage.contents.bitmap_unit.toString(), 'bitmap_bit_order:', ximage.contents.bitmap_bit_order.toString(), 'bitmap_pad:', ximage.contents.bitmap_pad.toString(), 'depth:', ximage.contents.depth.toString(), 'bytes_per_line:', ximage.contents.bytes_per_line.toString(), 'bits_per_pixel:', ximage.contents.bits_per_pixel.toString(), 'red_mask:', ximage.contents.red_mask.toString(), 'green_mask:', ximage.contents.green_mask.toString(), 'blue_mask:', ximage.contents.blue_mask.toString(), '_END_');

				var fullLen = 4 * fullWidth * fullHeight;
				
				console.time('init imagedata');
				var imagedata = new ImageData(fullWidth, fullHeight);
				console.timeEnd('init imagedata');

				console.time('memcpy');
				ostypes.API('memcpy')(imagedata.data.buffer, ximage.contents.data, fullLen);
				console.timeEnd('memcpy');
				
				var iref = imagedata.data;
				
				/*
				console.time('make bgra to rgba');
				for (var i=0; i<fullLen; i=i+4) {
					var B = iref[i];
					iref[i] = iref[i+2];
					iref[i+2] = B;
				}
				console.timeEnd('make bgra to rgba');
				*/
				// end - take shot of all monitors and push to just first element of collMonInfos
				
				// start - because took a single screenshot of alllll put togather, lets portion out the imagedata
				console.time('portion out image data');
				for (var i=0; i<collMonInfos.length; i++) {
					var screenUseW = collMonInfos[i].w;
					var screenUseH = collMonInfos[i].h;
					
					console.info('screenUseW:', screenUseW, 'screenUseH:', screenUseH, '_END_');
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
				console.timeEnd('portion out image data');
				// end - because took a single screenshot of alllll put togather, lets portion out the imagedata
			
			break;
		case 'darwin':
				
				// start - get monitor resolutions
				var displays = ostypes.TYPE.CGDirectDisplayID.array(32)(); // i guess max possible monitors is 32
				var count = ostypes.TYPE.uint32_t();
				console.info('displays.constructor.size:', displays.constructor.size);
				console.info('ostypes.TYPE.CGDirectDisplayID.size:', ostypes.TYPE.CGDirectDisplayID.size);
				
				var maxDisplays = displays.constructor.size / ostypes.TYPE.CGDirectDisplayID.size;
				var activeDspys = displays; // displays.address() didnt work it threw `expected type pointer, got ctypes.uint32_t.array(32).ptr(ctypes.UInt64("0x11e978080"))` // the arg in declare is `self.TYPE.CGDirectDisplayID.ptr,	// *activeDisplays` // without .address() worked
				var dspyCnt = count.address();
				console.info('maxDisplays:', maxDisplays);
				
				var rez_CGGetActiveDisplayList = ostypes.API('CGGetActiveDisplayList')(maxDisplays, activeDspys, dspyCnt);
				console.info('rez_CGGetActiveDisplayList:', rez_CGGetActiveDisplayList.toString(), uneval(rez_CGGetActiveDisplayList), cutils.jscGetDeepest(rez_CGGetActiveDisplayList));
				if (!cutils.jscEqual(rez_CGGetActiveDisplayList, ostypes.CONST.kCGErrorSuccess)) {
					console.error('Failed , errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed , errno: "' + ctypes.errno + '" and : "' + rez_CGGetActiveDisplayList.toString(),
						errno: ctypes.errno
					});
				}
				
				count = parseInt(cutils.jscGetDeepest(count));
				console.info('count:', count);
				var i_nonMirror = {};
				
				var rect = ostypes.CONST.CGRectNull;
				console.info('rect preloop:', rect.toString()); // "CGRect({"x": Infinity, "y": Infinity}, {"width": 0, "height": 0})"
				for (var i=0; i<count; i++) {
					// if display is secondary mirror of another display, skip it
					console.info('displays[i]:', displays[i]);
					
					var rez_CGDisplayMirrorsDisplay = ostypes.API('CGDisplayMirrorsDisplay')(displays[i]);					
					console.info('rez_CGDisplayMirrorsDisplay:', rez_CGDisplayMirrorsDisplay.toString(), uneval(rez_CGDisplayMirrorsDisplay), cutils.jscGetDeepest(rez_CGDisplayMirrorsDisplay));

					if (!cutils.jscEqual(rez_CGDisplayMirrorsDisplay, ostypes.CONST.kCGNullDirectDisplay)) { // If CGDisplayMirrorsDisplay() returns 0 (a.k.a. kCGNullDirectDisplay), then that means the display is not mirrored.
						continue;
					}
					i_nonMirror[i] = null;
					
					var rez_CGDisplayBounds = ostypes.API('CGDisplayBounds')(displays[i]);
					console.info('rez_CGDisplayBounds:', rez_CGDisplayBounds.toString(), uneval(rez_CGDisplayBounds)/*, cutils.jscGetDeepest(rez_CGDisplayBounds)*/); // :todo: fix cutils.jscEqual because its throwing `Error: cannot convert to primitive value` for ctypes.float64_t and ctypes.double ACTUALLY its a struct, so no duhhh so no :todo:
					
					collMonInfos.push({
						x: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.origin.x)),
						y: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.origin.y)),
						w: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.size.width)),
						h: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.size.height)),
						screenshot: null // for darwin, i take the big canvas and protion to each mon
					});
					
					rect = ostypes.API('CGRectUnion')(rect, rez_CGDisplayBounds);
					console.info('rect post loop ' + i + ':', rect.toString());
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
					var rez_hideCursor = ostypes.API('CGDisplayHideCursor')(ostypes.CONST.kCGNullDirectDisplay);
					
					myNSStrings = new ostypes.HELPER.nsstringColl();
					
					var rez_width = ostypes.API('CGRectGetWidth')(rect);
					console.info('rez_width:', rez_width.toString(), uneval(rez_width), cutils.jscGetDeepest(rez_width));
					
					var rez_height = ostypes.API('CGRectGetHeight')(rect);
					console.info('rez_height:', rez_height.toString(), uneval(rez_height), cutils.jscGetDeepest(rez_height));
					
					var NSBitmapImageRep = ostypes.HELPER.class('NSBitmapImageRep');
					allocNSBIP = ostypes.API('objc_msgSend')(NSBitmapImageRep, ostypes.HELPER.sel('alloc'));
					console.info('allocNSBIP:', allocNSBIP.toString(), uneval(allocNSBIP));
		
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
					console.info('imageRep:', imageRep.toString(), uneval(imageRep), cutils.jscGetDeepest(imageRep));
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
					console.info('context:', context.toString(), uneval(context), cutils.jscGetDeepest(context));
					if (context.isNull()) { // im guessing this is how to error check it
						throw new Error({
							name: 'os-api-error',
							message: 'Failed context, errno: "' + ctypes.errno + '" and : "' + context.toString(),
							errno: ctypes.errno
						});
					}
					
					// [NSGraphicsContext saveGraphicsState];
					var rez_saveGraphicsState = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('saveGraphicsState'));
					console.info('rez_saveGraphicsState:', rez_saveGraphicsState.toString(), uneval(rez_saveGraphicsState), cutils.jscGetDeepest(rez_saveGraphicsState));
					
					// [NSGraphicsContext setCurrentContext:context];
					var rez_setCurrentContext = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('setCurrentContext:'), context);
					console.info('rez_setCurrentContext:', rez_setCurrentContext.toString(), uneval(rez_setCurrentContext), cutils.jscGetDeepest(rez_setCurrentContext));
					
					// CGContextRef cgcontext = [context graphicsPort];
					var cgcontext = ostypes.API('objc_msgSend')(context, ostypes.HELPER.sel('graphicsPort'));
					console.info('cgcontext:', cgcontext.toString(), uneval(cgcontext), cutils.jscGetDeepest(cgcontext));
					
					// CGContextClearRect(cgcontext, CGRectMake(0, 0, CGRectGetWidth(rect), CGRectGetHeight(rect)));
					var rez_width2 = ostypes.API('CGRectGetWidth')(rect);
					console.info('rez_width2:', rez_width2.toString(), uneval(rez_width2), cutils.jscGetDeepest(rez_width2));
					
					var rez_height2 = ostypes.API('CGRectGetHeight')(rect);
					console.info('rez_height2:', rez_height2.toString(), uneval(rez_height2), cutils.jscGetDeepest(rez_height2));
					
					var rez_CGRectMake = ostypes.API('CGRectMake')(0, 0, rez_width2, rez_height2);
					console.info('rez_CGRectMake:', rez_CGRectMake.toString(), uneval(rez_CGRectMake)/*, cutils.jscGetDeepest(rez_CGRectMake)*/);
					
					var casted_cgcontext = ctypes.cast(cgcontext, ostypes.TYPE.CGContextRef);
					var rez_CGContextClearRect = ostypes.API('CGContextClearRect')(casted_cgcontext, rez_CGRectMake); // returns void
					//console.info('rez_CGContextClearRect:', rez_CGContextClearRect.toString(), uneval(rez_CGContextClearRect), cutils.jscGetDeepest(rez_CGContextClearRect));
					console.log('did CGContextClearRect');
					
					for (var i in i_nonMirror) { // if display is secondary mirror of another display, skip it
						console.log('entering nonMirror');
						// CGRect displayRect = CGDisplayBounds(displays[i]);
						var displayRect = ostypes.API('CGDisplayBounds')(displays[i]);
						console.info('displayRect:', displayRect.toString(), uneval(displayRect));
						
						console.warn('pre CGDisplayCreateImage');
						// CGImageRef image = CGDisplayCreateImage(displays[i]);
						var image = ostypes.API('CGDisplayCreateImage')(displays[i]);
						console.info('image:', image.toString(), uneval(image));
						if (image.isNull()) {
							console.warn('no image so continuing');
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
						console.info('dest:', dest.toString(), uneval(dest));
						
						// CGContextDrawImage(cgcontext, dest, image);
						ostypes.API('CGContextDrawImage')(casted_cgcontext, dest, image); // reutrns void
						console.info('did CGContextDrawImage');
						
						// CGImageRelease(image);
						ostypes.API('CGImageRelease')(image); // returns void
						console.info('did CGImageRelease');
						
					}
					
					// [[NSGraphicsContext currentContext] flushGraphics];
					var rez_currentContext = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('currentContext'));
					console.info('rez_currentContext:', rez_currentContext.toString(), uneval(rez_currentContext));
					
					var rez_flushGraphics = ostypes.API('objc_msgSend')(rez_currentContext, ostypes.HELPER.sel('flushGraphics'));
					console.info('rez_flushGraphics:', rez_flushGraphics.toString(), uneval(rez_flushGraphics));
					
					// [NSGraphicsContext restoreGraphicsState];
					var rez_restoreGraphicsState = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('restoreGraphicsState'));
					console.info('rez_restoreGraphicsState:', rez_restoreGraphicsState.toString(), uneval(rez_restoreGraphicsState));
					// end - take one big screenshot of all monitors
					
					// start - try to get byte array
					// [imageRep bitmapData]
					var rgba_buf = ostypes.API('objc_msgSend')(imageRep, ostypes.HELPER.sel('bitmapData'));
					console.info('rgba_buf:', rgba_buf.toString());
					
					var bitmapBytesPerRow = rez_width * 4;
					var bitmapByteCount = bitmapBytesPerRow * rez_height;
					
					// var rgba_arr = ctypes.cast(rgba_buf, ostypes.TYPE.unsigned_char.array(bitmapByteCount).ptr).contents;
					// console.info('rgba_arr:', rgba_arr.toString());
					
					console.time('init imagedata');
					var imagedata = new ImageData(rez_width, rez_height);
					console.timeEnd('init imagedata');

					console.time('memcpy');
					ostypes.API('memcpy')(imagedata.data.buffer, rgba_buf, bitmapByteCount);
					console.timeEnd('memcpy');
					// end - try to get byte array
				} finally {
					console.error('starting finally block');
					var rez_showCursor = ostypes.API('CGDisplayShowCursor')(ostypes.CONST.kCGNullDirectDisplay);
					
					if (allocNSBIP) {
						var rez_relNSBPI = ostypes.API('objc_msgSend')(allocNSBIP, ostypes.HELPER.sel('release'));
						console.info('rez_relNSBPI:', rez_relNSBPI.toString());
					}
					if (myNSStrings) {
						myNSStrings.releaseAll()
					}
					console.info('released things, i want to know if it gets here even if return was called within the try block');
				}
				// end - take one big screenshot of all monitors
				
				// start - because took a single screenshot of alllll put togather, lets portion out the imagedata
				console.time('portion out image data');
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
				console.timeEnd('portion out image data');
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