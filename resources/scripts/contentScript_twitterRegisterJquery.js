// have to do console.error from these scripts as console.log doesnt show for some reason

function nativeShot_notifyDialogClosed(aEvent) {
	console.error('incoming uiTweetDialogClosed event', aEvent)
	var evt = document.createEvent('CustomEvent');
	evt.initCustomEvent('nativeShot_notifyDialogClosed', true, true, {});
	window.dispatchEvent(evt);
}

function nativeShot_notifyDataTweetSuccess(aEvent, bEvent) {
	console.error('incoming dataTweetSuccess event', aEvent, bEvent)
	var evt = document.createEvent('CustomEvent');
	evt.initCustomEvent('nativeShot_notifyDataTweetSuccess', true, true, {a:aEvent, b:bEvent});
	window.dispatchEvent(evt);
}

function nativeShot_notifyDataTweetError(aEvent, bEvent) {
	console.error('incoming dataTweetError event', aEvent, bEvent)
	var evt = document.createEvent('CustomEvent');
	evt.initCustomEvent('nativeShot_notifyDataTweetError', true, true, {a:aEvent, b:bEvent});
	window.dispatchEvent(evt);
}

function on__nativeShot_clickNewTweetBtn() {
	console.log('incoming on__nativeShot_clickNewTweetBtn event');
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
console.error('jquery registered, $', $);