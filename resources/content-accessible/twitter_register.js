// have to do this because i need to add stuff into the jquery

var nativeShot_notifyDialogClosed = function() {
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('nativeShot_notifyDialogClosed', true, true, {});
    window.dispatchEvent(evt);
};

$(document).on('uiTweetDialogClosed', nativeShot_notifyDialogClosed);

alert('registered');