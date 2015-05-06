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
				//console.info('hdcScreen:', hdcScreen.toString(), uneval(hdcScreen), cutils.jscGetDeepest(hdcScreen));
				if (ctypes.winLastError != 0) {
					//console.error('Failed hdcScreen, winLastError:', ctypes.winLastError);
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
				/* gives BRG
				var bmi = ostypes.TYPE.BITMAPINFO();
				bmi.bmiHeader.biSize = ostypes.TYPE.BITMAPINFOHEADER.size;
				bmi.bmiHeader.biWidth = nWidth; //w;
				bmi.bmiHeader.biHeight = -1 * nHeight; //-1 * h; // top-down
				bmi.bmiHeader.biPlanes = 1;
				bmi.bmiHeader.biBitCount = nBPP; //32;
				bmi.bmiHeader.biCompression = ostypes.CONST.BI_RGB;
				//var masks = ctypes.cast(bmi.addressOfField('bmiColors'), ostypes.TYPE.DWORD.ptr);
				
				//console.info('masks:', masks.toString(), 'masks[0]:', masks[0].toString());
				// bmi.bmiColors[0] = ostypes.TYPE.DWORD('0xf800');
				// bmi.bmiColors[1] = ostypes.TYPE.DWORD('0x07e0');
				// bmi.bmiColors[2] = ostypes.TYPE.DWORD('0x001f');
				//console.info('bmi:', bmi.toString());
				var cBmi = bmi.address();
				//*/

				//console.error('ostypes.TYPE.BITMAPINFOHEADER.size:', ostypes.TYPE.BITMAPINFOHEADER.size);
				//console.error('ostypes.TYPE.BITMAPV5HEADER.size:', ostypes.TYPE.BITMAPV5HEADER.size);
				///*
				var bmi = ostypes.TYPE.BITMAPV5HEADER();
				bmi.bV5Size = ostypes.TYPE.BITMAPV5HEADER.size;
				bmi.bV5Width = nWidth; //w;
				bmi.bV5Height = -1 * nHeight; //-1 * h; // top-down
				bmi.bV5Planes = 1;
				bmi.bV5BitCount = nBPP; //32;
				bmi.bV5Compression = ostypes.CONST.BI_BITFIELDS;
				bmi.bV5RedMask   =  ostypes.TYPE.DWORD('0xff000000');
				bmi.bV5GreenMask =  ostypes.TYPE.DWORD('0xff00');
				bmi.bV5BlueMask  =  ostypes.TYPE.DWORD('0xff');
				bmi.bV5AlphaMask =  ostypes.TYPE.DWORD('0xff0000');
				
				console.info('bmi:', bmi.toString(), bmi.address().toString());
				var cBmi = ctypes.cast(bmi.address(), ostypes.TYPE.BITMAPINFO.ptr);
				
				// bmi.bmiColors[0] = ostypes.TYPE.DWORD('0xf800');
				// bmi.bmiColors[1] = ostypes.TYPE.DWORD('0x07e0');
				// bmi.bmiColors[2] = ostypes.TYPE.DWORD('0x001f');
				//console.info('cBmi.contents:', cBmi.contents.toString());
				//*/
				
				var pixelBuffer = ostypes.TYPE.BYTE.ptr();
				console.info('PRE pixelBuffer:', pixelBuffer.toString(), 'pixelBuffer.addr:', pixelBuffer.address().toString());
				// CreateDIBSection stuff
				
				var hbmp = ostypes.API('CreateDIBSection')(hdcScreen, cBmi, ostypes.CONST.DIB_RGB_COLORS, pixelBuffer.address(), null, 0); 
				console.info('hbmp:', hbmp.toString(), uneval(hbmp), cutils.jscGetDeepest(hbmp));
				if (hbmp.isNull()) { // do not check winLastError when using v5, it always gives 87 i dont know why, but its working
					console.error('Failed hbmp, winLastError:', ctypes.winLastError);
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

				var w = c2.x - c1.x;
				var h = c2.y - c1.y;
				
				var rez_BB = ostypes.API('BitBlt')(hdcMemoryDC, 0,0, w, h, hdcScreen, c1.x, c1.y, ostypes.CONST.SRCCOPY);
				//console.info('rez_BB:', rez_BB.toString(), uneval(rez_BB), cutils.jscGetDeepest(rez_BB));
				if (ctypes.winLastError != 0) {
					//console.error('Failed rez_BB, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed rez_BB, winLastError: "' + ctypes.winLastError + '" and rez_BB: "' + rez_BB.toString(),
						winLastError: ctypes.winLastError
					});
				}
				
				console.info('POST pixelBuffer:', pixelBuffer.toString(), 'pixelBuffer.addr:', pixelBuffer.address().toString());
				
				var modW = w % 4;
				var useW = modW ? w + modW : w;
				console.log('useW:', useW, 'realW:', w);
				var arrLen = useW * h * 4
				var casted = ctypes.cast(pixelBuffer, ostypes.TYPE.BYTE.array(arrLen).ptr).contents;
				console.info('casted:', casted.toString());
				//logit(casted.toString().replace(/ctypes\.UInt64\("0"\), /g, ''));
				
				
				var imagedata = new ImageData(useW, h);
				
				/*
				// straight feed way 800ms
				console.time('straight feed');
				imagedata.data.set(casted); // its BRG so color is jacked up
				console.timeEnd('straight feed');
				//*/
				
				/*
				// normal way 1300ms
				console.time('normal way');
				var normalArr = [];
				for (var nIndex=0; nIndex<arrLen; nIndex=nIndex+4) {
					
					var r = casted[nIndex + 0];
					var g = casted[nIndex + 1];
					var b = casted[nIndex + 2];
					var a = 255;
					imagedata.data[nIndex] = r;
					imagedata.data[nIndex+1] = g;
					imagedata.data[nIndex+2] = b;
					imagedata.data[nIndex+3] = a;
					
					// normalArr.push(r);
					// normalArr.push(g);
					// normalArr.push(b);
					// normalArr.push(a);
					
					////console.log(nRow, nCol, [r, g, b]);
					
					//break;
				}
				////console.info('normalArr:', normalArr.toString());
				imagedata.data.set(normalArr);
				console.timeEnd('normal way');
				// normal way
				//*/
				
				///*
				// memcpy way 4ms
				console.time('memcpy way');
				ostypes.API('memcpy')(imagedata.data, pixelBuffer, arrLen);
				console.timeEnd('memcpy way');
				//*/
				
				// DONE: handle this: DIB widths are always a multiple of 4. If your image is not naturally a multiple of 4 pixels wide, then the row is padded out with 0 until it is. Your sample image is 170 pixels, which isn't a multiple of 4. The next multiple of 4 is 172, hence the two extra bytes. from here: http://www.gamedev.net/topic/487517-c-strange-problem-with-createdibsection/#entry4184321
				
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
