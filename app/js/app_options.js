// Imports
const {classes: Cc, interfaces: Ci, utils: Cu, Constructor: CC, results: Cr} = Components;
Cu.import('resource://gre/modules/AddonManager.jsm');
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
var gAngScope;
// var gAngInjector;
const myPrefBranch = 'extensions.' + core.addon.id + '.';

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb_app_common', function () { return Services.strings.createBundle(core.addon.path.locale + 'app_common.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });
XPCOMUtils.defineLazyGetter(myServices, 'sb_app_options', function () { return Services.strings.createBundle(core.addon.path.locale + 'app_options.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });
XPCOMUtils.defineLazyGetter(myServices, 'sb_dateFormat', function () { return Services.strings.createBundle('chrome://global/locale/dateFormat.properties'); });

// start - addon functionalities

var	ANG_APP = angular.module('nativeshot_options', [])
	.controller('BodyController', ['$scope', function($scope) {
		
		var MODULE = this;
		
		var gAngBody = angular.element(document.body);
		gAngScope = gAngBody.scope();
		// gAngInjector = gAngBody.injector();
		
		MODULE.version = 'rawr';
		MODULE.last_updated = 'boo';
		
		var quick_save_dir = getPref('quick_save_dir');
		
		MODULE.prefs = {
			autoUpdateDefault: true,
			auto_update: 2, // 0 off, 1 default, 2 on
			quick_save_dir_dirname: null,
			quick_save_dir_basename: OS.Path.basename(quick_save_dir),
			print_preview: getPref('print_preview')
		};
		MODULE.prefs.quick_save_dir_dirname = quick_save_dir.substr(0, quick_save_dir.lastIndexOf(MODULE.prefs.quick_save_dir_basename));
		fetchAddon_v_lu_au();
		MODULE.BrowseSelectDir = function(aArgName) {
			var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
			fp.init(Services.wm.getMostRecentWindow('navigator:browser'), 'Pick directory the icon container file should be saved in', Ci.nsIFilePicker.modeGetFolder);
			// fp.appendFilters(Ci.nsIFilePicker.filterAll);

			var rv = fp.show();
			if (rv == Ci.nsIFilePicker.returnOK) {
				
				MODULE[aArgName] = fp.file.path;

			}// else { // cancelled	}
		};
	}]);

function updateNg_v_lu_au() {
	// from _cache_fetchAddon_v_lu_au, devuser should never call this, devuser should call fetchAddon_v_lu_au with true/false for refreshCache
	gAngScope.BC.version = _cache_fetchAddon_v_lu_au.version;
	var getTime = _cache_fetchAddon_v_lu_au.last_updated;
	var formattedDate = myServices.sb_dateFormat.GetStringFromName('month.' + (getTime.getMonth()+1) + '.name') + ' ' + getTime.getDate() + ', ' + getTime.getFullYear();
	gAngScope.BC.last_updated = formattedDate;

	gAngScope.BC.prefs.auto_update = _cache_fetchAddon_v_lu_au.auto_update;
	gAngScope.BC.prefs.autoUpdateDefault = _cache_fetchAddon_v_lu_au.autoUpdateDefault;
	gAngScope.$digest();
}

function setAutoUpdateOn() {
	if (_cache_fetchAddon_v_lu_au.autoUpdateDefault) {
		console.log('default is on, so set to default');
		_cache_gAddon.applyBackgroundUpdates = 1; // set it to default as default is on
		_cache_fetchAddon_v_lu_au.auto_update = 1;
	} else {
		console.log('set to on');
		_cache_gAddon.applyBackgroundUpdates = 2;
		_cache_fetchAddon_v_lu_au.auto_update = 2;
	}
	fetchAddon_v_lu_au();
}

function setAutoUpdateOff() {
	_cache_fetchAddon_v_lu_au.autoUpdateDefault = AddonManager.autoUpdateDefault;
	if (!_cache_fetchAddon_v_lu_au.autoUpdateDefault) {
		console.log('default is off, so set to default');
		_cache_gAddon.applyBackgroundUpdates = 1; // set it to default as default is off
		_cache_fetchAddon_v_lu_au.auto_update = 1;
	} else {
		console.log('set to off');
		_cache_gAddon.applyBackgroundUpdates = 0;
		_cache_fetchAddon_v_lu_au.auto_update = 0;
	}
	fetchAddon_v_lu_au();
}

var _cache_fetchAddon_v_lu_au;
var _cache_gAddon;
function fetchAddon_v_lu_au(refreshCache) {
	// fetches addon details of verison, last update, and autoupdate
	// runs updateNg_v_lu_au
	if (!_cache_fetchAddon_v_lu_au || refreshCache) {
		_cache_fetchAddon_v_lu_au = {};
		AddonManager.getAddonByID(core.addon.id, function(addon) {
			_cache_gAddon = addon;
			_cache_fetchAddon_v_lu_au.version = addon.version;
			_cache_fetchAddon_v_lu_au.last_updated = addon.updateDate;
			_cache_fetchAddon_v_lu_au.auto_update = parseInt(addon.applyBackgroundUpdates);
			_cache_fetchAddon_v_lu_au.autoUpdateDefault = AddonManager.autoUpdateDefault;
			updateNg_v_lu_au();
		});
	} else {
		updateNg_v_lu_au();
	}
}			

// on window focus will likely want to do:
	// fetchAddon_v_lu_au(true);

function onPageReady() {
	// alert('page ready ' + myServices.sb_app_options.GetStringFromName('blah'))
	
}
// end - addon functionalities

function getPref(aPrefName, doSetPrefWithVal) {
	switch (aPrefName) {
		case 'quick_save_dir':
		
				// os path to dir to save in
				var defaultVal = function() {
					try {
						return Services.dirsvc.get('XDGPict', Ci.nsIFile).path;
					} catch (ex if ex.result == Cr.NS_ERROR_FAILURE) { // this cr when path at keyword doesnt exist
						// console.warn('ex:', ex);
						try {
							return Services.dirsvc.get('Pict', Ci.nsIFile).path;
						} catch (ex if ex.result == Cr.NS_ERROR_FAILURE) { // this cr when path at keyword doesnt exist
							// console.warn('ex:', ex);
							return OS.Constants.Path.desktopDir;
						}
					}
				};
				var prefType = 'Char';
				
				// set pref part
				if (doSetPrefWithVal !== undefined) {
					if (doSetPrefWithVal == 'default') { // note: special case
						Services.prefs.clearUserPref(myPrefBranch + 'quick_save_dir')
					} else {
						Services.prefs['set' + prefType + 'Pref'](myPrefBranch + aPrefNamem, doSetPrefWithVal);
					}
				}
				// end set pref part
				
				var prefVal;
				try {
					 prefVal = Services.prefs['get' + prefType + 'Pref'](myPrefBranch + aPrefName);
				} catch (ex if ex.result == Cr.NS_ERROR_UNEXPECTED) { // this cr when pref doesnt exist
					// ok probably doesnt exist, so return default value
					prefVal = defaultVal();
				}
				return prefVal;
			
			break;
		case 'print_preview':
			
				var defaultVal = false;
				var prefType = 'Bool';
				
				// set pref part
				if (doSetPrefWithVal !== undefined) {
					if (doSetPrefWithVal == defaultVal) {
						Services.prefs.clearUserPref(myPrefBranch + aPrefName)
					} else {
						Services.prefs['set' + prefType + 'Pref'](myPrefBranch + aPrefName, doSetPrefWithVal);
					}
				}
				// end set pref part
				
				var prefVal;
				try {
					 prefVal = Services.prefs['get' + prefType + 'Pref'](myPrefBranch + 'print_preview');
				} catch (ex if ex.result == Cr.NS_ERROR_UNEXPECTED) { // this cr when pref doesnt exist
					// ok probably doesnt exist, so return default value
					prefVal = defaultVal;
				}
				return prefVal;
			
			break;
		default:
			throw new Error('unrecognized aPrefName: ' + aPrefName);
	}
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
// end - common helper functions

document.addEventListener('DOMContentLoaded', onPageReady, false);