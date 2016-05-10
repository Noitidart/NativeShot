////////// start - nativeshot - app_main

// Globals
var gQS;

window.addEventListener('message', function(aWinMsgEvent) {
	// console.error('incoming window message to HTML: iMon:', tQS.iMon, 'aWinMsgEvent:', aWinMsgEvent);
	var aData = aWinMsgEvent.data;
	if (aData.topic in window) {
		window[aData.topic](aData);
	} else {
		throw new Error('unknown topic received: ' + aData.topic);
	}
}, false);

function reactOcrResults(aData) {
	console.log('in reatOcrResults, aData:', aData);
	
	if (aData.error) {
		renderReactError(aData.error);
	} else {
		var imgdata = new ImageData(new Uint8ClampedArray(aData.arrbuf), aData.width, aData.height);
	
		renderReact(aData.result_txt, aData.width, aData.height, imgdata);
	}
}

function nsInitPage(aPostNonSkelInit_CB) {
	
	gQS = queryStringAsJson(window.location.href.substr(window.location.href.indexOf('?') + 1));
	
	// when done must call aPostNonSkelInit_CB();
	contentMMFromContentWindow_Method2(window).sendAsyncMessage(core.addon.id, ['getOcrResults', gQS.text]);
		
	aPostNonSkelInit_CB();
}

function nsOnFocus() {
	// nothing
}

function renderReactError(pErrorTxt) {
	var myContainer = React.createElement(Container, { pErrorTxt });
	
	ReactDOM.render(
		myContainer,
		document.getElementById('main_wrapp')
	);
}

function renderReact(pResultTxtObj, pWidth, pHeight, pImgdata) {
	var myContainer = React.createElement(Container, { pResultTxtObj, pWidth, pHeight, pImgdata });
	
	ReactDOM.render(
		myContainer,
		document.getElementById('main_wrapp')
	);
}

// start - react components
var MyStore = {};
var Container = React.createClass({
    displayName: 'Container',
	getInitialState: function() {
		return {};
	},
	componentDidMount: function() {
		MyStore.setState = this.setState.bind(this);
		document.addEventListener('copy', this.copy, false);
	},
	render: function() {
		var { pResultTxtObj, pImgdata, pWidth, pHeight, pErrorTxt } = this.props;
		
		var cChildren = [];
		
		if (!pErrorTxt) {
			for (var p in pResultTxtObj) {
				cChildren.push(React.createElement(Row, { pImgdata, pWidth, pHeight, pName:p, pTxt:pResultTxtObj[p], sJuxt:this.state['sJuxt-' + p], sNoPre:this.state['sNoPre-' + p] }));
			}
		} else {
			cChildren = React.createElement('div', { className:'padd-80' },
				React.createElement('div', {className:'row'},
					React.createElement('div', { className:('col-lg-12 col-md-12 col-sm-12 col-xs-12') },
						React.createElement('div', {className:'second-caption dataerror'},
							React.createElement('p', null,
								React.createElement('span', null,
									pErrorTxt.toLowerCase()
								)
							)
						)
					)
				)
			);
		}
		
		return React.createElement('div', {className:'container'},
			cChildren
		);
	}
});

var Row = React.createClass({
    displayName: 'Row',
	juxtapose: function() {
		MyStore.setState({
			['sJuxt-' + this.props.pName]: !this.props.sJuxt
		});
	},
	copy: function() {
		contentMMFromContentWindow_Method2(window).sendAsyncMessage(core.addon.id, ['callInBootstrap', ['copyTextToClip', this.props.pTxt]]);
	},
	pre: function() {
		MyStore.setState({
			['sNoPre-' + this.props.pName]: !this.props.sNoPre
		});
	},
	render: function() {

		var { pName, pTxt, sJuxt, sNoPre, pImgdata, pWidth, pHeight } = this.props;
		
		var canRef = function(can) {
			console.log('can:', can);
			if (can) {
				var ctx = can.getContext('2d');
				ctx.putImageData(pImgdata, 0, 0);
			}
		};
		
		return React.createElement('div', {className:'padd-80'},
			React.createElement('div', {className:'row'},
				React.createElement('div', {className:'col-md-12'},
					React.createElement('div', {className:'det-tags'},
						React.createElement('h4', null,
							pName.toUpperCase()
						),
						React.createElement('div', {className:'tags-button'},
							React.createElement('a', { href:'#', onClick:this.copy },
								'Copy'
							),
							React.createElement('a', { href:'#', onClick:this.pre },
								(sNoPre ? 'Original Whitespace' : 'Minimize Whitespace')
							),
							React.createElement('a', { href:'#', onClick:this.juxtapose },
								(sJuxt ? 'Hide Image' : 'Image Compare')
							)
						)
					)
				)
			),
			React.createElement('div', {className:'row'},
				React.createElement('div', { className:(!sJuxt ? 'col-lg-12 col-md-12 col-sm-12 col-xs-12' : 'col-lg-6 col-md-6 col-sm-6 col-xs-6') },
					React.createElement('div', { className:'second-caption' },
						React.createElement('p', null,
							React.createElement('span', { style:(sNoPre ? undefined : {whiteSpace:'pre'}) },
								pTxt
							)
						)
					)
				),
				!sJuxt ? undefined : React.createElement('div', {className:'col-lg-6 col-md-6 col-sm-6 col-xs-6'},
					React.createElement('div', {className:'second-caption'},
						React.createElement('p', null,
							React.createElement('span', null,
								React.createElement('canvas', { ref:canRef, width:pWidth, height:pHeight })
							)
						)
					)
				)
			)
		);
	}
});
// end - react components

// start - common helper functions
// rev3 - https://gist.github.com/Noitidart/725a9c181c97cfc19a99e2bf1991ebd3
function queryStringAsJson(aQueryString) {
	var asJsonStringify = aQueryString;
	asJsonStringify = asJsonStringify.replace(/&/g, '","');
	asJsonStringify = asJsonStringify.replace(/=/g, '":"');
	asJsonStringify = '{"' + asJsonStringify + '"}';
	asJsonStringify = asJsonStringify.replace(/"(-?\d+(?:.\d+)?|true|false)"/g, function($0, $1) { return $1; });
	
	return JSON.parse(asJsonStringify);
}
// end - common helper functions
////////// end - nativeshot - app_main











///////////////// start - framescript skeleton
// Imports
const {interfaces:Ci} = Components;

// Globals
var core = {
	addon: {
		id: 'NativeShot@jetpack' // non-skel
	}
}; // set by initPage
var gCFMM; // needed for contentMMFromContentWindow_Method2

// // Lazy imports
// var myServices = {};
// XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'cp.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

// Start - DOM Event Attachments
function doOnBeforeUnload() {

	contentMMFromContentWindow_Method2(window).removeMessageListener(core.addon.id, bootstrapMsgListener);

}

function doOnContentLoad() {
	console.log('in doOnContentLoad');
	initPage();
}

document.addEventListener('DOMContentLoaded', doOnContentLoad, false);
window.addEventListener('beforeunload', doOnBeforeUnload, false);

// :note: should attach doOnBlur to window.blur after page is init'ed for first time, or if widnow not focused, then attach focus listener link147928272
function ifNotFocusedDoOnBlur() { // was ifNotFocusedAttachFocusListener
	if (!document.hasFocus()) {
		attachFocusListener();
	}
}

function attachFocusListener() {
	// :note: i dont know why im removing focus on blur, but thats how i did it in nativeshot, it must avoid some redundancy
	window.addEventListener('focus', doOnFocus, false);
}

function detachFocusListener() {
	window.removeEventListener('focus', doOnFocus, false);
}

function doOnFocus() {
	detachFocusListener();
	// fetch prefs from bootstrap, and update dom
	nsOnFocus(); // non-skel
}

// End - DOM Event Attachments
// Start - Page Functionalities

function initPage() {
	
	var postNonSkelInit = function() {
		window.addEventListener('blur', attachFocusListener, false); // link147928272
		ifNotFocusedDoOnBlur();
	};
	
	nsInitPage(postNonSkelInit); ///// non-skel
}

// End - Page Functionalities

// start - server/framescript comm layer
// sendAsyncMessageWithCallback - rev3
var bootstrapCallbacks = { // can use whatever, but by default it uses this
	// put functions you want called by bootstrap/server here
	serverCommand_refreshDashboardGuiFromFile: function() {
		// do nothing
	}
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
// end - server/framescript comm layer
// start - common helper functions
function contentMMFromContentWindow_Method2(aContentWindow) {
	if (!gCFMM) {
		gCFMM = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIDocShell)
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIContentFrameMessageManager);
	}
	return gCFMM;

}
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

// rev1 - https://gist.github.com/Noitidart/c4ab4ca10ff5861c720b
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