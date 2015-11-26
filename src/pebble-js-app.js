// Configuration

Pebble.addEventListener('showConfiguration', function(e) {
  // Show config page
  Pebble.openURL('http://songgen.herokuapp.com/pebble');
});

Pebble.addEventListener('webviewclosed', function(e) {
  // Decode and parse config data as JSON
  var config_data = JSON.parse(decodeURIComponent(e.response));
  console.log('Config window returned: ', JSON.stringify(config_data));

  // Prepare AppMessage payload
  var dict = {
    'KEY_ACCESS_TOKEN': config_data[access_token],
    'KEY_REFRESH_TOKEN': config_data[refresh_token]
  };

  // Send settings to Pebble watchapp
  sendToPebble(dict);
});

// Watchapp

Pebble.addEventListener("ready", function(e) {
  console.log("PebbleKit JS ready!");

  // Notify the watchapp that it is now safe to send messages
  Pebble.sendAppMessage({ 'KEY_JS_READY': true });
});

Pebble.addEventListener('generate', function(e) {
  // Decode and parse data from Pebble watchapp
  var request = e.payload;
  console.log('Received message: ' + JSON.stringify(request));

  generatePlaylist(request['KEY_ACCESS_TOKEN'], request['KEY_REFRESH_TOKEN'], request['KEY_WORDS']);
});

function generatePlaylist(access_token, refresh_token, words) {
  var req = new XMLHttpRequest();
  var url = 'http://songgen.herokuapp.com/build-playlist/with-words';
  var params = 'access_token=' + access_token + '&refresh_token=' + refresh_token + '&words=' + words;
  req.open('POST', url, true);
  
  req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  req.setRequestHeader("Content-length", params.length);
  //req.setRequestHeader("Connection", "close");
  
  req.onload = function () {
    if (req.readyState === 4) {
      if (req.status === 200) {
        console.log(req.responseText);
        var response = JSON.parse(req.responseText);
        
        // Prepare AppMessage payload
        var dict = {};
        if(response.refresh_token) {
          dict['KEY_ACCESS_TOKEN'] = response.access_token;
          dict['KEY_REFRESH_TOKEN'] = response.refresh_token;
        }
        dict['KEY_PLAYLIST_ID'] = response.playlistID;
        
        // Send response to Pebble watchapp
        sendToPebble(dict);
      } else {
        console.log('Error');
      }
    }
  };
  req.send(params);
}

function sendToPebble(dict) {
  console.log("Dictionary: " + JSON.stringify(dict));
  Pebble.sendAppMessage(dict, function(){
    console.log('Sent result data to Pebble');
  }, function() {
    console.log('Failed to send result data!');
  });
}