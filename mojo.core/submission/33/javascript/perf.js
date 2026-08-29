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
