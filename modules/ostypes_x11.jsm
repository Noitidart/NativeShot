var EXPORTED_SYMBOLS = ['ostypes'];

// no need to define core or import cutils as all the globals of the worker who importScripts'ed it are availble here

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

var xlibTypes = function() {
	// ABIs
	this.CALLBACK_ABI = ctypes.default_abi;
	this.ABI = ctypes.default_abi;
	
	// C TYPES
	this.char = ctypes.char;
	this.int = ctypes.int;
	this.long = ctypes.long;
	this.size_t = ctypes.size_t;
	this.unsigned_char = ctypes.unsigned_char;
	this.unsigned_int = ctypes.unsigned_int;
	this.unsigned_long = ctypes.unsigned_long;
	this.void = ctypes.void_t;
	
	// SIMPLE TYPES // http://refspecs.linuxfoundation.org/LSB_1.3.0/gLSB/gLSB/libx11-ddefs.html
	this.Atom = ctypes.unsigned_long;
	this.Bool = ctypes.int;
	this.KeyCode = ctypes.unsigned_char;
	this.Status = ctypes.int;
	this.Time = ctypes.unsigned_long;
	this.VisualID = ctypes.unsigned_long;
	this.XID = ctypes.unsigned_long;
	this.XPointer = ctypes.char.ptr;
	this.CARD32 = /^(Alpha|hppa|ia64|ppc64|s390|x86_64)-/.test(core.os.xpcomabi) ? this.unsigned_int : this.unsigned_long; // https://github.com/foudfou/FireTray/blob/a0c0061cd680a3a92b820969b093cc4780dfb10c/src/modules/ctypes/linux/x11.jsm#L45 // // http://mxr.mozilla.org/mozilla-central/source/configure.in
	this.RROutput = this.XID;
	this.Connection = ctypes.uint16_t; // not exactly sure about this one but its working
	this.SubpixelOrder = ctypes.uint16_t; // not exactly sure about this one but its working
	this.RRCrtc = this.XID;
	this.RRMode = this.XID;
	this.XRRModeFlags = ctypes.unsigned_long;
	this.Rotation = ctypes.uint16_t; // not exactly sure about this one but its working
	this.GdkDrawable = ctypes.StructType('GdkDrawable');
	this.GdkWindow = ctypes.StructType('GdkWindow');
	this.GtkWindow = ctypes.StructType('GtkWindow');
	
	// gtk types temp
	this.gint = ctypes.int;
	this.gboolean = this.gint;
	this.gpointer = ctypes.voidptr_t;
	
	// ADVANCED TYPES
	this.Colormap = this.XID;
	this.Cursor = this.XID;
	this.Drawable = this.XID;
	this.Font = this.XID;
	this.GContext = this.XID;
	this.KeySym = this.XID;
	this.Pixmap = this.XID;
	this.Window = this.XID;

	// OPAQE STRUCTS
	this.Screen = ctypes.StructType('Screen');
	this.Display = ctypes.StructType('Display');
	this.Visual = ctypes.StructType('Visual');
	this.Depth = ctypes.StructType('Depth');
	
	// SIMPLE STRUCTS
	this.XImage = ctypes.StructType('_XImage', [	// https://github.com/pombreda/rpythonic/blob/23857bbeda30a4574b7ae3a3c47e88b87080ef3f/examples/xlib/__init__.py#L1593
		{ width: this.int },
		{ height: this.int },						// size of image
		{ xoffset: this.int },						// number of pixels offset in X direction
		{ format: this.int },						// XYBitmap, XYPixmap, ZPixmap
		{ data: this.char.ptr },					// pointer to image data
		{ byte_order: this.int },					// data byte order, LSBFirst, MSBFirst
		{ bitmap_unit: this.int },					// quant. of scanline 8, 16, 32
		{ bitmap_bit_order: this.int },				// LSBFirst, MSBFirst
		{ bitmap_pad: this.int },					// 8, 16, 32 either XY or ZPixmap
		{ depth: this.int },						// depth of image
		{ bytes_per_line: this.int },				// accelerator to next scanline
		{ bits_per_pixel: this.int },				// bits per pixel (ZPixmap)
		{ red_mask: this.unsigned_long },			// bits in z arrangement
		{ green_mask: this.unsigned_long },
		{ blue_mask: this.unsigned_long },
		{ obdata: this.XPointer },					// hook for the object routines to hang on
		{
			f: ctypes.StructType('funcs', [			// image manipulation routines
				{ create_image: ctypes.voidptr_t },
				{ destroy_image: ctypes.voidptr_t },
				{ get_pixel: ctypes.voidptr_t },
				{ put_pixel: ctypes.voidptr_t },
				{ sub_image: ctypes.voidptr_t },
				{ add_pixel: ctypes.voidptr_t }
			])
		}
	]);
	
	this.XWindowAttributes = ctypes.StructType('XWindowAttributes', [
		{ x: this.int },
		{ y: this.int },							// location of window
		{ width: this.int },
		{ height: this.int },						// width and height of window
		{ border_width: this.int },					// border width of window
		{ depth: this.int },						// depth of window
		{ visual: this.Visual.ptr },				// the associated visual structure
		{ root: this.Window },						// root of screen containing window
		{ class: this.int },						// InputOutput, InputOnl
		{ bit_gravity: this.int },					// one of bit gravity values
		{ win_gravity: this.int },					// one of the window gravity values
		{ backing_store: this.int },				// NotUseful, WhenMapped, Always
		{ backing_planes: this.unsigned_long },		// planes to be preserved if possible
		{ backing_pixel: this.unsigned_long },		// value to be used when restoring planes
		{ save_under: this.Bool },					// boolean, should bits under be saved?
		{ colormap: this.Colormap },				// color map to be associated with window
		{ map_installed: this.Bool },				// boolean, is color map currently installe
		{ map_state: this.int },					// IsUnmapped, IsUnviewable, IsViewable
		{ all_event_masks: this.long },				// set of events all people have interest i
		{ your_event_mask: this.long },				// my event mask
		{ do_not_propagate_mask: this.long },		// set of events that should not propagate
		{ override_redirect: this.Bool },			// boolean value for override-redirect
		{ screen: this.Screen.ptr }					// back pointer to correct screen
	]);
	
	this.XTextProperty = ctypes.StructType('XTextProperty', [
		{ value: this.unsigned_char.ptr },	// *value
		{ encoding: this.Atom },			// encoding
		{ format: this.int },				// format
		{ nitems: this.unsigned_long }		// nitems
	]);
	
	// start - xrandr stuff
		// resources:
		// http://cgit.freedesktop.org/xorg/proto/randrproto/tree/randrproto.txt
		// http://www.xfree86.org/current/Xrandr.3.html
	this.XRRModeInfo = ctypes.StructType('_XRRModeInfo', [
		{ id: this.RRMode },
		{ width: this.unsigned_int },
		{ height: this.unsigned_int },
		{ dotClock: this.unsigned_long },
		{ hSyncStart: this.unsigned_int },
		{ hSyncEnd: this.unsigned_int },
		{ hTotal: this.unsigned_int },
		{ hSkew: this.unsigned_int },
		{ vSyncStart: this.unsigned_int },
		{ vSyncEnd: this.unsigned_int },
		{ vTotal: this.unsigned_int },
		{ name: this.char.ptr },
		{ nameLength: this.unsigned_int },
		{ modeFlags: this.XRRModeFlags }
	]);
	
	this.XRRScreenResources = ctypes.StructType('_XRRScreenResources', [
		{ timestamp: this.Time },
		{ configTimestamp: this.Time },
		{ ncrtc: this.int },
		{ crtcs: this.RRCrtc.ptr },
		{ noutput: this.int },
		{ outputs: this.RROutput.ptr },
		{ nmode: this.int },
		{ modes: this.XRRModeInfo.ptr }
	]);
	
	this.XRROutputInfo = ctypes.StructType('_XRROutputInfo', [
		{ timestamp: this.Time },
		{ crtc: this.RRCrtc },
		{ name: this.char.ptr },
		{ nameLen: this.int },
		{ mm_width: this.unsigned_long },
		{ mm_height: this.unsigned_long },
		{ connection: this.Connection },
		{ subpixel_order: this.SubpixelOrder },
		{ ncrtc: this.int },
		{ crtcs: this.RRCrtc.ptr },
		{ nclone: this.int },
		{ clones: this.RROutput.ptr },
		{ nmode: this.int },
		{ npreferred: this.int },
		{ modes: this.RRMode.ptr }
	]);
	
	this.XRRCrtcInfo = ctypes.StructType('_XRRCrtcInfo', [
		{ timestamp: this.Time },
		{ x: this.int },
		{ y: this.int },
		{ width: this.unsigned_int },
		{ height: this.unsigned_int },
		{ mode: this.RRMode },
		{ rotation: this.Rotation },
		{ noutput: this.int },
		{ outputs: this.RROutput.ptr },
		{ rotations: this.Rotation },
		{ npossible: this.int },
		{ possible: this.RROutput.ptr }
	]);
	
	this.XClientMessageEvent = ctypes.StructType('XClientMessageEvent', [ // http://www.man-online.org/page/3-XClientMessageEvent/
		{ type: this.int },				// ClientMessage
		{ serial: this.unsigned_long },	// # of last request processed by server
		{ send_event: this.Bool },		// true if this came from a SendEvent request
		{ display: this.Display.ptr },	// Display the event was read from
		{ window: this.Window },
		{ message_type: this.Atom },
		{ format: this.int },
		{ data: this.long.array(5) }	// union of either this.char.array(20), this.short.array(10), or this.long.array(5) // if go with long format must be set to 32, if short then 16 else if char then 8
	]);
	
	// XEvent is one huge union, js-ctypes doesnt have union so i just set it to what I use for my addon
	this.XEvent = ctypes.StructType('_XEvent', [ // http://tronche.com/gui/x/xlib/events/structures.html
		{ xclient: this.XClientMessageEvent }
	])
};

var x11Init = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new xlibTypes();
	
	// CONSTANTS
	// XAtom.h - https://github.com/simonkwong/Shamoov/blob/64aa8d3d0f69710db48691f69440ce23eeb41ad0/SeniorTeamProject/Bullet/btgui/OpenGLWindow/optionalX11/X11/Xatom.h
	// xlib.py - https://github.com/hazelnusse/sympy-old/blob/65f802573e5963731a3e7e643676131b6a2500b8/sympy/thirdparty/pyglet/pyglet/window/xlib/xlib.py#L88
	this.CONST = {
		AnyPropertyType: 0,
		BadAtom: 5,
		BadValue: 2,
		BadWindow: 3,
		False: 0,
		IsUnmapped: 0,
		IsUnviewable: 1,
		IsViewable: 2,
		None: 0,
		Success: 0,
		True: 1,
		XA_ATOM: 4,
		XA_CARDINAL: 6,
		XA_WINDOW: 33,
		RR_CONNECTED: 0,
		PropModeReplace: 0,
		PropModePrepend: 1,
		PropModeAppend: 2,
		ClientMessage: 33,
		_NET_WM_STATE_REMOVE: 0,
		_NET_WM_STATE_ADD: 1,
		_NET_WM_STATE_TOGGLE: 2,
		SubstructureRedirectMask: 1048576,
		SubstructureNotifyMask: 524288
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
								_lib[path] = ctypes.open('libc.so.0.1');
								break;
							default:
								throw new Error({
									name: 'api-error',
									message: 'Path to libc on operating system of , "' + OS.Constants.Sys.Name + '" is not supported'
								});
						}

					break;
				case 'x11':

						switch (core.os.name) {
							case 'darwin': // physically unverified
								_lib[path] = ctypes.open('libX11.dylib');
								break;
							case 'freebsd': // physically unverified
								_lib[path] = ctypes.open('libX11.so.7');
								break;
							case 'openbsd': // physically unverified
								_lib[path] = ctypes.open('libX11.so.61.0');
								break;
							case 'sunos': // physically unverified
							case 'netbsd': // physically unverified
							case 'dragonfly': // physcially unverified
								_lib[path] = ctypes.open('libX11.so');
								break;
							case 'linux':
								_lib[path] = ctypes.open('libX11.so.6');
								break;
							case 'gnu/kfreebsd': // physically unverified
								_lib[path] = ctypes.open('libX11.so.0.1');
								break;
							default:
								throw new Error({
									name: 'api-error',
									message: 'Path to libX11 on operating system of , "' + OS.Constants.Sys.Name + '" is not supported'
								});
						}

					break;
					case 'xrandr':

						switch (core.os.name) {
							case 'freebsd': // physically unverified
							case 'openbsd': // physically unverified
							case 'sunos': // physically unverified
							case 'netbsd': // physically unverified
							case 'dragonfly': // physcially unverified
							case 'linux':
							case 'gnu/kfreebsd': // physically unverified
								_lib[path] = ctypes.open('libXrandr.so.2');
								break;
							default:
								throw new Error({
									name: 'api-error',
									message: 'Path to libX11 on operating system of , "' + OS.Constants.Sys.Name + '" is not supported'
								});
						}

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
		XChangeProperty: function() {
			/* http://www.xfree86.org/4.4.0/XChangeProperty.3.html
			 * int XChangeProperty(
			 *   Display *display,
			 *   Window w,
			 *   Atom property,
			 *   Atom type,
			 *   int format,
			 *   int mode,
			 *   unsigned char *data,
			 *   int nelements
			 * );
			 */
			return lib('x11').declare('XChangeProperty', self.TYPE.ABI,
				self.TYPE.int,				// return
				self.TYPE.Display.ptr,		// *display
				self.TYPE.Window,				// w
				self.TYPE.Atom,				// property
				self.TYPE.Atom,				// type
				self.TYPE.int,				// format
				self.TYPE.int,				// mode
				self.TYPE.unsigned_char.ptr,	// *data
				self.TYPE.int					// nelements
			);
		},
		XDefaultRootWindow: function() {
			/* http://www.xfree86.org/4.4.0/DefaultRootWindow.3.html
			 * Window DefaultRootWindow(
			 *   Display	*display
			 * );
			 */
			return lib('x11').declare('XDefaultRootWindow', self.TYPE.ABI,
				self.TYPE.Window,		// return
				self.TYPE.Display.ptr	// *display
			);
		},
		XDefaultScreen: function() {
			/* int XDefaultScreen(
			 *   Display *display;
			 * )
			 */
			return lib('x11').declare('XDefaultScreen', self.TYPE.ABI,
				self.TYPE.int,			// return
				self.TYPE.Display.ptr	// *display
			);
		},
		XDefaultScreenOfDisplay: function() {
			/* http://www.xfree86.org/4.4.0/DefaultScreenOfDisplay.3.html
			 * Screen *XDefaultScreenOfDisplay(
			 *   Display *display;
			 * )
			 */
			return lib('x11').declare('XDefaultScreenOfDisplay', self.TYPE.ABI,
				self.TYPE.Screen.ptr,		// return
				self.TYPE.Display.ptr		// *display
			);
		},
		XHeightOfScreen: function() {
			/* http://www.xfree86.org/4.4.0/HeightOfScreen.3.html
			 * int HeightOfScreen(
			 *   Screen	*screen 
			 * );
			 */
			return lib('x11').declare('XHeightOfScreen', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.Screen.ptr	// *screen
			);
		},
		XWidthOfScreen: function() {
			/* http://www.xfree86.org/4.4.0/WidthOfScreen.3.html
			 * int WidthOfScreen(
			 *   Screen	*screen 
			 * );
			 */
			return lib('x11').declare('XWidthOfScreen', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.Screen.ptr	// *screen
			);
		},
		XCloseDisplay: function() {
			/* http://www.xfree86.org/4.4.0/XCloseDisplay.3.html
			 * int XCloseDisplay(
			 *   Display	*display
			 * );
			 */
			return lib('x11').declare('XCloseDisplay', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.Display.ptr	// *display
			);
		},
		XFlush: function() {
			/* http://www.xfree86.org/4.4.0/XFlush.3.html
			 * int XFlush(
			 *   Display	*display
			 * );
			 */
			return lib('x11').declare('XFlush', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.Display.ptr	// *display
			);
		},
		XFree: function() {
			/* http://www.xfree86.org/4.4.0/XFree.3.html
			 * int XFree(
			 *   void	*data
			 * );
			 */
			return lib('x11').declare('XFree', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.void.ptr	// *data
			);
		},
		XFreeStringList: function() {
			/* http://www.xfree86.org/4.4.0/XFreeStringList.3.html
			 * void XFreeStringList (
			 *   char **list
			 * );
			 */
			return lib('x11').declare('XFreeStringList', self.TYPE.ABI,
				self.TYPE.void,			// return
				self.TYPE.char.ptr.ptr	// **list
			);
		},
		XGetGeometry: function() {
			/* http://www.xfree86.org/4.4.0/XGetGeometry.3.html
			 * Status XGetGeometry(
			 *   Display 		*display,
			 *   Drawable		d,	// It is legal to pass an InputOnly window as a drawable to this request. 
			 *   Window			*root_return,
			 *   int			*x_return,
			 *   int			*y_return,
			 *   unsigned int	*width_return,
			 *   unsigned int	*height_return,
			 *   unsigned int	*border_width_return,
			 *   unsigned int	*depth_return
			 * );
			 */
			return lib('x11').declare('XGetGeometry', self.TYPE.ABI,
				self.TYPE.Status,			// return
				self.TYPE.Display.ptr,		// *display
				self.TYPE.Drawable,			// d
				self.TYPE.Window.ptr,		// *root_return
				self.TYPE.int.ptr,			// *x_return
				self.TYPE.int.ptr,			// *y_return
				self.TYPE.unsigned_int.ptr,	// *width_return
				self.TYPE.unsigned_int.ptr,	// *height_return
				self.TYPE.unsigned_int.ptr,	// *border_width_return
				self.TYPE.unsigned_int.ptr	// *depth_return
			); 
		},
		XGetWindowAttributes: function() {
			/* http://www.xfree86.org/4.4.0/XGetWindowAttributes.3.html
			 * Status XGetWindowAttributes(
			 *   Display			*display,
			 *   Window 			w,
			 *   XWindowAttributes	*window_attributes_return
			 * );
			 */
			return lib('x11').declare('XGetWindowAttributes', self.TYPE.ABI,
				self.TYPE.Status,				// return
				self.TYPE.Display.ptr,			// *display
				self.TYPE.Window,				// w
				self.TYPE.XWindowAttributes.ptr	// *window_attributes_return
			); 
		},
		XGetAtomNames: function() {
			/* NOTE: XGetAtomNames() is more efficient, but doesn't exist in X11R5. Source: https://github.com/JohnArchieMckown/nedit/blob/b4560954930d28113086b5471ffcda27a3d28e77/source/server_common.c#L130
			 * http://www.x.org/releases/X11R7.5/doc/man/man3/XGetAtomNames.3.html
			 * Status XGetAtomNames (
			 *   Display *display,
			 *   Atom *atoms,
			 *   int count,
			 *   char **names_return
			 * );
			 */
			return lib('x11').declare('XGetAtomNames', self.TYPE.ABI,
				self.TYPE.Status,		// return
				self.TYPE.Display.ptr,	// *display
				self.TYPE.Atom.ptr,		// *atoms
				self.TYPE.int,			// count
				self.TYPE.char.ptr.ptr	// **names_return
			);
		},
		XGetWindowProperty: function() {
			/* http://www.xfree86.org/4.4.0/XGetWindowProperty.3.html
			 * int XGetWindowProperty(
			 *   Display		*display,
			 *   Window			w,
			 *   Atom			property,
			 *   long			long_offset,
			 *   long			long_length,
			 *   Bool			delete,
			 *   Atom			req_type,
			 *   Atom			*actual_type_return,
			 *   int			*actual_format_return,
			 *   unsigned long	*nitems_return,
			 *   unsigned long	*bytes_after_return,
			 *   unsigned char	**prop_return
			 * );
			 */
			return lib('x11').declare('XGetWindowProperty', self.TYPE.ABI,
				self.TYPE.int,					// return
				self.TYPE.Display.ptr,			// *display
				self.TYPE.Window,				// w
				self.TYPE.Atom,					// property
				self.TYPE.long,					// long_offset
				self.TYPE.long,					// long_length
				self.TYPE.Bool,					// delete
				self.TYPE.Atom,					// req_type
				self.TYPE.Atom.ptr,				// *actual_type_return
				self.TYPE.int.ptr,				// *actual_format_return
				self.TYPE.unsigned_long.ptr,	// *nitems_return
				self.TYPE.unsigned_long.ptr,	// *bytes_after_return
				self.TYPE.unsigned_char.ptr.ptr	// **prop_return
			);
		},
		XListProperties: function() {
			/* http://tronche.com/gui/x/xlib/window-information/XListProperties.html
			 * Atom *XListProperties(
			 *   Display *display,
			 *   Window w,
			 *   int *num_prop_return
			 * )
			 */
			return lib('x11').declare('XListProperties', self.TYPE.ABI,
				self.TYPE.Atom.ptr,			// return
				self.TYPE.Display.ptr,		// *display
				self.TYPE.Window,			// w
				self.TYPE.int.ptr			// *num_prop_return
			);
		},
		XGetWMName: function() {
			/* http://www.xfree86.org/4.4.0/XGetWMName.3.html
			 * Status XGetWMName(
			 *   Display		*display,
			 *   Window			w,
			 *   XTextProperty	*text_prop_return 
			 * );
			 */
			 return lib('x11').declare('XGetWMName', self.TYPE.ABI,
				self.TYPE.Status,				// return
				self.TYPE.Display.ptr,			// *display
				self.TYPE.Window,				// w
				self.TYPE.XTextProperty.ptr		// *text_prop_return
			);
		},
		XInternAtom: function() {
			/* http://www.xfree86.org/4.4.0/XInternAtom.3.html
			 * Atom XInternAtom(
			 *   Display	*display,
			 *   char		*atom_name,
			 *   Bool		only_if_exists
			 * );
			 */
			 return lib('x11').declare('XInternAtom', self.TYPE.ABI,
				self.TYPE.Atom,			// return
				self.TYPE.Display.ptr,	// *display
				self.TYPE.char.ptr,		// *atom_name
				self.TYPE.Bool			// only_if_exists
			);
		},
		XOpenDisplay: function() {
			/* http://www.xfree86.org/4.4.0/XOpenDisplay.3.html
			 * Display *XOpenDisplay(
			 *   char	*display_name
			 * );
			 */
			return lib('x11').declare('XOpenDisplay', self.TYPE.ABI,
				self.TYPE.Display.ptr,	// return
				self.TYPE.char.ptr		// *display_name
			); 
		},
		XQueryTree: function() {
			/* http://www.xfree86.org/4.4.0/XQueryTree.3.html
			 * Status XQueryTree(
			 *   Display		*display,
			 *   Window			w,
			 *   Window			*root_return,
			 *   Window			*parent_return,
			 *   Window			**children_return,
			 *   unsigned int	*nchildren_return
			 * );
			 */
			return lib('x11').declare('XQueryTree', self.TYPE.ABI,
				self.TYPE.Status,				// return
				self.TYPE.Display.ptr,		// *display
				self.TYPE.Window,				// w
				self.TYPE.Window.ptr,			// *root_return
				self.TYPE.Window.ptr,			// *parent_return
				self.TYPE.Window.ptr.ptr,		// **children_return
				self.TYPE.unsigned_int.ptr	// *nchildren_return
			); 
		},
		XTranslateCoordinates: function() {
			/* http://www.xfree86.org/4.4.0/XTranslateCoordinates.3.html
			 * Bool XTranslateCoordinates(
			 *   Display	*display,
			 *   Window		src_w,
			 *   Window		dest_w,
			 *   int		src_x,
			 *   int		src_y,
			 *   int		*dest_x_return,
			 *   int		*dest_y_return,
			 *   Window		*child_return
			 * );
			 */
			return lib('x11').declare('XTranslateCoordinates', self.TYPE.ABI,
				self.TYPE.Bool,			// return
				self.TYPE.Display.ptr,	// *display
				self.TYPE.Window,			// src_w
				self.TYPE.Window,			// dest_w
				self.TYPE.int,			// src_x
				self.TYPE.int,			// src_y
				self.TYPE.int.ptr,		// *dest_x_return
				self.TYPE.int.ptr,		// *dest_y_return
				self.TYPE.Window.ptr		// *child_return
			); 
		},
		XAllPlanes: function() {
			/* http://tronche.com/gui/x/xlib/display/display-macros.html
			 * unsigned long XAllPlanes()
			 */
			return lib('x11').declare('XAllPlanes', self.TYPE.ABI,
				self.TYPE.unsigned_long	// return
			);
		},
		XGetImage: function() {
			/* http://www.xfree86.org/4.4.0/XGetImage.3.html
			 * XImage *XGetImage (
			 *   Display *display,
			 *   Drawable d,
			 *   int x,
			 *   int y,
			 *   unsigned int width,
			 *   unsigned int height,
			 *   unsigned long plane_mask,
			 *   int format
			 * ); 
			 */
			return lib('x11').declare('XGetImage', self.TYPE.ABI,
				self.TYPE.XImage.ptr,		// return
				self.TYPE.Display.ptr,		// *display,
				self.TYPE.Drawable,			// d,
				self.TYPE.int,				// x,
				self.TYPE.int,				// y,
				self.TYPE.unsigned_int,		// width,
				self.TYPE.unsigned_int,		// height,
				self.TYPE.unsigned_long,	// plane_mask,
				self.TYPE.int				// format
			);
		},
		XSendEvent: function() {
			/* http://www.xfree86.org/4.4.0/XSendEvent.3.html
			 * Status XSendEvent(
			 *   Display *display,
			 *   Window w,
			 *   Bool propagate,
			 *   long event_mask,
			 *   XEvent *event_send
			 * ); 
			 */
			return lib('x11').declare('XSendEvent', self.TYPE.ABI,
				self.TYPE.Status,		// return
				self.TYPE.Display.ptr,	// *display
				self.TYPE.Window,		// w
				self.TYPE.Bool,			// propagate
				self.TYPE.long,			// event_mask
				self.TYPE.XEvent.ptr	// *event_sent
			); 
		},
		XQueryTree: function() {
			/* http://tronche.com/gui/x/xlib/window-information/XQueryTree.html
			 * Status XQueryTree (
			 *   Display *display,
			 *   Window w,
			 *   Window *root_return,
			 *   Window *parent_return,
			 *   Window **children_return,
			 *   unsigned int *nchildren_return
			 * )
			 */
			return lib('x11').declare('XQueryTree', self.TYPE.ABI,
				self.TYPE.Status,			// return
				self.TYPE.Display.ptr,		// *display
				self.TYPE.Window,			// w
				self.TYPE.Window.ptr,		// *root_return
				self.TYPE.Window.ptr,		// *parent_return
				self.TYPE.Window.ptr.ptr,	// **children_return
				self.TYPE.unsigned_int.ptr	// *nchildren_return
			);
		},
		// start - XRANDR
		XRRGetScreenResources: function() {
			/* http://cgit.freedesktop.org/xorg/lib/libXrandr/tree/src/XrrScreen.c
			 * XRRScreenResources *XRRGetScreenResources(
			 *   Display *dpy,
			 *   Window window
			 * )
			 */
			return lib('xrandr').declare('XRRGetScreenResources', self.TYPE.ABI,
				self.TYPE.XRRScreenResources.ptr,		// return
				self.TYPE.Display.ptr,					// *dpy
				self.TYPE.Window						// window
			);
		},
		XRRGetOutputInfo: function() {
			/* http://cgit.freedesktop.org/xorg/lib/libXrandr/tree/src/XrrOutput.c
			 * XRROutputInfo *XRRGetOutputInfo (
			 *   Display *dpy,
			 *   XRRScreenResources *resources,
			 *   RROutput output
			 * )
			 */
			return lib('xrandr').declare('XRRGetOutputInfo', self.TYPE.ABI,
				self.TYPE.XRROutputInfo.ptr,		// return
				self.TYPE.Display.ptr,				// *dpy
				self.TYPE.XRRScreenResources.ptr,	// *resources
				self.TYPE.RROutput					// output
			);
		},
		XRRGetCrtcInfo: function() {
			/* http://cgit.freedesktop.org/xorg/lib/libXrandr/tree/src/XrrCrtc.c
			 * XRRCrtcInfo *XRRGetCrtcInfo (
			 *   Display *dpy,
			 *   XRRScreenResources *resources,
			 *   RRCrtc crtc
			 * )
			 */
			return lib('xrandr').declare('XRRGetCrtcInfo', self.TYPE.ABI,
				self.TYPE.XRRCrtcInfo.ptr,		// return
				self.TYPE.Display.ptr,					// *dpy
				self.TYPE.XRRScreenResources.ptr,		// *resources
				self.TYPE.RRCrtc						// crtc
			);
		},
		XRRFreeCrtcInfo: function() {
			/* http://cgit.freedesktop.org/xorg/lib/libXrandr/tree/src/XrrCrtc.c
			 * void XRRFreeCrtcInfo (
			 *   XRRCrtcInfo *crtcInfo
			 * )
			 */
			return lib('xrandr').declare('XRRFreeCrtcInfo', self.TYPE.ABI,
				self.TYPE.void,				// return
				self.TYPE.XRRCrtcInfo.ptr	// *crtcInfo
			);
		},
		XRRFreeOutputInfo: function() {
			/* http://cgit.freedesktop.org/xorg/lib/libXrandr/tree/src/XrrOutput.c
			 * void XRRFreeOutputInfo (
			 *   XRROutputInfo *outputInfo
			 * )
			 */
			return lib('xrandr').declare('XRRFreeOutputInfo', self.TYPE.ABI,
				self.TYPE.void,				// return
				self.TYPE.XRROutputInfo.ptr	// *outputInfo
			);
		},
		XRRFreeScreenResources: function() {
			/* http://cgit.freedesktop.org/xorg/lib/libXrandr/tree/src/XrrScreen.c
			 * void XRRFreeScreenResources (
			 *   XRRScreenResources *resources
			 * )
			 */
			return lib('xrandr').declare('XRRFreeScreenResources', self.TYPE.ABI,
				self.TYPE.void,						// return
				self.TYPE.XRRScreenResources.ptr	// *resources
			);
		},
		// end - XRANDR
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
	};
	// end - predefine your declares here
	// end - function declares

	this.MACRO = { // http://tronche.com/gui/x/xlib/display/display-macros.html
		DefaultRootWindow: function() {
			/* The DefaultRootWindow macro returns the root window for the default screen. 
			 * Argument `display` specifies the connection to the X server.
			 * Returns the root window for the default screen.
			 * http://www.xfree86.org/4.4.0/DefaultRootWindow.3.html
			 * Window DefaultRootWindow(
			 *   Display	*display
			 * );
			 */
			return self.API('XDefaultRootWindow');
		},
		DefaultScreenOfDisplay: function() {
			/* http://www.xfree86.org/4.4.0/DefaultScreenOfDisplay.3.html
			 * Screen *DefaultScreenOfDisplay(
			 *   Display	*display
			 * );
			 */
			return self.API('XDefaultScreenOfDisplay');
		},
		HeightOfScreen: function() {
			/* http://www.xfree86.org/4.4.0/HeightOfScreen.3.html
			 * int HeightOfScreen(
			 *   Screen	*screen 
			 * );
			 */
			return self.API('XHeightOfScreen');
		},
		WidthOfScreen: function() {
			/* http://www.xfree86.org/4.4.0/WidthOfScreen.3.html
			 * int WidthOfScreen(
			 *   Screen	*screen 
			 * );
			 */
			return self.API('XWidthOfScreen');
		},
		DefaultScreen: function() {
			/* The DefaultScreen macro returns the default screen number referenced in the XOpenDisplay routine.
			 * Argument `display` specifies the connection to the X server. 
			 * Return the default screen number referenced by the XOpenDisplay() function. This macro or function should be used to retrieve the screen number in applications that will use only a single screen. 
			 * http://www.xfree86.org/4.4.0/DefaultScreen.3.html
			 * int DefaultScreen(
			 *   Display *display
			 * );
			 */
			return self.API('XDefaultScreen');
		}
	};
	
	this._cache = {};
	this._cacheAtoms = {};
	
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
		},
		cachedDefaultRootWindow: function(refreshCache/*, disp*/) {
			if (refreshCache || !self._cache.DefaultRootWindow)  {
				self._cache.DefaultRootWindow = self.MACRO.DefaultRootWindow()(/*disp*/self.HELPER.cachedXOpenDisplay());
			}
			return self._cache.DefaultRootWindow;
		},
		cachedDefaultScreen: function(refreshCache/*, disp*/) {
			if (refreshCache || !self._cache.DefaultScreen)  {
				self._cache.DefaultScreen = self.MACRO.DefaultScreen()(/*disp*/self.HELPER.cachedXOpenDisplay());
			}
			return self._cache.DefaultScreen;
		},
		cachedDefaultScreenOfDisplay: function(refreshCache/*, disp*/) {
			if (refreshCache || !self._cache.DefaultScreenOfDisplay)  {
				self._cache.DefaultScreenOfDisplay = self.MACRO.DefaultScreenOfDisplay()(/*disp*/self.HELPER.cachedXOpenDisplay());
			}
			return self._cache.DefaultScreenOfDisplay;
		},
		cachedXOpenDisplay: function(refreshCache) {
			if (refreshCache || !self._cache.XOpenDisplay)  {
				self._cache.XOpenDisplay = self.API('XOpenDisplay')(null);
			}
			return self._cache.XOpenDisplay;
		},
		ifOpenedXCloseDisplay: function() {
			if (self._cache.XOpenDisplay) {
				self.API('XCloseDisplay')(self._cache.XOpenDisplay);
			}
		},
		cachedAtom: function(aAtomName, createAtomIfDne, refreshCache) {
			// createAtomIfDne is jsBool, true or false. if set to true/1 then the atom is creatd if it doesnt exist. if set to false/0, then an error is thrown when atom does not exist
			// default behavior is throw when atom doesnt exist
			
			// aAtomName is self.TYPE.char.ptr but im pretty sure you can just pass in a jsStr
			// returns self.TYPE.Atom

			if (!(aAtomName in self._cacheAtoms)) {		
				var atom = self.API('XInternAtom')(self.HELPER.cachedXOpenDisplay(), aAtomName, createAtomIfDne ? self.CONST.False : self.CONST.True); //passing 3rd arg of false, means even if atom doesnt exist it returns a created atom, this can be used with GetProperty to see if its supported etc, this is how Chromium does it
				if (!createAtomIfDne) {
					if (atom == self.CONST.None) { // if i pass 3rd arg as False, it will will never equal self.CONST.None it gets creatd if it didnt exist on line before
						console.warn('No atom with name:', aAtomName, 'return val of atom:', atom.toString());
						throw new Error('No atom with name "' + aAtomName + '"), return val of atom:"' +  atom.toString() + '"');
					}
				}
				self._cacheAtoms[aAtomName] = atom;
			}
			return self._cacheAtoms[aAtomName];
		},
		getWinProp_ReturnStatus: function(devUserRequestedType, funcReturnedType, funcReturnedFormat, funcBytesAfterReturned, dontThrowOnDevTypeMismatch) {
			// devUserRequestedType is req_type arg passed to XGetWindowProperty
			// this tells us what the return of XGetWindowProperty means and if it needs XFree'ing
			// returns < 0 if nitems_return is empty and no need for XFree. > 0 if needs XFree as there are items. 0 if no items but needs XFree, i have never seen this situation and so have not set up this to return 0 // actually scratch this xfree thing it seems i have to xfree it everytime: // XGetWindowProperty() always allocates one extra byte in prop_return (even if the property is zero length) and sets it to zero so that simple properties consisting of characters do not have to be copied into yet another string before use.  // wait tested it, and i was getting some weird errors so only XFree when not empty, interesting
				// -1 - console.log('The specified property does not exist for the specified window. The delete argument was ignored. The nitems_return argument will be empty.');
				// -2 - must set dontThrowOnDevTypeMismatch to true else it throws - console.log('Specified property/atom exists on window but here because returns actual type does not match the specified type (the xgwpArg.req_type) you supplied to function. The delete argument was ignored. The nitems_return argument will be empty.');
				// 1 - console.log('The specified property exists and either you assigned AnyPropertyType to the req_type argument or the specified type matched the actual property type of the returned data.');
			
			if (cutils.jscEqual(funcReturnedType, self.CONST.None) && cutils.jscEqual(funcReturnedFormat, 0) && cutils.jscEqual(funcBytesAfterReturned, 0)) {
				// console.log('The specified property does not exist for the specified window. The delete argument was ignored. The nitems_return argument will be empty.');
				return -1;
			} else if (!cutils.jscEqual(devUserRequestedType, self.CONST.AnyPropertyType) && !cutils.jscEqual(devUserRequestedType, funcReturnedType)) {
				// console.log('Specified property/atom exists on window but here because returns actual type does not match the specified type (the xgwpArg.req_type) you supplied to function. The delete argument was ignored. The nitems_return argument will be empty.');
				console.info('devUserRequestedType:', cutils.jscGetDeepest(devUserRequestedType));
				console.info('funcReturnedType:', cutils.jscGetDeepest(funcReturnedType));
				if (!dontThrowOnDevTypeMismatch) {
					throw new Error('devuser supplied wrong type for title, fix it stupid, or maybe not a throw? maybe intentionally wrong? to just check if it exists on the window but dont want any data returend as dont want to XFree?');
				}
				return -2;
			} else if (cutils.jscEqual(devUserRequestedType, self.CONST.AnyPropertyType) || cutils.jscEqual(devUserRequestedType, funcReturnedType)) {
				// console.log('The specified property exists and either you assigned AnyPropertyType to the req_type argument or the specified type matched the actual property type of the returned data.');
				return 1;
			}  else {
				throw new Error('should never get here')
			}
		}
	};
};

var ostypes = new x11Init();