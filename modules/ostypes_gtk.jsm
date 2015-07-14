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
	this.GBytes = ctypes.StructType('_GBytes');
	this.GCancellable = ctypes.StructType('_GCancellable');
	this.GdkColormap = ctypes.StructType('GdkColormap');
	this.GdkDisplay = ctypes.StructType('GdkDisplay');
	this.GdkDisplayManager = ctypes.StructType('GdkDisplayManager');
	this.GdkDrawable = ctypes.StructType('GdkDrawable');
	this.GdkFullscreenMode = ctypes.int;
	this.GdkGravity = ctypes.int;
	this.GdkPixbuf = ctypes.StructType('GdkPixbuf');
	this.GdkScreen = ctypes.StructType('GdkScreen');
	this.GdkWindow = ctypes.StructType('GdkWindow');
	this.GdkWindowHints = ctypes.int;
	this.GdkWindowTypeHint = ctypes.int;
	this.gdouble = ctypes.double;
	this.GFile = ctypes.StructType('_GFile');
	this.GFileMonitor = ctypes.StructType('_GFileMonitor');
	this.gint = ctypes.int;
	this.gpointer = ctypes.void_t.ptr;
	this.GtkWidget = ctypes.StructType('GtkWidget');
	this.GtkWindow = ctypes.StructType('GtkWindow');
	this.GtkWindowPosition = ctypes.int;
	this.guchar = ctypes.unsigned_char;
	this.guint = ctypes.unsigned_int;
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
	this.GdkDeviceType = ctypes.int; // its enum: https://developer.gnome.org/gdk3/stable/GdkDevice.html#GdkDeviceType so this is a pretty good guess, i need to figure out though what exactly enum is. 
	
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
	this.GList = ctypes.StructType('GList');
	this.GList.define([
		{'data': this.gpointer},
		{'next': this.GList.ptr},
	]);
	this.GSList = ctypes.StructType('GList');
	this.GSList.define([ // https://developer.gnome.org/glib/unstable/glib-Singly-Linked-Lists.html#GSList
		{'data': this.gpointer},
		{'next': this.GSList.ptr}
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
	this.GdkGeometry = ctypes.StructType('GdkGeometry', [ // https://developer.gnome.org/gdk3/stable/gdk3-Windows.html#GdkGeometry
		{ min_width: this.gint },
		{ min_height: this.gint },
		{ max_width: this.gint },
		{ max_height: this.gint },
		{ base_width: this.gint },
		{ base_height: this.gint },
		{ width_inc: this.gint },
		{ height_inc: this.gint },
		{ min_aspect: this.gdouble },
		{ max_aspect: this.gdouble },
		{ win_gravity: this.GdkGravity }
	]);
	// ADVANCED STRUCTS // based on "simple structs" to be defined first

	// FURTHER ADVANCED STRUCTS
	
	// FURTHER ADV STRUCTS

	// FUNCTION TYPES
	this.GFunc = ctypes.FunctionType(this.CALLBACK_ABI, this.void, [this.gpointer, this.gpointer]).ptr;
	// STRUCTS USING FUNC TYPES

}

var gtkInit = function() {
	var self = this;

	this.IS64BIT = is64bit;

	this.TYPE = new gtkTypes();

	// CONSTANTS
	this.CONST = {
		GDK_FULLSCREEN_ON_CURRENT_MONITOR: 0,
		GDK_FULLSCREEN_ON_ALL_MONITORS: 1,
		WINDOW_TYPE_HINT_SPLASHSCREEN: 4,
		GTK_WIN_POS_NONE: 0,
		GDK_HINT_POS: 0,
		GDK_HINT_MIN_SIZE: 1,
		GDK_HINT_MAX_SIZE: 2,
		GDK_HINT_BASE_SIZE: 3,
		GDK_HINT_ASPECT: 4,
		GDK_HINT_RESIZE_INC: 5,
		GDK_HINT_WIN_GRAVITY: 6,
		GDK_HINT_USER_POS: 7,
		GDK_HINT_USER_SIZE: 8,
		GDK_GRAVITY_NORTH_WEST: 0,
		GDK_GRAVITY_NORTH: 1,
		GDK_GRAVITY_NORTH_EAST: 2,
		GDK_GRAVITY_WEST: 3,
		GDK_GRAVITY_CENTER: 4,
		GDK_GRAVITY_EAST: 5,
		GDK_GRAVITY_SOUTH_WEST: 6,
		GDK_GRAVITY_SOUTH: 7,
		GDK_GRAVITY_SOUTH_EAST: 8,
		GDK_GRAVITY_STATIC: 9
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
				case 'gtk2':
				
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
						}  else if (core.os.name == 'linux') {
							_lib[path] = ctypes.open('libc.so.6');
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
			return lib('gtk2').declare('gtk_widget_get_window', self.TYPE.ABI,
				self.TYPE.GdkWindow.ptr,	// *return
				self.TYPE.GtkWidget.ptr		// *widget
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
			return lib('gtk2').declare('gtk_window_get_size', self.TYPE.ABI,
				self.TYPE.void,					// return
				self.TYPE.GtkWindow.ptr,		// *window
				self.TYPE.gint.ptr,				// *width
				self.TYPE.gint.ptr				// *height
			);
		},
		gdk_pixbuf_get_from_drawable: function() {
			/* https://developer.gnome.org/gdk2/stable/gdk2-Pixbufs.html#gdk-pixbuf-get-from-drawable
			 * GdkPixbuf *gdk_pixbuf_get_from_drawable (
			 *   GdkPixbuf *dest,
			 *   GdkDrawable *src,
			 *   GdkColormap *cmap,
			 *   int src_x,
			 *   int src_y,
			 *   int dest_x,
			 *   int dest_y,
			 *   int width,
			 *   int height
			 * );
			 */
			return lib('gdk2').declare('gdk_pixbuf_get_from_drawable', self.TYPE.ABI,
				self.TYPE.GdkPixbuf.ptr,	// return
				self.TYPE.GdkPixbuf.ptr,	// *dest
				self.TYPE.GdkDrawable.ptr,	// *src
				self.TYPE.GdkColormap.ptr,	// *cmap
				self.TYPE.int,				// src_x
				self.TYPE.int,				// src_y
				self.TYPE.int,				// dest_x
				self.TYPE.int,				// dest_y
				self.TYPE.int,				// width
				self.TYPE.int				// height
			);
		},
		gdk_pixbuf_new: function() {}, // https://developer.gnome.org/gdk-pixbuf/stable/gdk-pixbuf-Image-Data-in-Memory.html#gdk-pixbuf-new
		gdk_pixbuf_get_width: function() {}, // https://developer.gnome.org/gdk-pixbuf/stable/gdk-pixbuf-The-GdkPixbuf-Structure.html#gdk-pixbuf-get-width
		gdk_pixbuf_get_height: function() {}, // https://developer.gnome.org/gdk-pixbuf/stable/gdk-pixbuf-The-GdkPixbuf-Structure.html#gdk-pixbuf-get-height
		gdk_pixbuf_get_pixels: function() {
			/* https://developer.gnome.org/gdk-pixbuf/stable/gdk-pixbuf-The-GdkPixbuf-Structure.html#gdk-pixbuf-get-pixels
			 * guchar *gdk_pixbuf_get_pixels (
			 *   const GdkPixbuf *pixbuf
			 * );
			 */
			return lib('gdk2').declare('gdk_pixbuf_get_pixels', self.TYPE.ABI,
				self.TYPE.guchar.ptr,		// return
				self.TYPE.GdkPixbuf.ptr		// *pixbuf
			);
		},
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
				self.TYPE.GdkDisplay.ptr	// *display // self.TYPE.gpointer //
			);
		},
		gdk_screen_get_root_window: function() {
			/* https://developer.gnome.org/gdk3/unstable/GdkScreen.html#gdk-screen-get-root-window
			 * GdkWindow *gdk_screen_get_root_window (
			 *   GdkScreen *screen
			 * );
			 */
			return lib('gdk2').declare('gdk_screen_get_root_window', self.TYPE.ABI,
				self.TYPE.GdkWindow.ptr,	// return
				self.TYPE.GdkScreen.ptr		// *screen
			);
		},
		gdk_screen_get_width: function() {
			/* https://developer.gnome.org/gdk3/unstable/GdkScreen.html#gdk-screen-get-width
			 * gint gdk_screen_get_width (
			 *   GdkScreen *screen
			 * );
			 */
			return lib('gdk2').declare('gdk_screen_get_width', self.TYPE.ABI,
				self.TYPE.gint,	// return
				self.TYPE.GdkScreen.ptr	// *screen
			);
		},
		gdk_screen_get_height: function() {
			/* https://developer.gnome.org/gdk3/unstable/GdkScreen.html#gdk-screen-get-height
			 * gint gdk_screen_get_height (
			 *   GdkScreen *screen
			 * );
			 */
			return lib('gdk2').declare('gdk_screen_get_height', self.TYPE.ABI,
				self.TYPE.gint,	// return
				self.TYPE.GdkScreen.ptr	// *screen
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
				self.TYPE.GdkDisplay.ptr,	// *display // self.TYPE.gpointer, //
				self.TYPE.gint				// screen_num
			);
		},
		gdk_screen_get_n_monitors: function() {
			/* https://developer.gnome.org/gdk3/unstable/GdkScreen.html#gdk-screen-get-n-monitors
			 * gint gdk_screen_get_n_monitors (
			 *   GdkScreen *screen
			 * );
			 */
			return lib('gdk2').declare('gdk_screen_get_n_monitors', self.TYPE.ABI,
				self.TYPE.gint,	// return
				self.TYPE.GdkScreen.ptr	// *screen
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
		},
		gdk_display_manager_get: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkDisplayManager.html#gdk-display-manager-get
			 * GdkDisplayManager *gdk_display_manager_get (
			 *   void
			 * );
			 */
			return lib('gdk2').declare('gdk_display_manager_get', self.TYPE.ABI,
				self.TYPE.GdkDisplayManager.ptr		// *return
			);
		},
		gdk_display_manager_list_displays: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkDisplayManager.html#gdk-display-manager-list-displays
			 * GSList *gdk_display_manager_list_displays (
			 *   GdkDisplayManager *manager
			 * );
			 */
			return lib('gdk2').declare('gdk_display_manager_list_displays', self.TYPE.ABI,
				self.TYPE.GSList.ptr,				// *return
				self.TYPE.GdkDisplayManager.ptr		// *manager
			);
		},
		gdk_display_get_window_at_pointer: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkDisplay.html#gdk-display-get-window-at-pointer
			 * NOTE: gdk_display_get_window_at_pointer has been deprecated since version 3.0 and should not be used in newly-written code. Use gdk_device_get_window_at_position() instead.
			 * GdkWindow * gdk_display_get_window_at_pointer (
			 *   GdkDisplay *display,
			 *   gint *win_x,
			 *   gint *win_y
			 * );
			 */
			return lib('gdk2').declare('gdk_window_at_pointer', self.TYPE.ABI,
				self.TYPE.GdkDisplay.ptr,	// *display
				self.TYPE.gint.ptr,	// *win_x
				self.TYPE.gint.ptr	// *win_y
			);
		},
		gdk_device_get_window_at_position: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkDevice.html#gdk-device-get-window-at-position
			 * GdkWindow * gdk_device_get_window_at_position (
			 *   GdkDevice *device,
			 *   gint *win_x,
			 *   gint *win_y
			 * );
			 */
			return lib('gdk3').declare('gdk_device_get_window_at_position', self.TYPE.ABI,
				self.TYPE.GdkDisplay.ptr,	// *display
				self.TYPE.gint.ptr,			// *win_x
				self.TYPE.gint.ptr			// *win_y			
			);
		},
		gdk_device_get_device_type: function() {
			/* https://developer.gnome.org/gdk3/stable/GdkDevice.html#gdk-device-get-device-type
			 * GdkDeviceType gdk_device_get_device_type (
			 *   GdkDevice *device
			 * );
			 */
			return lib('gdk2').declare('gdk_device_get_device_type', self.TYPE.ABI,
				self.TYPE.GdkDeviceType,	// return
				self.TYPE.GdkDevice.ptr		// *device
			);
		},
		gdk_pixbuf_get_from_window: function() {
			/* https://developer.gnome.org/gdk3/stable/gdk3-Pixbufs.html#gdk-pixbuf-get-from-window
			 * GdkPixbuf *gdk_pixbuf_get_from_window (
			 *   GdkWindow *window,
			 *   gint src_x,
			 *   gint src_y,
			 *   gint width,
			 *   gint height
			 * );
			 */
			return lib('gdk3').declare('gdk_pixbuf_get_from_window', self.TYPE.ABI,
				self.TYPE.GdkPixbuf.ptr,		// return
				self.TYPE.GdkWindow.ptr,		// *window
				self.TYPE.gint,					// src_x
				self.TYPE.gint,					// src_y
				self.TYPE.gint,					// width
				self.TYPE.gint					// height
			);
		},
		g_slist_free: function() {
			/* https://developer.gnome.org/glib/unstable/glib-Singly-Linked-Lists.html#g-slist-free
			 * void g_slist_free (
			 *   GSList *list
			 * );
			 */
			return lib('gdk2').declare('g_slist_free', self.TYPE.ABI,
				self.TYPE.void,			// return
				self.TYPE.GSList.ptr	// *list
			);
		},
		g_slist_foreach: function() {
			/* https://developer.gnome.org/glib/unstable/glib-Singly-Linked-Lists.html#g-slist-foreach
			 * void g_slist_foreach (
			 *   GSList *list,
             *   GFunc func,
             *   gpointer user_data
			 * );
			 */
			return lib('gdk2').declare('g_slist_foreach', self.TYPE.ABI,
				self.TYPE.void,		// return
				self.TYPE.GSList.ptr,	// *list
				self.TYPE.GFunc,		// func
				self.TYPE.gpointer		// user_data
			);
		},
		gdk_threads_init: function() {
			/* https://developer.gnome.org/gdk3/unstable/gdk3-Threads.html#gdk-threads-init
			 * void gdk_threads_init (
			 *   void
			 * );
			 */
			return lib('gdk2').declare('gdk_threads_init', self.TYPE.ABI,
				self.TYPE.void	// return
			);
		},
		gtk_init: function() {
			/* https://developer.gnome.org/gtk3/stable/gtk3-General.html#gtk-init
			 * void gtk_init (
			 *   int *argc,
			 *   char ***argv
			 * );
			 */
			return lib('gtk2').declare('gtk_init', self.TYPE.ABI,
				self.TYPE.void,				// return
				self.TYPE.int.ptr,			// *argc
				self.TYPE.char.ptr.ptr.ptr	// ***argv
			);
		},
		gdk_threads_enter: function() {
			/* https://developer.gnome.org/gdk3/unstable/gdk3-Threads.html#gdk-threads-enter
			 * void gdk_threads_enter (
			 *   void
			 * );
			 */
			return lib('gdk2').declare('gdk_threads_enter', self.TYPE.ABI,
				self.TYPE.void		// return
			);
		},
		gdk_threads_leave: function() {
			/* https://developer.gnome.org/gdk3/unstable/gdk3-Threads.html#gdk-threads-enter
			 * void gdk_threads_leave (
			 *   void
			 * );
			 */
			return lib('gdk2').declare('gdk_threads_leave', self.TYPE.ABI,
				self.TYPE.void		// return
			);
		},
		gdk_drawable_get_size: function() {
			/* https://developer.gnome.org/gdk2/stable/gdk2-Drawing-Primitives.html#gdk-drawable-get-size
			 * gint gdk_drawable_get_size (
			 *   GdkWindow *window,
			 *   gint *x,
			 *   gint *y
			 * );
			 */
			return lib('gdk2').declare('gdk_drawable_get_size', self.TYPE.ABI,
				self.TYPE.gint,				// return
				self.TYPE.GdkWindow.ptr,	// *window
				self.TYPE.gint.ptr,			// *x
				self.TYPE.gint.ptr			// *y
			);
		},
		gdk_window_get_origin: function() {
			/* https://developer.gnome.org/gdk3/stable/gdk3-Windows.html#gdk-window-get-origin
			 * gint gdk_window_get_origin (
			 *   GdkWindow *window,
			 *   gint *x,
			 *   gint *y
			 * );
			 */
			return lib('gdk2').declare('gdk_window_get_origin', self.TYPE.ABI,
				self.TYPE.gint,				// return
				self.TYPE.GdkWindow.ptr,	// *window
				self.TYPE.gint.ptr,			// *x
				self.TYPE.gint.ptr			// *y
			);
		},
		memcpy: function() {
			/* http://linux.die.net/man/3/memcpy
			 * void *memcpy (
			 *   void *dest,
			 *   const void *src,
			 *   size_t n
			 * );
			 */
			return lib('libc').declare('memcpy', self.TYPE.ABI,
				self.TYPE.void,		// return
				self.TYPE.void.ptr,	// *dest
				self.TYPE.void.ptr,	// *src
				self.TYPE.size_t	// count
			);
		},
		gdk_pixbuf_add_alpha: function() {
			/* https://developer.gnome.org/gdk-pixbuf/stable/gdk-pixbuf-Utilities.html#gdk-pixbuf-add-alpha
			 * GdkPixbuf *gdk_pixbuf_add_alpha (
			 *   const GdkPixbuf *pixbuf,
			 *   gboolean substitute_color,
			 *   guchar r,
			 *   guchar g,
			 *   guchar b
			 * );
			 */
			return lib('gdk2').declare('gdk_pixbuf_add_alpha', self.TYPE.ABI,
				self.TYPE.GdkPixbuf.ptr,		// return
				self.TYPE.GdkPixbuf.ptr,		// *pixbuf
				self.TYPE.gboolean,				// substitute_color
				self.TYPE.guchar,				// r
				self.TYPE.guchar,				// g
				self.TYPE.guchar				// b
			);
		},
		gdk_window_fullscreen: function() {
			/* https://developer.gnome.org/gdk3/stable/gdk3-Windows.html#gdk-window-fullscreen
			 * void gdk_window_fullscreen (
			 *   GdkWindow *window
			 * );
			 */
			return lib('gdk2').declare('gdk_window_fullscreen', self.TYPE.ABI,
				self.TYPE.void,			// void
				self.TYPE.GdkWindow.ptr	// *window
			);
		},
		gdk_window_set_fullscreen_mode: function() {
			/* https://developer.gnome.org/gdk3/stable/gdk3-Windows.html#gdk-window-set-fullscreen-mode
			 * void gdk_window_set_fullscreen_mode (
			 *   GdkWindow *window,
			 *   GdkFullscreenMode mode
			 * );
			 */
			return lib('gdk3').declare('gdk_window_set_fullscreen_mode', self.TYPE.ABI,
				self.TYPE.void,				// void
				self.TYPE.GdkWindow.ptr,	// *window
				self.TYPE.GdkFullscreenMode	// mode
			);
		},
		gtk_window_set_keep_above: function() {
			/* https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-set-keep-above
			 * void gtk_window_set_keep_above (
			 *   GtkWindow *window,
			 *   gboolean setting
			 * );
			 */
			return lib('gtk2').declare('gtk_window_set_keep_above', self.TYPE.ABI,
				self.TYPE.void,				// return
				self.TYPE.GtkWindow.ptr,	// *window
				self.TYPE.gboolean			// setting
			);
		},
		gdk_window_set_type_hint: function() {
			/* https://developer.gnome.org/gdk3/stable/gdk3-Windows.html#gdk-window-set-type-hint
			 * void gdk_window_set_type_hint (
			 *   GdkWindow *window,
			 *   GdkWindowTypeHint hint
			 * );
			 */
			return lib('gdk2').declare('gdk_window_set_type_hint', self.TYPE.ABI,
				self.TYPE.void,					// return
				self.TYPE.GdkWindow.ptr,		// *window
				self.TYPE.GdkWindowTypeHint		// hint
			);
		},
		gtk_window_set_position: function() {
			/* https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-set-position
			 *   void gtk_window_set_position (
			 *   GtkWindow *window,
			 *   GtkWindowPosition position
			 * );
			 */
			return lib('gtk2').declare('gtk_window_set_position', self.TYPE.ABI,
				self.TYPE.void,				// return
				self.TYPE.GtkWindow.ptr,	// *window
				self.TYPE.GtkWindowPosition	// position
			);
		},
		gtk_window_present: function() {
			/* https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-present
			 * void gtk_window_present (
			 *   GtkWindow *window
			 * );
			 */
			return lib('gtk2').declare('gtk_window_present', self.TYPE.ABI,
				self.TYPE.void,			// return
				self.TYPE.GtkWindow.ptr	// *window
			);
		},
		gtk_window_fullscreen: function() {
			/* https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-fullscreen
			 * void gtk_window_fullscreen (
			 *   GtkWindow *window
			 * );
			 */
			return lib('gtk2').declare('gtk_window_fullscreen', self.TYPE.ABI,
				self.TYPE.void,			// return
				self.TYPE.GtkWindow.ptr	// *window
			);
		},
		gtk_window_set_geometry_hints: function() {
			/* https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-set-geometry-hints
			 * void gtk_window_set_geometry_hints (
			 *   GtkWindow *window,
			 *   GtkWidget *geometry_widget,
			 *   GdkGeometry *geometry,
			 *   GdkWindowHints geom_mask
			 * );
			 */
			return lib('gtk2').declare('gtk_window_set_geometry_hints', self.TYPE.ABI,
				self.TYPE.void,				// return
				self.TYPE.GtkWindow.ptr,	// *window
				self.TYPE.GtkWidget.ptr,	// *geometry_widget
				self.TYPE.GdkGeometry.ptr,	// *geometry
				self.TYPE.GdkWindowHints	// geom_mask
			);
		}
		// libgdk_pixbuf-2.0-0
	};
	// end - predefine your declares here
	// end - function declares

	this.HELPER = {
		gdkWinPtrToXID: function(aGDKWindowPtr) {
			var GdkDrawPtr = ctypes.cast(aGDKWindowPtr, self.TYPE.GdkDrawable.ptr);
			var xidOfWin = self.API('gdk_x11_drawable_get_xid')(GdkDrawPtr);
			return xidOfWin;
		},
		gdkWinPtrToGtkWinPtr: function(aGDKWindowPtr) {
			var gptr = self.TYPE.gpointer();
			self.API('gdk_window_get_user_data')(aGDKWindowPtr, gptr.address());
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
		},
		mozNativeHandlToGdkWinPtr: function(aMozNativeHandlePtrStr) {
			var GdkWinPtr = self.TYPE.GdkWindow.ptr(ctypes.UInt64(aMozNativeHandlePtrStr));
			return GdkWinPtr;
		},
		mozNativeHandlToGtkWinPtr: function(aMozNativeHandlePtrStr) {
			GdkWinPtr = self.HELPER.mozNativeHandlToGdkWinPtr(aMozNativeHandlePtrStr);
			var GtkWinPtr = self.HELPER.gdkWinPtrToGtkWinPtr(GdkWinPtr);
			/*
			var gptr = self.TYPE.gpointer();
			self.API('gdk_window_get_user_data')(GdkWinPtr, gptr.address());
			var GtkWinPtr = ctypes.cast(gptr, self.TYPE.GtkWindow.ptr);
			*/
			return GtkWinPtr;
		},
		mozNativeHandlToXID: function(aMozNativeHandlePtrStr) {
			GdkWinPtr = self.TYPE.mozNativeHandlToGdkWinPtr(aMozNativeHandlePtrStr);
			var xid = self.HELPER.gdkWinPtrToXID(GdkWinPtr);
			return GtkWinPtr;
		}
	};
}

var ostypes = new gtkInit();
