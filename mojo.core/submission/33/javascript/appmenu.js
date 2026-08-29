/** section: Core
 * AppMenu
 * All you need to display and receive user commands from the webOS app menu.
 **/

/*globals Event Service App*/

var AppMenu = function() {
	var request;
	return {
		/**
		 * AppMenu.setup(config) -> undefined
		 * - config (Object): An object containing the configuration for the
		 *   App menu.
		 *
		 * This function configures the app menu for your application. It takes a
		 * configuration that is very similar to the standard Mojo app menu widget.
		 *
		 * `config` may contain any of the following:
		 *
		 *     {
		 *          - omitDefaultItems (Boolean): Whether to include the default
		 *            app menu items or not.
		 *          - richTextEditItems (Boolean): Whether to include rich text
		 *            editing options (such as bold, italic, etc.)
		 *          - items (Array): An array of items objects to include in the
		 *            app menu. Objects in this array may contain the following:
		 *            {
		 *                 - label (String): What text to put in the menu.
		 *                 - command (String): The string that is placed in the
		 *                   [[AppMenu.CommandEvent]] event.
		 *                 - [disabled (Boolean = false)]: Enable or disable
		 *                   this menu item.
		 *                 - [icon (String)]: An css class that will apply an icon
		 *                 - [iconPath (String)]: A path to an icon to insert
		 *                   into the menu item.
		 *                 - [width (Number)]: A width that will override the
		 *                   default.
		 *                 - [items: (Array)]: Submenu items, properties are
		 *                   identical to this items array.
		 *                 - [toggleCmd (String)]: Only used when `items` is
		 *                   specified.  Specify this property to make this
		 *                   group a "toggle group". This string is the
		 *                   `command` of currently selected 'choice' item.
		 *                 - [template (String)]: Path to HTML template for
		 *                   rendering custom content to be inserted instead of
		 *                   the standard menu item. Must be absolute.
		 *            }
		 *      }
		 **/
		setup: function(config) {
			request = Service.createRequest(
				'palm://com.palm.applicationManager/launch', {
					id: "com.palm.systemui",
					params: {
						action: "configureAppMenu",
						appId: App.info.id,
						config: config || {}
					}
				},
				function() {
					request = null;
				});

			if (typeof document !== 'undefined') {
				document.addEventListener(Event.relaunch, function(e) {
					if (e.params && e.params.appMenuCommand) {
						Event.send(document, 'mojo-app-menu-command', {
							command: e.params.appMenuCommand
						});
						Event.stop(e);
					}
				});
			}
		}
	};
}();

exports.AppMenu = AppMenu;


/**
 * class AppMenu.CommandEvent
 *
 * An instance of this class is sent to listeners of the `mojo-app-menu-command`
 * event.
 *
 * Contains the [usual properties][1] plus those documented below.
 *
 * [1]: http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 **/

/**
 * AppMenu.CommandEvent#command -> String
 * The command that was tapped by the user. This is either a command that was
 * specified by the `items` array in [[AppMenu.setup]], or one of the default
 * app menu commands.
 *
 * The default commands are:
 *
 * - `palm-cut-cmd`
 * - `palm-copy-cmd`
 * - `palm-paste-cmd`
 * - `palm-prefs-cmd`
 * - `palm-help-cmd`
 *
 * The commands that can be enabled by setting `richTextEditItems` to `true` in
 * [[AppMenu.setup]] are the following:
 *
 * - `palm-bold-cmd`
 * - `palm-italic-cmd`
 * - `palm-underline-cmd`
 * - `palm-selectall-cmd`
 **/
