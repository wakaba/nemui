import { PQ } from './pq.js';

  /* ------ Images ------ */

  export class ImageDataSource {
    constructor (config) {
      this.config = config;
    } // constructor

    checkInternalURL (urlString) {
      let m = urlString.match (/^https?:\/\/([^\/:?#]+)(?::[0-9]+|)\//);
      if (!m) throw new Error ("Bad URL: <"+urlString+">");

      let n = m[1].match (/^[^\/:?#]+\.([^.\/:?#]+)$/);
      if (!n) throw new Error ("Bad domain: |"+urlString+"|");

      if ({
        internal: true,
        local: true,
      }[n[1]]) throw new Error ("Bad domain: |"+urlString+"|");
    } // isInternalURL

    parseImageInput (input) {
      let imageSource = {
        // key : string
        // pageURL : absolute URL?
        // imageURL : absolute URL?
        // imageWidth : positive integer?
        // imageHeight : positive integer?
        orientation: 1,
        // pageNumber : positive integer?
      };
      let imageAccess = {
        // useOGImage : boolean
        // imageURL : absolute URL?
        // imageType : "djvu"?
        // iiifURL : absolute URL?
        // needTypeCheck : boolean
        // needImageDimension : boolean
        // pageNumber : positive integer?
        // isInternal : boolean
      };
      let imageRegion = {
        // regionKey: string?
        regionBoundary: input.regionBoundary, // or undefined
      };

      if (input.image_source) {
        // XXX backcompat
        input.image_source.orientation ??= 1;
        input.image_source.transformKey ??= 'o' + input.image_source.orientation;
        
        
        input.text = ':ep-x' + input.image_source.transformKey + '-' + input.image_source.key;
        imageRegion.regionKey = input.image_region?.region_key;
        imageRegion.regionBoundary ??= input.image_region?.region_boundary;
        ['imageURL', 'imageWidth', 'imageHeight'].forEach (_ => {
          if (input.image_source[_]) imageSource[_] = input.image_source[_];
        });
      }

      let inputURL = {};
      if (/^\s*https?:/i.test (input.text)) {
        try {
          inputURL = new URL (input.text);
          input.text = "";
        } catch (e) {
          return null;
        }
      }

      while (true) {
        let inputEP = null;
        let inputEPType = null;
        {
          let m = input.text.match (/^\s*:ep-(?:x([0-9a-z_]+)-|)([a-wyz][a-z0-9]+)-/);
          if (m) {
            inputEP = input.text.replace (/^\s*:ep-(?:x[0-9a-z_]+-|)[A-wyz][a-z0-9]+-/, '');

            if (m[1]) {
              let n = m[1].match (/^o([1-8])$/);
              if (n) imageSource.orientation = parseInt (n[1]);
            }
          
            inputEPType = m[2];
            inputEP = inputEP.replace (/\s+$/, '');
          }
        }

        if (inputEPType === 'ndl') {
          let m = inputEP.match (/^([0-9]+)-([0-9]+)(?:-([0-9a-z]+)|)$/);
          if (m) {
            let x = m[1];
            let y = m[2];
            let yy = ("0000000" + y).substr (-7);
            imageSource.key = `ndl-${x}-${y}`;
            imageSource.imageURL = `https://dl.ndl.go.jp/api/iiif/${x}/R${yy}/full/full/0/default.jpg`;
            imageSource.pageURL = "https://dl.ndl.go.jp/pid/"+x+"/1/"+y;
            imageRegion.regionKey ??= m[3]; // or undefined
          }
          break;
        } else if (inputURL.hostname === 'dl.ndl.go.jp') {
          let p = inputURL.pathname.split (/\//g);
          if (p[1] === 'pid') {
            // https://dl.ndl.go.jp/pid/"+n[1]+"/1/"+n[2]
            let x = p[2];
            let y = p[4] || 1;
            let yy = ("0000000" + y).substr (-7);
            imageSource.key = `ndl-${x}-${y}`;
            imageSource.imageURL = `https://dl.ndl.go.jp/api/iiif/${x}/R${yy}/full/full/0/default.jpg`;
            imageSource.pageURL = "https://dl.ndl.go.jp/pid/"+x+"/1/"+y;
          } else if (p[1] === 'info:ndljp') {
            // https://dl.ndl.go.jp/info:ndljp/pid/2566606/2
            let x = p[3];
            let y = p[4] || 1;
            let yy = ("0000000" + y).substr (-7);
            imageSource.key = `ndl-${x}-${y}`;
            imageSource.imageURL = `https://dl.ndl.go.jp/api/iiif/${x}/R${yy}/full/full/0/default.jpg`;
            imageSource.pageURL = "https://dl.ndl.go.jp/pid/"+x+"/1/"+y;
          }
          break;
        }
        
        if (inputEPType === 'nao') {
          let m = inputEP.match (/^([a-z0-9]+)-([0-9]+)-([0-9]+)-([0-9]+)(?:-([0-9a-z]+)|)$/);
          if (m) {
            imageSource.key = `nao-${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
            imageSource.imageURL = `https://library.nao.ac.jp/kichou/archive/${m[1]}/${m[2]}/${m[3]}/images/${m[4]}.jpg`;
            imageSource.pageURL = `https://library.nao.ac.jp/kichou/archive/${m[1]}/${m[2]}/${m[3]}/kmview.html`;
            imageRegion.regionKey ??= m[5]; // or undefined
          }
          break;
        } else if (inputURL.hostname === 'library.nao.ac.jp') {
          let m = inputURL.pathname.match (/^\/kichou\/archive\/([a-z0-9]+)\/([0-9]+)\/([0-9]+)/);
          if (m) {
            let p = '00001';
            imageSource.key = `nao-${m[1]}-${m[2]}-${m[3]}-${p}`;
            imageSource.imageURL = `https://library.nao.ac.jp/kichou/archive/${m[1]}/${m[2]}/${m[3]}/images/${p}.jpg`;
            imageSource.pageURL = `https://library.nao.ac.jp/kichou/archive/${m[1]}/${m[2]}/${m[3]}/kmview.html`;
          } else {
            // `https://library.nao.ac.jp/kichou/archive/${n[1]}/${n[2]}/${n[3]}/images/${n[4]}.jpg`;
            let m = inputURL.pathname.match (/^\/kichou\/archive\/([a-z0-9]+)\/([0-9]+)\/([0-9]+)\/images\/([0-9]+)\.jpg/);
            if (m) {
              imageSource.key = `nao-${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
              imageSource.imageURL = `https://library.nao.ac.jp/kichou/archive/${m[1]}/${m[2]}/${m[3]}/images/${m[4]}.jpg`;
              imageSource.pageURL = `https://library.nao.ac.jp/kichou/archive/${m[1]}/${m[2]}/${m[3]}/kmview.html`;
            }
          }
          break;
        } // nao

        if (inputEPType === 'kokusho') {
          let m = inputEP.match (/^([0-9]+)-([0-9]+)(?:-([0-9a-z]+)|)$/);
          if (m) {
            imageAccess.pageNumber = parseInt (m[2]);
            imageSource.key = `kokusho-${m[1]}-${imageAccess.pageNumber}`;
            imageSource.pageURL = `https://kokusho.nijl.ac.jp/biblio/${m[1]}/${imageAccess.pageNumber}`;
            imageSource.iiifURL = `https://kokusho.nijl.ac.jp/biblio/${m[1]}/manifest`;
            imageRegion.regionKey ??= m[3]; // or undefined
          }
          break;
        } else if (inputURL.hostname === 'kokusho.nijl.ac.jp') {
          // https://kokusho.nijl.ac.jp/biblio/100232904/5?ln=ja
          // https://kokusho.nijl.ac.jp/biblio/100232904/manifest
          let m = inputURL.pathname.match (/\/biblio\/([0-9]+)(?:\/([0-9]+)|)/);
          if (m) {
            imageAccess.pageNumber = parseInt (m[2] || 1);
            imageSource.key = `kokusho-${m[1]}-${imageAccess.pageNumber}`;
            imageSource.pageURL = `https://kokusho.nijl.ac.jp/biblio/${m[1]}/${imageAccess.pageNumber}`;
            imageSource.iiifURL = `https://kokusho.nijl.ac.jp/biblio/${m[1]}/manifest`;
          }
          break;
        }

        if (inputEPType === 'kulib') {
          let m = inputEP.match (/^([0-9a-z]+)-([0-9]+)(?:-([0-9a-z]+)|)$/);
          if (m) {
            imageAccess.pageNumber = parseInt (m[2]);
            imageSource.key = `kulib-${m[1]}-${imageAccess.pageNumber}`;
            imageSource.pageURL = `https://rmda.kulib.kyoto-u.ac.jp/item/${m[1]}?page=${imageAccess.pageNumber}`;
            imageSource.iiifURL = `https://rmda.kulib.kyoto-u.ac.jp/iiif/metadata_manifest/${m[1].toUpperCase ()}/manifest.json`;
            imageRegion.regionKey ??= m[3]; // or undefined
          }
          break;
          // https://rmda.kulib.kyoto-u.ac.jp/iiif/metadata_manifest/RB00013293/manifest.json
        } else if (inputURL.hostname === 'rmda.kulib.kyoto-u.ac.jp') {
          // https://rmda.kulib.kyoto-u.ac.jp/item/rb00013293?page=21
          let m = inputURL.pathname.match (/\/item\/([0-9a-z]+)/);
          if (m) {
            imageAccess.pageNumber = parseInt (inputURL.searchParams.get ('page') ?? 1);
            imageSource.key = `kulib-${m[1]}-${imageAccess.pageNumber}`;
            imageSource.pageURL = `https://rmda.kulib.kyoto-u.ac.jp/item/${m[1]}?page=${imageAccess.pageNumber}`;
            imageSource.iiifURL = `https://rmda.kulib.kyoto-u.ac.jp/iiif/metadata_manifest/${m[1].toUpperCase ()}/manifest.json`;
          }
          break;
        }
        
        if (inputEPType === 'iwtkhk') {
          let m = inputEP.match (/^([0-9]+)(?:-([0-9a-z]+)|)$/);
          if (m) {
            imageSource.key = `iwtkhk-${m[1]}`;
            imageSource.pageURL = `https://jmapps.ne.jp/iwtkhk/det.html?data_id=${m[1]}`;
            imageAccess.useOGImage = true;
            imageRegion.regionKey ??= m[2]; // or undefined
          }
          break;
        } else if (inputURL.hostname === 'jmapps.ne.jp') {
          // input = 'https://jmapps.ne.jp/iwtkhk/det.html?data_id=' + m[2];
          let m = inputURL.pathname.match (/\/iwtkhk\/det\.html\?data_id=([0-9]+)/);
          if (m) {
            imageSource.key = `iwtkhk-${m[1]}`;
            imageSource.pageURL = `https://jmapps.ne.jp/iwtkhk/det.html?data_id=${m[1]}`;
            imageAccess.useOGImage = true;
          }
          break;
        }

        if (inputEPType === 'hanyodenshi') {
          let m = inputEP.match (/^([0-9]+)(?:-([0-9a-z]+)|)$/);
          if (m) {
            imageSource.pageNumber = parseInt (m[1] || 1);
            imageSource.key = `hanyodenshi-${imageSource.pageNumber}`;
            imageSource.pageURL = imageAccess.imageURL = "http://kanji.zinbun.kyoto-u.ac.jp/~yasuoka/hanyodenshi/"+imageSource.pageNumber+".djvu";
            imageAccess.imageType = 'djvu';
            imageRegion.regionKey ??= m[2]; // or undefined
            imageAccess.pageNumber = 1;
          }
          break;
        } else if (inputURL.hostname === 'kanji.zinbun.kyoto-u.ac.jp') {
          let m = inputURL.pathname.match (/\/~yasuoka\/hanyodenshi\/([0-9]+)\.djvu/);
          if (m) {
            imageSource.pageNumber = parseInt (m[1]);
            imageSource.key = 'hanyodenshi-' + imageSource.pageNumber;
            imageSource.pageURL = imageAccess.imageURL = "http://kanji.zinbun.kyoto-u.ac.jp/~yasuoka/hanyodenshi/"+imageSource.pageNumber+".djvu";
            imageAccess.imageType = 'djvu';
            imageAccess.pageNumber = 1;
          }
          break;
        }

        if (inputEPType === 'books') {
          let m = inputEP.match (/^([A-Za-z0-9_]+)(?:-([a-z0-9]+)|)$/);
          if (m) {
            let d = m[1].replace (/_([0-9A-F]{2})/g, (x, _) => String.fromCodePoint (parseInt (_, 16)));
            imageAccess.imageURL = this.config.internal_url_prefix + 'books/' + d;
            imageAccess.isInternal = true;
            let e = d.replace (/_/g, '_5F').replace (/\./g, '_2E').replace (/\//g, '_2F').replace (/^x/, '_78');
            imageSource.key = 'books-' + e;
            imageRegion.regionKey ??= m[2]; // or undefined
          }
          break;
        } else if (inputURL.href?.startsWith (this.config.internal_url_prefix)) {
          let m = inputURL.pathname.match (/^\/books\/([a-zA-Z0-9_.\/-]+)$/);
          if (m) {
            let e = m[1].replace (/_/g, '_5F').replace (/\./g, '_2E').replace (/\//g, '_2F').replace (/^x/, '_78');
            imageSource.key = 'books-' + e;
            imageAccess.imageURL = this.config.internal_url_prefix + inputURL.pathname.replace (/^\//, '');
            imageAccess.isInternal = true;
          }
          break;
        }

        if (inputEPType === 'image') {
          let m = inputEP.match (/^([A-Za-z0-9_]+)(?:-([a-z0-9]+)|)$/);
          if (m) {
            imageSource.pageURL = imageSource.imageURL = m[1].replace (/_([0-9A-F]{2})/g, (_, x) => String.fromCodePoint (parseInt (x, 16)));
            imageSource.key = 'image-' + imageSource.imageURL.replace (/([^A-Za-wyz0-9])/g, (_, c) => '_' + c.codePointAt (0).toString (16).toUpperCase ());
            imageRegion.regionKey ??= m[2]; // or undefined
          }
          break;
        } else if (inputEPType === 'pdf') {
          let m = inputEP.match (/^([A-Za-z0-9_]+)-([0-9]+)(?:-([a-z0-9]+)|)$/);
          if (m) {
            imageSource.pageURL = m[1].replace (/_([0-9A-F]{2})/g, (_, x) => String.fromCodePoint (parseInt (x, 16)));
            imageSource.pageNumber = parseInt (m[2]);
            imageSource.key = 'pdf-' + imageSource.pageURL.replace (/([^A-Za-wyz0-9])/g, (_, c) => '_' + c.codePointAt (0).toString (16).toUpperCase ()) + '-' + imageSource.pageNumber;
            imageAccess.imageURL = this.config.pdf_proxy_url_prefix + encodeURIComponent (imageSource.pageURL) + '/'+encodeURIComponent (imageSource.pageNumber)+'/image.png';
            imageAccess.isInternal = true;
            imageRegion.regionKey ??= m[3]; // or undefined
            if (!imageSource.imageWidth) {
              imageAccess.needImageDimension = true;
            }
          }
          break;
        } else if (inputEPType === 'djvu') {
          let m = inputEP.match (/^([A-Za-z0-9_]+)-([0-9]+)(?:-([a-z0-9]+)|)$/);
          if (m) {
            imageSource.pageURL = m[1].replace (/_([0-9A-F]{2})/g, (_, x) => String.fromCodePoint (parseInt (x, 16)));
            imageAccess.pageNumber = imageSource.pageNumber = parseInt (m[2]);
            imageSource.key = 'djvu-' + imageSource.pageURL.replace (/([^A-Za-wyz0-9])/g, (_, c) => '_' + c.codePointAt (0).toString (16).toUpperCase ()) + '-' + imageSource.pageNumber;
            imageAccess.imageURL = imageSource.pageURL;
            imageAccess.imageType = 'djvu';
            imageRegion.regionKey ??= m[3]; // or undefined
          }
          break;
        } else if (inputURL.href && (inputURL.protocol === "https:" ||
                                     inputURL.protocol === "http:")) {
          let m = inputURL.hash.match (/^#page=([0-9]+)\b/);
          if (m) imageAccess.pageNumber = parseInt (m[1]);
          imageSource.pageURL = inputURL.href.replace (/#.*$/, '');
          imageSource.key = 'unknown-' + inputURL.href.replace (/([^A-Za-wyz0-9])/g, (_, c) => '_' + c.codePointAt (0).toString (16).toUpperCase ());
          imageAccess.needTypeCheck = true;
          break;
        }

        break;
      } // true

      if (!imageSource.key) return null;
      ['pageURL', 'imageURL', 'iiifURL'].forEach (key => {
        if (imageSource[key]) this.checkInternalURL (imageSource[key]);
      });
      if (!imageAccess.isInternal) {
        ['pageURL', 'imageURL', 'iiifURL'].forEach (key => {
          if (imageAccess[key]) this.checkInternalURL (imageAccess[key]);
        });
      }

      imageSource.transformKey = 'o' + imageSource.orientation;
      return {
        imageSource, imageAccess, imageRegion,
      };
    } // parseImageInput

    async getImageByImageAccess ({imageSource, imageAccess}, opts = {}) {
      if (imageAccess.useOGImage &&
          !(imageAccess.imageURL || imageSource.imageURL)) {
        let fURL = this.config.image_proxy_url_prefix + imageSource.pageURL;
        await fetch (fURL, {mode: 'cors'}).then (res => {
          if (res.status !== 200) throw res;
          return res.text ();
        }).then (text => {
          let doc = PQ.env.parseHTML (text);
          let meta = doc.querySelector ('meta[property="og:image"]')
          if (meta && meta.content) {
            imageSource.imageURL = new URL (meta.content, imageSource.pageURL).href; // or throw
            this.checkInternalURL (imageSource.imageURL);
          } else {
            throw new Error ("There is no |og:image| in " + imageSource.pageURL);
          }
        });
      } // useOGImage

      if ((imageAccess.iiifURL || imageSource.iiifURL) &&
          !(imageAccess.imageURL || imageSource.imageURL)) {
        let fURL = this.config.image_proxy_url_prefix + (imageAccess.iiifURL || imageSource.iiifURL);
        let json = await fetch (fURL, {mode: 'cors'}).then (res => {
          if (res.status !== 200) throw res;
          return res.json ();
        });

        function getBestImage (items) {
          if (!items?.length) return null;
          let bestImage = items[0];
          let maxPixels = 0;
          items.forEach (image => {
            const res = image.resource || image.body;
            if (res && res.width && res.height) {
              const pixels = res.width * res.height;
              if (pixels > maxPixels) {
                maxPixels = pixels;
                bestImage = image;
              }
            }
          });
          return bestImage;
        } // getBestImage
        if (json.sequences) {
          let canvas = json.sequences[0].canvases[imageAccess.pageNumber-1];
          if (!canvas) throw new Error ("Bad page number |"+imageAccess.pageNumber+"|");

          // .images , .rendering
          let image = getBestImage (canvas.images);
          imageSource.imageURL = image?.resource['@id'];
          if (imageSource.imageURL) this.checkInternalURL (imageSource.imageURL);
        } else if (json.items) {
          let item = json.items[imageAccess.pageNumber-1];
          if (!item) throw new Error ("Bad page number |"+imageAccess.pageNumber+"|");

          let image = getBestImage (item.items[0].items);
          imageSource.imageURL = image?.body.id;
          if (imageSource.imageURL) this.checkInternalURL (imageSource.imageURL);
        }
      } // iiifURL

      if (imageAccess.needTypeCheck &&
          !(imageAccess.imageURL || imageSource.imageURL)) {
        let fURL = this.config.image_proxy_url_prefix + imageSource.pageURL;
        await fetch (fURL, {mode: 'cors'}).then (res => {
          if (res.status !== 200) throw res;
          if (res.headers.get ('content-type')?.match (/^(?:image\/vnd\.djvu|image\/x.djvu|image\/x-djvu|image\/djvu)\b/)) {
            imageAccess.pageNumber = imageSource.pageNumber ??= imageAccess.pageNumber ?? 1;
            imageAccess.imageURL = imageSource.pageURL;
            imageSource.key = imageSource.key.replace (/^unknown-/, 'djvu-') + '-' + imageSource.pageNumber;
            imageAccess.imageType = 'djvu';
          } else if (res.headers.get ('content-type')?.match (/^image\//)) {
            imageSource.imageURL = imageSource.pageURL;
            imageSource.key = imageSource.key.replace (/^unknown-/, 'image-');
          } else if (res.headers.get ('content-type')?.match (/^application\/pdf\b/)) {
            imageSource.pageNumber ??= imageAccess.pageNumber ?? 1;
            imageAccess.imageURL = this.config.pdf_proxy_url_prefix + encodeURIComponent (imageSource.pageURL) + '/'+encodeURIComponent (imageSource.pageNumber)+'/image.png';
            imageSource.key = imageSource.key.replace (/^unknown-/, 'pdf-') + '-' + imageSource.pageNumber;
            imageAccess.needImageDimension = true;
            imageAccess.isInternal = true;
          } else {
            throw new Error ("The specified URL <"+imageSource.pageURL+"> is not an image");
          }
        });
      } // needTypeCheck

      let fURL = (imageAccess.imageURL || imageSource.imageURL) + '';
      if (!imageAccess.isInternal) {
        fURL = this.config.image_proxy_url_prefix + fURL;
      }

      let getImg;
      if (opts.useCache) {
        this._cache ??= new Map;
        this._cache.x ??= Math.random ();
        getImg = this._cache.get (fURL); // or undefined
      }
      if (imageAccess.imageType === 'djvu') {
        if (!getImg) {
          getImg = PQ.env.createImageDataByDjvuURL (fURL, imageAccess.pageNumber);
          getImg.method = 'fromImageData';
        }
      } else {
        if (!getImg) {
          getImg = PQ.env.createImg (fURL);
          getImg.method = 'fromImg';
        }
      }
      if (opts.useCache) {
        this._cache.set (fURL, getImg);
      }

      let img = await getImg;
      let image = PQ.Image[getImg.method] (img, {
        orientation: imageSource.orientation,
      });
      if (imageAccess.needImageDimension) {
        imageSource.imageWidth = image.physicalWidth;
        imageSource.imageHeight = image.physicalHeight;
      }

      return image;
    } // getImageByImageAccess

    async getClippedImageCanvas ({imageSource, imageAccess, imageRegion}, opts = {}) {
      let image = await this.getImageByImageAccess ({imageSource, imageAccess, imageRegion}, opts); // or throw
      let rb = PQ.RegionBoundary.fromArray (imageRegion.regionBoundary);

      let ctx = image.getClippedCanvasByRegionBoundary (rb); 
      return ctx.canvas;
    } // getClippedImageCanvas

    async getClippedImageData ({imageSource, imageAccess, imageRegion}, opts = {}) {
      let image = await this.getImageByImageAccess ({imageSource, imageAccess, imageRegion}, opts); // or throw
      let rb = PQ.RegionBoundary.fromArray (imageRegion.regionBoundary);

      let ctx = image.getClippedCanvasByRegionBoundary (rb); 
      return ctx.getImageData (0, 0, ctx.canvas.width, ctx.canvas.height);
    } // getClippedImageData

    getClippedImageProxyURL ({imageSource, imageAccess, imageRegion}) {
      let key = ':ep-x' + imageSource.transformKey + '-' + imageSource.key + '-' + imageRegion.regionKey;
      let u = this.config.clipped_image_proxy_url_prefix + 'imx/' + encodeURIComponent (key) + '/image';

      return u;
    } // getClippedImageProxyURL

  } // ImageDataSource

  /* ------ Annotations ------ */

export class ClassicAnnotationStorage {
  constructor (config) {
    this.config = config;
  }

  async getAnnotationData ({imageSource}) {
    if (this.config.sw_storage_url_prefix) {
      let pageName = 'SWIR//' + imageSource.key + '//' + imageSource.transformKey;
      let json = await fetch (this.config.sw_storage_url_prefix + encodeURIComponent (pageName) + '?format=text', {
        cache: 'reload',
      }).then (res => {
        if (res.status === 404) return null;
        if (res.status !== 200) throw res;
        return res.json ();
      });
      if (json !== null) return json;
    }

    if (this.config.load_annotation_url_prefix) {
      let u = this.config.load_annotation_url_prefix + 'annotation-' + imageSource.key + '--' + imageSource.transformKey + '.json';
      let json = await fetch (u, {cache: 'reload'}).then (res => {
        if (res.status === 200) {
          return res.json ();
        } else if (res.status === 404) {
          return null;
        } else {
          throw res;
        }
      });
      if (json !== null) return json;
    }

    return {};
  } // getAnnotationData

  async putAnnotationData (obj) {
    let saved = 0;
    let pp = [];

    function objectToJSON (value, indent = 2) {
      const space = " ".repeat (indent);
      function format (val, depth) {
        if (val === null) return "null";

        if (typeof val !== "object") {
          return JSON.stringify (val);
        }

        if (Array.isArray (val)) {
          return `[${val.map(v => format(v, 0)).join(",")}]`;
        }

        const keys = Object.keys (val).sort ();
        if (keys.length === 0) return "{}";

        const inner = keys.map (key =>
          space.repeat(depth + 1) +
            JSON.stringify (key) +
            ":" +
            format (val[key], depth + 1)
        ).join (",\n");
        return `{\n${inner}\n${space.repeat(depth)}}`;
      } // format
      return format (value, 0);
    } // objectToJSON
    let json = objectToJSON (obj);

    if (this.config.sw_storage_url_prefix) {
      let fd = new FormData;
      fd.append ('content-type', 'application/swir+json');
      fd.append ('text', json);
      let pageName = 'SWIR//' + obj.image.key + '//' + obj.image.transformKey;
      pp.push (fetch (this.config.sw_storage_url_prefix + encodeURIComponent (pageName) + ';putdata', {
        method: 'POST', body: fd, credentials: 'include',
      }).then (res => {
        if (res.status !== 200) throw res;
      }));
      saved++;
    }

    if (this.config.save_url_prefix) {
      let fd = new FormData;
      fd.append ('json', json);
      pp.push (fetch (this.config.save_url_prefix + 'annotation', {
        method: 'POST', body: fd,
      }).then (res => {
        if (res.status !== 200) throw res;
        return res.json ();
      }));
      saved++;
    }

    if (!saved) throw new Error ("Failed to save");
    return Promise.all (pp);
  } // putAnnotationData
} // ClassicAnnotationStorage
