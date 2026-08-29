/*globals PalmSystem window document Module _ exports assignPrototype */

/** section: Core
 * Child
 * Namespace dealing with child windows.
 *
 * webOS offers a much richer experience than the standard web browser.
 * An important part of this experience is the ability to notify the user
 * of events without bringing the full application to the foreground or
 * blocking the current activity of the user. Another aspect is the ability
 * to open new windows, allowing you to keep your place in the parent window
 * while doing work in a child.
 *
 * Not surprisingly, these added features are just regular browser windows
 * similar to what you get when you call `window.open` in the web browser.
 * Unlike most browsers, however, webOS does not prevent these windows from
 * being opened.
 *
 * The API in this namespace makes dealing with the different types of child
 * windows offered by webOS as painless as possible.
 **/

var Child = (function() {
	/* These only matter in the browser for everything but popups
	 * popups respect the height that you give, the other two have
	 * system-determined heights
	 */
	var defaultHeight = {
		card: 432,
		dashboard: 48,
		popupAlert: 200
	};

	/**
	 * Child.Types
	 * The various window types that are supported by webOS
	 **/
	var windowTypes = {
		/**
		 * Child.Types.card = 'card'
		 *
		 * A card window is the default card type. It is a fullscreen window.
		 * Most simple apps are just a single card window.
		 **/
		card: 'card',
		/**
		 * Child.Types.dashboard = 'dashboard'
		 *
		 * A dashboard window is a small window that alerts the user that something
		 * interesting happened. It is persistent in that a small icon will be present
		 * in the notification area until the user taps on the icon (which brings it to
		 * full size) and dismisses the dashboard by flicking it off the screen.
		 *
		 * Find out more [here](http://developer.palm.com/index.php?option=com_content&view=article&id=1632)
		 **/
		dashboard: 'dashboard',
		/**
		 * Child.Types.popupAlert = 'popupalert'
		 *
		 * A popupAlert is an urgent dialog that pops up under whatever
		 * the user is currently doing. It is normally used for high priority
		 * interactions such as calendar alerts.
		 *
		 * Find out more [here](http://developer.palm.com/index.php?option=com_content&view=article&id=1632)
		 **/
		popupAlert: 'popupalert',
		bannerAlert: 'banneralert',
		activeBanner: 'activebanner',
		stackedCard: 'childcard',
		/**
		 * Child.Types.dockMode = 'dockMode'
		 *
		 * A dockMode stage is a stage that is used when the device is on the
		 * touchstone charging dock.
		 **/
		dockMode: 'dockMode'
	};

	var browserFeatures = "resizable=no,scrollbars=no,status=yes,width=320";

	function buildFeatures(features, attributes) {
		var key;
		var strFeatures = browserFeatures;
		if (features) {
			for (key in features) {
				if (features.hasOwnProperty(key)) {
					strFeatures += [",", key, '=', features[key]].join('');
				}
			}
		}
		strFeatures += ",attributes=" + JSON.stringify(attributes);
		return strFeatures;
	}

	/**
	 * class Child.Banner
	 * Created through [[Child.createBanner]] only.
	 **/
	function Banner(message, options) {
		var soundClass, soundPath, soundDuration;
		options = options || {};
		if (!message) {
			throw new TypeError('Banner: must have message');
		}
		if (options.sound) {
			soundClass = options.sound.audioClass;
			soundPath = options.sound.path;
			soundDuration = options.sound.duration;
		}
		this.id = PalmSystem.addBannerMessage(
			message,
			JSON.stringify(options.launchArguments || {}),
			options.icon,
			soundClass,
			soundPath,
			soundDuration);
	}

	assignPrototype(Banner, {
		/**
		 * Child.Banner#close() -> undefined
		 * Closes a banner (removes the banner text from the screen)
		 **/
		close: function() {
			PalmSystem.removeBannerMessage(this.id);
		}
	});

	var module = {

		/**
		 * Child.createWindow(url, name, features, attributes) -> window
		 * - url (String): An X/HTML file to render in the new card.
		 * - name (String): The name of the new card.
		 * - features (Object): A key/value pairing of standard window features
		 * - attributes (Object): A key/value pairing of Mojo window attributes
		 *
		 * Creates a child window. The available child window types are specified
		 * in [[Child.Types]]
		 *
		 * `features` is an object consisting of standard browser window
		 * features. The vast majority of window features are not supported,
		 * nor do they make sense on webOS. This is largely included to
		 * future-proof the API. The supported features consist of:
		 *
		 *  - `height` (Number): Ignored by many window types, popup alerts allow
		 *     the developer to customize the window height.
		 *
		 * `attributes` is an object consisting of Mojo specific window features.
		 *  Currently, the supported mojo features are:
		 *
		 *  - `window`: Specifies the window type. Valid values are the constants
		 *    defined in [[Child.Types]]. Defaults to [[Child.Types.card]] if
		 *    unspecified.
		 *
		 * Example
		 * -------
		 *     MojoCore.Child.createCard(url, name, {
		 *         height: 150
		 *     }, {
		 *         window: MojoCore.Child.Types.popupAlert
		 *     });
		 *
		 * Returns the newly created window reference, which, as a DOM level 0
		 * object, is most completely [documented by Mozilla][1].
		 *
		 * This window has been properly set up to work with webOS specific events.
		 *
		 * [1]: https://developer.mozilla.org/En/DOM/Window.open
		 **/
		createWindow: function (url, name, features, attributes) {
			var strFeatures;
			var newWindow;
			features = features || {};
			attributes = attributes || {};

			attributes.window = attributes.window || windowTypes.card;
			features.height = features.height || defaultHeight[attributes.window];

			strFeatures = buildFeatures(features, attributes);
			newWindow = window.open(url, name, strFeatures);

			return newWindow;
		},

		/**
		 * Child.createBanner(message[, options]) -> Child.Banner
		 * - message (String): The message to display in the banner.
		 * - options (Object): An object containing the plethora of optional
		 *   banner features.
		 *
		 * A banner is a line of text that temporarily appears at the bottom
		 * of the user's screen. It can be accompanied by a sound to grab the
		 * user's attention. When the banner is tapped, it relaunches your app
		 * (optionally with additional parameters).
		 *
		 * Options is an object that may (or may not) contain any of the
		 * following properties:
		 *
		 *  - `icon`: A path to an icon to display next to the text, relative to
		 *     the root of the running app. Defaults to a miniature version of
		 *     your application icon.
		 *  - `launchArguments`: An object that will be passed to your
		 *     application's relaunch method when the banner is tapped.
		 *  - `sound`: An object that may contain the following:
		 *     - `path`: The path to the sound file, relative to the running app.
		 *     - `audioClass`: The class of the sound file. (More information
		 *        can be [found here][1])
		 *     - `duration`: The length of time to play the sound in
		 *        milliseconds
		 *
		 * [1]: http://developer.palm.com/index.php?option=com_content&view=article&id=1539
		 **/
		createBanner: function(message, options) {
			return new Banner(message, options);
		}
	};

	module.Types = windowTypes;
	exports.Child = module;
	return module;
})();
