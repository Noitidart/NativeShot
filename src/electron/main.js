const {app, Menu, Tray, BrowserWindow} = require('electron');
const path = require('path')
const url = require('url')

var win;
function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({width: 800, height: 600})

    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Open the DevTools.
    win.webContents.openDevTools();

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    });
}

function startTray() {
    // run in app.on ready - i dont know why but @wadie did it like this
    var platform = require('os').platform();
    let appIcon =  new Tray('icon.' + (platform == 'win32' ? 'ico' : 'png'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Screenshots',
            type: 'radio'
        }
    ]);

    // Make a change to the context menu
    contextMenu.items[0].checked = false;

    // Call this again for Linux because we modified the context menu
    appIcon.setContextMenu(contextMenu);
}

const { TextEncoder, TextDecoder} = require('./node_modules/text-encoding/index.js');
function startChildProc() {
    // run in app.on ready - because i need TextEncoder which comes in from the require statement
    var spawn = require('child_process').spawn,
        child = spawn('./nativeshot.exe');

    // child.stdin.setEncoding('utf-8');
    // child.stdout.pipe(process.stdout);

    child.stdout.on('data', function (nbuf) {
        // nbuf stands for "node buffer" is Buffer which is Uint8Array per http://stackoverflow.com/a/12101012/1828637
        console.log('stdout, nbuf:', nbuf);
        var buf = nbuf.buffer; // ArrayBuffer
        console.log('buf:', buf);
        var view = new DataView(buf);
        console.log('view:', view);

        var decoder = new TextDecoder('utf-8');
        var str = decoder.decode(view);
        console.log('str lib:', str);

        // const StringDecoder = require('string_decoder').StringDecoder;
        // const decoder = new StringDecoder('utf8');
        // decoder.write(nbuf);
        // var str = decoder.end();
        // console.log('str:', str);
    });


    console.log('Hey there');
    var message = "\"ping\"";

    // https://dxr.mozilla.org/mozilla-central/source/toolkit/components/extensions/NativeMessaging.jsm#252
    var buf = new Buffer(new TextEncoder().encode(message).buffer);
    console.log('buf:', buf);

    // https://dxr.mozilla.org/mozilla-central/source/toolkit/components/extensions/NativeMessaging.jsm#298
    var sizebuf = new Buffer(Uint32Array.of(buf.byteLength).buffer);
    console.log('sizebuf:', sizebuf);

    child.stdin.write(sizebuf);
    child.stdin.write(buf);
    // child.stdin.end();

    setTimeout(function() {
        console.log('ok will send ping again');
        child.stdin.write(sizebuf);
        child.stdin.write(buf);
        // child.stdin.end();
    }, 5000);
}

function readyHandler() {
    startTray();
    startChildProc();
    createWindow();
}

function activateHandler() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
}

function allwinClosedHandler() {
    // Quit when all windows are closed.
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit()
    }
}

app.on('ready', readyHandler);
app.on('activate', activateHandler);
app.on('window-all-closed', allwinClosedHandler);
