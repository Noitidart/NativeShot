importScripts('resource://gre/modules/workers/require.js');
importScripts('chrome://nativeshot/content/modules/ocrad/ocrad.js');

// Setup PromiseWorker
var PromiseWorker = require('resource://gre/modules/workers/PromiseWorker.js');

// Instantiate AbstractWorker (see below).
var worker = new PromiseWorker.AbstractWorker()

worker.dispatch = function(method, args = []) {
  // Dispatch a call to method `method` with args `args`
  return self[method](...args);
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
self.addEventListener('message', msg => worker.handleMessage(msg));

function readByteArr(aImgBuf, aWidth, aHeight) {
	console.info('OCRAD aImgBuf:', aImgBuf, 'aWidth:', aWidth, 'aHeight:', aHeight, '');
	var cImgData = new ImageData(new Uint8ClampedArray(aImgBuf), aWidth, aHeight);
	var txt = OCRAD(cImgData);
	return txt;
}