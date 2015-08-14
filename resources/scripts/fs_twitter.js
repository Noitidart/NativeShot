var core = {
	addon: {
		id: 'NativeShot@jetpack'
	}
};
const clientId = new Date().getTime(); // server doesnt generate clientId in this framescript ecosystem
const TWITTER_HOSTNAME = 'twitter.com';

const serverMessageListener = {
	// listens to messages sent from clients (child framescripts) to me/server
	receiveMessage: function(aMsg) {
		console.error('CLIENT recieving msg:', 'this client id:', clientId, 'aMsg:', aMsg);
		switch (aMsg.json.aTopic) {
			/* // i dont have server telling us when to do init in this framescript ecosystem
			case 'serverRequest_clientInit':
					
					// server sends init after i send server clientBorn message
					fsComClient.init(aMsg.json.core);
					
				break;
			*/
			case 'serverRequest_clientShutdown':
			
					unregister();
			
				break;
			// start - devuser edit - add your personal message topics to listen to from server
			case 'serverCommand_attachImgDataURIWhenReady':
			
					serverCommand_attachImgDataURIWhenReady(aMsg.json.imgDataUri, aMsg.json.iIn_arrImgDataUris);
			
				break;
			// end - devuser edit - add your personal message topics to listen to from server
			default:
				console.error('CLIENT unrecognized aTopic:', aMsg.json.aTopic, 'aMsg:', aMsg);
		}
	}
};

function register() {
	// i dont have server telling us when to do init in this framescript ecosystem
	addMessageListener(core.addon.id, serverMessageListener);
	init();
}

function unregister() {
	removeMessageListener(core.addon.id, serverMessageListener);
}

function init() {
	var aContentDocument = content.document;
	if (aContentDocument.readyState.state == 'ready') {
		console.log('twitter already loaded so no need to attach load listener');
		do_openTweetModal();
	} else {
		addEventListener('DOMContentLoaded', listenForTwitterLoad, false);
	}
}

// START - custom functionalities
var twitterReady = false; // set to true after twitter loads, and new tweet modal is opened
function listenForTwitterLoad(aEvent) {
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	if (aContentWindow.frameElement) {
		console.warn('frame element loaded, so dont respond yet');
	} else {
		if (aContentWindow.location.hostname == TWITTER_HOSTNAME) {
			// twitterReady = true;
			removeEventListener('DOMContentLoaded', listenForTwitterLoad, false);
			do_openTweetModal();
		} else {
			console.error('page done loading buts it not twitter:', aContentWindow.location);
		}
	}
}

var pendingAttaches = [];

var imgDataUris = {}; // object so it keeps the iIn_arrImgDataUris straight just in case the async stuff mixes up, which it shouldnt, but im new to framescripts so testing
function serverCommand_attachImgDataURIWhenReady(aImgDataUri, a_iIn_arrImgDataUris) {
	// receives data and ensures its attached in the twitter page
	imgDataUris[a_iIn_arrImgDataUris] = {
		imgDataUri: aImgDataUri,
		uploadedUrl: null,
		attachedToTweet: false
	};
	
	if (twitterReady) {
		do_waitUntil(0, do_overlayIfNoFocus);
	}
}

function do_openTweetModal(aContentWindow) {
	var aContentDocument = content.document;
    var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button'); // id of twitter button :maintain:

    if (!btnNewTweet) {
        throw new Error('global tweet button not found, probably not logged in');
		// :todo: detect if not signed in, then set notification bar accordingly
    }
	
	// :todo: test if open already, if it is, then dont click the button
	btnNewTweet.click();
	
	twitterReady = true;
	
	do_waitUntil(0, do_overlayIfNoFocus);
}

const waitForInterval_ms = 100;
var for_waitUntil_aTest_1_currentPreviewElementsCount = 0;
var for_waitUntil_aTest_1_trying_iIn_arr = -1;
var for_waitUntil_aTest_1_running = false;
function do_waitUntil(aTest, aCB, aOptions) {
	
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	
	if (aTest == 0) {
		var modalTweet = aContentDocument.getElementById('global-tweet-dialog-dialog'); // :maintain: with twitter updates
		if (modalTweet) {
			console.log('PASSED found test 0');
			aCB(modalTweet);
		} else {
			console.log('not yet found test 0');
			setTimeout(function() {
				do_waitUntil(aTest, aCB)
			}, waitForInterval_ms);
		}
	} else if (aTest == 1) {
		// aOptions
			// aMaxTry
			// cTry but this is programttic, never st this as devuser
			// richInputTweetMsg - not an option, must set
			// aCBMaxTried - if aMaxTry supplied must do this
		for_waitUntil_aTest_1_running = true;
		var nowPreviewElementsCount = aOptions.richInputTweetMsg.parentNode.querySelectorAll('.previews .preview').length;
		if (nowPreviewElementsCount == for_waitUntil_aTest_1_currentPreviewElementsCount + 1) {
			console.log('PASSED found test 1');
			for_waitUntil_aTest_1_running = false;
			aCB();
		} else if (nowPreviewElementsCount == for_waitUntil_aTest_1_currentPreviewElementsCount) {
			// not yet attached
			console.log('not yet found test 1');
			if (aOptions.aMaxTry) {
				if (aOptions.cTry) {
					aOptions.cTry++;
				} else {
					aOptions.cTry = 1;
				}
				if (aOptions.cTry >= aOptions.aMaxTry) {
					console.log('FAILED TO MAX ATTEMPTS REACHE on found test 1', 'cTry:', aOptions.cTry, 'aMaxTry:', aOptions.aMaxTry);
					for_waitUntil_aTest_1_running = false;
					aOptions.aCBMaxTried();
				} else {
					setTimeout(function() {
						do_waitUntil(aTest, aCB, aOptions);
					}, waitForInterval_ms);
				}
			} else {				
				setTimeout(function() {
					do_waitUntil(aTest, aCB, aOptions);
				}, waitForInterval_ms);
			}
		}
	}
}

function do_overlayIfNoFocus(modalTweet) {
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	
	var isFocused_aContentWindow = isFocused(aContentWindow);
	if (!isFocused_aContentWindow) {
		// insert note telling them something will happen
		
		if (!modalTweet) {
			modalTweet = aContentDocument.getElementById('global-tweet-dialog-dialog');
		}
		modalTweet = modalTweet.querySelector('.modal-tweet-form-container'); // :maintain: with twitter updates

		var nativeshotNote = aContentDocument.createElement('div');
		nativeshotNote.setAttribute('style', 'background-color:rgba(255,255,255,0.7); position:absolute; width:' + modalTweet.offsetWidth + 'px; height:' + modalTweet.offsetHeight + 'px; z-index:100; top:' + modalTweet.offsetTop + 'px; left:0px; display:flex; align-items:center; justify-content:center; text-align:center; font-weight:bold;');
		
		var nativeshotText = aContentDocument.createElement('span');
		nativeshotText.setAttribute('style', 'margin-top:-60px;');
		nativeshotText.textContent = 'NativeShot will attach images to this tweet when you focus this tab'
		
		nativeshotNote.appendChild(nativeshotText);
		
		modalTweet.insertBefore(nativeshotNote, modalTweet.firstChild);
		
		aContentWindow.addEventListener('focus', function() {
			aContentWindow.removeEventListener('focus', arguments.callee, false);
			modalTweet.removeChild(nativeshotNote);
			do_attachUnattachedsToTweet();
		}, false);
		
		// insert note telling them something will happen
	} else {
		do_attachUnattachedsToTweet();
	}
}

function do_attachUnattachedsToTweet() {
	
	// actually attaches it
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	
	for (var a_iIn_arrImgDataUris in imgDataUris) {
		if (!imgDataUris[a_iIn_arrImgDataUris].attachedToTweet) {
			if (!isFocused(aContentWindow)) {
				console.warn('WARNING: tab not focused when trying to INIT/START attachment!'); // assume this is only triggered when focus is in the tab, if it fires when focus is not, then that is bad
				do_overlayIfNoFocus();
				return;
				// did testing aH!! this was the right way, we only need focus when initing so this comment to right is false thought i had earlier: // may have to move this block contents into do_waitUntil aTest==1
			} else {
				var richInputTweetMsg = aContentDocument.getElementById('tweet-box-global'); // :maintain: with twitter updates
				if (imgDataUris[a_iIn_arrImgDataUris].startedAttach) {
					console.log('found non attachedToTweet element in imgDataUris. found that had already startedAttach, trying to check if it attached by now');
					var nowPreviewElementsCount = richInputTweetMsg.parentNode.querySelectorAll('.previews .preview').length;
					if (nowPreviewElementsCount == for_waitUntil_aTest_1_currentPreviewElementsCount + 1) {
						console.log('ok nowPreviewElementsCount is == to 1+old count, so im assuming yes it attached, POSSIBLY not accurate test, as maybe some other item attached');
						if (for_waitUntil_aTest_1_trying_iIn_arr == a_iIn_arrImgDataUris) {
							console.log('yes the for_waitUntil_aTest_1_trying_iIn_arr is the same as this a_iIn_arrImgDataUris');
							imgDataUris[for_waitUntil_aTest_1_trying_iIn_arr].attachedToTweet = true;
							continue;
						} else {
							console.error('mismatch', 'a_iIn_arrImgDataUris:', a_iIn_arrImgDataUris, 'for_waitUntil_aTest_1_trying_iIn_arr:', for_waitUntil_aTest_1_trying_iIn_arr, 'i didnt think logic this deep as devuser so can use more work here');
							throw new Error('mistmatch on for_waitUntil_aTest_1_trying_iIn_arr and a_iIn_arrImgDataUris!');
						}
					} else if (nowPreviewElementsCount == for_waitUntil_aTest_1_currentPreviewElementsCount) {
						console.error('nowPreviewElementsCount is same as since before it started, so test if its currently still in the do_waitUntil, if it is then just return to wait. IF it is not in do_waitUntil then MAYBE try again, but im not sure if this is accurate');
						if (for_waitUntil_aTest_1_running) {
							console.log('seems like its still running for:', for_waitUntil_aTest_1_trying_iIn_arr);
							if (a_iIn_arrImgDataUris == for_waitUntil_aTest_1_trying_iIn_arr) {
								console.log('which is == to the one im testing, so just return', 'btw the one im testing is:', a_iIn_arrImgDataUris);
								return;
							} else {
								console.error('it is running for SOME OTHER a_iIn_arrImgDataUris! it is running for:', for_waitUntil_aTest_1_trying_iIn_arr, 'and the one im testing the one i found marked still attaching (startedAttach) is:', a_iIn_arrImgDataUris);
								throw new Error('whaaaaa?');
							}
						} else {
							throw new Error('nowPreviewElementsCount is same as since before it started, and NOTHING is running, so wtf  this didnt attach?');
						}
					} else {
						throw new Error('nowPreviewElementsCount is not same nor 1 + before startedAttach - so im confused now as devuser i didnt think logic into this deep');
					}
				}
				for_waitUntil_aTest_1_trying_iIn_arr = a_iIn_arrImgDataUris;
				imgDataUris[for_waitUntil_aTest_1_trying_iIn_arr].startedAttach = true;
				for_waitUntil_aTest_1_currentPreviewElementsCount = richInputTweetMsg.parentNode.querySelectorAll('.previews .preview').length;
				console.info('pre wait count:', for_waitUntil_aTest_1_currentPreviewElementsCount);
				var img = aContentDocument.createElement('img');
				img.setAttribute('src', imgDataUris[a_iIn_arrImgDataUris].imgDataUri);
				richInputTweetMsg.appendChild(img);
				
				var daOptions = {
					aMaxTry: (1000 / waitForInterval_ms) * 5, // try for this many seconds // 10 tries per sec // try * 5 means try 50 times means try for 5 sec
					aCBMaxTried: function() {
						imgDataUris[for_waitUntil_aTest_1_trying_iIn_arr].failedToAttach = true;  // can also use a_iIn_arrImgDataUris instead of the for_waitUntil_aTest_1_trying_iIn_arr, but i feel using for_ is more robust
					},
					richInputTweetMsg: richInputTweetMsg
				};
				
				do_waitUntil(1, function() {
					console.log('succesfully _iIn_arr:', for_waitUntil_aTest_1_trying_iIn_arr, 'took this many attempts:', daOptions.cTry, 'this many seconds:', ((daOptions.cTry * waitForInterval_ms) / 1000));
					imgDataUris[for_waitUntil_aTest_1_trying_iIn_arr].attachedToTweet = true; // can also use a_iIn_arrImgDataUris instead of the for_waitUntil_aTest_1_trying_iIn_arr, but i feel using for_ is more robust
					do_attachUnattachedsToTweet();
				}, daOptions);
				return; // just return here, even though there is a break after this, but for sure we want to quit at this point
			}
			break;
		}
	}
	
	return;
	
	var richInputTweetMsg = aContentDocument.getElementById('tweet-box-global'); // <button#global-new-tweet-button.js-global-new-tweet.js-tooltip btn primary-btn tweet-btn js-dynamic-tooltip> // :maintain:
	
	const actionDelay = 10;
	
	var keysImgDataUris = Object.keys(imgDataUris);
	
	var isFocused_aContentWindow = isFocused(aContentWindow);
	
	if (!isFocused_aContentWindow) {
		// insert note telling them something will happen
		
		var modalTweet = aContentDocument.getElementById('global-tweet-dialog-dialog').querySelector('.modal-tweet-form-container');

		var nativeshotNote = aContentDocument.createElement('div');
		nativeshotNote.setAttribute('style', 'background-color:rgba(255,255,255,0.7); position:absolute; width:' + modalTweet.offsetWidth + 'px; height:' + modalTweet.offsetHeight + 'px; z-index:100; top:' + modalTweet.offsetTop + 'px; left:0px; display:flex; align-items:center; justify-content:center; text-align:center; font-weight:bold;');
		
		var nativeshotText = aContentDocument.createElement('span');
		nativeshotText.setAttribute('style', 'margin-top:-60px;');
		nativeshotText.textContent = 'NativeShot will attach images to this tweet when you focus this tab'
		
		nativeshotNote.appendChild(nativeshotText);
		
		modalTweet.insertBefore(nativeshotNote, modalTweet.firstChild);
		
		aContentWindow.addEventListener('focus', function() {
			aContentWindow.removeEventListener('focus', arguments.callee, false);
			//modalTweet.removeChild(nativeshotNote);
		}, false);
		
		Services.prompt.alert(null, 'not foc', 'overlaid');
		// insert note telling them something will happen
	}
	
	/*
	for (var i=0; i<keysImgDataUris.length; i++) {
		let iHoisted = i;
		if (!imgDataUris[keysImgDataUris[i]].attachedToTweet) {
			imgDataUris[keysImgDataUris[i]].attachedToTweet = true;
			var doit = function() {
				aContentWindow.removeEventListener('focus', arguments.callee, false);
				setTimeout(function() {
					console.log('attaching iHoisted:', (iHoisted + 2) * actionDelay);
					console.info('imgDataUris[keysImgDataUris[iHoisted]].imgDataUri:', '<img src="' + imgDataUris[keysImgDataUris[iHoisted]].imgDataUri + '" />');
					var img = aContentDocument.createElement('img');
					img.setAttribute('src', imgDataUris[keysImgDataUris[iHoisted]].imgDataUri);
					richInputTweetMsg.appendChild(img);
					// richInputTweetMsg.innerHTML += '<img src="' + imgDataUris[keysImgDataUris[iHoisted]].imgDataUri + '" />';
				}, (iHoisted + 2) * actionDelay);
			};
			if (isFocused_aContentWindow) {
				console.log('is focused, so doit');
				doit();
			} else {
				console.log('wasnt focused so adding focus event listener for doit');
				
				aContentWindow.addEventListener('focus', doit, false);
			}
		}
	}
	*/
	// :todo: after attaching, test to verify it attached to tweet
	// :todo: also test for listener on modal close, then notify in user bar that images from tweet detached

}
// END - custom functionalities

// START - helper functions
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
// END - helper functions

register();