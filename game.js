const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
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
                monster = this.physics.add.sprite(data.x, data.y, 'monster');
                monster.setCollideWorldBounds(true); // モンスターが画面外に出ないように
            } else {
                monster.setPosition(data.x, data.y);
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

function update() {
    if (!player) return;

    let speed = 3;
    let moved = false;
    let x = player.x, y = player.y;

    // プレイヤーの移動処理
    if (cursors.left.isDown) { x -= speed; moved = true; }
    if (cursors.right.isDown) { x += speed; moved = true; }
    if (cursors.up.isDown) { y -= speed; moved = true; }
    if (cursors.down.isDown) { y += speed; moved = true; }

    if (moved) {
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
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
