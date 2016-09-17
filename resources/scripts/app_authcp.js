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
		var { setInctive } = this.props; // dispatchers

		var rows = []; // `actives` formated into an array so i can feed it React.createElement via `.map`
		for (var serviceid in actives) {
			var serviceentry = core.nativeshot.services[serviceid];
			var oauthentry = actives[serviceid];
			rows.push({
				serviceid,
				servicename: formatStringFromNameCore(serviceid, 'main'),
				acctname: oauthentry ? null : deepAccessUsingString(oauthentry, serviceentry.oauth.dotname),
				acctid: oauthentry ? null : deepAccessUsingString(oauthentry, serviceentry.oauth.dotid)
			});
		}
		rows.sort((a,b) => a.servicename.localeCompare(b.servicename));
		console.log('rows:', rows);

		// actives will have all services in it, if it has no active entry it will be null per link47388
		return React.createElement('div', { className:'col-md-12' },
			React.createElement('div', { className:'shop-detail-info' },
				React.createElement('h4', undefined, 'Active Accounts'),
				rows.map( rowentry => React.createElement(ActiveRow, { rowentry, setInactive, key:rowentry.serviceid }) )
			)
		);
	}
});
var ActiveRow = React.createClass({
	setInactive: function() {
		var { setInactive } = this.props; // attr

	},
	render: function() {
		var { rowentry } = this.props; // attr

		var { serviceid, servicename, acctname, acctid } = rowentry;

		var buttons = [];
		if (acctname) {
			buttons.push( React.createElement(Button, { key:'deactivate', style:2, size:'sm', text:'Deactivate' }) ); // TODO: l10n
		} else {
			buttons.push( React.createElement(Button, { key:'authnow', style:2, size:'sm', text:'Authorize Now' }) ); // TODO: l10n
		}

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
		var { setActive } = this.props; // dispatchers

		return React.createElement('div', undefined, inactives.toString());
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
			setInactive: ()=>dispatch(setInactive())
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
				var key = serviceid + '_inactive';
				if (oauth[key]) {
					inactives[key] = oauth[key];
				}
			}
		}

		return {
			inactives
		};
	},
	function mapDispatchToProps(dispatch, ownProps) {
		return {
			setInctive: ()=>dispatch(setInactive())
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
	oauth: {}
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
function setActive(serviceid, entry) {
	return {
		type: SET_ACTIVE,
		serviceid,
		entry
	}
}
function setInactive(serviceid, entry) {
	return {
		type: SET_INACTIVE,
		serviceid,
		entry
	}
}
function setNull(entry) {
	return {
		type: SET_NULL,
		entry
	}
}

// REDUCERS
function oauth(state=[], action) {
	switch (action.type) {
		case SET_ACTIVE:
			return state;
		case SET_INACTIVE:
			return state;
		case SET_NULL:
			return state;
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
