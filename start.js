const { spawn } = require('child_process');
const path = require('path');

const rootDir = __dirname;

console.log('\n========================================================');
console.log('  VELAVAN PROPERTIES ATTENDANCE & PAYROLL SYSTEM');
console.log('  Official Office Attendance, FaceLock & Payout App');
console.log('========================================================\n');
console.log('Starting services:');
console.log('  [1] Shared REST API Backend   -> http://localhost:5000');
console.log('  [2] Admin & FaceLock Kiosk    -> http://localhost:5173');
console.log('  [3] Employee Self-Service     -> http://localhost:5174');
console.log('\nOffice LAN Access (Wi-Fi / Network):');
console.log('  Employee Portal on Mobile:       http://192.168.1.28:5174');
console.log('  Admin & FaceLock Kiosk:         http://192.168.1.28:5173');
console.log('\nPress Ctrl+C anytime to stop all services.\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

function runProcess(name, command, args, cwd, colorCode) {
  const proc = spawn(command, args, {
    cwd,
    stdio: 'pipe',
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`\x1b[${colorCode}m[${name}]\x1b[0m ${line}`);
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.error(`\x1b[${colorCode}m[${name} ERR]\x1b[0m ${line}`);
      }
    });
  });

  proc.on('close', (code) => {
    console.log(`\x1b[${colorCode}m[${name}]\x1b[0m exited with code ${code}`);
  });

  return proc;
}

// 1. Server (port 5000) - green
const serverProc = runProcess('SERVER', 'node', ['server/index.js'], rootDir, '32');

// 2. Admin App (port 5173) - blue
const adminProc = runProcess('ADMIN-APP', npmCmd, ['run', 'dev'], path.join(rootDir, 'admin-app'), '34');

// 3. Employee FaceLock App (port 5174) - magenta
const employeeProc = runProcess('EMPLOYEE-APP', npmCmd, ['run', 'dev'], path.join(rootDir, 'employee-app'), '35');

// 4. Online Public Tunnels (Cloudflare) - Instant HTTPS public links for mobile phones & home access
const fs = require('fs');
let empTunnelProc = null;
let adminTunnelProc = null;
const cloudflaredPath = path.join(rootDir, 'cloudflared.exe');

let empUrl = '';
let adminUrl = '';

function printOnlineSummary() {
  if (empUrl && adminUrl) {
    const banner = `
========================================================================
  🌐 ONLINE PUBLIC LINKS (OPEN ANYWHERE ON MOBILE DATA / HOME / 4G / 5G)
========================================================================
  📱 EMPLOYEE SELF-SERVICE PORTAL:
     👉 ${empUrl}
     (Share this link with office staff on WhatsApp to view attendance & OT)

  💻 ADMIN & OWNER DASHBOARD:
     👉 ${adminUrl}
     (For management/HR to view live logs, payroll & office FaceLock)
========================================================================\n`;
    console.log(banner);
    fs.writeFileSync(path.join(rootDir, 'PUBLIC_URL.txt'), `EMPLOYEE PORTAL:\n${empUrl}\n\nADMIN & OWNER PORTAL:\n${adminUrl}\n`);
    fs.writeFileSync(path.join(rootDir, 'PUBLIC_URLS.json'), JSON.stringify({ employeeUrl: empUrl, adminUrl: adminUrl }, null, 2));
  }
}

if (fs.existsSync(cloudflaredPath)) {
  empTunnelProc = spawn(cloudflaredPath, ['tunnel', '--url', 'http://localhost:5174'], {
    cwd: rootDir,
    stdio: 'pipe'
  });

  empTunnelProc.stderr.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/);
    if (match && !empUrl) {
      empUrl = match[0];
      printOnlineSummary();
    }
  });

  adminTunnelProc = spawn(cloudflaredPath, ['tunnel', '--url', 'http://localhost:5173'], {
    cwd: rootDir,
    stdio: 'pipe'
  });

  adminTunnelProc.stderr.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/);
    if (match && !adminUrl) {
      adminUrl = match[0];
      printOnlineSummary();
    }
  });
}

// Graceful exit
const cleanup = () => {
  console.log('\nShutting down all Velavan Properties processes...');
  serverProc.kill();
  adminProc.kill();
  employeeProc.kill();
  if (empTunnelProc) empTunnelProc.kill();
  if (adminTunnelProc) adminTunnelProc.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
