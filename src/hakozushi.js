self.Hakozushi = {};

Hakozushi.run = function (e) {
  var f = e.ownerDocument.createElement ('dummy-container');
  while (e.firstChild) {
    f.appendChild (e.firstChild);
  }
  e.appendChild (f);
  var tryCount = 0;
  var maxTryCount = 30;
  var eWidth = e.offsetWidth;
  var minLastWidth = 3.5 * parseFloat (getComputedStyle (e).fontSize);
  e.style.transformOrigin = "left top";
  e.style.boxSizing = "border-box";
  var factor = 1;
  var rects = f.getClientRects ();
  while (rects.length > 1 && rects[rects.length-1].width < minLastWidth && tryCount++ < maxTryCount) {
    factor *= 0.99;
    e.style.transform = "scalex("+factor+")";
    e.style.width = eWidth / factor + "px";
    e.setAttribute ('data-try-count', tryCount);
    rects = f.getClientRects ();
  }
}; // Hakozushi.run

(function (s) {
  var selector = s.getAttribute ('data-selector');
  if (!selector) return;

  var op = Hakozushi.run;
  var mo = new MutationObserver (function (mutations) {
    mutations.forEach (function (m) {
      Array.prototype.forEach.call (m.addedNodes, function (e) {
        if (e.nodeType === e.ELEMENT_NODE) {
          if (e.matches (selector)) op (e);
          Array.prototype.forEach.call (e.querySelectorAll (selector), op);
        }
      });
    });
  });
  mo.observe (document, {childList: true, subtree: true});
  Array.prototype.forEach.call (document.querySelectorAll (selector), op);
}) (document.currentScript);

/*

Hakozushi.js
<https://github.com/wakaba/js-hakozushi/>

USAGE:

Declarative:
<script src=hakozushi.js async data-selector="h1, .summary"></script>

Imperative:
<script src=hakozushi.js></script>
<script>
  Hakozushi.run (document.querySelector ("h1"));
</script>

LICENSE:

The MIT License

Copyright 2017 Wakaba <wakaba@suikawiki.org>.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
