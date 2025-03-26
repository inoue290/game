let fallingObjects = [];

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('fallingObject', 'assets/fallingObject.png');  // 降ってくる物体の画像をロード
}

function create() {
    // WebSocketの接続先をRender上のURLに変更
    socket = new WebSocket('wss://game-7scn.onrender.com');  // https://で接続するため wss://
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

    // 上から降ってくる物体の生成
    this.time.addEvent({
        delay: 1000,  // 1秒ごとに物体を落とす
        callback: spawnFallingObject,
        callbackScope: this,
        loop: true
    });
}

// 降ってくる物体を生成する関数
function spawnFallingObject() {
    const x = Phaser.Math.Between(0, window.innerWidth);
    const fallingObject = this.physics.add.sprite(x, 0, 'fallingObject');  // fallingObject.pngを使用
    fallingObject.setVelocityY(Phaser.Math.Between(100, 300));  // 降ってくる速度

    // 物体がプレイヤーと衝突した場合の処理
    this.physics.add.overlap(fallingObject, player, handleCollision, null, this);

    fallingObjects.push(fallingObject);
}

// 衝突時の処理
function handleCollision(fallingObject, player) {
    console.log('Game Over: Player hit by falling object');
    
    // ログアウト処理やゲームの終了処理
    socket.send(JSON.stringify({ type: 'logout', id: playerId }));
    
    // ゲーム終了の処理
    player.setAlpha(0);  // プレイヤーを非表示にする
    fallingObject.setAlpha(0);  // 落ちた物体も非表示
}




