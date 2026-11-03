// Node.js 기본 내장 모듈만으로 구성된 로컬 개발용 서버
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local 파일에서 환경변수 로드
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...values] = trimmed.split('=');
            if (key) {
                process.env[key.trim()] = values.join('=').trim();
            }
        }
    });
}

// api/dust.js 핸들러 동적 import
let dustHandler;
try {
    const dustModule = await import('./api/dust.js');
    dustHandler = dustModule.default;
} catch (e) {
    console.error('api/dust.js 로드 실패:', e);
}

// MIME 타입 매핑
const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
    const pathname = parsedUrl.pathname;

    // Vercel Serverless Function 라우팅: /api/dust
    if (pathname === '/api/dust') {
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        const mockReq = { query, method: req.method, headers: req.headers };
        const mockRes = {
            statusCode: 200,
            headers: {},
            setHeader(name, value) {
                this.headers[name] = value;
            },
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                res.writeHead(this.statusCode, {
                    'Content-Type': 'application/json; charset=UTF-8',
                    ...this.headers
                });
                res.end(JSON.stringify(data));
            }
        };

        if (dustHandler) {
            try {
                await dustHandler(mockReq, mockRes);
            } catch (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ error: 'dustHandler가 로드되지 않았습니다.' }));
        }
        return;
    }

    // 정적 파일 서빙 (루트 접속 시 index.html)
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
                res.end(`서버 에러: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`대기오염 웹앱 로컬 서버가 시작되었습니다!`);
    console.log(`브라우저에서 접속: http://localhost:${PORT}`);
    console.log(`===============================================`);
});

