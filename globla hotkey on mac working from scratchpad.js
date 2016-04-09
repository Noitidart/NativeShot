var ctypes__ = Cu.import("resource://gre/modules/ctypes.jsm", {}).ctypes;

var EventTargetRef = ctypes__.voidptr_t;
var EventHotKeyRef = ctypes__.voidptr_t;

var EventHotKeyID = ctypes__.StructType('EventHotKeyID', [
	{ signature: ctypes__.uint32_t },
	{ id: ctypes__.uint32_t }
]);

var lib = ctypes__.open('/System/Library/Frameworks/Carbon.framework/Frameworks/HIToolbox.framework/HIToolbox');
var GetApplicationEventTarget
 = lib.declare('GetApplicationEventTarget', ctypes__.default_abi,
				       EventTargetRef);

var RegisterEventHotKey = lib.declare('RegisterEventHotKey', ctypes__.default_abi,
				                              ctypes__.int32_t,
				                              ctypes__.uint32_t,
				                              ctypes__.uint32_t,
				                              EventHotKeyID,
				                              EventTargetRef,
				                              ctypes__.uint32_t,
				                              EventHotKeyRef.ptr);

// ----

var EventTypeSpec = ctypes__.StructType('EventTypeSpec', [
	{ eventClass: ctypes__.uint32_t },
	{ eventKind: ctypes__.uint32_t }
]);

var kEventClassKeyboard = 0x6B657962;
var kEventHotKeyPressed = 5;

var EventHandlerCallRef = ctypes__.voidptr_t;
var EventRef = ctypes__.voidptr_t;
var EventHandlerRef = ctypes__.voidptr_t;

var EventHandlerProcPtr = ctypes__.FunctionType(ctypes__.default_abi, ctypes__.uint32_t, [EventHandlerCallRef, EventRef, ctypes__.voidptr_t]).ptr;

var EventHandlerUPP = EventHandlerProcPtr;

var InstallEventHandler = lib.declare('InstallEventHandler', ctypes__.default_abi,
				ctypes__.uint32_t,				// return
				EventTargetRef,		// inTarget,
				EventHandlerUPP,		// inHandler,
				ctypes__.unsigned_long,			// inNumTypes,
				EventTypeSpec.ptr,	// *inList,
				ctypes__.voidptr_t,				// *inUserData,
				EventHandlerRef.ptr	// *outRef
			);

// ----

var rez_appTarget = GetApplicationEventTarget();

var eventType = EventTypeSpec();
eventType.eventClass = kEventClassKeyboard;
eventType.eventKind = kEventHotKeyPressed;

function macHotKeyHandler(nextHandler, theEvent, userDataPtr) {
	// EventHandlerCallRef nextHandler, EventRef theEvent, void *userData
	console.error('wooohoo ah!! called hotkey!');
	return 1;
}

var cHotKeyHandler = EventHandlerUPP(macHotKeyHandler);
console.log('OSStuff.cHotKeyHandler:', cHotKeyHandler.toString());

var rez_install = InstallEventHandler(rez_appTarget, cHotKeyHandler, 1, eventType.address(), null, null);
console.log('rez_install:', rez_install.toString());

// ----

var gMyHotKeyRef = EventHotKeyRef();
var gMyHotKeyID = EventHotKeyID();
gMyHotKeyID.signature =  0x68746b31;
gMyHotKeyID.id = 1876;

var rez_appTarget2 = GetApplicationEventTarget();
console.log('rez_appTarget2 GetApplicationEventTarget:', rez_appTarget2.toString());

var shiftKey = 512;
var cmdKey = 256;

console.log('gMyHotKeyID:', gMyHotKeyID.toString());
console.log('gMyHotKeyID.address():', gMyHotKeyID.address().toString());

console.log('shiftKey + cmdKey:', shiftKey + cmdKey);
console.log('gMyHotKeyRef.address():', gMyHotKeyRef.address().toString());

var rez_reg = RegisterEventHotKey(49, shiftKey + cmdKey, gMyHotKeyID, rez_appTarget2, 0, gMyHotKeyRef.address());
console.log('rez_reg:', rez_reg.toString());