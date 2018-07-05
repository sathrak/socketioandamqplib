/******************************************************************************************************
 *	Filename	: server.js							
 *	Author		: Sathrak paldurai K
 *	Date		: 04-07-2018							
 *	Description	: Chat Server Files.
 ******************************************************************************************************/
	/* Global Modules */
	var http 		= require('http');
	var path 		= require('path');
	var async 		= require('async'); 
	var express 	= require('express');
	var amqplib 	= require('amqplib');	
	var bodyParser 	= require('body-parser');
	var jwt 		= require('jsonwebtoken');
	
	//Config & Generic files included 
	var init 		= require('../config/init.js');
	var dbconfig 	= require('../config/config.js');
	
	//lib & Generic files included 
	var generic 	= require('../lib/funcgeneric.js');
		
		
	var redis 		= require('redis');
	var redisAdapt  = require('socket.io-redis');
	
	/*
		Setup Redis Connection
	*/
	var pub = redis.createClient(dbconfig.MREDISLBPORT, dbconfig.MREDISLBIP, { auth_pass: dbconfig.REDISPASS});
	pub.on("error", function (err) {
		console.error("Redis Pub Error " + err);
	});
	
	var sub = redis.createClient(dbconfig.SREDISLBPORT, dbconfig.SREDISLBIP, { auth_pass: dbconfig.REDISPASS});
	sub.on("error", function (err) {
		console.error("Redis Sub Error " + err);
	});
	
	/*
		Setup Express & Socket.io & redis adapter
	*/
	var app         = express();	
	var server = http.createServer(app);
	var io_s = require('socket.io')(server, {
		serveClient: false,		
		pingInterval: 10000,
		pingTimeout: 5000,
		cookie: false
	});
	/*
		Also use Redis for Session Store. Redis will keep all Express sessions in it.
	*/
	io_s.adapter(redisAdapt({ pubClient: pub, subClient: sub }));	
	io_s.of('/').adapter.on('error', function(){
		console.error("Redis adapter Error")
	});
	
	var io = io_s.of('/kschat');	
	
	/*
		Setup RabbitMQ Middlewares 
	*/
	var APPRABMQ;
	var start = +new Date();
	amqplib.connect('amqp://admin:admin@'+dbconfig.RabbitMQIP+':5672?heartbeat=60').then(function(conn) {			
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
			
	var sockcnt = 0;
	var sockets = {};
	
	/*
	 When the user logs in (in our case, does http POST w/ user name), Server Side verify the JWT Token key.
	*/	
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
		sockcnt++;
		
		/**
		 * When a socket connection is disconnect, That time Routing Key based unbind or delete the Queue. 
		 */	
		socket.on('disconnect', function () {			
			sockcnt = sockcnt - 1;
			console.error(socket.userid,"Member Disconnect - Socket Count :",socket.id);
			if(socket.queueid && socket.userid){
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
			delete sockets[socket.userid];	
			delete sockets[socket.id];			
		}); 
		
		socket.on('error', function (err) {
			console.error( socket.id+' : received error from client:',err)
		});
		
		/**
		 * When a user Logout a chat session, Routing Key based unbind or delete the Queue. 
		 */	
		socket.on("Logout", function(data,callback) 
		{	
			callback({RESPONSE:"Logout Emit is success.",uId:data.uId});
			if (!generic.empty(data.uId)){			
				var key = socket.queueid;
				APPRABMQ.then(function(ch) {
					var ex = 'direct_logs';
					var queue_pat = 'ks_'+socket.queueid;										
					var aqok = ch.unbindQueue(key,ex,queue_pat);
					aqok.then(function(q) {
						ch.deleteQueue(key);
					});
				});				
			}			
			socket.emit('RESPLOGOUT',{RC:1,ERR:0},function(lgresp){});
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
	
	app.set('port', process.env.PORT || 3000);	
	app.set('views', '/data/home/chatserver/views');
	app.set('view engine', 'ejs');
	app.use(express.static(path.join('/data/home/chatserver','/public')));
	
	// parse application/x-www-form-urlencoded
	app.use(bodyParser.urlencoded({extended:true}));
	
	// parse application/json
	app.use(bodyParser.json());
	
	app.get('/', function(req, res){
		console.log("Welcome to chat - Socket IO and Amqplib");
		return res.send("Welcome to chat - Socket IO and Amqplib");
	});	
	
	app.get('/kschat', function(req, res){
		var data = (!generic.empty(req.body)) ? req.body : req.query;
		res.render('client.ejs',{uid:data.uid,rid:data.rid,random:12232,tokenId:'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.-LyxQiT8BPIc74'});
	});
	
	server.listen(app.get('port'), () => {
		console.error('App-Server listening at port %d', app.get('port'));
	});