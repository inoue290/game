window.onload = function () {
    // すでにリダイレクトしたことがある場合、処理をスキップ
    if (localStorage.getItem('redirected') === 'true') {
        return;  // リダイレクト済みなら何もしない
    }

    const urlParams = new URLSearchParams(window.location.search);

    // userパラメータがなければ、ランダムな値を生成して追加
    if (!urlParams.has('user')) {
        const randomString = generateRandomString(20);  // ランダムな20桁の英数字を生成
        const currentUrl = new URL(window.location.href); // 現在のURLをURLオブジェクトで取得

        // userパラメータを追加
        currentUrl.searchParams.set('user', randomString);

        // 新しいURLにリダイレクト（履歴が残らないようにする）
        window.location.href = currentUrl.toString();

        // リダイレクト済みとしてローカルストレージにフラグを設定
        localStorage.setItem('redirected', 'true');
        return;  // ここで処理を終了させる
    }
};

// 20桁のランダムな英数字を生成する関数
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}