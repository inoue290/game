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
        mode: Phaser.Scale.FIT,  // ゲーム画面を画面に合わせてフィット
        autoCenter: Phaser.Scale.CENTER_BOTH  // 画面中央に配置
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }  // 重力なし、デバッグモード無効
    },
    scene: { preload, create, update },  // ゲームシーンの設定（読み込み、作成、更新）
};

const game = new Phaser.Game(config);  // ゲームの初期化
let player, monster;
let players = {};  // 他のプレイヤーを管理するオブジェクト
let cursors, socket, playerId;
let attackEffectDuration = 500;  // 攻撃エフェクトの表示時間（ミリ秒）
// 各キャラクターのHPを保持するオブジェクト
let playerHP = 100;
let monsterHP = 100;
let playerHPText, monsterHPText;  // プレイヤーとモンスターのHPテキスト

function preload() {
    this.load.image('background', 'assets/background.png');  // 背景画像の読み込み
    this.load.image('player', 'assets/player.png');  // プレイヤー画像の読み込み
    this.load.image('monster', 'assets/monster.png');  // モンスター画像の読み込み
    this.load.image('attack', 'assets/attack.png');  // 攻撃エフェクト画像の読み込み
}

function create() {
    // 背景画像の設定
    this.add.image(window.innerWidth / 2, window.innerHeight / 2, 'background').setOrigin(0.5, 0.5);  // 画面中央に配置

    socket = new WebSocket('wss://game-7scn.onrender.com');  // WebSocket接続の確立

    // WebSocketからのメッセージ処理
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'welcome') {
            // サーバーからプレイヤーIDが送られてきた場合
            playerId = data.id;
            player = this.physics.add.sprite(Phaser.Math.Between(100, 700), Phaser.Math.Between(100, 500), 'player');
            player.setCollideWorldBounds(true);  // 画面外に出ないように設定
            player.setBounce(1);  // 画面の端に当たったときの反発を有効にする
            players[playerId] = player;  // プレイヤーオブジェクトを保存

            // プレイヤーのHPテキストを表示（1度だけ）
            if (!playerHPText) {
                playerHPText = this.add.text(player.x, player.y + player.height / 2 + 20, `HP: ${playerHP}`, { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5, 0);
            }

            // プレイヤーの位置が動くたびにHPテキストの位置を更新
            this.physics.world.on('worldstep', () => {
                playerHPText.setPosition(player.x, player.y + player.height / 2 + 20);
            });

            // プレイヤー同士、プレイヤーとモンスターの衝突判定を設定
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
            // モンスターの位置更新
            if (!monster) {
                monster = this.physics.add.sprite(data.x, data.y, 'monster');
                monster.setCollideWorldBounds(true);  // モンスターが画面外に出ないように
                monster.setBounce(1);  // モンスターの反発を有効にする
                // プレイヤーとモンスターの衝突判定
                this.physics.add.collider(player, monster, handleCollision, null, this);
            } else {
                monster.setPosition(data.x, data.y);  // モンスターの位置を更新
            }

            // モンスターのHP表示（1度だけ）
            if (!monsterHPText) {
                monsterHPText = this.add.text(monster.x, monster.y + monster.height / 2 + 20, `HP: ${monsterHP}`, { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5, 0);
            }

            // モンスターの位置が動くたびにHPテキストの位置を更新
            this.physics.world.on('worldstep', () => {
                monsterHPText.setPosition(monster.x, monster.y + monster.height / 2 + 20);
            });

        }
    }

    // プレイヤーの入力（移動）処理
    cursors = this.input.keyboard.createCursorKeys();

    // スマホ操作用タッチイベント（プレイヤー移動）
    this.input.on('pointermove', (pointer) => {
        if (player) {
            const x = pointer.x;
            const y = pointer.y;
            player.setPosition(x, y);  // プレイヤーの位置をタッチ位置に設定
            socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));  // プレイヤーの位置をサーバーに送信
        }
    });
}

// 衝突時のエフェクトを処理する関数
let lastCollisionTime = 0;  // 最後の衝突イベントが発生した時間
const collisionCooldown = 200;  // 衝突イベントの間隔（ミリ秒）

function handleCollision(player, other) {
    let currentTime = this.time.now;
    // 最後の衝突から200ミリ秒以上経過していたらエフェクトを表示
    if (currentTime - lastCollisionTime >= collisionCooldown) {
        // 衝突した場合、攻撃エフェクトを表示
        let attackEffect = this.physics.add.sprite(player.x, player.y, 'attack');
        attackEffect.setOrigin(0.5, 0.5);  // エフェクトの中心をプレイヤーの位置に合わせる
        attackEffect.setAlpha(1);  // エフェクトを最初は完全に見えるように

        // 0.5秒後にエフェクトを非表示にし、削除
        this.time.delayedCall(attackEffectDuration, () => {
            attackEffect.setAlpha(0);  // 透明にする
            attackEffect.destroy();  // エフェクトを削除
        });

        // サーバーに攻撃エフェクトの情報を送信
        socket.send(JSON.stringify({
            type: 'attackEffect',
            x: player.x,
            y: player.y
        }));

        // 最後の衝突時間を記録
        lastCollisionTime = currentTime;
    }
}

// モンスターのランダムな動きとサーバーへの送信
let monsterMoveDirection = { x: 1, y: 0 };  // モンスターの初期方向
let monsterSpeed = 2;  // モンスターの移動速度
let changeDirectionCooldown = 1000;  // 方向転換の間隔（ミリ秒）
let lastDirectionChangeTime = 0;  // 最後に方向転換した時間
function update() {
    // プレイヤー移動処理
    if (cursors.left.isDown) {
        player.setVelocityX(-160);  // 左移動
    } else if (cursors.right.isDown) {
        player.setVelocityX(160);  // 右移動
    } else {
        player.setVelocityX(0);  // 移動しない
    }

    if (cursors.up.isDown) {
        player.setVelocityY(-160);  // 上移動
    } else if (cursors.down.isDown) {
        player.setVelocityY(160);  // 下移動
    } else {
        player.setVelocityY(0);  // 移動しない
    }

    // モンスターのランダム移動処理
    let currentTime = this.time.now;
    if (currentTime - lastDirectionChangeTime > changeDirectionCooldown) {
        monsterMoveDirection.x = Phaser.Math.Between(-1, 1);  // x方向のランダムな動き
        monsterMoveDirection.y = Phaser.Math.Between(-1, 1);  // y方向のランダムな動き
        lastDirectionChangeTime = currentTime;
    }
    if (monster) {
        monster.setVelocity(monsterMoveDirection.x * monsterSpeed, monsterMoveDirection.y * monsterSpeed);
        // モンスターの位置情報をサーバーに送信
        socket.send(JSON.stringify({
            type: 'monsterPosition',
            x: monster.x,
            y: monster.y
        }));
    }
}


// 他のプレイヤーの位置を更新する関数
function updatePlayers(scene, playersData) {
    // 新しいプレイヤーを追加
    for (let id in playersData) {
        if (id !== playerId) {
            if (!players[id]) {
                players[id] = scene.physics.add.sprite(playersData[id].x, playersData[id].y, 'player');
                // プレイヤーとモンスターの衝突判定を設定
                scene.physics.add.collider(players[id], monster, handleCollision, null, scene);
            } else {
                players[id].setPosition(playersData[id].x, playersData[id].y);
            }
        }
    }

    // 既存のプレイヤーが削除されている場合は削除
    for (let id in players) {
        if (!playersData[id]) {
            players[id].destroy();
            delete players[id];
        }
    }
}
