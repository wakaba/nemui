export const PQ = {env: {}};

// PQ.env.createCanvas
// PQ.env.createImg
// PQ.env.parseHTML

  PQ.BoundingBox = function () {
    this.minX = this.minY = +Infinity;
    this.maxX = this.maxY = -Infinity;
    this.width = this.height = 0;
    this.centerPoint = [NaN, NaN];
  };

  PQ.BoundingBox.prototype.addPoints = function (pts) {
    pts.forEach (pt => {
      if (pt[0] < this.minX) this.minX = pt[0];
      if (pt[1] < this.minY) this.minY = pt[1];
      if (this.maxX < pt[0]) this.maxX = pt[0];
      if (this.maxY < pt[1]) this.maxY = pt[1];
    });
    this.width = this.maxX - this.minX + 1;
    this.height = this.maxY - this.minY + 1;
    this.centerPoint = [Math.floor (this.minX + this.width/2),
                        Math.floor (this.minY + this.height/2)];
  }; // addPoints

  PQ.BoundingBox.prototype.addBoundingBox = function (bb) {
    if (bb.width && bb.height) this.addPoints ([
      [bb.minX, bb.minY],
      [bb.maxX, bb.maxY],
    ]);
  }; // addBoundingBox

  PQ.Path = function () { };

  PQ.Path.fromPoints = function (pts) {
    let p = new PQ.Path ();
    p._pts = pts;
    return p;
  }; // PQ.Path.fromPoints

  PQ.Path.prototype.toPath2D = function (opts = {}) {
    let p = new Path2D ('M' + this._pts.join (' '));

    if (opts.matrix) {
      let q = new Path2D;
      q.addPath (p, opts.matrix);
      p = q;
    }

    return p;
  }; // toPath2D


  PQ.RegionBoundary = function () {};

  PQ.RegionBoundary.fromArray = function (array) {
    let rb = new PQ.RegionBoundary;
    rb.array = array;
    rb.boundingBox = PQ.RegionBoundary._getBoundingBox (array);
    return rb;
  }; // PQ.RegionBoundary.fromArray

  PQ.RegionBoundary._getBoundingBox = rb => {
    let xx = [];
    let yy = [];
    let bb = new PQ.BoundingBox;
    rb.forEach (paths => bb.addPoints (paths[0]));
    return bb;
  }; // PQ.RegionBoundary._getBoundingBox

  PQ.RegionBoundary.prototype.getRegionKey = async function () {
    let json = JSON.stringify (this.array);
    if (json === "[]") return null;
    let data = (new TextEncoder).encode (json);
    let buffer = await crypto.subtle.digest ("SHA-256", data);
    return Array.from (new Uint8Array (buffer)).slice (0, 5).map (b => b.toString (16).padStart (2, '0')).join ('');
  }; // getRegionKey


PQ.Image = function () {
  //
};

PQ.Image.fromImg = function (img, {orientation = 1}) {
  let self = new PQ.Image;
  self.orientation = orientation;
  self._img = img;
  self.physicalWidth = img.naturalWidth;
  self.physicalHeight = img.naturalHeight;
  return self;
}; // PQ.Image.fromImg

PQ.Image.fromImageData = function (imageData, {orientation = 1}) {
  let self = new PQ.Image;
  self.orientation = orientation;
  self._imageData = imageData;
  self.physicalWidth = imageData.width;
  self.physicalHeight = imageData.height;
  return self;
}; // PQ.Image.fromImageData

Object.defineProperty (PQ.Image.prototype, 'width', {
  get: function () { return this.orientation >= 5 ? this.physicalHeight : this.physicalWidth },
});
Object.defineProperty (PQ.Image.prototype, 'height', {
  get: function () { return this.orientation >= 5 ? this.physicalWidth : this.physicalHeight },
});

PQ.Image.prototype._getForBox = function (bb) {
  const { minX, minY, width: w, height: h } = bb;
  const W = this.physicalWidth;
  const H = this.physicalHeight;
    switch (this.orientation) {
      case 2: return { minX: W - minX - w, minY, width: w, height: h };
      case 3: return { minX: W - minX - w, minY: H - minY - h, width: w, height: h };
      case 4: return { minX, minY: H - minY - h, width: w, height: h };
      case 5: return { minX: minY, minY: minX, width: h, height: w };
      case 6: return { minX: minY, minY: H - (minX + w), width: h, height: w };
      case 7: return { minX: W - (minY + h), minY: H - (minX + w), width: h, height: w };
      case 8: return { minX: W - (minY + h), minY: minX, width: h, height: w };
     default: return { minX, minY, width: w, height: h };
    }
  }; // _getForBox
    
PQ.Image.prototype.drawFragment = async function (ctx, width, height, inBox) {
  const srcBox = this._getForBox (inBox);
    
    ctx.save ();

    switch (this.orientation) {
    case 2:
      ctx.translate (width, 0);
      ctx.scale (-1, 1);
      break;
    case 3:
      ctx.translate (width, height);
      ctx.rotate (Math.PI);
      break;
    case 4:
      ctx.translate (0, height);
      ctx.scale (1, -1);
      break;
    case 5:
      ctx.rotate (-Math.PI / 2);
      ctx.scale (-1, 1);
      break;
    case 6:
      ctx.translate (width, 0);
      ctx.rotate (Math.PI / 2);
      break;
    case 7:
      ctx.translate (width, height);
      ctx.rotate (Math.PI / 2);
      ctx.scale (-1, 1);
      break;
    case 8:
      ctx.translate (0, height);
      ctx.rotate (-Math.PI / 2);
      break;
  }

  let img = this._img;
  if (!img && this._imageData) {
    if (globalThis.createImageBitmap) {
      img = this._img = await createImageBitmap (this._imageData);
    } else {
      img = this._img = PQ.env.createCanvas (this._imageData.width, this._imageData.height);
      let x = img.getContext ('2d');
      x.putImageData (this._imageData, 0, 0);
    }
  }
  if (this.orientation >= 5) {
    ctx.drawImage (
      img,
      srcBox.minX, srcBox.minY, srcBox.width, srcBox.height,
      0, 0, height, width,
    );
  } else {
    ctx.drawImage (
      img,
      srcBox.minX, srcBox.minY, srcBox.width, srcBox.height,
      0, 0, width, height,
    );
  }
  
  ctx.restore ();
}; // PQ.Image.prototype.drawFragment


PQ.Image.prototype.getClippedCanvasByRegionBoundary = function (rb) {
  let bb = rb.boundingBox;

  let destCanvas = PQ.env.createCanvas (bb.width, bb.height);
  let destCtx = destCanvas.getContext ('2d');

  rb.array.forEach (paths => {
    let canvas = PQ.env.createCanvas (bb.width, bb.height);
    let ctx = canvas.getContext ('2d');

    ctx.fillStyle = "black";
    paths.forEach (path => {
      ctx.beginPath ();
      ctx.moveTo (path[0][0] - bb.minX, path[0][1] - bb.minY);
      path.forEach (([x, y], j) => ctx.lineTo (x - bb.minX, y - bb.minY));
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
    });

    ctx.globalCompositeOperation = "source-in";
    this.drawFragment (ctx, bb.width, bb.height, bb);
    
    destCtx.drawImage (canvas, 0, 0);
  });

  return destCtx;
}; // PQ.Image.prototype.getClippedCanvasByRegionBoundary
