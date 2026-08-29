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
