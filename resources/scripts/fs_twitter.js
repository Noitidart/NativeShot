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
		do_attachUnattachedsToTweet();
	}
}

function do_openTweetModal(aContentWindow) {
	var aContentDocument = content.document;
    var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button'); // id of twitter button :maintain:

    if (!btnNewTweet) {
        throw new Error('global tweet button not found, probably not logged in');
    }
	
	btnNewTweet.click();
	
	twitterReady = true;
	
	do_attachUnattachedsToTweet();
}
function do_attachUnattachedsToTweet() {
	// actually attaches it
	var aContentDocument = content.document;
	console.log('ok attaching it');
	
	var richInputTweetMsg = aContentDocument.getElementById('tweet-box-global'); // <button#global-new-tweet-button.js-global-new-tweet.js-tooltip btn primary-btn tweet-btn js-dynamic-tooltip> // :maintain:
	
	const actionDelay = 100;
	
	var keysImgDataUris = Object.keys(imgDataUris);
	
	for (var i=0; i<keysImgDataUris.length; i++) {
		let iHoisted = i;
		if (!imgDataUris[keysImgDataUris[i]].attachedToTweet) {
			imgDataUris[keysImgDataUris[i]].attachedToTweet = true;
			setTimeout(function() {
				console.log('attaching iHoisted:', (iHoisted + 2) * actionDelay);
				console.info('imgDataUris[keysImgDataUris[iHoisted]].imgDataUri:', '<img src="' + imgDataUris[keysImgDataUris[iHoisted]].imgDataUri + '" />');
				richInputTweetMsg.innerHTML += '<img src="' + imgDataUris[keysImgDataUris[iHoisted]].imgDataUri + '" />';
			}, (iHoisted + 2) * actionDelay);
		}
	}
	
}
// END - custom functionalities

register();