// Imports
var {interfaces: Ci, manager: Cm, results: Cr, utils:Cu} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);
Cu.importGlobalProperties(['Blob', 'URL']);
var { callInBootstrap, callInMainworker, callInContent } = CommHelper.framescript;

// Globals
var core = {addon: {id:'NativeShot@jetpack'}}; // all that should be needed is core.addon.id, the rest is brought over on init
var gBsComm; // need to set this. instead var because otherwise Comm/Comm.js cant access it
var gWinComm; // need to set this. instead var because otherwise Comm/Comm.js cant access it
var gMM = this;

var MATCH_APP = 1;
var MATCH_TWITTER = 2;
var MATCH_EDITOR = 3;

// start - about module
var aboutFactory;
function AboutPage() {}

function initAndRegisterAbout() {
	// init it
	AboutPage.prototype = Object.freeze({
		classDescription: formatStringFromNameCore('about_desc', 'main'),
		contractID: '@mozilla.org/network/protocol/about;1?what=nativeshot',
		classID: Components.ID('{2079bd20-3369-11e5-a2cb-0800200c9a66}'),
		QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

		getURIFlags: function(aURI) {
			return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT | Ci.nsIAboutModule.ALLOW_SCRIPT | Ci.nsIAboutModule.URI_MUST_LOAD_IN_CHILD;
		},

		newChannel: function(aURI, aSecurity_or_aLoadInfo) {
			var redirUrl;
			if (aURI.path.includes('iMon')) {
				redirUrl = core.addon.path.pages + 'editor.xhtml';
			} else if (aURI.path.toLowerCase().includes('?options')) {
				redirUrl = core.addon.path.pages + 'options.xhtml';
			} else if (aURI.path.toLowerCase().includes('?text')) {
				redirUrl = core.addon.path.pages + 'ocr.xhtml' + aURI.path.substr(aURI.path.indexOf('?text'));
			} else {
				redirUrl = core.addon.path.pages + 'main.xhtml';
			}

			var channel;
			if (Services.vc.compare(core.firefox.version, '47.*') > 0) {
				var redirURI = Services.io.newURI(redirUrl, 'UTF-8', Services.io.newURI('about:screencastify', null, null));
				channel = Services.io.newChannelFromURIWithLoadInfo(redirURI, aSecurity_or_aLoadInfo);
			} else {
				console.log('doing old way');
				channel = Services.io.newChannel(redirUrl, null, null);
			}
			channel.originalURI = aURI;

			return channel;
		}
	});

	// register it
	aboutFactory = new AboutFactory(AboutPage);
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

// start - pageLoader
var pageLoader = {
	// start - devuser editable
	IGNORE_FRAMES: true,
	IGNORE_LOAD: true,
	IGNORE_NONMATCH: true,
	IGNORE_UNLOAD: false,
	matches: function(aHREF, aLocation) {
		// do your tests on aHREF, which is aLocation.href.toLowerCase(), return true if it matches
		var href_lower = aLocation.href.toLowerCase();
		if (href_lower.startsWith('about:nativeshot')) {
			if (href_lower.includes('imon')) {
				return MATCH_EDITOR;
			} else {
				return MATCH_APP;
			}
		} else if (aLocation.host.toLowerCase() == 'twitter.com') {
			return MATCH_TWITTER;
		}
	},
	ready: function(aContentWindow) {
		// triggered on page ready
		// triggered for each frame if IGNORE_FRAMES is false
		// to test if frame do `if (aContentWindow.frameElement)`

		var contentWindow = aContentWindow;
		console.log('PAGE READYYYYYY:', contentWindow.location.href);
		switch (pageLoader.matches(contentWindow.location.href, contentWindow.location)) {
			case MATCH_APP:
					gWinComm = new Comm.server.content(contentWindow);
				break;
			case MATCH_EDITOR:
					console.error('ok loaded editor');
				break;
			case MATCH_TWITTER:
					// var principal = contentWindow.document.nodePrincipal; // contentWindow.location.origin (this is undefined for about: pages) // docShell.chromeEventHandler.contentPrincipal (chromeEventHandler no longer has contentPrincipal)
					// // console.log('contentWindow.document.nodePrincipal', contentWindow.document.nodePrincipal);
					// // console.error('principal:', principal);
					// var sandbox = Cu.Sandbox(principal, {
					// 	sandboxPrototype: contentWindow,
					// 	wantXrays: true, // only set this to false if you need direct access to the page's javascript. true provides a safer, isolated context.
					// 	sameZoneAs: contentWindow,
					// 	wantComponents: false
					// });
					// Services.scriptloader.loadSubScript(core.addon.path.scripts + 'TwitterContentscript.js?' + core.addon.cache_key, sandbox, 'UTF-8');
					//
					// gWinComm = new Comm.server.content(contentWindow);
				break;
		}
	},
	load: function(aContentWindow) {}, // triggered on page load if IGNORE_LOAD is false
	unload: function(aContentWindow) { // triggered on page unload if IGNORE_UNLOAD is false
		var url = aContentWindow.location.href;
		var ready_state = aContentWindow.document.readyState;
		console.warn('PAGE UNLOADING!!!!', 'url:', url, 'ready_state:', ready_state);
		if (gWinComm) {
			console.log('UNREGISTERING gWinComm AS IT WAS EXISTING');
			gWinComm.unregister();
			gWinComm = null;
		}
	},
	error: function(aContentWindow, aDocURI) {
		// triggered when page fails to load due to error
		console.warn('hostname page ready, but an error page loaded, so like offline or something, aHref:', aContentWindow.location.href, 'aDocURI:', aDocURI);
	},
	readyNonmatch: function(aContentWindow) {
		gWinComm = null;
	},
	loadNonmatch: function(aContentWindow) {},
	errorNonmatch: function(aContentWindow, aDocURI) {},
	// not yet supported
	// timeout: function(aContentWindow) {
	// 	// triggered on timeout
	// },
	// timeoutNonmatch: function(aContentWindow) {
	// 	// triggered on timeout
	// },
	// end - devuser editable
	// start - BOILERLATE - DO NOT EDIT
	register: function() {
		// DO NOT EDIT - boilerplate
		addEventListener('DOMContentLoaded', pageLoader.onPageReady, false);
		// addEventListener('DOMWindowCreated', pageLoader.onContentCreated, false);
		if (!pageLoader.IGNORE_UNLOAD) {
			addEventListener('unload', pageLoader.onPageUnload, true); // needs capturing, so can differentiate between tab close and document page unload
		}
	},
	unregister: function() {
		// DO NOT EDIT - boilerplate
		removeEventListener('DOMContentLoaded', pageLoader.onPageReady, false);
		if (!pageLoader.IGNORE_UNLOAD) {
			removeEventListener('unload', pageLoader.onPageUnload, true); // needs capturing, so can differentiate between tab close and document page unload
		}
		// removeEventListener('DOMWindowCreated', pageLoader.onContentCreated, false);
	},
	// onContentCreated: function(e) {
	// 	console.log('onContentCreated - e:', e);
	// 	var contentWindow = e.target.defaultView;
	//
	// 	var readyState = contentWindow.document.readyState;
	// 	console.log('onContentCreated readyState:', readyState, 'url:', contentWindow.location.href, 'location:', contentWindow.location);
	// },
	onPageReady: function(e) {
		// DO NOT EDIT
		// boilerpate triggered on DOMContentLoaded
		// frames are skipped if IGNORE_FRAMES is true

		var contentWindow = e.target.defaultView;
		// console.log('page ready, contentWindow.location.href:', contentWindow.location.href);

		// i can skip frames, as DOMContentLoaded is triggered on frames too
		if (pageLoader.IGNORE_FRAMES && contentWindow.frameElement) { return }

		var href = contentWindow.location.href.toLowerCase();
		if (pageLoader.matches(href, contentWindow.location)) {
			// ok its our intended, lets make sure its not an error page
			var webNav = contentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
			var docURI = webNav.document.documentURI;
			// console.info('docURI:', docURI);

			if (docURI.indexOf('about:neterror') === 0) {
				pageLoader.error(contentWindow, docURI);
			} else {
				// our page ready without error

				if (!pageLoader.IGNORE_LOAD) {
					// i can attach the load listener here, and remove it on trigger of it, because for sure after this point the load will fire
					contentWindow.addEventListener('load', pageLoader.onPageLoad, false);
				}

				pageLoader.ready(contentWindow);
			}
		} else {
			if (!pageLoader.IGNORE_NONMATCH) {
				console.log('page ready, but its not match:', uneval(contentWindow.location));
				var webNav = contentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
				var docURI = webNav.document.documentURI;
				// console.info('docURI:', docURI);

				if (docURI.indexOf('about:neterror') === 0) {
					pageLoader.errorNonmatch(contentWindow, docURI);
				} else {
					// our page ready without error

					if (!pageLoader.IGNORE_LOAD) {
						// i can attach the load listener here, and remove it on trigger of it, because for sure after this point the load will fire
						contentWindow.addEventListener('load', pageLoader.onPageLoadNonmatch, false);
					}

					pageLoader.readyNonmatch(contentWindow);
				}
			}
		}
	},
	onPageLoad: function(e) {
		// DO NOT EDIT
		// boilerplate triggered on load if IGNORE_LOAD is false
		var contentWindow = e.target.defaultView;
		contentWindow.removeEventListener('load', pageLoader.onPageLoad, false);
		pageLoader.load(contentWindow);
	},
	onPageLoadNonmatch: function(e) {
		// DO NOT EDIT
		// boilerplate triggered on load if IGNORE_LOAD is false
		var contentWindow = e.target.defaultView;
		contentWindow.removeEventListener('load', pageLoader.onPageLoadNonmatch, false);
		pageLoader.loadNonmatch(contentWindow);
	},
	onPageUnload: function(e) {
		if (e.target != gMM) {
			var contentWindow = e.target.defaultView;
			if (pageLoader.IGNORE_FRAMES && contentWindow.frameElement) { return }
			pageLoader.unload(contentWindow);
		} // else tab is closing
	}
	// end - BOILERLATE - DO NOT EDIT
};
// end - pageLoader

var progressListener = {
	register: function() {
		if (!docShell) {
			console.error('NO DOCSHEL!!!');
		} else {
			var webProgress = docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebProgress);
			webProgress.addProgressListener(progressListener.listener, Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);
		}
	},
	unregister: function() {
		if (!docShell) {
			console.error('NO DOCSHEL!!!');
		} else {
			var webProgress = docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebProgress);
			webProgress.removeProgressListener(progressListener.listener);
		}
	},
	listener: {
		onStateChange: function(webProgress, aRequest, flags, status) {
			// console.log('progressListener :: onStateChange:', webProgress, aRequest, flags, status);
			// // figure out the flags
			var flagStrs = [];
			for (var f in Ci.nsIWebProgressListener) {
				if (!/a-z/.test(f)) { // if it has any lower case letters its not a flag
					if (flags & Ci.nsIWebProgressListener[f]) {
						flagStrs.push(f);
					}
				}
			}
			// console.info('progressListener :: onStateChange, flagStrs:', flagStrs);

			var url;
			try {
				url = aRequest.QueryInterface(Ci.nsIChannel).URI.spec;
			} catch(ignore) {}
			// console.error('progressListener :: onStateChange, url:', url);

			if (url) {
				var url_lower = url.toLowerCase();
				var window = webProgress.DOMWindow;
				// console.log('progressListener :: onStateChange, DOMWindow:', window);

				// imgur:
					// approve
						// http://127.0.0.1/nativeshot_imgur?state=1468320903449#access_token=5eaec7849849ef33b2301d37a4932e65f3de9770&expires_in=2419200&token_type=bearer&refresh_token=275599cc975f3682746a8d1a42bccdc001bde1f1&account_username=Noitidart&account_id=12688375
					// reject
						// http://127.0.0.1/nativeshot_imgur?error=access_denied&state=1468321161637
				if (url_lower.startsWith('http://127.0.0.1/nativeshot_')) {
					if (flags & Ci.nsIWebProgressListener.STATE_START) {
						aRequest.cancel(Cr.NS_BINDING_ABORTED);
					} else if (flags & Ci.nsIWebProgressListener.STATE_STOP) {
						if (window) {
							var access_denied = url_lower.includes('error=access_denied') || url_lower.includes('denied='); // `denied=` is for twitter, `error=access_denied` is for everything else
							var allowed = !access_denied;
							var serviceid = url_lower.match(/nativeshot_([a-z]+)/)[1];
							// var serviceid = url_lower.substring(url_lower.indexOf('nativeshot_') + 11, url_lower.indexOf('?'));
							if (allowed) {
								callInMainworker('oauthAuthorized', {
									serviceid,
									href: url
								})
							}
							window.location.href = 'about:nativeshot?oauth/' + serviceid + '/' + (allowed ? 'approved' : 'denied');
							console.log('progressListener :: onStateChange, ok replaced');
						}
					}
				} else if (url_lower == 'https://api.twitter.com/oauth/authorize' && (flags & Ci.nsIWebProgressListener.STATE_STOP) && window && window.document.documentElement.innerHTML.includes('nativeshot_twitter?denied=')) {
					// console.log('twitter auth innerHTML:', window.document.body.innerHTML);
					window.location.href = 'about:nativeshot?oauth/twitter/denied';
				}
			}
		},
		QueryInterface: function QueryInterface(aIID) {
			if (aIID.equals(Ci.nsIWebProgressListener) || aIID.equals(Ci.nsISupportsWeakReference) || aIID.equals(Ci.nsISupports)) {
				return progressListener.listener;
			}

			throw Cr.NS_ERROR_NO_INTERFACE;
		}
	}
};

function init() {
	gBsComm = new Comm.client.framescript(core.addon.id);
	console.error('INITING TAB');
	callInMainworker('fetchCore', undefined, function(aArg, aComm) {
		core = aArg;
		console.log('ok updated core to:', core);

		addEventListener('unload', shutdown, true);

		pageLoader.register(); // pageLoader boilerpate
		progressListener.register();

		try {
			initAndRegisterAbout();
		} catch(ignore) {} // its non-e10s so it will throw saying already registered

		// var webNav = content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
		// var docURI = webNav.document.documentURI;
		// console.error('testing matches', content.window.location.href, 'docURI:', docURI);
		var href_lower = content.window.location.href.toLowerCase();
		switch (pageLoader.matches(href_lower, content.window.location)) {
			case MATCH_APP:
					// for about pages, need to reload it, as it it loaded before i registered it
					content.window.location.reload(); //href = content.window.location.href.replace(/https\:\/\/screencastify\/?/i, 'about:screencastify'); // cannot use .reload() as the webNav.document.documentURI is now https://screencastify/
				break;
			case MATCH_TWITTER:
					// for non-about pages, i dont reload, i just initiate the ready of pageLoader
					if (content.document.readyState == 'interactive' || content.document.readyState == 'complete') {
						pageLoader.onPageReady({target:content.document}); // IGNORE_LOAD is true, so no need to worry about triggering load
					}
				break;
		}
	});
}

function shutdown(e) {
	if (e.target == gMM) {
		// ok this content frame message manager is shutting down
		uninit();
	}
}

function uninit() { // link4757484773732
	// an issue with this unload is that framescripts are left over, i want to destory them eventually

	console.error('DOING UNINIT');

	pageLoader.unregister(); // pageLoader boilerpate
	progressListener.unregister();

	if (gWinComm) { // this only should happen if tab is not closing
		callInContent('uninit');
	}

	Comm.server.unregAll('content');
	Comm.client.unregAll('framescript');

	if (aboutFactory) {
		aboutFactory.unregister();
	}

	removeEventListener('unload', shutdown, true);
}

function isTwitterLoaded(aArg) {
	// returns
		// true - good and ready
		// false - not twitter
		// null - is twitter but error
	var contentWindow = content;

	var contentDocument = contentWindow.document;
	console.log('contentDocument.readyState:', contentDocument.readyState);

	if (pageLoader.matches(contentWindow.location.href, contentWindow.location) == MATCH_TWITTER) {
		var contentDocument = contentWindow.document;
		if (contentDocument.readyState == 'interactive' || contentDocument.readyState == 'complete') {
			var webnav = contentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
			var docuri = webnav.document.documentURI;
			// console.info('docuri:', docuri);

			if (docuri.indexOf('about:neterror') === 0) {
				return null;
			} else {
				return true;
			}
		}
	} else {
		return false;
	}
}

function injectToTwitter(aArg) {
	var deferredmain_injecttotwitter = new Deferred();

	var contentWindow = content;

	var principal = contentWindow.document.nodePrincipal; // contentWindow.location.origin (this is undefined for about: pages) // docShell.chromeEventHandler.contentPrincipal (chromeEventHandler no longer has contentPrincipal)
	// console.log('contentWindow.document.nodePrincipal', contentWindow.document.nodePrincipal);
	// console.error('principal:', principal);
	var sandbox = Cu.Sandbox(principal, {
		sandboxPrototype: contentWindow,
		wantXrays: true, // only set this to false if you need direct access to the page's javascript. true provides a safer, isolated context.
		sameZoneAs: contentWindow,
		wantComponents: false
	});
	Services.scriptloader.loadSubScript(core.addon.path.scripts + 'comm/Comm.js?' + core.addon.cache_key, sandbox, 'UTF-8');
	Services.scriptloader.loadSubScript(core.addon.path.scripts + 'TwitterContentscript.js?' + core.addon.cache_key, sandbox, 'UTF-8');

	gWinComm = new Comm.server.content(contentWindow, function() {
		deferredmain_injecttotwitter.resolve();
	});

	return deferredmain_injecttotwitter.promise;
}

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
// end - common helper functions

// startup
init();
