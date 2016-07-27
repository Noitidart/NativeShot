function initAppPage(aArg) {
	// aArg is what is received by the call in `init`

}

function uninitAppPage() {

}

// start - react-redux

// REACT COMPONENTS - PRESENTATIONAL

// REACT COMPONENTS - CONTAINER

// material for app.js
var gAppPageHeaderProps = {
	type: 1,
	get text() { return formatStringFromNameCore('header_text_dashboard', 'main') }
};

var gAppPageComponents = [
	React.createElement(Link, { href:'about:blank' }, 'hiii'),
	Link('rawr', 'data:text/html,rawr')
];

var hydrant;

// ACTIONS
const REMOVE_ALERT = 'REMOVE_ALERT';

// ACTION CREATORS
function removeAlert(alertid, obj) {
	// obj can contain a mix of these keys
		// acceptable keys: { body, body_prefix, body_suffix, color, dismissible, glyph, title }

	return {
		type: ADD_ALERT,
		alertid,
		obj
	}
}

// REDUCERS
function alerts(state=[], action) {
	switch (action.type) {
		case REMOVE_ALERT:
			return state.filter( alert => alert.alertid !== action.alertid );
		default:
			return state;
	}
}

// `var` so app.js can access it
var app = Redux.combineReducers({
	alerts
});

// end - react-redux
