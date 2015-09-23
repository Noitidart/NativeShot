// Imports
const {classes: Cc, interfaces: Ci, utils: Cu, Constructor: CC} = Components;
Cu.import('resource://gre/modules/FileUtils.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Promise.jsm');

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
		},
		cache_key: Math.random()
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase(),
		toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
		xpcomabi: Services.appinfo.XPCOMABI
	},
	firefox: {
		pid: Services.appinfo.processID,
		version: Services.appinfo.version
	}
};

const JETPACK_DIR_BASENAME = 'jetpack';
const OSPath_historyLog = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage', 'history-log.unbracketed.json');
const TWITTER_URL = 'https://twitter.com/';  // var aTweetUrl = TWITTER_URL + permlink.substr(1); // substr(1) avoids the first slash that permlinks start with
const TWITTER_IMG_SUFFIX = ':large';
const IMGUR_DEL_URL_PREFIX = 'https://api.imgur.com/3/image/';
const IMGUR_IMG_URL_PREFIX = 'http://i.imgur.com/'; // var aImgurImgUrl = IMGUR_IMG_URL_PREFIX + imgurImgId + IMGUR_IMG_URL_SUFFIX
const IMGUR_IMG_URL_SUFFIX = '.png';

// link872132154 cross file
const aTypeStrToTypeInt = {
	'imgur-anonymous': 0,
	'twitter': 1,
	'copy': 2,
	'print': 3,
	'save-quick': 4,
	'save-browse': 5,
	'dropbox': 6,
	'tineye': 7,
	'google-images': 8
};
var aTypeIntToTypeStr = {}; // dynamically generated on page load
const biggest_count_should_be_percent = 90; // for skill bars

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb_app_common', function () { return Services.strings.createBundle(core.addon.path.locale + 'app_common.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });
XPCOMUtils.defineLazyGetter(myServices, 'sb_app_main', function () { return Services.strings.createBundle(core.addon.path.locale + 'app_main.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });
XPCOMUtils.defineLazyGetter(myServices, 'sb_dateFormat', function () { return Services.strings.createBundle('chrome://global/locale/dateFormat.properties'); });

// start - addon functionalities

function updateCountsToSkillBars() {
	// after update counts
	var nativeshot_log_counts = {};
	for (var p in aTypeStrToTypeInt) {
		nativeshot_log_counts[aTypeStrToTypeInt[p]] = 0;
	}
	
	// calc sums
	for (var i=0; i<gFileJson.length; i++) {
		if (!(gFileJson[i].t in nativeshot_log_counts)) {
			throw new Error('found a type in the log file, that is not known to the app.js global aTypeStrToTypeInt. the unknown type id is: ' + gFileJson[i].t);
		}
		nativeshot_log_counts[gFileJson[i].t]++;
	}

	// find biggest count
	var nativeshot_biggest_count = 0;
	for (var p in nativeshot_log_counts) {
		if (nativeshot_log_counts[p] > nativeshot_biggest_count) {
			nativeshot_biggest_count = nativeshot_log_counts[p];
		}
	}
	
	console.log('nativeshot_log_counts:', nativeshot_log_counts);
	
		// mod biggest count so its percent obeys biggest_count_should_be_percent
		// alert('biggest count: ' + nativeshot_biggest_count);
		nativeshot_biggest_count = (nativeshot_biggest_count * 100 / biggest_count_should_be_percent);
		// alert('modded biggest count: ' + nativeshot_biggest_count);
		
		 $('.skill-line').each(function(){
			var objel = $(this);

			var cTypeStr = objel.attr('data-nativeshot-category');
			var cTypeInt = aTypeStrToTypeInt[cTypeStr];
			var nativeshot_category = aTypeStrToTypeInt[cTypeStr];
			
			var timer = objel.children('h5');

			timer.countTo({
				from: parseInt(timer.text()),
				to: nativeshot_log_counts[cTypeInt],
				speed: 2000
			});
			
			objel.children('div').css('width', nativeshot_biggest_count == 0 ? 0 : Math.round((nativeshot_log_counts[cTypeInt] / nativeshot_biggest_count)*100) + '%');
		});
};

function getArrElInFileJsonByGettime(aGettime) {
	for (var i=0; i<gFileJson.length; i++) {
		if (gFileJson[i].d == aGettime) {
			return gFileJson[i];
		}
	}
	
	throw new Error('no entry in gFileJson found with .d of ' + aGettime);
}

function getImageURL(aArrEl, nonFileUri) {
	
	switch (aArrEl.t) {
		case aTypeStrToTypeInt['save-quick']:
		case aTypeStrToTypeInt['save-browse']:
				
				if (nonFileUri) {
					return OS.Path.join(aArrEl.f, aArrEl.n);
				} else {
					return OS.Path.toFileURI(OS.Path.join(aArrEl.f, aArrEl.n));
				}
			
			break;
		case aTypeStrToTypeInt['twitter']:
			
				return aArrEl.l + TWITTER_IMG_SUFFIX;
			
			break;
		case aTypeStrToTypeInt['imgur-anonymous']:
			
				return IMGUR_IMG_URL_PREFIX + aArrEl.n + IMGUR_IMG_URL_SUFFIX;
			
			break;
		default:
			throw new Error('this aArrEl.t has no image url, aArrEl.t: ' + aArrEl.t);
	}
	
}

function izoView(aEvent, aGettime) {
	// alert(aEvent);
	// console.info('aEvent:', aEvent);
	if (aEvent.ctrlKey || aEvent.altKey || aEvent.metaKey || aEvent.shiftKey) {
		// let default browse action happen, which is open in new tab focused, new tab background, or new window
	} else {
		// do magnific
		// alert('magnific this: ' + getImageURL(getArrElInFileJsonByGettime(aGettime)));
		// aEvent.stopPropagation(); // if i uncomment this, then the click will not propoagte to document.body which is where i catch the click
		aEvent.preventDefault();
		// aEvent.returnValue = false;
		// return false;
	}
};
function izoCopy(aGettime) {
	var trans = Transferable(Services.wm.getMostRecentWindow('navigator:browser'));
	trans.addDataFlavor('text/unicode');
	var linktxt = getImageURL(getArrElInFileJsonByGettime(aGettime), true);
	
	trans.setTransferData('text/unicode', SupportsString(linktxt), linktxt.length * 2);
	
	Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
};
function izoOpen(aGettime) {
	
	var aArrEl = getArrElInFileJsonByGettime(aGettime);
	switch (aArrEl.t) {
		case aTypeStrToTypeInt['save-quick']:
		case aTypeStrToTypeInt['save-browse']:
			
				showFileInOSExplorer(new FileUtils.File(OS.Path.join(aArrEl.f, aArrEl.n)));
			
			break;
		case aTypeStrToTypeInt['twitter']:
			
				Services.wm.getMostRecentWindow('navigator:browser').gBrowser.loadOneTab(TWITTER_URL + aArrEl.p.substr(1), {
					inBackground: false,
					relatedToCurrent: true
				});
			
			break;
		default:
			throw new Error('this type does not have a open method, aTypeInt: ' + aArrEl.t);
	}
};
function izoDelete(aGettime) {
	// alert('delete on id: ' + aGettime);
	var aArrEl = getArrElInFileJsonByGettime(aGettime);
	switch (aArrEl.t) {
		case aTypeStrToTypeInt['save-quick']:
		case aTypeStrToTypeInt['save-browse']:
			
				var sliptarg = $('div[data-gettime=' + aGettime + ']');
				$('.izotope-container').css('pointer-events', 'none').isotope('remove', sliptarg.closest('.item')[0]).isotope('layout');
				var enablePointerTimer = setTimeout(function() {
					$('.izotope-container').css('pointer-events', '');
					checkIzoNoRez();
				}, 400);
				$('.sliphover-container').remove();

				var promise_moveToRecylingBin = OS.File.remove(getImageURL(aArrEl, true), {ignoreAbsent:false});
				promise_moveToRecylingBin.then(
					function(aVal) {
						console.log('Fullfilled - promise_moveToRecylingBin - ', aVal);
						// start - do stuff here - promise_moveToRecylingBin
						removeEntryOrEntriesFromFileJson(aGettime);
						// end - do stuff here - promise_moveToRecylingBin
					},
					function(aReason) {
						var rejObj = {name:'promise_moveToRecylingBin', aReason:aReason};
						console.error('Rejected - promise_moveToRecylingBin - ', rejObj);
						alert('Failed to delete file from computer, reload the page and try again');
						// deferred_createProfile.reject(rejObj);
					}
				).catch(
					function(aCaught) {
						var rejObj = {name:'promise_moveToRecylingBin', aCaught:aCaught};
						console.error('Caught - promise_moveToRecylingBin - ', rejObj);
						// deferred_createProfile.reject(rejObj);
					}
				);
			
			break;
		case aTypeStrToTypeInt['imgur-anonymous']:
			
				// var rez_conf = confirm(myServices.sb_app_main.GetStringFromName('img-host-anon-imgur_confirm-body'));
				// if (rez_conf) {
						
					var sliptarg = $('div[data-gettime=' + aGettime + ']');
					$('.izotope-container').css('pointer-events', 'none').isotope('remove', sliptarg.closest('.item')[0]).isotope('layout');
					var enablePointerTimer = setTimeout(function() {
						$('.izotope-container').css('pointer-events', '');
					}, 400);
					$('.sliphover-container').remove();
					
					var promise_delOnServ = xhr(IMGUR_DEL_URL_PREFIX + aArrEl.x, {
						aMethod: 'DELETE',
						Headers: {
							Authorization: 'Client-ID fa64a66080ca868'
						},
						aResponseType: 'json'
					});
					promise_delOnServ.then(
						function(aVal) {
							console.log('Fullfilled - promise_delOnServ - ', aVal);
							// start - do stuff here - promise_delOnServ
							if (aVal.response.success) {
								removeEntryOrEntriesFromFileJson(aGettime);
							} else {
								console.error('Failed to delete image from Imgur servers, response received was:', aVal.responseText);
								alert(myServices.sb_app_main.GetStringFromName('img-host-anon-imgur_delete-fail-server-body'));
							}
							// end - do stuff here - promise_delOnServ
						},
						function(aReason) {
							var rejObj = {name:'promise_delOnServ', aReason:aReason};
							console.error('Rejected - promise_delOnServ - ', rejObj);
							// console.error('Failed to connect to Imgur servers, debug object:', aVal);
							alert(myServices.sb_app_main.GetStringFromName('img-host-anon-imgur_delete-fail-connect-body'));
							//deferred_createProfile.reject(rejObj);
						}
					).catch(
						function(aCaught) {
							var rejObj = {name:'promise_delOnServ', aCaught:aCaught};
							console.error('Caught - promise_delOnServ - ', rejObj);
							alert('devleoper you did something stupid check your browser console - this error should never happen in released addon');
							//deferred_createProfile.reject(rejObj);
						}
					);
					
				// }

			break;
		default:
			throw new Error('this type does not have a open method, aTypeInt: ' + aArrEl.t);
	}
};
function izoRemove(aGettime) {
	removeEntryOrEntriesFromFileJson(aGettime);
	var sliptarg = $('div[data-gettime=' + aGettime + ']');
	$('.izotope-container').css('pointer-events', 'none').isotope('remove', sliptarg.closest('.item')[0]).isotope('layout');
	var enablePointerTimer = setTimeout(function() {
		$('.izotope-container').css('pointer-events', '');
		checkIzoNoRez();
	}, 400);
	$('.sliphover-container').remove();
};

function removeEntryOrEntriesFromFileJson(aGettime, aTypeInt) {
	// if provide aTypeInt, all items of that type are removed
	
	if (aGettime !== undefined && aTypeInt !== undefined) {
		throw new Error('must provide either or, not both');
	}
	
	var step1 = function() {
		// update gFileJson
		var promise_readAndParse = readInAndParseFileJson();
		promise_readAndParse.then(
			function(aVal) {
				console.log('Fullfilled - promise_readAndParse - ', aVal);
				// start - do stuff here - promise_readAndParse
				step2();
				// end - do stuff here - promise_readAndParse
			},
			function(aReason) {
				var rejObj = {name:'promise_readAndParse', aReason:aReason};
				console.error('Rejected - promise_readAndParse - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_readAndParse', aCaught:aCaught};
				console.error('Caught - promise_readAndParse - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		);
	};
	
	var step2 = function() {
		if (aGettime !== undefined) {
			// remove first element with aGettime (my assumption is aGettime is unique per element as it is down to the milliseconds) or all elements with aTypeInt
			for (var i=0; i<gFileJson.length; i++) {
				if (gFileJson[i].d == aGettime) {
					gFileJson.splice(i, 1);
					break;
				}
			}
		} else if (aTypeInt !== undefined) {
			// remove ALL elements that have this aTypeInt
			for (var i=gFileJson.length-1; i>=0; i--) {
				if (gFileJson[i].t == aTypeInt) {
					gFileJson.splice(i, 1);
				}
			}			
		} else {
			throw new Error('must provide an argument');
		}
		step3();
	}
	
	var step3 = function() {
		// save to disk
		writeFileJsonToFile();
		
		// update skill bars
		updateCountsToSkillBars();
	}
	
	step1();
}

function templatedDataCaption(aTypeInt, aTitle, aSubtitle, aGettime, aImgSrc) {
	// September 12, 2015 - 7:41 PM
	switch (aTypeInt) {
		case aTypeStrToTypeInt['imgur-anonymous']:
			return "<span class='vertical-align'><h4>" + aTitle + "</h4><span class='pr-sutitle'>" + aSubtitle + "</span><br/><br/><br/><a href='" + aImgSrc + "' class='card-button mag-view' data-card-gettime='" + aGettime + "' onclick='izoView(event, " + aGettime + ")'><span class='fa fa-eye'></span>" + myServices.sb_app_main.GetStringFromName('view') + "</a><a href='#' class='card-button' onclick='izoCopy(" + aGettime + ")'><span class='fa fa-link'></span>" + myServices.sb_app_main.GetStringFromName('copy') + "</a><br/><br/><br/><a href='#' class='card-button' onclick='izoDelete(" + aGettime + ")'><span class='fa fa-remove'></span>" + myServices.sb_app_main.GetStringFromName('delete') + "</a><a href='#' class='card-button' onclick='izoRemove(" + aGettime + ")'><span class='fa fa-history'></span>" + myServices.sb_app_main.GetStringFromName('remove') + "</a></span>";
		case aTypeStrToTypeInt['twitter']:
			return "<span class='vertical-align'><h4>" + aTitle + "</h4><span class='pr-sutitle'>" + aSubtitle + "</span><br/><br/><br/><a href='" + aImgSrc + "' class='card-button mag-view' data-card-gettime='" + aGettime + "' onclick='izoView(event, " + aGettime + ")'><span class='fa fa-eye'></span>" + myServices.sb_app_main.GetStringFromName('view') + "</a><a href='#' class='card-button' onclick='izoCopy(" + aGettime + ")'><span class='fa fa-link'></span>" + myServices.sb_app_main.GetStringFromName('copy') + "</a><br/><br/><br/><a href='#' class='card-button' onclick='izoOpen(" + aGettime + ")'><span class='fa fa-ttttttt'></span>" + myServices.sb_app_main.GetStringFromName('open-tweet') + "</a><a href='#' class='card-button' onclick='izoRemove(" + aGettime + ")'><span class='fa fa-history'></span>" + myServices.sb_app_main.GetStringFromName('remove') + "</a></span>";
		case aTypeStrToTypeInt['save-browse']:
			return "<span class='vertical-align'><h4>" + aTitle + "</h4><span class='pr-sutitle'>" + aSubtitle + "</span><br/><br/><br/><a href='" + aImgSrc + "' class='card-button mag-view' data-card-gettime='" + aGettime + "' onclick='izoView(event, " + aGettime + ")'><span class='fa fa-eye'></span>" + myServices.sb_app_main.GetStringFromName('view') + "</a><a href='#' class='card-button' onclick='izoCopy(" + aGettime + ")'><span class='fa fa-link'></span>" + myServices.sb_app_main.GetStringFromName('copy') + "</a><a href='#' class='card-button' onclick='izoOpen(" + aGettime + ")'><span class='fa fa-folder-open'></span>" + myServices.sb_app_main.GetStringFromName('open') + "</a><br/><br/><br/><a href='#' class='card-button' onclick='izoDelete(" + aGettime + ")'><span class='fa fa-trash'></span>" + myServices.sb_app_main.GetStringFromName('delete') + "</a><a href='#' class='card-button' onclick='izoRemove(" + aGettime + ")'><span class='fa fa-history'></span>" + myServices.sb_app_main.GetStringFromName('remove') + "</a></span>";
		case aTypeStrToTypeInt['save-quick']:
			return "<span class='vertical-align'><h4>" + aTitle + "</h4><span class='pr-sutitle'>" + aSubtitle + "</span><br/><br/><br/><a href='" + aImgSrc + "' class='card-button mag-view' data-card-gettime='" + aGettime + "' onclick='izoView(event, " + aGettime + ")'><span class='fa fa-eye'></span>" + myServices.sb_app_main.GetStringFromName('view') + "</a><a href='#' class='card-button' onclick='izoCopy(" + aGettime + ")'><span class='fa fa-link'></span>" + myServices.sb_app_main.GetStringFromName('copy') + "</a><a href='#' class='card-button' onclick='izoOpen(" + aGettime + ")'><span class='fa fa-folder-open'></span>" + myServices.sb_app_main.GetStringFromName('open') + "</a><br/><br/><br/><a href='#' class='card-button' onclick='izoDelete(" + aGettime + ")'><span class='fa fa-trash'></span>" + myServices.sb_app_main.GetStringFromName('delete') + "</a><a href='#' class='card-button' onclick='izoRemove(" + aGettime + ")'><span class='fa fa-history'></span>" + myServices.sb_app_main.GetStringFromName('remove') + "</a></span>";
		default:
			throw new Error('unrecognized aTypeInt: ' + aTypeInt);
	}
}

// all values in Varitants must be array or obj as it is a pass by reference
var classVariants = {}
classVariants[aTypeStrToTypeInt['imgur-anonymous']] = 'item nativeshot-imgur-anonymous';
classVariants[aTypeStrToTypeInt['twitter']] = 'item nativeshot-twitter';
classVariants[aTypeStrToTypeInt['save-quick']] = 'item nativeshot-save-quick';
classVariants[aTypeStrToTypeInt['save-browse']] = 'item nativeshot-save-browse';


var classREF = {
	class: ''
};
var dataCaptionREF = {
	class: 'det-img ellem',
	'data-caption': '',
	'data-gettime': ''
}
var imgREF = {
	src: 'rawr',
	alt:''
};
var aREF = {
	href:'#'
};
var slipCoverJson = ['html:div', classREF,
						['html:a', aREF],
						['html:div', dataCaptionREF,
							['html:img', imgREF]
						]
					];
					
function matchIsotopeContentsToFileJson(isNotInit) {
	// adds in images that are not in isotope but are in gFileJson
	// removes images that are in isotopte and not in gFileJson
	
	var objOfImagePathsInIsotope = {}; // values are {domEl:, aTypeInt} keys are src's of imgs
	var imageInIsotope = $('.izotope-container img').each(function() {
		var imgSrc = this.getAttribute('src');
		objOfImagePathsInIsotope[imgSrc] = {
			domEl: this
		}
		
		var aTypeInt;
		var domElItem = $(this).closest('.item')[0];
		console.log('domElItem:', domElItem);
		var classList = domElItem.classList; // gets 
		for (var i=0; i<classList.length; i++) {
			if (classList[i].indexOf('nativeshot-') == 0) {
				// console.log('aTypeStr:', classList[i].substr(11));
				aTypeInt = aTypeStrToTypeInt[classList[i].substr(11)]; // 11 is 'nativeshot-'.length
				break;
			}
		}
		
		if (aTypeInt === undefined) {
			throw new Error('unidentified type str found in izotope-container of here is classList:' + classList.join(' '));
		}
		
		objOfImagePathsInIsotope[imgSrc].aTypeInt = aTypeInt;
		objOfImagePathsInIsotope[imgSrc].domElItem = domElItem;
	});
	
	console.log('objOfImagePathsInIsotope:', objOfImagePathsInIsotope);
	
	var imgsAdded = false;
	var imgsRemoved = false;
	
	var ic = document.getElementById('izoc');
	var izotopeContainer = $(ic);
	
	var fileJsonAsIzotopeEls = {}; // key is img src (OS.Path.toFileURI on save-*'s) value is {aTypeInt:, aDataId:int} // holds only things that should have image in the isotope container, like even if copy/print type did have img src it wouldnt be in here
	for (var i=0; i<gFileJson.length; i++) {
		if (!(gFileJson[i].t in aTypeIntToTypeStr)) {
			throw new Error('found a type in the log file, that is not known to the app.js global aTypeStrToTypeInt. the unknown type id is: ' + gFileJson[i].t);
		}
		switch (gFileJson[i].t) {
			case aTypeStrToTypeInt['save-quick']:
			case aTypeStrToTypeInt['save-browse']:
			case aTypeStrToTypeInt['twitter']:
			case aTypeStrToTypeInt['imgur-anonymous']:
						
					if (!(gFileJson[i].t in classVariants)) {
						throw new Error('no mainDivClassVariants for type ' + gFileJson[i].t);
					}
								
					classREF.class = classVariants[gFileJson[i].t];
					var imgDate = new Date(gFileJson[i].d);
					var formattedDate = myServices.sb_dateFormat.GetStringFromName('month.' + (imgDate.getMonth()+1) + '.name') + ' ' + imgDate.getDate() + ', ' + imgDate.getFullYear() + ' - ' + (imgDate.getHours() > 12 ? Math.abs(imgDate.getHours() - 12) : imgDate.getHours()) + ':' + (imgDate.getMinutes() < 10 ? '0' + imgDate.getMinutes() : imgDate.getMinutes()) + ' ' + (imgDate.getHours() < 12 ? 'AM' : 'PM');
					
					dataCaptionREF['data-gettime'] = gFileJson[i].d;
					imgREF.src = getImageURL(gFileJson[i]);
					aREF.href = imgREF.src;
					dataCaptionREF['data-caption'] = templatedDataCaption(gFileJson[i].t, formattedDate, myServices.sb_app_main.GetStringFromName('type' + gFileJson[i].t), gFileJson[i].d, imgREF.src);
					
					
					var foundAlreadyInIzotope = false;
					for (var isotopeImgSrc in objOfImagePathsInIsotope) {
						// go through the gFileJson obj i created
						if (imgREF.src.toLowerCase() == isotopeImgSrc.toLowerCase()) {
							foundAlreadyInIzotope = true;
							break;
						}
					}
					fileJsonAsIzotopeEls[imgREF.src] = {
						aTypeInt: aTypeStrToTypeInt[gFileJson[i].t]
					};
					if (!foundAlreadyInIzotope) {
						imgsAdded = true;
						
						var createdEl = jsonToDOM(slipCoverJson, document, {});
						console.log('createdEl:', createdEl);
						ic.insertBefore(createdEl, ic.firstChild.nextSibling);
						if (isNotInit) {
							izotopeContainer.isotope('addItems', createdEl);
						}
					}
				
				break;
			default:
				// no image for this type in isotope, like copy and print
		}
	}


	console.log('fileJsonAsIzotopeEls:', fileJsonAsIzotopeEls);
	if (isNotInit) {
		// check if need to remove anything, and remove it
		// check if any of the isotope srcs that were present when i started this function, need to not be there (meaning they are not in the fileJsonAsIzotopeEls obj)
		for (var isotopeImgSrc in objOfImagePathsInIsotope) {
			// go through the gFileJson obj i created
			var found = false;
			for (var jsonImgSrc in fileJsonAsIzotopeEls) {
				if (jsonImgSrc.toLowerCase() == isotopeImgSrc.toLowerCase()) {
					found = true;
					break;
				}
			}
			if (!found) {
				console.log('need to remove from isotope this img src:', isotopeImgSrc);
				imgsRemoved = true;
				izotopeContainer.isotope('remove', objOfImagePathsInIsotope[isotopeImgSrc].domElItem);
			}
		}
	}

	if (!isNotInit) {
		izotopeContainer.isotope({
			itemSelector: '.item',
			layoutMode: 'masonry',
			masonry: {
				columnWidth: '.grid-sizer'
			}
		});
		/*
		izotopeContainer.on('layoutComplete', function( event, laidOutItems ) {
			alert('removing pointer events none');
			izotopeContainer.css('pointer-events', '');
		});
		alert('attached on');
		*/
	}
		
	if (imgsAdded || imgsRemoved) {
			// before image loaded, so if imgs were added, we start the layout, and then after imgs loaded it adjusts for proper sizes
			if (isNotInit) {
				// alert('izo reloadingItems');
				izotopeContainer.isotope('reloadItems');
			}
			izotopeContainer.isotope('layout');
			if (imgsAdded) {
				izotopeContainer.imagesLoaded(function() {
					// alert('running layout');
					izotopeContainer.isotope('reloadItems');
					izotopeContainer.isotope();
					checkIzoNoRez(true);
				});
			}
	}
	checkIzoNoRez(true);
	if (!isNotInit) {
		document.getElementById('message_div_izo_none').style.display = ''; // link89454 so on load if none it doesnt do transition
	}
}

var gFileJson;
function readInAndParseFileJson() {
	var deferredMain_readInAndParseFileJson = new Deferred();

	// read the file
	var promise_read = read_encoded(OSPath_historyLog, {encoding:'utf-8'});
	promise_read.then(
		function(aVal) {
			console.log('Fullfilled - promise_read - ', aVal);
			// start - do stuff here - promise_read
			gFileJson = JSON.parse('[' + aVal.substr(1) + ']'); // because its saved as unbracketed with a leading comma
			gFileJson.sort(function(a, b) {
				return a.d > b.d;
			})
			deferredMain_readInAndParseFileJson.resolve();
			// end - do stuff here - promise_read
		},
		function(aReason) {
			var rejObj = {name:'promise_read', aReason:aReason};
			if (aReasonMax(aReason).becauseNoSuchFile) {
				gFileJson = [];
				deferredMain_readInAndParseFileJson.resolve();
			} else {
				console.warn('Rejected - promise_read - ', rejObj);
				deferredMain_readInAndParseFileJson.reject(rejObj);
			}
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_read', aCaught:aCaught};
			console.error('Caught - promise_read - ', rejObj);
			deferredMain_readInAndParseFileJson.reject(rejObj);
		}
	);
	
	return deferredMain_readInAndParseFileJson.promise;
}

function writeFileJsonToFile() {
	var writeTxt = JSON.stringify(gFileJson);
	writeTxt = ',' + writeTxt.substring(1, writeTxt.length-1); // unbracket the array, and lead with comma
	if (writeTxt == ',') {
		writeTxt = ''; // as we dont want to write justa comma
	}
	console.log('writing to file:', writeTxt);
	
	tryOsFile_ifDirsNoExistMakeThenRetry('writeAtomic', [OSPath_historyLog, writeTxt, {
		encoding: 'utf-8',
		tmpPath: OSPath_historyLog + '.tmp'
	}], OS.Constants.Path.profileDir);
}

function izotopeFilter(aTypeStr) {
	
	if (aTypeStr.indexOf('.') == 0) {
		aTypeStr = aTypeStr.substr(12); // 'nativeshot-'.length + 1
		// alert(aTypeStr);
	}
	
	$('#filters .but').each(function() {
		var $th = $(this);
		if (aTypeStr == '*') {
			if ($th.attr('data-filter') == aTypeStr) {
				$th.addClass('activbut');
			} else {
				$th.removeClass('activbut');
			}
		} else {
			if ($th.attr('data-filter') == '.nativeshot-' + aTypeStr) {
				$th.addClass('activbut');
			} else {
				$th.removeClass('activbut');
			}			
		}
	});
	$('.skill-block').each(function() {
		var $th = $(this);
		if (aTypeStr == '*') {
			$th.removeClass('non-filtered-skill');
		} else {
			var cTypeStr = $th.find('.skill-line').attr('data-nativeshot-category');
			if (cTypeStr == aTypeStr) {
				$th.removeClass('non-filtered-skill');
			} else {
				$th.addClass('non-filtered-skill');
			}
		}
	});
	$('.izotope-container').isotope({filter: aTypeStr == '*' ? aTypeStr : '.nativeshot-' + aTypeStr});
	
	checkIzoNoRez();
	
}


function checkIzoNoRez(disallowQuickAnim) {
	if ( !$('.izotope-container').data('isotope').filteredItems.length ) {
		// alert('show none');
		var izo_msg_none = document.getElementById('message_div_izo_none');
		if (izo_msg_none.classList.contains('izo-msg-show')) {
			if (!disallowQuickAnim) {
				var quickAnim = setTimeout(function() {
					izo_msg_none.classList.add('izo-msg-show');
				}, 100);
				izo_msg_none.classList.remove('izo-msg-show');
			}
		} else {
			izo_msg_none.classList.add('izo-msg-show');
		}
	} else {
		// alert('hide none');
		document.getElementById('message_div_izo_none').classList.remove('izo-msg-show');
	}
}

function doOnBlur() {
	attachFocusListener();
}
function doOnFocus() {
	window.removeEventListener('focus', doOnFocus, false);
	readFileAndUpdateGUI(true);
}

function attachFocusListener() {
	window.addEventListener('focus', doOnFocus, false);
}

function readFileAndUpdateGUI(isNotInit) {
	var step1 = function() {
		// read in file and do some set up stuff while its reading
		var promise_bringInFile = readInAndParseFileJson();
		
		// set up stuff
		for (var p in aTypeStrToTypeInt) {
			aTypeIntToTypeStr[aTypeStrToTypeInt[p]] = p;
		}
		// end set up stuff
		
		
		promise_bringInFile.then(
			function(aVal) {
				console.log('Fullfilled - promise_bringInFile - ', aVal);
				// start - do stuff here - promise_bringInFile
				step2();
				// end - do stuff here - promise_bringInFile
			},
			function(aReason) {
				var rejObj = {name:'promise_bringInFile', aReason:aReason};
				console.warn('Rejected - promise_bringInFile - ', rejObj);
				alert('An error occured when trying to read the history, please reload the page');
				// deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_bringInFile', aCaught:aCaught};
				console.error('Caught - promise_bringInFile - ', rejObj);
				// deferred_createProfile.reject(rejObj);
				alert('deverror on history read');
			}
		);
	};
	
	var step2 = function() {
		// from gFileJson update skill bars and add in images to isotope zone
		updateCountsToSkillBars();
		matchIsotopeContentsToFileJson(isNotInit);
	};
	
	step1();
}

var serverMessageListener = {
	receiveMessage: function(aMsg) {
		console.error('DASHBOARD client recieving msg:', 'aMsg:', aMsg);
		if (aMsg.json == 'serverCommand_refreshDashboardGuiFromFile') {
			readFileAndUpdateGUI(true);
		} else {
			console.error('DASHBAORD client unrecognized aMasg:', aMsg);
		}
	}
};

function onPageReady() {
	window.addEventListener('blur', doOnBlur, false);
	
	readFileAndUpdateGUI(false);
	
	// attach message listener
	contentMMFromContentWindow_Method2(window).addMessageListener(core.addon.id, serverMessageListener);
	
	/***********************************/
	/*skill-block click handlers*/
	/**********************************/
	$('.skill-block').on('click', function(event) {
		event.stopPropagation();
		console.log('event:', event);
		var typeStr = $(event.target).closest('.skill-block').find('.skill-line').attr('data-nativeshot-category');
		// alert(['clicked ' + typeStr, 'clicked x:'+event.offsetX,'el left:'+event.target.offsetLeft,'el right:' + (event.target.offsetLeft + event.target.offsetWidth)].join('\n'));
		if (event.offsetX > event.target.offsetLeft + event.target.offsetWidth || event.offsetX < 0) {
			// alert(['clicked pseudo el'].join('\n'));
			// remove all history from log
			switch (typeStr) {
				// link872132154 cross file
				// when add non-iso image stuff, add them here so can reset counts
				case 'print':
				case 'copy':
				case 'tineye':
				case 'google-images':
					removeEntryOrEntriesFromFileJson(undefined, aTypeStrToTypeInt[typeStr]);
					break; // these support remove all
				default:
					// these dont support remove all
			}
		} else {
			// apply filter
			// link872132154 cross file
			switch (typeStr) {
				case 'print':
				case 'copy':
				case 'tineye':
				case 'google-images':
					break; // these arent filterable
				default:
					// $('.izotope-container').isotope({filter: '.nativeshot-' + typeStr});
					izotopeFilter(typeStr);
			}
		}
	})
	/***********************************/
	/*MAGNIFIC POPUP*/
	/**********************************/
	$(document.body).magnificPopup({ // cant do '.izotope-container' here because the click happens on the "view" button in the sliphover which is dynamically added to the body element
		delegate: '.mag-view',
		type: 'image',
		tLoading: '',
		mainClass: 'mfp-with-zoom',
		removalDelay: 500,
		gallery: {
			enabled: false,
			navigateByImgClick: false
		},
		zoom: {
			enabled: true,
			duration: 300,
			easing: 'ease-in-out', 
			opener: function(openerElement) {
			  console.info('openerElement:', openerElement);
			  var aGettime = openerElement[0].getAttribute('data-card-gettime');
			  console.log('aGettime:', '"'+aGettime+'"');
			  var relatedImg = $('.det-img[data-gettime="' + aGettime + '"] img');
			  console.info('relatedImg:', relatedImg);
			  return relatedImg;
			}
		},
		callbacks: {
			imageLoadComplete: function() {
			  var self = this;
			  setTimeout(function() {
				self.wrap.addClass('mfp-image-loaded');
			  }, 16);
			},
			close: function() {
			  this.wrap.removeClass('mfp-image-loaded');
			},
			beforeChange: function() {
				// this.items[0].src = this.items[0].src + '?=' + Math.random(); 
            }
		},
		 closeBtnInside: false,
         closeOnContentClick: true,
         midClick: false
	});
}

// start - common helper functions
function extendCore() {
	// adds some properties i use to core based on the current operating system, it needs a switch, thats why i couldnt put it into the core obj at top
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
	
	console.log('done adding to core, it is now:', core);
}
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

function xhr(aStr, aOptions={}) {
	// update 072615 - added support for aOptions.aMethod
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
	var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

	var handler = ev => {
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

	var evf = f => ['load', 'error', 'abort'].forEach(f);
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
		xhr.open(aOptions.aMethod ? aOptions.aMethod : 'GET', aStr, true);
		do_setHeaders();
		xhr.channel.loadFlags |= aOptions.aLoadFlags;
		xhr.responseType = aOptions.aResponseType;
		xhr.send(null);
	}
	
	return deferredMain_xhr.promise;
}
var txtDecodr; // holds TextDecoder if created
function getTxtDecodr() {
	if (!txtDecodr) {
		txtDecodr = new TextDecoder();
	}
	return txtDecodr;
}
var txtEncodr; // holds TextEncoder if created
function getTxtEncodr() {
	if (!txtEncodr) {
		txtEncodr = new TextEncoder();
	}
	return txtEncodr;
}
function read_encoded(path, options) {
	// because the options.encoding was introduced only in Fx30, this function enables previous Fx to use it
	// must pass encoding to options object, same syntax as OS.File.read >= Fx30
	// TextDecoder must have been imported with Cu.importGlobalProperties(['TextDecoder']);
	
	var deferred_read_encoded = new Deferred();
	
	if (options && !('encoding' in options)) {
		deferred_read_encoded.reject('Must pass encoding in options object, otherwise just use OS.File.read');
		return deferred_read_encoded.promise;
	}
	
	if (options && Services.vc.compare(Services.appinfo.version, 30) < 0) { // tests if version is less then 30
		//var encoding = options.encoding; // looks like i dont need to pass encoding to TextDecoder, not sure though for non-utf-8 though
		delete options.encoding;
	}
	var promise_readIt = OS.File.read(path, options);
	
	promise_readIt.then(
		function(aVal) {
			console.log('Fullfilled - promise_readIt - ', {a:{a:aVal}});
			// start - do stuff here - promise_readIt
			var readStr;
			if (Services.vc.compare(Services.appinfo.version, 30) < 0) { // tests if version is less then 30
				readStr = getTxtDecodr().decode(aVal); // Convert this array to a text
			} else {
				readStr = aVal;
			}
			deferred_read_encoded.resolve(readStr);
			// end - do stuff here - promise_readIt
		},
		function(aReason) {
			var rejObj = {name:'promise_readIt', aReason:aReason};
			console.error('Rejected - promise_readIt - ', rejObj);
			deferred_read_encoded.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_readIt', aCaught:aCaught};
			console.error('Caught - promise_readIt - ', rejObj);
			deferred_read_encoded.reject(rejObj);
		}
	);
	
	return deferred_read_encoded.promise;
}
function tryOsFile_ifDirsNoExistMakeThenRetry(nameOfOsFileFunc, argsOfOsFileFunc, fromDir, aOptions={}) {
	//last update: 061215 0303p - verified worker version didnt have the fix i needed to land here ALSO FIXED so it handles neutering of Fx37 for writeAtomic and I HAD TO implement this fix to worker version, fix was to introduce aOptions.causesNeutering
	// aOptions:
		// causesNeutering - default is false, if you use writeAtomic or another function and use an ArrayBuffer then set this to true, it will ensure directory exists first before trying. if it tries then fails the ArrayBuffer gets neutered and the retry will fail with "invalid arguments"
		
	// i use this with writeAtomic, copy, i havent tested with other things
	// argsOfOsFileFunc is array of args
	// will execute nameOfOsFileFunc with argsOfOsFileFunc, if rejected and reason is directories dont exist, then dirs are made then rexecute the nameOfOsFileFunc
	// i added makeDir as i may want to create a dir with ignoreExisting on final dir as was the case in pickerIconset()
	// returns promise
	
	var deferred_tryOsFile_ifDirsNoExistMakeThenRetry = new Deferred();
	
	if (['writeAtomic', 'copy', 'makeDir'].indexOf(nameOfOsFileFunc) == -1) {
		deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
		// not supported because i need to know the source path so i can get the toDir for makeDir on it
		return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise; //just to exit further execution
	}
	
	// setup retry
	var retryIt = function() {
		console.info('tryosFile_ retryIt', 'nameOfOsFileFunc:', nameOfOsFileFunc, 'argsOfOsFileFunc:', argsOfOsFileFunc);
		var promise_retryAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		promise_retryAttempt.then(
			function(aVal) {
				console.log('Fullfilled - promise_retryAttempt - ', aVal);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('retryAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_retryAttempt', aReason:aReason};
				console.error('Rejected - promise_retryAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_retryAttempt', aCaught:aCaught};
				console.error('Caught - promise_retryAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};
	
	// popToDir
	var toDir;
	var popToDir = function() {
		switch (nameOfOsFileFunc) {
			case 'writeAtomic':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;
				
			case 'copy':
				toDir = OS.Path.dirname(argsOfOsFileFunc[1]);
				break;

			case 'makeDir':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;
				
			default:
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
				return; // to prevent futher execution
		}
	};
	
	// setup recurse make dirs
	var makeDirs = function() {
		if (!toDir) {
			popToDir();
		}
		var promise_makeDirsRecurse = makeDir_Bug934283(toDir, {from: fromDir});
		promise_makeDirsRecurse.then(
			function(aVal) {
				console.log('Fullfilled - promise_makeDirsRecurse - ', aVal);
				retryIt();
			},
			function(aReason) {
				var rejObj = {name:'promise_makeDirsRecurse', aReason:aReason};
				console.error('Rejected - promise_makeDirsRecurse - ', rejObj);
				/*
				if (aReason.becauseNoSuchFile) {
					console.log('make dirs then do retryAttempt');
					makeDirs();
				} else {
					// did not get becauseNoSuchFile, which means the dirs exist (from my testing), so reject with this error
				*/
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				/*
				}
				*/
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDirsRecurse', aCaught:aCaught};
				console.error('Caught - promise_makeDirsRecurse - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	var doInitialAttempt = function() {
		var promise_initialAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		console.info('tryosFile_ initial', 'nameOfOsFileFunc:', nameOfOsFileFunc, 'argsOfOsFileFunc:', argsOfOsFileFunc);
		promise_initialAttempt.then(
			function(aVal) {
				console.log('Fullfilled - promise_initialAttempt - ', aVal);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('initialAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_initialAttempt', aReason:aReason};
				console.error('Rejected - promise_initialAttempt - ', rejObj);
				if (aReason.becauseNoSuchFile) { // this is the flag that gets set to true if parent dir(s) dont exist, i saw this from experience
					console.log('make dirs then do secondAttempt');
					makeDirs();
				} else {
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				}
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initialAttempt', aCaught:aCaught};
				console.error('Caught - promise_initialAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};
	
	if (!aOptions.causesNeutering) {
		doInitialAttempt();
	} else {
		// ensure dir exists, if it doesnt then go to makeDirs
		popToDir();
		var promise_checkDirExistsFirstAsCausesNeutering = OS.File.exists(toDir);
		promise_checkDirExistsFirstAsCausesNeutering.then(
			function(aVal) {
				console.log('Fullfilled - promise_checkDirExistsFirstAsCausesNeutering - ', aVal);
				// start - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
				if (!aVal) {
					makeDirs();
				} else {
					doInitialAttempt(); // this will never fail as we verified this folder exists
				}
				// end - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
			},
			function(aReason) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aReason:aReason};
				console.warn('Rejected - promise_checkDirExistsFirstAsCausesNeutering - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aCaught:aCaught};
				console.error('Caught - promise_checkDirExistsFirstAsCausesNeutering - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		);
	}
	
	
	return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise;
}
function aReasonMax(aReason) {
	var deepestReason = aReason;
	while (deepestReason.hasOwnProperty('aReason') || deepestReason.hasOwnProperty()) {
		if (deepestReason.hasOwnProperty('aReason')) {
			deepestReason = deepestReason.aReason;
		} else if (deepestReason.hasOwnProperty('aCaught')) {
			deepestReason = deepestReason.aCaught;
		}
	}
	return deepestReason;
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
function showFileInOSExplorer(aNsiFile) {
	//http://mxr.mozilla.org/mozilla-release/source/browser/components/downloads/src/DownloadsCommon.jsm#533
	// opens the directory of the aNsiFile
	
	if (aNsiFile.isDirectory()) {
		aNsiFile.launch();
	} else {
		aNsiFile.reveal();
	}
}
const nsTransferable = CC('@mozilla.org/widget/transferable;1', 'nsITransferable');
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
const nsSupportsString = CC('@mozilla.org/supports-string;1', 'nsISupportsString');
function SupportsString(str) {
    // Create an instance of the supports-string class
    var res = nsSupportsString();

    // Store the JavaScript string that we want to wrap in the new nsISupportsString object
    res.data = str;
    return res;
}
var gCFMM;
function contentMMFromContentWindow_Method2(aContentWindow, refreshCache) {
	if (!gCFMM || refreshCache) {
		gCFMM = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIDocShell)
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIContentFrameMessageManager);
	}
	return gCFMM;

}
// end - common helper functions

document.addEventListener('DOMContentLoaded', onPageReady, false);