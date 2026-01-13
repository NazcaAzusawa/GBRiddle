/**
 * ------------------------------------------------------------------
 * PART 3: GAME LOGIC & UI RENDERER (MP3 MODE)
 * ------------------------------------------------------------------
 */

const CHAR_LIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";

// グローバル変数
let GAME_CONFIG = null;
let GAME_STATE = null;
let SCREEN_MODE = "title"; // "title" または "game"
let TITLE_STATE = {
  stages: [],
  cursorIndex: 0,
  isLoading: false,
};

// SHA-256ハッシュ化関数
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

// --- ゲームデータ初期化 ---
function initGameState(config) {
  GAME_CONFIG = config;
  GAME_STATE = {
    // 設定から謎データを生成
    riddles: GAME_CONFIG.RIDDLES.map((r) => ({
      ...r,
      img: new Image(),
      solved: false,
      inputBuffer: [0, 0, 0, 0, 0], // 謎ごとの入力保持
    })),
    currentRiddleIndex: 0,
    cursorPos: 0,
  };

  // 画像プリロード
  GAME_STATE.riddles.forEach((r) => {
    if (!r.isLocked) {
      r.img.src = r.imgSrc;
    }
  });
}

// --- メインループ & 描画処理 ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const C = {
  bg: "#9CA04C",
  dark: "#0f380f",
  light: "#8bac0f",
};

function resizeCanvas() {
  const container = canvas.parentElement;
  const internalWidth = 160;
  const ratio = container.clientHeight / container.clientWidth;
  const internalHeight = Math.floor(internalWidth * ratio);
  canvas.width = internalWidth;
  canvas.height = internalHeight;
  ctx.imageSmoothingEnabled = false;

  // グリッド調整
  const displayWidth = container.clientWidth;
  const scale = displayWidth / internalWidth;
  const overlay = document.querySelector(".grid-overlay");
  if (overlay) overlay.style.backgroundSize = `100% ${scale * 4}px`; // スキャンライン幅調整
}
window.addEventListener("resize", resizeCanvas);

// 南京錠アイコンを描画
function drawLockIcon(x, y, size) {
  ctx.strokeStyle = C.dark;
  ctx.fillStyle = C.dark;
  ctx.lineWidth = 2;

  // 本体（四角形）
  const bodyW = size * 0.6;
  const bodyH = size * 0.7;
  const bodyX = x - bodyW / 2;
  const bodyY = y - bodyH / 2 + size * 0.15;

  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  // 鍵穴
  ctx.fillStyle = C.bg;
  const holeSize = size * 0.15;
  ctx.fillRect(x - holeSize / 2, bodyY + bodyH * 0.3, holeSize, holeSize * 1.5);

  // アーチ（上部の半円）
  ctx.beginPath();
  ctx.arc(x, bodyY, bodyW * 0.3, Math.PI, 0, false);
  ctx.lineWidth = 3;
  ctx.stroke();
}

// タイトル画面を描画
function renderTitleScreen() {
  const w = canvas.width;
  const h = canvas.height;

  // 背景
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);

  // フォント設定
  ctx.font = '12px "Press Start 2P"';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // タイトル
  ctx.fillStyle = C.dark;
  ctx.font = '14px "Press Start 2P"';
  ctx.fillText("STAGESELECT", w / 2, 20);

  // ローディング表示
  if (TITLE_STATE.isLoading) {
    ctx.fillStyle = C.dark;
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText("LOADING...", w / 2, h / 2);
    return;
  }

  // ステージリスト
  const startY = 40;
  const lineHeight = 20;
  const maxVisible = Math.floor((h - startY - 20) / lineHeight);

  TITLE_STATE.stages.forEach((stage, index) => {
    const y = startY + index * lineHeight;
    
    // カーソル表示
    if (index === TITLE_STATE.cursorIndex) {
      ctx.fillStyle = C.dark;
      ctx.fillRect(5, y - 8, w - 10, lineHeight - 2);
      ctx.fillStyle = C.bg;
    } else {
      ctx.fillStyle = C.dark;
    }

    // ステージ名
    ctx.font = '8px "Press Start 2P"';
    const displayName = stage.name.length > 18 ? stage.name.substring(0, 15) + "..." : stage.name;
    ctx.fillText(displayName, w / 2, y);
  });
}

// ゲーム画面を描画
function renderGameScreen() {
  const w = canvas.width;
  const h = canvas.height;

  // 1. 全体をクリア
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);

  // フォント設定
  ctx.font = '16px "Press Start 2P"';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 設定が読み込まれていない場合は待機
  if (!GAME_CONFIG || !GAME_STATE) {
    ctx.fillStyle = C.dark;
    ctx.fillText("LOADING...", w / 2, h / 2);
    return;
  }

  // --- ローディング画面 ---
  if (AudioEngine.isLoading) {
    ctx.fillStyle = C.dark;
    ctx.fillText("LOADING...", w / 2, h / 2);
    return;
  }

  const riddle = GAME_STATE.riddles[GAME_STATE.currentRiddleIndex];

  // --- A. 画像エリア (上部固定 160x160) ---
  if (riddle.isLocked) {
    // ロック中の場合は南京錠アイコンを表示
    ctx.fillStyle = C.dark;
    ctx.fillRect(0, 0, 160, 160);
    drawLockIcon(80, 80, 60);
    // "LOCKED"テキスト
    ctx.font = '12px "Press Start 2P"';
    ctx.fillStyle = C.bg;
    ctx.fillText("LOCKED", 80, 140);
  } else {
    if (riddle.img.complete && riddle.img.src) {
      ctx.drawImage(riddle.img, 0, 0, 160, 160);
    } else {
      ctx.fillStyle = C.dark;
      ctx.fillRect(0, 0, 160, 160);
    }

    // 正解時の演出（半透明）
    if (riddle.solved) {
      ctx.fillStyle = "rgba(156, 160, 76, 0.6)";
      ctx.fillRect(0, 0, 160, 160);
    }
  }

  // --- レイアウト計算 ---
  const barH = 14;
  const barY = h - barH;
  const dialH = 28;
  const dialY = barY - dialH - 8;

  // --- B. 入力エリア ---
  const boxW = 24;
  const boxH = 26;
  const gap = 2;
  const adjustX = 1;
  const adjustY = 1; // 微調整

  const totalW = boxW * 5 + gap * 4;
  const dialXStart = Math.floor((w - totalW) / 2);

  for (let i = 0; i < 5; i++) {
    const x = dialXStart + i * (boxW + gap);
    const centerX = x + boxW / 2;
    const centerY = dialY + boxH / 2;

    // カーソル
    if (i === GAME_STATE.cursorPos) {
      ctx.fillStyle = C.dark;
      ctx.fillRect(x, dialY, boxW, boxH);
      ctx.fillStyle = C.bg;
    } else {
      ctx.fillStyle = C.dark;
    }

    // 文字
    if (riddle.isLocked) {
      // ロック中は文字を表示しない（または"?"を表示）
      ctx.font = '16px "Press Start 2P"';
      ctx.fillText("?", centerX + adjustX, centerY + adjustY);
    } else {
      const charIndex = riddle.inputBuffer[i];
      const char = CHAR_LIST[charIndex];
      ctx.fillText(
        char,
        Math.floor(centerX + adjustX),
        Math.floor(centerY + adjustY)
      );
    }
  }

  // --- C. フッター (シークバー & タイム) ---
  // モード0以外なら表示
  if (GAME_CONFIG.PLAY_MODE !== 0) {
    ctx.fillStyle = C.dark;
    ctx.fillRect(0, barY, w, barH);

    // タイム表示 (右寄せ)
    const timeStr = AudioEngine.getTimeStr();
    ctx.font = '8px "Press Start 2P"'; // ここだけ小さく
    ctx.textAlign = "right";
    ctx.fillStyle = C.bg;
    ctx.fillText(timeStr, w - 2, barY + barH / 2 + 1);

    // プログレスバー
    const progress = AudioEngine.getProgress(); // 0.0 ~ 1.0
    const barAreaW = w - 40; // タイム表示分を引く

    // バー枠
    ctx.fillStyle = C.bg;
    ctx.fillRect(4, barY + 5, barAreaW, 4);

    // バー中身 (進行)
    if (progress > 0) {
      ctx.fillStyle = C.dark;
      ctx.fillRect(5, barY + 6, Math.floor((barAreaW - 2) * progress), 2);
    }
  } else {
    // Mode 0: ただの黒帯
    ctx.fillStyle = C.dark;
    ctx.fillRect(0, barY, w, barH);
  }
}

// 描画ループ
function renderLoop() {
  if (SCREEN_MODE === "title") {
    renderTitleScreen();
  } else {
    renderGameScreen();
  }
  requestAnimationFrame(renderLoop);
}

// --- 入力ハンドリング ---

function handleInput(action) {
  if (SCREEN_MODE === "title") {
    handleTitleInput(action);
  } else {
    handleGameInput(action);
  }
}

function handleTitleInput(action) {
  switch (action) {
    case "UP":
      if (TITLE_STATE.stages.length === 0) return;
      TITLE_STATE.cursorIndex--;
      if (TITLE_STATE.cursorIndex < 0) {
        TITLE_STATE.cursorIndex = TITLE_STATE.stages.length - 1;
      }
      break;
    case "DOWN":
      if (TITLE_STATE.stages.length === 0) return;
      TITLE_STATE.cursorIndex++;
      if (TITLE_STATE.cursorIndex >= TITLE_STATE.stages.length) {
        TITLE_STATE.cursorIndex = 0;
      }
      break;
    case "A": // 選択
      if (TITLE_STATE.stages.length > 0 && !TITLE_STATE.isLoading) {
        const selectedStage = TITLE_STATE.stages[TITLE_STATE.cursorIndex];
        selectStage(selectedStage.path);
      }
      break;
    // Bボタンはタイトル画面では無効
  }
}

function handleGameInput(action) {
  if (!GAME_CONFIG || !GAME_STATE) return;

  const currentRiddle = GAME_STATE.riddles[GAME_STATE.currentRiddleIndex];

  // ロック中の謎の場合、Bボタン以外の操作を無効化
  if (currentRiddle.isLocked && action !== "B") {
    return;
  }

  switch (action) {
    case "UP":
      if (currentRiddle.isLocked) return;
      currentRiddle.inputBuffer[GAME_STATE.cursorPos]--;
      if (currentRiddle.inputBuffer[GAME_STATE.cursorPos] < 0) {
        currentRiddle.inputBuffer[GAME_STATE.cursorPos] =
          CHAR_LIST.length - 1;
      }
      break;
    case "DOWN":
      if (currentRiddle.isLocked) return;
      currentRiddle.inputBuffer[GAME_STATE.cursorPos]++;
      if (
        currentRiddle.inputBuffer[GAME_STATE.cursorPos] >=
        CHAR_LIST.length
      ) {
        currentRiddle.inputBuffer[GAME_STATE.cursorPos] = 0;
      }
      break;
    case "LEFT":
      if (currentRiddle.isLocked) return;
      GAME_STATE.cursorPos--;
      if (GAME_STATE.cursorPos < 0) GAME_STATE.cursorPos = 4;
      break;
    case "RIGHT":
      if (currentRiddle.isLocked) return;
      GAME_STATE.cursorPos++;
      if (GAME_STATE.cursorPos > 4) GAME_STATE.cursorPos = 0;
      break;

    case "A": // 送信
      if (currentRiddle.isLocked || currentRiddle.solved) return;
      checkAnswer(currentRiddle);
      break;

    case "B": // 次の謎へ
      GAME_STATE.currentRiddleIndex++;
      if (GAME_STATE.currentRiddleIndex >= GAME_STATE.riddles.length) {
        GAME_STATE.currentRiddleIndex = 0;
      }
      GAME_STATE.cursorPos = 0;
      break;
  }
}

async function checkAnswer(riddle) {
  const inputStr = riddle.inputBuffer
    .map((idx) => CHAR_LIST[idx])
    .join("");

  // 入力文字列をSHA-256でハッシュ化
  const inputHash = await sha256(inputStr);

  // ハッシュ値を比較
  if (inputHash === riddle.answerHash) {
    riddle.solved = true;

    // 正解したら音量更新 (Mode 2のみ)
    if (GAME_CONFIG.PLAY_MODE === 2) {
      const solvedCount = countSolved();
      AudioEngine.updateVolumes(solvedCount);
    }

    // ロック解除チェック
    checkUnlockConditions();
  }
}

function countSolved() {
  return GAME_STATE.riddles.filter((r) => r.solved).length;
}

// ロック解除条件をチェック
function checkUnlockConditions() {
  const solvedCount = countSolved();

  GAME_STATE.riddles.forEach((riddle) => {
    if (riddle.isLocked && riddle.unlockCondition !== undefined) {
      if (solvedCount >= riddle.unlockCondition) {
        riddle.isLocked = false;
        // 画像を読み込む
        riddle.img.src = riddle.imgSrc;
        console.log(`Riddle unlocked! (Solved: ${solvedCount})`);
      }
    }
  });
}

// --- イベントリスナー ---

const bindTouch = (id, action) => {
  const el = document.getElementById(id);
  if (!el) return;
  const isButton = el.classList.contains("btn");

  el.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleInput(action);
    if (!isButton) {
      el.style.backgroundColor = "rgba(0,0,0,0.1)";
    } else {
      el.classList.add("active");
    }
  });

  el.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (!isButton) {
      el.style.backgroundColor = "transparent";
    } else {
      el.classList.remove("active");
    }
  });

  el.addEventListener("mousedown", () => handleInput(action));
};

// イベントリスナーの登録
bindTouch("btn-up", "UP");
bindTouch("btn-down", "DOWN");
bindTouch("btn-left", "LEFT");
bindTouch("btn-right", "RIGHT");
bindTouch("btn-a", "A");
bindTouch("btn-b", "B");

document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp":
      handleInput("UP");
      break;
    case "ArrowDown":
      handleInput("DOWN");
      break;
    case "ArrowLeft":
      handleInput("LEFT");
      break;
    case "ArrowRight":
      handleInput("RIGHT");
      break;
    case "z":
    case "Enter":
      handleInput("A");
      break;
    case "x":
    case "Backspace":
      handleInput("B");
      break;
  }
});

// ダブルタップで全画面
let lastTap = 0;
document.body.addEventListener("touchend", (e) => {
  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTap;
  if (tapLength < 300 && tapLength > 0) {
    e.preventDefault();
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .catch((err) => console.log(err));
    }
  }
  lastTap = currentTime;
});

// --- タイトル画面のロジック ---

async function loadTitleScreen() {
  try {
    const response = await fetch("data/scenario_list.json");
    const listData = await response.json();
    TITLE_STATE.stages = listData.stages;
    TITLE_STATE.cursorIndex = 0;
  } catch (error) {
    console.error("Failed to load scenario_list.json:", error);
  }
}

async function selectStage(scenarioPath) {
  TITLE_STATE.isLoading = true;

  try {
    // オーディオエンジンの初期化と読み込み
    AudioEngine.init();
    const configResponse = await fetch(scenarioPath);
    const config = await configResponse.json();

    // オーディオ読み込み（PLAY_MODEが0でない場合）
    if (config.PLAY_MODE !== 0) {
      await AudioEngine.load(config);
    }

    // ゲーム状態の初期化
    initGameState(config);

    // 画面モードをゲームに切り替え
    SCREEN_MODE = "game";

    // オーディオ再生
    if (config.PLAY_MODE !== 0) {
      AudioEngine.play(config);
    }
  } catch (error) {
    console.error("Failed to load stage:", error);
    TITLE_STATE.isLoading = false;
  }
}

// 初期化: タイトル画面を読み込む
async function init() {
  await loadTitleScreen();
  resizeCanvas();
  requestAnimationFrame(renderLoop);
}

// ページ読み込み時に初期化
init();
