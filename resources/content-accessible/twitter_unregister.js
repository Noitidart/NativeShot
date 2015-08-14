// have to do this because i need to add stuff into the jquery
$(document).off('uiTweetDialogClosed', nativeShot_notifyDialogClosed);

delete window.nativeShot_notifyDialogClosed;

var scriptReg = docuement.getElementById('nativeshot_twitter_register');
var scriptUneg = docuement.getElementById('nativeshot_twitter_unregister');

scriptReg.parentNode.removeChild(scriptReg);
scriptUneg.parentNode.removeChild(scriptUneg);

alert('unregistered');