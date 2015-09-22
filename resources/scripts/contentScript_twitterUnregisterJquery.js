

$(document).off('uiTweetDialogClosed', nativeShot_notifyDialogClosed);
$(document).off('dataTweetSuccess', nativeShot_notifyDataTweetSuccess);
$(document).off('dataTweetError', nativeShot_notifyDataTweetError);

document.removeEventListener('nativeShot_clickNewTweetBtn', on__nativeShot_clickNewTweetBtn, false);

