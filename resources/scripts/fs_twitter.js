// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
// Cu.import('resource://gre/modules/XPCOMUtils.jsm'); // frame scripts already have this loaded

// Globals
var core = {
	addon: {
		id: 'NativeShot@jetpack',
		path: {
			content_accessible: 'chrome://nativeshot-accessible/content/'
		}
	}
};
const gContentFrameMessageManager = this;
var clientId; // i set it to userAckId
var userAckId;
var FSRegistered = false;
var FSInited = false;
const TWITTER_HOSTNAME = 'twitter.com';
const TWITTER_IMAGE_SUBSTR = 'https://pbs.twimg.com/media/';
var TWITTER_IMAGE_SUBSTR_REGEX = /\.twimg\.com/i;
var gTweeted = false; // set to true on succesful tweet

// Lazy Imports
const myServices = {};

const serverMessageListener = {
	// listens to messages sent from clients (child framescripts) to me/server
	receiveMessage: function(aMsg) {
		console.error('CLIENT recieving msg:', 'this client id:', clientId, 'aMsg:', aMsg);
		switch (aMsg.json.aTopic) {
			case 'serverCommand_clientInit':
					
					// server sends init after i send server clientBorn message
					fsComClient.init(aMsg.json.core, aMsg.json.userAckId);
					
				break;
			case 'serverCommand_clientShutdown':
			
					unregReason = 'server-command';
					unregister();
			
				break;
			// start - devuser edit - add your personal message topics to listen to from server
			case 'serverCommand_attachImgDataURIWhenReady':
			
					if (!FSInited) { console.error('frame scirpt not yet inited, ignoring msg:', aMsg.josn) }
					serverCommand_attachImgDataURIWhenReady(aMsg.json.imgDataUri, aMsg.json.iIn_arrImgDataUris);
			
				break;
			case 'serverCommand_reOpenTweetModal':
			
					if (!FSInited) { console.error('frame scirpt not yet inited, ignoring msg:', aMsg.josn) }
					do_openTweetModal();
			
				break;
			// end - devuser edit - add your personal message topics to listen to from server
			default:
				console.error('CLIENT unrecognized aTopic:', aMsg.json.aTopic, 'aMsg:', aMsg);
		}
	}
};

function fsUnloaded(aEvent) {
	if (aEven.target == gContentFrameMessageManager) {
		// frame script unloaded, tab was closed
		// :todo: check if the tweet was submitted, if it wasnt, then notif parent to make the notification-bar button to a "open new tab and reattach"
		unregReason = 'tab-closed';
		unregister();
	}
}

function register() {
	// i dont have server telling us when to do init in this framescript ecosystem
	FSRegistered = true;
	
	addMessageListener(core.addon.id, serverMessageListener);
	
	addEventListener('unload', fsUnloaded, false);	
}

var unregReason;
function unregister() {
	FSRegistered = false;
	console.error('unregistering!!!!!');
	
	removeEventListener('unload', fsUnloaded, false);
	removeEventListener('DOMContentLoaded', listenForTwitterLoad, false);
	removeEventListener('DOMContentLoaded', listenForTwitterSignIn, false);
	
	try {
		removeMessageListener(core.addon.id, serverMessageListener);
	} catch(ignore) {
		console.info('failed to removeMessageListener probably because tab is already dead, ex:', ignore);
	}
	
	try {
		var aContentWindow = content;
		var aContentDocument = content.document;
	} catch (ignore) {} // content goes to null when tab is killed
	
	if (aContentWindow) {
		aContentWindow.removeEventListener('unload', listenForTwittterUnload, false);
		
		var myUnregScript = aContentDocument.createElement('script');
		myUnregScript.setAttribute('src', core.addon.path.content_accessible + 'twitter_unregister.js');
		myUnregScript.setAttribute('id', 'nativeshot_twitter_unregister');
		myUnregScript.setAttribute('nonce', aContentDocument.querySelector('script[nonce]').getAttribute('nonce'));
		aContentDocument.documentElement.appendChild(myUnregScript);
		
		aContentWindow.removeEventListener('nativeShot_notifyDialogClosed', on_nativeShot_notifyDialogClosed, false, true);
		aContentWindow.removeEventListener('nativeShot_notifyDataTweetSuccess', on_nativeShot_notifyDataTweetSuccess, false, true);
		aContentWindow.removeEventListener('nativeShot_notifyDataTweetError', on_nativeShot_notifyDataTweetError, false, true);
		
		if (waitForFocus_forAttach) {
			aContentWindow.removeEventListener('focus', waitForFocus_forAttach, false);
		}
	}
	
	var sendAsyncJson = {aTopic:'clientNotify_clientUnregistered', userAckId:userAckId, tweeted:gTweeted, subServer:'twitter', unregReason:unregReason};
	if (unregReason == 'tweet-success') {
		// then add in the clipboard stuff
		sendAsyncJson.clips = succesfullyTweetedClips;
	}
	sendAsyncMessage(core.addon.id, sendAsyncJson);
}

function listenForTwitterSignIn(aEvent) {
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	if (aContentWindow.frameElement) {
		//console.warn('frame element loaded, so dont respond yet');
	} else {
		if (aContentWindow.location.hostname == TWITTER_HOSTNAME) {
			var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button');
			if (!btnNewTweet) {
				console.warn('still not signed in yet');
			} else {
				// signed in now
				do_openTweetModal();
			}
		} else {
			console.warn('page done loading buts it not twitter, so keep listener attached, im waiting for twitter:', aContentWindow.location);
		}
	}
}

function on_nativeShot_notifyDataTweetError(aEvent) {
	// :todo: tell notification-bar that tweet was submited and failed
	var a = aEvent.detail.a;
	var b = aEvent.detail.b;
	
	console.error('tweet submission came back error, aEvent:', {aEvent: aEvent,a: a, b: b});
	
	var refDetails;
	if (b.tweetboxId) {
		refDetails = b;
	} else {
		refDetails = b.sourceEventData;
	}
}

var succesfullyTweetedClips;
function on_nativeShot_notifyDataTweetSuccess(aEvent) {
	// :todo: tell notification-bar that tweet was submited succesfully, and is now waiting to receive uploaded image urls
	var a = aEvent.detail.a;
	var b = aEvent.detail.b;
	
	console.error('tweet success baby, aEvent:', {aEvent: aEvent,a: a, b: b});
	
	var refDetails;
	if (b.tweetboxId) {
		refDetails = b;
	} else {
		refDetails = b.sourceEventData;
	}
	
	var clips = {
		tweet_id: refDetails.tweet_id
	}; // key is img id, vaulue is img url, key of 'tweet' holds tweet_id, on the server side, convert this id to a url to the tweet
	
	var parser = new DOMParser();
	var parsedDocument = parser.parseFromString(refDetails.tweet_html, 'text/html');
	
	var tweetUrl = parsedDocument.querySelector()
	var photos = parsedDocument.querySelectorAll('div[class^="photo-"]');
	for (var i=0; i<photos.length; i++) {
		var imgIdOfPhotoMatch = /photo-(\d)/.match(photos[i].classList);
		if (!imgIdOfPhoto) {
			throw new Error('id could not be detected for photo, maybe twitter changed and have photo-NON_DIGIT class now');
		}
		var imgIdOfPhoto = imgIdOfPhotoMatch[1];
		
		if (imgIdOfPhoto in imgIdsAttached_andPreviewIndex) {
			clips[imgIdOfPhoto] = photos[i].data.url;
		} // else, this is possible, as if user deleted a preview then attached another // :todo: when user does delete a preview, then the previewIndex of my attached images after that index should be reduced by 1
	}
	gTweeted = true;
	
	
	console.info('clips:', clips);
	
	succesfullyTweetedClips = clips;
	unregReason = 'tweet-success';
	unregister();
}

function on_nativeShot_notifyDialogClosed(aEvent) {
	console.error('tweet dialog closed, aEvent:', aEvent);
	if (!gTweeted) {
		// :todo: tell notification-bar that tweet was lost due to closed tweet, offer on click to openTweetModal and reattach
		sendAsyncMessage(core.addon.id, {aTopic:'clientNotify_tweetClosedWithoutSubmit', clientId:clientId, subServer:'twitter'});
	}
}
// step 0
function init(aCore, aUserAckId) {
	userAckId = aUserAckId;
	core = aCore;
	
	FSInited = true;
	
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	if (aContentDocument.readyState.state == 'ready' && aContentWindow.location.hostname == TWITTER_HOSTNAME) {
		ensureSignedIn();
		aContentWindow.addEventListener('unload', listenForTwittterUnload, false);
	} else {
		console.error('adding listener for twitter load');
		addEventListener('DOMContentLoaded', listenForTwitterLoad, false); // add listener to listen to page loads  till it finds twitter page
	}
	
	// :todo: absolutely ensure we are on home page, meaning users timeline, because when user submits tweet, if they are not on timeline, then the images are not loaded and i wont be able to get their uploaded image urls
	// :todo: detect if user clicks on "x" of any of the previews, then that should be removed from notification-bar, to identify which one got x'ed i can identify by on attach, i wait till it gets attached right, so on attach get that upload id. maybe just addEventListener on those preview x's, it seems you cant tab to it, so this is good, just attach click listeners to it
}

// step 0.5 // decimal steps are optional, they may not happen
function listenForTwitterLoad(aEvent) {
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	if (aContentWindow.frameElement) {
		console.warn('frame element loaded, so dont respond yet');
	} else {
		if (aContentWindow.location.hostname == TWITTER_HOSTNAME) {
			// twitterReady = true;
			removeEventListener('DOMContentLoaded', listenForTwitterLoad, false);
			aContentWindow.addEventListener('unload', listenForTwittterUnload, false);
			ensureSignedIn();
		} else {
			console.error('page done loading buts it not twitter, so keep listener attached, im waiting for twitter:', aContentWindow.location);
			sendAsyncMessage(core.addon.id, {aTopic:'clientNotify_nonTwitterPage_onLoadComplete', userAckId:userAckId, subServer:'twitter'});
		}
	}
}

// step 1
function ensureSignedIn() {
	// test if signed in
	var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button');
	if (!btnNewTweet) {
		// assume not signed in
		// add listener listening to sign in
		addEventListener('DOMContentLoaded', listenForTwitterSignIn, false);
		sendAsyncMessage(core.addon.id, {aTopic:'clientNotify_twitterNotSignedIn', userAckId:userAckId, subServer:'twitter'});
		return false;
	} else {
		registerJqueryScript();
		return true;
	}
}

// step 2
function registerJqueryScript() {
	aContentWindow.addEventListener('nativeShot_notifyDialogClosed', on_nativeShot_notifyDialogClosed, false, true);
	aContentWindow.addEventListener('nativeShot_notifyDataTweetSuccess', on_nativeShot_notifyDataTweetSuccess, false, true);
	aContentWindow.addEventListener('nativeShot_notifyDataTweetError', on_nativeShot_notifyDataTweetError, false, true);
	
	aContentWindow.addEventListener('nativeShot_notifyJqueryRegistered', on_nativeShot_notifyJqueryRegistered, false, true);
	
	var myRegScript = aContentDocument.createElement('script');
	myRegScript.setAttribute('src', core.addon.path.content_accessible + 'twitter_register.js');
	myRegScript.setAttribute('id', 'nativeshot_twitter_register');
	myRegScript.setAttribute('nonce', aContentDocument.querySelector('script[nonce]').getAttribute('nonce'));
	aContentDocument.documentElement.appendChild(myRegScript);
}

// step 3
function on_nativeShot_notifyJqueryRegistered(aEvent) {
	jqueryScriptRegistered = true;
	aContentWindow.removeEventListener('nativeShot_notifyJqueryRegistered', on_nativeShot_notifyJqueryRegistered, false, true);
	do_openTweetModal();
}

// step 4 and step 10
function do_clientNotify_FSReadyToAttach() {
	FSReadyToAttach = true;
	sendAsyncMessage(core.addon.id, {aTopic:'clientNotify_FSReadyToAttach', userAckId:userAckId, subServer:'twitter'});
}

// step 5 ---- this is entry point from server when FSReadyToAttach is true
function do_openTweetModal(aImgId, aImgDataUrl) {
	if (!FSReadyToAttach) {
		throw new Error('in do_openTweetModal but FSReadyToAttach is false so this should never have happened');
	}
	FSReadyToAttach = false;
	
	currentlyAttaching.imgId = aImgId;
	currentlyAttaching.imgDataUrl = aImgDataUrl;
	
	var aContentWindow = content;
	var aContentDocument = content.document;
	
	var dialogTweet = aContentDocument.getElementById('global-tweet-dialog');
	if (!dialogTweet) {
		throw new Error('no tweet dialog, no clue why, this should not happen, as i did the signed in check in init');
	}
	
	if (aContentWindow.getComputedStyle(dialogTweet, null).getPropertyValue('display') == 'none') { // test if open already, if it is, then dont click the button
		// its closed, so lets open it
		var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button'); // id of twitter button :maintain:
		if (!btnNewTweet) {
			// assume not signed in as checked if signed in earlier in the process
			// so if got here, then wtf i dont know whats wrong
			throw new Error('wtf, should never get here');
		}
		
		btnNewTweet.click();
	}
	
	do_clientNotify_FSReadyToAttach();
}

// step 6
var tweetDialogDialog;
function do_waitForTweetDialogToOpen() {
	var aContentWindow = content;
	var aContentDocument = content.document;
	
	tweetDialogDialog = aContentDocument.getElementById('global-tweet-dialog-dialog'); // :maintain: with twitter updates
	if (tweetDialogDialog) {
		console.log('PASSED found test 0');
		do_attachImgToTweet();
	} else {
		console.log('not yet found test 0');
		setTimeout(do_waitForTweetDialogToOpen, waitForInterval_ms);
	}
}

// step 7
var modalTweet;
function do_waitForTabFocus() {
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	
	var isFocused_aContentWindow = isFocused(aContentWindow);
	if (!isFocused_aContentWindow) {
		// insert note telling them something will happen
		
		try {
			modalTweet = tweetDialogDialog.querySelector('.modal-tweet-form-container'); // :maintain: with twitter updates
		} catch(ignore) {}
		if (!modalTweet) {
			throw new Error('wtf modalTweet not found, this should never happen!!!');
		}

		var nativeshotNote = aContentDocument.createElement('div');
		nativeshotNote.setAttribute('style', 'background-color:rgba(255,255,255,0.7); position:absolute; width:' + modalTweet.offsetWidth + 'px; height:' + modalTweet.offsetHeight + 'px; z-index:100; top:' + modalTweet.offsetTop + 'px; left:0px; display:flex; align-items:center; justify-content:center; text-align:center; font-weight:bold;');
		
		var nativeshotText = aContentDocument.createElement('span');
		nativeshotText.setAttribute('style', 'margin-top:-60px;');
		nativeshotText.textContent = 'NativeShot will attach images to this tweet when you focus this tab'
		
		nativeshotNote.appendChild(nativeshotText);
		
		modalTweet.insertBefore(nativeshotNote, modalTweet.firstChild);
		
		waitForFocus_forAttach = function() {
			waitForFocus_forAttach = null;
			aContentWindow.removeEventListener('focus', arguments.callee, false);
			modalTweet.removeChild(nativeshotNote);
			attachSentImgData();
		};
		
		aContentWindow.addEventListener('focus', waitForFocus_forAttach, false);
		
		// insert note telling them something will happen
	} else {
		attachSentImgData();
	}	
}

// step 8
var richInputTweetMsg;
function attachSentImgData() {
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	
	richInputTweetMsg = aContentDocument.getElementById('tweet-box-global'); // :maintain: with twitter updates
	
	if (!richInputTweetMsg) {
		throw new Error('wtf input box not found!! should nevr get here unless twitter updated their site and changed the id');
	}
	
	countPreview = richInputTweetMsg.parentNode.querySelectorAll('.previews .preview').length;
	
	var img = aContentDocument.createElement('img');
	img.setAttribute('src', currentlyAttaching.imgDataURL);
	currentlyAttaching.imgDataURL = null; // memperf
	richInputTweetMsg.appendChild(img);
	
	timeStartedAttach = new Date().getTime();
	waitForAttachToFinish();
}

// step 9
var countPreview;
const waitForAttach_maxMsWait = 5000;
var timeStartedAttach;
function waitForAttachToFinish() {
	// keeps checking the preview account, if it goes up then it has attached
	
	var nowCountPreview = richInputTweetMsg.parentNode.querySelectorAll('.previews .preview').length;
	if (nowCountPreview == countPreview + 1) {
		// :todo: add event listener on click of the x of the preview, on delete, send msg to parent saying deleted, also delete from imgIdsAttached_andPreviewIndex
		imgIdsAttached_andPreviewIndex[currentlyAttaching.imgId] = countPreview;
		countPreview = null;
		console.log('PASSED img attach test', 'took this much seconds:', ((new Date().getTime() - timeStartedAttach)/1000));
		do_clientNotify_FSReadyToAttach();
	} else {
		console.log('NOT yet img attach test passed');
		if (new Date().getTime() - timeStartedAttach < waitForAttach_maxMsWait) {
			setTimeout(waitForAttachToFinish, waitForInterval_ms);
		} else {
			console.error('max time reached when trying to attach, this should never happen!!!');
			throw new Error('max time reached when trying to attach, this should never happen!!!');
		}
	}
}

// not a step, but can happen anytime after identified that twitter was loaded
function listenForTwittterUnload(aEvent) {
	// :todo: notify notification-bar that tweet was lost due to unload, offer on click to load twitter.com again, its important that tweet happens from twitter.com as when the tweet goes through the images show up in the timeline and i can get those
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	if (aContentWindow.frameElement) {
		//console.warn('frame element loaded, so dont respond yet');
	} else {
		unregister();
	}
}
// START - custom functionalities
var currentlyAttaching = {
	imgId: null,
	imgDataURL: null
};
var imgIdsAttached_andPreviewIndex = {}; // key is imgId, value is index of preview
var FSReadyToAttach = false;
const waitForInterval_ms = 100;
// :todo: once image is attached, add event listener to the on delete of it, to sendAsyncMessage to server saying it was deleted


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

console.error('ContentFrameMessageManager:', gContentFrameMessageManager);
register();