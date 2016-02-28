////////// start - nativeshot - app_main
var gJLog = []; // parsed json of history-log

var aTypeStrToTypeInt = {};
var aTypeIntToTypeStr = {};
			
const biggest_count_should_be_percent = 90; // for skill bars

// all values in Varitants must be array or obj as it is a pass by reference
var classVariants = {}

var classREF = {
	class: ''
};
var dataCaptionREF = {
	class: 'det-img ellem',
	'data-caption': '',
	'data-gettime': ''
}
var imgREF = {
	src: 'rawr',
	alt:''
};
var aREF = {
	href:'#'
};
var slipCoverJson = ['html:div', classREF,
						['html:a', aREF],
						['html:div', dataCaptionREF,
							['html:img', imgREF]
						]
					];
var gHoverEl = {};
var gHoverId = -1;
function templatedDataCaption(aTypeInt, aTitle, aSubtitle, aGettime, aImgSrc) {
	// September 12, 2015 - 7:41 PM
	switch (aTypeInt) {
		case aTypeStrToTypeInt['twitter']:
		
				// return "<span class='vertical-align'><h4>" + aTitle + "</h4><span class='pr-sutitle'>" + aSubtitle + "</span><br/><br/><br/><a href='" + aImgSrc + "' class='card-button mag-view' data-card-gettime='" + aGettime + "' onclick='izoView(event, " + aGettime + ")'><span class='fa fa-eye'></span>" + justFormatStringFromName(core.addon.l10n.app_main['view']) + "</a><a href='#' class='card-button' onclick='izoCopy(" + aGettime + ")'><span class='fa fa-link'></span>" + justFormatStringFromName(core.addon.l10n.app_main['copy']) + "</a><br/><br/><br/><a href='#' class='card-button' onclick='izoOpen(" + aGettime + ")'><span class='fa fa-ttttttt'></span>" + justFormatStringFromName(core.addon.l10n.app_main['open-tweet']) + "</a><a href='#' class='card-button' onclick='izoRemove(" + aGettime + ")'><span class='fa fa-history'></span>" + justFormatStringFromName(core.addon.l10n.app_main['remove']) + "</a></span>";
				gHoverEl[gHoverId] = ['span', {class:'vertical-align'},
										['h4', {},
											aTitle
										],
										['span', {class:'pr-sutitle'},
											aSubtitle
										],
										['br', {}],
										['br', {}],
										['br', {}],
										['a', {href:aImgSrc, class:'card-button mag-view', 'data-card-gettime':aGettime, onclick:'izoView(event, ' + aGettime + ')'},
											['span', {class:'fa fa-eye'}],
											justFormatStringFromName(core.addon.l10n.app_main['view'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoCopy(' + aGettime + ')'},
											['span', {class:'fa fa-link'}],
											justFormatStringFromName(core.addon.l10n.app_main['copy'])
										],
										['br', {}],
										['br', {}],
										['br', {}],
										['a', {href:'#', class:'card-button', onclick:'izoOpen(' + aGettime + ')'},
											['span', {class:'fa fa-ttttttt'}],
											justFormatStringFromName(core.addon.l10n.app_main['open-tweet'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoRemove(' + aGettime + ')'},
											['span', {class:'fa fa-history'}],
											justFormatStringFromName(core.addon.l10n.app_main['remove'])
										]
									 ];
				 
			break;
		case aTypeStrToTypeInt['save-browse']:
		
				// return "<span class='vertical-align'><h4>" + aTitle + "</h4><span class='pr-sutitle'>" + aSubtitle + "</span><br/><br/><br/><a href='" + aImgSrc + "' class='card-button mag-view' data-card-gettime='" + aGettime + "' onclick='izoView(event, " + aGettime + ")'><span class='fa fa-eye'></span>" + justFormatStringFromName(core.addon.l10n.app_main['view']) + "</a><a href='#' class='card-button' onclick='izoCopy(" + aGettime + ")'><span class='fa fa-link'></span>" + justFormatStringFromName(core.addon.l10n.app_main['copy']) + "</a><a href='#' class='card-button' onclick='izoOpen(" + aGettime + ")'><span class='fa fa-folder-open'></span>" + justFormatStringFromName(core.addon.l10n.app_main['open']) + "</a><br/><br/><br/><a href='#' class='card-button' onclick='izoDelete(" + aGettime + ")'><span class='fa fa-trash'></span>" + justFormatStringFromName(core.addon.l10n.app_main['delete']) + "</a><a href='#' class='card-button' onclick='izoRemove(" + aGettime + ")'><span class='fa fa-history'></span>" + justFormatStringFromName(core.addon.l10n.app_main['remove']) + "</a></span>";
				gHoverEl[gHoverId] = ['span', {class:'vertical-align'},
										['h4', {},
											aTitle
										],
										['span', {class:'pr-sutitle'},
											aSubtitle
										],
										['br', {}],
										['br', {}],
										['br', {}],
										['a', {href:aImgSrc, class:'card-button mag-view', 'data-card-gettime':aGettime, onclick:'izoView(event, ' + aGettime + ')'},
											['span', {class:'fa fa-eye'}],
											justFormatStringFromName(core.addon.l10n.app_main['view'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoCopy(' + aGettime + ')'},
											['span', {class:'fa fa-link'}],
											justFormatStringFromName(core.addon.l10n.app_main['copy'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoOpen(' + aGettime + ')'},
											['span', {class:'fa fa-folder-open'}],
											justFormatStringFromName(core.addon.l10n.app_main['open'])
										],
										['br', {}],
										['br', {}],
										['br', {}],
										['a', {href:'#', class:'card-button', onclick:'izoDelete(' + aGettime + ')'},
											['span', {class:'fa fa-trash'}],
											justFormatStringFromName(core.addon.l10n.app_main['delete'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoRemove(' + aGettime + ')'},
											['span', {class:'fa fa-history'}],
											justFormatStringFromName(core.addon.l10n.app_main['remove'])
										]
									 ];
				 
			break;
		case aTypeStrToTypeInt['save-quick']:
		
				// return "<span class='vertical-align'><h4>" + aTitle + "</h4><span class='pr-sutitle'>" + aSubtitle + "</span><br/><br/><br/><a href='" + aImgSrc + "' class='card-button mag-view' data-card-gettime='" + aGettime + "' onclick='izoView(event, " + aGettime + ")'><span class='fa fa-eye'></span>" + justFormatStringFromName(core.addon.l10n.app_main['view']) + "</a><a href='#' class='card-button' onclick='izoCopy(" + aGettime + ")'><span class='fa fa-link'></span>" + justFormatStringFromName(core.addon.l10n.app_main['copy']) + "</a><a href='#' class='card-button' onclick='izoOpen(" + aGettime + ")'><span class='fa fa-folder-open'></span>" + justFormatStringFromName(core.addon.l10n.app_main['open']) + "</a><br/><br/><br/><a href='#' class='card-button' onclick='izoDelete(" + aGettime + ")'><span class='fa fa-trash'></span>" + justFormatStringFromName(core.addon.l10n.app_main['delete']) + "</a><a href='#' class='card-button' onclick='izoRemove(" + aGettime + ")'><span class='fa fa-history'></span>" + justFormatStringFromName(core.addon.l10n.app_main['remove']) + "</a></span>";
				gHoverEl[gHoverId] = ['span', {class:'vertical-align'},
										['h4', {},
											aTitle
										],
										['span', {class:'pr-sutitle'},
											aSubtitle
										],
										['br', {}],
										['br', {}],
										['br', {}],
										['a', {href:aImgSrc, class:'card-button mag-view', 'data-card-gettime':aGettime, onclick:'izoView(event, ' + aGettime + ')'},
											['span', {class:'fa fa-eye'}],
											justFormatStringFromName(core.addon.l10n.app_main['view'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoCopy(' + aGettime + ')'},
											['span', {class:'fa fa-link'}],
											justFormatStringFromName(core.addon.l10n.app_main['copy'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoOpen(' + aGettime + ')'},
											['span', {class:'fa fa-folder-open'}],
											justFormatStringFromName(core.addon.l10n.app_main['open'])
										],
										['br', {}],
										['br', {}],
										['br', {}],
										['a', {href:'#', class:'card-button', onclick:'izoDelete(' + aGettime + ')'},
											['span', {class:'fa fa-trash'}],
											justFormatStringFromName(core.addon.l10n.app_main['delete'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoRemove(' + aGettime + ')'},
											['span', {class:'fa fa-history'}],
											justFormatStringFromName(core.addon.l10n.app_main['remove'])
										]
									 ];

			break;
		default:
				// by default i assume its oauth upload, so same as imguranon format
				// return "<span class='vertical-align'><h4>" + aTitle + "</h4><span class='pr-sutitle'>" + aSubtitle + "</span><br/><br/><br/><a href='" + aImgSrc + "' class='card-button mag-view' data-card-gettime='" + aGettime + "' onclick='izoView(event, " + aGettime + ")'><span class='fa fa-eye'></span>" + justFormatStringFromName(core.addon.l10n.app_main['view']) + "</a><a href='#' class='card-button' onclick='izoCopy(" + aGettime + ")'><span class='fa fa-link'></span>" + justFormatStringFromName(core.addon.l10n.app_main['copy']) + "</a><br/><br/><br/><a href='#' class='card-button' onclick='izoDelete(" + aGettime + ")'><span class='fa fa-remove'></span>" + justFormatStringFromName(core.addon.l10n.app_main['delete']) + "</a><a href='#' class='card-button' onclick='izoRemove(" + aGettime + ")'><span class='fa fa-history'></span>" + justFormatStringFromName(core.addon.l10n.app_main['remove']) + "</a></span>";
				gHoverEl[gHoverId] = ['span', {class:'vertical-align'},
										['h4', {},
											aTitle
										],
										['span', {class:'pr-sutitle'},
											aSubtitle
										],
										['br', {}],
										['br', {}],
										['br', {}],
										['a', {href:aImgSrc, class:'card-button mag-view', 'data-card-gettime':aGettime, onclick:'izoView(event, ' + aGettime + ')'},
											['span', {class:'fa fa-eye'}],
											justFormatStringFromName(core.addon.l10n.app_main['view'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoCopy(' + aGettime + ')'},
											['span', {class:'fa fa-link'}],
											justFormatStringFromName(core.addon.l10n.app_main['copy'])
										],
										['br', {}],
										['br', {}],
										['br', {}],
										['a', {href:'#', class:'card-button', onclick:'izoDelete(' + aGettime + ')'},
											['span', {class:'fa fa-remove'}],
											justFormatStringFromName(core.addon.l10n.app_main['delete'])
										],
										['a', {href:'#', class:'card-button', onclick:'izoRemove(' + aGettime + ')'},
											['span', {class:'fa fa-history'}],
											justFormatStringFromName(core.addon.l10n.app_main['remove'])
										]
									 ];
	}
}

function nsOnFocus() {
	console.log('focused');
	readHistoryLog(function() {
		updateCountsToSkillBars();
		matchIsotopeContentsToFileJson(true);
	});
}

function nsInitPage(aPostNonSkelInit_CB) {
	
	// when done must call aPostNonSkelInit_CB();
	
	var do_attachEventListeners = function() {
		
		/***********************************/
		/*SLIP HOVER PLUGIN*/
		/**********************************/
		 $('.sliphover').sliphover({
			 target: '.ellem',
			 caption: 'data-caption',
			 fontColor: '#fff'
		 });
		 
		/***********************************/
		/*MAGNIFIC POPUP*/
		/**********************************/
		$(document.body).magnificPopup({ // cant do '.izotope-container' here because the click happens on the "view" button in the sliphover which is dynamically added to the body element
			delegate: '.mag-view',
			type: 'image',
			tLoading: '',
			mainClass: 'mfp-with-zoom',
			removalDelay: 500,
			gallery: {
				enabled: false,
				navigateByImgClick: false
			},
			zoom: {
				enabled: true,
				duration: 300,
				easing: 'ease-in-out', 
				opener: function(openerElement) {

				  var aGettime = openerElement[0].getAttribute('data-card-gettime');

				  var relatedImg = $('.det-img[data-gettime="' + aGettime + '"] img');

				  return relatedImg;
				}
			},
			callbacks: {
				imageLoadComplete: function() {
				  var self = this;
				  setTimeout(function() {
					self.wrap.addClass('mfp-image-loaded');
				  }, 16);
				},
				close: function() {
				  this.wrap.removeClass('mfp-image-loaded');
				},
				beforeChange: function() {
					// this.items[0].src = this.items[0].src + '?=' + Math.random(); 
				}
			},
			 closeBtnInside: false,
			 closeOnContentClick: true,
			 midClick: false
		});
	};
	
	var do_step1 = function() {
		// fetch core
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInPromiseWorker', ['returnCore']], bootstrapMsgListener.funcScope, function(aCore) {
			core = aCore;
			do_step2();
		});
	};
	
	var do_step2 = function() {
		// get services infos
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInPromiseWorker', ['returnServicesInfos']], bootstrapMsgListener.funcScope, function(aServicesInfos) {			
			var servicesInfosReact = [
				// {
				// 	serviceName: cServiceName,
				// 	serviceInt: 0,
				// 	serviceTitle: core.addon.l10n.app_main[cServiceName],
				// 	hasAssociatedImgs: 'noWriteObj' in cServiceInfoEntry && 'imgsrc' in cServiceInfoEntry.noWriteObj
				// }
			];
			
			aTypeStrToTypeInt = aServicesInfos.logTypesN2I;
			for (var p in aTypeStrToTypeInt) {
				aTypeIntToTypeStr[aTypeStrToTypeInt[p]] = p;
				classVariants[aTypeStrToTypeInt[p]] = 'item nativeshot-' + p;
			}
			
			for (var cServiceName in aServicesInfos.logTypesN2I) {
				
				var cServiceInfoEntry = {};
				var cServiceDataKeys = aServicesInfos.serviceDataKeys[cServiceName];
				
				cServiceInfoEntry.serviceName = cServiceName;
				cServiceInfoEntry.serviceInt = aServicesInfos.logTypesN2I[cServiceName];
				cServiceInfoEntry.serviceTitle = core.addon.l10n.app_main['title_' + cServiceName];
				cServiceInfoEntry.hasAssociatedImgs = ('noWriteObj' in cServiceDataKeys && 'imgsrc' in cServiceDataKeys.noWriteObj);
				
				servicesInfosReact.push(cServiceInfoEntry);
				
				
			}
			
			console.log('servicesInfosReact:', servicesInfosReact);
			servicesInfosReact.sort(function(a, b) {
				return compareAlphaNumeric(a.serviceTitle, b.serviceTitle); // sort asc
			});
			
			MyStore.postMountCB = do_step3;
			
			renderReact(servicesInfosReact);
		});
	};
	
	var do_step3 = function() {
		

		
		do_attachEventListeners();
		
		readHistoryLog(function() {
			updateCountsToSkillBars();
			matchIsotopeContentsToFileJson(false);
			
			do_step4();
		});
	}
	
	var do_step4 = function() {
		MyStore.setState({
			sLog: JSON.parse(JSON.stringify(gJLog)),
		});
		aPostNonSkelInit_CB();
	};
	
	do_step1();

}

// react control
var MyStore = {};
function renderReact(aServicesInfos) {
	var myMainComp = React.createElement(MainComp, {pServicesInfos:aServicesInfos});
	
	ReactDOM.render(
		myMainComp,
		document.querySelector('.main-wrapp')
	);
}

// react components
var MainComp = React.createClass({
	displayName: 'MainComp',
	getInitialState: function() {
		return {
			sLog: [],
			sActiveFilter: 'all' // the serviceName or "all" of the one that is currently filtered
		};
	},
	componentDidMount: function() {
		MyStore.setState = this.setState.bind(this); // need bind here otherwise it doesnt work
		MyStore.postMountCB();
		delete MyStore.postMountCB;
	},
	render: function() {
		// props
		//	pServicesInfos

		return React.createElement('div', {className:'container'},
			React.createElement(ServicesSummaryRow, {pServicesInfos:this.props.pServicesInfos, sLog:this.state.sLog, sActiveFilter:this.state.sActiveFilter}),
			React.createElement(ServicesFilterRow, {pServicesInfos:this.props.pServicesInfos, sActiveFilter:this.state.sActiveFilter})
		);
	}
});
var ServicesSummaryRow = React.createClass({
	displayName: 'ServicesSummaryRow',
	getInitialState: function() {
		return {
			
		};
	},
	render: function() {
		// props
		//	pServicesInfos
		//	sActiveFilter
		//	sLog

		var summaryColCnt = 3; // devuser must set this number to the number of ServicesSummaryCol elements in this returned render
		var servicesPerColCnt = Math.ceil(this.props.pServicesInfos.length / summaryColCnt);
		
		var cServicesInfosGroups = []; // create sections out of pServicesInfos into groups of servicesPerColCnt 
		
		for (var i=0; i<summaryColCnt; i++) {
			cServicesInfosGroups.push(this.props.pServicesInfos.slice(i * servicesPerColCnt, i * servicesPerColCnt + servicesPerColCnt));
		}
		
		// get counts of entries for each service in sLog
		var sServicesLogEntryCnts = {};
		for (var i=0; i<this.props.pServicesInfos.length; i++) {
			sServicesLogEntryCnts[this.props.pServicesInfos[i].serviceInt] = 0;
		}
		for (var i=0; i<this.props.sLog.length; i++) {
			sServicesLogEntryCnts[this.props.sLog[i].t]++;
		}
		// delete the serviceInt keys and copy it to the new key with serviceName
		for (var i=0; i<this.props.pServicesInfos.length; i++) {
			sServicesLogEntryCnts[this.props.pServicesInfos[i].serviceName] = sServicesLogEntryCnts[this.props.pServicesInfos[i].serviceInt];
			delete sServicesLogEntryCnts[this.props.pServicesInfos[i].serviceInt];
		}
		
		return React.createElement('div', {className:'padd-80', style:{paddingBottom:'40px'} },
			React.createElement('div', {className:'row'},
				React.createElement('div', {className:'col-md-4 col-sm-6 col-xs-12'},
					React.createElement(ServicesSummaryCol, {pServicesInfosGroup:cServicesInfosGroups.shift(), sActiveFilter:this.props.sActiveFilter, sServicesLogEntryCnts:sServicesLogEntryCnts})
				),
				React.createElement('div', {className:'col-md-4 col-sm-6 col-xs-12'},
					React.createElement(ServicesSummaryCol, {pServicesInfosGroup:cServicesInfosGroups.shift(), sActiveFilter:this.props.sActiveFilter, sServicesLogEntryCnts:sServicesLogEntryCnts})
					/*
					React.createElement('div', {className:'second-caption'},
						React.createElement('p', {style:{lineHeight:'155px', textAlign:'center'} },
							core.addon.l10n.app_main.category_desc
						)
					)
					*/
				),
				React.createElement('div', {className:'col-md-4 col-sm-8 col-sm-offset-2 col-md-offset-0 col-xs-12'}, // should this be `col-sm-6`? not `-12`?
					React.createElement(ServicesSummaryCol, {pServicesInfosGroup:cServicesInfosGroups.shift(), sActiveFilter:this.props.sActiveFilter, sServicesLogEntryCnts:sServicesLogEntryCnts})
				)
			)
		);
	}
});

var ServicesFilterRow = React.createClass({
	displayName: 'ServicesFilterRow',
	render: function() {
		// props
		//	pServicesInfos
		//	sActiveFilter
		
		var cFilterBtns = [];
		
		// push the "All" filter button first
		cFilterBtns.push(React.createElement(ServiceFilterBtn, {pServiceName:'all', pServiceTitle:core.addon.l10n.app_main.title_all, sActiveFilter:this.props.sActiveFilter}));
		
		var cServicesInfos = this.props.pServicesInfos;
		console.log('cServicesInfos:', cServicesInfos);
		for (var i=0; i<cServicesInfos.length; i++) {
			var cServiceInfoEntry = cServicesInfos[i];
			if (cServiceInfoEntry.hasAssociatedImgs) {
				cFilterBtns.push(React.createElement(ServiceFilterBtn, {pServiceName:cServiceInfoEntry.serviceName, pServiceTitle:cServiceInfoEntry.serviceTitle, sActiveFilter:this.props.sActiveFilter}));
			}
		}
		
		return React.createElement('div', {className:'padd-80' },
			React.createElement('div', {className:'row'},
				React.createElement('div', {id:'filters', className:'fillter-wrap', style:{lineHeight:'40px', paddingBottom:'25px'} },
					cFilterBtns
				)
			),
			React.createElement('div', {className:'row'},
				React.createElement('div', {className:'izotope-container gutt-col3 sliphover', id:'izoc', },
					React.createElement('div', {className:'grid-sizer'}),
					React.createElement('div', {id:'message_div_izo_none', style:{display:'none'} }, // link89454 so on load if none it doesnt do transition
						core.addon.l10n.app_main.isotope_no_results
					)
				)
			)
		);
	}
});

var ServiceFilterBtn = React.createClass({
	displayName: 'ServiceFilterBtn',
	click: function() {
		izotopeFilter(this.props.pServiceName == 'all' ? '*' : this.props.pServiceName);
	},
	render: function() {
		// props
		//	sActiveFilter - holds serviceName
		//	pServiceName
		//	pServiceTitle
		
		return React.createElement('button', {className:'but' + (this.props.sActiveFilter == this.props.pServiceName ? ' activbut' : ''), 'data-filter':(this.props.pServiceName == 'all' ? '*' : '.nativeshot-' + this.props.pServiceName), onClick:this.click},
			this.props.pServiceTitle
		);
	}
});

var ServicesSummaryCol = React.createClass({
	displayName: 'ServicesSummaryCol',
	render: function() {
		// props
		//	pServicesInfosGroup
		//	sServicesLogEntryCnts
		//	sActiveFilter
		
		// console.log('pServicesInfosGroup:', this.props.pServicesInfosGroup);
		// console.log('sServicesLogEntryCnts:', this.props.sServicesLogEntryCnts);
		
		var cChildren = [];
		
		for (var i=0; i<this.props.pServicesInfosGroup.length; i++) {
			var sServiceLogEntryCnt = this.props.sServicesLogEntryCnts[this.props.pServicesInfosGroup[i].serviceName];
			cChildren.push(React.createElement(ServiceSummary, {sServiceLogEntryCnt:sServiceLogEntryCnt, pServiceName:this.props.pServicesInfosGroup[i].serviceName, pServiceTitle:this.props.pServicesInfosGroup[i].serviceTitle, sActiveFilter:this.props.sActiveFilter, pHasAssociatedImgs:this.props.pServicesInfosGroup[i].hasAssociatedImgs}));
		}
		
		return React.createElement('div', {className:'second-caption'},
			cChildren
		);
	}
});

var ServiceSummary = React.createClass({
    displayName: 'ServiceSummary',
	clickApplyFilter: function() {
		// click event only attached when it has associated imgs
		izotopeFilter(this.props.pServiceName);
	},
	clickRemoveAllLogEntries: function() {
		// click event only attached when it has NO associated imgs
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInPromiseWorker', ['removeTypeInLog', this.props.pServiceName]], bootstrapMsgListener.funcScope, function(aStatusObj) {
			if (!aStatusObj.status) {
				// do a contentWindow alert on failure. after user closes out the alert it triggers the nsOnFocus which does re-read of the file into the dom
				// alert(aStatusObj.detail);
			} else {
				gJLog = aStatusObj.jLog;
				updateCountsToSkillBars();
			}
		});
	},
	render: function() {
		// props
		//	sServiceLogEntryCnt
		//	pServiceName
		//	pServiceTitle
		//	sActiveFilter
		//	pHasAssociatedImgs
		
		return React.createElement('div', {className:'skill-block' + (this.props.pHasAssociatedImgs ? '' : ' rem-all'), onClick:(this.props.pHasAssociatedImgs ? this.clickApplyFilter : undefined)},
			// core.addon.l10n.app_main['category_' + this.props.serviceName], // see comment on next line for why i dont do this line
			this.props.pServiceTitle, // i dont do the core.addon.l10n access here because at start i push all the services and sort them alpha based on the value from localization
			this.props.pHasAssociatedImgs ? undefined : React.createElement('div', {className:'rem-all-after', onClick:this.clickRemoveAllLogEntries}),
			React.createElement('div', {className:'skill-line', 'data-nativeshot-category':this.props.pServiceName},
				React.createElement('h5', {className:'timer'},
					this.props.sServiceLogEntryCnt
				),
				React.createElement('div')
			)
		);
	}
});

// interaction via jquery - as thats how the template came - i should change this to use react in the future instead

function updateCountsToSkillBars() {
	// after update counts
	var nativeshot_log_counts = {};
	for (var p in aTypeStrToTypeInt) {
		nativeshot_log_counts[aTypeStrToTypeInt[p]] = 0;
	}
	
	// calc sums
	for (var i=0; i<gJLog.length; i++) {
		if (!(gJLog[i].t in nativeshot_log_counts)) {
			throw new Error('found a type in the log file, that is not known to the app.js global aTypeStrToTypeInt. the unknown type id is: ' + gJLog[i].t);
		}
		nativeshot_log_counts[gJLog[i].t]++;
	}

	// find biggest count
	var nativeshot_biggest_count = 0;
	for (var p in nativeshot_log_counts) {
		if (nativeshot_log_counts[p] > nativeshot_biggest_count) {
			nativeshot_biggest_count = nativeshot_log_counts[p];
		}
	}
	
	// mod biggest count so its percent obeys biggest_count_should_be_percent
	// alert('biggest count: ' + nativeshot_biggest_count);
	nativeshot_biggest_count = (nativeshot_biggest_count * 100 / biggest_count_should_be_percent);
	// alert('modded biggest count: ' + nativeshot_biggest_count);
	
	 $('.skill-line').each(function(){
		var objel = $(this);

		var cTypeStr = objel.attr('data-nativeshot-category');
		var cTypeInt = aTypeStrToTypeInt[cTypeStr];
		var nativeshot_category = aTypeStrToTypeInt[cTypeStr];
		
		var timer = objel.children('h5');

		timer.countTo({
			from: parseInt(timer.text()),
			to: nativeshot_log_counts[cTypeInt],
			speed: 2000
		});
		
		objel.children('div').css('width', nativeshot_biggest_count == 0 ? 0 : Math.round((nativeshot_log_counts[cTypeInt] / nativeshot_biggest_count)*100) + '%');
	});
};

function matchIsotopeContentsToFileJson(isNotInit) {
	// adds in images that are not in isotope but are in gJLog
	// removes images that are in isotopte and not in gJLog
	
	var objOfImagePathsInIsotope = {}; // values are {domEl:, aTypeInt} keys are src's of imgs
	var imageInIsotope = $('.izotope-container img').each(function() {
		var imgSrc = this.getAttribute('src');
		objOfImagePathsInIsotope[imgSrc] = {
			domEl: this
		}
		
		var aTypeInt;
		var domElItem = $(this).closest('.item')[0];

		var classList = domElItem.classList; // gets 
		for (var i=0; i<classList.length; i++) {
			if (classList[i].indexOf('nativeshot-') == 0) {

				aTypeInt = aTypeStrToTypeInt[classList[i].substr(11)]; // 11 is 'nativeshot-'.length
				break;
			}
		}
		
		if (aTypeInt === undefined) {
			throw new Error('unidentified type str found in izotope-container of here is classList:' + classList.join(' '));
		}
		
		objOfImagePathsInIsotope[imgSrc].aTypeInt = aTypeInt;
		objOfImagePathsInIsotope[imgSrc].domElItem = domElItem;
	});
	

	
	var imgsAdded = false;
	var imgsRemoved = false;
	
	var ic = document.getElementById('izoc');
	var izotopeContainer = $(ic);
	
	var fileJsonAsIzotopeEls = {}; // key is .imgsrc value is {aTypeInt:, aDataId:int} // holds only things that should have image in the isotope container, like even if copy/print type did have img src it wouldnt be in here
	for (var i=0; i<gJLog.length; i++) {
		if (!(gJLog[i].t in aTypeIntToTypeStr)) {
			throw new Error('found a type in the log file, that is not known to the app.js global aTypeStrToTypeInt. the unknown type id is: ' + gJLog[i].t);
		}

		if (gJLog[i].noWriteObj && gJLog[i].noWriteObj.imgsrc) {						
			if (!(gJLog[i].t in classVariants)) {
				throw new Error('no mainDivClassVariants for type ' + gJLog[i].t);
			}
						
			classREF.class = classVariants[gJLog[i].t];
			var imgDate = new Date(gJLog[i].d);
			var formattedDate = justFormatStringFromName(core.addon.l10n.dateFormat['month.' + (imgDate.getMonth()+1) + '.name']) + ' ' + imgDate.getDate() + ', ' + imgDate.getFullYear() + ' - ' + (imgDate.getHours() > 12 ? Math.abs(imgDate.getHours() - 12) : imgDate.getHours()) + ':' + (imgDate.getMinutes() < 10 ? '0' + imgDate.getMinutes() : imgDate.getMinutes()) + ' ' + (imgDate.getHours() < 12 ? 'AM' : 'PM');
			
			dataCaptionREF['data-gettime'] = gJLog[i].d;
			imgREF.src = gJLog[i].noWriteObj.imgsrc;
			aREF.href = imgREF.src;
			gHoverId++;
			dataCaptionREF['data-caption'] = gHoverId;
			templatedDataCaption(gJLog[i].t, formattedDate, justFormatStringFromName(core.addon.l10n.app_main['title_' + aTypeIntToTypeStr[gJLog[i].t]]), gJLog[i].d, imgREF.src);
			
			
			var foundAlreadyInIzotope = false;
			for (var isotopeImgSrc in objOfImagePathsInIsotope) {
				// go through the gJLog obj i created
				if (imgREF.src.toLowerCase() == isotopeImgSrc.toLowerCase()) {
					foundAlreadyInIzotope = true;
					break;
				}
			}
			fileJsonAsIzotopeEls[imgREF.src] = {
				aTypeInt: aTypeStrToTypeInt[gJLog[i].t]
			};
			if (!foundAlreadyInIzotope) {
				imgsAdded = true;
				
				var createdEl = jsonToDOM(slipCoverJson, document, {});

				ic.insertBefore(createdEl, ic.firstChild.nextSibling);
				if (isNotInit) {
					izotopeContainer.isotope('addItems', createdEl);
				}
			}
		} else {
			// no image for this type in isotope, like copy and print
		}
	}



	if (isNotInit) {
		// check if need to remove anything, and remove it
		// check if any of the isotope srcs that were present when i started this function, need to not be there (meaning they are not in the fileJsonAsIzotopeEls obj)
		for (var isotopeImgSrc in objOfImagePathsInIsotope) {
			// go through the gJLog obj i created
			var found = false;
			for (var jsonImgSrc in fileJsonAsIzotopeEls) {
				if (jsonImgSrc.toLowerCase() == isotopeImgSrc.toLowerCase()) {
					found = true;
					break;
				}
			}
			if (!found) {

				imgsRemoved = true;
				izotopeContainer.isotope('remove', objOfImagePathsInIsotope[isotopeImgSrc].domElItem);
			}
		}
	}

	if (!isNotInit) {
		izotopeContainer.isotope({
			itemSelector: '.item',
			layoutMode: 'masonry',
			masonry: {
				columnWidth: '.grid-sizer'
			}
		});
		/*
		izotopeContainer.on('layoutComplete', function( event, laidOutItems ) {
			alert('removing pointer events none');
			izotopeContainer.css('pointer-events', '');
		});
		alert('attached on');
		*/
	}
		
	if (imgsAdded || imgsRemoved) {
			// before image loaded, so if imgs were added, we start the layout, and then after imgs loaded it adjusts for proper sizes
			if (isNotInit) {
				// alert('izo reloadingItems');
				izotopeContainer.isotope('reloadItems');
			}
			izotopeContainer.isotope('layout');
			if (imgsAdded) {
				izotopeContainer.imagesLoaded(function() {
					// alert('running layout');
					izotopeContainer.isotope('reloadItems');
					izotopeContainer.isotope();
					checkIzoNoRez(true);
				});
			}
	}
	checkIzoNoRez(true);
	if (!isNotInit) {
		document.getElementById('message_div_izo_none').style.display = ''; // link89454 so on load if none it doesnt do transition
	}
}

function checkIzoNoRez(disallowQuickAnim) {
	if ( !$('.izotope-container').data('isotope').filteredItems.length ) {
		// alert('show none');
		var izo_msg_none = document.getElementById('message_div_izo_none');
		if (izo_msg_none.classList.contains('izo-msg-show')) {
			if (!disallowQuickAnim) {
				var quickAnim = setTimeout(function() {
					izo_msg_none.classList.add('izo-msg-show');
				}, 100);
				izo_msg_none.classList.remove('izo-msg-show');
			}
		} else {
			izo_msg_none.classList.add('izo-msg-show');
		}
	} else {
		// alert('hide none');
		document.getElementById('message_div_izo_none').classList.remove('izo-msg-show');
	}
}

function izotopeFilter(aTypeStr) {
	
	if (aTypeStr.indexOf('.') == 0) {
		aTypeStr = aTypeStr.substr(12); // 'nativeshot-'.length + 1
		// alert(aTypeStr);
	}
	
	$('#filters .but').each(function() {
		var $th = $(this);
		if (aTypeStr == '*') {
			if ($th.attr('data-filter') == aTypeStr) {
				$th.addClass('activbut');
			} else {
				$th.removeClass('activbut');
			}
		} else {
			if ($th.attr('data-filter') == '.nativeshot-' + aTypeStr) {
				$th.addClass('activbut');
			} else {
				$th.removeClass('activbut');
			}			
		}
	});
	$('.skill-block').each(function() {
		var $th = $(this);
		if (aTypeStr == '*') {
			$th.removeClass('non-filtered-skill');
		} else {
			var cTypeStr = $th.find('.skill-line').attr('data-nativeshot-category');
			if (cTypeStr == aTypeStr) {
				$th.removeClass('non-filtered-skill');
			} else {
				$th.addClass('non-filtered-skill');
			}
		}
	});
	$('.izotope-container').isotope({filter: aTypeStr == '*' ? aTypeStr : '.nativeshot-' + aTypeStr});
	
	checkIzoNoRez();
	
}

function readHistoryLog(aCB) {
	sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInPromiseWorker', ['readHistoryLog']], bootstrapMsgListener.funcScope, function(aStatusObj) {
		
		if (aStatusObj && aStatusObj.status) {
			gJLog = aStatusObj.jLog;

			if (aCB) {
				aCB();
			}
		} else {
			throw new Error('readHistoryLog failed');
		}
		
	});
}

function writeHistoryLog(aCB) {
	// writes gJLog to file
	sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInPromiseWorker', ['writeHistoryLog', gJLog]], bootstrapMsgListener.funcScope, function(aStatusObj) {
		
		if (aStatusObj && aStatusObj.status) {
			gJLog = JSON.parse('[' + aContents.substr(1) + ']'); // because its saved as unbracketed with a leading comma
			gJLog.sort(function(a, b) {
				return a.d > b.d;
			})
			
			if (aCB) {
				aCB();
			}
		} else {
			throw new Error('failed to writeHistoryLog');
		}
		
	});
}

function getArrElInFileJsonByGettime(aGettime) {
	for (var i=0; i<gJLog.length; i++) {
		if (gJLog[i].d == aGettime) {
			return gJLog[i];
		}
	}
	
	throw new Error('no entry in gJLog found with .d of ' + aGettime);
}


function izoView(aEvent, aGettime) {
	// alert(aEvent);

	if (aEvent.ctrlKey || aEvent.altKey || aEvent.metaKey || aEvent.shiftKey) {
		// let default browse action happen, which is open in new tab focused, new tab background, or new window
	} else {
		// do magnific
		// alert('magnific this: ' + getImageURL(getArrElInFileJsonByGettime(aGettime)));
		// aEvent.stopPropagation(); // if i uncomment this, then the click will not propoagte to document.body which is where i catch the click
		aEvent.preventDefault();
		// aEvent.returnValue = false;
		// return false;
	}
};
function izoCopy(aGettime) {

	var cLogEntry = getArrElInFileJsonByGettime(aGettime);
	
	var linktxt;
	if (cLogEntry.noWriteObj.platpath) {
		linktxt = cLogEntry.noWriteObj.platpath;
	} else {
		linktxt = cLogEntry.noWriteObj.imgsrc;
	}
	
	contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, ['callInBootstrap', ['copyTextToClip', linktxt]]);
};
function izoOpen(aGettime) {
	
	var aArrEl = getArrElInFileJsonByGettime(aGettime);
	switch (aArrEl.t) {
		case aTypeStrToTypeInt['save-quick']:
		case aTypeStrToTypeInt['save-browse']:
			
				contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, ['callInBootstrap', ['showFileInOSExplorer', null, aArrEl.f, aArrEl.n]]);
			
			break;
		case aTypeStrToTypeInt['twitter']:
			
				contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, ['callInBootstrap', ['openRelatedTab', 'https://twitter.com/' + aArrEl.p.substr(1)]]);				
			
			break;
		default:
			throw new Error('this type does not have a open method, aTypeInt: ' + aArrEl.t);
	}
};
function izoDelete(aGettime) {
	
	sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInPromiseWorker', ['deleteEntryInLog', aGettime]], bootstrapMsgListener.funcScope, function(aStatusObj) {
		if (!aStatusObj.status) {
			// do a contentWindow alert on failure. after user closes out the alert it triggers the nsOnFocus which does re-read of the file into the dom
			// alert(aStatusObj.detail);
		} else {
			gJLog = aStatusObj.jLog;
			updateCountsToSkillBars();
		}
	});

	slipStyleRemoveElement(aGettime);
};

function izoRemove(aGettime) {
	sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['callInPromiseWorker', ['removeEntryInLog', aGettime]], bootstrapMsgListener.funcScope, function(aStatusObj) {
		if (!aStatusObj.status) {
			// do a contentWindow alert on failure. after user closes out the alert it triggers the nsOnFocus which does re-read of the file into the dom
			// alert(aStatusObj.detail);
		} else {
			gJLog = aStatusObj.jLog;
			updateCountsToSkillBars();
		}
	});
	
	slipStyleRemoveElement(aGettime);
};

function slipStyleRemoveElement(aGettime) {
	// call this to remove an element from the isotope gui, when the users mouse is over the element
	// RETURNS - nothing
	
	var sliptarg = $('div[data-gettime=' + aGettime + ']');
	$('.izotope-container').css('pointer-events', 'none').isotope('remove', sliptarg.closest('.item')[0]).isotope('layout');
	var enablePointerTimer = setTimeout(function() {
		$('.izotope-container').css('pointer-events', '');
		checkIzoNoRez();
	}, 400);
	$('.sliphover-container').remove();
}

// start - common helper functions
function jsonToDOM(json, doc, nodes) {

    var namespaces = {
        html: 'http://www.w3.org/1999/xhtml',
        xul: 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
    };
    var defaultNamespace = namespaces.html;

    function namespace(name) {
        var m = /^(?:(.*):)?(.*)$/.exec(name);        
        return [namespaces[m[1]], m[2]];
    }

    function tag(name, attr) {
        if (Array.isArray(name)) {
            var frag = doc.createDocumentFragment();
            Array.forEach(arguments, function (arg) {
                if (!Array.isArray(arg[0]))
                    frag.appendChild(tag.apply(null, arg));
                else
                    arg.forEach(function (arg) {
                        frag.appendChild(tag.apply(null, arg));
                    });
            });
            return frag;
        }

        var args = Array.slice(arguments, 2);
        var vals = namespace(name);
        var elem = doc.createElementNS(vals[0] || defaultNamespace, vals[1]);

        for (var key in attr) {
            var val = attr[key];
            if (nodes && key == 'id')
                nodes[val] = elem;

            vals = namespace(key);
            if (typeof val == 'function')
                elem.addEventListener(key.replace(/^on/, ''), val, false);
            else
                elem.setAttributeNS(vals[0] || '', vals[1], val);
        }
        args.forEach(function(e) {
            try {
                elem.appendChild(
                                    Object.prototype.toString.call(e) == '[object Array]'
                                    ?
                                        tag.apply(null, e)
                                    :
                                        e instanceof doc.defaultView.Node
                                        ?
                                            e
                                        :
                                            doc.createTextNode(e)
                                );
            } catch (ex) {
                elem.appendChild(doc.createTextNode(ex));
            }
        });
        return elem;
    }
    return tag.apply(null, json);
}
// end - common helper functions
////////// end - nativeshot - app_main











///////////////// start - framescript skeleton
// Imports
const {interfaces:Ci} = Components;

// Globals
var core = {
	addon: {
		id: 'NativeShot@jetpack' // non-skel
	}
}; // set by initPage
var gCFMM; // needed for contentMMFromContentWindow_Method2

// // Lazy imports
// var myServices = {};
// XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'cp.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

// Start - DOM Event Attachments
function doOnBeforeUnload() {

	contentMMFromContentWindow_Method2(window).removeMessageListener(core.addon.id, bootstrapMsgListener);

}

function doOnContentLoad() {
	console.log('in doOnContentLoad');
	initPage();
}

document.addEventListener('DOMContentLoaded', doOnContentLoad, false);
window.addEventListener('beforeunload', doOnBeforeUnload, false);

// :note: should attach doOnBlur to window.blur after page is init'ed for first time, or if widnow not focused, then attach focus listener link147928272
function ifNotFocusedDoOnBlur() { // was ifNotFocusedAttachFocusListener
	if (!document.hasFocus()) {
		attachFocusListener();
	}
}

function attachFocusListener() {
	// :note: i dont know why im removing focus on blur, but thats how i did it in nativeshot, it must avoid some redundancy
	window.addEventListener('focus', doOnFocus, false);
}

function detachFocusListener() {
	window.removeEventListener('focus', doOnFocus, false);
}

function doOnFocus() {
	detachFocusListener();
	// fetch prefs from bootstrap, and update dom
	nsOnFocus(); // non-skel
}

// End - DOM Event Attachments
// Start - Page Functionalities

function initPage() {
	
	var postNonSkelInit = function() {
		window.addEventListener('blur', attachFocusListener, false); // link147928272
		ifNotFocusedDoOnBlur();
	};
	
	nsInitPage(postNonSkelInit); ///// non-skel
}

// End - Page Functionalities

// start - server/framescript comm layer
// sendAsyncMessageWithCallback - rev3
var bootstrapCallbacks = { // can use whatever, but by default it uses this
	// put functions you want called by bootstrap/server here
	serverCommand_refreshDashboardGuiFromFile: function() {
		nsOnFocus();
	}
};
const SAM_CB_PREFIX = '_sam_gen_cb_';
var sam_last_cb_id = -1;
function sendAsyncMessageWithCallback(aMessageManager, aGroupId, aMessageArr, aCallbackScope, aCallback) {
	sam_last_cb_id++;
	var thisCallbackId = SAM_CB_PREFIX + sam_last_cb_id;
	aCallbackScope = aCallbackScope ? aCallbackScope : bootstrap; // :todo: figure out how to get global scope here, as bootstrap is undefined
	aCallbackScope[thisCallbackId] = function(aMessageArr) {
		delete aCallbackScope[thisCallbackId];
		aCallback.apply(null, aMessageArr);
	}
	aMessageArr.push(thisCallbackId);
	aMessageManager.sendAsyncMessage(aGroupId, aMessageArr);
}
var bootstrapMsgListener = {
	funcScope: bootstrapCallbacks,
	receiveMessage: function(aMsgEvent) {
		var aMsgEventData = aMsgEvent.data;
		console.log('framescript getting aMsgEvent, unevaled:', uneval(aMsgEventData));
		// aMsgEvent.data should be an array, with first item being the unfction name in this.funcScope
		
		var callbackPendingId;
		if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
			callbackPendingId = aMsgEventData.pop();
		}
		
		var funcName = aMsgEventData.shift();
		if (funcName in this.funcScope) {
			var rez_fs_call = this.funcScope[funcName].apply(null, aMsgEventData);
			
			if (callbackPendingId) {
				// rez_fs_call must be an array or promise that resolves with an array
				if (rez_fs_call.constructor.name == 'Promise') {
					rez_fs_call.then(
						function(aVal) {
							// aVal must be an array
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, aVal]);
						},
						function(aReason) {
							console.error('aReject:', aReason);
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aReason]]);
						}
					).catch(
						function(aCatch) {
							console.error('aCatch:', aCatch);
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aCatch]]);
						}
					);
				} else {
					// assume array
					contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, rez_fs_call]);
				}
			}
		}
		else { console.warn('funcName', funcName, 'not in scope of this.funcScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out
		
	}
};
contentMMFromContentWindow_Method2(content).addMessageListener(core.addon.id, bootstrapMsgListener);
// end - server/framescript comm layer
// start - common helper functions
function contentMMFromContentWindow_Method2(aContentWindow) {
	if (!gCFMM) {
		gCFMM = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIDocShell)
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIContentFrameMessageManager);
	}
	return gCFMM;

}
function Deferred() { // rev3 - https://gist.github.com/Noitidart/326f1282c780e3cb7390
	// update 062115 for typeof
	if (typeof(Promise) != 'undefined' && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (typeof(PromiseUtils) != 'undefined'  && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else {
		/* A method to resolve the associated Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} value : This value is used to resolve the promise
		 * If the value is a Promise then the associated promise assumes the state
		 * of Promise passed as value.
		 */
		this.resolve = null;

		/* A method to reject the assocaited Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} reason: The reason for the rejection of the Promise.
		 * Generally its an Error object. If however a Promise is passed, then the Promise
		 * itself will be the reason for rejection no matter the state of the Promise.
		 */
		this.reject = null;

		/* A newly created Pomise object.
		 * Initially in pending state.
		 */
		this.promise = new Promise(function(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;
		}.bind(this));
		Object.freeze(this);
	}
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};
	console.error('Rejected - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};
	console.error('Caught - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}

// rev1 - https://gist.github.com/Noitidart/c4ab4ca10ff5861c720b
function validateOptionsObj(aOptions, aOptionsDefaults) {
	// ensures no invalid keys are found in aOptions, any key found in aOptions not having a key in aOptionsDefaults causes throw new Error as invalid option
	for (var aOptKey in aOptions) {
		if (!(aOptKey in aOptionsDefaults)) {
			console.error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value, aOptionsDefaults:', aOptionsDefaults, 'aOptions:', aOptions);
			throw new Error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value');
		}
	}
	
	// if a key is not found in aOptions, but is found in aOptionsDefaults, it sets the key in aOptions to the default value
	for (var aOptKey in aOptionsDefaults) {
		if (!(aOptKey in aOptions)) {
			aOptions[aOptKey] = aOptionsDefaults[aOptKey];
		}
	}
}
function justFormatStringFromName(aLocalizableStr, aReplacements) {
    // justFormatStringFromName is formating only ersion of the worker version of formatStringFromName

    var cLocalizedStr = aLocalizableStr;
    if (aReplacements) {
        for (var i=0; i<aReplacements.length; i++) {
            cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
        }
    }

    return cLocalizedStr;
}
var reA = /[^a-zA-Z]/g; // for compareAlphaNumeric
var reN = /[^0-9]/g; // for compareAlphaNumeric
function compareAlphaNumeric(a, b) {
	// useful for sorting algo, originally inteded for alpha-numeric asc sort. taken from - http://stackoverflow.com/a/4340339/1828637
	// returns -1 if a < b
	// returns -1 if a == b
	// returns -1 if a > b
    var aA = a.replace(reA, '');
    var bA = b.replace(reA, '');
    if(aA === bA) {
        var aN = parseInt(a.replace(reN, ''), 10);
        var bN = parseInt(b.replace(reN, ''), 10);
        return aN === bN ? 0 : aN > bN ? 1 : -1;
    } else {
        return aA > bA ? 1 : -1;
    }
}
// end - common helper functions