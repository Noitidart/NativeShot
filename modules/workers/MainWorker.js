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
	console.log('in worker init');
	
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

	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.content + 'modules/ostypes_win.jsm');
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
function shootSect(c1, c2) {
	// c1 is object of x,y top left coordinates
	// c2 is object of x,y top left coordinates
	
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				var hWindow = ostypes.API('GetDesktopWindow')();
				console.info('hWindow:', hWindow.toString(), uneval(hWindow), cutils.jscGetDeepest(hWindow));
				if (ctypes.winLastError != 0) {
					console.error('Failed hWindow, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed hWindow, winLastError: "' + ctypes.winLastError + '" and hWindow: "' + hWindow.toString(),
						winLastError: ctypes.winLastError
					});
				}
				var hdcScreen = ostypes.API('GetDC')(hWindow);
				console.info('hdcScreen:', hdcScreen.toString(), uneval(hdcScreen), cutils.jscGetDeepest(hdcScreen));
				if (ctypes.winLastError != 0) {
					console.error('Failed hdcScreen, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed hdcScreen, winLastError: "' + ctypes.winLastError + '" and hdcScreen: "' + hdcScreen.toString(),
						winLastError: ctypes.winLastError
					});
				}
				var rect = ostypes.TYPE.RECT();

				var rez_GCR = ostypes.API('GetClientRect')(hWindow, rect.address());
				console.info('rez_GCR:', rez_GCR.toString(), uneval(rez_GCR), cutils.jscGetDeepest(rez_GCR));
				if (ctypes.winLastError != 0) {
					console.error('Failed rez_GCR, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed rez_GCR, winLastError: "' + ctypes.winLastError + '" and rez_GCR: "' + rez_GCR.toString(),
						winLastError: ctypes.winLastError
					});
				}

				console.info('rect:', rect.toString(), uneval(rect));
				// rect.bottom = ostypes.TYPE.LONG(c2.y);
				// rect.right = ostypes.TYPE.LONG(c2.x);
				// console.info('rect modded:', rect.toString(), uneval(rect));

				var hbmC = ostypes.API('CreateCompatibleBitmap')(hdcScreen, rect.right, rect.bottom);
				console.info('hbmC:', hbmC.toString(), uneval(hbmC), cutils.jscGetDeepest(hbmC));
				if (ctypes.winLastError != 0) {
					console.error('Failed hbmC, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed hbmC, winLastError: "' + ctypes.winLastError + '" and hbmC: "' + hbmC.toString(),
						winLastError: ctypes.winLastError
					});
				}
				
				if (!hbmC.isNull()) {
					var hdcC = ostypes.API('CreateCompatibleDC')(hdcScreen);
					console.info('hdcC:', hdcC.toString(), uneval(hdcC), cutils.jscGetDeepest(hdcC));
					if (ctypes.winLastError != 0) {
						console.error('Failed hdcC, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcC, winLastError: "' + ctypes.winLastError + '" and hdcC: "' + hdcC.toString(),
							winLastError: ctypes.winLastError
						});
					}

					if (!hdcC.isNull()) {
						var hbmOld = ostypes.API('SelectObject')(hdcC, hbmC);
						console.info('hbmOld:', hbmOld.toString(), uneval(hbmOld), cutils.jscGetDeepest(hbmOld));
						if (ctypes.winLastError != 0) {
							console.error('Failed hbmOld, winLastError:', ctypes.winLastError);
							throw new Error({
								name: 'os-api-error',
								message: 'Failed hbmOld, winLastError: "' + ctypes.winLastError + '" and hbmOld: "' + hbmOld.toString(),
								winLastError: ctypes.winLastError
							});
						}

						var w = c2.x - c1.x;
						var h = c2.y - c1.y;
						var rez_BB = ostypes.API('BitBlt')(hdcC, 0, 0, w, h, hdcScreen, c1.x, c1.y, ostypes.CONST.SRCCOPY);
						console.info('rez_BB:', rez_BB.toString(), uneval(rez_BB), cutils.jscGetDeepest(rez_BB));
						if (!rez_BB) {
							console.error('Failed rez_BB, winLastError:', ctypes.winLastError);
							throw new Error({
								name: 'os-api-error',
								message: 'Failed rez_BB, winLastError: "' + ctypes.winLastError + '" and rez_BB: "' + rez_BB.toString(),
								winLastError: ctypes.winLastError
							});
						} else {				
							// start - trying to get imagedata
							var imagedata = new ImageData(w, h);
							console.error('imagedata.data:', imagedata.data.toString());
							console.error('imagedata.data:', imagedata.data.set.toString());
							var normalArr = [];
							
							var buf = new ArrayBuffer(w * h * 4);
							var buf8 = new Uint8ClampedArray(buf);
							var buf32 = new Uint32Array(buf);
							
							for (var nRow=0; nRow<h; ++nRow) {
								for (var nCol=0; nCol<w; ++nCol) {
									var rez_colorref = ostypes.API('GetPixel')(hdcC, nCol, nRow);
									var input = parseInt(cutils.jscGetDeepest(rez_colorref));
									
									/*
									var r =  input       & 0xff;
									var g = (input >> 8) & 0xff;
									var b = (input >>16) & 0xff;
									var a = 255;

									normalArr.push(r);
									normalArr.push(g);
									normalArr.push(b);
									normalArr.push(a);
									//console.log(nRow, nCol, [r, g, b]);
									*/
									buf32[nRow * w + nCol] = input | (255 << 24) /*alpha of 255 otherwise it is 0*/;
									//break;
								}
								//break;
							}
							// end - trying to get imagedata
							console.info('normalArr:', normalArr.toString());
							imagedata.data.set(buf8);
							console.error('set done');
							var rez_SO = ostypes.API('SelectObject')(hdcC, hbmOld);
							console.info('rez_SO:', rez_SO.toString(), uneval(rez_SO), cutils.jscGetDeepest(rez_SO));
							if (ctypes.winLastError != 0) {
								console.error('Failed rez_SO, winLastError:', ctypes.winLastError);
								throw new Error({
									name: 'os-api-error',
									message: 'Failed rez_SO, winLastError: "' + ctypes.winLastError + '" and rez_SO: "' + rez_SO.toString(),
									winLastError: ctypes.winLastError
								});
							}
							
							var rez_DDC = ostypes.API('DeleteDC')(hdcC);
							console.info('rez_DDC:', rez_DDC.toString(), uneval(rez_DDC), cutils.jscGetDeepest(rez_DDC));
							if (ctypes.winLastError != 0) {
								console.error('Failed rez_DDC, winLastError:', ctypes.winLastError);
								throw new Error({
									name: 'os-api-error',
									message: 'Failed rez_DDC, winLastError: "' + ctypes.winLastError + '" and rez_DDC: "' + rez_DDC.toString(),
									winLastError: ctypes.winLastError
								});
							}
						}
					}
				}

				var rez_RDC = ostypes.API('ReleaseDC')(hWindow, hdcScreen);
				console.info('rez_RDC:', rez_RDC.toString(), uneval(rez_RDC), cutils.jscGetDeepest(rez_RDC));
				if (ctypes.winLastError != 0) {
					console.error('Failed rez_RDC, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed rez_RDC, winLastError: "' + ctypes.winLastError + '" and rez_RDC: "' + rez_RDC.toString(),
						winLastError: ctypes.winLastError
					});
				}

				return imagedata;
				
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}
// End - Addon Functionality
