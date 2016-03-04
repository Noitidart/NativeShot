// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

const PromiseWorker = Cu.import('resource://gre/modules/PromiseWorker.jsm').BasePromiseWorker;
Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import('resource://gre/modules/FileUtils.jsm');
Cu.import('resource://gre/modules/Geometry.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/AddonManager.jsm');

var importGlobalPropertiesArr = [];
if (!Ci.nsIDOMFileReader) {
	importGlobalPropertiesArr.push('FileReader');
}
if (importGlobalPropertiesArr.length) {
	Cu.importGlobalProperties(importGlobalPropertiesArr);
}

// Globals
var core = { // core has stuff added into by MainWorker (currently MainWorker) and then it is updated
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
			styles: 'chrome://nativeshot/content/resources/styles/'
		},
		prefbranch: 'extensions.NativeShot@jetpack.',
		prefs: {},
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
var BOOTSTRAP = this;
const NS_HTML = 'http://www.w3.org/1999/xhtml';
const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

const TWITTER_URL = 'https://twitter.com/';
const TWITTER_IMG_SUFFIX = ':large';

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'as', function () { return Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService) });
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'mm', function () { return Cc['@mozilla.org/globalmessagemanager;1'].getService(Ci.nsIMessageBroadcaster).QueryInterface(Ci.nsIFrameScriptLoader); });

// start - pref stuff
// Initialize the prefs object in core - this needs to be done first in the mainthread as then core gets sent to workers
// no validation is done on the defaultValue, i assume the devuser sets it right
var gPrefMeta = { // short for pref meta data // dictates dom structure in options.xhmtl crossfile-link44375677
	// each MUST HAVE defaultValue, values, type
	// type Custom MUST HAVE getter, setter can be null
	// setter and getter are for setting and getting into the environement they are got from. the js environment here which is core.addon.prefs[aPrefName] is updated on every set and get in prefSet and prefGet with approprate validation done there link3838375435343
		// but do not set the value of core.addon.prefs from the getter/setter
		// async getter, should return a promise, and the value resolved is what is used
	quick_save_dir: {
		defaultValue: quickSaveDirDefaultValue(),
		values: [quickSaveDirValidator],
		type: 'Char' // type is string - Char,Int,Bool,Custom // if custom it then needs a setter and getter. setter can be null then it is never written anywhere.
	},
	print_preview: {
		defaultValue: false,
		values: [false, true],
		type: 'Bool'
	},
	autoupdate: {
		defaultValue: true,
		values: [false, true], // false off, true on
		type: 'Custom',
		setter: function(aNewVal) {
			// i dont care to return promise on succesful set, even though it is async, because the core.addon.prefs[aPrefName] is updated right away and thats what the addon uses. and promise is only for the addon to know when done
			AddonManager.getAddonByID(core.addon.id, function(addon) {
				if (aNewVal) {
					addon.applyBackgroundUpdates  = 2;
				} else {
					addon.applyBackgroundUpdates  = 0;
				}
			});
		},
		getter: function() {
			// do no validation on gotten val, just report it back to devuser, validation is done after it is got
			var mainDeferred_getAutoupdate = new Deferred();
			
			AddonManager.getAddonByID(core.addon.id, function(addon) {
				// start - set lastUpdatedDate into core, this is bad, as getter is meant only for specific stuff. but on startup this gets called, and i need last updated date which is available here so this is unrelated to the pref system
				if (!core.addon.lastUpdatedDate) {
					core.addon.lastUpdatedGetTime = addon.updateDate.getTime();
				}
				// end - set lastUpdatedDate into core, this is bad, as getter is meant only for specific stuff. but on startup this gets called, and i need last updated date which is available here so this is unrelated to the pref system
				var gotVal = parseInt(addon.applyBackgroundUpdates);
				if (gotVal === 0) {
					mainDeferred_getAutoupdate.resolve(false);
				} else if (gotVal === 2) {
					mainDeferred_getAutoupdate.resolve(true);
				} else {
					// its 1, so default value, lets see what that is
					var gotValOfDefault = AddonManager.autoUpdateDefault; // true for on, false for off
					if (gotValOfDefault) {
						// default is on
						mainDeferred_getAutoupdate.resolve(true);
					} else {
						// default is off
						mainDeferred_getAutoupdate.resolve(false);
					}
				}
			});
			
			return mainDeferred_getAutoupdate.promise;
		}
	}
};

// only use prefGet function if you want to get fresh, otherwise just use core.addon.prefs[aPrefName] for the value
function prefGet(aPrefName) {
	
	var prefType = gPrefMeta[aPrefName].type;
	var gotVal;
	switch (prefType) {
		case 'Custom':
			
				gotVal = gPrefMeta[aPrefName].getter();
			
			break;
		case 'Char':
		case 'Int':
		case 'Bool':
			
				try {
					gotVal = Services.prefs['get' + prefType + 'Pref'](core.addon.prefbranch + aPrefName);
				} catch(ex) {
					// pref probably doesnt exist, so set it to defaultValue
					gotVal = gPrefMeta[aPrefName].defaultValue;
				}
			
			break;
		default:
			console.error('could not set because, invalid type set by devuser in gPrefMeta for aPrefName:', aPrefName);
			throw new Error('could not set because, invalid type set by devuser in gPrefMeta for aPrefName');
	}
	
	if (gotVal.constructor.name == 'Promise') {
		var deferred_waitGetter = new Deferred();
		
		// actually on error it returns the default value, because you wanted it fresh right, meaning the devuser thinks current value is defunct?? maybe so im going with this  decided against ----> // on error, it resolves with the current value, if no current value, then it resolves with the default value link444522952112
		
		gotVal.then(
			function(aVal) {
				console.log('Fullfilled - gotVal - ', aVal);
				// start - copy block1029221000
				if (isValidPrefVal(aPrefName, aVal)) {
					core.addon.prefs[aPrefName] = { // link3838375435343
						value: aVal,
						defaultValue: gPrefMeta[aPrefName].defaultValue
					};
					deferred_waitGetter.resolve(aVal);
				} else {
					console.error('got invalid value for pref name:', aPrefName, 'value got was:', '"' + aVal + '"', 'so returning default');
					core.addon.prefs[aPrefName] = { // link3838375435343
						value: gPrefMeta[aPrefName].defaultValue,
						defaultValue: gPrefMeta[aPrefName].defaultValue
					};
					// deferred_waitGetter.resolve(getFromCore_curValOrDefault(aPrefName)); // link444522952112
					deferred_waitGetter.resolve(gPrefMeta[aPrefName].defaultValue); // link444522952112
				}
				// end - copy block1029221000
			},
			function(aReason) {
				var rejObj = {
					name: 'gotVal',
					aReason: aReason
				};
				console.error('Rejected - gotVal - ', rejObj);
				core.addon.prefs[aPrefName] = { // link3838375435343
					value: gPrefMeta[aPrefName].defaultValue,
					defaultValue: gPrefMeta[aPrefName].defaultValue
				};
				// deferred_waitGetter.resolve(getFromCore_curValOrDefault(aPrefName)); // link444522952112
				deferred_waitGetter.resolve(gPrefMeta[aPrefName].defaultValue); // link444522952112
			}
		).catch(
			function(aCaught) {
				var rejObj = {
					name: 'gotVal',
					aCaught: aCaught
				};
				console.error('Caught - gotVal - ', rejObj);
				core.addon.prefs[aPrefName] = gPrefMeta[aPrefName].defaultValue; // link3838375435343
				// deferred_waitGetter.resolve(getFromCore_curValOrDefault(aPrefName)); // link444522952112
				deferred_waitGetter.resolve(gPrefMeta[aPrefName].defaultValue); // link444522952112
			}
		);
		
		return deferred_waitGetter.promise;
	} else {
		// start - copy block1029221000
		if (isValidPrefVal(aPrefName, gotVal)) {
			core.addon.prefs[aPrefName] = { // link3838375435343
				value: gotVal,
				defaultValue: gPrefMeta[aPrefName].defaultValue
			};
			return gotVal;
		}
		// end - copy block1029221000
	}
}

function getFromCore_curValOrDefault(aPrefName) {
	if (aPrefName in core.addon.prefs) {
		return core.addon.prefs[aPrefName];
	} else {
		return gPrefMeta[aPrefName].defaultValue;
	}
}

function prefSet(aPrefName, aNewVal) {
	// returns the prefName obj from core.addon.prefs on set. for non custom and custom sync the return true is valid statement that it succesfully was set. for custom async it is not valid as it will return true before set is complete. 
	
	if (isValidPrefVal(aPrefName, aNewVal)) {
		var prefType = gPrefMeta[aPrefName].type;
		switch (prefType) {
			case 'Custom':
				
					gPrefMeta[aPrefName].setter(aNewVal);
				
				break;
			case 'Char':
			case 'Int':
			case 'Bool':
				
					Services.prefs['set' + prefType + 'Pref'](core.addon.prefbranch + aPrefName, aNewVal);
				
				break;
			default:
				console.error('could not set because, invalid type set by devuser in gPrefMeta for aPrefName:', aPrefName);
				throw new Error('could not set because, invalid type set by devuser in gPrefMeta for aPrefName');
		}
		core.addon.prefs[aPrefName] = { // link3838375435343
			value: aNewVal,
			defaultValue: gPrefMeta[aPrefName].defaultValue
		};
		return core.addon.prefs[aPrefName];
	}
}

function isValidPrefVal(aPrefName, aVal) {
	// aVal is something you want to test if it is valid for setting to pref value
	// RETURNS
		// true
		// false
	
	var cValues = gPrefMeta[aPrefName].values;
	if (!cValues) {
		console.error('valid values not set for aPrefName:', aPrefName);
		throw new Error('valid values not set for aPrefName!');
	}
	for (var i=0; i<cValues.length; i++) {
		if (typeof(cValues[i]) == 'function') {
			if (cValues[i](aVal)) {
				return true;
			}
		} else {
			if (aVal == cValues[i]) {
				return true;
			}
		}
	}
	
	return false;
}

function quickSaveDirDefaultValue() {
	try {
		return Services.dirsvc.get('XDGPict', Ci.nsIFile).path; // works on linux
	} catch (ex) {
		try {
			return Services.dirsvc.get('Pict', Ci.nsIFile).path; // works on windows
		} catch (ex) {
			try {
				return Services.dirsvc.get('Pct', Ci.nsIFile).path; // works on mac
			} catch (ex) {
				return OS.Constants.Path.desktopDir;
			}
		}
	}
}

function quickSaveDirValidator(aNewVal) {
	return true; // :todo: for now i just return true
}

function refreshCoreForPrefs() {
	// updates all the values in core.addon.prefs
	// RETURNS
		// promise telling you when complete. resolve value is core.addon.prefs
	var mainDeferred_refreshCoreForPrefs = new Deferred();
	
	var promiseAllArr_getterRequests = [];
	for (var aPrefName in gPrefMeta) {
		var fetchFresh = prefGet(aPrefName);
		if (fetchFresh.constructor.name == 'Promise') {
			promiseAllArr_getterRequests.push(fetchFresh);
		}
	}
	
	if (!promiseAllArr_getterRequests.length) {
		mainDeferred_refreshCoreForPrefs.resolve(core.addon.prefs);
	} else {
		var promiseAll_getterRequests = Promise.all(promiseAllArr_getterRequests);
		promiseAll_getterRequests.then(
			function(aVal) {
				console.log('Fullfilled - promiseAll_getterRequests - ', aVal);
				mainDeferred_refreshCoreForPrefs.resolve(core.addon.prefs);
			},
			genericReject.bind(null, 'promiseAll_getterRequests', mainDeferred_refreshCoreForPrefs)
		).catch(genericCatch.bind(null, 'promiseAll_getterRequests', mainDeferred_refreshCoreForPrefs));
	}
	
	return mainDeferred_refreshCoreForPrefs.promise;
}
// end - pref stuff

// start - beutify stuff

var devtools;
try {
	var { devtools } = Cu.import('resource://devtools/shared/Loader.jsm', {});
} catch(ex) {
	var { devtools } = Cu.import('resource://gre/modules/devtools/Loader.jsm', {});
}
var beautify1 = {};
var beautify2 = {};
devtools.lazyRequireGetter(beautify1, 'beautify', 'devtools/jsbeautify');
devtools.lazyRequireGetter(beautify2, 'beautify', 'devtools/shared/jsbeautify/beautify');

function BEAUTIFY() {
	try {
		beautify1.beautify.js('""');
		return beautify1.beautify;
	} catch (ignore) {}
	try {
		beautify2.beautify.js('""');
		return beautify2.beautify;
	} catch (ignore) {}
}
// end - beutify stuff

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

			var version_osx = userAgent.match(/Mac OS X 10\.([\d\.]+)/);

			
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

// start - about module
var aboutFactory_nativeshot;
function AboutNativeShot() {}

function initAndRegisterAboutNativeShot() {
	// init it
	AboutNativeShot.prototype = Object.freeze({
		classDescription: justFormatStringFromName(core.addon.l10n.bootstrap.about_page_desc),
		contractID: '@mozilla.org/network/protocol/about;1?what=nativeshot',
		classID: Components.ID('{2079bd20-3369-11e5-a2cb-0800200c9a66}'),
		QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

		getURIFlags: function(aURI) {
			return Ci.nsIAboutModule.ALLOW_SCRIPT | Ci.nsIAboutModule.URI_CAN_LOAD_IN_CHILD;
		},

		newChannel: function(aURI, aSecurity) {
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
	
	// register it
	aboutFactory_nativeshot = new AboutFactory(AboutNativeShot);
}

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
// end - about module

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
var gEResizing = false; // user is moving rect
var gEOrigSelectedRect = new Rect(0, 0, 0, 0);
var gEMDX = null; // mouse down x
var gEMDY = null; // mouse down y
var gESelectedRect = new Rect(0, 0, 0, 0);

const gDefDimFillStyle = 'rgba(0, 0, 0, 0.6)';
const gDefLineDash = [3, 3];
const gDefStrokeStyle = '#fff';
const gDefAltLineDash = [0, 3, 0];
const gDefAltStrokeStyle = '#000';
const gDefLineWidth = '1';
var gDefResizePtSize = 7;
const gDefResizePtStyle = '#000';

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
					['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_save-file-quick']), oncommand:function(e){ gEditor.uploadOauth(e, 'save-quick') }}],
					['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_save-file-browse']), oncommand:function(e){ gEditor.uploadOauth(e, 'save-browse') }}],
					['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_copy']), oncommand:function(e){ gEditor.copyToClipboard(e) }}],
					['xul:menuitem', {id:'print_menuitem', label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_print']), oncommand:function(e){ gEditor.sendToPrinter(e) }}],
					['xul:menu', {label:'Upload to Cloud Drive'}, // :l10n:
						['xul:menupopup', {},
							// ['xul:menuitem', {label:'Amazon Cloud Drive'}],
							// ['xul:menuitem', {label:'Box'}],
							// ['xul:menuitem', {label:'Copy by Barracuda Networks'}],
							['xul:menuitem', {label:'Dropbox', oncommand:function(e){ gEditor.uploadOauth(e, 'dropbox') }}], // :l10n:
							['xul:menuitem', {label:'Google Drive', oncommand:function(e){ gEditor.uploadOauth(e, 'gdrive') }}] // :l10n:
							// ['xul:menuitem', {label:'MEGA'}],
							// ['xul:menuitem', {label:'OneDrive (aka SkyDrive)'}]
						]
					],
					['xul:menu', {label:'Upload to Image Host'}, // :10n:
						['xul:menupopup', {},
							// ['xul:menuitem', {label:'Flickr'}],
							// ['xul:menuitem', {label:'Image Shack'}],
							['xul:menuitem', {label:'Imgur', oncommand:function(e){ gEditor.uploadOauth(e, 'imgur') }}] // :10n:
							// ['xul:menuitem', {label:'Photobucket'}]
						]
					],
					['xul:menu', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_upload-img-host-anon'])},
						['xul:menupopup', {},
							/*['xul:menuitem', {label:'FreeImageHosting.net'}],*/
							['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_imgur']), oncommand:function(e){ gEditor.uploadOauth(e, 'imguranon') }}]
						]
					],
					['xul:menu', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_share-to-social'])},
						['xul:menupopup', {},
							/*['xul:menuitem', {label:'Facebook'}],*/
							['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_twitter']), oncommand:function(e){ gEditor.shareToTwitter(e) }}]
						]
					],
					['xul:menu', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_search-reverse'])},
						['xul:menupopup', {},
							['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_tineye']), oncommand:function(e){ gEditor.uploadOauth(e, 'tineye') }}],
							['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_google-images']), oncommand:function(e){ gEditor.uploadOauth(e, 'google-images') }}]
						]
					],
					['xul:menu', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_ocr'])},
						['xul:menupopup', {},
							['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_gocr']), oncommand:function(e){ gEditor.ocr(e, 'gocr') }}],
							['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_ocrad']), oncommand:function(e){ gEditor.ocr(e, 'ocrad') }}],
							['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_tesseract']), oncommand:function(e){ gEditor.ocr(e, 'tesseract') }}],
							['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_ocr-all']), oncommand:function(e){ gEditor.ocr(e, 'all') }}]
						]
					],
					['xul:menuseparator', {}],
					['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_select-clear']), oncommand:function(e){ gEditor.clearSelection(e) }}],
					['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_select-last']), oncommand:function(e){ gEditor.repeatLastSelection(e) }, id:'repeatLastSelection'}],
					['xul:menu', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_select-fullscreen'])},
						gEMenuArrRefs.select_fullscreen
					],
					['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_select-window']), oncommand:function(e){ gEditor.selectWindow(e) }}],
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
					['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_close']), oncommand:function() { gEditor.closeOutEditor({shiftKey:false}) }}]
				]
			];
	}
	
	return gEMenuDomJson;
}
// start - observer handlers
var gColReuploadTimers = {};
var gLastReuploadTimerId = 0;
// start - canvas functions to act across all canvases
var gESelectedRectLastLast; // set to the last selection on mouse up
var gESelectedRectLast; // temporary, to hold the new gESelectedRectLastLast until the user makes a gESelectedRect that doesnt match gESelectedRectLast
var gCanDim = {
	execFunc: function(aStrFuncName, aArrFuncArgs=[], aObjConvertScreenToLayer) {
		/* aObjConvertScreenToLayer is an object holding keys of `x` and `y` and it tells the index in aArrFuncArgs it is found, it will then convert that to layerX
		if provide this arg MUST provide x and y
		*/
		// if (!Array.isArray(aArrFuncArgs)) {
			// throw new Error('aArrFuncArgs must be an array');
		// }
		// executes the ctx function across all ctx's

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
			if (aArrFuncArgs.length) {
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

					if (rectIntersecting.left == rectIntersecting.right || rectIntersecting.top == rectIntersecting.bottom) { // if width OR height are 0 it means no intersection between the two rect's
						// does not intersect, continue to next monitor

						continue;
					} else {

						// convert screen xy of rect to layer xy
						clone_aArrFuncArgs[aObjConvertScreenToLayer.x] = rectIntersecting.left - colMon[i].x;
						clone_aArrFuncArgs[aObjConvertScreenToLayer.y] = rectIntersecting.top - colMon[i].y;
						
						// adjust width and height, needed for multi monitor selection correction
						clone_aArrFuncArgs[aObjConvertScreenToLayer.w] = rectIntersecting.width;
						clone_aArrFuncArgs[aObjConvertScreenToLayer.h] = rectIntersecting.height;

					}
					// end - block link6587436215
				}
				
				var aCtxDim = colMon[i].E.ctxDim;


				aCtxDim[aStrFuncName].apply(aCtxDim, clone_aArrFuncArgs);
			} else {
				var aCtxDim = colMon[i].E.ctxDim;
				aCtxDim[aStrFuncName]();
			}
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

		if (aTopic == 'alertclickcallback')	{

			if (gNotifClickCallback[aData]) {
				gNotifClickCallback[aData]();
				delete gNotifClickCallback[aData];
			}
		} else if (aTopic == 'alertshow') {
			//gENotifPending[0].shown = true;
			var shown = gENotifPending.splice(0, 1);

			gNotifierStrRandomizer = gNotifierStrRandomizer == ' ' ? '' : ' ';
		} else if (aTopic == 'alertfinished') {

			if (gNotifClickCallback[aData]) {
				// user didnt click it

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

		if (gENotifPending.length > 0) {
			if (gENotifPending[0].aClickCookie !== null) {

				myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', justFormatStringFromName(core.addon.l10n.bootstrap['addon_name']) + ' - ' + gENotifPending[0].aTitle + gNotifierStrRandomizer, gENotifPending[0].aMsg, true, gENotifPending[0].aClickCookie, gENotifListener, 'NativeShot');
			} else {
				myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', justFormatStringFromName(core.addon.l10n.bootstrap['addon_name']) + ' - ' + gENotifPending[0].aTitle + gNotifierStrRandomizer, gENotifPending[0].aMsg, null, null, gENotifListener, 'NativeShot');
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
							NBs_updateGlobal_updateTwitterBtn(refUAPEntry, justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-but-not-signed-in']) + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-bad', 'focus-tab'); // :todo: framescript should open the login box, and on succesfull login it should notify all other tabs that were waiting for login, that login happend and they should reload. but if user logs into a non watched twitter tab, then i wont get that automated message
							
							
						break;
					case 'clientNotify_tweetClosedWithoutSubmit':
							
							var refUAPEntry = getUAPEntry_byUserAckId(aMsg.json.userAckId);
							for (var imgId in refUAPEntry.imgDatas) {
								refUAPEntry.imgDatas[imgId].attachedToTweet = false;
							}
							// set button to reopen tweet with attachments, which should just do fsComServer.twitter_IfFSReadyToAttach_sendNextUnattached()
							
							// NBs_updateGlobal_updateTwitterBtn(refUAPEntry, 'Tweet Dialog Closed - Twitter auto detached imgs - Click to reopen/reattach', 'nativeshot-twitter-bad', 'reopen-tweet-modal')
							NBs_updateGlobal_updateTwitterBtn(refUAPEntry, justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-but-dialog-closed']) + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-bad', 'reopen-tweet-modal');
							
						break;
					case 'clientNotify_signedInShowAwaitingMsg':
							
							var refUAPEntry = getUAPEntry_byUserAckId(aMsg.json.userAckId);
							NBs_updateGlobal_updateTwitterBtn(refUAPEntry, justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-user-tweet']) + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-neutral', 'focus-tab');
							
						break;
					case 'clientNotify_imgDeleted':
							
							// :todo: not yet set up as of sept 19 2015
							// when user clicks the x button from the tweet dialog
							var refUAPEntry = getUAPEntry_byUserAckId(aMsg.json.userAckId);
							delete refUAPEntry.imgDatas[aMsg.json.imgId];
							
						break;
					case 'clientNotify_clientUnregistered':
					

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
										
										switch (aMsg.json.unregReason) {
											case 'error-loading':
													
													// aMsg = 'Error loading Twitter - You may be offline - Click to open new tab and try again';
													aMsg = justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-but-error-loading']);
													
												break;
											case 'non-twitter-load':
											case 'twitter-page-unloaded':
													
													// aMsg = 'Navigated away from Twitter.com - Click to open new tab with Twitter';
													aMsg = justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-but-twitter-unloaded']);
													
												break;
											case 'tab-closed':
													
													// aMsg = 'Tab Closed - Click to reopen';
													aMsg = justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-but-tab-closed']);
													
												break;
											default:
												throw new Error('unrecongized uregReason in sub block - should never get here');
										}
										
										NBs_updateGlobal_updateTwitterBtn(refUAPEntry, aMsg + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-bad', 'open-new-tab');

										
									break;
								case 'tweet-success':
										
										refUAPEntry.tweeted = true;
										
										// set urls to userAckId so can offer clipboard										
										var other_info = aMsg.json.clips.other_info;
										delete aMsg.json.clips.other_info;
										
										refUAPEntry.tweetURL = TWITTER_URL + other_info.permlink.substr(1); // because permlink is preceded by slash
										

										
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
											NBs.crossWin[crossWinId].msg = justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-msg-imgs-tweeted']);
										}
										
										if (!aBtnInfo) {

											throw new Error('this should never happen');
										}
										
										// no need to delete aBtnInfo.actionOnBtn as its not type menu so it wont have any affect
										aBtnInfo.tweeted = true;
										// aBtnInfo.label = 'Successfully Tweeted - Image URLs Copied';
										aBtnInfo.label = justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-tweeted']) + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')';
										aBtnInfo.class = 'nativeshot-twitter-good';
										aBtnInfo.type = 'menu';
										aBtnInfo.popup = ['xul:menupopup', {},
															// ['xul:menuitem', {label:'Tweet URL', oncommand:copyTextToClip.bind(null, refUAPEntry.tweetURL, null) }] // :l10n:
															['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-menu-copy-tweet-link']), oncommand:copyTextToClip.bind(null, refUAPEntry.tweetURL, null) }]
														 ];

										var arrOfImgUrls = [];
										for (var imgId in refUAPEntry.imgDatas) {
											arrOfImgUrls.push(aMsg.json.clips[imgId]);
											// aBtnInfo.popup.push(['xul:menuitem', {label:'Image ' + arrOfImgUrls.length + ' URL', oncommand:copyTextToClip.bind(null, aMsg.json.clips[imgId], null)}]); // :l10n:
											aBtnInfo.popup.push(['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-menu-copy-single-image-link'], [arrOfImgUrls.length]), oncommand:copyTextToClip.bind(null, aMsg.json.clips[imgId] + TWITTER_IMG_SUFFIX, null)}]);
										}
										
										if (arrOfImgUrls.length > 1) {
											// aBtnInfo.popup.push(['xul:menuitem', {label:'All ' + arrOfImgUrls.length + ' Image URLs', oncommand:copyTextToClip.bind(null, arrOfImgUrls.join('\n'), null)}]); // :l10n:
											aBtnInfo.popup.push(['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-menu-copy-all-image-links'], [arrOfImgUrls.length]), oncommand:copyTextToClip.bind(null, arrOfImgUrls.join(TWITTER_IMG_SUFFIX + '\n') + TWITTER_IMG_SUFFIX, null)}]);
										}
										
										// copy all img urls to clipboard:
										copyTextToClip(arrOfImgUrls.join(TWITTER_IMG_SUFFIX + '\n') + TWITTER_IMG_SUFFIX);
										
										// get those uploaded urls
										// add in update to log file
										for (var i=0; i<arrOfImgUrls.length; i++) {
											addEntryToLog('twitter', {
												u: other_info.user_id,
												s: other_info.screen_name,
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

							
							fsComServer.twitter_IfFSReadyToAttach_sendNextUnattached(aMsg.json.userAckId);
							
						break;
					case 'clientResponse_imgAttached':
							
							
							
						break;
					case 'clientRequest_clientShutdownComplete':
							
							
							
						break;
					// start - devuser edit - add your personal message topics to listen to from clients
						
					// end - devuser edit - add your personal message topics to listen to from clients
					default:

				}
			} // else {

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

		if (refUAPEntry.FSReadyToAttach) {

			// its available to attach, so send it
			// check if any imgs are waiting to be attached
			for (var imgId in refUAPEntry.imgDatas) {

				if (!refUAPEntry.imgDatas[imgId].attachedToTweet) {
					// send command to client to attached
					refUAPEntry.FSReadyToAttach = false;

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

			// NBs_updateGlobal_updateTwitterBtn(refUAPEntry, 'Tweet dialog opened and images attached - awaiting user input', 'nativeshot-twitter-neutral', 'focus-tab'); // i can show this, but i am not showing "'Waiting to for progrmattic attach'" so not for right now, but i guess would be nice maybe, but maybe too much info
			NBs_updateGlobal_updateTwitterBtn(refUAPEntry, justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-user-tweet']) + ' (' + Object.keys(refUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-neutral', 'focus-tab'); // this is good, because if was found not signed in, then on signed in load it opens up and is waiting for attach, but needs user focus
		} else {

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

		throw new Error('could not find aUAPEntry with userAckId - should not happen i think');
	}
}
*/

//// start - button interaction with gEditor system AB system FHR system and OAuth system
// all data must be stored in the gEditorABData_* objects link947444544
var gEditorABData_Bar = {
	//	gEditor.sessionId: {
			// link8888776 - see this link for details on the keys
		// }
};
var gEditorABData_Btn = {
	//	some_generated_id: {
			// see link11114 for more info on keys
		// }
};
var gEditorABData_BtnId = 0;

function gEditorABData_setBtnState(aNewState) { // is binded to gEditorABData_Btn[gEditorABData_BtnId]
	// returns nothing
	// aNewState - keys are same as what goes in BtnRef

	for (var p in aNewState) {
		this.BtnRef[p] = aNewState[p];
	}
	
	// go through and find any bClick and replace it with the callback
	replaceClickNameWithClickCallback(this.BtnRef, this);
	
	// go through the menu items to see if any of them have a cClick
	if (this.BtnRef.bMenu) {
		iterMenuForNameToCbs(this.BtnRef.bMenu, this);
	}
	
	if (gEditorABData_Bar[this.sessionId].shown) {
		AB.setState(gEditorABData_Bar[this.sessionId].ABRef);
	}
	else { console.error('bar not yet shown') }
	
	// return gEditorABData_Btn[gEditorABData_BtnId];
}

function iterMenuForNameToCbs(jMenu, a_gEditorABData_BtnENTRY) {
	jMenu.forEach(function(jEntry, jIndex, jArr) {
		replaceClickNameWithClickCallback(jEntry, a_gEditorABData_BtnENTRY);
		if (jEntry.cMenu) {
			iterMenuForNameToCbs(jEntry.cMenu);
		}
	});
}

function replaceClickNameWithClickCallback(aObjEntryForRep, a_gEditorABData_BtnENTRY) {
	if (!aObjEntryForRep.bClick && !aObjEntryForRep.cClick) {
		return; // this has no click name
	}
	var keyClick = aObjEntryForRep.bClick ? 'bClick' : 'cClick';
	// if i ever change bClick or cClick to a func, it gets taken out, so i dont have to check if it changed or its type is string, because its type for sure is string, but i just do it to show my future self
	if (typeof(aObjEntryForRep[keyClick]) != 'string') {
		console.error('this should never ever happen, typeof is:', typeof(aObjEntryForRep[keyClick]));
		return;
	}
	
	var keyClickName = aObjEntryForRep[keyClick];
	var gEditorABData_BtnENTRY = this;
	aObjEntryForRep[keyClick] = function(sentByABAPI_doClose, sentByABAPI_browser) { gEditorABClickCallbacks_Btn[keyClickName].bind(this, a_gEditorABData_BtnENTRY, sentByABAPI_doClose, sentByABAPI_browser)() };
}

function gEditorABData_addBtn() { // is binded to gEditorABData_Bar[this.sessionId]
	// returns gEditorABData_Btn object for the added btn
	
	var cSessionId = this.sessionId;
	gEditorABData_BtnId++;
	gEditorABData_Btn[gEditorABData_BtnId] = { // link11114
		BtnRef: {}, // this is the react object for each btn, that is reference to what is within the react object of owning bar in gEditorABData_Bar
		// ABRef: this.ABRef, // so I can go AB.setState(.ABRef)
		sessionId: cSessionId, // so I can go AB.setState(gEditorABData_Bar[.sessionId]) - as having ABRef is causing a "TypeError: cyclic object value"
		btnId: gEditorABData_BtnId, // because of link888778 - so i can tell worker do work on this guy. and when worker needs, he can say to update this guy, and when worker needs, worker can fetch data from this guy
		// setBtnState: gEditorABData_setBtnState.bind(gEditorABData_Btn[gEditorABData_BtnId]), // obvious why this is needed // :todo: :learn: :verify: gEditorABData_Btn[gEditorABData_BtnId] isnt created at the time of this bind so lets see if it really binds to it not sure
		data: {}, // link947444544
		meta: {}, // holds meta data, like group of dropbox/twitter/gdrive/imgur etc. and other info to help work with this button
		getBtnFHR: gEditorABData_getBtnFhr.bind(null, gEditorABData_BtnId)
	};
	this.ABRef.aBtns.push(gEditorABData_Btn[gEditorABData_BtnId].BtnRef);
	gEditorABData_Btn[gEditorABData_BtnId].setBtnState = gEditorABData_setBtnState.bind(gEditorABData_Btn[gEditorABData_BtnId]);
	
	return gEditorABData_Btn[gEditorABData_BtnId];
}

function retryForBtnId(aBtnId, aServiceName) {
	// aServiceName is optional, if it is not provided it uses cBtnStore.meta.service
	
	var cBtnStore = gEditorABData_Btn[aBtnId];
	
	aServiceName = aServiceName ? aServiceName : cBtnStore.meta.service;
	if (!aServiceName) {
		// then this means cBtnStore.meta.service is undefined, this is a huge error
		console.error('should never happen deverror - then this means cBtnStore.meta.service is undefined, this is a huge error');
		throw new Error('should never happen')
	}
	
	
	cBtnStore.setBtnState({
		bTxt: 'Waiting...', // :l10n:
		bType: 'button',
		bIcon: core.addon.path.images + aServiceName + '16.png',
		bMenu: undefined
	});

	doServiceForBtnId(cBtnStore.btnId, aServiceName);
}

function gEditorABData_getBtnFhr(aBtnId) {
	// creates fhr for this btn if it doesnt have one. if it has one then it returns that
	// if created, it adds to the unloaders
	var cFHR;
	if (!gEditorABData_Btn[aBtnId].data.fhr) {
		cFHR = new FHR();
		gEditorABData_Btn[aBtnId].data.fhr = cFHR;
		gEditorABData_Bar[gEditorABData_Btn[aBtnId].sessionId].unloaders.push(function() {
			if (cFHR.destroy) { // test this, because it might have already been destroyed
				cFHR.destroy();
			} // else it was already destroyed
		});
	} else {
		cFHR = gEditorABData_Btn[aBtnId].data.fhr;
	}
	return cFHR;
}

var gEditorABClickCallbacks_Btn = { // each callback gets passed a param to its gEditorABData_Btn obj
	copy: function(gEditorABData_BtnENTRY, doClose, aBrowser) {
		// console.log('this:', this, 'gEditorABData_BtnENTRY:', gEditorABData_BtnENTRY, 'doClose:', doClose, 'aBrowser:', aBrowser);
		copyTextToClip(gEditorABData_BtnENTRY.data.copyTxt);
	},
	openInFinder: function(gEditorABData_BtnENTRY, doClose, aBrowser) {
		// console.log('this:', this, 'gEditorABData_BtnENTRY:', gEditorABData_BtnENTRY, 'doClose:', doClose, 'aBrowser:', aBrowser);
		var nsifileOfCopyTxt = new FileUtils.File(gEditorABData_BtnENTRY.data.copyTxt); // i can do this because for save-quick save-browse copyTxt is platform path
		showFileInOSExplorer(nsifileOfCopyTxt);
	},
	retry: function(gEditorABData_BtnENTRY, doClose, aBrowser) {
		// uses menudata if it is present, else it uses meta.action
		retryForBtnId(gEditorABData_BtnENTRY.btnId, (this.menuitem ? this.menuitem.menudata : undefined)); // if menudata is undefined, retryForBtnId uses cBtnStore.meta.action so retries itself
	},
	abort_autoretry_then_retry: function(gEditorABData_BtnENTRY, doClose, aBrowser) {
		// same as retry, but first it aborts
		gEditorABData_BtnENTRY.setBtnState({
			bTxt: 'Aborting...',
			bType: 'button',
			bMenu: undefined
		});
		gEditorABData_BtnENTRY.autoretryAborting = true; // set to true, and while true any updates via updateAttnBar are ignored
		var promise_abortAutoretry = MainWorker.post('abortAutoretryForBtnId', [gEditorABData_BtnENTRY.btnId]); // abort a autoretry in case one was in progress
		promise_abortAutoretry.then(function() {
			
			delete gEditorABData_BtnENTRY.autoretryAborting;
			
			// uses menudata if it is present, else it uses meta.action
			retryForBtnId(gEditorABData_BtnENTRY.btnId, (this.menuitem ? this.menuitem.menudata : undefined)); // if menudata is undefined, retryForBtnId uses cBtnStore.meta.action so retries itself
			
		});
	},
	focus_tab: function(gEditorABData_BtnENTRY, doClose, aBrowser) {
		var tabToFocus = gEditorABData_BtnENTRY.data.tabWk.get();
		tabToFocus.ownerDocument.defaultView.focus(); // focus browser window
		tabToFocus.ownerDocument.defaultView.gBrowser.selectedTab = tabToFocus; // focus tab
	},
	showerror: function(gEditorABData_BtnENTRY, doClose, aBrowser) {
		Services.prompt.alert(aBrowser.ownerDocument.defaultView, 'NativeShot - Error', BEAUTIFY().js(JSON.stringify(gEditorABData_BtnENTRY.data.errordets)));
	},
	pick_acct: function(gEditorABData_BtnENTRY, doClose, aBrowser) {
		// Services.prompt.alert(aBrowser.ownerDocument.defaultView, 'NativeShot - Pick Acct', JSON.stringify(this.menuitem.menudata));
		gEditorABData_BtnENTRY.setBtnState({
			bTxt: 'Waiting...',
			bType: 'button',
			bMenu: undefined
		});
		var promise_pickAcct = MainWorker.post('authorizeAppForBtnId', [gEditorABData_BtnENTRY.btnId, gEditorABData_BtnENTRY.meta.service, 'get_from_store_only_time_this_is_needed_is_for_multi_acct_picker', this.menuitem.menudata]);
		promise_pickAcct.then(
			function(aVal) { console.log('Fullfilled - promise_pickAcct - ', aVal) },
			genericReject.bind(null, 'promise_pickAcct', 0)
		).catch(genericCatch.bind(null, 'promise_pickAcct', 0));
	},
	none: function() {
		// used for removing a callback
	}
};
//// end - button interaction with gEditor system AB system FHR system and OAuth system
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
		gEResizing = false;
		gEOrigSelectedRect.setRect(0, 0, 0, 0);
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

		}
	},
	removeEventListener: function(keyNameInColMonE, evName, func, aBool) {
		for (var i=0; i<colMon.length; i++) {
			colMon[i].E[keyNameInColMonE].removeEventListener(evName, func, aBool);
		}
	},
	saveAsLastSelection: function() {
		// for use with repeatLastSelection
		// i save the last selection, if it was used for an action
		if (gESelected) {
			gESelectedRectLastLast = gESelectedRectLast;
			gESelectedRectLast = gESelectedRect.clone();
		}
	},
	repeatLastSelection: function() {
		console.log('gESelectedRect:', gESelectedRect);

		if (gESelectedRectLastLast || gESelectedRectLast) {
			var setAsSelected;
			if (gESelected) {
				if (gESelectedRect.equals(gESelectedRectLast)) {
					if (gESelectedRectLastLast) {
						setAsSelected = gESelectedRectLastLast;
					}
				} else {
					setAsSelected = gESelectedRectLast;
				}
				this.clearSelection();
			} else {
				setAsSelected = gESelectedRectLast;
			}
			
			if (setAsSelected) {
				gESelected = true;
				gESelectedRect = setAsSelected.clone();
				gCanDim.execFunc('clearRect', [gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height]);
			}
		}
	},
	moveSelection: function(dX, dY, by10) {
		if (!gESelected) {
			// console.log('no selection');
			return;
		}
		
		if (by10) {
			dX *= 10;
			dY *= 10;
		}
		
		gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		gCanDim.execFunc('fillRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		
		var gESelectedWidth = gESelectedRect.width;
		var gESelectedHeight = gESelectedRect.height;
		
		gESelectedRect.translate(dX, dY);
		
		gESelectedRect.width = gESelectedWidth;
		gESelectedRect.height = gESelectedHeight;
		
		gCanDim.execFunc('clearRect', [gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height], {x:0,y:1,w:2,h:3});
	},
	resizeSelection: function(dW, dH, by10) {
		// can never resize to 0
		if (!gESelected) {
			// console.log('no selection');
			return;
		}
		
		if (by10) {
			dW *= 10;
			dH *= 10;
		}
		
		gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		gCanDim.execFunc('fillRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		
		var gESelectedWidth = gESelectedRect.width;
		var gESelectedHeight = gESelectedRect.height;
		
		if (gESelectedWidth + dW > 0) {
			gESelectedRect.width += dW;
		}
		if (gESelectedHeight + dH > 0) {
			gESelectedRect.height += dH;
		}
		
		gCanDim.execFunc('clearRect', [gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height], {x:0,y:1,w:2,h:3});
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
			

					for (var i=0; i<colMon.length; i++) {
						gESelectedRect = gESelectedRect.union(colMon[i].rect);
					}
					gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']);
					
				break;
			case -1:
					iMon = parseInt(e.view.location.search.substr('?iMon='.length));

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

			var promise_fetchWin = ScreenshotWorker.post('getAllWin', [{
				getPid: true,
				getBounds: true,
				getTitle: true,
				filterVisible: true
			}])
			promise_fetchWin.then(
				function(aVal) {

					// start - do stuff here - promise_fetchWin

					gEditor.winArr = aVal;
					// Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(JSON.stringify(aVal)); // :debug:
					// end - do stuff here - promise_fetchWin
				},
				function(aReason) {
					var rejObj = {name:'promise_fetchWin', aReason:aReason};

					// deferred_createProfile.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promise_fetchWin', aCaught:aCaught};

					// deferred_createProfile.reject(rejObj);
				}
			);
		}
		
		gEditor.pendingWinSelect = true;
		gCanDim.execStyle('cursor', 'pointer');
		
	},
	compositeSelection: function() {
		// creates a canvas holding a composite of the current selection

		if (!gESelected) {
			throw new Error('no selection to composite!');
		}
		
		if (this.lastCompositedRect && this.lastCompositedRect.equals(gESelectedRect)) {

			return;
		}
		
		this.lastCompositedRect = gESelectedRect.clone();
		this.saveAsLastSelection();
		
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

				continue;
			} else {

				// convert screen xy of rect to layer xy
				rectIntersecting.left -= colMon[i].x;
				rectIntersecting.top -= colMon[i].y;

				// adjust width and height, needed for multi monitor selection correction
				rectIntersecting.right -= colMon[i].x;
				rectIntersecting.bottom -= colMon[i].y;
			}
			// end - mod of copied block link6587436215
			
			// this.canComp.style.position = 'fixed'; // :debug:


			this.ctxComp.putImageData(colMon[i].screenshot, colMon[i].x - this.lastCompositedRect.left, colMon[i].y - this.lastCompositedRect.top, rectIntersecting.left, rectIntersecting.top, rectIntersecting.width, rectIntersecting.height);
			
			//this.compDOMWindow.document.documentElement.querySelector('stack').appendChild(this.canComp); // :debug:
			

		}
	},
	closeOutEditor: function(e) {
		// if e.shiftKey then it doesnt do anything, else it closes it out and cleans up (in future maybe possibility to cache? maybe... so in this case would just hide window, but im thinking no dont do this)

		if (e.shiftKey) {

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
	borderSelection: function() {
		if (!gESelected) {
			// console.log('no selection');
			return;
		}
		
		// draw dashed border
		gCanDim.execFunc('beginPath');
		gCanDim.execFunc('translate', [0.5, 0.5]);
		gCanDim.execFunc('rect', [gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height]); // draw invisible rect for stroke
		gCanDim.execFunc('stroke');
		
		// gCanDim.execProp('strokeStyle', gDefAltStrokeStyle);
		// gCanDim.execFunc('setLineDash', [gDefAltLineDash]);
		// gCanDim.execFunc('stroke');
		gCanDim.execFunc('translate', [-0.5, -0.5]);
		
		// draw resize points/strokeStyle
		gCanDim.execFunc('beginPath');
		gCanDim.execProp('fillStyle', gDefResizePtStyle);
		gCanDim.execFunc('setLineDash', [[0]]);
		
		gCanDim.execFunc('rect', [gESelectedRect.left - gDefResizePtSize / 2, gESelectedRect.top - gDefResizePtSize / 2, gDefResizePtSize, gDefResizePtSize]); // top left
		gCanDim.execFunc('rect', [(gESelectedRect.left - gDefResizePtSize / 2) + (gESelectedRect.width / 2), gESelectedRect.top - gDefResizePtSize / 2, gDefResizePtSize, gDefResizePtSize]); // top center
		gCanDim.execFunc('rect', [(gESelectedRect.left - gDefResizePtSize / 2) + (gESelectedRect.width), gESelectedRect.top - gDefResizePtSize / 2, gDefResizePtSize, gDefResizePtSize]); // top right
		                  
		gCanDim.execFunc('rect', [gESelectedRect.left - gDefResizePtSize / 2, (gESelectedRect.top - gDefResizePtSize / 2) + (gESelectedRect.height / 2), gDefResizePtSize, gDefResizePtSize]); // middle left
		gCanDim.execFunc('rect', [(gESelectedRect.left - gDefResizePtSize / 2) + (gESelectedRect.width), (gESelectedRect.top - gDefResizePtSize / 2) + (gESelectedRect.height / 2), gDefResizePtSize, gDefResizePtSize]); // middle right
		                  
		gCanDim.execFunc('rect', [gESelectedRect.left - gDefResizePtSize / 2, (gESelectedRect.top - gDefResizePtSize / 2) + gESelectedRect.height, gDefResizePtSize, gDefResizePtSize]); // bottom left
		gCanDim.execFunc('rect', [(gESelectedRect.left - gDefResizePtSize / 2) + (gESelectedRect.width / 2), (gESelectedRect.top - gDefResizePtSize / 2) + gESelectedRect.height, gDefResizePtSize, gDefResizePtSize]); // bottom center
		gCanDim.execFunc('rect', [(gESelectedRect.left - gDefResizePtSize / 2) + (gESelectedRect.width), (gESelectedRect.top - gDefResizePtSize / 2)  + gESelectedRect.height, gDefResizePtSize, gDefResizePtSize]); // bottom right
		
		gCanDim.execFunc('fill');
		gCanDim.execFunc('translate', [0.5, 0.5]);
		gCanDim.execFunc('stroke');
		gCanDim.execFunc('translate', [-0.5, -0.5]);
		
		gCanDim.execFunc('beginPath');
		gCanDim.execFunc('setLineDash', [gDefLineDash]); // restore line dash style for next line dash
		gCanDim.execProp('fillStyle', gDefDimFillStyle); // set back to default dim fill color
		
	},
	setSelectionStyles: function() {
		// // clear out any drawings existing here
		// gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']);
		// gCanDim.execFunc('fillRect', [0, 0, '{{W}}', '{{H}}']);
		
		// save what ever previous styles user applied
		gCanDim.execFunc('save');
		
		// set "in selection" styles
		gCanDim.execProp('fillStyle', gDefDimFillStyle); // get default dim fill color
		gCanDim.execFunc('setLineDash', [gDefLineDash]);
		gCanDim.execProp('strokeStyle', gDefStrokeStyle);
		gCanDim.execProp('lineWidth', gDefLineWidth);
	},
	restorePreSelectionStyles: function() {
		gEditor.borderSelection();
		gCanDim.execFunc('restore');
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

		}
		if (!gNotifTimerRunning) {
			gENotifCallback.notify(gNotifTimer);
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
		
		gEditor.showNotif(justFormatStringFromName(core.addon.l10n.bootstrap['notif-title_clipboard-ok']), justFormatStringFromName(core.addon.l10n.bootstrap['notif-body_clipboard-ok']));
		
		addEntryToLog('copy');
		
		this.closeOutEditor(e);
	},
	sendToPrinter: function(e) {
		this.compositeSelection();
		if (!prefGet('print_preview')) {
			// print method link678321212
			var win = Services.wm.getMostRecentWindow('navigator:browser'); //Services.appShell.hiddenDOMWindow;
			var doc = win.document;
			var iframe = doc.createElementNS(NS_HTML, 'iframe');
			iframe.addEventListener('load', function() {
				iframe.removeEventListener('load', arguments.callee, true);


				gPostPrintRemovalFunc = function() {
					iframe.parentNode.removeChild(iframe);

					gPostPrintRemovalFunc = null;
				};
				iframe.contentWindow.addEventListener('afterprint', function() {
					// iframe.parentNode.removeChild(iframe);

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
		addEntryToLog('print');
		
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
					// label: justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-user-tweet'], [1]) + '-ID:' + refUAPEntry.userAckId, // :l10n:
					label: justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-user-tweet']) + ' (' + 1 + ')' + '-ID:' + refUAPEntry.userAckId,
					// label: 'Waiting to for progrmattic attach (1)-ID:' + refUAPEntry.userAckId,
					btn_id: refUAPEntry.userAckId,
					class: 'nativeshot-twitter-neutral',
					accessKey: 'T',
					callback: twitterNotifBtnCB.bind(null, refUAPEntry)
				});
			} else {
				NBs.crossWin[crossWinId] = {
					// msg: 'Images have been prepared for Tweeting. User interaction needed in order to complete:', // :l10n:
					msg: justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-msg-imgs-awaiting-user-action']),
					img: core.addon.path.images + 'twitter16.png',
					p: 6,
					btns: [{
						// label: 'Image Pending Tweet (1)-ID:' + refUAPEntry.userAckId,
						// label: 'Waiting to for progrmattic attach (1)-ID:' + refUAPEntry.userAckId,
						label: justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-user-tweet']) + ' (' + 1 + ')' + '-ID:' + refUAPEntry.userAckId,
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
			if (btnEntryInCrossWin.label.indexOf(justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-user-tweet'])) == 0) { // cuz page loads in bg before notif is shown, so if user is doing multi stuff, the btn may have been updated to "not signed in" error msg or something
				btnEntryInCrossWin.label = justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-user-tweet']) + ' (' + (refUAPEntry.imgDatasCount + 1) + ')' + '-ID:' + refUAPEntry.userAckId;
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
	ocr: function(e, serviceTypeStr) {
		// serviceTypeStr valid values
		//	gocr
		//	ocrad
		//	tesseract
		//	all


		
		this.compositeSelection();
		
		var cDOMWindow = gEditor.gBrowserDOMWindow;
		var cWidth = gEditor.canComp.width;
		var cHeight = gEditor.canComp.height;
			
		var serviceTypeFunc = {
			gocr: function(aByteArr, dontTransfer) {
				if (!bootstrap.GOCRWorker) {
					bootstrap.GOCRWorker = new PromiseWorker(core.addon.path.content + 'modules/gocr/GOCRWorker.js');
				}
				
				return GOCRWorker.post('readByteArr', [aByteArr, cWidth, cHeight], null, dontTransfer ? undefined : [aByteArr]);
			},
			ocrad: function(aByteArr, dontTransfer) {
				if (!bootstrap.OCRADWorker) {
					bootstrap.OCRADWorker = new PromiseWorker(core.addon.path.content + 'modules/ocrad/OCRADWorker.js');
				}
				
				return OCRADWorker.post('readByteArr', [aByteArr, cWidth, cHeight], null, dontTransfer ? undefined : [aByteArr]);
			},
			tesseract: function(aByteArr, dontTransfer) {
				if (!bootstrap.TesseractWorker) {
					bootstrap.TesseractWorker = new PromiseWorker(core.addon.path.content + 'modules/tesseract/TesseractWorker.js');
				}
				
				return TesseractWorker.post('readByteArr', [aByteArr, cWidth, cHeight], null, dontTransfer ? undefined : [aByteArr]);
			}
		};
		
		var cImgData = this.ctxComp.getImageData(0, 0, this.canComp.width, this.canComp.height);
		console.log('cImgData:', cImgData);
		gEditor.closeOutEditor(e);
		
		var promiseAllArr_ocr = [];
		var allArr_serviceTypeStr = [];
		if (serviceTypeStr == 'all') {
			for (var p in serviceTypeFunc) {
				promiseAllArr_ocr.push(serviceTypeFunc[p](cImgData.data.buffer, true));
				allArr_serviceTypeStr.push(p);
			}
		} else {
			promiseAllArr_ocr.push(serviceTypeFunc[serviceTypeStr](cImgData.data.buffer));
			allArr_serviceTypeStr.push(serviceTypeStr);
		}
		
		var promiseAll_ocr = Promise.all(promiseAllArr_ocr);
		promiseAll_ocr.then(
			function(aTxtArr) {
				console.log('Fullfilled - promiseAll_ocr - ', aTxtArr);
				cImgData = undefined; // when do all, we dont transfer, so it doesnt get neutered, so lets just do this, it might help it gc
				var alertStrArr = [];
				for (var i=0; i<allArr_serviceTypeStr.length; i++) {
					if (allArr_serviceTypeStr.length > 1) {
						// alertStrArr.push(allArr_serviceTypeStr[i] + ':');
						alertStrArr.push(core.addon.l10n.bootstrap['ocr_label_' + allArr_serviceTypeStr[i]]);
						alertStrArr.push();
						alertStrArr.push();
					}
					alertStrArr.push(aTxtArr[i]);
				}
				var alertStr = alertStrArr.join('\n');
				Services.prompt.alert(cDOMWindow, core.addon.l10n.bootstrap.ocr_results_title, alertStr); // :todo: hook this up to the notif-bar system once i rework it
				if (allArr_serviceTypeStr.length == 1) {
					copyTextToClip(alertStr, cDOMWindow);
				} else {
					var choices = [core.addon.l10n.bootstrap.ocr_opt_all];
					for (var i=0; i<allArr_serviceTypeStr.length; i++) {
						choices.push(core.addon.l10n.bootstrap['ocr_opt_' + allArr_serviceTypeStr[i]]);
					}
					var selectedChoiceIndex = {};
					var rez_select = Services.prompt.select(cDOMWindow, core.addon.l10n.bootstrap.ocr_choice_title, core.addon.l10n.bootstrap.ocr_choice_msg, choices.length, choices, selectedChoiceIndex)
					if (rez_select) {
						console.log('selectedChoiceIndex:', selectedChoiceIndex); // this is ```Object { value: 2 }```
						if (selectedChoiceIndex.value == 0) {
							copyTextToClip(alertStr, cDOMWindow);
							console.log('copied all to clip:', alertStr);
							for (var realServiceTypeStr in serviceTypeFunc) {
								addEntryToLog(realServiceTypeStr);
							}
						} else {
							copyTextToClip(aTxtArr[selectedChoiceIndex.value - 1], cDOMWindow);
							addEntryToLog(allArr_serviceTypeStr[selectedChoiceIndex.value - 1]);
							console.log('copied just ', selectedChoiceIndex.value, ' to clip:', aTxtArr[selectedChoiceIndex.value - 1]);
						}
					}
				}
			},
			genericReject.bind(null, 'promiseAll_ocr', 0)
		).catch(genericCatch.bind(null, 'promiseAll_ocr', 0));
		
		if (serviceTypeStr != 'all') {
			addEntryToLog(serviceTypeStr);
		}
	},
	uploadOauth: function(e, aOAuthService) {
		// aOAuthService - string
			// dropbox
			// gdrive
			// imgur
			// imguranon
			// etc see link64098756794556
			
		this.compositeSelection();
		
		var cDOMWindow = gEditor.gBrowserDOMWindow;
		var cSessionId = gEditor.sessionId; // sessionId is time of screenshot
		
		var cBtn = createNewBtnStore(cSessionId, aOAuthService);
		
		// var cDataUrl = this.canComp.toDataURL('image/png', '');
		// var cBlob;
		// var cArrBuf;
		var cWidth = gEditor.canComp.width;
		var cHeight = gEditor.canComp.height;
		
		(gEditor.canComp.toBlobHD || gEditor.canComp.toBlob).call(gEditor.canComp, function(b) {
			gEditor.closeOutEditor(e); // as i cant close out yet as i need this.canComp see line above this one: `(this.canComp.toBlobHD || this.canComp.toBlob).call(this.canComp, function(b) {`
			// cBlob = b;
			
			var r = Ci.nsIDOMFileReader ? Cc['@mozilla.org/files/filereader;1'].createInstance(Ci.nsIDOMFileReader) : new FileReader();
			r.onloadend = function() {
				// cArrBuf = r.result;
				cBtn.data.arrbuf = r.result; // link947444544
				cBtn.data.width = cWidth;
				cBtn.data.height = cHeight;
				
				doServiceForBtnId(cBtn.btnId, aOAuthService);
			};
			r.readAsArrayBuffer(b);
			
		}, 'image/png');

	}
};

function createNewBtnStore(aSessionId, aService) {
	var cBtn = gEditorABData_Bar[aSessionId].addBtn();
	cBtn.setBtnState({
		bTxt: 'Waiting...', // :l10n:
		bIcon: core.addon.path.images + aService + '16.png'
	});
	cBtn.meta.service = aService;
	return cBtn;
}

function doServiceForBtnId(aBtnId, aOAuthService) {
	// must have arrbuf or appropriate data in button data store object
		// if not provided, the service is calculated and set in the meta data
	
	var cBtnStore = gEditorABData_Btn[aBtnId];
	
	var cMethodForService;
	cBtnStore.meta.service = aOAuthService;
	switch (aOAuthService) { // link64098756794556
		case 'dropbox':
		case 'imgur':
		case 'gdrive':
		case 'imguranon':
			
				cMethodForService = 'uploadImgArrBufForBtnId';
			
			break;
		case 'save-quick':
		case 'save-browse':
			
				cMethodForService = 'saveToDiskImgArrBufForBtnId';
			
			break;
		case 'tineye':
		case 'google-images':
			
				cMethodForService = 'reverseSearchImgArrBufForBtnId';
			
			break;
		default:
			console.error('invalid aOAuthService:', aOAuthService);
			throw new Error('invalid aOAuthService!!');
	}
	cBtnStore.meta.action = cMethodForService;
	
	var promise_methodForService = MainWorker.post(cMethodForService, [cBtnStore.btnId, aOAuthService, cBtnStore.sessionId]); // link888778
	promise_methodForService.then(
		function(aVal) {
			console.log('Fullfilled - promise_methodForService - ', aVal);
		},
		genericReject.bind(null, 'promise_methodForService', 0)
	).catch(genericCatch.bind(null, 'promise_methodForService', 0));
}

function reverseSearchImgPlatPath(aBtnId, aServiceSearchUrl, aPlatPathToImg, aPostDataObj) {
	var cBtnStore = gEditorABData_Btn[aBtnId];
	
	var ansifileFieldFound = false;
	for (var aPostKey in aPostDataObj) {
		if (aPostDataObj[aPostKey] == '{{ansifile}}') {
			aPostDataObj[aPostKey] = new FileUtils.File(aPlatPathToImg);
			ansifileFieldFound = true;
			break;
		}
	}
	
	if (!ansifileFieldFound) { console.error('deverror, must have a field in aPostDataObj in where to place the nsi file, this field must be a string when sent from worker and should be {{ansifile}}'); throw new Error('deverror, must have a field in aPostDataObj in where to place the nsi file, this field must be a string when sent from worker and should be {{ansifile}}'); }
	console.log('aPostDataObj:', aPostDataObj);
	
	var tab = Services.wm.getMostRecentWindow('navigator:browser').gBrowser.loadOneTab(aServiceSearchUrl, {
		inBackground: false,
		postData: encodeFormData(aPostDataObj, 'iso8859-1')
	});
	
	cBtnStore.data.tabWk = Cu.getWeakReference(tab);

	MainWorkerMainThreadFuncs.updateAttnBar(aBtnId, {
		bTxt: 'Focus Tab', // :l10n:
		bClick: 'focus_tab',
		bType: 'menu-button',
		bMenu: [
			{
				cTxt: 'Retry',
				cClick: 'retry'
			},
			{
				cTxt: 'Retry with ' + (cBtnStore.meta.service == 'tineye' ? 'Google Images' : 'Tineye'),
				cClick: 'retry',
				menudata: (cBtnStore.meta.service == 'tineye' ? 'google-images' : 'tineye')
			}
		]
	});
}

var OCRADWorkerFuncs = {};
var GOCRWorkerFuncs = {};

function gEMouseMove(e) {
	var iMon; //var iMon = gIMonMouseDownedIn; //parseInt(e.view.location.search.substr('?iMon='.length)); // cant do this as on mouse move, user may not be over iMon they started in, so have to calc it
	var screenPoint = new Rect(e.screenX, e.screenY, 1, 1);
	for (var i=0; i<colMon.length; i++) {
		if (colMon[i].rect.contains(screenPoint)) {
			iMon = i;
			break;
		}
	}

	if (gESelecting) {
		var cEMMX = colMon[iMon].win81ScaleX ? Math.floor(colMon[iMon].x + ((e.screenX - colMon[iMon].x) * colMon[iMon].win81ScaleX)) : e.screenX;
		var cEMMY = colMon[iMon].win81ScaleY ? Math.floor(colMon[iMon].y + ((e.screenY - colMon[iMon].y) * colMon[iMon].win81ScaleY)) : e.screenY;
		// var cEMMX = e.screenX;
		// var cEMMY = e.screenY;
		

		var newW = cEMMX - gEMDX;
		var newH = e.shiftKey ? newW : cEMMY - gEMDY;
		
		gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		gCanDim.execFunc('fillRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
				
		if (newW && newH) {
			gESelected = true;
			if (newW < 0) {
				gESelectedRect.left = e.altKey ? gEMDX + (newW / 2) : gEMDX + newW;
				gESelectedRect.width = Math.abs(newW);
			} else {
				gESelectedRect.left = e.altKey ? gEMDX - (newW / 2) : gEMDX;
				gESelectedRect.width = newW;
			}
			if (newH < 0) {
				gESelectedRect.top = e.altKey ? gEMDY + (newH / 2) : gEMDY + newH;
				gESelectedRect.height = Math.abs(newH);
			} else {
				gESelectedRect.top = e.altKey ? gEMDY - (newH / 2) : gEMDY;
				gESelectedRect.height = newH;
			}
			//gESelectedRect.setRect(gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height); // no need

			gCanDim.execFunc('clearRect', [gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height], {x:0,y:1,w:2,h:3});
			
			// gCanDim.execFunc('translate', [0.5, 0.5]);
			// gCanDim.execFunc('rect', [gEMDX, gEMDY, newW, newH]); // draw invisible rect for stroke
			// gCanDim.execFunc('stroke');
			// gCanDim.execFunc('translate', [0, 0]);
		} else {
			gESelected = false;
		}
		
	} else if (gEMoving) {
		var cEMMX = colMon[iMon].win81ScaleX ? Math.floor(colMon[iMon].x + ((e.screenX - colMon[iMon].x) * colMon[iMon].win81ScaleX)) : e.screenX;
		var cEMMY = colMon[iMon].win81ScaleY ? Math.floor(colMon[iMon].y + ((e.screenY - colMon[iMon].y) * colMon[iMon].win81ScaleY)) : e.screenY;
		
		gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		gCanDim.execFunc('fillRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		
		
		gESelectedRect.left = gEMoving.left - (gEMDX - cEMMX);
		gESelectedRect.top = gEMoving.top - (gEMDY - cEMMY);
		
		gESelectedRect.width = gEMoving.width;
		gESelectedRect.height = gEMoving.height;
		
		gCanDim.execFunc('clearRect', [gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height], {x:0,y:1,w:2,h:3});

	} else if (gEResizing) {
		var cEMMX = colMon[iMon].win81ScaleX ? Math.floor(colMon[iMon].x + ((e.screenX - colMon[iMon].x) * colMon[iMon].win81ScaleX)) : e.screenX;
		var cEMMY = colMon[iMon].win81ScaleY ? Math.floor(colMon[iMon].y + ((e.screenY - colMon[iMon].y) * colMon[iMon].win81ScaleY)) : e.screenY;
		// var cEMMX = e.screenX;
		// var cEMMY = e.screenY;
		
		var newW = gEOrigSelectedRect.width;
		var newH = gEOrigSelectedRect.height;
		var resizedRect = gEOrigSelectedRect.clone();
		switch (gEResizing) {
			case 1:
			
					// ne
					// copy from ns
					var dMY = cEMMY - gEMDY;
					resizedRect.top = gEOrigSelectedRect.top + dMY;
					if (cEMMY <= gEOrigSelectedRect.bottom) {
						resizedRect.top = gEOrigSelectedRect.top + dMY;
						resizedRect.bottom = gEOrigSelectedRect.bottom;
					} else {
						resizedRect.top = gEOrigSelectedRect.bottom;
						resizedRect.bottom = gEOrigSelectedRect.bottom + (dMY - gEOrigSelectedRect.height);
					}
					// copy from - we
					var dMX = cEMMX - gEMDX;
					resizedRect.left = gEOrigSelectedRect.left + dMX;
					if (cEMMX <= gEOrigSelectedRect.right) {
						resizedRect.left = gEOrigSelectedRect.left + dMX;
						resizedRect.right = gEOrigSelectedRect.right;
					} else {
						resizedRect.left = gEOrigSelectedRect.right;
						resizedRect.right = gEOrigSelectedRect.right + (dMX - gEOrigSelectedRect.width);
					}
				break;
			case 2:
			
					// ns
					var dMY = cEMMY - gEMDY;
					resizedRect.top = gEOrigSelectedRect.top + dMY;
					if (cEMMY <= gEOrigSelectedRect.bottom) {
						resizedRect.top = gEOrigSelectedRect.top + dMY;
						resizedRect.bottom = gEOrigSelectedRect.bottom;
					} else {
						resizedRect.top = gEOrigSelectedRect.bottom;
						resizedRect.bottom = gEOrigSelectedRect.bottom + (dMY - gEOrigSelectedRect.height);
					}
				
				break;
			case 3:
			
					// nw
					// copy from ns
					var dMY = cEMMY - gEMDY;
					resizedRect.top = gEOrigSelectedRect.top + dMY;
					if (cEMMY <= gEOrigSelectedRect.bottom) {
						resizedRect.top = gEOrigSelectedRect.top + dMY;
						resizedRect.bottom = gEOrigSelectedRect.bottom;
					} else {
						resizedRect.top = gEOrigSelectedRect.bottom;
						resizedRect.bottom = gEOrigSelectedRect.bottom + (dMY - gEOrigSelectedRect.height);
					}
					// copy from ew
					var dMX = cEMMX - gEMDX;
					resizedRect.left = gEOrigSelectedRect.left + dMX;
					if (cEMMX >= gEOrigSelectedRect.left) {
						resizedRect.right = gEOrigSelectedRect.right + dMX;
						resizedRect.left = gEOrigSelectedRect.left;
					} else {
						resizedRect.right = gEOrigSelectedRect.left;
						resizedRect.left = gEOrigSelectedRect.left + (dMX + gEOrigSelectedRect.width);
					}
					
				break;
			case 4:
			
					// we - copy and replace all from ns
					var dMX = cEMMX - gEMDX;
					resizedRect.left = gEOrigSelectedRect.left + dMX;
					if (cEMMX <= gEOrigSelectedRect.right) {
						resizedRect.left = gEOrigSelectedRect.left + dMX;
						resizedRect.right = gEOrigSelectedRect.right;
					} else {
						resizedRect.left = gEOrigSelectedRect.right;
						resizedRect.right = gEOrigSelectedRect.right + (dMX - gEOrigSelectedRect.width);
					}
				
				break;
			case 5:
			
					// ew - copy and replace all from sn
					var dMX = cEMMX - gEMDX;
					resizedRect.left = gEOrigSelectedRect.left + dMX;
					if (cEMMX >= gEOrigSelectedRect.left) {
						resizedRect.right = gEOrigSelectedRect.right + dMX;
						resizedRect.left = gEOrigSelectedRect.left;
					} else {
						resizedRect.right = gEOrigSelectedRect.left;
						resizedRect.left = gEOrigSelectedRect.left + (dMX + gEOrigSelectedRect.width);
					}
				
				break;
			case 6:
			
					// sw
					// copy from sn
					var dMY = cEMMY - gEMDY;
					resizedRect.top = gEOrigSelectedRect.top + dMY;
					if (cEMMY >= gEOrigSelectedRect.top) {
						resizedRect.bottom = gEOrigSelectedRect.bottom + dMY;
						resizedRect.top = gEOrigSelectedRect.top;
					} else {
						resizedRect.bottom = gEOrigSelectedRect.top;
						resizedRect.top = gEOrigSelectedRect.top + (dMY + gEOrigSelectedRect.height);
					}
					// copy from we
					var dMX = cEMMX - gEMDX;
					resizedRect.left = gEOrigSelectedRect.left + dMX;
					if (cEMMX <= gEOrigSelectedRect.right) {
						resizedRect.left = gEOrigSelectedRect.left + dMX;
						resizedRect.right = gEOrigSelectedRect.right;
					} else {
						resizedRect.left = gEOrigSelectedRect.right;
						resizedRect.right = gEOrigSelectedRect.right + (dMX - gEOrigSelectedRect.width);
					}
					
				break;
			case 7:
			
					// sn
					var dMY = cEMMY - gEMDY;
					resizedRect.top = gEOrigSelectedRect.top + dMY;
					if (cEMMY >= gEOrigSelectedRect.top) {
						resizedRect.bottom = gEOrigSelectedRect.bottom + dMY;
						resizedRect.top = gEOrigSelectedRect.top;
					} else {
						resizedRect.bottom = gEOrigSelectedRect.top;
						resizedRect.top = gEOrigSelectedRect.top + (dMY + gEOrigSelectedRect.height);
					}
				
				break;
			case 8:
			
					// se
					// copy from sn
					var dMY = cEMMY - gEMDY;
					resizedRect.top = gEOrigSelectedRect.top + dMY;
					if (cEMMY >= gEOrigSelectedRect.top) {
						resizedRect.bottom = gEOrigSelectedRect.bottom + dMY;
						resizedRect.top = gEOrigSelectedRect.top;
					} else {
						resizedRect.bottom = gEOrigSelectedRect.top;
						resizedRect.top = gEOrigSelectedRect.top + (dMY + gEOrigSelectedRect.height);
					}
					// copy from ew
					var dMX = cEMMX - gEMDX;
					resizedRect.left = gEOrigSelectedRect.left + dMX;
					if (cEMMX >= gEOrigSelectedRect.left) {
						resizedRect.right = gEOrigSelectedRect.right + dMX;
						resizedRect.left = gEOrigSelectedRect.left;
					} else {
						resizedRect.right = gEOrigSelectedRect.left;
						resizedRect.left = gEOrigSelectedRect.left + (dMX + gEOrigSelectedRect.width);
					}
				
				break;
			default:
				// will never get here
		}

		gCanDim.execFunc('clearRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
		gCanDim.execFunc('fillRect', [0, 0, '{{W}}', '{{H}}']); // clear out previous cutout
				
		if (resizedRect.width && resizedRect.height) {
			gESelected = true;
			gESelectedRect.copyFrom(resizedRect);
			gCanDim.execFunc('clearRect', [gESelectedRect.left, gESelectedRect.top, gESelectedRect.width, gESelectedRect.height], {x:0,y:1,w:2,h:3});
		} else {
			gESelected = false;
		}
	}
	
	// e.preventDefault();
	// e.stopPropagation();
	// e.returnValue = false;
	// return false;
}
function gEMouseUp(e) {
	var iMon = parseInt(e.view.location.search.substr('?iMon='.length));

	if (gESelecting) {

		gESelecting = false;
		// gEditor.removeEventListener('DOMWindow', 'mousemove', gEMouseMove, false);
		colMon[gIMonMouseDownedIn].E.DOMWindow.removeEventListener('mousemove', gEMouseMove, false);
		gIMonMouseDownedIn = null;
		
		gEditor.restorePreSelectionStyles();
		
		
	} else if (gEMoving) {
		// gEditor.removeEventListener('DOMWindow', 'mousemove', gEMouseMove, false);
		colMon[gIMonMouseDownedIn].E.DOMWindow.removeEventListener('mousemove', gEMouseMove, false);
		gEMoving = false;
		gCanDim.execStyle('cursor', 'crosshair');
		gIMonMouseDownedIn = null;
		
		gEditor.restorePreSelectionStyles();
		
	} else if (gEResizing) {
		colMon[gIMonMouseDownedIn].E.DOMWindow.removeEventListener('mousemove', gEMouseMove, false);
		gEResizing = false;
		gEOrigSelectedRect.setRect(0, 0, 0, 0);
		gCanDim.execStyle('cursor', 'crosshair');
		gIMonMouseDownedIn = null;
		
		gEditor.restorePreSelectionStyles();
	}
	
	// e.preventDefault();
	// e.stopPropagation();
	// e.returnValue = false;
	// return false;
}
function gEMouseDown(e) {
	var iMon = parseInt(e.view.location.search.substr('?iMon='.length));




	if (e.button != 0) { return } // only repsond to primary click
	if (e.target.id != 'canDim') { return } // only repsond to primary click on canDim so this makes it ignore menu clicks etc
	
	var cEMDX = colMon[iMon].win81ScaleX ? colMon[iMon].x + ((e.screenX - colMon[iMon].x) * colMon[iMon].win81ScaleX) : e.screenX;
	var cEMDY = colMon[iMon].win81ScaleY ? colMon[iMon].y + ((e.screenY - colMon[iMon].y) * colMon[iMon].win81ScaleY) : e.screenY;

	
	// var cEMDX = e.screenX;
	// var cEMDY = e.screenY;
	

	
	// check if mouse downed on move selection hit box
	if (gEditor.pendingWinSelect) {
		gEditor.pendingWinSelect = false;
		gCanDim.execStyle('cursor', 'crosshair');
		

		
		var do_selWinAtPt = function() {
			if (gEditor.winArr) {
				// go through all windows in z order and draw sel around the window rect that contains cEMDX, cEMDY

				// Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(JSON.stringify(gEditor.winArr)) // :debug: console.log('remove on prod');
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

						gEditor.setSelectionStyles();
						
						gIMonMouseDownedIn = iMon;
						gESelecting = false;
						gESelected = true;
						
						gEMDX = cEMDX;
						gEMDY = cEMDY;
						
						gESelectedRect.setRect(gEditor.winArr[i].left, gEditor.winArr[i].top, gEditor.winArr[i].width, gEditor.winArr[i].height);
						gCanDim.execFunc('clearRect', [gEditor.winArr[i].left, gEditor.winArr[i].top, gEditor.winArr[i].width, gEditor.winArr[i].height], {x:0,y:1,w:2,h:3});
						
						gEditor.restorePreSelectionStyles();
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
		
	} else {
		if (gESelected) {
			// if user mouses down within selected area, then dont start new selection
			var cPoint = new Rect(cEMDX, cEMDY, 1, 1);
			
			// check if cPoint is in the resizePt rects
			
			gDefResizePtSize += 5; // make hit test easier for user + 1 for the stroke
			var resizePtRects = [
				new Rect(gESelectedRect.left - gDefResizePtSize / 2, gESelectedRect.top - gDefResizePtSize / 2, gDefResizePtSize, gDefResizePtSize), // top left
				new Rect((gESelectedRect.left - gDefResizePtSize / 2) + (gESelectedRect.width / 2), gESelectedRect.top - gDefResizePtSize / 2, gDefResizePtSize, gDefResizePtSize), // top center
				new Rect((gESelectedRect.left - gDefResizePtSize / 2) + (gESelectedRect.width), gESelectedRect.top - gDefResizePtSize / 2, gDefResizePtSize, gDefResizePtSize), // top right
				new Rect(gESelectedRect.left - gDefResizePtSize / 2, (gESelectedRect.top - gDefResizePtSize / 2) + (gESelectedRect.height / 2), gDefResizePtSize, gDefResizePtSize), // middle left
				new Rect((gESelectedRect.left - gDefResizePtSize / 2) + (gESelectedRect.width), (gESelectedRect.top - gDefResizePtSize / 2) + (gESelectedRect.height / 2), gDefResizePtSize, gDefResizePtSize), // middle right
				new Rect(gESelectedRect.left - gDefResizePtSize / 2, (gESelectedRect.top - gDefResizePtSize / 2) + gESelectedRect.height, gDefResizePtSize, gDefResizePtSize), // bottom left
				new Rect((gESelectedRect.left - gDefResizePtSize / 2) + (gESelectedRect.width / 2), (gESelectedRect.top - gDefResizePtSize / 2) + gESelectedRect.height, gDefResizePtSize, gDefResizePtSize), // bottom center
				new Rect((gESelectedRect.left - gDefResizePtSize / 2) + gESelectedRect.width, (gESelectedRect.top - gDefResizePtSize / 2)  + gESelectedRect.height, gDefResizePtSize, gDefResizePtSize) // bottom right
			];
			gDefResizePtSize -= 5;
			
			for (var i=0; i<8; i++) {
				if (resizePtRects[i].contains(cPoint)) {
					gEResizing = i + 1; // so i can just test `if (gEResizing)`
					// gEOrigSelectedRect.copyFrom(gESelectedRect);
					gEOrigSelectedRect = gESelectedRect.clone();
					gEMDX = cEMDX;
					gEMDY = cEMDY;
					gIMonMouseDownedIn = iMon;
					gEditor.setSelectionStyles();
					
					var resizeCursors = [
						'nw-resize',
						'ns-resize',
						'ne-resize',
						'ew-resize',
						'ew-resize',
						'ne-resize',
						'ns-resize',
						'nw-resize'
					];
					
					gCanDim.execStyle('cursor', resizeCursors[gEResizing - 1]);
					console.log('gEResizing:', gEResizing);
					colMon[gIMonMouseDownedIn].E.DOMWindow.addEventListener('mousemove', gEMouseMove, false);
					return;
				}
			}
			
			if (gESelectedRect.contains(cPoint)) {
				
				
				gEMDX = cEMDX;
				gEMDY = cEMDY;
				gIMonMouseDownedIn = iMon;
				
				
				gEditor.setSelectionStyles();
				
				gEMoving = gESelectedRect.clone();
				gCanDim.execStyle('cursor', 'move');
				colMon[gIMonMouseDownedIn].E.DOMWindow.addEventListener('mousemove', gEMouseMove, false);
				return; // he clicked within it, dont do anything
			}
		}
		
		gESelectedRect.setRect(0, 0, 0, 0);
		
		gESelecting = true;
		gESelected = false;
		
		gEMDX = cEMDX;
		gEMDY = cEMDY;
		
		gEditor.setSelectionStyles();
		
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

	var iMon = parseInt(e.currentTarget.location.search.substr('?iMon='.length));


	
	// close all other windows
	for (var i=0; i<colMon.length; i++) {
		colMon[i].E.DOMWindow.removeEventListener('unload', gEUnload, false);
		colMon[i].E.DOMWindow.close();
	}
	
	// as nativeshot_canvas windows are now closing. check if should show notification bar - if it has any btns then show it
	if (gEditorABData_Bar[gEditor.sessionId].ABRef.aBtns.length) {
		console.log('need to show notif bar now');
		gEditorABData_Bar[gEditor.sessionId].shown = true; // otherwise setBtnState will not update react states
		AB.setState(gEditorABData_Bar[gEditor.sessionId].ABRef);
	} else {
		// no need to show, delete it
		console.log('no need to show, delete it');
		delete gEditorABData_Bar[gEditor.sessionId];
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
	} else if ([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
		// left, up, right, down, arrow keys in this order
		gEditor.setSelectionStyles();
		switch (e.keyCode) {
			case 37:
					if (e.altKey) {
						gEditor.resizeSelection(-1, 0, e.shiftKey);
					} else {
						gEditor.moveSelection(-1, 0, e.shiftKey);
					}
				break;
			case 38:
					if (e.altKey) {
						gEditor.resizeSelection(0, 1, e.shiftKey);
					} else {
						gEditor.moveSelection(0, -1, e.shiftKey);
					}
				break;
			case 39:
					if (e.altKey) {
						gEditor.resizeSelection(1, 0, e.shiftKey);
					} else {
						gEditor.moveSelection(1, 0, e.shiftKey);
					}
				break;
			case 40:
					if (e.altKey) {
						gEditor.resizeSelection(0, -1, e.shiftKey);
					} else {
						gEditor.moveSelection(0, 1, e.shiftKey);
					}
				break;
			default:
				// will never get here
		}
		gEditor.restorePreSelectionStyles();
	}
	// else { console.log('e.keyCode:', e.keyCode); }
}

function gEPopupHiding(e) {
	// e.view.setTimeout(function() {
		// e.view.addEventListener('keyup', gEKeyUp, false);
	// }, 1000);

}

function gEPopupShowing(e) {
	//e.view.removeEventListener('keyup', gEKeyUp, false); // so if user hits escape while menu is open, esc will close out menu instead of editor. its ok to only do to current window, as if user clicks else where window it will close menu and the popuphiding adds the window close esc listener back
	if (gESelectedRectLastLast || gESelectedRectLast) {
		e.view.document.getElementById('repeatLastSelection').removeAttribute('hidden');
	} else {
		e.view.document.getElementById('repeatLastSelection').setAttribute('hidden', 'true');
	}
	
}
// end - canvas functions to act across all canvases
function obsHandler_nativeshotEditorLoaded(aSubject, aTopic, aData) {
	
	var iMon = aData; //parseInt(aEditorDOMWindow.location.search.substr('?iMon='.length)); // iMon is my rename of colMonIndex. so its the i in the collMoninfos object

	
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

	if (core.os.name != 'darwin') {
		aEditorDOMWindow.moveTo(colMon[iMon].x, colMon[iMon].y);
	}
	
	aEditorDOMWindow.focus();
	// if (core.os.name != 'darwin' && core.os.name != 'winnt') {
	if (core.os.name != 'darwin') {
		aEditorDOMWindow.fullScreen = true;
	}
	// if (core.os.name == 'winnt') {
		// aEditorDOMWindow.resizeTo(colMon[iMon].w, colMon[iMon].h);
	// }
	
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
		var promise_setWinAlwaysTop = ScreenshotWorker.post('setWinAlwaysOnTop', [aArrHwndPtr, aArrHwndPtrOsParams]);
		promise_setWinAlwaysTop.then(
			function(aVal) {

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

												
					var NSWindowPtr = ctypes.voidptr_t(ctypes.UInt64(NSWindowString));
					
					// var orderFrontRegardless = gMacTypes.sel_registerName('orderFrontRegardless');
					// var rez_orderFront = gMacTypes.objc_msgSend(NSWindowPtr, orderFrontRegardless, ctypes.long(aVal));

					
						var setLevel = gMacTypes.sel_registerName('setLevel:');
						gMacTypes.setLevel = setLevel;
						var rez_setLevel = gMacTypes.objc_msgSend(NSWindowPtr, setLevel, gMacTypes.NSInteger(aVal + 1)); // have to do + 1 otherwise it is ove rmneubar but not over the corner items. if just + 0 then its over menubar, if - 1 then its under menu bar but still over dock. but the interesting thing is, the browse dialog is under all of these  // link847455111

						
						var newSize = gMacTypes.NSSize(colMon[iMon].w, colMon[iMon].h);
						var rez_setContentSize = gMacTypes.objc_msgSend(NSWindowPtr, gMacTypes.sel_registerName('setContentSize:'), newSize);

						
						aEditorDOMWindow.moveTo(colMon[iMon].x, colMon[iMon].y); // must do moveTo after setContentsSize as that sizes from bottom left and moveTo moves from top left. so the sizing will change the top left.
						

					/*
					aEditorDOMWindow.setTimeout(function() {
							var NSSavePanel = gMacTypes.objc_getClass('NSSavePanel');
							var savePanel = gMacTypes.sel_registerName('savePanel');
							var aSavePanel = gMacTypes.objc_msgSend(NSSavePanel, savePanel);
							
							// var setFloatingPanel = gMacTypes.sel_registerName('setFloatingPanel:');
							// var rez_setFloatingPanel = gMacTypes.objc_msgSend(aSavePanel, setFloatingPanel, gMacTypes.YES);

							
							var rezFloatingPanel = gMacTypes.objc_msgSend(aSavePanel, setLevel, gMacTypes.NSInteger(3));

							
							var runModal = gMacTypes.sel_registerName('runModal')
							var rez_savepanel = gMacTypes.objc_msgSend(aSavePanel, runModal);

					}, 2000);
					*/
					
				}
				// end - do stuff here - promise_setWinAlwaysTop
			},
			function(aReason) {
				var rejObj = {name:'promise_setWinAlwaysTop', aReason:aReason};

				//deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_setWinAlwaysTop', aCaught:aCaught};

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

			// var rez_orderFront = gMacTypes.objc_msgSend(NSWindow, gMacTypes.sel_registerName('orderFrontRegardless'));

	
			var baseWindow = Services.wm.getMostRecentWindow('navigator:browser').QueryInterface(Ci.nsIInterfaceRequestor)
										  .getInterface(Ci.nsIWebNavigation)
										  .QueryInterface(Ci.nsIDocShellTreeItem)
										  .treeOwner
										  .QueryInterface(Ci.nsIInterfaceRequestor)
										  .getInterface(Ci.nsIBaseWindow);

			var NSWindowString = aHwndPtrStr; // baseWindow.nativeHandle;

			
			var aHwndPtrStr = aEditorDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
												.getInterface(Ci.nsIWebNavigation)
												.QueryInterface(Ci.nsIDocShellTreeItem)
												.treeOwner
												.QueryInterface(Ci.nsIInterfaceRequestor)
												.getInterface(Ci.nsIBaseWindow)
												.nativeHandle;

			var NSWindowString = aHwndPtrStr; // baseWindow.nativeHandle;

										
			var NSWindowPtr = ctypes.voidptr_t(ctypes.UInt64(NSWindowString));
			var orderFront = gMacTypes.sel_registerName('setLevel:');
			var rez_orderFront = gMacTypes.objc_msgSend(NSWindowPtr, orderFront, ctypes.long(3));

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
				
				if (colMon[iMon].win81ScaleX || colMon[iMon].win81ScaleY) { // 122315 - this is no longer just win81, this is also if on // priror to 122315 - win81+ has multi monitor dpi issue while firefox bug 890156 persists // http://stackoverflow.com/a/31500103/1828637 // https://bugzilla.mozilla.org/show_bug.cgi?id=890156
					var win81ScaleX = colMon[iMon].win81ScaleX;
					var win81ScaleY = colMon[iMon].win81ScaleY;
					if (win81ScaleX || win81ScaleY) {
						json.push(['html:canvas', {id:'canDum',style:'display:none;',width:w,height:h}]);
						w = Math.ceil(w / win81ScaleX);
						h = Math.ceil(h / win81ScaleY);

						
						json[2][1].width = w;
						json[2][1].height = h;
						json[2][1].style += 'position:fixed;';
						
						json[3][1].width = w;
						json[3][1].height = h;
						json[3][1].style += 'position:fixed;';
						

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
	

	if (win81ScaleX || win81ScaleY) {
		// rescaled for Win81 DPI non aware bug

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

	doc.documentElement.appendChild(jsonToDOM(get_gEMenuDomJson(), doc, menuElRef));

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

	}
	// }, 1000);
	// end - postStuff
}
// end - observer handlers

function shootAllMons(aDOMWindow) {
	
	gESelected = false;
	var openWindowOnEachMon = function() {
		gEditor.sessionId = new Date().getTime(); // in other words, this is time of screenshot of this session
		
		// notification bar stuff
		var cSessionId = gEditor.sessionId;
		gEditorABData_Bar[gEditor.sessionId] = { // link8888776
			ABRef: { // object for the bar used for state - so I can go AB.setState(.ABRef)
				aTxt: (new Date(gEditor.sessionId)).toLocaleString(),
				aPriority: 1,
				aIcon: core.addon.path.images + 'icon16.png',
				aClose: function() {
					var cUnloaders = gEditorABData_Bar[cSessionId].unloaders;
					for (var i=0; i<cUnloaders.length; i++) {
						cUnloaders[i]();
					}
					var thisBtnIds = gEditorABData_Bar[cSessionId].btnIds; // can yse gEditor.sessionId here as it uses live value apparently - bug fix from test result
					for (var i=0; i<thisBtnIds.length; i++) {
						delete gEditorABData_Btn[thisBtnIds[i]];
						MainWorker.post('deleteBtnStore', [thisBtnIds[i]]);
					}
					delete gEditorABData_Bar[cSessionId];
					// :todo: need to ensure that none of th workers are holding onto any data that was stored in gEditorABData_Bar or gEditorABData_Btn
				},
				aBtns: []
			},
			shown: false, // bool. set to true if AB.setState has been called. meaning if notification bar is shown.. also determines if setBtnState should call AB.setState
			btnIds: [], // array of generated ids found in gEditorABData_Btn // array of generated ids found in gEditorABData_Btn
			sessionId: gEditor.sessionId, // so i can group things togather per screenshot
			// addBtn: gEditorABData_addBtn.bind(gEditorABData_Bar[gEditor.sessionId]) // moved to link44444455 because this is not binding as the object hasnt been made yet
			unloaders: []
		};
		gEditorABData_Bar[gEditor.sessionId].addBtn = gEditorABData_addBtn.bind(gEditorABData_Bar[gEditor.sessionId]) // link44444455
		// end notification bar stuff
		
		gEditor.wasFirefoxWinFocused = isFocused(aDOMWindow);
		for (var i=0; i<colMon.length; i++) {
			var aEditorDOMWindow = Services.ww.openWindow(null, core.addon.path.content + 'panel.xul?iMon=' + i, '_blank', 'chrome,alwaysRaised,width=1,height=2,screenX=' + (core.os.name == 'darwin' ? (colMon[i].x + 1) : 1) + ',screenY=' + (core.os.name == 'darwin' ? (colMon[i].y + 1) : 1), null); // so for ubuntu i recall i had to set to 1x1 otherwise the resizeTo or something wouldnt work // now on osx if i set to 1x1 it opens up full available screen size, so i had to do 1x2 (and no matter what, resizeTo or By is not working on osx, if i try to 200x200 it goes straight to full avail rect, so im using ctypes on osx, i thought it might be i setLevel: first though but i tested it and its not true, it just wont work, that may be why resizeTo/By isnt working) // on mac because i size it first then moveTo, i think i have to move it to that window first, because otherwise it will be constrained to whatever monitor size i sized it on (i did + 1 just because i had issues with 0 0 on ubuntu so im thinking its safer)
			colMon[i].E = {
				DOMWindow: aEditorDOMWindow,
				docEl: aEditorDOMWindow.document.documentElement,
				doc: aEditorDOMWindow.document,
			};

		}
	};
	
	var promise_shoot = ScreenshotWorker.post('shootAllMons', []);
	promise_shoot.then(
		function(aVal) {

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
						['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_select-current-mon']), oncommand:gEditor.selectMonitor.bind(null, -1)}],
						['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_select-all-mon']), oncommand:gEditor.selectMonitor.bind(null, -2)}]
					]
				;
				for (var i=0; i<colMon.length; i++) {
					gEMenuArrRefs.select_fullscreen.push(
						['xul:menuitem', {label:justFormatStringFromName(core.addon.l10n.bootstrap['editor-menu_select-mon-n'], [i+1]), oncommand:gEditor.selectMonitor.bind(null, i)}]
					);
				}
			}
			
			openWindowOnEachMon();
			// end - do stuff here - promise_shoot
		},
		function(aReason) {
			var rejObj = {name:'promise_shoot', aReason:aReason};

			Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), justFormatStringFromName(core.addon.l10n.bootstrap['addon_name']) + ' - ' + justFormatStringFromName(core.addon.l10n.bootstrap['error-title_screenshot-internal']), justFormatStringFromName(core.addon.l10n.bootstrap['error-body_screenshot-internal']));
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_shoot', aCaught:aCaught};

			Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'NativeShot - Developer Error', 'Developer did something wrong in the code, see Browser Console.');
		}
	);
}

function twitterNotifBtnCB(aUAPEntry, aElNotification, aObjBtnInfo) {


	switch (aUAPEntry.actionOnBtn) {
		case 'show-clips-popup':
			

			
			break;
		case 'open-new-tab':

				// NBs_updateGlobal_updateTwitterBtn(aUAPEntry, 'Waiting to for progrmattic attach', 'nativeshot-twitter-neutral', 'focus-tab'); // not showing for right now, i think too much info

				NBs_updateGlobal_updateTwitterBtn(aUAPEntry, justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-user-tweet']) + ' (' + Object.keys(aUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-neutral', 'focus-tab');
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

				NBs_updateGlobal_updateTwitterBtn(aUAPEntry, justFormatStringFromName(core.addon.l10n.bootstrap['notif-bar_twitter-btn-imgs-awaiting-user-tweet']) + ' (' + Object.keys(aUAPEntry.imgDatas).length + ')', 'nativeshot-twitter-neutral', 'focus-tab');
				// need to focus for that paste event thingy work around
				var tab = aUAPEntry.tab.get();
				tab.ownerDocument.defaultView.focus(); // focus browser window
				tab.ownerDocument.defaultView.gBrowser.selectedTab = aUAPEntry.tab.get(); // focus tab
				fsComServer.twitter_focusContentWindow(aUAPEntry.userAckId); // focus content window
				fsComServer.twitter_IfFSReadyToAttach_sendNextUnattached(aUAPEntry.userAckId);
			
			break;
		case 'focus-tab':
		default:
			

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

					
					var allBtnsInfo = {};
					for (var i=0; i<cCrossWin.btns.length; i++) {
						var cBtnInfo = cCrossWin.btns[i];
						allBtnsInfo[cBtnInfo.btn_id] = {};
						for (var p in cBtnInfo) {
							allBtnsInfo[cBtnInfo.btn_id][p] = cBtnInfo[p];
						}
					}

					
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

		if (!btmDeckBox) {

		  btmDeckBox = aDOMDocument.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'notificationbox');
		  btmDeckBox.setAttribute('id', 'nativeshotDeck' + aGroupId);
		  // deck.parentNode.insertBefore(btmDeckBox, deck); // for top
		  deck.parentNode.appendChild(btmDeckBox); // for bottom
		} else {

		}

		var nb = btmDeckBox; //win.gBrowser.getNotificationBox(); //use _gNB for window level notification. use `win.gBrowser.getNotificationBox()` for tab level
		var n = btmDeckBox.getNotificationWithValue(aGroupId);


		if (n) {

		} else {
			
			var cNB;
			var notifCallback = function(what) {

				if (what == 'removed') {
					// btmDeckBox.removeNotification(cNB, false); // close just hides it, so we do removeNotification to remove it. otherwise if same groupid, nativeshot will find it already exists and then not create another one
					aDOMWindow.setTimeout(function() {
						btmDeckBox.parentNode.removeChild(btmDeckBox);
					}, 1000);
					if (aGroupId in NBs.crossWin) {
						NBs.closeGlobal(aGroupId);
					} else {

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
			domWinUtils.loadSheet(Services.io.newURI(core.addon.path.styles + 'cui.css', null, null), domWinUtils.AUTHOR_SHEET);
			
			for (aGroupId in NBs.crossWin) {
				NBs.insertGlobalToWin(aGroupId, aDOMWindow);
			}
		}/* else if (aDOMWindow.document.location.href == 'chrome://global/content/printProgress.xul') {

			if (!aDOMWindow.opener) {
				// this is my print window so lets set opener
				// for some reason whenever i do print() from hiddenDOMWindow iframe it doesnt get an opener
				// i have set opener this cuz window.opener is null so it doesnt close: `TypeError: opener is null printProgress.js:83:10`
				// as whenever i print from my hidden frame on link678321212 it opens the print dialog with opener set to null, and then it tries opener.focus() and it then leaves the window open
				// :todo: i should maybe target specifically my printer window, as if other people open up with opener null then i dont know if i should fix for them from here, but right now it is, and if opener ever is null then they'll run into that problem of window not closing (at least for me as tested on win81)

				//aDOMWindow.opener = Services.wm.getMostRecentWindow(null); // { focus: function() { } };

			}
		}*/
		
		contextMenuSetup(aDOMWindow);
		
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.removeSheet(Services.io.newURI(core.addon.path.styles + 'cui.css', null, null), domWinUtils.AUTHOR_SHEET);
		}
		
		contextMenuDestroy(aDOMWindow);
	}
};
/*end - windowlistener*/

// start - context menu items
var gToolbarContextMenu_domId = 'toolbar-context-menu';
var gCustomizationPanelItemContextMenu_domId = 'customizationPanelItemContextMenu';

var gDashboardMenuitem_domIdSuffix = '_nativeshot-menuitem';
var gDashboardSeperator_domIdSuffix = '_nativeshot-seperator';

var gDashboardMenuitem_jsonTemplate = ['xul:menuitem', {
	// id: 'toolbar-context-menu_nativeshot-menuitem',
	// label: justFormatStringFromName(core.addon.l10n.bootstrap['dashboard-menuitem']), // cant access myServices.sb till startup, so this is set on startup // link988888887
	class: 'menuitem-iconic',
	image: core.addon.path.images + 'icon16.png',
	hidden: 'true'
}];
var gDashboardMenuseperator_jsonTemplate = ['xul:menuseparator', {
	// id: 'toolbar-context-menu_nativeshot-menuseparator', // id is set when inserting into dom
	hidden: 'true'
}];

function contextMenuBootstrapStartup() {
	// because i cant access myServices.sb until bootstrap startup triggers i have to set these in here
	
	gDashboardMenuitem_jsonTemplate[1].label = justFormatStringFromName(core.addon.l10n.bootstrap['dashboard-menuitem']); // link988888887 - needs to go before windowListener is registered
	gDashboardMenuitem_jsonTemplate[1].onclick = `
		(function() {
			var cntTabs = gBrowser.tabs.length;
			for (var i=0; i<cntTabs; i++) {
				// e10s safe way to check content of tab
				if (gBrowser.tabs[i].getAttribute('label') == '${justFormatStringFromName(core.addon.l10n.bootstrap['nativeshot.app-main.title'])}') { // crossfile-link381787872 - i didnt link over there but &nativeshot.app-main.title; is what this is equal to
					gBrowser.selectedTab = gBrowser.tabs[i];
					return;
				}
			}
			var newNativeshotTab = gBrowser.loadOneTab(\'about:nativeshot\', {inBackground:false});
		})();
	`;
	
}

function contextMenuHiding(e) {
	// only triggered when it was shown due to right click on cui_nativeshot
	console.log('context menu hiding');
	
	e.target.removeEventListener('popuphiding', contextMenuHiding, false);
	
	var cToolbarContextMenu_dashboardMenuitem = e.target.querySelector('#' + gToolbarContextMenu_domId + gDashboardMenuitem_domIdSuffix);
	if (cToolbarContextMenu_dashboardMenuitem) {
		var cToolbarContextMenu_dashboardSeperator = e.target.querySelector('#' + gToolbarContextMenu_domId + gDashboardSeperator_domIdSuffix);
		cToolbarContextMenu_dashboardMenuitem.setAttribute('hidden', 'true');
		cToolbarContextMenu_dashboardSeperator.setAttribute('hidden', 'true');
	}
	
	var cCustomizationPanelItemContextMenu_dashboardMenuitem = e.target.querySelector('#' + gCustomizationPanelItemContextMenu_domId + gDashboardMenuitem_domIdSuffix);
	if (cCustomizationPanelItemContextMenu_dashboardMenuitem) {
		var cCustomizationPanelItemContextMenu_dashboardSeperator = e.target.querySelector('#' + gCustomizationPanelItemContextMenu_domId + gDashboardSeperator_domIdSuffix);			
		cCustomizationPanelItemContextMenu_dashboardMenuitem.setAttribute('hidden', 'true');
		cCustomizationPanelItemContextMenu_dashboardMenuitem.setAttribute('hidden', 'true');
	}
	
}

function contextMenuShowing(e) {
	console.log('context menu showing', 'popupNode:', e.target.ownerDocument.popupNode);
	
	var cPopupNode = e.target.ownerDocument.popupNode;
	if (cPopupNode.getAttribute('id') == 'cui_nativeshot') {
		
		var cToolbarContextMenu_dashboardMenuitem = e.target.querySelector('#' + gToolbarContextMenu_domId + gDashboardMenuitem_domIdSuffix);
		if (cToolbarContextMenu_dashboardMenuitem) {
			var cToolbarContextMenu_dashboardSeperator = e.target.querySelector('#' + gToolbarContextMenu_domId + gDashboardSeperator_domIdSuffix);
			cToolbarContextMenu_dashboardMenuitem.removeAttribute('hidden');
			cToolbarContextMenu_dashboardSeperator.removeAttribute('hidden');
			e.target.addEventListener('popuphiding', contextMenuHiding, false);
		}
		
		var cCustomizationPanelItemContextMenu_dashboardMenuitem = e.target.querySelector('#' + gCustomizationPanelItemContextMenu_domId + gDashboardMenuitem_domIdSuffix);
		if (cCustomizationPanelItemContextMenu_dashboardMenuitem) {
			var cCustomizationPanelItemContextMenu_dashboardSeperator = e.target.querySelector('#' + gCustomizationPanelItemContextMenu_domId + gDashboardSeperator_domIdSuffix);			
			cCustomizationPanelItemContextMenu_dashboardMenuitem.removeAttribute('hidden');
			cCustomizationPanelItemContextMenu_dashboardSeperator.removeAttribute('hidden');
			e.target.addEventListener('popuphiding', contextMenuHiding, false);
		}
		
	}
}

function contextMenuSetup(aDOMWindow) {
	// if this aDOMWindow has the context menus set it up
		
		
		
	var cToolbarContextMenu = aDOMWindow.document.getElementById(gToolbarContextMenu_domId);
	if (cToolbarContextMenu) {
		gDashboardMenuitem_jsonTemplate[1].id = gToolbarContextMenu_domId + gDashboardMenuitem_domIdSuffix;
		gDashboardMenuseperator_jsonTemplate[1].id = gToolbarContextMenu_domId + gDashboardSeperator_domIdSuffix;
		
		var cToolbarContextMenu_dashboardMenuitem = jsonToDOM(gDashboardMenuitem_jsonTemplate, aDOMWindow.document, {});
		var cToolbarContextMenu_dashboardSeperator = jsonToDOM(gDashboardMenuseperator_jsonTemplate, aDOMWindow.document, {});

			

		cToolbarContextMenu.insertBefore(cToolbarContextMenu_dashboardSeperator, cToolbarContextMenu.firstChild);
		cToolbarContextMenu.insertBefore(cToolbarContextMenu_dashboardMenuitem, cToolbarContextMenu.firstChild);
		
		cToolbarContextMenu.addEventListener('popupshowing', contextMenuShowing, false);
	}
	
	var cCustomizationPanelItemContextMenu = aDOMWindow.document.getElementById(gCustomizationPanelItemContextMenu_domId);
	if (cCustomizationPanelItemContextMenu) {
		
		gDashboardMenuitem_jsonTemplate[1].id = gCustomizationPanelItemContextMenu_domId + gDashboardMenuitem_domIdSuffix;
		gDashboardMenuseperator_jsonTemplate[1].id = gCustomizationPanelItemContextMenu_domId + gDashboardSeperator_domIdSuffix;
		
		var cCustomizationPanelItemContextMenu_dashboardMenuitem = jsonToDOM(gDashboardMenuitem_jsonTemplate, aDOMWindow.document, {});
		var cCustomizationPanelItemContextMenu_dashboardSeperator = jsonToDOM(gDashboardMenuseperator_jsonTemplate, aDOMWindow.document, {});

			

		cCustomizationPanelItemContextMenu.insertBefore(cCustomizationPanelItemContextMenu_dashboardSeperator, cCustomizationPanelItemContextMenu.firstChild);
		cCustomizationPanelItemContextMenu.insertBefore(cCustomizationPanelItemContextMenu_dashboardMenuitem, cCustomizationPanelItemContextMenu.firstChild);
		
		cCustomizationPanelItemContextMenu.addEventListener('popupshowing', contextMenuShowing, false);
	}
	
	// console.log('ok good setup');
}

function contextMenuDestroy(aDOMWindow) {
	// if this aDOMWindow has the context menus it removes it from it
	
	var cToolbarContextMenu = aDOMWindow.document.getElementById(gToolbarContextMenu_domId);
	if (cToolbarContextMenu) {
		var cToolbarContextMenu_dashboardMenuitem = aDOMWindow.document.getElementById(gToolbarContextMenu_domId + gDashboardMenuitem_domIdSuffix);
		var cToolbarContextMenu_dashboardSeperator = aDOMWindow.document.getElementById(gToolbarContextMenu_domId + gDashboardSeperator_domIdSuffix);
		
		cToolbarContextMenu.removeChild(cToolbarContextMenu_dashboardMenuitem);
		cToolbarContextMenu.removeChild(cToolbarContextMenu_dashboardSeperator);
		
		cToolbarContextMenu.removeEventListener('popupshowing', contextMenuShowing, false);
	}
	
	var cCustomizationPanelItemContextMenu = aDOMWindow.document.getElementById(gCustomizationPanelItemContextMenu_domId);	
	if (cCustomizationPanelItemContextMenu) {
		var cCustomizationPanelItemContextMenu_dashboardMenuitem = aDOMWindow.document.getElementById(gCustomizationPanelItemContextMenu_domId + gDashboardMenuitem_domIdSuffix);
		var cCustomizationPanelItemContextMenu_dashboardSeperator = aDOMWindow.document.getElementById(gCustomizationPanelItemContextMenu_domId + gDashboardSeperator_domIdSuffix);
		
		cCustomizationPanelItemContextMenu.removeChild(cCustomizationPanelItemContextMenu_dashboardMenuitem);
		cCustomizationPanelItemContextMenu.removeChild(cCustomizationPanelItemContextMenu_dashboardSeperator);
		
		cCustomizationPanelItemContextMenu.removeEventListener('popupshowing', contextMenuShowing, false);
	}
	
	// console.log('ok good destroyed');
	
}
// end - context menu items

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

// start - AttentionBar mixin
var AB = { // AB stands for attention bar
	// based on https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/notificationbox#Methods && https://dxr.mozilla.org/mozilla-central/source/toolkit/content/widgets/notification.xml#79
	Insts: {
		/*
		##: {
			state: avail in bootstrap only. the dom does a JSON.parse(JSON.stringify()) on this when updating from it
			setState: avail only in dom, its the react connection to it
			callbackids: {}, only in bootstrap, used for help cleaning up on destroy. key is id of callback, value is meaningless
		}
		*/
	}, // holds all instances
	domIdPrefix: core.addon.id.replace(/[^a-z0-9-_\:\.]/ig,'AB'), // The ID and NAME elements must start with a letter i.e. upper case A to Z or lower case a to z; a number is not allowed. After the first letter any number of letters (a to z, A to Z), digits (0 to 9), hyphens (-), underscores (_), colons (:) and periods (.) are allowed. // http://www.electrictoolbox.com/valid-characters-html-id-attribute/
	Callbacks: {},
	// key is nid, if nid is of a notification then the callback is a close callback, else it is of a click callback.
	// all Callbacks have last arg of aBrowser which is the xul browser element that was focused when user triggered the cb
	// click callbacks have first arg doClose, you should call doClose(aBrowser) if you want to close out the AB
	// callbacks this is bound to useful stuff. all are passed by reference so modifying that modfieis the entry in AB.Insts
		// for example clicking a menu item:
			// this: Object { inststate: Object, btn: Object, menu: Array[2], menuitem: Object } bootstrap.js:501
		// clicking btn, inst will have inststate and btn
		// closing this has inststate only
	nid: -1, // stands for next_id, used for main toolbar, and also for each button, and also each menu item
	/*
	{
		id: genned id, each id gets its own container in aDOMWindow
		desc: aDesc,
		comp: stands for react component, this gets rendered
	}
	*/
	setStateDestroy: function(aInstId) {
		// destroys, and cleans up, this does not worry about callbacks. the nonDevUserSpecifiedCloseCb actually calls this
		
		// unmount from all windows dom && delete from all windows js
		var doit = function(aDOMWindow) {
			// start - copy block link77728110
			if (!aDOMWindow.gBrowser) {
				return; // because i am targeting cDeck, windows without gBrowser won't have it
			}
			var winAB = aDOMWindow[core.addon.id + '-AB'];
			if (winAB) {
				if (aInstId in winAB.Insts) {
					// unmount this
					console.error('aInstId:', aInstId, 'notificationbox-' + aInstId + '--' + AB.domIdPrefix);
					var cNotificationBox = aDOMWindow.document.getElementById('notificationbox-' + aInstId + '--' + AB.domIdPrefix);
					aDOMWindow.ReactDOM.unmountComponentAtNode(cNotificationBox);
					cNotificationBox.parentNode.removeChild(cNotificationBox);
					delete winAB.Insts[aInstId];
				}
			}
			// end - copy block link77728110
		};
		
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				doit(aDOMWindow);
			}//  else { // not complete means its impossible it has this aInstId mounted in here
				// // aDOMWindow.addEventListener('load', function () {
				// // 	aDOMWindow.removeEventListener('load', arguments.callee, false);
				// // 	doit(aDOMWindow);
				// // }, false);
			//}
		}
		
		// delete callbacks
		for (var aCallbackId in AB.Insts[aInstId].callbackids) {
			delete AB.Callbacks[aCallbackId];
		}
		
		// delete from bootstrap js
		delete AB.Insts[aInstId];
	},
	setState: function(aInstState) { // :note: aInstState is really aInstStateState
		// this function will add to aInstState and all bts in aInstState.aBtns a id based on this.genId()
		// this function also sends setState message to all windows to update this instances
		// aInstState should be strings only, as it is sent to all windows
		
		// :note: to remove a callback you have to set it to an empty function - ```getScope().AB.Insts[0].state.aClose = function() {}; getScope().AB.setState(getScope().AB.Insts[0].state);```
		
		// RETURNS
			// updated aInstState

		
		var cInstDefaults = {
			// aId: this is auto added in
			aTxt: '', // this is the message body on the toolbar
			aPos: 0, // 1 for top, on where to append it
			aIcon: 'chrome://mozapps/skin/places/defaultFavicon.png', // icon on the toolbar
			aPriority: 1, // valid values 1-10
			aBtns: [], // must be array
			aHideClose: undefined, // if set to string 'true' or bool true, in dom it will get converted to string as 'true'. setting to 1 int will not work.
			aClose: undefined
		};
		
		/*
		aBtns: array of objects
		[
			{
				// bId - this is auto generated and stuck in here, with this.nid
				bIcon: optional, string to image path
				bTxt: required, text shown on button
				bKey: 'B', // access key
				bMenu: [
					{
						//mId: this is auto genned and added in here,
						mTxt: 'string'
					}
				]
			},
			{
				...
			}
		]
		*/
		
		if (!('aId' in aInstState)) {
			validateOptionsObj(aInstState, cInstDefaults);
			aInstState.aId = AB.genId();
			AB.Insts[aInstState.aId] = {
				state: aInstState,
				callbackids: {}
			};
			AB.Callbacks[aInstState.aId] = function(aBrowser) {
				AB.nonDevUserSpecifiedCloseCb(aInstState.aId, aBrowser); // this one doesnt need bind, only devuser callbacks are bound
			};
			AB.Insts[aInstState.aId].callbackids[aInstState.aId] = 1; // the close callback id
		}
		if (aInstState.aClose) {
			var aClose = aInstState.aClose.bind({inststate:aInstState});
			delete aInstState.aClose;
			
			AB.Callbacks[aInstState.aId] = function(aBrowser) {
				var rez_aClose = aClose(aBrowser);
				if (rez_aClose !== false) { // :note: if onClose returns false, it cancels the closing
					AB.nonDevUserSpecifiedCloseCb(aInstState.aId, aBrowser); // this one doesnt need bind, only devuser callbacks are bound
				}
			};
			
		}
		
		// give any newly added btns and menu items an id		
		if (aInstState.aBtns) {
			for (var i=0; i<aInstState.aBtns.length; i++) {
				if (!('bId' in aInstState.aBtns[i])) {
					aInstState.aBtns[i].bId = AB.genId();
				}
				if (aInstState.aBtns[i].bClick) { // i dont do this only if bId is not there, because devuser can change it up. i detect change by presenence of the bClick, because after i move it out of state obj and into callbacks obj, i delete it from state obj. so its not here unless changed
					AB.Insts[aInstState.aId].callbackids[aInstState.aBtns[i].bId] = 1; // its ok if it was already there, its the same one ill be removing
					AB.Callbacks[aInstState.aBtns[i].bId] = aInstState.aBtns[i].bClick.bind({inststate:aInstState, btn:aInstState.aBtns[i]}, AB.Callbacks[aInstState.aId]);
					delete aInstState.aBtns[i].bClick; // AB.Callbacks[aInstState.aId] is the doClose callback devuser should call if they want it to close out
				}
				if (aInstState.aBtns[i].bMenu) {
					AB.iterMenuForIdAndCbs(aInstState.aBtns[i].bMenu, aInstState.aId, aInstState.aBtns[i]);
				}
			}
		}
		
		// go through all windows, if this id is not in it, then mount it, if its there then setState on it
		
		var doit = function(aDOMWindow) {
			// start - orig block link181888888
			if (!aDOMWindow.gBrowser) {
				return; // because i am targeting cDeck, windows without gBrowser won't have it
			}
			AB.ensureInitedIntoWindow(aDOMWindow);
			
			if (aInstState.aId in aDOMWindow[core.addon.id + '-AB'].Insts) {
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInstState));
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].setState(JSON.parse(JSON.stringify(aInstState)));
			} else {
				// mount it
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId] = {};
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInstState));
				var cDeck = aDOMWindow.document.getElementById('content-deck');
				var cNotificationBox = aDOMWindow.document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'notificationbox');
				console.error('inserting', 'notificationbox-' + aInstState.aId + '--' + AB.domIdPrefix);
				cNotificationBox.setAttribute('id', 'notificationbox-' + aInstState.aId + '--' + AB.domIdPrefix);
				if (!aInstState.aPos) {
					cDeck.parentNode.appendChild(cNotificationBox);
				} else {
					cDeck.parentNode.insertBefore(cNotificationBox, cDeck); // for top
				}
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].relement = aDOMWindow.React.createElement(aDOMWindow[core.addon.id + '-AB'].masterComponents.Notification, aInstState);
				aDOMWindow.ReactDOM.render(aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].relement, cNotificationBox);
			}
			// end - orig block link181888888
		};
		
		// have to do this, because if i call setState with a new object, one that is not AB.Insts[aId] then it wont get updated, and when loadInstancesIntoWindow it will not have the updated one
		AB.Insts[aInstState.aId].state = aInstState;
		
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				doit(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					doit(aDOMWindow);
				}, false);
			}
		}
		
		return aInstState;
	},
	nonDevUserSpecifiedCloseCb: function(aInstId, aBrowser) {
		// this does the unmounting from all windows, and deletes entry from this.Insts
		
		// aBrowser.contentWindow.alert('ok this tab sent the close message for aInstId ' + aInstId);
		// on close go through and get all id's in there and remove all callbacks for it. and then unmount from all windows.
		AB.setStateDestroy(aInstId, true);
	},
	genId: function() {
		AB.nid++;
		return AB.nid;
	},
	iterMenuForIdAndCbs: function(jMenu, aCloseCallbackId, aBtnEntry) {
		// aCloseCallbackId is same as aInstId
		// aBtnArrEntry is reference as its the btn object in the .aBtns arr
		// goes through and gives every menuitem and submenu item (anything that has cTxt) an id, as they are clickable
		// ALSO moves cClick callbacks into AB.Callbacks
		jMenu.forEach(function(jEntry, jIndex, jArr) {
			if (!jEntry.cId && jEntry.cTxt) { // cId will NEVER be 0 but if it does it would be a problem with !jEntry.cId because first the notification bar is genId and the button is genId and nid starts at 0 so its at least 2 by first jMenu
				jEntry.cId = AB.genId();
				if (jEntry.cMenu) {
					AB.iterMenuForIdAndCbs(jEntry.cMenu, aCloseCallbackId, aBtnEntry);
				}
			}
			if (jEntry.cClick) { // i dont do this only if bId is not there, because devuser can change it up. i detect change by presenence of the bClick, because after i move it out of state obj and into callbacks obj, i delete it from state obj. so its not here unless changed
				AB.Insts[aCloseCallbackId].callbackids[jEntry.cId] = 1; // its ok if it was already there, its the same one ill be removing
				AB.Callbacks[jEntry.cId] = jEntry.cClick.bind({inststate:AB.Insts[aCloseCallbackId].state, btn:aBtnEntry, menu:jMenu, menuitem:jEntry}, AB.Callbacks[aCloseCallbackId]);
				delete jEntry.cClick; // AB.Callbacks[aInst.aId] is the doClose callback devuser should call if they want it to close out
			}
		});
	},
	uninitFromWindow: function(aDOMWindow) {
		if (!aDOMWindow[core.addon.id + '-AB']) {
			return;
		}
		console.error('doing uninit from window');
		// start - original block link77728110
		var winAB = aDOMWindow[core.addon.id + '-AB'];
		for (var aInstsId in winAB.Insts) {
			// unmount this
			console.error('aInstsId:', aInstsId, 'notificationbox-' + aInstsId + '--' + AB.domIdPrefix);
			var cNotificationBox = aDOMWindow.document.getElementById('notificationbox-' + aInstsId + '--' + AB.domIdPrefix);
			aDOMWindow.ReactDOM.unmountComponentAtNode(cNotificationBox);
			cNotificationBox.parentNode.removeChild(cNotificationBox);
		}
		// end - original block link77728110
		delete aDOMWindow[core.addon.id + '-AB'];
		console.error('done uninit');
	},
	ensureInitedIntoWindow: function(aDOMWindow) {
		// dont run this yoruself, ensureInstancesToWindow runs this. so if you want to run yourself, then run ensureInstancesToWindow(aDOMWindow)
		if (!aDOMWindow[core.addon.id + '-AB']) {
			aDOMWindow[core.addon.id + '-AB'] = {
				Insts: {},
				domIdPrefix: AB.domIdPrefix
			}; // ab stands for attention bar
			if (!aDOMWindow.React) {
				console.log('WILL NOW LOAD IN REACT');
				// resource://devtools/client/shared/vendor/react.js
				Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-with-addons.js?' + core.addon.cache_key, aDOMWindow); // even if i load it into aDOMWindow.blah and .blah is an object, it goes into global, so i just do aDOMWindow now
			}
			if (!aDOMWindow.ReactDOM) {
				console.log('WILL NOW LOAD IN REACTDOM');
				// resource://devtools/client/shared/vendor/react-dom.js
				Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-dom.js?' + core.addon.cache_key, aDOMWindow);
			}
			Services.scriptloader.loadSubScript(core.addon.path.scripts + 'ab-react-components.js?' + core.addon.cache_key, aDOMWindow);
		}
	},
	init: function() {
		Services.mm.addMessageListener(core.addon.id + '-AB', AB.msgListener);
		
		Services.wm.addListener(AB.winListener);
		
		// i dont iterate all windows now and do ensureInitedIntoWindow, because i only run ensureInitedIntoWindow when there is something to add, so its lazy
		
		// and its impossible that Insts exists before Init, so no need to iterate through all windows.
	},
	uninit: function() {
		Services.mm.removeMessageListener(core.addon.id + '-AB', AB.msgListener);
		
		Services.wm.removeListener(AB.winListener);
		
		// go through all windows and unmount
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow[core.addon.id + '-AB']) {
				AB.uninitFromWindow(aDOMWindow);
			}
		}
	},
	msgListener: {
		receiveMessage: function(aMsgEvent) {
			var aMsgEventData = aMsgEvent.data;
			console.error('getting aMsgEvent, data:', aMsgEventData);
			// this means trigger a callback with id aMsgEventData
			var cCallbackId = aMsgEventData;
			var cBrowser = aMsgEvent.target;
			if (AB.Callbacks[cCallbackId]) { // need this check because react components always send message on click, but it may not have a callback
				AB.Callbacks[cCallbackId](cBrowser);
			}
		}
	},
	loadInstancesIntoWindow: function(aDOMWindow) {
		// this function is called when there may be instances in AB.Insts but and it needs to be verified that its mounted in window
		// basically this is called when a new window is opened
		
		var idsInsts = Object.keys(AB.Insts);
		if (!idsInsts.length) {
			return;
		}
		
		var doit = function(aDOMWindow) {
			// check again, in case by the time window loaded, AB.Insts changed
			var idsInsts = Object.keys(AB.Insts);
			if (!idsInsts.length) {
				return;
			}
			
			// start - copy of block link181888888
			if (!aDOMWindow.gBrowser) {
				return; // because i am targeting cDeck, windows without gBrowser won't have it
			}

			AB.ensureInitedIntoWindow(aDOMWindow);

			for (var aInstId in AB.Insts) {
				var aInstState = AB.Insts[aInstId].state;
				if (aInstState.aId in aDOMWindow[core.addon.id + '-AB'].Insts) {
					console.error('this is really weird, it should never happen, as i only call this function when a new window opens');
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInstState));
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].setState(JSON.parse(JSON.stringify(aInstState)));
				} else {
					// mount it
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId] = {};
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInstState));
					var cDeck = aDOMWindow.document.getElementById('content-deck');
					var cNotificationBox = aDOMWindow.document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'notificationbox');
					console.error('inserting', 'notificationbox-' + aInstState.aId + '--' + AB.domIdPrefix);
					cNotificationBox.setAttribute('id', 'notificationbox-' + aInstState.aId + '--' + AB.domIdPrefix);
					if (!aInstState.aPos) {
						cDeck.parentNode.appendChild(cNotificationBox);
					} else {
						cDeck.parentNode.insertBefore(cNotificationBox, cDeck); // for top
					}
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].relement = aDOMWindow.React.createElement(aDOMWindow[core.addon.id + '-AB'].masterComponents.Notification, aInstState);
					aDOMWindow.ReactDOM.render(aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].relement, cNotificationBox);
				}
				// end - copy of block link181888888
			}
		};
		

		if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
			doit(aDOMWindow);
		} else {
			aDOMWindow.addEventListener('load', function () {
				aDOMWindow.removeEventListener('load', arguments.callee, false);
				doit(aDOMWindow);
			}, false);
		}
		
	},
	winListener: {
		onOpenWindow: function (aXULWindow) {
			// Wait for the window to finish loading
			var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
			aDOMWindow.addEventListener('load', function () {
				aDOMWindow.removeEventListener('load', arguments.callee, false);
				AB.loadInstancesIntoWindow(aDOMWindow);
			}, false);
		},
		onCloseWindow: function (aXULWindow) {},
		onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	}
};
// end - AttentionBar mixin

// start - MainWorkerMainThreadFuncs
var MainWorkerMainThreadFuncs = {
	callInPromiseWorker: function(aWorkerName, aArrOfFuncnameThenArgs) {
		// for use with sendAsyncMessageWithCallback from framescripts
		
		var mainDeferred_callInPromiseWorker = new Deferred();
		
		console.log('aWorkerName:', aWorkerName);
		console.log('aArrOfFuncnameThenArgs:', aArrOfFuncnameThenArgs);
		
		var rez_pwcall = BOOTSTRAP[aWorkerName].post(aArrOfFuncnameThenArgs.shift(), aArrOfFuncnameThenArgs);
		rez_pwcall.then(
			function(aVal) {
				console.log('Fullfilled - rez_pwcall - ', aVal);
				if (Array.isArray(aVal)) {
					mainDeferred_callInPromiseWorker.resolve(aVal);
				} else {
					mainDeferred_callInPromiseWorker.resolve([aVal]);
				}
			},
			function(aReason) {
				var rejObj = {
					name: 'rez_pwcall',
					aReason: aReason
				};
				console.error('Rejected - rez_pwcall - ', rejObj);
				mainDeferred_callInPromiseWorker.resolve([rejObj]);
			}
		).catch(
			function(aCaught) {
				var rejObj = {
					name: 'rez_pwcall',
					aCaught: aCaught
				};
				console.error('Caught - rez_pwcall - ', rejObj);
				mainDeferred_callInPromiseWorkerr.resolve([rejObj]);
			}
		);
		
		return mainDeferred_callInPromiseWorker.promise;
	},
	authorizeApp: function(aBtnId, aUrl, aCallbackSetName) {
		var deferredMain_authorizeApp = new Deferred();
		
		var promise_fhrResponse = (fhr_ifBtnIdNodata(aBtnId) || gEditorABData_Btn[aBtnId].getBtnFHR()).loadPage(aUrl, null, aCallbackSetName, null);
		promise_fhrResponse.then(
			function(aFHRResponse) {
				console.log('Fullfilled - promise_fhrResponse - ', aFHRResponse);
				deferredMain_authorizeApp.resolve([aFHRResponse]);
			},
			genericReject.bind(null, 'promise_fhrResponse', deferredMain_authorizeApp)
		).catch(genericCatch.bind(null, 'promise_fhrResponse', deferredMain_authorizeApp));
		
		return deferredMain_authorizeApp.promise;
	},
	clickAllow: function(aBtnId, aClickSetName, aCallbackSetName) {
		// clicks allow for authorizeApp
		
		var deferredMain_clickAllow = new Deferred();
	
		var promise_fhrResponse = (fhr_ifBtnIdNodata(aBtnId) || gEditorABData_Btn[aBtnId].getBtnFHR()).loadPage(null, aClickSetName, aCallbackSetName, null);
		promise_fhrResponse.then(
			function(aFHRResponse) {
				console.log('Fullfilled - promise_fhrResponse - ', aFHRResponse);
				deferredMain_clickAllow.resolve([aFHRResponse]);
			},
			genericReject.bind(null, 'promise_fhrResponse', deferredMain_clickAllow)
		).catch(genericCatch.bind(null, 'promise_fhrResponse', deferredMain_clickAllow));
		
		return deferredMain_clickAllow.promise;
	},
	clickPickAcct: function(aBtnId, aClickSetName, aCallbackSetName, aLoadPageData) {
		// aLoadPageData should be aMultiAcctPickInfo (which is acct entry for one of the multiple accts found) is an object that has three  keys, uid and screenname and domElId or domElSelector . :todo: consider putting in domElSelector or domElId
		var deferredMain_pickAccount = new Deferred();
	
		var promise_fhrResponse = (fhr_ifBtnIdNodata(aBtnId) || gEditorABData_Btn[aBtnId].getBtnFHR()).loadPage(null, aClickSetName, aCallbackSetName, aLoadPageData);
		console.error('promise_fhrResponse:', promise_fhrResponse);
		promise_fhrResponse.then(
			function(aFHRResponse) {
				console.log('Fullfilled - promise_fhrResponse - ', aFHRResponse);
				deferredMain_pickAccount.resolve([aFHRResponse]);
			},
			genericReject.bind(null, 'promise_fhrResponse', deferredMain_pickAccount)
		).catch(genericCatch.bind(null, 'promise_fhrResponse', deferredMain_pickAccount));
		
		return deferredMain_pickAccount.promise;
	},
	extractData: function(aBtnId, aDataKeysArr) {
		// takes a copy from btn data object and sends to worker
		// if the key contains "arrbuf" it is transferred to worker
		// aDataKeysArr is a bunch an array of keys for which you want from data to worker
		
		var cSendData = {};
		var cTransfers = [];
		
		var cBtnData = gEditorABData_Btn[aBtnId].data;
		
		for (var i=0; i<aDataKeysArr.length; i++) {
			
			var cKey = aDataKeysArr[i];
			
			cSendData[cKey] = cBtnData[cKey];
			
			if (cKey.indexOf('arrbuf') > -1) {
				cTransfers.push(cBtnData[cKey]);
				cBtnData[cKey] = 'TRANSFERED'; // i dont have to do this, i just do this in case i look for this and go nuts when things dont work. i remember in past i had an arrbuf but it was transfered and so byteLength was 0 and i didnt realize it and was going nuts
			}
			
		}
		
		if (cTransfers.length) {
			console.log('extracting with transfer');
			return [cSendData, cTransfers, SIP_TRANS_WORD];
		} else {
			console.log('extracting as all copies');
			return [cSendData];
		}
	},
	putToData: function(aBtnId, aDataObj) {
		// aDataObj is merged into btn data
		var cBtnData = gEditorABData_Btn[aBtnId].data;
		for (var p in aDataObj) {
			cBtnData[p] = aDataObj[p];
		}
		aDataObj = null;
		
		return ['ok'];
	},
	updateAttnBar: function(aBtnId, newBtnRefData) {
		// aId is the id of aABInfoObj
		// common keys in in newBtnRefData are added to the current BtnRef --- BtnRef is not set equal to newBtnRefData, hence the word "Data" in the param
		if(isBtnIdNoData(aBtnId)) {
			return false;
		}
		
		console.log('newBtnRefData:', newBtnRefData);
		
		var cBtnObj = gEditorABData_Btn[aBtnId];
		console.log('cBtnObj:', cBtnObj);
		
		if (cBtnObj.autoretryAborting) {
			// maybe a timeout message came through before the abort completed so ignore those
			return;
		}
		
		cBtnObj.setBtnState(newBtnRefData);		
	}
};
// end - MainWorkerMainThreadFuncs

var nodataBtnFhrs = {}; // key is nodataBtnId and value is the fhr
function fhr_ifBtnIdNodata(aBtnId) {
	if (typeof(aBtnId) == 'string' && aBtnId.indexOf('nodata:') === 0) {
		if (!nodataBtnFhrs[aBtnId]) {
			nodataBtnFhrs[aBtnId] = new FHR();
		}
		return nodataBtnFhrs[aBtnId];
	} else {
		return false;
	}
}

function destroy_nodataFhr(aNoDataBtnId) {
	nodataBtnFhrs[aNoDataBtnId].destroy();
	delete nodataBtnFhrs[aNoDataBtnId];
}
function isBtnIdNoData(aBtnId) {
	if (typeof(aBtnId) == 'string' && aBtnId.indexOf('nodata:') === 0) {
		return true;
	} else {
		return false;
	}
}
// start - main framescript communication - rev3 https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5
var fsFuncs = { // can use whatever, but by default its setup to use this
	callInPromiseWorker: function(aArrOfFuncnameThenArgs) {
		// for use with sendAsyncMessageWithCallback from framescripts
		
		var mainDeferred_callInPromiseWorker = new Deferred();
		
		var rez_pwcall = MainWorker.post(aArrOfFuncnameThenArgs.shift(), aArrOfFuncnameThenArgs);
		rez_pwcall.then(
			function(aVal) {
				console.log('Fullfilled - rez_pwcall - ', aVal);
				if (Array.isArray(aVal)) {
					mainDeferred_callInPromiseWorker.resolve(aVal);
				} else {
					mainDeferred_callInPromiseWorker.resolve([aVal]);
				}
			},
			function(aReason) {
				var rejObj = {
					name: 'rez_pwcall',
					aReason: aReason
				};
				console.error('Rejected - rez_pwcall - ', rejObj);
				mainDeferred_callInPromiseWorker.resolve([rejObj]);
			}
		).catch(
			function(aCaught) {
				var rejObj = {
					name: 'rez_pwcall',
					aCaught: aCaught
				};
				console.error('Caught - rez_pwcall - ', rejObj);
				mainDeferred_callInPromiseWorkerr.resolve([rejObj]);
			}
		);
		
		return mainDeferred_callInPromiseWorker.promise;
	},
	callInBootstrap: function(aArrOfFuncnameThenArgs) {
		// for use with sendAsyncMessageWithCallback from framescripts
		
		var mainDeferred_callInBootstrap = new Deferred();
		
		var cBootMethod = aArrOfFuncnameThenArgs.shift();
		if (!(cBootMethod in BOOTSTRAP)) {
			console.error('method is not in bootstrap! cBootMethod:', cBootMethod);
			throw new Error('method is not in bootstrap!');
		}
		var rez_pwcall = BOOTSTRAP[cBootMethod].apply(null, aArrOfFuncnameThenArgs);
		if (rez_pwcall && rez_pwcall.constructor.name == 'Promise') { // rez_pwcall may be undefined if it didnt return a promise
			rez_pwcall.then(
				function(aVal) {
					console.log('Fullfilled - rez_pwcall - ', aVal);
					if (Array.isArray(aVal)) {
						mainDeferred_callInBootstrap.resolve(aVal);
					} else {
						mainDeferred_callInBootstrap.resolve([aVal]);
					}
				},
				function(aReason) {
					var rejObj = {
						name: 'rez_pwcall',
						aReason: aReason
					};
					console.error('Rejected - rez_pwcall - ', rejObj);
					mainDeferred_callInBootstrap.resolve([rejObj]);
				}
			).catch(
				function(aCaught) {
					var rejObj = {
						name: 'rez_pwcall',
						aCaught: aCaught
					};
					console.error('Caught - rez_pwcall - ', rejObj);
					mainDeferred_callInBootstrapr.resolve([rejObj]);
				}
			);
		} else {
			if (Array.isArray(rez_pwcall)) {
				mainDeferred_callInBootstrap.resolve(rez_pwcall);
			} else {
				mainDeferred_callInBootstrap.resolve([rez_pwcall]);
			}
		}
		
		return mainDeferred_callInBootstrap.promise;
	}
};

MainWorkerMainThreadFuncs.callInBootstrap = fsFuncs.callInBootstrap;
// MainWorkerMainThreadFuncs.callInBootstrap = fsFuncs.callInPromiseWorker;

var fsMsgListener = {
	funcScope: fsFuncs,
	receiveMessage: function(aMsgEvent) {
		var aMsgEventData = aMsgEvent.data;
		console.log('fsMsgListener getting aMsgEventData:', aMsgEventData, 'aMsgEvent:', aMsgEvent);
		// aMsgEvent.data should be an array, with first item being the unfction name in bootstrapCallbacks
		
		var callbackPendingId;
		if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
			callbackPendingId = aMsgEventData.pop();
		}
		
		aMsgEventData.push(aMsgEvent); // this is special for server side, so the function can do aMsgEvent.target.messageManager to send a response
		
		var funcName = aMsgEventData.shift();
		if (funcName in this.funcScope) {
			var rez_parentscript_call = this.funcScope[funcName].apply(null, aMsgEventData);
			
			if (callbackPendingId) {
				// rez_parentscript_call must be an array or promise that resolves with an array
				if (rez_parentscript_call.constructor.name == 'Promise') {
					rez_parentscript_call.then(
						function(aVal) {
							// aVal must be an array
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, aVal]);
						},
						function(aReason) {
							console.error('aReject:', aReason);
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aReason]]);
						}
					).catch(
						function(aCatch) {
							console.error('aCatch:', aCatch);
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aCatch]]);
						}
					);
				} else {
					// assume array
					aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, rez_parentscript_call]);
				}
			}
		}
		else { console.warn('funcName', funcName, 'not in scope of this.funcScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out
		
	}
};
// end - main framescript communication

function install() {}
function uninstall(aData, aReason) {
	// delete imgur history file
	if (aReason == ADDON_UNINSTALL) {
		Services.prefs.clearUserPref(core.addon.prefbranch + 'quick_save_dir');
		Services.prefs.clearUserPref(core.addon.prefbranch + 'print_preview');
	}
}

function startup(aData, aReason) {
	// core.addon.aData = aData;
	extendCore();
	
	// start - add stuff to core that worker cannot get
	
	// end - add stuff to core that worker cannot get
	
	SIPWorker('ScreenshotWorker', core.addon.path.content + 'modules/screenshot/ScreenshotWorker.js'); // if want instant init, tag on .post() and it will return a promise resolving with value from init

	var do_afterWorkerInit = function(aInitedCore) {
		
		core = aInitedCore;
		
		CustomizableUI.createWidget({
			id: 'cui_nativeshot',
			defaultArea: CustomizableUI.AREA_NAVBAR,
			label: justFormatStringFromName(core.addon.l10n.bootstrap['cui_nativeshot_lbl']),
			tooltiptext: justFormatStringFromName(core.addon.l10n.bootstrap['cui_nativeshot_tip']),
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
		
		contextMenuBootstrapStartup();
		
		//windowlistener more
		windowListener.register();
		//end windowlistener more
		
		//start observers stuff more
		for (var o in observers) {
			observers[o].reg();
		}
		//end observers stuff more
		
		initAndRegisterAboutNativeShot();
		
		AB.init();
		
		Services.mm.addMessageListener(core.addon.id, fsMsgListener);
	};
	
	var do_afterPrefsInit = function() {
		var promise_getInit = SIPWorker('MainWorker', core.addon.path.content + 'modules/main/MainWorker.js', core, MainWorkerMainThreadFuncs).post();
		promise_getInit.then(
			function(aVal) {
				console.log('Fullfilled - promise_getInit - ', aVal);
				do_afterWorkerInit(aVal);
			},
			genericReject.bind(null, 'promise_getInit', 0)
		).catch(genericCatch.bind(null, 'promise_getInit', 0));
	};
	
	// set stuff in core, as it is sent to worker
	core.addon.version = aData.version;
	var promise_initPrefs = refreshCoreForPrefs();
	
	
	promise_initPrefs.then(
		function(aVal) {
			console.log('Fullfilled - promise_initPrefs - ', aVal);
			do_afterPrefsInit();
		},
		genericReject.bind(null, 'promise_initPrefs', 0)
	).catch(genericCatch.bind(null, 'promise_initPrefs', 0));
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }
	
	try {
		myServices.mm.removeMessageListener(core.addon.id, fsComServer.twitterClientMessageListener); // in case its still alive which it very well could be, because user may disable during tweet process // :todo: should probably clear all notfication bars maybe
	} catch (ignore) {}
	
	CustomizableUI.destroyWidget('cui_nativeshot');
	
	AB.uninit();
	
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
	
	// destroy workers
	if (ScreenshotWorker && ScreenshotWorker.launchTimeStamp) { // as when i went to rev5, its not insantly inited, so there is a chance that it doesnt need terminate
		ScreenshotWorker._worker.terminate();
	}
	if (MainWorker && MainWorker.launchTimeStamp) {
		MainWorker._worker.terminate();
	}

	if (bootstrap.GOCRWorker) {
		GOCRWorker._worker.terminate();
	}
	
	if (bootstrap.OCRADWorker) {
		OCRADWorker._worker.terminate();
	}
	
	// destroy any FHR's that the devuser did not clean up
	for (var DSTR_I=0; DSTR_I<gFHR.length; DSTR_I++) {
		if (gFHR[DSTR_I].destroy) {
			console.log('destroying gFHR DSTR_I:', DSTR_I);
			gFHR[DSTR_I].destroy();
			console.log('DSTR_I after destroy:', DSTR_I);
			DSTR_I--; // because .destroy splices it out of gFHR i do a .forEach, otherwise i have to do i--. but .destroy uses i so im worried theres scoping issues here so i switched to DSTR_I
		}
	}
	
	Services.mm.removeMessageListener(core.addon.id, fsMsgListener);
}

// start - custom addon functionalities
function openRelatedTab(aUrl) {
	Services.wm.getMostRecentWindow('navigator:browser').gBrowser.loadOneTab(aUrl, {
		inBackground: false,
		relatedToCurrent: true
	});
}

// rev3 - https://gist.github.com/Noitidart/feeec1776c6ee4254a34
function showFileInOSExplorer(aNsiFile, aDirPlatPath, aFileName) {
	// can pass in aNsiFile
	if (aNsiFile) {
		//http://mxr.mozilla.org/mozilla-release/source/browser/components/downloads/src/DownloadsCommon.jsm#533
		// opens the directory of the aNsiFile
		
		if (aNsiFile.isDirectory()) {
			aNsiFile.launch();
		} else {
			aNsiFile.reveal();
		}
	} else {
		var cNsiFile = new FileUtils.File(aDirPlatPath);
		
		if (!aFileName) {
			// its a directory
			cNsiFile.launch();
		} else {
			cNsiFile.append(aFileName);
			cNsiFile.reveal();
		}
	}
}

function browseFile(aDialogTitle, aOptions={}) {
	// uses xpcom file browser and returns path to file selected
	// returns
		// filename
		// if aOptions.returnDetails is true, then it returns object with fields:
		//	{
		//		filepath: string,
		//		replace: bool, // only set if mode is modeSave
		//	}
	
	var cOptionsDefaults = {
		mode: 'modeOpen', // modeSave, modeGetFolder,
		filters: undefined, // else an array. in sets of two. so one filter would be ['PNG', '*.png'] or two filters woul be ['PNG', '*.png', 'All Files', '*']
		startDirPlatPath: undefined, // string - platform path to dir the dialog should start in
		returnDetails: false,
		async: false // if set to true, then it wont block main thread while its open, and it will also return a promise
	}
	
	validateOptionsObj(aOptions, cOptionsDefaults);
	
	var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
	
	fp.init(Services.wm.getMostRecentWindow(null), aDialogTitle, Ci.nsIFilePicker[aOptions.mode]);
	
	if (aOptions.filters) {
		for (var i=0; i<aOptions.filters.length; i=i+2) {
			fp.appendFilter(aOptions.filters[i], aOptions.filters[i+1]);
		}
	}
	
	if (aOptions.startDirPlatPath) {
		fp.displayDirectory = new FileUtils.File(aOptions.startDirPlatPath);
	}
	
	var fpDoneCallback = function(rv) {
		var retFP;
		if (rv == Ci.nsIFilePicker.returnOK || rv == Ci.nsIFilePicker.returnReplace) {
			
			if (aOptions.returnDetails) {
				var cBrowsedDetails = {
					filepath: fp.file.path
				};
				
				if (aOptions.mode == 'modeSave') {
					cBrowsedDetails.replace = (rv == Ci.nsIFilePicker.returnReplace);
				}
				
				retFP = cBrowsedDetails;
			} else {
				retFP = fp.file.path;
			}

		}// else { // cancelled	}
		if (aOptions.async) {
			console.error('async resolving');
			mainDeferred_browseFile.resolve(retFP);
		} else {
			return retFP;
		}
	}
	
	if (aOptions.async) {
		var mainDeferred_browseFile = new Deferred();
		fp.open({
			done: fpDoneCallback
		});
		return mainDeferred_browseFile.promise;
	} else {
		return fpDoneCallback(fp.show());
	}
}

function macSetLevelOfBrowseFile() {
	// can use gMacTypes.setLevel and gMacTypes.NSMainMenuWindowLevel because this only ever triggers after link98476884 runs for sure for sure
	console.error('in macSetLevelOfBrowseFile');
	/*
	var cWin = Services.wm.getMostRecentWindow(null);
	try {
		var cWinType = cWin.document.documentElement.getAttribute('windowtype');
		console.error('cWinType:', cWinType);
	} catch(ignore) {}
	try {
		var cWinTitle = cWin.document.documentElement.getAttribute('title');
		console.error('cWinTitle:', cWinTitle);
	} catch(ignore) {}
	
	var aHwndPtrStr = Services.wm.getMostRecentWindow(null).QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIWebNavigation)
										.QueryInterface(Ci.nsIDocShellTreeItem)
										.treeOwner
										.QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIBaseWindow)
										.nativeHandle;
	var NSWindowString = aHwndPtrStr;

								
	var NSWindowPtr = ctypes.voidptr_t(ctypes.UInt64(NSWindowString));
	*/
	var NSApplication = gMacTypes.objc_getClass('NSApplication');
	var sharedApplication = gMacTypes.sel_registerName('sharedApplication');
	
	var sharedApp = gMacTypes.objc_msgSend(NSApplication, sharedApplication);
	console.log('sharedApp:', sharedApp, sharedApp.toString(), uneval(sharedApp));
	
	var keyWindow = gMacTypes.sel_registerName('keyWindow');
	var rez_keyWin = gMacTypes.objc_msgSend(sharedApp, keyWindow);
	console.log('rez_keyWin:', rez_keyWin, rez_keyWin.toString(), uneval(rez_keyWin));
	if (rez_keyWin.isNull()) {
		console.error('no keyWindow yet, apparently its possible, im guessing maybe while the window is opening, im not sure but just to be safe wait a bit and call again');
		setTimeout(macSetLevelOfBrowseFile, 100);
		return;
	}
	
	var title = gMacTypes.sel_registerName('title');
	var rez_title = gMacTypes.objc_msgSend(rez_keyWin, title);
	console.log('rez_title:', rez_title, rez_title.toString(), uneval(rez_title));
	
	var UTF8String = gMacTypes.sel_registerName('UTF8String');
	var rez_titleUTF8 = gMacTypes.objc_msgSend(rez_title, UTF8String);
	console.log('rez_titleUTF8:', rez_titleUTF8, rez_titleUTF8.toString(), uneval(rez_titleUTF8));
	
	var cCharPtr = ctypes.cast(rez_titleUTF8, ctypes.char.ptr);
	var cWinTitle = cCharPtr.readString(); // :note: // link123111119 i do read string, so the text i open browseFile with should be readable by this
	console.log('cWinTitle:', cWinTitle);
	
	if (cWinTitle != core.addon.l10n.bootstrap['filepicker-title-save-screenshot']) {
		console.error('keyWindow is not the browse file picker dialog yet so try again in a bit');
		setTimeout(macSetLevelOfBrowseFile, 100);
		return;
	} else {	
		var rez_setLevel = gMacTypes.objc_msgSend(rez_keyWin, gMacTypes.setLevel, gMacTypes.NSInteger(gMacTypes.NSMainMenuWindowLevel + 1)); // i guess 0 is NSNormalWindowLevel // link98476884 // link847455111
		console.log('rez_setLevel:', rez_setLevel, rez_setLevel.toString(), uneval(rez_setLevel));
	}
	console.error('done macSetLevelOfBrowseFile');
	
	// in my tests, i didnt need to every wait, as keyWindow was set and it was the picker
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

	
	NBs.updateGlobal(crossWinId, {
		lbl: 1, // label was updated for sure
		btns:{
			label: [aUAPEntry.userAckId], // arr of btn ids that need updating
			class: [aUAPEntry.userAckId] // arr of btn ids that need updating
		}
	});
}

function broadcastToMainGuisToUpdate() {
	myServices.mm.broadcastAsyncMessage(core.addon.id, ['serverCommand_refreshDashboardGuiFromFile']);
}

function addEntryToLog(aTypeStr, aData={}) {
	var promise_appendLog = MainWorker.post('addEntryToLog', [aTypeStr, aData]);
	promise_appendLog.then(
		function(aVal) {
			console.log('Fullfilled - promise_appendLog - ', aVal);
		},
		genericReject.bind(null, 'promise_appendLog', 0)
	).catch(genericCatch.bind(null, 'promise_appendLog', 0));
}
// end - custom addon functionalities

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
// rev3 - https://gist.github.com/Noitidart/326f1282c780e3cb7390
function Deferred() {
	// update 062115 for typeof
	if (typeof(Promise) != 'undefined' && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (typeof(PromiseUtils) != 'undefined'  && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else {
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
	}
}

// SIPWorker - rev9 - https://gist.github.com/Noitidart/92e55a3f7761ed60f14c
const SIP_CB_PREFIX = '_a_gen_cb_';
const SIP_TRANS_WORD = '_a_gen_trans_';
var sip_last_cb_id = -1;
function SIPWorker(workerScopeName, aPath, aCore=core, aFuncExecScope=BOOTSTRAP) {
	// update 022016 - delayed init till first .post
	// update 010516 - allowing pomiseworker to execute functions in this scope, supply aFuncExecScope, else leave it undefined and it will not set this part up
	// update 122115 - init resolves the deferred with the value returned from Worker, rather then forcing it to resolve at true
	// "Start and Initialize PromiseWorker"
	// returns promise
		// resolve value: jsBool true
	// aCore is what you want aCore to be populated with
	// aPath is something like `core.addon.path.content + 'modules/workers/blah-blah.js'`
	
	// :todo: add support and detection for regular ChromeWorker // maybe? cuz if i do then ill need to do ChromeWorker with callback
	
	// var deferredMain_SIPWorker = new Deferred();

	var cWorkerInited = false;
	var cWorkerPost_orig;
	
	if (!(workerScopeName in bootstrap)) {
		bootstrap[workerScopeName] = new PromiseWorker(aPath);
		
		cWorkerPost_orig = bootstrap[workerScopeName].post;
		
		bootstrap[workerScopeName].post = function(pFun, pArgs, pCosure, pTransfers) {
			if (!cWorkerInited) {
				var deferredMain_post = new Deferred();
				
				bootstrap[workerScopeName].post = cWorkerPost_orig;
				
				var doInit = function() {
					var promise_initWorker = bootstrap[workerScopeName].post('init', [aCore]);
					promise_initWorker.then(
						function(aVal) {
							console.log('Fullfilled - promise_initWorker - ', aVal);
							// start - do stuff here - promise_initWorker
							if (pFun) {
								doOrigPost();
							} else {
								// pFun is undefined, meaning devuser asked for instant init
								deferredMain_post.resolve(aVal);
							}
							// end - do stuff here - promise_initWorker
						},
						genericReject.bind(null, 'promise_initWorker', deferredMain_post)
					).catch(genericCatch.bind(null, 'promise_initWorker', deferredMain_post));
				};
				
				var doOrigPost = function() {
					var promise_origPosted = bootstrap[workerScopeName].post(pFun, pArgs, pCosure, pTransfers);
					promise_origPosted.then(
						function(aVal) {
							console.log('Fullfilled - promise_origPosted - ', aVal);
							deferredMain_post.resolve(aVal);
						},
						genericReject.bind(null, 'promise_origPosted', deferredMain_post)
					).catch(genericCatch.bind(null, 'promise_origPosted', deferredMain_post));
				};
				
				doInit();
				return deferredMain_post.promise;
			}
		};
		
		// start 010516 - allow worker to execute functions in bootstrap scope and get value
		if (aFuncExecScope) {
			// this triggers instantiation of the worker immediately
			var origOnmessage = bootstrap[workerScopeName]._worker.onmessage;
			var origOnerror = bootstrap[workerScopeName]._worker.onerror;
			
			bootstrap[workerScopeName]._worker.onerror = function(onErrorEvent) {
				// got an error that PromiseWorker did not know how to serialize. so we didnt get a {fail:.....} postMessage. so in onerror it does pop of the deferred. however with allowing promiseworker to return async, we cant simply pop if there are more then 1 promises pending
				var cQueue = bootstrap[workerScopeName]._queue._array;
				if (cQueue.length === 1) {
					// console.log('its fine for origOnerror it will just pop the only one there, which is the one to reject for sure as there are no other promises');
					// DO NOTE THOUGH - .onerror message might come in from any error, it is innate to worker to send this message on error, so it will pop out the promise early, so maybe i might run this origOnerror before the actual promise rejects due to catch
					origOnerror(onErrorEvent);
				} else {
					onErrorEvent.preventDefault(); // as they do this in origOnerror so i prevent here too
					console.error('queue has more then one promises in there, i dont know which one to reject', 'onErrorEvent:', onErrorEvent, 'queue:', bootstrap[workerScopeName]._queue._array);
				}
			};
			
			bootstrap[workerScopeName]._worker.onmessage = function(aMsgEvent) {
				////// start - my custom stuff
				var aMsgEventData = aMsgEvent.data;
				console.log('promiseworker receiving msg:', aMsgEventData);
				if (Array.isArray(aMsgEventData)) {
					// my custom stuff, PromiseWorker did self.postMessage to call a function from here
					console.log('promsieworker is trying to execute function in mainthread');
					
					var callbackPendingId;
					if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SIP_CB_PREFIX) == 0) {
						callbackPendingId = aMsgEventData.pop();
					}
					
					var funcName = aMsgEventData.shift();
					if (funcName in aFuncExecScope) {
						var rez_mainthread_call = aFuncExecScope[funcName].apply(null, aMsgEventData);
						
						if (callbackPendingId) {
							if (rez_mainthread_call.constructor.name == 'Promise') { // if get undefined here, that means i didnt return an array from the function in main thread that the worker called
								rez_mainthread_call.then(
									function(aVal) {
										if (aVal.length >= 2 && aVal[aVal.length-1] == SIP_TRANS_WORD && Array.isArray(aVal[aVal.length-2])) {
											// to transfer in callback, set last element in arr to SIP_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
											console.error('doing transferrrrr');
											aVal.pop();
											bootstrap[workerScopeName]._worker.postMessage([callbackPendingId, aVal], aVal.pop());
										} else {
											bootstrap[workerScopeName]._worker.postMessage([callbackPendingId, aVal]);
										}
									},
									function(aReason) {
										console.error('aReject:', aReason);
										bootstrap[workerScopeName]._worker.postMessage([callbackPendingId, ['promise_rejected', aReason]]);
									}
								).catch(
									function(aCatch) {
										console.error('aCatch:', aCatch);
										bootstrap[workerScopeName]._worker.postMessage([callbackPendingId, ['promise_rejected', aCatch]]);
									}
								);
							} else {
								// assume array
								if (rez_mainthread_call.length > 2 && rez_mainthread_call[rez_mainthread_call.length-1] == SIP_TRANS_WORD && Array.isArray(rez_mainthread_call[rez_mainthread_call.length-2])) {
									// to transfer in callback, set last element in arr to SIP_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
									rez_mainthread_call.pop();
									console.log('doiing traansfer');
									bootstrap[workerScopeName]._worker.postMessage([callbackPendingId, rez_mainthread_call], rez_mainthread_call.pop());
								} else {
									bootstrap[workerScopeName]._worker.postMessage([callbackPendingId, rez_mainthread_call]);
								}
							}
						}
					}
					else { console.error('funcName', funcName, 'not in scope of aFuncExecScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out
					////// end - my custom stuff
				} else {
					// find the entry in queue that matches this id, and move it to first position, otherwise i get the error `Internal error: expecting msg " + handler.id + ", " + " got " + data.id + ` --- this guy uses pop and otherwise might get the wrong id if i have multiple promises pending
					var cQueue = bootstrap[workerScopeName]._queue._array;
					var cQueueItemFound;
					for (var i=0; i<cQueue.length; i++) {
						if (cQueue[i].id == aMsgEvent.data.id) {
							cQueueItemFound = true;
							if (i !== 0) {
								// move it to first position
								var wasQueue = cQueue.slice(); // console.log('remove on production');
								cQueue.splice(0, 0, cQueue.splice(i, 1)[0]);
								console.log('ok moved q item from position', i, 'to position 0, this should fix that internal error, aMsgEvent.data.id:', aMsgEvent.data.id, 'queue is now:', cQueue, 'queue was:', wasQueue);
							}
							else { console.log('no need to reorder queue, the element of data.id:', aMsgEvent.data.id, 'is already in first position:', bootstrap[workerScopeName]._queue._array); }
							break;
						}
					}
					if (!cQueueItemFound) {
						console.error('errrrror: how on earth can it not find the item with this id in the queue? i dont throw here as the .pop will throw the internal error, aMsgEvent.data.id:', aMsgEvent.data.id, 'cQueue:', cQueue);
					}
					origOnmessage(aMsgEvent);
				}
			}
		}
		// end 010516 - allow worker to execute functions in bootstrap scope and get value
		
		if ('addon' in aCore && 'aData' in aCore.addon) {
			delete aCore.addon.aData; // we delete this because it has nsIFile and other crap it, but maybe in future if I need this I can try JSON.stringify'ing it
		}
	} else {
		throw new Error('Something is loaded into bootstrap[workerScopeName] already');
	}
	
	// return deferredMain_SIPWorker.promise;
	return bootstrap[workerScopeName];
	
}

// SICWorker - rev8 - https://gist.github.com/Noitidart/6a9da3589e88cc3df7e7
const SIC_CB_PREFIX = '_a_gen_cb_';
const SIC_TRANS_WORD = '_a_gen_trans_';
var sic_last_cb_id = -1;
function SICWorker(workerScopeName, aPath, aFuncExecScope=bootstrap, aCore=core) {
	// creates a global variable in bootstrap named workerScopeName which will hold worker, do not set up a global for it like var Blah; as then this will think something exists there
	// aScope is the scope in which the functions are to be executed
	// ChromeWorker must listen to a message of 'init' and on success of it, it should sendMessage back saying aMsgEvent.data == {aTopic:'init', aReturn:true}
	// "Start and Initialize ChromeWorker" // based on SIPWorker
	// returns promise
		// resolve value: jsBool true
	// aCore is what you want aCore to be populated with
	// aPath is something like `core.addon.path.content + 'modules/workers/blah-blah.js'`	
	var deferredMain_SICWorker = new Deferred();

	if (!(workerScopeName in bootstrap)) {
		bootstrap[workerScopeName] = new ChromeWorker(aPath);
		
		if ('addon' in aCore && 'aData' in aCore.addon) {
			delete aCore.addon.aData; // we delete this because it has nsIFile and other crap it, but maybe in future if I need this I can try JSON.stringify'ing it
		}
		
		var afterInitListener = function(aMsgEvent) {
			// note:all msgs from bootstrap must be postMessage([nameOfFuncInWorker, arg1, ...])
			var aMsgEventData = aMsgEvent.data;
			console.log('mainthread receiving message:', aMsgEventData);
			
			// postMessageWithCallback from worker to mt. so worker can setup callbacks after having mt do some work
			var callbackPendingId;
			if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SIC_CB_PREFIX) == 0) {
				callbackPendingId = aMsgEventData.pop();
			}
			
			var funcName = aMsgEventData.shift();
			
			if (funcName in aFuncExecScope) {
				var rez_mainthread_call = aFuncExecScope[funcName].apply(null, aMsgEventData);
				
				if (callbackPendingId) {
					if (rez_mainthread_call.constructor.name == 'Promise') {
						rez_mainthread_call.then(
							function(aVal) {
								if (aVal.length >= 2 && aVal[aVal.length-1] == SIC_TRANS_WORD && Array.isArray(aVal[aVal.length-2])) {
									// to transfer in callback, set last element in arr to SIC_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
									console.error('doing transferrrrr');
									aVal.pop();
									bootstrap[workerScopeName].postMessage([callbackPendingId, aVal], aVal.pop());
								} else {
									bootstrap[workerScopeName].postMessage([callbackPendingId, aVal]);
								}
							},
							function(aReason) {
								console.error('aReject:', aReason);
								bootstrap[workerScopeName].postMessage([callbackPendingId, ['promise_rejected', aReason]]);
							}
						).catch(
							function(aCatch) {
								console.error('aCatch:', aCatch);
								bootstrap[workerScopeName].postMessage([callbackPendingId, ['promise_rejected', aCatch]]);
							}
						);
					} else {
						// assume array
						if (rez_mainthread_call.length > 2 && rez_mainthread_call[rez_mainthread_call.length-1] == SIC_TRANS_WORD && Array.isArray(rez_mainthread_call[rez_mainthread_call.length-2])) {
							// to transfer in callback, set last element in arr to SIC_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
							rez_mainthread_call.pop();
							bootstrap[workerScopeName].postMessage([callbackPendingId, rez_mainthread_call], rez_mainthread_call.pop());
						} else {
							bootstrap[workerScopeName].postMessage([callbackPendingId, rez_mainthread_call]);
						}
					}
				}
			}
			else { console.warn('funcName', funcName, 'not in scope of aFuncExecScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out

		};
		
		var beforeInitListener = function(aMsgEvent) {
			// note:all msgs from bootstrap must be postMessage([nameOfFuncInWorker, arg1, ...])
			var aMsgEventData = aMsgEvent.data;
			if (aMsgEventData[0] == 'init') {
				bootstrap[workerScopeName].removeEventListener('message', beforeInitListener);
				bootstrap[workerScopeName].addEventListener('message', afterInitListener);
				deferredMain_SICWorker.resolve(true);
				if ('init' in aFuncExecScope) {
					aFuncExecScope[aMsgEventData.shift()].apply(null, aMsgEventData);
				}
			}
		};
		
		// var lastCallbackId = -1; // dont do this, in case multi SICWorker's are sharing the same aFuncExecScope so now using new Date().getTime() in its place // link8888881
		bootstrap[workerScopeName].postMessageWithCallback = function(aPostMessageArr, aCB, aPostMessageTransferList) {
			// lastCallbackId++; // link8888881
			sic_last_cb_id++;
			var thisCallbackId = SIC_CB_PREFIX + sic_last_cb_id; // + lastCallbackId; // link8888881
			aFuncExecScope[thisCallbackId] = function() {
				delete aFuncExecScope[thisCallbackId];
				// console.log('in mainthread callback trigger wrap, will apply aCB with these arguments:', arguments, 'turned into array:', Array.prototype.slice.call(arguments));
				aCB.apply(null, arguments[0]);
			};
			aPostMessageArr.push(thisCallbackId);
			// console.log('aPostMessageArr:', aPostMessageArr);
			bootstrap[workerScopeName].postMessage(aPostMessageArr, aPostMessageTransferList);
		};
		
		bootstrap[workerScopeName].addEventListener('message', beforeInitListener);
		bootstrap[workerScopeName].postMessage(['init', aCore]);
		
	} else {
		deferredMain_SICWorker.reject('Something is loaded into bootstrap[workerScopeName] already');
	}
	
	return deferredMain_SICWorker.promise;
	
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

function copyTextToClip(aTxt, aDOMWindow) {
	var trans = Transferable(aDOMWindow ? aDOMWindow : Services.wm.getMostRecentWindow('navigator:browser'));
	trans.addDataFlavor('text/unicode');
	trans.setTransferData('text/unicode', SupportsString(aTxt), aTxt.length * 2); // We multiply the length of the string by 2, since it's stored in 2-byte UTF-16 format internally.
	Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
}

function encodeFormData(data, charset, forArrBuf_nameDotExt, forArrBuf_mimeType) {
	// http://stackoverflow.com/a/25020668/1828637

	var encoder = Cc["@mozilla.org/intl/saveascharset;1"].createInstance(Ci.nsISaveAsCharset);
	encoder.Init(charset || "utf-8", Ci.nsISaveAsCharset.attr_EntityAfterCharsetConv + Ci.nsISaveAsCharset.attr_FallbackDecimalNCR, 0);
	var encode = function(val, header) {
		val = encoder.Convert(val);
		if (header) {
			val = val.replace(/\r\n/g, " ").replace(/"/g, "\\\"");
		}
		return val;
	}

	var boundary = "----boundary--" + Date.now();
	var mpis = Cc['@mozilla.org/io/multiplex-input-stream;1'].createInstance(Ci.nsIMultiplexInputStream);

	var item = "";
	for (var k of Object.keys(data)) {
		item += "--" + boundary + "\r\n";
		var v = data[k];
		
		if (v instanceof Ci.nsIFile) {
			
			var fstream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
			fstream.init(v, -1, -1, Ci.nsIFileInputStream.DELETE_ON_CLOSE);
			item += "Content-Disposition: form-data; name=\"" + encode(k, true) + "\";" + " filename=\"" + encode(v.leafName, true) + "\"\r\n";

			var ctype = "application/octet-stream";
			try {
				var mime = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);
				ctype = mime.getTypeFromFile(v) || ctype;
			} catch (ex) {
				console.warn("failed to get type", ex);
			}
			item += "Content-Type: " + ctype + "\r\n\r\n";

			var ss = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
			ss.data = item;

			mpis.appendStream(ss);
			mpis.appendStream(fstream);

			item = "";

		} else {
			console.error('in else');
			item += "Content-Disposition: form-data; name=\"" + encode(k, true) + "\"\r\n\r\n";
			item += encode(v);
			
		}
		item += "\r\n";
	}

	item += "--" + boundary + "--\r\n";
	var ss = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
	ss.data = item;
	mpis.appendStream(ss);
  
	var postStream = Cc["@mozilla.org/network/mime-input-stream;1"].createInstance(Ci.nsIMIMEInputStream);
	postStream.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
	postStream.setData(mpis);
	postStream.addContentLength = true;
  
	return postStream;
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

// rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5
const SAM_CB_PREFIX = '_sam_gen_cb_';
var sam_last_cb_id = -1;
function sendAsyncMessageWithCallback(aMessageManager, aGroupId, aMessageArr, aCallbackScope, aCallback) {
	sam_last_cb_id++;
	var thisCallbackId = SAM_CB_PREFIX + sam_last_cb_id;
	aCallbackScope = aCallbackScope ? aCallbackScope : bootstrap;
	aCallbackScope[thisCallbackId] = function(aMessageArr) {
		delete aCallbackScope[thisCallbackId];
		aCallback.apply(null, aMessageArr);
	}
	aMessageArr.push(thisCallbackId);
	aMessageManager.sendAsyncMessage(aGroupId, aMessageArr);
}

var gFHR = []; // holds all currently alive FHR instances. keeps track of FHR's so it destroys them on shutdown. if devuser did not handle destroying it
var gFHR_id = 0;
function FHR() {
	// my FrameHttpRequest module which loads pages into frames, and navigates by clicks
	// my play on XHR
	
	// must instatiate with loadPageArgs
	
	gFHR_id++;
	
	var fhrThis = this;
	this.id = gFHR_id;
	gFHR.push(this);
	
	var fhrFsMsgListenerId = core.addon.id + '-fhr_' + gFHR_id;

	// start - rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5
	var fhrFsFuncs = { // can use whatever, but by default its setup to use this
		FHRFrameScriptReady: function() {
			console.log('mainthread', 'FHRFrameScriptReady');
			fhrThis.inited = true;
			if (fhrPostInitCb) {
				fhrPostInitCb();
			}
		}
	};
	var fhrFsMsgListener = {
		funcScope: fhrFsFuncs,
		receiveMessage: function(aMsgEvent) {
			var aMsgEventData = aMsgEvent.data;
			console.log('fhrFsMsgListener getting aMsgEventData:', aMsgEventData, 'aMsgEvent:', aMsgEvent);
			// aMsgEvent.data should be an array, with first item being the unfction name in bootstrapCallbacks
			
			var callbackPendingId;
			if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
				callbackPendingId = aMsgEventData.pop();
			}
			
			aMsgEventData.push(aMsgEvent); // this is special for server side, so the function can do aMsgEvent.target.messageManager to send a response
			
			var funcName = aMsgEventData.shift();
			if (funcName in this.funcScope) {
				var rez_parentscript_call = this.funcScope[funcName].apply(null, aMsgEventData);
				
				if (callbackPendingId) {
					// rez_parentscript_call must be an array or promise that resolves with an array
					if (rez_parentscript_call.constructor.name == 'Promise') {
						rez_parentscript_call.then(
							function(aVal) {
								// aVal must be an array
								aMsgEvent.target.messageManager.sendAsyncMessage(fhrFsMsgListenerId, [callbackPendingId, aVal]);
							},
							function(aReason) {
								console.error('aReject:', aReason);
								aMsgEvent.target.messageManager.sendAsyncMessage(fhrFsMsgListenerId, [callbackPendingId, ['promise_rejected', aReason]]);
							}
						).catch(
							function(aCatch) {
								console.error('aCatch:', aCatch);
								aMsgEvent.target.messageManager.sendAsyncMessage(fhrFsMsgListenerId, [callbackPendingId, ['promise_rejected', aCatch]]);
							}
						);
					} else {
						// assume array
						aMsgEvent.target.messageManager.sendAsyncMessage(fhrFsMsgListenerId, [callbackPendingId, rez_parentscript_call]);
					}
				}
			}
			else { console.warn('funcName', funcName, 'not in scope of this.funcScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out
			
		}
	};
	
	Services.mm.addMessageListener(fhrFsMsgListenerId, fhrFsMsgListener);
	
	// no need to redefine - sendAsyncMessageWithCallback, i can use the globally defined sendAsyncMessageWithCallback fine with this
	// end - rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5
	
	
	var aWindow = Services.wm.getMostRecentWindow('navigator:browser');
	var aDocument = aWindow.document;
	var fhrPostInitCb;
	
	var doAfterAppShellDomWinReady = function() {
		
			this.frame = aDocument.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'browser');
			
			// this.frame.setAttribute('class', core.addon.id + '_fhr-');
			// if (OS.Constants.Sys.Name.toLowerCase() != 'darwin') {
				this.frame.setAttribute('remote', 'true');
			// }
			this.frame.setAttribute('type', 'content');
			this.frame.setAttribute('style', 'height:100px;border:2px solid steelblue;');
			
			aDocument.documentElement.appendChild(this.frame);
			this.frame.messageManager.loadFrameScript(core.addon.path.scripts + 'FHRFrameScript.js?fhrFsMsgListenerId=' + fhrFsMsgListenerId + '&v=' + core.addon.cache_key, false);			
			// aWindow.gBrowser.selectedBrowser.messageManager.loadFrameScript(core.addon.path.scripts + 'FHRFrameScript.js?fhrFsMsgListenerId=' + fhrFsMsgListenerId + '&v=' + core.addon.cache_key, false);
			
			this.destroy = function() {
				
				this.frame.messageManager.sendAsyncMessage(fhrFsMsgListenerId, ['destroySelf']); // not really needed as i remove the element

				Services.mm.removeMessageListener(fhrFsMsgListenerId, fhrFsMsgListener);
				aDocument.documentElement.removeChild(this.frame);
				
				delete this.frame; // release reference to it
				delete this.loadPage;
				delete this.destroy;
				
				for (var i=0; i<gFHR.length; i++) {
					if (gFHR[i].id == this.id) {
						gFHR.splice(i, 1);
						break;
					}
				}
				
				this.destroyed = true;
				console.log('ok destroyed FHR instance with id:', this.id);
			}.bind(this);
		
	}.bind(this);
	
	if (aDocument.readyState == 'complete') {
		doAfterAppShellDomWinReady();
	} else {
		aWindow.addEventListener('load', function() {
			aWindow.removeEventListener('load', arguments.callee, false);
			doAfterAppShellDomWinReady();
		}, false);
	}
	
	this.loadPage = function(aSrc, aClickSetName, aCallbackSetName, aLoadPageData, aDeferredMain_setSrc) {
		// sets src of frame OR clicks if aClickSetName is set. must either set aSrc OR aClickSetName never both
		
		// aCbInfoObj is a collection of callbacks, like for on fail load, on error etc etc
		console.log('ok in loadPage for id:', this.id);
		
		var deferredMain_setSrc;
		
		if (aDeferredMain_setSrc) {
			console.log('ok set to preset deferred');
			deferredMain_setSrc = aDeferredMain_setSrc;
		} else {
			deferredMain_setSrc = new Deferred();
			
			if (!this.inited) {
				console.log('not yet inited');
				fhrPostInitCb = this.loadPage.bind(this, aSrc, aClickSetName, aCallbackSetName, aLoadPageData, deferredMain_setSrc);
			
				return deferredMain_setSrc.promise;
			}
		}
		
		console.log('sending msg to message manager fhrFsMsgListenerId:', fhrFsMsgListenerId);
		sendAsyncMessageWithCallback(this.frame.messageManager, fhrFsMsgListenerId, ['loadPage', aSrc, aClickSetName, aCallbackSetName, aLoadPageData], fhrFsMsgListener.funcScope, function(aFhrResponse) {
			console.log('bootstrap', 'aFhrResponse:', aFhrResponse);
			deferredMain_setSrc.resolve(aFhrResponse);
		});
		
		return deferredMain_setSrc.promise;
		
	}.bind(this);
	
}

//rev1 - https://gist.github.com/Noitidart/c4ab4ca10ff5861c720b
function validateOptionsObj(aOptions, aOptionsDefaults) {
	// ensures no invalid keys are found in aOptions, any key found in aOptions not having a key in aOptionsDefaults causes throw new Error as invalid option
	for (var aOptKey in aOptions) {
		if (!(aOptKey in aOptionsDefaults)) {
			console.error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value, aOptionsDefaults:', aOptionsDefaults, 'aOptions:', aOptions);
			throw new Error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value');
		}
	}
	
	// if a key is not found in aOptions, but is found in aOptionsDefaults, it sets the key in aOptions to the default value
	for (var aOptKey in aOptionsDefaults) {
		if (!(aOptKey in aOptions)) {
			aOptions[aOptKey] = aOptionsDefaults[aOptKey];
		}
	}
}
function justFormatStringFromName(aLocalizableStr, aReplacements) {
    // justFormatStringFromName is formating only ersion of the worker version of formatStringFromName

    var cLocalizedStr = aLocalizableStr;
    if (aReplacements) {
        for (var i=0; i<aReplacements.length; i++) {
            cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
        }
    }

    return cLocalizedStr;
}
// end - common helper functions