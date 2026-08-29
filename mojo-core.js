/*globals MojoLoader */
var MojoCore;


(function() {
	var root = this;
	root.loadMojoCore = function() {
		var libs;
		libs = MojoLoader.require({name: "mojo.core", version: "1.0"});
		MojoCore = libs['mojo.core'];

		/* There are a few things that are necessary for every app to provide
		 * that are provided by Mojo. These include an app menu and an alt-char
		 * picker. It's possible to have these drawn by the system, so we
		 * Let the system know we want it to do that here.
		 */
		if (!window.opener) {
			MojoCore.AppMenu.setup();
			MojoCore.AltChar.setup();
		}

		delete root.loadMojoCore;
	}

	window.addEventListener('DOMContentLoaded', function(e) {
		if (typeof PalmSystem !== 'undefined' && PalmSystem.stageReady) {

			// Call a real JS function since PalmSystem.stageReady gets
			// a little upset when it's passed to setTimeout.
			setTimeout(function() { PalmSystem.stageReady(); }, 0);
		}
		window.removeEventListener('DOMContentLoaded', arguments.callee);
	});

	document.write('<script onload="loadMojoCore();" src="/usr/palm/frameworks/mojoloader.js"></script>');
})();


