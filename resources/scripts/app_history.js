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

var gImageInfoLoading = {}; // object where key is the `item.src`, so link39193888 knows not to kick off another `loadImageForEntry` // value is true, if a `item.src` not in here, then its not loading AND EITHER it was never requested to load with `loadImageForEntry` OR `image_info` object was set in `item`
function loadImageForEntry(aEntry) {
	var info = {
		ok: undefined // `undefined` when loading, `false` when error, `true` when loaded and ready
		// reason: undefined // this is populated when `ok` is set to `false`
		// height: // set when `ok` is set to true
		// width: // set when `ok` is set to true
		// src: // set when `ok` is set to true
	};

	var image = new Image();

	// start async-proc94833
	var prelims = function() {
		if (aEntry.src.startsWith('file')) {
			callInBootstrap('makeResourceURI', aEntry.src, aResourceURI => {
				info.src = aResourceURI;
				loadit();
			});
		} else {
			info.src = aEntry.src;
			loadit();
		}
	};

	var loadit = function() {
		image.src = info.src;
	};

	image.onerror = function() {
		info.reason = 'ERROR: something happend'; // TODO
		info.ok = false;
		injectInfoIntoState();
	};
	image.onabort = function() {
		info.reason = 'ERROR: loading somehow aborted'; // TODO
		info.ok = false;
		injectInfoIntoState();
	};
	image.onload = function() {
		info.height = image.naturalHeight;
		info.width = image.naturalWidth;
		info.ok = true;
		injectInfoIntoState();
	};

	var injectInfoIntoState = function() {
		store.dispatch(injectGalleryImageInfo(aEntry.src, info));
	};

	prelims();
	// end async-proc94833

}

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
				React.createElement('div', { id:'filters' },
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

var gGalleryAnimated = false;
var Gallery = React.createClass({
	render: function() {
		var { layouts } = this.props; // attr
		var { selected_filter, width, all_items } = this.props; // mapped state
		var { setFilter } = this.props; // dispatchers

		var display_filters = getDisplayFilters(selected_filter);
		var services = core.nativeshot.services;

		console.log('all_items:', all_items);

		var item_rels;
		if (width > 0) { // so we dont render when gallery width is not yet set
			var layout = layouts.reduce( (pre, el) => width <= el.breakpoint ? el : pre );

			var colwidth = Math.round(width / layout.cols);
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

			var running_colheight = [];
			for (var i=0; i<layout.cols; i++) {
				running_colheight.push(0);
			}

			const GALENTRY_MIN_HEIGHT = 200;
			const GALITEM_IMAGE_MARGIN = 5; // must match crossfile-link173771

			item_rels = items.map( (entry, i) => {
				var col = i % layout.cols; // base 0
				var row = Math.floor(i / layout.cols);

				if (row > 0 && layout.cols > 1) {
					// find shortest col
					var shortest_col = running_colheight.reduce( (pre, el, i, arr) => i === 1 ? (el < pre ? i /*obviously 1*/ : i - 1 /*obviously 0*/) : (el < arr[pre] ? i : pre) )
					col = shortest_col;
				}

				var translate_x = col * colwidth;
				var translate_y = running_colheight[col];
				var transform = 'translate(' + translate_x + 'px, ' + translate_y + 'px)';

				var item_rel;
				var item_attr = { key:entry.src, className:'galentry', style:{width:colwidthpx, transform} };

				var image_info = entry.image_info;
				if (image_info) { // link39193888 - two ways to check if, check gImageInfoLoading or entry.image_info
					// if image_entry.ok is undefined it means its still loading
					if (image_info.ok) {

						// add to `running_colheight` this images height
						var display_img_width = colwidth - (GALITEM_IMAGE_MARGIN * 2);
						var scale_factor = display_img_width / image_info.width;
						var display_img_height = Math.round(image_info.height * scale_factor);
						if (display_img_height < GALENTRY_MIN_HEIGHT) {
							display_img_height = GALENTRY_MIN_HEIGHT - (GALITEM_IMAGE_MARGIN * 2);
						}

						var display_item_width = colwidth;
						var display_item_height = display_img_height + (GALITEM_IMAGE_MARGIN * 2);

						running_colheight[col] += display_item_height;

						// item_attr['data-display-item-dims'] = display_item_width + ' x ' + display_item_height;
						// item_attr['data-display-img-dims'] = display_img_width + ' x ' + display_img_height;
						// item_attr['data-img-dims'] = image_info.width + ' x ' + image_info.height;

						item_rel = React.createElement('img', { src:image_info.src }); // i dont do `entry.src` because like in case of file uri, the `image.src` is a resource uri and not the origianl which is `entry.src`
					} else {
						// failed
						item_rel = image_info.reason;
					}
				} else {
					if (!gImageInfoLoading[entry.src]) {
						// link39193888
						gImageInfoLoading[entry.src] = true;
						setTimeout(loadImageForEntry.bind(null, entry), 0);
					}
					running_colheight[col] += GALENTRY_MIN_HEIGHT;
					item_rel = React.createElement('div', { className:'uil-default-css' },
						[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map( deg => React.createElement('div', {style:{transform:'rotate('+deg+'deg) translate(0,-60px)'}}) )
					);
				}

				return React.createElement(GalleryItem, item_attr,
					item_rel
				);
			});

			if (!items.length) {
				item_rels = React.createElement(GalleryItem, { key:selected_filter, className:'galentry', style:{width:(layout.cols*colwidth)+'px', transform:'translate(0, 0)'} },
					React.DOM.div({ className:'no-images' },
						formatStringFromNameCore('no_images_in_filter', 'main')
					)
				);
			}
		} else {
			item_rels = undefined;
		}

		if (width > 0 && !gGalleryAnimated && !document.getElementById('app_wrap').getAttribute('class').includes('animsition')) {
			gGalleryAnimated = true;
		}

		return React.createElement(ReactTransitionGroup, { component:'div', id:'gallery', className:'padd-80' + (gGalleryAnimated ? ' galsition' : '') },
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

var GalleryItem = React.createClass({
	render: function() {
		var attr = {};
		for (var p in this.props) {
			if (p != 'children' && p != 'ref' && p != 'key') {
				attr[p] = this.props[p];
			}
		}
		if (gGalleryAnimated && !this.entered) {
			attr.style.transform += ' scale(0.01)'; // cant scale to 0, otherwise it also translates to 0,0. so i do 0.01
		}
		return React.DOM.div(attr,
			this.props.children
		);
	},
	entered: false,
	// componentDidMount: function() {
	// 	console.error('comp did mount!');
	// },
	// componentWillUnmount: function() {
	// 	console.error('will UNMOUNT');
	// },
	// componentWillAppear: function(callback) {
	// 	console.error('will appear');
	// 	callback();
	// },
	// componentDidAppear: function() {
	// 	console.error('did appear');
	// },
	componentWillEnter: function(callback) {
		this.entered = true;
		if (!gGalleryAnimated) {
			callback();
		} else {
			var domel = ReactDOM.findDOMNode(this);
			domel.style.transform = this.props.style.transform.replace('0.01', '1');
			setTimeout(callback, 301);
		}
	},
	// componentDidEnter: function() {
	// 	console.error('did enter');
	// },
	componentWillLeave: function(callback) {
		// console.error('will leave, transform:', this.props.style.transform);
		if (!gGalleryAnimated) {
			callback();
		} else {
			var domel = ReactDOM.findDOMNode(this);
			domel.style.transform = this.props.style.transform + ' scale(0.01)'; // cant scale to 0, otherwise it also translates to 0,0. so i do 0.01
			setTimeout(callback, 301);
		}
	}
	// componentDidLeave: function() {
	// 	console.error('did leave');
	// }
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
const INJECT_GALLERY_IMAGE_INFO = 'INJECT_GALLERY_IMAGE_INFO';

const SET_GALLERY_WIDTH = 'SET_GALLERY_WIDTH';

// ACTION CREATORS
function overwriteGalleryItems(items) {
	// should only call this on `init`
	return {
		type: OVERWRITE_GALLERY_ITEMS,
		items
	}
}

function injectGalleryImageInfo(src, info) {
	// `src` is the `src` in `item` NOT the resource uri `src` found in `info.src` if its a file://
	return {
		type: INJECT_GALLERY_IMAGE_INFO,
		src,
		info
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
		case INJECT_GALLERY_IMAGE_INFO:
			var { src, info } = action;
			return state.map(item => {
				if (item.src && item.src == src) { // `noimg` type entries in the log (`item`) dont have a `src`
					return Object.assign({}, item, {
						image_info: info
					});
				} else {
					return item;
				}
			});
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
