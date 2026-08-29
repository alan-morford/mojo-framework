/**
 * == Core ==
 *
 * Mojo.Core is a collection of core APIs that provides a low level abstraction
 * on top of basic webOS system interactions. For very simple apps that do not
 * require widgets, scenes, or really anything visual, this is a small, fast
 * alternative to including the entire Mojo framework. Dashboard apps and
 * games are examples of apps that would be good candidates to only use 
 * Mojo.Core.
 *
 * To use Mojo.Core in place of Mojo, you need to include the following code
 * in your index.html, before any of your own scripts are included:
 *
 *     <script src="/usr/palm/frameworks/mojo-core.js" type="text/javascript"></script>
 *
 * This needs to be included in every window of an app in order to ensure it will work
 * as expected. This includes child windows.
 *
 * `mojo-core.js` will create a global object called `MojoCore` that will contain the
 * namespaces documented in this section. Note that no other Mojo APIs will
 * be available, only the APIs documented in the [[Core]] section.
 *
 * These APIs are also available in Mojo proper. They are generally hidden
 * behind higher level APIs that are more convenient, but you can access the
 * namespaces documented here by accessing `Mojo.Core`.
 **/

/*globals MojoLoader window global console Event
  App Service inBuiltinEnv setPrototype */

var _;

// Install useful ECMAScript 5 extensions if they don't already exist.
if (typeof Object.create !== 'function') {
	Object.create = function (o) {
		function F() {}
		F.prototype = o;
		return new F();
	};
}

if (Function.prototype.bind === undefined) {
	Function.prototype.bind = function() {
		if (arguments.length < 2 && arguments[0] === undefined) {
			return this;
		}
		var __method = this,
			args = Array.prototype.slice.call(arguments),
			object = args.shift();
		return function() {
			return __method.apply(object, args.concat(Array.prototype.slice.call(arguments)));
		};
	};
}

exports.onLoad = function() {
	TypeError.prototype.toString = function() {
		console.error(this.message);
		if (this.stack) {
			console.log(this.stack);
		}
	};


	if (typeof window === "undefined" && typeof global !== "undefined") {
		// @@ In a Triton environment, there is no DOM available.
		// @@ Stub out the bare essentials needed to load Mojo.Core.
		global.window = global;
		window.addEventListener = function() {};
		window.document = {
			addEventListener: function() {}
		};
	}

	Event.setup();
	App.setup();
	Service.setup();

};

function assertElement(el) {
	if (!(el && el.nodeType == 1)) {
		throw new TypeError("A DOM element is required.");
	}
}

function assignPrototype(fn, proto) {
	if (typeof inBuiltinEnv !== 'undefined' && inBuiltinEnv) {
		setPrototype(fn, proto);
	}
	else {
		fn.prototype = proto;
	}
}
