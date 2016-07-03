// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('chrome://nativeshot/content/resources/scripts/comm/Comm.js');
var {callInBootstrap, callInChildworker1} = CommHelper.mainworker;


// Globals
var core;

var gBsComm = new Comm.client.worker();
var gOcrComm;
var callInOcrComm = Comm.callInX.bind(null, 'gOcrComm', null);

var gHydrants; // keys are getPage() names, like NewRecordingPage and value is an object which is its hydrant

function dummyForInstantInstantiate() {}
function init(objCore) {
	//console.log('in worker init');

	core = objCore;

	gOcrComm = new Com.server.worker(core.addon.path.scripts + 'OCRWorker.js');

	importScripts(core.addon.path.scripts + 'supplement/MainWorkerSupplement.js');

	addOsInfoToCore();

	core.addon.path.storage = OS.Path.join(OS.Constants.Path.profileDir, 'jetpack', core.addon.id, 'simple-storage');
	core.addon.path.log = OS.Path.join(core.addon.path.storage, 'history-log.unbracketed.json');
	core.addon.path.editorstate = OS.Path.join(core.addon.path.storage, 'editorstate.json');
	core.addon.path.prefs = OS.Path.join(core.addon.path.storage, 'prefs.json');

	// load all localization pacakages
	formatStringFromName('blah', 'main');
	formatStringFromName('blah', 'app');
	core.addon.l10n = _cache_formatStringFromName_packages;

	// Import ostypes
	importScripts(core.addon.path.scripts + 'ostypes/cutils.jsm');
	importScripts(core.addon.path.scripts + 'ostypes/ctypes_math.jsm');
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.scripts + 'ostypes/ostypes_win.jsm');
			break
		case 'gtk':
			importScripts(core.addon.path.scripts + 'ostypes/ostypes_x11.jsm');
			break;
		case 'darwin':
			importScripts(core.addon.path.scripts + 'ostypes/ostypes_mac.jsm');
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}

	// OS Specific Init
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				//

			break;
		case 'gtk':

				//

			break;
		case 'darwin':

				//

			break;
		default:
			// do nothing special
	}

	// setTimeoutSync(1000); // i want to delay 1sec to allow old framescripts to destroy

	return core;
}

// Start - Addon Functionality
self.onclose = function() {
	console.log('doing mainworker term proc');

	writePrefsToFile();

	Comm.server.unregAll('worker');

	switch (core.os.mname) {
		case 'android':

				if (OSStuff.jenv) {
					JNI.UnloadClasses(OSStuff.jenv);
				}

			break;
		case 'gtk':

				ostypes.HELPER.ifOpenedXCBConnClose();

			break;
	}

	console.log('ok ready to terminate');
}

function trashFile(aFilePlatPath) {
	// aFilePlatPath is a js string

	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				// http://stackoverflow.com/a/23721071/1828637
				var sfo = ostypes.TYPE.SHFILEOPSTRUCT();
				sfo.hwnd = null;
				sfo.wFunc = ostypes.CONST.FO_DELETE;
				sfo.pFrom = ostypes.TYPE.PCZZTSTR.targetType.array(aFilePlatPath.length + 2)(aFilePlatPath); // + 2 because we need it double terminated, that is the definition of PCZZTSTR per the msdn docs
				sfo.pTo = null;
				sfo.fFlags = ostypes.CONST.FOF_ALLOWUNDO | ostypes.CONST.FOF_NOCONFIRMATION | ostypes.CONST.FOF_NOERRORUI | ostypes.CONST.FOF_SILENT;
				sfo.fAnyOperationsAborted = 0;
				sfo.hNameMappings = null;
				sfo.lpszProgressTitle = null;

				console.log('sfo.pFrom:', sfo.pFrom.toString());

				var rez_trash = ostypes.API('SHFileOperation')(sfo.address());
				console.log('rez_trash:', rez_trash);
				console.log('sfo.fAnyOperationsAborted:', sfo.fAnyOperationsAborted);

				if (cutils.jscEqual(rez_trash, 0)) {
					return true;
				} else {
					return false;
				}


			break;
		case 'gtk':

				var cGFile = ostypes.API('g_file_new_for_path')(aFilePlatPath);
				console.log('cGFile:', cGFile);

				var rez_trash = ostypes.API('g_file_trash')(cGFile, null, null);
				console.log('rez_trash:', rez_trash);

				if (cutils.jscEqual(rez_trash, 1)) {
					return true;
				} else {
					// i have only seen it be 0 on fail
					return false;
				}

			break;
		case 'darwin':

				// http://stackoverflow.com/a/18069259/1828637
				var trashNSStrings = new ostypes.HELPER.nsstringColl();
				try {

					var NSArray = ostypes.HELPER.class('NSArray');
					// var cNSArray = ostypes.API('objc_msgSend')(NSArray, ostypes.HELPER.sel('array'));

					var NSURL = ostypes.HELPER.class('NSURL');
					console.log('aFilePlatPath:', aFilePlatPath);

					var cMacUrl = ostypes.API('objc_msgSend')(NSURL, ostypes.HELPER.sel('fileURLWithPath:isDirectory:'), trashNSStrings.get(aFilePlatPath), ostypes.CONST.NO);
					console.log('cMacUrl:', cMacUrl);
					if (cMacUrl.isNull()) {
						console.error('failed to create NSURL');
						return false;
					}

					var cMacUrlArray = ostypes.API('objc_msgSend')(NSArray, ostypes.HELPER.sel('arrayWithObject:'), cMacUrl);
					console.log('cMacUrlArray:', cMacUrlArray);

					var NSWorkspace = ostypes.HELPER.class('NSWorkspace');

					var sharedWorkspace = ostypes.API('objc_msgSend')(NSWorkspace, ostypes.HELPER.sel('sharedWorkspace'));

					var rez_trash = ostypes.API('objc_msgSend')(sharedWorkspace, ostypes.HELPER.sel('recycleURLs:completionHandler:'), cMacUrlArray, ostypes.CONST.NIL); // verified that NIL is not modified it is still 0x0 after calling this
					console.log('rez_trash:', rez_trash); // value is meaningless

					// as val of rez_trash is meaningless i have to check until its trashed. i dont think this function blocks till trash completes, so i loop below
					var TRASHED_CHECK_INTERVAL = 100; // ms
					var MAX_TRASHED_CHECK_CNT = Math.ceil(10000 / TRASHED_CHECK_INTERVAL); // checks for 10,000 ms
					var trashed_check_i = 0;
					while (trashed_check_i < MAX_TRASHED_CHECK_CNT) {
						var trashedFileExists = OS.File.exists(aFilePlatPath);
						console.log(trashed_check_i, 'trashedFileExists:', trashedFileExists);
						if (!trashedFileExists) {
							// yes it was trashed
							return true;
						}
						setTimeoutSync(TRASHED_CHECK_INTERVAL);
						trashed_check_i++;
					}
					return false; // checked max times, and the file is still not yet trashed, so report false for rez_trash

					// with callback block - this cannot be run from ChromeWorker's - this is a firefox bug i have to link the bugzilla here
					// var handlerId = new Date().getTime();
					// OSStuff[handlerId] = {};
					//
					// OSStuff[handlerId].myHandler_js = function(NSURLs, error) {
					// 	console.error('handler called');
					//
					// 	console.log('error:', error, error.toString(), error.isNull());
					//
					// 	// return nothing as per its IMP
					// };
					// ostypes.TYPE.NSURLs = ctypes.voidptr_t;
					// ostypes.TYPE.NSError = ctypes.voidptr_t;
					// var IMP_for_completionHandler = ctypes.FunctionType(ostypes.TYPE.CALLBACK_ABI, ostypes.TYPE.VOID, [ostypes.TYPE.NSURLs, ostypes.TYPE.NSError]);
					// OSStuff[handlerId].myHandler_c = IMP_for_completionHandler.ptr(OSStuff[handlerId].myHandler_js);
					// var myBlock_c = ostypes.HELPER.createBlock(OSStuff[handlerId].myHandler_c);
					//
					// var rez_trash = ostypes.API('objc_msgSend')(sharedWorkspace, ostypes.HELPER.sel('recycleURLs:completionHandler:'), cMacUrlArray, myBlock_c.address()); // verified that NIL is not modified it is still 0x0 after calling this
					// console.log('rez_trash:', rez_trash);


				} finally {
					if (trashNSStrings) {
						trashNSStrings.releaseAll()
					}
				}

			break;
		default:
			throw new Error('os not supported ' + core.os.name);
	}
}

// start - platform functions
function shootAllMons() {

	var collMonInfos = [];
	var aScreenshotBuffersToTransfer = [];

	// if (core.os.name.indexOf('win') === 0) {
		// if (!SetProcessDpiAwareness) {
			// var shcore = ctypes.open('shcore');
			// SetProcessDpiAwareness = shcore.declare('SetProcessDpiAwareness', ostypes.TYPE.ABI, ostypes.TYPE.HRESULT, ostypes.TYPE.int);
		// }

		// var PROCESS_PER_MONITOR_DPI_AWARE = 2;
		// var rez_setaware = SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);
		// console.log('rez_setaware:', rez_setaware, 'convertPrimHrToHex:', convertPrimHrToHex(rez_setaware));
	// }

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

				var swapBandRinUint8 = function(aUint8) {
					var pos = 0;
					var cArrLen = aUint8.length;
					while (pos < cArrLen) {
						var B = aUint8[pos];

						aUint8[pos] = aUint8[pos+2];
						aUint8[pos+2] = B;
						aUint8[pos+3] = 255;

						pos += 4;
					}
				};

				// start - take shot of each monitor
				var dpiScaleX;
				var dpiScaleY;
				for (var s=0; s<collMonInfos.length; s++) {

					var hdcScreen = ostypes.API('CreateDC')(collMonInfos[s].otherInfo.lpszDriver, collMonInfos[s].otherInfo.lpszDevice, null, null);

					if (ctypes.winLastError != 0) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcScreen, winLastError: "' + ctypes.winLastError + '" and hdcScreen: "' + hdcScreen.toString(),
							winLastError: ctypes.winLastError
						});
					}

					if (s == 0) {
						var dpiX = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.LOGPIXELSX)));
						var dpiY = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.LOGPIXELSY)));
						// console.log('dpiX:', dpiX, 'dpiY:', dpiY);
						dpiScaleX = dpiX / 96; // because 96 is default which is 1
						dpiScaleY = dpiY / 96;
					}

					if (core.os.version >= 6.3) { // for scale purposes for non dpi aware process due to bug 890156
						collMonInfos[s].otherInfo.scaledWidth = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.HORZRES)));
						collMonInfos[s].otherInfo.scaledHeight = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.VERTRES)));
						// var win81ScaleX = collMonInfos[s].w / collMonInfos[s].otherInfo.scaledWidth;
						// var win81ScaleY = collMonInfos[s].h / collMonInfos[s].otherInfo.scaledHeight;
						var win81ScaleX = (collMonInfos[s].w / collMonInfos[s].otherInfo.scaledWidth) * dpiScaleX;
						var win81ScaleY = (collMonInfos[s].h / collMonInfos[s].otherInfo.scaledHeight) * dpiScaleY;
						if (win81ScaleX != 1) {
							collMonInfos[s].win81ScaleX = win81ScaleX;
						}
						if (win81ScaleY != 1) {
							collMonInfos[s].win81ScaleY = win81ScaleY;
						}
					} else if (dpiScaleX != 1 || dpiScaleY != 1) {
						// console.log('dpiScaleX, dpiScaleY', dpiScaleX, dpiScaleY);
						collMonInfos[s].win81ScaleX = dpiScaleX;
						collMonInfos[s].win81ScaleY = dpiScaleY;
						// console.log('win81ScaleX, win81ScaleY', collMonInfos[s].win81ScaleX, collMonInfos[s].win81ScaleY);
					}

					var w = collMonInfos[s].w;
					var h = collMonInfos[s].h;

					var modW = w % 4;
					var useW = modW != 0 ? w + (4-modW) : w;
					// console.log('useW:', useW, 'w:', w);

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



					var arrLen = w * h * 4;
					// var imagedata = new ImageData(useW, h);
					var monShotBuf = new ArrayBuffer(arrLen);


					var pixelBufferLen = w * h *4; // cannot use arrLen here as that uses useW which is not w, if i do memcpy will crash obviously
					ostypes.API('memcpy')(monShotBuf, pixelBuffer, pixelBufferLen);


					var monShotUint8 = new Uint8Array(monShotBuf);

					// swap bytes to go from BRGA to RGBA
					// Reorganizing the byte-order is necessary as canvas can only hold data in RGBA format (little-endian, ie. ABGR in the buffer). Here is one way to do this:

					swapBandRinUint8(monShotUint8);


					collMonInfos[s].screenshotArrBuf = monShotBuf;
					aScreenshotBuffersToTransfer.push(collMonInfos[s].screenshotArrBuf);

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

				// get root window
				var setup = ostypes.API('xcb_get_setup')(ostypes.HELPER.cachedXCBConn());
				console.log('setup:', setup.contents);

				var screens = ostypes.API('xcb_setup_roots_iterator')(setup);
				var rootWin = screens.data.contents.root;
				console.log('rootWin:', rootWin);

				// get screens
				var reqScreens = ostypes.API('xcb_randr_get_screen_resources_current')(ostypes.HELPER.cachedXCBConn(), rootWin);
				var replyScreens = ostypes.API('xcb_randr_get_screen_resources_current_reply')(ostypes.HELPER.cachedXCBConn(), reqScreens, null);

				console.log('replyScreens:', replyScreens);
				console.log('replyScreens.contents:', replyScreens.contents);

				var timestamp = replyScreens.contents.config_timestamp;
				console.log('timestamp:', timestamp);

				var len = ostypes.API('xcb_randr_get_screen_resources_current_outputs_length')(replyScreens);
				console.log('len:', len);

				var randr_outputs = ostypes.API('xcb_randr_get_screen_resources_current_outputs')(replyScreens);
				console.log('randr_outputs:', randr_outputs);

				randr_outputs = ctypes.cast(randr_outputs, ostypes.TYPE.xcb_randr_output_t.array(len).ptr).contents;
				console.log('casted randr_outputs:', randr_outputs);

				for (var i=0; i<len; i++) {
					console.log('randr_outputs[i]:', randr_outputs[i]);
					var reqOutput = ostypes.API('xcb_randr_get_output_info')(ostypes.HELPER.cachedXCBConn(), randr_outputs[i], timestamp);
					var output = ostypes.API('xcb_randr_get_output_info_reply')(ostypes.HELPER.cachedXCBConn(), reqOutput, null);

					console.log('output:', output);
					console.log('output.contents:', output.contents);

					if (output.isNull()) {
						console.warn('got null output but will continue to len');
						continue;
					}

					if (cutils.jscEqual(output.contents.crtc, ostypes.CONST.XCB_NONE) || cutils.jscEqual(output.contents.connection, ostypes.CONST.XCB_RANDR_CONNECTION_DISCONNECTED)) {
						console.warn('continue becuase its XCB_NONE or XCB_RANDR_CONNECTION_DISCONNECTED');
						continue;
					}

					var reqCrtc = ostypes.API('xcb_randr_get_crtc_info')(ostypes.HELPER.cachedXCBConn(), output.contents.crtc, timestamp);
					var crtc = ostypes.API('xcb_randr_get_crtc_info_reply')(ostypes.HELPER.cachedXCBConn(), reqCrtc, null);

					console.log('crtc.contents:', crtc.contents);

					collMonInfos.push({
						x: parseInt(cutils.jscGetDeepest(crtc.contents.x)),
						y: parseInt(cutils.jscGetDeepest(crtc.contents.y)),
						w: parseInt(cutils.jscGetDeepest(crtc.contents.width)),
						h: parseInt(cutils.jscGetDeepest(crtc.contents.height)),
						screenshot: null // for x11, i take the big canvas and protion to each mon
					});

					ostypes.API('free')(crtc);
					ostypes.API('free')(output);
				}

				ostypes.API('free')(replyScreens);



				// end - get all monitor resolutions

				// start - take shot of all monitors and push to just first element of collMonInfos
				// https://github.com/BoboTiG/python-mss/blob/a4d40507c492962d59fcb97a509ede1f4b8db634/mss.py#L116

				// // this call to XGetWindowAttributes grab one screenshot of all monitors
				// var gwa = ostypes.TYPE.XWindowAttributes();
				// var rez_XGetWinAttr = ostypes.API('XGetWindowAttributes')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), gwa.address());
                //
				//
				// var fullWidth = parseInt(cutils.jscGetDeepest(gwa.width));
				// var fullHeight = parseInt(cutils.jscGetDeepest(gwa.height));
				// var originX = parseInt(cutils.jscGetDeepest(gwa.x));
				// var originY = parseInt(cutils.jscGetDeepest(gwa.y));

				// figure out full width/height, and x y
				var minX = collMonInfos[0].x;
				var maxX = collMonInfos[0].x + collMonInfos[0].w;
				var minY = collMonInfos[0].y;
				var maxY = collMonInfos[0].y + collMonInfos[0].h;
				for (var i=1; i<collMonInfos.length; i++) {
					var cMinX = collMonInfos[i].x;
					var cMaxX = collMonInfos[i].x + collMonInfos[i].w;
					var cMinY = collMonInfos[i].y;
					var cMaxY = collMonInfos[i].y + collMonInfos[i].h;

					if (cMinX < minX) {
						minX = cMinX;
					}
					if (cMaxX > maxX) {
						maxX = cMaxX;
					}
					if (cMinY < minY) {
						minY = cMinY;
					}
					if (cMaxY > maxY) {
						maxY = cMaxY;
					}
				}

				var fullWidth = maxX - minX;
				var fullHeight = maxY - minY;

				console.log(minX, minY, maxX, maxY, fullWidth, fullHeight);

				// capture shot
				var reqShot = ostypes.API('xcb_get_image')(ostypes.HELPER.cachedXCBConn(), ostypes.CONST.XCB_IMAGE_FORMAT_Z_PIXMAP, rootWin, minX, minY, fullWidth, fullHeight, ostypes.CONST.XCB_ALL_PLANES);
				var replyShot = ostypes.API('xcb_get_image_reply')(ostypes.HELPER.cachedXCBConn(), reqShot, null);

				console.log('replyShot:', replyShot);
				console.log('replyShot.contents:', replyShot.contents);

				var dataShot = ostypes.API('xcb_get_image_data')(replyShot);
				console.log('dataShot:', dataShot);

				var fullLen = 4 * fullWidth * fullHeight;

				var allShotBuf = new ArrayBuffer(fullWidth * fullHeight * 4);

				ostypes.API('memcpy')(allShotBuf, dataShot, fullLen);

				// should call XDestroyImage on ximage
				ostypes.API('free')(replyShot);

				var allShotUint8 = new Uint8Array(allShotBuf);
				// end - take shot of all monitors and push to just first element of collMonInfos

				// start - because took a single screenshot of alllll put togather, lets portion out the imagedata


				// optimized linux from 1900ms down to 45ms from chat on #extdev on sept 18 2015 ~430-630am
				var portionOutAllToMonFromBgra0ToRgba255 = function(cutoutMonW, cutoutMonH, cutoutMonX, cutoutMonY) {
					// returns aMonUint
					var monShotBuf = new ArrayBuffer(cutoutMonW * cutoutMonH * 4);
					var monShotUint8 = new Uint8Array(monShotBuf);

					var allShotEndY = cutoutMonY + cutoutMonH;
					var allShotEndX = cutoutMonX + cutoutMonW;
					var si = 0;
					for (var y=cutoutMonY; y<allShotEndY; y++) {
						var pixY = (fullWidth * y << 2); // << 2 is same as * 4
						for (var x=cutoutMonX; x<allShotEndX; x++) {
							var pixXY = pixY + (x << 2);
							var B = allShotUint8[pixXY];
							monShotUint8[si] = allShotUint8[pixXY+2];
							monShotUint8[si+1] = allShotUint8[pixXY+1];
							monShotUint8[si+2] = B;
							monShotUint8[si+3] = 255;
							si += 4;
						}
					}

					return monShotBuf;
				};

				for (var i=0; i<collMonInfos.length; i++) {
					var monUseW = collMonInfos[i].w;
					var monUseH = collMonInfos[i].h;

					collMonInfos[i].screenshotArrBuf = portionOutAllToMonFromBgra0ToRgba255(monUseW, monUseH, collMonInfos[i].x, collMonInfos[i].y);
					aScreenshotBuffersToTransfer.push(collMonInfos[i].screenshotArrBuf);
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

				var minScreenX;
				var minScreenY;

				var rect = ostypes.CONST.CGRectNull;
				// var primaryDisplayRect;
				var primaryDisplayRectInfo;

				for (var i=0; i<count; i++) {
					// if display is secondary mirror of another display, skip it


					var rez_CGDisplayMirrorsDisplay = ostypes.API('CGDisplayMirrorsDisplay')(displays[i]);


					if (!cutils.jscEqual(rez_CGDisplayMirrorsDisplay, ostypes.CONST.kCGNullDirectDisplay)) { // If CGDisplayMirrorsDisplay() returns 0 (a.k.a. kCGNullDirectDisplay), then that means the display is not mirrored.
						continue;
					}
					i_nonMirror[i] = collMonInfos.length; // the length here, will be the i index of the CGDisplayBounds in collMonInfos

					var rez_CGDisplayBounds = ostypes.API('CGDisplayBounds')(displays[i]);


					collMonInfos.push({
						x: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.origin.x)),
						y: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.origin.y)),
						w: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.size.width)),
						h: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.size.height)),
						screenshot: null // for darwin, i take the big canvas and protion to each mon
					});

					if (minScreenX === undefined) {
						minScreenX = collMonInfos[i_nonMirror[i]].x;
						minScreenY = collMonInfos[i_nonMirror[i]].y;
					} else {
						if (collMonInfos[i_nonMirror[i]].x < minScreenX) {
							minScreenX = collMonInfos[i_nonMirror[i]].x;
						}
						if (collMonInfos[i_nonMirror[i]].y < minScreenY) {
							minScreenY = collMonInfos[i_nonMirror[i]].y;
						}
					}

					if (!primaryDisplayRectInfo) {
						// assuming the first non mirror is primary per http://stackoverflow.com/questions/28216681/how-can-i-get-screenshot-from-all-displays-on-mac/28247749#comment53261634_28247749
						collMonInfos[collMonInfos.length-1].primary = true;
						// primaryDisplayRect = rez_CGDisplayBounds;
						primaryDisplayRectInfo = collMonInfos[collMonInfos.length-1];
					}

					// rez_CGDisplayBounds.origin.y = ostypes.API('CGRectGetMaxY')(primaryDisplayRect) - ostypes.API('CGRectGetMaxY')(displayRect);
					// need to do correction just on Y and not on X because "Y coordinate because that's the only difference between Cocoa's coordinate system and Core Graphics' coordinate system" // http://stackoverflow.com/questions/28216681/how-can-i-get-screenshot-from-all-displays-on-mac/28247749#comment53248403_28247749
					rez_CGDisplayBounds.origin.y = (primaryDisplayRectInfo.y + primaryDisplayRectInfo.h) - (collMonInfos[collMonInfos.length-1].y + collMonInfos[collMonInfos.length-1].h); // because CGRectGetMaxY is just ` rect.origin.y + rect.size.height;` as per https://github.com/joshpc/SBLayoutManager/blob/b899e10834d27f3569b5a8e2de296f19b8f9003d/SBLayoutManager/CGRectHelpers.m#L22 // and also [0] instead of primaryDisplayRect as the first one is primary monitor per link5233423
					collMonInfos[collMonInfos.length-1].corrected_y = rez_CGDisplayBounds.origin.y;
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
					var rez_hideCursor = ostypes.API('CGDisplayHideCursor')(ostypes.CONST.kCGNullDirectDisplay);

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
						myNSStrings.get('NSDeviceRGBColorSpace'),							// colorSpaceName
						ostypes.TYPE.NSBitmapFormat(0),											// bitmapFormat
						ostypes.TYPE.NSInteger(4 * rez_width),									// bytesPerRow
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



					var rectOriginX = parseInt(cutils.jscGetDeepest(rect.origin.x));
					var rectOriginY = parseInt(cutils.jscGetDeepest(rect.origin.y));






					// note: i_nonMirror, keys are the i value it corresponds to in displays Array, and value is the i value it corresponds to in collMonInfos Array
					for (var i in i_nonMirror) { // if display is secondary mirror of another display, skip it

						// CGRect displayRect = CGDisplayBounds(displays[i]);
						// var displayRect = ostypes.API('CGDisplayBounds')(displays[i]);



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
							collMonInfos[i_nonMirror[i]].x - rectOriginX,
							collMonInfos[i_nonMirror[i]].corrected_y - rectOriginY,
							collMonInfos[i_nonMirror[i]].w,
							collMonInfos[i_nonMirror[i]].h
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

					// // start - write to desktop
					// // NSData* data = [imageRep representationUsingType:NSPNGFileType properties:@{ }];
					//
					// var NSDictionary = ostypes.HELPER.class('NSDictionary');
					// var tempDict = ostypes.API('objc_msgSend')(NSDictionary, ostypes.HELPER.sel('dictionary')); //gives us temporary dicationary, one that gets auto released? well whatever its something not allocated so we dont have to release it
                    //
					//
					// var data = ostypes.API('objc_msgSend')(imageRep, ostypes.HELPER.sel('representationUsingType:properties:'), ostypes.CONST.NSPNGFileType, tempDict); // https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ApplicationKit/Classes/NSBitmapImageRep_Class/index.html#//apple_ref/occ/instm/NSBitmapImageRep/representationUsingType:properties:
					//
					// // [data writeToFile:@"/tmp/screenshot.png" atomically:YES];
					// var rez_writeToFile = ostypes.API('objc_msgSend')(data, ostypes.HELPER.sel('writeToFile:atomically:'), myNSStrings.get(OS.Path.join(OS.Constants.Path.desktopDir, 'full_ss.png')), ostypes.CONST.YES);
                    //
					// // end - write to desktop

					// start - try to get byte array
					// [imageRep bitmapData]
					var rgba_buf = ostypes.API('objc_msgSend')(imageRep, ostypes.HELPER.sel('bitmapData'));


					rez_width = parseInt(cutils.jscGetDeepest(rez_width));
					rez_height = parseInt(cutils.jscGetDeepest(rez_height));

					var bitmapBytesPerRow = rez_width * 4;
					var bitmapByteCount = bitmapBytesPerRow * rez_height;

					// var rgba_arr = ctypes.cast(rgba_buf, ostypes.TYPE.unsigned_char.array(bitmapByteCount).ptr).contents;



					var allShotBuf = new ArrayBuffer(bitmapByteCount);



					ostypes.API('memcpy')(allShotBuf, rgba_buf, bitmapByteCount);


					var allShotUint8 = new Uint8Array(allShotBuf);
					// end - try to get byte array
				} finally {

					var rez_showCursor = ostypes.API('CGDisplayShowCursor')(ostypes.CONST.kCGNullDirectDisplay);

					if (allocNSBIP) {
						var rez_relNSBPI = ostypes.API('objc_msgSend')(allocNSBIP, ostypes.HELPER.sel('release'));

					}
					if (myNSStrings) {
						myNSStrings.releaseAll()
					}

				}
				// end - take one big screenshot of all monitors

				// start - because took a single screenshot of alllll put togather, lets portion out the imagedata


				var portionOutAllToMonAnd255 = function(cutoutMonW, cutoutMonH, cutoutMonX, cutoutMonY) {
					// returns aMonUint
					var monShotBuf = new ArrayBuffer(cutoutMonW * cutoutMonH * 4);
					var monShotUint8 = new Uint8Array(monShotBuf);

					var allShotEndY = cutoutMonY + cutoutMonH;
					var allShotEndX = cutoutMonX + cutoutMonW;
					var si = 0;
					for (var y=cutoutMonY; y<allShotEndY; y++) {
						var pixY = (rez_width * y << 2); // << 2 is same as * 4
						for (var x=cutoutMonX; x<allShotEndX; x++) {
							var pixXY = pixY + (x << 2);
							monShotUint8[si] = allShotUint8[pixXY];
							monShotUint8[si+1] = allShotUint8[pixXY+1];
							monShotUint8[si+2] = allShotUint8[pixXY+2];
							monShotUint8[si+3] = 255;
							si += 4;
						}
					}

					return monShotBuf;
				};

				for (var i=0; i<collMonInfos.length; i++) {
					var monUseW = collMonInfos[i].w;
					var monUseH = collMonInfos[i].h;


					collMonInfos[i].screenshotArrBuf = portionOutAllToMonAnd255(monUseW, monUseH, collMonInfos[i].x - minScreenX, collMonInfos[i].y - minScreenY);
					aScreenshotBuffersToTransfer.push(collMonInfos[i].screenshotArrBuf);
				}

				// end - because took a single screenshot of alllll put togather, lets portion out the imagedata

			break;
		default:
			throw new Error('os not supported ' + core.os.name);
	}

	var rezOfFunc = new PromiseWorker.Meta(collMonInfos, {transfers: aScreenshotBuffersToTransfer});
	collMonInfos = null;
	aScreenshotBuffersToTransfer = null;
	return rezOfFunc;
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

				// start - post analysis, per http://stackoverflow.com/questions/31914311/correlate-groups-from-xquerytree-data-to-a-window?noredirect=1#comment53135178_31914311
				var analyzedArr = [];
				var pushItBlock = function() {
					if (cWinObj) {

						// start - mini algo to find proper x and y. it first gets max x and y. if they are both 0, then it checks if min x and y are negative and then set its to that (as user may have set up window to left or above or something)
						var minLeft = Math.min.apply(Math, cWinObj.left);
						var minTop = Math.min.apply(Math, cWinObj.top);
						cWinObj.left = Math.max.apply(Math, cWinObj.left);
						cWinObj.top = Math.max.apply(Math, cWinObj.top);

						if (cWinObj.left == 0 && cWinObj.top == 0) {
							if (minLeft != -1 && minTop != -1) {
								cWinObj.left = minLeft;
								cWinObj.top = minTop;
							}
						}
						// end - mini algo to find proper x and y
						cWinObj.width = Math.max.apply(Math, cWinObj.width);
						cWinObj.height = Math.max.apply(Math, cWinObj.height);

						cWinObj.right = cWinObj.left + cWinObj.width;
						cWinObj.bottom = cWinObj.top + cWinObj.height;

						analyzedArr.push(cWinObj);
					}
				}

				var cWinObj = null;
				for (var i = 0; i < rezWinArr.length; i++) {
					if (rezWinArr[i].pid || rezWinArr[i].title) { // apparently sometimes you can hvae a new win title but no pid. like after "browser console" came a "compiz" title but no pid on it
						pushItBlock();
						cWinObj = {
							pid: rezWinArr[i].pid,
							left: [],
							top: [],
							width: [],
							height: []
						};
					}
					if (cWinObj) {
						cWinObj.left.push(rezWinArr[i].left);
						cWinObj.top.push(rezWinArr[i].top);
						cWinObj.width.push(rezWinArr[i].width);
						cWinObj.height.push(rezWinArr[i].height);
						if (rezWinArr[i].title) {
							cWinObj.title = rezWinArr[i].title;
						}
					}
				}
				pushItBlock();

				// post pushing analysis
				// 1) remove all windows who have height and width of 1
				for (var i = 0; i < analyzedArr.length; i++) {
					if (analyzedArr[i].width == 1 && analyzedArr[i].height == 1) {
						analyzedArr.splice(i, 1);
						i--;
					}
				}
				// 2) remove all windows who have height and width == to Desktop which is that last entry
				if (analyzedArr[analyzedArr.length - 1].title != 'Desktop') {

				}
				var deskW = analyzedArr[analyzedArr.length - 1].width;
				var deskH = analyzedArr[analyzedArr.length - 1].height;
				for (var i = 0; i < analyzedArr.length - 1; i++) { // - 1 as we dont want the very last item
					if (analyzedArr[i].width == deskW && analyzedArr[i].height == deskH) {
						analyzedArr.splice(i, 1);
						i--;
					}
				}
				/*
				// 3) remove windows up till and including the last window with title "nativeshot_canvas"
				var iOfLastNativeshotCanvas = -1;
				for (var i = 0; i < analyzedArr.length; i++) {
					if (analyzedArr[i].title == 'nativeshot_canvas') {
						iOfLastNativeshotCanvas = i;
					}
				}
				if (iOfLastNativeshotCanvas > -1) {
					analyzedArr.splice(0, iOfLastNativeshotCanvas + 1);
				}
				*/
				// set rezWinArr to analyzedArr

				rezWinArr = analyzedArr;
				// end - post analysis

			break;
		case 'darwin':

				var cfarr_win = ostypes.API('CGWindowListCopyWindowInfo')(ostypes.CONST.kCGWindowListOptionOnScreenOnly, ostypes.CONST.kCGNullWindowID);
				try {
					var myNSStrings = new ostypes.HELPER.nsstringColl();

					var cnt_win = ostypes.API('CFArrayGetCount')(cfarr_win);

					cnt_win = parseInt(cutils.jscGetDeepest(cnt_win));


					for (var i=0; i<cnt_win; i++) {
						var thisWin = {};
						var c_win = ostypes.API('CFArrayGetValueAtIndex')(cfarr_win, i);

						if (aOptions.hwndAsPtr) {
							var windowNumber = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowNumber')); // (NSString *)[window objectForKey:@"kCGWindowName"];
							// console.log('windowNumber:', windowNumber, cutils.jscGetDeepest(windowNumber), cutils.jscGetDeepest(windowNumber, 10), cutils.jscGetDeepest(windowNumber, 16)); // >>> windowNumber: ctypes.voidptr_t(ctypes.UInt64("0xb37")) ctypes.voidptr_t(ctypes.UInt64("0xb37")) 2871 b37

							var windowNumberIntVal = ostypes.API('objc_msgSend')(windowNumber, ostypes.HELPER.sel('intValue'));
							// console.log('windowNumberIntVal:', windowNumberIntVal, cutils.jscGetDeepest(windowNumberIntVal), cutils.jscGetDeepest(windowNumberIntVal, 10), cutils.jscGetDeepest(windowNumberIntVal, 16)) // >>> windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0xb")) ctypes.voidptr_t(ctypes.UInt64("0xb")) 11 b

							// results of console logging
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x6137")) ctypes.voidptr_t(ctypes.UInt64("0x6137")) 24887 6137 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x61")) ctypes.voidptr_t(ctypes.UInt64("0x61")) 97 61 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1d37")) ctypes.voidptr_t(ctypes.UInt64("0x1d37")) 7479 1d37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x1d")) ctypes.voidptr_t(ctypes.UInt64("0x1d")) 29 1d ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1237")) ctypes.voidptr_t(ctypes.UInt64("0x1237")) 4663 1237 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x12")) ctypes.voidptr_t(ctypes.UInt64("0x12")) 18 12 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1737")) ctypes.voidptr_t(ctypes.UInt64("0x1737")) 5943 1737 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x17")) ctypes.voidptr_t(ctypes.UInt64("0x17")) 23 17 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1137")) ctypes.voidptr_t(ctypes.UInt64("0x1137")) 4407 1137 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x11")) ctypes.voidptr_t(ctypes.UInt64("0x11")) 17 11 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1337")) ctypes.voidptr_t(ctypes.UInt64("0x1337")) 4919 1337 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x13")) ctypes.voidptr_t(ctypes.UInt64("0x13")) 19 13 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x337")) ctypes.voidptr_t(ctypes.UInt64("0x337")) 823 337 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x3")) ctypes.voidptr_t(ctypes.UInt64("0x3")) 3 3 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0xd37")) ctypes.voidptr_t(ctypes.UInt64("0xd37")) 3383 d37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0xd")) ctypes.voidptr_t(ctypes.UInt64("0xd")) 13 d ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x6537")) ctypes.voidptr_t(ctypes.UInt64("0x6537")) 25911 6537 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x65")) ctypes.voidptr_t(ctypes.UInt64("0x65")) 101 65 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x19a37")) ctypes.voidptr_t(ctypes.UInt64("0x19a37")) 105015 19a37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x19a")) ctypes.voidptr_t(ctypes.UInt64("0x19a")) 410 19a ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x18237")) ctypes.voidptr_t(ctypes.UInt64("0x18237")) 98871 18237 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x182")) ctypes.voidptr_t(ctypes.UInt64("0x182")) 386 182 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x18737")) ctypes.voidptr_t(ctypes.UInt64("0x18737")) 100151 18737 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x187")) ctypes.voidptr_t(ctypes.UInt64("0x187")) 391 187 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x437")) ctypes.voidptr_t(ctypes.UInt64("0x437")) 1079 437 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x4")) ctypes.voidptr_t(ctypes.UInt64("0x4")) 4 4 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0xe37")) ctypes.voidptr_t(ctypes.UInt64("0xe37")) 3639 e37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0xe")) ctypes.voidptr_t(ctypes.UInt64("0xe")) 14 e ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0xb37")) ctypes.voidptr_t(ctypes.UInt64("0xb37")) 2871 b37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0xb")) ctypes.voidptr_t(ctypes.UInt64("0xb")) 11 b ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x237")) ctypes.voidptr_t(ctypes.UInt64("0x237")) 567 237 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x2")) ctypes.voidptr_t(ctypes.UInt64("0x2")) 2 2 ScreenshotWorker.js:461:1

							thisWin.hwndCGWindowID = parseInt(cutils.jscGetDeepest(windowNumberIntVal, 10));
						}

						if (aOptions.getTitle) {
							var windowName = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowName')); // (NSString *)[window objectForKey:@"kCGWindowName"];
							var windowNameLen = ostypes.API('objc_msgSend')(windowName, ostypes.HELPER.sel('length'));

							windowNameLen = ctypes.cast(windowNameLen, ostypes.TYPE.NSUInteger);

							windowNameLen = parseInt(cutils.jscGetDeepest(windowNameLen));


							if (windowNameLen == 0) { // can be 0 as its stated that kCGWindowName is an optional source: https://developer.apple.com/library/mac/documentation/Carbon/Reference/CGWindow_Reference/Constants/Constants.html#//apple_ref/doc/constant_group/Required_Window_List_Keys
								thisWin.title = '';
							} else {
								var utf8str = ostypes.API('objc_msgSend')(windowName, ostypes.HELPER.sel('UTF8String'));
								var str_casted = ctypes.cast(utf8str, ostypes.TYPE.char.array(windowNameLen+1).ptr).contents; // +1 as it doesnt include the null char, and readString needs that

								thisWin.title = str_casted.readString();
							}
						}

						if (aOptions.getPid) {
							var rez_pid = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowOwnerPID'));


							// rez_pid = ctypes.cast(rez_pid, ostypes.TYPE.NSInteger);


							// rez_pid = parseInt(cutils.jscGetDeepest(rez_pid));

							// thisWin.pid = rez_pid;

							var int_pid = ostypes.API('objc_msgSend')(rez_pid, ostypes.HELPER.sel('integerValue'));
							int_pid = ctypes.cast(int_pid, ostypes.TYPE.NSInteger);


							int_pid = parseInt(cutils.jscGetDeepest(int_pid));

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


							var bounds = ostypes.TYPE.CGRect();
							rez_bs = ctypes.cast(rez_bs, ostypes.TYPE.CFDictionaryRef);


							var rez_makeBounds = ostypes.API('CGRectMakeWithDictionaryRepresentation')(rez_bs, bounds.address());




							thisWin.left = parseInt(cutils.jscGetDeepest(bounds.origin.x));
							thisWin.top = parseInt(cutils.jscGetDeepest(bounds.origin.y));
							thisWin.width = parseInt(cutils.jscGetDeepest(bounds.size.width));
							thisWin.height = parseInt(cutils.jscGetDeepest(bounds.size.height));

							thisWin.right = thisWin.left + thisWin.width;
							thisWin.bottom = thisWin.top + thisWin.height;
						}

						rezWinArr.push(thisWin);
					}

					// post analysis
					// 1) remove all windows who have height and width == to Desktop which is that last entry
					// osx has multiple desktop elements, if two mon, then two desktops, i can know number of mon by counting number of "nativeshot_canvas" titled windows
					// and nativeshot_canvas width and height is equal to that of its respective desktop width and height
					var numDesktop = 0;
					var desktopDimWxH = [];
					for (var i=0; i<rezWinArr.length; i++) {
						if (rezWinArr[i].title == 'Desktop') {
							numDesktop++;
							desktopDimWxH.push(rezWinArr[i]);
						}
					}
					// now splice out all things that have any dimensions matching these EXCEPT the last numMon elements as they will be titled Desktop
					// for (var i=rezWinArr.length-numDesktop; i<rezWinArr.length; i++) {
					// 	if (rezWinArr[i].title != 'DesktopAA') {
                    //
					// 	}
					// }
					for (var i=0; i<rezWinArr.length; i++) {
						var cWin = rezWinArr[i];
						if (cWin.title == 'Desktop') {
							continue;
						}
						for (var j=0; j<numDesktop; j++) {
							var cDesktop = desktopDimWxH[j];
							if (cWin.width == cDesktop.width && cWin.height == cDesktop.height && cWin.left == cDesktop.left && cWin.top == cDesktop.top) {
								rezWinArr.splice(i, 1);
								i--;
								break;
							}
						}
					}

					// // 2) splice out the editor contextmenu, which will be the first blank titled thing after the first nativeshot_canvas
					// var nativeshotCanvasPID = 0;
					// for (var i = 0; i < rezWinArr.length - 1; i++) { // - 1 as we dont want the very last item
					// 	if (rezWinArr[i].title == 'nativeshot_canvas') { // need to leave nativeshot_canvas in as mainthread uses it as a pointer position to start from
					// 		nativeshotCanvasPID = rezWinArr[i].pid;
					// 	}
					// 	if (!nativeshotCanvasPID) {
					// 		continue;
					// 	} else {
					// 		if (rezWinArr[i].pid == nativeshotCanvasPID && rezWinArr[i].title == '') {
					// 			// first non titled thing with same pid after the first nativeshot_canvas should be the right click contextmenu of editor
					// 			rezWinArr.splice(i, 1);
					// 			break;
					// 		}
					// 	}
					// }
					// end - post analysis
				} finally {
					ostypes.API('CFRelease')(cfarr_win);

					if (myNSStrings) {
						myNSStrings.releaseAll()
					}
				}

			break;
		default:

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
	console.error('in setWinAlwaysOnTop. aArrHwndPtrStr:', aArrHwndPtrStr)
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':


				for (var i=0; i<aArrHwndPtrStr.length; i++) {

					var hwndStr = aArrHwndPtrStr[i];
					var hwndPtr = ostypes.TYPE.HWND(ctypes.UInt64(hwndStr));

					// var lpString = ostypes.TYPE.LPTSTR.targetType.array(500)();
					// var nWinTitleLen = ostypes.API('GetWindowText')(hwndPtr, lpString, lpString.length);
					// var nWinTitle = lpString.readString();
					// console.log('nWinTitle:', nWinTitle);

					// start - remove border from window - http://stackoverflow.com/a/2400467/1828637
					var GWL_STYLE = -16;
					var WS_CAPTION = 0x00C00000;
					var WS_THICKFRAME = 0x00040000;
					var WS_MINIMIZE = 0x20000000;
					var WS_MAXIMIZE = 0x01000000;
					var WS_SYSMENU = 0x00080000;

					var lStyle = ostypes.API('GetWindowLongPtr')(hwndPtr, GWL_STYLE);
					console.log('lStyle:', lStyle);
					lStyle &= ~(WS_CAPTION | WS_THICKFRAME | WS_MINIMIZE | WS_MAXIMIZE | WS_SYSMENU);

					var rez_setLong = ostypes.API('SetWindowLongPtr')(hwndPtr, GWL_STYLE, lStyle);
					console.log('rez_setLong:', rez_setLong);

					// var GWL_EXSTYLE = -20;
					// var WS_EX_DLGMODALFRAME = 0x00000001;
					// var WS_EX_CLIENTEDGE = 0x00000200;
					// var WS_EX_STATICEDGE = 0x00020000;

					// var lExStyle = ostypes.API('GetWindowLongPtr')(hwndPtr, GWL_EXSTYLE);
					// console.log('lExStyle:', lExStyle);
					// lExStyle &= ~(WS_EX_DLGMODALFRAME | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE);

					// var rez_setLong = ostypes.API('SetWindowLongPtr')(hwndPtr, GWL_EXSTYLE, lExStyle);
					// console.log('rez_setLong:', rez_setLong);


					var SWP_FRAMECHANGED = 0x0020;
					var rez_setTop = ostypes.API('SetWindowPos')(hwndPtr, ostypes.CONST.HWND_TOPMOST, aOptions[hwndStr].left, aOptions[hwndStr].top, aOptions[hwndStr].width, aOptions[hwndStr].height, SWP_FRAMECHANGED/* | ostypes.CONST.SWP_NOREDRAW*/); // window wasnt moved so no need for SWP_NOREDRAW, the NOMOVE and NOSIZE params make it ignore x, y, cx, and cy
					// end try to remove that border

					// var rez_setTop = ostypes.API('SetWindowPos')(hwndPtr, ostypes.CONST.HWND_TOPMOST, aOptions[hwndStr].left, aOptions[hwndStr].top, aOptions[hwndStr].width, aOptions[hwndStr].height, 0/* | ostypes.CONST.SWP_NOREDRAW*/); // window wasnt moved so no need for SWP_NOREDRAW, the NOMOVE and NOSIZE params make it ignore x, y, cx, and cy
					// var rez_setTop = ostypes.API('SetWindowPos')(aHwnd, ostypes.CONST.HWND_TOPMOST, aOptions[aArrHwndPtrStr[i]].left, aOptions[aArrHwndPtrStr[i]].top, aOptions[aArrHwndPtrStr[i]].width, aOptions[aArrHwndPtrStr[i]].height, ostypes.CONST.SWP_NOSIZE | ostypes.CONST.SWP_NOMOVE | ostypes.CONST.SWP_NOREDRAW);
				}
				console.log('will force focus now');
				var rez_winForceFocus = winForceForegroundWindow(hwndPtr); // use the last hwndPtr, i just need to focus one of my canvas windows // so if user hits esc it will work, otherwise the keyboard focus is in the other app even though my canvas window is top most
				// console.log('rez_winForceFocus:', rez_winForceFocus);

			break;
		case 'gtk':

				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					console.log('hwndPtr:', hwndPtr);
					var XWindow = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					console.log('XWindow1a:', XWindow);
					XWindow = parseInt(cutils.jscGetDeepest(XWindow));
					console.log('XWindow1b:', XWindow);

					// setTimeout(function() {
						var rez_unmap = ostypes.API('xcb_unmap_window')(ostypes.HELPER.cachedXCBConn(), XWindow);
						console.log('rez_unmap', rez_unmap);

						// var rez_flush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
						// console.log('rez_flush', rez_flush);

						var chgValueList = ostypes.TYPE.uint32_t.array()([
							1
						]);
						var rez_chg = ostypes.API('xcb_change_window_attributes')(ostypes.HELPER.cachedXCBConn(), XWindow, ostypes.CONST.XCB_CW_OVERRIDE_REDIRECT, chgValueList);
						console.log('rez_chg:', rez_chg);

						var rez_map = ostypes.API('xcb_map_window')(ostypes.HELPER.cachedXCBConn(), XWindow);
						console.log('rez_map', rez_map);

						// var rez_flush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
						// console.log('rez_flush', rez_flush);

						// raise the window
						var rez_raise = ostypes.API('xcb_configure_window')(ostypes.HELPER.cachedXCBConn(), XWindow, ostypes.CONST.XCB_CONFIG_WINDOW_STACK_MODE, ostypes.TYPE.uint32_t.array()([ostypes.CONST.XCB_STACK_MODE_ABOVE]));
						console.log('rez_raise:', rez_raise);

						// Set input focus (we have override_redirect=1, so the wm will not do this for us)
						// i cannot use XCB_NONE i have to use XCB_INPUT_FOCUS_POINTER_ROOT as otherwise keys are not working
						var rez_focus = ostypes.API('xcb_set_input_focus')(ostypes.HELPER.cachedXCBConn(), ostypes.CONST.XCB_INPUT_FOCUS_POINTER_ROOT, XWindow, ostypes.CONST.XCB_CURRENT_TIME);
						console.log('rez_focus:', rez_focus);

						// // Grab the keyboard to get all input
						// var reqGrab = ostypes.API('xcb_grab_keyboard')(ostypes.HELPER.cachedXCBConn(), false, XWindow, ostypes.CONST.XCB_CURRENT_TIME, ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC);
						// var replyGrab = ostypes.API('xcb_grab_keyboard_reply')(ostypes.HELPER.cachedXCBConn(), reqGrab, null);
						// console.error('replyGrab:', replyGrab);
						// console.error('replyGrab.contents:', replyGrab.contents);
						// console.error('replyGrab.status:', replyGrab.contents.status);

						var rez_flush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
						console.log('rez_flush', rez_flush);

					// }, 5000);
				}



				////// // http://stackoverflow.com/a/4347486/5062337
				////// // do this stuff up here as if it doesnt exist it will throw now, rather then go through set allocate xevent then find out when setting xevent.xclient data that its not available
				////// var atom_wmStateAbove = ostypes.HELPER.cachedAtom('_NET_WM_STATE_ABOVE');
				////// var atom_wmState = ostypes.HELPER.cachedAtom('_NET_WM_STATE');
				////// var atom_wmActive = ostypes.HELPER.cachedAtom('_NET_ACTIVE_WINDOW');
				//////
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
                //////
				////// 	var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	console.log('hwndPtr:', hwndPtr);
				////// 	var XWindow = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				////// 	console.log('XWindow:', XWindow);
                //////
				////// 	// set window always on top
				////// 	var xevent = ostypes.TYPE.XEvent();
				//////
				////// 	xevent.xclient.type = ostypes.CONST.ClientMessage;
				////// 	xevent.xclient.serial = 0;
				////// 	xevent.xclient.send_event = ostypes.CONST.True;
				////// 	xevent.xclient.display = ostypes.HELPER.cachedXOpenDisplay();
				////// 	xevent.xclient.window = XWindow;
				////// 	xevent.xclient.message_type = atom_wmState;
				////// 	xevent.xclient.format = 32; // because xclient.data is long, i defined that in the struct union
				////// 	xevent.xclient.data = ostypes.TYPE.long.array(5)([ostypes.CONST._NET_WM_STATE_ADD, atom_wmStateAbove, 0, 0, 0]);
				//////
				////// 	console.log('xevent set');
				////// 	var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address());
				////// 	console.log('rez_SendEv set on top:', rez_SendEv);
				//////
				////// 	// focus the window
				////// 	var xevent = ostypes.TYPE.XEvent();
				//////
				////// 	xevent.xclient.type = ostypes.CONST.ClientMessage;
				////// 	xevent.xclient.serial = 0;
				////// 	xevent.xclient.send_event = ostypes.CONST.True;
				////// 	xevent.xclient.display = ostypes.HELPER.cachedXOpenDisplay();
				////// 	xevent.xclient.window = XWindow; // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				////// 	xevent.xclient.message_type = atom_wmState;
				////// 	xevent.xclient.format = 32; // because xclient.data is long, i defined that in the struct union
				////// 	xevent.xclient.data = ostypes.TYPE.long.array(5)([ostypes.CONST._NET_WM_STATE_ADD, atom_wmStateAbove, 0, 0, 0]);
				//////
				////// 	var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top
                //////     console.log('rez_SendEv focus:', rez_SendEv);
				//////
				////// 	var rez_xmap = ostypes.API('XMapRaised')(ostypes.HELPER.cachedXOpenDisplay(), xevent.xclient.window);
				////// 	console.log('rez_xmap:', rez_xmap);
				//////
				////// 	// xevent.xclient.data[1] = ostypes.HELPER.cachedAtom('_NET_WM_STATE_STICKY');
				////// 	// var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top
                //////
				//////
				////// 	// xevent.xclient.data[1] = ostypes.HELPER.cachedAtom('_NET_WM_STATE_FULLSCREEN');
				////// 	// var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top
                //////
                //////
				////// 	/*
				////// 	// testing XListProperties
				////// 	var numAtoms = ostypes.TYPE.int();
				////// 	var rez_ListProp = ostypes.API('XListProperties')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, numAtoms.address());
                //////
                //////
				////// 	//if (cutils.jscEqual(rez_ListProp, ostypes.CONST.BadWindow)) { // need to figure out how to test this, it seems when rez_ListProp is null, so im not sure how to get BadWindow its just not returning it // throw new Error('XListProperties failed with reason BadWindow'); // }
				////// 	if (rez_ListProp.isNull()) {
				////// 		// then probably failed
				////// 		throw new Error('XListProperties probably failed with BadWindow BUT is possible the window really has no properties set on it in which case i should not throw error on this line');
				////// 	}
				//////
				////// 	var atomsJS = ctypes.cast(rez_ListProp, ostypes.TYPE.Atom.array(parseInt(cutils.jscGetDeepest(numAtoms))).ptr).contents;
                //////
				////// 	var atomsC = rez_ListProp;
				////// 	numAtoms = parseInt(cutils.jscGetDeepest(numAtoms));
				//////
				////// 	// ostypes.API('XFree')(rez_ListProp); // must be done
				//////
				////// 	// test XGetAtomNames
				//////
				////// 	// // var atomsJS = [
				////// 	// // 	1,
				////// 	// // 	2,
				////// 	// // 	3
				////// 	// // ];
				////// 	// // var numAtoms = atomsJS.length;
				////// 	// // var atomsC = ostypes.TYPE.Atom.array(atomsJS.length)(atomsJS);
				//////
				//////
				////// 	var atomNames = ostypes.TYPE.char.ptr.array(numAtoms)();
                //////
				////// 	var rez_GetANames = ostypes.API('XGetAtomNames')(ostypes.HELPER.cachedXOpenDisplay(), atomsC, numAtoms, atomNames);
                //////
				////// 	if (cutils.jscEqual(rez_GetANames, 0)) {
				////// 		throw new Error('failed XGetAtomNames');
				////// 	}
                //////
				//////
				////// 	for (var i=0; i<atomNames.length; i++) {
                //////
				////// 		//ostypes.API('XFree')(atomNames[i]);
				////// 	}
				//////
				////// 	// doing XFree on atomNames seemed to cause an eventual crash, so i did XFree on each element and that seemed to not crash, i am now trying to see if I can do a XFreeStringList instead of XFree on each item
				////// 	//ostypes.API('XFreeStringList')(atomNames);
				//////
				////// 	// XFreeStringList crashes it almost immediately
				////// 	// XFree on atomNames crashes it eventually
				////// 	// XFree on each element seems the only crash free way
				////// 	ostypes.API('XFreeStringList')(atomNames);
				////// 	ostypes.API('XFree')(rez_ListProp); // must be done
                //////
				////// 	return;
				//////
				////// 	// https://github.com/HarveyHunt/barney/blob/bf43fef9ce95d1f7e2150973c2a28e0970bd8dfb/barney/bar.py#L199
				////// 	// the reason this XChangeProperty on _NET_WM_STATE is not working is because explained here: "http://standards.freedesktop.org/wm-spec/wm-spec-1.3.html#idm140130317612768" --> "A Client wishing to change the state of a window MUST send a _NET_WM_STATE client message to the root window (see below). The Window Manager MUST keep this property updated to reflect the current state of the window." meaning the WM will handle setting this, and I should be ADDing this from XSendEvent
				////// 	var dataJS = [
				////// 		ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE_DOCK')
				////// 	];
				////// 	var dataC = ostypes.TYPE.Atom.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE'), ostypes.CONST.XA_ATOM, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
                //////
				////// 	// make window show on all desktops
				////// 	var dataJS = [
				////// 		ostypes.TYPE.Atom('0xFFFFFFFF') // means all desktops
				////// 	];
				////// 	var dataC = ostypes.TYPE.Atom.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, ostypes.HELPER.cachedAtom('_NET_WM_DESKTOP'), ostypes.CONST.XA_CARDINAL, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				//////
				////// 	// // change window title
				////// 	// var dataJS = [
				////// 	// 	String.charCodeAt('r'),
				////// 	// 	String.charCodeAt('a'),
				////// 	// 	String.charCodeAt('w'),
				////// 	// ];
				////// 	// var dataC = ostypes.TYPE.unsigned_char.array(dataJS.length)(dataJS);
				////// 	// var dataCCasted = dataC; // no need to cast as it is already 8 byte //ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	// var dataFormat = 8; // cuz unsigned_long
				////// 	// var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, ostypes.HELPER.cachedAtom('_NET_WM_NAME'), ostypes.HELPER.cachedAtom('UTF8_STRING'), dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				////// 	*/
				////// }
				//////
				////// ostypes.API('XFlush')(ostypes.HELPER.cachedXOpenDisplay()); // will not set on top if you dont do this, wont even change window title name which was done via XChangeProperty, MUST FLUSH
				//////
				////// /*
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
                //////
				////// 	var gdkWinPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	var gtkWinPtr = ostypes.HELPER.gdkWinPtrToGtkWinPtr(gdkWinPtr);
				////// 	ostypes.API('gtk_window_set_keep_above')(gtkWinPtr, 1);
				////// }
				////// */
				//////
				////// /*
				////// // try changing STRUT and STRUT_PARTIAL
				////// var atom_wmStrut = ostypes.HELPER.cachedAtom('_NET_WM_STRUT_PARTIAL');
				////// var atom_wmStrutPartial = ostypes.HELPER.cachedAtom('_NET_WM_STRUT_PARTIAL');
				//////
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
				////// 	var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	var Window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				//////
				////// 	var dataJS = [
				////// 		0,
				////// 		0,
				////// 		0,
				////// 		0
				////// 	];
				////// 	var dataC = ostypes.TYPE.unsigned_long.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), atom_wmStrut, ostypes.CONST.XA_CARDINAL, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				////// }
				////// */
				////// /*
				////// // try changing WM_WINDOW_TYPE properties
				////// var atom_wmWindowType = ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE');
				////// var atom_wmWindowTypeDock = ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE_DOCK');
				//////
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
				////// 	var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	var Window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				//////
				////// 	var dataJS = [
				////// 		atom_wmWindowTypeDock
				////// 	];
				////// 	var dataC = ostypes.TYPE.Atom.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), atom_wmWindowType, ostypes.CONST.XA_ATOM, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				////// }
				////// */
				////// /*
				////// // try changing WM_STATE properties
				////// var atom_wmWmState = ostypes.HELPER.cachedAtom('_NET_WM_STATE');
				////// var atom_wmStateAbove = ostypes.HELPER.cachedAtom('_NET_WM_STATE_ABOVE');
				////// var atom_wmStateFullscreen = ostypes.HELPER.cachedAtom('_NET_WM_STATE_FULLSCREEN');
				////// var atom_wmStateAttn = ostypes.HELPER.cachedAtom('_NET_WM_STATE_DEMANDS_ATTENTION');;
				//////
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
				////// 	var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	var Window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				//////
				////// 	var dataJS = [
				////// 		atom_wmStateAbove,
				////// 		atom_wmStateFullscreen,
				////// 		atom_wmStateAttn
				////// 	];
				////// 	var dataC = ostypes.TYPE.unsigned_long.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), atom_wmState, ostypes.CONST.XA_ATOM, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				////// }
				////// */
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
				// unregister, unalloc, etc all `OSStuff.setWinAlwaysOnTop_****` and delete js key pairs from OSStuff if you want it re-registered later on

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


				// METHOD: do on main thread with this key
				var rez_getKey = ostypes.API('CGWindowLevelForKey')(ostypes.CONST.kCGMainMenuWindowLevelKey); // to avoid that constraint issue


				// METHOD: dont set on top just focus app, this has that ugly scroll side affect if user is focused on another desktop on that monitor due to full screen app or something
				focusSelfApp();

				return parseInt(cutils.jscGetDeepest(rez_getKey));

			break;
		default:

	}
}

function gtkRaiseWindow(aArrHwndPtrStr) {
	switch (core.os.mname) {
		case 'winnt':

				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					var hwndPtr = ostypes.TYPE.HWND(ctypes.UInt64(aArrHwndPtrStr[i]));

					// while (true) {
						var rez_focus = ostypes.API('SetForegroundWindow')(hwndPtr);
						console.log('rez_focus:', rez_focus);

						var hFrom = ostypes.API('GetForegroundWindow')();
						if (hFrom.isNull()) {
							// nothing in foreground, so calling process is free to focus anything
							console.error('nothing in foreground right now');
							// continue;
						}
						console.log('hFrom:', hFrom, 'hTo:', hwndPtr);
						if (cutils.comparePointers(hFrom, hwndPtr) === 0) {
							console.error('succesfully focused window, hwndPtr:', hwndPtr);
							// break;
						}
					// }
				}

			break;
		case 'gtk':
				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					console.log('hwndPtr:', hwndPtr);
					var XWindow = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					console.log('XWindow1a:', XWindow);
					XWindow = parseInt(cutils.jscGetDeepest(XWindow));
					console.log('XWindow1b:', XWindow);

					var rez_raise = ostypes.API('xcb_configure_window')(ostypes.HELPER.cachedXCBConn(), XWindow, ostypes.CONST.XCB_CONFIG_WINDOW_STACK_MODE, ostypes.TYPE.uint32_t.array()([ostypes.CONST.XCB_STACK_MODE_ABOVE]));
					console.log('rez_raise:', rez_raise);

					// Set input focus (we have override_redirect=1, so the wm will not do this for us)
					// i cannot use XCB_NONE i have to use XCB_INPUT_FOCUS_POINTER_ROOT as otherwise keys are not working
					var rez_focus = ostypes.API('xcb_set_input_focus')(ostypes.HELPER.cachedXCBConn(), ostypes.CONST.XCB_INPUT_FOCUS_POINTER_ROOT, XWindow, ostypes.CONST.XCB_CURRENT_TIME);
					console.log('rez_focus:', rez_focus);
				}

				var rez_flush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
				console.log('rez_flush', rez_flush);
			break;
	}
}

function trashFile(aFilePlatPath) {
	// aFilePlatPath is a js string

	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				// http://stackoverflow.com/a/23721071/1828637
				var sfo = ostypes.TYPE.SHFILEOPSTRUCT();
				sfo.hwnd = null;
				sfo.wFunc = ostypes.CONST.FO_DELETE;
				sfo.pFrom = ostypes.TYPE.PCZZTSTR.targetType.array(aFilePlatPath.length + 2)(aFilePlatPath); // + 2 because we need it double terminated, that is the definition of PCZZTSTR per the msdn docs
				sfo.pTo = null;
				sfo.fFlags = ostypes.CONST.FOF_ALLOWUNDO | ostypes.CONST.FOF_NOCONFIRMATION | ostypes.CONST.FOF_NOERRORUI | ostypes.CONST.FOF_SILENT;
				sfo.fAnyOperationsAborted = 0;
				sfo.hNameMappings = null;
				sfo.lpszProgressTitle = null;

				console.log('sfo.pFrom:', sfo.pFrom.toString());

				var rez_trash = ostypes.API('SHFileOperation')(sfo.address());
				console.log('rez_trash:', rez_trash);
				console.log('sfo.fAnyOperationsAborted:', sfo.fAnyOperationsAborted);

				if (cutils.jscEqual(rez_trash, 0)) {
					return true;
				} else {
					return false;
				}


			break;
		case 'gtk':

				var cGFile = ostypes.API('g_file_new_for_path')(aFilePlatPath);
				console.log('cGFile:', cGFile);

				var rez_trash = ostypes.API('g_file_trash')(cGFile, null, null);
				console.log('rez_trash:', rez_trash);

				if (cutils.jscEqual(rez_trash, 1)) {
					return true;
				} else {
					// i have only seen it be 0 on fail
					return false;
				}

			break;
		case 'darwin':

				// http://stackoverflow.com/a/18069259/1828637
				var trashNSStrings = new ostypes.HELPER.nsstringColl();
				try {

					var NSArray = ostypes.HELPER.class('NSArray');
					// var cNSArray = ostypes.API('objc_msgSend')(NSArray, ostypes.HELPER.sel('array'));

					var NSURL = ostypes.HELPER.class('NSURL');
					console.log('aFilePlatPath:', aFilePlatPath);

					var cMacUrl = ostypes.API('objc_msgSend')(NSURL, ostypes.HELPER.sel('fileURLWithPath:isDirectory:'), trashNSStrings.get(aFilePlatPath), ostypes.CONST.NO);
					console.log('cMacUrl:', cMacUrl);
					if (cMacUrl.isNull()) {
						console.error('failed to create NSURL');
						return false;
					}

					var cMacUrlArray = ostypes.API('objc_msgSend')(NSArray, ostypes.HELPER.sel('arrayWithObject:'), cMacUrl);
					console.log('cMacUrlArray:', cMacUrlArray);

					var NSWorkspace = ostypes.HELPER.class('NSWorkspace');

					var sharedWorkspace = ostypes.API('objc_msgSend')(NSWorkspace, ostypes.HELPER.sel('sharedWorkspace'));

					var rez_trash = ostypes.API('objc_msgSend')(sharedWorkspace, ostypes.HELPER.sel('recycleURLs:completionHandler:'), cMacUrlArray, ostypes.CONST.NIL); // verified that NIL is not modified it is still 0x0 after calling this
					console.log('rez_trash:', rez_trash); // value is meaningless

					// as val of rez_trash is meaningless i have to check until its trashed. i dont think this function blocks till trash completes, so i loop below
					var TRASHED_CHECK_INTERVAL = 100; // ms
					var MAX_TRASHED_CHECK_CNT = Math.ceil(10000 / TRASHED_CHECK_INTERVAL); // checks for 10,000 ms
					var trashed_check_i = 0;
					while (trashed_check_i < MAX_TRASHED_CHECK_CNT) {
						var trashedFileExists = OS.File.exists(aFilePlatPath);
						console.log(trashed_check_i, 'trashedFileExists:', trashedFileExists);
						if (!trashedFileExists) {
							// yes it was trashed
							return true;
						}
						setTimeoutSync(TRASHED_CHECK_INTERVAL);
						trashed_check_i++;
					}
					return false; // checked max times, and the file is still not yet trashed, so report false for rez_trash

					// with callback block - this cannot be run from ChromeWorker's - this is a firefox bug i have to link the bugzilla here
					// var handlerId = new Date().getTime();
					// OSStuff[handlerId] = {};
					//
					// OSStuff[handlerId].myHandler_js = function(NSURLs, error) {
					// 	console.error('handler called');
					//
					// 	console.log('error:', error, error.toString(), error.isNull());
					//
					// 	// return nothing as per its IMP
					// };
					// ostypes.TYPE.NSURLs = ctypes.voidptr_t;
					// ostypes.TYPE.NSError = ctypes.voidptr_t;
					// var IMP_for_completionHandler = ctypes.FunctionType(ostypes.TYPE.CALLBACK_ABI, ostypes.TYPE.VOID, [ostypes.TYPE.NSURLs, ostypes.TYPE.NSError]);
					// OSStuff[handlerId].myHandler_c = IMP_for_completionHandler.ptr(OSStuff[handlerId].myHandler_js);
					// var myBlock_c = ostypes.HELPER.createBlock(OSStuff[handlerId].myHandler_c);
					//
					// var rez_trash = ostypes.API('objc_msgSend')(sharedWorkspace, ostypes.HELPER.sel('recycleURLs:completionHandler:'), cMacUrlArray, myBlock_c.address()); // verified that NIL is not modified it is still 0x0 after calling this
					// console.log('rez_trash:', rez_trash);


				} finally {
					if (trashNSStrings) {
						trashNSStrings.releaseAll()
					}
				}

			break;
		default:
			throw new Error('os not supported ' + core.os.name);
	}
}
// end - platform functions

////// start - specific helper functions
function readPrefsFromFile() {

}
function writePrefsToFile() {

}
function getPref() {

}
function setPref() {

}
function autogenScreenshotFileName(aDateGettime) {
	// no extension generated

	// Screencast - Mmm DD, YYYY - hh:mm AM
	// Screencast - Feb 25, 2016 - 5:04 AM

	var nowDate = new Date();
	if (aDateGettime) {
		nowDate = new Date(aDateGettime);
	}

	var Mmm = formatStringFromName('month.' + (nowDate.getMonth() + 1) + '.Mmm', 'chrome://global/locale/dateFormat.properties');
	var YYYY = nowDate.getFullYear();
	var DD = nowDate.getDate();

	var mm = nowDate.getMinutes();
	var hh = nowDate.getHours(); // 0 - 23
	var AM;
	if (hh < 12) {
		AM = 'AM';
	} else {
		AM = 'PM';
	}

	// adjust hh to 12 hour
	if (hh === 0) {
		hh = 12;
	} else if (hh > 12) {
		hh -= 12;
	}

	// prefix mm with 0
	if (mm < 10) {
		mm = '0' + mm;
	}

	return [formatStringFromName('screenshot', 'main'), ' - ', Mmm, ' ', DD, ', ', YYYY, ' ', hh, ':', mm, ' ', AM].join('');
}

function getPathForAction(path, rec, unsafe_filename) {
	// unsafe_filename is either a string, or undefined. if undefined, rec.time is used with autogenScreencastFileName
	// after unsafe_filename is a string, it is safedForPlatFS
	if (!unsafe_filename) {
		unsafe_filename = autogenScreencastFileName(unsafe_filename);
	}

	return OS.Path.join( path, safedForPlatFS(unsafe_filename, {repStr:'.'}) ) + '.' + rec.mimetype.substr(rec.mimetype.indexOf('/')+1);
}


function buildOSFileErrorString(aMethod, aOSFileError) {
	// aMethod:string - enum[writeAtomic]

	switch (aMethod) {
		case 'writeAtomic':
				var explain;
				if (aOSFileError.becauseNoSuchFile) {
					explain = formatStringFromName('osfileerror_writeatomic_nosuchfile', 'main');
				} else {
					explain = formatStringFromName('osfileerror_unknownreason', 'main');
				}
				formatStringFromName('osfileerror_' + aMethod, 'app', [explain, aOSFileError.winLastError || aOSFileError.unixErrno])
			break;
	}
}

function genericOnUploadProgress(rec, aReportProgress, e) {

	var total_size = formatBytes(rec.arrbuf.byteLength, 1);


	var percent;
	var uploaded_size;
	if (e.lengthComputable) {
		percent = Math.round((e.loaded / e.total) * 100);
		uploaded_size = formatBytes(e.loaded, 1);
	} else {
		percent = '?';
		uploaded_size = '?';
	}

	aReportProgress({
		reason: formatStringFromName('uploading_progress', 'app', [percent, uploaded_size, total_size])
	});
};

////// start - non-oauth actions
function action_browse(rec, aActionFinalizer, aReportProgress) {}
////// start - non-oauth actions


// start - functions called by bootstrap
function fetchHydrant(head, aComm) {
	// returns undefined if no hydrant, otherwise the page will overwrite its hydrant with an empty object which will screw up all the default values for redux

	if (!gHydrants) {
		try {
			gHydrants = JSON.parse(OS.File.read(OS.Path.join(core.addon.path.storage, 'hydrants.json'), {encoding:'utf-8'}));
		} catch (OSFileError) {
			if (OSFileError.becauseNoSuchFile) {
				gHydrants = {};
			}
			else { console.error('OSFileError:', OSFileError); throw new Error('error when trying to ready hydrant:', OSFileError); }
		}
	}

	return gHydrants[head];
}

var gWriteHydrantsTimeout;
function updateHydrant(aArg, aComm) {
	var { head, hydrant } = aArg;
	gHydrants[head] = hydrant;

	if (gWriteHydrantsTimeout) {
		clearTimeout(gWriteHydrantsTimeout);
	}
	gWriteHydrantsTimeout = setTimeout(writeHydrants, 30000);
}

function writeHydrants() {
	gWriteHydrantsTimeout = null;
	if (gHydrants) {
		console.error('writing hydrants.json');
		writeThenDir(OS.Path.join(core.addon.path.storage, 'hydrants.json'), JSON.stringify(gHydrants), OS.Constants.Path.profileDir);
	}
}

function bootstrapTimeout(milliseconds) {
	var mainDeferred_bootstrapTimeout = new Deferred();
	setTimeout(function() {
		mainDeferred_bootstrapTimeout.resolve();
	}, milliseconds)
	return mainDeferred_bootstrapTimeout.promise;
}

function processAction(aArg, aReportProgress, aComm) {
	var { actionid, serviceid, duration, arrbuf, time, mimetype, action_options } = aArg;

	var deferredMain_processAction = new Deferred();

	console.log('worker - processAction - aArg:', aArg);
	var rec = { serviceid, actionid, duration, arrbuf, time, mimetype, action_options };
	// time - is time it was taken, i use that as videoid

	gWorker['action_' + serviceid](rec, function(status) {
		console.log('worker - processAction complete, status:', status);
		deferredMain_processAction.resolve(status);
	}, aReportProgress);

	return deferredMain_processAction.promise;
}
// end - functions called by bootstrap

// End - Addon Functionality

// start - common helper functions
function Deferred() {
	this.resolve = null;
	this.reject = null;
	this.promise = new Promise(function(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
	}.bind(this));
	Object.freeze(this);
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};
	console.error('Rejected - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};
	console.error('Caught - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
// rev2 - not yet updated to gist.github - https://gist.github.com/Noitidart/ec1e6b9a593ec7e3efed
function xhr(aUrlOrFileUri, aOptions={}) {
	// console.error('in xhr!!! aUrlOrFileUri:', aUrlOrFileUri);

	// all requests are sync - as this is in a worker
	var aOptionsDefaults = {
		responseType: 'text',
		timeout: 0, // integer, milliseconds, 0 means never timeout, value is in milliseconds
		headers: null, // make it an object of key value pairs
		method: 'GET', // string
		data: null // make it whatever you want (formdata, null, etc), but follow the rules, like if aMethod is 'GET' then this must be null
	};
	aOptions = Object.assign(aOptionsDefaults, aOptions);

	var cRequest = new XMLHttpRequest();

	cRequest.open(aOptions.method, aUrlOrFileUri, false); // 3rd arg is false for synchronus

	if (aOptions.headers) {
		for (var h in aOptions.headers) {
			cRequest.setRequestHeader(h, aOptions.headers[h]);
		}
	}

	cRequest.responseType = aOptions.responseType;
	cRequest.send(aOptions.data);

	// console.log('response:', cRequest.response);

	// console.error('done xhr!!!');
	return cRequest;
}
// rev4 - https://gist.github.com/Noitidart/6d8a20739b9a4a97bc47
var _cache_formatStringFromName_packages = {}; // holds imported packages
function formatStringFromName(aKey, aLocalizedPackageName, aReplacements) {
	// depends on ```core.addon.path.locale``` it must be set to the path to your locale folder

	// aLocalizedPackageName is name of the .properties file. so mainworker.properties you would provide mainworker // or if it includes chrome:// at the start then it fetches that
	// aKey - string for key in aLocalizedPackageName
	// aReplacements - array of string

	// returns null if aKey not found in pacakage

	var packagePath;
	var packageName;
	if (aLocalizedPackageName.indexOf('chrome:') === 0 || aLocalizedPackageName.indexOf('resource:') === 0) {
		packagePath = aLocalizedPackageName;
		packageName = aLocalizedPackageName.substring(aLocalizedPackageName.lastIndexOf('/') + 1, aLocalizedPackageName.indexOf('.properties'));
	} else {
		packagePath = core.addon.path.locale + aLocalizedPackageName + '.properties';
		packageName = aLocalizedPackageName;
	}

	if (!_cache_formatStringFromName_packages[packageName]) {
		var packageStr = xhr(packagePath).response;
		var packageJson = {};

		var propPatt = /(.*?)=(.*?)$/gm;
		var propMatch;
		while (propMatch = propPatt.exec(packageStr)) {
			packageJson[propMatch[1]] = propMatch[2];
		}

		_cache_formatStringFromName_packages[packageName] = packageJson;

		console.log('packageJson:', packageJson);
	}

	var cLocalizedStr = _cache_formatStringFromName_packages[packageName][aKey];
	if (!cLocalizedStr) {
		return null;
	}
	if (aReplacements) {
		for (var i=0; i<aReplacements.length; i++) {
			cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
		}
	}

	return cLocalizedStr;
}

function xhrAsync(aUrlOrFileUri, aOptions={}, aCallback) { // 052716 - added timeout support
	// console.error('in xhr!!! aUrlOrFileUri:', aUrlOrFileUri);
	if (!aUrlOrFileUri && aOptions.url) { aUrlOrFileUri = aOptions.url }

	// all requests are sync - as this is in a worker
	var aOptionsDefaults = {
		responseType: 'text',
		timeout: 0, // integer, milliseconds, 0 means never timeout, value is in milliseconds
		headers: null, // make it an object of key value pairs
		method: 'GET', // string
		data: null, // make it whatever you want (formdata, null, etc), but follow the rules, like if aMethod is 'GET' then this must be null
		onprogress: undefined, // set to callback you want called
		onuploadprogress: undefined // set to callback you want called
	};
	Object.assign(aOptionsDefaults, aOptions);
	aOptions = aOptionsDefaults;

	var request = new XMLHttpRequest();

	request.timeout = aOptions.timeout;

	var handler = ev => {
		evf(m => request.removeEventListener(m, handler, !1));

		switch (ev.type) {
			case 'load':

					aCallback({request, ok:true});
					// if (xhr.readyState == 4) {
					// 	if (xhr.status == 200) {
					// 		deferredMain_xhr.resolve(xhr);
					// 	} else {
					// 		var rejObj = {
					// 			name: 'deferredMain_xhr.promise',
					// 			aReason: 'Load Not Success', // loaded but status is not success status
					// 			xhr: xhr,
					// 			message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					// 		};
					// 		deferredMain_xhr.reject(rejObj);
					// 	}
					// } else if (xhr.readyState == 0) {
					// 	var uritest = Services.io.newURI(aStr, null, null);
					// 	if (uritest.schemeIs('file')) {
					// 		deferredMain_xhr.resolve(xhr);
					// 	} else {
					// 		var rejObj = {
					// 			name: 'deferredMain_xhr.promise',
					// 			aReason: 'Load Failed', // didnt even load
					// 			xhr: xhr,
					// 			message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					// 		};
					// 		deferredMain_xhr.reject(rejObj);
					// 	}
					// }

				break;
			case 'abort':
			case 'error':
			case 'timeout':

					// var result_details = {
					// 	reason: ev.type,
					// 	request,
					// 	message: request.statusText + ' [' + ev.type + ':' + request.status + ']'
					// };
					aCallback({request, ok:false, reason:ev.type});

				break;
			default:
				var result_details = {
					reason: 'unknown',
					request,
					message: request.statusText + ' [' + ev.type + ':' + request.status + ']'
				};
				aCallback({request, ok:false, reason:ev.type, result_details});
		}
	};


	var evf = f => ['load', 'error', 'abort', 'timeout'].forEach(f);
	evf(m => request.addEventListener(m, handler, false));

	if (aOptions.onprogress) {
		request.addEventListener('progress', aOptions.onprogress, false);
	}
	if (aOptions.onuploadprogress) {
		request.upload.addEventListener('progress', aOptions.onuploadprogress, false);
	}
	request.open(aOptions.method, aUrlOrFileUri, true); // 3rd arg is false for async

	if (aOptions.headers) {
		for (var h in aOptions.headers) {
			request.setRequestHeader(h, aOptions.headers[h]);
		}
	}

	request.responseType = aOptions.responseType;
	request.send(aOptions.data);

	// console.log('response:', request.response);

	// console.error('done xhr!!!');

}

function setTimeoutSync(aMilliseconds) {
	var breakDate = Date.now() + aMilliseconds;
	while (Date.now() < breakDate) {}
}

// rev1 - _ff-addon-snippet-safedForPlatFS.js - https://gist.github.com/Noitidart/e6dbbe47fbacc06eb4ca
var _safedForPlatFS_pattWIN = /([\\*:?<>|\/\"])/g;
var _safedForPlatFS_pattNIXMAC = /\//g;
function safedForPlatFS(aStr, aOptions={}) {
	// short for getSafedForPlatformFilesystem - meaning after running this on it, you can safely use the return in a filename on this current platform
	// aOptions
	//	repStr - use this string, in place of the default repCharForSafePath in place of non-platform safe characters
	//	allPlatSafe - by default it will return a path safed for the current OS. Set this to true if you want to to get a string that can be used on ALL platforms filesystems. A Windows path is safe on all other platforms

	// set defaults on aOptions
	if (!('allPlatSafe' in aOptions)) {
		aOptions.allPlatSafe = false;
	}
	if (!('repStr' in aOptions)) {
		aOptions.repStr = '-';
	}

	var usePlat = aOptions.allPlatSafe ? 'winnt' : core.os.name; // a windows path is safe in all platforms so force that. IF they dont want all platforms then use the current platform
	switch (usePlat) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				return aStr.replace(_safedForPlatFS_pattWIN, aOptions.repStr);

			break;
		default:

				return aStr.replace(_safedForPlatFS_pattNIXMAC, aOptions.repStr);
	}
}

// https://gist.github.com/Noitidart/7810121036595cdc735de2936a7952da -rev1
function writeThenDir(aPlatPath, aContents, aDirFrom, aOptions={}) {
	// tries to writeAtomic
	// if it fails due to dirs not existing, it creates the dir
	// then writes again
	// if fail again for whatever reason it throws

	var cOptionsDefaults = {
		encoding: 'utf-8',
		noOverwrite: false
		// tmpPath: aPlatPath + '.tmp'
	};

	aOptions = Object.assign(cOptionsDefaults, aOptions);

	var do_write = function() {
		OS.File.writeAtomic(aPlatPath, aContents, aOptions); // doing unixMode:0o4777 here doesn't work, i have to `OS.File.setPermissions(path_toFile, {unixMode:0o4777})` after the file is made
	};

	try {
		do_write();
	} catch (OSFileError) {
		if (OSFileError.becauseNoSuchFile) { // this happens when directories dont exist to it
			OS.File.makeDir(OS.Path.dirname(aPlatPath), {from:aDirFrom});
			do_write(); // if it fails this time it will throw outloud
		} else {
			throw OSFileError;
		}
	}

}

// rev1 - https://gist.github.com/Noitidart/c4ab4ca10ff5861c720b
var jQLike = { // my stand alone jquery like functions
	serialize: function(aSerializeObject) {
		// https://api.jquery.com/serialize/

		// verified this by testing
			// http://www.w3schools.com/jquery/tryit.asp?filename=tryjquery_ajax_serialize
			// http://www.the-art-of-web.com/javascript/escape/

		var serializedStrArr = [];
		for (var cSerializeKey in aSerializeObject) {
			serializedStrArr.push(encodeURIComponent(cSerializeKey) + '=' + encodeURIComponent(aSerializeObject[cSerializeKey]));
		}
		return serializedStrArr.join('&');
	}
};

// rev4 - not yet updated to gist - jun 12 16 - using Object.assign for defaults - https://gist.github.com/Noitidart/e6dbbe47fbacc06eb4ca
var _safedForPlatFS_pattWIN = /([\\*:?<>|\/\"])/g;
var _safedForPlatFS_pattNIXMAC = /[\/:]/g;
function safedForPlatFS(aStr, aOptions={}) {
	// depends on core.os.mname - expects it to be lower case
	// short for getSafedForPlatformFilesystem - meaning after running this on it, you can safely use the return in a filename on this current platform
	// aOptions
	//	repStr - use this string, in place of the default repCharForSafePath in place of non-platform safe characters
	//	allPlatSafe - by default it will return a path safed for the current OS. Set this to true if you want to to get a string that can be used on ALL platforms filesystems. A Windows path is safe on all other platforms

	// 022816 - i added : to _safedForPlatFS_pattNIXMAC because on mac it was replacing it with a `/` which is horrible it will screw up OS.Path.join .split etc

	// set defaults on aOptions
	aOptions = Object.assign({
		allPlatSafe: false,
		repStr: '-'
	}, aOptions)

	var usePlat = aOptions.allPlatSafe ? 'winnt' : core.os.mname; // a windows path is safe in all platforms so force that. IF they dont want all platforms then use the current platform
	switch (usePlat) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				return aStr.replace(_safedForPlatFS_pattWIN, aOptions.repStr);

			break;
		default:

				return aStr.replace(_safedForPlatFS_pattNIXMAC, aOptions.repStr);
	}
}

var _cache_getSystemDirectory = {};
function getSystemDirectory(type) {
	// main entry point that should be used for getting system path. worker, botostrap, etc should call here
	// for each type, guranteed to return a string

	// resolves to string
	// type - string - enum: Videos
	var deferredMain_getSystemDirectory = new Deferred();

	if (_cache_getSystemDirectory[type]) {
		deferredMain_getSystemDirectory.resolve(_cache_getSystemDirectory[type]);
	} else {
		const TYPE_ROUTE_BOOTSTRAP = 0;
		const TYPE_ROUTE_ANDROID = 1;
		const TYPE_ROUTE_OS_CONST = 2;
		switch (type) {
			case 'Videos':

					var platform = {
						winnt: { type:'Vids', route:TYPE_ROUTE_BOOTSTRAP },
						darwin: { type:'Mov', route:TYPE_ROUTE_BOOTSTRAP },
						gtk: { type:'XDGVids', route:TYPE_ROUTE_BOOTSTRAP },
						android: { type:'DIRECTORY_MOVIES', route:TYPE_ROUTE_ANDROID }
					};

				break;
		}

		var { type, route } = platform[core.os.mname];

		switch (route) {
			case TYPE_ROUTE_BOOTSTRAP:
					callInBootstrap('getSystemDirectory_bootstrap', type, function(path) {
						deferredMain_getSystemDirectory.resolve(path);
					});
				break;
			case TYPE_ROUTE_ANDROID:
					deferredMain_getSystemDirectory.resolve(getSystemDirectory_android[type]);
				break;
			case TYPE_ROUTE_OS_CONST:
					deferredMain_getSystemDirectory.resolve(OS.Constants.Path[type]);
				break;
		};
	}

	return deferredMain_getSystemDirectory.promise;
}

function getSystemDirectory_android(type) {
	// progrmatic helper for getSystemDirectory in MainWorker - devuser should NEVER call this himself
	// type - string - currently accepted values
		// DIRECTORY_DOWNLOADS
		// DIRECTORY_MOVIES
		// DIRECTORY_MUSIC
		// DIRECTORY_PICTURES

	// var OSStuff.jenv = null;
	try {
		if (!OSStuff.jenv) {
			OSStuff.jenv = JNI.GetForThread();
		}

		var SIG = {
			Environment: 'Landroid/os/Environment;',
			String: 'Ljava/lang/String;',
			File: 'Ljava/io/File;'
		};

		var Environment = JNI.LoadClass(OSStuff.jenv, SIG.Environment.substr(1, SIG.Environment.length - 2), {
			static_fields: [
				{ name: 'DIRECTORY_DOWNLOADS', sig: SIG.String },
				{ name: 'DIRECTORY_MOVIES', sig: SIG.String },
				{ name: 'DIRECTORY_MUSIC', sig: SIG.String },
				{ name: 'DIRECTORY_PICTURES', sig: SIG.String }
			],
			static_methods: [
				{ name:'getExternalStorageDirectory', sig:'()' + SIG.File }
			]
		});

		var jFile = JNI.LoadClass(OSStuff.jenv, SIG.File.substr(1, SIG.File.length - 2), {
			methods: [
				{ name:'getPath', sig:'()' + SIG.String }
			]
		});

		var OSPath_dirExternalStorage = JNI.ReadString(OSStuff.jenv, Environment.getExternalStorageDirectory().getPath());
		var OSPath_dirname = JNI.ReadString(OSStuff.jenv, Environment[type]);
		var OSPath_dir = OS.Path.join(OSPath_dirExternalStorage, OSPath_dirname);
		console.log('OSPath_dir:', OSPath_dir);

		return OSPath_dir;

	} finally {
		// if (OSStuff.jenv) {
		// 	JNI.UnloadClasses(OSStuff.jenv);
		// }
	}
}
function queryStringAsJson(aQueryString) {
	var asJsonStringify = aQueryString;
	asJsonStringify = asJsonStringify.replace(/&/g, '","');
	asJsonStringify = asJsonStringify.replace(/=/g, '":"');
	asJsonStringify = '{"' + asJsonStringify + '"}';
	asJsonStringify = asJsonStringify.replace(/"(\d+|true|false)"/, function($0, $1) { return $1; });

	return JSON.parse(asJsonStringify);
}
// end - common helper functions
// start - common worker functions
function addOsInfoToCore() {
	// request core.os.toolkit
	// OS.File import

	// add stuff to core
	core.os.name = OS.Constants.Sys.Name.toLowerCase();
	core.os.mname = core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name; // mname stands for modified-name // this will treat solaris, linux, unix, *bsd systems as the same. as they are all gtk based
	// core.os.version
	switch (core.os.name) {
		case 'winnt':
				var version_win = navigator.userAgent.match(/Windows NT (\d+.\d+)/);
				if (version_win) {
					core.os.version = parseFloat(version_win[1]);
					// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
					switch (core.os.version) {
						case 5.1:
						case 5.2:
							core.os.version_name = 'xp';
							break;
						case 6:
							core.os.version_name = 'vista';
							break;
						case 6.1:
							core.os.version_name = '7';
							break;
						case 6.2:
							core.os.version_name = '8';
							break;
						case 6.3:
							core.os.version_name = '8.1';
							break;
						case 10:
							core.os.version_name = '10';
							break;
					}
				}
			break;
		case 'darwin':
				var version_osx = navigator.userAgent.match(/Mac OS X 10\.([\d\.]+)/);
				if (version_osx) {
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
				}
			break;
	}
}
// end - common worker functions
