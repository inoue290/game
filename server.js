const WebSocket = require('ws');  // WebSocketモジュールのインポート
const port = process.env.PORT || 3000;  // ポートが指定されていなければ3000を使用

const server = new WebSocket.Server({ port: port, host: '0.0.0.0' });
let players = {};
let monsterPosition = { x: 400, y: 300 };  // モンスターの初期位置
let effects = [];  // エフェクトを格納する配列

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

            // モンスターのHPを減少させる
            if (data.target === 'monster') {
                monsterHP -= 10;
                if (monsterHP < 0) monsterHP = 0;  

                // モンスターの新しいHPを全員に送信
                broadcast(JSON.stringify({
                    type: 'monsterHPUpdate',
                    monsterHP
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

// すべてのクライアントにデータ送信
function broadcast(message) {
    server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

console.log('✅ WebSocketサーバー起動！');
