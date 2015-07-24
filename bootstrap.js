// Imports
const {classes: Cc, interfaces: Ci, utils: Cu, Constructor: CC} = Components;
Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
Cu.import('resource://gre/modules/Geometry.jsm');
const {TextDecoder, TextEncoder, OS} = Cu.import('resource://gre/modules/osfile.jsm', {});
Cu.import('resource://gre/modules/Promise.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.importGlobalProperties(['btoa']);

// Globals
const core = {
	addon: {
		name: 'NativeShot',
		id: 'NativeShot@jetpack',
		path: {
			name: 'nativeshot',
			content: 'chrome://nativeshot/content/',
			locale: 'chrome://nativeshot/locale/',
			resources: 'chrome://nativeshot/content/resources/',
			images: 'chrome://nativeshot/content/resources/images/'
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	}
};

var PromiseWorker;
var bootstrap = this;
const NS_HTML = 'http://www.w3.org/1999/xhtml';
const cui_cssUri = Services.io.newURI(core.addon.path.resources + 'cui.css', null, null);

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'as', function () { return Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService) });
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'global.properties?' + Math.random()); /* Randomize URI to work around bug 719376 */ });
XPCOMUtils.defineLazyGetter(myServices, 'sm', function () { return Cc['@mozilla.org/gfx/screenmanager;1'].getService(Ci.nsIScreenManager) });

function extendCore() {
	// adds some properties i use to core
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			core.os.version = parseFloat(Services.sysinfo.getProperty('version'));
			// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
			if (core.os.version == 6.0) {
				core.os.version_name = 'vista';
			}
			if (core.os.version >= 6.1) {
				core.os.version_name = '7+';
			}
			if (core.os.version == 5.1 || core.os.version == 5.2) { // 5.2 is 64bit xp
				core.os.version_name = 'xp';
			}
			break;
			
		case 'darwin':
			var userAgent = myServices.hph.userAgent;
			//console.info('userAgent:', userAgent);
			var version_osx = userAgent.match(/Mac OS X 10\.([\d\.]+)/);
			//console.info('version_osx matched:', version_osx);
			
			if (!version_osx) {
				throw new Error('Could not identify Mac OS X version.');
			} else {
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
				// this makes it so that 10.10.0 becomes 10.100
				// 10.10.1 => 10.101
				// so can compare numerically, as 10.100 is less then 10.101
				
				//core.os.version = 6.9; // note: debug: temporarily forcing mac to be 10.6 so we can test kqueue
			}
			break;
		default:
			// nothing special
	}
	
	core.os.toolkit = Services.appinfo.widgetToolkit.toLowerCase();
	core.os.xpcomabi = Services.appinfo.XPCOMABI;
	
	core.firefox = {};
	core.firefox.version = Services.appinfo.version;
	
	console.log('done adding to core, it is now:', core);
}

//start obs stuff
var observers = {
	'nativeshot-editor-loaded': { // this trick detects actual load of iframe from bootstrap scope
		observe: function (aSubject, aTopic, aData) {
			obsHandler_nativeshotEditorLoaded(aSubject, aTopic, aData);
		},
		reg: function () {
			Services.obs.addObserver(observers['nativeshot-editor-loaded'], core.addon.id + '_nativeshot-editor-loaded', false);
		},
		unreg: function () {
			Services.obs.removeObserver(observers['nativeshot-editor-loaded'], core.addon.id + '_nativeshot-editor-loaded');
		}
	}
};
//end obs stuff

// START - Addon Functionalities
const gEMenuDomJson = 
	['xul:popupset', {},
		['xul:menupopup', {id: 'myMenu1'},
			['xul:menuitem', {label:'Close', oncommand:'window.close()'}],
			['xul:menuseparator', {}],
			['xul:menuitem', {label:'Save to File (preset dir & name pattern)', oncommand:function(e){ gEditor.saveToFile(e, true) }}],
			['xul:menuitem', {label:'Save to File (file picker dir and name)', oncommand:function(e){ gEditor.saveToFile(e) }}],
			['xul:menuitem', {label:'Copy to Clipboard', oncommand:function(e){ gEditor.copyToClipboard(e) }}],
			['xul:menu', {label:'Upload to Cloud Drive (click this for last used host)'},
				['xul:menupopup', {},
					['xul:menuitem', {label:'Amazon Cloud Drive'}],
					['xul:menuitem', {label:'Box'}],
					['xul:menuitem', {label:'Copy by Barracuda Networks'}],
					['xul:menuitem', {label:'Dropbox'}],
					['xul:menuitem', {label:'Google Drive'}],
					['xul:menuitem', {label:'MEGA'}],
					['xul:menuitem', {label:'OneDrive (aka SkyDrive)'}]
				]
			],
			['xul:menu', {label:'Upload to Image Host with My Account (click this for last used host)'},
				['xul:menupopup', {},
					['xul:menuitem', {label:'Flickr'}],
					['xul:menuitem', {label:'Image Shack'}],
					['xul:menuitem', {label:'Imgur'}],
					['xul:menuitem', {label:'Photobucket'}]
				]
			],
			['xul:menu', {label:'Upload to Image Host as Anonymous (click this for last used host)'},
				['xul:menupopup', {},
					['xul:menuitem', {label:'FreeImageHosting.net'}],
					['xul:menuitem', {label:'Imgur', oncommand:function(e){ gEditor.uploadToImgur(e, false) }}],
				]
			],
			['xul:menu', {label:'Share to Social Media'},
				['xul:menupopup', {},
					['xul:menuitem', {label:'Facebook'}],
					['xul:menuitem', {label:'Twitter'}]
				]
			],
			['xul:menuitem', {label:'Print Image', oncommand:function(e){ gEditor.sendToPrinter(e) }}],
			['xul:menuseparator', {}],
			['xul:menu', {label:'Selection to Monitor', onclick:'alert(\'clicked main level menu item so will select current monitor\')'},
				['xul:menupopup', {},
					['xul:menuitem', {label:'Current Monitor'}],
					['xul:menuitem', {label:'All Monitors'}],
					['xul:menuitem', {label:'Monitor 1'}],
					['xul:menuitem', {label:'Monitor 2'}]
				]
			],
			['xul:menu', {label:'Selection to Application Window'},
				['xul:menupopup', {},
					['xul:menuitem', {label:'Running App 1', onclick:'alert(\'seletion around window 1\')'}],
					['xul:menu', {label:'Running App 2', onclick:'alert(\'seletion around window 1\')'},
						['xul:menupopup', {},
							['xul:menuitem', {label:'Window 1'}],
							['xul:menuitem', {label:'Window 2'}],
							['xul:menuitem', {label:'Window 3'}]
						]
					],
					['xul:menuitem', {label:'Running App 3', onclick:'alert(\'seletion around window 1\')'}]
				]
			]
		]
	];
					
// global editor values
var colMon; // rename of collMonInfos
/* holds
{
	x: origin x
	y: origin y
	w: width mon
	h: height mon
	screenshot: ImageData of monitor screenshot
	E: { editor props
		DOMWindow: xul dom window
		DOMWindowMarkedUnloaded: bool used for determining which ones to exec .close on when closing out all editor windows
		canBase
		ctxBase
		canDim
		ctxDim
	}
}
*/
var gIMonMouseDownedIn;

var gETopLeftMostX;
var gETopLeftMostY;

var gESelected = false;
var gESelecting = false; // users is drawing rect
var gEMoving = false; // user is moving rect
var gEMDX = null; // mouse down x
var gEMDY = null; // mouse down y
var gESelectedRect = new Rect(0, 0, 0, 0);

const gDefDimFillStyle = 'rgba(0, 0, 0, 0.6)';
const gDefLineDash = [3, 2];
const gDefStrokeStyle = '#ccc';
const gDefLineWidth = '1';

var gNotifTimer;

// start - observer handlers
// start - canvas functions to act across all canvases
var gCanDim = {
	execFunc: function(aStrFuncName, aArrFuncArgs=[], aObjConvertScreenToLayer) {
		/* aObjConvertScreenToLayer is an object holding keys of `x` and `y` and it tells the index in aArrFuncArgs it is found, it will then convert that to layerX
		if provide this arg MUST provide x and y
		*/
		// if (!Array.isArray(aArrFuncArgs)) {
			// throw new Error('aArrFuncArgs must be an array');
		// }
		// executes the ctx function across all ctx's
		if (aObjConvertScreenToLayer) { console.error('start exec'); } // :debug:
		// identify replace indiices and its val
		var specials = {
			'{{W}}': '{{W}}', // can dependent
			'{{H}}': '{{H}}' // can depdnent
		}
		var specialIndexes = {};
		var somethingSpecial = false;
		for (var j=0; j<aArrFuncArgs.length; j++) {
			if (aArrFuncArgs[j] in specials) {
				specialIndexes[j] = specials[aArrFuncArgs[j]];
				somethingSpecial = true;
			}
		}
		
		if (!somethingSpecial) {
			specialIndexes = null;
		}
		
		var clone_aArrFuncArgs = [];
		for (var i=0; i<colMon.length; i++) {
			// clone aArrFuncArgs (instead of aArrFuncArgs.slice() i think it might be better to do it this way)
			for (var j=0; j<aArrFuncArgs.length; j++) {
				clone_aArrFuncArgs[j] = aArrFuncArgs[j];
			}
			
			var orig = JSON.stringify(clone_aArrFuncArgs); // :debug:
			
			// do special replacements in arugments
			for (var j=0; j<clone_aArrFuncArgs.length; j++) {
				// special replacements
				if (clone_aArrFuncArgs[j] == '{{W}}') {
					clone_aArrFuncArgs[j] = colMon[i].w;
				} else if (clone_aArrFuncArgs[j] == '{{H}}') {
					clone_aArrFuncArgs[j] = colMon[i].h;
				}
			}
			
			// modify screenX and screenY to layerX and layerY based on monitor
			if (aObjConvertScreenToLayer) {
				var cRect = new Rect(clone_aArrFuncArgs[aObjConvertScreenToLayer.x], clone_aArrFuncArgs[aObjConvertScreenToLayer.y], clone_aArrFuncArgs[aObjConvertScreenToLayer.w], clone_aArrFuncArgs[aObjConvertScreenToLayer.h]);
				// start - block link6587436215
				// check if intersection
				var rectIntersecting = colMon[i].rect.intersect(cRect);
				console.info('iMon:', i, 'rectIntersecting:', rectIntersecting, 'cRect:', cRect, 'colMon[i].rect:', colMon[i].rect)
				if (rectIntersecting.left == rectIntersecting.right || rectIntersecting.top == rectIntersecting.bottom) { // if width OR height are 0 it means no intersection between the two rect's
					// does not intersect, continue to next monitor
					console.warn('iMon:', i,'no intersect, contin to next mon', 'cRect:', cRect, 'colMon[i].rect:', colMon[i].rect);
					continue;
				} else {
					//console.info('due to interesect here is comparison of x y w h:', rectIntersecting.left, rectIntersecting.right, rectIntersecting.left == rectIntersecting.right, rectIntersecting.top == rectIntersecting.bottom, rectIntersecting.top, rectIntersecting.bottom)
					// convert screen xy of rect to layer xy
					clone_aArrFuncArgs[aObjConvertScreenToLayer.x] = rectIntersecting.left - colMon[i].x;
					clone_aArrFuncArgs[aObjConvertScreenToLayer.y] = rectIntersecting.top - colMon[i].y;
					
					// adjust width and height, needed for multi monitor selection correction
					clone_aArrFuncArgs[aObjConvertScreenToLayer.w] = rectIntersecting.width;
					clone_aArrFuncArgs[aObjConvertScreenToLayer.h] = rectIntersecting.height;
					console.log('args converted from screen to layer xy:', 'from:', JSON.parse(orig), 'to:', clone_aArrFuncArgs);
				}
				// end - block link6587436215
			}
			
			var aCtxDim = colMon[i].E.ctxDim;

			//console.log('applying arr:', clone_aArrFuncArgs);
			aCtxDim[aStrFuncName].apply(aCtxDim, clone_aArrFuncArgs);
		}
	},
	execProp: function(aStrPropName, aPropVal) {
		for (var i=0; i<colMon.length; i++) {
			var aCtxDim = colMon[i].E.ctxDim;			
			aCtxDim[aStrPropName] = aPropVal;
		}
	}
};

var gEditor = {
	lastCompositedRect: null, // holds rect of selection (`gESelectedRect`) that it last composited for
	canComp: null, // holds canvas element
	ctxComp: null, // holds ctx element
	compDOMWindow: null, // i use colMon[i].DOMWindow for this
	gBrowserDOMWindow: null, // used for clipboard context
	cleanUp: function() {
		// reset all globals
		colMon = null;
		this.lastCompositedRect = null;
		this.canComp = null;
		this.compDOMWindow = null;
		this.gBrowserDOMWindow = null;
		
		gIMonMouseDownedIn = null;

		gETopLeftMostX = null;
		gETopLeftMostY = null;

		gESelected = false;
		gESelecting = false; // users is drawing rect
		gEMoving = false; // user is moving rect
		gEMDX = null; // mouse down x
		gEMDY = null; // mouse down y

		gESelectedRect = new Rect(0, 0, 0, 0);
	},
	addEventListener: function(keyNameInColMonE, evName, func, aBool) {
		for (var i=0; i<colMon.length; i++) {
			colMon[i].E[keyNameInColMonE].addEventListener(evName, func, aBool);
			console.log('added ', evName, 'to iMon:', i);
		}
	},
	removeEventListener: function(keyNameInColMonE, evName, func, aBool) {
		for (var i=0; i<colMon.length; i++) {
			colMon[i].E[keyNameInColMonE].removeEventListener(evName, func, aBool);
		}
	},
	compositeSelection: function() {
		// creates a canvas holding a composite of the current selection
		console.error('starting compositing');
		if (!gESelected) {
			throw new Error('no selection to composite!');
		}
		
		if (this.lastCompositedRect && this.lastCompositedRect.equals(gESelectedRect)) {
			console.log('no need to composite as compositing was already done so is cached');
			return;
		}
		
		this.lastCompositedRect = gESelectedRect.clone();
		
		// create a canvas
		// i use colMon[0] for the composite canvas
		if (!this.compDOMWindow) {
			// need to initalize it
			this.compDOMWindow = colMon[0].E.DOMWindow;
			this.canComp = this.compDOMWindow.document.createElementNS(NS_HTML, 'canvas');
			this.ctxComp = this.canComp.getContext('2d');
		}
		
		this.canComp.width = this.lastCompositedRect.width;
		this.canComp.height = this.lastCompositedRect.height;
		
		// do the base file for areas where there is no image (in case of multi mon selection where there is gaps)
		// this.ctxComp.fillStyle = 'rgba(0, 0, 0, 0)';
		// this.ctxComp.fillRect(0, 0, this.lastCompositedRect.width, this.lastCompositedRect.height);
		
		for (var i=0; i<colMon.length; i++) {			
			// start - mod of copied block link6587436215
			// check if intersection
			var rectIntersecting = colMon[i].rect.intersect(this.lastCompositedRect);
			if (rectIntersecting.left == rectIntersecting.right || rectIntersecting.top == rectIntersecting.bottom) { // if width OR height are 0 it means no intersection between the two rect's
				// does not intersect, continue to next monitor
				console.warn('iMon:', i,'no intersect, contin to next mon', 'cRect:', this.lastCompositedRect, 'colMon[i].rect:', colMon[i].rect);
				continue;
			} else {
				//console.info('due to interesect here is comparison of x y w h:', rectIntersecting.left, rectIntersecting.right, rectIntersecting.left == rectIntersecting.right, rectIntersecting.top == rectIntersecting.bottom, rectIntersecting.top, rectIntersecting.bottom)
				// convert screen xy of rect to layer xy
				rectIntersecting.left -= colMon[i].x;
				rectIntersecting.top -= colMon[i].y;

				// adjust width and height, needed for multi monitor selection correction
				rectIntersecting.right -= colMon[i].x;
				rectIntersecting.bottom -= colMon[i].y;
			}
			// end - mod of copied block link6587436215
			
			this.canComp.style.position = 'fixed'; // :debug:
			this.ctxComp.putImageData(colMon[i].screenshot, colMon[i].x - this.lastCompositedRect.left, colMon[i].y - this.lastCompositedRect.top, rectIntersecting.left, rectIntersecting.top, rectIntersecting.width, rectIntersecting.height);
			
			//this.compDOMWindow.document.documentElement.querySelector('stack').appendChild(this.canComp); // :debug:
			
			console.error('composited');
		}
	},
	closeOutEditor: function(e) {
		// if e.shiftKey then it doesnt do anything, else it closes it out and cleans up (in future maybe possibility to cache? maybe... so in this case would just hide window, but im thinking no dont do this)
		console.error('in close out editor, e.shiftKey:', e.shiftKey);
		if (e.shiftKey) {
			console.log('will not close out editor as shift key was held, user wants to do more actions')
		} else {
			colMon[0].E.DOMWindow.close();
		}
	},
	showNotif: function(aTitle, aMsg) {
		if (!gNotifTimer) {
			gNotifTimer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
		} else {
			gNotifTimer.cancel();
		}
		gNotifTimer.initWithCallback({
			notify: function() {
				myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', core.addon.name + ' - ' + aTitle, aMsg);
				gNotifTimer = null;
			}
		}, 1000, Ci.nsITimer.TYPE_ONE_SHOT);
	},
	saveToFile: function(e, aBoolPreset) {
		// aBoolPreset true if want to use preset folder and file name
		this.compositeSelection();
		
		var OSPath_save;
		var do_saveCanToDisk = function() {
			(gEditor.canComp.toBlobHD || gEditor.canComp.toBlob).call(gEditor.canComp, function(b) {
				gEditor.closeOutEditor(e); // as i cant close out yet as i need this.canComp see line above this one: `(this.canComp.toBlobHD || this.canComp.toBlob).call(this.canComp, function(b) {`
				var r = Cc['@mozilla.org/files/filereader;1'].createInstance(Ci.nsIDOMFileReader); //new FileReader();
				r.onloadend = function() {
					// r.result contains the ArrayBuffer.
					var promise_saveToDisk = OS.File.writeAtomic(OSPath_save, new Uint8Array(r.result), { tmpPath: OSPath_save + '.tmp' });
					promise_saveToDisk.then(
						function(aVal) {
							console.log('Fullfilled - promise_saveToDisk - ', aVal);
							// start - do stuff here - promise_saveToDisk
							var trans = Transferable(gEditor.gBrowserDOMWindow);
							trans.addDataFlavor('text/unicode');
							// We multiply the length of the string by 2, since it's stored in 2-byte UTF-16 format internally.
							trans.setTransferData('text/unicode', SupportsString(OSPath_save), OSPath_save.length * 2);
							
							Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
							
							gEditor.showNotif('Save Completed', 'Screenshot was successfully saved to disk and file path was copied to clipboard');
							// end - do stuff here - promise_saveToDisk
						},
						function(aReason) {
							var rejObj = {name:'promise_saveToDisk', aReason:aReason};
							console.error('Rejected - promise_saveToDisk - ', rejObj);
							gEditor.showNotif('Save Failed', 'Screenshot failed to save to disk, see browser console for more details');
							//deferred_createProfile.reject(rejObj);
						}
					).catch(
						function(aCaught) {
							var rejObj = {name:'promise_saveToDisk', aCaught:aCaught};
							console.error('Caught - promise_saveToDisk - ', rejObj);
							Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'NativeShot - Developer Error', 'Developer did something wrong in the code, see Browser Console.');
							//deferred_createProfile.reject(rejObj);
						}
					);
				};
				r.readAsArrayBuffer(b);
			}, 'image/png');
		}
		
		if (aBoolPreset) {
			// get save path
			var OSPath_saveDir;
			try {
				OSPath_saveDir = Services.dirsvc.get('XDGPict', Ci.nsIFile).path;
			} catch (ex) {
				console.warn('ex:', ex);
				try {
					OSPath_saveDir = Services.dirsvc.get('Pict', Ci.nsIFile).path;
				} catch (ex) {
					console.warn('ex:', ex);
					OSPath_saveDir = OS.Constants.Path.desktopDir;
				}
			}
			
			// generate file name
			var filename = 'Screenshot - ' + getSafedForOSPath(new Date().toLocaleFormat()) + '.png';
			OSPath_save = OS.Path.join(OSPath_saveDir, filename);
			
			do_saveCanToDisk();
		} else {
			var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
			fp.init(this.compDOMWindow, 'Save Screenshot', Ci.nsIFilePicker.modeSave);
			fp.appendFilter('PNG Image', '*.png');
			
			var rv = fp.show();
			if (rv == Ci.nsIFilePicker.returnOK || rv == Ci.nsIFilePicker.returnReplace) {
				OSPath_save = fp.file.path.trim();
				
				if (!/^.*\.png/i.test(OSPath_save)) {
					OSPath_save += '.png';
				}
				do_saveCanToDisk();
			} else {
				 // user canceled
				console.error('rv was:', rv);
				gEditor.closeOutEditor(e);
			}
		}
	},
	copyToClipboard: function(e) {
		this.compositeSelection();
			
		// based on:
			// mostly: https://github.com/mxOBS/deb-pkg_icedove/blob/8f8955df7c9db605cf6903711dcbfc6dd7776e50/mozilla/toolkit/devtools/gcli/commands/screenshot.js#L161
			// somewhat on: https://github.com/dadler/thumbnail-zoom/blob/76a6edded0ca4ef1eb76d4c1b2bc363b433cde63/src/resources/clipboardService.js#L78-L209
			
		var data = this.canComp.toDataURL('image/png', '');
		var channel = Services.io.newChannel(data, null, null);
		var input = channel.open();
		var imgTools = Cc['@mozilla.org/image/tools;1'].getService(Ci.imgITools);
		
		var container = {};
		imgTools.decodeImageData(input, channel.contentType, container);

		var wrapped = Cc['@mozilla.org/supports-interface-pointer;1'].createInstance(Ci.nsISupportsInterfacePointer);
		wrapped.data = container.value;
		
		var trans = Transferable(this.gBrowserDOMWindow);
		console.info('channel.contentType:', channel.contentType);
		trans.addDataFlavor(channel.contentType);
		
		trans.setTransferData(channel.contentType, wrapped, -1);
		
		Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
		
		/* to consider
			// have to first set imageURL = createBlob
		  
		   // Also put the image's html <img> tag on the clipboard.  This is 
		   // important (at least on OSX): if we copy just jpg image data,
		   // programs like Photoshop and Thunderbird seem to receive it as
		   // uncompressed png data, which is very large, bloating emails and
		   // causing randomly truncated data.  But if we also include a
		   // text/html flavor referring to the jpg image on the Internet, 
		   // those programs retrieve the image directly as the original jpg
		   // data, so there is no data bloat.
		  
		  var str = Components.classes['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
		  if (str) {
			str.data = '<img src="' + imageURL + '" />';
			trans.addDataFlavor('text/html');
			trans.setTransferData('text/html', str, str.data.length * 2);
		  }    
		*/
		
		gEditor.showNotif('Image Copied', 'Screenshot was successfully copied to the clipboard');
		
		this.closeOutEditor(e);
	},
	sendToPrinter: function(e) {
		this.compositeSelection();
		this.closeOutEditor(e);
	},
	uploadToImgur: function(e, aBoolAnon) {
		// aBoolAnon true if want anonymous upload
		this.compositeSelection();
		
		var data = this.canComp.toDataURL('image/png'); // returns `data:image/png;base64,iVBORw.....`
		console.info('base64 data pre trim:', data);
		data = data.substr('data:image/png;base64,'.length); // imgur wants without this
		
		console.info('base64 data:', data);
		var promise_uploadAnonImgur = xhr('https://api.imgur.com/3/upload', {
			aPostData: {
				image: data, // this gets encodeURIComponent'ed by my xhr function
				type: 'base64'
			},
			Headers: {
				Authorization: 'Client-ID fa64a66080ca868',
				'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' // if i dont do this, then by default Content-Type is `text/plain; charset=UTF-8` and it fails saying `aReason.xhr.response.data.error == 'Image format not supported, or image is corrupt.'` and i get `aReason.xhr.status == 400`
			},
			aResponseType: 'json'
		});
		
		promise_uploadAnonImgur.then(
			function(aVal) {
				console.log('Fullfilled - promise_uploadAnonImgur - ', aVal);
				// start - do stuff here - promise_uploadAnonImgur
				var imgUrl = aVal.response.data.link;
				var deleteHash = aVal.response.data.deletehash; // at time of this writing jul 13 2015 the delete link is `'http://imgur.com/delete/' + deleteHash` (ie: http://imgur.com/delete/AxXkaRTpZILspsh)
				var imgId = aVal.response.data.id;
				
				var trans = Transferable(this.gBrowserDOMWindow);
				trans.addDataFlavor('text/unicode');
				// We multiply the length of the string by 2, since it's stored in 2-byte UTF-16 format internally.
				trans.setTransferData('text/unicode', SupportsString(imgUrl), imgUrl.length * 2);
				
				Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
				
				// save to upload history - only for anonymous uploads to imgur, so can delete in future
				var OSPath_history = OS.Path.join(OS.Constants.Path.desktopDir, 'imgur-history.txt'); // creates file if it wasnt there
				OS.File.open(OSPath_history, {write: true, append: true}).then(valOpen => {
					var txtToAppend = ',"' + imgId + '":"' + deleteHash + '"';
					var txtEncoded = getTxtEncodr().encode(txtToAppend);
					valOpen.write(txtEncoded).then(valWrite => {
						console.log('valWrite:', valWrite);
						valOpen.close().then(valClose => {
							console.log('valClose:', valClose);
							console.log('successfully appended');
						});
					});
				});
				
				gEditor.showNotif('Image Uploaded', 'Upload to Imgur was successful and image link was copied to the clipboard');
				// end - do stuff here - promise_uploadAnonImgur
			},
			function(aReason) {
				var rejObj = {name:'promise_uploadAnonImgur', aReason:aReason};
				console.error('Rejected - promise_uploadAnonImgur - ', rejObj);
				gEditor.showNotif('Upload Failed', 'Upload to Imgur failed, see Browser Console for details');
				//deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_uploadAnonImgur', aCaught:aCaught};
				console.error('Caught - promise_uploadAnonImgur - ', rejObj);
				//deferred_createProfile.reject(rejObj);
				//myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', core.addon.name + ' - ' + 'Upload Failed', 'Upload to Imgur failed, see Browser Console for details');
				Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'NativeShot - Developer Error', 'Developer did something wrong in the code, see Browser Console.');
			}
		);
		
		this.closeOutEditor(e);
	}
};

function gEMouseMove(e) {
	var iMon; //var iMon = gIMonMouseDownedIn; //parseInt(e.view.location.search.substr('?iMon='.length)); // cant do this as on mouse move, user may not be over iMon they started in, so have to calc it
	var screenPoint = new Rect(e.screenX, e.screenY, 1, 1);
	for (var i=0; i<colMon.length; i++) {
		if (colMon[i].rect.contains(screenPoint)) {
			iMon = i;
			break;
		}
	}
	//console.log('mousemove imon:', iMon, e.screenX, e.screenY);
	if (gESelecting) {
		var cEMMX = colMon[iMon].win81ScaleX ? Math.floor(colMon[iMon].x + ((e.screenX - colMon[iMon].x) * colMon[iMon].win81ScaleX)) : e.screenX;
		var cEMMY = colMon[iMon].win81ScaleY ? Math.floor(colMon[iMon].y + ((e.screenY - colMon[iMon].y) * colMon[iMon].win81ScaleY)) : e.screenY;
		// var cEMMX = e.screenX;
		// var cEMMY = e.screenY;
		
		console.info('PREmod:', e.screenX, e.screenY, 'POSTmod:', cEMMX, cEMMY);
		var newW = cEMMX - gEMDX;
		var newH = cEMMY - gEMDY;
		
		gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		gCanDim.execFunc('fillRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
				
		if (newW && newH) {
			gESelected = true;
			if (newW < 0) {
				gESelectedRect.left = gEMDX + newW;
				gESelectedRect.width = Math.abs(newW);
			} else {
				gESelectedRect.left = gEMDX;
				gESelectedRect.width = newW;
			}
			if (newH < 0) {
				gESelectedRect.top = gEMDY + newH;
				gESelectedRect.height = Math.abs(newH);
			} else {
				gESelectedRect.top = gEMDY;
				gESelectedRect.height = newH;
			}
			//gESelectedRect.setRect(gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height); // no need
			//console.error('x y w h:', [gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height]);
			gCanDim.execFunc('clearRect', [gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height], {x:0,y:1,w:2,h:3});
			
			// gCanDim.execFunc('translate', [0.5, 0.5]);
			// gCanDim.execFunc('rect', [gEMDX, gEMDY, newW, newH]); // draw invisible rect for stroke
			// gCanDim.execFunc('stroke');
			// gCanDim.execFunc('translate', [0, 0]);
		} else {
			gESelected = false;
		}
		
	} else if (gEMoving) {
		// :todo:
	}
	
	// e.preventDefault();
	// e.stopPropagation();
	// e.returnValue = false;
	// return false;
}
function gEMouseUp(e) {
	var iMon = parseInt(e.view.location.search.substr('?iMon='.length));

	if (gESelecting) {
		console.error('MOUSED UP iMon:', iMon);
		gESelecting = false;
		// gEditor.removeEventListener('DOMWindow', 'mousemove', gEMouseMove, false);
		colMon[gIMonMouseDownedIn].E.DOMWindow.removeEventListener('mousemove', gEMouseMove, false);
		gIMonMouseDownedIn = null;
		
		gCanDim.execFunc('restore');
		
	} else if (gEMoving) {
		gEMoving = false;
		
		// gEditor.removeEventListener('DOMWindow', 'mousemove', gEMouseMove, false);
		colMon[gIMonMouseDownedIn].E.DOMWindow.removeEventListener('mousemove', gEMouseMove, false);
		gIMonMouseDownedIn = null;
		
		gCanDim.execFunc('restore');
	}
	
	// e.preventDefault();
	// e.stopPropagation();
	// e.returnValue = false;
	// return false;
}
function gEMouseDown(e) {
	var iMon = parseInt(e.view.location.search.substr('?iMon='.length));
	//console.info('mousedown, e:', e);

	// console.info('you moved on x:', (e.screenX - colMon[iMon].x))
	// console.info('add this to e.screenX:', ((e.screenX - colMon[iMon].x) * colMon[iMon].win81ScaleX));
	if (e.button != 0) { return } // only repsond to primary click
	if (e.target.id != 'canDim') { return } // only repsond to primary click on canDim so this makes it ignore menu clicks etc
	
	var cEMDX = colMon[iMon].win81ScaleX ? colMon[iMon].x + ((e.screenX - colMon[iMon].x) * colMon[iMon].win81ScaleX) : e.screenX;
	var cEMDY = colMon[iMon].win81ScaleY ? colMon[iMon].y + ((e.screenY - colMon[iMon].y) * colMon[iMon].win81ScaleY) : e.screenY;
	console.info('MOUSEDOWN', 'PREmod:', e.screenX, e.screenY, 'POSTmod:', cEMDX, cEMDY);
	
	// var cEMDX = e.screenX;
	// var cEMDY = e.screenY;
	
	//console.info('pre mod', e.screenX, 'post mod:', cEMDX);
	
	// check if mouse downed on move selection hit box
	if (e.target.id == 'hitboxMoveSel') {
		gEMoving = true;
		gEMDX = cEMDX;
		gEMDY = cEMDY;
		// gEditor.addEventListener('DOMWindow', 'mousemove', gEMouseMove, false);
		gIMonMouseDownedIn = iMon;
		colMon[gIMonMouseDownedIn].E.DOMWindow.addEventListener('mousemove', gEMouseMove, false);
	} else {
		if (gESelected) {
			// if user mouses down within selected area, then dont start new selection
			var cPoint = new Rect(cEMDX, cEMDY, 1, 1);
			if (gESelectedRect.contains(cPoint)) {
				console.error('clicked within selected so dont do anything', 'point:', cPoint, 'gESelectedRect', JSON.parse(JSON.stringify(gESelectedRect)));
				return; // he clicked within it, dont do anything
			}
		}
		
		gESelectedRect.setRect(0, 0, 0, 0);
		
		gESelecting = true;
		gESelected = false;
		
		gEMDX = cEMDX;
		gEMDY = cEMDY;
		
		// save what ever previous styles user applied
		gCanDim.execFunc('save')
		
		// set "in selection" styles
		gCanDim.execProp('fillStyle', gDefDimFillStyle); // get default dim fill color
		gCanDim.execFunc('setLineDash', [gDefLineDash]);
		gCanDim.execFunc('setLineDash', [gDefLineDash]);
		gCanDim.execProp('strokeStyle', gDefStrokeStyle);
		gCanDim.execProp('lineWidth', gDefLineWidth);
		
		// clear out any drawings existing here
		gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']);
		gCanDim.execFunc('fillRect', [0, 0, '{{W}}', '{{H}}']);

		// gEditor.addEventListener('DOMWindow', 'mousemove', gEMouseMove, false);
		gIMonMouseDownedIn = iMon;
		colMon[gIMonMouseDownedIn].E.DOMWindow.addEventListener('mousemove', gEMouseMove, false);

	}
	// else start selection
		// reset canvases
		
	// e.preventDefault();
	// e.stopPropagation();
	// e.returnValue = false;
	// return false;
}

function gEUnload(e) {
	//console.info('unload e:', e);
	var iMon = parseInt(e.currentTarget.location.search.substr('?iMon='.length));
	//console.error('editor window unloading iMon:', iMon);

	
	// close all other windows
	for (var i=0; i<colMon.length; i++) {
		colMon[i].E.DOMWindow.removeEventListener('unload', gEUnload, false);
		colMon[i].E.DOMWindow.close();
	}
	
	gEditor.cleanUp();
}
// end - canvas functions to act across all canvases
function obsHandler_nativeshotEditorLoaded(aSubject, aTopic, aData) {
	
	var iMon = aData; //parseInt(aEditorDOMWindow.location.search.substr('?iMon='.length)); // iMon is my rename of colMonIndex. so its the i in the collMoninfos object
	//console.error('loaded window for iMon:', iMon);
	
	var aEditorDOMWindow = colMon[iMon].E.DOMWindow;
	
	if (!aEditorDOMWindow || aEditorDOMWindow.closed) {
		throw new Error('wtf how is window not existing, the on load observer notifier of panel.xul just sent notification that it was loaded');
	}
	
	var aHwndPtrStr = aEditorDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIWebNavigation)
										.QueryInterface(Ci.nsIDocShellTreeItem)
										.treeOwner
										.QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIBaseWindow)
										.nativeHandle;
	
	colMon[iMon].hwndPtrStr = aHwndPtrStr;
	
	aEditorDOMWindow.moveTo(colMon[iMon].x, colMon[iMon].y);
	
	aEditorDOMWindow.focus();
	aEditorDOMWindow.fullScreen = true;
	
	/*
	// set window on top:
	var aArrHwndPtr = [aHwndPtrStr];
	var aArrHwndPtrOsParams = {};
	aArrHwndPtrOsParams[aHwndPtrStr] = {
		left: colMon[iMon].x,
		top: colMon[iMon].y,
		right: colMon[iMon].x + colMon[iMon].w,
		bottom: colMon[iMon].y + colMon[iMon].h
	};
	var promise_setWinAlwaysTop = MainWorker.post('setWinAlwaysOnTop', [aArrHwndPtr, aArrHwndPtrOsParams]);
	promise_setWinAlwaysTop.then(
		function(aVal) {
			console.log('Fullfilled - promise_setWinAlwaysTop - ', aVal);
			// start - do stuff here - promise_setWinAlwaysTop
			// end - do stuff here - promise_setWinAlwaysTop
		},
		function(aReason) {
			var rejObj = {name:'promise_setWinAlwaysTop', aReason:aReason};
			console.error('Rejected - promise_setWinAlwaysTop - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_setWinAlwaysTop', aCaught:aCaught};
			console.error('Caught - promise_setWinAlwaysTop - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	);
	*/
	
	// setting up the dom base, moved it to above the "os specific special stuff" because some os's might need to modify this (like win81)
	var w = colMon[iMon].w;
	var h = colMon[iMon].h;
	
	var json = 
	[
		'xul:stack', {id:'contOfCans'},
				['html:canvas', {draggable:'false',id:'canBase',width:w,height:h,style:'display:-moz-box;cursor:crosshair;display:-moz-box;background:#000 url(' + core.addon.path.images + 'canvas_bg.png) repeat fixed top left;'}],
				['html:canvas', {draggable:'false',id:'canDim',width:w,height:h,style:'display:-moz-box;cursor:crosshair;'}]
	];
	
	// os specific special stuff
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
				
				if (core.os.version >= 6.3) { // win81+ has multi monitor dpi issue while firefox bug 890156 persists // http://stackoverflow.com/a/31500103/1828637 // https://bugzilla.mozilla.org/show_bug.cgi?id=890156
					var win81ScaleX = colMon[iMon].win81ScaleX;
					var win81ScaleY = colMon[iMon].win81ScaleY;
					if (win81ScaleX || win81ScaleY) {
						json.push(['html:canvas', {id:'canDum',style:'display:none;',width:w,height:h}]);
						w = Math.ceil(w / win81ScaleX);
						h = Math.ceil(h / win81ScaleY);
						console.warn('modified w and h:', w, h);
						
						json[2][1].width = w;
						json[2][1].height = h;
						json[2][1].style += 'position:fixed;';
						
						json[3][1].width = w;
						json[3][1].height = h;
						json[3][1].style += 'position:fixed;';
						
						console.warn('scale moded:', json);
					}				
				}
			
			break;
		case 'darwin':
			
				aEditorDOMWindow.setTimeout(function() {
					//aEditorDOMWindow.focus(); // doesnt work to make take full
					//aEditorDOMWindow.moveBy(0, -10); // doesnt work to make take full
					aEditorDOMWindow.resizeBy(0, 0) // makes it take full. as fullScreen just makes it hide the special ui and resize to as if special ui was there, this makes it resize now that they are gone. no animation takes place on chromeless window, excellent
				}, 10);
			
			break;
		default:
			// nothing special
	}
	
	// start - postStuff
	// aEditorDOMWindow.setTimeout(function() {
	// insert canvases and menu	
	var doc = aEditorDOMWindow.document;
	var elRef = {};
	doc.documentElement.appendChild(jsonToDOM(json, doc, elRef));
	
	var ctxBase = elRef.canBase.getContext('2d');
	var ctxDim = elRef.canDim.getContext('2d');
	
	// set global E. props
	colMon[iMon].E.canBase = elRef.canBase;
	colMon[iMon].E.canDim = elRef.canDim;
	colMon[iMon].E.ctxBase = ctxBase;
	colMon[iMon].E.ctxDim = ctxDim;
	
	//console.error('colMon[iMon].screenshot:', colMon[iMon].screenshot)
	if (win81ScaleX || win81ScaleY) {
		// rescaled for Win81 DPI non aware bug
		console.warn('drawing rescaled');
		var ctxDum = elRef.canDum.getContext('2d');
		ctxDum.putImageData(colMon[iMon].screenshot, 0, 0);
		ctxBase.scale(1/colMon[iMon].win81ScaleX, 1/colMon[iMon].win81ScaleY);
		ctxBase.drawImage(elRef.canDum, 0, 0);
		elRef.canDum.parentNode.removeChild(elRef.canDum);
		//ctxDim.clearRect(elRef.canDim.width, elRef.canDim.height);
		//ctxBase.scale(1/colMon[iMon].win81ScaleX,1/colMon[iMon].win81ScaleY);
		
		ctxDim.scale(1/colMon[iMon].win81ScaleX, 1/colMon[iMon].win81ScaleY);
	} else {
		ctxBase.putImageData(colMon[iMon].screenshot, 0, 0);
	}
	
	ctxDim.fillStyle = 'rgba(0, 0, 0, 0.6)';
	ctxDim.fillRect(0, 0, colMon[iMon].w, colMon[iMon].h);

	var menuElRef = {};
	//console.error('ok going to append');
	doc.documentElement.appendChild(jsonToDOM(gEMenuDomJson, doc, menuElRef));
	//console.error('ok APPENDED??');
	doc.documentElement.setAttribute('context', 'myMenu1');
	
	// set up up event listeners
	
	aEditorDOMWindow.addEventListener('unload', gEUnload, false);
	aEditorDOMWindow.addEventListener('mousedown', gEMouseDown, false);
	aEditorDOMWindow.addEventListener('mouseup', gEMouseUp, false);

	// special per os stuff
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				// make window always on top
				
			break;
		case 'gtk':

				// make window always on top
				
			break;
		
		case 'darwin':
				
				// make window always on top
			
			break;
		default:
			console.error('os not supported');
	}
	// }, 1000);
	// end - postStuff
}
// end - observer handlers

function shootAllMons(aDOMWindow) {
	
	gESelected = false;
	var openWindowOnEachMon = function() {
		for (var i=0; i<colMon.length; i++) {
			var aEditorDOMWindow = Services.ww.openWindow(null, core.addon.path.content + 'panel.xul?iMon=' + i, '_blank', 'chrome,width=1,height=1,screenX=1,screenY=1', null);
			colMon[i].E = {
				DOMWindow: aEditorDOMWindow,
				docEl: aEditorDOMWindow.document.documentElement,
				doc: aEditorDOMWindow.document,
			};
			//console.info('aEditorDOMWindow:', aEditorDOMWindow);
		}
	};
	
	var promise_shoot = MainWorker.post('shootAllMons', []);
	promise_shoot.then(
		function(aVal) {
			console.log('Fullfilled - promise_shoot - ', aVal);
			// start - do stuff here - promise_shoot
			colMon = aVal;
			// set gETopLeftMostX and gETopLeftMostY
			for (var i=0; i<colMon.length; i++) {
				colMon[i].rect = new Rect(colMon[i].x, colMon[i].y, colMon[i].w, colMon[i].h);
				if (i == 0) {
					gETopLeftMostX = colMon[i].x;
					gETopLeftMostY = colMon[i].y;
				} else {
					if (colMon[i].x < gETopLeftMostX) {
						gETopLeftMostX = colMon[i].x;
					}
					if (colMon[i].y < gETopLeftMostY) {
						gETopLeftMostY = colMon[i].y;
					}
				}
			}
			openWindowOnEachMon();
			// end - do stuff here - promise_shoot
		},
		function(aReason) {
			var rejObj = {name:'promise_shoot', aReason:aReason};
			console.warn('Rejected - promise_shoot - ', rejObj);
			Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'NativeShot - Exception', 'An exception occured while taking screenshot, see Browser Console for more information');
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_shoot', aCaught:aCaught};
			console.error('Caught - promise_shoot - ', rejObj);
			Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'NativeShot - Error', 'An error occured while taking screenshot, see Browser Console for more information');
		}
	);
}

// END - Addon Functionalities
// start - clipboard boilerplate
// Create a constructor for the built-in supports-string class.
const nsSupportsString = CC("@mozilla.org/supports-string;1", "nsISupportsString");
function SupportsString(str) {
    // Create an instance of the supports-string class
    var res = nsSupportsString();

    // Store the JavaScript string that we want to wrap in the new nsISupportsString object
    res.data = str;
    return res;
}

// Create a constructor for the built-in transferable class
const nsTransferable = CC("@mozilla.org/widget/transferable;1", "nsITransferable");

// Create a wrapper to construct an nsITransferable instance and set its source to the given window, when necessary
function Transferable(source) {
    var res = nsTransferable();
    if ('init' in res) {
        // When passed a Window object, find a suitable privacy context for it.
        if (source instanceof Ci.nsIDOMWindow) {
            // Note: in Gecko versions >16, you can import the PrivateBrowsingUtils.jsm module
            // and use PrivateBrowsingUtils.privacyContextFromWindow(sourceWindow) instead
            source = source.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
		}
		
        res.init(source);
    }
    return res;
}
// end - clipboard boilerplate
/*start - windowlistener*/
var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {
		
		// Load into any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				windowListener.loadIntoWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					windowListener.loadIntoWindow(aDOMWindow);
				}, false);
			}
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		/*
		for (var u in unloaders) {
			unloaders[u]();
		}
		*/
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.loadSheet(cui_cssUri, domWinUtils.AUTHOR_SHEET);
		}
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.removeSheet(cui_cssUri, domWinUtils.AUTHOR_SHEET);
		}
	}
};
/*end - windowlistener*/

function install() {}
function uninstall() {}

function startup(aData, aReason) {
	core.addon.aData = aData;
	extendCore();
	
	PromiseWorker = Cu.import(core.addon.path.content + 'modules/PromiseWorker.jsm').BasePromiseWorker;
	
	var promise_getMainWorker = SIPWorker('MainWorker', core.addon.path.content + 'modules/workers/MainWorker.js');
	promise_getMainWorker.then(
		function(aVal) {
			console.log('Fullfilled - promise_getMainWorker - ', aVal);
			// start - do stuff here - promise_getMainWorker
			// end - do stuff here - promise_getMainWorker
		},
		function(aReason) {
			var rejObj = {
				name: 'promise_getMainWorker',
				aReason: aReason
			};
			console.warn('Rejected - promise_getMainWorker - ', rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {
				name: 'promise_getMainWorker',
				aCaught: aCaught
			};
			console.error('Caught - promise_getMainWorker - ', rejObj);
		}
	);
	
	CustomizableUI.createWidget({
		id: 'cui_nativeshot',
		defaultArea: CustomizableUI.AREA_NAVBAR,
		label: myServices.sb.GetStringFromName('cui_nativeshot_lbl'),
		tooltiptext: myServices.sb.GetStringFromName('cui_nativeshot_tip'),
		onCommand: function(aEvent) {
			var aDOMWin = aEvent.target.ownerDocument.defaultView;
			gEditor.gBrowserDOMWindow = aDOMWin;
			if (aEvent.shiftKey == 1) {
				// default time delay queue
				aDOMWin.setTimeout(function() {
					shootAllMons(aDOMWin);
				}, 5000);
			} else {
				// imemdiate freeze
				shootAllMons(aDOMWin);
			}
		}
	});
	
	//windowlistener more
	windowListener.register();
	//end windowlistener more
	
	//start observers stuff more
	for (var o in observers) {
		observers[o].reg();
	}
	//end observers stuff more
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }
	
	CustomizableUI.destroyWidget('cui_nativeshot');
	
	//windowlistener more
	windowListener.unregister();
	//end windowlistener more
	
	//start observers stuff more
	for (var o in observers) {
		observers[o].unreg();
	}
	//end observers stuff more
	
	Cu.unload(core.addon.path.content + 'modules/PromiseWorker.jsm');
}

// start - common helper functions
function Deferred() {
	if (Promise && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (PromiseUtils && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else if (Promise) {
		try {
			/* A method to resolve the associated Promise with the value passed.
			 * If the promise is already settled it does nothing.
			 *
			 * @param {anything} value : This value is used to resolve the promise
			 * If the value is a Promise then the associated promise assumes the state
			 * of Promise passed as value.
			 */
			this.resolve = null;

			/* A method to reject the assocaited Promise with the value passed.
			 * If the promise is already settled it does nothing.
			 *
			 * @param {anything} reason: The reason for the rejection of the Promise.
			 * Generally its an Error object. If however a Promise is passed, then the Promise
			 * itself will be the reason for rejection no matter the state of the Promise.
			 */
			this.reject = null;

			/* A newly created Pomise object.
			 * Initially in pending state.
			 */
			this.promise = new Promise(function(resolve, reject) {
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this));
			Object.freeze(this);
		} catch (ex) {
			console.error('Promise not available!', ex);
			throw new Error('Promise not available!');
		}
	} else {
		throw new Error('Promise not available!');
	}
}

function SIPWorker(workerScopeName, aPath, aCore=core) {
	// "Start and Initialize PromiseWorker"
	// returns promise
		// resolve value: jsBool true
	// aCore is what you want aCore to be populated with
	// aPath is something like `core.addon.path.content + 'modules/workers/blah-blah.js'`
	
	// :todo: add support and detection for regular ChromeWorker // maybe? cuz if i do then ill need to do ChromeWorker with callback
	
	var deferredMain_SIPWorker = new Deferred();

	if (!(workerScopeName in bootstrap)) {
		bootstrap[workerScopeName] = new PromiseWorker(aPath);
		
		if ('addon' in aCore && 'aData' in aCore.addon) {
			delete aCore.addon.aData; // we delete this because it has nsIFile and other crap it, but maybe in future if I need this I can try JSON.stringify'ing it
		}
		
		var promise_initWorker = bootstrap[workerScopeName].post('init', [aCore]);
		promise_initWorker.then(
			function(aVal) {
				console.log('Fullfilled - promise_initWorker - ', aVal);
				// start - do stuff here - promise_initWorker
				deferredMain_SIPWorker.resolve(true);
				// end - do stuff here - promise_initWorker
			},
			function(aReason) {
				var rejObj = {name:'promise_initWorker', aReason:aReason};
				console.warn('Rejected - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initWorker', aCaught:aCaught};
				console.error('Caught - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		);
		
	} else {
		deferredMain_SIPWorker.reject('Something is loaded into bootstrap[workerScopeName] already');
	}
	
	return deferredMain_SIPWorker.promise;
	
}
function jsonToDOM(json, doc, nodes) {

    var namespaces = {
        html: 'http://www.w3.org/1999/xhtml',
        xul: 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
    };
    var defaultNamespace = namespaces.html;

    function namespace(name) {
        var m = /^(?:(.*):)?(.*)$/.exec(name);        
        return [namespaces[m[1]], m[2]];
    }

    function tag(name, attr) {
        if (Array.isArray(name)) {
            var frag = doc.createDocumentFragment();
            Array.forEach(arguments, function (arg) {
                if (!Array.isArray(arg[0]))
                    frag.appendChild(tag.apply(null, arg));
                else
                    arg.forEach(function (arg) {
                        frag.appendChild(tag.apply(null, arg));
                    });
            });
            return frag;
        }

        var args = Array.slice(arguments, 2);
        var vals = namespace(name);
        var elem = doc.createElementNS(vals[0] || defaultNamespace, vals[1]);

        for (var key in attr) {
            var val = attr[key];
            if (nodes && key == 'id')
                nodes[val] = elem;

            vals = namespace(key);
            if (typeof val == 'function')
                elem.addEventListener(key.replace(/^on/, ''), val, false);
            else
                elem.setAttributeNS(vals[0] || '', vals[1], val);
        }
        args.forEach(function(e) {
            try {
                elem.appendChild(
                                    Object.prototype.toString.call(e) == '[object Array]'
                                    ?
                                        tag.apply(null, e)
                                    :
                                        e instanceof doc.defaultView.Node
                                        ?
                                            e
                                        :
                                            doc.createTextNode(e)
                                );
            } catch (ex) {
                elem.appendChild(doc.createTextNode(ex));
            }
        });
        return elem;
    }
    return tag.apply(null, json);
}
var _getSafedForOSPath_pattWIN = /([\\*:?<>|\/\"])/g;
var _getSafedForOSPath_pattNIXMAC = /\//g;
const repCharForSafePath = '-';
function getSafedForOSPath(aStr, useNonDefaultRepChar) {
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
		
				return aStr.replace(_getSafedForOSPath_pattWIN, useNonDefaultRepChar ? useNonDefaultRepChar : repCharForSafePath);
				
			break;
		default:
		
				return aStr.replace(_getSafedForOSPath_pattNIXMAC, useNonDefaultRepChar ? useNonDefaultRepChar : repCharForSafePath);
	}
}
function xhr(aStr, aOptions={}) {
	// currently only setup to support GET and POST
	// does an async request
	// aStr is either a string of a FileURI such as `OS.Path.toFileURI(OS.Path.join(OS.Constants.Path.desktopDir, 'test.png'));` or a URL such as `http://github.com/wet-boew/wet-boew/archive/master.zip`
	// Returns a promise
		// resolves with xhr object
		// rejects with object holding property "xhr" which holds the xhr object
	
	/*** aOptions
	{
		aLoadFlags: flags, // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/NsIRequest#Constants
		aTiemout: integer (ms)
		isBackgroundReq: boolean, // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Non-standard_properties
		aResponseType: string, // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Browser_Compatibility
		aPostData: string
	}
	*/
	
	var aOptions_DEFAULT = {
		aLoadFlags: Ci.nsIRequest.LOAD_ANONYMOUS | Ci.nsIRequest.LOAD_BYPASS_CACHE | Ci.nsIRequest.INHIBIT_PERSISTENT_CACHING,
		aPostData: null,
		aResponseType: 'text',
		isBackgroundReq: true, // If true, no load group is associated with the request, and security dialogs are prevented from being shown to the user
		aTimeout: 0, // 0 means never timeout, value is in milliseconds
		Headers: null
	}
	
	for (var opt in aOptions_DEFAULT) {
		if (!(opt in aOptions)) {
			aOptions[opt] = aOptions_DEFAULT[opt];
		}
	}
	
	// Note: When using XMLHttpRequest to access a file:// URL the request.status is not properly set to 200 to indicate success. In such cases, request.readyState == 4, request.status == 0 and request.response will evaluate to true.
	
	var deferredMain_xhr = new Deferred();
	console.log('here222');
	let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

	let handler = ev => {
		evf(m => xhr.removeEventListener(m, handler, !1));

		switch (ev.type) {
			case 'load':
			
					if (xhr.readyState == 4) {
						if (xhr.status == 200) {
							deferredMain_xhr.resolve(xhr);
						} else {
							var rejObj = {
								name: 'deferredMain_xhr.promise',
								aReason: 'Load Not Success', // loaded but status is not success status
								xhr: xhr,
								message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
							};
							deferredMain_xhr.reject(rejObj);
						}
					} else if (xhr.readyState == 0) {
						var uritest = Services.io.newURI(aStr, null, null);
						if (uritest.schemeIs('file')) {
							deferredMain_xhr.resolve(xhr);
						} else {
							var rejObj = {
								name: 'deferredMain_xhr.promise',
								aReason: 'Load Failed', // didnt even load
								xhr: xhr,
								message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
							};
							deferredMain_xhr.reject(rejObj);
						}
					}
					
				break;
			case 'abort':
			case 'error':
			case 'timeout':
				
					var rejObj = {
						name: 'deferredMain_xhr.promise',
						aReason: ev.type[0].toUpperCase() + ev.type.substr(1),
						xhr: xhr,
						message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					};
					deferredMain_xhr.reject(rejObj);
				
				break;
			default:
				var rejObj = {
					name: 'deferredMain_xhr.promise',
					aReason: 'Unknown',
					xhr: xhr,
					message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
				};
				deferredMain_xhr.reject(rejObj);
		}
	};

	let evf = f => ['load', 'error', 'abort'].forEach(f);
	evf(m => xhr.addEventListener(m, handler, false));

	if (aOptions.isBackgroundReq) {
		xhr.mozBackgroundRequest = true;
	}
	
	if (aOptions.aTimeout) {
		xhr.timeout
	}
	
	var do_setHeaders = function() {
		if (aOptions.Headers) {
			for (var h in aOptions.Headers) {
				xhr.setRequestHeader(h, aOptions.Headers[h]);
			}
		}
	};
	
	if (aOptions.aPostData) {
		xhr.open('POST', aStr, true);
		do_setHeaders();
		xhr.channel.loadFlags |= aOptions.aLoadFlags;
		xhr.responseType = aOptions.aResponseType;
		
		/*
		var aFormData = Cc['@mozilla.org/files/formdata;1'].createInstance(Ci.nsIDOMFormData);
		for (var pd in aOptions.aPostData) {
			aFormData.append(pd, aOptions.aPostData[pd]);
		}
		xhr.send(aFormData);
		*/
		var aPostStr = [];
		for (var pd in aOptions.aPostData) {
			aPostStr.push(pd + '=' + encodeURIComponent(aOptions.aPostData[pd])); // :todo: figure out if should encodeURIComponent `pd` also figure out if encodeURIComponent is the right way to do this
		}
		console.info('aPostStr:', aPostStr.join('&'));
		xhr.send(aPostStr.join('&'));
	} else {
		xhr.open('GET', aStr, true);
		do_setHeaders();
		xhr.channel.loadFlags |= aOptions.aLoadFlags;
		xhr.responseType = aOptions.aResponseType;
		xhr.send(null);
	}
	
	return deferredMain_xhr.promise;
}
var txtEncodr; // holds TextDecoder if created
function getTxtEncodr() {
	if (!txtEncodr) {
		txtEncodr = new TextEncoder();
	}
	return txtEncodr;
}
// end - common helper functions