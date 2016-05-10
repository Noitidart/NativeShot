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
importScripts(core.addon.path.modules + 'ostypes/cutils.jsm');
importScripts(core.addon.path.modules + 'ostypes/ctypes_math.jsm');

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

  var earlierResult = gEarlyDispatchResults[args[0]]; // i change args[0] to data.id
  delete gEarlyDispatchResults[args[0]];
  if (Array.isArray(earlierResult) && earlierResult[0] == 'noit::throw::') {

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

		var funcName = aMsgEventData.shift();
		if (funcName in WORKER) {
			var rez_worker_call = WORKER[funcName].apply(null, aMsgEventData);
		}

	} else {

		var earlyDispatchErr;
		var earlyDispatchRes;
		try {
			earlyDispatchRes = self[aMsgEvent.data.fun](...aMsgEvent.data.args);

		} catch(earlyDispatchErr) {
			earlyDispatchRes = ['noit::throw::', earlyDispatchErr];

			// throw new Error('blah');
		}
		aMsgEvent.data.args.splice(0, 0, aMsgEvent.data.id)
		if (earlyDispatchRes && earlyDispatchRes.constructor.name == 'Promise') { // as earlyDispatchRes may be undefined

			earlyDispatchRes.then(
				function(aVal) {

					gEarlyDispatchResults[aMsgEvent.data.id] = aVal;
					worker.handleMessage(aMsgEvent);
				},
				function(aReason) {

				}
			).catch(
				function(aCatch) {

					gEarlyDispatchResults[aMsgEvent.data.id] = ['noit::throw::', aCatch];

				}
			);
		} else {

			if (earlyDispatchRes) {

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

		aCB.apply(null, aResponseArgsArr);
	};
	aPostMessageArr.push(thisCallbackId);
	self.postMessage(aPostMessageArr, aPostMessageTransferList);
};
// end - setup SIPWorker

function init(objCore) { // function name init required for SIPWorker

	
	// merge objCore into core
	// core and objCore is object with main keys, the sub props
	
	core = objCore;
	
	core.os.mname = core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name; // mname stands for modified-name
	
	// setup core that gets sent back to bootstrap.js

	// os
	core.os.name = OS.Constants.Sys.Name.toLowerCase();
	
	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc

	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.modules + 'ostypes/ostypes_win.jsm');
			break
		case 'gtk':
			importScripts(core.addon.path.modules + 'ostypes/ostypes_x11.jsm');
			break;
		case 'darwin':
			importScripts(core.addon.path.modules + 'ostypes/ostypes_mac.jsm');
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}

	
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
	var regError = registerHotkey();
	if (regError) {
		gHotkeyRegistered = false;
		return regError;
	} else {
		gHotkeyRegistered = true;
	}
	
	startEventLoop();
	

	// return core; // for SIPWorker returnung is not required
}

// start - addon functionality
var gEventLoopInterval;
const gEventLoopIntervalMS = 50;
var gHotkeyRegistered = false;

function prepTerm() {
	
	stopEventLoop();
	
	// unregister the hotkey
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
		
				if (gHotkeyRegistered) {
					var rez_unregKey = ostypes.API('UnregisterHotKey')(null, 1);

				}
				
			break
		case 'gtk':
		
				////// var rez_ungrab = ostypes.API('XUngrabKey')(ostypes.HELPER.cachedXOpenDisplay(), OSStuff.key, ostypes.CONST.None, ostypes.HELPER.cachedDefaultRootWindow());

				////// 
				////// ostypes.HELPER.ifOpenedXCloseDisplay();
				
				if (gHotkeyRegistered) {
					for (var i=0; i<OSStuff.grabWins.length; i++) {

						for (var j=0; j<OSStuff.keycodesArr.length; j++) {

							var rez_ungrab = ostypes.API('xcb_ungrab_key')(OSStuff.conn, OSStuff.keycodesArr[j], OSStuff.grabWins[i], ostypes.CONST.XCB_NONE);

							
							ostypes.API('xcb_ungrab_key')(OSStuff.conn, OSStuff.keycodesArr[j], OSStuff.grabWins[i], ostypes.CONST.XCB_MOD_MASK_LOCK); // caps lock
							ostypes.API('xcb_ungrab_key')(OSStuff.conn, OSStuff.keycodesArr[j], OSStuff.grabWins[i], ostypes.CONST.XCB_MOD_MASK_2); // num lock
							ostypes.API('xcb_ungrab_key')(OSStuff.conn, OSStuff.keycodesArr[j], OSStuff.grabWins[i], ostypes.CONST.XCB_MOD_MASK_LOCK | ostypes.CONST.XCB_MOD_MASK_2); // caps lock AND num lock
						}
					}

					var rez_flush = ostypes.API('xcb_flush')(OSStuff.conn);

					
					delete OSStuff.keycodesArr;
					delete OSStuff.grabWins;
					delete OSStuff.hotkeyLastTriggered;
				}
				
				if (OSStuff.conn) {
					ostypes.API('xcb_disconnect')(OSStuff.conn);
					delete OSStuff.conn;
				}
				
			break;
		case 'darwin':
		
				// 
				
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}
	

}

function registerHotkey() {
	// return undefined if no error. if error returns a string stating error
	
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
		
				var rez_regKey = ostypes.API('RegisterHotKey')(null, 1, ostypes.CONST.MOD_NOREPEAT, ostypes.CONST.VK_SNAPSHOT);

			
			break
		case 'gtk':
		
				var conn = ostypes.API('xcb_connect')(null, null);

				OSStuff.conn = conn;
				
				var keysyms = ostypes.API('xcb_key_symbols_alloc')(conn);


				var XK_A = 0x0041; // lower case "a" // https://github.com/semonalbertyeah/noVNC_custom/blob/60daa01208a7e25712d17f67282497626de5704d/include/keysym.js#L216
				var XK_Print = 0xff61;
				var XK_Space = 0x0020;

				// var XCB_EVENT_MASK_KEY_PRESS = 1;
				// var XCB_EVENT_MASK_BUTTON_PRESS = 4;
				// var XCB_EVENT_MASK_EXPOSURE = 32768;
				// var XCB_CW_EVENT_MASK = 2048;

				var keycodesPtr = ostypes.API('xcb_key_symbols_get_keycode')(keysyms, XK_Print);


				var keycodesArr = [];
				for (var i=0; i<10; i++) { // im just thinking 10 is a lot, usually you only have 1 keycode. mayyybe 2. 10 should cover it
					var keycodesArrC = ctypes.cast(keycodesPtr, ostypes.TYPE.xcb_keycode_t.array(i+1).ptr).contents;

					if (keycodesArrC[i] == ostypes.CONST.XCB_NO_SYMBOL) {
						break;
					}
					keycodesArr.push(keycodesArrC[i]);
				}


				if (!keycodesArr.length) {
					return 'linux no keycodes found';
					throw new Error('linux no keycodes found');
				}
				
				ostypes.API('free')(keycodesPtr);

				ostypes.API('xcb_key_symbols_free')(keysyms);

				var setup = ostypes.API('xcb_get_setup')(conn);


				var screens = ostypes.API('xcb_setup_roots_iterator')(setup);

				var grabWins = []; // so iterate through these and ungrab on remove of hotkey
				var screensCnt = screens.rem;


				for (var i=0; i<screensCnt; i++) {


					for (var j=0; j<keycodesArr.length; j++) {
						// var rez_grab = ostypes.API('xcb_grab_key')(conn, 1, screens.data.contents.root, ostypes.CONST.XCB_NONE, keycodesArr[j], ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC);
						var rez_grab = ostypes.API('xcb_grab_key_checked')(conn, 1, screens.data.contents.root, ostypes.CONST.XCB_NONE, keycodesArr[j], ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC);


						var rez_check = ostypes.API('xcb_request_check')(conn, rez_grab);

						if (!rez_check.isNull()) {

							return 'The hotkey "PrntScrn" is already in use by another function. Please go to your system control panel and find the "Global Keyboard Shortcuts" section. Then disable whatever shortcut is using "PrntScrn" as a hotkey. Then come back to Firefox, go to NativeShot options page, and toggle the "System Hotkey" setting to "Off" then back to "On".';
							throw new Error('linux grab failed');
						}
						
						ostypes.API('xcb_grab_key')(conn, 1, screens.data.contents.root, ostypes.CONST.XCB_MOD_MASK_LOCK, keycodesArr[j], ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC); // caps lock
						ostypes.API('xcb_grab_key')(conn, 1, screens.data.contents.root, ostypes.CONST.XCB_MOD_MASK_2, keycodesArr[j], ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC); // num lock
						ostypes.API('xcb_grab_key')(conn, 1, screens.data.contents.root, ostypes.CONST.XCB_MOD_MASK_LOCK | ostypes.CONST.XCB_MOD_MASK_2, keycodesArr[j], ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC); // caps lock AND num lock
					}

					// var chgValueList = ctypes.uint32_t.array()([
					//  XCB_EVENT_MASK_EXPOSURE | XCB_EVENT_MASK_BUTTON_PRESS | XCB_EVENT_MASK_KEY_PRESS
					// ]);
					// var rez_chg = xcb_change_window_attributes(conn, screens.data.contents.root, XCB_CW_EVENT_MASK, chgValueList);


					grabWins.push(screens.data.contents.root);
					ostypes.API('xcb_screen_next')(screens.address());
				}

				var rez_flush = ostypes.API('xcb_flush')(conn);

				
				OSStuff.keycodesArr = keycodesArr;
				OSStuff.grabWins = grabWins;
				OSStuff.hotkeyLastTriggered = 0;
				
			break;
		case 'darwin':
		
				var eventType = ostypes.TYPE.EventTypeSpec();
				eventType.eventClass = ostypes.CONST.kEventClassKeyboard;
				eventType.eventKind = ostypes.CONST.kEventHotKeyPressed;
				
				var gMyHotKeyID = ostypes.TYPE.EventHotKeyID();
				var gMyHotKeyRef = ostypes.TYPE.EventHotKeyRef();
				
				var rez_appTarget = ostypes.API('GetApplicationEventTarget')();

				OSStuff.cHotKeyHandler = ostypes.TYPE.EventHandlerUPP(macHotKeyHandler);
				var rez_install = ostypes.API('InstallEventHandler')(rez_appTarget, OSStuff.cHotKeyHandler, 1, eventType.address(), null, null);

				
				gMyHotKeyID.signature =  ostypes.TYPE.OSType('1752460081'); // has to be a four char code. MACS is http://stackoverflow.com/a/27913951/1828637 0x4d414353 so i just used htk1 as in the example here http://dbachrach.com/blog/2005/11/program-global-hotkeys-in-cocoa-easily/ i just stuck into python what the stackoverflow topic told me and got it struct.unpack(">L", "htk1")[0]
				gMyHotKeyID.id = 1;
				
				var rez_appTarget2 = ostypes.API('GetEventDispatcherTarget')();

				var rez_reg = ostypes.API('RegisterEventHotKey')(49, ctypes_math.UInt64.add(ctypes.UInt64(ostypes.CONST.shiftKey), ctypes.UInt64(ostypes.CONST.cmdKey)), gMyHotKeyID, rez_appTarget2, 0, gMyHotKeyRef.address());

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
	

	
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				var tookShot = false;
				while (ostypes.API('PeekMessage')(OSStuff.msg.address(), null, ostypes.CONST.WM_HOTKEY, ostypes.CONST.WM_HOTKEY, ostypes.CONST.PM_REMOVE)) {

					if (!tookShot) { // so if user pressed prnt screen multiple times during the interval, it wont trigger the shot multiple times
						if (cutils.jscEqual(OSStuff.msg.wParam, 1)) { // `1` and not `ostypes.CONST.VK_SNAPSHOT` because it reports the hotkey id, not the vk code
							tookShot = true;
							self.postMessage(['takeShot']);
						}
					}
				}
			
			break
		case 'gtk':
				
				var evt = ostypes.API('xcb_poll_for_event')(OSStuff.conn);

				if (!evt.isNull()) {

					for (var i=0; i<OSStuff.keycodesArr.length; i++) {
						if (evt.contents.response_type == ostypes.CONST.XCB_KEY_PRESS) {
							if (evt.contents.pad0 == OSStuff.keycodesArr[i]) {

								var hotkeyNowTriggered = (new Date()).getTime();
								if (hotkeyNowTriggered - OSStuff.hotkeyLastTriggered > 1000) {
									OSStuff.hotkeyLastTriggered = hotkeyNowTriggered;

									self.postMessage(['takeShot']);
								}

								break;
							}
						}
					}
					ostypes.API('free')(evt);
				}
				
			break;
		case 'darwin':
		
				// var cursorRgn = ostypes.TYPE.RgnHandle();
				var evRec = ostypes.TYPE.EventRecord();
				var everyEvent = 0;
				
				// var rez_waitEv = ostypes.API('WaitNextEvent')(everyEvent, evRec.address(), ostypes.TYPE.UInt32('32767'), cursorRgn);
				var rez_waitEv = ostypes.API('WaitNextEvent')(everyEvent, evRec.address(), 0, null);

				
				// var rez_run = ostypes.API('RunCurrentEventLoop')(1);

				
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}
}

function macHotKeyHandler(nextHandler, theEvent, userDataPtr) {
	// EventHandlerCallRef nextHandler, EventRef theEvent, void *userData

	return 1; // must be of type ostypes.TYPE.OSStatus
}
// end - addon functionality

// start - common helpers
// end - common helpers