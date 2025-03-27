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
let player, monster, otherPlayers = {};
let cursors, socket, playerId;
let monsterSpeed = 100; // モンスターの移動速度

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('monster', 'assets/monster.png'); // モンスター画像をロード
}

function create() {
    socket = new WebSocket('wss://game-7scn.onrender.com');

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'welcome') {
            playerId = data.id;
            player = this.physics.add.sprite(400, 300, 'player');
            player.setCollideWorldBounds(true);

            // モンスターをランダムな位置に配置
            let randomX = Phaser.Math.Between(100, window.innerWidth - 100);
            let randomY = Phaser.Math.Between(100, window.innerHeight - 100);
            monster = this.physics.add.sprite(randomX, randomY, 'monster');
            monster.setCollideWorldBounds(true); // 画面の端で止まる
            this.physics.add.overlap(player, monster, onPlayerHit, null, this);

            // モンスターをランダムに動かす
            changeMonsterDirection();
            this.time.addEvent({ delay: 2000, callback: changeMonsterDirection, callbackScope: this, loop: true });
        } else if (data.type === 'update') {
            updateOtherPlayers(this, data.players);
        }
    };

    cursors = this.input.keyboard.createCursorKeys();

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

    if (cursors.left.isDown) { x -= speed; moved = true; }
    if (cursors.right.isDown) { x += speed; moved = true; }
    if (cursors.up.isDown) { y -= speed; moved = true; }
    if (cursors.down.isDown) { y += speed; moved = true; }

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
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }
}

// プレイヤーがモンスターに当たった時の処理
function onPlayerHit() {
    let randomChance = Phaser.Math.Between(1, 10); // 1～10のランダムな値を取得
    if (randomChance === 1) { // 1/10の確率でログアウト
        logoutPlayer();
    }
}

// ログアウト処理
function logoutPlayer() {
    alert("モンスターにやられた！ログアウトします。");
    socket.close(); // WebSocket を切断
    player.destroy(); // プレイヤーを削除
    game.destroy(true); // ゲームを終了
    location.reload(); // ページをリロード
}

// モンスターの方向をランダムに変える
function changeMonsterDirection() {
    if (!monster) return;

    let randomAngle = Phaser.Math.Between(0, 360); // 0～360度のランダムな方向
    let velocityX = Math.cos(randomAngle) * monsterSpeed;
    let velocityY = Math.sin(randomAngle) * monsterSpeed;

    monster.setVelocity(velocityX, velocityY);
}




