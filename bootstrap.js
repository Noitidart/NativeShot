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
			Services.prompt.alert(null, 'shot', 'take');
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

function fetchCore(aArg, aComm) {
    return core;
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
