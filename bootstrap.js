// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

const { BasePromiseWorker } = Cu.import('resource://gre/modules/PromiseWorker.jsm', {});
Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import('resource://gre/modules/FileUtils.jsm');
Cu.import('resource://gre/modules/Geometry.jsm');
const {TextDecoder, TextEncoder, OS} = Cu.import('resource://gre/modules/osfile.jsm', {});
Cu.import('resource://gre/modules/Promise.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.importGlobalProperties(['btoa', 'atob']);

// Globals
const core = {
	addon: {
		name: 'NativeShot',
		id: 'NativeShot@jetpack',
		path: {
			name: 'nativeshot',
			content: 'chrome://nativeshot/content/',
			content_accessible: 'chrome://nativeshot-accessible/content/',
			images: 'chrome://nativeshot/content/resources/images/',
			locale: 'chrome://nativeshot/locale/',
			resources: 'chrome://nativeshot/content/resources/',
			scripts: 'chrome://nativeshot/content/resources/scripts/',
			styles: 'chrome://nativeshot/content/resources/styles/',
		},
		cache_key: Math.random() // set to version on release
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase(),
		toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
		xpcomabi: Services.appinfo.XPCOMABI
	},
	firefox: {
		pid: Services.appinfo.processID,
		version: Services.appinfo.version
	}
};

var bootstrap = this;
const NS_HTML = 'http://www.w3.org/1999/xhtml';
const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const cui_cssUri = Services.io.newURI(core.addon.path.styles + 'cui.css', null, null);
const JETPACK_DIR_BASENAME = 'jetpack';
const OSPath_historyImgHostAnonImgur = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage', 'imgur-history-anon.unbracketed.json');
const OSPath_historyLog = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage', 'history-log.unbracketed.json');

const TWITTER_MAX_FILE_SIZE = 5242880; // i got this from doing debugger prettify on twitter javascript files
const TWITTER_MAX_UPLOAD_FILE_SIZE = 3145728; // i got this from doing debugger prettify on twitter javascript files
const TWITTER_URL = 'https://twitter.com/';
const TWITTER_IMG_SUFFIX = ':large';

const myPrefBranch = 'extensions.' + core.addon.id + '.';

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'as', function () { return Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService) });
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'mm', function () { return Cc['@mozilla.org/globalmessagemanager;1'].getService(Ci.nsIMessageBroadcaster).QueryInterface(Ci.nsIFrameScriptLoader); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'bootstrap.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

function extendCore() {
	// adds some properties i use to core based on the current operating system, it needs a switch, thats why i couldnt put it into the core obj at top
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

// about module
var aboutFactory_nativeshot;
function AboutNativeShot() {}
AboutNativeShot.prototype = Object.freeze({
	classDescription: 'NativeShot Dashboard',
	contractID: '@mozilla.org/network/protocol/about;1?what=nativeshot',
	classID: Components.ID('{2079bd20-3369-11e5-a2cb-0800200c9a66}'),
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

	getURIFlags: function(aURI) {
		return Ci.nsIAboutModule.ALLOW_SCRIPT;
	},

	newChannel: function(aURI) {
		var channel;
		if (aURI.path.toLowerCase().indexOf('?options') > -1) {
			channel = Services.io.newChannel(core.addon.path.content + 'app/options.xhtml', null, null);
		} else {
			channel = Services.io.newChannel(core.addon.path.content + 'app/main.xhtml', null, null);
		}
		channel.originalURI = aURI;
		return channel;
	}
});

function AboutFactory(component) {
	this.createInstance = function(outer, iid) {
		if (outer) {
			throw Cr.NS_ERROR_NO_AGGREGATION;
		}
		return new component();
	};
	this.register = function() {
		Cm.registerFactory(component.prototype.classID, component.prototype.classDescription, component.prototype.contractID, this);
	};
	this.unregister = function() {
		Cm.unregisterFactory(component.prototype.classID, this);
	}
	Object.freeze(this);
	this.register();
}

// START - Addon Functionalities					
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

var gEMenuDomJson;
var gEMenuArrRefs = {
	select_fullscreen: null
};
function get_gEMenuDomJson() {
	if (!gEMenuDomJson) {
		gEMenuDomJson =
			['xul:popupset', {},
				['xul:menupopup', {id: 'myMenu1'},
					['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_save-file-quick'), oncommand:function(e){ gEditor.saveToFile(e, true) }}],
					['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_save-file-browse'), oncommand:function(e){ gEditor.saveToFile(e) }}],
					['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_copy'), oncommand:function(e){ gEditor.copyToClipboard(e) }}],
					/*
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
					*/
					['xul:menu', {label:myServices.sb.GetStringFromName('editor-menu_upload-img-host-anon')},
						['xul:menupopup', {},
							/*['xul:menuitem', {label:'FreeImageHosting.net'}],*/
							['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_imgur'), oncommand:function(e){ gEditor.uploadToImgur(e, false) }}]
						]
					],
					['xul:menu', {label:myServices.sb.GetStringFromName('editor-menu_share-to-social')},
						['xul:menupopup', {},
							/*['xul:menuitem', {label:'Facebook'}],*/
							['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_twitter'), oncommand:function(e){ gEditor.shareToTwitter(e) }}]
						]
					],
					['xul:menu', {label:'Upload to Cloud Storage'}, //:l10n:
						['xul:menupopup', {},
							/*['xul:menuitem', {label:'Google Drive'}],*/ // :l10n:
							/*['xul:menuitem', {label:'OneDrive'}],*/ // :l10n:
							['xul:menuitem', {label:'Dropbox', oncommand:function(e){ gEditor.uploadToDropbox(e) }}] // :l10n:
						]
					],
					['xul:menuitem', {id:'print_menuitem', label:myServices.sb.GetStringFromName('editor-menu_print'), oncommand:function(e){ gEditor.sendToPrinter(e) }}],
					['xul:menuseparator', {}],
					['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_select-clear'), oncommand:function(e){ gEditor.clearSelection(e) }}],
					['xul:menu', {label:myServices.sb.GetStringFromName('editor-menu_select-fullscreen')},
						gEMenuArrRefs.select_fullscreen
					],
					['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_select-window'), oncommand:function(e){ gEditor.selectWindow(e) }}],
					/*
					['xul:menu', {label:'Select Window'},
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
					*/
					['xul:menuseparator', {}],
					['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_close'), oncommand:function() { gEditor.closeOutEditor({shiftKey:false}) }}]
				]
			];
	}
	
	return gEMenuDomJson;
}
// start - observer handlers
var gColReuploadTimers = {};
var gLastReuploadTimerId = 0;
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
		// if (aObjConvertScreenToLayer) { console.error('start exec'); } // :debug:
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
			
			// var orig = JSON.stringify(clone_aArrFuncArgs); // :debug:
			
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
				// console.info('iMon:', i, 'rectIntersecting:', rectIntersecting, 'cRect:', cRect, 'colMon[i].rect:', colMon[i].rect)
				if (rectIntersecting.left == rectIntersecting.right || rectIntersecting.top == rectIntersecting.bottom) { // if width OR height are 0 it means no intersection between the two rect's
					// does not intersect, continue to next monitor
					// console.warn('iMon:', i,'no intersect, contin to next mon', 'cRect:', cRect, 'colMon[i].rect:', colMon[i].rect);
					continue;
				} else {
					//console.info('due to interesect here is comparison of x y w h:', rectIntersecting.left, rectIntersecting.right, rectIntersecting.left == rectIntersecting.right, rectIntersecting.top == rectIntersecting.bottom, rectIntersecting.top, rectIntersecting.bottom)
					// convert screen xy of rect to layer xy
					clone_aArrFuncArgs[aObjConvertScreenToLayer.x] = rectIntersecting.left - colMon[i].x;
					clone_aArrFuncArgs[aObjConvertScreenToLayer.y] = rectIntersecting.top - colMon[i].y;
					
					// adjust width and height, needed for multi monitor selection correction
					clone_aArrFuncArgs[aObjConvertScreenToLayer.w] = rectIntersecting.width;
					clone_aArrFuncArgs[aObjConvertScreenToLayer.h] = rectIntersecting.height;
					//console.log('args converted from screen to layer xy:', 'from:', JSON.parse(orig), 'to:', clone_aArrFuncArgs);
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
	},
	execStyle: function(aPropName, aPropVal) {
		for (var i=0; i<colMon.length; i++) {
			var aCanDim = colMon[i].E.canDim;
			aCanDim.style[aPropName] = aPropVal;
		}
	}
};

var gNotifierStrRandomizer = ' '; // because on ubuntu if back to back same exact title and/or msg (not sure the combintation) the native alert wont show the second time but alertshown triggers as if it had shown but didnt, but probably triggered cuz the one before it was the same
var gENotifListener = {
	observe: function(aSubject, aTopic, aData) {
		// aSubject is always null
		// aData is the aClickCookie, i set aClickCookie to notif id. if its not clickable aClickCookie is not set
		// aTopic is: alertfinished, alertclickcallback, alertshow
		console.error('incoming notification observer:', aSubject, aTopic, aData);
		if (aTopic == 'alertclickcallback')	{
			console.error('user clicked trying to throw click');
			if (gNotifClickCallback[aData]) {
				gNotifClickCallback[aData]();
				delete gNotifClickCallback[aData];
			}
		} else if (aTopic == 'alertshow') {
			//gENotifPending[0].shown = true;
			var shown = gENotifPending.splice(0, 1);
			console.log('just showed:', shown);
			gNotifierStrRandomizer = gNotifierStrRandomizer == ' ' ? '' : ' ';
		} else if (aTopic == 'alertfinished') {
			console.log('just alertfinished')
			if (gNotifClickCallback[aData]) {
				// user didnt click it
				console.warn('user didnt click it man');
				delete gNotifClickCallback[aData];
			}
		}
	}
};
var gNotifClickCallback = {};
var gNotifLastId = 0;  //minimum gNotifLastId is 1 link687412
var gENotifPending = []; // contains array of objs like: {shown:false, aTitle:'', aMsg:'', aClickCookie:''}
var gNotifTimerRunning = false;
// ensures to show notifications in order
const gNotifTimerInterval = 1000; //ms
var gENotifCallback = {
	notify: function() {
		console.log('triggered notif callback, this is the arr:', JSON.stringify(gENotifPending));
		if (gENotifPending.length > 0) {
			if (gENotifPending[0].aClickCookie !== null) {
				console.warn('doing showAlert with CLICK cookie');
				myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', myServices.sb.GetStringFromName('addon_name') + ' - ' + gENotifPending[0].aTitle + gNotifierStrRandomizer, gENotifPending[0].aMsg, true, gENotifPending[0].aClickCookie, gENotifListener, 'NativeShot');
			} else {
				myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', myServices.sb.GetStringFromName('addon_name') + ' - ' + gENotifPending[0].aTitle + gNotifierStrRandomizer, gENotifPending[0].aMsg, null, null, gENotifListener, 'NativeShot');
			}
			gNotifTimer.initWithCallback(gENotifCallback, gNotifTimerInterval, Ci.nsITimer.TYPE_ONE_SHOT);
		} else {
			gNotifTimerRunning = false;
			gNotifTimer = null;
		}
	}
};
var gPostPrintRemovalFunc;
const reuploadTimerInterval = 10000;

function notifCB_saveToFile(aOSPath_savedFile) {
	console.error('in the click thingy baby');
	var nsifile = FileUtils.File(aOSPath_savedFile);
	showFileInOSExplorer(nsifile);
}

var gMacTypes;
function initMacTypes() {
	if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
		var is64bit = false;
	} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
		var is64bit = true;
	} else {
		throw new Error('huh??? not 32 or 64 bit?!?!');
	}
	gMacTypes = {};
	gMacTypes.NIL = ctypes.voidptr_t(ctypes.UInt64('0x0'));
	gMacTypes.BOOL = ctypes.signed_char;
	gMacTypes.YES = gMacTypes.BOOL(1);
	gMacTypes.objc = ctypes.open(ctypes.libraryName("objc"));
	gMacTypes.id = ctypes.voidptr_t;
	gMacTypes.SEL = ctypes.voidptr_t;
	gMacTypes.CGFloat = is64bit ? ctypes.double : ctypes.float;
	gMacTypes.NSInteger = is64bit ? ctypes.long: ctypes.int;
	
	gMacTypes.NSPoint = ctypes.StructType('_NSPoint', [
		{ 'x': gMacTypes.CGFloat },
		{ 'y': gMacTypes.CGFloat }
	]);
	gMacTypes.NSSize = ctypes.StructType('_NSSize', [
		{ 'width': gMacTypes.CGFloat },
		{ 'height': gMacTypes.CGFloat }
	]);
	gMacTypes.NSRect = ctypes.StructType('_NSRect', [
		{ 'origin': gMacTypes.NSPoint },
		{ 'size': gMacTypes.NSSize }
	]);
	
gMacTypes.objc_getClass = gMacTypes.objc.declare("objc_getClass",
ctypes.default_abi,
gMacTypes.id,
ctypes.char.ptr);

gMacTypes.sel_registerName = gMacTypes.objc.declare("sel_registerName",
ctypes.default_abi,
gMacTypes.SEL,
ctypes.char.ptr);

gMacTypes.objc_msgSend = gMacTypes.objc.declare("objc_msgSend",
ctypes.default_abi,
gMacTypes.id,
gMacTypes.id,
gMacTypes.SEL,
"...");

gMacTypes.objc_msgSend_NSRECT = gMacTypes.objc.declare("objc_msgSend",
ctypes.default_abi,
gMacTypes.NSRect,
gMacTypes.id,
gMacTypes.SEL,
"...");

}
var userAckPending = [ // object holding on to data till user is notified of the tabs, images have succesfully been dropped into tabs, and user ancknolwedges by makeing focus to tabs (as i may need to hold onto the data, if user is not signed in, or if user want to use another account [actually i dont think ill bother with other account thing, just signed in])
// {gEditorSessionId:,tab:,fs:,imgDatas:{dataURL,uploadedURL,attachedToTweet,sentToFS}} // array of objects, weak reference to tab, framescript, the 4 (because thats max allowed by twitter per tweet) data uri of imgs for that tab, and then after upload it holds the image urls for copy to clipboard
];

const fsComServer = {
	serverId: Math.random(),
	// start - twitter framescript specific
	twitterListenerRegistered: false,
	twitterClientMessageListener: {
		// listens to messages sent from clients (child framescripts) to me/server
		// also from old server, to listen when to trigger updated register
		receiveMessage: function(aMsg) {
			console.error('SERVER recieving msg:', aMsg.json);
			if ((aMsg.json.subServer == 'twitter') && (!('serverId' in aMsg.json) || aMsg.json.serverId == fsComServer.serverId)) {
				switch (aMsg.json.aTopic) {
					/* // i dont need this because the sendMessage is sync event though sendAsync, so if i do load and do sendAsync message it will get that message
					case 'clientRequest_clientBorn':
							
							
							
						break;
					*/
					case 'clientNotify_twitterNotSignedIn':
							
							var refUAPEntry = getUAPEntry_byUserAckId(aMsg.json.userAckId);
							for (var imgId in refUAPEntry.imgDatas) {
								refUAPEntry.imgDatas[imgId].attachedToTweet = false;
							}
							// set button to reopen tweet with attachments, which should just do fsComServer.twitter_IfFSReadyToAttach_sendNextUnattached()
							
							// NBs_updateGlobal_updateTwitterBtn(refUAPEntry, 'Not Signed In - Focus this tab and sign in, or sign into Twitter in another tab then reload this tab', 'nativeshot-twitter-bad', 'focus-tab'); // :todo: framescript should open the login box, and on succesfull login it should notify all other tabs that were waiting for login, that login happend and they should reload. but if user logs into a non watched twitter tab, then i wont get that automated message
							NBs_updateGlobal_updateTwitterBtn(refUAPEntry, myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-but-not-signed-in') + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-bad', 'focus-tab'); // :todo: framescript should open the login box, and on succesfull login it should notify all other tabs that were waiting for login, that login happend and they should reload. but if user logs into a non watched twitter tab, then i wont get that automated message
							
							
						break;
					case 'clientNotify_tweetClosedWithoutSubmit':
							
							var refUAPEntry = getUAPEntry_byUserAckId(aMsg.json.userAckId);
							for (var imgId in refUAPEntry.imgDatas) {
								refUAPEntry.imgDatas[imgId].attachedToTweet = false;
							}
							// set button to reopen tweet with attachments, which should just do fsComServer.twitter_IfFSReadyToAttach_sendNextUnattached()
							
							// NBs_updateGlobal_updateTwitterBtn(refUAPEntry, 'Tweet Dialog Closed - Twitter auto detached imgs - Click to reopen/reattach', 'nativeshot-twitter-bad', 'reopen-tweet-modal')
							NBs_updateGlobal_updateTwitterBtn(refUAPEntry, myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-but-dialog-closed') + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-bad', 'reopen-tweet-modal');
							
						break;
					case 'clientNotify_signedInShowAwaitingMsg':
							
							var refUAPEntry = getUAPEntry_byUserAckId(aMsg.json.userAckId);
							NBs_updateGlobal_updateTwitterBtn(refUAPEntry, myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-user-tweet') + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-neutral', 'focus-tab');
							
						break;
					case 'clientNotify_imgDeleted':
							
							// :todo: not yet set up as of sept 19 2015
							// when user clicks the x button from the tweet dialog
							var refUAPEntry = getUAPEntry_byUserAckId(aMsg.json.userAckId);
							delete refUAPEntry.imgDatas[aMsg.json.imgId];
							
						break;
					case 'clientNotify_clientUnregistered':
					
							console.error('ok in SERVER SIDE clientNotify_clientUnregistered');
							var refUAPEntry = getUAPEntry_byUserAckId(aMsg.json.userAckId);
							switch (aMsg.json.unregReason) {
								case 'error-loading':
								case 'non-twitter-load':
								case 'tab-closed':
								case 'twitter-page-unloaded':
								
										// note that none of the images were attached
										for (var imgId in refUAPEntry.imgDatas) {
											refUAPEntry.imgDatas[imgId].attachedToTweet = false;
										}
										
										var aMsg;
										switch (aMsg.json.unregReason) {
											case 'error-loading':
													
													// aMsg = 'Error loading Twitter - You may be offline - Click to open new tab and try again';
													aMsg = myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-but-error-loading');
													
												break;
											case 'non-twitter-load':
											case 'twitter-page-unloaded':
													
													// aMsg = 'Navigated away from Twitter.com - Click to open new tab with Twitter';
													aMsg = myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-but-twitter-unloaded');
													
												break;
											case 'tab-closed':
													
													// aMsg = 'Tab Closed - Click to reopen';
													aMsg = myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-but-tab-closed');
													
												break;
											default:
												throw new Error('unrecongized uregReason in sub block - should never get here');
										}
										
										NBs_updateGlobal_updateTwitterBtn(refUAPEntry, aMsg + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-bad', 'open-new-tab');
										console.error('should have set action btn to open-new-tab');
										
									break;
								case 'tweet-success':
										
										refUAPEntry.tweeted = true;
										
										// set urls to userAckId so can offer clipboard										
										var other_info = aMsg.json.clips.other_info;
										delete aMsg.json.clips.other_info;
										
										refUAPEntry.tweetURL = TWITTER_URL + other_info.permlink.substr(1); // because permlink is preceded by slash
										
										console.info('other_info:', other_info);
										
										for (var imgId in refUAPEntry.imgDatas) {
											delete refUAPEntry.imgDatas[imgId].dataURL;
											refUAPEntry.imgDatas[imgId].uploadedURL = aMsg.json.clips[imgId];
										}
										
										var crossWinId = refUAPEntry.gEditorSessionId + '-twitter';
										var aBtnInfos = NBs.crossWin[crossWinId].btns;
										var aBtnInfo;
										var cntBtnsTweeted = 0;
										for (var i=0; i<aBtnInfos.length; i++) {
											if (aBtnInfos[i].btn_id == refUAPEntry.userAckId) {
												aBtnInfo = aBtnInfos[i];
												cntBtnsTweeted++;
											} else {
												if (aBtnInfos[i].tweeted) {
													cntBtnsTweeted++;
												}
											}
										}
										if (cntBtnsTweeted == aBtnInfos.length) {
											// NBs.crossWin[crossWinId].msg = 'All images were succesfully tweeted!'; //:l10n:
											NBs.crossWin[crossWinId].msg = myServices.sb.GetStringFromName('notif-bar_twitter-msg-imgs-tweeted');
										}
										
										if (!aBtnInfo) {
											console.error('this should never happend, btn for userAckId was not found, userAckId', userAckId, 'aBtnInfos:', aBtnInfos, 'NBs.crossWin:', NBs.crossWin);
											throw new Error('this should never happen');
										}
										
										// no need to delete aBtnInfo.actionOnBtn as its not type menu so it wont have any affect
										aBtnInfo.tweeted = true;
										// aBtnInfo.label = 'Successfully Tweeted - Image URLs Copied';
										aBtnInfo.label = myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-tweeted') + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')';
										aBtnInfo.class = 'nativeshot-twitter-good';
										aBtnInfo.type = 'menu';
										aBtnInfo.popup = ['xul:menupopup', {},
															// ['xul:menuitem', {label:'Tweet URL', oncommand:copyTextToClip.bind(null, refUAPEntry.tweetURL) }] // :l10n:
															['xul:menuitem', {label:myServices.sb.GetStringFromName('notif-bar_twitter-menu-copy-tweet-link'), oncommand:copyTextToClip.bind(null, refUAPEntry.tweetURL) }]
														 ];

										var arrOfImgUrls = [];
										for (var imgId in refUAPEntry.imgDatas) {
											arrOfImgUrls.push(aMsg.json.clips[imgId]);
											// aBtnInfo.popup.push(['xul:menuitem', {label:'Image ' + arrOfImgUrls.length + ' URL', oncommand:copyTextToClip.bind(null, aMsg.json.clips[imgId])}]); // :l10n:
											aBtnInfo.popup.push(['xul:menuitem', {label:myServices.sb.formatStringFromName('notif-bar_twitter-menu-copy-single-image-link', [arrOfImgUrls.length], 1), oncommand:copyTextToClip.bind(null, aMsg.json.clips[imgId] + TWITTER_IMG_SUFFIX)}]);
										}
										
										if (arrOfImgUrls.length > 1) {
											// aBtnInfo.popup.push(['xul:menuitem', {label:'All ' + arrOfImgUrls.length + ' Image URLs', oncommand:copyTextToClip.bind(null, arrOfImgUrls.join('\n'))}]); // :l10n:
											aBtnInfo.popup.push(['xul:menuitem', {label:myServices.sb.formatStringFromName('notif-bar_twitter-menu-copy-all-image-links', [arrOfImgUrls.length], 1), oncommand:copyTextToClip.bind(null, arrOfImgUrls.join(TWITTER_IMG_SUFFIX + '\n') + TWITTER_IMG_SUFFIX)}]);
										}
										
										// copy all img urls to clipboard:
										copyTextToClip(arrOfImgUrls.join(TWITTER_IMG_SUFFIX + '\n') + TWITTER_IMG_SUFFIX);
										
										// get those uploaded urls
										// add in update to log file
										for (var i=0; i<arrOfImgUrls.length; i++) {
											appendToHistoryLog('twitter', {
												d: new Date().getTime() + i,
												u: other_info.user_id,
												// s: other_info.screen_name,
												p: other_info.permlink,
												l: arrOfImgUrls[i]
											});
										}
										
										NBs.updateGlobal(crossWinId, {
											lbl:1, // in case it was updated
											btns:{
												label: [refUAPEntry.userAckId],
												class: [refUAPEntry.userAckId],
												popup: [refUAPEntry.userAckId],
												type: [refUAPEntry.userAckId]
											}
										});
										
									break;
								case 'server-command':
								default:
									// nothing special
							}
							
							/*
							// check if the currently unregistering fs was succesfully tweeted and update notif bar accordingly
							if (aMsg.json.gTweeted) {
								// was successfully tweeted, so set this refUAPEntry to completed AND framescript: inactive
								refUAPEntry.tweeted = true;
								refUAPEntry.actionOnBtn = 'show-clips-popup';
								// :todo: make notif-bar green
							} else {
								// set refUAPEntry to failed tweet (either tab closed, twitter page navigated away from, ), and make its notif button, on click to open a new tab and reattach
								// refUAPEntry.tweeted = false; // it should already be false, no need to set it
								// :todo: make notif-bar red
								refUAPEntry.actionOnBtn = 'open-tab';
							}
							*/
							
							// check if any other twitter fs are active (meaning a succesful tweet is pending), if none found remove the twitterClientMessageListener
							var refUAP = userAckPending;
							var untweetedUAPFound = false;
							console.log('checking if any untweeted tabs are open, and if they are then it wont remove listener:', refUAP);
							for (var i=0; i<refUAP.length; i++) {
								// :todo: apparently i found here somethign that had no refUAP.uaGroup, investigate why this was - i was just getting back to nativeshot after doing other work so i dont recall at this time what all intricacies
								if (refUAP[i].uaGroup && refUAP[i].uaGroup == 'twitter' && !refUAP[i].tweeted) {
									untweetedUAPFound = true;
									break;
								}
							}
							if (!untweetedUAPFound) {
								fsComServer.twitterListenerRegistered = false;
								myServices.mm.removeMessageListener(core.addon.id, fsComServer.twitterClientMessageListener);
								console.log('removed message listener for twitter as no other twitter tabs im caring about (meaning that im watching for succesful image attach then tweet) are left open');
							}
							
						break;
					case 'clientNotify_FSReadyToAttach':
							
							// notification that the FS with this UAP is ready to accept another image
							var refUAPEntry = getUAPEntry_byUserAckId(aMsg.json.userAckId);
							
							// check if something was attached by this notification, and mark it so
							if ('justAttachedImgId' in aMsg.json) {
								refUAPEntry.imgDatas[aMsg.json.justAttachedImgId].attachedToTweet = true;
							}
							
							refUAPEntry.FSReadyToAttach = true; // short for frameScript_isReadyToAttachAnother, basically ready to accept another send
							console.error('just set FSReadyToAttach to true in refUAPEntry:', refUAPEntry);
							
							fsComServer.twitter_IfFSReadyToAttach_sendNextUnattached(aMsg.json.userAckId);
							
						break;
					case 'clientResponse_imgAttached':
							
							
							
						break;
					case 'clientRequest_clientShutdownComplete':
							
							
							
						break;
					// start - devuser edit - add your personal message topics to listen to from clients
						
					// end - devuser edit - add your personal message topics to listen to from clients
					default:
						console.error('SERVER unrecognized aTopic:', aMsg.json.aTopic, aMsg, 'server id:', fsComServer.serverId);
				}
			} // else {
				// console.warn('incoming message to server but it has an id and it is not of this so ignore it', 'this server id:', fsComServer.id, 'msg target server is:', aMsg.json.serverId, 'aMsg:', aMsg);
			//}
		}
	},
	twitterInitFS: function(userAckId) {
		var refUAPEntry = getUAPEntry_byUserAckId(userAckId);
		refUAPEntry.tab.get().linkedBrowser.messageManager.sendAsyncMessage(core.addon.id, {aTopic:'serverCommand_clientInit', serverId:fsComServer.serverId, userAckId:userAckId, core:core})
	},
	twitterSendDataToAttach: function(userAckId) {
		var refUAPEntry = getUAPEntry_byUserAckId(userAckId);
	},
	twitter_focusContentWindow: function(userAckId) {
		var refUAPEntry = getUAPEntry_byUserAckId(userAckId);
		refUAPEntry.tab.get().linkedBrowser.messageManager.sendAsyncMessage(core.addon.id, {
			aTopic: 'serverCommand_focusContentWindow',
			serverId: fsComServer.serverId,
			userAckId: refUAPEntry.userAckId
		});
	},
	twitter_IfFSReadyToAttach_sendNextUnattached: function(userAckId) {
		// returns true, if something was found unattached and sent, returns false if nothing found unnatached or FS wasnt ready
		var refUAPEntry = getUAPEntry_byUserAckId(userAckId);
		console.error('in here ok good h0, refUAPEntry:', refUAPEntry);
		if (refUAPEntry.FSReadyToAttach) {
			console.error('in here ok good h1');
			// its available to attach, so send it
			// check if any imgs are waiting to be attached
			for (var imgId in refUAPEntry.imgDatas) {
				console.log('checking:', refUAPEntry.imgDatas[imgId]);
				if (!refUAPEntry.imgDatas[imgId].attachedToTweet) {
					// send command to client to attached
					refUAPEntry.FSReadyToAttach = false;
					console.log('ok found img that was not yet attached to tweet, sending it, it is:', refUAPEntry.imgDatas[imgId]);
					refUAPEntry.tab.get().linkedBrowser.messageManager.sendAsyncMessage(core.addon.id, {
						aTopic: 'serverCommand_attachImgToTweet',
						serverId: fsComServer.serverId,
						imgId: imgId,
						dataURL: refUAPEntry.imgDatas[imgId].dataURL,
						userAckId: refUAPEntry.userAckId
					});
					return true;
				}
			}
			console.log('all imgs are attached');
			// NBs_updateGlobal_updateTwitterBtn(refUAPEntry, 'Tweet dialog opened and images attached - awaiting user input', 'nativeshot-twitter-neutral', 'focus-tab'); // i can show this, but i am not showing "'Waiting to for progrmattic attach'" so not for right now, but i guess would be nice maybe, but maybe too much info
			NBs_updateGlobal_updateTwitterBtn(refUAPEntry, myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-user-tweet') + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-neutral', 'focus-tab'); // this is good, because if was found not signed in, then on signed in load it opens up and is waiting for attach, but needs user focus
		} else {
			console.error('in here ok good h1');
			// not yet availble to attach so do nothing. because when fs is ready to attach it will send me a clientNotify_readyToAttach, and i run this function of twitter_IfFSReadyToAttach_sendNextUnattached there
			return false;
		}
	}
	// end - twitter framescript specific
}

function getUAPEntry_byUserAckId(userAckId) {
	// THROWS if not found
	var refUAP = userAckPending;
	var refUAPEntry;
	for (var i=0; i<refUAP.length; i++) {
		if (refUAP[i].userAckId == userAckId) {
			return refUAP[i];
		}
	}
	console.error('could not find aUAPEntry with userAckId of', userAckId, 'this is UAP:', refUAP);
	throw new Error('could not find aUAPEntry with userAckId - should not happen i think');
}
/* // used only in one place so removed this
function getUAPEntry_byGEditorSessionId(gEditorSessionId, throwOnNotFound) {
	// does NOT throw if not found
	var refUAP = userAckPending;
	var refUAPEntry;
	for (var i=0; i<refUAP.length; i++) {
		if (refUAP[i].gEditorSessionId == gEditorSessionId) {
			return refUAP[i];
		}
	}
	if (throwOnNotFound) {
		console.error('could not find aUAPEntry with userAckId of', userAckId, 'this is UAP:', refUAP);
		throw new Error('could not find aUAPEntry with userAckId - should not happen i think');
	}
}
*/
var gEditor = {
	lastCompositedRect: null, // holds rect of selection (`gESelectedRect`) that it last composited for
	canComp: null, // holds canvas element
	ctxComp: null, // holds ctx element
	compDOMWindow: null, // i use colMon[i].DOMWindow for this
	gBrowserDOMWindow: null, // used for clipboard context
	sessionId: null,
	printPrevWins: null, // holds array of windows waiting to get focus on close of gEditor
	forceFocus: null, // set to true like when user does twitter as that needs user focus
	cleanUp: function() {
		// reset all globals
		console.error('doing cleanup');
		
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
		
		this.pendingWinSelect = false;
		this.winArr = null;
		
		this.sessionId = null;
		
		this.printPrevWins = null;
		this.forceFocus = null;
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
	clearSelection: function(e) {
		if (!gESelected) {
			throw new Error('no selection to clear!');
		}
		
		gCanDim.execFunc('save');
		
		gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		gCanDim.execFunc('fillRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		
		gCanDim.execFunc('restore');
		
		gESelected = false;
		gESelectedRect.setRect(0, 0, 0, 0);
	},
	selectMonitor: function(iMon, e) {
		// iMon -1 for current monitor
		// iMon -2 for all monitors
		switch (iMon) {
			case -2:
			
					console.error('selecting all monitors');
					for (var i=0; i<colMon.length; i++) {
						gESelectedRect = gESelectedRect.union(colMon[i].rect);
					}
					gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']);
					
				break;
			case -1:
					iMon = parseInt(e.view.location.search.substr('?iMon='.length));
					console.error('selecting current monitor which is:', iMon);
					// intionally no break here so iMon is set to current monitor and it goes on to the default selection part
			default:
					try {
						gEditor.clearSelection(e);
					} catch(ignore) {}
					gESelectedRect = colMon[iMon].rect.clone();
					colMon[iMon].E.ctxDim.clearRect(0, 0, colMon[iMon].w, colMon[iMon].h);
		}
		gESelected = true;
		
	},
	selectWindow: function(e) {
		
		try {
			gEditor.clearSelection(e);
		} catch(ignore) {}
		
		if (!gEditor.winArr) {
			console.time('getAllWin');
			var promise_fetchWin = MainWorker.post('getAllWin', [{
				getPid: true,
				getBounds: true,
				getTitle: true,
				filterVisible: true
			}])
			promise_fetchWin.then(
				function(aVal) {
					console.log('Fullfilled - promise_fetchWin - ', aVal);
					// start - do stuff here - promise_fetchWin
					console.timeEnd('getAllWin');
					gEditor.winArr = aVal;
					// Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(JSON.stringify(aVal)); // :debug:
					// end - do stuff here - promise_fetchWin
				},
				function(aReason) {
					var rejObj = {name:'promise_fetchWin', aReason:aReason};
					console.warn('Rejected - promise_fetchWin - ', rejObj);
					// deferred_createProfile.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promise_fetchWin', aCaught:aCaught};
					console.error('Caught - promise_fetchWin - ', rejObj);
					// deferred_createProfile.reject(rejObj);
				}
			);
		}
		
		gEditor.pendingWinSelect = true;
		gCanDim.execStyle('cursor', 'pointer');
		
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
			
			// this.canComp.style.position = 'fixed'; // :debug:
			console.info('i:', i, 'colMon:', colMon, 'this.lastCompositedRect.left:', this.lastCompositedRect.left, 'this.lastCompositedRect.top:', this.lastCompositedRect.top, 'rectIntersecting.left:', rectIntersecting.left, 'rectIntersecting.top:', rectIntersecting.top, 'rectIntersecting.width:', rectIntersecting.width, 'rectIntersecting.height:', rectIntersecting.height);
			console.info(colMon[i].x - this.lastCompositedRect.left, colMon[i].y - this.lastCompositedRect.top, rectIntersecting.left, rectIntersecting.top, rectIntersecting.width, rectIntersecting.height);
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
			for (var p in NBs.crossWin) {
				if (p.indexOf(gEditor.sessionId) == 0) { // note: this is why i have to start each crossWin id with gEditor.sessionId
					NBs.insertGlobalToWin(p, 'all');
				}
			}
			if (gEditor.wasFirefoxWinFocused || gEditor.forceFocus) {
				gEditor.gBrowserDOMWindow.focus();
			}
			if (gEditor.printPrevWins) {
				for (var i=0; i<gEditor.printPrevWins.length; i++) {
					gEditor.printPrevWins[i].focus();
				}
			}
			colMon[0].E.DOMWindow.close();
		}
	},
	showNotif: function(aTitle, aMsg, aClickCallback) {
		if (!gNotifTimer) {
			gNotifTimer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
		}
		gNotifLastId++; //minimum gNotifLastId is 1 link687412
		gENotifPending.push({
			//shown: false, //no need as as long as it doesnt show its element will be first in the array
			aTitle: aTitle,
			aMsg: aMsg,
			aClickCookie: aClickCallback ? gNotifLastId : null
		});
		if (aClickCallback) {
			gNotifClickCallback[gNotifLastId] = aClickCallback;
			console.log('registered this notif with a CLICK callback, gNotifClickCallback:', gNotifClickCallback);
		}
		if (!gNotifTimerRunning) {
			gENotifCallback.notify(gNotifTimer);
		}
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
					// start - copy block link49842300
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
							
							gEditor.showNotif(myServices.sb.GetStringFromName('notif-title_file-save-ok'), myServices.sb.GetStringFromName('notif-body_file-save-ok'), notifCB_saveToFile.bind(null, OSPath_save));
							
							appendToHistoryLog(aBoolPreset ? 'save-quick' : 'save-browse', {
								d: new Date().getTime(),
								n: OS.Path.basename(OSPath_save),
								f: OS.Path.dirname(OSPath_save)
							});
							
							// end - do stuff here - promise_saveToDisk
						},
						function(aReason) {
							var rejObj = {name:'promise_saveToDisk', aReason:aReason};
							console.error('Rejected - promise_saveToDisk - ', rejObj);
							gEditor.showNotif(myServices.sb.GetStringFromName('notif-title_file-save-fail'), myServices.sb.GetStringFromName('notif-body_file-save-fail'));
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
					// end - copy block link49842300
				};
				r.readAsArrayBuffer(b);
			}, 'image/png');
		}
		
		if (aBoolPreset) {
			// start - copy block link7984654
			// get save path
			var OSPath_saveDir = getPrefNoSetStuff('quick_save_dir');
			
			// generate file name
			var filename = myServices.sb.GetStringFromName('screenshot') + ' - ' + getSafedForOSPath(new Date().toLocaleFormat()) + '.png';
			OSPath_save = OS.Path.join(OSPath_saveDir, filename);
			// end - copy block link7984654
						
			do_saveCanToDisk();
			
		} else {
			if (core.os.name == 'darwin') {
					// can use gMacTypes.setLevel and gMacTypes.NSMainMenuWindowLevel because this only ever triggers after link98476884 runs for sure for sure
					var aHwndPtrStr = e.view.QueryInterface(Ci.nsIInterfaceRequestor)
														.getInterface(Ci.nsIWebNavigation)
														.QueryInterface(Ci.nsIDocShellTreeItem)
														.treeOwner
														.QueryInterface(Ci.nsIInterfaceRequestor)
														.getInterface(Ci.nsIBaseWindow)
														.nativeHandle;
					var NSWindowString = aHwndPtrStr;
					console.info('NSWindowString:', NSWindowString);
												
					var NSWindowPtr = ctypes.voidptr_t(ctypes.UInt64(NSWindowString));

					var rez_setLevel = gMacTypes.objc_msgSend(NSWindowPtr, gMacTypes.setLevel, gMacTypes.NSInteger(0)); // i guess 0 is NSNormalWindowLevel
					console.log('rez_setLevel:', rez_setLevel, rez_setLevel.toString());	
			}
			var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
			fp.init(e.view, myServices.sb.GetStringFromName('filepicker-title-save-screenshot'), Ci.nsIFilePicker.modeSave);
			fp.appendFilter('PNG Image', '*.png');
			
			var rv = fp.show();
			
			if (core.os.name == 'darwin') {
				var rez_setLevel = gMacTypes.objc_msgSend(NSWindowPtr, gMacTypes.setLevel, gMacTypes.NSInteger(gMacTypes.NSMainMenuWindowLevel + 1)); // link847455111
				console.log('rez_setLevel:', rez_setLevel, rez_setLevel.toString());	
			}
			
			if (rv == Ci.nsIFilePicker.returnOK || rv == Ci.nsIFilePicker.returnReplace) {
				OSPath_save = fp.file.path.trim();
				
				if (!/^.*\.png/i.test(OSPath_save)) {
					OSPath_save += '.png';
				}
				do_saveCanToDisk();
			} else {
				 // user canceled
				console.error('rv was not ok or replace:', rv);
				//gEditor.closeOutEditor(e);
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
		
		gEditor.showNotif(myServices.sb.GetStringFromName('notif-title_clipboard-ok'), myServices.sb.GetStringFromName('notif-body_clipboard-ok'));
		
		appendToHistoryLog('copy', {
			d: new Date().getTime()
		});
		
		this.closeOutEditor(e);
	},
	sendToPrinter: function(e) {
		this.compositeSelection();
		
		if (!getPrefNoSetStuff('print_preview')) {
			// print method link678321212
			var win = Services.wm.getMostRecentWindow('navigator:browser'); //Services.appShell.hiddenDOMWindow;
			var doc = win.document;
			var iframe = doc.createElementNS(NS_HTML, 'iframe');
			iframe.addEventListener('load', function() {
				iframe.removeEventListener('load', arguments.callee, true);
				console.error('ok should have removed load listener from iframe, iframe.src:', iframe.getAttribute('src'));
				console.error('iframe loaded, print it', iframe.contentWindow.print);
				gPostPrintRemovalFunc = function() {
					iframe.parentNode.removeChild(iframe);
					console.error('ok removed iframe that i added to hiddenDOMWindow')
					gPostPrintRemovalFunc = null;
				};
				iframe.contentWindow.addEventListener('afterprint', function() {
					// iframe.parentNode.removeChild(iframe);
					// console.error('ok removed iframe that i added to hiddenDOMWindow')
					//discontinued immediate removal as it messes up/deactivates print to file on ubuntu from my testing
					iframe.setAttribute('src', 'about:blank');
				}, false);
				iframe.contentWindow.print();
			}, true); // if i use false here it doesnt work
			iframe.setAttribute('src', this.canComp.toDataURL('image/png'));
			iframe.setAttribute('style', 'display:none');
			doc.documentElement.appendChild(iframe); // src page wont load until i append to document
		} else {
			
			
			/*
			var aPrintPrevWin;
			// open print preview window on monitor with coords 0,0 wxh 10x10
			// find monitor dimentiosn that has coord 0,0
			var primaryScreenPoint = new Rect(1, 1, 1, 1);
			for (var i=0; i<colMon.length; i++) {
				if (colMon[i].rect.contains(primaryScreenPoint)) {
					aPrintPrevWin = Services.ww.openWindow(null, 'chrome://browser/content/browser.xul', '_blank', 'chrome,width=' + colMon[i].w + ',height=' + colMon[i].h + ',screenX=0,screenY=0', null);
				}
			}
			*/
			// i dont do it that way because i want the available rect so i do this way:
			// var sDims = {x:{},y:{},w:{},h:{}};
			// Cc['@mozilla.org/gfx/screenmanager;1'].getService(Ci.nsIScreenManager).screenForRect(1,1,1,1).GetAvailRect(sDims.x, sDims.y, sDims.w, sDims.h);
			// console.info('chrome,width=' + sDims.w.value + ',height=' + sDims.h.value + ',screenX=' + sDims.x.value + ',screenY=' + sDims.y.value);
			var aPrintPrevWin = Services.ww.openWindow(null, 'chrome://browser/content/browser.xul', '_blank', null, null);
			if (this.printPrevWins) {
				this.printPrevWins.push(aPrintPrevWin);
			} else {
				this.printPrevWins = [aPrintPrevWin];
			}
			var savedDataURL = this.canComp.toDataURL('image/png');
			aPrintPrevWin.addEventListener('load', function() {
				aPrintPrevWin.removeEventListener('load', arguments.callee, false);
				aPrintPrevWin.focus();
				// old stuff
				var win = aPrintPrevWin;
				var doc = win.document;
				var iframe = doc.createElementNS(NS_XUL, 'browser');
				iframe.addEventListener('load', function() {
					iframe.removeEventListener('load', arguments.callee, true);
					console.error('ok should have removed load listener from iframe, iframe.src:', iframe.getAttribute('src'));
					console.error('iframe loaded, print preview it');
					
					var aPPListener = win.PrintPreviewListener;
					var aOrigPPgetSourceBrowser = aPPListener.getSourceBrowser;
					var aOrigPPExit = aPPListener.onExit;
					aPPListener.onExit = function() {
						aOrigPPExit.call(aPPListener);
						iframe.parentNode.removeChild(iframe);
						aPPListener.onExit = aOrigPPExit;
						aPPListener.getSourceBrowser = aOrigPPgetSourceBrowser;
						win.close();
					};
					aPPListener.getSourceBrowser = function() {
						return iframe;
					};
					win.PrintUtils.printPreview(aPPListener);
					
				}, true); // if i use false here it doesnt work
				iframe.setAttribute('type', 'content');
				iframe.setAttribute('src', savedDataURL);
				iframe.setAttribute('style', 'display:none'); // if dont do display none, then have to give it a height and width enough to show it, otherwise print preview is blank
				doc.documentElement.appendChild(iframe); // src page wont load until i append to document
				// end old stuff
				
				
			}, false);
		}
		appendToHistoryLog('print', {
			d: new Date().getTime()
		});
		
		this.closeOutEditor(e); // with print preview, cannot do multiple print previews, can probably do multiple other things if its not print preview though
		
		/* heres a print method to not show headers etc
			// https://dxr.mozilla.org/mozilla-central/source/browser/base/content/sync/utils.js?offset=200#148
			this._preparePPiframe(elid, function(iframe) {
			  let webBrowserPrint = iframe.contentWindow
										  .QueryInterface(Ci.nsIInterfaceRequestor)
										  .getInterface(Ci.nsIWebBrowserPrint);
			  let printSettings = PrintUtils.getPrintSettings();

			  // Display no header/footer decoration except for the date.
			  printSettings.headerStrLeft
				= printSettings.headerStrCenter
				= printSettings.headerStrRight
				= printSettings.footerStrLeft
				= printSettings.footerStrCenter = "";
			  printSettings.footerStrRight = "&D";

			  try {
				webBrowserPrint.print(printSettings, null);
			  } catch (ex) {
				// print()'s return codes are expressed as exceptions. Ignore.
			  }
		*/
	},
	shareToTwitter: function(e) {
		// opens new tab, loads twitter, and attaches up to 4 images, after 4 imgs it makes a new tab, tabs are then focused, so user can type tweet, tag photos, then click Tweet
		
		this.compositeSelection();
		
		var refUAP = userAckPending;
		
		//var refUAPEntry = getUAPEntry_byGEditorSessionId(this.sessionId);
		var refUAPEntry;
		for (var i=0; i<refUAP.length; i++) {
			if (refUAP[i].gEditorSessionId == this.sessionId && refUAP[i].imgDatasCount < 4) {
				refUAPEntry = refUAP[i];
			}
		}
		
		var cImgDataUri = this.canComp.toDataURL('image/png', '');
		
		var crossWinId = gEditor.sessionId + '-twitter'; // note: make every crossWinId start with gEditor.sessionId
		
		if (!refUAPEntry) {
			if (!fsComServer.twitterListenerRegistered) {
				myServices.mm.addMessageListener(core.addon.id, fsComServer.twitterClientMessageListener, true);
				fsComServer.twitterListenerRegistered = true;
			}
			var newtab = gEditor.gBrowserDOMWindow.gBrowser.loadOneTab(TWITTER_URL, {
				inBackground: false,
				relatedToCurrent: false
			});
			newtab.linkedBrowser.messageManager.loadFrameScript(core.addon.path.scripts + 'fs_twitter.js?' + core.addon.cache_key, false);
			refUAPEntry = refUAP[refUAP.push({
				gEditorSessionId: gEditor.sessionId,
				userAckId: Math.random(),
				tab: Cu.getWeakReference(newtab),
				imgDatas: {},
				FSReadyToAttach: false,
				imgDatasCount: 0, // will get ++'ed in very next lines out of this block. reason is so i dont hav eto have a custom ++ if not first push
				uaGroup: 'twitter',
				actionOnBtn: 'focus-tab'
					/*
						focus-tab: default (meaning if invaild actionOnBtn it will do this), it focuses tab of this framescript
						open-new-tab: opens new tab, loads twitter, and starts the attaching process
					*/
			}) - 1];
			
			fsComServer.twitterInitFS(refUAPEntry.userAckId);
			if (crossWinId in NBs.crossWin) {
				NBs.crossWin[crossWinId].btns.push({
					// label: myServices.sb.formatStringFromName('notif-bar_twitter-btn-imgs-awaiting-user-tweet', [1], 1) + '-ID:' + refUAPEntry.userAckId, // :l10n:
					label: myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-user-tweet') + ' (' + 1 + ')' + '-ID:' + refUAPEntry.userAckId,
					// label: 'Waiting to for progrmattic attach (1)-ID:' + refUAPEntry.userAckId,
					btn_id: refUAPEntry.userAckId,
					class: 'nativeshot-twitter-neutral',
					accessKey: 'T',
					callback: twitterNotifBtnCB.bind(null, refUAPEntry)
				});
			} else {
				NBs.crossWin[crossWinId] = {
					// msg: 'Images have been prepared for Tweeting. User interaction needed in order to complete:', // :l10n:
					msg: myServices.sb.GetStringFromName('notif-bar_twitter-msg-imgs-awaiting-user-action'),
					img: core.addon.path.images + 'twitter16.png',
					p: 6,
					btns: [{
						// label: 'Image Pending Tweet (1)-ID:' + refUAPEntry.userAckId,
						// label: 'Waiting to for progrmattic attach (1)-ID:' + refUAPEntry.userAckId,
						label: myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-user-tweet') + ' (' + 1 + ')' + '-ID:' + refUAPEntry.userAckId,
						btn_id: refUAPEntry.userAckId,
						class: 'nativeshot-twitter-neutral',
						accessKey: 'T',
						callback: twitterNotifBtnCB.bind(null, refUAPEntry) // :todo: test what the arguments on click of button are
					}]
				};
			}
		} else {
			var btnEntryInCrossWin;
			for (var i=0; i<NBs.crossWin[crossWinId].btns.length; i++) {
				if (NBs.crossWin[crossWinId].btns[i].btn_id == refUAPEntry.userAckId) {
					btnEntryInCrossWin = NBs.crossWin[crossWinId].btns[i];
					break;
				}
			}
			// btnEntryInCrossWin.label = 'Images Pending Tweet (' + (refUAPEntry.imgDatasCount + 1) + ')-ID:' + refUAPEntry.userAckId;  // :l10n:
			if (btnEntryInCrossWin.label.indexOf(myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-user-tweet')) == 0) { // cuz page loads in bg before notif is shown, so if user is doing multi stuff, the btn may have been updated to "not signed in" error msg or something
				btnEntryInCrossWin.label = myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-user-tweet') + ' (' + (refUAPEntry.imgDatasCount + 1) + ')' + '-ID:' + refUAPEntry.userAckId;
			}
		}
		
		// twitter allows maximum 4 attachment, so if 
		
		refUAPEntry.imgDatas[refUAPEntry.imgDatasCount] = {
			dataURL: cImgDataUri,
			attachedToTweet: false,
			uploadedURL: null
		};
		refUAPEntry.imgDatasCount++;
		// refUAPEntry.imgDataUris.push(cImgDataUri);
		
		fsComServer.twitter_IfFSReadyToAttach_sendNextUnattached(refUAPEntry.userAckId);
		
		this.forceFocus = true; // as user needs browser focus so they can tweet it
		this.closeOutEditor(e);
	},
	uploadToImgur: function(e, aBoolAnon) {
		// aBoolAnon true if want anonymous upload
		this.compositeSelection();
		
		var data = this.canComp.toDataURL('image/png'); // returns `data:image/png;base64,iVBORw.....`
		console.info('base64 data pre trim:', data);
		data = data.substr('data:image/png;base64,'.length); // imgur wants without this
		
		console.info('base64 data:', data);
		
		var abortReuploadAndToFile = function() {
			// turn data url to file and do quick save
			gColReuploadTimers[reuploadTimerId].timer.cancel();
			delete gColReuploadTimers[reuploadTimerId];

			// save data url to file
			// http://stackoverflow.com/questions/25145792/write-a-data-uri-to-a-file-in-a-firefox-extension/25148685#25148685
			console.time('charCodeAt method');
			var dataAtob = atob(data);
			// Decode to an Uint8Array, because OS.File.writeAtomic expects an ArrayBuffer(View).
			var byteArr = new Uint8Array(dataAtob.length);
			for (var i = 0, e = dataAtob.length; i < e; ++i) {
			  byteArr[i] = dataAtob.charCodeAt(i);
			}
			console.timeEnd('charCodeAt method');
			
			// start - copy block link7984654 - slight modificaiton
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
			var filename = myServices.sb.GetStringFromName('screenshot') + ' - ' + getSafedForOSPath(new Date().toLocaleFormat()) + ' - ' + myServices.sb.GetStringFromName('failed-upload') + '.png';
			OSPath_save = OS.Path.join(OSPath_saveDir, filename);
			// end - copy block link7984654 - slight modificaiton
			
			// start - copy block link49842300 - slight mod
			var promise_saveToDisk = OS.File.writeAtomic(OSPath_save, byteArr, { tmpPath: OSPath_save + '.tmp' });
			promise_saveToDisk.then(
				function(aVal) {
					console.log('Fullfilled - promise_saveToDisk - ', aVal);
					// start - do stuff here - promise_saveToDisk
					var trans = Transferable(Services.wm.getMostRecentWindow('navigator:browser'));
					trans.addDataFlavor('text/unicode');
					// We multiply the length of the string by 2, since it's stored in 2-byte UTF-16 format internally.
					trans.setTransferData('text/unicode', SupportsString(OSPath_save), OSPath_save.length * 2);
					
					Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
					
					gEditor.showNotif(myServices.sb.GetStringFromName('notif-title_file-save-ok'), myServices.sb.GetStringFromName('notif-body_file-save-ok'), notifCB_saveToFile.bind(null, OSPath_save));
					// end - do stuff here - promise_saveToDisk
				},
				function(aReason) {
					var rejObj = {name:'promise_saveToDisk', aReason:aReason};
					console.error('Rejected - promise_saveToDisk - ', rejObj);
					gEditor.showNotif(myServices.sb.GetStringFromName('notif-title_file-save-fail'), myServices.sb.GetStringFromName('notif-body_file-save-fail'));
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
			// end - copy block link49842300 - slight mod
		};
		
		var reuploadTimerId = gLastReuploadTimerId++;
		var reuploadFunc = function() {
			if (!gColReuploadTimers[reuploadTimerId]) {
				gColReuploadTimers[reuploadTimerId] = {
					timer: Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer),
					callback: {
						notify: function() {
							do_xhrToImgur();
						}
					},
					attempt: 0
				};
			}
			gColReuploadTimers[reuploadTimerId].attempt++;
			gColReuploadTimers[reuploadTimerId].timer.initWithCallback(gColReuploadTimers[reuploadTimerId].callback, reuploadTimerInterval, Ci.nsITimer.TYPE_ONE_SHOT);
			gEditor.showNotif(myServices.sb.formatStringFromName('notif-title_anon-upload-fail', [gColReuploadTimers[reuploadTimerId].attempt], 1), myServices.sb.GetStringFromName('notif-body_anon-upload-fail'), abortReuploadAndToFile);
		};
		
		var do_xhrToImgur = function() {
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
					if (!aVal.response.success) {
						reuploadFunc();
						return;
					}
					if (gColReuploadTimers[reuploadTimerId]) {
						delete gColReuploadTimers[reuploadTimerId];
					}
					
					var imgUrl = aVal.response.data.link;
					var deleteHash = aVal.response.data.deletehash; // at time of this writing jul 13 2015 the delete link is `'http://imgur.com/delete/' + deleteHash` (ie: http://imgur.com/delete/AxXkaRTpZILspsh)
					var imgId = aVal.response.data.id;
					
					var trans = Transferable(gEditor.gBrowserDOMWindow);
					trans.addDataFlavor('text/unicode');
					// We multiply the length of the string by 2, since it's stored in 2-byte UTF-16 format internally.
					trans.setTransferData('text/unicode', SupportsString(imgUrl), imgUrl.length * 2);
					
					Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
					
					// add in update to log file
					appendToHistoryLog('imgur-anonymous', {
						d: new Date().getTime(),
						x: deleteHash,
						n: imgId
					});
					
					gEditor.showNotif(myServices.sb.GetStringFromName('notif-title_anon-upload-ok'), myServices.sb.GetStringFromName('notif-body_clipboard-ok'));
					// end - do stuff here - promise_uploadAnonImgur
				},
				function(aReason) {
					var rejObj = {name:'promise_uploadAnonImgur', aReason:aReason};
					console.error('Rejected - promise_uploadAnonImgur - ', rejObj);
					// i have seen aReason.xhr.status == 405 and aReason.xhr.statusText == 'Not Allowed'
					reuploadFunc();
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
		};
		
		
		do_xhrToImgur();
		
		this.closeOutEditor(e);
	},
	uploadToDropbox: function(e) {
		this.compositeSelection();
		
		var appKey = 'nzyavm88qlxp6dz';
		var appSecret = '9nr700erdpf4jxg';
		
		// start authorize
		var authParam_client_id = appKey;
		var authParam_response_type = 'token';
		var authParam_redirect_uri = 'data:text/html,auth_dropbox'; // required for A redirect URI is required for a token flow, but optional for code. 
		var authParam_force_reapprove = 'false';
		var authParam_disable_signup = 'true';
		var authURL = 'https://www.dropbox.com/1/oauth2/authorize?client_id=' + authParam_client_id + '&response_type=' + authParam_response_type + '&redirect_uri=' + authParam_redirect_uri + '&force_reapprove=' + authParam_force_reapprove + '&disable_signup=' + authParam_disable_signup;

		// load callbacks:
		var iframe;
		var setSrcToAuthUrl_eventsAndCallbacks = [
			// first event with callback
			{
				eventType: 'DOMContentLoaded',
				useCapture: false,
				dontRemoveAllAttached: false,
				callback: function(e) {
					Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'in callbck now');
					// do error handling, like if user is not signed in
					var aContentWindow = iframe.contentWindow; //e.originalTarget.defaultView;
					var aContentDocument = aContentWindow.document;
					var webnav = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
					var docuri = webnav.document.documentURI;
					
					var websiteDomEls = { // :maintain-per-website: // add multiple selectors for test, in case they change something, so this adds robustness // :maintain-per-website: as its site dependent stuff
						allowBtn: {
							domEl: null,
							selectorsToTry: [ // :maintain-per-website:
								{method:'querySelector', arg:'.auth-button.button-primary'}
							]
						},
						notSignedIn: {
							selectorsToTry: [ // :maintain-per-website:
								{method:'getElementById', arg:'regular-login-forms'},
								{method: 'querySelector', arg:'.login-form-container'}
							]
						}
					};
					
					if (docuri.indexOf('about:') == 0) {
						// error-loading
						// one of the following happend:
							// are working offline
							// users local network is not responding
						Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'error: could not load auth page, you may be working offline or your network is down, the docuri is:\n' + docuri);
						throw new Error('dropbox-auth-failed');
					} else if (testAndFindDomEl(aContentDocument, websiteDomEls.notSignedIn.selectorsToTry)) {
						// test for not signed in
						Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'error: not signed into dropbox');
						throw new Error('dropbox-auth-failed');
					} else if (testAndFindDomEl(aContentDocument, websiteDomEls.allowBtn.selectorsToTry, websiteDomEls.allowBtn)) {
						// test for allow button
						// click allow button
						Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'ok will now allow');
						
						attachEventListeners_asSelfRemoveables(iframe, postClickAllow_eventsAndCallbacks);
						
						websiteDomEls.allowBtn.domEl.click(); // test if it works will iframe is display none
						
					} else {
						// maybe server timed out?
						Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'error: could not identify the loaded auth page, maybe server timed out?');
						throw new Error('dropbox-auth-failed');
					}
				}
			}
			// second event with callback
		];

		var postClickAllow_eventsAndCallbacks = [
			{
				eventType: 'DOMContentLoaded',
				useCapture: false,
				callback: function(e) {
					var aContentWindow = iframe.contentWindow; //e.originalTarget.defaultView;
					Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'ok the page after clicking allow loaded');
					
					// get the token
					var receivedParamsFullStr = aContentWindow.location.hash.substr(1);
					var receivedParamsPiecesStrArr = receivedParams.split('&');
					
					var receivedParamsKeyVal = {};
					for (var i=0; i<receivedParamsPiecesStrArr.length; i++) {
						var splitPiece = receivedParamsPiecesStrArr[i].split('=');
						receivedParamsKeyVal[splitPiece[0]] = splitPiece[1];
					}
					
					console.info('receivedParamsKeyVal:', receivedParamsKeyVal);
					Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'received params parsed');
				}
			}
		];
		// load auth page into frame
		
		// set up the hidden iframe

		var win = gEditor.gBrowserDOMWindow;
		var doc = win.document;
		var iframe = doc.createElementNS(NS_XUL, 'browser');
		iframe.setAttribute('type', 'content');
		iframe.setAttribute('style', 'height:400px; border:10px solid steelblue;'); // :debug:
		// iframe.setAttribute('style', 'display:none'); // :debug:
		

		Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'will now wait for about:blank to finish loading');
		
		// wait for about:blank to load, then kick off auth process
		iframe.addEventListener('load', function() {
			iframe.removeEventListener('load', arguments.callee, true);
			Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'ok about:blank loaded: ' + iframe.contentWindow.location);
			
			// kick of the auth process
			iframe.setAttribute('src', authURL); // on load it will remove all the attached event listeners
			attachEventListeners_asSelfRemoveables(iframe, setSrcToAuthUrl_eventsAndCallbacks);
		}, true);

		Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'ok will now append it');
		doc.documentElement.appendChild(iframe); // i think src only takes affect after appending
		
		/*
		var promise_uploadAnonImgur = xhr(authURL, {
			Headers: {
				Authorization: 'Client-ID fa64a66080ca868',
				'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' // if i dont do this, then by default Content-Type is `text/plain; charset=UTF-8` and it fails saying `aReason.xhr.response.data.error == 'Image format not supported, or image is corrupt.'` and i get `aReason.xhr.status == 400`
			},
			aResponseType: 'json'
		});
		*/
		
		// end authorize
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
		
		// console.info('PREmod:', e.screenX, e.screenY, 'POSTmod:', cEMMX, cEMMY);
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
	if (gEditor.pendingWinSelect) {
		gEditor.pendingWinSelect = false;
		gCanDim.execStyle('cursor', 'crosshair');
		
		console.log('user made win sel at point:', cEMDX, cEMDY);
		
		var do_selWinAtPt = function() {
			if (gEditor.winArr) {
				// go through all windows in z order and draw sel around the window rect that contains cEMDX, cEMDY
				console.log('ok winArr is populated, lets go throgh and find it');
				Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(JSON.stringify(gEditor.winArr)) // :debug:
				//var clickedPoint = new Rect(cEMDX, cEMDY, 1, 1);
				var first_nativeshot_canvas_found = false;
				for (var i=0; i<gEditor.winArr.length; i++) {
					if (gEditor.winArr[i].title == 'nativeshot_canvas') {
						first_nativeshot_canvas_found = true;
						continue;
					}/* else { // had to discontinue this block, as osx CGWindowListCopyWindowInfo doesnt give NSWindow for windows that are not of the process running the code, had to give nativeshot_canvas title and test that
						var skipThisWinArrI_AsItIsNSWin = false;
						for (var j=0; j<colMon.length; j++) {
							if (i == 0) {
								console.log('colMon[j].hwndPtrStr', j, colMon[j].hwndPtrStr);
							}
							if (colMon[j].hwndPtrStr == gEditor.winArr[i].hwnd) {
								// this is a nativeshot canvas window, skip it
								skipThisWinArrI_AsItIsNSWin = true;
								break;
							}
						}
					}
					if (skipThisWinArrI_AsItIsNSWin) {
						continue;
					}*/
					if (!first_nativeshot_canvas_found) {
						continue; // find nativeshot_canvas first then start paying attention to windows, as context menu is above, on osx also the cursor gets a window and its element 0
					}
					if (cEMDX >= gEditor.winArr[i].left && cEMDX <= gEditor.winArr[i].right && cEMDY >= gEditor.winArr[i].top && cEMDY <= gEditor.winArr[i].bottom) {
						console.log('selecting winArr element i:', i);

						gIMonMouseDownedIn = iMon;
						gESelecting = false;
						gESelected = true;
						
						gEMDX = cEMDX;
						gEMDY = cEMDY;
						
						gESelectedRect.setRect(gEditor.winArr[i].left, gEditor.winArr[i].top, gEditor.winArr[i].width, gEditor.winArr[i].height);
						gCanDim.execFunc('clearRect', [gEditor.winArr[i].left, gEditor.winArr[i].top, gEditor.winArr[i].width, gEditor.winArr[i].height], {x:0,y:1,w:2,h:3});
						
						break;
					}
				}
				
			} else {
				colMon[iMon].E.DOMWindow.setTimeout(do_selWinAtPt, 100);
			}
		};
		
		if (gEditor.winArr) {
			do_selWinAtPt();
		} else {
			colMon[iMon].E.DOMWindow.setTimeout(do_selWinAtPt, 100); // as winArr is populated async'ly. user may click before winArr is populated
		}
		
	} else if (e.target.id == 'hitboxMoveSel') {
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
		gCanDim.execFunc('save');
		
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

var gPanelWasNotOpenDuringEsc = false;
function gEKeyUp(e) {
	if (e.keyCode == 27) {
		if (gPanelWasNotOpenDuringEsc) {
			gPanelWasNotOpenDuringEsc = false; // ok user didnt hit esc to close out menu. they inteded to close out editor
			gEditor.closeOutEditor({shiftKey:false});
		}
	}
}
function gEKeyDown(e) {
	if (e.keyCode == 27) {
		// this key down does not trigger if menu was open (at least on win81, need to test on other platforms)
		gPanelWasNotOpenDuringEsc = true; // tell key up to close window on up
	}
}

function gEPopupHiding(e) {
	// e.view.setTimeout(function() {
		// e.view.addEventListener('keyup', gEKeyUp, false);
	// }, 1000);
	console.error('e:', e);
}

function gEPopupShowing(e) {
	//e.view.removeEventListener('keyup', gEKeyUp, false); // so if user hits escape while menu is open, esc will close out menu instead of editor. its ok to only do to current window, as if user clicks else where window it will close menu and the popuphiding adds the window close esc listener back
	
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
	console.info('1st:', aHwndPtrStr);
	if (core.os.name != 'darwin') {
		aEditorDOMWindow.moveTo(colMon[iMon].x, colMon[iMon].y);
	}
	
	aEditorDOMWindow.focus();
	if (core.os.name != 'darwin') {
		aEditorDOMWindow.fullScreen = true;
	}
	
	// set window on top:
	var aArrHwndPtr = [aHwndPtrStr];
	var aArrHwndPtrOsParams = {};
	aArrHwndPtrOsParams[aHwndPtrStr] = {
		left: colMon[iMon].x,
		top: colMon[iMon].y,
		right: colMon[iMon].x + colMon[iMon].w,
		bottom: colMon[iMon].y + colMon[iMon].h,
		width: colMon[iMon].w,
		height: colMon[iMon].h
	};
	
	// if (core.os.name != 'darwinAAAA') {
		var promise_setWinAlwaysTop = MainWorker.post('setWinAlwaysOnTop', [aArrHwndPtr, aArrHwndPtrOsParams]);
		promise_setWinAlwaysTop.then(
			function(aVal) {
				console.log('Fullfilled - promise_setWinAlwaysTop - ', aVal);
				// start - do stuff here - promise_setWinAlwaysTop
				if (core.os.name == 'darwin') {
					if (!gMacTypes) {
						initMacTypes();
					}
					// link98476884
					gMacTypes.NSMainMenuWindowLevel = aVal;
					
					var aHwndPtrStr = aEditorDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
														.getInterface(Ci.nsIWebNavigation)
														.QueryInterface(Ci.nsIDocShellTreeItem)
														.treeOwner
														.QueryInterface(Ci.nsIInterfaceRequestor)
														.getInterface(Ci.nsIBaseWindow)
														.nativeHandle;

					var NSWindowString = aHwndPtrStr; // baseWindow.nativeHandle;
					console.info('NSWindowString:', NSWindowString);
												
					var NSWindowPtr = ctypes.voidptr_t(ctypes.UInt64(NSWindowString));
					
					// var orderFrontRegardless = gMacTypes.sel_registerName('orderFrontRegardless');
					// var rez_orderFront = gMacTypes.objc_msgSend(NSWindowPtr, orderFrontRegardless, ctypes.long(aVal));
					// console.log('rez_orderFront:', rez_orderFront, rez_orderFront.toString());
					
						var setLevel = gMacTypes.sel_registerName('setLevel:');
						gMacTypes.setLevel = setLevel;
						var rez_setLevel = gMacTypes.objc_msgSend(NSWindowPtr, setLevel, gMacTypes.NSInteger(aVal + 1)); // have to do + 1 otherwise it is ove rmneubar but not over the corner items. if just + 0 then its over menubar, if - 1 then its under menu bar but still over dock. but the interesting thing is, the browse dialog is under all of these  // link847455111
						console.log('rez_setLevel:', rez_setLevel, rez_setLevel.toString());
						
						var newSize = gMacTypes.NSSize(colMon[iMon].w, colMon[iMon].h);
						var rez_setContentSize = gMacTypes.objc_msgSend(NSWindowPtr, gMacTypes.sel_registerName('setContentSize:'), newSize);
						console.info('rez_setContentSize:', rez_setContentSize);
						
						aEditorDOMWindow.moveTo(colMon[iMon].x, colMon[iMon].y); // must do moveTo after setContentsSize as that sizes from bottom left and moveTo moves from top left. so the sizing will change the top left.
						
						console.log('ok resized to and moved to');
					/*
					aEditorDOMWindow.setTimeout(function() {
							var NSSavePanel = gMacTypes.objc_getClass('NSSavePanel');
							var savePanel = gMacTypes.sel_registerName('savePanel');
							var aSavePanel = gMacTypes.objc_msgSend(NSSavePanel, savePanel);
							
							// var setFloatingPanel = gMacTypes.sel_registerName('setFloatingPanel:');
							// var rez_setFloatingPanel = gMacTypes.objc_msgSend(aSavePanel, setFloatingPanel, gMacTypes.YES);
							// console.log('rez_setFloatingPanel:', rez_setFloatingPanel, rez_setFloatingPanel.toString());
							
							var rezFloatingPanel = gMacTypes.objc_msgSend(aSavePanel, setLevel, gMacTypes.NSInteger(3));
							console.log('rezFloatingPanel:', rezFloatingPanel, rezFloatingPanel.toString());
							
							var runModal = gMacTypes.sel_registerName('runModal')
							var rez_savepanel = gMacTypes.objc_msgSend(aSavePanel, runModal);
							console.info('rez_savepanel:', rez_savepanel, rez_savepanel.toString());
					}, 2000);
					*/
					
				}
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
	// } else {
		/*
		// main thread ctypes
		Services.wm.getMostRecentWindow('navigator:browser').setTimeout(function() {
			if (!gMacTypes) {
				initMacTypes();
			}
			// var NSWindow = ctypes.voidptr_t(ctypes.UInt64(aHwndPtrStr));
			// // var rez_setLevel = gMacTypes.objc_msgSend(NSWindow, gMacTypes.sel_registerName('setLevel:'), ctypes.long(24)); // long as its NSInteger // 5 for kCGFloatingWindowLevel which is NSFloatingWindowLevel
			// // console.info('rez_setLevel:', rez_setLevel.toString());
			// var rez_orderFront = gMacTypes.objc_msgSend(NSWindow, gMacTypes.sel_registerName('orderFrontRegardless'));
			// console.info('rez_orderFront:', rez_orderFront.toString());
	
			var baseWindow = Services.wm.getMostRecentWindow('navigator:browser').QueryInterface(Ci.nsIInterfaceRequestor)
										  .getInterface(Ci.nsIWebNavigation)
										  .QueryInterface(Ci.nsIDocShellTreeItem)
										  .treeOwner
										  .QueryInterface(Ci.nsIInterfaceRequestor)
										  .getInterface(Ci.nsIBaseWindow);

			var NSWindowString = aHwndPtrStr; // baseWindow.nativeHandle;
			console.info('NSWindowString:', NSWindowString);
			
			var aHwndPtrStr = aEditorDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
												.getInterface(Ci.nsIWebNavigation)
												.QueryInterface(Ci.nsIDocShellTreeItem)
												.treeOwner
												.QueryInterface(Ci.nsIInterfaceRequestor)
												.getInterface(Ci.nsIBaseWindow)
												.nativeHandle;

			var NSWindowString = aHwndPtrStr; // baseWindow.nativeHandle;
			console.info('NSWindowString:', NSWindowString);
										
			var NSWindowPtr = ctypes.voidptr_t(ctypes.UInt64(NSWindowString));
			var orderFront = gMacTypes.sel_registerName('setLevel:');
			var rez_orderFront = gMacTypes.objc_msgSend(NSWindowPtr, orderFront, ctypes.long(3));
			console.log('rez_orderFront:', rez_orderFront, rez_orderFront.toString());
		}, 5000);
		*/
	// }
	
	// setting up the dom base, moved it to above the "os specific special stuff" because some os's might need to modify this (like win81)
	var w = colMon[iMon].w;
	var h = colMon[iMon].h;
	
	var json = 
	[
		'xul:stack', {id:'contOfCans'},
				['html:canvas', {draggable:'false',id:'canBase',width:w,height:h,style:'display:-moz-box;background:#000 url(' + core.addon.path.images + 'canvas_bg.png) repeat fixed top left;'}],
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
			
				// aEditorDOMWindow.setTimeout(function() {
				// 	//aEditorDOMWindow.focus(); // doesnt work to make take full
				// 	//aEditorDOMWindow.moveBy(0, -10); // doesnt work to make take full
				// 	aEditorDOMWindow.resizeBy(0, 0) // makes it take full. as fullScreen just makes it hide the special ui and resize to as if special ui was there, this makes it resize now that they are gone. no animation takes place on chromeless window, excellent
				// }, 10);
			
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
	
	ctxDim.fillStyle = gDefDimFillStyle;
	ctxDim.fillRect(0, 0, colMon[iMon].w, colMon[iMon].h);

	var menuElRef = {};
	//console.error('ok going to append');
	doc.documentElement.appendChild(jsonToDOM(get_gEMenuDomJson(), doc, menuElRef));
	//console.error('ok APPENDED??');
	doc.documentElement.setAttribute('context', 'myMenu1');
	menuElRef.myMenu1.addEventListener('popupshowing', gEPopupShowing, false);
	menuElRef.myMenu1.addEventListener('popuphiding', gEPopupHiding, false);
	// set up up event listeners
	
	aEditorDOMWindow.addEventListener('unload', gEUnload, false);
	aEditorDOMWindow.addEventListener('mousedown', gEMouseDown, false);
	aEditorDOMWindow.addEventListener('mouseup', gEMouseUp, false);
	aEditorDOMWindow.addEventListener('keyup', gEKeyUp, false);
	aEditorDOMWindow.addEventListener('keydown', gEKeyDown, false);
	
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
		gEditor.sessionId = new Date().getTime();
		gEditor.wasFirefoxWinFocused = isFocused(aDOMWindow);
		for (var i=0; i<colMon.length; i++) {
			var aEditorDOMWindow = Services.ww.openWindow(null, core.addon.path.content + 'panel.xul?iMon=' + i, '_blank', 'chrome,alwaysRaised,width=1,height=2,screenX=' + (core.os.name == 'darwin' ? (colMon[i].x + 1) : 1) + ',screenY=' + (core.os.name == 'darwin' ? (colMon[i].y + 1) : 1), null); // so for ubuntu i recall i had to set to 1x1 otherwise the resizeTo or something wouldnt work // now on osx if i set to 1x1 it opens up full available screen size, so i had to do 1x2 (and no matter what, resizeTo or By is not working on osx, if i try to 200x200 it goes straight to full avail rect, so im using ctypes on osx, i thought it might be i setLevel: first though but i tested it and its not true, it just wont work, that may be why resizeTo/By isnt working) // on mac because i size it first then moveTo, i think i have to move it to that window first, because otherwise it will be constrained to whatever monitor size i sized it on (i did + 1 just because i had issues with 0 0 on ubuntu so im thinking its safer)
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
			
			if (gPostPrintRemovalFunc) { // poor choice of clean up for post print, i need to be able to find a place that triggers after print to file, and also after if they dont print to file, if iframe is not there, then print to file doesnt work
				gPostPrintRemovalFunc();
			}
			
			// set gETopLeftMostX and gETopLeftMostY
			for (var i=0; i<colMon.length; i++) {
				colMon[i].screenshot = new aDOMWindow.ImageData(new aDOMWindow.Uint8ClampedArray(colMon[i].screenshot), colMon[i].w, colMon[i].h);
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
			
			// update monitor menu domJson
			
			if (!gEMenuArrRefs.select_fullscreen || gEMenuArrRefs.select_fullscreen.length != 2 + colMon.length) {
				gEMenuArrRefs.select_fullscreen = 
					['xul:menupopup', {},
						['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_select-current-mon'), oncommand:gEditor.selectMonitor.bind(null, -1)}],
						['xul:menuitem', {label:myServices.sb.GetStringFromName('editor-menu_select-all-mon'), oncommand:gEditor.selectMonitor.bind(null, -2)}]
					]
				;
				for (var i=0; i<colMon.length; i++) {
					gEMenuArrRefs.select_fullscreen.push(
						['xul:menuitem', {label:myServices.sb.formatStringFromName('editor-menu_select-mon-n', [i+1], 1), oncommand:gEditor.selectMonitor.bind(null, i)}]
					);
				}
			}
			
			openWindowOnEachMon();
			// end - do stuff here - promise_shoot
		},
		function(aReason) {
			var rejObj = {name:'promise_shoot', aReason:aReason};
			console.warn('Rejected - promise_shoot - ', rejObj);
			Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), myServices.sb.GetStringFromName('addon_name') + ' - ' + myServices.sb.GetStringFromName('error-title_screenshot-internal'), myServices.sb.GetStringFromName('error-body_screenshot-internal'));
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_shoot', aCaught:aCaught};
			console.error('Caught - promise_shoot - ', rejObj);
			Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'NativeShot - Developer Error', 'Developer did something wrong in the code, see Browser Console.');
		}
	);
}

function twitterNotifBtnCB(aUAPEntry, aElNotification, aObjBtnInfo) {
	console.info('notifBtn clicked, arguments:', arguments);
	// console.info('notifBtn clicked, this:', this); // this is bootstrap sandbox, interesting
	switch (aUAPEntry.actionOnBtn) {
		case 'show-clips-popup':
			
				console.log('show popup so user can copy stuff to clipboard');
			
			break;
		case 'open-new-tab':

				// NBs_updateGlobal_updateTwitterBtn(aUAPEntry, 'Waiting to for progrmattic attach', 'nativeshot-twitter-neutral', 'focus-tab'); // not showing for right now, i think too much info
				console.info('aUAPEntry:', aUAPEntry);
				NBs_updateGlobal_updateTwitterBtn(aUAPEntry, myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-user-tweet') + ' (' + Object.keys(aUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-neutral', 'focus-tab');
				if (!fsComServer.twitterListenerRegistered) {
					myServices.mm.addMessageListener(core.addon.id, fsComServer.twitterClientMessageListener, true);
					fsComServer.twitterListenerRegistered = true;
				}
				var newtab = Services.wm.getMostRecentWindow('navigator:browser').gBrowser.loadOneTab(TWITTER_URL, {
					inBackground: false,
					relatedToCurrent: false
				});
				newtab.linkedBrowser.messageManager.loadFrameScript(core.addon.path.scripts + 'fs_twitter.js?' + core.addon.cache_key, false);
				aUAPEntry.tab = Cu.getWeakReference(newtab);
				aUAPEntry.tweeted = false; // synonomous with fsActive = false
				fsComServer.twitterInitFS(aUAPEntry.userAckId);
			
			break;

		case 'reopen-tweet-modal':
			
				// NBs_updateGlobal_updateTwitterBtn(aUAPEntry, 'Waiting to for progrmattic attach', 'nativeshot-twitter-neutral', 'focus-tab'); // not showing for right now, i think too much info
				console.info('aUAPEntry:', aUAPEntry);
				NBs_updateGlobal_updateTwitterBtn(aUAPEntry, myServices.sb.GetStringFromName('notif-bar_twitter-btn-imgs-awaiting-user-tweet') + ' (' + Object.keys(aUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-neutral', 'focus-tab');
				// need to focus for that paste event thingy work around
				var tab = aUAPEntry.tab.get();
				tab.ownerDocument.defaultView.focus(); // focus browser window
				tab.ownerDocument.defaultView.gBrowser.selectedTab = aUAPEntry.tab.get(); // focus tab
				fsComServer.twitter_focusContentWindow(aUAPEntry.userAckId); // focus content window
				fsComServer.twitter_IfFSReadyToAttach_sendNextUnattached(aUAPEntry.userAckId);
			
			break;
		case 'focus-tab':
		default:
			
				console.log('doing default as aUAPEntry.actionOnBtn:', aUAPEntry.actionOnBtn);
				var tab = aUAPEntry.tab.get();
				tab.ownerDocument.defaultView.focus(); // focus browser window
				tab.ownerDocument.defaultView.gBrowser.selectedTab = aUAPEntry.tab.get(); // focus tab
	}
	
	throw new Error('throw to preventing close of this notif-bar');
}

var NBs = { // short for "notification bars"
	crossWin: {},  // holds objects of details for nb's that should show across all windows, key should be aGroupId
	/* struct
	{
		msg: String,
		img: String,
		p: Number, // priority
		g-editor-session-id: Number,
		btns: Array
		///// btns Array
		// [{
		// 	label: 'Button-ID:String', // nativeshot custom, append -ID: and whatever string you want, this is how it recognizes button future updates, this is converted to custom attribute on the element //CHANGABLE, RESPECTED BY updateGlobal // after item is appended it doesnt use the '-ID:' anymore so when update it, no need to add in the -ID: link64798787
		// 	accessKey: 'B', //CHANGABLE, RESPECTED BY updateGlobal // should be optional but its a bug i need to file on bugzilla, if dont set, then its undefined and accesskey is set to u as thats first letter of undefined
		// 	popup: null,  //NOT changeable, by updateGlobal yet // ON creation, this must be either string of id of existing popup OR an xul element ready to append, and if it is xul element, then TYPE must set type to menu or menu-button // for update though this should be json array for jsonToDOM OR null if you want it removed  // SOOO for ease, dont ever set this on create, only go for update // see this image for on creation styles: C:\Users\Vayeate\Documents\GitHub\AwesomeBar-Power-Tip\popup is string and type is null, popup is getElementById of xul el and type is menu, popup is getElementById of xul and el is menu-button.png
		//  type: String // optional  //NOT changeable, by updateGlobal yet //menu or menu-button are special, it causes popup to be required to be an XUL element. // for update though, this should be whatever // SOOO for ease, dont ever set this on create, only go for update
		//  anchor: String // optional  //NOT changeable, by updateGlobal yet
		//  isDefault: String // optional, if none of your buttons have this, then button at position 0 is made default
		//  class: 'blah1 blah2 blah3', // nativeshot custom, setAttribute('class')  //CHANGABLE, RESPECTED BY updateGlobal
		//  btn_id: String, // nativeshot custom same string set in label // only has to be unique per notification notifcation, not per deck
		// 	callback: function(blah) {  //NOT changable, updateGlobal doesnt set this yet, ill have to learn how, im sure its possible, as of aug 13 2015
		// 	  _actionTaken = true;
		// 	  console.log('blah:', blah);
		// 	}
		// ]
		///
	}
	*/
	updateGlobal: function(aGroupId, aHints) {
		// do the changes on the NBs.crossWin[aGroupId] then call this, and it will update to dom. but if you removed some btns, this will remove from the js object, so you dont have to pre do that
		// aHints is an obj is then no need to close and update
			// lbl - any
			// p - any
			// btns - {removed:[btn_ids],label:[btn_ids],class:[btn_ids],type:[btn_ids],popup:[btn_ids]} // not yet supported added:[btn_ids]
		
		var cCrossWin = NBs.crossWin[aGroupId];
		var DOMWindows = Services.wm.getEnumerator('navigator:browser');
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			var btmDeckBox = aDOMWindow.document.getElementById('nativeshotDeck' + aGroupId);
			if (btmDeckBox) {
				var nb = btmDeckBox.getNotificationWithValue(aGroupId);
				if (aHints.lbl) {
					nb.label = cCrossWin.msg;
				}
				if (aHints.p) {
					nb.priority = cCrossWin.p;
					// copied from here, keep updated from here, :https://dxr.mozilla.org/mozilla-central/source/toolkit/content/widgets/notification.xml#151
					if (cCrossWin.p >= btmDeckBox.PRIORITY_CRITICAL_LOW) {
						nb.setAttribute("type", "critical");
					} else if (cCrossWin.p <= btmDeckBox.PRIORITY_INFO_HIGH) {
						nb.setAttribute("type", "info");
					} else {
						nb.setAttribute("type", "warning");
					}
				}
				if (aHints.btns) {
					var allBtnsQ = nb.querySelectorAll('button.notification-button');
					var allBtnsEl = {};
					for (var i=0; i<allBtnsQ.length; i++) {
						var cBtnId = allBtnsQ[i].getAttribute('data-btn-id');
						allBtnsEl[cBtnId] = allBtnsQ[i];
					}
					allBtnsQ = null;
					console.info('allBtnsEl:', allBtnsEl);
					
					var allBtnsInfo = {};
					for (var i=0; i<cCrossWin.btns.length; i++) {
						var cBtnInfo = cCrossWin.btns[i];
						allBtnsInfo[cBtnInfo.btn_id] = {};
						for (var p in cBtnInfo) {
							allBtnsInfo[cBtnInfo.btn_id][p] = cBtnInfo[p];
						}
					}
					console.info('allBtnsInfo:', allBtnsInfo);
					
					if (aHints.btns.removed) {
						for (var i=0; i<aHints.btns.removed.length; i++) {
							allBtnsEl[aHints.btns.removed[i]].parentNode.removeChild(btn);
						}
					}
					if (aHints.btns.label) {
						for (var i=0; i<aHints.btns.label.length; i++) {
							allBtnsEl[aHints.btns.label[i]].label = allBtnsInfo[aHints.btns.label[i]].label;
						}
					}
					if (aHints.btns.akey) {
						for (var i=0; i<aHints.btns.akey.length; i++) {
							allBtnsEl[aHints.btns.akey[i]].setAttribute('accesskey', allBtnsInfo[aHints.btns.akey[i]].accessKey);
						}
					}
					if (aHints.btns.class) {
						for (var i=0; i<aHints.btns.class.length; i++) {
							var cClass = allBtnsEl[aHints.btns.class[i]].getAttribute('class');
							cClass = cClass.substr(0, cClass.indexOf(' custom_classes_divider '));
							allBtnsEl[aHints.btns.class[i]].setAttribute('class', cClass + ' custom_classes_divider ' + allBtnsInfo[aHints.btns.class[i]].class);
						}
					}
					if (aHints.btns.type) {
						for (var i=0; i<aHints.btns.type.length; i++) {
							allBtnsEl[aHints.btns.type[i]].setAttribute('type', allBtnsInfo[aHints.btns.type[i]].type);
						}
					}
					if (aHints.btns.popup) {
						// popup gets removed and recated everytime this hint exists
						for (var i=0; i<aHints.btns.popup.length; i++) {
							if (allBtnsEl[aHints.btns.popup[i]].childNodes[0]) {
								allBtnsEl[aHints.btns.popup[i]].removeChild(allBtnsEl[aHints.btns.popup[i]].childNodes[0]); // its always first childe node im pretty sure as when we add it, and on create they add it, they append to the button
							}
							if (allBtnsInfo[aHints.btns.popup[i]].popup !== null) {
								allBtnsEl[aHints.btns.popup[i]].appendChild(jsonToDOM(allBtnsInfo[aHints.btns.popup[i]].popup, aDOMWindow.document, {})); // its always first childe node im pretty sure as when we add it, and on create they add it, they append to the button
							}
						}
					}
				}
			} else {
				console.error('doesnt exist in this window, this is weird, maybe should insertGlobalToWin');
			}
		}
	
		// to update, i close the notif and reopen it
	},
	closeGlobal: function(aGroupId) {
		
		delete NBs.crossWin[aGroupId];
		
		var DOMWindows = Services.wm.getEnumerator('navigator:browser');
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			var btmDeckBox = aDOMWindow.document.getElementById('nativeshotDeck' + aGroupId);
			if (btmDeckBox) {
				var n = btmDeckBox.getNotificationWithValue(aGroupId);
				if (n) {
					n.close();
				}
			} else {
				console.warn('very werid, it didnt even have it, it was global nb it should have had it');
			}
		}
	},
	insertGlobalToWin: function(aGroupId, aDOMWindow) {
		// aDOMWindow is a dom window or 'all'
		if (aDOMWindow == 'all') {
			var DOMWindows = Services.wm.getEnumerator('navigator:browser');
			while (DOMWindows.hasMoreElements()) {
				aDOMWindow = DOMWindows.getNext();
				if (aDOMWindow.gBrowser) {
					NBs.insertGlobalToWin.bind(null, aGroupId, aDOMWindow)();
				}
			}
			return;
		};
		var aDOMDocument = aDOMWindow.document;
		
		var cCrossWin = NBs.crossWin[aGroupId];	
		
		var deck = aDOMDocument.getElementById('content-deck');
		var btmDeckBox = aDOMDocument.getElementById('nativeshotDeck' + aGroupId);
		console.info('btmDeckBox:', btmDeckBox);
		if (!btmDeckBox) {
		  console.log('created new btm deck');
		  btmDeckBox = aDOMDocument.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'notificationbox');
		  btmDeckBox.setAttribute('id', 'nativeshotDeck' + aGroupId);
		  // deck.parentNode.insertBefore(btmDeckBox, deck); // for top
		  deck.parentNode.appendChild(btmDeckBox); // for bottom
		} else {
			console.log('already there');
		}

		var nb = btmDeckBox; //win.gBrowser.getNotificationBox(); //use _gNB for window level notification. use `win.gBrowser.getNotificationBox()` for tab level
		var n = btmDeckBox.getNotificationWithValue(aGroupId);
		console.log('nb:', nb, 'n:', n);

		if (n) {
			console.log('global nb already in this window, so not adding');
		} else {
			
			var cNB;
			var notifCallback = function(what) {
				console.log('what:', what);
				if (what == 'removed') {
					// btmDeckBox.removeNotification(cNB, false); // close just hides it, so we do removeNotification to remove it. otherwise if same groupid, nativeshot will find it already exists and then not create another one
					aDOMWindow.setTimeout(function() {
						btmDeckBox.parentNode.removeChild(btmDeckBox);
					}, 1000);
					if (aGroupId in NBs.crossWin) {
						NBs.closeGlobal(aGroupId);
					} else {
						console.log('aGroupId no longer in crossWin so this is probably a global close');
					}
				}
			}
			
			// https://dxr.mozilla.org/mozilla-central/source/toolkit/content/widgets/notification.xml#79
			cNB = nb.appendNotification(
				cCrossWin.msg,
				aGroupId,
				cCrossWin.img,
				cCrossWin.p,
				cCrossWin.btns,
				notifCallback
			);
			var btns = cNB.querySelectorAll('button.notification-button');
			for (var i=0; i<btns.length; i++) {
				var label_with_id = btns[i].getAttribute('label');
				var id_index = label_with_id.lastIndexOf('-ID:');
				var btn_id = label_with_id.substr(id_index + '-ID:'.length);
				var label = label_with_id.substr(0, id_index);
				
				console.info('btn_id:', btn_id);
				console.info('label:', label);
				
				btns[i].setAttribute('label', label);
				btns[i].setAttribute('data-btn-id', btn_id);
				cCrossWin.afterOfficialInit_completedCustInit = true; // cust init is me takng the btn_id out of the label
				
				var btn_id_found_in_crossWinBtns = false;
				for (var j=0; j<cCrossWin.btns.length; j++) {
					if (cCrossWin.btns[j].btn_id == btn_id) {
						btn_id_found_in_crossWinBtns = true;
						break;
					}
				}
				if (!btn_id_found_in_crossWinBtns) {
					throw new Error('btn_id in label post -ID: was not found in crossWinBtns because devuser made typo'); // should never happen devuser dont make typo
				}
				
				var cClasses = btns[i].getAttribute('class');
				btns[i].setAttribute('class', cClasses + ' custom_classes_divider ' + cCrossWin.btns[j].class);
				
				btns[i].label = label; // after item is appended it doesnt use the '-ID:' anymore so when update it, no need to add in the -ID: link64798787
			}
		}
	}
};
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
			
			for (aGroupId in NBs.crossWin) {
				NBs.insertGlobalToWin(aGroupId, aDOMWindow);
			}
		}/* else if (aDOMWindow.document.location.href == 'chrome://global/content/printProgress.xul') {
			//console.error('got incoming print progress window here! opener:', aDOMWindow.opener);
			if (!aDOMWindow.opener) {
				// this is my print window so lets set opener
				// for some reason whenever i do print() from hiddenDOMWindow iframe it doesnt get an opener
				// i have set opener this cuz window.opener is null so it doesnt close: `TypeError: opener is null printProgress.js:83:10`
				// as whenever i print from my hidden frame on link678321212 it opens the print dialog with opener set to null, and then it tries opener.focus() and it then leaves the window open
				// :todo: i should maybe target specifically my printer window, as if other people open up with opener null then i dont know if i should fix for them from here, but right now it is, and if opener ever is null then they'll run into that problem of window not closing (at least for me as tested on win81)
				console.error('going to set opener to wm! as it was null');
				//aDOMWindow.opener = Services.wm.getMostRecentWindow(null); // { focus: function() { } };
				//console.error('ok set opener! it is:', aDOMWindow.opener);
			}
		}*/
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

var gDelayedShotObj;
var gLastIntervalId = -1;
const delayedShotTimePerClick = 5; // sec

function delayedShotUpdateBadges() {
	var widgetInstances = CustomizableUI.getWidget('cui_nativeshot').instances;
	for (var i=0; i<widgetInstances.length; i++) {
		if (gDelayedShotObj.time_left > 0 && !widgetInstances[i].node.hasAttribute('badge')) {
			widgetInstances[i].node.classList.add('badged-button');
		}
		if (gDelayedShotObj.time_left > 0) {
			widgetInstances[i].node.setAttribute('badge', gDelayedShotObj.time_left);
		} else {
			widgetInstances[i].node.classList.remove('badged-button');
			widgetInstances[i].node.removeAttribute('badge');
		}
	}
}

var delayedShotTimerCallback = {
	notify: function() {
		gDelayedShotObj.time_left--;
		delayedShotUpdateBadges();
		if (!gDelayedShotObj.time_left) {
			cancelAndCleanupDelayedShot();
			var aDOMWin = Services.wm.getMostRecentWindow('navigator:browser');
			if (!aDOMWin) {
				throw new Error('no navigator:browser type window open, this is required in order to take screenshot')
			}
			shootAllMons(aDOMWin);
		} else {
			gDelayedShotObj.timer.initWithCallback(delayedShotTimerCallback, 1000, Ci.nsITimer.TYPE_ONE_SHOT);
		}
	}
};

function cancelAndCleanupDelayedShot() {
	if (gDelayedShotObj) {
		gDelayedShotObj.timer.cancel();
		gDelayedShotObj.time_left = 0; // needed for delayedShotUpdateBadges
		delayedShotUpdateBadges();
		gDelayedShotObj = null;
	}
}

function install() {}
function uninstall(aData, aReason) {
	// delete imgur history file
	if (aReason == ADDON_UNINSTALL) {
		Services.prefs.clearUserPref(myPrefBranch + 'quick_save_dir');
		Services.prefs.clearUserPref(myPrefBranch + 'print_preview');
	}
}

function startup(aData, aReason) {
	core.addon.aData = aData;
	extendCore();
	
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
				if (gDelayedShotObj) {
					// there is a count down currently running
					gDelayedShotObj.time_left += delayedShotTimePerClick;
					// gDelayedShotObj.timer.cancel();
					delayedShotUpdateBadges();
					// so user wants to add 5 mroe sec to countdown
				} else {
					gDelayedShotObj = {
						time_left: delayedShotTimePerClick,
						timer: Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer)
					};
					delayedShotUpdateBadges();
					gDelayedShotObj.timer.initWithCallback(delayedShotTimerCallback, 1000, Ci.nsITimer.TYPE_ONE_SHOT);
				}
			} else {
				if (gDelayedShotObj) {
					cancelAndCleanupDelayedShot();
				}
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
	
	aboutFactory_nativeshot = new AboutFactory(AboutNativeShot);
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }
	
	try {
		myServices.mm.removeMessageListener(core.addon.id, fsComServer.twitterClientMessageListener); // in case its still alive which it very well could be, because user may disable during tweet process // :todo: should probably clear all notfication bars maybe
	} catch (ignore) {}
	
	CustomizableUI.destroyWidget('cui_nativeshot');
	
	//windowlistener more
	windowListener.unregister();
	//end windowlistener more
	
	//start observers stuff more
	for (var o in observers) {
		observers[o].unreg();
	}
	//end observers stuff more
	
	// clear intervals if any are pending
	if (gDelayedShotObj) {
		cancelAndCleanupDelayedShot();
	}
	
	if (gPostPrintRemovalFunc) { // poor choice of clean up for post print, i need to be able to find a place that triggers after print to file, and also after if they dont print to file, if iframe is not there, then print to file doesnt work
		gPostPrintRemovalFunc();
	}
	
	for (var id in gColReuploadTimers) {
		gColReuploadTimers[id].timer.cancel();
		delete gColReuploadTimers[id];
	}
	
	aboutFactory_nativeshot.unregister();
	
	// destroy worker
	MainWorker._worker.terminate();
	console.error('worker should have termed');
}

function getPrefNoSetStuff(aPrefName) {
	// gets pref, if its not there, returns default
	// this one doesnt have the set stuff
	switch (aPrefName) {
		case 'quick_save_dir':
		
				// os path to dir to save in
				var defaultVal = function() {
					try {
						return Services.dirsvc.get('XDGPict', Ci.nsIFile).path;
					} catch (ex if ex.result == Cr.NS_ERROR_FAILURE) { // this cr when path at keyword doesnt exist
						// console.warn('ex:', ex);
						try {
							return Services.dirsvc.get('Pict', Ci.nsIFile).path;
						} catch (ex if ex.result == Cr.NS_ERROR_FAILURE) { // this cr when path at keyword doesnt exist
							// console.warn('ex:', ex);
							return OS.Constants.Path.desktopDir;
						}
					}
				};
				var prefType = 'Char';
				
				var prefVal;
				try {
					 prefVal = Services.prefs['get' + prefType + 'Pref'](myPrefBranch + aPrefName);
				} catch (ex if ex.result == Cr.NS_ERROR_UNEXPECTED) { // this cr when pref doesnt exist
					// ok probably doesnt exist, so return default value
					prefVal = defaultVal();
				}
				return prefVal;
			
			break;
		case 'print_preview':
			
				var defaultVal = false;
				var prefType = 'Bool';
				
				var prefVal;
				try {
					 prefVal = Services.prefs['get' + prefType + 'Pref'](myPrefBranch + 'print_preview');
				} catch (ex if ex.result == Cr.NS_ERROR_UNEXPECTED) { // this cr when pref doesnt exist
					// ok probably doesnt exist, so return default value
					prefVal = defaultVal;
				}
				return prefVal;
			
			break;
		default:
			throw new Error('unrecognized aPrefName: ' + aPrefName);
	}
}

function NBs_updateGlobal_updateTwitterBtn(aUAPEntry, newLabel, newClass, newAction) {
	// update twitter btn label, class, and action, because i do this so much
	
	// get notif bar id, as crossWinId
	var crossWinId = aUAPEntry.gEditorSessionId + '-twitter';
	// get the buttons infos in this notif bar
	var aBtnInfos = NBs.crossWin[crossWinId].btns;
	
	// find our specific btninfo for this tab
	var aBtnInfo;
	for (var i=0; i<aBtnInfos.length; i++) {
		if (aBtnInfos[i].btn_id == aUAPEntry.userAckId) {
			aBtnInfo = aBtnInfos[i];
			break;
		}
	}
	
	if (!aBtnInfo) {
		throw new Error('couldnt find btn info for this tab, this should never happen');
	}
	
	if (!NBs.crossWin[crossWinId].afterOfficialInit_completedCustInit) {
		// item hasnt been inserted to dom yet, so keep the -ID on it
		newLabel += '-ID:' + aUAPEntry.userAckId;
	}
	aBtnInfo.label = newLabel;
	aBtnInfo.class = newClass;
	aUAPEntry.actionOnBtn = newAction;
	console.error('set actionOnBtn to newAction of:', newAction);
	
	NBs.updateGlobal(crossWinId, {
		lbl: 1, // label was updated for sure
		btns:{
			label: [aUAPEntry.userAckId], // arr of btn ids that need updating
			class: [aUAPEntry.userAckId] // arr of btn ids that need updating
		}
	});
}

// link872132154 cross file
const aTypeStrToTypeInt = {
	'imgur-anonymous': 0,
	'twitter': 1,
	'copy': 2,
	'print': 3,
	'save-quick': 4,
	'save-browse': 5
};

function appendToHistoryLog(aTypeStr, aData) {
	/* // info on args
	// aTypeStr - string. will get added to push obj with key of `t` for type
		// imgur-anonymous
		// twitter
		// print
		// copy (for copy image to clipboard)
		// save-quick
		// save-browse
	// aData - object
		{
			// regardless of aType must have
			d: new Date().getTime()
			
			// save-quick and save-browse
			n: 'file name with extension so like blah.png as in future will likely support other then png output' // `n` for name
			f: 'full os path to folder saved in'
			
			// imgur-anonymous
			x: 'delete hash' // `x` signifies image when remove, as d is taken for date
			n: 'file name here is the img id as its anonymous'
			
			// twitter
			u: 'user_id uploaded too', // maybe not necessary
			// s: 'user_screen_name uploaded too', // maybe not necessary // for now no, because its at the start of `p` anyways which is `other_info.permlink`
			p: 'post, p stands for post which stands for tweet, id. so post id. so tweet id.' // a link is made by going https://twitter.com/USSER_NAME_HERE/status/TWEET_ID // althought USSER_NAME_HERE seems like it can be anything and it gets fixed to the right one
			l: 'link/url to imaage' // i expected imags to be "https://pbs.twimg.com/media/CO0xs-vVAAEJHqP.png" however im not sure so saving whole url for now
		}
	*/
	
	// start - validating arguments provided by devuser
	
	var dataKeysForTypeId = {}; // these and no more and no less keys should be found in aData
	dataKeysForTypeId[aTypeStrToTypeInt['imgur-anonymous']] = ['d', 'x', 'n'];
	dataKeysForTypeId[aTypeStrToTypeInt['twitter']] = ['d', 'u', 'p', 'l'];
	dataKeysForTypeId[aTypeStrToTypeInt['copy']] = ['d'];
	dataKeysForTypeId[aTypeStrToTypeInt['print']] = ['d'];
	dataKeysForTypeId[aTypeStrToTypeInt['save-browse']] = ['d', 'n', 'f'];
	dataKeysForTypeId[aTypeStrToTypeInt['save-quick']] = ['d', 'n', 'f'];
	
	if (!(aTypeStr in aTypeStrToTypeInt)) {
		throw new Error('unidentified aTypeStr: ' + aTypeStr);
	}
	
	if (!(aTypeStrToTypeInt[aTypeStr] in dataKeysForTypeId)) {
		throw new Error('dev forgot to define the required keys for aTypeStr: ' + aTypeStr);
	}
	
	// check if any extra keys found in aData, if it is then throw
	for (var p in aData) {
		if (dataKeysForTypeId[aTypeStrToTypeInt[aTypeStr]].indexOf(p) == -1) {
			throw new Error('a key was provided in aData but it is not an acceptable key based on dataKeysForTypeId. the invalid key: ' + p);
		}
	}
	
	// check to make sure the required keys are found in aData else throw
	for (var i=0; i<dataKeysForTypeId[aTypeStrToTypeInt[aTypeStr]].length; i++) {
		if (!(dataKeysForTypeId[aTypeStrToTypeInt[aTypeStr]][i] in aData)) {
			throw new Error('required key note found in aData. the required key: ' + dataKeysForTypeId[aTypeStrToTypeInt[aTypeStr]][i]);
		}
	}
	
	// push the aTypeInt to the aData obj
	aData.t = aTypeStrToTypeInt[aTypeStr];
	
	// end - ok done validating arguments provided by devuser
	
	// save to upload history - only for anonymous uploads to imgur, so can delete in future
	
	var do_closeHistory = function(hOpen) {
		var promise_closeHistory = hOpen.close();
		promise_closeHistory.then(
			function(aVal) {
				console.log('Fullfilled - promise_closeHistory - ', aVal);
				// start - do stuff here - promise_closeHistory
				// notify any open dashboards that they should reload gui
				myServices.mm.broadcastAsyncMessage(core.addon.id, 'serverCommand_refreshDashboardGuiFromFile');
				console.log('Fullfilled - appendToHistoryLog - ', aVal);
				// end - do stuff here - promise_closeHistory
			},
			function(aReason) {
				var rejObj = {name:'promise_closeHistory', aReason:aReason};
				console.error('Rejected - promise_closeHistory - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_closeHistory', aCaught:aCaught};
				console.error('Caught - promise_closeHistory - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		);
	};
	
	var do_writeHistory = function(hOpen) {
		var txtToAppend = ',' + JSON.stringify(aData); // note: the text is an unbracketed array, so the leading { and ending } are missing but the stuff within are seperated by a comma, and first character is a comma
		var txtEncoded = getTxtEncodr().encode(txtToAppend);
		var promise_writeHistory = hOpen.write(txtEncoded);
		promise_writeHistory.then(
			function(aVal) {
				console.log('Fullfilled - promise_writeHistory - ', aVal);
				// start - do stuff here - promise_writeHistory
				do_closeHistory(hOpen);
				// end - do stuff here - promise_writeHistory
			},
			function(aReason) {
				var rejObj = {name:'promise_writeHistory', aReason:aReason};
				console.error('Rejected - promise_writeHistory - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_writeHistory', aCaught:aCaught};
				console.error('Caught - promise_writeHistory - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		);
	};
	
	var do_makeDirsToHistory = function() {
		var promise_makeDirsToHistory = makeDir_Bug934283(OS.Path.dirname(OSPath_historyLog), {from:OS.Constants.Path.profileDir})
		promise_makeDirsToHistory.then(
			function(aVal) {
				console.log('Fullfilled - promise_makeDirsToHistory - ', aVal);
				// start - do stuff here - promise_makeDirsToHistory
				do_openHistory();
				// end - do stuff here - promise_makeDirsToHistory
			},
			function(aReason) {
				var rejObj = {name:'promise_makeDirsToHistory', aReason:aReason};
				console.error('Rejected - promise_makeDirsToHistory - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDirsToHistory', aCaught:aCaught};
				console.error('Caught - promise_makeDirsToHistory - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		);
	};
	
	var openHistoryAttempt = 1;
	var do_openHistory = function() {
		var promise_openHistory = OS.File.open(OSPath_historyLog, {write: true, append: true}); // creates file if it wasnt there, but if folder paths dont exist it throws unixErrno=2 winLastError=3
		promise_openHistory.then(
			function(aVal) {
				console.log('Fullfilled - promise_openHistory - ', aVal);
				// start - do stuff here - promise_openHistory
				do_writeHistory(aVal);
				// end - do stuff here - promise_openHistory
			},
			function(aReason) {
				var rejObj = {name:'promise_openHistory', aReason:aReason};
				if (aReason.becauseNoSuchFile && openHistoryAttempt == 1) {
					// first attempt, and i have only ever gotten here with os.file.open when write append are true if folder doesnt exist, so make it per https://gist.github.com/Noitidart/0401e9a7de716de7de45
					openHistoryAttempt++;
					do_makeDirsToHistory();
					rejObj.openHistoryAttempt = openHistoryAttempt;
				} else {
					console.error('Rejected - promise_openHistory - ', rejObj);
					//deferred_createProfile.reject(rejObj);
				}
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_openHistory', aCaught:aCaught};
				console.error('Caught - promise_openHistory - ', rejObj);
				//deferred_createProfile.reject(rejObj);
			}
		);
	};
	
	do_openHistory(); // starts the papend to history process
}

// start - common helper functions
function isFocused(window) {
    let childTargetWindow = {};
    Services.focus.getFocusedElementForWindow(window, true, childTargetWindow);
    childTargetWindow = childTargetWindow.value;

    let focusedChildWindow = {};
    if (Services.focus.activeWindow) {
        Services.focus.getFocusedElementForWindow(Services.focus.activeWindow, true, focusedChildWindow);
        focusedChildWindow = focusedChildWindow.value;
    }

    return (focusedChildWindow === childTargetWindow);
}
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
		bootstrap[workerScopeName] = new BasePromiseWorker(aPath);
		
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
	// update 072615 - added support for aOptions.aMethod
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
	var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

	var handler = ev => {
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

	var evf = f => ['load', 'error', 'abort'].forEach(f);
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
		xhr.open(aOptions.aMethod ? aOptions.aMethod : 'GET', aStr, true);
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
function makeDir_Bug934283(path, options) {
	// pre FF31, using the `from` option would not work, so this fixes that so users on FF 29 and 30 can still use my addon
	// the `from` option should be a string of a folder that you know exists for sure. then the dirs after that, in path will be created
	// for example: path should be: `OS.Path.join('C:', 'thisDirExistsForSure', 'may exist', 'may exist2')`, and `from` should be `OS.Path.join('C:', 'thisDirExistsForSure')`
	// options of like ignoreExisting is exercised on final dir
	
	if (!options || !('from' in options)) {
		console.error('you have no need to use this, as this is meant to allow creation from a folder that you know for sure exists, you must provide options arg and the from key');
		throw new Error('you have no need to use this, as this is meant to allow creation from a folder that you know for sure exists, you must provide options arg and the from key');
	}

	if (path.toLowerCase().indexOf(options.from.toLowerCase()) == -1) {
		console.error('The `from` string was not found in `path` string');
		throw new Error('The `from` string was not found in `path` string');
	}

	var options_from = options.from;
	delete options.from;

	var dirsToMake = OS.Path.split(path).components.slice(OS.Path.split(options_from).components.length);
	console.log('dirsToMake:', dirsToMake);

	var deferred_makeDir_Bug934283 = new Deferred();
	var promise_makeDir_Bug934283 = deferred_makeDir_Bug934283.promise;

	var pathExistsForCertain = options_from;
	var makeDirRecurse = function() {
		pathExistsForCertain = OS.Path.join(pathExistsForCertain, dirsToMake[0]);
		dirsToMake.splice(0, 1);
		var promise_makeDir = OS.File.makeDir(pathExistsForCertain, options);
		promise_makeDir.then(
			function(aVal) {
				console.log('Fullfilled - promise_makeDir - ', 'ensured/just made:', pathExistsForCertain, aVal);
				if (dirsToMake.length > 0) {
					makeDirRecurse();
				} else {
					deferred_makeDir_Bug934283.resolve('this path now exists for sure: "' + pathExistsForCertain + '"');
				}
			},
			function(aReason) {
				var rejObj = {
					promiseName: 'promise_makeDir',
					aReason: aReason,
					curPath: pathExistsForCertain
				};
				console.error('Rejected - ' + rejObj.promiseName + ' - ', rejObj);
				deferred_makeDir_Bug934283.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDir', aCaught:aCaught};
				console.error('Caught - promise_makeDir - ', rejObj);
				deferred_makeDir_Bug934283.reject(rejObj); // throw aCaught;
			}
		);
	};
	makeDirRecurse();

	return promise_makeDir_Bug934283;
}
function tryOsFile_ifDirsNoExistMakeThenRetry(nameOfOsFileFunc, argsOfOsFileFunc, fromDir, aOptions={}) {
	//last update: 061215 0303p - verified worker version didnt have the fix i needed to land here ALSO FIXED so it handles neutering of Fx37 for writeAtomic and I HAD TO implement this fix to worker version, fix was to introduce aOptions.causesNeutering
	// aOptions:
		// causesNeutering - default is false, if you use writeAtomic or another function and use an ArrayBuffer then set this to true, it will ensure directory exists first before trying. if it tries then fails the ArrayBuffer gets neutered and the retry will fail with "invalid arguments"
		
	// i use this with writeAtomic, copy, i havent tested with other things
	// argsOfOsFileFunc is array of args
	// will execute nameOfOsFileFunc with argsOfOsFileFunc, if rejected and reason is directories dont exist, then dirs are made then rexecute the nameOfOsFileFunc
	// i added makeDir as i may want to create a dir with ignoreExisting on final dir as was the case in pickerIconset()
	// returns promise
	
	var deferred_tryOsFile_ifDirsNoExistMakeThenRetry = new Deferred();
	
	if (['writeAtomic', 'copy', 'makeDir'].indexOf(nameOfOsFileFunc) == -1) {
		deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
		// not supported because i need to know the source path so i can get the toDir for makeDir on it
		return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise; //just to exit further execution
	}
	
	// setup retry
	var retryIt = function() {
		console.info('tryosFile_ retryIt', 'nameOfOsFileFunc:', nameOfOsFileFunc, 'argsOfOsFileFunc:', argsOfOsFileFunc);
		var promise_retryAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		promise_retryAttempt.then(
			function(aVal) {
				console.log('Fullfilled - promise_retryAttempt - ', aVal);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('retryAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_retryAttempt', aReason:aReason};
				console.error('Rejected - promise_retryAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_retryAttempt', aCaught:aCaught};
				console.error('Caught - promise_retryAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};
	
	// popToDir
	var toDir;
	var popToDir = function() {
		switch (nameOfOsFileFunc) {
			case 'writeAtomic':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;
				
			case 'copy':
				toDir = OS.Path.dirname(argsOfOsFileFunc[1]);
				break;

			case 'makeDir':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;
				
			default:
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
				return; // to prevent futher execution
		}
	};
	
	// setup recurse make dirs
	var makeDirs = function() {
		if (!toDir) {
			popToDir();
		}
		var promise_makeDirsRecurse = makeDir_Bug934283(toDir, {from: fromDir});
		promise_makeDirsRecurse.then(
			function(aVal) {
				console.log('Fullfilled - promise_makeDirsRecurse - ', aVal);
				retryIt();
			},
			function(aReason) {
				var rejObj = {name:'promise_makeDirsRecurse', aReason:aReason};
				console.error('Rejected - promise_makeDirsRecurse - ', rejObj);
				/*
				if (aReason.becauseNoSuchFile) {
					console.log('make dirs then do retryAttempt');
					makeDirs();
				} else {
					// did not get becauseNoSuchFile, which means the dirs exist (from my testing), so reject with this error
				*/
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				/*
				}
				*/
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDirsRecurse', aCaught:aCaught};
				console.error('Caught - promise_makeDirsRecurse - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	var doInitialAttempt = function() {
		var promise_initialAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		console.info('tryosFile_ initial', 'nameOfOsFileFunc:', nameOfOsFileFunc, 'argsOfOsFileFunc:', argsOfOsFileFunc);
		promise_initialAttempt.then(
			function(aVal) {
				console.log('Fullfilled - promise_initialAttempt - ', aVal);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('initialAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_initialAttempt', aReason:aReason};
				console.error('Rejected - promise_initialAttempt - ', rejObj);
				if (aReason.becauseNoSuchFile) { // this is the flag that gets set to true if parent dir(s) dont exist, i saw this from experience
					console.log('make dirs then do secondAttempt');
					makeDirs();
				} else {
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				}
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initialAttempt', aCaught:aCaught};
				console.error('Caught - promise_initialAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};
	
	if (!aOptions.causesNeutering) {
		doInitialAttempt();
	} else {
		// ensure dir exists, if it doesnt then go to makeDirs
		popToDir();
		var promise_checkDirExistsFirstAsCausesNeutering = OS.File.exists(toDir);
		promise_checkDirExistsFirstAsCausesNeutering.then(
			function(aVal) {
				console.log('Fullfilled - promise_checkDirExistsFirstAsCausesNeutering - ', aVal);
				// start - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
				if (!aVal) {
					makeDirs();
				} else {
					doInitialAttempt(); // this will never fail as we verified this folder exists
				}
				// end - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
			},
			function(aReason) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aReason:aReason};
				console.warn('Rejected - promise_checkDirExistsFirstAsCausesNeutering - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aCaught:aCaught};
				console.error('Caught - promise_checkDirExistsFirstAsCausesNeutering - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		);
	}
	
	
	return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise;
}
function showFileInOSExplorer(aNsiFile) {
	//http://mxr.mozilla.org/mozilla-release/source/browser/components/downloads/src/DownloadsCommon.jsm#533
	// opens the directory of the aNsiFile
	
	if (aNsiFile.isDirectory()) {
		aNsiFile.launch();
	} else {
		aNsiFile.reveal();
	}
}
function copyTextToClip(aTxt) {
	var trans = Transferable(Services.wm.getMostRecentWindow('navigator:browser'));
	trans.addDataFlavor('text/unicode');
	trans.setTransferData('text/unicode', SupportsString(aTxt), aTxt.length * 2); // We multiply the length of the string by 2, since it's stored in 2-byte UTF-16 format internally.
	Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
}
function testAndFindDomEl(targetDocument, selectorsToTry, ifFound_setKeyDomEl_inThisObj_toFoundElement, throwOnNotFound) {
	// targetDocument is like aContentDocument
	// selectorsToTry is an array of objects, with key method being a document method, and arg being the first arg to pass to it
	// returns true if it finds any of the selectors >= 0
	// ifFound_setKeyDomEl_inThisObj_toFoundElement must be an object, with key domEl
	var foundDomEl;
	for (var i=0; i<selectorsToTry.length; i++) {
		foundDomEl = targetDocument[selectorsToTry[i].method](selectorsToTry[i].arg);
		if (foundDomEl) {
			if (ifFound_setKeyDomEl_inThisObj_toFoundElement) {
				ifFound_setKeyDomEl_inThisObj_toFoundElement.domEl = foundDomEl;
			}
			return true;
		}
	}
	
	if (throwOnNotFound) {
		throw new Error('none of the selectors found the allow btn, needs :maintain-per-website:');
	} else {
		return false;
	}
};

function attachEventListeners_asSelfRemoveables(iframeDomEl, arrOfEventsWithCallbacks) {
	// call this on an iframe, before doing action to make the iframe change page, like setting src or clicking a btn in a form in that iframe
	// to the iframe attaches the events, with callbacks, in your arrOfEventsWithCallbacks
		// on load of any one of the events that was added, it removes all the added events then calls your callback
		// arrOfEventsWithCallbacks is an array with objects holding three keys:
			// eventType - 'load', 'DOMContentLoaded', etc etc
			// callback - function()
			// useCapture - true/false
			// dontRemoveAllAttached - true/false (defautlt false)
	// both arguments are required

	var arrOfWrappedCbsAroundOrigCbs = []; // as i wrap them with a self remover func
	// the i in arrOfWrappedCbsAroundOrigCbs matches i in arrOfEventsWithCallbacks, well it should as i push to it as i iterate through arrOfEventsWithCallbacks when adding
	var removeAllAttached = function() {
		for (var i=0; i<arrOfEventsWithCallbacks.length; i++) {
			var evWithCb = arrOfEventsWithCallbacks[i];
			iframeDomEl.removeEventListener(evWithCb.eventType, arrOfWrappedCbsAroundOrigCbs[i], evWithCb.useCapture);
		}
	};
	
	for (var i=0; i<arrOfEventsWithCallbacks.length; i++) {
		var evWithCb = arrOfEventsWithCallbacks[i];
		
		var devuserDefinedCB_wrappedWithRemover = function(aOrigDontRemoveAllAttached, aOrigEventType, aOrigUseCapture, aOrigCallback, e) {
			if (!aOrigDontRemoveAllAttached) {
				Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'ok removed all attached callbacks. will call orig call back of this single event type');
				removeAllAttached();
			} else {
				Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'msg', 'will call callback for this single event. did not remove attached as when this event triggered devuser specified not to remove any');
			}
			aOrigCallback(e);
		}.bind(null, evWithCb.dontRemoveAllAttached, evWithCb.eventType, evWithCb.useCapture, evWithCb.callback);
		
		arrOfWrappedCbsAroundOrigCbs.push(devuserDefinedCB_wrappedWithRemover);
		
		iframeDomEl.addEventListener(evWithCb.eventType, devuserDefinedCB_wrappedWithRemover, evWithCb.useCapture);
	}
};

// end - common helper functions