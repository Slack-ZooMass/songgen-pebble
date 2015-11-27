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

  // Send settings to Pebble watchapp
  sendToPebble({ 'KEY_CREDENTIALS_SAVED': true });
});

// Watchapp

Pebble.addEventListener('ready', function(e) {
  console.log('PebbleKit JS ready!');

  // Notify the watchapp that it is now safe to send messages
  sendToPebble({ 'KEY_JS_READY': true });
});

Pebble.addEventListener('appmessage', function(e) {
  // Decode and parse data from Pebble watchapp
  var request = e.payload;
  console.log('Received message: ' + JSON.stringify(e));
  
  var access_token = localStorage.getItem('KEY_ACCESS_TOKEN');
  var refresh_token = localStorage.getItem('KEY_REFRESH_TOKEN');
  var words = request['KEY_WORDS'];
  
  console.log('access_token: ' + access_token);
  console.log('refresh_token: ' + refresh_token);
  console.log('words: ' + words);
  
  if (access_token && refresh_token) {
    generatePlaylist(access_token, refresh_token, words);
  } else {
    sendToPebble({ 'KEY_ERROR_CREDENTIALS_MISSING': true });
  }
  
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
        
        if (response.refresh_token) {
          // Save to persistent storage on phone
          localStorage.setItem('KEY_ACCESS_TOKEN', config_data['access_token']);
          localStorage.setItem('KEY_REFRESH_TOKEN', config_data['refresh_token']);
        }
        
        // Send response to Pebble watchapp
        sendToPebble({ 'KEY_PLAYLIST_ID': response.playlistID });
      } else {
        console.log('Error with request');
        sendToPebble({ 'KEY_ERROR_HTTP': true });
      }
    }
  };
  req.send(params);
}

function sendToPebble(dict) {
  console.log("Dictionary: " + JSON.stringify(dict));
  Pebble.sendAppMessage(dict, function() {
    console.log('Sent result data to Pebble');
  }, function() {
    console.log('Failed to send result data!');
  });
}