const {app, Menu, Tray, BrowserWindow} = require('electron');
const path = require('path')
const url = require('url')

let win
function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

let appIcon = null
var platform = require('os').platform();
app.on('ready', () => {
if (platform == 'win32') {
    appIcon = new Tray('icon.ico');
}
else {
  appIcon = new Tray('icon.png');
}
  const contextMenu = Menu.buildFromTemplate([
    {label: 'Screenshots', type: 'radio'}
  ])

  // Make a change to the context menu
  contextMenu.items[0].checked = false

  // Call this again for Linux because we modified the context menu
  appIcon.setContextMenu(contextMenu);
})


const execFile = require('child_process').execFile;
const child = execFile('./nativeshot',(error, stdout, stderr) => {
  if (error) {
    throw error;
  }
  console.log(stdout);
});
