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
				
				var cStr = ostypes.TYPE.LPCTSTR.targetType.array()('DISPLAY');
				
				var hdcScreen = ostypes.API('CreateDC')(cStr, null, null, null);
				console.info('hdcScreen:', hdcScreen.toString(), uneval(hdcScreen), cutils.jscGetDeepest(hdcScreen));
				if (ctypes.winLastError != 0) {
					console.error('Failed hdcScreen, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed hdcScreen, winLastError: "' + ctypes.winLastError + '" and hdcScreen: "' + hdcScreen.toString(),
						winLastError: ctypes.winLastError
					});
				}

				var nWidth = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.HORZRES)));
				var nHeight = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.VERTRES)));
				var nBPP = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.BITSPIXEL)));
				
				console.info('nWidth:', nWidth, 'nHeight:', nHeight, 'nBPP:', nBPP);
				
				// force fullscreen
				c1 = {x:0, y:0};
				c2 = {x:nWidth, y:nHeight};
				
				var hdcMemoryDC = ostypes.API('CreateCompatibleDC')(hdcScreen); 
				console.info('hdcMemoryDC:', hdcMemoryDC.toString(), uneval(hdcMemoryDC), cutils.jscGetDeepest(hdcMemoryDC));
				if (ctypes.winLastError != 0) {
					console.error('Failed hdcMemoryDC, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed hdcMemoryDC, winLastError: "' + ctypes.winLastError + '" and hdcMemoryDC: "' + hdcMemoryDC.toString(),
						winLastError: ctypes.winLastError
					});
				}

				// CreateDIBSection stuff				
				var bmi = ostypes.TYPE.BITMAPINFO();
				bmi.bmiHeader.biSize = ostypes.TYPE.BITMAPINFOHEADER.size;
				bmi.bmiHeader.biWidth = nWidth; //w;
				bmi.bmiHeader.biHeight = -1 * nHeight; //-1 * h; // top-down
				bmi.bmiHeader.biPlanes = 1;
				bmi.bmiHeader.biBitCount = nBPP; //32;
				bmi.bmiHeader.biCompression = ostypes.CONST.BI_RGB;
				//bmi.bmiHeader.biSizeImage = nHeight * nWidth * (nBPP / 8);
				
				console.info('bmi:', bmi.toString());
				
				var pixelBuffer = ostypes.TYPE.COLORREF.ptr();
				//console.info('PRE pixelBuffer:', pixelBuffer.toString(), 'pixelBuffer.addr:', pixelBuffer.address().toString());
				// CreateDIBSection stuff
				
				var hbmp = ostypes.API('CreateDIBSection')(hdcMemoryDC, bmi.address(), ostypes.CONST.DIB_RGB_COLORS, pixelBuffer.address(), null, 0); 
				console.info('hbmp:', hbmp.toString(), uneval(hbmp), cutils.jscGetDeepest(hbmp));
				if (ctypes.winLastError != 0) {
					console.error('Failed hbmp, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed hbmp, winLastError: "' + ctypes.winLastError + '" and hbmp: "' + hbmp.toString(),
						winLastError: ctypes.winLastError
					});
				}
				
				var rez_SO = ostypes.API('SelectObject')(hdcMemoryDC, hbmp);
				console.info('rez_SO:', rez_SO.toString(), uneval(rez_SO), cutils.jscGetDeepest(rez_SO));
				if (ctypes.winLastError != 0) {
					console.error('Failed rez_SO, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed rez_SO, winLastError: "' + ctypes.winLastError + '" and rez_SO: "' + rez_SO.toString(),
						winLastError: ctypes.winLastError
					});
				}

				var w = c2.x - c1.x;
				var h = c2.y - c1.y;
				
				var rez_BB = ostypes.API('BitBlt')(hdcMemoryDC, 0,0, w, h, hdcScreen, c1.x, c1.y, ostypes.CONST.SRCCOPY);
				console.info('rez_BB:', rez_BB.toString(), uneval(rez_BB), cutils.jscGetDeepest(rez_BB));
				if (ctypes.winLastError != 0) {
					console.error('Failed rez_BB, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed rez_BB, winLastError: "' + ctypes.winLastError + '" and rez_BB: "' + rez_BB.toString(),
						winLastError: ctypes.winLastError
					});
				}
				
				var casted = ctypes.cast(pixelBuffer, ostypes.TYPE.COLORREF.array(nWidth * nHeight).ptr).contents;
				//console.info('casted:', casted.toString().replace(/ctypes\.UInt64\("0"\), /g, ''));
				logit(casted.toString().replace(/ctypes\.UInt64\("0"\), /g, ''));
				
				
				var imagedata = new ImageData(w, h);
				/*
				// uint32 way
				console.time('uint32 way');
				var buf = new ArrayBuffer(w * h * 4);
				var buf8 = new Uint8ClampedArray(buf);
				var buf32 = new Uint32Array(buf);
				
				for (var nRow=0; nRow<h; ++nRow) {
					for (var nCol=0; nCol<w; ++nCol) {
						var nIndex = nRow * w + nCol;
						var rez_colorref = casted[nIndex];
						var input = parseInt(cutils.jscGetDeepest(rez_colorref));
						
						buf32[nIndex] = input;
						//break;
					}
					//break;
				}
				//console.info('normalArr:', normalArr.toString());
				imagedata.data.set(buf8);
				console.timeEnd('uint32 way');
				// uint32 way
				*/
				
				// normal way
				console.time('normal way');
				var normalArr = [];							
				for (var nRow=0; nRow<h; ++nRow) {
					for (var nCol=0; nCol<w; ++nCol) {
						var nIndex = nRow * w + nCol;
						var rez_colorref = parseInt(casted[nIndex].toString());						
						var input = rez_colorref;
						
						var b =  input       & 0xff;
						var g = (input >> 8) & 0xff;
						var r = (input >>16) & 0xff;
						var a = 255;

						normalArr.push(r);
						normalArr.push(g);
						normalArr.push(b);
						normalArr.push(a);
						//console.log(nRow, nCol, [r, g, b]);
						
						//break;
					}
					//break;
				}
				//console.info('normalArr:', normalArr.toString());
				imagedata.data.set(normalArr);
				console.timeEnd('normal way');
				// normal way
				
				/*
				// uint32 way
				console.time('uint32 way');
				var buf = new ArrayBuffer(w * h * 4);
				var buf8 = new Uint8ClampedArray(buf);
				var buf32 = new Uint32Array(buf);
				
				for (var nRow=0; nRow<h; ++nRow) {
					for (var nCol=0; nCol<w; ++nCol) {
						var rez_colorref = ostypes.API('GetPixel')(hdcC, nCol, nRow);
						var input = parseInt(cutils.jscGetDeepest(rez_colorref));
						
						buf32[nRow * w + nCol] = input | (255 << 24); //alpha of 255 otherwise it is 0
						//break;
					}
					//break;
				}
				//console.info('normalArr:', normalArr.toString());
				imagedata.data.set(buf8);
				console.timeEnd('uint32 way');
				// uint32 way
				*/
				
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

var txtEn = new TextEncoder()
var pth = OS.Path.join(OS.Constants.Path.desktopDir, 'logit.txt');

function logit(txt) {
	var valOpen = OS.File.open(pth, {write: true, append: true});
	var valWrite = valOpen.write(txtEn.encode(txt + '\n'));
	valOpen.close();
}
