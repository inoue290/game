const WebSocket = require('ws');  // WebSocketモジュールのインポート
const port = process.env.PORT || 3000;  // ポートが指定されていなければ3000を使用

const server = new WebSocket.Server({ port: port, host: '0.0.0.0' });
let players = {};
let monsterPosition = { x: 400, y: 300 };  // モンスターの初期位置
let effects = [];  // エフェクトを格納する配列
let monsterHP = 100;

server.on('connection', (socket) => {
    console.log('🚀 プレイヤーが接続');

    // 新しいプレイヤーIDを生成
    const playerId = Math.random().toString(36).substring(2, 10);
    players[playerId] = { x: 400, y: 300 };
    //サーバーへID転送
    socket.send(JSON.stringify({ type: 'welcome', id: playerId }));

    // メッセージを受信
    socket.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'move' && players[data.id]) {
            players[data.id] = { x: data.x, y: data.y };
            // 他のクライアントに送信
            broadcast(JSON.stringify({ type: 'update', players }));
        }
        
        // 衝突エフェクトの送信（例：プレイヤーがモンスターに衝突）
        if (data.type === 'attack') {
            const effect = { type: 'attack', x: data.x, y: data.y, timestamp: Date.now() };
            effects.push(effect);
            
            // エフェクト情報を全員に送信
            broadcast(JSON.stringify({ type: 'effect', effect }));
            // モンスターHPを全員に送信
             monsterHP -= 1;
            if (monsterHP < 0) monsterHP = 0;
            // モンスターのHPが0になったら初期値に戻す
            if (monsterHP === 0) {
                // 少し遅らせてリセットすることも可能
                setTimeout(() => {
                    monsterHP = 100; // 初期値に戻す
                    broadcast(JSON.stringify({
                        type: 'updateMonsterHP',
                        hp: monsterHP
                    }));
                }, 5000); // 5秒後にリセット（演出を入れたい場合）
            } else {
            // 全員にHPとエフェクトを送信
            broadcast(JSON.stringify({
                type: 'updateMonsterHP',
                hp: monsterHP
            }));
        }
        }
    });

    // 切断時
    socket.on('close', () => {
        console.log(`❌ プレイヤー ${playerId} が切断`);
        delete players[playerId];
        broadcast(JSON.stringify({ type: 'update', players }));
    });
});

// 定期的にモンスターの位置を更新して全員に送信
setInterval(() => {
    // モンスターのランダムな動きを設定
    monsterPosition.x += Math.random() * 20 - 10;  // ランダムに位置を変更
    monsterPosition.y += Math.random() * 20 - 10;

    // モンスターの位置を全員に送信
    broadcast(JSON.stringify({
        type: 'monsterPosition',
        x: monsterPosition.x,
        y: monsterPosition.y
    }));
}, 1000);  // 1秒ごとに更新

// 定期的にエフェクトを更新して削除
setInterval(() => {
    // 1秒ごとに古いエフェクトを削除
    const currentTime = Date.now();
    effects = effects.filter(effect => currentTime - effect.timestamp < 1000);  // 1秒以内のエフェクトだけ残す

    // 残ったエフェクトを全員に送信
    effects.forEach(effect => {
        broadcast(JSON.stringify({ type: 'effect', effect }));
    });
}, 1000);  // 1秒ごとにエフェクトを更新

// すべてのクライアントにデータ送信
function broadcast(message) {
    server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

console.log('✅ WebSocketサーバー起動！');
