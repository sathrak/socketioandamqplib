# Node js chat server using Express, Socket IO, Redis and RabbitMQ

## Chat application : 
	In this guide we’ll create a basic chat application. It requires almost no basic prior knowledge of Node.JS or Socket IO.
		
### Introduction
	Sockets have traditionally been the solution around which most realtime chat systems are architected, providing a bi-directional communication channel between a client and a server.

	This means that the server can push messages to clients. Whenever you write a chat message, the idea is that the server will get it and push it to all other connected clients.	
	
### The web framework
	The first goal is to setup a simple HTML webpage that serves out a form and a list of messages. We’re going to use the Node.JS web framework express to this end. 	
		
	First let’s create a package.json manifest file that describes our project.
		
	Now, in order to easily populate the dependencies with the things we need, we’ll use npm install --save:

	npm install --save express@4.15.2
		
	Now that express is installed we can create an ./bin/server.js file that will setup our application.
	
```js
var app = require('express')();
var http = require('http').Server(app);

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});		
```
	
### This translates into the following:
	1. Express initializes app to be a function handler that you can supply to an HTTP server (as seen in line 2).
	2. We define a route handler / that gets called when we hit our website home.
	3. We make the http server listen on port 3000.
	
## Serving HTML
	So far in ./bin/server.js we’re calling res.send and pass it a HTML string. Our code would look very confusing if we just placed our entire application’s HTML there. Instead, we’re going to create a client.ejs file and serve it.

	Let’s refactor our route handler to use render instead:
		
```js	
app.get('/', function(req, res){	
	res.render('client.ejs',{uid:<Sender Id>,rid:<Receiver Id>,random:<Random Number>,tokenId:'<Tocken Id>'});
});		
```
		
    	And set The view engine and share the image and style to client side. 
		
	npm install --save ejs@2.6.1
		
```js	
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname,'public')));		
```
		
# Integrating Socket.IO

## Socket.IO is composed of two parts:

	A server that integrates with (or mounts on) the Node.JS HTTP Server: socket.io
	A client library that loads on the browser side: socket.io-client

	During development, socket.io serves the client automatically for us, as we’ll see, so for now we only have to 		install one module:

	npm install --save socket.io

	That will install the module and add the dependency to package.json. Now let’s edit client.ejs to add it:

```js	
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
	var data = req.query;			
	res.render('client.ejs',{uid:<Sender Id>,rid:<Receiver Id>,random:<Random Number>,tokenId:'<Tocken Id>'});
});

io.on('connection', function(socket){
	console.log('a user connected');
});

http.listen(3000, function(){
  console.log('listening on :3000');
});		
```
	Notice that I initialize a new instance of socket.io by passing the http (the HTTP server) object. Then I listen on the connection event for incoming sockets, and I log it to the console.

	Now in client.ejs I add the following snippet before the </body>:

```HTML
<script src="/socket.io/socket.io"></script>
<script>
	var option = {
		reconnect: false,
		'try multiple transports': false,
		transports: ['websocket'],
		'query':'token=<%= tokenId %>&ksId=<%= uid %>'
	};
	var socket = io.connect("localhost:3000/kschat",option);
</script>	
```	
	That’s all it takes to load the socket.io-client, which exposes a io global, and then connect.

	Notice that I’m not specifying any URL when I call io(), since it defaults to trying to connect to the host that serves the page.

	If you now reload the server and the website you should see the console print “a user connected”.Try opening several tabs, and you’ll see several messages:
	
	Each socket also fires a special disconnect event:

```js	
io.on('connection', function(socket){
	console.log('a user connected');
	socket.on('disconnect', function(){
		console.log('user disconnected');
	});
});	
```	
## Emitting events

	The main idea behind Socket.IO is that you can send and receive any events you want, with any data you want. Any objects that can be encoded as JSON will do, and binary data is supported too.

	Let’s make it so that when the user types in a message, the server gets it as a chat message event. The scripts section in client.ejs should now look as follows:

```html	
<script src="/socket.io/socket.io.js"></script>
<script src="https://code.jquery.com/jquery-1.11.1.js"></script>
<script>
  $(function () {
	var option = {
		reconnect: false,
		'try multiple transports': false,
	transports: ['websocket'],
	'query':'token=<%= tokenId %>&ksId=<%= uid %>'
};
var socket = io.connect("localhost:3000/kschat",option);
$(document).on("click", "#SEND", function(){
	var time = Math.floor(new Date().getTime()/1000);
	socket.emit('Send',{uId:<%= uid %>,pId:<%= rid %>,msg:$("#MSG").val(),rno:random,time:time},function(resp){
		$("#MSG").val('');
	});
});	
});
</script>		
```	
	And in /bin.server.js we print out the chat message event:
	
```js	
io.on('connection', function(socket){
	socket.on("Send", function(data,callback){
		console.log('message: ' + data);
		callback({RESPONSE:"Send Emit is success."});

	});
});		
```
# Socket IO with JWT
	server side Token verification 
		
	npm install --save jsonwebtoken@8.2.1
				
```js
io.use(function(socket, next){		
	if (socket.handshake.query && socket.handshake.query.token){
		try {				
			var decoded = jwt.verify(socket.handshake.query.token, init.SECRET_KEY,{ignoreNotBefore:true});
			if(!generic.empty(decoded.data)){
				var jwtId = decoded.data.id;
				socket.userid = jwtId;
				sockets[jwtId] = socket;
				return next();
			}else {					
				return next(new Error('Authentication error'));					
			}
		} catch(err) {				
			return next(new Error('Authentication error'));
		}
	} else {
		next(new Error('Authentication error'));
	}    
}).on('connection', function(socket) {
	// Inside create the RabbitMQ consumer
});		
```	

### Client Side pass the tocken key and user Info

```js	
var option = {
	reconnect: false,
	'try multiple transports': false,
	transports: ['websocket'],
	'query':'token=<%= tokenId %>&ksId=<%= uid %>'
};
var socket = io.connect("localhost:3000/kschat",option);		
```
## Socket io and Redis
		
	First Create the redis pub/sub connection, If you need to create a redisAdapter to a redis instance that has a password, use pub/sub options instead of passing a connection string.
		
	npm install --save redis@2.8.0
	npm install --save socket.io-redis@5.2.0
	
```js	
var pub = redis.createClient(dbconfig.MREDISLBPORT, dbconfig.MREDISLBIP, { auth_pass: dbconfig.REDISPASS});
pub.on("error", function (err) {
	console.error("Redis Pub Error " + err);
});

var sub = redis.createClient(dbconfig.SREDISLBPORT, dbconfig.SREDISLBIP, { auth_pass: dbconfig.REDISPASS});
sub.on("error", function (err) {
	console.error("Redis Sub Error " + err);
});		

io_s.adapter(redisAdapt({ pubClient: pub, subClient: sub }));
var io = io_s.of('/kschat');		
```	
	By running socket.io with the socket.io-redis adapter you can run multiple socket.io instances in different processes or servers that can all broadcast and emit events to and from each other.
		
# Introduction to RabbitMQ
	
	RabbitMQ is a message broker. It simply accepts messages from one or more endpoints "Producers" and sends it to one or more endpoints "Consumers".

	RabbitMQ is more sophisticated and flexible than just that. Depending on the configuration, it can also figure out what needs to be done when a consumer crashes(store and re-deliver message), when consumer is slow (queue messages), when there are multiple consumers (distribute work load), or even when RabbitMQ itself crashes (durable). For more please see: RabbitMQ tutorials.
		
	RabbitMQ is also very fast & efficient. It implements Advanced Message Queuing Protocol "AMQP" that was built by and for Wall Street firms like J.P. Morgan Chase, Goldman Sachs, etc. for trading stocks and related activities. RabbitMQ is an Erlang (also well-known for concurrency & speed) implementation of that protocol.
	
		
## RabbitMQ Connection	
		Connect to an AMQP 0-9-1 server, optionally given an AMQP URL (see AMQP URI syntax) and socket options. The protocol part (amqp: or amqps:) is mandatory; defaults for elided parts are as given in 'amqp://guest:guest@localhost:5672'. If the URI is omitted entirely, it will default to 'amqp://localhost', which given the defaults for missing parts, will connect to a RabbitMQ installation with factory settings, on localhost.
		
		
### RabbitMQ has 4 pieces.

	1. Producer ("P") - Sends messages to an exchange along with "Routing key" indicating how to route the message.
	2. Exchange ("X") - Receives message and Routing key from Producers and figures out what to do with the message.
	3. Queues("Q") - A temporary place where the messages are stored based on Queue's "binding key" until a consumer is ready to receive the message. Note: While a Queue physically resides inside RabbitMQ, a consumer ("C") is the one that actually creates it by providing a "Binding Key".
	4. Consumer("C") - Subscribes to a Queue to receive messages.

### Routing Key, Binding Key and types of Exchanges

	To allow various work-flows like pub-sub, work queues, topics, RPC etc., RabbitMQ allows us to independently configure the type of the Exchange, Routing Key and Binding Key.
	Routing Key:

	A string/constraint from Producer instructing Exchange how to route the message. A Routing key looks like: "logs", "errors.logs", "warnings.logs" "tweets" etc.
	Binding Key:

	Another string/constraint added by a Consumer to a queue to which it is binding/listening to. A Binding key looks like: "logs", "*.logs", "#.logs" etc.

	Note: In RabbitMQ, Binding keys can have "patterns" (but not Routing keys).

### Types of Exchange:

### Exchanges can be of 4 types:

	1. Direct - Sends messages from producer to consumer if Routing Key and Binding key match exactly.
	2. Fanout - Sends any message from a producer to ALL consumers (i.e ignores both routing key & binding key)
	3. Topic - Sends a message from producer to consumer based on pattern-matching.
	4. Headers - If more complicated routing is required beyond simple Routing key string, you can use headers exchange.

	In RabbitMQ the combination of the type of Exchange, Routing Key and Binding Key make it behave completely differently. For example: A Fanout Exchange ignores Routing Key and Binding Key and sends messages to all queues. A Topic Exchange sends a copy of a message to zero, one or more consumers based on RabbitMQ patterns (#, *).

	Using RabbitMQ to do pub-sub in our Node.js chat app.

	Now that we know some of the basics of RabbitMQ, and all the 4 pieces, let's see how to actually use it in our Chat app.

### Connecting to RabbitMQ and creating an Exchange

	For our chat application, we will create a direct exchange called chatExchange. And will be using node-amqp module to talk to RabbitMQ service.
		
```js	
//Connect to RabbitMQ and get reference to the connection.		
var APPRABMQ;
var start = +new Date();
amqplib.connect('amqp://admin:admin@localhost:5672?heartbeat=60').then(function(conn) {			
	APPRABMQ = conn.createChannel();	
	var end = +new Date();
	console.log("Rabbit MQ Connection Time " + (end-start) + " milliseconds");

	conn.on("error", function(err) {
		if (err.message !== "Connection closing") {
			console.error("Rabbit MQ Connection error", err.message);
		}
	});

	conn.on("close", function() {
		console.error("Rabbit MQ reconnecting");
		process.exit();
	});
}).then(null, console.warn);


//Connect the Exchange direct or fanout or topic
var ex = 'direct_logs';	
var aeok = ch.assertExchange(ex, 'direct', {durable: false});		
```	
### Creating Producers (So Users can send chat messages)

	In our chat app, users are both producers(i.e. sends chat messages to others) and also consumers (i.e. receives messages from others). Let's focus on users being 'producers'.

	When a user sends a chat message, publish it to chatExchange w/o a Routing Key based.
```js		
socket.on("Send", function(data,callback){								
	var suId 	= data.uId;
	var spId   	= data.pId;						
	var smsg 	= data.msg;
	var srno 	= data.rno;
	var msgTime = generic.millisecTime();	

	callback({RESPONSE:"Send Emit is success.",uId:suId});		
	var qmsg = JSON.stringify({uId:suId,pId:spId,msg:smsg,rStatus:1,msgTime:msgTime});			
	if(APPRABMQ){				
		var key = 'ks_'+spId;				
		APPRABMQ.then(function(ch) {						
			var ex = 'direct_logs';	
			ch.on('return', function(msg) {
				console.log('Message returned:',msg);
			});									

			ch.publish(ex, key, new Buffer(qmsg), {deliveryMode: 2, mandatory: true}, function() {
				console.error('Message processed');
			});
		});			
	} else {
		socket.emit('RESPSEND',{RC:1,ER:2},function(sresp){});
	}
});			
``` 
### Creating Consumers (So Users can receive chat messages)

	Creating consumers involves 3 steps:

		1. Create a queue with some options.
		2. Bind queue to exchange using some "Binding Key"
		3. Create a subscriber (usually a callback function) to actually obtain messages sent to the queue.

### For our chat app,

	Let's create a queue w/o any name. This forces RabbitMQ to create new queue for every socket.io connection w/ a new random queue name. Let's also set exclusive flag to ensure only this consumer can access the messages from this queue.

```js		
//Connect the Exchange direct or fanout or topic
var aeok = ch.assertExchange(ex, 'direct', {durable: false});

var aqok = ch.assertQueue('',{exclusive: true});					
```
	Then bind the queue to chatExchange with an empty 'Binding key' and listen to ALL messages.

```js		
var ex = 'direct_logs';						
var key = 'ks_12345';
//Bind to chatExchange w/ "#" or "" binding key to listen to all messages.
ch.bindQueue(q.queue, ex, key);		
```
	Lastly, create a consumer (via q.subscribe) that waits for messages from RabbitMQ. And when a message comes, send it to the browser.
```js		
//Subscribe When a message comes, send it back to browser
ch.consume(q.queue, function(msg) {
	if (msg !== null) {										
		var encodemsg = msg.content.toString();
		var quemsg = JSON.parse(encodemsg);
		if(!generic.empty(quemsg)){
			socket.emit('RESPRECEIVER',{RC:1,ER:0,MSG:[quemsg]},function(rresp){});
		} 							
	} else {
		socket.emit('RESPRECEIVER',{RC:1,ER:0},function(rresp){});
	}
}, {noAck: true});			
```

### Putting it all together.

```js	
io.on('connection', function(socket) {
	/**
	 * When a socket connection is disconnect, That time Routing Key based unbind or delete the Queue. 
	 */	
	socket.on('disconnect', function () {			
		sockcnt = sockcnt - 1;
		console.error(socket.userid,"Member Disconnect - Socket Count :",socket.id);
		if(socket.userid && socket.queueid){
			var key = socket.queueid;
			APPRABMQ.then(function(ch) {
				var ex = 'direct_logs';
				var queue_pat = 'ks_'+socket.userid;										
				var aqok = ch.unbindQueue(key,ex,queue_pat);
				aqok.then(function(q) {
					ch.deleteQueue(key);
				});
			});				
		}	
	}); 

	/**
	 * When a user sends a chat message, publish it to chatExchange w/o a Routing Key.		
	 */		
	socket.on("Send", function(data,callback){								
		var suId 	= data.uId;
		var spId   	= data.pId;						
		var smsg 	= data.msg;
		var srno 	= data.rno;
		var msgTime = generic.millisecTime();	

		callback({RESPONSE:"Send Emit is success.",uId:suId});		
		var qmsg = JSON.stringify({uId:suId,pId:spId,msg:smsg,rStatus:1,msgTime:msgTime});			
		if(APPRABMQ){
			socket.emit('RESPSEND',{RC:1,ER:0,SID:suId,RID:spId,MSG:smsg,RANDOMNO:srno,MSGTIME:msgTime,STATUS:1},function(sresp){});
			var key = 'ks_'+spId;				
			APPRABMQ.then(function(ch) {						
				var ex = 'direct_logs';	
				ch.on('return', function(msg) {
					console.log('Message returned:',msg);
				});									

				ch.publish(ex, key, new Buffer(qmsg), {deliveryMode: 2, mandatory: true}, function() {
					console.error('Message processed');
				});
			});			
		} else {
			socket.emit('RESPSEND',{RC:1,ER:2},function(sresp){});
		}
	});


	/**
	 * Initialize subscriber queue.
	 * 1. First Connect the set the Exchange name direct or fanout or topic
	 * 2. First create a queue w/o any name. This forces RabbitMQ to create new queue for every socket.io connection w/ a new random queue name.
	 * 3. Then bind the queue to chatExchange  w/ "#" or "" 'Binding key' and listen to ALL messages
	 * 4. Lastly, create a consumer (via .consume) that waits for messages from RabbitMQ. And when
	 * a message comes, send it to the browser.
	 *
	 * Note: we are creating this w/in io.on('connection'..) to create NEW queue for every connection
	 */
	var ruserId = socket.userid;
	if(APPRABMQ && ruserId){
		var ex = 'direct_logs';						
		var key = 'ks_'+ruserId;					
		APPRABMQ.then(function(ch) {
			//Connect the Exchange direct or fanout or topic
			var aeok = ch.assertExchange(ex, 'direct', {durable: false});
			aeok.then(function() {						
				var aqok = ch.assertQueue('',{exclusive: true});
				aqok.then(function(q) {
					socket.queueid = q.queue;
					//Bind to chatExchange w/ "#" or "" binding key to listen to all messages.
					ch.bindQueue(q.queue, ex, key);
					//Subscribe When a message comes, send it back to browser
					ch.consume(q.queue, function(msg) {
						if (msg !== null) {										
							var encodemsg = msg.content.toString();
							var quemsg = JSON.parse(encodemsg);
							if(!generic.empty(quemsg)){
								socket.emit('RESPRECEIVER',{RC:1,ER:0,MSG:[quemsg]},function(rresp){});
							} 							
						} else {
							socket.emit('RESPRECEIVER',{RC:1,ER:0},function(rresp){});
						}
					}, {noAck: true});
				});
			});
		});					
	} else{
		console.error("APP - Receiver RabbitMQ Connection is Empty:"+ruserId);
		socket.emit('RESPRECEIVER',{RC:1,ER:2},function(rresp){});
	}				
});		
```
# Running / Testing it on Cloud Foundry

	1. Clone this app to socketioandamqpib folder
	2. cd socketioandamqpib
	3. npm install & follow the below instructions to push the app to Cloud Foundry
	4. Once the server is up, open up multiple browsers and go to <servername>.com
	5. Start chatting.

