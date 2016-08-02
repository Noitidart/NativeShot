var gImageData;

function initAppPage(aArg) {
	// aArg is what is received by the call in `init`
	var actionid = window.location.href.match(/\d{11,}/i);
	if (!actionid) {
		alert('show error page');
		gAppPageComponents.push('ERROR: Could not identify action');
	} else {
		var deferred = new Deferred();
		actionid = parseInt(actionid);
		callInBootstrap('extractData', actionid, function(data) {
			if (!data) {
				gAppPageComponents.push('ERROR: Data for this action no longer exists. The data bar was probably closed.');
			} else {
				console.log('ok got data:', data);

				gImageData = new ImageData(new Uint8ClampedArray(data.arrbuf), data.width, data.height);

				for (serviceid in data.txt) {
					gAppPageComponents.push(
						React.createElement(Section, {
							serviceid,
							result: data.txt[serviceid]
						})
					);
				}
			}
			deferred.resolve();
		});
		return deferred.promise;
	}
}

function uninitAppPage() {

}

// start - react-redux

// REACT COMPONENTS - PRESENTATIONAL
var ErrorSection = React.createClass({
	displayName: 'Section',
	render: function() {
		var { msg } = this.props;

		React.createElement('div', { className:'padd-80' },
			React.createElement('div', { className:'row' },
				React.createElement('div', { className:'col-lg-12 col-md-12 col-sm-12 col-xs-12' },
					React.createElement('div', { className:'second-caption dataerror' },
						React.createElement('p', null,
							React.createElement('span', null,
								msg
							)
						)
					)
				)
			)
		)
	}
});
var Section = React.createClass({
	displayName: 'Section',
	render: function() {

		var { serviceid, result, sJuxt, sNoPre } = this.props;

		var canRef = function(can) {
			console.log('can:', can);
			if (can) {
				var ctx = can.getContext('2d');
				ctx.putImageData(gImageData, 0, 0);
			}
		};

		return React.createElement('div', {className:'padd-80'},
			React.createElement('div', {className:'row'},
				React.createElement('div', {className:'col-md-12'},
					React.createElement('div', {className:'det-tags'},
						React.createElement('h4', null,
							formatStringFromNameCore(serviceid, 'main').toUpperCase()
						),
						React.createElement('div', {className:'tags-button'},
							React.createElement(Button, { style:6, size:'xs', onClick:this.copy, text:formatStringFromNameCore('just_copy', 'main') }),
							' ',
							React.createElement(Button, { style:6, size:'xs', onClick:this.pre, text:formatStringFromNameCore(sNoPre ? 'orig_whitespace' : 'min_whitespace', 'main') }),
							' ',
							React.createElement(Button, { style:6, size:'xs', onClick:this.juxtapose, text:formatStringFromNameCore(sJuxt ? 'hide_image' : 'image_compare', 'main') })
						)
					)
				)
			),
			React.createElement('div', {className:'row'},
				React.createElement('div', { className:(!sJuxt ? 'col-lg-12 col-md-12 col-sm-12 col-xs-12' : 'col-lg-6 col-md-6 col-sm-6 col-xs-6') },
					React.createElement('div', { className:'second-caption' },
						React.createElement('p', null,
							React.createElement('span', { 'data-service-name':serviceid, style:(sNoPre ? undefined : {whiteSpace:'pre'}) },
								result
							)
						)
					)
				),
				!sJuxt ? undefined : React.createElement('div', {className:'col-lg-6 col-md-6 col-sm-6 col-xs-6'},
					React.createElement('div', {className:'second-caption'},
						React.createElement('p', null,
							React.createElement('span', null,
								React.createElement('canvas', { ref:canRef, width:gImageData.width, height:gImageData.height })
							)
						)
					)
				)
			)
		);
	}
});
// REACT COMPONENTS - CONTAINER

// material for app.js
var gAppPageNarrow = false;

var gAppPageHeaderProps = {
	type: 1,
	get text() { return formatStringFromNameCore('header_text_ocr', 'main') }
};

var gAppPageComponents = [

];

var hydrant, hydrant_ex, hydrant_ex_instructions;

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
