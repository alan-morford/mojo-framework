
/*globals Service App Event */

/** section: Core
 * AltChar
 *
 * The alternate character picker is a list of characters that can't be
 * made with the normal keyboard.
 **/

var AltChar = function() {
	var SYM_CODE = 17;
	var request, target;

	function showAltCharPicker() {
		request = Service.createRequest(
			'palm://com.palm.applicationManager/launch', {
				id: "com.palm.systemui",
				params: {
					action: "showAltChar"
				}
			},
			function() {
				request = null;
			});
	}

	function sendFakeKey(type, charCode) {
		var e = document.createEvent('Events');
		e.initEvent(type, true, true);

		e.keyCode = charCode;
		e.charCode = charCode;
		e.which = charCode;

		target.dispatchEvent(e);
		return e;
	}

	return {
		/**
		 * AltChar.setup() -> undefined
		 *
		 * This does not apply to regular Mojo apps.
		 *
		 * Enables the alt char picker for the current document. This is
		 * done automatically for any window that includes mojo-core.js.
		 * If you have a child window that does not include mojo-core.js,
		 * you will need to call this function to get the alt-char picker
		 * in the child window.
		 **/
		setup: function() {
			if (typeof document !== 'undefined') {
				document.addEventListener('keydown', function(e) {
					if (e.keyCode === SYM_CODE) {
						target = e.target;
						console.log('saving off target: ' + target);
						showAltCharPicker();
					}
				});

				document.addEventListener(Event.relaunch, function(e) {
					var selection, newEvent, charCode;
					if (e.params && e.params.altCharSelected) {

						/* Ok, this is pretty nutty. Since the altchar selector is
						 * basically a virtual keyboard, it follows that some
						 * application listening for keyup, keypress, or keydown
						 * should get the appropriate events when one of those keys
						 * is hit. Since we can't generate "real" keyboard events,
						 * we have to splat the text in there manually and create
						 * fake events for any JS that might be listening.
						 */

						// Put the text into the editable element
						selection = window.getSelection();
						// make sure there are any available range to index as
						// getRangeAt does not protect against that
						if (selection && selection.rangeCount > 0 && selection.getRangeAt(0)) { 
							document.execCommand("insertText", true, e.params.altCharSelected);
						}

						// Fire off our fake events
						charCode = e.params.altCharSelected.charCodeAt(0);
						sendFakeKey('keydown', charCode);
						sendFakeKey('keypress', charCode);
						sendFakeKey('keyup', charCode);

						Event.stop(e);
					}
				});
			}
		}
	};
}();

exports.AltChar = AltChar;
