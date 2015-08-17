// have to do this because i need to add stuff into the jquery

var nativeShot_notifyDialogClosed = function() {
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('nativeShot_notifyDialogClosed', true, true, {});
    window.dispatchEvent(evt);
};

var nativeShot_notifyDataTweetSuccess = function(aEvent, bEvent) {
	
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('nativeShot_notifyDataTweetSuccess', true, true, {
		a: aEvent,
		b: bEvent
	});
    window.dispatchEvent(evt);
	
	alert('aEvent.message:' + aEvent.message);
	alert('bEvent.message:' + bEvent.message);
};

var nativeShot_notifyDataTweetError = function(aEvent, bEvent) {
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('nativeShot_notifyDataTweetError', true, true, {
		a: aEvent,
		b: bEvent
	});
    window.dispatchEvent(evt);
};

$(document).on('uiTweetDialogClosed', nativeShot_notifyDialogClosed);
$(document).on('dataTweetSuccess', nativeShot_notifyDataTweetSuccess);
$(document).on('dataTweetError', nativeShot_notifyDataTweetError);

var jqReggedEvt = document.createEvent('CustomEvent');
jqReggedEvt.initCustomEvent('nativeShot_notifyJqueryRegistered', true, true, {});
window.dispatchEvent(jqReggedEvt);