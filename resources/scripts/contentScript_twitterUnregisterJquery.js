// have to do console.error from these scripts as console.log doesnt show for some reason

$(document).off('uiTweetDialogClosed', nativeShot_notifyDialogClosed);
$(document).off('dataTweetSuccess', nativeShot_notifyDataTweetSuccess);
$(document).off('dataTweetError', nativeShot_notifyDataTweetError);

document.removeEventListener('nativeShot_clickNewTweetBtn', on__nativeShot_clickNewTweetBtn, false);

console.error('jquery unregistered')