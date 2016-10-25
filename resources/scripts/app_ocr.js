var gImageData;
var gActionId;
var gAlreadyLogged = {};

function initAppPage(aArg) {
	// aArg is what is received by the call in `init`
	var actionid = window.location.href.match(/\d{11,}/i);
	if (!actionid) {
		alert('show error page');
		gAppPageComponents.push(formatStringFromNameCore('error_actionid', 'main'));
	} else {
		var deferred = new Deferred();
		gActionId = actionid = parseInt(actionid);
		callInBootstrap('extractData', actionid, function(data) {
			if (!data) {
				gAppPageComponents.push(formatStringFromNameCore('error_datagone', 'main'));
			} else {

				gImageData = new ImageData(new Uint8ClampedArray(data.arrbuf), data.width, data.height);

				var serviceids = Object.keys(data.txt);
				serviceids.sort();
				var l = serviceids.length;
				for (var i=0; i<l; i++) {
					var serviceid = serviceids[i];
					var result = data.txt[serviceid];
					var br = i === l-1 ? false : true;
					gAppPageComponents.push(
						React.createElement(SectionContainer, {
							serviceid,
							result,
							br
						})
					);
				}

				if (l === 1) {
					// already logged it
					gAlreadyLogged[serviceid] = true;
				}
			}
			deferred.resolve();
		});
		return deferred.promise;
	}
}

function uninitAppPage() {

}

function copyListener(e) {
	console.log('copied, e:', e);
	var parentNodes = document.querySelectorAll('[data-serviceid]'); // parent el of the pTxt textNodes
	var l = parentNodes.length;

	var sel = window.getSelection();
	if (sel.toString().trim().length) {
		for (var i=0; i<l; i++) {
			var textNode = parentNodes[i].childNodes[0]; // the pTxt containing node. its always a signle text element ah
			if (textNode && textNode.textContent.trim().length) {
				console.error(i, 'textNode.textContent.trim():', textNode.textContent.trim());
				if (sel.containsNode(textNode, true)) {
					var serviceid = parentNodes[i].getAttribute('data-serviceid').toLowerCase();
					if (!gAlreadyLogged[serviceid]) {
						callInMainworker('addShotToLog', { serviceid, actionid:gActionId });
						gAlreadyLogged[serviceid] = true;
					}
					else { console.warn('already logged this service:', { serviceid, actionid:gActionId }) }
				}
			}
		}
	}
}
document.addEventListener('copy', copyListener, false);

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

		var { serviceid, result, br } = this.props; // attr defind
		var { juxtaposed, whitespaced, tesseract_reprocess, tesseract_options, tesseract_selected_option } = this.props; // mapped state
		var { copy, toggleJuxtaposition, toggleWhitespace, tesseractChanged } = this.props; // dispatchers

		var canRef = function(can) {
			console.log('can:', can);
			if (can) {
				var ctx = can.getContext('2d');
				ctx.putImageData(gImageData, 0, 0);
			}
		};

		var result_rel;
		if (typeof(tesseract_reprocess) == 'number') {
			result_rel = React.createElement('span', { 'data-serviceid':serviceid },
				React.createElement('div', { className:'tesseract-reprocess-progress' },
					tesseract_reprocess + '%'
				),
				React.createElement('div', { className:'uil-default-css' },
					[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map( deg => React.createElement('div', {style:{transform:'rotate('+deg+'deg) translate(0,-60px)'}}) )
				)
			);
		} else {
			result_rel = React.createElement('span', { 'data-serviceid':serviceid, style:(!whitespaced ? {whiteSpace:'pre'} : undefined) },
				tesseract_reprocess ? tesseract_reprocess.result : result
			);
		}

		return React.createElement('div', {className:'padd-80'},
			React.createElement('div', {className:'row'},
				React.createElement('div', {className:'col-md-12'},
					React.createElement('div', {className:'det-tags'},
						React.createElement('h4', undefined,
							formatStringFromNameCore(serviceid, 'main').toUpperCase()
						),
						React.createElement('div', {className:'tags-button'},
							typeof(tesseract_reprocess) != 'number' ? React.createElement(Button, { style:6, size:'xs', onClick:copy, text:formatStringFromNameCore('just_copy', 'main') }) : undefined,
							typeof(tesseract_reprocess) != 'number' ? ' ' : undefined,
							typeof(tesseract_reprocess) != 'number' ? React.createElement(Button, { style:6, size:'xs', onClick:toggleWhitespace, text:formatStringFromNameCore(!whitespaced ? 'min_whitespace' : 'orig_whitespace', 'main'), key:(!whitespaced ? 'orig_whitespace' : 'min_whitespace') }) : undefined,
							typeof(tesseract_reprocess) != 'number' ? ' ' : undefined,
							React.createElement(Button, { style:6, size:'xs', onClick:toggleJuxtaposition, text:formatStringFromNameCore(juxtaposed ? 'hide_image' : 'image_compare', 'main'), key:(juxtaposed ? 'hide_image' : 'image_compare') }),
							serviceid != 'tesseract' ? undefined : ' ',
							serviceid != 'tesseract' ? undefined : React.createElement(Dropdown, { style:6, size:'xs', label:formatStringFromNameCore('change', 'main'), alwaysShowLabel:false, options:tesseract_options, selected:tesseract_selected_option, onChange:tesseractChanged })
						)
					)
				)
			),
			React.createElement('div', {className:'row'},
				React.createElement('div', { className:(!juxtaposed ? 'col-lg-12 col-md-12 col-sm-12 col-xs-12' : 'col-lg-6 col-md-6 col-sm-6 col-xs-6') },
					result_rel
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
			),
			br ? React.DOM.br() : undefined
		);
	}
});
// REACT COMPONENTS - CONTAINER
var SectionContainer = ReactRedux.connect(
	function mapStateToProps(state, ownProps) {
		var { serviceid } = ownProps;
		var tesseract_options;
		var tesseract_selected_option;
		var tesseract_reprocess;
		if (serviceid == 'tesseract') {
			tesseract_options = createSortedTessLangArr()
			tesseract_selected_option = tesseract_options.find(el => el.value == hydrant_ex.prefs.default_tesseract_lang)
			tesseract_reprocess = state.tesseract_reprocess;
		}
		return {
			juxtaposed: state.juxtapositions[serviceid],
			whitespaced: state.whitespaces[serviceid],
			tesseract_options,
			tesseract_selected_option,
			tesseract_reprocess
		}
	},
	function mapDispatchToProps(dispatch, ownProps) {
		var { serviceid, result } = ownProps;
		var tesseractChanged;
		if (serviceid == 'tesseract') {
			tesseractChanged = (lang) => {
				if (lang == hydrant_ex.prefs.default_tesseract_lang) {
					dispatch(tesseractReprocessing(100));
					setTimeout(()=>dispatch(tesseractUnprocessed()), 500);
				} else {
					dispatch(tesseractReprocessing());
					callInMainworker(
						'tesseractReprocess',
						{
							__XFER: ['arrbuf'],
							arrbuf: gImageData.data.buffer.slice(),
							width: gImageData.width,
							height: gImageData.height,
							lang
						},
						aStatusObj => {

							if (aStatusObj.reason == 'SUCCESS') {
								dispatch(tesseractReprocessed(lang, aStatusObj.data.txt.tesseract));
							} else if (aStatusObj.reason == 'PROGRESS') {
								console.log('progress! aStatusObj:', aStatusObj);
								dispatch(tesseractReprocessing(aStatusObj.data.percent));
							} else {
								// TODO:
							}
						}
					)
				}
			}
		}
		return {
			toggleJuxtaposition: () => dispatch(toggleJuxtaposition(serviceid)),
			toggleWhitespace: () => dispatch(toggleWhitespace(serviceid)),
			tesseractChanged,
			copy: () => {
				var copytxt = result;
				if (serviceid == 'tesseract') {
					var state = store.getState();
					if (state.tesseract_reprocess && typeof(state.tesseract_reprocess) == 'object') {
						copytxt = state.tesseract_reprocess.result;
					}
				}
				callInBootstrap('copy', copytxt);
				if (!gAlreadyLogged[serviceid]) {
					callInMainworker('addShotToLog', { serviceid, actionid:gActionId });
					gAlreadyLogged[serviceid] = true;
				}
				else { console.warn('already logged this service:', { serviceid, actionid:gActionId }) }
			}
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

var hydrant;
var hydrant_ex = {
	prefs: {}
};
var hydrant_ex_instructions = { // stuff that shouldnt get written to hydrants entry in filestore. updating this is handled manually by dev
	filestore_entries: ['prefs']
};
function shouldUpdateHydrantEx() {} // required as I have set `hydrant_ex_instructions`

// ACTIONS
const TOGGLE_JUXTAPOSITION = 'TOGGLE_JUXTAPOSITION';
const TOGGLE_WHITESPACE = 'TOGGLE_WHITESPACE';
const TESSERACT_REPROCESSING = 'TESSERACT_REPROCESSING';
const TESSERACT_REPROCESSED = 'TESSERACT_REPROCESSED';
const TESSERACT_UNPROCESSED = 'TESSERACT_UNPROCESSED';

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
function tesseractReprocessing(percent=0) {
	return {
		type: TESSERACT_REPROCESSING,
		percent
	}
}
function tesseractReprocessed(lang, result) {
	return {
		type: TESSERACT_REPROCESSED,
		lang,
		result
	}
}
function tesseractUnprocessed() {
	return {
		type: TESSERACT_UNPROCESSED
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
function tesseract_reprocess(state=null, action) {
	// state is
		// null for use default
		// typeof is number for spinner and percent
		// an object with keys, `lang` and `result`
	switch (action.type) {
		case TESSERACT_UNPROCESSED:
			return null;
		case TESSERACT_REPROCESSING:
			return action.percent;
		case TESSERACT_REPROCESSED:
			var { lang, result } = action;
			return {
				lang,
				result
			};
		default:
			return state;
	}
}

// `var` so app.js can access it
var app = Redux.combineReducers({
	juxtapositions,
	whitespaces,
	tesseract_reprocess
});

// end - react-redux
