Components.utils.import('resource://gre/modules/Services.jsm');

var core = {
	addon: {
		name: 'NativeShot',
		id: 'NativeShot@jetpack'
	}
};

var gQS = queryStringAsJson(window.location.search.substr(1));
console.log('gQS:', gQS, window.location.search.substr(1));

var gStack;
var gCanBase;
var gCanDim;

var gCtxBase;
var gCtxDim;

const gStyle = {
	dimFill: 'rgba(0, 0, 0, 0.6)',
	lineDash: [3, 3],
	stroke: '#fff',
	lineDashAlt: [0, 3, 0],
	strokeAlt: '#000',
	lineWidth: '1',
	resizePtSize: 7,
	resizePtFill: '#000'
};

const NS_HTML = 'http://www.w3.org/1999/xhtml';
const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

var gUsedW;
var gUsedH;

function init() {
	// set globals
	// setTimeout(function() {
	
	gStack = document.getElementById('contOfCans');
	gCanBase = document.getElementById('canBase');
	gCanDim = document.getElementById('canDim');
	
	gCtxBase = gCanBase.getContext('2d');
	gCtxDim = gCanDim.getContext('2d');
	
	// set dimensions of canvas
	
	// setAttributeNS doesnt work
	// gCanBase.setAttributeNS(NS_HTML, 'width', gQS.w);
	// gCanBase.setAttributeNS(NS_HTML, 'height', gQS.h);
	// gCanDim.setAttributeNS(NS_HTML, 'width', gQS.w);
	// gCanDim.setAttributeNS(NS_HTML, 'height', gQS.h);
	
	if (gQS.win81ScaleX || gQS.win81ScaleY) {
		gUsedW = Math.ceil(gQS.w / gQS.win81ScaleX);
		gUsedH = Math.ceil(gQS.h / gQS.win81ScaleY);
	}

	
	gCanBase.setAttribute('width', gUsedW);
	gCanBase.setAttribute('height', gUsedH);
	gCanDim.setAttribute('width', gUsedW);
	gCanDim.setAttribute('height', gUsedH);
	
	// fill
	gCtxDim.fillStyle = gStyle.dimFill;
	console.log('gStyle.dimFill:', gStyle.dimFill);
	gCtxDim.fillRect(0, 0, gQS.w, gQS.h);
	console.log('filled:', 0, 0, gQS.w, gQS.h)
	// }, 1000);
	Services.obs.notifyObservers(null, core.addon.id + '_nativeshot-editor-request', JSON.stringify({
		topic: 'init',
		iMon: gQS.iMon
	}));
}

function screenshotXfer(aData) {
	console.log('in screenshotXfer, aData:', aData);
	
	var screenshotImageData = new ImageData(new Uint8ClampedArray(aData.screenshotArrBuf), gQS.w, gQS.h);
	
	if (gQS.win81ScaleX || gQS.win81ScaleY) {
		var canDum = document.createElementNS(NS_HTML, 'canvas');
		canDum.setAttribute('width', gQS.w);
		canDum.setAttribute('height', gQS.h);
		
		var ctxDum = canDum.getContext('2d');
		ctxDum.putImageData(screenshotImageData, 0, 0);
		
		gCtxBase.scale(1/gQS.win81ScaleX, 1/gQS.win81ScaleY);
		gCtxDim.scale(1/gQS.win81ScaleX, 1/gQS.win81ScaleY);
		
		gCtxBase.drawImage(canDum, 0, 0);
	} else {
		gCtxBase.putImageData(screenshotImageData, 0, 0);
	}
}

window.addEventListener('load', init, false);

window.addEventListener('message', function(aWinMsgEvent) {
	console.error('incoming message to window iMon "' + gQS.iMon + '", aWinMsgEvent:', aWinMsgEvent);
	var aData = aWinMsgEvent.data;
	if (aData.topic in window) {
		window[aData.topic](aData);
	} else {
		throw new Error('unknown topic received: ' + aData.topic);
	}
}, false);

// common functions

// rev3 - https://gist.github.com/Noitidart/725a9c181c97cfc19a99e2bf1991ebd3
function queryStringAsJson(aQueryString) {
	var asJsonStringify = aQueryString;
	asJsonStringify = asJsonStringify.replace(/&/g, '","');
	asJsonStringify = asJsonStringify.replace(/=/g, '":"');
	asJsonStringify = '{"' + asJsonStringify + '"}';
	asJsonStringify = asJsonStringify.replace(/"(\d+(?:.\d+)?|true|false)"/g, function($0, $1) { return $1; });
	
	return JSON.parse(asJsonStringify);
}