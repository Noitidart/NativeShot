// have to do this because i need to add stuff into the jquery
var scriptReg = docuement.getElementById('nativeshot_twitter_register');
if (scriptReg) {
	$(document).off('uiTweetDialogClosed', nativeShot_notifyDialogClosed);
	$(document).off('dataTweetSuccess', nativeShot_notifyDataTweetSuccess);
	$(document).off('dataTweetError', nativeShot_notifyDataTweetError);
	
	delete window.nativeShot_notifyDialogClosed;
	delete window.nativeShot_notifyDataTweetSuccess;
	delete window.nativeShot_notifyDataTweetError;
	
	scriptReg.parentNode.removeChild(scriptReg);
}

var scriptUneg = docuement.getElementById('nativeshot_twitter_unregister');
scriptUneg.parentNode.removeChild(scriptUneg);

alert('unregistered');