$(document).ready(function() {
	
	// ---------------------------------------------------------------------------------
	// OpenTok vars and functions
	// ---------------------------------------------------------------------------------
	var apiKey = '11427';
	var sessionId = '28757622dbf26a5a7599c2d21323765662f1d436';
	var token = 'devtoken';	
	
	var publisher;
	var session = TB.initSession(sessionId);
	
	// Set up event listeners
	session.addEventListener('sessionConnected', sessionConnectedHandler);
	session.addEventListener('streamCreated', streamCreatedHandler);
	session.connect(apiKey, token);
	
	// On session connect handler
	function sessionConnectedHandler(event) {
		var div = document.createElement('div');
		div.setAttribute('id', 'publisher');
		
		document.getElementById('publisher').appendChild(div);
		
		publisher = session.publish(div.id);
	}
	
	// On stream created handler
	function streamCreatedHandler(event) {
		for (var i = 0; i < event.streams.length; i++) {
			// Enable the identify button as soon as the publisher hits 'Allow'
			if (event.streams[i].connection.connectionId == session.connection.connectionId) {
				$("#identifyButton").css("display", "block");
			}
		}
	}
		
	// ---------------------------------------------------------------------------------
	// UI handlers
	// ---------------------------------------------------------------------------------	
	$("#identifyButton").click(function() {	
		var imgData = publisher.getImgData();
		
		// Attempt to identify the person in the image
		faceTokApp.identify(imgData);
		
		// Display the captured image on screen
		var img = document.createElement('img');
		img.setAttribute('src', "data:image/gif;base64," + imgData);
		
		$("#image-container").html(img);
	});
});

// ---------------------------------------------------------------------------------
// Application methods Methods
// ---------------------------------------------------------------------------------
var faceTokApp = {
	identify: function(imgData) {
				log.clear();
		
		imgurClient.getImageURL(imgData, function(url) {
			faceClient.recognizeImg(url, function(response) {				
				var tag = response;
				log.clear();
				
				if (!tag) {
					log.message("I didn't find any faces?!?!");
				} else {
					var name;
					if (tag.uids[0]) {
						// Tell the user to smile if they are not!
						if (tag.attributes.smiling.value == "false") {
							log.message("You're not smiling. Cheer up!");
						}
						
						// Parse the uid to get only the first name
						name = tag.uids[0].uid.split("@");
						log.message("Hello, " + name[0] + "!");
						
					} else {
						// Ask the unidentified user what their name is
						name = prompt("I didn't recognize you. What's your first name?");
						faceClient.tagImg(tag.tid, name, function(response) {
							log.clear();
							log.message("Image has been trained under name " + name + ".");
							log.message("Try detecting again.");
						});
					}
				}
			});
		});
	}
};

// ---------------------------------------------------------------------------------
// Face.com REST API Methods
// ---------------------------------------------------------------------------------
var faceClient = {	
	// Face.com variables	
	api_key: '1b01b5e7e7580de213bf6f404272141c',
	api_secret: '674706baed36d5b904531da18ed441f6',
	namespace: 'facetok',
	
	// Returns all the user ids in the namespace as a common separated string
	getUserIDs: function(callback) {
		var data = {
			api_key: faceClient.api_key,
			api_secret: faceClient.api_secret,
			namespaces: faceClient.namespace
		};

		log.message("getting user set...");
		$.ajax({
			url: 'http://api.face.com/account/users.json',
			data: data,
			type: "POST",
			crossDomain: true,
			dataType: 'jsonp',
			success: function (response) {
				log.message("got users.");
				var UIDString = "";					
				var users = response.users[faceClient.namespace];

				for (var i = 0; i < users.length; i++) {
					UIDString += users[i];
					if (i < users.length - 1) {
						UIDString += ",";
					}
				}					

				callback(UIDString);
			}
		});
	},
	
	// Takes a photo URL and returns the processed
	// image with tags and attributes
	detectImg: function(url, callback) {
		var data = {
			api_key: faceClient.api_key,
			api_secret: faceClient.api_secret,
			urls: url
		};

		$.ajax({
			url: 'http://api.face.com/faces/detect.json',
			data: data,
			type: "POST",
			crossDomain: true,
			dataType: 'jsonp',
			success: function(response) {
				callback(response.photos[0]);
			}
		});
	},
	
	// Saves the tagged photo to a user name
	// Returns the success / error status of the call
	tagImg: function(tid, name, callback) {
		var uid = name + "@" + faceClient.namespace;
		
		var data = {
			api_key: faceClient.api_key,
			api_secret: faceClient.api_secret,
			tids: tid,
			uid: uid
		};
		
		log.message("saving tag...");
		$.ajax({
			url: 'http://api.face.com/tags/save.json',
			data: data,
			type: "POST",
			crossDomain: true,
			dataType: 'jsonp',
			success: function (response) {
				log.message("tag saved.");
				callback(response);
			}
		});			
	},
	
	// Takes a photo URL and returns the highest accuracy tag
	recognizeImg: function(url, callback) {			
		faceClient.getUserIDs(function(response) {
			var data = {
				api_key: faceClient.api_key,
				api_secret: faceClient.api_secret,
				urls: url,
				uids: response
			};
			
			if (data.uids.length >= 1) {
				log.message("looking for users in image...");
				$.ajax({
					url: 'http://api.face.com/faces/recognize.json',
					data: data,
					type: "POST",
					crossDomain: true,
					dataType: 'jsonp',
					success: function(response) {
						log.message("done looking.");
						// Here I'm making the assumption that there is only one photo
						// and only one tag. Iterate the arrays to make it more robust.
						if (response.photos[0].tags.length > 0) {
							callback(response.photos[0].tags[0]);		
						} else {
							callback(null);
						}										
					}
				});				
			} else {
				faceClient.detectImg(url, function(response) {
					callback(response.tags[0]);
				});
			}		
		});						
	}		
};

// ---------------------------------------------------------------------------------
// Imgur REST API Methods
// ---------------------------------------------------------------------------------
var imgurClient = {
	// Imgur variables
	api_key: 'f9d2936ab67d16145c6966a2f01a0a28',
	
	// Takes a base64 string and returns a link to the image
	getImageURL: function(imgData, callback) {
		var data = {
			key: imgurClient.api_key,
			image: imgData,
			type: 'base64'
		};
		
		log.message("saving image...");
		$.post('http://api.imgur.com/2/upload.json', data, function(response) {
			log.message("image saved.");
			callback(response.upload.links.original);
		});	
	}
};

// ---------------------------------------------------------------------------------
// Logging Methods
// ---------------------------------------------------------------------------------
var log = {
	// Writes a message to the logging area
	message: function(message) {
		var log = $("<li />", {
			text: message
		});
		
		$("#logs").prepend(log);
	},
		
	// Clears the logging area
	clear: function() {
		$("#logs").html('');
	}
};