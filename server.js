const WebSocket = require('ws');

// RenderのPORT環境変数を使用してポートを指定
const port = process.env.PORT || 3000;  // ポートが指定されていなければ3000を使用

const server = new WebSocket.Server({ port: port, host: '0.0.0.0' });
let players = {};
let monsterId = 'monster';  // モンスターのIDを設定
players[monsterId] = { x: 400, y: 300, hp: 100 };  // モンスターの初期位置とHP

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
            const monster = players[monsterId];  // モンスターをプレイヤーのように管理

            console.log('Player before attack:', player);  // 攻撃前のプレイヤー情報を確認
            console.log('Monster before attack:', monster);  // 攻撃前のモンスター情報を確認

            if (player) {
                player.hp -= 10;  // プレイヤーのHPを10減らす
                if (player.hp < 0) player.hp = 0;  // プレイヤーのHPが0未満にならないようにする
            }

            if (monster) {
                monster.hp -= 1;  // モンスターのHPを1減らす
                if (monster.hp < 0) monster.hp = 0;  // モンスターのHPが0未満にならないようにする
            }

            console.log('Player after attack:', player);  // 攻撃後のプレイヤー情報を確認
            console.log('Monster after attack:', monster);  // 攻撃後のモンスター情報を確認

            // プレイヤーとモンスターのHP情報を全員に送信
            broadcast(JSON.stringify({ type: 'update', players }));
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
    players[monsterId].x += Math.random() * 20 - 10;  // ランダムに位置を変更
    players[monsterId].y += Math.random() * 20 - 10;

    // モンスターの位置とHPを全員に送信
    broadcast(JSON.stringify({
        type: 'monsterPosition',
        x: players[monsterId].x,
        y: players[monsterId].y,
        hp: players[monsterId].hp
    }));
}, 1000);  // 1秒ごとに更新

// サーバー起動完了メッセージ
console.log('✅ WebSocketサーバー起動！');


