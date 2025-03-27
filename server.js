const WebSocket = require('ws');

// RenderのPORT環境変数を使用してポートを指定
const port = process.env.PORT || 3000;  // ポートが指定されていなければ3000を使用

const server = new WebSocket.Server({ port: port, host: '0.0.0.0' });
let players = {};
let monsterPosition = { x: 400, y: 300 };  // モンスターの初期位置

server.on('connection', (socket) => {
    console.log('🚀 プレイヤーが接続');

    // 新しいプレイヤーIDを生成
    const playerId = Math.random().toString(36).substring(2, 10);
    players[playerId] = { x: 400, y: 300 };

    socket.send(JSON.stringify({ type: 'welcome', id: playerId }));

    // メッセージを受信
    socket.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'move') {
            players[data.id] = { x: data.x, y: data.y };
            // 他のクライアントに送信
            broadcast(JSON.stringify({ type: 'update', players }));
        }
    });

    // 切断時
    socket.on('close', () => {
        console.log(`❌ プレイヤー ${playerId} が切断`);
        delete players[playerId];
        broadcast(JSON.stringify({ type: 'update', players }));
    });
});

// すべてのクライアントにデータ送信
function broadcast(message) {
    server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

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

console.log('✅ WebSocketサーバー起動！');
