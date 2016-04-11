////////// start - nativeshot - app_main
function nsInitPage(aPostNonSkelInit_CB) {
	
	// when done must call aPostNonSkelInit_CB();
	var do_step1 = function() {
		// fetch core - it will have the udpated prefs
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInPromiseWorker', ['returnCore']], bootstrapMsgListener.funcScope, function(aCore) {
			
			core = aCore;
			
			do_step2();
		});
	};
	
	var do_step2 = function() {
		// refresh prefs in bootstrap core object - as source of truth  for prefs is in bootstrap
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInBootstrap', ['refreshCoreForPrefs']], bootstrapMsgListener.funcScope, function(aCoreAddonPrefs) {

			core.addon.prefs = aCoreAddonPrefs;
			do_step3();
		});
	};
	
	var do_step3 = function() {
		gLastUpdated = new Date(core.addon.lastUpdatedGetTime);
		
		initGDOMStructureLocalized();
		
		refreshGDOMState();
		
		renderReact();
		
		aPostNonSkelInit_CB();
	};
	
	do_step1();
}

function nsOnFocus() {
	// refresh prefs in bootstrap core object
	sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInBootstrap', ['refreshCoreForPrefs']], bootstrapMsgListener.funcScope, function(aCoreAddonPrefs) {

		core.addon.prefs = aCoreAddonPrefs;
		refreshGDOMState();
		MyStore.setState({
			sBlockValues: JSON.parse(JSON.stringify(gDOMState))
		});
	});
}

// Globals
var gLastUpdated;

var gDOMStructure;
function initGDOMStructureLocalized() {
	gDOMStructure = [ // react reads this as pBlocks
		// each must have:
		//		id
		//		pref - the field key name in core.addon.prefs
		//		label
		//		values - object, key is value that pref can be in core.addon.prefs, see gPrefMeta for value details and validation crossfile-link44375677
		//		descs - array of texts
		//		btns - array of objects
				// each must have
				//		id
				//		label
				//		hidden - true or false (or can omit field for false) based on if you want to show it or not (usually this is callback)
				//		click
		
		// if you want to set a callback, make sure to set it in gDOMStructureCallbacks with same key
		{
			id: 'autoup',
			pref: 'autoupdate',
			label: core.addon.l10n.app_options.auto_updates,
			values: {
				'false': core.addon.l10n.app_options.off,
				'true': core.addon.l10n.app_options.on
			},
			descs: [
				justFormatStringFromName(core.addon.l10n.app_options.version, [core.addon.version]),
				justFormatStringFromName(core.addon.l10n.app_options.last_updated, [
					core.addon.l10n.dateFormat['month.' + (gLastUpdated.getMonth() + 1) + '.name'] + ' ' + gLastUpdated.getDate() + ', ' + gLastUpdated.getFullYear()
				])
			],
			btns: [
				{
					id: 'autoup-toggle',
					label: 'callback:autoup-toggle', // start with callback: means it should call that callback to figure out the value for this field
					click: 'callback:autoup-toggle-click'
				}
			]
		},
		{
			id: 'quickdir',
			pref: 'quick_save_dir',
			label: core.addon.l10n.app_options.quick_save_dir,
			sup: 'callback:quickdir-sup',
			values: 'callback:quickdir-values', // start with callback: means it should call that callback to figure out the value for this field
			descs: [
				core.addon.l10n.app_options.quick_save_dir_desc1,
				core.addon.l10n.app_options.quick_save_dir_desc2
			],
			btns: [
				{
					id: 'quickdir-chg',
					label: core.addon.l10n.app_options.change,
					click: 'callback:quickdir-chg-click'
				},
				{
					id: 'quickdir-reset',
					label: core.addon.l10n.app_options.reset,
					hidden: 'callback:quickdir-reset-hidden',
					click: 'callback:quickdir-reset-click'
				}
			]
		},
		{
			id: 'printprev',
			pref: 'print_preview',
			label: core.addon.l10n.app_options.print_preview,
			values: {
				'false': core.addon.l10n.app_options.off,
				'true': core.addon.l10n.app_options.on
			},
			descs: [
				core.addon.l10n.app_options.print_preview_desc1,
				core.addon.l10n.app_options.print_preview_desc2
			],
			btns: [
				{
					id: 'printprev-toggle',
					label: 'callback:printprev-toggle',
					click: 'callback:printprev-toggle-click'
				}
			]
		},
		{
			id: 'systemhotkey',
			pref: 'system_hotkey',
			label: core.addon.l10n.app_options.system_hotkey,
			values: {
				'false': core.addon.l10n.app_options.off,
				'true': core.addon.l10n.app_options.on
			},
			descs: [
				core.os.mname == 'darwin' ? core.addon.l10n.app_options.system_hotkey_desc1_mac.replace('\\u2318', '\u2318') : core.addon.l10n.app_options.system_hotkey_desc1_winnix,
				core.addon.l10n.app_options.system_hotkey_desc2
			],
			btns: [
				{
					id: 'systemhotkey-toggle',
					label: 'callback:systemhotkey-toggle',
					click: 'callback:systemhotkey-toggle-click'
				}
			]
		}
	];
}

var gDOMStructureCallbacks = {
	// because gDOMStructure is passed in as a prop to the react component, we dont want any functions otherwise it triggers the diff mechanism all the time // basically the values of these fields are dicated by the state value of the block
	// callbacks used in click are binded to `this` of the componenet
	// all other callbacks are passed the state of the block
	'callback:printprev-toggle': function(aBlockState) {
		return (!aBlockState.value ? core.addon.l10n.app_options.on : core.addon.l10n.app_options.off);
	},
	'callback:systemhotkey-toggle': function(aBlockState) {
		return (!aBlockState.value ? core.addon.l10n.app_options.on : core.addon.l10n.app_options.off);
	},
	'callback:autoup-toggle': function(aBlockState) {
		return (!aBlockState.value ? core.addon.l10n.app_options.on : core.addon.l10n.app_options.off);
	},
	'callback:quickdir-reset-hidden': function(aBlockState) {

		if (aBlockState.value == core.addon.prefs.quick_save_dir.defaultValue) {

			return true;
		} else {

			return false;
		}
	},
	'callback:quickdir-sup': function(aBlockState) {
		var fsSeperatorLastIndex = aBlockState.value.lastIndexOf(core.os.filesystem_seperator);
		if (fsSeperatorLastIndex == -1) {
			return core.os.filesystem_seperator;
		} else {
			return aBlockState.value.substr(0, fsSeperatorLastIndex);
		}
	},
	'callback:quickdir-values': function(aBlockState) {
		var cValues = {};
		cValues[aBlockState.value + ''] = aBlockState.value.substr(aBlockState.value.lastIndexOf(core.os.filesystem_seperator) + core.os.filesystem_seperator.length);
		return cValues;
	},
	'callback:printprev-toggle-click': function() {
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInBootstrap', ['prefSet', 'print_preview', !core.addon.prefs.print_preview.value]], bootstrapMsgListener.funcScope, function(aCorePrefNameObj) {

			core.addon.prefs.print_preview = aCorePrefNameObj;
			refreshGDOMState();
			MyStore.setState({
				sBlockValues: JSON.parse(JSON.stringify(gDOMState))
			});
		});
	},
	'callback:systemhotkey-toggle-click': function() {
		var newPrefValue = !core.addon.prefs.system_hotkey.value;
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInBootstrap', ['prefSet', 'system_hotkey', !core.addon.prefs.system_hotkey.value]], bootstrapMsgListener.funcScope, function(aCorePrefNameObj) {

			core.addon.prefs.system_hotkey = aCorePrefNameObj;
			refreshGDOMState();
			MyStore.setState({
				sBlockValues: JSON.parse(JSON.stringify(gDOMState))
			});
		});
		if (newPrefValue) {
			contentMMFromContentWindow_Method2(window).sendAsyncMessage(core.addon.id, ['callInBootstrap', ['initHotkey']]);
		} else {
			contentMMFromContentWindow_Method2(window).sendAsyncMessage(core.addon.id, ['callInBootstrap', ['uninitHotkey']]);
		}
	},
	'callback:autoup-toggle-click': function() {
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInBootstrap', ['prefSet', 'autoupdate', !core.addon.prefs.autoupdate.value]], bootstrapMsgListener.funcScope, function(aCorePrefNameObj) {

			core.addon.prefs.autoupdate = aCorePrefNameObj;
			refreshGDOMState();
			MyStore.setState({
				sBlockValues: JSON.parse(JSON.stringify(gDOMState))
			});
		});
	},
	'callback:quickdir-chg-click': function() {
		
		var do_setPref = function(aDirPlatPath) {
			sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInBootstrap', ['prefSet', 'quick_save_dir', aDirPlatPath]], bootstrapMsgListener.funcScope, function(aCorePrefNameObj) {

				core.addon.prefs.quick_save_dir = aCorePrefNameObj;
				refreshGDOMState();
				MyStore.setState({
					sBlockValues: JSON.parse(JSON.stringify(gDOMState))
				});
			});
		};
		
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInBootstrap', ['browseFile', core.addon.l10n.app_options.change_dir_dialog_title, {mode:'modeGetFolder', async:true}]], bootstrapMsgListener.funcScope, function(aDirPlatPath) {

			if (aDirPlatPath && aDirPlatPath != core.addon.prefs.quick_save_dir.value) {
				do_setPref(aDirPlatPath);
			}
		});
	},
	'callback:quickdir-reset-click': function() {
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInBootstrap', ['prefSet', 'quick_save_dir', core.addon.prefs.quick_save_dir.defaultValue]], bootstrapMsgListener.funcScope, function(aCorePrefNameObj) {

			core.addon.prefs.quick_save_dir = aCorePrefNameObj;
			refreshGDOMState();
			MyStore.setState({
				sBlockValues: JSON.parse(JSON.stringify(gDOMState))
			});
		});
	}
};

function getObjKeyVal(aObj, aKey, aState) { // react components uses this only for non-click callbacks
	if (aKey == 'hidden') {

	}
	if (aKey in aObj) {
		var cVal = aObj[aKey];
		if (typeof(cVal) == 'string' && gDOMStructureCallbacks[cVal]) {
			return gDOMStructureCallbacks[cVal](aState);
		} else {
			return cVal;
		}
	} else {
		return undefined;
	}
}

var gDOMState = {}; // react reads this as sBlocks // each entry is an object. the current value/state for each entry gDOMStructure
function refreshGDOMState() {
	// can be use as initGDOMState as well
	
	gDOMState = {};
	for (var i=0; i<gDOMStructure.length; i++) {
		var cStructEntry = gDOMStructure[i];
		gDOMState[cStructEntry.id] = {};
		
		var cStructState = gDOMState[cStructEntry.id];
		if (cStructEntry.pref) {
			cStructState.value = core.addon.prefs[cStructEntry.pref].value;
		} else {
			throw new Error('at this point in time each entry must have a pref associated with it');
		}
	}
}

function renderReact() {
	var myContainer = React.createElement(Container, {pBlocks:JSON.parse(JSON.stringify(gDOMStructure))});
	
	ReactDOM.render(
		myContainer,
		document.getElementById('main_wrapp')
	);
}

// start - react components
var MyStore = {};

var Container = React.createClass({
    displayName: 'Container',
	getInitialState: function() {
		return {
			sBlockValues: JSON.parse(JSON.stringify(gDOMState))
		};
	},
	componentDidMount: function() {
		MyStore.updateStatedIniObj = this.updateStatedIniObj; // no need for bind here else React warns "Warning: bind(): You are binding a component method to the component. React does this for you automatically in a high-performance way, so you can safely remove this call. See Menu"
		MyStore.setState = this.setState.bind(this); // need bind here otherwise it doesnt work
	},
	render: function() {
		// props
		//		pBlocks
		
		var cChildren = [];
		
		var k = -1 * MAX_BLOCKS_PER_ROW; // k is tracker index for this.props.pBlocks
		var numRows = Math.ceil(this.props.pBlocks.length / MAX_BLOCKS_PER_ROW);
		for (var i=0; i<numRows; i++) {
			k += MAX_BLOCKS_PER_ROW;
			cChildren.push(React.createElement(Row, {pBlocks:this.props.pBlocks, pK:k, sBlockValues:this.state.sBlockValues}));
			if (k >= this.props.pBlocks.length - 1) {
				break;
			}
		}
		
		return React.createElement('div', {className:'container'},
			cChildren
		);
	}
});

const MAX_BLOCKS_PER_ROW = 3; // link6675835357
var Row = React.createClass({
    displayName: 'Row',
	render: function() {
		// props
		//	pBlocks
		//	sBlockValues
		//	pK
		
		var k = this.props.pK;
		var rowBlockCnt = Math.min(this.props.pBlocks.length - k, MAX_BLOCKS_PER_ROW);
		
		var cRowChildren = [];
		for (var j=0; j<MAX_BLOCKS_PER_ROW; j++) {
			cRowChildren.push(React.createElement(Block, {pBlock:this.props.pBlocks[k], sBlockValue:this.props.sBlockValues[this.props.pBlocks[k].id], pRowBlockCnt:rowBlockCnt, pRowFirstBlock:(j === 0 ? true : false)}));
			if (k == this.props.pBlocks.length - 1) { // in case there is not exactly MAX_BLOCKS_PER_ROW left to fill this row. so number of blocks for this row is less than MAX_BLOCKS_PER_ROW
				break;
			}
			k++;
		}
		
		return React.createElement('div', {className:'padd-80'},
			React.createElement('div', {className:'row'},
				cRowChildren
			)
		);
	}
});

var Block = React.createClass({
    displayName: 'Block',
	render: function() {
		// props
		//	pBlock
		//	sBlockValue
		//	pRowBlockCnt
		//	pRowFirstBlock - true if its the first block in the row else false
		
		var cBlockTitle = this.props.pBlock.label;
		
		var cValues = getObjKeyVal(this.props.pBlock, 'values', this.props.sBlockValue);
		var cBlockValue = (!cValues ? undefined : cValues[this.props.sBlockValue.value]);
		
		var cBlockSup;
		if (cBlockValue) {
			cBlockSup = getObjKeyVal(this.props.pBlock, 'sup', this.props.sBlockValue);
		}
		
		var cBlockDescs = [];
		var cDescs = this.props.pBlock.descs;

		for (var i=0; i<cDescs.length; i++) {
			cBlockDescs.push(React.createElement('li', {},
				cDescs[i]
			));
		}
		
		var cBlockBtns = [];
		var cBtns = this.props.pBlock.btns;

		for (var i=0; i<cBtns.length; i++) {
			var cBtnHidden = getObjKeyVal(cBtns[i], 'hidden', this.props.sBlockValue);

			if (!cBtnHidden) {
				cBlockBtns.push(React.createElement(Button, {sBlockValue:this.props.sBlockValue, pBtn:cBtns[i]}));
			}
		}

		
		// add space between the cBtns if there is more than 1
		// so [1, 2] becomes Array [ 1, " ", 2 ]
		// [1, 2, 3] Array [ 1, " ", 2, " ", 3 ]
		// etc
		if (cBlockBtns.length > 1) {
			for (var i=0; i<cBlockBtns.length-1; i=i+2) {
				cBlockBtns.splice(i+1, 0, ' ');
			}
		}
		
		var cClassName;
		if (!this.props.pRowFirstBlock || this.props.pRowBlockCnt == MAX_BLOCKS_PER_ROW) {
			cClassName = 'col-lg-4 col-lg-offset-0 col-md-4 col-md-offset-0 col-sm-6 col-sm-offset-3 col-xs-12';
		} else {
			// :note: if increase MAX_BLOCKS_PER_ROW then I have to adjust this bootstrap offset logic per http://stackoverflow.com/a/35687323/1828637 // link6675835357
			if (this.props.pRowBlockCnt == 2) {
				cClassName = 'col-lg-4 col-lg-offset-2 col-md-4 col-md-offset-2 col-sm-6 col-sm-offset-3 col-xs-12';
			} else {
				// this.props.pRowBlockCnt is 1 obviously
				cClassName = 'col-lg-4 col-lg-offset-4 col-md-4 col-md-offset-4 col-sm-6 col-sm-offset-3 col-xs-12';
			}
		}
		
		return React.createElement('div', {className:cClassName},
			React.createElement('div', {className:'price-block' + (!cBlockSup ? '' : ' filesystem-path')},
				React.createElement('div', {className:'price-price'},
					React.createElement('h4', {},
						cBlockTitle
					)
				),
				React.createElement('div', {className:'price-title'},
					!cBlockSup ? undefined : React.createElement('sup', {},
						cBlockSup
					),
					React.createElement('span', {},
						cBlockValue
					)
				),
				React.createElement('ul', {},
					cBlockDescs
				),
				React.createElement('div', {className:'button-style-2'},
					cBlockBtns
				)
			)
		);
	}
});

var Button = React.createClass({
    displayName: 'Button',
	render: function() {
		// props
		//		sBlockValue
		//		pBtn
		
		var cAttr = {
			href:'#',
			className:'b-md butt-style'
		};
		
		var cLabel = getObjKeyVal(this.props.pBtn, 'label', this.props.sBlockValue);
		
		var cClick;
		if (typeof(this.props.pBtn.click) == 'string' && gDOMStructureCallbacks[this.props.pBtn.click]) {
			cAttr.onClick = gDOMStructureCallbacks[this.props.pBtn.click].bind(this);
		}
		
		return React.createElement('a', cAttr,
			cLabel
		)
	}
});

// end - react components

// start - common helper functions

// end - common helper functions
////////// end - nativeshot - app_main











///////////////// start - framescript skeleton
// Imports
const {interfaces:Ci} = Components;

// Globals
var core = {
	addon: {
		id: 'NativeShot@jetpack' // non-skel
	}
}; // set by initPage
var gCFMM; // needed for contentMMFromContentWindow_Method2

// // Lazy imports
// var myServices = {};
// XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'cp.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

// Start - DOM Event Attachments
function doOnBeforeUnload() {

	contentMMFromContentWindow_Method2(window).removeMessageListener(core.addon.id, bootstrapMsgListener);

}

function doOnContentLoad() {

	initPage();
}

document.addEventListener('DOMContentLoaded', doOnContentLoad, false);
window.addEventListener('beforeunload', doOnBeforeUnload, false);

// :note: should attach doOnBlur to window.blur after page is init'ed for first time, or if widnow not focused, then attach focus listener link147928272
function ifNotFocusedDoOnBlur() { // was ifNotFocusedAttachFocusListener
	if (!document.hasFocus()) {
		attachFocusListener();
	}
}

function attachFocusListener() {
	// :note: i dont know why im removing focus on blur, but thats how i did it in nativeshot, it must avoid some redundancy
	window.addEventListener('focus', doOnFocus, false);
}

function detachFocusListener() {
	window.removeEventListener('focus', doOnFocus, false);
}

function doOnFocus() {
	detachFocusListener();
	// fetch prefs from bootstrap, and update dom
	nsOnFocus(); // non-skel
}

// End - DOM Event Attachments
// Start - Page Functionalities

function initPage() {
	
	var postNonSkelInit = function() {
		window.addEventListener('blur', attachFocusListener, false); // link147928272
		ifNotFocusedDoOnBlur();
	};
	
	nsInitPage(postNonSkelInit); ///// non-skel
}

// End - Page Functionalities

// start - server/framescript comm layer
// sendAsyncMessageWithCallback - rev3
var bootstrapCallbacks = { // can use whatever, but by default it uses this
	// put functions you want called by bootstrap/server here
	serverCommand_refreshDashboardGuiFromFile: function() {
		// do nothing
	}
};
const SAM_CB_PREFIX = '_sam_gen_cb_';
var sam_last_cb_id = -1;
function sendAsyncMessageWithCallback(aMessageManager, aGroupId, aMessageArr, aCallbackScope, aCallback) {
	sam_last_cb_id++;
	var thisCallbackId = SAM_CB_PREFIX + sam_last_cb_id;
	aCallbackScope = aCallbackScope ? aCallbackScope : bootstrap; // :todo: figure out how to get global scope here, as bootstrap is undefined
	aCallbackScope[thisCallbackId] = function(aMessageArr) {
		delete aCallbackScope[thisCallbackId];
		aCallback.apply(null, aMessageArr);
	}
	aMessageArr.push(thisCallbackId);
	aMessageManager.sendAsyncMessage(aGroupId, aMessageArr);
}
var bootstrapMsgListener = {
	funcScope: bootstrapCallbacks,
	receiveMessage: function(aMsgEvent) {
		var aMsgEventData = aMsgEvent.data;

		// aMsgEvent.data should be an array, with first item being the unfction name in this.funcScope
		
		var callbackPendingId;
		if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
			callbackPendingId = aMsgEventData.pop();
		}
		
		var funcName = aMsgEventData.shift();
		if (funcName in this.funcScope) {
			var rez_fs_call = this.funcScope[funcName].apply(null, aMsgEventData);
			
			if (callbackPendingId) {
				// rez_fs_call must be an array or promise that resolves with an array
				if (rez_fs_call.constructor.name == 'Promise') {
					rez_fs_call.then(
						function(aVal) {
							// aVal must be an array
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, aVal]);
						},
						function(aReason) {

							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aReason]]);
						}
					).catch(
						function(aCatch) {

							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aCatch]]);
						}
					);
				} else {
					// assume array
					contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, rez_fs_call]);
				}
			}
		}

		
	}
};
contentMMFromContentWindow_Method2(content).addMessageListener(core.addon.id, bootstrapMsgListener);
// end - server/framescript comm layer
// start - common helper functions
function contentMMFromContentWindow_Method2(aContentWindow) {
	if (!gCFMM) {
		gCFMM = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIDocShell)
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIContentFrameMessageManager);
	}
	return gCFMM;

}
function Deferred() { // rev3 - https://gist.github.com/Noitidart/326f1282c780e3cb7390
	// update 062115 for typeof
	if (typeof(Promise) != 'undefined' && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (typeof(PromiseUtils) != 'undefined'  && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else {
		/* A method to resolve the associated Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} value : This value is used to resolve the promise
		 * If the value is a Promise then the associated promise assumes the state
		 * of Promise passed as value.
		 */
		this.resolve = null;

		/* A method to reject the assocaited Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} reason: The reason for the rejection of the Promise.
		 * Generally its an Error object. If however a Promise is passed, then the Promise
		 * itself will be the reason for rejection no matter the state of the Promise.
		 */
		this.reject = null;

		/* A newly created Pomise object.
		 * Initially in pending state.
		 */
		this.promise = new Promise(function(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;
		}.bind(this));
		Object.freeze(this);
	}
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};

	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};

	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}

// rev1 - https://gist.github.com/Noitidart/c4ab4ca10ff5861c720b
function validateOptionsObj(aOptions, aOptionsDefaults) {
	// ensures no invalid keys are found in aOptions, any key found in aOptions not having a key in aOptionsDefaults causes throw new Error as invalid option
	for (var aOptKey in aOptions) {
		if (!(aOptKey in aOptionsDefaults)) {

			throw new Error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value');
		}
	}
	
	// if a key is not found in aOptions, but is found in aOptionsDefaults, it sets the key in aOptions to the default value
	for (var aOptKey in aOptionsDefaults) {
		if (!(aOptKey in aOptions)) {
			aOptions[aOptKey] = aOptionsDefaults[aOptKey];
		}
	}
}
function justFormatStringFromName(aLocalizableStr, aReplacements) {
    // justFormatStringFromName is formating only ersion of the worker version of formatStringFromName

    var cLocalizedStr = aLocalizableStr;
    if (aReplacements) {
        for (var i=0; i<aReplacements.length; i++) {
            cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
        }
    }

    return cLocalizedStr;
}
// end - common helper functions