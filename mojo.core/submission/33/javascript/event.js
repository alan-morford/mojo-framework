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
