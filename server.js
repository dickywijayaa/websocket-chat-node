"use strict";

// load env
require('dotenv').config()

var helper = require('./helper')
var HttpStatus = require('http-status-codes');

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = process.env.APP_NAME;

// Port where we'll run the websocket server
var webSocketsServerPort = process.env.APP_PORT;
var webSocketServer = require('websocket').server;
var http = require('http');

/**
 * Global variables
 */
// latest 100 messages
var history = [ ];

// list of currently connected clients (users)
var clients = [ ];

// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];

/**
 * HTTP server
 */
var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' HTTP server. URL' + request.url + ' requested.');
  
    if (request.url === '/status') {
      response.writeHead(HttpStatus.OK, {'Content-Type': 'application/json'});
      
      var responseObject = {
        currentClients: clients.length,
        totalHistory: history.length
      };

      response.end(JSON.stringify(responseObject));
    } else {
      response.writeHead(HttpStatus.NOT_FOUND, {'Content-Type': 'text/plain'});
      response.end('Sorry, unknown url');
    }
});

server.listen(webSocketsServerPort, function() {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});

/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
  httpServer: server
});

// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    var connection = request.accept(null, request.origin); 

    // we need to know client index to remove them on 'close' event
    var index = clients.push(connection) - 1;
    var userName = false;
    var userColor = false;
    console.log((new Date()) + ' Connection accepted.');
    
    // send back chat history
    if (history.length > 0) {
        connection.sendUTF(
            JSON.stringify({
                type: 'history',
                data: history
            })
        );
    }

    // user sent some message
    connection.on('message', function(message) {
        if (message.type === 'utf8') { // accept only text
            // first message sent by user is their name
            if (userName === false) {
                userName = helper.htmlEntities(message.utf8Data);
                userColor = colors.shift();
                
                connection.sendUTF(JSON.stringify({ 
                    type:'color',
                    data: userColor
                }));
                
                console.log((new Date()) + ' User is known as: ' + userName + ' with ' + userColor + ' color.');
            } else {
                console.log((new Date()) + ' Received Message from ' + userName + ': ' + message.utf8Data);
                
                // we want to keep history of all sent messages
                var obj = {
                    time: (new Date()).getTime(),
                    text: helper.htmlEntities(message.utf8Data),
                    author: userName,
                    color: userColor
                };
                
                history.push(obj);
                history = history.slice(-100);
                
                // broadcast message to all connected clients
                var json = JSON.stringify({
                    type:'message',
                    data: obj
                });

                for (var i=0; i < clients.length; i++) {
                    clients[i].sendUTF(json);
                }
            }
        }
    });

  // user disconnected
    connection.on('close', function(connection) {
        if (userName !== false && userColor !== false) {
            console.log((new Date()) + " Peer " + connection.remoteAddress + " / Username : " + userName + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
            colors.push(userColor);
        }
    });

});