/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-21a80088'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "visualiceList.html",
    "revision": "3887b0b458e7ee0d7f83103ca141007c"
  }, {
    "url": "traxsource.html",
    "revision": "0e002b069b73db686cbdfa1346b2df6f"
  }, {
    "url": "tidal-download.html",
    "revision": "d97dccc8adf2780809a2509c4e35b4d8"
  }, {
    "url": "radio.html",
    "revision": "c5f19bcefb7c2d6987841ea68cf6fa89"
  }, {
    "url": "mis-listas.html",
    "revision": "e38996675ad3b2e08138d1d394d8c015"
  }, {
    "url": "login.html",
    "revision": "49daa2c6a87dae15a8f278e1a7e22a62"
  }, {
    "url": "index.html",
    "revision": "e14f2e4ad80e4cbeeeb2782dc112e1f5"
  }, {
    "url": "beatport.html",
    "revision": "9c9b58cb4a32928d63a6dc064c3516f9"
  }, {
    "url": "auth-helper.js",
    "revision": "d40e3bc4f4238747c2e8901060f3c9cb"
  }, {
    "url": "1001tracklists.html",
    "revision": "271bb277782a8456ad03ca5c16854b7a"
  }, {
    "url": "images/wallpaperIbiza.png",
    "revision": "966d752ca22961b8ee825c65817bb8ad"
  }, {
    "url": "images/icon.PNG",
    "revision": "928390d751c233075d46585121da6370"
  }, {
    "url": "images/IbizaVibesRadio.png",
    "revision": "3c462718dcd528e077a767ad9381d01b"
  }, {
    "url": "icons/icon-512x512.png",
    "revision": "44308c7ab6abe1d2355eab2e3eae4198"
  }, {
    "url": "icons/icon-192x192.png",
    "revision": "cc46e6e10d35e86c2cb3ef97bf2705cc"
  }, {
    "url": "assets/workbox-window.prod.es5-BIl4cyR9.js",
    "revision": null
  }, {
    "url": "assets/index-DF4kou43.css",
    "revision": null
  }, {
    "url": "assets/index-BKA7axLh.js",
    "revision": null
  }, {
    "url": "icons/icon-192x192.png",
    "revision": "cc46e6e10d35e86c2cb3ef97bf2705cc"
  }, {
    "url": "icons/icon-512x512.png",
    "revision": "44308c7ab6abe1d2355eab2e3eae4198"
  }, {
    "url": "images/icon.PNG",
    "revision": "928390d751c233075d46585121da6370"
  }, {
    "url": "images/wallpaperIbiza.png",
    "revision": "966d752ca22961b8ee825c65817bb8ad"
  }, {
    "url": "manifest.webmanifest",
    "revision": "3f7ccaaaef73859e8cbb316c1fe62e21"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/\/api\/.*/i, new workbox.NetworkFirst({
    "cacheName": "api-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 3600
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
