#!/bin/bash
# scripts/setup.sh
# ==================
# ZK-Login Demo: Complete setup script
#
# Steps:
#  1. Compile the Circom circuit -> login.r1cs + login_js/login.wasm
#  2. Powers of Tau ceremony (Phase 1 of Groth16 trusted setup)
#  3. Groth16 Phase 2 (circuit-specific trusted setup)
#  4. Export the verification key (public; server uses this to verify proofs)

set -euo pipefail

# ---------------------------------------------------------------------------
# Locate binaries
# ---------------------------------------------------------------------------
export PATH="$HOME/.cargo/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CIRCUIT_DIR="$ROOT_DIR/circuit"
KEYS_DIR="$ROOT_DIR/keys"
PROOFS_DIR="$ROOT_DIR/proofs"

# Linux circom (installed via cargo)
CIRCOM="$HOME/.cargo/bin/circom"

# Linux node.js (installed via nvm) - used for snarkjs CLI
NODE_EXE=""
for v in "$HOME/.nvm/versions/node/"*/bin/node; do
    if [ -f "$v" ]; then
        NODE_EXE="$v"
    fi
done
# Final fallback to Windows node.exe if no nvm node found
if [ -z "$NODE_EXE" ]; then
    NODE_EXE="/mnt/c/Program Files/nodejs/node.exe"
fi

# snarkjs CLI (JS file, run via node)
SNARKJS_CLI="$ROOT_DIR/node_modules/snarkjs/cli.js"

# Circuit file paths
CIRCUIT_FILE="$CIRCUIT_DIR/login_with_challenge.circom"
R1CS_FILE="$CIRCUIT_DIR/login_with_challenge.r1cs"
WASM_FILE="$CIRCUIT_DIR/login_with_challenge_js/login_with_challenge.wasm"

# Key file paths
POT_0="$KEYS_DIR/pot12_0000.ptau"
POT_1="$KEYS_DIR/pot12_0001.ptau"
POT_FINAL="$KEYS_DIR/pot12_final.ptau"
ZKEY_0="$KEYS_DIR/login_0000.zkey"
ZKEY_FINAL="$KEYS_DIR/login_final.zkey"
VKEY="$KEYS_DIR/verification_key.json"

# ---------------------------------------------------------------------------
# Helper: run snarkjs command
# ---------------------------------------------------------------------------
snarkjs() {
    echo "[SETUP] \$ snarkjs $*"
    "$NODE_EXE" "$SNARKJS_CLI" "$@"
    echo ""
}

banner() {
    echo ""
    echo "------------------------------------------------------------"
    echo "  $1"
    echo "------------------------------------------------------------"
}

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
banner "Preflight checks"

if [ ! -f "$CIRCOM" ]; then
    echo "[SETUP] ERROR: circom not found at $CIRCOM"
    echo "[SETUP] Install with: cargo install --git https://github.com/iden3/circom.git circom"
    exit 1
fi
echo "[SETUP] circom      : $("$CIRCOM" --version)"

if [ ! -f "$NODE_EXE" ]; then
    echo "[SETUP] ERROR: node.exe not found at $NODE_EXE"
    echo "[SETUP] Install Node.js for Windows from https://nodejs.org"
    exit 1
fi
echo "[SETUP] node.exe    : $("$NODE_EXE" --version)"

if [ ! -f "$SNARKJS_CLI" ]; then
    echo "[SETUP] ERROR: snarkjs not found. Run: npm install"
    exit 1
fi
echo "[SETUP] snarkjs CLI : OK ($SNARKJS_CLI)"

if [ ! -f "$CIRCUIT_FILE" ]; then
    echo "[SETUP] ERROR: circuit file not found: $CIRCUIT_FILE"
    exit 1
fi
echo "[SETUP] circuit     : OK ($CIRCUIT_FILE)"

mkdir -p "$KEYS_DIR" "$PROOFS_DIR"
echo "[SETUP] Directories : OK"

# ---------------------------------------------------------------------------
# Step 1: Compile the Circom circuit
# ---------------------------------------------------------------------------
banner "Step 1: Compile Circom circuit"
echo "[SETUP] Input  : $CIRCUIT_FILE"
echo "[SETUP] Outputs: login.r1cs, login_js/login.wasm, login.sym"
echo ""

"$CIRCOM" "$CIRCUIT_FILE" --r1cs --wasm --sym -o "$CIRCUIT_DIR" -l "$ROOT_DIR/node_modules"

if [ ! -f "$R1CS_FILE" ]; then
    echo "[SETUP] ERROR: R1CS not produced"
    exit 1
fi
if [ ! -f "$WASM_FILE" ]; then
    echo "[SETUP] ERROR: WASM not produced"
    exit 1
fi
echo "[SETUP] Circuit compiled successfully!"
echo "[SETUP]   R1CS : $R1CS_FILE"
echo "[SETUP]   WASM : $WASM_FILE"

# Show circuit info
echo "[SETUP] Circuit statistics:"
snarkjs r1cs info "$R1CS_FILE" || true

# ---------------------------------------------------------------------------
# Step 2: Powers of Tau ceremony (Phase 1)
# ---------------------------------------------------------------------------
banner "Step 2: Powers of Tau ceremony (Phase 1)"
echo "[SETUP] BN128 curve, power=12 (supports up to 4096 constraints)"
echo "[SETUP] Our circuit has ~200 constraints - well within limits."
echo ""

snarkjs powersoftau new bn128 12 "$POT_0" -v
echo "[SETUP] Initial ptau: $POT_0"

# Random entropy contribution (fine for a local demo)
ENTROPY1="zk-login-demo-entropy-$(date +%s)"
snarkjs powersoftau contribute "$POT_0" "$POT_1" --name="Demo" -v -e="$ENTROPY1"
echo "[SETUP] Contributed entropy. ptau: $POT_1"

# Prepare for Phase 2 (computes Lagrange basis)
snarkjs powersoftau prepare phase2 "$POT_1" "$POT_FINAL" -v
echo "[SETUP] Phase 1 complete: $POT_FINAL"

# ---------------------------------------------------------------------------
# Step 3: Groth16 trusted setup (Phase 2)
# ---------------------------------------------------------------------------
banner "Step 3: Groth16 trusted setup (Phase 2)"
echo "[SETUP] Combining R1CS + ptau to produce proving/verifying key pair."
echo ""

snarkjs groth16 setup "$R1CS_FILE" "$POT_FINAL" "$ZKEY_0"
echo "[SETUP] Initial zkey: $ZKEY_0"

ENTROPY2="phase2-entropy-$(date +%s)"
snarkjs zkey contribute "$ZKEY_0" "$ZKEY_FINAL" --name="Demo" -v -e="$ENTROPY2"
echo "[SETUP] Final zkey: $ZKEY_FINAL"

# Verify the zkey (optional sanity check)
snarkjs zkey verify "$R1CS_FILE" "$POT_FINAL" "$ZKEY_FINAL" || true

# ---------------------------------------------------------------------------
# Step 4: Export verification key
# ---------------------------------------------------------------------------
banner "Step 4: Export verification key"
echo "[SETUP] The vKey is public. The server loads it to verify proofs."
echo ""

snarkjs zkey export verificationkey "$ZKEY_FINAL" "$VKEY"
echo "[SETUP] Verification key: $VKEY"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  Setup Complete!"
echo "============================================================"
echo ""
echo "[SETUP] Artifacts:"
for f in "$R1CS_FILE" "$WASM_FILE" "$POT_FINAL" "$ZKEY_FINAL" "$VKEY"; do
    if [ -f "$f" ]; then
        size=$(du -k "$f" | cut -f1)
        rel="${f#$ROOT_DIR/}"
        printf "[SETUP]   OK   %-45s (%s KB)\n" "$rel" "$size"
    else
        echo "[SETUP]   MISSING: $f"
    fi
done
echo ""
echo "[SETUP] Next steps:"
echo "[SETUP]   Terminal 1: node server/index.js"
echo "[SETUP]   Terminal 2: node client/cli.js"
echo "============================================================"
