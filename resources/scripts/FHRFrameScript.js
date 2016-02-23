const {classes:Cc, interfaces:Ci} = Components;
console.log('FHRFrameScript loaded, this:', Components.stack, Components.stack.filename);
var gFhrFsMsgListenerId = Components.stack.filename.match(/fhrFsMsgListenerId=([^&]+)/)[1]; // Components.stack.filename == "chrome://nativeshot/content/resources/scripts/FHRFrameScript.js?fhrFsMsgListenerId=NativeShot@jetpack-fhr_1&v=0.2623310905363082"

//////////////////////////////////////////////////////// start - boilerplate
// start - rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5
var core = {
	addon: {
		id: gFhrFsMsgListenerId // heeded for rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5
	}
}

var bootstrapCallbacks = { // can use whatever, but by default it uses this
	// put functions you want called by bootstrap/server here
};
const SAM_CB_PREFIX = '_sam_gen_cb_';
var sam_last_cb_id = -1;
function sendAsyncMessageWithCallback(aMessageManager, aGroupId, aMessageArr, aCallbackScope, aCallback) {
	sam_last_cb_id++;
	var thisCallbackId = SAM_CB_PREFIX + sam_last_cb_id;
	aCallbackScope = aCallbackScope ? aCallbackScope : bootstrap; // :todo: figure out how to get global scope here, as bootstrap is undefined
	aCallbackScope[thisCallbackId] = function(aMessageArr) {
		delete aCallbackScope[thisCallbackId];
		aCallback.apply(null, aMessageArr);
	}
	aMessageArr.push(thisCallbackId);
	aMessageManager.sendAsyncMessage(aGroupId, aMessageArr);
}
var bootstrapMsgListener = {
	funcScope: bootstrapCallbacks,
	receiveMessage: function(aMsgEvent) {
		var aMsgEventData = aMsgEvent.data;
		console.log('framescript getting aMsgEvent, unevaled:', uneval(aMsgEventData));
		// aMsgEvent.data should be an array, with first item being the unfction name in this.funcScope
		
		var callbackPendingId;
		if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
			callbackPendingId = aMsgEventData.pop();
		}
		
		var funcName = aMsgEventData.shift();
		if (funcName in this.funcScope) {
			var rez_fs_call = this.funcScope[funcName].apply(null, aMsgEventData);
			
			if (callbackPendingId) {
				// rez_fs_call must be an array or promise that resolves with an array
				if (rez_fs_call.constructor.name == 'Promise') {
					rez_fs_call.then(
						function(aVal) {
							// aVal must be an array
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, aVal]);
						},
						function(aReason) {
							console.error('aReject:', aReason);
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aReason]]);
						}
					).catch(
						function(aCatch) {
							console.error('aCatch:', aCatch);
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aCatch]]);
						}
					);
				} else {
					// assume array
					contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, rez_fs_call]);
				}
			}
		}
		else { console.warn('funcName', funcName, 'not in scope of this.funcScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out
		
	}
};
contentMMFromContentWindow_Method2(content).addMessageListener(core.addon.id, bootstrapMsgListener);

var gCFMM;
function contentMMFromContentWindow_Method2(aContentWindow) {
	if (!gCFMM) {
		gCFMM = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIDocShell)
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIContentFrameMessageManager);
	}
	return gCFMM;

}
// end - rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5



// start - common helpers
function Deferred() { // rev3 - https://gist.github.com/Noitidart/326f1282c780e3cb7390
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

function xpcomSetTimeout(aNsiTimer, aDelayTimerMS, aTimerCallback) {
	aNsiTimer.initWithCallback({
		notify: function() {
			aTimerCallback();
		}
	}, aDelayTimerMS, Ci.nsITimer.TYPE_ONE_SHOT);
}
// end - common helpers
//////////////////////////////////////////////////////// end - boilerplate

// START - framescript functionality

contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, ['FHRFrameScriptReady']);

var pageLoading = false;
var gMainDeferred_loadPage; // resolve it with what you usually resolve XHR with, well as much as you can
/*
// resolve with:
statusText - whatever string explaining status
status - failed or ok
and any other stuff
*/
var gTimeout = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer); // hold timeout object
var gTimeoutMs = 10000;

var bootstrapCallbacks = { // can use whatever, but by default it uses this
	// put functions you want called by bootstrap/server here
	loadPage: function(aSrc, aClickSetName, aCallbackSetName) {
		// if want to load page by click, then set aClickSetName
		// must set aSrc OR aClickSetName never both!
		if (aSrc && aClickSetName) {
			console.error('must set aSrc OR aClickSetName never both!');
			throw new Error('must set aSrc OR aClickSetName never both!');
		}
		
		if (pageLoading) {
			throw new Error('cannot load yet, as previous page is still loading');
		}
		
		
		gMainDeferred_loadPage = new Deferred();
		
		pageLoading = true;
		addEventListener('DOMContentLoaded', pageLoaded.bind(null, aCallbackSetName), false);
		
		xpcomSetTimeout(gTimeout, gTimeoutMs, pageTimeouted); //gTimeout = setTimeout(pageTimeouted, gTimeoutMs);
		
		if (aSrc) {
			content.location = aSrc;
		} else if (aClickSetName) {
			if (!clickSet[aClickSetName]) {
				console.error('clickSet name not found!! aClickSetName:', aClickSetName);
				throw new Error('clickSet name not found!!');
			}
			
			// try clicking in all frames
			var contentWindow = content;
			var contentFrames = contentWindow.frames;
			var contentWindowArr = [contentWindow];
			for (var i=0; i<contentFrames.length; i++) {
				contentWindowArr.push(contentFrames[i].window);
			}
	
			var rez_clickExec;
			clickExec_winLoop:
			for (var h=0; h<contentWindowArr.length; h++) {
				console.log('h:', h, 'contentWindowArr[h].document.documentElement.innerHTML:', contentWindowArr[h].document.documentElement.innerHTML);
				for (var i=0; i<clickSet[aClickSetName].length; i++) {
					rez_clickExec = clickSet[aClickSetName][i].exec(contentWindowArr[h], contentWindowArr[h].document);
					if (rez_clickExec) {
						break clickExec_winLoop;
					}
				}
			}
			if (!rez_clickExec) {
				console.log('all click instructions failed!');				
				loadPage_finalizer(
					{
						status: 'fail',
						statusText: 'click-set-failed'
					},
					false
				);
			}
		} else {
			console.error('should never ever get here');
			throw new Error('should never ever get here');
		}
		
		return gMainDeferred_loadPage.promise;
	},
	destroySelf: function() {
		contentMMFromContentWindow_Method2(content).removeMessageListener(core.addon.id, bootstrapMsgListener);
		console.log('ok destroyed self');
	}
};

bootstrapMsgListener.funcScope = bootstrapCallbacks; // need to do this, as i setup bootstrapMsgListener above with funcScope as bootstrapCallbacks however it is undefined at that time

function pageTimeouted() {	
	loadPage_finalizer(
		{
			status: 'fail',
			statusText: 'timeout'
		},
		true
	);
}

function pageLoaded(aCallbackSetName, e) {
	// waits till the loaded event triggers on top window not frames
	var contentWindow = e.target.defaultView;
	var contentDocument = contentWindow.document;
	
	if (contentWindow.frameElement) {
		// top window not yet loaded
	} else {
		// ok top finished loading

		loadPage_finalizer();
		
		var webnav = contentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
		var docuri = webnav.document.documentURI;
		
		if (docuri.indexOf('about:') === 0 && docuri.indexOf('127.0.0.1/nativeshot') == -1) { // because i used http://127.0.0.1/nativeshot it will fail load on allow as well, so i have to detect that here
			// failed loading
			loadPage_finalizer(
				{
					status: 'fail',
					statusText: 'error-loading',
					docuri: docuri
				},
				false
			);
			
			// about:neterror?e=connectionFailure&u=http%3A//127.0.0.1/folder_name%3Fstate%3Dblah%23access_token%3Dfda25d1a39fd974a08a0485eccd8cd752ae16dd4%26expires_in%3D2419200%26token_type%3Dbearer%26refresh_token%3D32f7854e11b0091c6206d6ff3668a1f6f4f99c52%26account_username%3DNoitidart%26account_id%3D12688375&c=UTF-8&f=regular&d=Firefox%20can%27t%20establish%20a%20connection%20to%20the%20server%20at%20127.0.0.1.
		} else {
			// test all frames with callback set
			// if none of the tests of the callback for that return for that frame, then try next frame.
				// if none of the frames then report failed callbacks fhrResponse object
				
			var contentFrames = contentWindow.frames;
			var contentWindowArr = [contentWindow];
			for (var i=0; i<contentFrames.length; i++) {
				contentWindowArr.push(contentFrames[i].window);
			}
	
			for (var h=0; h<contentWindowArr.length; h++) {
				console.log('h:', h, 'contentWindowArr[h].document.documentElement.innerHTML:', contentWindowArr[h].document.documentElement.innerHTML);
				for (var i=0; i<callbackSet[aCallbackSetName].length; i++) {
					var rezTest = callbackSet[aCallbackSetName][i].test(contentWindowArr[h], contentWindowArr[h].document);
					if (rezTest) {
						gMainDeferred_loadPage.resolve([rezTest]);
						return;
					}
				}
			}
			loadPage_finalizer(
				{
					status: 'fail',
					statusText: 'failed-callbackset',
					callbackSetName: aCallbackSetName
				},
				false
			);
			
		}
	}
}

function loadPage_finalizer(aFHRResponse, aDoStop) {
	
	if (aDoStop) {
		content.stop();
	}
	
	gTimeout.cancel(); //clearTimeout(gTimeout);
	pageLoading = false;
	removeEventListener('DOMContentLoaded', pageLoaded, false);
	
	if (aFHRResponse) {
		gMainDeferred_loadPage.resolve([aFHRResponse]);
	}
}

// custom callbacks specific to NativeShot
var callbackSet = {
	// each entry, is an array of objects
	// each object has to have a test function which takes are contentWindow, contentDocument. and a fhrResponse object that it returns
	//// dropbox
	authorizeApp_dropbox: [
		// {
		// 	fhrResponse: 'testing!!', // string just for test, it should be a fhrResponse object // nice test shows, this.fhrResponse within .test() is accessing the right thing, which is this thing
		// 	test: function(aContentWindow, aContentDocument) { // must return fhrResponse obj, else it must return undefined/null
		// 		// if test succesful, then it returns resolveObj, it may update some stuff in resolveObj
		// 		console.log('this.fhrResponse:', this.fhrResponse);
		// 	}
		// },
		{
			fhrResponse: {
				status: 'fail',
				statusText: 'api-error',
				apiText: '' // populated by .test()
			},
			test: function(aContentWindow, aContentDocument) {
				var errorDomEl = aContentDocument.getElementById('errorbox');
				if (errorDomEl) { // :maintain-per-website:
					this.fhrResponse.apiText = errorDomEl.innerHTML;
					return this.fhrResponse;
				}
			}
		},
		{
			fhrResponse: {
				status: 'fail',
				statusText: 'not-logged-in',
			},
			test: function(aContentWindow, aContentDocument) {
				var domEl = aContentDocument.getElementById('login-content');
				if (domEl) { // :maintain-per-website:
					return this.fhrResponse;
				}
			}
		},
		{
			fhrResponse: {
				status: 'ok',
				statusText: 'logged-in-allow-screen',
				username: '' // set by .test() // so oauth worker can test prefs to see if this username was allowed yet
			},
			test: function(aContentWindow, aContentDocument) {
				
					// :maintain-per-website:
					var domEl = aContentDocument.querySelector('.auth-button[name=allow_access]');
					if (domEl) {
						var preStart_index = aContentDocument.documentElement.innerHTML.indexOf('"email": "');
						var start_index = preStart_index + '"email": "'.length;
						var end_index = aContentDocument.documentElement.innerHTML.indexOf('"', start_index);
						
						if (preStart_index > -1 && end_index > -1) {
							var username = aContentDocument.documentElement.innerHTML.substr(start_index, end_index);
							console.log('username:', username);
							this.fhrResponse.username = username;
							return this.fhrResponse;
						}
						console.error('failed to get username');
					}
				

			}
		}
	],
	allow_dropbox: [
		{
			fhrResponse: {
				status: 'ok',
				statusText: 'allowed',
				allowedParams: '' // set by .test()
			},
			test: function(aContentWindow, aContentDocument) {
				
				var webnav = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
				var docuri = webnav.document.documentURI;
				console.log('docuri:', docuri);
				
				if (docuri.indexOf('about:') === 0) {
					console.log('aContentWindow.location.href:', aContentWindow.location.href);
					console.log('aContentWindow.location.hash:', aContentWindow.location.hash);
					
					var receivedParamsFullStr = aContentWindow.location.hash[0] == '#' ? aContentWindow.location.hash.substr(1) : aContentWindow.location.hash;
					var receivedParamsPiecesStrArr = receivedParamsFullStr.split('&');
					
					var receivedParamsKeyVal = {};
					for (var i=0; i<receivedParamsPiecesStrArr.length; i++) {
						var splitPiece = receivedParamsPiecesStrArr[i].split('=');
						receivedParamsKeyVal[splitPiece[0]] = splitPiece[1];
					}
					
					this.fhrResponse.allowedParams = receivedParamsKeyVal;
					return this.fhrResponse;	
				}
			}
		}
	],
	//// imgur
	authorizeApp_imgur: [
		{
			fhrResponse: {
				status: 'fail',
				statusText: 'not-logged-in',
			},
			test: function(aContentWindow, aContentDocument) {
				var domEl = aContentDocument.getElementById('password');
				if (domEl) { // :maintain-per-website:
					return this.fhrResponse;
				}
			}
		},
		{
			fhrResponse: {
				status: 'ok',
				statusText: 'logged-in-allow-screen',
				username: '' // set by .test() // so oauth worker can test prefs to see if this username was allowed yet
			},
			test: function(aContentWindow, aContentDocument) {
				var domEl = aContentDocument.getElementById('upload-global-logged-in');
				if (domEl) { // :maintain-per-website:
				
					var loggedInUserDomEl = domEl.querySelector('.green');
					if (loggedInUserDomEl) {
						this.fhrResponse.username = loggedInUserDomEl.textContent;
					}
					return this.fhrResponse;
				}
			}
		}
	],
	allow_imgur: [
		{
			fhrResponse: {
				status: 'ok',
				statusText: 'allowed',
				allowedParams: '' // set by .test()
			},
			test: function(aContentWindow, aContentDocument) {
				
				var webnav = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
				var docuri = webnav.document.documentURI;
				console.log('docuri:', docuri);
				
				if (docuri.indexOf('about:') === 0) {
					console.log('aContentWindow.location.href:', aContentWindow.location.href);
					console.log('aContentWindow.location.hash:', aContentWindow.location.hash);
					
					var receivedParamsFullStr = aContentWindow.location.hash[0] == '#' ? aContentWindow.location.hash.substr(1) : aContentWindow.location.hash;
					var receivedParamsPiecesStrArr = receivedParamsFullStr.split('&');
					
					var receivedParamsKeyVal = {};
					for (var i=0; i<receivedParamsPiecesStrArr.length; i++) {
						var splitPiece = receivedParamsPiecesStrArr[i].split('=');
						receivedParamsKeyVal[splitPiece[0]] = splitPiece[1];
					}
					
					this.fhrResponse.allowedParams = receivedParamsKeyVal;
					return this.fhrResponse;	
				}
			}
		}
	]
	//// 
}

callbackSet.authorizeApp_imgur.push(callbackSet.allow_imgur[0]); // because going to authorizeApp_imgur goes directly as if allow_imgur if user had previously (non-locally) allowed it (so meaning on their servers) i add in the allow_imgur block to the above, without duplicating copy paste
callbackSet.authorizeApp_dropbox.push(callbackSet.allow_dropbox[0]);

var clickSet = {

	//// dropbox
	allow_dropbox: [
		{
			// fhrRequest: { // the allow button as of 02216 when user is logged in
			// 	statusText: 'this is fhrRequest object, this is just for my notes.'
			// },
			exec: function(aContentWindow, aContentDocument) {
				var domEl = aContentDocument.querySelector('.auth-button[name=allow_access]');
				if (domEl) {
					domEl.click();
				}
				return true;
			}
		}
	],
	//// imgur
	allow_imgur: [
		{
			// fhrRequest: { // the allow button as of 02216 when user is logged in
			// 	statusText: 'this is fhrRequest object, this is just for my notes.'
			// },
			exec: function(aContentWindow, aContentDocument) {
				var domEl = aContentDocument.getElementById('allow');
				if (domEl) {
					domEl.click();
				}
				return true;
			}
		}
	]
}

// END - framescript functionality