// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
// Cu.import('resource://gre/modules/XPCOMUtils.jsm'); // frame scripts already have this loaded

// Globals
var core = {
	addon: {
		id: 'NativeShot@jetpack',
		path: {
			content_accessible: 'chrome://nativeshot-accessible/content/',
			scripts: 'chrome://nativeshot/content/resources/scripts/'
		},
		cache_key: 'v1.2' // set to version on release
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
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'bootstrap.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

const serverMessageListener = {
	// listens to messages sent from clients (child framescripts) to me/server
	receiveMessage: function(aMsg) {

		if (!userAckId || !aMsg.json.userAckId || (aMsg.json.userAckId && userAckId && aMsg.json.userAckId == userAckId)) {
			switch (aMsg.json.aTopic) {
				case 'serverCommand_clientInit':
						
						// server sends init after i send server clientBorn message
						init(aMsg.json.core, aMsg.json.userAckId, aMsg.json.serverId);
						
					break;
				case 'serverCommand_clientShutdown':
				
						unregReason = 'server-command';
						unregister();
				
					break;
				case 'serverCommand_attachImgToTweet':
				

						do_openTweetModal(aMsg.json.imgId, aMsg.json.dataURL);
				
					break;
					
				case 'serverCommand_focusContentWindow':
				
					do_focusContentWindow();
					
				default:

			}
		} else {

		}
	}
};

function fsUnloaded(aEvent) {

	if (aEvent.target == gContentFrameMessageManager) {
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

	
	removeEventListener('unload', fsUnloaded, false);
	removeEventListener('DOMContentLoaded', listenForTwitterDOMContentLoad, false);
	removeEventListener('load', listenForTwitterLoad, true);
	
	try {
		removeMessageListener(core.addon.id, serverMessageListener);
	} catch(ignore) {

	}
	
	try {
		var aContentWindow = content;
		var aContentDocument = content.document;
	} catch (ignore) {} // content goes to null when tab is killed
	
	if (aContentWindow) {
		aContentWindow.removeEventListener('unload', listenForTwittterUnload, false);
		
		if (aSandbox) {
			// Cu.evalInSandbox(unregisterJqueryScript, aSandbox);
			aContentWindow.removeEventListener('nativeShot_notifyDialogClosed', on_nativeShot_notifyDialogClosed, false, true);
			aContentWindow.removeEventListener('nativeShot_notifyDataTweetSuccess', on_nativeShot_notifyDataTweetSuccess, false, true);
			aContentWindow.removeEventListener('nativeShot_notifyDataTweetError', on_nativeShot_notifyDataTweetError, false, true);
			Services.scriptloader.loadSubScript(core.addon.path.scripts + 'contentScript_twitterUnregisterJquery.js', aSandbox, 'UTF-8');
			Cu.nukeSandbox(aSandbox);
		}
		
		if (waitForFocus_forAttach) {
			aContentWindow.removeEventListener('focus', waitForFocus_forAttach, false);
		}
	}
	
	var sendAsyncJson = {aTopic:'clientNotify_clientUnregistered', userAckId:userAckId, subServer:'twitter', serverId:serverId, unregReason:unregReason};
	if (unregReason == 'tweet-success') {
		// then add in the clipboard stuff
		sendAsyncJson.clips = succesfullyTweetedClips;
	}
	//contentMMFromContentWindow_Method2(content, true).
	sendAsyncMessage(core.addon.id, sendAsyncJson);

}

function on_nativeShot_notifyDataTweetError(aEvent) {
	// :todo: tell notification-bar that tweet was submited and failed
	var a = aEvent.detail.a;
	var b = aEvent.detail.b;
	

	
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
	
	gTweeted = true;
	
	var a = aEvent.detail.a;
	var b = aEvent.detail.b;
	

	
	var refDetails;
	if (b.tweetboxId) {
		refDetails = b;
	} else {
		refDetails = b.sourceEventData;
	}
	
	var clips = {
	}; // key is img id, vaulue is img url, key of 'tweet' holds tweet_id, on the server side, convert this id to a url to the tweet
	
	var parser = Cc['@mozilla.org/xmlextras/domparser;1'].createInstance(Ci.nsIDOMParser);
	var parsedDocument = parser.parseFromString(refDetails.tweet_html, 'text/html');

	
	var photos = [];
	var pattPhotoUrl = /data-(?:image-url|img-src)=["']?([^"' >]+)/g; // https://github.com/Noitidart/NativeShot/wiki/Twitter-Response-HTML
	var matchPhotoUrl;

	while (matchPhotoUrl = pattPhotoUrl.exec(refDetails.tweet_html)) {

		photos.push(matchPhotoUrl[1]);
	}

	for (var i=0; i<photos.length; i++) {
		for (var imgId in imgIdsAttached_andPreviewIndex) {
			if (imgIdsAttached_andPreviewIndex[imgId] == i) {
				// index is i, and it was found that at this preview index, was this imgId
				clips[imgId] = photos[i];
				break;
			}
		}
		// it is possible that a pic is not among the urls to return, as user may have added their own image. or also if user mixed it up and then added. etc etc :todo: revise for removing deletion of preview, as if user deleted a preview then attached another // :todo: when user does delete a preview, then the previewIndex of my attached images after that index should be reduced by 1
	}
	
	clips.other_info = {};
	
	clips.other_info.tweet_id = refDetails.tweet_id;
	try {
		clips.other_info.user_id = refDetails.profile_stats[0].user_id;
	} catch (ex) {

		clips.other_info.user_id = parsedDocument.querySelector('div[data-permalink-path]').getAttribute('data-permalink-path');
	}
	clips.other_info.permlink = parsedDocument.querySelector('div[data-permalink-path]').getAttribute('data-permalink-path');
	clips.other_info.screen_name = parsedDocument.querySelector('div[data-screen-name]').getAttribute('data-screen-name');
	// clips.other_info.full_name = parsedDocument.querySelector('div[data-name]').getAttribute('data-name');

	
	succesfullyTweetedClips = clips;
	unregReason = 'tweet-success';
	unregister();
}

function on_nativeShot_notifyDialogClosed(aEvent) {

	if (!gTweeted) {
		// :todo: tell notification-bar that tweet was lost due to closed tweet, offer on click to openTweetModal and reattach
		sendAsyncMessage(core.addon.id, {aTopic:'clientNotify_tweetClosedWithoutSubmit', userAckId:userAckId, subServer:'twitter', serverId:serverId});
	}
}
// step 0

var serverId;
function init(aCore, aUserAckId, aServerId) {
	userAckId = aUserAckId;
	serverId = aServerId;
	core = aCore;
	
	FSInited = true;
	
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;

	if (aContentDocument.readyState.state == 'complete') {
		if (aContentWindow.location.hostname == TWITTER_HOSTNAME) {
			ensureSignedIn();
		} else {

			unregReason = 'non-twitter-load';
			unregister();
		}
	} else {
		// aContentDocument.readyState.state == undefined //is undefined as asoon as framescript loaded as no page has lodaed yet, but also when get "problem loading page" like for offline, it stays undefined

		addEventListener('DOMContentLoaded', listenForTwitterDOMContentLoad, false); // add listener to listen to page loads  till it finds twitter page // if i use third argument of false, load doenst trigger, so had to make it true. if false then i can use DOMContentLoaded however at DOMContentLoaded $ is not defined so had to switch to $
	}
	
	// :todo: absolutely ensure we are on home page, meaning users timeline, because when user submits tweet, if they are not on timeline, then the images are not loaded and i wont be able to get their uploaded image urls
	// :todo: detect if user clicks on "x" of any of the previews, then that should be removed from notification-bar, to identify which one got x'ed i can identify by on attach, i wait till it gets attached right, so on attach get that upload id. maybe just addEventListener on those preview x's, it seems you cant tab to it, so this is good, just attach click listeners to it
}

// step 0.5 // decimal steps are optional, they may not happen
function listenForTwitterDOMContentLoad(aEvent) {
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	if (aContentWindow.frameElement) {

	} else {
		if (aContentWindow.location.hostname == TWITTER_HOSTNAME) {
			// check if got error loading page:
			var webnav = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
			var docuri = webnav.document.documentURI;

			if (docuri.indexOf('about:') == 0) {
				// twitter didnt really load, it was an error page

				unregReason = 'error-loading';
				unregister();
			} else {
				// twitterReady = true;

				removeEventListener('DOMContentLoaded', listenForTwitterDOMContentLoad, false);
				ensureSignedIn();
			}
		} else {

			unregReason = 'non-twitter-load';
			unregister();
			//sendAsyncMessage(core.addon.id, {aTopic:'clientNotify_nonTwitterPage_onLoadComplete', userAckId:userAckId, subServer:'twitter', serverId:serverId});
		}
	}
}

function listenForTwitterLoad(aEvent) {
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	if (aContentWindow.frameElement) {

	} else {
		removeEventListener('load', listenForTwitterLoad, true);
		doRegisterJqueryScript();
	}
}

// step 1
var wasFoundNotSignedIn = false;
function ensureSignedIn() {
	// test if signed in
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button');
	if (!btnNewTweet) {
		// assume missing button means not signed in
		// add listener listening to sign in
		wasFoundNotSignedIn = true;
		addEventListener('DOMContentLoaded', listenForTwitterDOMContentLoad, false);
		sendAsyncMessage(core.addon.id, {aTopic:'clientNotify_twitterNotSignedIn', userAckId:userAckId, subServer:'twitter', serverId:serverId});
		return false;
	} else {
		if (wasFoundNotSignedIn) {
			wasFoundNotSignedIn = false;
			sendAsyncMessage(core.addon.id, {aTopic:'clientNotify_signedInShowAwaitingMsg', userAckId:userAckId, subServer:'twitter', serverId:serverId}); // cuz if tab doesnt have focus, then it will not get updated to saying waiting for attach, it will stick at "not signed in"
		}
		aContentWindow.addEventListener('unload', listenForTwittterUnload, false);
		if (aContentDocument.readyState.state == 'complete') {
			doRegisterJqueryScript();
		} else {
			addEventListener('load', listenForTwitterLoad, true); // need to wait for load, as need to wait for jquery $ to come in // need to use true otherwise load doesnt trigger
		}
		return true;
	}
}

// step 2
var aSandbox;
function doRegisterJqueryScript() {
	
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	
	var options = {
		sandboxPrototype: aContentWindow,
		wantXrays: false
	};
	var principal = docShell.chromeEventHandler.contentPrincipal; // aContentWindow.location.origin;

	aSandbox = Cu.Sandbox(principal, options);

	// load in twitter_inlay.js // per https://developer.mozilla.org/en-US/Add-ons/Overlay_Extensions/XUL_School/Appendix_D:_Loading_Scripts#Examples_2
	aContentWindow.addEventListener('nativeShot_notifyDialogClosed', on_nativeShot_notifyDialogClosed, false, true);
	aContentWindow.addEventListener('nativeShot_notifyDataTweetSuccess', on_nativeShot_notifyDataTweetSuccess, false, true);
	aContentWindow.addEventListener('nativeShot_notifyDataTweetError', on_nativeShot_notifyDataTweetError, false, true);
	Services.scriptloader.loadSubScript(core.addon.path.scripts + 'contentScript_twitterRegisterJquery.js', aSandbox, 'UTF-8');
	
	// Cu.evalInSandbox(registerJqueryScript, aSandbox);

	// no sync stuff in my registerJqueryScript so i dont have to wait, i can continue immediately
	do_clientNotify_FSReadyToAttach();
}

// step 3 - skipping step3 no longer used
/*
function on_nativeShot_notifyJqueryRegistered(aEvent) {

	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	jqueryScriptRegistered = true;
	aContentWindow.removeEventListener('nativeShot_notifyJqueryRegistered', on_nativeShot_notifyJqueryRegistered, false, true);
	do_clientNotify_FSReadyToAttach();
}
*/

// step 4 and step 10
function do_clientNotify_FSReadyToAttach(aJustAttachedImgId) {
	FSReadyToAttach = true;

	var sendAsyncJson = {aTopic:'clientNotify_FSReadyToAttach', userAckId:userAckId, subServer:'twitter', serverId:serverId};
	if (aJustAttachedImgId) {
		sendAsyncJson.justAttachedImgId = aJustAttachedImgId;
	}
	sendAsyncMessage(core.addon.id, sendAsyncJson);
}

// step 5 ---- this is entry point from server when FSReadyToAttach is true
function do_openTweetModal(aImgId, aImgDataUrl) {
	if (!FSReadyToAttach) {
		throw new Error('in do_openTweetModal but FSReadyToAttach is false so this should never have happened');
	}
	FSReadyToAttach = false;
	
	currentlyAttaching.imgId = aImgId;
	currentlyAttaching.imgDataURL = aImgDataUrl;

	var aContentWindow = content;
	var aContentDocument = content.document;
	
	var dialogTweet = aContentDocument.getElementById('global-tweet-dialog');
	if (!dialogTweet) {
		throw new Error('no tweet dialog, no clue why, this should not happen, as i did the signed in check in init');
	}
	
	if (aContentWindow.getComputedStyle(dialogTweet, null).getPropertyValue('display') == 'none') { // test if open already, if it is, then dont click the button
		// its closed, so lets open it
		
		/*
		var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button'); // id of twitter button :maintain:
		if (!btnNewTweet) {
			// assume not signed in as checked if signed in earlier in the process
			// so if got here, then wtf i dont know whats wrong
			throw new Error('wtf, should never get here');
		}
		
		btnNewTweet.click();
		*/
		
		var event = new aContentWindow.CustomEvent('nativeShot_clickNewTweetBtn');
		aContentDocument.dispatchEvent(event);

		
	}
	
	do_waitForTweetDialogToOpen();
}

// step 6
var tweetDialogDialog;
function do_waitForTweetDialogToOpen() {
	var aContentWindow = content;
	var aContentDocument = content.document;
	
	tweetDialogDialog = aContentDocument.getElementById('global-tweet-dialog-dialog'); // :maintain: with twitter updates
	if (tweetDialogDialog) {

		do_waitForTabFocus();
	} else {

		setTimeout(do_waitForTweetDialogToOpen, waitForInterval_ms);
	}
}

// step 7
var modalTweet;
function do_waitForTabFocus() {
	var aContentWindow = content;
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
		nativeshotText.textContent = myServices.sb.GetStringFromName('framescript_twitter-will-attach-on-focus')
		
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
	var aContentWindow = content;
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
		var justAttachedImgId = currentlyAttaching.imgId;
		currentlyAttaching = {};
		imgIdsAttached_andPreviewIndex[justAttachedImgId] = countPreview;
		countPreview = null;

		do_clientNotify_FSReadyToAttach(justAttachedImgId);
	} else {

		if (new Date().getTime() - timeStartedAttach < waitForAttach_maxMsWait) {
			setTimeout(waitForAttachToFinish, waitForInterval_ms);
		} else {

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

	} else {
		unregReason = 'twitter-page-unloaded';
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
var waitForFocus_forAttach;

function do_focusContentWindow() {
	content.focus();

}

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
var gCFMM;
function contentMMFromContentWindow_Method2(aContentWindow, refreshCache) {
	if (!gCFMM || refreshCache) {
		gCFMM = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIDocShell)
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIContentFrameMessageManager);
	}
	return gCFMM;

}
// END - helper functions


register();