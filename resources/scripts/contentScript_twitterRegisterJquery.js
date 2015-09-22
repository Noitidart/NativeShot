

function nativeShot_notifyDialogClosed(aEvent) {

	var evt = document.createEvent('CustomEvent');
	evt.initCustomEvent('nativeShot_notifyDialogClosed', true, true, {});
	window.dispatchEvent(evt);
}

function nativeShot_notifyDataTweetSuccess(aEvent, bEvent) {

	var evt = document.createEvent('CustomEvent');
	evt.initCustomEvent('nativeShot_notifyDataTweetSuccess', true, true, {a:aEvent, b:bEvent});
	window.dispatchEvent(evt);
}

function nativeShot_notifyDataTweetError(aEvent, bEvent) {

	var evt = document.createEvent('CustomEvent');
	evt.initCustomEvent('nativeShot_notifyDataTweetError', true, true, {a:aEvent, b:bEvent});
	window.dispatchEvent(evt);
}

function on__nativeShot_clickNewTweetBtn() {

	var btn = $('#global-new-tweet-button');
	if (!btn) {
		throw new Error('maybe twitter changed the id, it couldnt be found');
	}
	
	btn.trigger('click');
}

document.addEventListener('nativeShot_clickNewTweetBtn', on__nativeShot_clickNewTweetBtn, false);

$(document).on('uiTweetDialogClosed', nativeShot_notifyDialogClosed);
$(document).on('dataTweetSuccess', nativeShot_notifyDataTweetSuccess);
$(document).on('dataTweetError', nativeShot_notifyDataTweetError);
