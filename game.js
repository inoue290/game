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
let monsterTimer;

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

            // 初期モンスターを生成
            createMonster(this);

            // 衝突判定を追加
            this.physics.add.collider(player, monster, onPlayerHit, null, this);  // ここでプレイヤーとモンスターの衝突を設定
        } else if (data.type === 'monsterPosition') {
            // モンスターの位置をサーバーから受け取った位置に更新
            if (monster) {
                monster.setPosition(data.x, data.y);
            }
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

// プレイヤーがモンスターに当たった時の処理
function onPlayerHit(player, monster) {
    if (!monster) return;

    // 攻撃エフェクトを表示
    let attackEffect = game.scene.scenes[0].add.image(monster.x, monster.y, 'attack');
    attackEffect.setScale(0.5);
    attackEffect.setDepth(1);  // エフェクトをプレイヤーとモンスターの前に表示

    // エフェクトを200ms後に消す
    game.scene.scenes[0].time.delayedCall(200, () => attackEffect.destroy(), [], game.scene.scenes[0]);

    let randomChance = Phaser.Math.Between(1, 10); // 1～10のランダムな値を取得
    if (randomChance === 1) { // 1/10の確率でモンスターを倒す
        monster.destroy(); // モンスターを破壊
        monster = null;    // モンスターをnullに設定
        alert("モンスターを倒した！討伐成功！");

        // 新しいモンスターを生成
        createMonster(game.scene.scenes[0]);
    }
}

// モンスターを生成する関数
function createMonster(scene) {
    // 3秒後に新しいモンスターを生成
    monsterTimer = scene.time.addEvent({
        delay: 3000,  // 3秒後
        callback: () => {
            if (!monster) {
                // モンスターの位置をランダムに決定
                let x = Phaser.Math.Between(100, window.innerWidth - 100);
                let y = Phaser.Math.Between(100, window.innerHeight - 100);
                monster = scene.physics.add.sprite(x, y, 'monster');
                monster.setCollideWorldBounds(true);
                scene.physics.add.collider(player, monster, onPlayerHit, null, scene);  // 衝突判定を追加
            }
        },
        loop: false  // 1回だけ実行
    });
}

// ログアウト処理
function logoutPlayer() {
    alert("モンスターにやられた！ログアウトします。");
    socket.close(); 
    player.destroy(); 
    game.destroy(true);
    location.reload();
}
