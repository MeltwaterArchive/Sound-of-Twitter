


var Listen = {

	/**
	 * Total number of sound files we have loaded
	 */
	totalSounds: 12,

	/**
	 * All the HTML5 audio objects
	 */
	sounds: [],

	/**
	 * The elements representing the sounds
	 */
	elements: [],

	/**
	 * The notes to play
	 */
	sentiment: [],

	counter: 0,

	/**
	* Start listening
	*/
	start: function() {
		// collect all the sounds & elements
		for (i = 0; i < this.totalSounds; i++) {
			this.sounds.push(document.getElementById('s' + i));
			this.elements.push(document.getElementById('e' + i));
		}

		// connect to DataSift
		DataSift.connect('<username>', '<apikey>', 'websocket.datasift.com');
		DataSift.register('b65ceba2ba57cadc880a18bd48c2f467', {
			onMessage: function(d) { this.onMessage(d); }.bind(this),
			onError: function() {}
		});

		setInterval(function() {
			this.notes();
		}.bind(this), 500);
	},

	onMessage: function(data) {

		data = data.data;

		if (data.salience && data.salience.content && data.salience.content.sentiment) {
			this.sentiment.push(data.salience.content.sentiment);
		}
	},

	notes: function() {

		var value = null;
		var rand  = Math.floor(3*Math.random());

		if (rand == 0) {
			value = this.sentiment.max();
		} else if (rand == 1) {
			value = this.sentiment.average();
		} else if (rand == 2) {
			value = this.sentiment.min();
		}

		if (!isNaN(value) && value !== null && value !== -Infinity && value !== Infinity) {
			this.play(value);
		}

		this.sentiment = [];
	},

	play: function(value) {

		var scale = 40;
		var distribution = scale/this.totalSounds;
		var note = 0;

		// first make the value positive
		value = value < 0 ? value*-1 : value > 0 ? value+(scale/2) : value;

		note = Math.floor(value / distribution);

		if (this.sounds[note].ended) {
			this.sounds[note].play();
		} else {
			var audio = new Audio(this.sounds[note].src);
			audio.play();
		}

		if (this.elements[note].className == 'note') {
			this.elements[note].className = 'note hover';
		}
		var temp = this.elements[note];

		setTimeout(function() {
			temp.className = 'note';
		}, 500);
	}
}

Listen.start();



Array.prototype.max = function() {
  return Math.max.apply(null, this)
}

Array.prototype.min = function() {
  return Math.min.apply(null, this)
}

Array.prototype.average = function() {
	var total = 0;
	for (var i = 0; i < this.length; i++) {
		total += this[i];
	}
	return total/this.length;
}
