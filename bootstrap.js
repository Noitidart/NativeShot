// Imports
const {classes: Cc, interfaces: Ci, utils: Cu, Constructor: CC} = Components;
Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
Cu.import('resource://gre/modules/ctypes.jsm'); // needed for GTK+
const {TextDecoder, TextEncoder, OS} = Cu.import('resource://gre/modules/osfile.jsm', {});
Cu.import('resource://gre/modules/Promise.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.importGlobalProperties(['btoa']);

// Globals
const core = {
	addon: {
		name: 'NativeShot',
		id: 'NativeShot@jetpack',
		path: {
			name: 'nativeshot',
			content: 'chrome://nativeshot/content/',
			locale: 'chrome://nativeshot/locale/',
			resources: 'chrome://nativeshot/content/resources/',
			images: 'chrome://nativeshot/content/resources/images/'
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	}
};

var PromiseWorker;
var bootstrap = this;
var OSStuff = {};
const NS_HTML = 'http://www.w3.org/1999/xhtml';
const cui_cssUri = Services.io.newURI(core.addon.path.resources + 'cui.css', null, null);
var collCanMonInfos;

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'as', function () { return Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService) });
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'global.properties?' + Math.random()); /* Randomize URI to work around bug 719376 */ });

function extendCore() {
	// adds some properties i use to core
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			core.os.version = parseFloat(Services.sysinfo.getProperty('version'));
			// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
			if (core.os.version == 6.0) {
				core.os.version_name = 'vista';
			}
			if (core.os.version >= 6.1) {
				core.os.version_name = '7+';
			}
			if (core.os.version == 5.1 || core.os.version == 5.2) { // 5.2 is 64bit xp
				core.os.version_name = 'xp';
			}
			break;
			
		case 'darwin':
			var userAgent = myServices.hph.userAgent;
			//console.info('userAgent:', userAgent);
			var version_osx = userAgent.match(/Mac OS X 10\.([\d\.]+)/);
			//console.info('version_osx matched:', version_osx);
			
			if (!version_osx) {
				throw new Error('Could not identify Mac OS X version.');
			} else {
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
				// this makes it so that 10.10.0 becomes 10.100
				// 10.10.1 => 10.101
				// so can compare numerically, as 10.100 is less then 10.101
				
				//core.os.version = 6.9; // note: debug: temporarily forcing mac to be 10.6 so we can test kqueue
			}
			break;
		default:
			// nothing special
	}
	
	core.os.toolkit = Services.appinfo.widgetToolkit.toLowerCase();
	core.os.xpcomabi = Services.appinfo.XPCOMABI;
	
	core.firefox = {};
	core.firefox.version = Services.appinfo.version;
	
	console.log('done adding to core, it is now:', core);
}

//start obs stuff
var observers = {
	'nativeshot-editor-loaded': { // this trick detects actual load of iframe from bootstrap scope
		observe: function (aSubject, aTopic, aData) {
			obsHandler_nativeshotEditorLoaded(aSubject, aTopic, aData);
		},
		reg: function () {
			Services.obs.addObserver(observers['nativeshot-editor-loaded'], core.addon.id + '_nativeshot-editor-loaded', false);
		},
		unreg: function () {
			Services.obs.removeObserver(observers['nativeshot-editor-loaded'], core.addon.id + '_nativeshot-editor-loaded');
		}
	}
};
//end obs stuff

// START - Addon Functionalities
// start - observer handlers
var collEditorDOMWindows = [];
function obsHandler_nativeshotEditorLoaded(aSubject, aTopic, aData) {
			console.error('yeaaa loaddded');
			
			var aEditorDOMWindow;
			var aEditorFound = false;
			
			for (var i=0; i<collEditorDOMWindows.length; i++) {
				aEditorDOMWindow = collEditorDOMWindows[i].get();
				if (!aEditorDOMWindow || aEditorDOMWindow.closed) {
					collEditorDOMWindows.splice(i, 1);
					continue;
				}
				if (aEditorDOMWindow.document.readyState == 'complete') {
					var collMonInfosIndex = parseInt(aEditorDOMWindow.location.search.substr('?collMonInfosIndex='.length));
					console.log('this path just loaded, collMonInfosIndex:', collMonInfosIndex);
					collEditorDOMWindows.splice(i, 1);
					aEditorFound = true;
					break;
				}
			}		
	
			if (!aEditorFound) {
				console.error('WARNNNNING could not find editor dom window');
				return;
			}
			
			var aHwndStr = aEditorDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
							.getInterface(Ci.nsIWebNavigation)
							.QueryInterface(Ci.nsIDocShellTreeItem)
							.treeOwner
							.QueryInterface(Ci.nsIInterfaceRequestor)
							.getInterface(Ci.nsIBaseWindow)
							.nativeHandle;
			
			var postStuff = function() {
				
				var w = collMonInfos[collMonInfosIndex].w;
				var h = collMonInfos[collMonInfosIndex].h;
				var doc = aEditorDOMWindow.document;
				
				var json = 
				[
					'xul:stack', {id:'stack'},
						['html:canvas', {id:'canBase',width:w,height:h,style:'display:-moz-box;cursor:crosshair;display:-moz-box;#000 url(' + core.addon.path.images + 'canvas_bg.png) repeat fixed top left'}],
						['html:canvas', {id:'canDim',width:w,height:h,style:'display:-moz-box;cursor:crosshair;'}]
				];
				
				var elRef = {};
				doc.documentElement.appendChild(jsonToDOM(json, doc, elRef));
				
				var ctxBase = elRef.canBase.getContext('2d');
				var ctxDim = elRef.canDim.getContext('2d');
				
				ctxDim.fillStyle = 'rgba(0,0,0,.6)';
				ctxDim.fillRect(0, 0, w, h);
				
				switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
					case 'winnt':
					case 'winmo':
					case 'wince':
							
							ctxBase.putImageData(collMonInfos[collMonInfosIndex].screenshot, 0, 0);
							
						break;
					case 'gtk':

							ctxBase.putImageData(collMonInfos[0].screenshot, 200, collMonInfos[collMonInfosIndex].y);
							
						break;
					
					case 'darwin':
						
							
						
						break;
					default:
						console.error('os not supported');
				}
				
				
			};
			
			switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
				case 'winnt':
				case 'winmo':
				case 'wince':
						
						aEditorDOMWindow.document.documentElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
						aEditorDOMWindow.moveTo(collMonInfos[collMonInfosIndex].x, collMonInfos[collMonInfosIndex].y);
						//aEditorDOMWindow.resizeTo(fullWidth, fullHeight);
						
						aEditorDOMWindow.focus();
						aEditorDOMWindow.fullScreen = true;
						
						postStuff();
						
					break;
				case 'gtk':

						var doc = aEditorDOMWindow.document;			
						var can = doc.createElementNS(NS_HTML, 'canvas');
						var ctx = can.getContext('2d');
						
						aEditorDOMWindow.document.documentElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
						aEditorDOMWindow.moveTo(collMonInfos[collMonInfosIndex].x, collMonInfos[collMonInfosIndex].y);
						//aEditorDOMWindow.resizeTo(fullWidth, fullHeight);
						
						aEditorDOMWindow.focus();
						aEditorDOMWindow.fullScreen = true;
						
						postStuff();
						
					break;
				
				case 'darwin':
					
						
					
					break;
				default:
					console.error('os not supported');
			}
			
			return; // :debug:
			
			var postStuff = function() {
				can.style.background = 'display:-moz-box;#000 url(' + core.addon.path.images + 'canvas_bg.png) repeat fixed top left'
				//doc.documentElement.appendChild(can); // this is larger then set widht and height and it just busts through, interesting, when i had set openWindow feature width and height to 100 each it wouldnt constrain this, weird

				var json = 
				[
					'xul:stack', {id:'stack'},
						['html:canvas', {id:'canDim',width:can.width,height:can.height,style:'display:-moz-box;cursor:crosshair;'}],
						['xul:box', {id:'divTools',style:'border:1px dashed #ccc;left:0;top:0;width:1px;height:1px;display:block;position:fixed;'}]
				];

				var el = {};
				doc.documentElement.appendChild(jsonToDOM(json, doc, el));
				el.stack.insertBefore(can, el.stack.firstChild);
				
				var ctxDim = el.canDim.getContext('2d');
				ctxDim.fillStyle = 'rgba(0,0,0,.6)';
				ctxDim.fillRect(0, 0, can.width, can.height);
				
				// event handlers - the reason i dont do this in the panel.xul file or import a .js file into is because i want the panel and canvas drawing to show asap, then worry about attaching js stuff. otherwise it will wait to load js file then trigger load.
				var win = aEditorDOMWindow;
				
				var md_x; //mousedowned x pos
				var md_y; //mousedowned y pos
				var mousemove = function(e) {
					var mm_x = e.layerX;
					var mm_y = e.layerY;
					var calc_x = (mm_x - md_x);
					var calc_y = (mm_y - md_y);
					
					if (calc_x < 0) {
						el.divTools.style.left = (md_x - Math.abs(calc_x)) + 'px';
					} else {
						el.divTools.style.left = md_x + 'px';
					}
					if (calc_y < 0) {
						el.divTools.style.top = (md_y - Math.abs(calc_y)) + 'px';
					} else {
						el.divTools.style.top = md_y + 'px';
					}
					el.divTools.style.width =  Math.abs(calc_x) + 'px';
					el.divTools.style.height = Math.abs(calc_y) + 'px';
					
					ctxDim.clearRect(0, 0, can.width, can.height);
					ctxDim.fillRect(0, 0, can.width, can.height);
					ctxDim.clearRect(parseInt(el.divTools.style.left)+1, parseInt(el.divTools.style.top)+1, parseInt(el.divTools.style.width)-1, parseInt(el.divTools.style.height)-1);
				};
				
				var inSelecting;
				win.addEventListener('mousedown', function(e) {
					if (e.button != 0) {
						return;
					}
					if (e.target.id != 'canDim') {
						return;
					}
					console.info('mousedown', 'e:', e);
					inSelecting = true;
					ctxDim.clearRect(0, 0, can.width, can.height);
					ctxDim.fillStyle = 'rgba(0,0,0,.6)';
					ctxDim.fillRect(0, 0, can.width, can.height);
					el.divTools.style.pointerEvents = 'none';
					md_x = e.layerX;
					md_y = e.layerY;
					el.divTools.style.left = md_x + 'px';
					el.divTools.style.top = md_y + 'px';
					el.divTools.style.width = '1px';
					el.divTools.style.height = '1px';
					win.addEventListener('mousemove', mousemove, false);
				});
				
				win.addEventListener('mouseup', function(e) {
					if (!inSelecting) {
						return;
					}
					inSelecting = false;
					console.info('mouseup', 'e:', e);
					win.removeEventListener('mousemove', mousemove, false);
					el.divTools.style.pointerEvents = '';
				});
				
				var menuJson = 
					['xul:popupset', {},
						['xul:menupopup', {id: 'myMenu1'},
							['xul:menuitem', {label:'Close', oncommand:function(){win.close()}}],
							['xul:menuseparator', {}],
							['xul:menuitem', {label:'Save to File (preset dir & name pattern)', oncommand:function(){ editorSaveToFile(win) }}],
							['xul:menuitem', {label:'Save to File (file picker dir and name)', oncommand:function(){ editorSaveToFile(win, true) }}],
							['xul:menuitem', {label:'Copy to Clipboard', oncommand:function(){ editorCopyImageToClipboard(win) }}],
							['xul:menu', {label:'Upload to Cloud Drive (click this for last used host)'},
								['xul:menupopup', {},
									['xul:menuitem', {label:'Amazon Cloud Drive'}],
									['xul:menuitem', {label:'Box'}],
									['xul:menuitem', {label:'Copy by Barracuda Networks'}],
									['xul:menuitem', {label:'Dropbox'}],
									['xul:menuitem', {label:'Google Drive'}],
									['xul:menuitem', {label:'MEGA'}],
									['xul:menuitem', {label:'OneDrive (aka SkyDrive)'}]
								]
							],
							['xul:menu', {label:'Upload to Image Host with My Account (click this for last used host)'},
								['xul:menupopup', {},
									['xul:menuitem', {label:'Flickr'}],
									['xul:menuitem', {label:'Image Shack'}],
									['xul:menuitem', {label:'Imgur'}],
									['xul:menuitem', {label:'Photobucket'}]
								]
							],
							['xul:menu', {label:'Upload to Image Host as Anonymous (click this for last used host)'},
								['xul:menupopup', {},
									['xul:menuitem', {label:'FreeImageHosting.net'}],
									['xul:menuitem', {label:'Imgur', oncommand:function(){ editorUploadToImgurAnon(win) }}],
								]
							],
							['xul:menu', {label:'Share to Social Media'},
								['xul:menupopup', {},
									['xul:menuitem', {label:'Facebook'}],
									['xul:menuitem', {label:'Twitter'}]
								]
							],
							['xul:menuitem', {label:'Print Image'}],
							['xul:menuseparator', {}],
							['xul:menu', {label:'Selection to Monitor', onclick:'alert(\'clicked main level menu item so will select current monitor\')'},
								['xul:menupopup', {},
									['xul:menuitem', {label:'Current Monitor'}],
									['xul:menuitem', {label:'All Monitors'}],
									['xul:menuitem', {label:'Monitor 1'}],
									['xul:menuitem', {label:'Monitor 2'}]
								]
							],
							['xul:menu', {label:'Selection to Application Window'},
								['xul:menupopup', {},
									['xul:menuitem', {label:'Running App 1', onclick:'alert(\'seletion around window 1\')'}],
									['xul:menu', {label:'Running App 2', onclick:'alert(\'seletion around window 1\')'},
										['xul:menupopup', {},
											['xul:menuitem', {label:'Window 1'}],
											['xul:menuitem', {label:'Window 2'}],
											['xul:menuitem', {label:'Window 3'}]
										]
									],
									['xul:menuitem', {label:'Running App 3', onclick:'alert(\'seletion around window 1\')'}]
								]
							]
						]
					];

				doc.documentElement.appendChild(jsonToDOM(menuJson, doc, el));
				doc.documentElement.setAttribute('context', 'myMenu1');
				
				console.timeEnd('mainthread');
				console.timeEnd('takeShot');
			};
			
			switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
				case 'winnt':
				case 'winmo':
				case 'wince':
						
						var topLeftMostX = 0;
						var topLeftMostY = 0;
						var fullWidth = 0;
						var fullHeight = 0;
						for (var s=0; s<collCanMonInfos.length; s++) {
							fullWidth += collCanMonInfos[s].nWidth;
							fullHeight += collCanMonInfos[s].nHeight;
							
							if (collCanMonInfos[s].yTopLeft < topLeftMostY) {
								topLeftMostY = collCanMonInfos[s].yTopLeft;
							}
							if (collCanMonInfos[s].xTopLeft < topLeftMostX) {
								topLeftMostX = collCanMonInfos[s].xTopLeft;
							}
						}

						console.info('topLeftMostX:', topLeftMostX, 'topLeftMostY:', topLeftMostY, 'fullWidth:', fullWidth, 'fullHeight:', fullHeight, '_END_');

						can.width = fullWidth; // just a note from left over stuff, i can do collCanMonInfos[s].idat.width now but this tells me some stuff: cannot do `collCanMonInfos.width` because DIB widths are by 4's so it might have padding, so have to use real width
						can.height = fullHeight;

						for (var s=0; s<collCanMonInfos.length; s++) {
							ctx.putImageData(collCanMonInfos[s].idat, collCanMonInfos[s].xTopLeft + Math.abs(topLeftMostX), collCanMonInfos[s].yTopLeft + Math.abs(topLeftMostY));
						}

						collCanMonInfos = null;
						
						aEditorDOMWindow.moveTo(topLeftMostX, topLeftMostY);
						aEditorDOMWindow.resizeTo(fullWidth, fullHeight);
						
						var aHwndStr = aEditorDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIWebNavigation)
										.QueryInterface(Ci.nsIDocShellTreeItem)
										.treeOwner
										.QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIBaseWindow)
										.nativeHandle;
						
						var promise_makeWinFullAllMon = MainWorker.post('makeWinFullAllMon', [aHwndStr, {
							fullWidth: fullWidth,
							fullHeight: fullHeight,
							topLeftMostX: topLeftMostX,
							topLeftMostY: topLeftMostY
						}]);
						promise_makeWinFullAllMon.then(
							function(aVal) {
								console.log('Fullfilled - promise_makeWinFullAllMon - ', aVal);
								// start - do stuff here - promise_makeWinFullAllMon

								// end - do stuff here - promise_makeWinFullAllMon
							},
							function(aReason) {
								var rejObj = {name:'promise_makeWinFullAllMon', aReason:aReason};
								console.error('Rejected - promise_makeWinFullAllMon - ', rejObj);
								//deferred_createProfile.reject(rejObj);
							}
						).catch(
							function(aCaught) {
								var rejObj = {name:'promise_makeWinFullAllMon', aCaught:aCaught};
								console.error('Caught - promise_makeWinFullAllMon - ', rejObj);
								//deferred_createProfile.reject(rejObj);
							}
						);
						
						postStuff();
						
					break;
				case 'gtk':

						var aHwndStr = aEditorDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIWebNavigation)
										.QueryInterface(Ci.nsIDocShellTreeItem)
										.treeOwner
										.QueryInterface(Ci.nsIInterfaceRequestor)
										.getInterface(Ci.nsIBaseWindow)
										.nativeHandle;



						
						var promise_makeWinFullAllMon = MainWorker.post('makeWinFullAllMon', [aHwndStr, {
							fullWidth: collCanMonInfos[0].nWidth,
							fullHeight: collCanMonInfos[0].nHeight
						}]);
						promise_makeWinFullAllMon.then(
							function(aVal) {
								console.log('Fullfilled - promise_makeWinFullAllMon - ', aVal);
								// start - do stuff here - promise_makeWinFullAllMon

								can.width = collCanMonInfos[0].nWidth;
								can.height = collCanMonInfos[0].nHeight;
								
								ctx.putImageData(collCanMonInfos[0].idat, 0, 0);
								//aEditorDOMWindow.fullScreen = true;
								
								
								aEditorDOMWindow.moveTo(collCanMonInfos[0].xTopLeft, collCanMonInfos[0].yTopLeft);
								aEditorDOMWindow.resizeTo(collCanMonInfos[0].nWidth, collCanMonInfos[0].nHeight);
								
								var ctypesGTK = get_gtk_ctypes();
								
								ctypesGTK.gtk_window_present(ctypesGTK.gdkWinPtrToGtkWinPtr(ctypesGTK.TYPE.GdkWindow.ptr(ctypes.UInt64(aHwndStr))));
								console.error('did do gtk_window_present from mainthread succesfully!! from thread this would crash instantly');
								
								collCanMonInfos = null;
								
								postStuff();

								// end - do stuff here - promise_makeWinFullAllMon
							},
							function(aReason) {
								var rejObj = {name:'promise_makeWinFullAllMon', aReason:aReason};
								console.error('Rejected - promise_makeWinFullAllMon - ', rejObj);
								//deferred_createProfile.reject(rejObj);
							}
						).catch(
							function(aCaught) {
								var rejObj = {name:'promise_makeWinFullAllMon', aCaught:aCaught};
								console.error('Caught - promise_makeWinFullAllMon - ', rejObj);
								//deferred_createProfile.reject(rejObj);
							}
						);
						
					break;
				
				case 'darwin':
					
						
					
					break;
				default:
					console.error('os not supported');
			}
			
}
// end - observer handlers
// start - editor functions
function editorSaveToFile(aEditorDOMWindow, showFilePicker) {
	// start - common to all editor functions
	var owin = Services.wm.getMostRecentWindow('navigator:browser');
	/*
	var ws = Services.wm.getEnumerator(null);
	while (var w = ws.getNext()) {
		if (w.documentElement.getAttribute('windowtype') != 'nativeshot:editor') {
			owin = w;
		}
	}
	*/
	if (!owin) { throw new Error('could not find other then this editor window') }
	var odoc = owin.document;

	var win = aEditorDOMWindow;
	var doc = win.document;
	
	var can = odoc.createElementNS(NS_HTML, 'canvas');
	var ctx = can.getContext('2d');
	
	var divTools = doc.getElementById('divTools');
	
	can.width = parseInt(divTools.style.width);
	can.height = parseInt(divTools.style.height);
	
	var baseCan = doc.querySelector('canvas');
	
	ctx.drawImage(baseCan, parseInt(divTools.style.left), parseInt(divTools.style.top), can.width, can.height, 0, 0, can.width, can.height);
	win.close();
	// end - common to all editor functions
	
	/*
	can.style.position = 'fixed'; // :debug:
	can.style.left = '2000px'; // :debug:
	can.style.top = '1300px'; // :debug:
	
	doc.documentElement.appendChild(can); // :debug:
	*/
	var OSPath_save;
	var do_saveCanToDisk = function() {
		(can.toBlobHD || can.toBlob).call(can, function(b) {
			var r = Cc['@mozilla.org/files/filereader;1'].createInstance(Ci.nsIDOMFileReader); //new FileReader();
			r.onloadend = function() {
				// r.result contains the ArrayBuffer.
				var promise_saveToDisk = OS.File.writeAtomic(OSPath_save, new Uint8Array(r.result), { tmpPath: OSPath_save + '.tmp' });
				promise_saveToDisk.then(
					function(aVal) {
						console.log('Fullfilled - promise_saveToDisk - ', aVal);
						// start - do stuff here - promise_saveToDisk
						var trans = Transferable(owin);
						trans.addDataFlavor('text/unicode');
						// We multiply the length of the string by 2, since it's stored in 2-byte UTF-16 format internally.
						trans.setTransferData('text/unicode', SupportsString(OSPath_save), OSPath_save.length * 2);
						
						Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
						
						myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', core.addon.name + ' - ' + 'File Path Copied', 'Screenshot was successfully saved and file path was copied to clipboard');
						// end - do stuff here - promise_saveToDisk
					},
					function(aReason) {
						var rejObj = {name:'promise_saveToDisk', aReason:aReason};
						console.error('Rejected - promise_saveToDisk - ', rejObj);
						myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', core.addon.name + ' - ' + 'Error', 'Screenshot failed to save to disk, see browser console for more details');
						//deferred_createProfile.reject(rejObj);
					}
				).catch(
					function(aCaught) {
						var rejObj = {name:'promise_saveToDisk', aCaught:aCaught};
						console.error('Caught - promise_saveToDisk - ', rejObj);
						myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', core.addon.name + ' - ' + 'CATCH', 'developer error stupid');
						//deferred_createProfile.reject(rejObj);
					}
				);
			};
			r.readAsArrayBuffer(b);
		}, 'image/png');
	}
	
	if (!showFilePicker) {
		// get save path
		var OSPath_saveDir;
		try {
			OSPath_saveDir = Services.dirsvc.get('XDGPict', Ci.nsIFile).path;
		} catch (ex) {
			console.warn('ex:', ex);
			try {
				OSPath_saveDir = Services.dirsvc.get('Pict', Ci.nsIFile).path;
			} catch (ex) {
				console.warn('ex:', ex);
				OSPath_saveDir = OS.Constants.Path.desktopDir;
			}
		}
		
		// generate file name
		var filename = 'Screenshot - ' + getSafedForOSPath(new Date().toLocaleFormat()) + '.png';
		OSPath_save = OS.Path.join(OSPath_saveDir, filename);
		
		do_saveCanToDisk();
	} else {
		var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
		fp.init(owin, 'Save Screenshot', Ci.nsIFilePicker.modeSave);
		fp.appendFilter('PNG Image', '*.png');
		
		var rv = fp.show();
		if (rv != Ci.nsIFilePicker.returnOK) { return } // user canceled
		
		OSPath_save = fp.file.path.trim();
		
		if (!/^.*\.png/i.test(OSPath_save)) {
			OSPath_save += '.png';
		}
		do_saveCanToDisk();
	}
	
}

function editorCopyImageToClipboard(aEditorDOMWindow) {
	// start - common to all editor functions
	var owin = Services.wm.getMostRecentWindow('navigator:browser');
	/*
	var ws = Services.wm.getEnumerator(null);
	while (var w = ws.getNext()) {
		if (w.documentElement.getAttribute('windowtype') != 'nativeshot:editor') {
			owin = w;
		}
	}
	*/
	if (!owin) { throw new Error('could not find other then this editor window') }
	var odoc = owin.document;

	var win = aEditorDOMWindow;
	var doc = win.document;
	
	var can = odoc.createElementNS(NS_HTML, 'canvas');
	var ctx = can.getContext('2d');
	
	var divTools = doc.getElementById('divTools');
	
	can.width = parseInt(divTools.style.width);
	can.height = parseInt(divTools.style.height);
	
	var baseCan = doc.querySelector('canvas');
	
	ctx.drawImage(baseCan, parseInt(divTools.style.left), parseInt(divTools.style.top), can.width, can.height, 0, 0, can.width, can.height);
	win.close();
	// end - common to all editor functions
    
	// based on:
		// mostly: https://github.com/mxOBS/deb-pkg_icedove/blob/8f8955df7c9db605cf6903711dcbfc6dd7776e50/mozilla/toolkit/devtools/gcli/commands/screenshot.js#L161
		// somewhat on: https://github.com/dadler/thumbnail-zoom/blob/76a6edded0ca4ef1eb76d4c1b2bc363b433cde63/src/resources/clipboardService.js#L78-L209
		
	var data = can.toDataURL('image/png', '')
	var channel = Services.io.newChannel(data, null, null);
	var input = channel.open();
	var imgTools = Cc['@mozilla.org/image/tools;1'].getService(Ci.imgITools);
	
	var container = {};
	imgTools.decodeImageData(input, channel.contentType, container);

	var wrapped = Cc['@mozilla.org/supports-interface-pointer;1'].createInstance(Ci.nsISupportsInterfacePointer);
	wrapped.data = container.value;
	
	var trans = Transferable(owin);
	console.info('channel.contentType:', channel.contentType);
	trans.addDataFlavor(channel.contentType);
	
	trans.setTransferData(channel.contentType, wrapped, -1);
	
	Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
	
	/* to consider
		// have to first set imageURL = createBlob
      
       // Also put the image's html <img> tag on the clipboard.  This is 
       // important (at least on OSX): if we copy just jpg image data,
       // programs like Photoshop and Thunderbird seem to receive it as
       // uncompressed png data, which is very large, bloating emails and
       // causing randomly truncated data.  But if we also include a
       // text/html flavor referring to the jpg image on the Internet, 
       // those programs retrieve the image directly as the original jpg
       // data, so there is no data bloat.
      
      var str = Components.classes['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
      if (str) {
        str.data = '<img src="' + imageURL + '" />';
        trans.addDataFlavor('text/html');
        trans.setTransferData('text/html', str, str.data.length * 2);
      }    
	*/
	
	owin.setTimeout(function() {
		myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', core.addon.name + ' - ' + 'Image Copied', 'Screenshot was successfully copied to the clipboard');
	}, 100);

}
function editorUploadToImgurAnon(aEditorDOMWindow) {
	// start - common to all editor functions
	var owin = Services.wm.getMostRecentWindow('navigator:browser');
	/*
	var ws = Services.wm.getEnumerator(null);
	while (var w = ws.getNext()) {
		if (w.documentElement.getAttribute('windowtype') != 'nativeshot:editor') {
			owin = w;
		}
	}
	*/
	if (!owin) { throw new Error('could not find other then this editor window') }
	var odoc = owin.document;

	var win = aEditorDOMWindow;
	var doc = win.document;
	
	var can = odoc.createElementNS(NS_HTML, 'canvas');
	var ctx = can.getContext('2d');
	
	var divTools = doc.getElementById('divTools');
	
	can.width = parseInt(divTools.style.width);
	can.height = parseInt(divTools.style.height);
	
	var baseCan = doc.querySelector('canvas');
	
	ctx.drawImage(baseCan, parseInt(divTools.style.left), parseInt(divTools.style.top), can.width, can.height, 0, 0, can.width, can.height);
	win.close();
	// end - common to all editor functions
    
	// based on:
		// mostly: https://github.com/mxOBS/deb-pkg_icedove/blob/8f8955df7c9db605cf6903711dcbfc6dd7776e50/mozilla/toolkit/devtools/gcli/commands/screenshot.js#L161
		// somewhat on: https://github.com/dadler/thumbnail-zoom/blob/76a6edded0ca4ef1eb76d4c1b2bc363b433cde63/src/resources/clipboardService.js#L78-L209
		
	var data = can.toDataURL('image/png'); // returns `data:image/png;base64,iVBORw.....`
	console.info('base64 data pre trim:', data);
	data = data.substr('data:image/png;base64,'.length); // imgur wants without this
	
	console.info('base64 data:', data);
	var promise_uploadAnonImgur = xhr('https://api.imgur.com/3/upload', {
		aPostData: {
			image: data, // this gets encodeURIComponent'ed by my xhr function
			type: 'base64'
		},
		Headers: {
			Authorization: 'Client-ID fa64a66080ca868',
			'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' // if i dont do this, then by default Content-Type is `text/plain; charset=UTF-8` and it fails saying `aReason.xhr.response.data.error == 'Image format not supported, or image is corrupt.'` and i get `aReason.xhr.status == 400`
		},
		aResponseType: 'json'
	});
	
	promise_uploadAnonImgur.then(
		function(aVal) {
			console.log('Fullfilled - promise_uploadAnonImgur - ', aVal);
			// start - do stuff here - promise_uploadAnonImgur
			var imgUrl = aVal.response.data.link;
			var deleteHash = aVal.response.data.deletehash; // at time of this writing jul 13 2015 the delete link is `'http://imgur.com/delete/' + deleteHash` (ie: http://imgur.com/delete/AxXkaRTpZILspsh)
			var imgId = aVal.response.data.id;
			
			var trans = Transferable(owin);
			trans.addDataFlavor('text/unicode');
			// We multiply the length of the string by 2, since it's stored in 2-byte UTF-16 format internally.
			trans.setTransferData('text/unicode', SupportsString(imgUrl), imgUrl.length * 2);
			
			Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
			
			// save to upload history - only for anonymous uploads to imgur, so can delete in future
			var OSPath_history = OS.Path.join(OS.Constants.Path.desktopDir, 'imgur-history.txt'); // creates file if it wasnt there
			OS.File.open(OSPath_history, {write: true, append: true}).then(valOpen => {
				var txtToAppend = ',"' + imgId + '":"' + deleteHash + '"';
				var txtEncoded = getTxtEncodr().encode(txtToAppend);
				valOpen.write(txtEncoded).then(valWrite => {
					console.log('valWrite:', valWrite);
					valOpen.close().then(valClose => {
						console.log('valClose:', valClose);
						console.log('successfully appended');
					});
				});
			});
			
			myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', core.addon.name + ' - ' + 'Image Uploaded', 'Upload to Imgur was successful and image link was copied to the clipboard');
			
			// end - do stuff here - promise_uploadAnonImgur
		},
		function(aReason) {
			var rejObj = {name:'promise_uploadAnonImgur', aReason:aReason};
			console.error('Rejected - promise_uploadAnonImgur - ', rejObj);
			myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', core.addon.name + ' - ' + 'Upload Failed', 'Upload to Imgur failed, see Browser Console for details');
			//deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_uploadAnonImgur', aCaught:aCaught};
			console.error('Caught - promise_uploadAnonImgur - ', rejObj);
			//deferred_createProfile.reject(rejObj);
			myServices.as.showAlertNotification(core.addon.path.images + 'icon48.png', core.addon.name + ' - ' + 'Upload Failed', 'Upload to Imgur failed, see Browser Console for details');
		}
	);

}
// end - editor functions
var _cache_get_gtk_ctypes; // {lib:theLib, declared:theFunc, TYPE:types}
function get_gtk_ctypes() {
	if (!_cache_get_gtk_ctypes) {
		_cache_get_gtk_ctypes = {
			lib: ctypes.open('libgdk-x11-2.0.so.0'),
			libGtk2: ctypes.open('libgtk-x11-2.0.so.0'),
			TYPE: {
				GdkColormap: ctypes.StructType('GdkColormap'),
				GdkDrawable: ctypes.StructType('GdkDrawable'),
				GdkWindow: ctypes.StructType('GdkWindow'),
				GdkPixbuf: ctypes.StructType('GdkPixbuf'),
				gpointer: ctypes.void_t.ptr,
				GtkWindow: ctypes.StructType('GtkWindow'),
				int: ctypes.int,
				void: ctypes.void_t
			}
		};
		_cache_get_gtk_ctypes.gdk_pixbuf_get_from_drawable = _cache_get_gtk_ctypes.lib.declare('gdk_pixbuf_get_from_drawable', ctypes.default_abi,
			_cache_get_gtk_ctypes.TYPE.GdkPixbuf.ptr,	// return
			_cache_get_gtk_ctypes.TYPE.GdkPixbuf.ptr,	// *dest
			_cache_get_gtk_ctypes.TYPE.GdkDrawable.ptr,	// *src
			_cache_get_gtk_ctypes.TYPE.GdkColormap.ptr,	// *cmap
			_cache_get_gtk_ctypes.TYPE.int,				// src_x
			_cache_get_gtk_ctypes.TYPE.int,				// src_y
			_cache_get_gtk_ctypes.TYPE.int,				// dest_x
			_cache_get_gtk_ctypes.TYPE.int,				// dest_y
			_cache_get_gtk_ctypes.TYPE.int,				// width
			_cache_get_gtk_ctypes.TYPE.int				// height
		);
		_cache_get_gtk_ctypes.gtk_window_present = _cache_get_gtk_ctypes.libGtk2.declare('gtk_window_present', ctypes.default_abi,
			_cache_get_gtk_ctypes.TYPE.void.ptr,		// return
			_cache_get_gtk_ctypes.TYPE.GtkWindow.ptr	// *window
		);
		_cache_get_gtk_ctypes.gdk_window_get_user_data = _cache_get_gtk_ctypes.lib.declare('gdk_window_get_user_data', ctypes.default_abi,
				_cache_get_gtk_ctypes.TYPE.void,				// return
				_cache_get_gtk_ctypes.TYPE.GdkWindow.ptr,	// *window
				_cache_get_gtk_ctypes.TYPE.gpointer.ptr		// *data
		);
		_cache_get_gtk_ctypes.gdkWinPtrToGtkWinPtr = function(aGDKWindowPtr) {
			var gptr = _cache_get_gtk_ctypes.TYPE.gpointer();
			_cache_get_gtk_ctypes.gdk_window_get_user_data(aGDKWindowPtr, gptr.address());
			var GtkWinPtr = ctypes.cast(gptr, _cache_get_gtk_ctypes.TYPE.GtkWindow.ptr);
			return GtkWinPtr;
		};
	}
	return _cache_get_gtk_ctypes;
}

function takeShot(aDOMWin) {
	console.log('taking shot');
	
	console.time('takeShot');
	
	var do_drawToCanvas = function(aVal) {
		// aVal is of form `ImageData { width: 1024, height: 1280, data: Uint8ClampedArray[5242880] }`
		console.timeEnd('chromeworker');
		console.time('mainthread');
		
		collCanMonInfos = aVal;
		
		switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
			case 'winnt':
			case 'winmo':
			case 'wince':
				
					
				
				break;
			case 'gtk':
				
					
				
				break;
			
			case 'darwin':
				
					
				
				break;
			default:
				console.error('os not supported');
		}

		for (var i=0; i<collCanMonInfos.length; i++) {
			var aEditorDOMWindow = Services.ww.openWindow(null, core.addon.path.content + 'panel.xul?mon=' + i, '_blank', 'chrome,width=1,height=1,screenX=1,screenY=1', null);
			collEditorDOMWindows.push(Cu.getWeakReference(aEditorDOMWindow));
			console.info('aEditorDOMWindow:', aEditorDOMWindow);
		}
		
		/*
		var xulwin = aEditorDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
						.getInterface(Ci.nsIWebNavigation)
						.QueryInterface(Ci.nsIDocShellTreeItem)
						.treeOwner
						.QueryInterface(Ci.nsIInterfaceRequestor)
						.getInterface(Ci.nsIXULWindow);
		Services.appShell.unregisterTopLevelWindow(xulwin);
		*/
	};
	
	if (core.os.toolkit.indexOf('gtk') == 0) {
		var ctypesGTK = get_gtk_ctypes();
		var do_gtkMainThreadStart = function(aVal) {
			var rootGdkDrawable = ctypesGTK.TYPE.GdkDrawable.ptr(ctypes.UInt64(aVal.rootGdkDrawable_strPtr));
			console.info('rootGdkDrawable:', rootGdkDrawable, 'x_orig:', aVal.x_orig, 'y_orig:', aVal.y_orig, 'width:', aVal.width, 'height:', aVal.height, '_END_');
			var screenshot = ctypesGTK.gdk_pixbuf_get_from_drawable(null, rootGdkDrawable, null, aVal.x_orig, aVal.y_orig, 0, 0, aVal.width, aVal.height);
			if (ctypes.errno != 11) {
				console.error('Failed gdk_pixbuf_get_from_drawable, errno:', ctypes.errno);
				throw new Error({
					name: 'os-api-error',
					message: 'Failed gdk_pixbuf_get_from_drawable, errno: "' + ctypes.errno + '" and : "' + rootGdkDrawable.toString(),
					errno: ctypes.errno
				});
			}
						
			ctypesGTK.screenshot = screenshot;
			
			var screenshot_ptrStr = screenshot.toString().match(/.*"(.*?)"/)[1];
			ctypesGTK.screenshot_ptrStr = screenshot_ptrStr;
			
			console.info('screenshot:', screenshot.toString(), 'screenshot_ptrStr:', screenshot_ptrStr);
			
			do_gtkMainThreadFinish(screenshot_ptrStr);
		};
		
		var do_gtkMainThreadFinish = function(aVal) {
			var promise_shootSectGtkWrapUp = MainWorker.post('shootMon', [1, {
				doGtkWrapUp: true,
				screenshot_ptrStr: aVal
			}]);
			promise_shootSectGtkWrapUp.then(
				function(aVal) {
					console.log('Fullfilled - promise_shootSectGtkWrapUp - ', aVal);
					// start - do stuff here - promise_shootSectGtkWrapUp
					// aVal is of form `ImageData { width: 1024, height: 1280, data: Uint8ClampedArray[5242880] }`
					delete ctypesGTK.screenshot;
					delete ctypesGTK.screenshot_ptrStr;
					do_drawToCanvas(aVal);
					// end - do stuff here - promise_shootSectGtkWrapUp
				},
				function(aReason) {
					var rejObj = {name:'promise_shootSectGtkWrapUp', aReason:aReason};
					console.error('Rejected - promise_shootSectGtkWrapUp - ', rejObj);
					Services.prompt.alert(aDOMWin, 'NativeShot - Exception', 'An exception occured while taking screenshot, see Browser Console for more information');
					//deferred_createProfile.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promise_shootSectGtkWrapUp', aCaught:aCaught};
					console.error('Caught - promise_shootSectGtkWrapUp - ', rejObj);
					//deferred_createProfile.reject(rejObj);
					Services.prompt.alert(aDOMWin, 'NativeShot - Error', 'An error occured while taking screenshot, see Browser Console for more information');
				}
			);
		};
	}
	
	console.time('chromeworker');
	var promise_shootSect = MainWorker.post('shootMon', [1]);
	promise_shootSect.then(
		function(aVal) {
			console.log('Fullfilled - promise_shootSect - ', aVal);
			// start - do stuff here - promise_shootSect
			if (core.os.toolkit.indexOf('gtk') == 0) {
				do_gtkMainThreadStart(aVal);
			} else {
				// aVal is of form `ImageData { width: 1024, height: 1280, data: Uint8ClampedArray[5242880] }`
				do_drawToCanvas(aVal);
			}
			// end - do stuff here - promise_shootSect
		},
		function(aReason) {
			var rejObj = {name:'promise_shootSect', aReason:aReason};
			console.warn('Rejected - promise_shootSect - ', rejObj);
			Services.prompt.alert(aDOMWin, 'NativeShot - Exception', 'An exception occured while taking screenshot, see Browser Console for more information');
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_shootSect', aCaught:aCaught};
			console.error('Caught - promise_shootSect - ', rejObj);
			Services.prompt.alert(aDOMWin, 'NativeShot - Error', 'An error occured while taking screenshot, see Browser Console for more information');
		}
	);	
	
}

var collMonInfos;
function shootAllMons(aDOMWindow) {
	
	var openWindowOnEachMon = function() {
		for (var i=0; i<collMonInfos.length; i++) {
			var aEditorDOMWindow = Services.ww.openWindow(null, core.addon.path.content + 'panel.xul?collMonInfosIndex=' + i, '_blank', 'chrome,width=1,height=1,screenX=1,screenY=1', null);
			collEditorDOMWindows.push(Cu.getWeakReference(aEditorDOMWindow));
			console.info('aEditorDOMWindow:', aEditorDOMWindow);
		}
	};
	
	var promise_shoot = MainWorker.post('shootAllMons', []);
	promise_shoot.then(
		function(aVal) {
			console.log('Fullfilled - promise_shoot - ', aVal);
			// start - do stuff here - promise_shoot
			collMonInfos = aVal;
			openWindowOnEachMon();
			// end - do stuff here - promise_shoot
		},
		function(aReason) {
			var rejObj = {name:'promise_shoot', aReason:aReason};
			console.warn('Rejected - promise_shoot - ', rejObj);
			Services.prompt.alert(aDOMWindow, 'NativeShot - Exception', 'An exception occured while taking screenshot, see Browser Console for more information');
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_shoot', aCaught:aCaught};
			console.error('Caught - promise_shoot - ', rejObj);
			Services.prompt.alert(aDOMWindow, 'NativeShot - Error', 'An error occured while taking screenshot, see Browser Console for more information');
		}
	);
}

// END - Addon Functionalities
// start - clipboard boilerplate
// Create a constructor for the built-in supports-string class.
const nsSupportsString = CC("@mozilla.org/supports-string;1", "nsISupportsString");
function SupportsString(str) {
    // Create an instance of the supports-string class
    var res = nsSupportsString();

    // Store the JavaScript string that we want to wrap in the new nsISupportsString object
    res.data = str;
    return res;
}

// Create a constructor for the built-in transferable class
const nsTransferable = CC("@mozilla.org/widget/transferable;1", "nsITransferable");

// Create a wrapper to construct an nsITransferable instance and set its source to the given window, when necessary
function Transferable(source) {
    var res = nsTransferable();
    if ('init' in res) {
        // When passed a Window object, find a suitable privacy context for it.
        if (source instanceof Ci.nsIDOMWindow) {
            // Note: in Gecko versions >16, you can import the PrivateBrowsingUtils.jsm module
            // and use PrivateBrowsingUtils.privacyContextFromWindow(sourceWindow) instead
            source = source.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
		}
		
        res.init(source);
    }
    return res;
}
// end - clipboard boilerplate
/*start - windowlistener*/
var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {
		
		// Load into any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				windowListener.loadIntoWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					windowListener.loadIntoWindow(aDOMWindow);
				}, false);
			}
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		/*
		for (var u in unloaders) {
			unloaders[u]();
		}
		*/
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.loadSheet(cui_cssUri, domWinUtils.AUTHOR_SHEET);
		}
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.removeSheet(cui_cssUri, domWinUtils.AUTHOR_SHEET);
		}
	}
};
/*end - windowlistener*/

function install() {}
function uninstall() {}

function startup(aData, aReason) {
	core.addon.aData = aData;
	extendCore();
	
	PromiseWorker = Cu.import(core.addon.path.content + 'modules/PromiseWorker.jsm').BasePromiseWorker;
	
	var promise_getMainWorker = SIPWorker('MainWorker', core.addon.path.content + 'modules/workers/MainWorker.js');
	promise_getMainWorker.then(
		function(aVal) {
			console.log('Fullfilled - promise_getMainWorker - ', aVal);
			// start - do stuff here - promise_getMainWorker
			// end - do stuff here - promise_getMainWorker
		},
		function(aReason) {
			var rejObj = {
				name: 'promise_getMainWorker',
				aReason: aReason
			};
			console.warn('Rejected - promise_getMainWorker - ', rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {
				name: 'promise_getMainWorker',
				aCaught: aCaught
			};
			console.error('Caught - promise_getMainWorker - ', rejObj);
		}
	);
	
	CustomizableUI.createWidget({
		id: 'cui_nativeshot',
		defaultArea: CustomizableUI.AREA_NAVBAR,
		label: myServices.sb.GetStringFromName('cui_nativeshot_lbl'),
		tooltiptext: myServices.sb.GetStringFromName('cui_nativeshot_tip'),
		onCommand: function(aEvent) {
			var aDOMWin = aEvent.target.ownerDocument.defaultView;
			if (aEvent.shiftKey == 1) {
				// default time delay queue
				aDOMWin.setTimeout(function() {
					shootAllMons(aDOMWin);
				}, 5000);
			} else {
				// imemdiate freeze
				shootAllMons(aDOMWin);
			}
		}
	});
	
	//windowlistener more
	windowListener.register();
	//end windowlistener more
	
	//start observers stuff more
	for (var o in observers) {
		observers[o].reg();
	}
	//end observers stuff more
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }
	
	CustomizableUI.destroyWidget('cui_nativeshot');
	
	//windowlistener more
	windowListener.unregister();
	//end windowlistener more
	
	//start observers stuff more
	for (var o in observers) {
		observers[o].unreg();
	}
	//end observers stuff more
	
	Cu.unload(core.addon.path.content + 'modules/PromiseWorker.jsm');
	
	if (_cache_get_gtk_ctypes) { // for GTK+
		_cache_get_gtk_ctypes.lib.close();
	}
}

// start - common helper functions
function Deferred() {
	if (Promise && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (PromiseUtils && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else if (Promise) {
		try {
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
		} catch (ex) {
			console.error('Promise not available!', ex);
			throw new Error('Promise not available!');
		}
	} else {
		throw new Error('Promise not available!');
	}
}

function SIPWorker(workerScopeName, aPath, aCore=core) {
	// "Start and Initialize PromiseWorker"
	// returns promise
		// resolve value: jsBool true
	// aCore is what you want aCore to be populated with
	// aPath is something like `core.addon.path.content + 'modules/workers/blah-blah.js'`
	
	// :todo: add support and detection for regular ChromeWorker // maybe? cuz if i do then ill need to do ChromeWorker with callback
	
	var deferredMain_SIPWorker = new Deferred();

	if (!(workerScopeName in bootstrap)) {
		bootstrap[workerScopeName] = new PromiseWorker(aPath);
		
		if ('addon' in aCore && 'aData' in aCore.addon) {
			delete aCore.addon.aData; // we delete this because it has nsIFile and other crap it, but maybe in future if I need this I can try JSON.stringify'ing it
		}
		
		var promise_initWorker = bootstrap[workerScopeName].post('init', [aCore]);
		promise_initWorker.then(
			function(aVal) {
				console.log('Fullfilled - promise_initWorker - ', aVal);
				// start - do stuff here - promise_initWorker
				deferredMain_SIPWorker.resolve(true);
				// end - do stuff here - promise_initWorker
			},
			function(aReason) {
				var rejObj = {name:'promise_initWorker', aReason:aReason};
				console.warn('Rejected - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initWorker', aCaught:aCaught};
				console.error('Caught - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		);
		
	} else {
		deferredMain_SIPWorker.reject('Something is loaded into bootstrap[workerScopeName] already');
	}
	
	return deferredMain_SIPWorker.promise;
	
}
function jsonToDOM(json, doc, nodes) {

    var namespaces = {
        html: 'http://www.w3.org/1999/xhtml',
        xul: 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
    };
    var defaultNamespace = namespaces.html;

    function namespace(name) {
        var m = /^(?:(.*):)?(.*)$/.exec(name);        
        return [namespaces[m[1]], m[2]];
    }

    function tag(name, attr) {
        if (Array.isArray(name)) {
            var frag = doc.createDocumentFragment();
            Array.forEach(arguments, function (arg) {
                if (!Array.isArray(arg[0]))
                    frag.appendChild(tag.apply(null, arg));
                else
                    arg.forEach(function (arg) {
                        frag.appendChild(tag.apply(null, arg));
                    });
            });
            return frag;
        }

        var args = Array.slice(arguments, 2);
        var vals = namespace(name);
        var elem = doc.createElementNS(vals[0] || defaultNamespace, vals[1]);

        for (var key in attr) {
            var val = attr[key];
            if (nodes && key == 'id')
                nodes[val] = elem;

            vals = namespace(key);
            if (typeof val == 'function')
                elem.addEventListener(key.replace(/^on/, ''), val, false);
            else
                elem.setAttributeNS(vals[0] || '', vals[1], val);
        }
        args.forEach(function(e) {
            try {
                elem.appendChild(
                                    Object.prototype.toString.call(e) == '[object Array]'
                                    ?
                                        tag.apply(null, e)
                                    :
                                        e instanceof doc.defaultView.Node
                                        ?
                                            e
                                        :
                                            doc.createTextNode(e)
                                );
            } catch (ex) {
                elem.appendChild(doc.createTextNode(ex));
            }
        });
        return elem;
    }
    return tag.apply(null, json);
}
var _getSafedForOSPath_pattWIN = /([\\*:?<>|\/\"])/g;
var _getSafedForOSPath_pattNIXMAC = /\//g;
const repCharForSafePath = '-';
function getSafedForOSPath(aStr, useNonDefaultRepChar) {
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
		
				return aStr.replace(_getSafedForOSPath_pattWIN, useNonDefaultRepChar ? useNonDefaultRepChar : repCharForSafePath);
				
			break;
		default:
		
				return aStr.replace(_getSafedForOSPath_pattNIXMAC, useNonDefaultRepChar ? useNonDefaultRepChar : repCharForSafePath);
	}
}
function xhr(aStr, aOptions={}) {
	// currently only setup to support GET and POST
	// does an async request
	// aStr is either a string of a FileURI such as `OS.Path.toFileURI(OS.Path.join(OS.Constants.Path.desktopDir, 'test.png'));` or a URL such as `http://github.com/wet-boew/wet-boew/archive/master.zip`
	// Returns a promise
		// resolves with xhr object
		// rejects with object holding property "xhr" which holds the xhr object
	
	/*** aOptions
	{
		aLoadFlags: flags, // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/NsIRequest#Constants
		aTiemout: integer (ms)
		isBackgroundReq: boolean, // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Non-standard_properties
		aResponseType: string, // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Browser_Compatibility
		aPostData: string
	}
	*/
	
	var aOptions_DEFAULT = {
		aLoadFlags: Ci.nsIRequest.LOAD_ANONYMOUS | Ci.nsIRequest.LOAD_BYPASS_CACHE | Ci.nsIRequest.INHIBIT_PERSISTENT_CACHING,
		aPostData: null,
		aResponseType: 'text',
		isBackgroundReq: true, // If true, no load group is associated with the request, and security dialogs are prevented from being shown to the user
		aTimeout: 0, // 0 means never timeout, value is in milliseconds
		Headers: null
	}
	
	for (var opt in aOptions_DEFAULT) {
		if (!(opt in aOptions)) {
			aOptions[opt] = aOptions_DEFAULT[opt];
		}
	}
	
	// Note: When using XMLHttpRequest to access a file:// URL the request.status is not properly set to 200 to indicate success. In such cases, request.readyState == 4, request.status == 0 and request.response will evaluate to true.
	
	var deferredMain_xhr = new Deferred();
	console.log('here222');
	let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

	let handler = ev => {
		evf(m => xhr.removeEventListener(m, handler, !1));

		switch (ev.type) {
			case 'load':
			
					if (xhr.readyState == 4) {
						if (xhr.status == 200) {
							deferredMain_xhr.resolve(xhr);
						} else {
							var rejObj = {
								name: 'deferredMain_xhr.promise',
								aReason: 'Load Not Success', // loaded but status is not success status
								xhr: xhr,
								message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
							};
							deferredMain_xhr.reject(rejObj);
						}
					} else if (xhr.readyState == 0) {
						var uritest = Services.io.newURI(aStr, null, null);
						if (uritest.schemeIs('file')) {
							deferredMain_xhr.resolve(xhr);
						} else {
							var rejObj = {
								name: 'deferredMain_xhr.promise',
								aReason: 'Load Failed', // didnt even load
								xhr: xhr,
								message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
							};
							deferredMain_xhr.reject(rejObj);
						}
					}
					
				break;
			case 'abort':
			case 'error':
			case 'timeout':
				
					var rejObj = {
						name: 'deferredMain_xhr.promise',
						aReason: ev.type[0].toUpperCase() + ev.type.substr(1),
						xhr: xhr,
						message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					};
					deferredMain_xhr.reject(rejObj);
				
				break;
			default:
				var rejObj = {
					name: 'deferredMain_xhr.promise',
					aReason: 'Unknown',
					xhr: xhr,
					message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
				};
				deferredMain_xhr.reject(rejObj);
		}
	};

	let evf = f => ['load', 'error', 'abort'].forEach(f);
	evf(m => xhr.addEventListener(m, handler, false));

	if (aOptions.isBackgroundReq) {
		xhr.mozBackgroundRequest = true;
	}
	
	if (aOptions.aTimeout) {
		xhr.timeout
	}
	
	var do_setHeaders = function() {
		if (aOptions.Headers) {
			for (var h in aOptions.Headers) {
				xhr.setRequestHeader(h, aOptions.Headers[h]);
			}
		}
	};
	
	if (aOptions.aPostData) {
		xhr.open('POST', aStr, true);
		do_setHeaders();
		xhr.channel.loadFlags |= aOptions.aLoadFlags;
		xhr.responseType = aOptions.aResponseType;
		
		/*
		var aFormData = Cc['@mozilla.org/files/formdata;1'].createInstance(Ci.nsIDOMFormData);
		for (var pd in aOptions.aPostData) {
			aFormData.append(pd, aOptions.aPostData[pd]);
		}
		xhr.send(aFormData);
		*/
		var aPostStr = [];
		for (var pd in aOptions.aPostData) {
			aPostStr.push(pd + '=' + encodeURIComponent(aOptions.aPostData[pd])); // :todo: figure out if should encodeURIComponent `pd` also figure out if encodeURIComponent is the right way to do this
		}
		console.info('aPostStr:', aPostStr.join('&'));
		xhr.send(aPostStr.join('&'));
	} else {
		xhr.open('GET', aStr, true);
		do_setHeaders();
		xhr.channel.loadFlags |= aOptions.aLoadFlags;
		xhr.responseType = aOptions.aResponseType;
		xhr.send(null);
	}
	
	return deferredMain_xhr.promise;
}
var txtEncodr; // holds TextDecoder if created
function getTxtEncodr() {
	if (!txtEncodr) {
		txtEncodr = new TextEncoder();
	}
	return txtEncodr;
}
// end - common helper functions