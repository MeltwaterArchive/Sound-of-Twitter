#Sound of Twitter

Using DataSift this is a little application which visualises the sentiment from Twitter with lights and sounds.

You can see a demo over on [YouTube](http://www.youtube.com/watch?v=DLlBSY-ci7U) or read more information on [DataSift Labs](http://labs.datasift.com]

##Prerequisites 

You will need to get a API key from [DataSift](http://datasift.com). 

You will need credit on your DataSift account (depending on the stream, this application may rapidly consume your credits).

You will need to agree to the [Salience Entities](http://datasift.com/source/19/salience-entities) data source.

##Configuration

<pre>
	DataSift.connect('<username>', '<apikey>', 'websocket.datasift.com');
</pre>

Change line 39 of sound.js to include your username and password. Currently the default stream is a search for a keyword 'life' in order to change you search change line 40 to include the stream hash of what you want to search for.