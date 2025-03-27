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
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload, create, update },
};

const game = new Phaser.Game(config);
let player, monster;
let players = {}; // 複数プレイヤー管理
let cursors, socket, playerId;

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('monster', 'assets/monster.png');
}

function create() {
    socket = new WebSocket('wss://game-7scn.onrender.com'); // サーバーURLを指定
    // WebSocketイベント処理
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'welcome') {
            // プレイヤーのIDがサーバーから送られてきた場合
            playerId = data.id;
            player = this.physics.add.sprite(Phaser.Math.Between(100, 700), Phaser.Math.Between(100, 500), 'player');
            player.setCollideWorldBounds(true);
            players[playerId] = player;

        } else if (data.type === 'update') {
            // 他のプレイヤーの位置更新
            updatePlayers(this, data.players);

        } else if (data.type === 'monsterPosition') {
            // モンスターの位置更新
            if (!monster) {
                // モンスターがまだ作成されていない場合
                monster = this.physics.add.sprite(data.x, data.y, 'monster');
                monster.setCollideWorldBounds(true); // モンスターが画面外に出ないように
            } else {
                // 既にモンスターが作成されている場合
                monster.setPosition(data.x, data.y); // モンスターの位置を更新
            }
        }
    };

    // プレイヤーの動き用
    cursors = this.input.keyboard.createCursorKeys();

    // スマホでの操作用タッチイベント
    this.input.on('pointermove', (pointer) => {
        if (player) {
            const x = pointer.x;
            const y = pointer.y;
            player.setPosition(x, y);
            socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
        }
    });
}

let monsterMoveDirection = { x: 1, y: 0 }; // モンスターの初期方向（右方向）
let monsterSpeed = 2; // モンスターの速度
let changeDirectionCooldown = 1000; // 方向転換の間隔（ミリ秒）
let lastDirectionChangeTime = 0; // 方向転換した時間

function update() {
    if (!player) return;

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

    // モンスターの移動
    if (monster) {
        const currentTime = Date.now();
        const timeSinceLastChange = currentTime - lastDirectionChangeTime;

        // 一定時間ごとにモンスターの移動方向を変更
        if (timeSinceLastChange > changeDirectionCooldown) {
            // ランダムな方向に変更（±Xまたは±Yの方向）
            if (Math.random() < 0.5) {
                monsterMoveDirection.x = Math.random() < 0.5 ? -1 : 1; // X方向をランダム
                monsterMoveDirection.y = 0; // Y方向は変更しない
            } else {
                monsterMoveDirection.y = Math.random() < 0.5 ? -1 : 1; // Y方向をランダム
                monsterMoveDirection.x = 0; // X方向は変更しない
            }
            lastDirectionChangeTime = currentTime; // 方向変更時刻を更新
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



// 他のプレイヤーの位置更新
function updatePlayers(scene, playersData) {
    for (let id in playersData) {
        if (id !== playerId) {
            if (!players[id]) {
                players[id] = scene.physics.add.sprite(playersData[id].x, playersData[id].y, 'player');
            } else {
                players[id].setPosition(playersData[id].x, playersData[id].y);
            }
        }
    }

    // 消えたプレイヤーを削除
    for (let id in players) {
        if (!playersData[id]) {
            players[id].destroy();
            delete players[id];
        }
    }
}
