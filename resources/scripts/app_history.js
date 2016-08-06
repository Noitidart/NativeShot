function initAppPage(aArg) {
	// aArg is what is received by the call in `init`
	store.dispatch(overwriteGalleryItems(hydrant_ex.logsrc));

	gAppPageComponents = [
		React.createElement(BarsContainer),
		React.createElement(FiltersContainer),
		React.createElement(GalleryContainer, { layouts:gGalleryLayouts })
	];
}

function uninitAppPage() {

}

var focusAppPage; // undefined for now, as i dont want focus events during dev

// start - react-redux

function getDisplayFilters(selected_filter) {
	var services = core.nativeshot.services;

	var display_filters = []; // element is an object
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
			display_filters.push({
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

			display_filters.push({
				serviceid,
				label: core.addon.l10n.main['filter_' + serviceid] || formatStringFromNameCore(serviceid, 'main')
			});
		}
	}

	// sort in `label` alpha
	display_filters.sort((a,b) => a.label.localeCompare(b.label));

	return display_filters;
}

var gGalleryLayouts = [ // must be in order from largest breakpoint to lowest
	{
		name: 'xxxlg',
		breakpoint: 99999999, // gallery_width <= this then it qualifies for xxxlg
		cols: 3 // col_width will be total gallery width DIVIDED BY this
	},
	{
		name: 'lg',
		breakpoint: 1200,
		cols: 3
	},
	{
		name: 'md',
		breakpoint: 996,
		cols: 3
	},
	{
		name: 'sm',
		breakpoint: 768,
		cols: 2
	},
	{
		name: 'xs',
		breakpoint: 480,
		cols: 1
	}
];

// REACT COMPONENTS - PRESENTATIONAL
var Filters = React.createClass({
	render: function() {
		var { selected_filter } = this.props; // mapped state
		var { setFilter } = this.props; // dispatchers

		var display_filters = getDisplayFilters(selected_filter);

		var services = core.nativeshot.services;
		if (selected_filter == 'all') {
			display_filters.splice(0, 0, {serviceid:'all', label:formatStringFromNameCore('filter_all', 'main')});
		} else {
			var all_of_type;
			if (services[selected_filter]) {
				all_of_type = services[selected_filter].type;
			} else {
				all_of_type = selected_filter;
			}
			display_filters.splice(0, 0, {serviceid:all_of_type, label:formatStringFromNameCore('filter_all_' + all_of_type, 'main')});
			display_filters.splice(0, 0, {serviceid:'all', label:formatStringFromNameCore('back', 'main')});
		}

		// `rel` is like `domel` it means react element
		var buttons_rel = display_filters.map(el => React.createElement('button', { className:(selected_filter == el.serviceid ? 'selected' : undefined), onClick:setFilter.bind(null, el.serviceid) },
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
		var { selected_filter } = this.props; // mapped state
		var { setFilter } = this.props; // dispatchers

		const MAX_COL = 3;

		var display_filters = getDisplayFilters(selected_filter);
		var services = core.nativeshot.services;
		var log = hydrant_ex.logsrc;

		if (selected_filter == 'all') {
			// get counts by type (`serviceid` in `filter_entry` is actually `type`)
			for (var filter of display_filters) {
				filter.cnt = log.filter( log_entry => getServiceFromCode(log_entry.t).entry.type === filter.serviceid ).length;
			}
		} else {
			// get counts of `serviceid`s in `display_filters`
			for (var filter of display_filters) {
				filter.cnt = log.filter( log_entry => log_entry.t === services[filter.serviceid].code ).length;
			}

			if (services[selected_filter]) {
				// `serviceid` is filtered
			} else {
				// no `serviceid` filtered, just `type` of `selected_filter`
			}
		}

		// get max cnt, set percent
		var max_cnt = 1;
		for (var filter of display_filters) {
			if (filter.cnt > max_cnt) {
				max_cnt = filter.cnt;
			}
		}

		// make 100% cnt be 5% more then max_cnt
		var hundred_cnt = max_cnt + (.05 * max_cnt);

		// set percent
		for (var filter of display_filters) {
			filter.per = Math.round((filter.cnt / hundred_cnt) * 100);
		}

		var serviceid_cnt = display_filters.length;

		var col_rels = [
			[], // col1
			[], // col2
			[] // col3
		];

		function animLine(per, el) {
			if (el) {
				window.getComputedStyle(el, '').width; // if i dont do this first, then the width wont transition/animate per bug1041292 - https://bugzilla.mozilla.org/show_bug.cgi?id=1041292#c3
				el.style.width = per + '%';
			} // else its null meaning el was unmounted
		}

		var colnum = 0;
		for (var filter of display_filters) {
			col_rels[colnum].push(
				React.createElement('div', { key:filter.serviceid, className:'service', onClick:setFilter.bind(null, filter.serviceid) },
					React.createElement('div', { className:'lblcnt' },
						filter.label,
						React.createElement(CountTo, { transition:'ease', duration:2000, mountval:0, end:filter.cnt })
					),
					React.createElement('div', { className:'line-bg' },
						React.createElement('div', { className:'line-fill', ref:(filter.per > 0 ? animLine.bind(null, filter.per) : undefined) })
					)
				)
			);
			if (++colnum === MAX_COL) {
				colnum = 0;
			}
		}

		var grid_class;
		if (col_rels[2].length) {
			grid_class = 'col-md-4 col-sm-6 col-xs-12';
		} else if (col_rels[1].length) {
			grid_class = 'col-md-6 col-sm-6 col-xs-12';
		} else {
			grid_class = 'col-md-12 col-sm-12 col-xs-12';
		}

		return React.createElement('div', { id:'bars', className:'padd-40' },
			React.createElement('div', { className:'row' },
				React.createElement('div', { className:grid_class },
					col_rels[0]
				),
				!col_rels[1].length ? undefined : React.createElement('div', { className:grid_class },
					col_rels[1]
				),
				!col_rels[2].length ? undefined : React.createElement('div', { className:grid_class }, // `grid_class` was "'col-md-4 col-sm-8 col-sm-offset-2 col-md-offset-0 col-xs-12'"
					col_rels[2]
				)
			)
		);
	}
});

var Gallery = React.createClass({
	render: function() {
		var { layouts } = this.props; // attr
		var { selected_filter, width, all_items } = this.props; // mapped state
		var { setFilter } = this.props; // dispatchers

		var display_filters = getDisplayFilters(selected_filter);
		var services = core.nativeshot.services;

		console.log('all_items:', all_items);

		if (width > 0) { // so we dont render when gallery width is not yet set
			var layout = layouts.reduce( (pre, cur) => width <= cur.breakpoint ? cur : pre );

			var colwidth = width / layout.cols;
			var colwidthpx = colwidth + 'px';

			var items;
			if (selected_filter == 'all') {
				items = all_items;
			} else {
				if (services[selected_filter]) {
					// `serviceid` is filtered
					items = all_items.filter(entry => entry.t === services[selected_filter].code );
				} else {
					// no `serviceid` filtered, just `type` of `selected_filter`
					items = all_items.filter(entry => getServiceFromCode(entry.t).entry.type == selected_filter );
				}
			}

			items = items.filter(entry => !getServiceFromCode(entry.t).entry.noimg);

			console.log('items:', items);

			var item_rels = items.map(entry =>
				React.createElement('div', { className:'galentry', style:{width:colwidthpx} },
					React.createElement('img', { src:entry.src })
				)
			);
		} else {
			var item_rels = undefined;
		}

		return React.createElement('div', { id:'gallery', className:'padd-80' },
			item_rels
		);
	},
	componentDidMount: function() {
		window.addEventListener('resize', this.resize, false);

		// console.error('gal width on mount:', ReactDOM.findDOMNode(this).offsetWidth);
		store.dispatch(setGalleryWidth(ReactDOM.findDOMNode(this).offsetWidth));
	},
	resize: function() {
		var domel = ReactDOM.findDOMNode(this);
		var width = domel.offsetWidth;

		console.log('width:', width);
		store.dispatch(setGalleryWidth(width));
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

var BarsContainer = ReactRedux.connect(
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
)(Bars);

var GalleryContainer = ReactRedux.connect(
	function mapStateToProps(state, ownProps) {
		return {
			selected_filter: state.selected_filter,
			width: state.gallery_width,
			all_items: state.gallery_items
		}
	},
	function mapDispatchToProps(dispatch, ownProps) {
		return {

		}
	}
)(Gallery);

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

const OVERWRITE_GALLERY_ITEMS = 'OVERWRITE_GALLERY_ITEMS';
const ADD_GALLERY_ITEMS = 'ADD_GALLERY_ITEMS';

const SET_GALLERY_WIDTH = 'SET_GALLERY_WIDTH';

// ACTION CREATORS
function overwriteGalleryItems(items) {
	// should only call this on `init`
	return {
		type: OVERWRITE_GALLERY_ITEMS,
		items
	}
}

function addGalleryItems(items) {
	return {
		type: ADD_GALLERY_ITEMS,
		items
	}
}

function setGalleryWidth(width) {
	return {
		type: SET_GALLERY_WIDTH,
		width
	}
}

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

function gallery_items(state=[], action) {
	switch (action.type) {
		case OVERWRITE_GALLERY_ITEMS:
			return action.items;
		case ADD_GALLERY_ITEMS:
			return [ ...state, ...action.items ];
		default:
			return state;
	}
}

// console.error('document.documentElement.offsetWidth:', document.documentElement.offsetWidth);
// var gGalleryWidthDefault = document.documentElement.offsetWidth - 123;
function gallery_width(state=0, action) {
	switch (action.type) {
		case SET_GALLERY_WIDTH:
			return action.width;
		default:
			return state;
	}
}

// `var` so app.js can access it
var app = Redux.combineReducers({
	selected_filter,
	gallery_width,
	gallery_items
});

// end - react-redux

function getServiceFromCode(servicecode) {
	// exact copy in bootstrap.js, MainWorker.js, app_history.js
	// console.log('getting service from id of:', servicecode);
	for (var a_serviceid in core.nativeshot.services) {
		if (core.nativeshot.services[a_serviceid].code === servicecode) {
			return {
				serviceid: a_serviceid,
				entry: core.nativeshot.services[a_serviceid]
			};
		}
	}
}
