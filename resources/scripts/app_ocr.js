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

				gImageData = new ImageData(new Uint8ClampedArray(data.arrbuf), data.width, data.height);

				for (var serviceid in data.txt) {
					gAppPageComponents.push(
						React.createElement(SectionContainer, {
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

		var { serviceid, result } = this.props; // attr defind
		var { juxtaposed, whitespaced } = this.props; // mapped state
		var { copy, toggleJuxtaposition, toggleWhitespace } = this.props; // dispatchers

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
						React.createElement('h4', undefined,
							formatStringFromNameCore(serviceid, 'main').toUpperCase()
						),
						React.createElement('div', {className:'tags-button'},
							React.createElement(Button, { style:6, size:'xs', onClick:copy, text:formatStringFromNameCore('just_copy', 'main') }),
							' ',
							React.createElement(Button, { style:6, size:'xs', onClick:toggleWhitespace, text:formatStringFromNameCore(!whitespaced ? 'orig_whitespace' : 'min_whitespace', 'main'), key:(!whitespaced ? 'orig_whitespace' : 'min_whitespace') }),
							' ',
							React.createElement(Button, { style:6, size:'xs', onClick:toggleJuxtaposition, text:formatStringFromNameCore(juxtaposed ? 'hide_image' : 'image_compare', 'main'), key:(juxtaposed ? 'hide_image' : 'image_compare') })
						)
					)
				)
			),
			React.createElement('div', {className:'row'},
				React.createElement('div', { className:(!juxtaposed ? 'col-lg-12 col-md-12 col-sm-12 col-xs-12' : 'col-lg-6 col-md-6 col-sm-6 col-xs-6') },
					React.createElement('div', { className:'second-caption' },
						React.createElement('p', null,
							React.createElement('span', { 'data-service-name':serviceid, style:(!whitespaced ? undefined : {whiteSpace:'pre'}) },
								result
							)
						)
					)
				),
				!juxtaposed ? undefined : React.createElement('div', {className:'col-lg-6 col-md-6 col-sm-6 col-xs-6'},
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
var SectionContainer = ReactRedux.connect(
	function mapStateToProps(state, ownProps) {
		var { serviceid, result } = ownProps;
		return {
			juxtaposed: state.juxtapositions[serviceid],
			whitespaced: state.whitespaces[serviceid],
			serviceid,
			result
		}
	},
	function mapDispatchToProps(dispatch, ownProps) {
		var { serviceid, result } = ownProps;
		return {
			toggleJuxtaposition: () => dispatch(toggleJuxtaposition(serviceid)),
			toggleWhitespace: () => dispatch(toggleWhitespace(serviceid)),
			copy: callInBootstrap.bind(null, 'copy', result)
		}
	}
)(Section);

// material for app.js
var gAppPageNarrow = false;

var gAppPageHeaderProps = {
	type: 1,
	get text() { return formatStringFromNameCore('header_text_ocr', 'main') }
};

var gAppPageComponents = [];

var hydrant, hydrant_ex, hydrant_ex_instructions;

// ACTIONS
const TOGGLE_JUXTAPOSITION = 'TOGGLE_JUXTAPOSITION';
const TOGGLE_WHITESPACE = 'TOGGLE_WHITESPACE';

// ACTION CREATORS
function toggleJuxtaposition(serviceid) {
	return {
		type: TOGGLE_JUXTAPOSITION,
		serviceid
	}
}
function toggleWhitespace(serviceid) {
	return {
		type: TOGGLE_WHITESPACE,
		serviceid
	}
}

// REDUCERS
function juxtapositions(state={}, action) {
	switch (action.type) {
		case TOGGLE_JUXTAPOSITION:
			var { serviceid } = action;
			return Object.assign({}, state, {
				[serviceid]: !state[serviceid]
			});
		default:
			return state;
	}
}
function whitespaces(state={}, action) {
	switch (action.type) {
		case TOGGLE_WHITESPACE:
			var { serviceid } = action;
			return Object.assign({}, state, {
				[serviceid]: !state[serviceid]
			});
		default:
			return state;
	}
}

// `var` so app.js can access it
var app = Redux.combineReducers({
	juxtapositions,
	whitespaces
});

// end - react-redux
