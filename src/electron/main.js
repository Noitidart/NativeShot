const {app, Menu, Tray, BrowserWindow} = require('electron');
const path = require('path')
const url = require('url')

let win;
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
    let platform = require('os').platform();
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

function startChildProc() {
    // run in app.on ready - because i need TextEncoder which comes in from the require statement
    const { spawn } = require('child_process');
    let child = spawn('./nativeshot.exe');

    // child.stdin.setEncoding('utf-8');
    // child.stdout.pipe(process.stdout);

    child.stdout.on('data', function (nbuf) {
        // nbuf stands for "node buffer" is Buffer which is Uint8Array per http://stackoverflow.com/a/12101012/1828637
        console.log('stdout, nbuf:', nbuf, 'nbuf.toJSON:', nbuf.toJSON());

        // let sizeofuint32 = new Buffer(Uint32Array.of(nbuf.length).buffer).length;
        // console.log('sizeofuint32:', sizeofuint32); // is 4
        const SIZEOFUINT32 = 4;

        let ix = 0;
        let l = nbuf.length;
        while(ix < l) {
            let lenbuf = Buffer.from(nbuf.buffer, ix, ix + SIZEOFUINT32); // 4 because size of Uint32 is 4. `sizeofuint32` gives 4
            console.log('lenbuf:', lenbuf.toJSON());
            // console.log('lenbuf:', lenbuf.toString('utf8'));
            let len = new Uint32Array(lenbuf)[0];
            console.log('len:', len);

            let strbuf = Buffer.from(nbuf.buffer, SIZEOFUINT32, len);
            console.log('strbuf:', strbuf.toJSON());
            let str = strbuf.toString('utf8');
            console.log('str:', str);

            ix = SIZEOFUINT32 + len;
            console.log('post ix:', ix, 'l:', l);
        }
    });


    console.log('Hey there');
    let message = JSON.stringify('ping');

    // https://dxr.mozilla.org/mozilla-central/source/toolkit/components/extensions/NativeMessaging.jsm#252
    let nbuf = Buffer.from(message, 'utf8');
    console.log('nbuf:', nbuf);
    console.log('nbuf.length:', nbuf.length);
    // https://dxr.mozilla.org/mozilla-central/source/toolkit/components/extensions/NativeMessaging.jsm#298
    let lenbuf = new Buffer(Uint32Array.of(nbuf.length).buffer);
    console.log('lenbuf:', lenbuf, 'length:', lenbuf.length);

    child.stdin.write(lenbuf);
    child.stdin.write(nbuf);
    // child.stdin.end(); // otherwise next message wont write, must do this on close of child

    setTimeout(function() {
        console.log('ok will send ping again');
        child.stdin.write(lenbuf);
        child.stdin.write(nbuf);
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
