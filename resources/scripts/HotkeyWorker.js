importScripts('chrome://nativeshot/content/resources/scripts/comm/Comm.js');
var {callInBootstrap, callInMainworker} = CommHelper.childworker;
var gWkComm = new Comm.client.worker();

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
	var regError = registerHotkey();
	if (regError) {
		gHotkeyRegistered = false;
		return regError;
	} else {
		gHotkeyRegistered = true;
	}

	startEventLoop();

	console.log('HotkeyWorker init success');
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
					console.log('rez_unregKey:', rez_unregKey, 'winLastError:', ctypes.winLastError);
				}

			break
		case 'gtk':

				////// var rez_ungrab = ostypes.API('XUngrabKey')(ostypes.HELPER.cachedXOpenDisplay(), OSStuff.key, ostypes.CONST.None, ostypes.HELPER.cachedDefaultRootWindow());
				////// console.log('rez_ungrab:', rez_ungrab);
				//////
				////// ostypes.HELPER.ifOpenedXCloseDisplay();

				if (gHotkeyRegistered) {
					for (var i=0; i<OSStuff.grabWins.length; i++) {
						console.log('ungrabbing win i:', i, OSStuff.grabWins[i]);
						for (var j=0; j<OSStuff.keycodesArr.length; j++) {
							console.log('ungrabbing key:', j, OSStuff.keycodesArr[j])
							var rez_ungrab = ostypes.API('xcb_ungrab_key')(OSStuff.conn, OSStuff.keycodesArr[j], OSStuff.grabWins[i], ostypes.CONST.XCB_NONE);
							console.log('rez_ungrab:', rez_ungrab);

							ostypes.API('xcb_ungrab_key')(OSStuff.conn, OSStuff.keycodesArr[j], OSStuff.grabWins[i], ostypes.CONST.XCB_MOD_MASK_LOCK); // caps lock
							ostypes.API('xcb_ungrab_key')(OSStuff.conn, OSStuff.keycodesArr[j], OSStuff.grabWins[i], ostypes.CONST.XCB_MOD_MASK_2); // num lock
							ostypes.API('xcb_ungrab_key')(OSStuff.conn, OSStuff.keycodesArr[j], OSStuff.grabWins[i], ostypes.CONST.XCB_MOD_MASK_LOCK | ostypes.CONST.XCB_MOD_MASK_2); // caps lock AND num lock
						}
					}

					var rez_flush = ostypes.API('xcb_flush')(OSStuff.conn);
					console.log('rez_flush:', rez_flush);

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

	console.error('ok HotkeyWorker prepped for term');
}

function registerHotkey() {
	// return undefined if no error. if error returns a string stating error

	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				var rez_regKey = ostypes.API('RegisterHotKey')(null, 1, ostypes.CONST.MOD_NOREPEAT, ostypes.CONST.VK_SNAPSHOT);
				console.log('rez_regKey:', rez_regKey);

			break
		case 'gtk':

				var conn = ostypes.API('xcb_connect')(null, null);
				console.log('conn:', conn.toString());
				OSStuff.conn = conn;

				var keysyms = ostypes.API('xcb_key_symbols_alloc')(conn);
				console.log('keysyms:', keysyms.toString());

				var XK_A = 0x0041; // lower case "a" // https://github.com/semonalbertyeah/noVNC_custom/blob/60daa01208a7e25712d17f67282497626de5704d/include/keysym.js#L216
				var XK_Print = 0xff61;
				var XK_Space = 0x0020;

				// var XCB_EVENT_MASK_KEY_PRESS = 1;
				// var XCB_EVENT_MASK_BUTTON_PRESS = 4;
				// var XCB_EVENT_MASK_EXPOSURE = 32768;
				// var XCB_CW_EVENT_MASK = 2048;

				var keycodesPtr = ostypes.API('xcb_key_symbols_get_keycode')(keysyms, XK_Print);
				console.log('keycodesPtr:', keycodesPtr.toString());

				var keycodesArr = [];
				for (var i=0; i<10; i++) { // im just thinking 10 is a lot, usually you only have 1 keycode. mayyybe 2. 10 should cover it
					var keycodesArrC = ctypes.cast(keycodesPtr, ostypes.TYPE.xcb_keycode_t.array(i+1).ptr).contents;
					console.log('keycodesArrC:', keycodesArrC);
					if (keycodesArrC[i] == ostypes.CONST.XCB_NO_SYMBOL) {
						break;
					}
					keycodesArr.push(keycodesArrC[i]);
				}

				console.log('keycodesArr:', keycodesArr);
				if (!keycodesArr.length) {
					return 'linux no keycodes found';
					throw new Error('linux no keycodes found');
				}

				ostypes.API('free')(keycodesPtr);

				ostypes.API('xcb_key_symbols_free')(keysyms);

				var setup = ostypes.API('xcb_get_setup')(conn);
				console.log('setup:', setup.contents);

				var screens = ostypes.API('xcb_setup_roots_iterator')(setup);

				var grabWins = []; // so iterate through these and ungrab on remove of hotkey
				var screensCnt = screens.rem;
				console.log('screensCnt:', screensCnt);

				for (var i=0; i<screensCnt; i++) {
					console.log('screen[' + i + ']:', screens);
					console.log('screen[' + i + '].data:', screens.data.contents);
					for (var j=0; j<keycodesArr.length; j++) {
						// var rez_grab = ostypes.API('xcb_grab_key')(conn, 1, screens.data.contents.root, ostypes.CONST.XCB_NONE, keycodesArr[j], ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC);
						var rez_grab = ostypes.API('xcb_grab_key_checked')(conn, 1, screens.data.contents.root, ostypes.CONST.XCB_NONE, keycodesArr[j], ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC);
						console.log('rez_grab:', rez_grab);

						var rez_check = ostypes.API('xcb_request_check')(conn, rez_grab);
						console.log('rez_check:', rez_check.toString());
						if (!rez_check.isNull()) {
							// console.error('grab failed! error:', rez_check.contents);
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
					// console.log('rez_chg:', rez_chg);

					grabWins.push(screens.data.contents.root);
					ostypes.API('xcb_screen_next')(screens.address());
				}

				var rez_flush = ostypes.API('xcb_flush')(conn);
				console.log('rez_flush:', rez_flush);

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

				var evt = ostypes.API('xcb_poll_for_event')(OSStuff.conn);
				// console.log('evt:', evt);
				if (!evt.isNull()) {
					console.error('evt.contents:', evt.contents);
					for (var i=0; i<OSStuff.keycodesArr.length; i++) {
						if (evt.contents.response_type == ostypes.CONST.XCB_KEY_PRESS) {
							if (evt.contents.pad0 == OSStuff.keycodesArr[i]) {
								console.error('hotkey pressed! evt.pad0:', evt.contents.pad0, 'keycodesArr:', OSStuff.keycodesArr);
								var hotkeyNowTriggered = (new Date()).getTime();
								if (hotkeyNowTriggered - OSStuff.hotkeyLastTriggered > 1000) {
									OSStuff.hotkeyLastTriggered = hotkeyNowTriggered;
									console.warn('taking shot');
									self.postMessage(['takeShot']);
								}
								else { console.warn('will not takeShot as 1sec has not yet elapsed since last triggering hotkey'); }
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
