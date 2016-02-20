var WORKER = this; // crossfile-link11151
importScripts('resource://gre/modules/workers/require.js');
importScripts('chrome://nativeshot/content/modules/tesseract/tesseract.js');

// Setup PromiseWorker
var PromiseWorker = require('resource://gre/modules/workers/PromiseWorker.js');

// Instantiate AbstractWorker (see below).
var worker = new PromiseWorker.AbstractWorker()

// worker.dispatch = function(method, args = []) {
worker.dispatch = function(method, args = []) {// start - noit hook to allow PromiseWorker methods to return promises
  // Dispatch a call to method `method` with args `args`
  // start - noit hook to allow PromiseWorker methods to return promises
  // return self[method](...args);
  console.log('dispatch args:', args);
  var earlierResult = gEarlyDispatchResults[args[0]]; // i change args[0] to data.id
  delete gEarlyDispatchResults[args[0]];
  return earlierResult;
  // end - noit hook to allow PromiseWorker methods to return promises
};
worker.postMessage = function(...args) {
  // Post a message to the main thread
  self.postMessage(...args);
};
worker.close = function() {
  // Close the worker
  self.close();
};
worker.log = function(...args) {
  // Log (or discard) messages (optional)
  dump('Worker: ' + args.join(' ') + '\n');
};

// Connect it to message port.
// self.addEventListener('message', msg => worker.handleMessage(msg));
// start - noit hook to allow PromiseWorker methods to return promises
var gEarlyDispatchResults = {};
self.addEventListener('message', msg => {
	

      var earlyDispatchRes = self[msg.data.fun](...msg.data.args);
	  msg.data.args.splice(0, 0, msg.data.id)
	  if (earlyDispatchRes.constructor.name == 'Promise') {
		earlyDispatchRes.then(
			function(aVal) {
				gEarlyDispatchResults[msg.data.id] = aVal;
				worker.handleMessage(msg);
			},
			function(aReason) {
				console.error('aReject:', aReason);
			}
		).catch(
			function(aCatch) {
				console.error('aCatch:', aCatch);
			}
		);
	  } else {
		  gEarlyDispatchResults[msg.data.id] = earlyDispatchRes;
		  worker.handleMessage(msg);
	  }
});
// end - noit hook to allow PromiseWorker methods to return promises

var gT;
var gIndex = 0;
var gBigWorker = false;

function readByteArr(aImgBuf, aWidth, aHeight) {
	
	var deferredMain_readByteArr = new Deferred();
	
	if (!gT) {
		gT = tesseractinit(16777216*6); // equivalent of worker.postMessage({init: {mem: 16777216*6}})
	}
	
	var cImgData = new ImageData(new Uint8ClampedArray(aImgBuf), aWidth, aHeight);
	
	gIndex++;
	
	gT.detect(gIndex, cImgData, function(detectErr, detectResult) {
		console.log('detectErr:', detectErr, 'detectResult:', detectResult);
		gIndex++;
		
		var aOptions = {};
		if (detectResult) {
			aOptions.lang = detectResult.script;
			aOptions.lang = 'eng'; // :debug: as .script is not something i can pass to .lang
		} else {
			aOptions.lang = 'eng';
		}
		
		if (!gBigWorker && ['chi_sim', 'chi_tra', 'jpn'].indexOf(aOptions.lang) != -1){
			gT = tesseractinit(16777216*10); // worker.postMessage({init: {mem: 16777216*10}})
			gBigWorker = true; // bigworker = true
			// console.log('started big worker')
		}
		
		gT.recognize(gIndex, cImgData, aOptions.lang, aOptions, function(recognizeErr, recognizeResult){
			console.log('recognizeErr:', recognizeErr, 'recognizeResult:', recognizeResult);
			if (recognizeResult) {
				deferredMain_readByteArr.resolve(recognizeResult.text);
			} else {
				deferredMain_readByteArr.reject('tesseract.js failed');
			}
		});
	});
	
	// console.info('OCRAD aImgBuf:', aImgBuf, 'aWidth:', aWidth, 'aHeight:', aHeight, '');
	// return 'rawr'; // with my hook for "noit hook to allow PromiseWorker methods to return promises" i can return anything or a promises
	return deferredMain_readByteArr.promise;
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