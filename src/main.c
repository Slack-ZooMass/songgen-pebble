#include <pebble.h>

static Window *s_main_window;
static TextLayer *s_top_layer, *s_prompt_layer;

// Keys for communicating with JS
typedef enum {
  KEY_JS_READY = 0,
  KEY_CREDENTIALS_SAVED = 3,
  KEY_ERROR_CREDENTIALS_MISSING = 4,
  KEY_WORDS = 5,
  KEY_PLAYLIST_ID = 6,
  KEY_ERROR_HTTP = 7
} AppKey;

static DictationSession *s_dictation_session;
static char s_last_text[256];

static bool s_speaking_enabled;
static bool s_js_ready;

/********************************* Quiz Logic *********************************/

static void prompt_handler(void *context) {
  text_layer_set_text(s_top_layer, "songgen");
  text_layer_set_text(s_prompt_layer, "Press Select to create a new playlist!");
  window_set_background_color(s_main_window, GColorDarkGray);
  s_speaking_enabled = true;
}

static void result_handler(char *playlistID) {
  text_layer_set_text(s_top_layer, playlistID);
  text_layer_set_text(s_prompt_layer, "Press Select to create a new playlist!");
  window_set_background_color(s_main_window, GColorDarkGray);
  app_timer_register(5000, prompt_handler, NULL);
}

static void generate(char *transcription) {
  text_layer_set_text(s_top_layer, "songgen");
  text_layer_set_text(s_prompt_layer, "Sending to server...");

  //TODO: Send to server
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);

  if (!iter) {
    // Error creating outbound message
    return;
  }

  dict_write_cstring(iter, KEY_WORDS, transcription);
  dict_write_end(iter); //?

  app_message_outbox_send();
}

/******************************* Dictation API ********************************/

static void dictation_session_callback(DictationSession *session, DictationSessionStatus status,
                                       char *transcription, void *context) {
  if(status == DictationSessionStatusSuccess) {
    // Generate the words into a playlist
    generate(transcription);
  } else {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Transcription failed.\n\nError ID:\n%d", (int)status);
  }
}

/******************************** JavaScript *********************************/

static void inbox_received_handler(DictionaryIterator *iter, void *context) {
  Tuple *ready_tuple = dict_find(iter, KEY_JS_READY);
  if(ready_tuple) {
    // PebbleKit JS is ready! Safe to send messages
    s_js_ready = true;
  }
  
  Tuple *playlistID_tuple = dict_find(iter, KEY_PLAYLIST_ID);
  if(playlistID_tuple) {
    // We completed creating a playlist!
    result_handler(playlistID_tuple->value->cstring); //TODO: check this
  }
  
  // Errors
  
  Tuple *error_credentials_missing = dict_find(iter, KEY_ERROR_CREDENTIALS_MISSING);
  if(error_credentials_missing) {
    // Let the UI know to go to config!
  }
  
  Tuple *error_http = dict_find(iter, KEY_ERROR_HTTP);
  if(error_http) {
    // Let the UI know the internet isnt working!
    // Also let them retry!
  }
}

/************************************ App *************************************/

static void select_click_handler(ClickRecognizerRef recognizer, void *context) {
  if(s_speaking_enabled && s_js_ready) {
    // Start voice dictation UI
    dictation_session_start(s_dictation_session);
    s_speaking_enabled = false;
  }
}

static void click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click_handler);
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  s_top_layer = text_layer_create(GRect(5, 5, bounds.size.w - 10, bounds.size.h));
  text_layer_set_font(s_top_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
  text_layer_set_text_color(s_top_layer, GColorWhite);
  text_layer_set_text_alignment(s_top_layer, GTextAlignmentCenter);
  text_layer_set_background_color(s_top_layer, GColorClear);
  layer_add_child(window_layer, text_layer_get_layer(s_top_layer));

  s_prompt_layer = text_layer_create(GRect(5, 100, bounds.size.w - 10, bounds.size.h));
  text_layer_set_text(s_prompt_layer, "Press Select to create a new playlist!");
  text_layer_set_font(s_prompt_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_color(s_prompt_layer, GColorWhite);
  text_layer_set_text_alignment(s_prompt_layer, GTextAlignmentCenter);
  text_layer_set_background_color(s_prompt_layer, GColorClear);
  layer_add_child(window_layer, text_layer_get_layer(s_prompt_layer));

#if defined(PBL_ROUND)
  const uint8_t inset = 3;

  text_layer_enable_screen_text_flow_and_paging(s_top_layer, inset);
  text_layer_enable_screen_text_flow_and_paging(s_prompt_layer, inset);
#endif
}

static void window_unload(Window *window) {
  text_layer_destroy(s_prompt_layer);
  text_layer_destroy(s_top_layer);
}

static void init() {
  s_main_window = window_create();
  window_set_click_config_provider(s_main_window, click_config_provider);
  window_set_window_handlers(s_main_window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload,
  });
  window_stack_push(s_main_window, true);

  // Create new dictation session
  s_dictation_session = dictation_session_create(sizeof(s_last_text),
                                                 dictation_session_callback, NULL);
  
  window_set_background_color(s_main_window, GColorDarkGray);
  text_layer_set_text(s_top_layer, "songgen");
  s_speaking_enabled = true;
  s_js_ready = false;
  
  //TODO: persistent storage load for credentials
  
  // Handle talking to JS
  app_message_register_inbox_received(inbox_received_handler);
  app_message_open(64, 64);
}

static void deinit() {
  // Free the last session data
  dictation_session_destroy(s_dictation_session);
  
  //TODO: persistent storage for credentials

  window_destroy(s_main_window);
}

int main() {
  init();
  app_event_loop();
  deinit();
}