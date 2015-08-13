var XPIScope = Cu.import('resource://gre/modules/addons/XPIProvider.jsm');
var scope = XPIScope.XPIProvider.bootstrapScopes['NativeShot@jetpack'];

var g_editor_session_id = 'gEditorSessionId-1'; // no need for nativeshot prefix, as my globaln notifs go into my own nativeshot deck box
var nbRsOfSess1 = {
	msg: 'Results of gEditor session id 1',
	img: scope.core.addon.path.images + 'icon16.png',
	p: 6,
	btns: [{
		label: 'Images Pending Tweet (1)-ID:twit1',
		btn_id: 'twit1',
		class: 'nativeshot-twitter-bad',
		accessKey: 'T',
		callback: function() {
		alert('ya');
		throw new Error('preventing close of this n');
	}
	}]
};
scope.NBs.crossWin[g_editor_session_id] = nbRsOfSess1;
scope.NBs.insertGlobalToWin(g_editor_session_id, 'all');


// update
var XPIScope = Cu.import('resource://gre/modules/addons/XPIProvider.jsm');
var scope = XPIScope.XPIProvider.bootstrapScopes['NativeShot@jetpack'];

var g_editor_session_id = 'gEditorSessionId-1'; // no need for nativeshot prefix, as my globaln notifs go into my own nativeshot deck box
var nbRsOfSess1 = {
	msg: 'Results of gEditor session id 1',
	img: scope.core.addon.path.images + 'icon16.png',
	p: 6,
	btns: [{
		label: 'Images Uploaded (1)',
		btn_id: 'twit1',
		class: 'nativeshot-twitter',
		accessKey: 'U',
		callback: function() {
		alert('ya');
		throw new Error('preventing close of this n');
	}
	}]
};
scope.NBs.crossWin[g_editor_session_id] = nbRsOfSess1;
scope.NBs.updateGlobal(g_editor_session_id, {btns:{label:['twit1'],class:['twit1'],akey:['twit1']}});