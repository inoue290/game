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
let successText, attackEffect;

function preload() {
    // 画像をロード
    this.load.image('player', 'assets/player.png');
    this.load.image('monster', 'assets/monster.png');
    this.load.image('attack', 'assets/attack.png');
}

function create() {
    // WebSocket接続
    socket = new WebSocket('wss://game-7scn.onrender.com');

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // プレイヤーが初めて接続した時の処理
        if (data.type === 'welcome') {
            playerId = data.id;
            player = this.physics.add.sprite(400, 300, 'player');
            player.setCollideWorldBounds(true);
            player.setOrigin(0.5, 0.5);

            // 最初のモンスター生成
            createMonster(this);

            // プレイヤーとモンスターの衝突判定
            this.physics.add.collider(player, monster, onPlayerHit, null, this);
        } else if (data.type === 'monsterPosition') {
            // 他のプレイヤーのモンスターの位置更新
            if (monster) {
                monster.setPosition(data.x, data.y);
            }
        } else if (data.type === 'update') {
            // 他のプレイヤーの位置更新
            updateOtherPlayers(this, data.players);
        }
    };

    // キーボードの入力を取得
    cursors = this.input.keyboard.createCursorKeys();
    attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // タッチ移動の処理
    this.input.on('pointerdown', (pointer) => handleTouchMove(pointer));
    this.input.on('pointermove', (pointer) => handleTouchMove(pointer));

    // 討伐成功メッセージを表示するテキスト
    successText = this.add.text(400, 50, '', { fontSize: '32px', fill: '#00FF00' }).setOrigin(0.5);
    successText.setVisible(false);  // 初めは非表示
}

function update() {
    // プレイヤーがいなければ終了
    if (!player) return;

    let moved = false;
    let x = player.x, y = player.y;
    let speed = 3;

    // プレイヤーの移動処理
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

    // プレイヤーが移動した場合
    if (moved) {
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }

    // 攻撃キーが押された時の処理
    if (Phaser.Input.Keyboard.JustDown(attackKey)) {
        attack();
    }

    // モンスターが存在する場合、その動きの更新
    if (monster) {
        moveMonsterNaturally(monster);
    }
}

function updateOtherPlayers(scene, playersData) {
    // 他のプレイヤーの情報を更新
    Object.keys(playersData).forEach(id => {
        if (id !== playerId) {
            // 新しいプレイヤーを追加
            if (!otherPlayers[id]) {
                otherPlayers[id] = scene.physics.add.sprite(playersData[id].x, playersData[id].y, 'player');
            } else {
                // 既存のプレイヤー位置を更新
                otherPlayers[id].setPosition(playersData[id].x, playersData[id].y);
            }
        }
    });

    // もういないプレイヤーを削除
    Object.keys(otherPlayers).forEach(id => {
        if (!playersData[id]) {
            otherPlayers[id].destroy();
            delete otherPlayers[id];
        }
    });
}

function handleTouchMove(pointer) {
    // タッチでプレイヤーの位置を更新
    if (pointer.isDown) {
        const x = pointer.x;
        const y = pointer.y;
        player.setPosition(x, y);
        socket.send(JSON.stringify({ type: 'move', id: playerId, x, y }));
    }
}

function onPlayerHit(player, monster) {
    // モンスターに当たった場合の処理
    if (!monster) return;

    // 攻撃エフェクトの表示
    attackEffect = game.scene.scenes[0].add.image(monster.x, monster.y, 'attack');
    attackEffect.setScale(0.5);
    attackEffect.setDepth(1);

    // 0.2秒後に攻撃エフェクトを削除
    game.scene.scenes[0].time.delayedCall(200, () => {
        attackEffect.destroy();
    }, [], game.scene.scenes[0]);

    // モンスター討伐判定
    let randomChance = Phaser.Math.Between(1, 10);
    if (randomChance === 1) {
        // モンスターを削除
        monster.destroy();
        monster = null;

        // 討伐成功メッセージを表示
        successText.setText('討伐成功！');
        successText.setVisible(true);

        // 1.5秒後にメッセージを非表示
        game.scene.scenes[0].time.delayedCall(1500, () => successText.setVisible(false), [], game.scene.scenes[0]);

        // 新しいモンスターを生成
        createMonster(game.scene.scenes[0]);
    }
}

function createMonster(scene) {
    // モンスターがいない場合のみ生成
    if (!monster) {
        let x = Phaser.Math.Between(100, window.innerWidth - 100);
        let y = Phaser.Math.Between(100, window.innerHeight - 100);
        monster = scene.physics.add.sprite(x, y, 'monster');
        monster.setCollideWorldBounds(true);
        scene.physics.add.collider(player, monster, onPlayerHit, null, scene);
    }
}

function moveMonsterNaturally(monster) {
    // モンスターが自然に動く処理
    const changeDirectionChance = 1; // 1フレームに1回方向を変える確率
    const moveSpeed = monsterSpeed;

    // ランダムで方向を変える（左右のみに限定）
    if (Phaser.Math.Between(1, 100) <= changeDirectionChance) {
        const moveLeft = Phaser.Math.Between(0, 1) === 0; // 50%の確率で左 or 右
        monster.setFlipX(moveLeft); // 左なら true、右なら false
        monster.setVelocityX(moveLeft ? -monsterSpeed : monsterSpeed); // 左なら負の速度、右なら正の速度
    }

    // モンスターの移動処理
    const velocityX = Math.cos(Phaser.Math.DegToRad(monster.angle)) * moveSpeed;
    const velocityY = Math.sin(Phaser.Math.DegToRad(monster.angle)) * moveSpeed;

    monster.setVelocity(velocityX, velocityY);
}

function logoutPlayer() {
    // ゲームを終了する処理
    alert("モンスターにやられた！ログアウトします。");
    socket.close();  // WebSocket接続を閉じる
    player.destroy();  // プレイヤーキャラクターを削除
    game.destroy(true);  // ゲームの状態を全て削除
    location.reload();  // ページをリロードしてゲームを再起動
}
