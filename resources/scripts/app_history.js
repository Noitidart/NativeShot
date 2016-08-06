function initAppPage(aArg) {
	// aArg is what is received by the call in `init`
	gAppPageComponents = [
		React.createElement(Bars),
		React.createElement(FiltersContainer),
		React.createElement(Gallery)
	];
}

function uninitAppPage() {

}

var focusAppPage; // undefined for now, as i dont want focus events during dev

// start - react-redux

// REACT COMPONENTS - PRESENTATIONAL
var Filters = React.createClass({
	render: function() {
		var { selected_filter } = this.props; // mapped state
		var { setFilter } = this.props; // dispatchers

		var services = core.nativeshot.services;

		var buttons_detail = []; // element is an object
		if (selected_filter == 'all') {
			// add all types without duplicates
			var types = new Set();
			for (var serviceid in services) {
				var entry = services[serviceid];

				if (entry.history_ignore) { continue; }

				types.add(entry.type);
			}
			// put into array so i can later sort it
			for (var type of types) {
				buttons_detail.push({
					serviceid: type,
					label: formatStringFromNameCore('filter_' + type, 'main')
				});
			}
		} else {
			// selected_filter is either a `serviceid` or a `type`
			var type;
			if (selected_filter in services) {
				type = services[selected_filter].type;
			} else {
				// else its a `type`
				type = selected_filter;
			}

			for (var serviceid in services) {
				var entry = services[serviceid];

				if (entry.history_ignore) { continue; }
				if (entry.type != type) { continue; }

				buttons_detail.push({
					serviceid,
					label: core.addon.l10n.main['filter_' + serviceid] || formatStringFromNameCore(serviceid, 'main')
				});
			}
		}

		// sort with "all" in first position, then the rest in `label` alpha
		buttons_detail.sort((a,b) => a.label.localeCompare(b.label));
		buttons_detail.splice(0, 0, {serviceid:'all', label:formatStringFromNameCore('filter_all', 'main')});

		// `rel` is like `domel` it means react element
		var buttons_rel = buttons_detail.map(el => React.createElement('button', { className:(selected_filter == el.serviceid ? 'selected' : undefined), onClick:setFilter.bind(null, el.serviceid) },
			el.label
		));

		return React.createElement('div', { className:'padd-40' },
			React.createElement('div', { className:'row' },
				React.createElement('div', { id:'filters', className:'padd-40' },
					buttons_rel
				)
			)
		);
	}
});

var Bars = React.createClass({
	render: function() {
		return React.createElement('div', { id:'bars', className:'padd-40' },
			'bars'
		);
	}
});

var Gallery = React.createClass({
	render: function() {
		return React.createElement('div', { id:'gallery', className:'padd-80' },
			'gallery',
			React.createElement(Pagination)
		);
	}
});

var Pagination = React.createClass({
	render: function() {
		return React.createElement('div', { id:'pagination' },
			'pagination'
		);
	}
});
// REACT COMPONENTS - CONTAINER
var FiltersContainer = ReactRedux.connect(
	function mapStateToProps(state, ownProps) {
		return {
			selected_filter: state.selected_filter
		}
	},
	function mapDispatchToProps(dispatch, ownProps) {
		return {
			setFilter: serviceid => dispatch(setFilter(serviceid))
		}
	}
)(Filters);

// material for app.js
var gAppPageNarrow = false;

var gAppPageHeaderProps = {
	type: 3,
	get text() { return formatStringFromNameCore('header_text_dashboard', 'main') },
	menu: [
		{
			 get text() { return formatStringFromNameCore('history', 'main') },
		},
		{
			 get text() { return formatStringFromNameCore('options', 'main') },
			 href: 'about:nativeshot?options'
		},
		{
			 get text() { return formatStringFromNameCore('authorization', 'main') },
			 href: 'about:nativeshot?auth'
		}
	]
};

var gAppPageComponents; // done in init as needs l10n

var hydrant, hydrant_ex;
var hydrant_ex_instructions = {
	logsrc: true
}

function shouldUpdateHydrantEx() {} // need empty function, as i dont update any file with `logsrc` // need a function as `store.subscribe` is ran on `shouldUpdateHydrantEx` when `hydrant_ex_instructions` is present

// ACTIONS
const SET_FILTER = 'SET_FILTER';

// ACTION CREATORS
function setFilter(serviceid) {
	// `serviceid` is a string. a key in `core.nativeshot.services` (except ones marked `history_ignore` like "ocrall") OR "all"
	return {
		type: SET_FILTER,
		serviceid
	}
}

// REDUCERS
function selected_filter(state='all', action) {
	switch (action.type) {
		case SET_FILTER:
			return action.serviceid;
		default:
			return state;
	}
}

// `var` so app.js can access it
var app = Redux.combineReducers({
	selected_filter
});

// end - react-redux
