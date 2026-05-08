'use strict';

const { buildPoseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WASM_PATH_DEV = path.join(__dirname, '..', 'circuit', 'login_with_challenge_js', 'login_with_challenge.wasm');
const ZKEY_PATH_DEV = path.join(__dirname, '..', 'keys', 'login_final.zkey');

const WASM_PATH_PROD = path.join(process.cwd(), 'login_with_challenge.wasm');
const ZKEY_PATH_PROD = path.join(process.cwd(), 'login_final.zkey');

const WASM_PATH = fs.existsSync(WASM_PATH_DEV) ? WASM_PATH_DEV : WASM_PATH_PROD;
const ZKEY_PATH = fs.existsSync(ZKEY_PATH_DEV) ? ZKEY_PATH_DEV : ZKEY_PATH_PROD;

function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function preparePasswordForZK(password) {
    // 1. Băm mật khẩu bằng thuật toán chuẩn (SHA-256)
    const hashHex = crypto.createHash('sha256').update(password).digest('hex');
    // 2. Trích xuất 62 ký tự hex (248 bit) để đảm bảo KHÔNG vượt quá giới hạn trường BN128 (~254 bit)
    const safeHex = hashHex.slice(0, 62);
    return BigInt('0x' + safeHex);
}

async function register() {
    console.log('\n--- ĐĂNG KÝ ---');
    const username = await prompt('Nhập username: ');
    const password = await prompt('Nhập password: ');

    if (!username || !password) {
        console.error('Username và password không được để trống.');
        return;
    }

    const poseidon = await buildPoseidon();
    const passwordBigInt = preparePasswordForZK(password);
    const hashBytes = poseidon([passwordBigInt]);
    const passwordHash = poseidon.F.toString(hashBytes);

    const data = { username, passwordHash };
    fs.writeFileSync('register_data.json', JSON.stringify(data, null, 2));
    console.log('\nĐã tạo file `register_data.json`. Hãy upload file này lên Web để đăng ký.');
}

async function login() {
    console.log('\n--- ĐĂNG NHẬP ---');
    if (!fs.existsSync(WASM_PATH) || !fs.existsSync(ZKEY_PATH)) {
        console.error('\n[LỖI] Không tìm thấy file ZK Artifacts!');
        console.error('Nếu bạn đang chạy file .exe, vui lòng đảm bảo 2 file sau nằm CÙNG THƯ MỤC với file .exe:');
        console.error(' - login_with_challenge.wasm');
        console.error(' - login_final.zkey');
        return;
    }

    const username = await prompt('Nhập username: ');
    const password = await prompt('Nhập password: ');
    const challenge = await prompt('Nhập Challenge Code (lấy từ Web): ');

    if (!username || !password || !challenge) {
        console.error('Thông tin không được để trống.');
        return;
    }

    const poseidon = await buildPoseidon();
    const passwordBigInt = preparePasswordForZK(password);
    const hashBytes = poseidon([passwordBigInt]);
    const expectedHash = poseidon.F.toString(hashBytes);

    console.log('\nĐang tạo ZK Proof... (có thể mất vài giây)');

    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            { password: passwordBigInt.toString(), expectedHash, challenge },
            WASM_PATH,
            ZKEY_PATH,
            null,
            null,
            { singleThread: true }
        );

        const data = { username, proof, publicSignals };
        fs.writeFileSync('login_proof.json', JSON.stringify(data, null, 2));
        console.log('\nĐã tạo file `login_proof.json`. Hãy upload file này lên Web để đăng nhập.');
    } catch (err) {
        console.error('\nTạo proof thất bại:', err.message);
        console.error('Nguyên nhân có thể do sai mật khẩu.');
    }
}

async function main() {
    console.log('1. Đăng ký (Tạo file hash)');
    console.log('2. Đăng nhập (Tạo file proof)');
    console.log('0. Thoát');
    while (true) {
        const choice = await prompt('Choose action (0-2): ');
        if (choice === '1') {
            await register();
        } else if (choice === '2') {
            await login();
        } else if (choice === '0') {
            console.log('Bye!');
            break;
        } else {
            console.log('Error!');
        }
    }

    // Dừng màn hình lại để người dùng đọc thông báo (tránh cửa sổ .exe tự đóng)
    await prompt('\nNhấn Enter để thoát...');
}

main().catch(err => console.error(err));
