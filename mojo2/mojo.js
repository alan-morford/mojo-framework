/*jslint evil: true */
/*--------------------------------------------------------------------------
*  Mojo JavaScript framework, version 2.0
*  Copyright 2009 Palm, Inc.  All rights reserved.
*--------------------------------------------------------------------------*/
/*$
* @name mojo.js
* @fileOverview This file bootstraps loading the Mojo Framework by determining
*				which versions of the framework to use.
*/

/*globals _ */

// This little acorn will one day be a beautiful (and gnarly) oak!
if (!window.Mojo) {
	Mojo = {};
}

// First things first, make sure javascript is the way we like it. ES5, baby!
(function() {
	//TODO: Remove when JavaScriptCore supports this
	var startingSpace = /^\s+/;
	var endingSpace = /\s+$/;
	if (String.prototype.trim === undefined) {
		String.prototype.trim = function() {
		    return this.replace(startingSpace, '').replace(endingSpace, '');
		};
	}
	
	if (Function.prototype.bind === undefined) {
		Function.prototype.bind = function() {
			if (arguments.length < 2 && arguments[0] === undefined) {
				return this;
			}
			// dont require underscore for bind
			var __method = this, args = Array.prototype.slice.call(arguments), object = args.shift();
			return function() {
				return __method.apply(object, args.concat(Array.prototype.slice.call(arguments)));
			};
		};	
	}

	var originalStopPropagation = Event.prototype.stopPropagation;
	Event.prototype.stopPropagation = function() {
		originalStopPropagation.call(this);
		this._mojoPropagationStopped = true;
	};

	// TODO: Remove as soon as LunaSysMgr console supports these things.
	var timers = {};
	console.time = function(name) {
		timers[name] = Date.now();
	};
	console.timeEnd = function(name) {
		console.info(name + ': ' + (Date.now() - timers[name]));
		timers[name] = undefined;
	};
})();

(function() {

	// This sym-linked framework directory will be used for all mojo2
	// frameworks unless overwritten for a particular app with
	// x-mojo-submission="##" or x-mojo-submission="trunk" in the script
	// attribute
	var submission = "205";
	var submissionOverride;
	var versionToUse = "mojo2";
	var frameworkPath;

	function findScriptTag() {
		return document.querySelector('script[src$="mojo.js"]');
	}

	function determineVersionStrings() {
		var match;
		var scriptTag = findScriptTag();
		
		submissionOverride = scriptTag.getAttribute('x-mojo-submission');

		if(submissionOverride) {
			if(submissionOverride === 'trunk') {
				frameworkPath = "/trunk";
			} else {
				frameworkPath = "/submissions/" + submissionOverride;
			}
			submission = submissionOverride;
			console.log("=========> Submission specified manually : " + submission);
		} else {
			frameworkPath = (submission === "trunk") ? "/trunk" : "/submissions/"+submission;
			console.log("=========> Submission defaulted to : " + submission);

		}

	}

	function setMojoLoaderVersionStrings() {
		Mojo.FRAMEWORK_HOME = frameworkPath;
		Mojo.MOJO_VERSION = versionToUse;
		Mojo.MOJO_BUILD = submission;

		Mojo.hasPalmGetResource = !!window.palmGetResource;
		
		Mojo.Host = {mojoHost: 'mojo-host', browser: 'mojo-host', palmSysMgr: 'palm-sys-mgr'};
		Mojo.Host.current = (Mojo.hasPalmGetResource ? Mojo.Host.palmSysMgr : Mojo.Host.browser);
	}

	function insertScriptTag(fileName, targetWindow) {
		var scriptTag;

		var src = '/usr/palm/frameworks/' + versionToUse +
		frameworkPath +
		'/javascripts/' + 
		fileName + 
		'.js';

		function reportLoadError(type, versionToUse) {
			var errorString = 'The load of ' + type + ' (' + versionToUse +
				') failed. Perhaps it is not installed?';
			document.write(errorString);
			document.write('<br><br>');
			console.error(errorString);
		}

		var tag = '<script type="text/javascript" onerror="(' +
					reportLoadError +
					')(\'' + src + '\',\''  + submission +'\')" src="' + src + '"><\/script>';

		(targetWindow || window).document.write(tag);
	}

	
	function writeBuiltinScripts(builtinFrameworkName) {
		// LunaSysMgr compiled the framework into WebKit as a V8 builtin and
		// injected it into every app's global object before any app script
		// ran. WebAppMgr has no such hook, and released submissions ship the
		// framework only as that blob (javascripts/ holds just
		// child_loader.js; mojo_host_loader.js was never shipped), so fetch
		// the blob - de-nativized at packaging time - as an ordinary script.
		// Parser-blocking document.write()s for the same reason as in
		// mojo1's mojo.js: everything after the mojo.js tag assumes the
		// framework is fully initialised.

		// MojoLoader has installed its synchronous-XHR palmGetResource
		// polyfill by now (its _env is 'browser' whenever document exists),
		// so the sysmgr host paths are serviceable - and they have to be
		// used: browser mode routes stage operations through
		// window.opener.MojoHost, a desktop harness WebAppMgr does not have.
		Mojo.hasPalmGetResource = !!window.palmGetResource;
		if (Mojo.hasPalmGetResource) {
			Mojo.Host.current = Mojo.Host.palmSysMgr;
		}

		// Modern-Blink fixups, shared with mojo1. Loaded ahead of the
		// framework because the PalmSystem members it fills in are read
		// during initialisation.
		document.write('<script type="text/javascript" src="/usr/palm/frameworks/mojo/mojo-compat.js"><\/script>');

		document.write('<script type="text/javascript" src="/usr/palm/frameworks/mojo/builtins/' +
			builtinFrameworkName + '.js"><\/script>');

		// Runs once the blob above has been evaluated and has published its
		// init function onto window.
		window.mojoBuiltinLoaded = function() {
			var init = window[builtinFrameworkName];
			window.mojoBuiltinLoaded = null;
			if (!init) {
				var errorString = 'The load of ' + builtinFrameworkName +
					' (' + submission + ') failed. Perhaps it is not installed?';
				document.write(errorString);
				console.error(errorString);
				return;
			}
			console.log("=========> Calling " + builtinFrameworkName);
			Mojo.BUILTIN_FRAMEWORK = true;
			init(window, navigator, document);
		};
		document.write('<script type="text/javascript">mojoBuiltinLoaded();<\/script>');
	}

	function loadFramework() {
		var builtinFrameworkName = "palmInitFramework2" + submission.replace(/\./g, "_");
		var builtinFrameworkInit = window[builtinFrameworkName];
		var home = '/usr/palm/frameworks/' + Mojo.MOJO_VERSION +
			'/' + Mojo.FRAMEWORK_HOME + '/javascripts/';

		if(builtinFrameworkInit) {
			//load MojoLoader, then load builtin. We're assuming that if there are builtins, we're in a sysmgr env.
			console.log("=========> Calling " + builtinFrameworkName);
			Mojo.BUILTIN_FRAMEWORK = true;
			//FIX ARGS
			//console.time('execute builtin');
			builtinFrameworkInit(window, navigator, document);
			//console.timeEnd('execute builtin');
		} else if (submission !== 'trunk') {
			writeBuiltinScripts(builtinFrameworkName);
		} else {
			insertScriptTag('mojo_host_loader');
		}
	}

	function isChild() {
		return window.Mojo && window.Mojo.isChild;
	}

	function load() {
		//console.time('mojo.js:load');
		determineVersionStrings();
		setMojoLoaderVersionStrings();

		window.mojoLoaderLoaded = function() {
			var libs  = MojoLoader.require({ name: 'mojo.core', version: '1.0' });
			Mojo.Core = libs['mojo.core'];

			if(isChild()) {
				insertScriptTag('child_loader');
			} else {
				loadFramework();
			}

			window.mojoLoaderLoaded = null;
		};

		document.write('<script type="text/javascript" onload="mojoLoaderLoaded();" src="/usr/palm/frameworks/mojoloader.js"><\/script>');
		//console.timeEnd('mojo.js:load');
	}

	load();

})();
