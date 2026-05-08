'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const snarkjs = require('snarkjs');
const multer  = require('multer');
const cors    = require('cors');
const crypto  = require('crypto');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up multer for file uploads (in-memory parsing)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// In-memory databases
const users = {}; // { [username]: { passwordHash: string } }
const activeChallenges = new Set(); // Store valid challenge codes

// Load Verification Key
const vKeyPath = path.join(__dirname, '..', 'keys', 'verification_key.json');
let vKey;
try {
    vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf8'));
    console.log('[SERVER] Verification key loaded from:', vKeyPath);
} catch (err) {
    console.error('[SERVER] ERROR: Could not load verification key.');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// GET /challenge
// Sinh mã ngẫu nhiên dùng 1 lần (Nonce) chống Replay Attack
// ---------------------------------------------------------------------------
app.get('/challenge', (req, res) => {
    // Generate a random numeric string as challenge (for easy circom processing)
    // A 16 digit number is safe and fits easily into BigInt / snarkjs
    const challengeCode = Math.floor(Math.random() * 1e16).toString();
    activeChallenges.add(challengeCode);
    
    console.log(`[SERVER] Generated new challenge: ${challengeCode}`);
    res.json({ challenge: challengeCode });
});

// ---------------------------------------------------------------------------
// POST /register
// Nhận file upload `register_data.json` chứa {username, passwordHash}
// ---------------------------------------------------------------------------
app.post('/register', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Vui lòng upload file.' });
        }

        const data = JSON.parse(req.file.buffer.toString());
        const { username, passwordHash } = data;

        console.log('\n[SERVER] --- REGISTER REQUEST (FILE) ---');
        console.log('[SERVER] Username     :', username);
        console.log('[SERVER] Password hash:', passwordHash);

        if (!username || !passwordHash) {
            return res.status(400).json({ error: 'File json không đúng định dạng.' });
        }

        if (users[username]) {
            return res.status(409).json({ error: 'Tài khoản đã tồn tại.' });
        }

        users[username] = { passwordHash };
        console.log('[SERVER] User registered successfully.');

        return res.json({ success: true, message: `Đăng ký thành công tài khoản ${username}` });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Lỗi xử lý file.' });
    }
});

// ---------------------------------------------------------------------------
// POST /login
// Nhận file upload `login_proof.json` chứa {username, proof, publicSignals}
// ---------------------------------------------------------------------------
app.post('/login', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Vui lòng upload file proof.' });
        }

        const data = JSON.parse(req.file.buffer.toString());
        const { username, proof, publicSignals } = data;

        console.log('\n[SERVER] --- LOGIN REQUEST (FILE) ---');
        console.log('[SERVER] Username:', username);

        if (!username || !proof || !publicSignals || publicSignals.length < 2) {
            return res.status(400).json({ error: 'File proof không đúng định dạng.' });
        }

        const user = users[username];
        if (!user) {
            return res.status(401).json({ error: 'Tài khoản không tồn tại.' });
        }

        // Kiểm tra các public signals:
        // publicSignals[0] = expectedHash
        // publicSignals[1] = challenge
        const claimedHash = publicSignals[0];
        const claimedChallenge = publicSignals[1];

        // 1. Kiểm tra Hash
        if (claimedHash !== user.passwordHash) {
            console.log('[SERVER] Hash mismatch!');
            return res.status(401).json({ error: 'Thông tin xác thực không đúng.' });
        }

        // 2. Kiểm tra Challenge
        if (!activeChallenges.has(claimedChallenge)) {
            console.log(`[SERVER] Invalid or expired challenge: ${claimedChallenge}`);
            return res.status(401).json({ error: 'Challenge không hợp lệ hoặc đã hết hạn (Replay Attack?)' });
        }

        // 3. Verify ZK Proof
        console.log('[SERVER] Verifying ZK proof...');
        let isValid;
        try {
            isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        } catch (err) {
            console.error('[SERVER] Verification error:', err.message);
            return res.status(500).json({ error: 'Lỗi hệ thống khi xác minh bằng chứng.' });
        }

        if (isValid) {
            console.log('[SERVER] Proof is VALID.');
            // Hủy challenge sau khi sử dụng thành công (chống Replay)
            activeChallenges.delete(claimedChallenge);

            return res.json({ success: true, message: `Đăng nhập thành công: ${username}` });
        } else {
            console.log('[SERVER] Proof is INVALID.');
            return res.status(401).json({ error: 'Bằng chứng ZK không hợp lệ. Từ chối truy cập.' });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Lỗi xử lý file proof.' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('  ZK-Login Demo Server (With Challenge)');
    console.log('='.repeat(60));
    console.log(`[SERVER] URL: http://localhost:${PORT}`);
    console.log('='.repeat(60));
});
