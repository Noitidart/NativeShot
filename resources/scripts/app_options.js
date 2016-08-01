function initAppPage(aArg) {
	// aArg is what is received by the call in `init`
	// filter hydrant to just prefs i care about

	gAppPageComponents = [];

	// push rows
	var crow = [React.createElement(Block, { title:'auto updates' })];
	const MAX_BLOCKS_PER_ROW = 3;
	for (var a_pref in hydrant_ex.prefs) {
		crow.push(React.createElement(Block, { title:a_pref }));

		if (crow.length == MAX_BLOCKS_PER_ROW) {
			gAppPageComponents.push(React.createElement(Row, undefined,
				crow
			));
			crow = [];
		}
	}
	if (crow.length) {
		gAppPageComponents.push(React.createElement(Row, undefined,
			crow
		));
	}
}

function uninitAppPage() {

}

// start - react-redux

// REACT COMPONENTS - PRESENTATIONAL
var Row = React.createClass({
	shouldComponentUpdate: ()=>false,
	render: function() {
		var { children } = this.props;

		return React.createElement('div', { className:'padd-80' },
			React.createElement('div', { className:'row' },
				children
			)
		);
	}
});

var Block = React.createClass({
	displayName: 'Block',
	render: function() {
		var { title } = this.props;

		return React.createElement('div', { className:'col-lg-4 col-lg-offset-0 col-md-4 col-md-offset-0 col-sm-6 col-sm-offset-3 col-xs-12' },
				React.createElement('div', { className:'pref-block' },
				React.createElement('div', { className:'pref-block-title' },
					React.createElement('h4', {},
						title
					)
				),
				React.createElement('div', { className:'pref-block-value' },
					React.createElement('span', {},
						'block value'
					)
				),
				React.createElement('ul', undefined,
					React.createElement('li', undefined,
						'desc1'
					),
					React.createElement('li', undefined,
						'desc2'
					)
				),
				React.createElement('div', { className:'pref-block-btns' },
					React.createElement(Button, { style:2, size:'md', text:'rawr' }),
					' ',
					React.createElement(Dropdown, { style:2, size:'md', label:'dd', options:[{label:'On'}, {label:'Off'}] })
				)
			)
		);
	}
});
// var Block = React.createClass({
//     displayName: 'Block',
// 	render: function() {
// 		// props
// 		//	pBlock
// 		//	sBlockValue
// 		//	pRowBlockCnt
// 		//	pRowFirstBlock - true if its the first block in the row else false
// 		var { firstblock, value, }
//
// 		var cBlockTitle = this.props.pBlock.label;
//
// 		var cValues = getObjKeyVal(this.props.pBlock, 'values', this.props.sBlockValue);
// 		var cBlockValue = (!cValues ? undefined : cValues[this.props.sBlockValue.value]);
//
// 		var cBlockSup;
// 		if (cBlockValue) {
// 			cBlockSup = getObjKeyVal(this.props.pBlock, 'sup', this.props.sBlockValue);
// 		}
//
// 		var cBlockDescs = [];
// 		var cDescs = this.props.pBlock.descs;
// 		console.error('cDescs:', cDescs);
// 		for (var i=0; i<cDescs.length; i++) {
// 			cBlockDescs.push(React.createElement('li', {},
// 				cDescs[i]
// 			));
// 		}
//
// 		var cBlockBtns = [];
// 		var cBtns = this.props.pBlock.btns;
// 		// console.log('cBtns:', cBtns);
// 		for (var i=0; i<cBtns.length; i++) {
// 			var cBtnHidden = getObjKeyVal(cBtns[i], 'hidden', this.props.sBlockValue);
// 			console.error('cBtnHidden:', cBtnHidden);
// 			if (!cBtnHidden) {
// 				cBlockBtns.push(React.createElement(Button, {sBlockValue:this.props.sBlockValue, pBtn:cBtns[i]}));
// 			}
// 		}
// 		console.log('cBlockBtns:', cBlockBtns);
//
// 		// add space between the cBtns if there is more than 1
// 		// so [1, 2] becomes Array [ 1, " ", 2 ]
// 		// [1, 2, 3] Array [ 1, " ", 2, " ", 3 ]
// 		// etc
// 		if (cBlockBtns.length > 1) {
// 			for (var i=0; i<cBlockBtns.length-1; i=i+2) {
// 				cBlockBtns.splice(i+1, 0, ' ');
// 			}
// 		}
//
// 		var cClassName;
// 		if (!this.props.pRowFirstBlock || this.props.pRowBlockCnt == MAX_BLOCKS_PER_ROW) {
// 			cClassName = 'col-lg-4 col-lg-offset-0 col-md-4 col-md-offset-0 col-sm-6 col-sm-offset-3 col-xs-12';
// 		} else {
// 			// :note: if increase MAX_BLOCKS_PER_ROW then I have to adjust this bootstrap offset logic per http://stackoverflow.com/a/35687323/1828637 // link6675835357
// 			if (this.props.pRowBlockCnt == 2) {
// 				cClassName = 'col-lg-4 col-lg-offset-2 col-md-4 col-md-offset-2 col-sm-6 col-sm-offset-3 col-xs-12';
// 			} else {
// 				// this.props.pRowBlockCnt is 1 obviously
// 				cClassName = 'col-lg-4 col-lg-offset-4 col-md-4 col-md-offset-4 col-sm-6 col-sm-offset-3 col-xs-12';
// 			}
// 		}
//
// 		return React.createElement('div', {className:cClassName},
// 			React.createElement('div', {className:'price-block' + (!cBlockSup ? '' : ' filesystem-path')},
// 				React.createElement('div', {className:'price-price'},
// 					React.createElement('h4', {},
// 						cBlockTitle
// 					)
// 				),
// 				React.createElement('div', {className:'price-title'},
// 					!cBlockSup ? undefined : React.createElement('sup', {},
// 						cBlockSup
// 					),
// 					React.createElement('span', {},
// 						cBlockValue
// 					)
// 				),
// 				React.createElement('ul', {},
// 					cBlockDescs
// 				),
// 				React.createElement('div', {className:'button-style-2'},
// 					cBlockBtns
// 				)
// 			)
// 		);
// 	}
// });

// REACT COMPONENTS - CONTAINER

// material for app.js
var gAppPageNarrow = false;

var gAppPageHeaderProps = {
	type: 3,
	get text() { return formatStringFromNameCore('header_text_dashboard', 'main') },
	menu: [
		{
			 get text() { return formatStringFromNameCore('history', 'main') },
			 href: 'about:nativeshot'
		},
		{
			 get text() { return formatStringFromNameCore('options', 'main') }
		},
		{
			 get text() { return formatStringFromNameCore('authorization', 'main') },
			 href: 'about:nativeshot?auth'
		}
	]
};

var gAppPageComponents; // done in `initAppPage` because it needs localization

// instructions on how to populate hdrant and hydrant_ex. they will be populated as objects. but here i set them as a string for hydrant, and object of instructions for hydrant_ex
var hydrant; // converted into object on `init` in app.js // update this is handled automatically by the `shouldUpdateHydrant` in app_page's
var hydrant_ex = { // stuff that shouldnt get written to hydrants entry in filestore. updating this is handled manually by dev
	filestore_entries: ['prefs'],
	addon_info: true
};

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
