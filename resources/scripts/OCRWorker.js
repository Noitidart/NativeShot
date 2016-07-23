importScripts('chrome://nativeshot/content/resources/scripts/comm/Comm.js');
var {callInBootstrap, callInMainworker} = CommHelper.childworker;
var gWkComm = new Comm.client.worker();

var gTess;
var gTessBig = false;
var gTessIdx = 0;
var WORKER = this;

function readByteArr(aArg) {
	var { method, arrbuf, width, height, lang='eng' } = aArg
	// method - string;enum['tesseract','ocrad','gocr']
	// lang only used by tessearact

	// console.info('GOCR arrbuf:', arrbuf, 'width:', width, 'height:', height, '');

	var image_data = new ImageData(new Uint8ClampedArray(arrbuf), width, height);

	switch (method) { // each block must return, no break's
		case 'gocr':

			if (typeof(GOCR) == 'undefined') {
				importScripts('chrome://nativeshot/content/resources/scripts/3rd/gocr.js');
			}
			var txt = GOCR(image_data);

			return txt;

		case 'ocrad':

			if (typeof(OCRAD) == 'undefined') {
				importScripts('chrome://nativeshot/content/resources/scripts/3rd/ocrad.js');
			}
			var txt = OCRAD(image_data);

			return txt;

		case 'tesseract':

			if (typeof(gTess) == 'undefined') {
				importScripts('chrome://nativeshot/content/resources/scripts/3rd/tesseract.js');
			}

			if (['chi_sim', 'chi_tra', 'jpn'].indexOf(lang)) {
				if (!gTessBig) {
					gTess = tesseractinit(16777216*10); // worker.postMessage({init: {mem: 16777216*10}})
					gTessBig = true;
				}
			} else {
				if (!gTess) {
					gTess = tesseractinit(16777216*6); // equivalent of worker.postMessage({init: {mem: 16777216*6}})
				}
			}

			var options = {};

			var deferred_recognize = new Deferred();

			gTess.recognize(gTessIdx++, image_data, lang, options, function(err, rez){
				console.log('err:', rez, 'rez:', rez);
				if (rez) {
					deferred_recognize.resolve(rez.text);
				} else {
					deferred_recognize.resolve(null);
				}
			});

			return deferred_recognize.promise;
	}
}

// start - common helper functions
function Deferred() {
	this.resolve = null;
	this.reject = null;
	this.promise = new Promise(function(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
	}.bind(this));
	Object.freeze(this);
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
// end - common helper functions
