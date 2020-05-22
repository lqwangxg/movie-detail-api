//========================================
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const API_KEY = require('./apiKey');
//const path = require('path');

//========================================
const server = express();
server.use(bodyParser.urlencoded({
    extended: true
}));

server.use(bodyParser.json());

//server.use(express.static(path.join(__dirname, 'public')));

//=========================================
//server.use((req, res) => {
//    res.sendStatus(404);
//});
// GET http://localhost:3000/api/v1/
server.post('/api/movie/',function(req,res){
    const movieTitle = req.body.movie? req.body.movie : 'The Godfather';
    res.json({
        message:"Hello,world",
        "movie title":movieTitle
    });
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
          req.body.queryResult.fulfillmentText = dataToSend;
          req.body.queryResult.fulfillmentMessages.text.text = dataToSend;
          
          console.log(`💫💫💫call webhook succeed.💫💫💫`);
          
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

var port = process.env.PORT || 8080;
//=========================================
server.listen(port, () => {
  console.log("url: http://localhost:" + port);
  console.log("Server is up and running...");
});
