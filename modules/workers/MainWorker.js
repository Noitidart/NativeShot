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
};
worker.postMessage = function(result, ...transfers) {
	self.postMessage(result, ...transfers);
};
worker.close = function() {
	self.close();
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

	if (core.os.toolkit == 'gtk2') {
		core.os.name = 'gtk';
	}
	
	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.content + 'modules/ostypes_win.jsm');
			break
		case 'gtk':
			importScripts(core.addon.path.content + 'modules/ostypes_gtk.jsm');
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
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				OSStuff.hiiii = true;
				
			break;
		default:
			// do nothing special
	}
	
	return true;
}

// Start - Addon Functionality
function shootMon(mons) {
	// mons
		// 0 - primary monitor
		// 1 - all monitors
		// 2 - monitor where the mouse currently is
		
	
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				console.time('winapi');
				var rezArr = [];
				var iDevNum = -1;
				while (true) {
					iDevNum++;
					var lpDisplayDevice = ostypes.TYPE.DISPLAY_DEVICE();
					lpDisplayDevice.cb = ostypes.TYPE.DISPLAY_DEVICE.size;
					var rez_EnumDisplayDevices = ostypes.API('EnumDisplayDevices')(null, iDevNum, lpDisplayDevice.address(), 0);
					console.info('rez_EnumDisplayDevices:', rez_EnumDisplayDevices.toString(), uneval(rez_EnumDisplayDevices), cutils.jscGetDeepest(rez_EnumDisplayDevices));
					if (cutils.jscEqual(rez_EnumDisplayDevices, 0)) { // ctypes.winLastError != 0
						// iDevNum is greater than the largest device index.
						break;
					}
					console.info('lpDisplayDevice.DeviceName:', lpDisplayDevice.DeviceName.readString()); // "\\.\DISPLAY1" till "\\.\DISPLAY4"
					if (lpDisplayDevice.StateFlags & ostypes.CONST.DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) {
						console.log('is monitor');
						rezArr.push({
							argsCreateDC: {
								lpszDriver: null,
								lpszDevice: lpDisplayDevice.DeviceName
							},
						});
					}
				}
				
				for (var i=0; i<rezArr.length; i++) {
					var dm = ostypes.TYPE.DEVMODE(); // SIZEOF_DEVMODE = 148
					console.info('dm.size:', ostypes.TYPE.DEVMODE.size);
					//dm.dmFields = ostypes.CONST.DM_PELSWIDTH;
					//dm.dmSize = ostypes.TYPE.DEVMODE.size;

					console.log('iDevNum:', iDevNum, rezArr[i].argsCreateDC.lpszDevice.readString());
					var rez_EnumDisplaySettings = ostypes.API('EnumDisplaySettings')(rezArr[i].argsCreateDC.lpszDevice, ostypes.CONST.ENUM_CURRENT_SETTINGS, dm.address());
					console.info('rez_EnumDisplaySettings:', rez_EnumDisplaySettings.toString(), uneval(rez_EnumDisplaySettings), cutils.jscGetDeepest(rez_EnumDisplaySettings));
					console.info('dm:', dm.toString());
					rezArr[i].nWidth = parseInt(cutils.jscGetDeepest(dm.dmPelsWidth));
					rezArr[i].nHeight = parseInt(cutils.jscGetDeepest(dm.dmPelsHeight));
					rezArr[i].xTopLeft = parseInt(cutils.jscGetDeepest(dm.u.dmPosition.x));
					rezArr[i].yTopLeft = parseInt(cutils.jscGetDeepest(dm.u.dmPosition.y));
					rezArr[i].nBPP = parseInt(cutils.jscGetDeepest(dm.dmBitsPerPel));
					console.info(JSON.stringify(rezArr[i]));
				}
				/*
				if (mons == 0) {
					rezArr.push({
						argsCreateDC: {
							lpszDriver: ostypes.TYPE.LPCTSTR.targetType.array()('DISPLAY'),
							lpszDevice: null
						},
						xTopLeft: 0,
						yTopLeft: 0
					});
				} else  if (mons == 1) {
					// get all monitors
					var jsMonitorEnumProc = function(hMonitor, hdcMonitor, lprcMonitor, dwData) {
						console.log('in jsMonitorEnumProc', 'hMonitor:', hMonitor.toString(), 'lprcMonitor:', lprcMonitor.contents.toString()); // link3687324
						rezArr.push({
							xTopLeft: parseInt(cutils.jscGetDeepest(lprcMonitor.contents.left)),
							yTopLeft: parseInt(cutils.jscGetDeepest(lprcMonitor.contents.top))
						});
						rezArr[rezArr.length - 1].nWidth = parseInt(cutils.jscGetDeepest(lprcMonitor.contents.right)) - rezArr[rezArr.length - 1].xTopLeft;
						rezArr[rezArr.length - 1].nHeight = parseInt(cutils.jscGetDeepest(lprcMonitor.contents.bottom)) - rezArr[rezArr.length - 1].yTopLeft;
						
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
						
						rezArr[rezArr.length-1].argsCreateDC = {
							lpszDriver: null,
							lpszDevice: cMonInfo.szDevice
						};

						return true; // continue enumeration
					}
					var cMonitorEnumProc = ostypes.TYPE.MONITORENUMPROC.ptr(jsMonitorEnumProc);
					var rez_EnumDisplayMonitors = ostypes.API('EnumDisplayMonitors')(null, null, cMonitorEnumProc, 0);
					console.log('post rez_EnumDisplayMonitors'); // good, this test proves that "in jsMonitorEnumProc, lprcMonitor" callbacks complete before EnuMDisplayMonitors unblocks link3687324
					console.info('rez_EnumDisplayMonitors:', rez_EnumDisplayMonitors.toString(), uneval(rez_EnumDisplayMonitors), cutils.jscGetDeepest(rez_EnumDisplayMonitors));
					if (ctypes.winLastError != 0) {
						console.error('Failed rez_EnumDisplayMonitors, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_EnumDisplayMonitors, winLastError: "' + ctypes.winLastError + '" and rez_EnumDisplayMonitors: "' + rez_EnumDisplayMonitors.toString(),
							winLastError: ctypes.winLastError
						});
					}
				} else if (mons == 2) {
					var cPoint = ostypes.TYPE.POINT();
					var rez_GetCursorPos = ostypes.API('GetCursorPos')(cPoint.address());
					console.info('rez_GetCursorPos:', rez_GetCursorPos.toString(), uneval(rez_GetCursorPos), cutils.jscGetDeepest(rez_GetCursorPos));
					if (ctypes.winLastError != 0) {
						console.error('Failed rez_GetCursorPos, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_GetCursorPos, winLastError: "' + ctypes.winLastError + '" and rez_GetCursorPos: "' + rez_GetCursorPos.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var cMon = ostypes.API('MonitorFromPoint')(cPoint, ostypes.CONST.MONITOR_DEFAULTTONEAREST);
					console.info('cMon:', cMon.toString(), uneval(cMon), cutils.jscGetDeepest(cMon));
					if (cMon.isNull()) { // removed `ctypes.winLastError != 0` because docs dont specify we can check last error and i didnt test it
						console.error('Failed cMon, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed cMon, winLastError: "' + ctypes.winLastError + '" and cMon: "' + cMon.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var cMonInfo = ostypes.TYPE.MONITORINFOEX();
					cMonInfo.cbSize = ostypes.TYPE.MONITORINFOEX.size;
					var rez_GetMonitorInfo = ostypes.API('GetMonitorInfo')(cMon, cMonInfo.address());
					console.info('rez_GetMonitorInfo:', rez_GetMonitorInfo.toString(), uneval(rez_GetMonitorInfo), cutils.jscGetDeepest(rez_GetMonitorInfo));
					if (cutils.jscEqual(rez_GetMonitorInfo, 0)) {
						console.error('Failed rez_GetMonitorInfo, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_GetMonitorInfo, winLastError: "' + ctypes.winLastError + '" and rez_GetMonitorInfo: "' + rez_GetMonitorInfo.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					console.info('cMonInfo.rcMonitor:', cMonInfo.rcMonitor.toString());
					
					rezArr.push({
						argsCreateDC: {
							lpszDriver: null,
							lpszDevice: cMonInfo.szDevice
						},
						xTopLeft: parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.left)),
						yTopLeft: parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.top))
					});
					rezArr[rezArr.length - 1].nWidth = parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.right)) - rezArr[rezArr.length - 1].xTopLeft;
					rezArr[rezArr.length - 1].nHeight = parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.bottom)) - rezArr[rezArr.length - 1].yTopLeft;
				} else {
					throw new Error({
						name: 'devuser-error',
						message: 'Invalid paramter of "' + mons + '" passed to mons argument'
					})
				}
				*/
				for (var s=0; s<rezArr.length; s++) {
					var hdcScreen = ostypes.API('CreateDC')(rezArr[s].argsCreateDC.lpszDriver, rezArr[s].argsCreateDC.lpszDevice, null, null);
					//console.info('hdcScreen:', hdcScreen.toString(), uneval(hdcScreen), cutils.jscGetDeepest(hdcScreen));
					if (ctypes.winLastError != 0) {
						//console.error('Failed hdcScreen, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcScreen, winLastError: "' + ctypes.winLastError + '" and hdcScreen: "' + hdcScreen.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					delete rezArr[s].argsCreateDC; // as we dont want to return CData to mainthread
					
					// var nWidth = 'nWidth' in rezArr[s] ? rezArr[s].nWidth : parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.HORZRES)));
					// var nHeight = 'nHeight' in rezArr[s] ? rezArr[s].nHeight : parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.VERTRES)));
					// var nBPP = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.BITSPIXEL)));
					// var dpiX = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.LOGPIXELSX)));
					// var dpiY = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.LOGPIXELSY)));
					// console.error('dpiX:', dpiX, 'dpiY:', dpiY);
					// rezArr[s].nWidth = nWidth; // in case it didnt have nWidth in rezArr[s]
					// rezArr[s].nHeight = nHeight; // in case it didnt have nHeight in rezArr[s]
					// console.info('nWidth:', nWidth, 'nHeight:', nHeight, 'nBPP:', nBPP);
					
					var w = rezArr[s].nWidth;
					var h = rezArr[s].nHeight;
					
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

					// CreateDIBSection stuff
					var bmi = ostypes.TYPE.BITMAPINFO();
					bmi.bmiHeader.biSize = ostypes.TYPE.BITMAPINFOHEADER.size;
					bmi.bmiHeader.biWidth = rezArr[s].nWidth;
					bmi.bmiHeader.biHeight = -1 * rezArr[s].nHeight; // top-down
					bmi.bmiHeader.biPlanes = 1;
					bmi.bmiHeader.biBitCount = rezArr[s].nBPP; // 32
					bmi.bmiHeader.biCompression = ostypes.CONST.BI_RGB;
					// bmi.bmiHeader.biXPelsPerMeter = dpiX;
					// bmi.bmiHeader.biYPelsPerMeter = dpiY;
					
					delete rezArr[s].nBPP; // mainthread has no need for this
					
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
					
					var rez_BB = ostypes.API('BitBlt')(hdcMemoryDC, 0, 0, rezArr[s].nWidth, rezArr[s].nHeight, hdcScreen, 0, 0, ostypes.CONST.SRCCOPY);
					//console.info('rez_BB:', rez_BB.toString(), uneval(rez_BB), cutils.jscGetDeepest(rez_BB));
					if (ctypes.winLastError != 0) {
						//console.error('Failed rez_BB, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_BB, winLastError: "' + ctypes.winLastError + '" and rez_BB: "' + rez_BB.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					console.timeEnd('winapi');
					
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
					
					rezArr[s].idat = imagedata;
				}
				
				setTimeout(function() {
					// no need to make `return` wait for this cleanup
					
					lpDisplayDevice = null;
					dm = null;
					imagedata = null;
					
					var rez_DelDc1 = ostypes.API('DeleteDC')(hdcScreen);
					console.log('rez_DelDc1:', rez_DelDc1);
					
					var rez_DelDc2 = ostypes.API('DeleteDC')(hdcMemoryDC);
					console.log('rez_DelDc2:', rez_DelDc2);
					
					var rez_DelObj1 = ostypes.API('DeleteObject')(hbmp);
					console.log('rez_DelObj1:', rez_DelObj1);
					
				}, 500);
				
				return rezArr;
				
			break;
		case 'gtk':
			
				var rootGdkWin = ostypes.API('gdk_get_default_root_window')();
				console.info('rootGdkWin:', rootGdkWin.toString(), uneval(rootGdkWin), cutils.jscGetDeepest(rootGdkWin));
				if (ctypes.errno != 0) {
					console.error('Failed , errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed , errno: "' + ctypes.errno + '" and : "' + rootGdkWin.toString(),
						errno: ctypes.errno
					});
				}

				/*
				var rootGtkWin = ostypes.HELPER.gdkWinPtrToGtkWinPtr(rootGdkWin);
				console.info('rootGtkWin:', rootGtkWin.toString());
				*/
				
				var w = ostypes.TYPE.gint();
				var h = ostypes.TYPE.gint();
				var rez_getSize = ostypes.API('gtk_window_get_size')(rootGtkWin, w.address(), h.address());
				console.info('rez_getSize:', rez_getSize.toString(), uneval(rez_getSize), cutils.jscGetDeepest(rez_getSize));
				if (ctypes.errno != 0) {
					console.error('Failed , errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed , errno: "' + ctypes.errno + '" and : "' + rez_getSize.toString(),
						errno: ctypes.errno
					});
				}
				
				console.info('w:', w.toString(), 'h:', h.toString());
				
				
				
			break;
		case 'darwin':
				
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
					
					rect = ostypes.API('CGRectUnion')(rect, rez_CGDisplayBounds);
					console.info('rect post loop ' + i + ':', rect.toString());
				}
				
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
					console.info('rez_width:', rez_width.toString(), uneval(rez_width), cutils.jscGetDeepest(rez_width));
					
					var rez_height = ostypes.API('CGRectGetHeight')(rect);
					console.info('rez_height:', rez_height.toString(), uneval(rez_height), cutils.jscGetDeepest(rez_height));
					
					var NSBitmapImageRep = ostypes.HELPER.class('NSBitmapImageRep');
					allocNSBIP = ostypes.API('objc_msgSend')(NSBitmapImageRep, ostypes.HELPER.sel('alloc'));
					console.info('NSCal:', uneval(myNSStrings.get('NSCalibratedRGBColorSpace')));
					var imageRep = ostypes.API('objc_msgSend')(allocNSBIP, ostypes.API('sel_registerName')('initWithBitmapDataPlanes:pixelsWide:pixelsHigh:bitsPerSample:samplesPerPixel:hasAlpha:isPlanar:colorSpaceName:bitmapFormat:bytesPerRow:bitsPerPixel:'),  // https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ApplicationKit/Classes/NSBitmapImageRep_Class/index.html#//apple_ref/occ/instm/NSBitmapImageRep/initWithBitmapDataPlanes:pixelsWide:pixelsHigh:bitsPerSample:samplesPerPixel:hasAlpha:isPlanar:colorSpaceName:bitmapFormat:bytesPerRow:bitsPerPixel:
						rez_width,										// pixelsWide
						rez_height,										// pixelsHigh
						8,												// bitsPerSample
						4,												// samplesPerPixel
						ostypes.CONST.YES,								// hasAlpha
						ostypes.CONST.NO,								// isPlanar
						myNSStrings.get('NSCalibratedRGBColorSpace'),	// colorSpaceName
						0,												// bitmapFormat
						0,												// bytesPerRow
						32												// bitsPerPixel
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
					console.info('rez_CGRectMake:', rez_CGRectMake.toString(), uneval(rez_CGRectMake), cutils.jscGetDeepest(rez_CGRectMake));
					
					var rez_CGContextClearRect = ostypes.API('CGContextClearRect')(cgcontext, rez_CGRectMake);
					console.info('rez_CGContextClearRect:', rez_CGContextClearRect.toString(), uneval(rez_CGContextClearRect), cutils.jscGetDeepest(rez_CGContextClearRect));
					
					for (var i in i_nonMirror) { // if display is secondary mirror of another display, skip it
						// CGRect displayRect = CGDisplayBounds(displays[i]);
						var displayRect = ostypes.API('CGDisplayBounds')(displays[i]);
						console.info('displayRect:', displayRect.toString(), uneval(displayRect), cutils.jscGetDeepest(displayRect));
						
						// CGImageRef image = CGDisplayCreateImage(displays[i]);
						var image = ostypes.API('CGDisplayCreateImage')(displays[i]);
						console.info('image:', image.toString(), uneval(image), cutils.jscGetDeepest(image));
						if (!image) {
							console.warn('no image so continuing');
							continue;
						}
						
						// CGRect dest = CGRectMake(displayRect.origin.x - rect.origin.x,
						//               displayRect.origin.y - rect.origin.y,
						//               displayRect.size.width,
						//               displayRect.size.height);
						var dest = ostypes.API('CGRectmake')(
							displayRect.origin.x - rect.origin.x,
							displayRect.origin.y - rect.origin.y,
							displayRect.size.width,
							displayRect.size.height
						);
						console.info('dest:', dest.toString(), uneval(dest), cutils.jscGetDeepest(dest));
						
						// CGContextDrawImage(cgcontext, dest, image);
						ostypes.API('CGContextDrawImage')(cgcontext, dest, image); // reutrns void
						
						// CGImageRelease(image);
						ostypes.API('CGImageRelease')(image); // returns void
						
					}
					
					// [[NSGraphicsContext currentContext] flushGraphics];
					var rez_currentContext = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('currentContext'));
					console.info('rez_currentContext:', rez_currentContext.toString(), uneval(rez_currentContext), cutils.jscGetDeepest(rez_currentContext));
					
					var rez_flushGraphics = ostypes.API('objc_msgSend')(rez_currentContext, ostypes.HELPER.sel('flushGraphics'));
					console.info('rez_flushGraphics:', rez_flushGraphics.toString(), uneval(rez_flushGraphics), cutils.jscGetDeepest(rez_flushGraphics));
					
					// [NSGraphicsContext restoreGraphicsState];
					var rez_restoreGraphicsState = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('restoreGraphicsState'));
					console.info('rez_restoreGraphicsState:', rez_restoreGraphicsState.toString(), uneval(rez_restoreGraphicsState), cutils.jscGetDeepest(rez_restoreGraphicsState));
					
					// NSData* data = [imageRep representationUsingType:NSPNGFileType properties:@{ }];
					
					var NSDictionary = ostypes.HELPER.class('NSDictionary');
					var tempDict = ostypes.API('objc_msgSend')(NSDictionary, ostypes.HELPER.sel('dictionary')); //gives us temporary dicationary, one that gets auto released? well whatever its something not allocated so we dont have to release it
					console.info('tempDict:', tempDict.toString(), uneval(tempDict));
					
					var data = ostypes.API('objc_msgSend')(imageRep, ostypes.HELPER.sel('representationUsingType:properties:'), ostypes.CONST.NSPNGFileType, tempDict); // https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ApplicationKit/Classes/NSBitmapImageRep_Class/index.html#//apple_ref/occ/instm/NSBitmapImageRep/representationUsingType:properties:
					
					// [data writeToFile:@"/tmp/screenshot.png" atomically:YES];
					var rez_writeToFile = objc.API('objc_msgSend')(data, ostypes.HELPER.sel('writeTofile:atomically:'), myNSStrings.get(OS.Path.join(OS.Constants.Path.desktopDir, 'full_ss.png')), ostypes.CONST.YES);
					console.info('rez_writeToFile:', rez_writeToFile.toString(), uneval(rez_writeToFile), cutils.jscGetDeepest(rez_writeToFile));
					
				} finally {
					console.error('starting finally block');
					if (allocNSBIP) {
						var rez_relNSBPI = ostypes.API('objc_msgSend')(allocNSBIP, ostypes.HELPER.sel('release'));
						console.info('rez_relNSBPI:', rez_relNSBPI.toString());
					}
					if (myNSStrings) {
						myNSStrings.releaseAll()
					}
					console.info('released things, i want to know if it gets here even if return was called within the try block');
				}
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}
// End - Addon Functionality

var txtEn = new TextEncoder()
var pth = OS.Path.join(OS.Constants.Path.desktopDir, 'logit.txt');

function logit(txt) {
	var valOpen = OS.File.open(pth, {write: true, append: true});
	var valWrite = valOpen.write(txtEn.encode(txt + '\n'));
	valOpen.close();
}
