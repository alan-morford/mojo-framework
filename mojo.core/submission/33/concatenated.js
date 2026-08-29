this._root["__MojoFramework_mojo.core"] = function(MojoLoader, exports, root) {


//@ sourceURL=mojo.core/prologue.js

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


//@ sourceURL=mojo.core/perf.js

/* Internal functions for measuring performance. */

/*globals console Service */

function GarbageStats() {
	var self = this;
	self.request = Service.createRequest(
		'palm://com.palm.lunastats/getStats',
		{},
		function(result) {
			self.originalBytes = result.counters.jsHeap.used;
			self.originalGcCount = result.counters.jsHeap['gc-count'];
		});
}

assignPrototype(GarbageStats, {
	reportStats: function() {
		var self = this;
		self.request = Service.createRequest(
			'palm://com.palm.lunastats/getStats',
			{},
			function(result) {
				var bytes = (result.counters.jsHeap.used - self.originalBytes)/1024;
				var gcs = result.counters.jsHeap['gc-count'] - self.originalGcCount;
				console.log("Used " + bytes + " kb");
				console.log("Ran GC " + gcs + " times");
			});
	}
});


//@ sourceURL=mojo.core/service.js

/*globals PalmSystem console PalmServiceBridge assignPrototype global webOS exports*/

/** section: Core
 * Service
 * Access device services like the accelerometer, GPS, contacts, and more!
 **/
var Service = (function() {
	/**
	 * class Service.Request
	 * Created with [[Service.createRequest]]
	 **/
	function Request(url, parameters, callback) {
		var subscribed;

		// Decorate request with activity id if we have one.
		if (!parameters.$activity) {
			if (!PalmSystem.activityId) {
				console.warn("No activity id available for service request!");
			}
			else {
				parameters.$activity = {
					activityId: PalmSystem.activityId
				};
			}
		}
		
		// best known legacy-compatible method of determining whether a request
		// intends on receiving multiple responses is to check if either
		// 'watch':true or 'subcribe':true is specified
		subscribed = parameters && (parameters.subscribe === true || parameters.watch === true);

		parameters = JSON.stringify(parameters);
		this.cancelled = false;
		this.psRequest = new PalmServiceBridge();
		var req = this.psRequest;
		var firstResponse = true;
		// Response handler function must be a method at time of assignment or else will get GCed (?!).
		this.f = function(message) {
			var response;
			try {
				response = JSON.parse(message);
			}
			catch (e) {
				response = {
					errorCode: -1,
					errorText: "Bad JSON response: " + e.message
				};
			}
			if (!subscribed && !firstResponse && response.errorText && response.errorText.match(/is not running.$/)) {
				// NOV-114543
				req.cancel();
			} else {
				firstResponse = false;
				callback(response);
			}
		};
		this.psRequest.onservicecallback = this.f;
		this.psRequest.call(url, parameters);
	}

	assignPrototype(Request, {
		/**
		 * Service.Request#cancel() -> undefined
		 * Call this to cancel a pending request.
		 **/
		cancel: function cancel() {
			if (this.psRequest) {
				this.cancelled = true;
				this.psRequest.cancel();
				this.psRequest = undefined;
			} else {
				throw Error("cancelling a request that is not in progress");
			}
		}
	});

	var module = {
		/**
		 * Service.createRequest(url, parameters, callback) -> Service.Request
		 * - url (String): The url of the service and method to access.
		 * - parameters (Object): The parameters to pass to the service.
		 *   These will be serialized by the request automatically.
		 * - callback (Function): The function to be called with the results
		 *   of the service request.
		 *
		 * This creates a request to the Palm Service bus.
		 * See the [service docs][] for more details on service APIs.
		 *
		 * The url for a service is usually something like `palm://com.palm.location`. In
		 * regular Mojo, you pass a `method` parameter when creating a service request. In
		 * reality, that just gets tacked onto the service url. So, when using this API,
		 * the developer needs to do that concatenation himself. For example, if the
		 * developer is querying for the user's location, the url would be
		 * `palm://com.palm.location/getCurrentPosition`. The `parameters` argument should
		 * then be a JavaScript object to be serialized and sent to the method.
		 *
		 * Example
		 * -------
		 *     var request = MojoCore.Service.createRequest(
		 *         'palm://com.palm.location/getCurrentPosition',
		 *         {
		 *              accuracy: 1,
		 *              maximumAge: 0,
		 *              responseTime: 3
		 *         },
		 *         function(response) {
		 *              console.log("Latitude is: " + response.latitude);
		 *         });
		 *
		 * [service docs]: http://developer.palm.com/index.php?option=com_content&view=article&id=1651&Itemid=240
		 **/
		createRequest: function(url, parameters, callback) {
			return new Request(url, parameters, callback);
		},
		setup: function() {
			if (typeof PalmServiceBridge === "undefined") {
				if (typeof global !== "undefined") {
					// Triton environment
					(function() {
						var handle;
					
						global.PalmServiceBridge = function() {};
						global.PalmServiceBridge.prototype = {
							call: function(url, paramString) {
								var that = this;

								if (!handle) {
									handle = new webOS.Handle("", false);
								}

								this.request = handle.call(url, paramString, function(responseObj) {
									if (that.request) {
										that.onservicecallback(responseObj.payload());
									}
								});
							},
							cancel: function() {
								if (this.request) {
									handle.cancel(this.request);
									this.request = undefined;
								}
							}
						};
					
					})();
				} else {
					// Browser environment
					(function() {
						
						// Standalone version adapted from Foundations to avoid another dependency.
						function toQueryString(obj) {
							var key;
							var pairs = [];
							var len;
							
							for (key in obj) {
								if (obj.hasOwnProperty(key)) {
									var val = obj[key];
									var encKey = encodeURIComponent(key);
									
									if (val === null|| val === undefined) {
										
										// { a: undefined, b: 'c' } -> "a&b=c"
										pairs.push(encKey);

									} else if (typeof val == 'number' || typeof val == 'string' || val === true || val === false) {
										pairs.push(encKey + "=" + encodeURIComponent(val));

									} else if (val.length) {
										
										len = val.length;
										for (var i=0; i<len; ++i) {
											pairs.push(encKey + "=" + encodeURIComponent(val[i]));
										}

									} else {
										throw new Error("Can't convert unknown object \"" + key + "\" to a query string");
									}
								}
							}

							return pairs.join('&');
						}
						
						window.PalmServiceBridge = function() {};
						window.PalmServiceBridge.prototype = {
							call: function(fullUrl, parameters) {
								this.fullUrl = fullUrl;
								this.parameters = parameters;
								var matches = fullUrl.match(this.serviceExpression);
								if (matches && matches.length == 3) {
									this.identifier = matches[1];
									this.method = matches[2];
									this.sendRequestToMojoHost();
								} else {
									var error = this.makeError(this.cannotExtractIdentifierError);
									error.errorText += this.fullUrl;
									this.sendResponse(error);
								}
							},

							sendRequestToMojoHost: function() {
								var params = this.parameters || "{}";
								var self = this;
								var ajaxParams = {
									sessionID: window.parent.top.name,
									methodParams: params,
									serviceMethod: this.method,
									serviceName: this.identifier
								};
								var url = this.makeLunaHostUrl();
								var req = new XMLHttpRequest();
								req.onreadystatechange = function() {
									if (req.readyState == 4) {
										if (req.status >= 200 && req.status < 300) {
											req.responseJSON = JSON.parse(req.responseText);
											self.onSuccess(req);
										} else {
											self.onFailure(req);
										}
									}
								};
								req.open('GET', url + "?" + toQueryString(ajaxParams)); 
								req.send(null);
							},

							makeLunaHostUrl: function() {
								return "/bridge/handle_method.js";
							},

							makeError: function(original) {
								var key;
								var error = {};
								for (key in original) {
									if (original.hasOwnProperty(key)) {
										error[key] = original[key];
									}
								}
								return error;
							},

							makeNoSuchServiceError: function() {
								var error = this.makeError(this.noSuchServiceError);
								return error;
							},

							makeUnknownServiceError: function(transport) {
								var error = this.makeError(this.unknownServiceError);
								error.errorText += transport.status;
								error.errorText += ":";
								error.errorText += transport.responseText;
								return error;
							},

							onSuccess: function(transport) {
								var response = transport.responseJSON;
								if (window.parent && window.parent.comet) {
									window.parent.comet.serviceBridgeManager.requests[response.token] = this;
								}
							},

							onFailure: function(transport) {
								if (transport.status == 501) {
									this.sendResponse(this.makeNoSuchServiceError());
								} else {
									this.sendResponse(this.makeUnknownServiceError(transport));
								}
							},

							sendResponse: function(error) {
								var self = this;
								setTimeout(function() {
									self.onservicecallback(JSON.stringify(error));
								}, 0);
							},

							cancel: function() {

							},

							serviceExpression: /palm:\/\/([\w.]+)\/(.*)/,

							cannotExtractIdentifierError: {
								returnValue: false,
								errorCode: -1,
								errorText: "Cannot extract identifier and method from "
							},

							noSuchServiceError: {
								returnValue: false,
								errorCode: -1,
								errorText: "mojo-host provides no service '<%= identifier %>' with method '<%= method %>'"
							},

							unknownServiceError: {
								returnValue: false, 
								errorCode: -1,
								errorText: "mojo-host error: "
							}
						};
						
					})();
				}
			}
		}
	};

	exports.Service = module;
	return module;
})();


//@ sourceURL=mojo.core/event.js

/* Copyright 2009-2010 Palm, Inc.  All rights reserved.
 */

/*globals console PalmSystem exports */
/*jslint browser: true, regexp: true */

/** section: Core
 * Event
 * Functions to aid in interacting with the supplemental events a touch
 * environment brings to the table.
 *
 * In general, Mojo seeks to use standard DOM events, plus pseudo-standard
 * events that have become popular in versions of webkit that support
 * multi-touch. This module seeks to provide functionality that is
 * supplemental to those standard events.
 *
 * Refer to the [DOM level 3 draft][1] for a reference to DOM standard events.
 *
 * Mobile specific events provided by webOS:
 *
 *  - orientationchange
 *  - gesturestart
 *  - gesturechange
 *  - gestureend
 *  - shakestart
 *  - shaking
 *  - shakeend
 *  - acceleration
 *
 * Mobile events **NOT** currently supported by webOS:
 *
 *  - touchstart
 *  - touchmove
 *  - touchend
 *  - touchcancel
 *
 *
 * In addition, the Mojo specific events documented below are supported.
 * These do not work in most mobile browsers, but are invaluable in
 * writing webOS applications that interact smoothly with the system.
 *
 * To use a built-in event, simply listen as you would any other standard
 * browser event.
 *
 * For example:
 *
 *     someElement.addEventListener('gesturestart', someEventHandler);
 *
 * There are aliases for the Mojo specific events (documented below), which
 * you can use when listening to these events.
 *
 * For example:
 *
 *     document.addEventListener(Mojo.Event.back, someEventHandler);
 *
 * [1]: http://www.w3.org/TR/DOM-Level-3-Events/#event-types-list
 **/
var Event = (function () {

	var key;

	var logEvents = false;

	var PASS_EVENT_ATTRIBUTE='x-palm-pass-event';

	var ESC_KEY = 27;

	var module, events;

	function logEvent(prefix, event, targetElement, mojoDetails) {
		if (logEvents) {
			console.log("%s event '%s' targeting element '%s#%s' %s", prefix,
				event.type, targetElement.tagName, targetElement.id || "<no id>");
		}
	}

	function getStyle(el, style) {
		var value = el.style[style];
		var css;
		if (!value || value == 'auto') {
			css = el.ownerDocument.defaultView.getComputedStyle(el, null);
			value = css ? css[style] : null;
		}
		if (style == 'opacity') {
			return value ? parseFloat(value) : 1.0;
		}
		return value == 'auto' ? null : value;
	}

	module = {
		/**
		 * Event.make(name, details[, doc][, bubbles][, cancel]) -> event
		 * - name (String): The name of the event, visible in event.type.
		 * - details (String): A hash of custom event properties to be copied to
		 *   the event object.
		 * - doc (DOMElement): is a supplied element to target the event on; if not
		 *   supplied, defaults to current active document
		 * - bubbles (Boolean): Flag determining if the event's propogation behavior
		 *   is to bubble; default is true.
		 * - cancel (Boolean): Flag determining if the event's default action may
		 *   be prevented via the `preventDefault()` method; default is true
		 *
		 * Utility routine used to create custom events.
		 *
		 * In addition to creating an event with the given name, the event is also 
		 * extended such that a `defaultPrevented` property is available on the
		 * event instance.
		 **/
		make: function(name, details, doc, bubbles, cancel) {
			var newEvent, key;

			bubbles = (bubbles !== undefined) ? bubbles: true;
			cancel = (cancel !== undefined) ? cancel: true;

			doc = doc || document;

			newEvent = doc.createEvent("HTMLEvents");
			newEvent.initEvent(name, bubbles, cancel);
			for (key in details) {
				if (details.hasOwnProperty(key)) {
					newEvent[key] = details[key];
				}
			}

			return newEvent;
		},

		/**
		 * Event.send(element, name[, details][, bubbles][, cancel]) -> event
		 * - element (DOMElement): to dispatch the event on.
		 * - name (String): is the name of the event, visible in event.type.
		 * - details (String): is a hash of custom event properties to be copied
		 *   to the event object.
		 * - bubbles (Boolean): flag determining if the event's propogation
		 *   behavior is to bubble; default is true
		 * - cancel (Boolean): flag determining if the event's default action may
		 *   be prevented via the preventDefault( ) method; default is true
		 *
		 * Like prototype's [element.fire()](http://prototypejs.org/api/element/fire),
		 * except that the event type is actually
		 * as specified (instead of always `dataavailable`),  and the specified details are
		 * placed in the event object directly (instead of a `memo` subobject).
		 **/
		send: function(element, name, details, bubbles, cancel) {
			var newEvent = module.make(name, details, element.ownerDocument, bubbles, cancel);
			logEvent("sending", newEvent, element, details);
			element.dispatchEvent(newEvent);
			return newEvent;
		},

		/**
		 * Event.stop(event) -> undefined
		 * - event (DOMEvent): Event object that should be stopped
		 *
		 * Stops the event from propagating and prevents the default action.
		 **/
		stop: function(e) {
			// Have to check here, since our derived events don't have both methods.
			if (e.preventDefault) {
				e.preventDefault();
			}
			if (e.stopPropagation) {
				e.stopPropagation();
			}
		},

		pointer: function(e) {
			return {
				x: e.pageX,
				y: e.pageY
			};
		},

		/*
		 * Event.setup() -> undefined
		 *
		 * Since there are a few non-standard ways Mojo receives events from
		 * the system, these hooks must be installed on every new window. This
		 * function does all the setup that is necessary for this to happen.
		 *
		 * If you create a child window through means other than the Mojo APIs
		 * (such as with `window.open`), you should pass your window reference
		 * to this function before using it with Mojo events. If you use the
		 * Mojo APIs, they will take care of this detail for the developer.
		 */
		setup: function() {
			var win = window;
			var doc = win.document;
			var dragStarted = false;
			var mouseDown, mouseUp, mouseMove;
			var lastDownPointer, lastMouseDownEvent;

			mouseDown = function(e) {
				var tagName = e.target.tagName;

				//FIXME: The original element doesn't get passed with flick gestures,
				// so we need to save it here until it does. See NOV-89965.
				lastMouseDownEvent = e;

				var passEvent = e.target.getAttribute(PASS_EVENT_ATTRIBUTE);
				var userModify =
					getStyle(e.target, "-webkit-user-modify") === "read-write" ||
					tagName === "INPUT" ||
					tagName === "TEXTAREA" ||
					tagName === "OBJECT";

				lastDownPointer = module.pointer(lastMouseDownEvent);

				doc.addEventListener('mousemove', mouseMove);
				doc.addEventListener('mouseup', mouseUp);

				if(!passEvent && !userModify) {
					module.stop(e);
				}

			};

			mouseMove = function(e) {
				var pt2 = module.pointer(e);
				var distance = {
					x: Math.abs(lastDownPointer.x - pt2.x),
					y: Math.abs(lastDownPointer.y - pt2.y)
				};

				e.filteredPointer = pt2;

				var info = {
					filteredDistance: distance,
					down: lastMouseDownEvent,
					move: e
				};

				if (!dragStarted) {
					module.send(lastMouseDownEvent.target, events.dragStart, info);
					dragStarted = true;
				}
				else {
					module.send(lastMouseDownEvent.target, events.dragging, info);
				}

				module.stop(e);
			};

			mouseUp = function(e) {
				if (dragStarted) {
					module.send(lastMouseDownEvent.target, events.dragEnd, {
						down: lastMouseDownEvent,
						up: e
					});
					dragStarted = false;

					module.stop(e);
				}
				doc.removeEventListener('mousemove', mouseMove);
				doc.removeEventListener('mouseup', mouseUp);
			};

			function keyUp(e) {
				var newEvent;
				if (e.keyCode === ESC_KEY) {
					newEvent = module.send(doc, events.back, e);
					if (newEvent.defaultPrevented) {
						e.preventDefault();
					}
					if (newEvent._mojoPropagationStopped) {
						e.stopPropagation();
					}
				}
			}

			/* Hackery to translate events fed to us by LunaSysMgr into
			 * events that look like they're real.
			 */
			function dispatchGesture(type, properties) {
				var newProps = {};
				switch(type) {
					case 'flick':
						newProps.velocity = {
							x: properties.xVel,
							y: properties.yVel
						};
						newProps.origin = {
							x: properties.x,
							y: properties.y
						};
						module.send(lastMouseDownEvent.target, events.flick, newProps);
						break;
					default:
						module.send(doc, 'mojo-' + type, properties);
						break;
				}
			}

			function orientationChanged(orientation) {
				module.send(doc, events.screenRotate, {orientation: orientation});
			}

			function fireWindowActivate() {
				module.send(doc, events.windowActivate);
			}

			function fireWindowDeactivate() {
				module.send(doc, events.windowDeactivate);
			}

			function fireRelaunch() {
				var params = PalmSystem.launchParams;
				if (params && params !== '') {
					params = JSON.parse(PalmSystem.launchParams);
				}
				else {
					params = {};
				}

				module.send(doc, events.relaunch, {
					params: params
				});
			}
			
			function fireLowMemory(params) {
				module.send(doc, events.lowMemory, {
					data: params
				});
			}

			doc.addEventListener("mousedown", mouseDown);
			doc.addEventListener("keyup", keyUp);

			win.addEventListener("unload", function(e) {
				doc.removeEventListener("mousedown", mouseDown);
				doc.removeEventListener("keyup", keyUp);
			});

			//FIXME: HACK! Need to fix LunaSysMgr to not assume Mojo exists
			// See NOV-89962
			if (!win.Mojo) {
				win.Mojo = {};
			}
			win.Mojo.handleGesture = dispatchGesture;
			win.Mojo.screenOrientationChanged = orientationChanged;
			win.Mojo.stageActivated = fireWindowActivate;
			win.Mojo.stageDeactivated = fireWindowDeactivate;
			win.Mojo.relaunch = fireRelaunch;
			win.Mojo.lowMemoryNotification = fireLowMemory;
		}
	};

	events = {
		/**
		 * Event.back = 'mojo-back'
		 * This event is sent through the active commander chain when a 
		 * back gesture is recognized (or the back key is pressed on the desktop).
		 *
		 * Custom Event Fields
		 *
		 * - originalEvent: The original click Event object which caused this
		 *   event to be dispatched. Useful for disambiguating changes if the list
		 *   items contain multiple input fields.
		 **/
		back: 'mojo-back',

		/**
		 * Event.forward = 'mojo-forward'
		 * This event is fired when a forward gesture is recognized
		 **/
		forward: 'mojo-forward',

		/**
		 * Event.up = 'mojo-up'
		 * This event is fired when an up gesture is recognized
		 **/
		up: 'mojo-up',

		/**
		 * Event.down = 'mojo-down'
		 * This event is fired when a down gesture is recognized
		 **/
		down: 'mojo-down',

		/**
		 * Event.command = 'mojo-command'
		 * A command event is generated when a menu item is selected. 
		 **/
		command: 'mojo-command',

		/**
		 * Event.windowDeactivate = 'mojo-window-deactivate'
		 *
		 * A `windowDeactivate` event is generated when a window is no longer active
		 * and potentially receiving the user's attention.
		 * For card windows, this is when the window is minimized.
		 **/
		windowDeactivate: 'mojo-window-deactivate',


		/**
		 * Event.windowActivate = 'mojo-window-deactivate'
		 *
		 * A `windowActivate` event is generated when a window becomes active and is
		 * potentially receiving the user's attention. For card windows, this
		 * is when the window is maximized and fills the screen.
		 **/
		windowActivate: 'mojo-window-activate',

		/**
		 * Event.flick = 'mojo-flick'
		 *
		 * Movement greater than a system-defined rate, between down and
		 * up events, generates a flick event.
		 **/
		flick: 'mojo-flick',

		/**
		 * Event.screenRotate = 'mojo-screen-rotate'
		 *
		 * Fires when the device is turned, unlike an `orientationchange`
		 * event which fires whenever the device moves at all.
		 *
		 * The passed event is an instance of [[Event.ScreenRotateEvent]]
		 **/
		screenRotate: 'mojo-screen-rotate',

		/**
		 * Event.dragStart = 'mojo-drag-start'
		 *
		 * A down action followed by movement outsided of a system-defined radius
		 * generates a `Event.dragStart` event. Usually, the
		 * `Event.dragStart` event is handled by the scroller.  However, any
		 * element that chooses to handle this event gets all subsequent drag
		 * events.
		 *
		 * The passed event is an instance of [[Event.DragEvent]]
		 **/
		dragStart: 'mojo-drag-start',

		/**
		 * Event.dragging = 'mojo-dragging'
		 * Movement following the [[Event.dragStart]] event generates
		 * `dragging` events.
		 *
		 * The passed event is an instance of [[Event.DragEvent]]
		 **/
		dragging: 'mojo-dragging',

		/**
		 * Event.dragEnd = 'mojo-drag-end'
		 * An up action following a [[Event.dragStart]] event generates
		 * a `dragEnd` event.
		 *
		 * The passed event is an instance of [[Event.DragEvent]]
		 **/
		dragEnd: 'mojo-drag-end',

		/**
		 * Event.relaunch = 'mojo-relaunch'
		 * An event that is generated whenever a launch event is sent to the
		 * app. This occurs whenever an app is opened by the user or when the
		 * app is opened programmatically through the application manager
		 * service.
		 *
		 * The passed event is an instance of [[Event.RelaunchEvent]]
		 **/
		relaunch: 'mojo-relaunch',
		
		/**
		 * Event.lowMemory = 'mojo-lowmemory'
		 *
		 * Triggered by the system when memory conditions change. 'data' has
		 * additional event info, including 'state', a string indicating the
		 * new memory state ("low", "critical", "normal").
		 **/
		lowMemory: 'mojo-lowmemory'
	};

	for (key in events) {
		module[key] = events[key];
	}
	exports.Event = module;
	return module;
})();

/* Docs for non-standard multi-touch events provided by the browser */

/**
 * class Event.GestureEvent
 * An instance of this class is passed to gesture event handlers.
 *
 * The available gesture events are:
 *
 *  - `gesturestart`: fires when the user puts 2 fingers on the screen, usually
 *    to pinch or rotate
 *  - `gesturechange`: fires when 1 or both fingers moves on the screen
 *  - `gestureend`: fires when the user lifts 1 or both fingers
 *
 * This event is provided by the browser, but documented here until it
 * becomes part of a formal standard.
 *
 * This event also has the [normal event attributes][1]
 *
 * [1]: http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 **/

/**
 * Event.GestureEvent#rotation -> float
 * The change in the rotation since the start of the event.
 *
 * Clockwise is positive and counter-clockwise is negative.
 **/

/**
 * Event.GestureEvent#scale -> float
 * A scale factor of the gesture.
 *
 * The initial value is 1.0. If the event's scale is < 1.0, then
 * the users fingers are getting closer. If the event's
 * scale is > 1.0, then the users fingers are getting further away.
 **/

/**
 * class Event.OrientationChangeEvent
 * An instance of this class is passed to orientationchange event handlers.
 *
 * This event is provided by the browser, but is documented here until it
 * becomes part of a formal standard.
 *
 * This event also has the [normal event attributes][1]
 *
 * [1]: http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 **/

/**
 * Event.OrientationChangeEvent#pitch -> float
 * The pitch of the device.
 **/

/**
 * Event.OrientationChangeEvent#roll -> float
 * The roll of the device.
 **/

/**
 * Event.OrientationChangeEvent#position -> Number
 * The position of the device.
 *
 * Possible values include:
 *
 * - 0 (Face up)
 * - 1 (Face down)
 * - 2 (Up, default portrait)
 * - 3 (Down, upside down)
 * - 4 (Left, left side down)
 * - 5 (Right, right side down)
 **/

/**
 * class Event.FlickEvent
 * An instance of this class is passed to flick event handlers.
 *
 * Flick event fires on the element at which the flick originated.
 * In addition to the [normal event attributes][1], this event has
 * the attributes documented below.
 *
 * [1]: http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 **/

/**
 * Event.FlickEvent#velocity -> object
 * The velocity of the flick event.
 *
 *     {
 *          x: <the velocity of the flick in the x direction>,
 *          y: <the velocity of the flick in the y direction>
 *     }
 **/

/**
 * Event.FlickEvent#origin -> object
 * The x/y location of the beginning of the flick.
 *
 *     {
 *          x: <the x coordinate of the flick origin>,
 *          y: <the y coordinate of the flick origin>
 *     }
 **/

/**
 * class Event.ScreenRotateEvent
 * An instance of this class is passed to screen rotation event handlers.
 *
 * Contains the [usual properties][1] plus those documented below.
 *
 * [1]: http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 **/

/**
 * Event.ScreenRotateEvent#orientation -> String
 * The new orientation of the screen.
 *
 * Possible values are:
 *
 *  - up
 *  - down
 *  - left
 *  - right
 *
 *  Up is the default. Down is upside down, left is rotated counter-clockwise,
 *  right is rotated clockwise.
 **/

/**
 * class Event.AccelerationEvent
 * An instance of this class is passed to acceleration event handlers.
 *
 * Contains the [usual properties][1] plus those documented below.
 *
 * [1]: http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 **/

/**
 * Event.AccelerationEvent#accelX -> float
 * Acceleration along the X axis in g's
 **/

/**
 * Event.AccelerationEvent#accelY -> float
 * Acceleration along the Y axis in g's
 **/

/**
 * Event.AccelerationEvent#accelZ -> float
 * Acceleration along the Z axis in g's
 **/

/**
 * class Event.ShakeEvent
 * An instance of this class is passed to shake event handlers.
 *
 * Contains the [usual properties][1] plus those documented below.
 *
 * [1]: http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 **/

/**
 * Event.ShakeEvent#magnitude -> Number
 *
 * The magnitude of the shake in g's. Larger numbers indicate
 * more vigorous shaking.
 **/

/**
 * class Event.DragEvent
 * An instance of this class is passed to drag event handlers.
 *
 * Contains the [usual properties][1] plus those documented below.
 *
 * [1]: http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 **/

/**
 * class Event.DragEvent
 * An instance of this class is passed to drag event listeners.
 **/

/**
 * Event.DragEvent#down -> Event
 *
 * The DOM event that started the initial drag. The `target` property
 * of this object is the element that the user is attempting to drag.
 **/

/**
 * Event.DragEvent#move -> Event
 *
 * The DOM event that fires while dragging. Using this event, you can determine
 * where the user has moved his/her finger to on the screen since the beginning
 * of the drag.
 *
 * Not provided on [[Event.dragEnd]] events.
 **/

/**
 * Event.DragEvent#up -> Event
 *
 * The DOM event that fires after the user lifts their finger, thereby ending
 * the drag. You can determine the final position on the screen and the
 * element that was dropped on inspecting this event.
 *
 * Only provided on [[Event.dragEnd]] events.
 **/

/**
 * class Event.RelaunchEvent
 * An instance of this class is passed to [[Event.relaunch]] listeners.
 **/

/**
 * Event.RelaunchEvent#params -> Object
 * An object that contains the launch parameters passed to the
 * application from the application manager. In the case that a user
 * opened the application, this object will be empty.
 **/


//@ sourceURL=mojo.core/child.js

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


//@ sourceURL=mojo.core/animation.js

/*
 * Copyright 2009-2010 Palm, Inc.  All rights reserved.
 */

/*globals _ Module window console */

/** section: Core
 * Animation
 * Holds the infrastructure for coordinating timers for multiple animations.
 **/

var Animation = function() {
	var targetFPS = 40;
	var stepRate = (1/targetFPS) * 1000;
	var showFPSUpdate = 1000;
	var maxExtraFrames = 1; // never run more than N frames in one step.
	var fpsBoxId = 'mojo-fps-display-box';

	function createFpsEl(doc) {
		var el = doc.createElement('div');
		el.id = fpsBoxId;
		el.style.position = 'fixed';
		el.style.width = '60px';
		el.style.height = '1em';
		el.style.top = '90px';
		el.style.right = '130px';
		el.style.margin = '0px auto';
		el.style.border = '1px solid #999';
		el.style['text-align'] = 'center';
		doc.querySelector('body').appendChild(el);
		return el;
	}

	/**
	 * class Animation.Queue
	 *
	 * Allows for running multiple animations using a shared timer, since
	 * the overhead of running multiple timers is pretty high.
	 *
	 * This animator attempts to run at 40 FPS.
	 *
	 * A developer can't instantiate a queue directly, instead one should
	 * call [[Animation.getQueue]] to get the appropriate animation queue.
	 **/
	var Queue = function(targetWindow) {
		this.window = targetWindow || window;
		this.animations = [];
		this.frameTimeStamps = [];
		this.showFPS = false;
		this.nextFPSUpdate = new Date().getTime() + showFPSUpdate;
	};
		
	assignPrototype(Queue, {
		cleanup: function() {
			if (this.timer) {
				this.window.clearInterval(this.timer);
				this.timer = undefined;
			}
		},

		/**
		 * Animation.Queue#add(animation) -> undefined
		 * - animation (Object): An object that contains animation callbacks.
		 *
		 * Adds an animation object to the queue. The object may have the
		 * following callbacks:
		 *
		 * - `animate`: Required. Gets called whenever it is time to progress
		 *    the animation (Once per frame). Receives:
		 *      - `queue` ([[Animation.Queue]]): The queue that called
		 *         the function
		 *      - `catchingUp` (boolean): True if frames were skipped and these
		 *         are frames to catch up.
		 * - `handleError`: If there is an error during animation (such as an
		 *    exception in the `animate` function), this function will be
		 *    called. Receives:
		 *      - `exception` (Error): Optional. If an exception caused the
		 *         function to be called, this is the exception.
		 **/
		add: function(animation) {
			if (!animation.animate)  {
				throw new TypeError(
					'animation object must contain an "animate" property that is a function.');
			}

			var index = this.animations.indexOf(animation);

			// Add only if this is a new animation
			if (index === -1) {
				this.animations.push(animation);

				// Start animating if this is the first animation
				if (this.animations.length == 1) {
					this.timer = this.window.setInterval(this._step.bind(this), stepRate);
					this.frameTimeStamps = [];
					this.renderTime = Date.now() + stepRate;
				}
			}
		},

		/**
		 * Animation.Queue#remove(animation) -> undefined
		 * - animation (Object): The animation object to remove.
		 *
		 * Removes the given animation object from the list,
		 * so its `animate` method will no longer be called.
		 **/
		remove: function(animation) {
			var index = this.animations.indexOf(animation);
			if (index !== -1) {
				this.animations.splice(index, 1);
				if (this.animations.length === 0) {
					this.window.clearInterval(this.timer);
					this.timer = undefined;
					if (this.showFPS) {
						this.reportFPS();
					}
				}
			}
		},

		 /* Executes one frame of the current animation queue, calling each
		  * active animation in turn.
		  */
		_step: function() {
			var animations, i, now, fpsEl;
			var framesToRun;

			// This is a critical path, so do the important lookups
			// on "this" now.
			var showFPS = this.showFPS;

			// Run at least one frame, plus extras if we've already passed
			// their scheduled time

			// how many ms late are we?
			framesToRun = Math.max(0, Date.now() - this.renderTime);
			framesToRun /= stepRate; // how many frames late are we?
			framesToRun = Math.floor(framesToRun + 1); // run at least one.
			framesToRun = Math.min(framesToRun, maxExtraFrames);

			animations = this.animations;
			while(framesToRun > 0) {
				
				if (showFPS) {
					this.frameTimeStamps.push(Date.now());
					if (this.frameTimeStamps.length > 10) {
						this.frameTimeStamps.shift();
					}
				}
				
				// animators may remove themselves from the queue within their
				// animate() function, so we run the loop backwards to avoid
				// skipping one.
				for (i = animations.length - 1; i >= 0; i--){
					this._invokeAnimator(animations[i], (framesToRun > 1));
				}
				
				framesToRun--;
				this.renderTime += stepRate;
			}
			
			// TODO: In order to help avoid sporadic skipped frames,
			// we could allow frames to come in slightly late without a
			// penalty, by adjusting renderTime in that case. This means
			// we wouldn't have a slight lateness slowly accumulate,
			// resulting in an occasional eye-jarring frame skip.
			
			if (showFPS) {
				now = Date.now();
				if (this.frameTimeStamps.length > 1 && now > this.nextFPSUpdate) {
					fpsEl = this.window.document.getElementById(fpsBoxId);
					fpsEl.innerHTML = this.reportFPS();
					this.nextFPSUpdate = now + showFPSUpdate;
				}
			}
		},
		
		/* Invokes a single client from the animation queue.
		 */
		_invokeAnimator: function(a, catchingUp) {
			try {
				a.animate(this, catchingUp);
			} catch (e) {
				this.remove(a);
				if (a.handleError) {
					try {
						a.handleError(e);
					} catch (e2) {
						console.log(e2,
							"exception during animator error handler");
					}
				}
			}
		},

		reportFPS: function() {
			var delta, averageTime, fps;
			var totalTime = 0;
			var frameTimeStamps = this.frameTimeStamps;
			for (var i=1; i < frameTimeStamps.length; i++) {
				delta = frameTimeStamps[i] - frameTimeStamps[i-1];
				totalTime += delta;
			}
			averageTime = totalTime/(frameTimeStamps.length-1);
			fps = Math.round(1000/averageTime);
			return fps;
		},

		/**
		 * Animation.Queue#toggleFPSBox() -> Element
		 *
		 * Creates a div that shows how many frames per second
		 * are currently being animated. Useful for debugging
		 * animation performance.
		 **/
		toggleFPSBox: function() {
			var doc = this.window.document;
			var fpsEl;
			if (this.showFps) {
				fpsEl = doc.getElementById(fpsBoxId);
				doc.querySelector('body').removeChild(fpsEl);
			}
			else {
				fpsEl = createFpsEl(doc);
			}
			this.showFps = !this.showFps;
			return fpsEl;
		}
	});

	var module = {
		/**
		 * Animation.getQueue(el) -> Animation.Queue
		 * - el (DOMElement | Document): A DOM element or document for which you
		 *   want the animation queue.
		 *
		 * Given a DOM element, returns a reference to the appropriate animation
		 * queue to use. Creates a new queue if one does not already exist.
		 **/
		getQueue: function(el) {
			var q, win;
			var oDoc = el.ownerDocument;

			function cleanup(e) {
				if (win && win._mojoAnimationQueue) {
					win._mojoAnimationQueue.cleanup();
				}
			}

			if (oDoc) {
				win = oDoc.defaultView;
			}
			else { // assume el is a document
				win = el.defaultView;
			}

			if (win) {
				q = win._mojoAnimationQueue;
				if (!q) {
					q = new Queue(win);
					win._mojoAnimationQueue = q;
					win.addEventListener('unload', cleanup);
				}
			}
			else {
				throw new TypeError(
					"Animation.getQueue: Could not find window for element");
			}

			return q;
		}
	};

	module.targetFPS = targetFPS;
	module.stepRate = stepRate;

	exports.Animation = module;
	return module;
}();


//@ sourceURL=mojo.core/scroll.js

/*globals _ Event Module Animation clearTimeout GarbageStats assertElement */

/** section: Core
 * Scroll
 * Handles scrolling, which is implemented in JavaScript in webOS.
 **/
var Scroll = function() {

	var key;

	// Private constants
	var STEP_RATE = Animation.stepRate * 1.2,
		MAX_TIME_SKIP = STEP_RATE * 3,
		FLICK_SPEED = 0.06,
		FLICK_RATIO = 0.5,
		OVERSCROLL_TARGET_SPEED = 0.25,
		CORRECT_OVERSCROLL_SPEED = 0.3,
		DELAYED_STOP_MS = 150,
		MIN_SCROLL_DELTA_SIZE = 3,
		MIN_MOVE_DELTA = 1,
		SCROLL_EVENT_RATE = 10;

	var PROPERTY_MAP = {
		x: 'width',
		y: 'height'
	};

	var SCROLL_MAP= {
		x: 'scrollLeft',
		y: 'scrollTop'
	};

	function getBorderWidth(el, border) {
		var width = 0;
		var styleName = "border-" + border + "-width";
		var style = el.style[styleName];
		if (style) {
			width = parseInt(style, 10);
			if (!width) {
				width = 0;
			}
		}
		return width;
	}

	function getUsableDimensions(el) {
		var dimensions = {
			width: el.offsetWidth,
			height: el.offsetHeight
		};
		dimensions.width -= getBorderWidth(el, "left");
		dimensions.width -= getBorderWidth(el, "right");
		dimensions.height -= getBorderWidth(el, "top");
		dimensions.height -= getBorderWidth(el, "bottom");
		return dimensions;
	}

	function getScrollPosition(el) {
		return {
			x: el.scrollLeft,
			y: el.scrollTop
		};
	}

	function getContentSize(el) {
		return {
			width: el.scrollWidth,
			height: el.scrollHeight
		};
	}

	function positionedOffset(el) {
		var x = 0, y = 0;
		do {
			y += el.offsetTop || 0;
			x += el.offsetLeft || 0;
			el = el.offsetParent;
			if (el) {
				if(el.tagName.toLowerCase() == "body") {
					break;
				}
				if (el.style.position !== 'static') {
					break;
				}
			}
		} while (el);

		return {
			x: x,
			y: y
		};
	}

	function roundTowardZero(num) {
		return num | 0;
	}

	function zenoCalculate(fdr, elapsedFrames) {
		// complement of the FDR, that represents the ratio
		// of distance left to travel after a frame
		var approachFDR;

		// if the total distance to travel is 1, this represents
		// how much distance there is left to travel after
		// a certain number of frames have elapsed
		var unitDistanceRemaining;

		// if the total distance to travel is 1, this represented
		// how much distance has been traveled after
		// a certain number of frames have elapsed
		var unitDistanceTraveled;

		approachFDR = 1 - fdr;
		unitDistanceRemaining = Math.pow(approachFDR, elapsedFrames);
		unitDistanceTraveled = 1 - unitDistanceRemaining;

		return unitDistanceTraveled;
	}

	var events = {
		/**
		 * Scroll.scrollStart = 'mojo-core-scroll-start'
		 * The event that fires when scrolling starts. Fires on
		 * the scrollable element.
		 **/
		scrollStart: 'mojo-core-scroll-start',

		/**
		 * Scroll.scrolling = 'mojo-core-scrolling'
		 * The event that fires while scrolling.
		 *
		 * This event is throttled, but still should fire frequently to do
		 * content updates. Keep in mind that this event fires on the animation
		 * loop's critical path, so any work done in this event handler can
		 * potentially cause skips in the animation.
		 *
		 * Fires on the scrollable element.
		 **/
		scrolling: 'mojo-core-scrolling',

		/**
		 * Scroll.scrollEnd = 'mojo-core-scroll-end'
		 * The event that fires when scrolling stops. Fires on
		 * the scrollable element.
		 **/
		scrollEnd: 'mojo-core-scroll-end'
	};

	/* Calculates the next position */
	var DragAnimator = {
		done: false,
		lastUpdateTime: 0,
		target: 0,
		current: 0,
		initialized: false,
		initialize: function(position, min, max) {
			if (!this.initialized) {
				this.current = position;
				this.target = position;
				this.min = min;
				this.max = max;
				this.initialized = true;
			}
		},
		updateTarget: function(newTarget) {
			this.target = newTarget;
		},
		animate: function() {
			var deltaDist = this.target - this.current;
			this.current += deltaDist;
			this.done = true;
			return this.current;
		},
		overscroll: function() {
			var elapsed, elapsedFrames;
			var now = Date.now();
			var fdr = CORRECT_OVERSCROLL_SPEED;
			var current = this.current;
			var target = this.target;
			var lastUpdateTime = this.lastUpdateTime;

			if(!lastUpdateTime) {
				lastUpdateTime = now - STEP_RATE;
			}

			elapsed = Math.min(MAX_TIME_SKIP, now - lastUpdateTime);
			this.lastUpdateTime = lastUpdateTime + elapsed;
			elapsedFrames = elapsed / STEP_RATE;

			if (Math.abs(target - current) <= MIN_MOVE_DELTA) {
				//very near target, go there directly
				current = target;
			} else {
				current += zenoCalculate(fdr, elapsedFrames) *
					(target - current);
			}

			this.current = current;

			// done when time has passed, movement is < 1, and the target hasn't
			// moved
			this.done = elapsedFrames && (roundTowardZero(current) === 0);

			return this.current;
		},
		checkOverscroll: function() {
			if (this.current > this.max) {
				this.dontStop = true;
				this.target = this.max;
				this.animate = this.overscroll;
			}
			else if (this.current < this.min) {
				this.dontStop = true;
				this.target = this.min;
				this.animate = this.overscroll;
			}
		}
	};

	var FlickAnimator = Object.create(DragAnimator);
	FlickAnimator.animate = function() {
		var fdr;
		var now = Date.now();
		var lastUpdateTime = this.lastUpdateTime;
		var target = this.target;
		var current = this.current;

		var deltaDist = target - current;

		// amount of time elapsed since last animate update.
		var elapsed, elapsedFrames;

		// the flicking start time needs to be set/reset on a new flick,
		// a target change, or FDR change
		if(!this.lastUpdateTime) {
			lastUpdateTime = now - STEP_RATE;
		}

		fdr = FLICK_SPEED;

		elapsed = Math.min(MAX_TIME_SKIP, now - lastUpdateTime);
		this.lastUpdateTime = lastUpdateTime + elapsed;
		elapsedFrames = elapsed / STEP_RATE;

		current += zenoCalculate(fdr, elapsedFrames) * deltaDist;
		this.current = current;

		// done when time has passed, movement is < 1
		this.done = elapsedFrames &&
			(roundTowardZero(target - current) === 0);

		return current;
	};
	FlickAnimator.checkOverscroll = function() {
		if (this.target > this.max || this.target < this.min) {
			this.dontStop = true;
			this.animate = this.overscroll;
		}
	};
	FlickAnimator.overscroll = function() {
		var lastUpdate, elapsed, elapsedFrames, limit, isMaxLimit,
			ret, bothOutside, numFrames, frac;
		var now = Date.now();
		var amountToMoveTarget;
		var adjustedTarget = this.target;
		var fdr = CORRECT_OVERSCROLL_SPEED;
		var adjustedCurrent = this.current;

		if(!this.lastUpdateTime) {
			this.lastUpdateTime = now - STEP_RATE;
		}

		lastUpdate = this.lastUpdateTime;

		elapsed = Math.min(MAX_TIME_SKIP, now - lastUpdate);
		this.lastUpdateTime += elapsed;
		elapsedFrames = elapsed / STEP_RATE;

		if (adjustedTarget < this.min && adjustedCurrent < this.min) {
			bothOutside = true;
			limit = this.min;
		}
		else if (adjustedTarget > this.max && adjustedCurrent > this.max) {
			bothOutside = true;
			limit = this.max;
		}

		if(bothOutside) {
			// if calculating next coordinate via iteration, the discrete and
			// partial number of frames need to be handled separately
			// NOTE: it's important that roundTowardZero is done on delta'ed
			// times, otherwise overflow is possible/likely
			numFrames = roundTowardZero(elapsedFrames);
			frac = elapsedFrames - numFrames;
			
			if (roundTowardZero(limit - adjustedTarget) === 0) {
				adjustedTarget = limit;
			}

			while(numFrames) {
				amountToMoveTarget = (limit - adjustedTarget) * 0.25;
				adjustedTarget += amountToMoveTarget;
				adjustedCurrent += (adjustedTarget - adjustedCurrent) * fdr;

				--numFrames;
			}
			if(frac) {
				//XXX: constant
				amountToMoveTarget = (limit - adjustedTarget) * 0.25 * frac;
				adjustedTarget += amountToMoveTarget;

				adjustedCurrent += (adjustedTarget - adjustedCurrent) *
					fdr * frac;
			}
		} else if(Math.abs(adjustedTarget - adjustedCurrent) <=
				MIN_MOVE_DELTA) {
			//very near target, go there directly
			adjustedCurrent = adjustedTarget;
		} else {
			//current coordinate not yet outside, proceed as a normal zeno.
			adjustedCurrent += zenoCalculate(fdr, elapsedFrames) *
				(adjustedTarget - adjustedCurrent);
		}

		this.target = adjustedTarget;
		this.current = adjustedCurrent;

		// done when time has passed, movement is < 1, and the target
		// hasn't moved
		this.done = elapsedFrames &&
			roundTowardZero(adjustedCurrent - adjustedTarget) === 0;

		return this.current;
	};


	/* This is the generic scrolling engine. Fancier scrollers should inherit
	 * from this scroll engine.
	 *
	 * The engine's responsibility is to move the element's scroll position as
	 * is appropriate. It is not responsible for doing the math to figure out
	 * how much to move the element by, instead it asks the Animator how much it
	 * should move, then does the movement.
	 */
	function Engine(el, axes) {
		this.el = el;
		this.axes = axes || ["x", "y"];
		this.calculateLimits();


		// //XXX: Temporary for timing recording
		// this.accum = 0;
		// this.accumTotal = 0;
	}

	assignPrototype(Engine, {
		perAxis: function(fn) {
			var i;
			var len = this.axes.length;
			for (i = 0; i < len; i++) {
				fn.call(this, this.axes[i]);
			}
		},

		move: function(motions, animators) {
			var self = this;
			var elementPos = getScrollPosition(this.el);
			var target;

			self.animators = animators;

			self.perAxis(function(axis) {
				var motion = motions[axis];
				var limit = self.limits[axis];
				var animator = animators[axis];

				if (motion === undefined) {
					return;
				}

				// Initialize. Only needs to be done once, but doesn't hurt
				animator.initialize(elementPos[axis], limit.min, limit.max);

				target = animator.target;

				// Slow down when outside
				if (target > limit.max || target < limit.min) {
					motion = (0.5 * motion);
				}

				target += motion;
				target = Math.max(limit.minOverLimit, target);
				target = Math.min(limit.maxOverLimit, target);
				animator.updateTarget(target);
			});
			if (!self.animating) {
				self.startAnimating();
			}
		},

		brake: function() {
			if (this.animating) {
				this.braking = setTimeout(this.finishStop.bind(this), DELAYED_STOP_MS);
			}
		},

		stopBraking: function() {
			clearTimeout(this.braking);
			this.braking = undefined;
		},

		finishStop: function() {
			var self = this;
			var stop = true;

			if (!self.braking) { return; }

			self.braking = undefined;
			self.perAxis(function(axis) {
				var animator = self.animators[axis];
				if (!animator.dontStop) {
					// Hey, we're there!
					// That is, this axis can be stopped, so even if we
					// don't end up stopping animation, we should stop this
					// axis. So set the target to current.
					animator.updateTarget(animator.current);
				}
				else {
					stop = false;
				}
			});

			if (stop) {
				self.stopAnimating();
			}
		},

		calculateMax: function() {
			var self = this;
			var contentSize, scrollerSize, property, max;
			var ret = { x: 0, y: 0 };

			self.perAxis(function(axis) {
				property = PROPERTY_MAP[axis];

				scrollerSize = getUsableDimensions(self.el)[property];
				contentSize = getContentSize(self.el)[property];
				max = contentSize - scrollerSize;

				if(max < MIN_SCROLL_DELTA_SIZE) {
					max = 0;
				}

				ret[axis] = max;
			});
			return ret;
		},

		calculateLimits: function() {
			var self = this;
			var limit;
			var ratio = 2;
			var margin;
			var dimensions = getUsableDimensions(self.el);
			var max = self.calculateMax();

			self.limits = {};

			self.perAxis(function(axis) {
				self.limits[axis] = limit = {};

				margin = Math.floor(dimensions[PROPERTY_MAP[axis]]*ratio);

				limit.min = 0;
				limit.max = max[axis];
				limit.minOverLimit = limit.min - margin;
				limit.maxOverLimit = limit.max + margin;
			});
		},

		startAnimating: function() {
			if (!this.animating) {
				Animation.getQueue(this.el).add(this);
				this.animating = true;
				this.frames = 0;
				Event.send(this.el, events.scrollStart);
				//this.gcStat = new GarbageStats(); //XXX: Remove
			}
		},

		stopAnimating: function() {
			if (this.animating) {
				this.animating = false;
				Animation.getQueue(this.el).remove(this);
				Event.send(this.el, events.scrollEnd);
				//this.gcStat.reportStats(); //XXX: Remove
			}
		},

		// The animation function that takes pending movements,
		// calculates the new positions with this.animator,
		// and then does the movement.
		animate: function(queue) {
			// var start = Date.now();
			// var end;

			var axis, target, current, animator, scrollProperty,
				newPosition, oldAnimator, limit, i, len;

			var done = true;
			var el = this.el;

			len = this.axes.length;
			for (i = 0; i < len; i++) {
				axis = this.axes[i];
				animator = this.animators[axis];
				scrollProperty = SCROLL_MAP[axis];

				newPosition = animator.animate(); // GO! GO! GO!

				done &= animator.done;
				el[scrollProperty] = newPosition;
			}

			this.frames++;
			if ((this.frames % SCROLL_EVENT_RATE) === 0) {
				Event.send(el, events.scrolling);
			}

			if (done) {
				this.stopAnimating();
			}

			// end = Date.now();
			// this.accumTotal++;
			// this.accum += end - start;
			// console.log('tot ' + this.accum/this.accumTotal);
		}
	});

	/**
	 * class Scroll.ScrollableElement
	 * Created with [[Scroll.createScrollableElement]].
	 **/
	function ScrollableElement(el, direction) {
		assertElement(el);
		var axes;

		switch (direction) {
			case 'vertical':
				axes = ['y'];
				break;
			case 'horizontal':
				axes = ['x'];
				break;
			case 'free':
				axes = ['x', 'y'];
				break;
			default:
				axes = ['x', 'y'];
				break;
		}

		this.el = el;

		this.el.style.overflow = 'hidden';
		// Overrides overflow hidden, but doesn't work in regular browser.
		this.el.style.overflow = "-webkit-palm-overflow";

		this.dragStart = this.dragStart.bind(this);
		this.dragged = this.dragged.bind(this);
		this.dragEnd = this.dragEnd.bind(this);

		this.flick = this.flick.bind(this);
		this.flickStop = this.flickStop.bind(this);

		this.cleanup = this.cleanup.bind(this);

		this.engine = new Engine(el, axes);

		el.addEventListener(Event.dragStart, this.dragStart);
		el.addEventListener(Event.flick, this.flick);
		el.addEventListener(el, 'mousedown', this.flickStop);

		el.addEventListener('DOMNodeRemovedFromDocument', this.cleanup);
	}

	assignPrototype(ScrollableElement, {
		cleanup: function(e) {
			var el = this.el;

			el.removeEventListener(Event.dragStart, this.dragStart);
			el.removeEventListener(Event.flick, this.flick);
			el.removeEventListener('mousedown', this.flickStop);

			el.removeEventListener('DOMNodeRemovedFromDocument', this.cleanup);
		},
		dragStart: function(e) {
			this.el.addEventListener(Event.dragging, this.dragged);
			this.el.addEventListener(Event.dragEnd, this.dragEnd);

			this.lastPointer = Event.pointer(e.down);
			this.dragAnimators = {
				x: Object.create(DragAnimator),
				y: Object.create(DragAnimator)
			};
			this.dragged(e); //dragStart is also the first drag event

			Event.stop(e);
		},

		dragged: function(e) {
			var self = this;
			var i, last, current, axis;
			var moveEvent = e.move || e;
			var pointer = Event.pointer(moveEvent);
			var motions = {x: 0, y: 0};
			var axes = [];
			for (i in motions) {
				if (motions.hasOwnProperty(i)) {
					axes.push(i);
				}
			}
			var len = axes.length;

			for (i = 0; i < len; i++) {
				axis = axes[i];
				last = self.lastPointer[axis];
				current = pointer[axis];
				if (last != current) {
					motions[axis] = last - current;
				}
			}

			self.lastPointer = pointer;
			self.engine.move(motions, self.dragAnimators);
		},

		dragEnd: function(e) {
			// Allow overscroll now if we need it.
			this.dragAnimators.x.checkOverscroll();
			this.dragAnimators.y.checkOverscroll();

			this.dragged(e.up);
			this.stopDrag();
			Event.stop(e);
		},

		stopDrag: function(e) {

			this.dragAnimators = undefined;

			this.el.removeEventListener(Event.dragging, this.dragged);
			this.el.removeEventListener(Event.dragEnd, this.dragEnd);
		},

		flick: function(e) {
			var motion = {};
			var animators = {
				x: Object.create(FlickAnimator),
				y: Object.create(FlickAnimator)
			};

			this.stopDrag();
			this.engine.stopBraking();

			for (axis in e.velocity) {
				if (e.velocity.hasOwnProperty(axis)) {
					motion[axis] = e.velocity[axis] * -FLICK_RATIO;
				}
			}
			this.engine.move(motion, animators);

			animators.x.checkOverscroll();
			animators.y.checkOverscroll();

			Event.stop(e);
		},

		flickStop: function(e) {
			this.engine.brake();
		},

		/**
		 * Scroll.ScrollableElement#revealTop([animate]) -> undefined
		 * - animate (boolean): If truthy, animates the scrolling.
		 *
		 * Scrolls to the top of the scrollable area.
		 **/
		revealTop: function(animate) {
			return this.scrollTo(undefined, 0, animate);
		},

		/**
		 * Scroll.ScrollableElement#revealBottom([animate]) -> undefined
		 * - animate (boolean): If truthy, animates the scrolling.
		 *
		 * Scrolls to the bottom of the scrollable area.
		 **/
		revealBottom: function(animate) {
			return this.scrollTo(undefined,
				this.el.scrollHeight - this.el.offsetHeight,
				animate);
		},

		/**
		 * Scroll.ScrollableElement#revealElement(el[,animate]) -> Number
		 * - el (HTMLElement): The element you want to show
		 * - animate (boolean): If truthy, animates the scrolling.
		 *
		 * Takes an element and scrolls to the bottom of it if it's below, or to the
		 * top of it if it's above.
		 *
		 * Returns the number of pixels to scroll in the Y direction. The X
		 * direction does not scroll.
		 **/
		revealElement: function(el, animate) {
			assertElement(el);

			if (!this.el.contains(el)) {
				throw new Error(
					"scrollable element does not contain element to reveal");
			}

			var currentTop = -getScrollPosition(this.el).y;
			var currentBottom = currentTop + getUsableDimensions(this.el).height;
			var elHeight = el.offsetHeight;
			var elOffset = positionedOffset(el);

			var currentlyShowing = currentBottom - elOffset.y;
			var remainingToShow = elHeight - currentlyShowing;

			if (Math.abs(remainingToShow) > 0) {
				this.adjustBy(0, remainingToShow);
			}

			return remainingToShow;
		},

		/**
		 * Scroll.ScrollableElement#adjustBy(dx, dy) -> undefined
		 * - dx (Number | undefined): The amount to change x by.
		 * - dy (Number | undefined): The amount to change y by.
		 *
		 * Scrolls the element by the amount specified by (dx, dy). Ignores
		 * a coordinate if it's undefined.
		 **/
		adjustBy: function(dx, dy) {
			this.engine.move({
				x: dx,
				y: dy
			}, {
				x: Object.create(DragAnimator),
				y: Object.create(DragAnimator)
			});
		},

		/**
		 * Scroll.ScrollableElement#scrollTo(x, y[, animate]) -> undefined
		 * - x (Number | undefined): The x coordinate to scroll to.
		 * - y (Number | undefined): The y coordinate to scroll to.
		 * - animate (boolean): If truthy, animates the scrolling.
		 *
		 * Scroll to the coordinate specified. If either coordinate is
		 * undefined, it is ignored.
		 **/
		scrollTo: function(x, y, animate) {
			var animator = animate ? FlickAnimator : DragAnimator;
			var movement = {
				x: x !== undefined ? -(this.el.scrollLeft - x) : x,
				y: y !== undefined ? -(this.el.scrollTop - y) : y
			};
			this.engine.move(movement, {
				x: Object.create(animator),
				y: Object.create(animator)
			});
		},

		/**
		 * Scroll.ScrollableElement#getScrollPosition() -> Object
		 *
		 * Returns an object with the current scroller position:
		 *
		 * - top (Number): The top coordinate.
		 * - left (Number): The left coordinate.
		 **/
		getScrollPosition: function() {
			return {
				top: this.el.scrollTop,
				left: this.el.scrollLeft
			};
		}
	});

	var module = {
		/**
		 * Scroll.createScrollableElement(el[, direction]) -> Scroll.ScrollableElement
		 * - el (DOMElement): The element you want to be able to scroll.
		 * - direction (String): Limit the direction of the scrolling. Default
		 *   is to freely scroll both vertically and horizontally. Valid
		 *   values for this argument are 'vertical', 'horizontal' or 'free'
		 *
		 * This takes an element and wraps it in the necessary logic to make
		 * it scrollable. Will handle flicks and drags, and fires the events
		 * documented in the [[Scroll]] namespace as appropriate.
		 *
		 * JS Example
		 * ----------
		 *
		 *     // This element will only scroll up and down, like a list.
		 *     var myElement = document.getElementById('my-content');
		 *     Mojo.Core.Scroll.createScrollableElement(myElement, "vertical");
		 **/
		createScrollableElement: function(el, direction) {
			return new ScrollableElement(el, direction);
		},

		/**
		 * Scroll.makeViewportScrollable(document[, axes]) -> Scroll.ScrollableElement
		 * - document (HTMLDocument): The document whose body you want to make
		 *   scrollable.
		 * - axes (Array): An array of dimensions indicating which directions
		 *   you want the scroller to operate in. Valid values are `["x"]`,
		 *   `["y"]`, and `["x", "y"]`
		 *
		 * This function makes the body of the provided document scrollable.
		 * It is a convenience function for the common case where the developer
		 * wants their entire window to scroll.
		 **/
		makeViewportScrollable: function(doc, axes) {
			if (!(doc && doc.nodeType == 9)) {
				throw new TypeError("must pass a document to make scrollable");
			}

			var children = Array.prototype.slice.call(doc.body.childNodes);
			var contentEl = doc.createElement('div');

			function setDimensions() {
				contentEl.style.height = doc.documentElement.clientHeight + "px";
				contentEl.style.width = doc.documentElement.clientWidth + "px";
			}

			function cleanup() {
				doc.defaultView.removeEventListener('resize', setDimensions);
				doc.defaultView.removeEventListener('unload', cleanup);
			}

			contentEl.name = 'mojo-core-viewport-scroller';
			setDimensions();
			doc.body.appendChild(contentEl);

			for (var i = 0; i < children.length; i++) {
				contentEl.appendChild(children[i]);
			};

			doc.defaultView.addEventListener('resize', setDimensions);
			doc.defaultView.addEventListener('unload', cleanup);

			return module.createScrollableElement(contentEl, axes);
		}
	};

	for (key in events) {
		module[key] = events[key];
	}

	exports.Scroll = module;
	return module;
}();


//@ sourceURL=mojo.core/app.js

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


//@ sourceURL=mojo.core/appmenu.js

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


//@ sourceURL=mojo.core/altchar.js


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

}