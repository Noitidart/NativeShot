var EXPORTED_SYMBOLS = ['ostypes'];

// no need to define core or import cutils as all the globals of the worker who importScripts'ed it are availble here

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

var ifdef_UNICODE = true;

var winTypes = function() {
	
	// ABIs
	if (is64bit) {
	  this.CALLBACK_ABI = ctypes.default_abi;
	  this.ABI = ctypes.default_abi;
	} else {
	  this.CALLBACK_ABI = ctypes.stdcall_abi;
	  this.ABI = ctypes.winapi_abi;
	}
	
	// SIMPLE TYPES // based on ctypes.BLAH // as per WinNT.h etc
	this.BOOL = ctypes.bool;
	this.BYTE = ctypes.unsigned_char;
	this.CHAR = ctypes.char;
	this.DWORD = ctypes.unsigned_long; // IntSafe.h defines it as: // typedef unsigned long DWORD; // so maybe can change this to ctypes.unsigned_long // i was always using `ctypes.uint32_t`
	this.INT = ctypes.int;
	this.INT_PTR = is64bit ? ctypes.int64_t : ctypes.int;
	this.LONG = ctypes.long;
	this.LONG_PTR = is64bit ? ctypes.int64_t : ctypes.long; // i left it at what i copied pasted it as but i thought it would be `ctypes.intptr_t`
	this.LPCVOID = ctypes.voidptr_t;
	this.LPVOID = ctypes.voidptr_t;	
	this.NTSTATUS = ctypes.long; // https://msdn.microsoft.com/en-us/library/cc230357.aspx // typedef long NTSTATUS;
	this.PVOID = ctypes.voidptr_t;
	this.RM_APP_TYPE = ctypes.unsigned_int; // i dont know im just guessing, i cant find a typedef that makes sense to me: https://msdn.microsoft.com/en-us/library/windows/desktop/aa373670%28v=vs.85%29.aspx
	this.UINT = ctypes.unsigned_int;
	this.UINT_PTR = is64bit ? ctypes.uint64_t : ctypes.unsigned_int;
	this.ULONG = ctypes.unsigned_long;
	this.ULONG_PTR = is64bit ? ctypes.uint64_t : ctypes.unsigned_long; // i left it at what i copied pasted it as, but i thought it was this: `ctypes.uintptr_t`
	this.USHORT = ctypes.unsigned_short;
	this.VARIANT_BOOL = ctypes.short;
	this.VARTYPE = ctypes.unsigned_short;
	this.VOID = ctypes.void_t;
	this.WCHAR = ctypes.jschar;
	this.WORD = ctypes.unsigned_short;
	
	// ADVANCED TYPES // as per how it was defined in WinNT.h // defined by "simple types"
	this.ATOM = this.WORD;
	this.BOOLEAN = this.BYTE; // http://blogs.msdn.com/b/oldnewthing/archive/2004/12/22/329884.aspx
	this.COLORREF = this.DWORD; // when i copied/pasted there was this comment next to this: // 0x00bbggrr
	this.DWORD_PTR = this.ULONG_PTR;
	this.HANDLE = this.PVOID;
	this.HRESULT = this.LONG;
	this.LPCSTR = this.CHAR.ptr; // typedef __nullterminated CONST CHAR *LPCSTR;
	this.LPCWSTR = this.WCHAR.ptr;
	this.LPARAM = this.LONG_PTR;
	this.LPDWORD = this.DWORD.ptr;
	this.LPSTR = this.CHAR.ptr;
	this.LPWSTR = this.WCHAR.ptr;
	this.LRESULT = this.LONG_PTR;
	this.OLECHAR = this.WCHAR; // typedef WCHAR OLECHAR; // https://github.com/wine-mirror/wine/blob/bdeb761357c87d41247e0960f71e20d3f05e40e6/include/wtypes.idl#L286
	this.PLONG = this.LONG.ptr;
	this.PULONG = this.ULONG.ptr;
	this.PULONG_PTR = this.ULONG.ptr;
	this.PCWSTR = this.WCHAR.ptr;
	this.SIZE_T = this.ULONG_PTR;
	this.SYSTEM_INFORMATION_CLASS = this.INT; // i think due to this search: http://stackoverflow.com/questions/28858849/where-is-system-information-class-defined
	this.TCHAR = ifdef_UNICODE ? this.WCHAR : ctypes.char; // when i copied pasted this it was just ctypes.char and had this comment: // Mozilla compiled with UNICODE/_UNICODE macros and wchar_t = jschar // in "advanced types" section even though second half is ctypes.char because it has something that is advanced, which is the first part, this.WCHAR
	this.WPARAM = this.UINT_PTR;
	
	// SUPER ADVANCED TYPES // defined by "advanced types"
	this.HBITMAP = this.HANDLE;
	this.HBRUSH = this.HANDLE;
	this.HDC = this.HANDLE;
	this.HFONT = this.HANDLE;
	this.HGDIOBJ = this.HANDLE;
	this.HHOOK = this.HANDLE;
	this.HICON = this.HANDLE;
	this.HINSTANCE = this.HANDLE;
	this.HKEY = this.HANDLE;
	this.HMENU = this.HANDLE;
	this.HWND = this.HANDLE;
	this.LPCOLESTR = this.OLECHAR.ptr; // typedef [string] const OLECHAR *LPCOLESTR; // https://github.com/wine-mirror/wine/blob/bdeb761357c87d41247e0960f71e20d3f05e40e6/include/wtypes.idl#L288
	this.LPCTSTR = ifdef_UNICODE ? this.LPCWSTR : this.LPCSTR;
	this.LPHANDLE = this.HANDLE.ptr;
	this.LPOLESTR = this.OLECHAR.ptr; // typedef [string] OLECHAR *LPOLESTR; // https://github.com/wine-mirror/wine/blob/bdeb761357c87d41247e0960f71e20d3f05e40e6/include/wtypes.idl#L287 // http://stackoverflow.com/a/1607335/1828637 // LPOLESTR is usually to be allocated with CoTaskMemAlloc()
	this.LPTSTR = ifdef_UNICODE ? this.LPWSTR : this.LPSTR;	
	
	// SUPER DUPER ADVANCED TYPES // defined by "super advanced types"
	this.HCURSOR = this.HICON;
	this.HMODULE = this.HINSTANCE;
	this.WNDENUMPROC = ctypes.FunctionType(this.CALLBACK_ABI, this.BOOL, [this.HWND, this.LPARAM]); // "super advanced type" because its highest type is `this.HWND` which is "advanced type"

	// inaccrurate types - i know these are something else but setting them to voidptr_t or something just works and all the extra work isnt needed
	this.PCIDLIST_ABSOLUTE = ctypes.voidptr_t; // https://github.com/west-mt/ssbrowser/blob/452e21d728706945ad00f696f84c2f52e8638d08/chrome/content/modules/WindowsShortcutService.jsm#L115
	this.PIDLIST_ABSOLUTE = ctypes.voidptr_t;
	this.WIN32_FIND_DATA = ctypes.voidptr_t;
	this.WINOLEAPI = ctypes.voidptr_t; // i guessed on this one
	
	// STRUCTURES
	
	// SIMPLE STRUCTS // based on any of the types above
	this.FILE_NOTIFY_INFORMATION = ctypes.StructType('FILE_NOTIFY_INFORMATION', [
		{ NextEntryOffset: this.DWORD },
		{ Action: this.DWORD },
		{ FileNameLength: this.DWORD },
		{ FileName: ctypes.ArrayType(this.WCHAR, 1) }, // not null terminated
	]);
	this.GUID = ctypes.StructType('GUID', [
	  { 'Data1': this.ULONG },
	  { 'Data2': this.USHORT },
	  { 'Data3': this.USHORT },
	  { 'Data4': this.BYTE.array(8) }
	]);
	this.OVERLAPPED = ctypes.StructType('_OVERLAPPED', [ // https://msdn.microsoft.com/en-us/library/windows/desktop/ms684342%28v=vs.85%29.aspx
		{ Internal: this.ULONG_PTR },
		{ InternalHigh: this.ULONG_PTR },
		{ Pointer: this.PVOID }, //  union { struct { DWORD Offset; DWORD OffsetHigh; }; PVOID Pointer; };
		{ hEvent: this.HANDLE },
	]);
	this.PROPVARIANT = ctypes.StructType('PROPVARIANT', [ // http://msdn.microsoft.com/en-us/library/windows/desktop/bb773381%28v=vs.85%29.aspx
		{ 'vt': this.VARTYPE }, // constants for this are available at MSDN: http://msdn.microsoft.com/en-us/library/windows/desktop/aa380072%28v=vs.85%29.aspx
		{ 'wReserved1': this.WORD },
		{ 'wReserved2': this.WORD },
		{ 'wReserved3': this.WORD },
		{ 'pwszVal': this.LPWSTR } // union, i just use pwszVal so I picked that one // for InitPropVariantFromString // when using this see notes on MSDN doc page chat of PROPVARIANT ( http://msdn.microsoft.com/en-us/library/windows/desktop/aa380072%28v=vs.85%29.aspx )this guy says: "VT_LPWSTR must be allocated with CoTaskMemAlloc :: (Presumably this also applies to VT_LPSTR) VT_LPWSTR is described as being a string pointer with no information on how it is allocated. You might then assume that the PROPVARIANT doesn't own the string and just has a pointer to it, but you'd be wrong. In fact, the string stored in a VT_LPWSTR PROPVARIANT must be allocated using CoTaskMemAlloc and be freed using CoTaskMemFree. Evidence for this: Look at what the inline InitPropVariantFromString function does: It sets a VT_LPWSTR using SHStrDupW, which in turn allocates the string using CoTaskMemAlloc. Knowing that, it's obvious that PropVariantClear is expected to free the string using CoTaskMemFree. I can't find this explicitly documented anywhere, which is a shame, but step through this code in a debugger and you can confirm that the string is freed by PropVariantClear: ```#include <Propvarutil.h>	int wmain(int argc, TCHAR *lpszArgv[])	{	PROPVARIANT pv;	InitPropVariantFromString(L"Moo", &pv);	::PropVariantClear(&pv);	}```  If  you put some other kind of string pointer into a VT_LPWSTR PROPVARIANT your program is probably going to crash."
	]);
	this.SECURITY_ATTRIBUTES = ctypes.StructType('_SECURITY_ATTRIBUTES', [ // https://msdn.microsoft.com/en-us/library/windows/desktop/aa379560%28v=vs.85%29.aspx
		{ 'nLength': this.DWORD },
		{ 'lpSecurityDescriptor': this.LPVOID },
		{ 'bInheritHandle': this.BOOL }
	]);
	
	// ADVANCED STRUCTS // based on "simple structs" to be defined first
	this.CLSID = this.GUID;
	this.PGUID = this.GUID.ptr;
	this.IID = this.GUID;
	this.LPOVERLAPPED = this.OVERLAPPED.ptr;
	this.LPSECURITY_ATTRIBUTES = this.SECURITY_ATTRIBUTES.ptr;
	
	// FUNCTION TYPES
	this.FileIOCompletionRoutine = ctypes.FunctionType(this.CALLBACK_ABI, this.VOID, [this.DWORD, this.DWORD, this.LPOVERLAPPED]);
	
	// STRUCTS USING FUNC TYPES
	this.LPOVERLAPPED_COMPLETION_ROUTINE = this.FileIOCompletionRoutine.ptr;
}

var winInit = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new winTypes();

	// CONSTANTS
	this.CONST = {
		ERROR_OPERATION_ABORTED: 995,
		FILE_ACTION_ADDED: 0x00000001,
		FILE_ACTION_REMOVED: 0x00000002,
		FILE_ACTION_MODIFIED: 0x00000003,
		FILE_ACTION_RENAMED_OLD_NAME: 0x00000004,
		FILE_ACTION_RENAMED_NEW_NAME: 0x00000005,
		FILE_FLAG_BACKUP_SEMANTICS: 33554432,
		FILE_FLAG_OVERLAPPED: 0x40000000,
		FILE_LIST_DIRECTORY: 0x0001,
		FILE_NOTIFY_CHANGE_FILE_NAME: 0x00000001,
		FILE_NOTIFY_CHANGE_DIR_NAME: 0x00000002,
		FILE_NOTIFY_CHANGE_ATTRIBUTES: 0x00000004,
		FILE_NOTIFY_CHANGE_SIZE: 0x00000008,
		FILE_NOTIFY_CHANGE_LAST_WRITE: 0x00000010,
		FILE_NOTIFY_CHANGE_LAST_ACCESS: 0x00000020,
		FILE_NOTIFY_CHANGE_CREATION: 0x00000040,
		FILE_NOTIFY_CHANGE_SECURITY: 0x00000100,
		FILE_SHARE_DELETE: 4,
		FILE_SHARE_READ: 1,
		FILE_SHARE_WRITE: 2,
		GENERIC_READ: 31, // from https://msdn.microsoft.com/en-us/library/windows/desktop/aa374892%28v=vs.85%29.aspx i have no idea where i got 0x80000000 from // 0x80000000,
		INVALID_HANDLE_VALUE: -1,
		MAXIMUM_WAIT_OBJECTS: 64,
		MB_OK: 0,
		OPEN_EXISTING: 3,
		WAIT_ABANDONED_0: 0x00000080, // 128
		WAIT_FAILED: self.TYPE.DWORD('0xFFFFFFFF'),
		WAIT_IO_COMPLETION: 0x000000C0, // 192
		WAIT_OBJECT_0: 0,
		WAIT_TIMEOUT: 0x00000102 // 258
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
				/* for libc which is unix
				case 'libc':
				
					if (core.os.name == 'darwin') {
						_lib[path] = ctypes.open('libc.dylib');
					} else if (core.os.name == 'freebsd') {
						_lib[path] = ctypes.open('libc.so.7');
					} else if (core.os.name == 'openbsd') {
						_lib[path] = ctypes.open('libc.so.61.0');
					} else if (core.os.name == 'sunos') {
						_lib[path] = ctypes.open('libc.so');
					} else {
						throw new Error({
							name: 'watcher-api-error',
							message: 'Path to libc on operating system of , "' + OS.Constants.Sys.Name + '" is not supported for kqueue'
						});
					}
					
					break;
				*/
				default:
					try {
						_lib[path] = ctypes.open(path);
					} catch (e) {
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
		CancelIoEx: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/aa363792%28v=vs.85%29.aspx
			 * BOOL WINAPI CancelIoEx(
			 *   __in_     HANDLE       hFile,
			 *   __in_opt_ LPOVERLAPPED lpOverlapped
			 * );
			 */
			return lib('kernel32').declare('CancelIoEx', self.TYPE.ABI,
				self.TYPE.BOOL,			// return
				self.TYPE.HANDLE,		// hObject
				self.TYPE.LPOVERLAPPED	// lpOverlapped
			);
		},
		CloseHandle: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/ms724211%28v=vs.85%29.aspx
			 * BOOL WINAPI CloseHandle(
			 *   __in_  HANDLE hObject
			 * );
			 */
			return lib('kernel32').declare('CloseHandle', self.TYPE.ABI,
				self.TYPE.BOOL,		// return
				self.TYPE.HANDLE	// hObject
			);
		},
		CreateFile: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/aa363858%28v=vs.85%29.aspx
			 * HANDLE WINAPI CreateFile(
			 *   __in_      LPCTSTR lpFileName,
			 *   __in_      DWORD dwDesiredAccess,
			 *   __in_      DWORD dwShareMode,
			 *   __in_opt_  LPSECURITY_ATTRIBUTES lpSecurityAttributes,
			 *   __in_      DWORD dwCreationDisposition,
			 *   __in_      DWORD dwFlagsAndAttributes,
			 *   __in_opt_  HANDLE hTemplateFile
			 * );
			 */
			return lib('kernel32').declare(ifdef_UNICODE ? 'CreateFileW' : 'CreateFileA', self.TYPE.ABI,
				self.TYPE.HANDLE,					// return
				self.TYPE.LPCTSTR,					// lpFileName
				self.TYPE.DWORD,					// dwDesiredAccess
				self.TYPE.DWORD,					// dwShareMode
				self.TYPE.LPSECURITY_ATTRIBUTES,	// lpSecurityAttributes
				self.TYPE.DWORD,					// dwCreationDisposition
				self.TYPE.DWORD,					// dwFlagsAndAttributes
				self.TYPE.HANDLE					// hTemplateFile
			);
		},
		CreateEvent: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/ms682396%28v=vs.85%29.aspx
			 * HANDLE WINAPI CreateEvent(
			 *  __in_opt_  LPSECURITY_ATTRIBUTES lpEventAttributes,
			 *  __in_      BOOL bManualReset,
			 *  __in_      BOOL bInitialState,
			 *  __in_opt_  LPCTSTR lpName
			 * );
			 */
			return lib('kernel32').declare(ifdef_UNICODE ? 'CreateEventW' : 'CreateEventA', self.TYPE.ABI,
				self.TYPE.HANDLE,					// return
				self.TYPE.LPSECURITY_ATTRIBUTES,	// lpEventAttributes
				self.TYPE.BOOL,						// bManualReset
				self.TYPE.BOOL,						// bInitialState
				self.TYPE.LPCTSTR					// lpName
			);
		},
		CreateIoCompletionPort: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/aa363862%28v=vs.85%29.aspx
			 *   HANDLE WINAPI CreateIoCompletionPort(
			 *     __in_      HANDLE FileHandle,
			 *     __in_opt_  HANDLE ExistingCompletionPort,
			 *     __in_      ULONG_PTR CompletionKey,
			 *     __in_      DWORD NumberOfConcurrentThreads
			 *   );
			 */
			return lib('kernel32').declare('CreateIoCompletionPort', self.TYPE.ABI,
				self.TYPE.HANDLE,		// return
				self.TYPE.HANDLE,		// FileHandle
				self.TYPE.HANDLE,		// ExistingCompletionPort
				self.TYPE.ULONG_PTR,	// CompletionKey
				self.TYPE.DWORD			// NumberOfConcurrentThreads
			);
		},
		GetOverlappedResult: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/ms683209%28v=vs.85%29.aspx
			 * BOOL WINAPI GetOverlappedResult(
			 *  __in_   HANDLE hFile,
			 *  __in_   LPOVERLAPPED lpOverlapped,
			 *  __out_  LPDWORD lpNumberOfBytesTransferred,
			 *  __in_   BOOL bWait
			 * );
			 */
			return lib('kernel32').declare('GetOverlappedResult', self.TYPE.ABI,
				self.TYPE.BOOL,			// return
				self.TYPE.HANDLE,		// hFile
				self.TYPE.LPOVERLAPPED,	// lpOverlapped
				self.TYPE.LPDWORD,		// lpNumberOfBytesTransferred
				self.TYPE.BOOL			// bWait
			);
		},
		GetQueuedCompletionStatus: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/aa364986%28v=vs.85%29.aspx
			 * BOOL WINAPI GetQueuedCompletionStatus(
			 *   __in_   HANDLE CompletionPort,
			 *   __out_  LPDWORD lpNumberOfBytes,
			 *   __out_  PULONG_PTR lpCompletionKey,
			 *   __out_  LPOVERLAPPED *lpOverlapped,
			 *   __in_   DWORD dwMilliseconds
			 * );
			 */
			return lib('kernel32').declare('GetQueuedCompletionStatus', self.TYPE.ABI,
				self.TYPE.BOOL,			// return
				self.TYPE.HANDLE,		// CompletionPort
				self.TYPE.LPDWORD,		// lpNumberOfBytes
				self.TYPE.PULONG_PTR,	// lpCompletionKey
				self.TYPE.LPOVERLAPPED,	// *lpOverlapped
				self.TYPE.DWORD			// dwMilliseconds
			);
		},
		MessageBox: function() {
			/*
				int WINAPI MessageBox(
				  _In_opt_  HWND hWnd,
				  _In_opt_  LPCTSTR lpText,
				  _In_opt_  LPCTSTR lpCaption,
				  _In_      UINT uType
				);
			*/
			return lib('user32').declare(ifdef_UNICODE ? 'MessageBoxW' : 'MessageBoxA', self.TYPE.ABI,
				self.TYPE.INT,			// return
				self.TYPE.HWND,			// hWnd
				self.TYPE.LPCTSTR,		// lpText
				self.TYPE.LPCTSTR,		// lpCaption
				self.TYPE.UINT			// uType
			);
		},
		ReadDirectoryChanges: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/aa365465%28v=vs.85%29.aspx
			 * BOOL WINAPI ReadDirectoryChangesW(
			 *   __in_         HANDLE hDirectory,
			 *   __out_        LPVOID lpBuffer,
			 *   __in_         DWORD nBufferLength,
			 *   __in_         BOOL bWatchSubtree,
			 *   __in_         DWORD dwNotifyFilter,
			 *   __out_opt_    LPDWORD lpBytesReturned,
			 *   __inout_opt_  LPOVERLAPPED lpOverlapped,
			 *   __in_opt_     LPOVERLAPPED_COMPLETION_ROUTINE lpCompletionRoutine
			 * );
			 */
			return lib('kernel32').declare('ReadDirectoryChangesW', self.TYPE.ABI,
				self.TYPE.BOOL,								// return
				self.TYPE.HANDLE,							// hDirectory,
				self.TYPE.LPVOID,							// lpBuffer,
				self.TYPE.DWORD,							// nBufferLength,
				self.TYPE.BOOL,								// bWatchSubtree,
				self.TYPE.DWORD,							// dwNotifyFilter,
				self.TYPE.LPDWORD,							// lpBytesReturned,
				self.TYPE.LPOVERLAPPED,						// lpOverlapped,
				self.TYPE.LPOVERLAPPED_COMPLETION_ROUTINE	// lpCompletionRoutine
			);
		},
		SleepEx: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/ms686307%28v=vs.85%29.aspx
			 * DWORD WINAPI SleepEx(
			 *   __in_  DWORD dwMilliseconds,
			 *   __in_  BOOL bAlertable
			 * );
			 */
			return lib('kernel32').declare('SleepEx', self.TYPE.ABI,
				self.TYPE.DWORD,	// return
				self.TYPE.DWORD,	// dwMilliseconds
				self.TYPE.BOOL		//bAlertable
			);
		},
		WaitForMultipleObjectsEx: function() {
			/* https://msdn.microsoft.com/en-us/library/windows/desktop/ms687028%28v=vs.85%29.aspx
			 * DWORD WINAPI WaitForMultipleObjectsEx(
			 *   __in_  DWORD nCount,
			 *   __in_  const HANDLE *lpHandles,
			 *   __in_  BOOL bWaitAll,
			 *   __in_  DWORD dwMilliseconds,
			 *   __in_  BOOL bAlertable
			 * );
			 */
			return lib('kernel32').declare('WaitForMultipleObjectsEx', self.TYPE.ABI,
				self.TYPE.DWORD,		// return
				self.TYPE.DWORD,		// nCount
				self.TYPE.HANDLE.ptr,	// *lpHandles
				self.TYPE.BOOL,			// bWaitAll
				self.TYPE.DWORD,		// dwMilliseconds
				self.TYPE.BOOL			// bAlertable
			);
		}
	};
	// end - predefine your declares here
	// end - function declares
	
	this.HELPER = {
		checkHRESULT: function(hr /*HRESULT*/, funcName /*jsStr*/) {
			if(parseInt(cutils.jscGetDeepest(hr)) < 0) {
				throw new Error('HRESULT ' + hr + ' returned from function ' + funcName);
			}
		},
		CLSIDFromString: function(lpsz /*jsStr*/) {
			// lpsz should look like: "886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99" no quotes
			var GUID_or_IID = self.TYPE.GUID();

			var pieces = lpsz.split('-');
			
			GUID_or_IID.Data1 = parseInt(pieces[0], 16);
			GUID_or_IID.Data2 = parseInt(pieces[1], 16);
			GUID_or_IID.Data3 = parseInt(pieces[2], 16);
			
			var piece34 = pieces[3] + '' + pieces[4];
			
			for (var i=0; i<8; i++) {
			  GUID_or_IID.Data4[i] = parseInt(piece34.substr(i*2,2), 16);
			};

			return GUID_or_IID;
		}
	};
}

var ostypes = new winInit();