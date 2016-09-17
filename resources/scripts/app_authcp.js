function initAppPage(aArg) {
	// aArg is what is received by the call in `init`
	gAppPageComponents = [
		React.createElement(Wrap)
	];
}

function uninitAppPage() {

}

// start - react-redux

// REACT COMPONENTS - PRESENTATIONAL
var Wrap = React.createClass({
	render: function() {
		return React.createElement('div', { className:'container' },
			React.createElement(Tives)
		);
	}
});
var Tives = React.createClass({
	render: function() {
		return React.createElement('div', { className:'padd-80' },
			React.createElement(ActivesContainer),
			React.createElement(InactivesContainer)
		);
	}
});

var Actives = React.createClass({
	render: function() {
		var { actives } = this.props; // mapped state

		var rows = []; // `actives` formated into an array so i can feed it React.createElement via `.map`
		for (var serviceid in actives) {
			var serviceentry = core.nativeshot.services[serviceid];
			var oauthentry = actives[serviceid];
			rows.push({
				serviceid,
				servicename: formatStringFromNameCore(serviceid, 'main'),
				acctname: !oauthentry ? null : deepAccessUsingString(oauthentry, serviceentry.oauth.dotname),
				acctid: !oauthentry ? null : deepAccessUsingString(oauthentry, serviceentry.oauth.dotid)
			});
		}
		rows.sort((a,b) => a.servicename.localeCompare(b.servicename));
		console.log('rows:', rows);

		// actives will have all services in it, if it has no active entry it will be null per link47388
		return React.createElement('div', { className:'shoprow col-md-12' },
			React.createElement('div', { className:'shop-detail-info' },
				React.createElement('h4', undefined, 'Active Accounts'),
				rows.map( rowentry => React.createElement(ActiveRow, { rowentry, key:rowentry.serviceid }) )
			),
			React.createElement('p', { style:{color:'transparent'} }, 'spacer')
		);
	}
});
var ActiveRow = React.createClass({
	doInactivate: function() {
		var { rowentry } = this.props; // attr
		var { serviceid } = rowentry;

		console.log(this.props);
		store.dispatch(setInactive(serviceid));
	},
	doAuthWithLogin: function() {
		var { rowentry } = this.props; // attr
		var { serviceid } = rowentry;

		alert('do auth with login flow');
	},
	doAuth: function() {
		var { rowentry } = this.props; // attr
		var { serviceid } = rowentry;

		alert('do auth');
	},
	render: function() {
		var { rowentry } = this.props; // attr

		var { serviceid, servicename, acctname, acctid } = rowentry;

		var buttons = [];
		if (acctname) {
			buttons.push( React.createElement(Button, { key:'deactivate', style:2, size:'xs', text:'Set Inactive', onClick:this.doInactivate }) ); // TODO: l10n
		} else {
			buttons.push( React.createElement(Button, { key:'authnow', style:2, size:'xs', text:'Add Account', onClick:this.doAuth }) ); // TODO: l10n - also if inactives has these accounts then make it "Add Acccount" else make it "Authorize Now"
		}
		pushAlternatingRepeating(buttons, ' ');

		return React.createElement('div', { className:'shop-price' },
			React.createElement('div', { className:'rate-info fr' },
				buttons
			),
			React.createElement('div', undefined,
				React.createElement('h6', { className:'style-link-1' },
					React.createElement('img', { src:core.addon.path.images + serviceid + '.svg', height:'24', width:'24' })
				),
				React.createElement('h5', { className:(acctname ? 'bold' : 'italic no-active-acct') },
					(acctname || 'No Active Account') // TODO: l10n
				)
			)
		);
	}
});
var InactiveRow = React.createClass({
	doActivate: function() {
		var { rowentry } = this.props; // attr
		var { serviceid, acctid } = rowentry;

		store.dispatch(setActive(serviceid, acctid));
	},
	doNullify: function() {
		var { rowentry } = this.props; // attr
		var { serviceid, acctid } = rowentry;

		var where = serviceid + '_inactive';
		store.dispatch(setNull(where, acctid));
	},
	render: function() {
		var { rowentry } = this.props; // attr

		var { serviceid, servicename, acctname, acctid } = rowentry;

		var buttons = [];
		buttons.push( React.createElement(Button, { key:'forget', style:2, size:'xs', text:'Forget', onClick:this.doNullify	 }) ); // TODO: l10n
		buttons.push( React.createElement(Button, { key:'activate', style:2, size:'xs', text:'Set Active', onClick:this.doActivate }) ); // TODO: l10n
		pushAlternatingRepeating(buttons, ' ');

		return React.createElement('div', { className:'shop-price' },
			React.createElement('div', { className:'fl' },
				React.createElement('div', undefined,
					React.createElement('h6', { className:'style-link-1 fl' },
						React.createElement('img', { src:core.addon.path.images + serviceid + '.svg', height:'24', width:'24' })
					),
					React.createElement('h5', { className:'fl ' + (acctname ? 'bold' : 'italic') },
						(acctname || 'No Active Account') // TODO: l10n
					)
				)
			),
			React.createElement('div', { className:'rate-info fr' },
				buttons
			)
		);
	}
});
var Inactives = React.createClass({
	render: function() {
		var { inactives } = this.props; // mapped state
		console.log('inactives:', inactives);
		var rows = []; // `actives` formated into an array so i can feed it React.createElement via `.map`
		for (var serviceid in inactives) {
			var serviceentry = core.nativeshot.services[serviceid];
			var oauthentry = inactives[serviceid];
			if (oauthentry) {
				rows.push(
					...oauthentry.map(
						el => ({
							serviceid,
							servicename: formatStringFromNameCore(serviceid, 'main'),
							acctname: deepAccessUsingString(el, serviceentry.oauth.dotname),
							acctid: deepAccessUsingString(el, serviceentry.oauth.dotid)
						})
					)
				);
			}
		}
		rows.sort((a,b) => a.servicename != b.servicename ? a.servicename.localeCompare(b.servicename) : a.acctname.localeCompare(b.acctname));
		console.log('rows:', rows);

		var rows_rel;
		if (rows.length) {
			rows_rel = rows.map( rowentry => React.createElement(InactiveRow, { rowentry, key:rowentry.acctid }) );
		} else {
			rows_rel = React.createElement('div', { className:'shop-price no-accounts' },
				'No Other Accounts'
			);
		}

		// actives will have all services in it, if it has no active entry it will be null per link47388
		return React.createElement('div', { className:'shoprow col-md-12' },
			React.createElement('div', { className:'shop-detail-info' },
				React.createElement('h4', undefined, 'Other Accounts'),
				rows_rel,
				React.createElement('p', undefined,
					'NativeShot will not upload to these accounts. These are multiple accounts that you have used and are saved so you do not have to reauthenticate them. If you want to upload to one of these accounts, simply set it to "active".'
				)
			)
		);
	}
});
// REACT COMPONENTS - CONTAINER
var ActivesContainer = ReactRedux.connect(
	function mapStateToProps(state, ownProps) {
		var { services } = core.nativeshot;
		var { oauth } = state;

		var actives = {};
		for (var serviceid in services) {
			var serviceentry = services[serviceid];
			if (serviceentry.oauth) {
				var key = serviceid; // + '_inactive';
				if (oauth[key]) {
					actives[key] = oauth[key];
				} else {
					actives[key] = null; // link47388
				}
			}
		}

		return {
			actives
		};
	},
	function mapDispatchToProps(dispatch, ownProps) {
		return {
			// doInactivate: (serviceid)=>dispatch(setInactive(serviceid))
		};
	}
)(Actives);
var InactivesContainer = ReactRedux.connect(
	function mapStateToProps(state, ownProps) {
		var { services } = core.nativeshot;
		var { oauth } = state;

		var inactives = {};
		for (var serviceid in services) {
			var serviceentry = services[serviceid];
			if (serviceentry.oauth) {
				var inactivekey = serviceid + '_inactive';
				if (oauth[inactivekey]) {
					inactives[serviceid] = oauth[inactivekey];
				}
			}
		}

		return {
			inactives
		};
	},
	function mapDispatchToProps(dispatch, ownProps) {
		return {
			// doActivate: (serviceid)=>dispatch(setActive(serviceid)),
			// doNullify: (where, acctid)=>dispatch(setNull(where, acctid))
		};
	}
)(Inactives);

// material for app.js
var gAppPageNarrow = false;

var gAppPageHeaderProps = {
	type: 3,
	get text() { return formatStringFromNameCore('header_text_dashboard', 'main') },
	menu: [
		{
			 get text() { return formatStringFromNameCore('history', 'main') },
			 href: 'about:nativeshot'
		},
		{
			 get text() { return formatStringFromNameCore('options', 'main') },
			 href: 'about:nativeshot?options'
		},
		{
			 get text() { return formatStringFromNameCore('authorization', 'main') }
		}
	]
};

var gAppPageComponents; // done on init, as needs l10n

var hydrant;
var hydrant_ex = {
	oauth: []
}
var hydrant_ex_instructions = {
	filestore_entries: ['oauth'],
};

/* oauth = object
{
	[serviceid]: { `session_details` },
	[serviceid] + '_inactive': [ { `session_details` }, { `session_details` } ]
}
*/

function shouldUpdateHydrantEx() {
	var state = store.getState();
	return; // debug
	// check if hydrant_ex updated
	var hydrant_ex_updated = false;
	for (var p in hydrant_ex) {
		var is_different = React.addons.shallowCompare({props:hydrant_ex[p]}, state[p]);
		if (is_different) {
			console.log('something in', p, 'of hydrant_ex was updated');
			hydrant_ex_updated = true;

			if (!gSupressUpdateHydrantExOnce) {
				// update file stores or whatever store this key in hydrant_ex is connected to
				if (hydrant_ex_instructions.filestore_entries && hydrant_ex_instructions.filestore_entries.includes(p)) {
					callInMainworker('updateFilestoreEntry', {
						mainkey: p,
						value: state[p]
					})
				} else if (p == 'addon_info') {
					// make sure it is just applyBackgroundUpdates, as i only support changing applyBackgroundUpdates
					if (hydrant_ex.addon_info.applyBackgroundUpdates !== state.addon_info.applyBackgroundUpdates) {
						callInBootstrap('setApplyBackgroundUpdates', state.addon_info.applyBackgroundUpdates);
					}
				}
			}
			console.log('compared', p, 'is_different:', is_different, 'state:', state[p], 'hydrant_ex:', hydrant_ex[p]);
			hydrant_ex[p] = state[p];
			// break; // dont break because we want to update the hydrant_ex in this global scope for future comparing in this function.
		}
	}

	if (gSupressUpdateHydrantExOnce) {
		console.log('hydrant_ex update supressed once');
		gSupressUpdateHydrantExOnce = false;
		return;
	}

	console.log('done shouldUpdateHydrantEx');
}

// ACTIONS
const SET_ACTIVE = 'SET_ACTIVE';
const SET_INACTIVE = 'SET_INACTIVE';
const SET_NULL = 'SET_NULL'; // deletes it


// ACTION CREATORS
function setActive(serviceid, acctid) {
	return {
		type: SET_ACTIVE,
		serviceid,
		acctid
	}
}
function setInactive(serviceid) {
	// because only one account is ever active for a serviceid, i dont need acctid or anything
	return {
		type: SET_INACTIVE,
		serviceid
	}
}
function setNull(where, acctid) {
	// `where` is key in oauth to find this `acctid`. so its either `serviceid` or `serviceid + '_inactive'`
	return {
		type: SET_NULL,
		where,
		acctid
	}
}

// REDUCERS
function oauth(state=hydrant_ex.oauth, action) {
	switch (action.type) {
		case SET_ACTIVE:
			var { serviceid, acctid } = action;
			var serviceentry = core.nativeshot.services[serviceid];

			var active = state[serviceid];
			var inactivekey = serviceid + '_inactive';
			var inactive = state[inactivekey];
			// console.log('inactive:', inactive);
			if (!inactive) return state; // this is a deverror, how is `setActive` called when nothing was inactive?

			var newinactive = inactive.filter(el => deepAccessUsingString(el, serviceentry.oauth.dotid) !== acctid);
			if (active) newinactive.push(active);
			var newactive = inactive.find(el => deepAccessUsingString(el, serviceentry.oauth.dotid) === acctid);
			// console.log('newactive:', newactive);
			if (!newactive) return state; // this is a deverror, how can it not find the thing to activate?
			// console.log('newinactive:', newinactive);

			var newstate = Object.assign({}, state, {
				[serviceid]: newactive,
				[inactivekey]: newinactive
			});

			return newstate;
		case SET_INACTIVE:
			var { serviceid } = action;

			var active = state[serviceid];
			if (!active) return state; // this is a deverror, how is `setInactive` called when nothing was active?
			var inactivekey = serviceid + '_inactive';
			var inactive = state[inactivekey] || [];

			var newinactive = [...inactive, active];

			var newstate = Object.assign({}, state, {
				[serviceid]: null,
				[inactivekey]: newinactive
			});

			return newstate;
		case SET_NULL:
			var { where, acctid } = action;

			var newstate;
			var oauthentry = state[where];
			if (Array.isArray(oauthentry)) { // can also do `where.endsWith('_inactive')`
				// it is in inactive
				var serviceid = where.substr(0, where.indexOf('_'));
				var serviceentry = core.nativeshot.services[serviceid];
				var newinactive = oauthentry.filter(el => deepAccessUsingString(el, serviceentry.oauth.dotid) !== acctid);
				var inactivekey = where;
				newstate = Object.assign({}, state, {
					[inactivekey]: newinactive
				});
			} else {
				// it is in active
				// i currently dont allow this so i didnt bother setting it up
			}

			return newstate;
		default:
			return state;
	}
}

// `var` so app.js can access it
var app = Redux.combineReducers({
	oauth
});

// end - react-redux

// start - common helpers
function deepAccessUsingString(obj, key){
	// https://medium.com/@chekofif/using-es6-s-proxy-for-safe-object-property-access-f42fa4380b2c#.xotsyhx8t
  return key.split('.').reduce((nestedObject, key) => {
    if(nestedObject && key in nestedObject) {
      return nestedObject[key];
    }
    return undefined;
  }, obj);
}
