/* Global variables & requires */
var Maker 		= require('../../../models/maker'),
	mongoose 	= require('mongoose'),
	https 		= require('https'),
	async 		= require('async'),
	Team 		= require('../../../models/team').Team,
	ago = require('ago'),
	riotAPIkey 	= '?api_key=1234567890';

module.exports.set = function(app) {
	/* Attempting to verify the user is the owner of the Leage of Legends account */

	/* Posting to the route */	
	app.post('/maker/:id/verified', function(req, res) {

		/* Create a default response object set to return 400 */
		var response = {
			ready: false,
			status: 400,
			message: {
				error: 'Bad Request'
			}
		},

		/* Create an object to hold all relvant global varibles */
		info = {
			apikey: riotAPIkey, /* Your Riot api key */
			makerid: req.params.id || null, /* Maker ID obtained from url params */
			token: req.headers.token || null, /* User's access token sent with post */
			summonername: req.body.summonername || null, /* User's league of legends name sent with post */
			region: req.body.region || null, /* User's league of legends region sent with post */
			ownerName: null, /* Name of the requested account */
			callerid: null, /* ID of the user making the post */
			code: null, /* verification code */
			summonerid: null, /* League of Legends ID from Riot API */
			masteries: null, /* League of Legends Mastery list from Riot API */
			verified: null, /* Verification status */
			teams: [] /* List of team's the user is on */
		};

		/* Initialize async using the "series" control flow */
		async.series({
			checkParams: function(cb){
				console.log('-------------------------');
				console.log('1. Checking Paramenters');
				console.log('-------------------------');
				console.log('makerid:' + info.makerid);
				console.log('summonername:' + info.summonername);
				console.log('region:' + info.region);
				if(!info.makerid || !info.summonername || !info.region){
					response.ready = true;
					response.status = 404;
					response.message = {
						error: 'Bad Request'
					};

					console.log('----------------------');
					console.log('FAIL! -- 1');
					console.log('----------------------');
					cb(true, null);
				}else{
					cb(false, null);
				}
			},
			checkMaker: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('2. Checking maker');
				console.log('-------------------------');

				Maker.findById(info.makerid, function (err, maker){
					console.log('makername: ' + maker.username);

					if(err || !maker){
						
						response.ready = true;
						response.status = 404;
						response.message = {
							error: 'User does not exist'
						};

						console.log('----------------------');
						console.log('FAIL! -- 2');
						console.log('----------------------');
						cb(true, null);
					} else {
						cb(false, null);
					}
				});
			},
			authorize: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('3. Authorizing');
				console.log('-------------------------');
				Maker.authorize(info.token, function (err, ownerName){
					if(!err && ownerName){
						console.log('token: ' + info.token);
						info.ownerName = ownerName;
						console.log('ownerName: ' + info.ownerName);
						cb(false, null);
					} else {
						response.ready = true;
						response.status = 401;
						response.message = {
							error: 'Unable to Authorize'
						};
						console.log('----------------------');
						console.log('3. Authorizing - FAIL!');
						console.log('----------------------');
						cb(true, null);
					}
				});
			},
			findCaller: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('4. Find Caller');
				console.log('-------------------------');

				Maker.findOne({username: info.ownerName }, function (err, loggedInAs){
					if(!err && loggedInAs){
						info.callerid = loggedInAs.id;
						info.code = loggedInAs.code;
						info.verified = loggedInAs.verified;
						console.log('callerid: ' + info.callerid);
						console.log('code: ' + info.code);
						console.log('verified: ' + info.verified);
						cb(false, null);
					}else{
						response.ready = true;
						response.status = 401;
						response.message = {
							error: 'Unable to Authorize'
						};
						console.log('----------------------');
						console.log('FAIL! -- 4');
						console.log('----------------------');
						cb(true, null);
					}
				});
			},
			checkOwnership: function(cb) {
				console.log('');
				console.log('-------------------------');
				console.log('5. Check Owner');
				console.log('-------------------------');
				console.log('makerid:' + info.makerid);
				console.log('callerid:' + info.callerid);
				console.log('verified:' + info.verified);

				if(info.makerid !== info.callerid || info.verified === true){
					response.ready = true;
					response.status = 401;
					response.message = {
						error: 'Not Authorized'
					};
					console.log('----------------------');
					console.log('FAIL! -- 5');
					console.log('----------------------');
					cb(true, null);
				} else {
					cb(false, null);
				}
			},
			getSummonerID: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('6. Get Summoner ID');
				console.log('-------------------------');
				https.get('https://prod.api.pvp.net/api/lol/'+ info.region +'/v1.3/summoner/by-name/'+ info.summonername + info.apikey, function (res) {
			    	var str = '';

			    	//compile all the response data into a string
		        	res.on('data', function (chunk) {
		               str += chunk;
		         	});

		        	//After response...
		        	res.on('end', function () {
		        		//parse the response string into a JSON object
		        		var riotResponse = JSON.parse(str);
		        		
		        		//Find the summonerName property of summoner object
		        		for(key in riotResponse) {
		        			//Set the key of the object to the summonername
		        			if(key === info.summonername) {
		        				//set the summoner ID of the summoner

						    	info.summonerid = riotResponse[key].id;
						    	console.log(info.summonerid);
						    	cb(false, null);
						    }
						}
					});
					
				});
			},
			getMasteries: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('7. Get Masteries');
				console.log('-------------------------');
				if(info.summonerid){
					//Call Riot API to check masteries
			    	https.get('https://prod.api.pvp.net/api/lol/'+info.region+'/v1.3/summoner/'+ info.summonerid +'/masteries'+ info.apikey, function(res) {
				    	var str = '';

				    	//compile all the response data into a string
			        	res.on('data', function (chunk) {
			               str += chunk;
			         	});

			        	//After response...
			        	res.on('end', function () {

			        		//parse the response string into a JSON object
			        		var riotResponse = JSON.parse(str);
			        		//Find the summonerID property of Masteries object
			        		for(key in riotResponse) {
			        			//Set the key of the object to the summonerID
			        			if(key == info.summonerid) {
			        				//Get the total # of masteries
									info.masteries = riotResponse[key].pages;
									cb(false, null);
								}
			        		}
			        	});
					});
				} else {
					response.ready = true;
					response.status = 401;
					response.message = {
						error: 'Incorrect Summoner Name and/or Region'
					};
					console.log('----------------------');
					console.log('FAIL! -- 7');
					console.log('----------------------');
					cb(true, null);
				}
			},
			checkMasteries: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('8. Check Masteries');
				console.log('-------------------------');
				if(info.masteries){
					count = info.masteries.length;
					console.log('Mastery Count:' + count);
					//Cycle through each Mastery
					for(var x = 0; x < count; x++){
						//Check if the Mastery name = verification code
						if (info.code == info.masteries[x].name){
							info.verified = true;
							cb(false, null);
							break;
						} 
					}
				}else{
					response.ready = true;
					response.status = 401;
					response.message = {
						error: 'Cannot find Masteries'
					};
					console.log('----------------------');
					console.log('FAIL! -- 8');
					console.log('----------------------');
					cb(true, null);
				}
			},
			getTeams: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('7. Get Teams');
				console.log('-------------------------');
				if(info.summonerid){
					//Call Riot API to check masteries
			    	https.get('https://prod.api.pvp.net/api/lol/'+ info.region + '/v2.2/team/by-summoner/'+ info.summonerid + info.apikey, function(res) {
				    	var str = '';

				    	//compile all the response data into a string
			        	res.on('data', function (chunk) {
			               str += chunk;
			         	});

			        	//After response...
			        	res.on('end', function () {

			        		//parse the response string into a JSON object
			        		var riotResponse = JSON.parse(str);
			        		for(var x=0; x<riotResponse.length; x++){
			        			console.log(riotResponse[x].fullId);
			        			info.teams.push(riotResponse[x]);
			        		}
			   				cb(false, null);
			        	});
					});
				} else {
					response.ready = true;
					response.status = 401;
					response.message = {
						error: 'Incorrect Summoner Name and/or Region'
					};
					console.log('----------------------');
					console.log('FAIL! -- 7');
					console.log('----------------------');
					cb(true, null);
				}
			},
			verifyAccount: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('9. Verify Account');
				console.log('-------------------------');
				if(!info.verified){
					response.ready = true;
					response.status = 401;
					response.message = {
						error: 'Cannot find verification code in Masteries'
					};
					console.log('----------------------');
					console.log('FAIL! -- 9');
					console.log('----------------------');
					cb(true, null);
				} else {
					console.log('Verified is now -> ' + info.verified);
					cb(false, null);
				}
			},
			updateVerification: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('10. Update Verification');
				console.log('-------------------------');
				Maker.findById(info.makerid, function (err, thisMaker) {
					if(!err && thisMaker){
						thisMaker.verified = true;
						thisMaker.information.summonerid = info.summonerid;
						thisMaker.information.summonername = info.summonername;
						thisMaker.information.region = info.region;
						thisMaker.teams.remove();
						for(var x = 0; x < info.teams.length; x++){
							thisMaker.teams.push({	team: info.teams[x] });
						}

						console.log(thisMaker.teams);
						thisMaker.save(function(err){
							if(!err){
								response.ready = true;
								response.status = 200;
								response.message = {
									success: "Verified"
								};
								cb(false, null);
							} else {
								response.ready = true;
								response.status = 400;
								response.message = {
									error: 'Cannot verify User'
								};
								console.log('----------------------');
								console.log('FAIL! -- 10');
								console.log(err);
								console.log('----------------------');
								cb(true, null);
							}
						});
						
					} else {
						response.ready = true;
						response.status = 404;
						response.message = {
							error: 'Cannot find User'
						};
						console.log('----------------------');
						console.log('FAIL! -- 10');
						console.log('----------------------');
						cb(true, null);
					}
				});
			},
			createTeams: function(cb){
				console.log('');
				console.log('-------------------------');
				console.log('12. Create Teams');
				console.log('-------------------------');

				/* Add the teams to the MongoDB */

				for(var x = 0; x < info.teams.length; x++){
							//thisMaker.teams.push({	team: info.teams[x] });		
					var t = {
						teamid: info.teams[x].fullId,
						name: info.teams[x].name,
						wins: info.teams[x].teamStatSummary.teamStatDetails[1].wins,
						losses: info.teams[x].teamStatSummary.teamStatDetails[1].losses,
						members: []
					};

					for(var y = 0; y< info.teams[x].roster.memberList.length; y++){
						var summonerid = info.teams[x].roster.memberList[y].playerId;
						t.members.push({summonerid: summonerid});
					}

					Team.findOne({teamid: t.teamid}, function (err, thisTeam){
						var self = this;

						if(err){
							console.log (err);
							self.create(t, function (err, done){
								console.log(done);
							});
						} else {
							thisTeam.wins = t.wins;
							thisTeam.losses = t.losses;
							thisTeam.members = t.members;
							thisTeam.lastcall = ago.fromNow(30, "minutes");
							thisTeam.save(function (err, done){
								console.log(done);
							});
						}
					});
				}
				cb(false, null);
			}
		},
		function(err, results) {
			if (err){
				console.log('-------------------------');
				console.log('12. Success');
				console.log('-------------------------');
				console.log('sending: res.json('+response.status+', '+response.message+')');
				res.json(response.status, response.message);
			} else {
				console.log('sending: res.json('+response.status+', '+response.message+')');
				res.json(response.status, response.message);
			}

		});
	});
}