// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('chrome://nativeshot/content/resources/scripts/comm/Comm.js');
var {callInBootstrap, callInChildworker1} = CommHelper.mainworker;


// Globals
var core;

var gWorker = this;

var gBsComm = new Comm.client.worker();
var gOcrComm;
var callInOcrworker = Comm.callInX.bind(null, 'gOcrComm', null);

var gHydrants; // keys are getPage() names, like NewRecordingPage and value is an object which is its hydrant
var gEditorStateStr;

var gCancelled = []; // each element is actionid
var gHold = {};
// key is serviceid + '-' + HOLD_CONST OR actionid + '-' + HOLD_CONST
	// for updating state to gui, run the do not run serviceid gui update callback if the actionid is pending
	// reason + HOLD_CONST is because we can do the processing up till that HOLD_CONST then hold
	// for actionid i dont need hte + '-' + HOLD_CONST but to have same flow i include it
	// all HOLD_CONST should start with HOLD_
// value is object with keys `reason` and `resumers`
	// twitter: { reason:'HOLD_NEEDS_OAUTH', resumers:[resume_all, resumer...] }
	// [actionid]: { reason:'HOLD_ERROR', resumers:[resumer] }
		// resumers is an array (even for [actionid] but in this case it just has one entry)
			// resumer is an object:
				// { shot, aActionFlowReenterer, aActionFinalizer, aReportProgress }

function getHoldKey(actionid_serviceid, reason) {
	if (!reason.startsWith('HOLD_')) { console.error('deverror, reason should start with HOLD_ it is:', reason); throw new Error('deverror, reason should start with HOLD_ it is: ' + reason); }
	return actionid_serviceid + '-' + reason;
}
function buildResumer(shot, aActionFinalizer, aReportProgress, aActionFlowReenterer) {
	return { shot, aActionFinalizer, aReportProgress, aActionFlowReenterer };
}
const CHECK = 'CHECK'; const FINALIZE = 'FINALIZE'; const PROGRESS = 'PROGRESS'; const CANCEL = 'CANCEL'; const REENTER = 'REENTER'; const PLACE = 'PLACE'; const RESUME = 'RESUME';
function withHold(aAct, actionid_serviceid, reason, aFinalizeWithOrProgressWithOrResumer) {
	// reason is hold_const so meaning must start with HOLD_
	// aAct enum - FINALIZE, PROGRESS, CANCEL, REENTER, CHECK, PLACE, RESUME
	// aFinalizeWithOrProgressWithOrResumer is based on aAct:
		// FINALIZE(aFinalizeWith)
		// PROGRESS(aProgressWith)
		// CHECK(resumer)
		// PLACE(resumer)
		// CANCEL(null)
		// REENTER(null)
		// RESUME(null or object to Object.assign to action_options)
	// when doing CHECK, setting aFinalizeWithOrProgressWithOrResumer is optional, as maybe devuser wants to just check. but if it is set it should be the callback to reenter with, and it will queue it up if check yeields that it is on hold. should build one with buildResumer()
	// return values
	/*
		RESUME
			undefined
		CHECK
			true - if not on hold
			false - if on hold
		CANCEL/FINALIZE/PROGRESS/REENTER
			true - if anything canceled/finalized/progressed/reentered
			false - if nothing done
		PLACE
			true - if newly placed, resumers is just this resumer
			false - if already was there, and just added resumer to the array
	*/
	if (!reason.startsWith('HOLD_')) { console.error('deverror, reason should start with HOLD_ it is:', reason); throw new Error('deverror, reason should start with HOLD_ it is: ' + reason); }

	// build hold_key, and set byid
	var hold_key = actionid_serviceid + '-' + reason;

	var hold = gHold[hold_key];
	switch (aAct) {
		case PLACE:

				var resumer = aFinalizeWithOrProgressWithOrResumer;
				console.log('resumer:', resumer);

				if (hold) {
					// make sure this actionid is not already on hold
					var already_held = false;
					for (var a_resumer of gHold[hold_key].resumers) {
						if (a_resumer.shot.actionid === resumer.shot.actionid) {
							// this actionid is already on hold
							already_held = true;
							break;
						}
					}

					// its not already on hold so place the resumer
					if (!already_held) {
						gHold[hold_key].resumers.push(resumer);
					}
				} else {
					gHold[hold_key] = {
						reason,
						resumers: [resumer]
					};
				}

				resumer.aReportProgress({
					// no need to add in actionid as bootstrap side will handle adding that in crossfile-link393
					// serviceid: resumer.shot.serviceid, // no need for serviceid UNLESS i am changing the serviceid, as INIT handles setting the serviceid crossfile-link3399
					reason
				});

				if (hold) {
					return false;
				} else {
					return true;
				}

			break;
		case CHECK:

				if (hold) {
					// its on hold
					return false;
				} else {
					// its not on hold
					return true;
				}

			break;
		case RESUME:
				if (hold) {
					var resumers = hold.resumers;
					delete gHold[hold_key];
					var assignto_actionoptions = aFinalizeWithOrProgressWithOrResumer;
					for (var resumer of resumers) {
						if (assignto_actionoptions) {
							if (resumer.shot.action_options) {
								Object.assign(resumer.shot.action_options, assignto_actionoptions);
							} else {
								resumer.shot.action_options = Object.assign({}, assignto_actionoptions);
							}
						}
						resumer.aActionFlowReenterer();
					}
				}
			break;
	}
}
function withHoldResume(aArg) {
	var { actionid_serviceid, reason, action_options } = aArg;
	withHold(RESUME, actionid_serviceid, reason, action_options);
}

function dummyForInstantInstantiate() {}
function init(objCore) {
	//console.log('in worker init');

	core = objCore;

	gOcrComm = new Comm.server.worker(core.addon.path.scripts + 'OCRWorker.js?' + core.addon.cache_key);

	importScripts(core.addon.path.scripts + 'supplement/MainWorkerSupplement.js');
	importScripts(core.addon.path.scripts + '3rd/hmac-sha1.js'); // for twitter
	importScripts(core.addon.path.scripts + '3rd/enc-base64-min.js'); // for twitter

	addOsInfoToCore();

	core.addon.path.storage = OS.Path.join(OS.Constants.Path.profileDir, 'jetpack', core.addon.id, 'simple-storage');
	core.addon.path.filestore = OS.Path.join(core.addon.path.storage, 'store.json');

	core.os.filesystem_seperator = platformFilePathSeperator();

	// keys in store:
		// prefs
		// hydrants
		// log
		// editorstate

	// core.addon.path.log = OS.Path.join(core.addon.path.storage, 'history-log.unbracketed.json');
	// core.addon.path.editorstate = OS.Path.join(core.addon.path.storage, 'editorstate.json');
	// core.addon.path.prefs = OS.Path.join(core.addon.path.storage, 'prefs.json');

	// load all localization pacakages
	formatStringFromName('blah', 'main');
	formatStringFromName('blah', 'chrome://global/locale/dateFormat.properties');
	core.addon.l10n = _cache_formatStringFromName_packages;

	// Import ostypes
	importScripts(core.addon.path.scripts + 'ostypes/cutils.jsm');
	importScripts(core.addon.path.scripts + 'ostypes/ctypes_math.jsm');
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.scripts + 'ostypes/ostypes_win.jsm');
			break;
		case 'gtk':
			importScripts(core.addon.path.scripts + 'ostypes/ostypes_x11.jsm');
			break;
		case 'darwin':
			importScripts(core.addon.path.scripts + 'ostypes/ostypes_mac.jsm');
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}

	// OS Specific Init
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				//

			break;
		case 'gtk':

				//

			break;
		case 'darwin':

				//

			break;
		default:
			// do nothing special
	}

	// setTimeoutSync(1000); // i want to delay 1sec to allow old framescripts to destroy

	// setTimeout(readFilestore, 0); // init this as gFilestoreDefaultGetters should be sync, but `prefs__quick_save_dir` not right now, so i have to init it
	// readFilestore();

	// read store to see if we should enable system hotkey
	// setTimeout(function() {
	// 	var system_hotkey = fetchFilestoreEntry({mainkey:'prefs',key:'system_hotkey'});
	// 	if (system_hotkey) {
	// 		hotkeysRegister().then(failed => !failed ? null : callInBootstrap('hotkeyRegistrationFailed', failed));
	// 	}
	// }, 0);
	setTimeout(reflectSystemHotkeyPref, 0); // this does `readFilestore` because it does `fetchFilestoreEntry`

	return {
		core,
		gEditorStateStr
	};
}

// Start - Addon Functionality
// self.onclose = function() {}
function onBeforeTerminate() {
	console.log('doing mainworker term proc');

	writeFilestore();

	var promise_unreg = hotkeysShouldUnregister(); // this isnt really in use as im doing it on before term of worker

	Comm.server.unregAll('worker');

	switch (core.os.mname) {
		case 'android':

				if (OSStuff.jenv) {
					JNI.UnloadClasses(OSStuff.jenv);
				}

			break;
		case 'gtk':

				ostypes.HELPER.ifOpenedXCBConnClose();

			break;
	}


	console.log('ok onBeforeTerminate return point');
	if (promise_unreg) {
		return promise_unreg;
	}

}

// start - Comm functions
function setEntryResourceURI(aFileURI, aEntry) {
	let deferred = new Deferred();
	callInBootstrap('makeResourceURI', aFileURI, aResourceURI => {
		aEntry.src = aResourceURI;
		console.error('aEntry;', aEntry);
		deferred.resolve(true);
	});
	return deferred.promise;
}
function fetchCore(aArg) {
	var { hydrant:hydrant_head, hydrant_ex_instructions, nocore } = aArg || {};

	var deferredmain = new Deferred();
	var promiseallarr = [];

	var rez = { };

	if (!nocore) {
		rez.core = core;
	}

	if (hydrant_head) {
		rez.hydrant = fetchFilestoreEntry({ mainkey:'hydrants', key:hydrant_head });
	}

	if (hydrant_ex_instructions) {
		// hydrant_ex_instructions is object with keys:
			// filestore_entries - optional;array - of strings, each is a key found in filestore
			//
		rez.hydrant_ex = {};

		if (hydrant_ex_instructions.logsrc) {
			var logsrc = JSON.parse(JSON.stringify(fetchFilestoreEntry({ mainkey:'log' })));

			var services = core.nativeshot.services;
			for (var entry of logsrc) {
				mutateEntryForLogsrc(entry);
			}

			// sort by `d` desc
			logsrc.sort((a,b) => b.d-a.d); // crossfile-link189391

			rez.hydrant_ex.logsrc = logsrc;
		}

		if (hydrant_ex_instructions.filestore_entries) {
			for (var filestore_entry of hydrant_ex_instructions.filestore_entries) {
				rez.hydrant_ex[filestore_entry] = fetchFilestoreEntry({ mainkey:filestore_entry });
			}
		}

		if (hydrant_ex_instructions.addon_info) {
			let deferred = new Deferred();
			promiseallarr.push(deferred.promise);
			callInBootstrap('getAddonInfo', undefined, function(aAddonInfo) {
				rez.hydrant_ex.addon_info = aAddonInfo;
				deferred.resolve();
			});
		}
	}

	if (promiseallarr.length) {
		Promise.all(promiseallarr).then(function() {
			deferredmain.resolve(rez);
		});
		return deferredmain.promise;
	} else {
		return rez;
	}
}

function mutateEntryForLogsrc(entry) {
	var services = core.nativeshot.services;
	switch (entry.t) {
		case services.imgur.code:
		case services.imguranon.code:
				entry.src = 'http://i.imgur.com/' + entry.i + '.png'
			break;
		case services.savequick.code:
		case services.savebrowse.code:
				// var path = OS.Path.join(entry.f, entry.n);
				// var fileuri = OS.Path.toFileURI(path);
				entry.src = OS.Path.toFileURI(OS.Path.join(entry.f, entry.n));
				// promiseallarr.push(setEntryResourceURI(fileuri, entry));
				delete entry.f;
				delete entry.n;
			break;
		default:
			if (!getServiceFromCode(entry.t).entry.noimg) {
				// it has a l, turn that to src
				// if (!entry.l) { console.error('deverror: i thought this should have l but it doesnt:', entry); throw new Error('deverror: i thought this would have l') }
				entry.src = entry.l;
				// delete entry.l;
			} // else it is noimg
	}
	return entry;
}
// end - Comm functions

// start - platform functions
function trashFile(aFilePlatPath) {
	// aFilePlatPath is a js string

	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				// http://stackoverflow.com/a/23721071/1828637
				var sfo = ostypes.TYPE.SHFILEOPSTRUCT();
				sfo.hwnd = null;
				sfo.wFunc = ostypes.CONST.FO_DELETE;
				sfo.pFrom = ostypes.TYPE.PCZZTSTR.targetType.array(aFilePlatPath.length + 2)(aFilePlatPath); // + 2 because we need it double terminated, that is the definition of PCZZTSTR per the msdn docs
				sfo.pTo = null;
				sfo.fFlags = ostypes.CONST.FOF_ALLOWUNDO | ostypes.CONST.FOF_NOCONFIRMATION | ostypes.CONST.FOF_NOERRORUI | ostypes.CONST.FOF_SILENT;
				sfo.fAnyOperationsAborted = 0;
				sfo.hNameMappings = null;
				sfo.lpszProgressTitle = null;

				console.log('sfo.pFrom:', sfo.pFrom.toString());

				var rez_trash = ostypes.API('SHFileOperation')(sfo.address());
				console.log('rez_trash:', rez_trash);
				console.log('sfo.fAnyOperationsAborted:', sfo.fAnyOperationsAborted);

				if (cutils.jscEqual(rez_trash, 0)) {
					return true;
				} else {
					return false;
				}


			break;
		case 'gtk':

				var cGFile = ostypes.API('g_file_new_for_path')(aFilePlatPath);
				console.log('cGFile:', cGFile);

				var rez_trash = ostypes.API('g_file_trash')(cGFile, null, null);
				console.log('rez_trash:', rez_trash);

				if (cutils.jscEqual(rez_trash, 1)) {
					return true;
				} else {
					// i have only seen it be 0 on fail
					return false;
				}

			break;
		case 'darwin':

				// http://stackoverflow.com/a/18069259/1828637
				var trashNSStrings = new ostypes.HELPER.nsstringColl();
				try {

					var NSArray = ostypes.HELPER.class('NSArray');
					// var cNSArray = ostypes.API('objc_msgSend')(NSArray, ostypes.HELPER.sel('array'));

					var NSURL = ostypes.HELPER.class('NSURL');
					console.log('aFilePlatPath:', aFilePlatPath);

					var cMacUrl = ostypes.API('objc_msgSend')(NSURL, ostypes.HELPER.sel('fileURLWithPath:isDirectory:'), trashNSStrings.get(aFilePlatPath), ostypes.CONST.NO);
					console.log('cMacUrl:', cMacUrl);
					if (cMacUrl.isNull()) {
						console.error('failed to create NSURL');
						return false;
					}

					var cMacUrlArray = ostypes.API('objc_msgSend')(NSArray, ostypes.HELPER.sel('arrayWithObject:'), cMacUrl);
					console.log('cMacUrlArray:', cMacUrlArray);

					var NSWorkspace = ostypes.HELPER.class('NSWorkspace');

					var sharedWorkspace = ostypes.API('objc_msgSend')(NSWorkspace, ostypes.HELPER.sel('sharedWorkspace'));

					var rez_trash = ostypes.API('objc_msgSend')(sharedWorkspace, ostypes.HELPER.sel('recycleURLs:completionHandler:'), cMacUrlArray, ostypes.CONST.NIL); // verified that NIL is not modified it is still 0x0 after calling this
					console.log('rez_trash:', rez_trash); // value is meaningless

					// as val of rez_trash is meaningless i have to check until its trashed. i dont think this function blocks till trash completes, so i loop below
					var TRASHED_CHECK_INTERVAL = 100; // ms
					var MAX_TRASHED_CHECK_CNT = Math.ceil(10000 / TRASHED_CHECK_INTERVAL); // checks for 10,000 ms
					var trashed_check_i = 0;
					while (trashed_check_i < MAX_TRASHED_CHECK_CNT) {
						var trashedFileExists = OS.File.exists(aFilePlatPath);
						console.log(trashed_check_i, 'trashedFileExists:', trashedFileExists);
						if (!trashedFileExists) {
							// yes it was trashed
							return true;
						}
						setTimeoutSync(TRASHED_CHECK_INTERVAL);
						trashed_check_i++;
					}
					return false; // checked max times, and the file is still not yet trashed, so report false for rez_trash

					// with callback block - this cannot be run from ChromeWorker's - this is a firefox bug i have to link the bugzilla here
					// var handlerId = new Date().getTime();
					// OSStuff[handlerId] = {};
					//
					// OSStuff[handlerId].myHandler_js = function(NSURLs, error) {
					// 	console.error('handler called');
					//
					// 	console.log('error:', error, error.toString(), error.isNull());
					//
					// 	// return nothing as per its IMP
					// };
					// ostypes.TYPE.NSURLs = ctypes.voidptr_t;
					// ostypes.TYPE.NSError = ctypes.voidptr_t;
					// var IMP_for_completionHandler = ctypes.FunctionType(ostypes.TYPE.CALLBACK_ABI, ostypes.TYPE.VOID, [ostypes.TYPE.NSURLs, ostypes.TYPE.NSError]);
					// OSStuff[handlerId].myHandler_c = IMP_for_completionHandler.ptr(OSStuff[handlerId].myHandler_js);
					// var myBlock_c = ostypes.HELPER.createBlock(OSStuff[handlerId].myHandler_c);
					//
					// var rez_trash = ostypes.API('objc_msgSend')(sharedWorkspace, ostypes.HELPER.sel('recycleURLs:completionHandler:'), cMacUrlArray, myBlock_c.address()); // verified that NIL is not modified it is still 0x0 after calling this
					// console.log('rez_trash:', rez_trash);


				} finally {
					if (trashNSStrings) {
						trashNSStrings.releaseAll()
					}
				}

			break;
		default:
			throw new Error('os not supported ' + core.os.name);
	}
}

function shootAllMons() {

	var collMonInfos = [];

	// if (core.os.name.indexOf('win') === 0) {
		// if (!SetProcessDpiAwareness) {
			// var shcore = ctypes.open('shcore');
			// SetProcessDpiAwareness = shcore.declare('SetProcessDpiAwareness', ostypes.TYPE.ABI, ostypes.TYPE.HRESULT, ostypes.TYPE.int);
		// }

		// var PROCESS_PER_MONITOR_DPI_AWARE = 2;
		// var rez_setaware = SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);
		// console.log('rez_setaware:', rez_setaware, 'convertPrimHrToHex:', convertPrimHrToHex(rez_setaware));
	// }

	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				// start - get all monitor resolutions
				var iDevNum = -1;
				while (true) {
					iDevNum++;
					var lpDisplayDevice = ostypes.TYPE.DISPLAY_DEVICE();
					lpDisplayDevice.cb = ostypes.TYPE.DISPLAY_DEVICE.size;
					var rez_EnumDisplayDevices = ostypes.API('EnumDisplayDevices')(null, iDevNum, lpDisplayDevice.address(), 0);


					if (cutils.jscEqual(rez_EnumDisplayDevices, 0)) { // ctypes.winLastError != 0
						// iDevNum is greater than the largest device index.
						break;
					}

					var StateFlags = parseInt(cutils.jscGetDeepest(lpDisplayDevice.StateFlags));


					if (StateFlags & ostypes.CONST.DISPLAY_DEVICE_MIRRORING_DRIVER) {
						// skip this one, its a mirror monitor (like vnc or webex)
					} else if (StateFlags & ostypes.CONST.DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) {


						var dm = ostypes.TYPE.DEVMODE(); // SIZEOF_DEVMODE = 220 on 32bit fx Win8.1 64bit when I do insepction though dm.size is set to 188

						//dm.dmFields = ostypes.CONST.DM_PELSWIDTH;
						//dm.dmSize = ostypes.TYPE.DEVMODE.size;


						var rez_EnumDisplaySettings = ostypes.API('EnumDisplaySettings')(lpDisplayDevice.DeviceName, ostypes.CONST.ENUM_CURRENT_SETTINGS, dm.address());






						collMonInfos.push({
							x: parseInt(cutils.jscGetDeepest(dm.u.dmPosition.x)),
							y: parseInt(cutils.jscGetDeepest(dm.u.dmPosition.y)),
							w: parseInt(cutils.jscGetDeepest(dm.dmPelsWidth)),
							h: parseInt(cutils.jscGetDeepest(dm.dmPelsHeight)),
							screenshot: null, // for winnt, each collMonInfos entry has screenshot data
							otherInfo: {
								nBPP: parseInt(cutils.jscGetDeepest(dm.dmBitsPerPel)),
								lpszDriver: null,
								lpszDevice: lpDisplayDevice.DeviceName
							}
						});

						if (StateFlags & ostypes.CONST.DISPLAY_DEVICE_PRIMARY_DEVICE) {
							collMonInfos[collMonInfos.length-1].primary = true;
						}
					}
				}
				// end - get all monitor resolutions

				var swapBandRinUint8 = function(aUint8) {
					var pos = 0;
					var cArrLen = aUint8.length;
					while (pos < cArrLen) {
						var B = aUint8[pos];

						aUint8[pos] = aUint8[pos+2];
						aUint8[pos+2] = B;
						aUint8[pos+3] = 255;

						pos += 4;
					}
				};

				// start - take shot of each monitor
				var dpiScaleX;
				var dpiScaleY;
				for (var s=0; s<collMonInfos.length; s++) {

					var hdcScreen = ostypes.API('CreateDC')(collMonInfos[s].otherInfo.lpszDriver, collMonInfos[s].otherInfo.lpszDevice, null, null);

					if (ctypes.winLastError != 0) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcScreen, winLastError: "' + ctypes.winLastError + '" and hdcScreen: "' + hdcScreen.toString(),
							winLastError: ctypes.winLastError
						});
					}

					if (s == 0) {
						var dpiX = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.LOGPIXELSX)));
						var dpiY = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.LOGPIXELSY)));
						// console.log('dpiX:', dpiX, 'dpiY:', dpiY);
						dpiScaleX = dpiX / 96; // because 96 is default which is 1
						dpiScaleY = dpiY / 96;
					}

					if (core.os.version >= 6.3) { // for scale purposes for non dpi aware process due to bug 890156
						collMonInfos[s].otherInfo.scaledWidth = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.HORZRES)));
						collMonInfos[s].otherInfo.scaledHeight = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.VERTRES)));
						// var win81ScaleX = collMonInfos[s].w / collMonInfos[s].otherInfo.scaledWidth;
						// var win81ScaleY = collMonInfos[s].h / collMonInfos[s].otherInfo.scaledHeight;
						var win81ScaleX = (collMonInfos[s].w / collMonInfos[s].otherInfo.scaledWidth) * dpiScaleX;
						var win81ScaleY = (collMonInfos[s].h / collMonInfos[s].otherInfo.scaledHeight) * dpiScaleY;
						if (win81ScaleX != 1) {
							collMonInfos[s].win81ScaleX = win81ScaleX;
						}
						if (win81ScaleY != 1) {
							collMonInfos[s].win81ScaleY = win81ScaleY;
						}
					} else if (dpiScaleX != 1 || dpiScaleY != 1) {
						// console.log('dpiScaleX, dpiScaleY', dpiScaleX, dpiScaleY);
						collMonInfos[s].win81ScaleX = dpiScaleX;
						collMonInfos[s].win81ScaleY = dpiScaleY;
						// console.log('win81ScaleX, win81ScaleY', collMonInfos[s].win81ScaleX, collMonInfos[s].win81ScaleY);
					}

					var w = collMonInfos[s].w;
					var h = collMonInfos[s].h;

					var modW = w % 4;
					var useW = modW != 0 ? w + (4-modW) : w;
					// console.log('useW:', useW, 'w:', w);

					var hdcMemoryDC = ostypes.API('CreateCompatibleDC')(hdcScreen);

					if (ctypes.winLastError != 0) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcMemoryDC, winLastError: "' + ctypes.winLastError + '" and hdcMemoryDC: "' + hdcMemoryDC.toString(),
							winLastError: ctypes.winLastError
						});
					}


					// CreateDIBSection stuff
					var bmi = ostypes.TYPE.BITMAPINFO();
					bmi.bmiHeader.biSize = ostypes.TYPE.BITMAPINFOHEADER.size;
					bmi.bmiHeader.biWidth = w;
					bmi.bmiHeader.biHeight = -1 * h; // top-down
					bmi.bmiHeader.biPlanes = 1;
					bmi.bmiHeader.biBitCount = collMonInfos[s].otherInfo.nBPP; // 32
					bmi.bmiHeader.biCompression = ostypes.CONST.BI_RGB;
					// bmi.bmiHeader.biXPelsPerMeter = dpiX;
					// bmi.bmiHeader.biYPelsPerMeter = dpiY;

					// delete collMonInfos[s].nBPP; // mainthread has no more need for this

					var pixelBuffer = ostypes.TYPE.BYTE.ptr();

					// CreateDIBSection stuff

					var hbmp = ostypes.API('CreateDIBSection')(hdcScreen, bmi.address(), ostypes.CONST.DIB_RGB_COLORS, pixelBuffer.address(), null, 0);
					if (hbmp.isNull()) { // do not check winLastError when using v5, it always gives 87 i dont know why, but its working

						throw new Error({
							name: 'os-api-error',
							message: 'Failed hbmp, winLastError: "' + ctypes.winLastError + '" and hbmp: "' + hbmp.toString(),
							winLastError: ctypes.winLastError
						});
					}

					var rez_SO = ostypes.API('SelectObject')(hdcMemoryDC, hbmp);

					if (ctypes.winLastError != 0) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_SO, winLastError: "' + ctypes.winLastError + '" and rez_SO: "' + rez_SO.toString(),
							winLastError: ctypes.winLastError
						});
					}

					var rez_BB = ostypes.API('BitBlt')(hdcMemoryDC, 0, 0, w, h, hdcScreen, 0, 0, ostypes.CONST.SRCCOPY);

					if (ctypes.winLastError != 0) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_BB, winLastError: "' + ctypes.winLastError + '" and rez_BB: "' + rez_BB.toString(),
							winLastError: ctypes.winLastError
						});
					}



					var arrLen = w * h * 4;
					// var imagedata = new ImageData(useW, h);
					var monShotBuf = new ArrayBuffer(arrLen);


					var pixelBufferLen = w * h *4; // cannot use arrLen here as that uses useW which is not w, if i do memcpy will crash obviously
					ostypes.API('memcpy')(monShotBuf, pixelBuffer, pixelBufferLen);


					var monShotUint8 = new Uint8Array(monShotBuf);

					// swap bytes to go from BRGA to RGBA
					// Reorganizing the byte-order is necessary as canvas can only hold data in RGBA format (little-endian, ie. ABGR in the buffer). Here is one way to do this:

					swapBandRinUint8(monShotUint8);


					collMonInfos[s].screenshotArrBuf = monShotBuf;

					// release memory of screenshot stuff
					//delete collMonInfos[s].otherInfo;
					// lpDisplayDevice = null;
					dm = null;
					// imagedata = null;

					var rez_DelDc1 = ostypes.API('DeleteDC')(hdcScreen);


					var rez_DelDc2 = ostypes.API('DeleteDC')(hdcMemoryDC);


					var rez_DelObj1 = ostypes.API('DeleteObject')(hbmp);

				}

				// end - take shot of each monitor

				/*
				// get dpi for all monitors so can draw to canvas properly:
				var jsMonitorEnumProc = function(hMonitor, hdcMonitor, lprcMonitor, dwData) {

					// rezArr.push({
						// xTopLeft: parseInt(cutils.jscGetDeepest(lprcMonitor.contents.left)),
						// yTopLeft: parseInt(cutils.jscGetDeepest(lprcMonitor.contents.top))
					// });
					// rezArr[rezArr.length - 1].nWidth = parseInt(cutils.jscGetDeepest(lprcMonitor.contents.right)) - rezArr[rezArr.length - 1].xTopLeft;
					// rezArr[rezArr.length - 1].nHeight = parseInt(cutils.jscGetDeepest(lprcMonitor.contents.bottom)) - rezArr[rezArr.length - 1].yTopLeft;

					// get device name
					var cMonInfo = ostypes.TYPE.MONITORINFOEX();
					cMonInfo.cbSize = ostypes.TYPE.MONITORINFOEX.size;
					var rez_GetMonitorInfo = ostypes.API('GetMonitorInfo')(hMonitor, cMonInfo.address());

					if (cutils.jscEqual(rez_GetMonitorInfo, 0)) {

						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_GetMonitorInfo, winLastError: "' + ctypes.winLastError + '" and rez_GetMonitorInfo: "' + rez_GetMonitorInfo.toString(),
							winLastError: ctypes.winLastError
						});
					}
					// rezArr[rezArr.length-1].argsCreateDC = {
						// lpszDriver: null,
						// lpszDevice: cMonInfo.szDevice
					// };

					var dpiX = ostypes.TYPE.UINT();
					var dpiY = ostypes.TYPE.UINT();
					var rez_GetDPI = ostypes.API('GetDpiForMonitor')(hMonitor, ostypes.CONST.MDT_Raw_DPI, dpiX.address(), dpiY.address());




					var foundLPSZ = false;
					for (var z=0; z<collMonInfos.length; z++) {
						if (collMonInfos[z].otherInfo.lpszDevice.toString() == cMonInfo.szDevice.toString()) {
							foundLPSZ = true;
							collMonInfos[z].dpiX = parseInt(cutils.jscGetDeepest(dpiX));
							collMonInfos[z].dpiY = parseInt(cutils.jscGetDeepest(dpiY));
							break;
						}
					}
					if (!foundLPSZ) {

					}
					return true; // continue enumeration
				}
				var cMonitorEnumProc = ostypes.TYPE.MONITORENUMPROC.ptr(jsMonitorEnumProc);
				var rez_EnumDisplayMonitors = ostypes.API('EnumDisplayMonitors')(null, null, cMonitorEnumProc, 0);
				*/


				for (var i=0; i<collMonInfos.length; i++) {
					delete collMonInfos[i].otherInfo;

				}

			break;
		case 'gtk':

				// start - get all monitor resolutions

				// get root window
				var setup = ostypes.API('xcb_get_setup')(ostypes.HELPER.cachedXCBConn());
				console.log('setup:', setup.contents);

				var screens = ostypes.API('xcb_setup_roots_iterator')(setup);
				var rootWin = screens.data.contents.root;
				console.log('rootWin:', rootWin);

				// get screens
				var reqScreens = ostypes.API('xcb_randr_get_screen_resources_current')(ostypes.HELPER.cachedXCBConn(), rootWin);
				var replyScreens = ostypes.API('xcb_randr_get_screen_resources_current_reply')(ostypes.HELPER.cachedXCBConn(), reqScreens, null);

				console.log('replyScreens:', replyScreens);
				console.log('replyScreens.contents:', replyScreens.contents);

				var timestamp = replyScreens.contents.config_timestamp;
				console.log('timestamp:', timestamp);

				var len = ostypes.API('xcb_randr_get_screen_resources_current_outputs_length')(replyScreens);
				console.log('len:', len);

				var randr_outputs = ostypes.API('xcb_randr_get_screen_resources_current_outputs')(replyScreens);
				console.log('randr_outputs:', randr_outputs);

				randr_outputs = ctypes.cast(randr_outputs, ostypes.TYPE.xcb_randr_output_t.array(len).ptr).contents;
				console.log('casted randr_outputs:', randr_outputs);

				for (var i=0; i<len; i++) {
					console.log('randr_outputs[i]:', randr_outputs[i]);
					var reqOutput = ostypes.API('xcb_randr_get_output_info')(ostypes.HELPER.cachedXCBConn(), randr_outputs[i], timestamp);
					var output = ostypes.API('xcb_randr_get_output_info_reply')(ostypes.HELPER.cachedXCBConn(), reqOutput, null);

					console.log('output:', output);
					console.log('output.contents:', output.contents);

					if (output.isNull()) {
						console.warn('got null output but will continue to len');
						continue;
					}

					if (cutils.jscEqual(output.contents.crtc, ostypes.CONST.XCB_NONE) || cutils.jscEqual(output.contents.connection, ostypes.CONST.XCB_RANDR_CONNECTION_DISCONNECTED)) {
						console.warn('continue becuase its XCB_NONE or XCB_RANDR_CONNECTION_DISCONNECTED');
						continue;
					}

					var reqCrtc = ostypes.API('xcb_randr_get_crtc_info')(ostypes.HELPER.cachedXCBConn(), output.contents.crtc, timestamp);
					var crtc = ostypes.API('xcb_randr_get_crtc_info_reply')(ostypes.HELPER.cachedXCBConn(), reqCrtc, null);

					console.log('crtc.contents:', crtc.contents);

					collMonInfos.push({
						x: parseInt(cutils.jscGetDeepest(crtc.contents.x)),
						y: parseInt(cutils.jscGetDeepest(crtc.contents.y)),
						w: parseInt(cutils.jscGetDeepest(crtc.contents.width)),
						h: parseInt(cutils.jscGetDeepest(crtc.contents.height)),
						screenshot: null // for x11, i take the big canvas and protion to each mon
					});

					ostypes.API('free')(crtc);
					ostypes.API('free')(output);
				}

				ostypes.API('free')(replyScreens);



				// end - get all monitor resolutions

				// start - take shot of all monitors and push to just first element of collMonInfos
				// https://github.com/BoboTiG/python-mss/blob/a4d40507c492962d59fcb97a509ede1f4b8db634/mss.py#L116

				// // this call to XGetWindowAttributes grab one screenshot of all monitors
				// var gwa = ostypes.TYPE.XWindowAttributes();
				// var rez_XGetWinAttr = ostypes.API('XGetWindowAttributes')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), gwa.address());
                //
				//
				// var fullWidth = parseInt(cutils.jscGetDeepest(gwa.width));
				// var fullHeight = parseInt(cutils.jscGetDeepest(gwa.height));
				// var originX = parseInt(cutils.jscGetDeepest(gwa.x));
				// var originY = parseInt(cutils.jscGetDeepest(gwa.y));

				// figure out full width/height, and x y
				var minX = collMonInfos[0].x;
				var maxX = collMonInfos[0].x + collMonInfos[0].w;
				var minY = collMonInfos[0].y;
				var maxY = collMonInfos[0].y + collMonInfos[0].h;
				for (var i=1; i<collMonInfos.length; i++) {
					var cMinX = collMonInfos[i].x;
					var cMaxX = collMonInfos[i].x + collMonInfos[i].w;
					var cMinY = collMonInfos[i].y;
					var cMaxY = collMonInfos[i].y + collMonInfos[i].h;

					if (cMinX < minX) {
						minX = cMinX;
					}
					if (cMaxX > maxX) {
						maxX = cMaxX;
					}
					if (cMinY < minY) {
						minY = cMinY;
					}
					if (cMaxY > maxY) {
						maxY = cMaxY;
					}
				}

				var fullWidth = maxX - minX;
				var fullHeight = maxY - minY;

				console.log(minX, minY, maxX, maxY, fullWidth, fullHeight);

				// capture shot
				var reqShot = ostypes.API('xcb_get_image')(ostypes.HELPER.cachedXCBConn(), ostypes.CONST.XCB_IMAGE_FORMAT_Z_PIXMAP, rootWin, minX, minY, fullWidth, fullHeight, ostypes.CONST.XCB_ALL_PLANES);
				var replyShot = ostypes.API('xcb_get_image_reply')(ostypes.HELPER.cachedXCBConn(), reqShot, null);

				console.log('replyShot:', replyShot);
				console.log('replyShot.contents:', replyShot.contents);

				var dataShot = ostypes.API('xcb_get_image_data')(replyShot);
				console.log('dataShot:', dataShot);

				var fullLen = 4 * fullWidth * fullHeight;

				var allShotBuf = new ArrayBuffer(fullWidth * fullHeight * 4);

				ostypes.API('memcpy')(allShotBuf, dataShot, fullLen);

				// should call XDestroyImage on ximage
				ostypes.API('free')(replyShot);

				var allShotUint8 = new Uint8Array(allShotBuf);
				// end - take shot of all monitors and push to just first element of collMonInfos

				// start - because took a single screenshot of alllll put togather, lets portion out the imagedata


				// optimized linux from 1900ms down to 45ms from chat on #extdev on sept 18 2015 ~430-630am
				var portionOutAllToMonFromBgra0ToRgba255 = function(cutoutMonW, cutoutMonH, cutoutMonX, cutoutMonY) {
					// returns aMonUint
					var monShotBuf = new ArrayBuffer(cutoutMonW * cutoutMonH * 4);
					var monShotUint8 = new Uint8Array(monShotBuf);

					var allShotEndY = cutoutMonY + cutoutMonH;
					var allShotEndX = cutoutMonX + cutoutMonW;
					var si = 0;
					for (var y=cutoutMonY; y<allShotEndY; y++) {
						var pixY = (fullWidth * y << 2); // << 2 is same as * 4
						for (var x=cutoutMonX; x<allShotEndX; x++) {
							var pixXY = pixY + (x << 2);
							var B = allShotUint8[pixXY];
							monShotUint8[si] = allShotUint8[pixXY+2];
							monShotUint8[si+1] = allShotUint8[pixXY+1];
							monShotUint8[si+2] = B;
							monShotUint8[si+3] = 255;
							si += 4;
						}
					}

					return monShotBuf;
				};

				for (var i=0; i<collMonInfos.length; i++) {
					var monUseW = collMonInfos[i].w;
					var monUseH = collMonInfos[i].h;

					collMonInfos[i].screenshotArrBuf = portionOutAllToMonFromBgra0ToRgba255(monUseW, monUseH, collMonInfos[i].x, collMonInfos[i].y);
				}

				// end - because took a single screenshot of alllll put togather, lets portion out the imagedata

			break;
		case 'darwin':

				// start - get monitor resolutions
				var displays = ostypes.TYPE.CGDirectDisplayID.array(32)(); // i guess max possible monitors is 32
				var count = ostypes.TYPE.uint32_t();



				var maxDisplays = displays.constructor.size / ostypes.TYPE.CGDirectDisplayID.size;
				var activeDspys = displays; // displays.address() didnt work it threw `expected type pointer, got ctypes.uint32_t.array(32).ptr(ctypes.UInt64("0x11e978080"))` // the arg in declare is `self.TYPE.CGDirectDisplayID.ptr,	// *activeDisplays` // without .address() worked
				var dspyCnt = count.address();


				var rez_CGGetActiveDisplayList = ostypes.API('CGGetActiveDisplayList')(maxDisplays, activeDspys, dspyCnt);

				if (!cutils.jscEqual(rez_CGGetActiveDisplayList, ostypes.CONST.kCGErrorSuccess)) {

					throw new Error({
						name: 'os-api-error',
						message: 'Failed , errno: "' + ctypes.errno + '" and : "' + rez_CGGetActiveDisplayList.toString(),
						errno: ctypes.errno
					});
				}

				count = parseInt(cutils.jscGetDeepest(count));

				var i_nonMirror = {};

				var minScreenX;
				var minScreenY;

				var rect = ostypes.CONST.CGRectNull;
				// var primaryDisplayRect;
				var primaryDisplayRectInfo;

				for (var i=0; i<count; i++) {
					// if display is secondary mirror of another display, skip it


					var rez_CGDisplayMirrorsDisplay = ostypes.API('CGDisplayMirrorsDisplay')(displays[i]);


					if (!cutils.jscEqual(rez_CGDisplayMirrorsDisplay, ostypes.CONST.kCGNullDirectDisplay)) { // If CGDisplayMirrorsDisplay() returns 0 (a.k.a. kCGNullDirectDisplay), then that means the display is not mirrored.
						continue;
					}
					i_nonMirror[i] = collMonInfos.length; // the length here, will be the i index of the CGDisplayBounds in collMonInfos

					var rez_CGDisplayBounds = ostypes.API('CGDisplayBounds')(displays[i]);


					collMonInfos.push({
						x: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.origin.x)),
						y: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.origin.y)),
						w: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.size.width)),
						h: parseInt(cutils.jscGetDeepest(rez_CGDisplayBounds.size.height)),
						screenshot: null // for darwin, i take the big canvas and protion to each mon
					});

					if (minScreenX === undefined) {
						minScreenX = collMonInfos[i_nonMirror[i]].x;
						minScreenY = collMonInfos[i_nonMirror[i]].y;
					} else {
						if (collMonInfos[i_nonMirror[i]].x < minScreenX) {
							minScreenX = collMonInfos[i_nonMirror[i]].x;
						}
						if (collMonInfos[i_nonMirror[i]].y < minScreenY) {
							minScreenY = collMonInfos[i_nonMirror[i]].y;
						}
					}

					if (!primaryDisplayRectInfo) {
						// assuming the first non mirror is primary per http://stackoverflow.com/questions/28216681/how-can-i-get-screenshot-from-all-displays-on-mac/28247749#comment53261634_28247749
						collMonInfos[collMonInfos.length-1].primary = true;
						// primaryDisplayRect = rez_CGDisplayBounds;
						primaryDisplayRectInfo = collMonInfos[collMonInfos.length-1];
					}

					// rez_CGDisplayBounds.origin.y = ostypes.API('CGRectGetMaxY')(primaryDisplayRect) - ostypes.API('CGRectGetMaxY')(displayRect);
					// need to do correction just on Y and not on X because "Y coordinate because that's the only difference between Cocoa's coordinate system and Core Graphics' coordinate system" // http://stackoverflow.com/questions/28216681/how-can-i-get-screenshot-from-all-displays-on-mac/28247749#comment53248403_28247749
					rez_CGDisplayBounds.origin.y = (primaryDisplayRectInfo.y + primaryDisplayRectInfo.h) - (collMonInfos[collMonInfos.length-1].y + collMonInfos[collMonInfos.length-1].h); // because CGRectGetMaxY is just ` rect.origin.y + rect.size.height;` as per https://github.com/joshpc/SBLayoutManager/blob/b899e10834d27f3569b5a8e2de296f19b8f9003d/SBLayoutManager/CGRectHelpers.m#L22 // and also [0] instead of primaryDisplayRect as the first one is primary monitor per link5233423
					collMonInfos[collMonInfos.length-1].corrected_y = rez_CGDisplayBounds.origin.y;
					rect = ostypes.API('CGRectUnion')(rect, rez_CGDisplayBounds);

				}
				// start - get monitor resolutions

				// start - take one big screenshot of all monitors
				if (Object.keys(i_nonMirror).length == 0) {
					// what on earth, no monitors that arent mirrors?
					return []; // as there is nothing to screenshot
				}

				/*
				NSBitmapImageRep* imageRep = [[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL
                                                                         pixelsWide:CGRectGetWidth(rect)
                                                                         pixelsHigh:CGRectGetHeight(rect)
                                                                      bitsPerSample:8
                                                                    samplesPerPixel:4
                                                                           hasAlpha:YES
                                                                           isPlanar:NO
                                                                     colorSpaceName:NSCalibratedRGBColorSpace
                                                                       bitmapFormat:0
                                                                        bytesPerRow:0
                                                                       bitsPerPixel:32];
				*/
				var myNSStrings;
				var allocNSBIP;
				try {
					var rez_hideCursor = ostypes.API('CGDisplayHideCursor')(ostypes.CONST.kCGNullDirectDisplay);

					myNSStrings = new ostypes.HELPER.nsstringColl();

					var rez_width = ostypes.API('CGRectGetWidth')(rect);


					var rez_height = ostypes.API('CGRectGetHeight')(rect);


					var NSBitmapImageRep = ostypes.HELPER.class('NSBitmapImageRep');
					allocNSBIP = ostypes.API('objc_msgSend')(NSBitmapImageRep, ostypes.HELPER.sel('alloc'));


					var imageRep = ostypes.API('objc_msgSend')(allocNSBIP, ostypes.HELPER.sel('initWithBitmapDataPlanes:pixelsWide:pixelsHigh:bitsPerSample:samplesPerPixel:hasAlpha:isPlanar:colorSpaceName:bitmapFormat:bytesPerRow:bitsPerPixel:'),  // https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ApplicationKit/Classes/NSBitmapImageRep_Class/index.html#//apple_ref/occ/instm/NSBitmapImageRep/initWithBitmapDataPlanes:pixelsWide:pixelsHigh:bitsPerSample:samplesPerPixel:hasAlpha:isPlanar:colorSpaceName:bitmapFormat:bytesPerRow:bitsPerPixel:
						ostypes.TYPE.unsigned_char.ptr.ptr(null),								// planes
						ostypes.TYPE.NSInteger(rez_width),										// pixelsWide
						ostypes.TYPE.NSInteger(rez_height),										// pixelsHigh
						ostypes.TYPE.NSInteger(8),												// bitsPerSample
						ostypes.TYPE.NSInteger(4),												// samplesPerPixel
						ostypes.CONST.YES,														// hasAlpha
						ostypes.CONST.NO,														// isPlanar
						myNSStrings.get('NSDeviceRGBColorSpace'),							// colorSpaceName
						ostypes.TYPE.NSBitmapFormat(0),											// bitmapFormat
						ostypes.TYPE.NSInteger(4 * rez_width),									// bytesPerRow
						ostypes.TYPE.NSInteger(32)												// bitsPerPixel
					);

					if (imageRep.isNull()) { // im guessing this is how to error check it
						throw new Error({
							name: 'os-api-error',
							message: 'Failed imageRep, errno: "' + ctypes.errno + '" and : "' + imageRep.toString(),
							errno: ctypes.errno
						});
					}

					// NSGraphicsContext* context = [NSGraphicsContext graphicsContextWithBitmapImageRep:imageRep];
					var NSGraphicsContext = ostypes.HELPER.class('NSGraphicsContext');
					var context = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('graphicsContextWithBitmapImageRep:'), imageRep);

					if (context.isNull()) { // im guessing this is how to error check it
						throw new Error({
							name: 'os-api-error',
							message: 'Failed context, errno: "' + ctypes.errno + '" and : "' + context.toString(),
							errno: ctypes.errno
						});
					}

					// [NSGraphicsContext saveGraphicsState];
					var rez_saveGraphicsState = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('saveGraphicsState'));


					// [NSGraphicsContext setCurrentContext:context];
					var rez_setCurrentContext = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('setCurrentContext:'), context);


					// CGContextRef cgcontext = [context graphicsPort];
					var cgcontext = ostypes.API('objc_msgSend')(context, ostypes.HELPER.sel('graphicsPort'));


					// CGContextClearRect(cgcontext, CGRectMake(0, 0, CGRectGetWidth(rect), CGRectGetHeight(rect)));
					var rez_width2 = ostypes.API('CGRectGetWidth')(rect);


					var rez_height2 = ostypes.API('CGRectGetHeight')(rect);


					var rez_CGRectMake = ostypes.API('CGRectMake')(0, 0, rez_width2, rez_height2);


					var casted_cgcontext = ctypes.cast(cgcontext, ostypes.TYPE.CGContextRef);
					var rez_CGContextClearRect = ostypes.API('CGContextClearRect')(casted_cgcontext, rez_CGRectMake); // returns void



					var rectOriginX = parseInt(cutils.jscGetDeepest(rect.origin.x));
					var rectOriginY = parseInt(cutils.jscGetDeepest(rect.origin.y));






					// note: i_nonMirror, keys are the i value it corresponds to in displays Array, and value is the i value it corresponds to in collMonInfos Array
					for (var i in i_nonMirror) { // if display is secondary mirror of another display, skip it

						// CGRect displayRect = CGDisplayBounds(displays[i]);
						// var displayRect = ostypes.API('CGDisplayBounds')(displays[i]);



						// CGImageRef image = CGDisplayCreateImage(displays[i]);
						var image = ostypes.API('CGDisplayCreateImage')(displays[i]);

						if (image.isNull()) {

							continue;
						}

						// CGRect dest = CGRectMake(displayRect.origin.x - rect.origin.x,
						//               displayRect.origin.y - rect.origin.y,
						//               displayRect.size.width,
						//               displayRect.size.height);
						var dest = ostypes.API('CGRectMake')(
							collMonInfos[i_nonMirror[i]].x - rectOriginX,
							collMonInfos[i_nonMirror[i]].corrected_y - rectOriginY,
							collMonInfos[i_nonMirror[i]].w,
							collMonInfos[i_nonMirror[i]].h
						);




						// CGContextDrawImage(cgcontext, dest, image);
						ostypes.API('CGContextDrawImage')(casted_cgcontext, dest, image); // reutrns void


						// CGImageRelease(image);
						ostypes.API('CGImageRelease')(image); // returns void


					}

					// [[NSGraphicsContext currentContext] flushGraphics];
					var rez_currentContext = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('currentContext'));


					var rez_flushGraphics = ostypes.API('objc_msgSend')(rez_currentContext, ostypes.HELPER.sel('flushGraphics'));


					// [NSGraphicsContext restoreGraphicsState];
					var rez_restoreGraphicsState = ostypes.API('objc_msgSend')(NSGraphicsContext, ostypes.HELPER.sel('restoreGraphicsState'));

					// end - take one big screenshot of all monitors

					// // start - write to desktop
					// // NSData* data = [imageRep representationUsingType:NSPNGFileType properties:@{ }];
					//
					// var NSDictionary = ostypes.HELPER.class('NSDictionary');
					// var tempDict = ostypes.API('objc_msgSend')(NSDictionary, ostypes.HELPER.sel('dictionary')); //gives us temporary dicationary, one that gets auto released? well whatever its something not allocated so we dont have to release it
                    //
					//
					// var data = ostypes.API('objc_msgSend')(imageRep, ostypes.HELPER.sel('representationUsingType:properties:'), ostypes.CONST.NSPNGFileType, tempDict); // https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ApplicationKit/Classes/NSBitmapImageRep_Class/index.html#//apple_ref/occ/instm/NSBitmapImageRep/representationUsingType:properties:
					//
					// // [data writeToFile:@"/tmp/screenshot.png" atomically:YES];
					// var rez_writeToFile = ostypes.API('objc_msgSend')(data, ostypes.HELPER.sel('writeToFile:atomically:'), myNSStrings.get(OS.Path.join(OS.Constants.Path.desktopDir, 'full_ss.png')), ostypes.CONST.YES);
                    //
					// // end - write to desktop

					// start - try to get byte array
					// [imageRep bitmapData]
					var rgba_buf = ostypes.API('objc_msgSend')(imageRep, ostypes.HELPER.sel('bitmapData'));


					rez_width = parseInt(cutils.jscGetDeepest(rez_width));
					rez_height = parseInt(cutils.jscGetDeepest(rez_height));

					var bitmapBytesPerRow = rez_width * 4;
					var bitmapByteCount = bitmapBytesPerRow * rez_height;

					// var rgba_arr = ctypes.cast(rgba_buf, ostypes.TYPE.unsigned_char.array(bitmapByteCount).ptr).contents;



					var allShotBuf = new ArrayBuffer(bitmapByteCount);



					ostypes.API('memcpy')(allShotBuf, rgba_buf, bitmapByteCount);


					var allShotUint8 = new Uint8Array(allShotBuf);
					// end - try to get byte array
				} finally {

					var rez_showCursor = ostypes.API('CGDisplayShowCursor')(ostypes.CONST.kCGNullDirectDisplay);

					if (allocNSBIP) {
						var rez_relNSBPI = ostypes.API('objc_msgSend')(allocNSBIP, ostypes.HELPER.sel('release'));

					}
					if (myNSStrings) {
						myNSStrings.releaseAll()
					}

				}
				// end - take one big screenshot of all monitors

				// start - because took a single screenshot of alllll put togather, lets portion out the imagedata


				var portionOutAllToMonAnd255 = function(cutoutMonW, cutoutMonH, cutoutMonX, cutoutMonY) {
					// returns aMonUint
					var monShotBuf = new ArrayBuffer(cutoutMonW * cutoutMonH * 4);
					var monShotUint8 = new Uint8Array(monShotBuf);

					var allShotEndY = cutoutMonY + cutoutMonH;
					var allShotEndX = cutoutMonX + cutoutMonW;
					var si = 0;
					for (var y=cutoutMonY; y<allShotEndY; y++) {
						var pixY = (rez_width * y << 2); // << 2 is same as * 4
						for (var x=cutoutMonX; x<allShotEndX; x++) {
							var pixXY = pixY + (x << 2);
							monShotUint8[si] = allShotUint8[pixXY];
							monShotUint8[si+1] = allShotUint8[pixXY+1];
							monShotUint8[si+2] = allShotUint8[pixXY+2];
							monShotUint8[si+3] = 255;
							si += 4;
						}
					}

					return monShotBuf;
				};

				for (var i=0; i<collMonInfos.length; i++) {
					var monUseW = collMonInfos[i].w;
					var monUseH = collMonInfos[i].h;


					collMonInfos[i].screenshotArrBuf = portionOutAllToMonAnd255(monUseW, monUseH, collMonInfos[i].x - minScreenX, collMonInfos[i].y - minScreenY);
				}

				// end - because took a single screenshot of alllll put togather, lets portion out the imagedata

			break;
		default:
			throw new Error('os not supported ' + core.os.name);
	}

	var rez = {
		collMonInfos,
		__XFER: []
	};
	for (var i=0; i<collMonInfos.length; i++) {
		rez['arrbuf' + i] = collMonInfos[i].screenshotArrBuf;
		delete collMonInfos[i].screenshotArrBuf;
		rez.__XFER.push('arrbuf' + i);

		var msgchan = new MessageChannel();
		rez['screenshot' + i + '_port1'] = msgchan.port1;
		rez['screenshot' + i + '_port2'] = msgchan.port2;

		rez.__XFER.push('screenshot' + i + '_port1');
		rez.__XFER.push('screenshot' + i + '_port2');

	}

	return rez;
}

function focusSelfApp() {
	// makes the firefox you run this code from the active app, like brings it forward
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':




			break;
		case 'gtk':



			break;
		case 'darwin':

				var NSApplication = ostypes.HELPER.class('NSApplication');
				var sharedApplication = ostypes.HELPER.sel('sharedApplication');
				var NSApp = ostypes.API('objc_msgSend')(NSApplication, sharedApplication);

				// [NSApp activateIgnoringOtherApps:YES];
				var rez_actIgOthrApps = ostypes.API('objc_msgSend')(NSApp, ostypes.HELPER.sel('activateIgnoringOtherApps:'), ostypes.CONST.YES);


			break;
		default:

	}
}

function getAllWin(aOptions) {
	// returns an array of objects a list of all the windows in z order front to back:
	/*
		[
			{
				hwnd: window handle, hwnd for windows, gdkWindow* for gtk, nswindow for mac,
				pid: process id, if set getPid to true
				title: window title name, set getTitle true,
				bounds: window rect, set getBounds true,
				icon: custom icon for the window, set getIcon true,
			},
			{},
		]
	*/
	/*
	aOptions = {
		filterVisible: bool, will only contain windows that are visible,
		filterActiveWorkspace: bool, set to true if you want only the windows on the active workspace from each monitor,
		getPid: bool, set to true if u want it,
		getTitle: bool, set to true if you want it,
		getBounds: bool, set to true if you want it,
		getIcon: bool, set to true if you want to test if window has custom icon, if it does it returns its byte data? maybe hwnd? not sure maybe different per os, but if it doesnt have custom icon then key is present but set to null, // NOT YET SUPPORTED
		getAlwaysTop: bool, set to true if you want to test if window is set to always on top, // NOT YET SUPPORTED
		hwndAsPtr: bool, set to true if you want the hwnd to be ptr, otherwise it will be string of pointer, i recall that the loop would jack up and pointers would be bad so by default it will give strings, should verify and fix why the pointers were bad if they are aug 7 2015
	}
	*/

	var rezWinArr = [];

	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':

				if (aOptions.getPid) {
					var PID = ostypes.TYPE.DWORD();
				}

				if (aOptions.getTitle) {
					var lpStringMax = 500; // i dont think there is a max length to this so lets just go with 500
					var lpString = ostypes.TYPE.LPTSTR.targetType.array(lpStringMax)();
				}

				if (aOptions.getBounds) {
					var lpRect = ostypes.TYPE.RECT();
				}

				var f = 0;
				var SearchPD = function(hwnd, lparam) {
					f++;
					var thisWin = {};

					thisWin.hwnd = aOptions.hwndAsPtr ? hwnd : cutils.strOfPtr(hwnd);

					if (aOptions.filterVisible) {
						var hwndStyle = ostypes.API('GetWindowLongPtr')(hwnd, ostypes.CONST.GWL_STYLE);
						hwndStyle = parseInt(cutils.jscGetDeepest(hwndStyle));
						if (hwndStyle & ostypes.CONST.WS_VISIBLE) {

						} else {
							// window is not visible
							return true; // continue iterating // do not push thisWin into rezWinArr
						}
					}

					if (aOptions.getPid) {
						var rez_GWTPI = ostypes.API('GetWindowThreadProcessId')(hwnd, PID.address());
						thisWin.pid = cutils.jscGetDeepest(PID);
					}

					if (aOptions.getTitle) {
						var rez_lenNotInclNullTerm = ostypes.API('GetWindowText')(hwnd, lpString, lpStringMax);
						thisWin.title = lpString.readString();
						var lenParseInt = parseInt(cutils.jscGetDeepest(rez_lenNotInclNullTerm)); // i dont think the rez_lenNotInclNullTerm will exceed lpStringMax even if truncated
						for (var i=0; i<=lenParseInt; i++) { // need <= as len is till the last char, we need to reset it so we can reuse this var, otherwise if we read next thing into same buffer and its length is shorter, then we'll have left over chars from previous tagged on to the current
							lpString[i] = 0;
						}
					}

					if (aOptions.getBounds) {
						var rez_rect = ostypes.API('GetWindowRect')(hwnd, lpRect.address());
						thisWin.left = parseInt(cutils.jscGetDeepest(lpRect.left));
						thisWin.top = parseInt(cutils.jscGetDeepest(lpRect.top));
						thisWin.bottom = parseInt(cutils.jscGetDeepest(lpRect.bottom));
						thisWin.right = parseInt(cutils.jscGetDeepest(lpRect.right));

						thisWin.width = thisWin.right - thisWin.left;
						thisWin.height = thisWin.bottom - thisWin.top;
					}

					/*

					if (cutils.jscEqual(PID, tPid)) {
						var hwndStyle = ostypes.API('GetWindowLongPtr')(hwnd, ostypes.CONST.GWL_STYLE);
						if (cutils.jscEqual(hwndStyle, 0)) {
							throw new Error('Failed to GetWindowLongPtr');
						}
						hwndStyle = parseInt(cutils.jscGetDeepest(hwndStyle));

						// debug block
						foundInOrder.push([cutils.strOfPtr(hwnd) + ' - ' + debugPrintAllStylesOnIt(hwndStyle)]); //debug
						if (!focusThisHwnd && (hwndStyle & ostypes.CONST.WS_VISIBLE) && (hwndStyle & ostypes.CONST.WS_CAPTION)) {
							foundInOrder.push('the hwnd above this row is what i will focus');
							focusThisHwnd = cutils.strOfPtr(hwnd); // for some reason if i set this to just hwnd, the global var of focusThisHwnd is getting cut shortend to just 0x2 after this enum is complete later on, even though on find it is 0x10200 so weird!!
						}
						// end // debug block
						return true; // keep iterating as debug
					}
					*/

					rezWinArr.push(thisWin);

					return true; // keep iterating
				}
				var SearchPD_ptr = ostypes.TYPE.WNDENUMPROC(SearchPD);
				var wnd = ostypes.TYPE.LPARAM();
				var rez_EnuMWindows = ostypes.API('EnumWindows')(SearchPD_ptr, wnd);


			break;
		case 'gtk':

				var xqRoot = ostypes.TYPE.Window();
				var xqParent = ostypes.TYPE.Window();
				var xqChildArr = ostypes.TYPE.Window.ptr();
				var nChilds = ostypes.TYPE.unsigned_int();

				var gpTypeReturned = ostypes.TYPE.Atom();
				var gpFormatReturned = ostypes.TYPE.int();
				var gpNItemsReturned = ostypes.TYPE.unsigned_long();
				var gpBytesAfterReturn = ostypes.TYPE.unsigned_long();
				var gpItemsArr = ostypes.TYPE.unsigned_char.ptr();

				var geoRoot = ostypes.TYPE.Window();
				var geoX = ostypes.TYPE.int();
				var geoY = ostypes.TYPE.int();
				var geoW = ostypes.TYPE.unsigned_int();
				var geoH = ostypes.TYPE.unsigned_int();
				var geoBorderWidth = ostypes.TYPE.unsigned_int();
				var geoDepth = ostypes.TYPE.unsigned_int();

				var wAttr = ostypes.TYPE.XWindowAttributes();

				var processWin = function(w) {
					if (aOptions.filterVisible) {
						var rez_WA = ostypes.API('XGetWindowAttributes')(ostypes.HELPER.cachedXOpenDisplay(), w, wAttr.address());

						if (!cutils.jscEqual(wAttr.map_state, ostypes.CONST.IsViewable)) {
							return; // continue as this is a hidden window, do not list features, do not dig this window
						}
					}

					var thisWin = {};
					// fetch props on thisWin

					thisWin.hwndXid = parseInt(cutils.jscGetDeepest(w));

					if (aOptions.getPid) {
						var rez_pid = ostypes.API('XGetWindowProperty')(ostypes.HELPER.cachedXOpenDisplay(), w, ostypes.HELPER.cachedAtom('_NET_WM_PID'), 0, 1, ostypes.CONST.False, ostypes.CONST.XA_CARDINAL, gpTypeReturned.address(), gpFormatReturned.address(), gpNItemsReturned.address(), gpBytesAfterReturn.address(), gpItemsArr.address());
						if (ostypes.HELPER.getWinProp_ReturnStatus(ostypes.CONST.XA_CARDINAL, gpTypeReturned, gpFormatReturned, gpBytesAfterReturn) == 1) {
							var jsN = parseInt(cutils.jscGetDeepest(gpNItemsReturned));
							if (jsN == 0) {
								thisWin.pid = null; // set to null as this window did not have a pid, but i add the key indicating i tested for it and the window had the proerty
							} else {

								thisWin.pid = parseInt(cutils.jscGetDeepest(ctypes.cast(gpItemsArr, ostypes.TYPE.CARD32.array(1).ptr).contents[0]));
							}
							ostypes.API('XFree')(gpItemsArr);
						} else {
							thisWin.pid = undefined; // window didnt even have property
						}
					}

					if (aOptions.getTitle) {
						var rez_title = ostypes.API('XGetWindowProperty')(ostypes.HELPER.cachedXOpenDisplay(), w, ostypes.HELPER.cachedAtom('_NET_WM_NAME'), 0, 256 /* this number times 4 is maximum ctypes.char that can be returned*/, ostypes.CONST.False, ostypes.HELPER.cachedAtom('UTF8_STRING'), gpTypeReturned.address(), gpFormatReturned.address(), gpNItemsReturned.address(), gpBytesAfterReturn.address(), gpItemsArr.address());
						if (ostypes.HELPER.getWinProp_ReturnStatus(ostypes.HELPER.cachedAtom('UTF8_STRING'), gpTypeReturned, gpFormatReturned, gpBytesAfterReturn) == 1) {
							var jsN = parseInt(cutils.jscGetDeepest(gpNItemsReturned));
							if (jsN == 0) {
								thisWin.title = ''; // window had property but not title
							} else {
								thisWin.title = ctypes.cast(gpItemsArr, ostypes.TYPE.char.array(jsN).ptr).contents.readString();
							}
							ostypes.API('XFree')(gpItemsArr);
						} else {
							thisWin.title = undefined; // window didnt even have property
						}
					}

					if (aOptions.getBounds) {
						if (aOptions.filterVisible) {
							// then get the info from wAttr as its already available
							thisWin.left = parseInt(cutils.jscGetDeepest(wAttr.x));
							thisWin.top = parseInt(cutils.jscGetDeepest(wAttr.y));

							var borderWidth = parseInt(cutils.jscGetDeepest(wAttr.border_width));
							thisWin.borderWidth = borderWidth;

							thisWin.width = parseInt(cutils.jscGetDeepest(wAttr.width))/* + borderWidth*/;
							thisWin.height = parseInt(cutils.jscGetDeepest(wAttr.height))/* + borderWidth*/;

							thisWin.right = thisWin.left + thisWin.width;
							thisWin.bottom = thisWin.top + thisWin.height;
						} else {
							var rez_bounds = ostypes.API('XGetGeometry')(ostypes.HELPER.cachedXOpenDisplay(), w, geoRoot.address(), geoX.address(), geoY.address(), geoW.address(), geoH.address(), geoBorderWidth.address(), geoDepth.address());
							thisWin.left = parseInt(cutils.jscGetDeepest(geoX));
							thisWin.top = parseInt(cutils.jscGetDeepest(geoY));

							var borderWidth = parseInt(cutils.jscGetDeepest(wAttr.border_width));
							thisWin.borderWidth = borderWidth;

							thisWin.width = parseInt(cutils.jscGetDeepest(wAttr.width))/* + borderWidth*/;
							thisWin.height = parseInt(cutils.jscGetDeepest(wAttr.height))/* + borderWidth*/;

							thisWin.right = thisWin.left + thisWin.width;
							thisWin.bottom = thisWin.top + thisWin.height;
						}
					}

					rezWinArr.splice(0, 0, thisWin);

					// dig the win even if it doesnt qualify
					var rez_XQ = ostypes.API('XQueryTree')(ostypes.HELPER.cachedXOpenDisplay(), w, xqRoot.address(), xqParent.address(), xqChildArr.address(), nChilds.address()); // interesting note about XQueryTree and workspaces: "The problem with this approach is that it will only return windows on the same virtual desktop.  In the case of multiple virtual desktops, windows on other virtual desktops will be ignored." source: http://www.experts-exchange.com/Programming/System/Q_21443252.html

					var jsNC = parseInt(cutils.jscGetDeepest(nChilds));

					if (jsNC > 0) {
						var jsChildArr = ctypes.cast(xqChildArr, ostypes.TYPE.Window.array(jsNC).ptr).contents;

						// for (var i=jsNC-1; i>-1; i--) {
						for (var i=0; i<jsNC; i++) {
							var wChild = jsChildArr[i];
							processWin(wChild);
						}

						ostypes.API('XFree')(xqChildArr);
					}
				}

				processWin(ostypes.HELPER.cachedDefaultRootWindow());

				// start - post analysis, per http://stackoverflow.com/questions/31914311/correlate-groups-from-xquerytree-data-to-a-window?noredirect=1#comment53135178_31914311
				var analyzedArr = [];
				var pushItBlock = function() {
					if (cWinObj) {

						// start - mini algo to find proper x and y. it first gets max x and y. if they are both 0, then it checks if min x and y are negative and then set its to that (as user may have set up window to left or above or something)
						var minLeft = Math.min.apply(Math, cWinObj.left);
						var minTop = Math.min.apply(Math, cWinObj.top);
						cWinObj.left = Math.max.apply(Math, cWinObj.left);
						cWinObj.top = Math.max.apply(Math, cWinObj.top);

						if (cWinObj.left == 0 && cWinObj.top == 0) {
							if (minLeft != -1 && minTop != -1) {
								cWinObj.left = minLeft;
								cWinObj.top = minTop;
							}
						}
						// end - mini algo to find proper x and y
						cWinObj.width = Math.max.apply(Math, cWinObj.width);
						cWinObj.height = Math.max.apply(Math, cWinObj.height);

						cWinObj.right = cWinObj.left + cWinObj.width;
						cWinObj.bottom = cWinObj.top + cWinObj.height;

						analyzedArr.push(cWinObj);
					}
				}

				var cWinObj = null;
				for (var i = 0; i < rezWinArr.length; i++) {
					if (rezWinArr[i].pid || rezWinArr[i].title) { // apparently sometimes you can hvae a new win title but no pid. like after "browser console" came a "compiz" title but no pid on it
						pushItBlock();
						cWinObj = {
							pid: rezWinArr[i].pid,
							left: [],
							top: [],
							width: [],
							height: []
						};
					}
					if (cWinObj) {
						cWinObj.left.push(rezWinArr[i].left);
						cWinObj.top.push(rezWinArr[i].top);
						cWinObj.width.push(rezWinArr[i].width);
						cWinObj.height.push(rezWinArr[i].height);
						if (rezWinArr[i].title) {
							cWinObj.title = rezWinArr[i].title;
						}
					}
				}
				pushItBlock();

				// post pushing analysis
				// 1) remove all windows who have height and width of 1
				for (var i = 0; i < analyzedArr.length; i++) {
					if (analyzedArr[i].width == 1 && analyzedArr[i].height == 1) {
						analyzedArr.splice(i, 1);
						i--;
					}
				}
				// 2) remove all windows who have height and width == to Desktop which is that last entry
				if (analyzedArr[analyzedArr.length - 1].title != 'Desktop') {

				}
				var deskW = analyzedArr[analyzedArr.length - 1].width;
				var deskH = analyzedArr[analyzedArr.length - 1].height;
				for (var i = 0; i < analyzedArr.length - 1; i++) { // - 1 as we dont want the very last item
					if (analyzedArr[i].width == deskW && analyzedArr[i].height == deskH) {
						analyzedArr.splice(i, 1);
						i--;
					}
				}
				/*
				// 3) remove windows up till and including the last window with title "nativeshot_canvas"
				var iOfLastNativeshotCanvas = -1;
				for (var i = 0; i < analyzedArr.length; i++) {
					if (analyzedArr[i].title == 'nativeshot_canvas') {
						iOfLastNativeshotCanvas = i;
					}
				}
				if (iOfLastNativeshotCanvas > -1) {
					analyzedArr.splice(0, iOfLastNativeshotCanvas + 1);
				}
				*/
				// set rezWinArr to analyzedArr

				rezWinArr = analyzedArr;
				// end - post analysis

			break;
		case 'darwin':

				var cfarr_win = ostypes.API('CGWindowListCopyWindowInfo')(ostypes.CONST.kCGWindowListOptionOnScreenOnly, ostypes.CONST.kCGNullWindowID);
				try {
					var myNSStrings = new ostypes.HELPER.nsstringColl();

					var cnt_win = ostypes.API('CFArrayGetCount')(cfarr_win);

					cnt_win = parseInt(cutils.jscGetDeepest(cnt_win));


					for (var i=0; i<cnt_win; i++) {
						var thisWin = {};
						var c_win = ostypes.API('CFArrayGetValueAtIndex')(cfarr_win, i);

						if (aOptions.hwndAsPtr) {
							var windowNumber = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowNumber')); // (NSString *)[window objectForKey:@"kCGWindowName"];
							// console.log('windowNumber:', windowNumber, cutils.jscGetDeepest(windowNumber), cutils.jscGetDeepest(windowNumber, 10), cutils.jscGetDeepest(windowNumber, 16)); // >>> windowNumber: ctypes.voidptr_t(ctypes.UInt64("0xb37")) ctypes.voidptr_t(ctypes.UInt64("0xb37")) 2871 b37

							var windowNumberIntVal = ostypes.API('objc_msgSend')(windowNumber, ostypes.HELPER.sel('intValue'));
							// console.log('windowNumberIntVal:', windowNumberIntVal, cutils.jscGetDeepest(windowNumberIntVal), cutils.jscGetDeepest(windowNumberIntVal, 10), cutils.jscGetDeepest(windowNumberIntVal, 16)) // >>> windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0xb")) ctypes.voidptr_t(ctypes.UInt64("0xb")) 11 b

							// results of console logging
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x6137")) ctypes.voidptr_t(ctypes.UInt64("0x6137")) 24887 6137 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x61")) ctypes.voidptr_t(ctypes.UInt64("0x61")) 97 61 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1d37")) ctypes.voidptr_t(ctypes.UInt64("0x1d37")) 7479 1d37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x1d")) ctypes.voidptr_t(ctypes.UInt64("0x1d")) 29 1d ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1237")) ctypes.voidptr_t(ctypes.UInt64("0x1237")) 4663 1237 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x12")) ctypes.voidptr_t(ctypes.UInt64("0x12")) 18 12 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1737")) ctypes.voidptr_t(ctypes.UInt64("0x1737")) 5943 1737 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x17")) ctypes.voidptr_t(ctypes.UInt64("0x17")) 23 17 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1137")) ctypes.voidptr_t(ctypes.UInt64("0x1137")) 4407 1137 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x11")) ctypes.voidptr_t(ctypes.UInt64("0x11")) 17 11 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x1337")) ctypes.voidptr_t(ctypes.UInt64("0x1337")) 4919 1337 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x13")) ctypes.voidptr_t(ctypes.UInt64("0x13")) 19 13 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x337")) ctypes.voidptr_t(ctypes.UInt64("0x337")) 823 337 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x3")) ctypes.voidptr_t(ctypes.UInt64("0x3")) 3 3 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0xd37")) ctypes.voidptr_t(ctypes.UInt64("0xd37")) 3383 d37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0xd")) ctypes.voidptr_t(ctypes.UInt64("0xd")) 13 d ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x6537")) ctypes.voidptr_t(ctypes.UInt64("0x6537")) 25911 6537 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x65")) ctypes.voidptr_t(ctypes.UInt64("0x65")) 101 65 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x19a37")) ctypes.voidptr_t(ctypes.UInt64("0x19a37")) 105015 19a37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x19a")) ctypes.voidptr_t(ctypes.UInt64("0x19a")) 410 19a ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x18237")) ctypes.voidptr_t(ctypes.UInt64("0x18237")) 98871 18237 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x182")) ctypes.voidptr_t(ctypes.UInt64("0x182")) 386 182 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x18737")) ctypes.voidptr_t(ctypes.UInt64("0x18737")) 100151 18737 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x187")) ctypes.voidptr_t(ctypes.UInt64("0x187")) 391 187 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x437")) ctypes.voidptr_t(ctypes.UInt64("0x437")) 1079 437 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x4")) ctypes.voidptr_t(ctypes.UInt64("0x4")) 4 4 ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0xe37")) ctypes.voidptr_t(ctypes.UInt64("0xe37")) 3639 e37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0xe")) ctypes.voidptr_t(ctypes.UInt64("0xe")) 14 e ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0xb37")) ctypes.voidptr_t(ctypes.UInt64("0xb37")) 2871 b37 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0xb")) ctypes.voidptr_t(ctypes.UInt64("0xb")) 11 b ScreenshotWorker.js:461:1
							// windowNumber: ctypes.voidptr_t(ctypes.UInt64("0x237")) ctypes.voidptr_t(ctypes.UInt64("0x237")) 567 237 ScreenshotWorker.js:458:1
							// windowNumberIntVal: ctypes.voidptr_t(ctypes.UInt64("0x2")) ctypes.voidptr_t(ctypes.UInt64("0x2")) 2 2 ScreenshotWorker.js:461:1

							thisWin.hwndCGWindowID = parseInt(cutils.jscGetDeepest(windowNumberIntVal, 10));
						}

						if (aOptions.getTitle) {
							var windowName = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowName')); // (NSString *)[window objectForKey:@"kCGWindowName"];
							var windowNameLen = ostypes.API('objc_msgSend')(windowName, ostypes.HELPER.sel('length'));

							windowNameLen = ctypes.cast(windowNameLen, ostypes.TYPE.NSUInteger);

							windowNameLen = parseInt(cutils.jscGetDeepest(windowNameLen));


							if (windowNameLen == 0) { // can be 0 as its stated that kCGWindowName is an optional source: https://developer.apple.com/library/mac/documentation/Carbon/Reference/CGWindow_Reference/Constants/Constants.html#//apple_ref/doc/constant_group/Required_Window_List_Keys
								thisWin.title = '';
							} else {
								var utf8str = ostypes.API('objc_msgSend')(windowName, ostypes.HELPER.sel('UTF8String'));
								var str_casted = ctypes.cast(utf8str, ostypes.TYPE.char.array(windowNameLen+1).ptr).contents; // +1 as it doesnt include the null char, and readString needs that

								thisWin.title = str_casted.readString();
							}
						}

						if (aOptions.getPid) {
							var rez_pid = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowOwnerPID'));


							// rez_pid = ctypes.cast(rez_pid, ostypes.TYPE.NSInteger);


							// rez_pid = parseInt(cutils.jscGetDeepest(rez_pid));

							// thisWin.pid = rez_pid;

							var int_pid = ostypes.API('objc_msgSend')(rez_pid, ostypes.HELPER.sel('integerValue'));
							int_pid = ctypes.cast(int_pid, ostypes.TYPE.NSInteger);


							int_pid = parseInt(cutils.jscGetDeepest(int_pid));

							thisWin.pid = int_pid;
						}

						/*
						// start debug i just want to see if fullscreen apps have a different workspace number
						// if (aOptions.getPid) {
							var rez_ws = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowWorkspace'));

							var int_ws = ostypes.API('objc_msgSend')(rez_ws, ostypes.HELPER.sel('integerValue'));
							int_ws = ctypes.cast(int_ws, ostypes.TYPE.NSInteger);
							int_ws = parseInt(cutils.jscGetDeepest(int_ws));
							thisWin.ws = int_ws;
						// }
						*/

						if (aOptions.getBounds) {
							var rez_bs = ostypes.API('objc_msgSend')(c_win, ostypes.HELPER.sel('objectForKey:'), myNSStrings.get('kCGWindowBounds'));


							var bounds = ostypes.TYPE.CGRect();
							rez_bs = ctypes.cast(rez_bs, ostypes.TYPE.CFDictionaryRef);


							var rez_makeBounds = ostypes.API('CGRectMakeWithDictionaryRepresentation')(rez_bs, bounds.address());




							thisWin.left = parseInt(cutils.jscGetDeepest(bounds.origin.x));
							thisWin.top = parseInt(cutils.jscGetDeepest(bounds.origin.y));
							thisWin.width = parseInt(cutils.jscGetDeepest(bounds.size.width));
							thisWin.height = parseInt(cutils.jscGetDeepest(bounds.size.height));

							thisWin.right = thisWin.left + thisWin.width;
							thisWin.bottom = thisWin.top + thisWin.height;
						}

						rezWinArr.push(thisWin);
					}

					// post analysis
					// 1) remove all windows who have height and width == to Desktop which is that last entry
					// osx has multiple desktop elements, if two mon, then two desktops, i can know number of mon by counting number of "nativeshot_canvas" titled windows
					// and nativeshot_canvas width and height is equal to that of its respective desktop width and height
					var numDesktop = 0;
					var desktopDimWxH = [];
					for (var i=0; i<rezWinArr.length; i++) {
						if (rezWinArr[i].title == 'Desktop') {
							numDesktop++;
							desktopDimWxH.push(rezWinArr[i]);
						}
					}
					// now splice out all things that have any dimensions matching these EXCEPT the last numMon elements as they will be titled Desktop
					// for (var i=rezWinArr.length-numDesktop; i<rezWinArr.length; i++) {
					// 	if (rezWinArr[i].title != 'DesktopAA') {
                    //
					// 	}
					// }
					for (var i=0; i<rezWinArr.length; i++) {
						var cWin = rezWinArr[i];
						if (cWin.title == 'Desktop') {
							continue;
						}
						for (var j=0; j<numDesktop; j++) {
							var cDesktop = desktopDimWxH[j];
							if (cWin.width == cDesktop.width && cWin.height == cDesktop.height && cWin.left == cDesktop.left && cWin.top == cDesktop.top) {
								rezWinArr.splice(i, 1);
								i--;
								break;
							}
						}
					}

					// // 2) splice out the editor contextmenu, which will be the first blank titled thing after the first nativeshot_canvas
					// var nativeshotCanvasPID = 0;
					// for (var i = 0; i < rezWinArr.length - 1; i++) { // - 1 as we dont want the very last item
					// 	if (rezWinArr[i].title == 'nativeshot_canvas') { // need to leave nativeshot_canvas in as mainthread uses it as a pointer position to start from
					// 		nativeshotCanvasPID = rezWinArr[i].pid;
					// 	}
					// 	if (!nativeshotCanvasPID) {
					// 		continue;
					// 	} else {
					// 		if (rezWinArr[i].pid == nativeshotCanvasPID && rezWinArr[i].title == '') {
					// 			// first non titled thing with same pid after the first nativeshot_canvas should be the right click contextmenu of editor
					// 			rezWinArr.splice(i, 1);
					// 			break;
					// 		}
					// 	}
					// }
					// end - post analysis
				} finally {
					ostypes.API('CFRelease')(cfarr_win);

					if (myNSStrings) {
						myNSStrings.releaseAll()
					}
				}

			break;
		default:

	}

	return rezWinArr;

}

function setWinAlwaysOnTop(aArg) {
	var { aArrHwndPtrStr, aOptions } = aArg;
	// aArrHwndPtrStr is an array of multiple hwnds, each of them will get set to always on top
	// aOptions holds keys that are hwndPtrStr in aArr and hold params like, left, right, top, left needed for x11 strut partial stuff OR for SetWindowPos for winapi
	/* example:
		aArrHwndPtrStr = ['0x1234', '0x999'];
		aOptions = {
			'0x1234': {left:0, top:0, ...},
			'0x999': {left:0, top:0, ...}
		}
	*/
	console.error('in setWinAlwaysOnTop. aArrHwndPtrStr:', aArrHwndPtrStr)
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':


				for (var i=0; i<aArrHwndPtrStr.length; i++) {

					var hwndStr = aArrHwndPtrStr[i];
					var hwndPtr = ostypes.TYPE.HWND(ctypes.UInt64(hwndStr));

					// var lpString = ostypes.TYPE.LPTSTR.targetType.array(500)();
					// var nWinTitleLen = ostypes.API('GetWindowText')(hwndPtr, lpString, lpString.length);
					// var nWinTitle = lpString.readString();
					// console.log('nWinTitle:', nWinTitle);

					// start - remove border from window - http://stackoverflow.com/a/2400467/1828637
					var GWL_STYLE = -16;
					var WS_CAPTION = 0x00C00000;
					var WS_THICKFRAME = 0x00040000;
					var WS_MINIMIZE = 0x20000000;
					var WS_MAXIMIZE = 0x01000000;
					var WS_SYSMENU = 0x00080000;

					var lStyle = ostypes.API('GetWindowLongPtr')(hwndPtr, GWL_STYLE);
					console.log('lStyle:', lStyle);
					lStyle &= ~(WS_CAPTION | WS_THICKFRAME | WS_MINIMIZE | WS_MAXIMIZE | WS_SYSMENU);

					var rez_setLong = ostypes.API('SetWindowLongPtr')(hwndPtr, GWL_STYLE, lStyle);
					console.log('rez_setLong:', rez_setLong);

					// var GWL_EXSTYLE = -20;
					// var WS_EX_DLGMODALFRAME = 0x00000001;
					// var WS_EX_CLIENTEDGE = 0x00000200;
					// var WS_EX_STATICEDGE = 0x00020000;

					// var lExStyle = ostypes.API('GetWindowLongPtr')(hwndPtr, GWL_EXSTYLE);
					// console.log('lExStyle:', lExStyle);
					// lExStyle &= ~(WS_EX_DLGMODALFRAME | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE);

					// var rez_setLong = ostypes.API('SetWindowLongPtr')(hwndPtr, GWL_EXSTYLE, lExStyle);
					// console.log('rez_setLong:', rez_setLong);


					var SWP_FRAMECHANGED = 0x0020;
					var rez_setTop = ostypes.API('SetWindowPos')(hwndPtr, ostypes.CONST.HWND_TOPMOST, aOptions[hwndStr].left, aOptions[hwndStr].top, aOptions[hwndStr].width, aOptions[hwndStr].height, SWP_FRAMECHANGED/* | ostypes.CONST.SWP_NOREDRAW*/); // window wasnt moved so no need for SWP_NOREDRAW, the NOMOVE and NOSIZE params make it ignore x, y, cx, and cy
					// end try to remove that border

					// var rez_setTop = ostypes.API('SetWindowPos')(hwndPtr, ostypes.CONST.HWND_TOPMOST, aOptions[hwndStr].left, aOptions[hwndStr].top, aOptions[hwndStr].width, aOptions[hwndStr].height, 0/* | ostypes.CONST.SWP_NOREDRAW*/); // window wasnt moved so no need for SWP_NOREDRAW, the NOMOVE and NOSIZE params make it ignore x, y, cx, and cy
					// var rez_setTop = ostypes.API('SetWindowPos')(aHwnd, ostypes.CONST.HWND_TOPMOST, aOptions[aArrHwndPtrStr[i]].left, aOptions[aArrHwndPtrStr[i]].top, aOptions[aArrHwndPtrStr[i]].width, aOptions[aArrHwndPtrStr[i]].height, ostypes.CONST.SWP_NOSIZE | ostypes.CONST.SWP_NOMOVE | ostypes.CONST.SWP_NOREDRAW);
				}
				console.log('will force focus now');
				var rez_winForceFocus = winForceForegroundWindow(hwndPtr); // use the last hwndPtr, i just need to focus one of my canvas windows // so if user hits esc it will work, otherwise the keyboard focus is in the other app even though my canvas window is top most
				// console.log('rez_winForceFocus:', rez_winForceFocus);

			break;
		case 'gtk':

				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					console.log('hwndPtr:', hwndPtr);
					var XWindow = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					console.log('XWindow1a:', XWindow);
					XWindow = parseInt(cutils.jscGetDeepest(XWindow));
					console.log('XWindow1b:', XWindow);

					// setTimeout(function() {
						var rez_unmap = ostypes.API('xcb_unmap_window')(ostypes.HELPER.cachedXCBConn(), XWindow);
						console.log('rez_unmap', rez_unmap);

						// var rez_flush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
						// console.log('rez_flush', rez_flush);

						var chgValueList = ostypes.TYPE.uint32_t.array()([
							1
						]);
						var rez_chg = ostypes.API('xcb_change_window_attributes')(ostypes.HELPER.cachedXCBConn(), XWindow, ostypes.CONST.XCB_CW_OVERRIDE_REDIRECT, chgValueList);
						console.log('rez_chg:', rez_chg);

						var rez_map = ostypes.API('xcb_map_window')(ostypes.HELPER.cachedXCBConn(), XWindow);
						console.log('rez_map', rez_map);

						// var rez_flush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
						// console.log('rez_flush', rez_flush);

						// raise the window
						var rez_raise = ostypes.API('xcb_configure_window')(ostypes.HELPER.cachedXCBConn(), XWindow, ostypes.CONST.XCB_CONFIG_WINDOW_STACK_MODE, ostypes.TYPE.uint32_t.array()([ostypes.CONST.XCB_STACK_MODE_ABOVE]));
						console.log('rez_raise:', rez_raise);

						// Set input focus (we have override_redirect=1, so the wm will not do this for us)
						// i cannot use XCB_NONE i have to use XCB_INPUT_FOCUS_POINTER_ROOT as otherwise keys are not working
						var rez_focus = ostypes.API('xcb_set_input_focus')(ostypes.HELPER.cachedXCBConn(), ostypes.CONST.XCB_INPUT_FOCUS_POINTER_ROOT, XWindow, ostypes.CONST.XCB_CURRENT_TIME);
						console.log('rez_focus:', rez_focus);

						// // Grab the keyboard to get all input
						// var reqGrab = ostypes.API('xcb_grab_keyboard')(ostypes.HELPER.cachedXCBConn(), false, XWindow, ostypes.CONST.XCB_CURRENT_TIME, ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC);
						// var replyGrab = ostypes.API('xcb_grab_keyboard_reply')(ostypes.HELPER.cachedXCBConn(), reqGrab, null);
						// console.error('replyGrab:', replyGrab);
						// console.error('replyGrab.contents:', replyGrab.contents);
						// console.error('replyGrab.status:', replyGrab.contents.status);

						var rez_flush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
						console.log('rez_flush', rez_flush);

					// }, 5000);
				}



				////// // http://stackoverflow.com/a/4347486/5062337
				////// // do this stuff up here as if it doesnt exist it will throw now, rather then go through set allocate xevent then find out when setting xevent.xclient data that its not available
				////// var atom_wmStateAbove = ostypes.HELPER.cachedAtom('_NET_WM_STATE_ABOVE');
				////// var atom_wmState = ostypes.HELPER.cachedAtom('_NET_WM_STATE');
				////// var atom_wmActive = ostypes.HELPER.cachedAtom('_NET_ACTIVE_WINDOW');
				//////
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
                //////
				////// 	var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	console.log('hwndPtr:', hwndPtr);
				////// 	var XWindow = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				////// 	console.log('XWindow:', XWindow);
                //////
				////// 	// set window always on top
				////// 	var xevent = ostypes.TYPE.XEvent();
				//////
				////// 	xevent.xclient.type = ostypes.CONST.ClientMessage;
				////// 	xevent.xclient.serial = 0;
				////// 	xevent.xclient.send_event = ostypes.CONST.True;
				////// 	xevent.xclient.display = ostypes.HELPER.cachedXOpenDisplay();
				////// 	xevent.xclient.window = XWindow;
				////// 	xevent.xclient.message_type = atom_wmState;
				////// 	xevent.xclient.format = 32; // because xclient.data is long, i defined that in the struct union
				////// 	xevent.xclient.data = ostypes.TYPE.long.array(5)([ostypes.CONST._NET_WM_STATE_ADD, atom_wmStateAbove, 0, 0, 0]);
				//////
				////// 	console.log('xevent set');
				////// 	var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address());
				////// 	console.log('rez_SendEv set on top:', rez_SendEv);
				//////
				////// 	// focus the window
				////// 	var xevent = ostypes.TYPE.XEvent();
				//////
				////// 	xevent.xclient.type = ostypes.CONST.ClientMessage;
				////// 	xevent.xclient.serial = 0;
				////// 	xevent.xclient.send_event = ostypes.CONST.True;
				////// 	xevent.xclient.display = ostypes.HELPER.cachedXOpenDisplay();
				////// 	xevent.xclient.window = XWindow; // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				////// 	xevent.xclient.message_type = atom_wmState;
				////// 	xevent.xclient.format = 32; // because xclient.data is long, i defined that in the struct union
				////// 	xevent.xclient.data = ostypes.TYPE.long.array(5)([ostypes.CONST._NET_WM_STATE_ADD, atom_wmStateAbove, 0, 0, 0]);
				//////
				////// 	var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top
                //////     console.log('rez_SendEv focus:', rez_SendEv);
				//////
				////// 	var rez_xmap = ostypes.API('XMapRaised')(ostypes.HELPER.cachedXOpenDisplay(), xevent.xclient.window);
				////// 	console.log('rez_xmap:', rez_xmap);
				//////
				////// 	// xevent.xclient.data[1] = ostypes.HELPER.cachedAtom('_NET_WM_STATE_STICKY');
				////// 	// var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top
                //////
				//////
				////// 	// xevent.xclient.data[1] = ostypes.HELPER.cachedAtom('_NET_WM_STATE_FULLSCREEN');
				////// 	// var rez_SendEv = ostypes.API('XSendEvent')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), ostypes.CONST.False, ostypes.CONST.SubstructureRedirectMask | ostypes.CONST.SubstructureNotifyMask, xevent.address()); // window will come to top if it is not at top and then be made to always be on top
                //////
                //////
				////// 	/*
				////// 	// testing XListProperties
				////// 	var numAtoms = ostypes.TYPE.int();
				////// 	var rez_ListProp = ostypes.API('XListProperties')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, numAtoms.address());
                //////
                //////
				////// 	//if (cutils.jscEqual(rez_ListProp, ostypes.CONST.BadWindow)) { // need to figure out how to test this, it seems when rez_ListProp is null, so im not sure how to get BadWindow its just not returning it // throw new Error('XListProperties failed with reason BadWindow'); // }
				////// 	if (rez_ListProp.isNull()) {
				////// 		// then probably failed
				////// 		throw new Error('XListProperties probably failed with BadWindow BUT is possible the window really has no properties set on it in which case i should not throw error on this line');
				////// 	}
				//////
				////// 	var atomsJS = ctypes.cast(rez_ListProp, ostypes.TYPE.Atom.array(parseInt(cutils.jscGetDeepest(numAtoms))).ptr).contents;
                //////
				////// 	var atomsC = rez_ListProp;
				////// 	numAtoms = parseInt(cutils.jscGetDeepest(numAtoms));
				//////
				////// 	// ostypes.API('XFree')(rez_ListProp); // must be done
				//////
				////// 	// test XGetAtomNames
				//////
				////// 	// // var atomsJS = [
				////// 	// // 	1,
				////// 	// // 	2,
				////// 	// // 	3
				////// 	// // ];
				////// 	// // var numAtoms = atomsJS.length;
				////// 	// // var atomsC = ostypes.TYPE.Atom.array(atomsJS.length)(atomsJS);
				//////
				//////
				////// 	var atomNames = ostypes.TYPE.char.ptr.array(numAtoms)();
                //////
				////// 	var rez_GetANames = ostypes.API('XGetAtomNames')(ostypes.HELPER.cachedXOpenDisplay(), atomsC, numAtoms, atomNames);
                //////
				////// 	if (cutils.jscEqual(rez_GetANames, 0)) {
				////// 		throw new Error('failed XGetAtomNames');
				////// 	}
                //////
				//////
				////// 	for (var i=0; i<atomNames.length; i++) {
                //////
				////// 		//ostypes.API('XFree')(atomNames[i]);
				////// 	}
				//////
				////// 	// doing XFree on atomNames seemed to cause an eventual crash, so i did XFree on each element and that seemed to not crash, i am now trying to see if I can do a XFreeStringList instead of XFree on each item
				////// 	//ostypes.API('XFreeStringList')(atomNames);
				//////
				////// 	// XFreeStringList crashes it almost immediately
				////// 	// XFree on atomNames crashes it eventually
				////// 	// XFree on each element seems the only crash free way
				////// 	ostypes.API('XFreeStringList')(atomNames);
				////// 	ostypes.API('XFree')(rez_ListProp); // must be done
                //////
				////// 	return;
				//////
				////// 	// https://github.com/HarveyHunt/barney/blob/bf43fef9ce95d1f7e2150973c2a28e0970bd8dfb/barney/bar.py#L199
				////// 	// the reason this XChangeProperty on _NET_WM_STATE is not working is because explained here: "http://standards.freedesktop.org/wm-spec/wm-spec-1.3.html#idm140130317612768" --> "A Client wishing to change the state of a window MUST send a _NET_WM_STATE client message to the root window (see below). The Window Manager MUST keep this property updated to reflect the current state of the window." meaning the WM will handle setting this, and I should be ADDing this from XSendEvent
				////// 	var dataJS = [
				////// 		ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE_DOCK')
				////// 	];
				////// 	var dataC = ostypes.TYPE.Atom.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE'), ostypes.CONST.XA_ATOM, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
                //////
				////// 	// make window show on all desktops
				////// 	var dataJS = [
				////// 		ostypes.TYPE.Atom('0xFFFFFFFF') // means all desktops
				////// 	];
				////// 	var dataC = ostypes.TYPE.Atom.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, ostypes.HELPER.cachedAtom('_NET_WM_DESKTOP'), ostypes.CONST.XA_CARDINAL, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				//////
				////// 	// // change window title
				////// 	// var dataJS = [
				////// 	// 	String.charCodeAt('r'),
				////// 	// 	String.charCodeAt('a'),
				////// 	// 	String.charCodeAt('w'),
				////// 	// ];
				////// 	// var dataC = ostypes.TYPE.unsigned_char.array(dataJS.length)(dataJS);
				////// 	// var dataCCasted = dataC; // no need to cast as it is already 8 byte //ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	// var dataFormat = 8; // cuz unsigned_long
				////// 	// var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), XWindow, ostypes.HELPER.cachedAtom('_NET_WM_NAME'), ostypes.HELPER.cachedAtom('UTF8_STRING'), dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				////// 	*/
				////// }
				//////
				////// ostypes.API('XFlush')(ostypes.HELPER.cachedXOpenDisplay()); // will not set on top if you dont do this, wont even change window title name which was done via XChangeProperty, MUST FLUSH
				//////
				////// /*
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
                //////
				////// 	var gdkWinPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	var gtkWinPtr = ostypes.HELPER.gdkWinPtrToGtkWinPtr(gdkWinPtr);
				////// 	ostypes.API('gtk_window_set_keep_above')(gtkWinPtr, 1);
				////// }
				////// */
				//////
				////// /*
				////// // try changing STRUT and STRUT_PARTIAL
				////// var atom_wmStrut = ostypes.HELPER.cachedAtom('_NET_WM_STRUT_PARTIAL');
				////// var atom_wmStrutPartial = ostypes.HELPER.cachedAtom('_NET_WM_STRUT_PARTIAL');
				//////
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
				////// 	var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	var Window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				//////
				////// 	var dataJS = [
				////// 		0,
				////// 		0,
				////// 		0,
				////// 		0
				////// 	];
				////// 	var dataC = ostypes.TYPE.unsigned_long.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), atom_wmStrut, ostypes.CONST.XA_CARDINAL, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				////// }
				////// */
				////// /*
				////// // try changing WM_WINDOW_TYPE properties
				////// var atom_wmWindowType = ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE');
				////// var atom_wmWindowTypeDock = ostypes.HELPER.cachedAtom('_NET_WM_WINDOW_TYPE_DOCK');
				//////
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
				////// 	var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	var Window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				//////
				////// 	var dataJS = [
				////// 		atom_wmWindowTypeDock
				////// 	];
				////// 	var dataC = ostypes.TYPE.Atom.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), atom_wmWindowType, ostypes.CONST.XA_ATOM, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				////// }
				////// */
				////// /*
				////// // try changing WM_STATE properties
				////// var atom_wmWmState = ostypes.HELPER.cachedAtom('_NET_WM_STATE');
				////// var atom_wmStateAbove = ostypes.HELPER.cachedAtom('_NET_WM_STATE_ABOVE');
				////// var atom_wmStateFullscreen = ostypes.HELPER.cachedAtom('_NET_WM_STATE_FULLSCREEN');
				////// var atom_wmStateAttn = ostypes.HELPER.cachedAtom('_NET_WM_STATE_DEMANDS_ATTENTION');;
				//////
				////// for (var i=0; i<aArrHwndPtrStr.length; i++) {
				////// 	var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
				////// 	var Window = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
				//////
				////// 	var dataJS = [
				////// 		atom_wmStateAbove,
				////// 		atom_wmStateFullscreen,
				////// 		atom_wmStateAttn
				////// 	];
				////// 	var dataC = ostypes.TYPE.unsigned_long.array(dataJS.length)(dataJS);
				////// 	var dataCCasted = ctypes.cast(dataC.address(), ostypes.TYPE.unsigned_char.array(dataJS.length).ptr).contents;
				////// 	var dataFormat = 32; // cuz unsigned_long
				////// 	var rez_XChg = ostypes.API('XChangeProperty')(ostypes.HELPER.cachedXOpenDisplay(), ostypes.HELPER.cachedDefaultRootWindow(), atom_wmState, ostypes.CONST.XA_ATOM, dataFormat, ostypes.CONST.PropModeReplace, dataCCasted, dataJS.length);
                //////
				////// }
				////// */
			break;
		case 'darwin':

				/*
				// for (var i=0; i<aArrHwndPtrStr.length; i++) {

				// 	var aNSWindow = ctypes.voidptr_t(ctypes.UInt64(aArrHwndPtrStr[i]));

				// 	var nil = ctypes.voidptr_t(ctypes.UInt64('0x0')); // due to 3rd arg of objc_msgSend being variadic i have to set type, i cant just pass null
				// 	var rez_orderFront = ostypes.API('objc_msgSend')(aNSWindow, ostypes.HELPER.sel('windowNumber'));

				// }

				// METHOD: performSelectorOnMainThread:withObject:waitUntilDone:

				// make a class to hold my methods:
				var needsRegistration; // meaning registerClassPair, alloc, and init will be called and stored
				// unregister, unalloc, etc all `OSStuff.setWinAlwaysOnTop_****` and delete js key pairs from OSStuff if you want it re-registered later on

				var NSObject = ostypes.HELPER.class('NSObject');

				if (!OSStuff.setWinAlwaysOnTop_class) {
					throw new Error('setWinAlwaysOnTop_class was not previously cleaned up!!')
				}
				// if (!OSStuff.setWinAlwaysOnTop_class) {
					var needsRegistration = true;
					OSStuff.setWinAlwaysOnTop_class = ostypes.API('objc_allocateClassPair')(NSObject, 'setWinAlwaysOnTop_class', 0);
					if (OSStuff.setWinAlwaysOnTop_class.isNull()) {

						throw new Error('setWinAlwaysOnTop_class is null, so objc_allocateClassPair failed');
					}
				// } else {

					// needsRegistration = false;
				// }

				OSStuff.setWinAlwaysOnTop_jsMethods = {}; // holds key of aArrHwndPtrStr and value is js method

				var IMP_for_mainThreadSelector = ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, []);

				OSStuff.setWinAlwaysOnTop_jsMethods[aArrHwndPtrStr[0]] = function() {

					// delete OSStuff.setWinAlwaysOnTop_jsMethods[aArrHwndPtrStr[0]]; // cuz i made this single shots // i should delete class when no more methods are left
					// delete OSStuff.setWinAlwaysOnTop_cMethods[aArrHwndPtrStr[0]]; // cuz i made this single shots // i should delete class when no more methods are left
				};

				OSStuff.setWinAlwaysOnTop_cMethods = {};
				OSStuff.setWinAlwaysOnTop_cMethods[aArrHwndPtrStr[0]] = IMP_for_mainThreadSelector.ptr(OSStuff.setWinAlwaysOnTop_jsMethods[aArrHwndPtrStr[0]]);

				OSStuff.setWinAlwaysOnTop_methodSelectors = {};
				OSStuff.setWinAlwaysOnTop_methodSelectors[aArrHwndPtrStr[0]] = ostypes.API('sel_registerName')(aArrHwndPtrStr[0]);

				var rez_class_addMethod = ostypes.API('class_addMethod')(OSStuff.setWinAlwaysOnTop_class, OSStuff.setWinAlwaysOnTop_methodSelectors[aArrHwndPtrStr[0]], OSStuff.setWinAlwaysOnTop_cMethods[aArrHwndPtrStr[0]], 'v');

				if (needsRegistration) {
					ostypes.API('objc_registerClassPair')(OSStuff.setWinAlwaysOnTop_class);
					OSStuff.setWinAlwaysOnTop_allocation = ostypes.API('objc_msgSend')(OSStuff.setWinAlwaysOnTop_class, ostypes.HELPER.sel('alloc'));
					OSStuff.setWinAlwaysOnTop_instance = ostypes.API('objc_msgSend')(OSStuff.setWinAlwaysOnTop_allocation, ostypes.HELPER.sel('init'));
				}

				var rez_perform = ostypes.API('objc_msgSend')(OSStuff.setWinAlwaysOnTop_instance, ostypes.HELPER.sel('performSelectorOnMainThread:withObject:waitUntilDone:'), ostypes.HELPER.sel(aArrHwndPtrStr[0]), ostypes.CONST.NIL, ostypes.CONST.YES);


				// after all callbacks done then clean up class
				// ostypes.API('objc_msgSend')(OSStuff.setWinAlwaysOnTop_instance, ostypes.HELPER.sel('release'));
				// ostypes.API('objc_disposeClassPair')(OSStuff.setWinAlwaysOnTop_class);
				// delete OSStuff.setWinAlwaysOnTop_cMethods
				// delete OSStuff.setWinAlwaysOnTop_jsMethods
				// delete OSStuff.setWinAlwaysOnTop_allocation
				// delete OSStuff.setWinAlwaysOnTop_instance
				// delete OSStuff.setWinAlwaysOnTop_class

				*/

				/*
				// METHOD: dispatch_async( dispatch_get_main_queue(), ^(void)
				var rez_mainQ = ostypes.API('dispatch_get_main_queue'); // do not do () on this one


				OSStuff.js_cb = function() {

					return undefined;
				};

				OSStuff.c_cb = ostypes.TYPE.dispatch_block_t(OSStuff.js_cb);

				ostypes.API('dispatch_sync')(rez_mainQ, OSStuff.c_cb);
				*/
				/*
				// METHOD: perform no js method
				var aNSWindow = ctypes.voidptr_t(ctypes.UInt64(aArrHwndPtrStr[0]));
				var rez_perform = ostypes.API('objc_msgSend')(aNSWindow, ostypes.HELPER.sel('performSelectorOnMainThread:withObject:waitUntilDone:'), ostypes.HELPER.sel('orderFront:'), ostypes.CONST.NIL, ostypes.CONST.YES);
				*/


				// METHOD: do on main thread with this key
				var rez_getKey = ostypes.API('CGWindowLevelForKey')(ostypes.CONST.kCGMainMenuWindowLevelKey); // to avoid that constraint issue


				// METHOD: dont set on top just focus app, this has that ugly scroll side affect if user is focused on another desktop on that monitor due to full screen app or something
				focusSelfApp();

				return parseInt(cutils.jscGetDeepest(rez_getKey));

			break;
		default:

	}
}

function gtkRaiseWindow(aArrHwndPtrStr) {
	switch (core.os.mname) {
		case 'winnt':

				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					var hwndPtr = ostypes.TYPE.HWND(ctypes.UInt64(aArrHwndPtrStr[i]));

					// while (true) {
						var rez_focus = ostypes.API('SetForegroundWindow')(hwndPtr);
						console.log('rez_focus:', rez_focus);

						var hFrom = ostypes.API('GetForegroundWindow')();
						if (hFrom.isNull()) {
							// nothing in foreground, so calling process is free to focus anything
							console.error('nothing in foreground right now');
							// continue;
						}
						console.log('hFrom:', hFrom, 'hTo:', hwndPtr);
						if (cutils.comparePointers(hFrom, hwndPtr) === 0) {
							console.error('succesfully focused window, hwndPtr:', hwndPtr);
							// break;
						}
					// }
				}

			break;
		case 'gtk':
				for (var i=0; i<aArrHwndPtrStr.length; i++) {
					var hwndPtr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(aArrHwndPtrStr[i]));
					console.log('hwndPtr:', hwndPtr);
					var XWindow = ostypes.HELPER.gdkWinPtrToXID(hwndPtr); // gdkWinPtrToXID returns ostypes.TYPE.XID, but XClientMessageEvent.window field wants ostypes.TYPE.Window..... but XID and Window are same type so its ok no need to cast
					console.log('XWindow1a:', XWindow);
					XWindow = parseInt(cutils.jscGetDeepest(XWindow));
					console.log('XWindow1b:', XWindow);

					var rez_raise = ostypes.API('xcb_configure_window')(ostypes.HELPER.cachedXCBConn(), XWindow, ostypes.CONST.XCB_CONFIG_WINDOW_STACK_MODE, ostypes.TYPE.uint32_t.array()([ostypes.CONST.XCB_STACK_MODE_ABOVE]));
					console.log('rez_raise:', rez_raise);

					// Set input focus (we have override_redirect=1, so the wm will not do this for us)
					// i cannot use XCB_NONE i have to use XCB_INPUT_FOCUS_POINTER_ROOT as otherwise keys are not working
					var rez_focus = ostypes.API('xcb_set_input_focus')(ostypes.HELPER.cachedXCBConn(), ostypes.CONST.XCB_INPUT_FOCUS_POINTER_ROOT, XWindow, ostypes.CONST.XCB_CURRENT_TIME);
					console.log('rez_focus:', rez_focus);
				}

				var rez_flush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
				console.log('rez_flush', rez_flush);
			break;
	}
}

function winForceForegroundWindow(aHwndToFocus) { // rev2 - https://gist.github.com/Noitidart/50c7fa116f58836722a1
	// windows only!
	// focus a window even if this process, that is calling this function, is not the foreground window
	// copy of work from here - ForceForegroundWindow - http://www.asyncop.com/MTnPDirEnum.aspx?treeviewPath=[o]+Open-Source\WinModules\Infrastructure\SystemAPI.cpp

	// aHwndToFocus should be ostypes.TYPE.HWND
	// RETURNS
		// true - if focused
		// false - if it could not focus

	if (core.os.name != 'winnt') {
		throw new Error('winForceForegroundWindow is only for Windows platform');
	}

	var hTo = aHwndToFocus;

	var hFrom = ostypes.API('GetForegroundWindow')();
	if (hFrom.isNull()) {
		console.log('nothing in foreground, so calling process is free to focus anything')
		var rez_SetSetForegroundWindow = ostypes.API('SetForegroundWindow')(hTo);
		console.log('rez_SetSetForegroundWindow:', rez_SetSetForegroundWindow);
		return rez_SetSetForegroundWindow ? true : false;
	}

	if (cutils.comparePointers(hTo, hFrom) === 0) {
		// window is already focused
		console.log('window is already focused');
		return true;
	}

	var pidFrom = ostypes.TYPE.DWORD();
	var threadidFrom = ostypes.API('GetWindowThreadProcessId')(hFrom, pidFrom.address());
	console.info('threadidFrom:', threadidFrom);
	console.info('pidFrom:', pidFrom);

	var pidTo = ostypes.TYPE.DWORD();
	var threadidTo = ostypes.API('GetWindowThreadProcessId')(hTo, pidTo.address()); // threadidTo is thread of my firefox id, and hTo is that of my firefox id so this is possible to do
	console.info('threadidTo:', threadidTo);
	console.info('pidTo:', pidTo);

	// impossible to get here if `cutils.jscEqual(threadidFrom, threadidTo)` because if thats the case, then the window is already focused!!
	// if (cutils.jscEqual(threadidFrom, threadidTo) {

	// from testing, it shows that ```cutils.jscEqual(pidFrom, pidTo)``` works only if i allow at least 100ms of wait time between, which is very weird
	if (/*cutils.jscEqual(pidFrom, pidTo) || */cutils.jscEqual(pidFrom, core.firefox.pid)) {
		// the pid that needs to be focused, is already focused, so just focus it
		// or
		// the pid that needs to be focused is not currently focused, but the calling pid is currently focused. the current pid is allowed to shift focus to anything else it wants
		// if (cutils.jscEqual(pidFrom, pidTo)) {
		// 	console.info('the process, of the window that is to be focused, is already focused, so just focus it - no need for attach');
		// } else if (cutils.jscEqual(pidFrom, core.firefox.pid)) {
			console.log('the process, of the window that is currently focused, is of process of this ChromeWorker, so i can go ahead and just focus it - no need for attach');
		// }
		var rez_SetSetForegroundWindow = ostypes.API('SetForegroundWindow')(hTo);
		console.log('rez_SetSetForegroundWindow:', rez_SetSetForegroundWindow);
		return rez_SetSetForegroundWindow ? true : false;
	}

	var threadidOfChromeWorker = ostypes.API('GetCurrentThreadId')(); // thread id of this ChromeWorker
	console.log('threadidOfChromeWorker:', threadidOfChromeWorker);

	var rez_AttachThreadInput = ostypes.API('AttachThreadInput')(threadidOfChromeWorker, threadidFrom, true);
	console.info('rez_AttachThreadInput:', rez_AttachThreadInput);
	if (!rez_AttachThreadInput) {
		throw new Error('failed to attach thread input');
	}
	var rez_SetSetForegroundWindow = ostypes.API('SetForegroundWindow')(hTo);
	console.log('rez_SetSetForegroundWindow:', rez_SetSetForegroundWindow);

	var rez_AttachThreadInput = ostypes.API('AttachThreadInput')(threadidOfChromeWorker, threadidFrom, false);
	console.info('rez_AttachThreadInput:', rez_AttachThreadInput);

	return rez_SetSetForegroundWindow ? true : false;
}
// end - platform functions

////// start - specific helper functions
function autogenScreenshotFileName(aDateGettime) {
	// no extension generated

	// Screencast - Mmm DD, YYYY - hh:mm AM
	// Screencast - Feb 25, 2016 - 5:04 AM

	var nowDate = new Date();
	if (aDateGettime) {
		nowDate = new Date(aDateGettime);
	}

	var Mmm = formatStringFromName('month.' + (nowDate.getMonth() + 1) + '.Mmm', 'chrome://global/locale/dateFormat.properties');
	var YYYY = nowDate.getFullYear();
	var DD = nowDate.getDate();

	var mm = nowDate.getMinutes();
	var hh = nowDate.getHours(); // 0 - 23
	var AM;
	if (hh < 12) {
		AM = 'AM';
	} else {
		AM = 'PM';
	}

	// adjust hh to 12 hour
	if (hh === 0) {
		hh = 12;
	} else if (hh > 12) {
		hh -= 12;
	}

	// prefix mm with 0
	if (mm < 10) {
		mm = '0' + mm;
	}

	return [formatStringFromName('screenshot', 'main'), ' - ', Mmm, ' ', DD, ', ', YYYY, ' ', hh, ':', mm, ' ', AM].join('');
}

function getPathForAction(path, rec, unsafe_filename) {
	// unsafe_filename is either a string, or undefined. if undefined, rec.time is used with autogenScreencastFileName
	// after unsafe_filename is a string, it is safedForPlatFS
	if (!unsafe_filename) {
		unsafe_filename = autogenScreencastFileName(unsafe_filename);
	}

	return OS.Path.join( path, safedForPlatFS(unsafe_filename, {repStr:'.'}) ) + '.' + rec.mimetype.substr(rec.mimetype.indexOf('/')+1);
}


function buildOSFileErrorString(aMethod, aOSFileError) {
	// aMethod:string - enum[writeAtomic]

	switch (aMethod) {
		case 'writeAtomic':
				var explain;
				if (aOSFileError.becauseNoSuchFile) {
					explain = formatStringFromName('osfileerror_writeatomic_nosuchfile', 'main');
				} else {
					explain = formatStringFromName('osfileerror_unknownreason', 'main');
				}
				formatStringFromName('osfileerror_' + aMethod, 'app', [explain, aOSFileError.winLastError || aOSFileError.unixErrno])
			break;
	}
}
function genericCountdown(countdown, reason, resumer) {
	// reason - the reason that should be sent in aReportProgress on countdown tick
	// countdown is a int of seconds

	if (gCancelled.includes(resumer.shot.actionid)) {
		return;
	}

	countdown--;
	if (!countdown) {
		// coutndown reached 0
		resumer.aActionFlowReenterer();
	} else {
		resumer.aReportProgress({
			reason,
			data: {
				countdown
			},
			serviceid: resumer.shot.serviceid
		});
		setTimeout(genericCountdown.bind(null, ...arguments), 1000);
	}
}
function genericOnUploadProgress(shot, aReportProgress, e) {

	var total_size = formatBytes(shot.arrbuf.byteLength, 1);


	var percent;
	var uploaded_size;
	var progress_data = {};
	if (e.loaded) {
		progress_data.upload_percent = Math.round((e.loaded / e.total) * 100);
		progress_data.upload_size = formatBytes(e.loaded, 1);
		progress_data.upload_sizetotal = formatBytes(e.total, 1);
	}

	aReportProgress({
		reason: 'UPLOAD_PROGRESS',
		data: progress_data
	});
};

////// start - non-oauth actions

////// start - non-oauth actions

var gFilestore;
var gFilestoreDefaultGetters = [ // after default is set, it runs all these functions
	function prefs__quick_save_dir() {
		// all getters should be sync, so i need to figure out what to do here
		console.error('in prefs__quick_save_dir');
		getSystemDirectory('Pictures').then(val=> {
			console.error('ok got pics');
			gFilestoreDefault.prefs.quick_save_dir = val;
		});
		// var st = Date.now();
		// var i = 0;
		// while (!gFilestoreDefault.prefs.quick_save_dir) {
		// 	i++;
		// }
		// var end = Date.now();
		// console.log('prefs__quick_save_dir: took this long to get quick save dir:', (end - st), 'ms', 'i:', i);

		// var st = Date.now();
		// var i = 0;
		// while (!gFilestoreDefault.prefs.quick_save_dir) {
		// 	i++;
		// 	// xhr(OS.Path.toFileURI(OS.Constants.Path.profileDir));
		// 	ostypes.API('SleepEx')(1000, true);
		// 	console.log('completed one sleep, gFilestoreDefault.prefs.quick_save_dir:', gFilestoreDefault.prefs.quick_save_dir);
		// }
		// var end = Date.now();
		// console.log('prefs__quick_save_dir: took this long to get quick save dir:', (end - st), 'ms', 'i:', i);
		console.error('done prefs__quick_save_dir');
	}
];
var gFilestoreDefault = {
	prefs: {
		// quick_save_dir: null, // set by `gFilestoreDefaultGetters`
		print_preview: false,
		system_hotkey: true,
		default_tesseract_lang: 'eng'
	},
	log: [],
	editorstate: undefined,
	oauth: {}
	// hydrants: { // redux related
	// 	prefs: {}
	// }
};
function readFilestore() {
	// reads from disk, if not found, it uses the default filestore
	if (!gFilestore) {
		try {
			gFilestore = JSON.parse(OS.File.read(core.addon.path.filestore, {encoding:'utf-8'}));
		} catch (OSFileError) {
			if (OSFileError.becauseNoSuchFile) {
				gFilestore = gFilestoreDefault ? gFilestoreDefault : {};
				// run default gFilestoreDefaultGetters
				for (var getter of gFilestoreDefaultGetters) {
					getter();
				}
			}
			else { console.error('OSFileError:', OSFileError); throw new Error('error when trying to ready hydrant:', OSFileError); }
		}
	}

	return gFilestore;
}

function updateFilestoreEntry(aArg, aComm) {
	// updates in memory (global), does not write to disk
	// if gFilestore not yet read, it will readFilestore first

	var { mainkey, value, key, verb } = aArg;
	// verb
		// "filter" - `value` must be a function to determine what to remove

	// key is optional. if key is not set, then gFilestore[mainkey] is set to value
	// if key is set, then gFilestore[mainkey][key] is set to value
	// if verb is set

	// REQUIRED: mainkey, value

	if (!gFilestore) {
		readFilestore();
	}

	var dirty = true;
	switch (verb) {
		case 'push':
				// acts on arrays only
				if (key) {
					gFilestore[mainkey][key].push(value);
				} else {
					gFilestore[mainkey].push(value);
				}
			break;
		case 'filter':
				// acts on arrays only
				// removes entires that match verb_do
				var verb_do = value;
				dirty = false;
				var arr;
				if (key) {
					arr = gFilestore[mainkey][key];
				} else {
					arr = gFilestore[mainkey];
				}
				var lm1 = arr.length - 1;
				for (var i=lm1; i>-1; i--) {
					var el = arr[i];
					if (verb_do(el)) {
						arr.splice(i, 1);
						dirty = true;
					}
				}
			break;
		default:
			if (key) {
				gFilestore[mainkey][key] = value;
			} else {
				gFilestore[mainkey] = value;
			}
	}

	if (dirty) {
		gFilestore.dirty = dirty; // meaning not yet written to disk

		if (gWriteFilestoreTimeout !== null) {
			clearTimeout(gWriteFilestoreTimeout);
		}
		gWriteFilestoreTimeout = setTimeout(writeFilestore, 10000);
	}
}

function fetchFilestoreEntry(aArg) {
	var { mainkey, key } = aArg;
	// key is optional. if key is not set, then gFilestore[mainkey] is returned
	// if key is set, then gFilestore[mainkey][key] is returned

	// REQUIRED: mainkey

	if (!gFilestore) {
		readFilestore();
	}

	if (key) {
		return gFilestore[mainkey][key];
	} else {
		return gFilestore[mainkey];
	}
}

var gWriteFilestoreTimeout = null;
function writeFilestore(aArg, aComm) {
	// writes gFilestore to file (or if it is undefined, it writes gFilestoreDefault)
	if (!gFilestore.dirty) {
		console.warn('filestore is not dirty, so no need to write it');
		return;
	}
	if (gWriteFilestoreTimeout !== null) {
		clearTimeout(gWriteFilestoreTimeout);
		gWriteFilestoreTimeout = null;
	}
	delete gFilestore.dirty;
	try {
		writeThenDir(core.addon.path.filestore, JSON.stringify(gFilestore || gFilestoreDefault), OS.Constants.Path.profileDir);
	} catch(ex) {
		gFilestore.dirty = true;
		throw ex;
	}
}

// start - functions called by bootstrap
var gCountdown = undefined; // undefiend when idle. null when cancelled. int of seconds left when in progress
var gCountdownInterval;
function countdownStartOrIncrement(aArg, aReportProgress) {
	// returns true when coutndown done
	// if call this while a countdown is in progress it will increment the countdown and return false
	// will send progress update with a number
	var aSeconds = aArg;
	if (gCountdown === undefined) {
		gCountdown = aSeconds;
		var deferred_done = new Deferred();
		gCountdownInterval = setInterval(function() {
			if (gCountdown === null) {
				// cancelled
				gCountdown = undefined;
				clearInterval(gCountdownInterval);
				deferred_done.resolve({
					done: false
				});
			} else {
				gCountdown--;
				if (gCountdown === 0) {
					clearInterval(gCountdownInterval);
					gCountdown = undefined;
					deferred_done.resolve({
						done: true
					});
				} else {
					aReportProgress({
						sec_left: gCountdown
					});
				}
			}
		}, 1000);

		// set badge to the initial countdown
		aReportProgress({
			sec_left: gCountdown
		});

		return deferred_done.promise;
	} else {
		// gCountdown is a number, so increment it
		gCountdown += aSeconds;

		// update badge to the incremented countdown
		return {
			done: false,
			sec_left: gCountdown
		};
	}
}
function countdownCancel() {
	// returns true if cancelled - so bootstrap knows to clear badge
	if (gCountdown) {
		gCountdown = null;
		// dont clear interval here, so on next fire it will clean up the pathway
		return true;
	} else {
		return false;
	}
}

function bootstrapTimeout(milliseconds) {
	var mainDeferred_bootstrapTimeout = new Deferred();
	setTimeout(function() {
		mainDeferred_bootstrapTimeout.resolve();
	}, milliseconds)
	return mainDeferred_bootstrapTimeout.promise;
}

// reaons:
var reasons = {
	SUCCESS: 'SUCCESS',
	ABORT_ERROR: 'ABORT_ERROR',
	HOLD_ERROR: 'HOLD_ERROR',
	HOLD_USER_AUTH_NEEDED: 'HOLD_USER_AUTH_NEEDED', // user needs to grant oauth authorization
	HOLD_UNHANDLED_STATUS_CODE: 'HOLD_UNHANDLED_STATUS_CODE',
	UNHANDLED_STATUS_CODE: 'UNHANDLED_STATUS_CODE',
	HOLD_GETTING_USER: 'HOLD_GETTING_USER',
	HOLD_USER_TWEET_NEEDED: 'HOLD_USER_TWEET_NEEDED'
};

// start action functions
function action_savequick(shot, aActionFinalizer, aReportProgress) {

	var action_arguments = arguments;
	var n = safedForPlatFS(autogenScreenshotFileName(shot.sessionid) + '.png', {repStr:'.'});
	var f = fetchFilestoreEntry({ mainkey:'prefs', key:'quick_save_dir' });

	// start async-proc183999
	var getSetQuickSaveDir = function() {
		// if `f` is null then it gets the defualt dir and sets it
		if (!f) {
			var resumer = buildResumer( ...action_arguments, action_savequick.bind(null, ...action_arguments) );
			var promise_getdir = getSystemDirectory('Pictures');
			promise_getdir.then(
				function(aVal) {
					console.log('Fullfilled - promise_getdir - ', aVal);
					f = aVal;
					updateFilestoreEntry({
						value: aVal,
						mainkey: 'prefs',
						key: 'quick_save_dir'
					});
					writeToDisk();
				},
				actionReject.bind(null, ...action_arguments, resumer, 'promise_getdir')
			).catch(actionCatch.bind(null, ...action_arguments, resumer, 'promise_getdir'));
		} else {
			writeToDisk();
		}
	};

	var write_cnt = 1;
	var writeToDisk = function() {
		try {
			// throw 'rawr';

			console.log('n:', n, 'f:', f);
			var path;
			if (write_cnt === 1) {
				path = OS.Path.join(f, n);
			} else {
				var noext_n = n.substr(0, n.lastIndexOf('.'));
				var dotext_n = n.substr(n.lastIndexOf('.'));
				var modded_n = noext_n + ' #' + write_cnt + dotext_n;
				console.log('modded_n:', modded_n);
				path = OS.Path.join(f, modded_n);
			}
			OS.File.writeAtomic(path, new Uint8Array(shot.arrbuf), { noOverwrite:true });
			if (modded_n) {
				n = modded_n;
			}
			aActionFinalizer({
				reason: 'SUCCESS',
				data: {
					copytxt: path
				}
			});

			addShotToLog(shot, {
				n, // file name with extension so like blah.png
				f // full os path to folder saved in
			});
		} catch(OSFileError) {
			if (OSFileError.becauseExists) {
				write_cnt++;
				writeToDisk();
				return;
			}
			console.error('action_savequick -> OSFileError:', OSFileError);
			withHold(PLACE, shot.actionid, reasons.HOLD_ERROR, buildResumer( ...action_arguments, action_savequick.bind(null, ...action_arguments) ));
			aReportProgress({
				reason: reasons.HOLD_ERROR,
				data: {
					error_details: buildOSFileErrorString('writeAtomic', OSFileError)
				}
			});
		}
	};

	getSetQuickSaveDir();
	// end async-proc183999

}
function action_savebrowse(shot, aActionFinalizer, aReportProgress) {
	// start async-proc5545
	var n;
	var f;
	var doBrowse = function() {
		var browsefile_arg = {
			aDialogTitle: formatStringFromName('filepicker_title_savescreenshot', 'main'),
			aOptions: {
				returnDetails: true,
				mode: 'modeSave',
				async: true,
				defaultString: safedForPlatFS(autogenScreenshotFileName(shot.sessionid) + '.png', {repStr:'.'}),
				filters:[formatStringFromName('filepicker_filter_png', 'main'), '*.png']
			}
		};
		if (shot.action_options && 'imon' in shot.action_options) {
			browsefile_arg.aOptions.win = shot.action_options.imon;
		} else {
			browsefile_arg.aOptions.win = 'navigator:browser';
		}

		callInBootstrap('browseFile', browsefile_arg, function(aArg) {
			console.log('back from browseFile, aArg:', aArg);
			if (aArg) {
				var { filepath, filter, replace } = aArg;
				var dotext = filter.substr(filter.indexOf('.')); // includes the dot
				if (!filepath.toLowerCase().endsWith(dotext)) {
					filepath += dotext;
				}
				n = OS.Path.basename(filepath);
				f = OS.Path.dirname(filepath);
				writeToDisk();
			} else {
				// cancelled
				aActionFinalizer({
					reason: 'CANCELLED'
				});
			}
		});
	};

	var writeToDisk = function() {
		try {
			// throw 'rawr';

			console.log('n:', n, 'f:', f);
			var path = OS.Path.join(f, n);
			OS.File.writeAtomic(path, new Uint8Array(shot.arrbuf));

			aActionFinalizer({
				reason: 'SUCCESS',
				data: {
					copytxt: path
				}
			});

			addShotToLog(shot, {
				n, // file name with extension so like blah.png
				f // full os path to folder saved in
			});
		} catch(OSFileError) {
			console.error('action_savebrowse -> OSFileError:', OSFileError);
			withHold(PLACE, shot.actionid, reasons.HOLD_ERROR, buildResumer( ...action_arguments, action_savequick.bind(null, ...action_arguments) ));
			aReportProgress({
				reason: reasons.HOLD_ERROR,
				data: {
					error_details: buildOSFileErrorString('writeAtomic', OSFileError)
				}
			});
		}
	};

	doBrowse();
	// end async-proc5545
}
function action_print(shot, aActionFinalizer, aReportProgress) {
	var dataurl = 'data:image/png;base64,' + base64ArrayBuffer(shot.arrbuf);
	callInBootstrap('print', {
		aPrintPreview: fetchFilestoreEntry({mainkey:'prefs', key:'print_preview'}),
		aDataUrl: dataurl
	});
	addShotToLog(shot);
	aActionFinalizer({
		reason: 'SUCCESS',
		data: {
			print_dataurl: dataurl
		}
	});
}
function action_copy(shot, aActionFinalizer, aReportProgress) {
	// callInBootstrap('copy', shot.dataurl);
	var dataurl = 'data:image/png;base64,' + base64ArrayBuffer(shot.arrbuf);
	callInBootstrap('copy', dataurl);
	addShotToLog(shot);
	aActionFinalizer({
		reason: 'SUCCESS',
		data: {
			copytxt: dataurl
		}
	});
}
function action_ocrall(shot, aActionFinalizer, aReportProgress) {
	var action_arguments = arguments;

	aReportProgress({
		reason: 'PROCESSING'
	});

	// var dataurl = 'data:image/png;base64,' + base64ArrayBuffer(shot.arrbuf);

	var finalize_data = {
		reason: 'SUCCESS',
		data: {
			// dataurl: dataurl,
			arrbuf: shot.arrbuf,
			txt: {}
		}
	};

	var promiseAllArr_ocr = [];

	var processOcr = function(aMethod, aDeferred) {
		callInOcrworker('readByteArr', {
			method: aMethod,
			arrbuf: shot.arrbuf,
			width: shot.width,
			height: shot.height
		}, function(aArg2) {
			var txt = aArg2;
			finalize_data.data.txt[aMethod] = txt;
			finalize_data.data.width = shot.width;
			finalize_data.data.height = shot.height;
			aDeferred.resolve();
		});
	}

	for (var a_serviceid in core.nativeshot.services) {
		var entry = core.nativeshot.services[a_serviceid];
		if (entry.type == 'ocr' && a_serviceid != 'ocrall') {
			var deferred_processmethod = new Deferred();
			promiseAllArr_ocr.push(deferred_processmethod.promise);
			processOcr(a_serviceid, deferred_processmethod);
		}
	}

	var resumer = buildResumer( ...action_arguments, action_ocrall.bind(null, ...action_arguments) );
	var promiseAll_ocr = Promise.all(promiseAllArr_ocr);
	promiseAll_ocr.then(
		function() {
			aActionFinalizer(finalize_data);
		},
		actionReject.bind(null, ...action_arguments, resumer, 'promise_getdir')
	).catch(actionCatch.bind(null, ...action_arguments, resumer, 'promise_getdir'));

}
var action_tesseract = action_ocrad = action_gocr = function(shot, aActionFinalizer, aReportProgress) {
	var action_arguments = arguments;

	var lang;
	if (shot.action_options && shot.action_options.lang) {
		lang = shot.action_options.lang;
	} else {
		// use default
		lang = fetchFilestoreEntry({ mainkey:'prefs', key:'default_tesseract_lang' });
	}

	aReportProgress({
		reason: 'PROCESSING'
	});

	// var dataurl = 'data:image/png;base64,' + base64ArrayBuffer(shot.arrbuf);
	callInOcrworker('readByteArr', {
		method: shot.serviceid,
		arrbuf: shot.arrbuf,
		width: shot.width,
		height: shot.height,
		lang
		// __XFER: ['arrbuf']
	}, function(aArg2) {
		var txt = aArg2;

		if (txt === null) {
			aActionFinalizer({
				reason: 'HOLD_ERROR',
				data: {
					error_details: 'Failed OCR' // TODO:
				}
			});
		} else {
			aActionFinalizer({
				reason: 'SUCCESS',
				data: {
					// dataurl: dataurl,
					arrbuf: shot.arrbuf,
					width: shot.width,
					height: shot.height,
					txt: {
						[shot.serviceid]: txt
					}
				}
			});
		}
	});

	addShotToLog(shot);
}
function action_bing(shot, aActionFinalizer, aReportProgress) {
	// http://www.bing.com/images/search?q=&view=detailv2&iss=sbi&FORM=IRSBIQ&sbifsz=412+x+306+%c2%b7+15+kB+%c2%b7+png&sbifnm=rawr.png&thw=412&thh=306#enterInsights
	var action_arguments = arguments;

	var bing_bytes;
	if (shot.arrbuf.byteLength < 1024) {
		bing_bytes = '0+kB'
	} else {
		bing_bytes = formatBytes(shot.arrbuf.byteLength).replace(/\.\d+ /, '+').replace(/(.)B/, ($0,$1)=>$1.toLowerCase()+'B');
	}
	var url = 'http://www.bing.com/images/search?q=&view=detailv2&iss=sbi&FORM=IRSBIQ&sbifsz=' + Math.floor(shot.width) + '+x+' + Math.floor(shot.height) + '+%c2%b7+' + bing_bytes + '+%c2%b7+png&sbifnm=rawr.png&thw=' + Math.floor(shot.width) + '&thh=' + Math.floor(shot.height) + '#enterInsights';

	var postdata = {
		imgurl: '',
		cbir: 'sbi',
		imageBin: base64ArrayBuffer(shot.arrbuf)
	};

	callInBootstrap('reverseImageSearch', {
		postdata,
		url,
		actionid: shot.actionid
	});

	aActionFinalizer({
		reason: 'SUCCESS'
	});

	addShotToLog(shot);
}
var action_tineye = action_googleimages = function(shot, aActionFinalizer, aReportProgress) {
	var action_arguments = arguments;

	const search_urls = {
		googleimages: 'https://images.google.com/searchbyimage/upload',
		tineye: 'http://tineye.com/search'
	};

	var path = OS.Path.join(OS.Constants.Path.tmpDir, 'nativeshot_revsearch-' + shot.actionid + '.png'); // i make file name unique so that it never runs into issue where there is a prexisting file. even if the files have not self deleted from the past link000248

	try {
		OS.File.writeAtomic(path, new Uint8Array(shot.arrbuf));
	} catch(OSFileError) {
		console.error('action_' + shot.serviceid + ' -> OSFileError:', OSFileError);
		withHold(PLACE, shot.actionid, reasons.HOLD_ERROR, buildResumer( ...action_arguments, action_savequick.bind(null, ...arguments) ));
		aReportProgress({
			reason: reasons.HOLD_ERROR,
			data: {
				error_details: buildOSFileErrorString('writeAtomic', OSFileError)
			}
		});
	}

	var postdata = {};
	switch (shot.serviceid) {
		case 'tineye':
				postdata = {
					image: 'nsifile'
				};
			break;
		case 'googleimages':
				postdata = {
					encoded_image: 'nsifile',
					image_url: 'myimg.png'
				};
			break;
	}
	callInBootstrap('reverseImageSearch', {
		path,
		postdata,
		url: search_urls[shot.serviceid],
		actionid: shot.actionid
	});

	aActionFinalizer({
		reason: 'SUCCESS'
	});

	addShotToLog(shot);
}
// end action functions

function processAction(aArg, aReportProgress, aComm) {
	// var { actionid, sessionid, serviceid, arrbuf/dataurl, action_options, width, height } = aArg;
	// actionid is time the action started
	// sessionid is the time the screenshot was taken
		// special actions - based on action_options.alt_action
			// action_options.alt_action == 'delete'
				// action_options.d = d in log
				// serviceid
				// actionid - the Date.now() it started
				// nothing else, no arrbuf/dataurl, no width, no height
	var shot = aArg;
	// shot.shotid = shot.actionid; // shotid can be time, as time is down to millisecond and thus should be unique per shot

	var deferredMain_processAction = new Deferred();

	console.log('worker - processAction - aArg:', aArg);

	gWorker['action_' + shot.serviceid](shot, function(status) {
		console.log('worker - processAction complete, status:', status);
		deferredMain_processAction.resolve(status);
	}, aReportProgress);

	return deferredMain_processAction.promise;
}

function trashEntry(d, aReportProgress) {
	var log = fetchFilestoreEntry({ mainkey:'log' });
	var entry = log.find( el => el.d === d);
	var rez = trashFile(OS.Path.join(entry.f, entry.n));

	if (!rez) {
		return {
			reason: formatStringFromName('reason1_trash', 'main')
		};
	} else {
		aReportProgress({
			reason: formatStringFromName('processing_forget', 'main')
		});
		var rez2 = removeFromLogD(d, aReportProgress);
		if (rez2.reason != 'SUCCESS') {
			return {
				reason: formatStringFromName('reason2_trash', 'main')
			};
		} else {
			return rez2;
		}
	}
}

function removeFromLogD(d, aReportProgress) {
	// removes single entry where `entry.d` === `d`

	// // flow for talking with slipcover
	// var deferredmain = new Deferred();
	//
	// aReportProgress({
	// 	reason: 'hiii' // reason is a const usually, but in this case it is a text to show in slipcover
	// });
	//
	// setTimeout(function() {
	//	// this is how to send an error, IF success then send back `reason: 'SUCCESS'`
	// 	deferredmain.resolve({
	// 		reason: 'could not find log - dummy error'
	// 	});
	// }, 2000);
	//
	// return deferredmain.promise;

	updateFilestoreEntry({
		value: el => el.d === d,
		mainkey: 'log',
		verb: 'filter'
	});

	setTimeout(function() {
		callInBootstrap('broadcastToOpenHistory', {
			m: 'removeGalleryItemsBy',
			a: [
				'd',
				d
			]
		});
	}, 0);

	return {
		reason: 'SUCCESS'
	};
}

function removeFromLogT(t) {
	// removes all entries where `entry.t` === `t`

	updateFilestoreEntry({
		value: el => el.t === t,
		mainkey: 'log',
		verb: 'filter'
	});

	setTimeout(function() {
		callInBootstrap('broadcastToOpenHistory', {
			m: 'removeGalleryItemsBy',
			a: [
				't',
				t
			]
		});
	}, 0);

	return {
		reason: 'SUCCESS'
	};
}

function addShotToLog(shot, aExtraKeys={}) {
	var { serviceid, actionid } = shot;
	var required_extras = { // console.log(remove on prod)
		imguranon: ['x', 'i'], // console.log(remove on prod)
		imgur: ['x', 'i', 'u', 's'], // console.log(remove on prod)
		dropbox: ['l', 'i', 'u', 's'], // console.log(remove on prod)
		gdrive: ['l', 'i', 'u', 's'], // console.log(remove on prod)
		twitter: ['l', 'p', 'u', 's'], // console.log(remove on prod)
		savequick: ['n', 'f'], // console.log(remove on prod)
		savequick: ['n', 'f'] // console.log(remove on prod)
	}; // console.log(remove on prod)

	if (required_extras[serviceid]) { // console.log(remove on prod)
		for (var key of required_extras[serviceid]) { // console.log(remove on prod)
			if (!(key in aExtraKeys)) { // console.log(remove on prod)
				console.error('missing key of', key, 'in aExtraKeys for log entry of serviceid:', serviceid); // console.log(remove on prod)
				throw new Error('missing key of in log entry aExtraKeys'); // console.log(remove on prod)
			} // console.log(remove on prod)
		} // console.log(remove on prod)
	} // console.log(remove on prod)

	// if (['tesseract', 'gocr', 'ocrad'].includes(serviceid)) {
	// 	// lets make sure its not already there
	// 	for (var entry of fetchFilestoreEntry({mainkey:'log'})) {
	// 		if (entry.d === actionid && entry.t === core.nativeshot.services[serviceid].code) {
	// 			console.warn('this entry is already in the log, so dont add');
	// 			return;
	// 		}
	// 	}
	// }

	var log_entry = Object.assign(aExtraKeys, {
		d: actionid,
		t: core.nativeshot.services[serviceid].code
	});
	updateFilestoreEntry({
		value: log_entry,
		mainkey: 'log',
		verb: 'push'
	});

	var cloned = JSON.parse(JSON.stringify(log_entry));
	callInBootstrap('broadcastToOpenHistory', {
		m: 'addGalleryItems',
		a: [
			[mutateEntryForLogsrc(cloned)]
		]
	});
}

function actionReject(shot, aActionFinalizer, aReportProgress, aResumer, aPromiseName, aReason) {
	var rejobj = {
		name: aPromiseName,
		aReason
	};

	withHold(PLACE, shot.actionid, reasons.HOLD_ERROR, aResumer );
	aReportProgress({
		reason: reasons.HOLD_ERROR,
		data: {
			error_details: rejobj
		}
	});
}
function actionCatch(shot, aActionFinalizer, aReportProgress, aResumer, aPromiseName, aCaught) {
	var rejobj = {
		name: aPromiseName,
		aCaught
	};

	withHold(PLACE, shot.actionid, reasons.HOLD_ERROR, aResumer );
	aReportProgress({
		reason: reasons.HOLD_ERROR,
		data: {
			error_details: rejobj
		}
	});
}
// end - functions called by bootstrap

function reflectSystemHotkeyPref() {
	var system_hotkey = fetchFilestoreEntry({mainkey:'prefs',key:'system_hotkey'});
	console.log('reflectSystemHotkeyPref, system_hotkey:', system_hotkey);
	if (system_hotkey) {
		hotkeysRegister().then(failed => !failed ? null : callInBootstrap('hotkeyRegistrationFailed', failed));
	} else {
		hotkeysUnregister();
	}
}

// start - system hotkey
var gHKI = { // stands for globalHotkeyInfo
	any_registered: false, // false or true depending on if any registered
	all_registered: false, // false or true if all hotkeys succesfully registered
	loop_interval_ms: 200, // only for windows and xcb
	min_time_between_repeat: 1000,
	hotkeys: undefined, // as i need access to core.os.mname first, this will happen after init, i run hotkeysRegister after init, so i do it there
		// on succesful registration, the entry is marked with __REGISTERED: {} and holds data needed for unregistration
	next_hotkey_id: 1
};
var gHKILoopInterval = null;

function hotkeysRegister() {
	// on error, it returns an object:
	 	// hotkey - `hotkey` entry in gHKI.hotkeys that caused the failure
		// reason - string explaining why
	var deferredmain = new Deferred();

	if (!gHKI.hotkeys) {
		switch (core.os.mname) {
			case 'winnt':
					gHKI.hotkeys = [
						{
							desc: 'Print Screen', // it describes the `code` combo in english for use on hotkeysRegister() failing
							code: ostypes.CONST.VK_SNAPSHOT,
							callback: 'screenshot',
						}
					];
				break;
			case 'gtk':
					gHKI.hotkeys = [
						{
							desc: 'Print Screen (Capslock:Off, Numlock:Off)',
							code: ostypes.CONST.XK_Print,
							// mods: // if undefined, or object is empty it will use ostypes.CONST.XCB_NONE
							callback: 'screenshot'
						},
						{
							desc: 'Print Screen (Capslock:On, Numlock:Off)',
							code: ostypes.CONST.XK_Print,
							mods: {
								capslock: true // capslock is only available as mod on linux
							},
							callback: 'screenshot'
						},
						{
							desc: 'Print Screen (Capslock:Off, Numlock:On)',
							code: ostypes.CONST.XK_Print,
							mods: {
								numlock: true // numlock is only available as mod on linux
							},
							callback: 'screenshot'
						},
						{
							desc: 'Print Screen (Capslock:On, Numlock:On)',
							code: ostypes.CONST.XK_Print,
							mods: {
								numlock:true,
								capslock: true
							},
							callback: 'screenshot'
						}
					];
				break;
			case 'darwin':
					gHKI.hotkeys = [
						{
							desc: '\u2318 + 3', // \u2318 is the apple/meta key symbol
							code: ostypes.CONST.KEY_3,
							mods: {
								meta: true
							},
							callback: 'screenshot'
						}
					];
				break;
			default:
				console.error('your os is not supported for global platform hotkey');
				// throw new Error('your os is not supported for global platform hotkey');
				deferredmain.resolve({reason:'Your OS is not supported for global platform hotkey, OS is "' + core.os.mname + '" and "' + core.os.name + '"'});
				return deferredmain.promise;
		}
	}

	switch (core.os.mname) {
		case 'winnt':

				var hotkeys = gHKI.hotkeys;
				for (var hotkey of hotkeys) {
					var { __REGISTERED, mods, code:code_os } = hotkey;

					if (__REGISTERED) {
						console.warn('hotkey already registered for entry:', hotkey);
						continue;
					} else {
						var mods_os = ostypes.CONST.MOD_NONE; // this is 0
						if (mods) {
							// possible mods: alt, control, shift, meta (meta means win key)
								// windows only mods: norepeat
							if (mods.alt) {
								mods_os |= ostypes.CONST.MOD_ALT;
							}
							if (mods.control) {
								mods_os |= ostypes.CONST.MOD_CONTROL;
							}
							if (mods.norepeat) {
								// not supported on win vista - per docs
								mods_os |= ostypes.CONST.MOD_NOREPEAT;
							}
							if (mods.shift) {
								mods_os |= ostypes.CONST.MOD_SHIFT;
							}
							if (mods.meta) {
								mods_os |= ostypes.CONST.MOD_WIN;
							}
						}
						var hotkeyid = gHKI.next_hotkey_id++;
						var rez_reg = ostypes.API('RegisterHotKey')(null, hotkeyid, mods_os, code_os);
						if (rez_reg) {
							hotkey.__REGISTERED = {
								hotkeyid,
								last_triggered: 0 // Date.now() of when it was last triggered, for use to check with min_time_between_repeat
							};
						} else {
							console.error('failed to register hotkey:', hotkey);
							console.error('due to fail will not register any of the other hotkeys if there were any, and will unregister whatever was registered');
							hotkeysUnregister();
							deferredmain.resolve({
								hotkey,
								reason: 'Failed for winLastError of "' + ctypes.winLastError + '"'
							});
							return deferredmain.promise;
						}
					}
				}

				hotkeysStartLoop();

				deferredmain.resolve(null); // resolve with `null` for no error

			break;
		case 'gtk':

				var hotkeys = gHKI.hotkeys;

				// // get `code_os` for each `code`

				// collect unique codes
				var codes = new Set();
				for (var hotkey of hotkeys) {
					codes.add(hotkey.code);
				}

				codes = [...codes];

				var code_os_to_codes_os = {};

				var keysyms = ostypes.API('xcb_key_symbols_alloc')(ostypes.HELPER.cachedXCBConn());
				console.log('keysyms:', keysyms.toString());

				for (var code of codes) {
					code_os_to_codes_os[code] = []; // array becuase multiple codeos can exist for a single code


					var keycodesPtr = ostypes.API('xcb_key_symbols_get_keycode')(keysyms, code);
					console.log('keycodesPtr:', keycodesPtr.toString());

					for (var i=0; i<10; i++) { // im just thinking 10 is a lot, usually you only have 1 keycode. mayyybe 2. 10 should cover it
						var keycodesArrC = ctypes.cast(keycodesPtr, ostypes.TYPE.xcb_keycode_t.array(i+1).ptr).contents;
						console.log('keycodesArrC:', keycodesArrC);
						if (cutils.jscEqual(keycodesArrC[i], ostypes.CONST.XCB_NO_SYMBOL)) {
							break;
						} else {
							code_os_to_codes_os[code].push(keycodesArrC[i]);
						}
					}

					ostypes.API('free')(keycodesPtr);

					if (!code_os_to_codes_os[code].length) {
						console.error('linux no keycodes found for hotkey code:', code);
						// throw new Error('linux no keycodes found for hotkey code: ' + code);
						// nothing yet registered, so no need to run `hotkeysUnregister()`
						deferredmain.resolve({
							hotkey: hotkeys.find(el => el.code === code),
							reason: 'No keycodes on this system for code of "' + code+ '"'
						}); // the first hoeky that uses this `code`
						return deferredmain.promise;
					}
				}

				ostypes.API('xcb_key_symbols_free')(keysyms);

				// // grab the keys
				// collect the grab windows
				var setup = ostypes.API('xcb_get_setup')(ostypes.HELPER.cachedXCBConn());
				console.log('setup:', setup.contents);

				var screens = ostypes.API('xcb_setup_roots_iterator')(setup);
				var grabwins = []; // so iterate through these and ungrab on remove of hotkey
				var screens_cnt = screens.rem;

				for (var i=0; i<screens_cnt; i++) {
					console.log('screen[' + i + ']:', screens);
					console.log('screen[' + i + '].data:', screens.data.contents);
					var grabwin = screens.data.contents.root;
					grabwins.push(grabwin);
					ostypes.API('xcb_screen_next')(screens.address());
				}

				// start registering hotkeys if they are not registered
				for (var hotkey of hotkeys) {
					var { code, mods, __REGISTERED } = hotkey;
					if (__REGISTERED) {
						console.warn('hotkey already registered for entry:', hotkey);
						continue;
					} else {

						// start - copy of block-link391999
						var mods_os = ostypes.CONST.XCB_NONE; // is 0
						if (mods) {
							// possible mods: alt, control, shift, meta // TODO: <<< these are not yet supported
								// nix only mods: capslock, numlock - these are supported
							if (mods.capslock) {
								mods_os |= ostypes.CONST.XCB_MOD_MASK_LOCK;
							}
							if (mods.numlock) {
								mods_os |= ostypes.CONST.XCB_MOD_MASK_2;
							}
						}
						// end - copy of block-link391999

						// grab this hotkey on all grabwins
						// var any_win_registered = false;
						// var any_codeos_registered = false;
						// var any_registered = false;
						for (var grabwin of grabwins) {
							for (var code_os of code_os_to_codes_os[code]) {
								var rez_grab = ostypes.API('xcb_grab_key_checked')(ostypes.HELPER.cachedXCBConn(), 1, grabwin, mods_os, code_os, ostypes.CONST.XCB_GRAB_MODE_ASYNC, ostypes.CONST.XCB_GRAB_MODE_ASYNC);
								var rez_check = ostypes.API('xcb_request_check')(ostypes.HELPER.cachedXCBConn(), rez_grab);
								console.log('rez_check:', rez_check.toString());
								if (!rez_check.isNull()) {
									console.error('The hotkey is already in use by another application. Find that app, and make it release this hotkey. Possibly could be in use by the "Global Keyboard Shortcuts" of the system.'); // http://i.imgur.com/cLz1fDs.png
								} else {
									// even if just one registered, lets mark it registerd, so the `hotkeysUnregister` function will just get errors on what isnt yet registered from the set of `code_os_to_codes_os`
									// any_registered = true;
									hotkey.__REGISTERED = {
										grabwins,
										codes_os: code_os_to_codes_os[code],
										last_triggered: 0
									};
								}
							}
						}

						if (!hotkey.__REGISTERED) { // same as checking `if (!any_registered)`
							// nothing for any of the codeos's for this code registered on any of the grabwins
							console.error('failed to register hotkey:', hotkey);
							console.error('due to fail will not register any of the other hotkeys if there were any, and will unregister whatever was registered');
							hotkeysUnregister();
							deferredmain.resolve({
								hotkey,
								reason: 'It is most likely that this key combination is already in use by another application. Find that app, and make it release this hotkey. Possibly could be in use by the "Global Keyboard Shortcuts" of the system - http://i.imgur.com/cLz1fDs.png\n\n\nDetails: Was not able to register any of the `code_os` on any of the `grabwins`. `grabwins`: ' + grabwins.toString() + ' code_os: ' + code_os.toString()
							});
							return deferredmain.promise;
						}

					}
				}

				var rez_flush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
				console.log('rez_flush:', rez_flush);

				hotkeysStartLoop();

				deferredmain.resolve(null); // resolve with `null` for no error

			break;
		case 'darwin':

				var hotkeys_basic = [];
				var { hotkeys } = gHKI;

				for (var hotkey of hotkeys) {
					var { code:code_os, mods } = hotkey;

					var mods_os = 0;
					if (mods) {
						// possible mods: alt (on mac alt and option key is same), control, shift, meta
							// mac only mods: capslock

						if (mods.capslock) {
							mods_os |= ostypes.CONST.alphaLock;
						}
						if (mods.meta) {
							mods_os |= ostypes.CONST.cmdKey;
						}
						if (mods.alt) {
							mods_os |= ostypes.CONST.optionKey;
							mods_os |= ostypes.CONST.rightOptionKey;
						}
						if (mods.shift) {
							mods_os |= ostypes.CONST.shiftKey;
							mods_os |= ostypes.CONST.rightShiftKey;
						}
						if (mods.control) {
							mods_os |= ostypes.CONST.controlKey;
							mods_os |= ostypes.CONST.rightControlKey;
						}
					}

					var hotkeyid = gHKI.next_hotkey_id++;
					var signature = ostypes.HELPER.OS_TYPE(nonce(4 - hotkeyid.toString().length) + hotkeyid.toString());

					hotkey.temp_hotkeyid = hotkeyid; // this is premetive, so on return of `hotkeysRegisterMt`, i can go in and find the corresponding `hotkey` entry to attach the returned `ref`/`__REGISTERED`

					hotkeys_basic.push({
						mods_os,
						code_os,
						signature,
						hotkeyid
					});
				}

				callInBootstrap('hotkeysRegisterMt', { hotkeys_basic }, function(aObjOfErrAndRegs) {
					var { __ERROR, __REGISTREDs } = aObjOfErrAndRegs;

					var errored_hotkey;
					if (__ERROR && __ERROR.hotkeyid) {
						// find the `hotkey` entry associated with it, as in next block i will delete all hotkey.temp_hotkeyid
						errored_hotkey = hotkeys.find( el => el.temp_hotkeyid === __ERROR.hotkeyid );
					}

					if (Object.keys(__REGISTREDs).length) {
						// if any were succesfully registered, then go through add the `__REGISTERED` object to the associated `hotkey` entry. find association by `hotkey.temp_hotkeyid`
						for (var hotkey of hotkeys) {
							var { temp_hotkeyid:hotkeyid } = hotkey;

							delete hotkey.temp_hotkeyid;

							if (__REGISTREDs[hotkeyid]) {
								hotkey.__REGISTERED = __REGISTREDs[hotkeyid];
							}
						}

						if (__ERROR) {
							hotkeysUnregister();
						}
					}

					if (__ERROR) {
						deferredmain.resolve({
							hotkey: errored_hotkey,
							reason: __ERROR.reason
						});
					}
				});

			break;
		default:
			console.error('your os is not supported for global platform hotkey');
			// throw new Error('your os is not supported for global platform hotkey');
			deferredmain.resolve({reason:'Your OS is not supported for global platform hotkey, OS is "' + core.os.mname + '" and "' + core.os.name + '"'});
			return deferredmain.promise;
	}

	return deferredmain.promise;
}

function hotkeysShouldUnregister() {
	if (gHKI.hotkeys && gHKI.hotkeys.find(el => el.__REGISTERED)) {
		// it means something is registered, so lets unregister it
		return hotkeysUnregister();
	} // else it will return undefined
	else { console.log('no need to hotkeysUnregister'); }
}

function hotkeysUnregister() {

	hotkeysStopLoop();

	var hotkeys = gHKI.hotkeys;
	if (!hotkeys) { return } // never ever registered

	switch (core.os.mname) {
		case 'winnt':

				for (var hotkey of hotkeys) {
					var { __REGISTERED, mods, code:code_os } = hotkey;

					if (!__REGISTERED) {
						console.warn('this one is not registered:', hotkey);
					} else {
						var { hotkeyid } = __REGISTERED;
						var rez_unreg = ostypes.API('UnregisterHotKey')(null, hotkeyid);
						if (!rez_unreg) {
							console.error('failed to unregister hotkey:', hotkey);
						} else {
							delete hotkey.__REGISTERED;
						}
					}
				}

			break;
		case 'gtk':

				for (var hotkey of hotkeys) {
					var { __REGISTERED, mods, code:code_os } = hotkey;

					if (!__REGISTERED) {
						console.warn('this one is not registered:', hotkey);
					} else {
						var { codes_os, grabwins } = __REGISTERED;

						// start - copy of block-link391999
						var mods_os = ostypes.CONST.XCB_NONE; // is 0
						if (mods) {
							// possible mods: alt, control, shift, meta // TODO: <<< these are not yet supported
								// nix only mods: capslock, numlock - these are supported
							if (mods.capslock) {
								mods_os |= ostypes.CONST.XCB_MOD_MASK_LOCK;
							}
							if (mods.numlock) {
								mods_os |= ostypes.CONST.XCB_MOD_MASK_2;
							}
						}
						// end - copy of block-link391999

						for (var grabwin of grabwins) {
							for (var code_os of codes_os) {
								var rez_ungrab = ostypes.API('xcb_ungrab_key')(ostypes.HELPER.cachedXCBConn(), code_os, grabwin, mods_os);
								console.log('rez_ungrab:', rez_ungrab);
							}
						}

						// TODO: maybe add error checking if ungrab fails, not sure
						delete hotkey.__REGISTERED;
					}
				}

			break;
		case 'darwin':

				var deferredmain = new Deferred();
				callInBootstrap('hotkeysUnregisterMt', { hotkeys }, function() {
					for (var hotkey of hotkeys) {
						delete hotkey.__REGISTERED;
					}
					deferredmain.resolve()
				});

				return deferredmain.promise;

			break;
		default:
			console.error('your os is not supported for global platform hotkey');
			throw new Error('your os is not supported for global platform hotkey');
	}

	console.log('succesfully unregistered hotkeys');
}

function hotkeysStartLoop() {
	if (gHKILoopInterval !== null) {
		// never stopped loop
		return;
	}

	switch (core.os.mname) {
		case 'winnt':

				gHKI.win_msg = ostypes.TYPE.MSG();

			break;
		case 'gtk':

				//

			break;
		case 'darwin':

				//

			break;
		// no need for this `default` block as `hotkeysStopLoop`, `hotkeysStartLoop`, and `hotkeysLoop` are only triggered after `hotkeysRegister` was succesful
		// default:
		// 	console.error('your os is not supported for global platform hotkey');
		// 	throw new Error('your os is not supported for global platform hotkey');
	}

	gHKILoopInterval = setInterval(hotkeysLoop, gHKI.loop_interval_ms);
}

function hotkeysStopLoop() {
	if (gHKILoopInterval === null) {
		// never started loop
		return;
	}

	clearInterval(gHKILoopInterval);
	gHKILoopInterval = null;

	switch (core.os.mname) {
		case 'winnt':

				delete gHKI.win_msg;

			break;
		case 'gtk':

				//

			break;
		case 'darwin':

				//

			break;
		// no need for this `default` block as `hotkeysStopLoop`, `hotkeysStartLoop`, and `hotkeysLoop` are only triggered after `hotkeysRegister` was succesful
		// default:
		// 	console.error('your os is not supported for global platform hotkey');
		// 	throw new Error('your os is not supported for global platform hotkey');
	}

}

function hotkeysLoop() {
	// event loop for hotkey
	switch (core.os.mname) {
		case 'winnt':

				var msg = gHKI.win_msg;
				var hotkeys = gHKI.hotkeys;
				while (ostypes.API('PeekMessage')(msg.address(), null, ostypes.CONST.WM_HOTKEY, ostypes.CONST.WM_HOTKEY, ostypes.CONST.PM_REMOVE)) {
					// console.log('in peek, msg:', msg);
					for (var hotkey of hotkeys) {
						var { callback, __REGISTERED } = hotkey;
						if (__REGISTERED) {
							var { last_triggered, hotkeyid } = __REGISTERED;
							if (cutils.jscEqual(hotkeyid, msg.wParam)) {
								var now_triggered = Date.now();
								if ((now_triggered - last_triggered) > gHKI.min_time_between_repeat) {
									__REGISTERED.last_triggered = now_triggered;
									hotkeyCallbacks[callback]();
								}
								else { console.warn('time past is not yet greater than min_time_between_repeat, time past:', (now_triggered - last_triggered), 'ms'); }
								__REGISTERED.last_triggered = now_triggered; // dont allow till user keys up for at least min_time_between_repeat
							}
						}
					}
				}

			break;
		case 'gtk':

				while (true) {
					// true until evt is found to be null
					var evt = ostypes.API('xcb_poll_for_event')(ostypes.HELPER.cachedXCBConn());
					if (!evt.isNull()) {
						if (evt.contents.response_type == ostypes.CONST.XCB_KEY_PRESS) {
							var hotkeys = gHKI.hotkeys;
							hotkeyOf:
							for (var hotkey of hotkeys) {
								var { callback, __REGISTERED } = hotkey;
								if (__REGISTERED) {
									var { codes_os, last_triggered } = __REGISTERED;
									for (var code_os of codes_os) {
										if (cutils.jscEqual(code_os, evt.contents.pad0)) {
											var now_triggered = Date.now();
											if ((now_triggered - last_triggered) > gHKI.min_time_between_repeat) {
												console.warn('TRIGGERING!!!!!! time past IS > min_time_between_repeat, time past:', (now_triggered - last_triggered), 'ms, gHKI.min_time_between_repeat:', gHKI.min_time_between_repeat, 'last_triggered:', last_triggered);
												__REGISTERED.last_triggered = now_triggered;
												hotkeyCallbacks[callback]();
												break hotkeyOf;
											}
											else { console.warn('time past is not yet greater than min_time_between_repeat, time past:', (now_triggered - last_triggered), 'ms, gHKI.min_time_between_repeat:', gHKI.min_time_between_repeat, 'last_triggered:', last_triggered); }
											__REGISTERED.last_triggered = now_triggered; // dont allow till user keys up for at least min_time_between_repeat
											break hotkeyOf;
										}
									}
								}
							}
						}

						ostypes.API('free')(evt);
					} else {
						break;
					}
				}

			break;
		case 'darwin':

				throw new Error('darwin not supported for fake loop - use real loop');

			break;
		default:
			console.error('your os is not supported for global platform hotkey');
			throw new Error('your os is not supported for global platform hotkey');
	}
}

var hotkeyCallbacks = {
	screenshot: function() {
		console.error('in trigger callback! "screenshot"');
		callInBootstrap('shouldTakeShot');
	}
};

function hotkeyMacCallback(aArg) {
	var { id, now_triggered } = aArg;
	id = parseInt(id);

	var { hotkeys } = gHKI;

	for (var hotkey of hotkeys) {
		var { callback, __REGISTERED } = hotkey;
		if (__REGISTERED) {
			var { last_triggered, hotkeyid } = __REGISTERED;
			if (id === hotkeyid) {
				if ((now_triggered - last_triggered) > gHKI.min_time_between_repeat) {
					__REGISTERED.last_triggered = now_triggered;
					hotkeyCallbacks[callback]();
				}
				else { console.warn('time past is not yet greater than min_time_between_repeat, time past:', (now_triggered - last_triggered), 'ms, last_triggered:', last_triggered); }
				__REGISTERED.last_triggered = now_triggered; // dont allow till user keys up for at least min_time_between_repeat
			}
		}
	}
}
// end - system hotkey

// End - Addon Functionality

// start - common helper functions
function Deferred() {
	this.resolve = null;
	this.reject = null;
	this.promise = new Promise(function(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
	}.bind(this));
	Object.freeze(this);
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};
	console.error('Rejected - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};
	console.error('Caught - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
// rev2 - https://gist.github.com/Noitidart/ec1e6b9a593ec7e3efed
function xhr(aUrlOrFileUri, aOptions={}) {
	// console.error('in xhr!!! aUrlOrFileUri:', aUrlOrFileUri);

	// all requests are sync - as this is in a worker
	var aOptionsDefaults = {
		responseType: 'text',
		timeout: 0, // integer, milliseconds, 0 means never timeout, value is in milliseconds
		headers: null, // make it an object of key value pairs
		method: 'GET', // string
		data: null // make it whatever you want (formdata, null, etc), but follow the rules, like if aMethod is 'GET' then this must be null
	};
	aOptions = Object.assign(aOptionsDefaults, aOptions);

	var cRequest = new XMLHttpRequest();

	cRequest.open(aOptions.method, aUrlOrFileUri, false); // 3rd arg is false for synchronus

	if (aOptions.headers) {
		for (var h in aOptions.headers) {
			cRequest.setRequestHeader(h, aOptions.headers[h]);
		}
	}

	cRequest.responseType = aOptions.responseType;
	cRequest.send(aOptions.data);

	// console.log('response:', cRequest.response);

	// console.error('done xhr!!!');
	return cRequest;
}
// rev4 - https://gist.github.com/Noitidart/6d8a20739b9a4a97bc47
var _cache_formatStringFromName_packages = {}; // holds imported packages
function formatStringFromName(aKey, aLocalizedPackageName, aReplacements) {
	// depends on ```core.addon.path.locale``` it must be set to the path to your locale folder

	// aLocalizedPackageName is name of the .properties file. so mainworker.properties you would provide mainworker // or if it includes chrome:// at the start then it fetches that
	// aKey - string for key in aLocalizedPackageName
	// aReplacements - array of string

	// returns null if aKey not found in pacakage

	var packagePath;
	var packageName;
	if (aLocalizedPackageName.indexOf('chrome:') === 0 || aLocalizedPackageName.indexOf('resource:') === 0) {
		packagePath = aLocalizedPackageName;
		packageName = aLocalizedPackageName.substring(aLocalizedPackageName.lastIndexOf('/') + 1, aLocalizedPackageName.indexOf('.properties'));
	} else {
		packagePath = core.addon.path.locale + aLocalizedPackageName + '.properties';
		packageName = aLocalizedPackageName;
	}

	if (!_cache_formatStringFromName_packages[packageName]) {
		var packageStr = xhr(packagePath).response;
		var packageJson = {};

		var propPatt = /(.*?)=(.*?)$/gm;
		var propMatch;
		while (propMatch = propPatt.exec(packageStr)) {
			packageJson[propMatch[1]] = propMatch[2];
		}

		_cache_formatStringFromName_packages[packageName] = packageJson;

		console.log('packageJson:', packageJson);
	}

	var cLocalizedStr = _cache_formatStringFromName_packages[packageName][aKey];
	if (!cLocalizedStr) {
		return null;
	}
	if (aReplacements) {
		for (var i=0; i<aReplacements.length; i++) {
			cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
		}
	}

	return cLocalizedStr;
}

function xhrAsync(aUrlOrFileUri, aOptions={}, aCallback) { // 052716 - added timeout support
	// console.error('in xhr!!! aUrlOrFileUri:', aUrlOrFileUri);
	if (!aUrlOrFileUri && aOptions.url) { aUrlOrFileUri = aOptions.url }

	// all requests are sync - as this is in a worker
	var aOptionsDefaults = {
		responseType: 'text',
		timeout: 0, // integer, milliseconds, 0 means never timeout, value is in milliseconds
		headers: null, // make it an object of key value pairs
		method: 'GET', // string
		data: null, // make it whatever you want (formdata, null, etc), but follow the rules, like if aMethod is 'GET' then this must be null
		onprogress: undefined, // set to callback you want called
		onuploadprogress: undefined // set to callback you want called
	};
	Object.assign(aOptionsDefaults, aOptions);
	aOptions = aOptionsDefaults;

	var request = new XMLHttpRequest();

	request.timeout = aOptions.timeout;

	var handler = ev => {
		evf(m => request.removeEventListener(m, handler, !1));

		switch (ev.type) {
			case 'load':

					aCallback({request, ok:true});
					// if (xhr.readyState == 4) {
					// 	if (xhr.status == 200) {
					// 		deferredMain_xhr.resolve(xhr);
					// 	} else {
					// 		var rejObj = {
					// 			name: 'deferredMain_xhr.promise',
					// 			aReason: 'Load Not Success', // loaded but status is not success status
					// 			xhr: xhr,
					// 			message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					// 		};
					// 		deferredMain_xhr.reject(rejObj);
					// 	}
					// } else if (xhr.readyState == 0) {
					// 	var uritest = Services.io.newURI(aStr, null, null);
					// 	if (uritest.schemeIs('file')) {
					// 		deferredMain_xhr.resolve(xhr);
					// 	} else {
					// 		var rejObj = {
					// 			name: 'deferredMain_xhr.promise',
					// 			aReason: 'Load Failed', // didnt even load
					// 			xhr: xhr,
					// 			message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					// 		};
					// 		deferredMain_xhr.reject(rejObj);
					// 	}
					// }

				break;
			case 'abort':
			case 'error':
			case 'timeout':

					// var result_details = {
					// 	reason: ev.type,
					// 	request,
					// 	message: request.statusText + ' [' + ev.type + ':' + request.status + ']'
					// };
					aCallback({request, ok:false, reason:ev.type});

				break;
			default:
				var result_details = {
					reason: 'unknown',
					request,
					message: request.statusText + ' [' + ev.type + ':' + request.status + ']'
				};
				aCallback({request, ok:false, reason:ev.type, result_details});
		}
	};


	var evf = f => ['load', 'error', 'abort', 'timeout'].forEach(f);
	evf(m => request.addEventListener(m, handler, false));

	if (aOptions.onprogress) {
		request.addEventListener('progress', aOptions.onprogress, false);
	}
	if (aOptions.onuploadprogress) {
		request.upload.addEventListener('progress', aOptions.onuploadprogress, false);
	}
	request.open(aOptions.method, aUrlOrFileUri, true); // 3rd arg is false for async

	if (aOptions.headers) {
		for (var h in aOptions.headers) {
			request.setRequestHeader(h, aOptions.headers[h]);
		}
	}

	request.responseType = aOptions.responseType;
	request.send(aOptions.data);

	// console.log('response:', request.response);

	// console.error('done xhr!!!');

}

function setTimeoutSync(aMilliseconds) {
	var breakDate = Date.now() + aMilliseconds;
	while (Date.now() < breakDate) {}
}

// rev1 - _ff-addon-snippet-safedForPlatFS.js - https://gist.github.com/Noitidart/e6dbbe47fbacc06eb4ca
var _safedForPlatFS_pattWIN = /([\\*:?<>|\/\"])/g;
var _safedForPlatFS_pattNIXMAC = /\//g;
function safedForPlatFS(aStr, aOptions={}) {
	// short for getSafedForPlatformFilesystem - meaning after running this on it, you can safely use the return in a filename on this current platform
	// aOptions
	//	repStr - use this string, in place of the default repCharForSafePath in place of non-platform safe characters
	//	allPlatSafe - by default it will return a path safed for the current OS. Set this to true if you want to to get a string that can be used on ALL platforms filesystems. A Windows path is safe on all other platforms

	// set defaults on aOptions
	if (!('allPlatSafe' in aOptions)) {
		aOptions.allPlatSafe = false;
	}
	if (!('repStr' in aOptions)) {
		aOptions.repStr = '-';
	}

	var usePlat = aOptions.allPlatSafe ? 'winnt' : core.os.name; // a windows path is safe in all platforms so force that. IF they dont want all platforms then use the current platform
	switch (usePlat) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				return aStr.replace(_safedForPlatFS_pattWIN, aOptions.repStr);

			break;
		default:

				return aStr.replace(_safedForPlatFS_pattNIXMAC, aOptions.repStr);
	}
}

// https://gist.github.com/Noitidart/7810121036595cdc735de2936a7952da -rev1
function writeThenDir(aPlatPath, aContents, aDirFrom, aOptions={}) {
	// tries to writeAtomic
	// if it fails due to dirs not existing, it creates the dir
	// then writes again
	// if fail again for whatever reason it throws

	var cOptionsDefaults = {
		encoding: 'utf-8',
		noOverwrite: false
		// tmpPath: aPlatPath + '.tmp'
	};

	aOptions = Object.assign(cOptionsDefaults, aOptions);

	var do_write = function() {
		OS.File.writeAtomic(aPlatPath, aContents, aOptions); // doing unixMode:0o4777 here doesn't work, i have to `OS.File.setPermissions(path_toFile, {unixMode:0o4777})` after the file is made
	};

	try {
		do_write();
	} catch (OSFileError) {
		if (OSFileError.becauseNoSuchFile) { // this happens when directories dont exist to it
			OS.File.makeDir(OS.Path.dirname(aPlatPath), {from:aDirFrom});
			do_write(); // if it fails this time it will throw outloud
		} else {
			throw OSFileError;
		}
	}

}

// rev2 - https://gist.github.com/Noitidart/c4ab4ca10ff5861c720b
var jQLike = { // my stand alone jquery like functions
	serialize: function(aSerializeObject, aEncoder=encodeURIComponent) {
		// https://api.jquery.com/serialize/

		// verified this by testing
			// http://www.w3schools.com/jquery/tryit.asp?filename=tryjquery_ajax_serialize
			// http://www.the-art-of-web.com/javascript/escape/

		var serializedStrArr = [];
		for (var cSerializeKey in aSerializeObject) {
			serializedStrArr.push(aEncoder(cSerializeKey) + '=' + aEncoder(aSerializeObject[cSerializeKey]));
		}
		return serializedStrArr.join('&');
	}
};

// rev4 - not yet updated to gist - jun 12 16 - using Object.assign for defaults - https://gist.github.com/Noitidart/e6dbbe47fbacc06eb4ca
var _safedForPlatFS_pattWIN = /([\\*:?<>|\/\"])/g;
var _safedForPlatFS_pattNIXMAC = /[\/:]/g;
function safedForPlatFS(aStr, aOptions={}) {
	// depends on core.os.mname - expects it to be lower case
	// short for getSafedForPlatformFilesystem - meaning after running this on it, you can safely use the return in a filename on this current platform
	// aOptions
	//	repStr - use this string, in place of the default repCharForSafePath in place of non-platform safe characters
	//	allPlatSafe - by default it will return a path safed for the current OS. Set this to true if you want to to get a string that can be used on ALL platforms filesystems. A Windows path is safe on all other platforms

	// 022816 - i added : to _safedForPlatFS_pattNIXMAC because on mac it was replacing it with a `/` which is horrible it will screw up OS.Path.join .split etc

	// set defaults on aOptions
	aOptions = Object.assign({
		allPlatSafe: false,
		repStr: '-'
	}, aOptions)

	var usePlat = aOptions.allPlatSafe ? 'winnt' : core.os.mname; // a windows path is safe in all platforms so force that. IF they dont want all platforms then use the current platform
	switch (usePlat) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				return aStr.replace(_safedForPlatFS_pattWIN, aOptions.repStr);

			break;
		default:

				return aStr.replace(_safedForPlatFS_pattNIXMAC, aOptions.repStr);
	}
}

var _cache_getSystemDirectory = {};
function getSystemDirectory(type) {
	// main entry point that should be used for getting system path. worker, botostrap, etc should call here
	// for each type, guranteed to return a string

	// resolves to string
	// type - string - enum: Videos, Pictures
	var deferredMain_getSystemDirectory = new Deferred();

	if (_cache_getSystemDirectory[type]) {
		deferredMain_getSystemDirectory.resolve(_cache_getSystemDirectory[type]);
	} else {
		const TYPE_ROUTE_BOOTSTRAP = 0;
		const TYPE_ROUTE_ANDROID = 1;
		const TYPE_ROUTE_OS_CONST = 2;
		switch (type) {
			case 'Videos':

					var platform = {
						winnt: { type:'Vids', route:TYPE_ROUTE_BOOTSTRAP },
						darwin: { type:'Mov', route:TYPE_ROUTE_BOOTSTRAP },
						gtk: { type:'XDGVids', route:TYPE_ROUTE_BOOTSTRAP },
						android: { type:'DIRECTORY_MOVIES', route:TYPE_ROUTE_ANDROID }
					};

				break;
			case 'Pictures':

					var platform = {
						winnt: { type:'Pict', route:TYPE_ROUTE_BOOTSTRAP },
						darwin: { type:'Pct', route:TYPE_ROUTE_BOOTSTRAP },
						gtk: { type:'XDGPict', route:TYPE_ROUTE_BOOTSTRAP },
						android: { type:'DIRECTORY_PICTURES', route:TYPE_ROUTE_ANDROID }
					};

				break;
		}

		var { type, route } = platform[core.os.mname];

		switch (route) {
			case TYPE_ROUTE_BOOTSTRAP:
					callInBootstrap('getSystemDirectory_bootstrap', type, function(path) {
						deferredMain_getSystemDirectory.resolve(path);
					});
				break;
			case TYPE_ROUTE_ANDROID:
					deferredMain_getSystemDirectory.resolve(getSystemDirectory_android[type]);
				break;
			case TYPE_ROUTE_OS_CONST:
					deferredMain_getSystemDirectory.resolve(OS.Constants.Path[type]);
				break;
		};
	}

	return deferredMain_getSystemDirectory.promise;
}

function getSystemDirectory_android(type) {
	// progrmatic helper for getSystemDirectory in MainWorker - devuser should NEVER call this himself
	// type - string - currently accepted values
		// DIRECTORY_DOWNLOADS
		// DIRECTORY_MOVIES
		// DIRECTORY_MUSIC
		// DIRECTORY_PICTURES

	// var OSStuff.jenv = null;
	try {
		if (!OSStuff.jenv) {
			OSStuff.jenv = JNI.GetForThread();
		}

		var SIG = {
			Environment: 'Landroid/os/Environment;',
			String: 'Ljava/lang/String;',
			File: 'Ljava/io/File;'
		};

		var Environment = JNI.LoadClass(OSStuff.jenv, SIG.Environment.substr(1, SIG.Environment.length - 2), {
			static_fields: [
				{ name: 'DIRECTORY_DOWNLOADS', sig: SIG.String },
				{ name: 'DIRECTORY_MOVIES', sig: SIG.String },
				{ name: 'DIRECTORY_MUSIC', sig: SIG.String },
				{ name: 'DIRECTORY_PICTURES', sig: SIG.String }
			],
			static_methods: [
				{ name:'getExternalStorageDirectory', sig:'()' + SIG.File }
			]
		});

		var jFile = JNI.LoadClass(OSStuff.jenv, SIG.File.substr(1, SIG.File.length - 2), {
			methods: [
				{ name:'getPath', sig:'()' + SIG.String }
			]
		});

		var OSPath_dirExternalStorage = JNI.ReadString(OSStuff.jenv, Environment.getExternalStorageDirectory().getPath());
		var OSPath_dirname = JNI.ReadString(OSStuff.jenv, Environment[type]);
		var OSPath_dir = OS.Path.join(OSPath_dirExternalStorage, OSPath_dirname);
		console.log('OSPath_dir:', OSPath_dir);

		return OSPath_dir;

	} finally {
		// if (OSStuff.jenv) {
		// 	JNI.UnloadClasses(OSStuff.jenv);
		// }
	}
}
function queryStringAsJson(aQueryString) {
	var asJsonStringify = aQueryString;
	asJsonStringify = asJsonStringify.replace(/&/g, '","');
	asJsonStringify = asJsonStringify.replace(/=/g, '":"');
	asJsonStringify = '{"' + asJsonStringify + '"}';
	asJsonStringify = asJsonStringify.replace(/"(\d+|true|false)"/, function($0, $1) { return $1; });

	return JSON.parse(asJsonStringify);
}
function nonce(length) {
	// generates a nonce
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for(var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
function to_rfc3986(aStr) {
	// https://af-design.com/2008/03/14/rfc-3986-compliant-uri-encoding-in-javascript/
	// i should test with the samples given here - https://dev.twitter.com/oauth/overview/percent-encoding-parameters
	var tmp =  encodeURIComponent(aStr);
	tmp = tmp.replace(/\!/g,'%21');
	tmp = tmp.replace(/\*/g,'%2A');
	tmp = tmp.replace(/\(/g,'%28');
	tmp = tmp.replace(/\)/g,'%29');
	tmp = tmp.replace(/'/g,'%27');
	return tmp;
}
function alphaStrOfObj(aObj, aParseFunc, aJoinStr, aDblQuot) {
	var arr = Object.keys(aObj);
	arr.sort();

	if (!aParseFunc) {
		aParseFunc = function(aToBeParsed) {
			return aToBeParsed;
		};
	}

	for (var i=0; i<arr.length; i++) {
		arr[i] = aParseFunc(arr[i]) + '=' + (aDblQuot ? '"' : '') + aParseFunc(aObj[arr[i]]) + (aDblQuot ? '"' : '');
	}

	return arr.join(aJoinStr);
}
// end - common helper functions
// start - common worker functions
function addOsInfoToCore() {
	// request core.os.toolkit
	// OS.File import

	// add stuff to core
	core.os.name = OS.Constants.Sys.Name.toLowerCase();
	core.os.mname = core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name; // mname stands for modified-name // this will treat solaris, linux, unix, *bsd systems as the same. as they are all gtk based
	// core.os.version
	switch (core.os.name) {
		case 'winnt':
				var version_win = navigator.userAgent.match(/Windows NT (\d+.\d+)/);
				if (version_win) {
					core.os.version = parseFloat(version_win[1]);
					// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
					switch (core.os.version) {
						case 5.1:
						case 5.2:
							core.os.version_name = 'xp';
							break;
						case 6:
							core.os.version_name = 'vista';
							break;
						case 6.1:
							core.os.version_name = '7';
							break;
						case 6.2:
							core.os.version_name = '8';
							break;
						case 6.3:
							core.os.version_name = '8.1';
							break;
						case 10:
							core.os.version_name = '10';
							break;
					}
				}
			break;
		case 'darwin':
				var version_osx = navigator.userAgent.match(/Mac OS X 10\.([\d\.]+)/);
				if (version_osx) {
					var version_osx_str = version_osx[1];
					var ints_split = version_osx[1].split('.');
					if (ints_split.length == 1) {
						core.os.version = parseInt(ints_split[0]);
					} else if (ints_split.length >= 2) {
						core.os.version = ints_split[0] + '.' + ints_split[1];
						if (ints_split.length > 2) {
							core.os.version += ints_split.slice(2).join('');
						}
						core.os.version = parseFloat(core.os.version);
					}
				}
			break;
	}
}
function formatBytes(bytes,decimals) {
   if(bytes == 0) return '0 Byte';
   var k = 1024; // or 1024 for binary
   var dm = decimals + 1 || 3;
   var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
   var i = Math.floor(Math.log(bytes) / Math.log(k));
   return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
function buildOSFileErrorString(aMethod, aOSFileError) { // rev1 - https://gist.github.com/Noitidart/a67dc6c83ae79aeffe5e3123d42d8f65
	// aMethod:string - enum[writeAtomic]

	switch (aMethod) {
		case 'writeAtomic':
				var explain;
				if (aOSFileError.becauseNoSuchFile) {
					explain = formatStringFromName('osfileerror_writeatomic_nosuchfile', 'main');
				} else {
					explain = formatStringFromName('osfileerror_unknownreason', 'main');
				}
				formatStringFromName('osfileerror_' + aMethod, 'app', [explain, aOSFileError.winLastError || aOSFileError.unixErrno])
			break;
	}
}
function base64ArrayBuffer(arrayBuffer) {

// noit - i got this from - http://stackoverflow.com/a/9458996/1828637 - which led me to - https://gist.github.com/958841
// Converts an ArrayBuffer directly to base64, without any intermediate 'convert to string then
// use window.btoa' step. According to my tests, this appears to be a faster approach:
// http://jsperf.com/encoding-xhr-image-data/5

  var base64    = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var bytes         = new Uint8Array(arrayBuffer)
  var byteLength    = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength    = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63               // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
}
function platformFilePathSeperator() {
	// if (!_cache_platformFilePathSeperator) {
	// 	_cache_platformFilePathSeperator = OS.Path.join(' ', ' ').replace(/ /g, '');
	// }
	// return _cache_platformFilePathSeperator;
	return OS.Path.join(' ', ' ').replace(/ /g, '');
}
// end - common worker functions

function getServiceFromCode(servicecode) {
	// exact copy in bootstrap.js, MainWorker.js, app_history.js
	// console.log('getting service from id of:', servicecode);
	for (var a_serviceid in core.nativeshot.services) {
		if (core.nativeshot.services[a_serviceid].code === servicecode) {
			return {
				serviceid: a_serviceid,
				entry: core.nativeshot.services[a_serviceid]
			};
		}
	}
}
