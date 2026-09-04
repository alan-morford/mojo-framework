/*globals Mojo */

(function(){
	var otherMojo = window.opener.Mojo;

	var f = function finishLoading(loadEvent) {
		otherMojo.Controller.appController.finishOpenStage(window);
		window.removeEventListener('load', arguments.callee, false);
	};

	window.addEventListener('load', f, false);
	otherMojo.loadStylesheets(document, false);
	otherMojo.loadStylesheets(document, true);
}
)();
