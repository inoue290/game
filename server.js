const WebSocket = require('ws');

// RenderのPORT環境変数を使用してポートを指定
const port = process.env.PORT || 3000;  // ポートが指定されていなければ3000を使用

const server = new WebSocket.Server({ port: port, host: '0.0.0.0' });
let players = {};
let monsterPosition = { x: 400, y: 300, hp: 100 };  // モンスターの初期位置とHP
let effects = [];  // エフェクトを格納する配列

server.on('connection', (socket) => {
    console.log('🚀 プレイヤーが接続');

    // 新しいプレイヤーIDを生成
    const playerId = Math.random().toString(36).substring(2, 10);
    players[playerId] = { x: 400, y: 300, hp: 100 };  // プレイヤーの初期位置とHP

    // サーバーへIDと初期位置、HPを送信
    socket.send(JSON.stringify({ type: 'welcome', id: playerId, x: 400, y: 300, hp: 100 }));

    // メッセージ受信時の処理
    socket.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'move') {
            players[data.id] = { x: data.x, y: data.y, hp: players[data.id].hp };  // HPはそのまま
            broadcast(JSON.stringify({ type: 'update', players }));
        }

        // プレイヤーが攻撃した場合、HP減少
        if (data.type === 'attack') {
            const player = players[data.id];
            console.log('Player before attack:', player);  // 攻撃前のプレイヤー情報を確認
            if (player) {
                player.hp -= 10;  // 攻撃を受けた場合にHPを減少
                if (player.hp < 0) player.hp = 0;  // HPが0未満にならないようにする
                console.log('Player after attack:', player);  // 攻撃後のプレイヤー情報を確認
                // プレイヤーのHP情報を全員に送信
                broadcast(JSON.stringify({ type: 'update', players }));
            }
        }
    });

    // 接続が切断されたときの処理
    socket.on('close', () => {
        console.log(`❌ プレイヤー ${playerId} が切断`);
        delete players[playerId];
        broadcast(JSON.stringify({ type: 'update', players }));
    });
});

// すべてのクライアントにデータを送信する関数
function broadcast(message) {
    server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// 定期的にモンスターの位置を更新して全員に送信する処理
setInterval(() => {
    // モンスターのランダムな動きを設定
    monsterPosition.x += Math.random() * 20 - 10;  // ランダムに位置を変更
    monsterPosition.y += Math.random() * 20 - 10;

    // モンスターの位置とHPを全員に送信
    broadcast(JSON.stringify({
        type: 'monsterPosition',
        x: monsterPosition.x,
        y: monsterPosition.y,
        hp: monsterPosition.hp
    }));
}, 1000);  // 1秒ごとに更新

// サーバー起動完了メッセージ
console.log('✅ WebSocketサーバー起動！');

