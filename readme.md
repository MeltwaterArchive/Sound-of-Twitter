# Sound of Twitter

Use [DataSift](http://datasift.com) to visualize the sentiment on Twitter with lights and sounds.

You can see a demo over on [YouTube](http://www.youtube.com/watch?v=DLlBSY-ci7U) or read more information on [DataSift Labs](http://labs.datasift.com)

## Prerequisites 

You will need:

 * an API key from [DataSift](http://datasift.com). 

 * credit on your DataSift account (depending on the stream, this application may rapidly consume your credits).

 * access to the [Salience Entities](http://datasift.com/source/19/salience-entities) data source.

## Configuration

Locate the following line in `sound.js`:

```javascript
// connect to DataSift
DataSift.connect('<username>', '<apikey>', 'websocket.datasift.com');
```

Replace `<username>` with your DataSift username and `<apikey>` with your DataSift API key (look for it on your DataSift account page).

Save `sound.js` and open `index.html` in a web browser.

The default configuration of `sound.js` references a stream that filters for 'life'.  You can create your own stream and filter for other keywords.  If you do, you must change the stream hash in the call to `DataSift.register()`:

```javascript
DataSift.register('b65ceba2ba57cadc880a18bd48c2f467', {
	onMessage: function(d) { this.onMessage(d); }.bind(this),
	onError: function() {}
	});
```
