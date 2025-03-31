window.onload = function () {
    // すでにリダイレクトしたことがある場合、処理をスキップ
    if (localStorage.getItem('redirected') === 'true') {
        return;  // リダイレクト済みなら何もしない
    }

    const urlParams = new URLSearchParams(window.location.search);

    // userパラメータがなければ、ランダムな値を生成して追加
    if (!urlParams.has('user')) {
        const randomString = generateRandomString(20);  // ランダムな20桁の英数字を生成
        const currentUrl = new URL(window.location.href); // 現在のURLをURLオブジェクトで取得

        // userパラメータを追加
        currentUrl.searchParams.set('user', randomString);

        // 新しいURLにリダイレクト（履歴が残らないようにする）
        window.location.href = currentUrl.toString();

        // リダイレクト済みとしてローカルストレージにフラグを設定
        localStorage.setItem('redirected', 'true');
        return;  // ここで処理を終了させる
    }
};

// 20桁のランダムな英数字を生成する関数
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

//ここから
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
        mode: Phaser.Scale.FIT,  // ゲーム画面がウィンドウにフィットするように設定
        autoCenter: Phaser.Scale.CENTER_BOTH  // 画面を中央に配置
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }  // 重力を無効にし、デバッグモードをオフに
    },
    scene: { preload, create, update },  // シーンの処理（読み込み、作成、更新）
};

const game = new Phaser.Game(config);  // ゲームの初期化

let player, monster;  // プレイヤーとモンスターの変数
let players = {};  // 他のプレイヤーを管理するオブジェクト
let cursors, socket, playerId;  // プレイヤーの入力、WebSocket、プレイヤーID
let playerHP = 100, monsterHP = 100;  // プレイヤーとモンスターのHP
let attackEffectDuration = 500;  // 攻撃エフェクトの表示時間（ミリ秒）

// ゲームのリソースを事前に読み込む
function preload() {
    this.load.image('background', 'assets/background.png');  // 背景画像
    this.load.image('player', 'assets/player.png');  // プレイヤー画像
    this.load.image('monster', 'assets/monster.png');  // モンスター画像
    this.load.image('attack', 'assets/attack.png');  // 攻撃エフェクト画像
}

// ゲームの初期設定
function create() {
    // 背景画像の設定
    this.add.image(window.innerWidth / 2, window.innerHeight / 2, 'background').setOrigin(0.5, 0.5);

    socket = new WebSocket('wss://game-7scn.onrender.com');  // サーバーへのWebSocket接続

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);  // 受信したデータを解析

        if (data.type === 'welcome') {
            // サーバーからプレイヤーIDが送られてきた場合
            playerId = data.id;
            // プレイヤーの生成
            player = this.physics.add.sprite(Phaser.Math.Between(100, 700), Phaser.Math.Between(100, 500), 'player');
            player.setCollideWorldBounds(true);  // プレイヤーが画面外に出ないように設定
            player.setBounce(1);  // プレイヤーが壁に当たったときに反発するように設定
            players[playerId] = player;  // プレイヤーオブジェクトを保存

            // プレイヤーHPの表示
            let playerHPText = this.add.text(player.x, player.y + player.height / 2 + 20, `HP: ${playerHP}`, { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5, 0);
            // プレイヤーの位置が動くたびにHPテキストを更新
            this.physics.world.on('worldstep', () => {
                playerHPText.setPosition(player.x, player.y + player.height / 2 + 20);
            });

            // プレイヤー同士やプレイヤーとモンスターの衝突判定
            this.physics.add.collider(player, monster, handleCollision, null, this);
            for (let id in players) {
                if (id !== playerId) {
                    this.physics.add.collider(player, players[id], handleCollision, null, this);
                }
            }
        } else if (data.type === 'update') {
            // 他のプレイヤーの位置を更新
            updatePlayers(this, data.players);
        } else if (data.type === 'monsterPosition') {
            // モンスターの位置を更新
            if (!monster) {
                monster = this.physics.add.sprite(data.x, data.y, 'monster');
                monster.setCollideWorldBounds(true);
                monster.setBounce(1);  // モンスターの反発を有効に
                this.physics.add.collider(player, monster, handleCollision, null, this);
            } else {
                monster.setPosition(data.x, data.y);  // モンスターの位置を更新
            }

            // モンスターHPの表示
            let monsterHPText = this.add.text(monster.x, monster.y + monster.height / 2 + 20, `HP: ${monsterHP}`, { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5, 0);
            // モンスターの位置が動くたびにHPテキストを更新
            this.physics.world.on('worldstep', () => {
                monsterHPText.setPosition(monster.x, monster.y + monster.height / 2 + 20);
            });
        }
    };

    // プレイヤーの入力処理（キーボードによる移動）
    cursors = this.input.keyboard.createCursorKeys();

    // スマホ用のタッチイベントでプレイヤーを移動
    this.input.on('pointermove', (pointer) => {
        if (player) {
            const x = pointer.x;
            const y = pointer.y;
            player.setPosition(x, y);  // プレイヤーの位置をタッチ位置に設定
            socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));  // サーバーにプレイヤー位置を送信
        }
    });
}

// 衝突時のエフェクトを表示する処理
let lastCollisionTime = 0;
const collisionCooldown = 200;  // 衝突イベントの間隔（ミリ秒）
function handleCollision(player, other) {
    let currentTime = this.time.now;
    // 最後の衝突から200ミリ秒以上経過していたらエフェクトを表示
    if (currentTime - lastCollisionTime >= collisionCooldown) {
        // 衝突時の攻撃エフェクトを表示
        let attackEffect = this.physics.add.sprite(player.x, player.y, 'attack');
        attackEffect.setOrigin(0.5, 0.5);
        attackEffect.setAlpha(1);  // 最初は完全に見える

        // 0.5秒後にエフェクトを非表示に
        this.time.delayedCall(attackEffectDuration, () => {
            attackEffect.setAlpha(0);  // 透明に
            attackEffect.destroy();  // エフェクトを削除
        });

        // 衝突した場合、HPを減らす
        if (other === monster) {
            playerHP -= 10;  // プレイヤーHPを減らす
            monsterHP -= 1;  // モンスターHPを減らす

            // HP更新をサーバーに送信
            socket.send(JSON.stringify({
                type: 'hpUpdate',
                playerHP: playerHP,
                monsterHP: monsterHP
            }));
        }

        // サーバーからのHP更新を受け取る処理
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
        
            if (data.type === 'hpUpdate') {
                // サーバーから受け取ったプレイヤーとモンスターのHPを更新
                playerHP = data.playerHP;
                monsterHP = data.monsterHP;
        
                // プレイヤーHP表示の更新
                if (player) {
                    playerHPText.setText(`HP: ${playerHP}`);
                }
        
                // モンスターHP表示の更新
                if (monster) {
                    monsterHPText.setText(`HP: ${monsterHP}`);
                }
            }
        };

        // 攻撃エフェクトの情報をサーバーに送信
        socket.send(JSON.stringify({
            type: 'attackEffect',
            x: player.x,
            y: player.y
        }));

        // 最後の衝突時間を更新
        lastCollisionTime = currentTime;
    }
}

// モンスターのランダムな動きとサーバーへの送信
let monsterMoveDirection = { x: 1, y: 0 };
let monsterSpeed = 2;
let changeDirectionCooldown = 1000;
let lastDirectionChangeTime = 0;
function update() {
    if (!player) return;  // プレイヤーがいない場合は何も処理しない

    let speed = 3;
    let moved = false;
    let x = player.x, y = player.y;

    // プレイヤーの移動処理
    if (cursors.left.isDown) { x -= speed; player.setFlipX(true); moved = true; }
    if (cursors.right.isDown) { x += speed; player.setFlipX(false); moved = true; }
    if (cursors.up.isDown) { y -= speed; moved = true; }
    if (cursors.down.isDown) { y += speed; moved = true; }

    if (moved) {
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }

    // モンスターのランダム移動
    let currentTime = this.time.now;
    if (currentTime - lastDirectionChangeTime > changeDirectionCooldown) {
        // ランダムな方向にモンスターを動かす
        monster.setVelocity(monsterMoveDirection.x * monsterSpeed, monsterMoveDirection.y * monsterSpeed);
        // ランダムな方向に変更
        monsterMoveDirection = { x: Phaser.Math.Between(-1, 1), y: Phaser.Math.Between(-1, 1) };
        lastDirectionChangeTime = currentTime;
    }
}

