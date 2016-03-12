const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');

//start obs stuff
var observers = {
	'quit-application-granted': {
		observe: function (aSubject, aTopic, aData) {
			window.close()
		},
		reg: function () {
			Services.obs.addObserver(observers['quit-application-granted'], 'quit-application-granted', false);
		},
		unreg: function () {
			Services.obs.removeObserver(observers['quit-application-granted'], 'quit-application-granted');
		}
	}
};
var gObs = {
	init: function() {
		for (var o in observers) {
			observers[o].reg();
		}
	},
	uninit: function() {
		for (var o in observers) {
			observers[o].unreg();
		}
	}
}
//end obs stuff

var BackgroundWindow = {
	init: function() {
		console.log('doing bg init');
		window.removeEventListener('load', BackgroundWindow.init, false);

		var xulWindow = window.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIWebNavigation)
							  .QueryInterface(Ci.nsIDocShellTreeItem)
							  .treeOwner
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIXULWindow);

		// // Unregister our hidden window so it doesn't appear in the Window menu.
		// Services.appShell.unregisterTopLevelWindow(xulWindow);
        
		// // Tell Gecko that we closed the window already so it doesn't hold Firefox open if all other windows are closed.
		// Services.startup.QueryInterface(Ci.nsIObserver).observe(null, 'xul-window-destroyed', null);

		// gObs.init();
		
		console.log('did bg init');
	},
	uninit: function() {
		console.log('doing bg uninit');
		
		var xulWindow = window.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIWebNavigation)
							  .QueryInterface(Ci.nsIDocShellTreeItem)
							  .treeOwner
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIXULWindow);
		
		// // Register a window again so that the window count remains accurate.
		// // Otherwise the window mediator will think we have one less window than we really do. Because this window closing is unregistered, so its not there
		// Services.startup.QueryInterface(Ci.nsIObserver).observe(xulWindow, 'xul-window-registered', null);
		
		// gObs.uninit();
		
		console.log('did bg uninit');
	}
};

window.addEventListener('load', BackgroundWindow.init, false);
window.addEventListener('unload', BackgroundWindow.uninit, false);