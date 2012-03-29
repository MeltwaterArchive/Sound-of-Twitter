/**
 * <h2>Example</h2>
 *
 * We need to call two functions to start this off
 *
 * The first is DataSift.connect, which we can pass the username and API key,
 * this will instanitate the DataSift object
 *
 * DataSift.connect(false, false);
 *
 * Secondly we need to register hashes and callback to the function
 *
 * 	DataSift.register('e4941c3a0b4a905314ce806dea26e0d7', {
 *		onMessage: function(data) {console.log(data);}
 *	});
 *
 */
(function() {

	window.DataSiftGoogleLoaded = function(){
		window.DataSift.googleLoadedCallbacks.forEach(function(callback){
			callback(true);
		});
	}

	window.DataSift = {

		username: null,
		apikey: null,
		host:null,

		idCounter: 0,

		storage: {},
		storageMax: 50,
		jsonpStarted: false,
		jsonpConnected: false,


		wsTimeoutTimer: null,
		wsTimeoutCount:0,
		wsTimeoutMax: 2,
		wsCloseCount:0,
		wsCloseMax: 5,
		wsConnected: false,
		wsConnectCallbacks: [],

		debug: false,

		/**
		 * Start a new DS connection
		 *
		 * @param username(string): username
		 * @param apikey(string): apikey of the user
		 * @param endpoint An alternative endpoint to use. defaults to stream.ds
		 */
		connect: function(username, apikey, host) {

			// check to see if it already exsits
			if (window.Datasift) {
				return;
			} else {
				window.Datasift = {};
			}

			this.username = username;
			this.apikey = apikey;
			this.host = host;

			// use websockets if supported
			if ("WebSocket" in window || "MozWebSocket" in window) {
				this.websocket('ws://' + host);
			} else {
				// JSONP start the timer
				this.jsonp();
			}
		},

		/**
		 * Register a new set of callback for DS
		 *
		 * @param hash(string): The hash of the stream
		 * @param options(object):
		 *		onOpen(function): What to do when we open a connection
		 *		onMessage(function): What to do when we recieve a message
		 *		onError(function): What to do when we error
		 */
		register: function(hash, options) {

			// register the callback options
			options.onOpen = options.onOpen ? options.onOpen : function() {};
			options.onMessage = options.onMessage ? options.onMessage : function() {};
			options.onError = options.onError ? options.onError : function(data) {this.error(data);}.bind(this);
			options.onClose = options.onClose ? options.onClose : function() {};

			// do we already have this hash
			if (!window.Datasift[hash]) {
				window.Datasift[hash] = {
					data: function(data) {
						// if we have a stream then break it up and distribute
						if (data.stream !== undefined) {
							// broadcast "open"
							if (!this.jsonpConnected) {
								this.jsonpConnected = true;
								this.broadcast('Open');
							}
							// broadcast "message"
							data.stream.each(function(d){
								this.broadcast('Message', {hash: hash, data: d});
								window.Datasift[hash].lastInteractionId = d.interaction.id;
							}.bind(this));
						} else {
							this.distribute(data, hash)
						}
					}.bind(this),
					callbacks: new Array()
				};
			}

			// generate a unquie id for this app
			var id = hash + '_' + this.idCounter++;
			// push the callbacks onto the hash
			window.Datasift[hash].callbacks.push({
				id: id,
				options: options
			});

			// subscribe
			if (this.socket) {
				var msg = '{ "action":"subscribe", "hash":"' + hash + '"}';
				try {
					this.socket.send(msg);
				} catch (err) {}
			}

			// return the ID to the app, it will need this to unsubscribe
			return id;
		},

		unregister: function(id) {
			// split apart the id
			var hash = id.split('_')[0];

			if (!window.Datasift[hash]) {
				throw 'Cannot find Hash';
			}

			for (var i = 0; i < window.Datasift[hash].callbacks.length; i++) {
				if (window.Datasift[hash].callbacks[i].id == id) {
					// destroy, we can't use a delete because it will leave a hole in the array
					window.Datasift[hash].callbacks.splice(i, 1);
				}
			}

			if (window.Datasift[hash].callbacks.length == 0) {
				// remove the hash & unsubscribe the socket
				if (this.socket) {
					var msg = '{ "action":"unsubscribe", "hash":"' + hash + '"}';
					this.socket.send(msg);
				}
				delete(window.Datasift[hash]);
			}
		},

		/**
		 * Test a string to see if it is valid JSON
		 *
		 * @params str The string to test
		 */
		isJSON: function(str) {
			if (str.length == 0) return false;
			str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
			str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
			str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
			return (/^[\],:{}\s]*$/).test(str);
		},

		/**
		 * Attempt to evaulate the JSON, this will first attempt to sanitize
		 * the script before evaluating it.
		 *
		 * @params data The string you want to parse
		 */
		evalJSON: function(data) {
			var json = data.replace(/^\/\*-secure-([\s\S]*)\*\/\s*$/, '$1');
			cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

			if (cx.test(json)) {
				json = json.replace(cx, function (a) {
					return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
				});
			}

			try {
				if (!data || this.isJSON(json)) return eval('(' + json + ')');
			} catch (e) { }
			throw('Badly formed JSON string');
		},

		/**
		 * Start a new websocket call
		 *
		 * @throws If the browser doesn't support websockets
		 *
		 * @TODO Need to add support for firefox websockets
		 */
		websocket: function(endpoint) {
			if (window['WebSocket'] == undefined && window['MozWebSocket'] == undefined) {
				throw 'Websocket not implemented in this browser';
			}
			var url = endpoint;
			if (url == undefined || !url){
				url='ws://websocket.datasift.com';
			}

			url += '?username=' + this.username + '&api_key=' + this.apikey;

			try {
				this.socket = new WebSocket(url);
			} catch (e) {
				this.socket = new MozWebSocket(url);
			}

			// start the timeout timer
			this.wsTimeoutTimer = setTimeout(function() {
				this.wsTimeoutCount++;

				// try to close
				try {
					this.socket.onopen = null;
					this.socket.onmessage = null;
					this.socket.onclose = null;
					this.socket.onerror = null;

					// if open or connecting we can close
					this.socket.close();
				} catch (e) {}

				// clear timer
				clearTimeout(this.wsTimeoutTimer);
				this.wsTimeoutTimer = null;

				// check if we are over the limit
				if (this.wsTimeoutCount > this.wsTimeoutMax) {
					// close and go to JSONP
					if (this.debug) console.log("WebSocket connection timed out " + this.wsTimeoutMax + " times. Falling back to JSONP");
					// call the callbacks telling them they have not got a ws connection
					this.wsConnectCallbacks.each(function(cb){
						cb(false);
					}.bind(this));
					this.jsonp();
				} else {
					// reconnect
					if (this.debug) console.log("WebSocket connection timed out. Retrying WebSocket");
					this.websocket(endpoint);
				}

			}.bind(this), 1000);

			// when the socket is open
			this.socket.onopen = function(data) {
				this.wsConnected = true;
				// clear the timeout timer
				clearTimeout(this.wsTimeoutTimer);
				this.wsTimeoutTimer = null;

				// call the callbacks telling them they have not got a ws connection
				for (obj in this.wsConnectCallbacks) {
					if (this.wsConnectCallbacks.hasOwnProperty(obj)) {
						this.wsConnectCallbacks[obj](true);
					}
				}

				// broadcast the open message
				this.broadcast('Open', data);

				// subscribe all registered hashes to the datasift service AKA multi stream
				this.subscribe();

			}.bind(this);

			this.socket.onmessage = function(data) {
				this.broadcast('Message', this.evalJSON(data.data));
			}.bind(this);

			this.socket.onerror = function(data) {
				this.wsConnected = false;
				this.broadcast('Error', data);
				this.connectionCount++;
			}.bind(this);

			this.socket.onclose=function(data) {
				this.wsConnected = false;
				//Clear the timeout timer
				clearTimeout(this.wsTimeoutTimer);
				this.wsTimeoutTimer = null;

				//If we have closed too many times then fallback to JSONP
				//Start the timeout timer
				this.wsCloseCount++;

				//Check if we are over the limit
				if (this.wsCloseCount > this.wsCloseMax) {
					//Close and go to JSONP
					if (this.debug) console.log("WebSocket connection closed " + this.wsCloseMax + " times. Falling back to JSONP");
					this.wsConnectCallbacks.each(function(cb){
						cb(false);
					}.bind(this));
					this.jsonp();
				} else {
					//Reconnect
					if (this.debug) console.log("WebSocket connection closed. Retrying.");
					//Wait a second before trying
					setTimeout(function(){
						this.websocket(endpoint);
					}.bind(this), 500);
				}

				//Broadcast close
				this.broadcast('Close', data);
				this.connectionCount++;
			}.bind(this);

		},

		/**
		 * Jsonp call, this will create the script tag on the page, with a id
		 * related to the hash of the stream
		 */
		jsonp: function() {
			this.jsonpStarted = true;

			for (hash in window.Datasift) {
				if (window.Datasift[hash].pollCount === undefined) {
					window.Datasift[hash].pollCount = 0;
				}

				window.Datasift[hash].pollCount++;

				var script = document.createElement('script');
				// count set to 20 as anymore will get dropped from the queue
				// random number used to stop the browser caching the result
				// interaction ID set to make sure old data is not re-displayed
				script.src =
					'http://api.datasift.com/stream.jsonp?hash=' + hash +
					'&count=200&callback=window.Datasift[\'' + hash + '\'].data'
					+ (window.Datasift[hash].lastInteractionId !== undefined ?
					'&interaction_id=' + window.Datasift[hash].lastInteractionId : '') +
					'&random=' + Math.random() + '&username=' + this.username +
					'&api_key=' + this.apikey;
				script.id = 'ds-' + hash;
				document.body.appendChild(script);

				if (window.Datasift[hash].pollCount == 1) {
					this.broadcast('Open');
				}
			}

			setTimeout(function() {
				this.jsonp();
			}.bind(this), 5000);
		},

		/**
		 * Once we recieve the data from the stream we need to destroy the tags
		 *
		 * @param data(object): The data we recieve
		 * @param hash(string): The hash of the stream
		 */
		distribute: function(data, hash) {
			// remove the scripts
			var script = document.getElementById('ds-' + hash);
			script.parentNode.removeChild(script);

			if (data.error !== undefined) {
				this.broadcast('Error', data, hash);
			} else {
				this.broadcast('Message', data, hash);
			}
		},

		/**
		 * Broadcast to all the binded apps that we have recieved an action for
		 * them. It is then up to the specific apps to handle that message. They
		 * will recieve notifications of:
		 *		- Message Recieved
		 *		- Connection Opened
		 *		- Connection Closed
		 *		- Error Recieved
		 *
		 * @params data(object): The data to send
		 * @params hash(string): The string to send
		 */
		broadcast: function(action, data) {
			// warning, failure
			if (data && data.status && (data.status == 'warning' || data.status == 'failure')) {
				action = 'Error';
			}

			if (action == 'Error' && typeof data !== 'string') {
				// data should be a string
				if (data.error !== undefined) {
					data.message = data.error;
				} else if (data.warning !== undefined) {
					data.message = data.warning;
				}
			}

			for (hash in window.Datasift){
				var l = window.Datasift[hash].callbacks.length;
				for (var i = 0; i < l; i++) {
					window.Datasift[hash].callbacks[i]['options']['on' + action](data);
				}
			}
		},

		/**
		 * Even if the subscribers call register we can't actually regiser them
		 * with the datasift service until the onopen even occurs otherwise we'll
		 * get an invalid state exception so this is invoked automatically after broadcasting
		 * the onopen event
		 */
		subscribe:function(){
			for (var hash in window.Datasift){
				var msg = '{ "action":"subscribe", "hash":"'+hash+'"}';
				this.socket.send(msg);
			}
		}
	}

	if (window.DataSiftLoaded !== undefined) {
		window.DataSiftLoaded();
	}
})();

/**
 * This is bad, but we need the bind function in browsers which don't support ECMA script 5
 */
if (!Function.prototype.bind) {
	Function.prototype.bind = function(t) {
		var args = Array.prototype.slice.call(arguments, 1);
		toBind = this;
		empty = function() {};
		bound = function() {
			return toBind.apply(this instanceof empty ? this : t || window,
			args.concat(Array.prototype.slice.call(arguments)));
		};
		empty.prototype = this.prototype;
		bound.prototype = new empty();
		return bound;
	}
}