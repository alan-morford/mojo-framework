/*globals _ palmGetResource Module mojoAppInfo */

/** section: Core
 * App
 * App specific configuration
 **/
var App = function() {

	var module = {
		/**
		 * App.info -> Object
		 *
		 * A JavaScript object that contains the information found in
		 * the app's appinfo.json file.
		 **/
		/**
		 * App.path -> string
		 *
		 * The root file path of the application.
		 **/
		setup: function() {
			var jsonText;
			var match = document.baseURI.match(/file:\/\/\/.*\/(.*)\//);
			if (match) {
				this.path = match[0];
			} else {
				this.path = document.baseURI.match(/http:\/\/.*\//)[0];
			}

			jsonText = palmGetResource(this.path + "appinfo.json");
			if (jsonText) {
				this.info = JSON.parse(jsonText);
			}
			else if (window.opener) {
				this.info = window.opener.mojoAppInfo;
			}
			else {
				this.info = {};
			}

			mojoAppInfo = this.info;

			if (!('noWindow' in this.info)) {
				this.info.noWindow = false;
			}

		}
	};
	exports.App = module;
	return module;
}();
