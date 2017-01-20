BUILD INSTRUCTIONS
cd into .tidy.ignore
npm install
gulp
it will create dist.xpi and ./dist
dist.xpi should match perfectly to the upload xpi

3RD PARTY SOURCES
* ./resources/scripts/3rd/ocrad.js - https://github.com/antimatter15/ocrad.js/blob/5b0af624ebfd70cf45ddf55c58eaf25718133ba3/ocrad.js
* ./resources/scripts/3rd/gocr.js - https://github.com/antimatter15/gocr.js/tree/d820e0651cf819e9649a837d83125724a2c1cc37
* ./resources/scripts/3rd/tesseract.js - https://cdn.rawgit.com/naptha/tesseract.js/master/lib/worker.2015.07.26.js
* ./resources/scripts/3rd/react-redux.js - https://npmcdn.com/react-redux@latest/dist/react-redux.min.js
* ./resources/scripts/3rd/redux.js - https://npmcdn.com/redux@3.5.2/dist/redux.min.js
* ./resources/scripts/3rd/react-with-addons.js - https://fb.me/react-with-addons-15.1.0.min.js
* ./resources/scripts/3rd/react-dom.js - https://fb.me/react-dom-15.1.0.min.js