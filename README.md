# Mojo framework (webOS 1.0, submission 506) — LuneOS port

Palm's Mojo JavaScript application framework as shipped in webOS 3.0.5,
unpacked and carrying the LuneOS patches that make it run on WebAppMgr's
Chromium instead of LunaSysMgr's 2011 WebKit. Installed on device as
`/usr/palm/frameworks/`, it serves applications whose `index.html` loads
`<script src="/usr/palm/frameworks/mojo/mojo.js" x-mojo-version="1">`.

The framework here was extracted from a webOS 3.0.5 TouchPad doctor image (rootfs
`usr/palm/frameworks`) with `extract-mojo-framework.sh` from
`meta-webos-ports/meta-luneos/recipes-webos-owo/frameworks/mojo-framework/`.

## Layout

| Path           | Contents                                                        |
|----------------|-----------------------------------------------------------------|
| `mojo/`        | `mojo.js`, submission 506 assets, the builtin framework blobs   |
| `mojocommon/`  | shared images and templates; `mojo/` symlinks into it           |
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

The working tree (HEAD) therefore matches exactly what
`mojo-framework.bb` in meta-webos-ports installs to
`/usr/palm/frameworks/`.

## Building with the Yocto recipe

`mojo-framework.bb` expects the **pristine** payload — it applies the patch
and de-nativizes at build time itself. Generate its tarball from the tag, not
from HEAD (HEAD would get patched twice):

```sh
git archive --format=tar --prefix=mojo-framework-1.0-506/ pristine-506 \
    | gzip > /path/to/downloads/mojo-framework-1.0-506.tar.gz
```

A ready-made copy also lives at `~/mojo-port/mojo-framework-1.0-506.tar.gz`.

## Related

- Recipe, patch and tools: `meta-webos-ports/meta-luneos/recipes-webos-owo/frameworks/mojo-framework/`
  (merged on `master`, commit `4f27474e1`)
- Port session artifacts (screenshots, report, deploy scripts): `~/mojo-port/`
