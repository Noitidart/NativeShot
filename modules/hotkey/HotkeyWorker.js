// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('resource://gre/modules/workers/require.js');

// Globals
var core = { // have to set up the main keys that you want when aCore is merged from mainthread in init
	addon: {
		path: {
			modules: 'chrome://nativeshot/content/modules/'
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	}
};

var OSStuff = {}; // global vars populated by init, based on OS

// Imports that use stuff defined in chrome
// I don't import ostypes_*.jsm yet as I want to init core first, as they use core stuff like core.os.isWinXP etc
// imported scripts have access to global vars on MainWorker.js
importScripts(core.addon.path.modules + 'cutils.jsm');
importScripts(core.addon.path.modules + 'ctypes_math.jsm');

// Setup PromiseWorker
// SIPWorker - rev9 - https://gist.github.com/Noitidart/92e55a3f7761ed60f14c
var PromiseWorker = require('resource://gre/modules/workers/PromiseWorker.js');

// Instantiate AbstractWorker (see below).
var worker = new PromiseWorker.AbstractWorker()

// worker.dispatch = function(method, args = []) {
worker.dispatch = function(method, args = []) {// start - noit hook to allow PromiseWorker methods to return promises
  // Dispatch a call to method `method` with args `args`
  // start - noit hook to allow PromiseWorker methods to return promises
  // return self[method](...args);
  console.log('dispatch args:', args);
  var earlierResult = gEarlyDispatchResults[args[0]]; // i change args[0] to data.id
  delete gEarlyDispatchResults[args[0]];
  if (Array.isArray(earlierResult) && earlierResult[0] == 'noit::throw::') {
	  console.error('ok need to throw but i want to ensure .constructor.name is in promiseworker.js"s EXCEPTION_NAMES, it is:', earlierResult[1].constructor.name);
	  throw earlierResult[1];
  }
  return earlierResult;
  // end - noit hook to allow PromiseWorker methods to return promises
};
worker.postMessage = function(...args) {
  // Post a message to the main thread
  self.postMessage(...args);
};
worker.close = function() {
  // Close the worker
  self.close();
};
worker.log = function(...args) {
  // Log (or discard) messages (optional)
  dump('Worker: ' + args.join(' ') + '\n');
};

// Connect it to message port.
// self.addEventListener('message', msg => worker.handleMessage(msg)); // this is what you do if you want PromiseWorker without mainthread calling ability
// start - setup SIPWorker
var WORKER = this;
var gEarlyDispatchResults = {};
self.addEventListener('message', function(aMsgEvent) { // this is what you do if you want SIPWorker mainthread calling ability
	var aMsgEventData = aMsgEvent.data;
	if (Array.isArray(aMsgEventData)) {
		// console.log('worker got response for main thread calling SIPWorker functionality:', aMsgEventData)
		var funcName = aMsgEventData.shift();
		if (funcName in WORKER) {
			var rez_worker_call = WORKER[funcName].apply(null, aMsgEventData);
		}
		else { console.error('funcName', funcName, 'not in scope of WORKER') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out
	} else {
		// console.log('no this is just regular promise worker message');
		var earlyDispatchErr;
		var earlyDispatchRes;
		try {
			earlyDispatchRes = self[aMsgEvent.data.fun](...aMsgEvent.data.args);
			console.error('earlyDispatchRes:', earlyDispatchRes);
		} catch(earlyDispatchErr) {
			earlyDispatchRes = ['noit::throw::', earlyDispatchErr];
			console.error('error in earlyDispatchRes:', earlyDispatchErr);
			// throw new Error('blah');
		}
		aMsgEvent.data.args.splice(0, 0, aMsgEvent.data.id)
		if (earlyDispatchRes && earlyDispatchRes.constructor.name == 'Promise') { // as earlyDispatchRes may be undefined
			console.log('in earlyDispatchRes as promise block');
			earlyDispatchRes.then(
				function(aVal) {
					console.log('earlyDispatchRes resolved:', aVal);
					gEarlyDispatchResults[aMsgEvent.data.id] = aVal;
					worker.handleMessage(aMsgEvent);
				},
				function(aReason) {
					console.warn('earlyDispatchRes rejected:', aReason);
				}
			).catch(
				function(aCatch) {
					console.error('earlyDispatchRes caught:', aCatch);
					gEarlyDispatchResults[aMsgEvent.data.id] = ['noit::throw::', aCatch];
					console.error('aCatch:', aCatch);
				}
			);
		} else {
			console.log('not a promise so setting it to gEarlyDispatchResults, it is:', earlyDispatchRes);
			if (earlyDispatchRes) {
				console.log('not undefined or null so constructor is:', earlyDispatchRes.constructor.name);
			}
			gEarlyDispatchResults[aMsgEvent.data.id] = earlyDispatchRes;
			worker.handleMessage(aMsgEvent);
		}
	}
});

const SIP_CB_PREFIX = '_a_gen_cb_';
const SIP_TRANS_WORD = '_a_gen_trans_';
var sip_last_cb_id = -1;
self.postMessageWithCallback = function(aPostMessageArr, aCB, aPostMessageTransferList) {
	var aFuncExecScope = WORKER;
	
	sip_last_cb_id++;
	var thisCallbackId = SIP_CB_PREFIX + sip_last_cb_id;
	aFuncExecScope[thisCallbackId] = function(aResponseArgsArr) {
		delete aFuncExecScope[thisCallbackId];
		console.log('in worker callback trigger wrap, will apply aCB with these arguments:', aResponseArgsArr);
		aCB.apply(null, aResponseArgsArr);
	};
	aPostMessageArr.push(thisCallbackId);
	self.postMessage(aPostMessageArr, aPostMessageTransferList);
};
// end - setup SIPWorker

function init(objCore) { // function name init required for SIPWorker
	console.log('in worker init');
	
	// merge objCore into core
	// core and objCore is object with main keys, the sub props
	
	core = objCore;
	
	core.os.mname = core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name; // mname stands for modified-name
	
	// setup core that gets sent back to bootstrap.js

	// os
	core.os.name = OS.Constants.Sys.Name.toLowerCase();
	
	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	console.log('bringing in ostypes');
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.modules + 'ostypes_win.jsm');
			break
		case 'gtk':
			importScripts(core.addon.path.modules + 'ostypes_x11.jsm');
			break;
		case 'darwin':
			importScripts(core.addon.path.modules + 'ostypes_mac.jsm');
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}
	console.log('brought in ostypes');
	
	// OS Specific Init
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				OSStuff.msg = ostypes.TYPE.MSG();
				
			break;
		case 'gtk':
		
				OSStuff.xev = ostypes.TYPE.XEvent();
		
			break;
		default:
			// do nothing special
	}
	
	// General Init
	registerHotkey();
	startEventLoop();
	
	console.log('HotkeyWorker init success');
	// return core; // for SIPWorker returnung is not required
}

// start - addon functionality
var gEventLoopInterval;
const gEventLoopIntervalMS = 5000;

function prepTerm() {
	
	stopEventLoop();
	
	// unregister the hotkey
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
		
				var rez_unregKey = ostypes.API('UnregisterHotKey')(null, 1);
				console.log('rez_unregKey:', rez_unregKey, 'winLastError:', ctypes.winLastError);
			
			break
		case 'gtk':
		
				////// var rez_ungrab = ostypes.API('XUngrabKey')(ostypes.HELPER.cachedXOpenDisplay(), OSStuff.key, ostypes.CONST.None, ostypes.HELPER.cachedDefaultRootWindow());
				////// console.log('rez_ungrab:', rez_ungrab);
				////// 
				////// ostypes.HELPER.ifOpenedXCloseDisplay();
				for (var i=0; i<OSStuff.grabWins.length; i++) {
					console.log('ungrabbing win i:', i, OSStuff.grabWins[i]);
					for (var j=0; j<OSStuff.keycodesArr.length; j++) {
						console.log('ungrabbing key:', j, OSStuff.keycodesArr[j])
						var rez_ungrab = ostypes.API('xcb_ungrab_key')(OSStuff.conn, OSStuff.keycodesArr[j], OSStuff.grabWins[i], ostypes.CONST.XCB_MOD_MASK_ANY);
						console.log('rez_ungrab:', rez_ungrab);
					}
				}
				
				ostypes.API('xcb_disconnect')(OSStuff.conn);
				
			break;
		case 'darwin':
		
				// 
				
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}
	
	console.error('ok HotkeyWorker prepped for term');
}

function registerHotkey() {
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
		
				var rez_regKey = ostypes.API('RegisterHotKey')(null, 1, ostypes.CONST.MOD_NOREPEAT, ostypes.CONST.VK_SNAPSHOT);
				console.log('rez_regKey:', rez_regKey);
			
			break
		case 'gtk':
		
				////// // var rez_init = ostypes.API('XInitThreads')(); // This function returns a nonzero status if initialization was successful; otherwise, it returns zero. On systems that do not support threads, this function always returns zero. 
				////// // console.log('rez_init:', rez_init);
				////// 
				////// // based on https://jnativehook.googlecode.com/svn/branches/test_code/linux/XGrabKey.c
				////// //	i copied it here as it might come in handy - https://gist.github.com/Noitidart/e12ad03d21bbb91cd214
				////// 
				////// //Try to attach to the default X11 display.
				////// var display = ostypes.HELPER.cachedXOpenDisplay();
				////// 
				////// //Get the default global window to listen on for the selected X11 display.
				////// var grabWin = ostypes.HELPER.cachedDefaultRootWindow();
				////// // var rez_allow = ostypes.API('XAllowEvents')(display, ostypes.CONST.AsyncKeyboard, ostypes.CONST.CurrentTime);
				////// // console.log('rez_allow:', rez_allow);
				////// // XkbSetDetectableAutoRepeat(display, true, NULL);
				////// 
				////// //Find the X11 KeyCode we are listening for.
				////// var key = ostypes.API('XKeysymToKeycode')(display, ostypes.CONST.XK_Print);
				////// console.log('key:', key);
				////// OSStuff.key = key;
				////// 
				////// //No Modifier
				////// var rez_grab = ostypes.API('XGrabKey')(display, key, ostypes.CONST.None, grabWin, true, ostypes.CONST.GrabModeAsync, ostypes.CONST.GrabModeAsync);
				////// console.log('rez_grab:', rez_grab);
				////// 
				////// // var rez_sel = ostypes.API('XSelectInput')(display, grabWin, ostypes.CONST.KeyPressMask);
				////// // console.log('rez_sel:', rez_sel);
				
				//////////////// // based on http://stackoverflow.com/a/28351174/1828637
				//////////////// // Connect to the X server.
				//////////////// var conn = ostypes.API('xcb_connect')(null, null);
				//////////////// console.log('conn:', conn);
				//////////////// OSStuff.conn = conn;
				//////////////// 
				//////////////// var rez_conerr = ostypes.API('xcb_connection_has_error')(conn);
				//////////////// console.log('rez_conerr:', rez_conerr);
				//////////////// 
				//////////////// if (!cutils.jscEqual(rez_conerr, 0)) {
				//////////////// 	console.error('error in the connection!!!!!');
				//////////////// 	throw new Error('error in xcb connection!!');
				//////////////// }
				//////////////// 
				//////////////// // get first screen
				//////////////// var setup = ostypes.API('xcb_get_setup')(conn);
				//////////////// console.log('setup:', setup);
				//////////////// 
				//////////////// var screen = ostypes.API('xcb_setup_roots_iterator')(setup);
				//////////////// console.log('screen:', screen);
				//////////////// 
				//////////////// 
				//////////////// // define the application as window manager
				//////////////// var select_input_val = ostypes.TYPE.uint32_t.array()([
				//////////////// 							ostypes.CONST.XCB_EVENT_MASK_SUBSTRUCTURE_REDIRECT
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_SUBSTRUCTURE_NOTIFY
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_ENTER_WINDOW
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_LEAVE_WINDOW
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_STRUCTURE_NOTIFY
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_PROPERTY_CHANGE
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_BUTTON_PRESS
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_BUTTON_RELEASE
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_FOCUS_CHANGE
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_KEY_PRESS
				//////////////// 							| ostypes.CONST.XCB_EVENT_MASK_KEY_RELEASE
				//////////////// 						]);
				//////////////// console.log('select_input_val:', select_input_val);
				//////////////// console.log('screen.data.contents.root:', screen.data.contents.root);
				//////////////// 
				//////////////// var rez_chg = ostypes.API('xcb_change_window_attributes')(conn, screen.data.contents.root, ostypes.CONST.XCB_CW_EVENT_MASK, select_input_val);
				//////////////// console.log('rez_chg:', rez_chg);
				//////////////// 
				//////////////// // Need to xcb_flush to validate error handler
				//////////////// var rez_sync = ostypes.API('xcb_aux_sync')(conn);
				//////////////// console.log('rez_sync:', rez_sync);
				
				// var rez_poll = ostypes.API('xcb_poll_for_event')(conn);
				// console.log('rez_poll:', rez_poll);
				// if (!rez_poll.isNull()) {
				// 	console.error('another window manager is already running');
				// }
				
				// var rez_flush = ostypes.API('xcb_flush')(conn);
				// console.log('rez_flush:', rez_flush);
				
				// tried creating a window to see if i can get events from there, it worked
				////////
				////////	var w = ostypes.API('xcb_generate_id')(conn);
				////////	console.log('w:', w);
				////////	
				////////	var mask = ostypes.CONST.XCB_CW_BACK_PIXEL | ostypes.CONST.XCB_CW_EVENT_MASK;
				////////	
				////////	var value_list = ostypes.TYPE.uint32_t.array()([
				////////		screen.data.contents.black_pixel, // Background color of the window (XCB_CW_BACK_PIXEL)
				////////		ostypes.CONST.XCB_EVENT_MASK_BUTTON_PRESS | ostypes.CONST.XCB_EVENT_MASK_BUTTON_RELEASE // Event masks (XCB_CW_EVENT_MASK)
				////////	]);
				////////	
				////////	var rezXcbCreateWindow = ostypes.API('xcb_create_window')(
				////////		conn,											// Connection
				////////		ostypes.CONST.XCB_COPY_FROM_PARENT,				// Depth
				////////		w,												// Window ID
				////////		screen.data.contents.root,						// Parent window
				////////		0,												// x
				////////		0,												// y
				////////		150,											// width
				////////		150,											// height
				////////		10,												// Border width in pixels
				////////		ostypes.CONST.XCB_WINDOW_CLASS_INPUT_OUTPUT,	// Window class
				////////		screen.data.contents.root_visual,				// Visual
				////////		mask,
				////////		value_list										// Window properties mask and values.
				////////	);
				////////	console.log('rezXcbCreateWindow:', rezXcbCreateWindow);
				////////	
				////////	// Map the window and ensure the server receives the map request.
				////////	var rezMap = ostypes.API('xcb_map_window')(conn, w);
				////////	console.log('rezMap:', rezMap);
				////////	
				////////	var rezFlush = ostypes.API('xcb_flush')(conn);
				////////	console.log('rezFlush:', rezFlush);
				////////
				
				// based on http://stackoverflow.com/q/14553810/1828637
				
				// Connect to the X server.
				var conn = ostypes.API('xcb_connect')(null, null);
				console.log('conn:', conn);
				OSStuff.conn = conn;
				
				var rez_conerr = ostypes.API('xcb_connection_has_error')(conn);
				console.log('rez_conerr:', rez_conerr);
				if (!cutils.jscEqual(rez_conerr, 0)) {
					console.error('error in the connection!!!!!');
					throw new Error('error in xcb connection!!');
				}
				
				// xcb_key_symbols_t *keysyms = xcb_key_symbols_alloc(c);
				var keysyms = ostypes.API('xcb_key_symbols_alloc')(conn);
				console.log('keysyms:', keysyms);
				
				// xcb_keycode_t *keycodes = xcb_key_symbols_get_keycode(keysyms, XK_space), keycode;
				var keycodesPtr = ostypes.API('xcb_key_symbols_get_keycode')(keysyms, ostypes.CONST.XK_Space);
				console.log('keycodesPtr:', keycodesPtr, uneval(keycodesPtr));
				
				var keycodesArr = [];
				var addressOfElement = ctypes.UInt64(cutils.strOfPtr(keycodesPtr));
				while(true) {
					var el = ostypes.TYPE.xcb_keycode_t.ptr(addressOfElement);
					var val = el.contents; // no need for cutils.jscGetDeepest because xcb_keycode_t is ctypes.uint_8 which is a number
					if (val == ostypes.CONST.XCB_NO_SYMBOL) {
						break;
					}
					keycodesArr.push(val);
					addressOfElement = ctypes_math.UInt64.add(addressOfElement, ostypes.TYPE.xcb_keycode_t.size);
				}
				
				OSStuff.keycodesArr = keycodesArr;
				console.log('keycodesArr:', keycodesArr);
				if (!keycodesArr.length) {
					console.error('no keycodes!! so nothing to grab!');
					return;
				}
				
				ostypes.API('free')(keycodesPtr); // returns undefined
				
				ostypes.API('xcb_key_symbols_free')(keysyms); // returns undefined
				
				// add bindings for all screens
				// iter = xcb_setup_roots_iterator (xcb_get_setup (c));
				var setup = ostypes.API('xcb_get_setup')(conn);
				console.log('setup:', setup);
				
				var screens = ostypes.API('xcb_setup_roots_iterator')(setup);
				console.log('screens:', screens);
				
				OSStuff.grabWins = [];
				var screensCnt = parseInt(cutils.jscGetDeepest(screens.rem));
				console.log('screensCnt:', screensCnt);
				for (var i=0; i<screensCnt; i++) {
					console.log('ok screen i:', i, 'screens:', screens);
					console.log('screens.data.contents:', screens.data.contents);
					for (var j=0; j<keycodesArr.length; j++) {
						// xcb_grab_key(c, true, iter.data->root, XCB_MOD_MASK_ANY, keycode, XCB_GRAB_MODE_SYNC, XCB_GRAB_MODE_SYNC);
						var rez_grab = ostypes.API('xcb_grab_key')(conn, 1, screens.data.contents.root, ostypes.CONST.XCB_MOD_MASK_ANY, keycodesArr[j], ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC);
						console.log('rez_grab:', rez_grab);
						
						// var rez_err = ostypes.API('xcb_request_check')(conn, rez_grab);
						// console.log('rez_err:', rez_err);
						// if (!rez_err.isNull()) {
						// 	console.log('rez_err.contents:', rez_err.contents);
						// }
					}
					
					var chgValueList = ostypes.TYPE.uint32_t.array()([
						ostypes.CONST.XCB_EVENT_MASK_EXPOSURE | ostypes.CONST.XCB_EVENT_MASK_BUTTON_PRESS
					]);
					var rez_chg = ostypes.API('xcb_change_window_attributes')(conn, screens.data.contents.root, ostypes.CONST.XCB_CW_EVENT_MASK, chgValueList);
					console.log('rez_chg:', rez_chg);
					
					OSStuff.grabWins.push(screens.data.contents.root);
					ostypes.API('xcb_screen_next')(screens.address()); // returns undefined
				}
				
				// ok screenI: 0 screens: xcb_screen_iterator_t(xcb_screen_t.ptr(ctypes.UInt64("0x7f9e1a93b754")), 0, 5856) HotkeyWorker.js:323:6
				// ok screenI: 1 screens: xcb_screen_iterator_t(xcb_screen_t.ptr(ctypes.UInt64("0x7f9e1abed994")), -1, 2826816) HotkeyWorker.js:323:6
				// ok screenI: 2 screens: xcb_screen_iterator_t(xcb_screen_t.ptr(ctypes.UInt64("0x7f9e1abed9bc")), -2, 40) HotkeyWorker.js:323:6
				// ok screenI: 3 screens: xcb_screen_iterator_t(xcb_screen_t.ptr(ctypes.UInt64("0x7f9e1abed9e4")), -3, 40)
				
				var rez_flush = ostypes.API('xcb_flush')(conn);
				console.log('rez_flush:', rez_flush);
				
			break;
		case 'darwin':
		
				var eventType = ostypes.TYPE.EventTypeSpec();
				eventType.eventClass = ostypes.CONST.kEventClassKeyboard;
				eventType.eventKind = ostypes.CONST.kEventHotKeyPressed;
				
				var gMyHotKeyID = ostypes.TYPE.EventHotKeyID();
				var gMyHotKeyRef = ostypes.TYPE.EventHotKeyRef();
				
				var rez_appTarget = ostypes.API('GetApplicationEventTarget')();
				console.log('rez_appTarget:', rez_appTarget);
				OSStuff.cHotKeyHandler = ostypes.TYPE.EventHandlerUPP(macHotKeyHandler);
				var rez_install = ostypes.API('InstallEventHandler')(rez_appTarget, OSStuff.cHotKeyHandler, 1, eventType.address(), null, null);
				console.log('rez_install:', rez_install);
				
				gMyHotKeyID.signature =  ostypes.TYPE.OSType('1752460081'); // has to be a four char code. MACS is http://stackoverflow.com/a/27913951/1828637 0x4d414353 so i just used htk1 as in the example here http://dbachrach.com/blog/2005/11/program-global-hotkeys-in-cocoa-easily/ i just stuck into python what the stackoverflow topic told me and got it struct.unpack(">L", "htk1")[0]
				gMyHotKeyID.id = 1;
				
				var rez_appTarget2 = ostypes.API('GetEventDispatcherTarget')();
				console.log('rez_appTarget2:', rez_appTarget2);
				var rez_reg = ostypes.API('RegisterEventHotKey')(49, ctypes_math.UInt64.add(ctypes.UInt64(ostypes.CONST.shiftKey), ctypes.UInt64(ostypes.CONST.cmdKey)), gMyHotKeyID, rez_appTarget2, 0, gMyHotKeyRef.address());
				console.log('rez_reg:', rez_reg);
				ostypes.HELPER.convertLongOSStatus(rez_reg);
				
				OSStuff.runLoopMode = ostypes.HELPER.makeCFStr('com.mozilla.firefox.nativeshot');
				
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}
}

function startEventLoop() {
	gEventLoopInterval = setInterval(checkEventLoop, gEventLoopIntervalMS);
}

function stopEventLoop() {
	clearInterval(gEventLoopInterval);
}

function checkEventLoop() {
	
	// console.log('in check loop');
	
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				var tookShot = false;
				while (ostypes.API('PeekMessage')(OSStuff.msg.address(), null, ostypes.CONST.WM_HOTKEY, ostypes.CONST.WM_HOTKEY, ostypes.CONST.PM_REMOVE)) {
					// console.log('got wParam:', OSStuff.msg.wParam);
					if (!tookShot) { // so if user pressed prnt screen multiple times during the interval, it wont trigger the shot multiple times
						if (cutils.jscEqual(OSStuff.msg.wParam, 1)) { // `1` and not `ostypes.CONST.VK_SNAPSHOT` because it reports the hotkey id, not the vk code
							tookShot = true;
							self.postMessage(['takeShot']);
						}
					}
				}
			
			break
		case 'gtk':
		
				////// var rez_pending = ostypes.API('XPending')(ostypes.HELPER.cachedXOpenDisplay());
				////// console.log('rez_pending:', rez_pending);
				////// 
				////// var evPendingCnt = parseInt(cutils.jscGetDeepest(rez_pending));
				////// console.log('evPendingCnt:', evPendingCnt);
				////// for (var i=0; i<evPendingCnt; i++) {
				////// 	//Block waiting for the next event.
				////// 	console.log('ok going to block');
				////// 	var rez_next = ostypes.API('XNextEvent')(ostypes.HELPER.cachedXOpenDisplay(), OSStuff.xev.address());
				////// 	console.log('rez_next:', rez_next);
				////// 	
				////// 	console.log('xev.xkey.type:', cutils.jscGetDeepest(OSStuff.xev.xkey.type));
				////// 	if (cutils.jscEqual(OSStuff.xev.xkey.type, ostypes.CONST.KeyPress)) {
				////// 		console.error('okkkkk key pressed!!!');
				////// 	}
				////// 	setTimeout(checkEventLoop, 0);
				////// }
				
				// var evt = ostypes.API('xcb_wait_for_event')(OSStuff.conn);
				// console.log('evt:', evt);
				// if (!evt.isNull()) {
					// console.log('evt.contents:', evt.contents);
					// ostypes.API('free')(evt);
				// }
				
				var evt = ostypes.API('xcb_poll_for_event')(OSStuff.conn);
				console.log('evt:', evt);
				if (!evt.isNull()) {
					console.log('evt.contents:', evt.contents);
					ostypes.API('free')(evt);
				}
				
			break;
		case 'darwin':
		
				// var cursorRgn = ostypes.TYPE.RgnHandle();
				var evRec = ostypes.TYPE.EventRecord();
				var everyEvent = 0;
				
				// var rez_waitEv = ostypes.API('WaitNextEvent')(everyEvent, evRec.address(), ostypes.TYPE.UInt32('32767'), cursorRgn);
				var rez_waitEv = ostypes.API('WaitNextEvent')(everyEvent, evRec.address(), 0, null);
				console.log('rez_waitEv:', rez_waitEv);
				
				// var rez_run = ostypes.API('RunCurrentEventLoop')(1);
				// console.log('rez_run:', rez_run);
				
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}
}

function macHotKeyHandler(nextHandler, theEvent, userDataPtr) {
	// EventHandlerCallRef nextHandler, EventRef theEvent, void *userData
	console.error('wooohoo ah!! called hotkey!');
	return 1; // must be of type ostypes.TYPE.OSStatus
}
// end - addon functionality

// start - common helpers
// end - common helpers