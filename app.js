//========================================
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const API_KEY = require('./apiKey');

//インストールしたモジュールを読み込む
const language = require('@google-cloud/language');
const line = require('@line/bot-sdk');
const axios = require("axios");
require("dotenv").config();

//先ほど書いた.envファイルからアクセストークンとチャンネルシークレットを引っ張ってくる。
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client_line = new line.Client(config);
const client_lang = new language.LanguageServiceClient();

let eva = 0;

//応答処理
const Analyze = async (text,event,userId) => {
  let replyText = "";
  const document = {
    content: text,
    type: 'PLAIN_TEXT',
  };

  client_lang
  .analyzeSentiment({document: document})
  .then(results => {
    //全体評価をpushMessageで返します(scoreで点数、magnitudeで感情の揺れが取得できます。)
    const sentiment = results[0].documentSentiment;
    pushText(`全体評価:\nスコア: ${rounding(sentiment.score)}\n感情の振れ幅: ${rounding(sentiment.magnitude)}`,userId);
    //一文ごとの点数と感情の揺れを返します。forEachで文が複数あれば一つずつpushMessageで返します。
    //出力される順番がおかしくなることがあるので、setTimeoutを使っていますが、解消されない時があります...
    const sentences = results[0].sentences;
    sentences.forEach(sentence => {
      setTimeout(() => {
        pushText(`「${sentence.text.content}」:\nスコア: ${rounding(sentence.sentiment.score)}\n感情の振れ幅: ${rounding(sentence.sentiment.magnitude)}`,userId);
      },1000);
    });
    //総合評価がニュートラル、正の値、負の値によってスタンプを送信します。
    evalResult(sentiment.score,userId)
  })
  .catch(err => {
    console.error('ERROR:', err);
  });
}

//切り捨てs処理
const rounding = (num) =>{
    return Math.floor(num * 10)/10;
}
  
//テキスト送信処理
const pushText = (mes,userId) => {
  client_line.pushMessage(userId,{
    type: "text",
    text: mes,
  })
}

//総合評価でスタンプ送信。これもsetTimeout()を使って一番最後(２秒後)に出力されるようにします。
const evalResult = (num,userId) => {
    let stamp = 1;
    if(num === 0){
      stamp = 113
    }else if (num >= 0) {
      stamp = 14;
    }else{
      stamp = 6;
    }
    setTimeout(() => {
      client_line.pushMessage(userId,{
        type: "sticker",
        packageId: 1,
        stickerId: stamp,
      })
    },2000);
}

//LINEイベント(メッセージ入力)発火
const handleEvent = (event) => {
    if (event.type !== 'message' || event.message.type !== 'text') {
      return Promise.resolve(null);
    }
    const sentText = event.message.text;
    const userId = event.source.userId;
    let message = "";
  
    if(event.message.text !== ""){
      //評価する前に一文出力して、解析っぽさを演出します。
      message = `「${sentText}」を解析します...`;
      //解析
      Analyze(sentText,event,userId);
    }
  
    return client_line.replyMessage(event.replyToken, {
      type: 'text',
      text: message
    });
}

//========================================
const server = express();
server.use(bodyParser.urlencoded({
    extended: true
}));

server.use(bodyParser.json());

//server.use(express.static(path.join(__dirname, 'public')));

//=========================================
//main
server.post('/webhook', line.middleware(config), (req, res) => {
    console.log(req.body.events);
    Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result));
});

server.post('/movie', function(req, res){

    console.log(' req.body:', req.body);

    const movieTitle = req.body.queryResult 
        && req.body.queryResult.parameters 
        && req.body.queryResult.parameters.movie ? req.body.queryResult.parameters.movie.toString() : 'The Godfather';
    
    const reqUrl = encodeURI(`http://www.omdbapi.com/?t=${movieTitle}&apikey=${API_KEY}`);
    console.log('movieTitle:', movieTitle, 'reqUrl:', reqUrl);

    http.get(reqUrl, (responseFromAPI) => {
      let completeResponse = '';
      responseFromAPI.on('data', (chunk) => {
          completeResponse += chunk;
      });
      responseFromAPI.on('end', () => {
          const movie = JSON.parse(completeResponse);
          let dataToSend = movieTitle === 'The Godfather' ? `I don't have the required info on that. Here's some info on 'The Godfather' instead.\n` : '';
          dataToSend += `${movie.Title} is a ${movie.Actors} starer ${movie.Genre} movie, released in ${movie.Year}. It was directed by ${movie.Director}`;
          
          return res.json({
              speech: dataToSend,
              displayText: dataToSend,
              source: 'movie'
          });
      });
    }, (error) => {
      return res.json({
          speech: 'Something went wrong!',
          displayText: 'Something went wrong!',
          source: 'movie'
      });
    });
});

var port = process.env.PORT || 3000;
//=========================================
server.listen(port, () => {
  console.log("url: http://localhost:" + port);
  console.log("Server is up and running...");
});
