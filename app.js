/**********************************************************************************************
 *	Filename	: index.js							
 *	Author		: Sathrak paldurai K
 *	Date		: 04-07-2018								
 *	Description	: Chat Server.
***********************************************************************************************/
	console.log = function(){};	
	
	process.on('uncaughtException', function (err) {
		console.error('UncaughtException:', err.message);
		console.error('UncaughtException:'+err.stack);
	});

	require('./bin/server');	
	
	const numeral = require('numeral');
	setInterval(() => {
		const { rss, heapTotal} = process.memoryUsage();
		console.log('rss', numeral(rss).format('0.0 ib'),
			'heapTotal', numeral(heapTotal).format('0.0 ib'));
	},5000);