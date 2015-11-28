// Configuration

Pebble.addEventListener('showConfiguration', function(e) {
  // Show config page
  Pebble.openURL('http://songgen.herokuapp.com/pebble');
});

Pebble.addEventListener('webviewclosed', function(e) {
  // Decode and parse config data as JSON
  var config_data = JSON.parse(decodeURIComponent(e.response));
  console.log('Config window returned: ', JSON.stringify(config_data));
  
  // Save to persistent storage on phone
  localStorage.setItem('KEY_ACCESS_TOKEN', config_data['access_token']);
  localStorage.setItem('KEY_REFRESH_TOKEN', config_data['refresh_token']);

  // Notify the watchapp that it is now safe to send messages
  sendToPebble({ 'KEY_JS_READY': true });
});

// Watchapp

Pebble.addEventListener('ready', function(e) {
  console.log('PebbleKit JS ready!');
  
  var access_token = localStorage.getItem('KEY_ACCESS_TOKEN');
  var refresh_token = localStorage.getItem('KEY_REFRESH_TOKEN');

  if (access_token && refresh_token) {
    // Notify the watchapp that it is now safe to send messages
    sendToPebble({ 'KEY_JS_READY': true });
  } else {
    // We need the user to go to the configuration screen
    sendToPebble({ 'KEY_ERROR_CREDENTIALS_MISSING': true });
  }
});

Pebble.addEventListener('appmessage', function(e) {
  // Decode and parse data from Pebble watchapp
  var request = e.payload;
  console.log('Received message: ' + JSON.stringify(e));
  
  var url = 'http://songgen.herokuapp.com/build-playlist/with-words';
  var params = {
    access_token : localStorage.getItem('KEY_ACCESS_TOKEN'),
    refresh_token : localStorage.getItem('KEY_REFRESH_TOKEN'),
    words : request['KEY_WORDS'].split(' ')
  };
  
  if (params.access_token && params.refresh_token) {
    post(url, params, function(response) {
      var access_token = response.access_token;
      var playlistID = response.playlistID;
      
      if (access_token) {
        // Save to persistent storage on phone
        localStorage.setItem('KEY_ACCESS_TOKEN', access_token);
      }

      // Send response to Pebble watchapp
      sendToPebble({ 'KEY_PLAYLIST_ID': playlistID });
    });
  } else {
    sendToPebble({ 'KEY_ERROR_CREDENTIALS_MISSING': true });
  }  
});

function post(url, params, callback) {
  var req = new XMLHttpRequest();
  req.open('POST', url, true);
  
  req.setRequestHeader("Content-type", "application/json");
  req.setRequestHeader("Content-length", params.length);
  //req.setRequestHeader("Connection", "close");
  
  req.onload = function () {
    if (req.readyState === 4) {
      if (req.status === 200) {
        console.log(req.responseText);
        callback(JSON.parse(req.responseText));
      } else {
        console.log('Error with request');
        sendToPebble({ 'KEY_ERROR_HTTP': true });
      }
    }
  };
  req.send(JSON.stringify(params));
}

function sendToPebble(dict) {
  console.log("Dictionary: " + JSON.stringify(dict));
  Pebble.sendAppMessage(dict, function() {
    console.log('Sent result data to Pebble');
  }, function() {
    console.log('Failed to send result data!');
  });
}