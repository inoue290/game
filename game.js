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
let cursors, attackKey, socket, playerId;
let monsterSpeed = 100; 

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('monster', 'assets/monster.png');
    this.load.image('attack', 'assets/attack.png'); // 攻撃エフェクト
}

function create() {
    socket = new WebSocket('wss://game-7scn.onrender.com');

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'welcome') {
            playerId = data.id;
            player = this.physics.add.sprite(400, 300, 'player');
            player.setCollideWorldBounds(true);
            player.setOrigin(0.5, 0.5);

            // モンスター生成
            let randomX = Phaser.Math.Between(100, window.innerWidth - 100);
            let randomY = Phaser.Math.Between(100, window.innerHeight - 100);
            monster = this.physics.add.sprite(randomX, randomY, 'monster');
            monster.setCollideWorldBounds(true);
            
            // モンスターとの衝突判定
            this.physics.add.overlap(player, monster, onPlayerHit, null, this);

            // モンスターをランダム移動
            changeMonsterDirection();
            this.time.addEvent({ delay: 2000, callback: changeMonsterDirection, callbackScope: this, loop: true });
        } else if (data.type === 'update') {
            updateOtherPlayers(this, data.players);
        }
    };

    cursors = this.input.keyboard.createCursorKeys();
    attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE); // スペースキーで攻撃

    this.input.on('pointerdown', (pointer) => handleTouchMove(pointer));
    this.input.on('pointermove', (pointer) => handleTouchMove(pointer));
}

function update() {
    if (!player) return;

    let moved = false;
    let x = player.x, y = player.y;
    let speed = 3;

    // 移動処理
    if (cursors.left.isDown) {
        x -= speed; 
        moved = true;
        player.setFlipX(true); // 左向き
    }
    if (cursors.right.isDown) {
        x += speed; 
        moved = true;
        player.setFlipX(false); // 右向き
    }
    if (cursors.up.isDown) { y -= speed; moved = true; }
    if (cursors.down.isDown) { y += speed; moved = true; }

    if (moved) {
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }

    // 攻撃処理
    if (Phaser.Input.Keyboard.JustDown(attackKey)) {
        attack();
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

// モンスターの方向をランダムに変える
function changeMonsterDirection() {
    if (!monster) return;

    let randomAngle = Phaser.Math.Between(0, 360);
    let velocityX = Math.cos(randomAngle) * monsterSpeed;
    let velocityY = Math.sin(randomAngle) * monsterSpeed;

    monster.setVelocity(velocityX, velocityY);
    if (velocityX < 0) {
        monster.setFlipX(true); // 左向き
    } else {
        monster.setFlipX(false); // 右向き
    }
}

// モンスターを倒せるようにする
function attack() {
    if (!monster) return;

    let distance = Phaser.Math.Distance.Between(player.x, player.y, monster.x, monster.y);
    if (distance < 50) { // 一定距離内なら攻撃成功
        let attackEffect = game.scene.scenes[0].add.image(monster.x, monster.y, 'attack');
        attackEffect.setScale(0.5);
        game.scene.scenes[0].time.delayedCall(200, () => attackEffect.destroy(), [], game.scene.scenes[0]);

        monster.destroy();
        monster = null;
        console.log("モンスターを倒した！");
    }
}

// プレイヤーがモンスターに当たった時の処理
function onPlayerHit() {
    let randomChance = Phaser.Math.Between(1, 10); 
    if (randomChance === 1) { // 1/10の確率でログアウト
        logoutPlayer();
    }
}

// ログアウト処理
function logoutPlayer() {
    alert("モンスターにやられた！ログアウトします。");
    socket.close(); 
    player.destroy(); 
    game.destroy(true);
    location.reload();
}

