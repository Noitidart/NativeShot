var gServiceid = window.location.href.toLowerCase().match(/[a-z]+(?=\/)/)[0];
var gAuthorized = window.location.href.toLowerCase().includes('approved'); // `true` if approved, `false` if denied

function initAppPage(aArg) {
	// aArg is what is received by the call in `init`
	document.title = formatStringFromNameCore(gServiceid, 'main') + ' ' + document.title;
	gAppPageComponents = [
		React.createElement(Jumbotron, { logo:core.addon.path.images + gServiceid + '.svg' })
	];
}

function uninitAppPage() {

}

function closeSelfTab() {
	callInBootstrap('closeSelfTab');
}

function reauth() {
	callInMainworker('openAuthTab', gServiceid);
}

// start - react-redux

// REACT COMPONENTS - PRESENTATIONAL
var Jumbotron = React.createClass({
	render: function() {
		var { logo } = this.props;

		return React.createElement('div', { className:'jumbotron jumbo-' + gServiceid, style:(logo ? {backgroundImage:'url(' + logo + ')'} : undefined) },
			React.createElement('h1', undefined,
				formatStringFromNameCore(gAuthorized ? 'approved' : 'denied', 'main') + (gAuthorized ? '!!!' : ' =(')
			),
			React.createElement('p', { className:'lead' },
				formatStringFromNameCore(gAuthorized ? 'approved_msg' : 'denied_msg', 'main')
			),
			React.createElement('p', { className:'lead' },
				!gAuthorized ? React.createElement(Button, { style:4, text:formatStringFromNameCore('reauth_button', 'main'), size:'lg', onClick:reauth }) : undefined,
				!gAuthorized ? ' ' : undefined,
				React.createElement(Button, { style:3, text:formatStringFromNameCore('close_tab', 'main'), size:'lg', onClick:closeSelfTab })
			)
		);
	}
});
// REACT COMPONENTS - CONTAINER

// material for app.js
var gAppPageNarrow = true;

var gAppPageHeaderProps = {
	type: 2,
	get text() { return formatStringFromNameCore('header_text_auth', 'main', [ formatStringFromNameCore(gServiceid, 'main') ]) },
	get minortext() { return formatStringFromNameCore('addon_name', 'main') },
	get logo() { return core.addon.path.images + gServiceid + '.svg' },
	logowidth: 42,
	logoheight: 42
};

var gAppPageComponents; // setup in initAppPage as need core

var hydrant, hydrant_ex, hydrant_ex_instructions;

// ACTIONS

// ACTION CREATORS

// REDUCERS

// `var` so app.js can access it
var app = null; // will prevent app.js from setting up redux
// var app = Redux.combineReducers({
// 	alerts
// });

// end - react-redux
