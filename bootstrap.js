// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cu.import('resource://gre/modules/AddonManager.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.importGlobalProperties(['Blob', 'URL']);

const COMMONJS_URI = 'resource://gre/modules/commonjs';
const { require } = Cu.import(COMMONJS_URI + '/toolkit/require.js', {});
var CLIPBOARD = require('sdk/clipboard');

var BEAUTIFY = {};
(function() {
	var { require } = Cu.import('resource://devtools/shared/Loader.jsm', {});
	var { jsBeautify } = require('devtools/shared/jsbeautify/src/beautify-js');
	BEAUTIFY.js = jsBeautify;
}());

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'as', () => Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService) );

// Globals
var core = {
	addon: {
		name: 'NativeShot',
		id: 'NativeShot@jetpack',
		path: {
			name: 'nativeshot',
			//
			content: 'chrome://nativeshot/content/',
			locale: 'chrome://nativeshot/locale/',
			//
			resources: 'chrome://nativeshot/content/resources/',
			images: 'chrome://nativeshot/content/resources/images/',
			scripts: 'chrome://nativeshot/content/resources/scripts/',
			styles: 'chrome://nativeshot/content/resources/styles/',
			fonts: 'chrome://nativeshot/content/resources/styles/fonts/',
			pages: 'chrome://nativeshot/content/resources/pages/'
			// below are added by worker
			// storage: OS.Path.join(OS.Constants.Path.profileDir, 'jetpack', core.addon.id, 'simple-storage')
		},
		pref_branch: 'extensions.NativeShot@jetpack.',
		cache_key: Math.random() // set to version on release
	},
	os: {
		// // name: added by worker
		// // mname: added by worker
		toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
		xpcomabi: Services.appinfo.XPCOMABI
	},
	firefox: {
		pid: Services.appinfo.processID,
		version: Services.appinfo.version,
		channel: Services.prefs.getCharPref('app.update.channel')
	}
};

var gBootstrap;

var gWkComm;
var gFsComm;
var callInMainworker, callInContentinframescript, callInFramescript, callInContent1;

var gAndroidMenuIds = [];

var gCuiCssUri;
var gGenCssUri;

var OSStuff = {};

var gEditorSession = {
	// id: null - set when a session is in progress
};

var ostypes;
var gFonts;
var gEditorStateStr;

const NS_HTML = 'http://www.w3.org/1999/xhtml';
const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';


function install() {}
function uninstall(aData, aReason) {
    if (aReason == ADDON_UNINSTALL) {
		Cu.import('resource://gre/modules/osfile.jsm');
		OS.File.removeDir(OS.Path.join(OS.Constants.Path.profileDir, 'jetpack', core.addon.id), {ignorePermissions:true, ignoreAbsent:true}); // will reject if `jetpack` folder does not exist
	}
}

function startup(aData, aReason) {

    Services.scriptloader.loadSubScript(core.addon.path.scripts + 'comm/Comm.js', gBootstrap);
    ({ callInMainworker, callInContentinframescript, callInFramescript, callInContent1 } = CommHelper.bootstrap);

    gWkComm = new Comm.server.worker(core.addon.path.scripts + 'MainWorker.js?' + core.addon.cache_key, ()=>core, function(aArg, aComm) {
        core = aArg;

		gEditorStateStr = core.editorstateStr;
		delete core.editorstateStr;

		gFsComm = new Comm.server.framescript(core.addon.id);

        Services.mm.loadFrameScript(core.addon.path.scripts + 'MainFramescript.js?' + core.addon.cache_key, true);

        // desktop:insert_gui
        if (core.os.name != 'android') {

			gGenCssUri = Services.io.newURI(core.addon.path.styles + 'general.css', null, null);
			gCuiCssUri = Services.io.newURI(core.addon.path.styles + getCuiCssFilename(), null, null);

    		// insert cui
    		Cu.import('resource:///modules/CustomizableUI.jsm');
    		CustomizableUI.createWidget({
    			id: 'cui_' + core.addon.path.name,
    			defaultArea: CustomizableUI.AREA_NAVBAR,
    			label: formatStringFromNameCore('gui_label', 'main'),
    			tooltiptext: formatStringFromNameCore('gui_tooltip', 'main'),
    			onCommand: guiClick
    		});

    	}

        // register must go after the above, as i set gCuiCssUri above
        windowListener.register();

		if (core.os.name != 'android') {
			Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-mozNotificationBar/host.js', gBootstrap);
			AB.init();
		}

    });

    callInMainworker('dummyForInstantInstantiate');
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) {
		callInMainworker('writePrefsToFile');
		return;
	}

	Services.mm.removeDelayedFrameScript(core.addon.path.scripts + 'MainFramescript.js?' + core.addon.cache_key);

    Comm.server.unregAll('framescript');
    Comm.server.unregAll('worker');

    // desktop_android:insert_gui
    if (core.os.name != 'android') {
		CustomizableUI.destroyWidget('cui_' + core.addon.path.name);
	} else {
		for (var androidMenu of gAndroidMenus) {
			var domwin;
			try {
				domwin = androidMenu.domwin.get();
			} catch(ex) {
				// its dead
				continue;
			}
			if (!domwin) {
				// its dead
				continue;
			}
			domwin.NativeWindow.menu.remove(androidMenu.menuid);
		}
	}

	windowListener.unregister();
}

// start - addon functions
function getCuiCssFilename() {
	var cuiCssFilename;
	if (Services.prefs.getCharPref('app.update.channel') == 'aurora') {
		if (core.os.mname != 'darwin') {
			// i didnt test dev edition on winxp, not sure what it is there
			cuiCssFilename = 'cui_dev.css';
		} else {
			cuiCssFilename = 'cui_dev_mac.css';
		}
	} else {
		if (core.os.mname == 'darwin') {
			cuiCssFilename = 'cui_mac.css';
		} else if (core.os.mname == 'gtk') {
			cuiCssFilename = 'cui_gtk.css';
		} else {
			// windows
			if (core.os.version <= 5.2) {
				// xp
				cuiCssFilename = 'cui_gtk.css';
			} else {
				cuiCssFilename = 'cui.css';
			}
		}
	}
	return cuiCssFilename;
}
function guiClick(e) {
	if (!gEditorSession.id) {
		if (e.shiftKey) {
			// add delay
			callInMainworker('countdownStartOrIncrement', 5, function(aArg) {
				var { sec_left, done } = aArg;
				if (done) {
					// countdown done
					guiSetBadge(null);
					guiClick({});
				} else {
					// done is false or undefined
					// if false it means it was incremented and its closing the pathway. but it sends a sec_left with it, which is the newly incremented countdown
						//	OR it means it was cancelled. when cancelled there is no sec_left
					// if undefined then sec_left is there, and they are providing progress updates
					if (sec_left !== undefined) {
						// progress, or increment close
						guiSetBadge(sec_left);
					}
					else { console.log('cancelled - pathway cleaned up') }
				}
			});
		} else {
			// clear delay if there was one
			callInMainworker('countdownCancel', undefined, function(aArg) {
				var cancelled = aArg;
				if (cancelled) {
					guiSetBadge(null);
				}
			});
			takeShot();
		}
	}
	else { console.warn('editor is currently open, so do nothing') }
}
function guiSetBadge(aTxt) {
	// set aTxt to null if you want to remove badge
	var widgetInstances = CustomizableUI.getWidget('cui_' + core.addon.path.name).instances;
	for (var i=0; i<widgetInstances.length; i++) {
		var inst = widgetInstances[i];
		var node = inst.node;
		if (aTxt === null) {
			node.classList.remove('badged-button');
			node.removeAttribute('badge');
		} else {
			node.setAttribute('badge', aTxt);
			node.classList.add('badged-button'); // classList.add does not add duplicate classes
		}
	}
}

function takeShot() {
	gEditorSession.id = Date.now();
	callInMainworker('shootAllMons', undefined, function(aArg) {
		var { collMonInfos } = aArg;
		for (var i=0; i<collMonInfos.length; i++) {
			collMonInfos[i].arrbuf = aArg['arrbuf' + i];

			collMonInfos[i].port1 = aArg['screenshot' + i + '_port1'];
			collMonInfos[i].port2 = aArg['screenshot' + i + '_port2'];
		}

		// call it shots
		var shots = collMonInfos;
		gEditorSession.shots = shots;

		// the most recent browser window when screenshot was taken
		var domwin = Services.wm.getMostRecentWindow('navigator:browser');
		gEditorSession.domwin_wk = Cu.getWeakReference(domwin);
		gEditorSession.domwin_was_focused = isFocused(domwin);

		// create allMonDimStr
		var allMonDim = [];
		for (var shot of shots) {
			allMonDim.push({
				x: shot.x,
				y: shot.y,
				w: shot.w,
				h: shot.h
				// win81ScaleX: shot.win81ScaleX,
				// win81ScaleY: shot.win81ScaleY
			});
		}
		var allMonDimStr = JSON.stringify(allMonDim);

		// open window for each shot
		var i = -1;
		for (var shot of shots) {
			i++;

			var x = shot.x;
			var y = shot.y;
			var w = shot.w;
			var h = shot.h;

			// scale it?
			var scaleX = shot.win81ScaleX;
			var scaleY = shot.win81ScaleY;
			if (scaleX) {
				x = Math.floor(x / scaleX);
				w = Math.floor(w / scaleX);
			}
			if (scaleY) {
				y = Math.floor(y / scaleY);
				h = Math.floor(h / scaleY);
			}

			// make query string of the number, string, and boolean properties of shot
			var query_json = Object.assign(
				{
					iMon: i,
					allMonDimStr: allMonDimStr
				},
				shot
			);
			// console.log('query_json:', query_json);
			var query_str = jQLike.serialize(query_json);
			// console.log('query_str:', query_str);

			var editor_domwin = Services.ww.openWindow(null, 'about:nativeshot?' + query_str, '_blank', 'chrome,titlebar=0,width=' + w + ',height=' + h + ',screenX=' + x + ',screenY=' + y, null);
			shot.domwin_wk = Cu.getWeakReference(editor_domwin);
		}

		console.log('collMonInfos:', collMonInfos);
	});
}

function editorInitShot(aIMon) {
	// does the platform dependent stuff to make the window be position on the proper monitor and full screened covering all things underneeath
	// also transfer the screenshot data to the window

	var iMon = aIMon; // iMon is my rename of colMonIndex. so its the i in the collMoninfos object
	var shots = gEditorSession.shots;
	var shot = shots[iMon];
	// var aEditorDOMWindow = colMon[iMon].E.DOMWindow;
	//
	// if (!aEditorDOMWindow || aEditorDOMWindow.closed) {
	// 	throw new Error('wtf how is window not existing, the on load observer notifier of panel.xul just sent notification that it was loaded');
	// }

	var domwin = shot.domwin_wk.get();
	var aHwndPtrStr = getNativeHandlePtrStr(domwin);
	shot.hwndPtrStr = aHwndPtrStr;

	// if (core.os.name != 'darwin') {
		// aEditorDOMWindow.moveTo(colMon[iMon].x, colMon[iMon].y);
		// aEditorDOMWindow.resizeTo(colMon[iMon].w, colMon[iMon].h);
	// }

	domwin.focus();

	// if (core.os.name != 'darwin') {
		// aEditorDOMWindow.fullScreen = true;
	// }

	// set window on top:
	var aArrHwndPtrStr = [aHwndPtrStr];
	var aArrHwndPtrOsParams = {};
	aArrHwndPtrOsParams[aHwndPtrStr] = {
		left: shot.x,
		top: shot.y,
		right: shot.x + shot.w,
		bottom: shot.y + shot.h,
		width: shot.w,
		height: shot.h
	};

	// if (core.os.name != 'darwinAAAA') {
	callInMainworker('setWinAlwaysOnTop', { aArrHwndPtrStr, aOptions:aArrHwndPtrOsParams }, function(aArg) {
		if (core.os.name == 'darwin') {
			initOstypes();
			// link98476884
			OSStuff.NSMainMenuWindowLevel = aVal;

			var NSWindowString = getNativeHandlePtrStr(domwin);
			var NSWindowPtr = ostypes.TYPE.NSWindow(ctypes.UInt64(NSWindowString));

			var rez_setLevel = ostypes.API('objc_msgSend')(NSWindowPtr, ostypes.HELPER.sel('setLevel:'), ostypes.TYPE.NSInteger(OSStuff.NSMainMenuWindowLevel + 1)); // have to do + 1 otherwise it is ove rmneubar but not over the corner items. if just + 0 then its over menubar, if - 1 then its under menu bar but still over dock. but the interesting thing is, the browse dialog is under all of these  // link847455111
			console.log('rez_setLevel:', rez_setLevel.toString());

			var newSize = ostypes.TYPE.NSSize(shot.w, shot.h);
			var rez_setContentSize = ostypes.API('objc_msgSend')(NSWindowPtr, ostypes.HELPER.sel('setContentSize:'), newSize);
			console.log('rez_setContentSize:', rez_setContentSize.toString());

			domwin.moveTo(shot.x, shot.y); // must do moveTo after setContentsSize as that sizes from bottom left and moveTo moves from top left. so the sizing will change the top left.
		}
	});

	if (!gFonts) {
			var fontsEnumerator = Cc['@mozilla.org/gfx/fontenumerator;1'].getService(Ci.nsIFontEnumerator);
			gFonts = fontsEnumerator.EnumerateAllFonts({});
	}

	shot.comm.putMessage('init', {
		screenshotArrBuf: shot.arrbuf,
		core: core,
		fonts: gFonts,
		editorstateStr: gEditorStateStr,
		_XFER: ['screenshotArrBuf']
	});

	// set windowtype attribute
	// colMon[aData.iMon].E.DOMWindow.document.documentElement.setAttribute('windowtype', 'nativeshot:canvas');

	// check to see if all monitors inited, if they have been, the fetch all win
	var allWinInited = true;
	for (var shoty of shots) {
		if (!shoty.hwndPtrStr) {
			allWinInited = false;
			break;
		}
	}
	if (allWinInited) {
		if (core.os.mname == 'winnt') {
			// reRaiseCanvasWins(); // ensures its risen
		}
		sendWinArrToEditors();
	}
}

function sendWinArrToEditors() {
	var shots = gEditorSession.shots;

	callInMainworker(
		'getAllWin',
		{
			getPid: true,
			getBounds: true,
			getTitle: true,
			filterVisible: true
		},
		function(aArg) {
			console.log('Fullfilled - promise_fetchWin - ', aVal);
			// Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(JSON.stringify(aVal)); // :debug:

			// build hwndPtrStr arr for nativeshot_canvas windows
			var hwndPtrStrArr = [];
			for (var shot of shots) {
				hwndPtrStrArr.push(shot.hwndPtrStr);
			}

			// remove nativeshot_canvas windows
			for (var i=0; i<aVal.length; i++) {
				if (aVal[i].title == 'nativeshot_canvas' || hwndPtrStrArr.indexOf(aVal[i].hwndPtrStr) > -1) {
					// need to do the hwndPtrStr check as on windows, sometimes the page isnt loaded yet, so the title of the window isnt there yet
					// aVal.splice(i, 1);
					aVal[i].left = -10000;
					aVal[i].right = -10000;
					aVal[i].width = 0;
					aVal[i].NATIVESHOT_CANVAS = true;
					// i--;
				}
			}

			for (var shot of shots) {
				shot.putMessage('receiveWinArr', {
					winArr: aVal
				});
			}
		}
	);
}
function initOstypes() {
	if (!ostypes) {
		Cu.import('resource://gre/modules/ctypes.jsm');

		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'ostypes/cutils.jsm', gBootstrap); // need to load cutils first as ostypes_mac uses it for HollowStructure
		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'ostypes/ctypes_math.jsm', gBootstrap);
		switch (core.os.mname) {
			case 'winnt':
			case 'winmo':
			case 'wince':
				Services.scriptloader.loadSubScript(core.addon.path.scripts + 'ostypes/ostypes_win.jsm', gBootstrap);
				break;
			case 'gtk':
				Services.scriptloader.loadSubScript(core.addon.path.scripts + 'ostypes/ostypes_x11.jsm', gBootstrap);
				break;
			case 'darwin':
				Services.scriptloader.loadSubScript(core.addon.path.scripts + 'ostypes/ostypes_mac.jsm', gBootstrap);
				break;
			default:
				throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
		}
	}
}

// start - context menu items
var gToolbarContextMenu_domId = 'toolbar-context-menu';
var gCustomizationPanelItemContextMenu_domId = 'customizationPanelItemContextMenu';

var gDashboardMenuitem_domIdSuffix = '_nativeshot-menuitem';
var gDashboardSeperator_domIdSuffix = '_nativeshot-seperator';

var gDashboardMenuitem_jsonTemplate = ['xul:menuitem', {
	// id: 'toolbar-context-menu_nativeshot-menuitem',
	// label: formatStringFromNameCore('dashboard-menuitem', 'main'), // cant access myServices.sb till startup, so this is set on startup // link988888887
	class: 'menuitem-iconic',
	image: core.addon.path.images + 'icon16.png',
	hidden: 'true',
	oncommand: function(e) {
		var gbrowser = e.target.ownerDocument.defaultView.gBrowser;
		var tabs = gbrowser.tabs;
		var l = gbrowser.tabs.length;
		for (var i=0; i<l; i++) {
			// e10s safe way to check content of tab
			if (tabs[i].linkedBrowser.currentURI.spec.toLowerCase().includes('about:nativeshot')) { // crossfile-link381787872 - i didnt link over there but &nativeshot.app-main.title; is what this is equal to
				gbrowser.selectedTab = tabs[i];
				return;
			}
		}
		gbrowser.loadOneTab('about:nativeshot', {inBackground:false});
	}
}];
var gDashboardMenuseperator_jsonTemplate = ['xul:menuseparator', {
	// id: 'toolbar-context-menu_nativeshot-menuseparator', // id is set when inserting into dom
	hidden: 'true'
}];

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


	if (!gDashboardMenuitem_jsonTemplate[1].label) {
		gDashboardMenuitem_jsonTemplate[1].label = formatStringFromNameCore('menuitem_opendashboard', 'main'); // link988888887 - needs to go before windowListener is registered
	}

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

var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {
		// console.error('title changed to:', aNewTitle);
		if (aNewTitle == 'nativeshot_canvas') {
			var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
			// aDOMWindow.document.documentElement.style.backgroundColor = 'transparent';
			aDOMWindow.addEventListener('nscomm', function(e) {
				aDOMWindow.removeEventListener('nscomm', arguments.callee, false);
				// console.log('got nscomm', e.detail);
				var detail = e.detail;
				var iMon = detail;
				var shot = gEditorSession.shots[iMon];
				shot.comm = new Comm.server.content(aDOMWindow, editorInitShot.bind(null, iMon), shot.port1, shot.port2);
			}, false, true);
		}
	},
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

            // desktop_android:insert_gui
			if (core.os.name != 'android') {
                // desktop:insert_gui
				if (aDOMWindow.gBrowser) {
					var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
					domWinUtils.loadSheet(gCuiCssUri, domWinUtils.AUTHOR_SHEET);
					domWinUtils.loadSheet(gGenCssUri, domWinUtils.AUTHOR_SHEET);
				}

				contextMenuSetup(aDOMWindow);
			} else {
                // android:insert_gui
				if (aDOMWindow.NativeWindow && aDOMWindow.NativeWindow.menu) {
					var menuid = aDOMWindow.NativeWindow.menu.add(formatStringFromNameCore('gui_label', 'main'), core.addon.path.images + 'icon-color16.png', guiClick)
					gAndroidMenus.push({
						domwin: Cu.getWeakReference(aDOMWindow),
						menuid
					});
				}
			}
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

        // desktop:insert_gui
        if (core.os.name != 'android') {
            if (aDOMWindow.gBrowser) {
				var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
				domWinUtils.removeSheet(gCuiCssUri, domWinUtils.AUTHOR_SHEET);
				domWinUtils.removeSheet(gGenCssUri, domWinUtils.AUTHOR_SHEET);
			}

			contextMenuDestroy(aDOMWindow);
        }
	}
};

// start - Comm functions

// end - Comm functions

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
function formatStringFromNameCore(aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements) {
	// 051916 update - made it core.addon.l10n based
    // formatStringFromNameCore is formating only version of the worker version of formatStringFromName, it is based on core.addon.l10n cache

	try { var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n][aLocalizableStr]; if (!cLocalizedStr) { throw new Error('localized is undefined'); } } catch (ex) { console.error('formatStringFromNameCore error:', ex, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements); } // remove on production

	var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n][aLocalizableStr];
	// console.log('cLocalizedStr:', cLocalizedStr, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements);
    if (aReplacements) {
        for (var i=0; i<aReplacements.length; i++) {
            cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
        }
    }

    return cLocalizedStr;
}
function getSystemDirectory_bootstrap(type) {
	// progrmatic helper for getSystemDirectory in MainWorker - devuser should NEVER call this himself
	return Services.dirsvc.get(type, Ci.nsIFile).path;
}

// specific to nativeshot helper functions
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
function getNativeHandlePtrStr(aDOMWindow) {
	var aDOMBaseWindow = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
								   .getInterface(Ci.nsIWebNavigation)
								   .QueryInterface(Ci.nsIDocShellTreeItem)
								   .treeOwner
								   .QueryInterface(Ci.nsIInterfaceRequestor)
								   .getInterface(Ci.nsIBaseWindow);
	return aDOMBaseWindow.nativeHandle;
}
