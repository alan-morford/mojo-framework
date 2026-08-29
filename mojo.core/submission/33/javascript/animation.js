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
