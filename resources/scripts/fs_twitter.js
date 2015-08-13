var core = {
	addon: {
		id: 'NativeShot@jetpack'
	}
};
const TWITTER_URL = 'https://twitter.com/';
const clientId = new Date().getTime(); // server doesnt generate clientId in this framescript ecosystem

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
				case 'serverCommand_attachImgDataURI':
				
						serverCommand_attachImgDataURI();
				
					break;
				// end - devuser edit - add your personal message topics to listen to from server
				default:
					console.error('CLIENT unrecognized aTopic:', aMsg.json.aTopic, 'aMsg:', aMsg);
			}
		}
	}
}

function register() {
	// i dont have server telling us when to do init in this framescript ecosystem
	addMessageListener(core.addon.id, serverMessageListener);
	init();
}

function unregister() {
	removeMessageListener(core.addon.id, serverMessageListener);
}

function init() {
	
}

// START - custom functionalities
var twitterLoaded = false;

var imgDataUris = {}; // object so it keeps the iIn_arrImgDataUris straight just in case the async stuff mixes up, which it shouldnt, but im new to framescripts so testing
function serverCommand_attachImgDataURI(aImgDataUri, a_iIn_arrImgDataUris) {
	// receives data and ensures its attached in the twitter page
	imgDataUris[a_iIn_arrImgDataUris] = {
		imgDataUri: aImgDataUri,
		uploadedUrl: null,
		attachedToTweet: false
	};
	
	if (twitterLoaded) {
		
	}
}
// END - custom functionalities

register();