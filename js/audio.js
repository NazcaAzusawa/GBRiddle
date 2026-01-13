/**
 * ------------------------------------------------------------------
 * PART 2: AUDIO ENGINE (MP3 LOADER) & CONFIG
 * ------------------------------------------------------------------
 */

// --- オーディオエンジン (Web Audio API) ---
const AudioEngine = {
  ctx: null,
  buffers: [], // 読み込んだ音声データ
  sources: [], // 再生中のソースノード
  gains: [], // 音量ノード
  isLoading: false,
  isPlaying: false,
  startTime: 0, // 再生開始時刻 (シークバー用)
  duration: 0, // 曲の長さ (シークバー用)

  init: function () {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  // ファイル読み込み (モードに応じて分岐)
  load: async function (gameConfig) {
    if (gameConfig.PLAY_MODE === 0) return; // Mode 0は読み込みなし

    this.init();
    this.isLoading = true;
    this.buffers = [];

    const fileList =
      gameConfig.PLAY_MODE === 1
        ? [gameConfig.FILES.BGM]
        : gameConfig.FILES.TRACKS;

    try {
      // 全ファイルを並列ダウンロード & デコード
      const promises = fileList.map(async (url) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await this.ctx.decodeAudioData(arrayBuffer);
      });

      this.buffers = await Promise.all(promises);

      // 曲の長さを取得 (最初のトラック基準)
      if (this.buffers.length > 0) {
        this.duration = this.buffers[0].duration;
      }

      console.log("Audio Loaded!");
    } catch (e) {
      console.error("Audio Load Failed:", e);
    } finally {
      this.isLoading = false;
    }
  },

  // 再生開始
  play: function (gameConfig) {
    if (gameConfig.PLAY_MODE === 0) return;
    if (!this.ctx || this.buffers.length === 0) return;
    if (this.isPlaying) return;

    this.resume(); // iOS対策

    // ソースの作成と接続
    const now = this.ctx.currentTime + 0.1; // 0.1秒後に一斉スタート
    this.startTime = now;

    this.sources = [];
    this.gains = [];

    this.buffers.forEach((buffer, index) => {
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();

      source.buffer = buffer;
      source.loop = true; // ループ有効化

      // Mode 2の場合、音量を制御
      if (gameConfig.PLAY_MODE === 2) {
        // 初期状態: トラック1のみON、他はミュート (後でupdateVolumesで制御)
        gain.gain.value = index === 0 ? 1.0 : 0.0;
      } else {
        gain.gain.value = 1.0;
      }

      source.connect(gain);
      gain.connect(this.ctx.destination);

      source.start(now); // 完全に同時に開始

      this.sources.push(source);
      this.gains.push(gain);
    });

    this.isPlaying = true;
  },

  // 音量更新 (Mode 2用: 正解数に応じてトラックを開放)
  updateVolumes: function (solvedCount) {
    // activeTracks: 0問正解でもドラム(Track1)は鳴る → 1問正解でTrack1+2...
    const activeTracks = Math.min(solvedCount + 1, 4);

    this.gains.forEach((gain, index) => {
      // フェードイン/アウト処理
      const targetVol = index < activeTracks ? 1.0 : 0.0;
      const now = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(targetVol, now + 0.5); // 0.5秒かけて変化
    });
  },

  // コンテキストの再開 (タッチイベント用)
  resume: function () {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  },

  // 現在の再生位置 (0.0 〜 1.0) を取得
  getProgress: function () {
    if (!this.isPlaying || !this.duration) return 0;
    const elapsed = this.ctx.currentTime - this.startTime;
    return (elapsed % this.duration) / this.duration;
  },

  // 現在のタイム表示用 (MM:SS)
  getTimeStr: function () {
    if (!this.isPlaying || !this.duration) return "0:00";
    const elapsed =
      (this.ctx.currentTime - this.startTime) % this.duration;
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  },
};
