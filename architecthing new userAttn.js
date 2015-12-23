// can keep reference to the object, can update it, then call nabUpdateAttn
///// example 1
Attn.add('devuser generated id', {
	desktopNotification: {
		type: 'once', // once, persistent // once disappears after some time, persistent stays till user clicks - note: only once supported as of now and no time setting supported as of now
		icon: '', // string
		title: '', // string
		body: '', // string
		callbacks: {
			onClickDismiss: function(aId) {}, // closed because clicked // aId is the first argument to .add and is the one in Attn.instance // return false if you are doing async stuff and dont want this deleted from instance automatically, if you do return false then make sure to delete Attn.instance[aId] when youre done for mem perf
			onTimedDismiss: function(aId) {} // closed due to time, not available to `type: 'persistent'` // aId is the first argument to .add and is the one in Attn.instance // return false if you are doing async stuff and dont want this deleted from instance automatically, if you do return false then make sure to delete Attn.instance[aId] when youre done for mem perf
		}
	},
	barNotification: {
		type: 'tab', // tab, window, app // better word would be scope maybe // app puts bar in all windows, and future opened windows
		target: DOMElement, // only for tab or window, provide the tab/window dom element
		icon: '', // string
		body: '', // string
		location: 'top', // top, bottom // where the bar gets placed in the browser
		priority: 0, // integer 0-9
		timeout: 0, // default is 0, meaning not dismissed until user clicks close, or you close from button click, the number of seconds to show the bar for
		callbacks: {
			onTimeUp: function() {}, // not available if `timeout: 0`, this will call .close()
			onClose: function() {}, // does not differentiate bteween click on close, or if closed from button click
			onButtonClick: function(aBtnId) {}, // make it throw to prevent close
		},
		buttons: {
			'devuser generated button id': {
				body: ''
				menu: jsonToDOM json,
				icon: '', // string
				accesskey: '' // string, if this key is not here, then no accesskey is assigned
				// devuser can put whatever other keys he wants here for data storage, for example, onButtonClick can have a switch, then in here you can have a key 'actionOnClick' and it will do that respective function
			}
		}
	}
});
///// example 2 - how to update an instance that is alive

///////////////// start

var myServices = {
	as: Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService)
};

var Attn = {
	instance: {}, // object of instances that are alive
	add: function(aId, aDetailsObj) { // reason i have devuser provide aId is because then they can access it in Attn.instance and modify it then call Attn.updateInstance(aId)
		// this is named add, but can also be named init, or push
		// see above aDetailsObj
		// adds the details obj with aId to instance obj and adds to windows etc
		if (aId in Attn.instance) {
			throw new Error('aId already in instance');
		}
		
		Attn.instance[aId] = aDetailsObj;
		
		if (aDetailsObj.desktopNotification) {
			
			var delFromInstance = function() {
				// delete from instances
				delete Attn.instance[aId].desktopNotification;
				
				// check if any other keys in this, if not then delete aId from Attn.instance
				if (Object.keys(Attn.instance[aId]).length == 0) {
					delete Attn.instance[aId];
				}
			};
			
			if (aDetailsObj.desktopNotification.type == 'once') {
				aDetailsObj.desktopNotification.programatic.dismissListener = {
					observe: function(aSubject, aTopic, aData) {
						// aSubject
							// always null
						// aTopic
							// alertfinished - dismissed due to time
							// alertclickcallback - dissmissed due to user click
							// alertshow - alert shown
						// aData
							// cookie argument from showAlertNotification
						switch (aTopic) {
							case 'alertfinished':
							
									var deleteFromInstance = true;
									if (aDetailsObj.desktopNotification.callbacks.onTimedDismiss) {
										deleteFromInstance = aDetailsObj.desktopNotification.callbacks.onTimedDismiss(aId); // note: make callback return false if you want to handle deleting from Attn.instance yourself
									}
									if (deleteFromInstance) {
										delFromInstance();
									}
							
								break;
							case 'alertclickcallback':
							
									var deleteFromInstance = true;
									if (aDetailsObj.desktopNotification.callbacks.onTimedDismiss) {
										deleteFromInstance = aDetailsObj.desktopNotification.callbacks.onClickDismiss(aId); // note: make callback return false if you want to handle deleting from Attn.instance yourself
									}
									if (deleteFromInstance) {
										delFromInstance();
									}
							
								break;
							case 'alertshow':
							
									//
							
								break;
							default:
								throw new Error('unrecognized aTopic in dismissListener: "' + aTopic + '", aId: "' + aId + '"');
						}
					}
				};
				var showAlertNotificationArgs = [
					aDetailsObj.desktopNotification.icon,		// imageUrl
					aDetailsObj.desktopNotification.title,		// title
					aDetailsObj.desktopNotification.body,		// text
					false,										// textClickable
					aId,										// cookie
					aDetailsObj.desktopNotification.programatic.dismissListener	// alertListener
					// 'i dont care',							// name
					// 'i dont care',							// dir
					// 'i dont care'							// lang
				];
				
				try {
					myServices.as.showAlertNotification.apply(myServices.as.showAlertNotification, showAlertNotificationArgs);
				} catch (ex) {
					// this can fail if notfications are disabled
					delFromInstance();
				}
			} else {
				throw new Error('unsupported type of desktopNotification');
			}
		}
	}
};