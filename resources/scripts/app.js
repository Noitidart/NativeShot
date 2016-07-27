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

window.addEventListener('pageshow', function() {
	// this happens when go back/forward and its like a non-fresh page, i saw this behavior in nightly
	var domel = document.querySelector('.app-wrap');
	if (domel.classList.contains('animsition-leave')) {

		domel.classList.remove('animsition-leave');

		domel.classList.remove('animsition-leave-active');

		domel.classList.add('animsition-enter');

		setTimeout(function() {
			domel.classList.add('animsition-enter-active');
			var removeAfter = function() {
				domel.removeEventListener('transitionend', removeAfter, false);
				domel.classList.remove('animsition-enter');
				domel.classList.remove('animsition-enter-active');
			};
			setTimeout(function() {
				domel.addEventListener('transitionend', removeAfter, false);
			}, 0);
		}, 0);
	}

}, false);

function init() {
	callInMainworker('fetchCore', undefined, function(aArg) {
		console.log('aArg in app.js:', aArg);
		core = aArg;

		// set up some listeners
		// window.addEventListener('unload', uninit, false);

		// setup and start redux
		if (aArg.hydrant) {
			// dont update hydrant if its undefined, otherwise it will screw up all default values for redux
			hydrant = aArg.hydrant;
		}

		store = Redux.createStore(app);

		if (hydrant) {
			store.subscribe(shouldUpdateHydrant);
		}

		initAppPage(aArg);

		// render react
		ReactDOM.render(
			React.createElement(ReactRedux.Provider, { store },
				React.createElement(App)
			),
			document.getElementById('root')
		);

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

// STORE
var store;

// var unsubscribe = store.subscribe(() => console.log(store.getState()) );

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
		callInMainworker('updateHydrant', {
			head: gPage.name,
			hydrant
		})
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
	createTrans('animsition', 1100, 800, true)
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
	var doCallback = function() {
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
			React.createElement('div', {key:'trans0', className:'app-wrap'},
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
		e.preventDefault(); // so it doesnt follow the href
		unmountApp( ()=>{window.location.href = href} );
	};

	return React.createElement('a', { href, onClick },
		children
	);
};


var Header = React.createClass({
	render: function() {
		/* props
		type - int;enum 1
		text
		*/
		var { type, text } = this.props;

		var cprops = {};

		switch (type) {
			case 1:
				return React.createElement('header', cprops,
					text
				);
		}
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
// end - common helper functions
