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
let playerHP = 100;  // プレイヤーのHP
let monsterHP = 100; // モンスターのHP
let playerHPLabel, monsterHPLabel;  // HPラベルを格納する変数

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

            // プレイヤー同士、プレイヤーとモンスターの衝突判定を設定
            this.physics.add.collider(player, monster, handleCollision, null, this);
            for (let id in players) {
                if (id !== playerId) {
                    this.physics.add.collider(player, players[id], handleCollision, null, this);
                }
            }

            // プレイヤーのHPラベルを表示
            playerHPLabel = this.add.text(player.x, player.y - player.height / 2 - 20, `HP: ${playerHP}`, {
                font: '16px Arial',
                fill: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);

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

            // モンスターのHPラベルを表示
            if (!monsterHPLabel) {
                monsterHPLabel = this.add.text(monster.x, monster.y - monster.height / 2 - 20, `HP: ${monsterHP}`, {
                    font: '16px Arial',
                    fill: '#ffffff',
                    align: 'center'
                }).setOrigin(0.5);
        }
    }};

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
function handleCollision(player, other) {
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

    // モンスターと接触した場合HPを減少
    if (other === monster) {
        monsterHP -= 1;  // モンスターのHPを減少
         playerHP -= 10;  // プレイヤーのHPを減少
    }

    // プレイヤーHPが0になった場合、ログアウト
    if (playerHP <= 0) {
        handlePlayerLogout(player);  // プレイヤーをログアウト
    }

     // モンスターHPが0になった場合、キャラクターを消去
    if (monsterHP <= 0) {
        handleMonsterDeath(monster);  // モンスターを消去
    }
}

// プレイヤーがHP0になった場合のログアウト処理
function handlePlayerLogout(player) {
    console.log("プレイヤーがHP0でログアウトします");
    // ログアウト処理をここに追加
    // 例: プレイヤーをゲームから削除するなど
    player.setAlpha(0);  // プレイヤーを非表示にする
    playerHPLabel.setAlpha(0);  // プレイヤーのHPラベルを非表示にする
    window.location.href = 'https://inoue290.github.io/game/index.html';  // ここにリダイレクトしたいURLを指定
}

// モンスターがHP0になった場合の消去処理
function handleMonsterDeath(monster) {
    console.log("モンスターがHP0で消えます");
    // モンスターとラベルを非表示にする
    monster.setAlpha(0);  // モンスターを非表示にする
    monster.setActive(false);  // モンスターを非アクティブにする
    monster.setVisible(false);  // モンスターを見えなくする
    // モンスターのHPラベルを非表示にする
    monsterHPLabel.setAlpha(0);  // モンスターのHPラベルを非表示にする
    // ここでモンスターの再生成を行う
    regenerateMonster(monster);
}

// モンスターの再生成処理
function regenerateMonster(monster) {
    console.log("モンスターが再生成されます");

    // モンスターの位置をランダムに設定（もしくは任意の位置を指定）
    let newX = Phaser.Math.Between(100, 800);  // 例: 画面内のランダムな位置
    let newY = Phaser.Math.Between(100, 600);

    // 新しいモンスターを生成
    let newMonster = this.physics.add.sprite(newX, newY, 'monster');  // 'monster'はモンスターのスプライトの名前です

    // 必要なモンスター設定
    newMonster.setAlpha(1);  // モンスターを表示する
    newMonster.setActive(true);  // モンスターをアクティブにする
    newMonster.setVisible(true); // モンスターを可視化

    // モンスターのHPラベルも再生成
    let monsterHPLabel = this.add.text(newX, newY - 20, 'HP: 100', {
        fontSize: '16px',
        fill: '#ff0000'
    });
    
    // 必要なモンスターのプロパティを設定（例えばHPなど）
    monsterHP = 100;  // 新しいモンスターのHPを設定

    // モンスター再生成後に必要な追加処理
    // 例えば、再生成されたモンスターを追跡するためのリストに追加
    monster = newMonster;  // ここで、再生成されたモンスターを現在のモンスターとして設定
}


// モンスターのランダムな動きとサーバーへの送信
let monsterMoveDirection = { x: 1, y: 0 };  // モンスターの初期方向
let monsterSpeed = 2;  // モンスターの移動速度
let changeDirectionCooldown = 1000;  // 方向転換の間隔（ミリ秒）
let lastDirectionChangeTime = 0;  // 最後に方向転換した時間

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

    // プレイヤーが移動した場合、位置を更新しサーバーに送信
    if (moved) {
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }

    // プレイヤーのHPラベルをプレイヤーの位置に合わせて更新
    if (playerHPLabel) {
        playerHPLabel.setPosition(player.x, player.y - player.height / 2 - 20);
        playerHPLabel.setText(`HP: ${playerHP}`);
    }

    // モンスターのHPラベルをモンスターの位置に合わせて更新
    if (monster && monsterHPLabel) {
        monsterHPLabel.setPosition(monster.x, monster.y - monster.height / 2 - 20);
        monsterHPLabel.setText(`HP: ${monsterHP}`);
    }

    // モンスターの移動
    if (monster) {
        const currentTime = Date.now();
        const timeSinceLastChange = currentTime - lastDirectionChangeTime;

        // 一定時間ごとにモンスターの移動方向を変更
        if (timeSinceLastChange > changeDirectionCooldown) {
            if (Math.random() < 0.5) {
                monsterMoveDirection.x = Math.random() < 0.5 ? -1 : 1;  // X方向をランダム
                monsterMoveDirection.y = 0;  // Y方向は変更しない
            } else {
                monsterMoveDirection.y = Math.random() < 0.5 ? -1 : 1;  // Y方向をランダム
                monsterMoveDirection.x = 0;  // X方向は変更しない
            }
            lastDirectionChangeTime = currentTime;  // 最後に方向を変更した時間を更新
        }

        // モンスターを移動
        monster.x += monsterMoveDirection.x * monsterSpeed;
        monster.y += monsterMoveDirection.y * monsterSpeed;

        // 画面外に出ないようにモンスターの位置を制限
        monster.x = Phaser.Math.Clamp(monster.x, 0, window.innerWidth);
        monster.y = Phaser.Math.Clamp(monster.y, 0, window.innerHeight);

        // モンスターの位置をサーバーに送信
        socket.send(JSON.stringify({
            type: 'moveMonster',
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

