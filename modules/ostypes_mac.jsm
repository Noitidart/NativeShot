var EXPORTED_SYMBOLS = ['ostypes'];

// no need to define core or import cutils as all the globals of the worker who importScripts'ed it are availble here

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

var macTypes = function() {

	// ABIs
	this.CALLBACK_ABI = ctypes.default_abi;
	this.ABI = ctypes.default_abi;

	// C TYPES
	this.char = ctypes.char;
	this.int = ctypes.int;
	this.int16_t = ctypes.int16_t;
	this.int64_t = ctypes.int64_t;
	this.intptr_t = ctypes.intptr_t;
	this.long = ctypes.long;
	this.short = ctypes.short;
	this.size_t = ctypes.size_t;
	this.uint16_t = ctypes.uint16_t;
	this.uint32_t = ctypes.uint32_t;
	this.uintptr_t = ctypes.uintptr_t;
	this.uint64_t = ctypes.uint64_t;
	this.unsigned_char = ctypes.unsigned_char;
	this.unsigned_long = ctypes.unsigned_long;
	this.void = ctypes.void_t;
	
	// ADV C TYPES
	this.time_t = this.long; // https://github.com/j4cbo/chiral/blob/3c66a8bb64e541c0f63b04b78ec2d0ffdf5b473c/chiral/os/kqueue.py#L34 AND also based on this github search https://github.com/search?utf8=%E2%9C%93&q=time_t+ctypes&type=Code&ref=searchresults AND based on this answer here: http://stackoverflow.com/a/471287/1828637
	
	// SIMPLE TYPES // based on ctypes.BLAH // as per WinNT.h etc
	this.Boolean = ctypes.unsigned_char;
	this.CFIndex = ctypes.long;
	this.CFOptionFlags = ctypes.unsigned_long;
	this.CFTimeInterval = ctypes.double;
	this.CFTypeRef = ctypes.voidptr_t;
	this.CGDirectDisplayID = ctypes.uint32_t;
	this.CGError = ctypes.int32_t;
	this.CGFloat = is64bit ? ctypes.double : ctypes.float; // ctypes.float is 32bit deosntw ork as of May 10th 2015 see this bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1163406 this would cause crash on CGDisplayGetBounds http://stackoverflow.com/questions/28216681/how-can-i-get-screenshot-from-all-displays-on-mac#comment48414568_28247749
	this.CGWindowID = ctypes.uint32_t;
	this.CGWindowLevel = ctypes.int32_t;
	this.CGWindowLevelKey = ctypes.int32_t;
	this.CGWindowListOption = ctypes.uint32_t;
	this.ConstStr255Param = ctypes.unsigned_char.ptr;
	this.ConstStringPtr = ctypes.unsigned_char.ptr;
	this.OpaqueDialogPtr = ctypes.StructType("OpaqueDialogPtr");
	this.SInt16 = ctypes.short;
	this.SInt32 = ctypes.long;
	this.UInt16 = ctypes.unsigned_short;
	this.UInt32 = ctypes.unsigned_long;
	this.UInt64 = ctypes.unsigned_long_long;
	this.UniChar = ctypes.jschar;
	this.VOID = ctypes.void_t;
	
	// ADVANCED TYPES // as per how it was defined in WinNT.h // defined by "simple types"
	this.AlertType = this.SInt16;
	this.DialogItemIndex = this.SInt16;
	this.DialogPtr = this.OpaqueDialogPtr.ptr;
	this.EventKind = this.UInt16;
	this.FSEventStreamCreateFlags = this.UInt32;
	this.FSEventStreamEventFlags = this.UInt32;
	this.FSEventStreamEventId = this.UInt64;
	this.EventModifiers = this.UInt16;
	this.OSErr = this.SInt16;
	
	// SUPER ADVANCED TYPES // defined by "advanced types"
	this.DialogRef = this.DialogPtr;
	
	// SUPER DUPER ADVANCED TYPES // defined by "super advanced types"

	// inaccrurate types - i know these are something else but setting them to voidptr_t or something just works and all the extra work isnt needed

	// STRUCTURES
	// consts for structures
	var struct_const = {

	};

	// SIMPLE STRUCTS // based on any of the types above
	this.__CFAllocator = ctypes.StructType('__CFAllocator');
	this.__CFArray = ctypes.StructType("__CFArray");
	this.__CFDictionary = new ctypes.StructType('__CFDictionary');
	this.__CFRunLoop = ctypes.StructType("__CFRunLoop");
	this.__CFString = ctypes.StructType('__CFString');
	this.__CFURL = ctypes.StructType('__CFURL');
	this.__FSEventStream = ctypes.StructType("__FSEventStream");
	this.CFDictionaryRef = this.__CFDictionary.ptr;
	this.CGImage = ctypes.StructType('CGImage');
	this.CGContext = ctypes.StructType('CGContext');
	this.CGPoint = ctypes.StructType('CGPoint', [
		{ x: this.CGFloat },
		{ y: this.CGFloat }
	]);
	this.CGSize = ctypes.StructType('CGSize', [
		{ width: this.CGFloat },
		{ height: this.CGFloat }
	]);
	this.Point = ctypes.StructType('Point', [
		{ v: this.short },
		{ h: this.short }
	]);
	this.ProcessSerialNumber = new ctypes.StructType('ProcessSerialNumber', [
		{ highLongOfPSN: this.UInt32 },
		{ lowLongOfPSN: this.UInt32 }
	]);
	this.timespec = ctypes.StructType('timespec', [ // http://www.opensource.apple.com/source/text_cmds/text_cmds-69/sort/timespec.h
		{ tv_sec: this.time_t },
		{ tv_nsec: this.long }
	]);
	
	// ADVANCED STRUCTS // based on "simple structs" to be defined first
	this.CFAllocatorRef = this.__CFAllocator.ptr;
	this.CFArrayRef = this.__CFArray.ptr;
	this.CFRunLoopRef = this.__CFRunLoop.ptr;
	this.CFStringRef = this.__CFString.ptr;
	this.CFURLRef = this.__CFURL.ptr;
	this.CGImageRef = this.CGImage.ptr;
	this.CGContextRef = this.CGContext.ptr;
	this.CGRect = ctypes.StructType('CGRect', [
		{ origin: this.CGPoint },
		{ size: this.CGSize }
	]);
	this.ConstFSEventStreamRef = this.__FSEventStream.ptr;
	this.EventRecord = ctypes.StructType("EventRecord", [
		{ what: this.EventKind },
		{ message: this.unsigned_long },
		{ when: this.UInt32 },
		{ where: this.Point },
		{ modifiers: this.EventModifiers }
	]);
	this.FSEventStreamRef = this.__FSEventStream.ptr;
	
	// FURTHER ADVANCED STRUCTS

	// FURTHER ADV STRUCTS

	// FUNCTION TYPES
	this.CFAllocatorCopyDescriptionCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.CFStringRef, [this.void.ptr]).ptr;
	this.CFAllocatorRetainCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.void.ptr, [this.void.ptr]).ptr;
	this.CFAllocatorReleaseCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.void, [this.void.ptr]).ptr;
	this.CFArrayCopyDescriptionCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.CFStringRef, [this.void.ptr]).ptr;
	this.CFArrayEqualCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.Boolean, [this.void.ptr, this.void.ptr]).ptr;
	this.CFArrayReleaseCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.void, [this.CFAllocatorRef, this.void.ptr]).ptr;
	this.CFArrayRetainCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.void.ptr, [this.CFAllocatorRef, this.void.ptr]).ptr;
	this.FSEventStreamCallback = ctypes.FunctionType(this.CALLBACK_ABI, this.void, [this.ConstFSEventStreamRef, this.void.ptr, this.size_t, this.void.ptr, this.FSEventStreamEventFlags.ptr, this.FSEventStreamEventId.ptr]).ptr;
	this.ModalFilterProcPtr = ctypes.FunctionType(this.CALLBACK_ABI, this.Boolean, [this.DialogRef, this.EventRecord.ptr, this.DialogItemIndex.ptr]).ptr;
	
	// ADVANCED FUNCTION TYPES
	this.ModalFilterUPP = this.ModalFilterProcPtr;
	
	// STRUCTS USING FUNC TYPES
	this.AlertStdAlertParamRec = ctypes.StructType("AlertStdAlertParamRec", [
		{ movable: this.Boolean },
		{ helpButton: this.Boolean },
		{ filterProc: this.ModalFilterUPP },
		{ defaultText: this.ConstStringPtr },
		{ cancelText: this.ConstStringPtr },
		{ otherText: this.ConstStringPtr },
		{ defaultButton: this.SInt16 },
		{ cancelButton: this.SInt16 },
		{ position: this.UInt16 }
	]);
	this.CFArrayCallBacks = ctypes.StructType("CFArrayCallBacks", [
		{ version: this.CFIndex },
		{ retain: this.CFArrayRetainCallBack },
		{ release: this.CFArrayReleaseCallBack },
		{ copyDescription: this.CFArrayCopyDescriptionCallBack },
		{ equal: this.CFArrayEqualCallBack }
	]);
	this.FSEventStreamContext = ctypes.StructType("FSEventStreamContext", [
		{version: this.CFIndex},
		{info: this.void.ptr},
		{retain: this.CFAllocatorRetainCallBack},
		{release: this.CFAllocatorReleaseCallBack},
		{copyDescription: this.CFAllocatorCopyDescriptionCallBack}
	]);
	
	
	///// OBJC
	
	// SIMPLE OBJC TYPES
	this.BOOL = ctypes.signed_char;
	this.NSInteger = ctypes.long;
	this.NSUInteger = ctypes.unsigned_long;
	
	// ADV OBJC TYPES
	this.NSBitmapFormat = this.NSUInteger;
	
	// GUESS TYPES OBJC - they work though
	this.id = ctypes.voidptr_t;
	this.IMP = ctypes.voidptr_t;
	this.SEL = ctypes.voidptr_t;
	this.Class = ctypes.voidptr_t;
	this.NSWindow = ctypes.voidptr_t;
	
	// NULL CONSTs that i use for vaiadic args
	
	
	// SIMPLE OBJC STRUCTS
	
	// ADV OBJC STRUCTS
	

	// dispatch stuff
	this.dispatch_block_t = ctypes.FunctionType(this.CALLBACK_ABI, this.void, []).ptr;
	this.dispatch_queue_t = ctypes.voidptr_t; // guess
}

var macInit = function() {
	var self = this;

	this.IS64BIT = is64bit;

	this.TYPE = new macTypes();

	// CONSTANTS
	var _const = {}; // lazy load consts
	this.CONST = {
		get CGRectNull () { if (!('CGRectNull' in _const)) { _const['CGRectNull'] = lib('CoreGraphics').declare('CGRectNull', self.TYPE.CGRect); } return _const['CGRectNull']; },
		get kCFTypeArrayCallBacks () { if (!('kCFTypeArrayCallBacks' in _const)) { _const['kCFTypeArrayCallBacks'] = lib('CoreFoundation').declare('kCFTypeArrayCallBacks', self.TYPE.CFArrayCallBacks); } return _const['kCFTypeArrayCallBacks']; },
		kCGErrorSuccess: 0,
		kCGNullDirectDisplay: 0,
		kCGBaseWindowLevelKey: 0,
		kCGMinimumWindowLevelKey: 1,
		kCGDesktopWindowLevelKey: 2,
		kCGBackstopMenuLevelKey: 3,
		kCGNormalWindowLevelKey: 4,
		kCGFloatingWindowLevelKey: 5,
		kCGTornOffMenuWindowLevelKey: 6,
		kCGDockWindowLevelKey: 7,
		kCGMainMenuWindowLevelKey: 8,
		kCGStatusWindowLevelKey: 9,
		kCGModalPanelWindowLevelKey: 10,
		kCGPopUpMenuWindowLevelKey: 11,
		kCGDraggingWindowLevelKey: 12,
		kCGScreenSaverWindowLevelKey: 13,
		kCGMaximumWindowLevelKey: 14,
		kCGOverlayWindowLevelKey: 15,
		kCGHelpWindowLevelKey: 16,
		kCGUtilityWindowLevelKey: 17,
		kCGDesktopIconWindowLevelKey: 18,
		kCGCursorWindowLevelKey: 19,
		kCGAssistiveTechHighWindowLevelKey: 20,
		kCGNumberOfWindowLevelKeys: 21,
		kCGNullWindowID: 0,
		kCGWindowListOptionAll: 0,
		kCGWindowListOptionOnScreenOnly: 1,
		kCGWindowListOptionOnScreenAboveWindow: 2,
		kCGWindowListOptionOnScreenBelowWindow: 4,
		kCGWindowListOptionIncludingWindow: 8,
		kCGWindowListExcludeDesktopElements: 16,
		///////// OBJC - all consts are wrapped in a type as if its passed to variadic it needs to have type defind, see jsctypes chat with arai on 051015 357p
		NO: self.TYPE.BOOL(0),
		NSPNGFileType: self.TYPE.NSUInteger(4),
		YES: self.TYPE.BOOL(1), // i do this instead of 1 becuase for varidic types we need to expclicitly define it
		NIL: self.TYPE.void.ptr(ctypes.UInt64('0x0')) // needed for varidic args, as i cant pass null there
	};

	var _lib = {}; // cache for lib
	var lib = function(path) {
		//ensures path is in lib, if its in lib then its open, if its not then it adds it to lib and opens it. returns lib
		//path is path to open library
		//returns lib so can use straight away

		if (!(path in _lib)) {
			//need to open the library
			//default it opens the path, but some things are special like libc in mac is different then linux or like x11 needs to be located based on linux version
			switch (path) {
				case 'CarbonCore':
				
						_lib[path] = ctypes.open('/System/Library/Frameworks/CoreServices.framework/Frameworks/CarbonCore.framework/CarbonCore');
					
					break;
				case 'CoreFoundation':
				
						_lib[path] = ctypes.open('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
					
					break;
				case 'CoreGraphics':
				
						_lib[path] = ctypes.open('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
					
					break;
				case 'FSEvents':
				
						try {
							// for osx 10.10
							_lib[path] = ctypes.open('/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/FSEvents.framework/Versions/A/FSEvents');
						} catch (ex) {
							if (ex.message.indexOf('couldn\'t open library') == -1) {
								throw ex; // failed due to some othe reason
							}
							// for osx < 10.10
							_lib[path] = lib('CarbonCore');
						}
					
					break;
				case 'libc':

						switch (core.os.name) {
							case 'darwin':
								_lib[path] = ctypes.open('libc.dylib');
								break;
							case 'freebsd':
								_lib[path] = ctypes.open('libc.so.7');
								break;
							case 'openbsd':
								_lib[path] = ctypes.open('libc.so.61.0');
								break;
							case 'android':
							case 'sunos':
							case 'netbsd': // physically unverified
							case 'dragonfly': // physcially unverified
								_lib[path] = ctypes.open('libc.so');
								break;
							case 'linux':
								_lib[path] = ctypes.open('libc.so.6');
								break;
							case 'gnu/kfreebsd': // physically unverified
								lib = ctypes.open('libc.so.0.1');
								break;
							default:
								throw new Error({
									name: 'watcher-api-error',
									message: 'Path to libc on operating system of , "' + OS.Constants.Sys.Name + '" is not supported for kqueue'
								});
						}

					break;
				case 'objc':
				
						_lib[path] = ctypes.open(ctypes.libraryName('objc'));
					
					break;
				default:
					try {
						_lib[path] = ctypes.open(path);
					} catch (ex) {
						throw new Error({
							name: 'addon-error',
							message: 'Could not open ctypes library path of "' + path + '"',
							ex_msg: ex.message
						});
					}
			}
		}
		return _lib[path];
	};

	// start - function declares
	var _api = {};
	this.API = function(declaration) { // it means ensureDeclared and return declare. if its not declared it declares it. else it returns the previously declared.
		if (!(declaration in _api)) {
			_api[declaration] = preDec[declaration](); //if declaration is not in preDec then dev messed up
		}
		return _api[declaration];
	};

	// start - predefine your declares here
	var preDec = { //stands for pre-declare (so its just lazy stuff) //this must be pre-populated by dev // do it alphabateized by key so its ez to look through
		CFArrayCreate: function() {
			return lib('CoreFoundation').declare('CFArrayCreate', self.TYPE.ABI,
				self.TYPE.CFArrayRef,
				self.TYPE.CFAllocatorRef,
				self.TYPE.void.ptr.ptr,
				self.TYPE.CFIndex,
				self.TYPE.CFArrayCallBacks.ptr
			);
		},
		CFArrayGetCount: function() {
			return lib('CoreFoundation').declare('CFArrayGetCount', self.TYPE.ABI,
				self.TYPE.CFIndex,
				self.TYPE.CFArrayRef
			);
		},
		CFArrayGetValueAtIndex: function() {
			return lib('CoreFoundation').declare('CFArrayGetValueAtIndex', self.TYPE.ABI,
				self.TYPE.void.ptr,
				self.TYPE.CFArrayRef,
				self.TYPE.CFIndex
			);
		},
		CFStringCreateWithCharacters: function() {
			/* https://developer.apple.com/library/mac/documentation/CoreFoundation/Reference/CFStringRef/#//apple_ref/c/func/CFStringCreateWithCharacters
			 * CFStringRef CFStringCreateWithCharacters (
			 *   CFAllocatorRef alloc,
			 *   const UniChar *chars,
			 *   CFIndex numChars
			 * ); 
			 */
			return lib('CoreFoundation').declare('CFStringCreateWithCharacters', self.TYPE.ABI,
				self.TYPE.CFStringRef,		// return
				self.TYPE.CFAllocatorRef,	// alloc
				self.TYPE.UniChar.ptr,		// *chars
				self.TYPE.CFIndex			// numChars
			);
		},
		CFRelease: function() {
			/* https://developer.apple.com/library/mac/documentation/CoreFoundation/Reference/CFTypeRef/#//apple_ref/c/func/CFRelease
			 * void CFRelease (
			 *   CFTypeRef cf
			 * ); 
			 */
			return lib('CoreFoundation').declare('CFRelease', self.TYPE.ABI,
				self.TYPE.void,		// return
				self.TYPE.CFTypeRef	// cf
			);
		},
		CGContextClearRect: function() {
			return lib('CoreGraphics').declare('CGContextClearRect', self.TYPE.ABI,
				self.TYPE.void,
				self.TYPE.CGContextRef,
				self.TYPE.CGRect
			);
		},
		CGContextDrawImage: function() {
			/* https://developer.apple.com/library/mac/documentation/GraphicsImaging/Reference/CGContext/index.html#//apple_ref/c/func/CGContextDrawImage
			 * void CGContextDrawImage (
			 *   CGContextRef c,
			 *   CGRect rect,
			 *   CGImageRef image
			 * ); 
			 */
			return lib('CoreGraphics').declare('CGContextDrawImage', self.TYPE.ABI,
				self.TYPE.void,		// return
				self.TYPE.CGContextRef,	// c
				self.TYPE.CGRect,		// rect
				self.TYPE.CGImageRef		// image
			);
		},
		CGDisplayBounds: function() {
			return lib('CoreGraphics').declare('CGDisplayBounds', self.TYPE.ABI,
				self.TYPE.CGRect,
				self.TYPE.CGDirectDisplayID
			);
		},
		CGDisplayCreateImage: function() {
			return lib('CoreGraphics').declare('CGDisplayCreateImage', self.TYPE.ABI,
				self.TYPE.CGImageRef,
				self.TYPE.CGDirectDisplayID
			);
		},
		CGDisplayHideCursor: function() {
			return lib('CoreGraphics').declare("CGDisplayHideCursor", self.TYPE.ABI,
				self.TYPE.CGError,
				self.TYPE.CGDirectDisplayID
			);
		},
		CGDisplayMirrorsDisplay: function() {
			return lib('CoreGraphics').declare('CGDisplayMirrorsDisplay', self.TYPE.ABI,
				self.TYPE.CGDirectDisplayID,
				self.TYPE.CGDirectDisplayID
			);
		},
		CGDisplayShowCursor: function() {
			return lib('CoreGraphics').declare("CGDisplayShowCursor", self.TYPE.ABI,
				self.TYPE.CGError,
				self.TYPE.CGDirectDisplayID
			);
		},
		CGGetActiveDisplayList: function() {
			/* https://developer.apple.com/library/mac/documentation/GraphicsImaging/Reference/Quartz_Services_Ref/index.html#//apple_ref/c/func/CGGetActiveDisplayList
			 * CGError CGGetActiveDisplayList (
			 *   uint32_t maxDisplays,
			 *   CGDirectDisplayID *activeDisplays,
			 *   uint32_t *displayCount
			 * ); 
			 */
			return lib('CoreGraphics').declare('CGGetActiveDisplayList', self.TYPE.ABI,
				self.TYPE.CGError,					// return
				self.TYPE.uint32_t,					// maxDisplays
				self.TYPE.CGDirectDisplayID.ptr,	// *activeDisplays
				self.TYPE.uint32_t.ptr				// *displayCount
			);
		},
		CGWindowLevelForKey: function() {
			return lib('CoreGraphics').declare('CGWindowLevelForKey', self.TYPE.ABI,
				self.TYPE.CGWindowLevel,
				self.TYPE.CGWindowLevelKey
			);
		},
		CGWindowListCopyWindowInfo: function() {
			/* https://developer.apple.com/library/mac/documentation/Carbon/Reference/CGWindow_Reference/Reference/Functions.html
			 * CFArrayRef CGWindowListCopyWindowInfo(
			 *   CGWindowListOption option,
			 *   CGWindowID relativeToWindow
			 * );
			 */
			return lib('CoreGraphics').declare('CGWindowListCopyWindowInfo', self.TYPE.ABI,
				self.TYPE.CFArrayRef,
				self.TYPE.CGWindowListOption,
				self.TYPE.CGWindowID
			);
		},
		CGImageRelease: function() {
			return lib('CoreGraphics').declare('CGImageRelease', self.TYPE.ABI,
				self.TYPE.void,
				self.TYPE.CGImageRef
			);
		},
		CGRectMake: function() {
			/* https://developer.apple.com/library/ios/documentation/GraphicsImaging/Reference/CGGeometry/index.html#//apple_ref/c/func/CGRectMake
			 *  CGRect CGRectMake (
			 *    CGFloat x,
			 *    CGFloat y,
			 *    CGFloat width,
			 *    CGFloat height
			 * ); 
			 */
			 /*
			return lib('CGGeometry').declare('CGRectMake', self.TYPE.ABI,
				self.TYPE.CGRect,	// return
				self.TYPE.CGFloat,	// x
				self.TYPE.CGFloat,	// y
				self.TYPE.CGFloat,	// width
				self.TYPE.CGFloat	// height
			);
			*/
			return function(x, y, width, height) {
				return self.TYPE.CGRect(
					self.TYPE.CGPoint(x, y),
					self.TYPE.CGSize(width, height)
				);
			};
		},
		CGRectMakeWithDictionaryRepresentation: function() {
			/* https://developer.apple.com/library/ios/documentation/GraphicsImaging/Reference/CGGeometry/index.html#//apple_ref/c/func/CGRectMakeWithDictionaryRepresentation
			 * bool CGRectMakeWithDictionaryRepresentation (
			 *   CFDictionaryRef dict,
			 *   CGRect *rect
			 * ); 
			 */
			return lib('CoreGraphics').declare('CGRectMakeWithDictionaryRepresentation', self.TYPE.ABI,
				ctypes.bool,				// return
				self.TYPE.CFDictionaryRef,	// dict
				self.TYPE.CGRect.ptr		// *rect
			);
		},
		CGRectGetHeight: function() {
			return lib('CoreGraphics').declare('CGRectGetHeight', self.TYPE.ABI,
				self.TYPE.CGFloat,
				self.TYPE.CGRect
			);
		},
		CGRectGetWidth: function() {
			return lib('CoreGraphics').declare('CGRectGetWidth', self.TYPE.ABI,
				self.TYPE.CGFloat,
				self.TYPE.CGRect
			);
		},
		CGRectUnion: function() {
			return lib('CoreGraphics').declare('CGRectUnion', self.TYPE.ABI,
				self.TYPE.CGRect,
				self.TYPE.CGRect,
				self.TYPE.CGRect
			);
		},
		dispatch_get_main_queue: function() {
			/* https://developer.apple.com/library/prerelease/mac/documentation/Performance/Reference/GCD_libdispatch_Ref/#//apple_ref/c/func/dispatch_get_main_queue
			 *  dispatch_queue_t dispatch_get_main_queue (
			 *   void
			 * ); 
			 */
			// return lib('/usr/lib/system/libdispatch.dylib').declare('_dispatch_main_q', self.TYPE.ABI,
			// 	self.TYPE.dispatch_queue_t	// return
			// );
			// do not do ostypes.API('dispatch_get_main_queue')() the () will give error not FuncitonType.ptr somhting like that, must just use ostypes.API('dispatch_get_main_queue')
			// http://stackoverflow.com/questions/31637321/standard-library-containing-dispatch-get-main-queue-gcd
			return lib('/usr/lib/system/libdispatch.dylib').declare('_dispatch_main_q', self.TYPE.dispatch_queue_t);
		},
		dispatch_sync: function() {
			/* https://developer.apple.com/library/prerelease/mac/documentation/Performance/Reference/GCD_libdispatch_Ref/#//apple_ref/c/func/dispatch_sync
			 * void dispatch_sync (
			 *   dispatch_queue_t queue,
			 *   dispatch_block_t block
			 * ); 
			 */
			return lib('/usr/lib/system/libdispatch.dylib').declare('dispatch_sync', self.TYPE.ABI,
				self.TYPE.void,					// return
				self.TYPE.dispatch_queue_t,		// queue
				self.TYPE.dispatch_block_t		// block
			);
		},
		//////////// OBJC
		objc_getClass: function() {
			/* https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ObjCRuntimeRef/index.html#//apple_ref/c/func/objc_getClass
			 * Class objc_getClass (
			 *   const char *name
			 * ); 
			 */
			return lib('objc').declare('objc_getClass', self.TYPE.ABI,
				self.TYPE.Class,		// return
				self.TYPE.char.ptr		// *name
			);
		},
		objc_msgSend: function() {
			/* https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ObjCRuntimeRef/index.html#//apple_ref/c/func/objc_getClass
			 * id objc_msgSend (
			 *   id self,
			 *   SEL op,
			 *   ... 
			 * ); 
			 */
			return lib('objc').declare('objc_msgSend', self.TYPE.ABI,
				self.TYPE.id,		// return
				self.TYPE.id,		// self
				self.TYPE.SEL,		// op
				'...'				// variable arguments
			);
		},
		sel_registerName: function() {
			/* https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ObjCRuntimeRef/index.html#//apple_ref/c/func/objc_getClass
			 * SEL sel_registerName (
			 *   const char *str
			 * ); 
			 */
			return lib('objc').declare('sel_registerName', self.TYPE.ABI,
				self.TYPE.SEL,		// return
				self.TYPE.char.ptr	// *str
			);
		},
		objc_registerClassPair: function() {
			/* https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ObjCRuntimeRef/index.html#//apple_ref/c/func/objc_registerClassPair
			 * void objc_registerClassPair (
			 *   Class cls
			 * ); 
			 */
			return lib('objc').declare('objc_registerClassPair', self.TYPE.ABI,
				self.TYPE.void,	// return
				self.TYPE.Class	// cls
			);
		},
		objc_allocateClassPair: function() {
			/* https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ObjCRuntimeRef/index.html#//apple_ref/c/func/objc_allocateClassPair
			 *  Class objc_allocateClassPair (
			 *   Class superclass,
			 *   const char *name,
			 *   size_t extraBytes
			 * );
			 */
			return lib('objc').declare('objc_allocateClassPair', self.TYPE.ABI,
				self.TYPE.Class,		// return
				self.TYPE.Class,		// superclass
				self.TYPE.char.ptr,		// *name
				self.TYPE.size_t		// extraBytes
			);
		},
		class_addMethod: function() {
			/* https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ObjCRuntimeRef/index.html#//apple_ref/c/func/class_addMethod
			 * BOOL class_addMethod (
			 *   Class cls,
			 *   SEL name,
			 *   IMP imp,
			 *   const char *types
			 * ); 
			 */
			return lib('objc').declare('class_addMethod', self.TYPE.ABI,
				self.TYPE.BOOL,		// return
				self.TYPE.Class,	// cls
				self.TYPE.SEL,		// name
				self.TYPE.IMP,		// imp
				self.TYPE.char.ptr	// *types
			);
		},
		objc_disposeClassPair: function() {
			/* https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ObjCRuntimeRef/index.html#//apple_ref/c/func/objc_disposeClassPair
			 * void objc_disposeClassPair (
			 *   Class cls
			 * ); 
			 */
			return lib('objc').declare('objc_disposeClassPair', self.TYPE.ABI,
				self.TYPE.void,	// return
				self.TYPE.Class	// cls
			);
		},
		///////////// LIBC
		memcpy: function() {
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man3/memcpy.3.html#//apple_ref/doc/man/3/memcpy
			 * void *memcpy (
			 *   void *restrict dst,
			 *   const void *restrict src,
			 *   size_t n
			 * );
			 */
			return lib('libc').declare('memcpy', self.TYPE.ABI,
				self.TYPE.void,		// return
				self.TYPE.void.ptr,	// *dst
				self.TYPE.void.ptr,	// *src
				self.TYPE.size_t	// n
			);
		}
	};
	// end - predefine your declares here
	// end - function declares

	this.HELPER = {
		makeCFStr: function(jsStr) {
			// js str is just a string
			// returns a CFStr that must be released with CFRelease when done
			return self.API('CFStringCreateWithCharacters')(null, jsStr, jsStr.length);
		},
		Str255: function(str) {
			return String.fromCharCode(str.length) + str;
		},
		// OBJC HELPERS
		_selLC: {}, // LC = Lazy Cache
		sel: function(jsStrSEL) {
			if (!(jsStrSEL in self.HELPER._selLC)) {
				self.HELPER._selLC[jsStrSEL] = self.API('sel_registerName')(jsStrSEL);
				console.info('sel c got', jsStrSEL, self.HELPER._selLC[jsStrSEL].toString());
			}
			return self.HELPER._selLC[jsStrSEL];
		},
		_classLC: {}, // LC = Lazy Cache
		class: function(jsStrCLASS) {
			if (!(jsStrCLASS in self.HELPER._classLC)) {
				self.HELPER._classLC[jsStrCLASS] = self.API('objc_getClass')(jsStrCLASS);
				console.info('class c got', jsStrCLASS, self.HELPER._classLC[jsStrCLASS].toString());
			}
			return self.HELPER._classLC[jsStrCLASS];
		},
		nsstringColl: function() { // collection of NSStrings with methods of .release to release all of them
			// creates a collection
			// if get and it doesnt exist then it makes and stores it
			// if get and already exists then it returns that lazy
			// can releaseAll on it
			console.error('nssstringColll');
			this.coll = {};
			this.class = {};
			this.get = function(jsStr) {
				console.error('enter get');
				if (!(jsStr in this.coll)) {
					console.error('here');
					this.class[jsStr] = self.API('objc_msgSend')(self.HELPER.class('NSString'), self.HELPER.sel('alloc'));;
					console.info('pre init this.class[jsStr]:', jsStr, this.class[jsStr].toString());
					
					var rez_initWithUTF8String = self.API('objc_msgSend')(this.class[jsStr], self.HELPER.sel('initWithUTF8String:'), self.TYPE.char.array()(jsStr));
					this.coll[jsStr] = rez_initWithUTF8String;
					console.info('post init this.class:', jsStr, this.class[jsStr].toString(), 'this.coll[jsStr]:', this.coll[jsStr].toString());
				} else {
					console.error('jsStr already in coll', jsStr);
				}
				return this.coll[jsStr];
			};
			
			this.releaseAll = function() {
				for (var nsstring in this.coll) {
					var rez_relNSS = self.API('objc_msgSend')(this.coll[nsstring], self.HELPER.sel('release'));
					var rez_relCLASS = self.API('objc_msgSend')(this.class[nsstring], self.HELPER.sel('release'));
					console.info(nsstring, 'rez_relNSS:', rez_relNSS.toString(), 'rez_relCLASS:', rez_relCLASS.toString());
				}
				this.coll = null;
			};
		}
	};
}

var ostypes = new macInit();