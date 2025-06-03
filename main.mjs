import { app, BrowserWindow } from 'electron';
import path from 'path';
import { exec } from 'child_process';
import http from 'http';

function waitForServerReady(port, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check() {
      const req = http.request({ method: 'HEAD', host: 'localhost', port }, (res) => {
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(check, 250);
        }
      });
      req.end();
    }

    check();
  });
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: true }
  });
  win.loadURL('http://localhost:1226');
}

app.whenReady().then(() => {
  // 启动 Express 服务
  const server = exec('node dist/index.js', (err) => {
    if (err) console.error('Express 启动失败:', err);
  });

  // 等待服务器准备好后再打开窗口
  waitForServerReady(8080)
    .then(() => createWindow())
    .catch((err) => {
      console.error('Server 未能在规定时间内启动:', err);
    });
});