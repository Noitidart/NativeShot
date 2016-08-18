var gInited = false;
var core;
var gFsComm;
var callInFramescript, callInMainworker, callInBootstrap;

function preinit() {
	console.log('in iprenit');
	({ callInFramescript, callInMainworker, callInBootstrap } = CommHelper.contentinframescript);
	gFsComm = new Comm.client.content(init);
}
window.addEventListener('DOMContentLoaded', preinit, false);

function animsitizeOnBackForward() {
	// this happens when go back/forward and its like a non-fresh page, i saw this behavior in nightly
	var domel = document.querySelector('.app-wrap');
	if (domel) {
		if (domel.classList.contains('animsition-leave') || !domel.classList.add('animsition-enter')) {
			domel.classList.add('animsition-enter');
			domel.classList.remove('animsition-leave');
			domel.classList.remove('animsition-leave-active');
			setTimeout(function() {
				domel.classList.add('animsition-enter-active');
				var removeAfter = function(e) {
					if (e.target != domel) { return }
					e.stopPropagation();
					domel.removeEventListener('transitionend', removeAfter, false);
					domel.classList.remove('animsition-enter');
					domel.classList.remove('animsition-enter-active');
				};
				setTimeout(function() {
					domel.addEventListener('transitionend', removeAfter, false);
				}, 0);
			}, 0);
		}
	}
}
window.addEventListener('pageshow', animsitizeOnBackForward, false);

function init() {
	console.error('calling fetchCore with hydrant_ex_instructions:', hydrant_ex_instructions);
	callInMainworker('fetchCore', { hydrant, hydrant_ex_instructions }, function(aArg) {
		console.log('aArg in app.js:', aArg);
		({ core } = aArg);

		// set up some listeners
		// window.addEventListener('unload', uninit, false);

		// setup and start redux
		if (app) {
			if (hydrant) {
				// dont update hydrant if its undefined, otherwise it will screw up all default values for redux
				hydrant = aArg.hydrant;
			}
			if (hydrant_ex_instructions) {
				hydrant_ex = aArg.hydrant_ex;
			}

			store = Redux.createStore(app);

			if (hydrant) {
				store.subscribe(shouldUpdateHydrant);
			}
			if (hydrant_ex_instructions) {
				store.subscribe(shouldUpdateHydrantEx);
			}
		}

		var page_inited = initAppPage(aArg);

		var afterPageInited = function() {
			// render react
			ReactDOM.render(
				React.createElement(ReactRedux.Provider, { store },
					React.createElement(App)
				),
				document.getElementById('root')
			);
			if (typeof(focusAppPage) != 'undefined') {
				window.addEventListener('focus', focusAppPage, false);
			}
		};

		if (page_inited && page_inited.constructor.name == 'Promise') {
			page_inited.then(afterPageInited);
		} else {
			afterPageInited();
		}

	});
}

function uninit() {
	// triggered by uninit of framescript - if i want to do something on unload of page i should create function unload() and addEventListener('unload', unload, false)
	// window.removeEventListener('unload', uninit, false);

	uninitAppPage();

	Comm.client.unregAll('content');
}

// start - functions called by framescript

// end - functions called by framescript

// start - react-redux
const ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;
const ReactTransitionGroup = React.addons.TransitionGroup;

// STORE
var store;

// var unsubscribe = store.subscribe(() => console.log(store.getState()) );

var gSupressUpdateHydrantOnce = false; // supress the updating of the filestore due to hydrant update
var gSupressUpdateHydrantExOnce = false; // supress the updating of the filestore due to hydrant update
function shouldUpdateHydrant() {
	console.log('in shouldUpdateHydrant');

	var state = store.getState();

	// check if hydrant updated
	var hydrant_updated = false;
	for (var p in hydrant) {
		var is_different = React.addons.shallowCompare({props:hydrant[p]}, state[p]);
		if (is_different) {
			console.log('something in', p, 'of hydrant was updated');
			hydrant_updated = true;
			hydrant[p] = state[p];
			// break; // dont break because we want to update the hydrant in this global scope for future comparing in this function.
		}
		console.log('compared', p, 'is_different:', is_different, 'state:', state[p], 'hydrant:', hydrant[p]);
	}

	if (hydrant_updated) {
		if (gSupressUpdateHydrantOnce) {
			console.log('hydrant update supressed once');
			gSupressUpdateHydrantOnce = false;
		} else {
			callInMainworker('updateHydrant', {
				head: gPage.name,
				hydrant
			});
		}
	}

	console.log('done shouldUpdateHydrant');
}

// REACT TRANSITION GROUPS
function createTrans(transitionName, transitionEnterTimeout, transitionLeaveTimeout, transitionAppear=undefined) {
	// transitionAppear is true else undefined
	var props = { transitionName, transitionEnterTimeout, transitionLeaveTimeout };
	if (transitionAppear) {
		props.transitionAppear = true;
		props.transitionAppearTimeout = transitionEnterTimeout;
	}
	return props;
}
var gTrans = [
	createTrans('animsition', 1100, 800, true),
	createTrans('slideleftright', 225, 225)
];
function initTransTimingStylesheet() {
	var style = document.createElement('style');
	var rules = [];
	for (var trans of gTrans) {
		var { transitionName, transitionEnterTimeout, transitionLeaveTimeout, transitionAppear } = trans;
		if (transitionAppear) {
			rules.push('.' + transitionName + '-appear.' + transitionName + '-appear-active,');
		}
		rules.push('.' + transitionName + '-enter.' + transitionName + '-enter-active { transition-duration:' + transitionEnterTimeout + 'ms }');
		rules.push('.' + transitionName + '-leave.' + transitionName + '-leave-active { transition-duration:' + transitionLeaveTimeout + 'ms }');
	}
	style.textContent = rules.join('');
	document.head.appendChild(style);
}
initTransTimingStylesheet();

function getTrans(transitionName, otherProps) {
	// use this in the React.createElement(ReactCSSTransitionGroup, getTrans(...))
	for (var trans of gTrans) {
		if (trans.transitionName == transitionName) {
			if (otherProps) {
				return Object.assign({}, trans, otherProps);
			} else {
				return trans;
			}
		}
	}
}
// REACT COMPONENTS - PRESENTATIONAL
var unmountApp = function(aCallback) {
	var domel = document.querySelector('.app-wrap');
	var doCallback = function(e) {
		if (e.target != domel) { return }
		e.stopPropagation();
		domel.removeEventListener('transitionend', doCallback, false);
		aCallback();
	};
	domel.addEventListener('transitionend', doCallback, false);
	domel.classList.add('animsition-leave');
	domel.classList.add('animsition-leave-active');
};

var App = React.createClass({
	render: function() {

		var app_components = [
			React.createElement(Header, gAppPageHeaderProps),
			...gAppPageComponents
		];

		return React.createElement(ReactCSSTransitionGroup, getTrans('animsition'),
			React.createElement('div', {key:'trans0', id:'app_wrap', className:'app-wrap container' + (gAppPageNarrow ? ' container-narrow' : '')},
				app_components
			)
		);
	}
});

const Link = (text, href) => {
	// can use two ways:
		// React.createElement(Link, { href:'about:blank' }, 'hiii')
		// Link('rawr', 'data:text/html,rawr')

	var children;
	if (typeof(text) == 'object') {
		href = text.href;
		children = text.children;
	} else {
		children = text;
	}

	var onClick = function(e) {
		if (e.button === 0) {
			e.preventDefault(); // so it doesnt follow the href
			unmountApp( ()=>{window.location.href = href} );
		}
	};

	return React.createElement('a', { href, onClick },
		children
	);
};


var Header = React.createClass({
	render: function() {
		// props
			// type - int;enum 1 2 3
		var { type } = this.props;

		switch (this.props.type) {
			case 1:
				// just logo and text

				/* props
				text - string;default:undefined
				logo - should be 32x32 img path defaults:"chrome://nativeshot/content/resources/images/icon32.png"
				logo_margin - defaults:undefined
				*/
				var { text, logo_margin, logowidth, logoheight, logo='chrome://nativeshot/content/resources/images/icon32.png' } = this.props;

				return React.createElement('header', { className:'type1' },
					React.createElement('div', { className:'header-text' },
						React.createElement('img', { className:'logo32', src:logo, width:logowidth, height:logoheight, style:(logo_margin ? {margin:logo_margin} : undefined) }),
						text
					)
				);
			case 2:
				// two logos, two texts

				/* props
				text - string;default:undefined
				logo - should be 32x32 img path defaults:"chrome://nativeshot/content/resources/images/icon32.png"
				logo_margin - defaults:undefined
				minortext
				minorlogo
				minorlogo_margin
				*/
				var { text, logo_margin, logowidth, logoheight, logo='chrome://nativeshot/content/resources/images/icon32.png', minortext, minorlogo='chrome://nativeshot/content/resources/images/icon16.png', minorlogo_margin } = this.props;

				return React.createElement('header', { className:'type2' },
					React.createElement('div', { className:'header-text' },
						React.createElement('img', { className:'logo32', src:logo, width:logowidth, height:logoheight, style:(logo_margin ? {margin:logo_margin} : undefined) }),
						text
					),
					React.createElement('div', { className:'header-text-minor' },
						React.createElement('img', { className:'logo16', src:minorlogo, style:(minorlogo_margin ? {margin:minorlogo_margin} : undefined) }),
						minortext
					)
				);
			case 3:
				// with menu, as scroll menu moves to top right and main text to top left
				var { text, menu, logo_margin, logo='chrome://nativeshot/content/resources/images/icon32.png' } = this.props;

				return React.createElement('div', { className:'header-fix-wrap' + (this.shouldThinform(window.scrollY, true) ? ' thinform' : '') }, // window.scrollY is 0, until i put in overflowing text so this doesnt work right now
					React.createElement('div', { className:'header type3' },
						React.createElement('div', { className:'header-maintext' },
							React.createElement('div', { className:'trans-left' },
								React.createElement('img', { className:'logo32', src:logo, style:(logo_margin ? {margin:logo_margin} : undefined) }),
								text
							)
						),
						React.createElement(BurgerMenu),
						React.createElement('nav', { className:'menu' },
							React.createElement('ul', { className:'trans-right' },
								menu.map( item => React.createElement('li', undefined,
									item.href ? Link(item.text, item.href) : item.text
								))
							)
						)
					)
				);
		}
	},
	componentDidMount: function() {
		var { type } = this.props;
		if (type === 3) {
			this.shouldThinform(window.scrollY);
			window.addEventListener('scroll', this.scroll, false);
		}
	},
	scroll: function(e) {
		var { type } = this.props;
		if (type === 3) {
			this.shouldThinform(window.scrollY);
		}
	},
	thinform: false,
	shouldThinform: function(aScrollY, aDontDom) {
		// transforms if necessary
		const limit = 3; // inclusive
		if (aScrollY <= limit) {
			if (this.thinform) {
				// make it fatform
				this.thinform = false;

				if (!aDontDom) {
					var domel = ReactDOM.findDOMNode(this);
					domel.classList.remove('thinform'); // to .header-fix-wrap
				} else {
					return this.thinform;
				}
			}
		} else {
			if (!this.thinform) {
				// make it thinform
				this.thinform = true;

				if (!aDontDom) {
					var domel = ReactDOM.findDOMNode(this);
					domel.classList.add('thinform'); // to .header-fix-wrap
				} else {
					return this.thinform;
				}
			}
		}
	}
});

var BurgerMenu = React.createClass({
	toggle: function() {
		this.is_open = !this.is_open;
		ReactDOM.findDOMNode(this).classList[this.is_open ? 'add' : 'remove']('open');
	},
	is_open: false,
	render: function() {
		var { style } = this.props;

		return React.createElement('div', { className:'nav-menu-icon', onClick:this.toggle, style },
			React.createElement('a', { href:'#' },
				React.createElement('i')
			)
		)
	}
});

var Button = React.createClass({
	render: function() {
		var { style=1, text, size='md', onClick } = this.props;
		// size - string;enum:xs,sm,md,lg
		// style - int;enum:1,2,3,4,5,6

		return React.createElement('div', { className:'butt-style button-style-' + style },
			React.createElement('a', { className:'b-' + size, onClick },
				text
			)
		);
	}
});

var Dropdown = React.createClass({
	getInitialState: function() {
		var { selected } = this.props;
		return {
			open: false,
			selected: selected
		};
	},
	show: function() {
		if (this.state.open) { return }
		this.setState({ open:true });
		document.addEventListener('click', this.hide, false);
		document.addEventListener('keyup', this.keyup, false);
	},
	hide: function() {
		if (!this.state.open) { return }
		this.setState({ open:false });
		document.removeEventListener('click', this.hide, false);
		document.removeEventListener('keyup', this.keyup, false);
	},
	keyup: function(e) {
		switch (e.key) {
			case 'Escape':
					this.hide();
				break;
		}
	},
	select: function(e) {
		var { options, onChange } = this.props;

		console.log('e.target.parentNode:', e.target.parentNode);
		var ix = 0;
		var node = e.target;
		while (node = node.previousSibling) {
			ix++;
		}

		this.setState({ selected:options[ix] });

		if (onChange) {
			onChange(options[ix].value);
		}
	},
	render: function() {
		var { style=1, size, onChange, label, alwaysShowLabel, options } = this.props;
		var { selected } = this.state;
		// style right now is unused
		// selected is reference to object in options
		// options is an array of objects. object has { label:string, value:any }
		// defaultLabel is what text to show when nothing selected, key must be unique

		return React.createElement('div', { className:'dropdown-container d-' + size + ' dropdown-style-' + style + (this.state.open ? ' dropdown-open' : '')},
			React.createElement('div', { className:'dropdown-display', onClick:this.show },
				React.createElement('span', undefined,
					!selected || alwaysShowLabel ? label : selected.label
				),
				' ',
				React.createElement('i', { className:'fa-down-thin' },
					'\ue802'
				)
			),
			React.createElement('div', { className:'dropdown-list' },
				options.map( el => React.createElement('div', { className:'dropdown-list-item', onClick:this.select }, el.label) )
			)
		);
	}
});
// REACT COMPONENTS - CONTAINER

// end - react-redux

// start - common helper functions
function pushAlternatingRepeating(aTargetArr, aEntry) {
	// pushes into an array aEntry, every alternating
		// so if aEntry 0
			// [1, 2] becomes [1, 0, 2]
			// [1] statys [1]
			// [1, 2, 3] becomes [1, 0, 2, 0, 3]
	var l = aTargetArr.length;
	for (var i=l-1; i>0; i--) {
		aTargetArr.splice(i, 0, aEntry);
	}
}
function formatStringFromNameCore(aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements) {
	// 051916 update - made it core.addon.l10n based
    // formatStringFromNameCore is formating only version of the worker version of formatStringFromName, it is based on core.addon.l10n cache

	try { var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n][aLocalizableStr]; if (!cLocalizedStr) { throw new Error('localized is undefined'); } } catch (ex) { console.error('formatStringFromNameCore error:', ex, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements); } // remove on production

	var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n][aLocalizableStr];
	// console.log('cLocalizedStr:', cLocalizedStr, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements);
    if (aReplacements) {
        for (var i=0; i<aReplacements.length; i++) {
            cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
        }
    }

    return cLocalizedStr;
}
function escapeRegExp(text) {
	if (!arguments.callee.sRE) {
		var specials = ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\'];
		arguments.callee.sRE = new RegExp('(\\' + specials.join('|\\') + ')', 'g'); // doesnt work in strict mode ```'use strict';```
	}
	return text.replace(arguments.callee.sRE, '\\$1');
}
// end - common helper functions

function stopClickAndCheck0(e) {
	e.stopPropagation();
	e.preventDefault();
	if (e.button === 0) {
		return true;
	} else {
		return false;
	}
}
function formatTime(aDateOrTime, aOptions={}) {
	// aMonthFormat - name, Mmm
	var aDefaultOptions = {
		month: 'name', // string;enum[name,Mmm] - format for month
		time: true // bool - if should append time string
	};
	aOptions = Object.assign(aDefaultOptions, aOptions);

	var aDate = typeof(aDateOrTime) == 'object' ? aDateOrTime : new Date(aDateOrTime);

	var mon = formatStringFromNameCore('month.' + (aDate.getMonth()+1) + '.' + aOptions.month, 'dateFormat');
	var yr = aDate.getFullYear();
	var day = aDate.getDate();

	var hr = aDate.getHours() > 12 ? aDate.getHours() - 12 : aDate.getHours();
	var min = aDate.getMinutes() < 10 ? '0' + aDate.getMinutes() : aDate.getMinutes();
	var meridiem = aDate.getHours() < 12 ? 'AM' : 'PM';

	return mon + ' ' + day + ', ' + yr + (aOptions.time ? ' - ' + hr + ':' + min + ' ' + meridiem : '');
}

function createSortedTessLangArr() {
	var arr = [
		{ value:'eng', label: formatStringFromNameCore('eng', 'main') },
		{ value:'chi_sim', label: formatStringFromNameCore('chi_sim', 'main') },
		{ value:'rus', label: formatStringFromNameCore('rus', 'main') },
		{ value:'meme', label: formatStringFromNameCore('meme', 'main') },
		{ value:'tha', label: formatStringFromNameCore('tha', 'main') },
		{ value:'deu', label: formatStringFromNameCore('deu', 'main') },
		{ value:'jpn', label: formatStringFromNameCore('jpn', 'main') },
		{ value:'spa', label: formatStringFromNameCore('spa', 'main') },
		{ value:'fra', label: formatStringFromNameCore('fra', 'main') },
		{ value:'chi_tra', label: formatStringFromNameCore('chi_tra', 'main') },
		{ value:'por', label: formatStringFromNameCore('por', 'main') },
		{ value:'ita', label: formatStringFromNameCore('ita', 'main') },
		{ value:'pol', label: formatStringFromNameCore('pol', 'main') },
		{ value:'tur', label: formatStringFromNameCore('tur', 'main') },
		{ value:'nld', label: formatStringFromNameCore('nld', 'main') },
		{ value:'ara', label: formatStringFromNameCore('ara', 'main') },
		{ value:'ces', label: formatStringFromNameCore('ces', 'main') },
		{ value:'kor', label: formatStringFromNameCore('kor', 'main') },
		{ value:'swe', label: formatStringFromNameCore('swe', 'main') },
		{ value:'vie', label: formatStringFromNameCore('vie', 'main') },
		{ value:'ron', label: formatStringFromNameCore('ron', 'main') },
		{ value:'ell', label: formatStringFromNameCore('ell', 'main') },
		{ value:'ind', label: formatStringFromNameCore('ind', 'main') },
		{ value:'hun', label: formatStringFromNameCore('hun', 'main') },
		{ value:'dan', label: formatStringFromNameCore('dan', 'main') },
		{ value:'bul', label: formatStringFromNameCore('bul', 'main') },
		{ value:'fin', label: formatStringFromNameCore('fin', 'main') },
		{ value:'nor', label: formatStringFromNameCore('nor', 'main') },
		{ value:'ukr', label: formatStringFromNameCore('ukr', 'main') },
		{ value:'cat', label: formatStringFromNameCore('cat', 'main') },
		{ value:'hrv', label: formatStringFromNameCore('hrv', 'main') },
		{ value:'heb', label: formatStringFromNameCore('heb', 'main') },
		{ value:'lit', label: formatStringFromNameCore('lit', 'main') },
		{ value:'slv', label: formatStringFromNameCore('slv', 'main') },
		{ value:'hin', label: formatStringFromNameCore('hin', 'main') },
		{ value:'ben', label: formatStringFromNameCore('ben', 'main') },
		{ value:'tel', label: formatStringFromNameCore('tel', 'main') },
		{ value:'tam', label: formatStringFromNameCore('tam', 'main') },
		{ value:'kan', label: formatStringFromNameCore('kan', 'main') },
		{ value:'mal', label: formatStringFromNameCore('mal', 'main') },
		{ value:'tgl', label: formatStringFromNameCore('tgl', 'main') },
		{ value:'swa', label: formatStringFromNameCore('swa', 'main') },
		{ value:'aze', label: formatStringFromNameCore('aze', 'main') },
		{ value:'bel', label: formatStringFromNameCore('bel', 'main') },
		{ value:'afr', label: formatStringFromNameCore('afr', 'main') },
		{ value:'sqi', label: formatStringFromNameCore('sqi', 'main') },
		{ value:'eus', label: formatStringFromNameCore('eus', 'main') },
		{ value:'epo', label: formatStringFromNameCore('epo', 'main') },
		{ value:'est', label: formatStringFromNameCore('est', 'main') },
		{ value:'glg', label: formatStringFromNameCore('glg', 'main') },
		{ value:'isl', label: formatStringFromNameCore('isl', 'main') },
		{ value:'lav', label: formatStringFromNameCore('lav', 'main') },
		{ value:'mkd', label: formatStringFromNameCore('mkd', 'main') },
		{ value:'msa', label: formatStringFromNameCore('msa', 'main') },
		{ value:'mlt', label: formatStringFromNameCore('mlt', 'main') },
		{ value:'grc', label: formatStringFromNameCore('grc', 'main') },
		{ value:'chr', label: formatStringFromNameCore('chr', 'main') },
		{ value:'enm', label: formatStringFromNameCore('enm', 'main') },
		{ value:'epo_alt', label: formatStringFromNameCore('epo_alt', 'main') },
		{ value:'frk', label: formatStringFromNameCore('frk', 'main') },
		{ value:'frm', label: formatStringFromNameCore('frm', 'main') },
		{ value:'ita_old', label: formatStringFromNameCore('ita_old', 'main') },
		{ value:'equ', label: formatStringFromNameCore('equ', 'main') },
		{ value:'srp', label: formatStringFromNameCore('srp', 'main') },
		{ value:'slk', label: formatStringFromNameCore('slk', 'main') },
		{ value:'spa_old', label: formatStringFromNameCore('spa_old', 'main') }
	];

	arr.sort((a, b) => a.label > b.label);

	return arr;
}
