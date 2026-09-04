# Mojo framework — LuneOS port

Palm's Mojo JavaScript application frameworks — Mojo 1 (submission 506) and
Mojo 2 (submission 205) — as shipped in webOS 3.0.5, unpacked and carrying
the LuneOS patches that make them run on WebAppMgr's Chromium instead of
LunaSysMgr's 2011 WebKit. Installed on device as `/usr/palm/frameworks/`,
serving applications whose `index.html` loads
`<script src="/usr/palm/frameworks/mojo/mojo.js" x-mojo-version="1">` or
`<script src="/usr/palm/frameworks/mojo2/mojo.js">`.

The framework here was extracted from a webOS 3.0.5 TouchPad doctor image (rootfs
`usr/palm/frameworks`) with `extract-mojo-framework.sh` from
`meta-webos-ports/meta-luneos/recipes-webos-owo/frameworks/mojo-framework/`.

## Layout

| Path           | Contents                                                        |
|----------------|-----------------------------------------------------------------|
| `mojo/`        | `mojo.js`, submission 506 assets, the builtin framework blobs (both Mojo 1's 506 and Mojo 2's 2205) |
| `mojo2/`       | Mojo 2 bootstrap `mojo.js` and submission 205 assets            |
| `mojocommon/`  | shared images and templates; `mojo/` and `mojo2/` symlink into it |
| `mojo.core/`   | loadable framework behind `mojo-core.js`                        |
| `prototype/`   | stock Prototype 1.6.0.3, used instead of the builtin rewrite    |
| `mojo-core.js` | loader stub for `mojo.core`                                     |

## History

The git history separates Palm's code from the LuneOS changes:

1. **`pristine-506` tag** — untouched framework as extracted from the image.
2. *mojo.js: load the framework builtins from disk* — LunaSysMgr injected the
   builtins as V8 natives before app scripts ran; WebAppMgr has no such hook,
   so the patched `mojo.js` document.write()s them as ordinary scripts.
3. *builtins: de-nativize the palmInitFramework blobs* — the blobs' trailers
   call the privileged `%SetProperty(global, ...)` intrinsic, which Chromium
   rejects at parse time; rewritten to plain global assignments
   (`denativize.py` from the meta-webos-ports recipe).
4. *mojo: add mojo-compat.js* — runtime shims for 2011-WebKit behaviour
   (`-webkit-border-image` border-style, missing `PalmSystem` members).
5. **`pristine-mojo2-205` tag** — untouched `mojo2/` as extracted from the
   image: the bootstrap `mojo.js` and submission 205's assets. The framework
   code is the `palmInitFramework2205` blob already carried (de-nativized) in
   `mojo/builtins/`; released submissions ship neither `mojo_host_loader.js`
   nor the `javascripts/` tree it would load.
6. *mojo2/mojo.js: load the framework builtin from disk* — mirrors Mojo 1's
   patch, plus recomputes `Mojo.Host.current` to palm-sys-mgr once
   MojoLoader's `palmGetResource` polyfill is in place (browser mode would
   route stage operations through the nonexistent desktop `MojoHost`), and
   shares `mojo-compat.js` with Mojo 1.

The working tree (HEAD) therefore matches exactly what
`mojo-framework.bb` in meta-webos-ports installs to
`/usr/palm/frameworks/`.

## Building with the Yocto recipe

`mojo-framework.bb` fetches this repository directly at a pinned `SRCREV`
(the fully patched tree — no build-time patching remains) and installs it
under `/usr/palm/frameworks/`. Mojo 2 additionally needs the `underscore`
and `foundations` loadable frameworks at runtime; the recipe RDEPENDS on
them. The `pristine-*` tags exist so Palm's code stays separable from the
LuneOS changes and to regenerate the historical tarball if ever needed:

```sh
git archive --format=tar --prefix=mojo-framework-1.0-506/ pristine-506 \
    | gzip > /path/to/downloads/mojo-framework-1.0-506.tar.gz
```

## Related

- Recipe, patch and tools: `meta-webos-ports/meta-luneos/recipes-webos-owo/frameworks/mojo-framework/`
  (merged on `master`, commit `4f27474e1`)
- Port session artifacts (screenshots, report, deploy scripts): `~/mojo-port/`
