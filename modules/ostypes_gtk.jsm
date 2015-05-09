var EXPORTED_SYMBOLS = ['ostypes'];

// no need to define core or import cutils as all the globals of the worker who importScripts'ed it are availble here

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

var gtkTypes = function() {

	// ABIs
	this.CALLBACK_ABI = ctypes.default_abi;
	this.ABI = ctypes.default_abi;
  
	// C TYPES
	this.char = ctypes.char;
	this.int = ctypes.int;
	this.long = ctypes.long;
	this.size_t = ctypes.size_t;
	this.ssize_t = ctypes.ssize_t;
	this.uint32_t = ctypes.uint32_t;
	this.void = ctypes.void_t;

	// SIMPLE TYPES
	this.CARD32 = /^(Alpha|hppa|ia64|ppc64|s390|x86_64)-/.test(core.os.xpcomabi) ? ctypes.unsigned_int : ctypes.unsigned_long;
	this.gchar = ctypes.char;
	this.GCancellable = ctypes.StructType('_GCancellable');
	this.GdkDisplay = ctypes.StructType('GdkDisplay');
	this.GdkDrawable = ctypes.StructType('GdkDrawable');
	this.GdkWindow = ctypes.StructType('GdkWindow');
	this.GFile = ctypes.StructType('_GFile');
	this.GFileMonitor = ctypes.StructType('_GFileMonitor');
	this.GdkScreen = ctypes.StructType('GdkScreen');
	this.GtkWidget = ctypes.StructType('GtkWidget');
	this.GtkWindow = ctypes.StructType('GtkWindow');
	this.gint = ctypes.int;
	this.gpointer = ctypes.void_t.ptr;
	this.guint32 = ctypes.unsigned_int;
	this.gulong = ctypes.unsigned_long;
	
	// ADVANCED TYPES // defined by "simple types"
	this.gboolean = this.gint;
	this.GQuark = this.guint32;
	this.Window = this.CARD32;
	this.XID =  this.CARD32;
	
	// SUPER ADVANCED TYPES // defined by "advanced types"

	// SUPER DUPER ADVANCED TYPES // defined by "super advanced types"
	
	// GUESS/INACCURATE TYPES AS THEY ARE ENUM OR SOMETHING I COULDNT FIND BUT THE FOLLOWING WORK FOR MY APPLICATIONS
	this.GCallback = ctypes.voidptr_t;
	this.GdkPixbuf = ctypes.StructType('GdkPixbuf');
	this.GFileMonitorEvent = ctypes.unsigned_int;
	this.GFileMonitorFlags = ctypes.unsigned_int;
	this.GClosureNotify	= ctypes.voidptr_t;
	this.GConnectFlags = ctypes.unsigned_int;
	
	// STRUCTURES
	// consts for structures
	var struct_const = {
		
	};
	
	// SIMPLE STRUCTS // based on any of the types above
	this.cairo_rectangle_int_t = ctypes.StructType('cairo_rectangle_int_t', [ // https://developer.gnome.org/cairo/stable/cairo-Types.html#cairo-rectangle-int-t
		{ x:		this.int },
		{ y:		this.int },
		{ width:	this.int },
		{ height:	this.int }
	]);
	this.GdkRectangle = ctypes.StructType('GdkRectangle', [ // https://developer.gnome.org/gdk3/stable/gdk3-Points-Rectangles-and-Regions.html#GdkRectangle
		{ x:		this.int },
		{ y:		this.int },
		{ width:	this.int },
		{ height:	this.int }
	]);
	this.GdkPoint = ctypes.StructType('GdkPoint', [ // https://developer.gnome.org/gdk3/stable/gdk3-Points-Rectangles-and-Regions.html#GdkPoint
		{ x:	this.gint },
		{ y:	this.gint }
	]);
	this.GError = ctypes.StructType('GError', [ // https://developer.gnome.org/glib/stable/glib-Error-Reporting.html#GError
		{ domain: this.GQuark },
		{ code: this.gint },
		{ message: this.gchar.ptr }
	]);
	// ADVANCED STRUCTS // based on "simple structs" to be defined first

	// FURTHER ADVANCED STRUCTS
	
	// FURTHER ADV STRUCTS

	// FUNCTION TYPES

	// STRUCTS USING FUNC TYPES

}

var gtkInit = function() {
	var self = this;

	this.IS64BIT = is64bit;

	this.TYPE = new gtkTypes();

	// CONSTANTS
	this.CONST = {
		
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
				case 'gdk2':
				
						_lib[path] = ctypes.open('libgdk-x11-2.0.so.0');
				
					break;
				case 'gdk3':
				
						_lib[path] = ctypes.open('libgdk-3.so.0');
				
					break;
				case 'gtk':
				
						_lib[path] = ctypes.open('libgtk-x11-2.0.so.0');
				
					break;
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
				case 'x11':
				
						_lib[path] = ctypes.open('libX11.so.6');
				
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
		gtk_widget_get_window: function() {
			/* https://developer.gnome.org/gtk3/stable/GtkWidget.html#gtk-widget-get-window
			 * GdkWindow *gtk_widget_get_window (
			 *   GtkWidget *widget
			 * );
			 */
			return lib('gtk').declare('gtk_widget_get_window', self.TYPE.ABI,
				self.TYPE.GdkWindow.ptr,	// *return
				self.TYPE.GdkWidget.ptr		// *widget
			);
		},
		gdk_x11_drawable_get_xid: function() {
			/* https://developer.gnome.org/gdk2/stable/gdk2-X-Window-System-Interaction.html#gdk-x11-drawable-get-xid
			 * XID gdk_x11_drawable_get_xid (
			 *   GdkDrawable *drawable
			 * );
			 */
			return lib('gdk2').declare('gdk_x11_drawable_get_xid', self.TYPE.ABI,
				self.TYPE.XID,				// return
				self.TYPE.GdkDrawable.ptr	// *drawable
			);
		},
		gdk_window_get_user_data: function() {
			/* https://developer.gnome.org/gdk3/stable/gdk3-Windows.html#gdk-window-get-user-data
			 * void gdk_window_get_user_data (
			 *   GdkWindow *window,
			 *   gpointer *data
			 * );
			 */
			return lib('gdk2').declare('gdk_window_get_user_data', self.TYPE.ABI,
				self.TYPE.void,				// return
				self.TYPE.GdkWindow.ptr,	// *window
				self.TYPE.gpointer.ptr		// *data
			);
		},
		gdk_x11_window_lookup_for_display: function() {
			/* https://developer.gnome.org/gdk2/stable/gdk2-X-Window-System-Interaction.html#gdk-x11-window-lookup-for-display
			 * GdkWindow *gdk_x11_window_lookup_for_display (
			 *   GdkDisplay *display,
			 *   Window window
			 * );
			 */
			return lib('gdk2').declare('gdk_x11_window_lookup_for_display', self.TYPE.ABI,
				self.TYPE.GdkWindow.ptr,	// *return
				self.TYPE.GdkDisplay.ptr,	// *display
				self.TYPE.Window			// window
			);
		},
		gdk_get_default_root_window: function() {
			/* https://developer.gnome.org/gdk3/stable/gdk3-Windows.html#gdk-get-default-root-window
			 * GdkWindow *gdk_get_default_root_window (
			 *   void
			 * );
			 */
			return lib('gdk2').declare('gdk_get_default_root_window', self.TYPE.ABI,
				self.TYPE.GdkWindow.ptr		// *return
			);
		},
		gtk_window_get_size: function() {
			/* https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-get-size
			 * void gtk_window_get_size (
			 *   GtkWindow *window,
			 *   gint *width,
			 *   gint *height
			 * );
			 */
			return lib('gtk').declare('gtk_window_get_size', self.TYPE.ABI,
				self.TYPE.void,					// return
				self.TYPE.GtkWindow.ptr,		// *window
				self.TYPE.gint.ptr,				// *width
				self.TYPE.gint.ptr				// *height
			);
		},
		gdk_pixbuf_get_from_drawable: function() {},
		gdk_pixbuf_new: function() {}, // https://developer.gnome.org/gdk-pixbuf/stable/gdk-pixbuf-Image-Data-in-Memory.html#gdk-pixbuf-new
		gdk_pixbuf_get_width: function() {}, // https://developer.gnome.org/gdk-pixbuf/stable/gdk-pixbuf-The-GdkPixbuf-Structure.html#gdk-pixbuf-get-width
		gdk_pixbuf_get_height: function() {}, // https://developer.gnome.org/gdk-pixbuf/stable/gdk-pixbuf-The-GdkPixbuf-Structure.html#gdk-pixbuf-get-height
		gdk_pixbuf_get_pixels: function() {}, // https://developer.gnome.org/gdk-pixbuf/stable/gdk-pixbuf-The-GdkPixbuf-Structure.html#gdk-pixbuf-get-pixels
		
		gdk_display_get_default: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkDisplay.html#gdk-display-get-default
			 * GdkDisplay *gdk_display_get_default (
			 *   void
			 * );
			 */
			return lib('gdk2').declare('gdk_display_get_default', self.TYPE.ABI,
				self.TYPE.GdkDisplay.ptr	// *return
			);
		},
		gdk_display_get_n_screens: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkDisplay.html#gdk-display-get-n-screens
			 * NOTE: gdk_display_get_n_screens has been deprecated since version 3.10 and should not be used in newly-written code. The number of screens is always 1.
			 * gint gdk_display_get_n_screens (
			 *   GdkDisplay *display
			 * );
			 */
			return lib('gdk2').declare('gdk_display_get_n_screens', self.TYPE.ABI,
				self.TYPE.gint,				// return
				self.TYPE.GdkDisplay.ptr	// *display
			);
		},
		gdk_screen_get_monitor_geometry: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkScreen.html#gdk-screen-get-monitor-geometry
			 * void gdk_screen_get_monitor_geometry (
			 *   GdkScreen *screen,
			 *   gint monitor_num,
			 *   GdkRectangle *dest
			 * );
			 */
			return lib('gdk2').declare('gdk_screen_get_monitor_geometry', self.TYPE.ABI,
				self.TYPE.void,				// return
				self.TYPE.GdkScreen.ptr,	// *screen
				self.TYPE.gint,				// monitor_num
				self.TYPE.GdkRectangle.ptr	// *dest
			);
		},
		gdk_display_get_screen: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkDisplay.html#gdk-display-get-screen
			 * GdkScreen *gdk_display_get_screen (
			 *   GdkDisplay *display,
			 *   gint screen_num
			 * );
			 */
			return lib('gdk2').declare('gdk_display_get_screen', self.TYPE.ABI,
				self.TYPE.GdkScreen.ptr,	// *return
				self.TYPE.GdkDisplay.ptr,	// *display
				self.TYPE.gint				// screen_num
			);
		},
		gdk_display_get_default_screen: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkDisplay.html#gdk-display-get-default-screen
			 * GdkScreen *gdk_display_get_default_screen (
			 *   GdkDisplay *display
			 * );
			 */
			return lib('gdk2').declare('gdk_display_get_default_screen', self.TYPE.ABI,
				self.TYPE.GdkScreen.ptr,	// *return
				self.TYPE.GdkDisplay.ptr	// *display
			);
		}
		// libgdk_pixbuf-2.0-0
	};
	// end - predefine your declares here
	// end - function declares

	this.HELPER = {
		gdkWinPtrToXID: function(aGDKWindowPtrStr, aGDKWindowPtr) {
			// pass str or ptr. reason for str option is because baseWindow.nativeHandle is a ptrstr
			if (aGDKWindowPtrStr) {
				var GdkWinPtr = self.TYPE.GdkWindow.ptr(ctypes.UInt64(aGDKWindowPtrStr));
			} else if (aGDKWindowPtr) {
				var GdkWinPtr = aGDKWindowPtr;
			}
			var GdkDrawPtr = ctypes.cast(GdkWinPtr, self.TYPE.GdkDrawable.ptr);
			var xidOfWin = self.API('gdk_x11_drawable_get_xid')(GdkDrawPtr);
			return xidOfWin;
		},
		gdkWinPtrToGtkWinPtr: function(aGDKWindowPtrStr, aGDKWindowPtr) {
			// pass str or ptr. reason for str option is because baseWindow.nativeHandle is a ptrstr
			if (aGDKWindowPtrStr) {
				var GdkWinPtr = self.TYPE.GdkWindow.ptr(ctypes.UInt64(aGDKWindowPtrStr));
			} else if (aGDKWindowPtr) {
				var GdkWinPtr = aGDKWindowPtr;
			}
			var gptr = self.TYPE.gpointer();
			self.API('gdk_window_get_user_data')(GdkWinPtr, gptr.address());
			var GtkWinPtr = ctypes.cast(gptr, self.TYPE.GtkWindow.ptr);
			return GtkWinPtr;
		},
		gtkWinPtrToXID: function(aGTKWinPtr) {
			var aGDKWinPtr = self.TYPE.HELPER.gtkWinPtrToGdkWinPtr(aGTKWinPtr);
			var aXID = self.TYPE.HELPER.gdkWinPtrToXID(null, aGDKWinPtr);
			return aXID;
		},
		gtkWinPtrToGdkWinPtr: function(aGTKWinPtr) {
			var gtkWidgetPtr = ctypes.cast(aGTKWinPtr, self.TYPE.GtkWidget.ptr);
			var backTo_gdkWinPtr = self.API('gtk_widget_get_window')(gtkWidgetPtr);
			return backTo_gdkWinPtr;
		},
		xidToGdkWinPtr: function(aXID) {
			// todo: figure out how to use gdk_x11_window_lookup_for_display and switch to that, as apparently gdk_xid_table_lookup was deprecated since 2.24
			var aGpointer = self.API('gdk_xid_table_lookup')(aXID);
			var aGDKWinPtr = ctypes.cast(aGpointer, self.TYPE.GdkWindow.ptr);
			return aGDKWinPtr;
		},
		xidToGtkWinPtr: function(aXID) {
			var aGDKWinPtr = self.HELPER.xidToGdkWinPtr(aXID);
			var aGTKWinPtr = self.HELPER.gdkWinPtrToGtkWinPtr(aGDKWinPtr);
			return aGTKWinPtr;
		}
	};
}

var ostypes = new gtkInit();