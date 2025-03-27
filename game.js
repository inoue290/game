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
let monsterSpeed = 50;
let monsterTimer;

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('monster', 'assets/monster.png');
    this.load.image('attack', 'assets/attack.png');
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

            createMonster(this);  // 最初のモンスター生成

            this.physics.add.collider(player, monster, onPlayerHit, null, this);
        } else if (data.type === 'monsterPosition') {
            if (monster) {
                monster.setPosition(data.x, data.y);
            }
        } else if (data.type === 'update') {
            updateOtherPlayers(this, data.players);
        }
    };

    cursors = this.input.keyboard.createCursorKeys();
    attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE); 

    this.input.on('pointerdown', (pointer) => handleTouchMove(pointer));
    this.input.on('pointermove', (pointer) => handleTouchMove(pointer));
}

function update() {
    if (!player) return;

    let moved = false;
    let x = player.x, y = player.y;
    let speed = 3;

    if (cursors.left.isDown) {
        x -= speed; 
        moved = true;
        player.setFlipX(true);
    }
    if (cursors.right.isDown) {
        x += speed; 
        moved = true;
        player.setFlipX(false);
    }
    if (cursors.up.isDown) { y -= speed; moved = true; }
    if (cursors.down.isDown) { y += speed; moved = true; }

    if (moved) {
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }

    if (Phaser.Input.Keyboard.JustDown(attackKey)) {
        attack();
    }

    // モンスターが存在する場合、その動きを更新
    if (monster) {
        moveMonsterRandomly(monster);
    }
}

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

function handleTouchMove(pointer) {
    if (pointer.isDown) {
        const x = pointer.x;
        const y = pointer.y;
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }
}

function onPlayerHit(player, monster) {
    if (!monster) return;

    let attackEffect = game.scene.scenes[0].add.image(monster.x, monster.y, 'attack');
    attackEffect.setScale(0.5);
    attackEffect.setDepth(1); 

    game.scene.scenes[0].time.delayedCall(200, () => attackEffect.destroy(), [], game.scene.scenes[0]);

    let randomChance = Phaser.Math.Between(1, 10);
    if (randomChance === 1) { 
        monster.destroy();
        monster = null;
        alert("モンスターを倒した！討伐成功！");

        // 3秒後に新しいモンスターを生成
        createMonster(game.scene.scenes[0]);
    }
}

function createMonster(scene) {
    // モンスターがいない場合のみ生成
    if (!monster) {
        monsterTimer = scene.time.addEvent({
            delay: 3000, 
            callback: () => {
                if (!monster) {
                    let x = Phaser.Math.Between(100, window.innerWidth - 100);
                    let y = Phaser.Math.Between(100, window.innerHeight - 100);
                    monster = scene.physics.add.sprite(x, y, 'monster');
                    monster.setCollideWorldBounds(true);
                    scene.physics.add.collider(player, monster, onPlayerHit, null, scene);
                }
            },
            loop: false
        });
    }
}

// モンスターをランダムに動かす関数
function moveMonsterRandomly(monster) {
    const changeDirectionChance = 1; // 1フレームに1回方向を変える確率
    const moveSpeed = monsterSpeed;

    if (Phaser.Math.Between(1, 100) <= changeDirectionChance) {
        const randomAngle = Phaser.Math.Between(0, 360);
        monster.setAngle(randomAngle);
    }

    const velocityX = Math.cos(Phaser.Math.DegToRad(monster.angle)) * moveSpeed;
    const velocityY = Math.sin(Phaser.Math.DegToRad(monster.angle)) * moveSpeed;

    monster.setVelocity(velocityX, velocityY);
}

function logoutPlayer() {
    alert("モンスターにやられた！ログアウトします。");
    socket.close(); 
    player.destroy(); 
    game.destroy(true);
    location.reload();
}
