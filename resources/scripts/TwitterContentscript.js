var core;
var gFsComm;
var callInFramescript, callInMainworker, callInBootstrap;

function preinit() {
	({ callInFramescript, callInMainworker, callInBootstrap } = CommHelper.contentinframescript);
	gFsComm = new Comm.client.content(init);
}

function init() {
	alert('injected content script');
	callInMainworker('fetchCore', undefined, function(aArg, aComm) {
		core = aArg;

		window.addEventListener('unload', unload, false);

	});
}

function uninit() {
	// triggered by uninit of framescript - if i want to do something on unload of page i should create function unload() and addEventListener('unload', unload, false)
	alert('uninit');
	window.removeEventListener('unload', unload, false);
	if (gCover) { gCover.parentNode.removeChild(gCover) }
}

function unload() {
	// if this event listener is still attached, and triggers, it means the page unload or tab was closed
	alert('unloading');
	callInBootstrap('prompt', 'aaa images not yet attached to tweet, and tab closed OR page unloaded');
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
function loadSubScript(path) {
	var script = document.createElement('srcipt');
	script.onload = function() {
		alert('loaded subscript');
	};
	script.setAttribute('src', path);
	document.body.appendChild(script);
}

// startup
if (document.readyState == 'complete') {
	console.log('doc already loaded so do preinit now!');
	preinit();
} else {
	window.addEventListener('DOMContentLoaded', function(e) {
		if (e.target.defaultView.frameElement) {
			// ignore frame
			console.log('DOMContentLoaded a frame so ignore');
			return;
		} else {
			console.error('ok doing preinit now!');
		}
		preinit();
	}, false);
}
