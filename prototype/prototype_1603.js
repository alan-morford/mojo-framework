/* If there's an appropriately named Prototype loader global, then we're
 * running in an environment with prototype built-in and should initialize
 * it to copy it into the global object, otherwise inject the full version
 * of Prototype.
 */
if (window.InstallPrototypeBuiltIn) {
	InstallPrototypeBuiltIn(window);
} else {
	document.write(
		'<script type="text/javascript" src="/usr/palm/frameworks/prototype/prototype-1.6.0.3.js"></script>'
	);
}