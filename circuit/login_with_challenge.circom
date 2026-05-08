pragma circom 2.0.0;
include "../node_modules/circomlib/circuits/poseidon.circom";

template Login() {
    // Private input (Bí mật)
    signal input password;
    
    // Public inputs (Công khai)
    signal input expectedHash; // Hash đã lưu trên server
    signal input challenge;    // Mã dùng 1 lần do server cấp

    // 1. Kiểm tra password hash
    component hasher = Poseidon(1);
    hasher.inputs[0] <== password;
    hasher.out === expectedHash;

    // 2. Gắn challenge vào mạch
    // Kỹ thuật Dummy Constraint (Ràng buộc giả) để bắt buộc 
    // compiler đưa challenge vào quá trình tạo proof.
    // Việc tính toán bình phương của challenge đảm bảo tín hiệu này tham gia vào hệ ràng buộc.
    signal challengeSquared;
    challengeSquared <== challenge * challenge;
}

// Bắt buộc cả expectedHash và challenge phải là public signals
component main {public [expectedHash, challenge]} = Login();
