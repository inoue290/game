const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,  // スマホの画面幅に合わせる
    height: window.innerHeight,  // スマホの画面高さに合わせる
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload, create, update },
};

const game = new Phaser.Game(config);
let player, otherPlayers = {};
let cursors, socket, playerId;

function preload() {
    this.load.image('player', 'assets/player.png');
}

function create() {
    socket = new WebSocket('wss://game-7scn.onrender.com:4000');
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'welcome') {
            playerId = data.id;
            player = this.physics.add.sprite(400, 300, 'player');
            player.setCollideWorldBounds(true);
        } else if (data.type === 'update') {
            updateOtherPlayers(this, data.players);
        }
    };

    // キーボード入力の設定（PC用）
    cursors = this.input.keyboard.createCursorKeys();

    // スマホのタッチ操作
    this.input.on('pointerdown', (pointer) => {
        handleTouchMove(pointer);
    });

    this.input.on('pointermove', (pointer) => {
        handleTouchMove(pointer);
    });
}

function update() {
    if (!player) return;

    let moved = false;
    let x = player.x, y = player.y;
    let speed = 2;

    // PC用の矢印キーによる移動
    if (cursors.left.isDown) { x -= speed; moved = true; }
    if (cursors.right.isDown) { x += speed; moved = true; }
    if (cursors.up.isDown) { y -= speed; moved = true; }
    if (cursors.down.isDown) { y += speed; moved = true; }

    // 移動した場合、位置を更新してサーバに送信
    if (moved) {
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }
}

// 他のプレイヤーを更新
function updateOtherPlayers(scene, playersData) {
    Object.keys(playersData).forEach(id => {
        if (id !== playerId) {
            if (!otherPlayers[id]) {
                otherPlayers[id] = scene.physics.add.sprite(playersData[id].x, playersData[id].y, 'player');
            } else {
                otherPlayers[id].setPosition(playersData[id].x, playersData[id].y);
            }
        }
    });

    // 他のプレイヤーが切断された場合
    Object.keys(otherPlayers).forEach(id => {
        if (!playersData[id]) {
            otherPlayers[id].destroy();
            delete otherPlayers[id];
        }
    });
}

// タッチ操作でプレイヤーを移動
function handleTouchMove(pointer) {
    if (pointer.isDown) {
        const x = pointer.x;
        const y = pointer.y;

        // プレイヤーをタッチした位置に移動
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }
}






