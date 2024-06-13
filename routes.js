
  function distance2 (a, b) {
    return Math.pow (a.lat-b.lat, 2) + Math.pow (a.lon-b.lon, 2);
  } // distance2

  function findNears (points, distances, refI, startI, endI, threshold) {
    let segments = [];
    let state = 0;
    let minD;
    for (let i = startI; i <= endI; i++) {
      let d = refI >= i ? distances[refI][i] : distances[i][refI];
      if (state === 2) {
        if (d < threshold) {
          segments.unshift ([i, i, i]);
          minD = d;
          state = 1;
        } else {
          //
        }
      } else if (state === 1) {
        if (d < threshold) {
          segments[0][2] = i;
          if (d < minD) {
            minD = d;
            minDi = segments[0][1] = i;
          }
        } else {
          state = 2;
        }
      } else if (state === 0) {
        if (d < threshold) {
          segments.unshift ([i, i, i]);
          minD = d;
          state = 1;
        } else {
          state = 2;
        }
      }
    }

    return segments.reverse ();
  } // findNears

  function getNearest (points, p) {
    let minD = Infinity;
    let minDi = -1;
    for (let i = 0; i < points.length; i++) {
      let d = distance2 (p, points[i]);
      if (d < minD) {
        minD = d;
        minDi = i;
      }
    }
    return {distance2: minD, index: minDi, point: points[minDi]};
  } // getNearest

  function recompute (pointsList, radius) {
    let start = performance.now ();

    /*
    let threshold = Infinity;
    {
      let points = pointsList[0];
      if (points.length === 0) points = pointsList[1];
      //let minD = Infinity;
      let dd = [];
      for (let i = 1; i < points.length; i++) {
        let d = distance2 (points[i-1], points[i]);
        //if (d < minD) {
        //  minD = d;
        //}
        dd.push (d);
      }
      //threshold = minD / 2;
      let median = dd.sort ((a, b) => a-b)[Math.floor (dd.length / 2)];
      threshold = median / 2;
    }
    */
    let threshold = 0.000001;
    if (pointsList[0].length) {
      let distancePerLat = distanceH84 (pointsList[0][0],
                                        {lat: pointsList[0][0].lat + 1,
                                         lon: pointsList[0][0].lon});
      let distancePerLon = distanceH84 (pointsList[0][0],
                                        {lat: pointsList[0][0].lat,
                                         lon: pointsList[0][0].lon + 1});
      threshold = radius / distancePerLat;
      threshold = threshold * threshold;
    }
    let thresholdC = threshold * 3*3;
    let thresholdCP = thresholdC;
    
    let augPoints = [];
    let confluentialPoints = [];
    if (pointsList[0].length) {
      pointsList[0][0].origIndex = 0;
      pointsList[0][0].index = 0;
      augPoints.push (pointsList[0][0]);
      if (pointsList[0][0].confluential) {
        confluentialPoints.push (0);
      }
    }
    for (let i = 1; i < pointsList[0].length; i++) {
      let d = distance2 (pointsList[0][i-1], pointsList[0][i]);
      if (d > threshold) {
        let n = Math.floor (Math.pow (d, 0.5) / Math.pow (threshold, 0.5)) + 1;
        for (let j = 1; j < n; j++) {
          let p = {lat: (pointsList[0][i].lat*j+(pointsList[0][i-1].lat*(n-j)))/n,
                   lon: (pointsList[0][i].lon*j+(pointsList[0][i-1].lon*(n-j)))/n,
                   additional: true};
          p.index = augPoints.length;
          augPoints.push (p);
        }
      }
      pointsList[0][i].origIndex = i;
      pointsList[0][i].index = augPoints.length;
      augPoints.push (pointsList[0][i]);
      if (pointsList[0][i].confluential) {
        confluentialPoints.push (augPoints.length-1);
      }
    }

    if (augPoints.length && !confluentialPoints.length) {
      confluentialPoints.push (0);
      if (augPoints.length > 1) {
        confluentialPoints.push (augPoints.length-1);
      }
    }

    let distances = [];
    for (let i = 0; i < augPoints.length; i++) {
      distances[i] = [];
      distances[i][i] = 0;
      for (let j = 0; j < i; j++) {
        distances[i][j] = /*distances[j][i] =*/ distance2 (augPoints[i], augPoints[j]);
      }
    }

    let useThC = [];
    confluentialPoints.forEach (i => {
      useThC[i] = true;
      for (let k = 0; k < i; k++) {
        if (distances[i][k] < thresholdCP) {
          useThC[k] = true;
        }
      }
      for (let k = i + 1; k < augPoints.length; k++) {
        if (distances[k][i] < thresholdCP) {
          useThC[k] = true;
        }
      }
    });                     

    let dataPoints = [];
    let maxBaseIndex = Infinity;
    {
      let forced = pointsList[2].slice ().sort ((a, b) => a.timestamp - b.timestamp);
      let o = 0;
      let prevFP;
      for (let p of pointsList[1]) {
        while (forced.length && forced[0].timestamp < p.timestamp) {
          let fp = forced.shift ();
          let bp = pointsList[0][fp.baseOrigIndex];
          fp.index = dataPoints.length;
          if (bp) fp.baseIndex = bp.index;
          dataPoints.push (fp);
          if (prevFP) {
            prevFP.maxBaseIndex = bp ? fp.baseIndex : Infinity;
          } else {
            maxBaseIndex = bp ? fp.baseIndex : Infinity;
          }
          prevFP = fp;
        }
        p.index = dataPoints.length;
        p.origIndex = o++;
        dataPoints.push (p);
      }
      while (forced.length) {
        let fp = forced.shift ();
        let bp = pointsList[0][fp.baseOrigIndex];
        fp.index = dataPoints.length;
        if (bp) fp.baseIndex = bp.index;
        dataPoints.push (fp);
        if (prevFP) prevFP.maxBaseIndex = bp ? fp.baseIndex : Infinity;
        prevFP = fp;
      }
      if (prevFP) prevFP.maxBaseIndex = Infinity;
    }
    
    let nears = [];
    for (let i = 0; i < augPoints.length; i++) {
      nears[i] = findNears (augPoints, distances, i, 0, augPoints.length-1, useThC[i] ? thresholdC : threshold);
      if (nears[i].length === 0) {
        nears[i].push ([i, i, i]);
      }
    }

    let phases = [];
    let i2p = [];
    {
      let size = 0;
      let seg;
      for (let i = 0; i < augPoints.length; i++) {
        let s = nears[i].length;
        if (s === size) {
          let matched = true;
          let change = [];
          for (let k = 0; k < s; k++) {
            if (seg[2][k] === +1 && nears[i-1][k][2] >= nears[i][k][0]) {
              //
            } else if (seg[2][k] === -1 && nears[i][k][2] >= nears[i-1][k][0]) {
              //
            } else if (seg[2][k] === 0) {
              if (nears[i-1][k][2] >= nears[i][k][0] &&
                  (nears[i-1][k][0] <= nears[i][k][0] ||
                   nears[i-1][k][2] <= nears[i][k][2])) {
                if (nears[i-1][k][0] < nears[i][k][0] ||
                    nears[i-1][k][2] < nears[i][k][2]) change[k] = +1;
                //
              } else if (nears[i][k][2] >= nears[i-1][k][0] &&
                         (nears[i][k][0] <= nears[i-1][k][0] ||
                          nears[i][k][2] <= nears[i-1][k][2])) {
                if (nears[i][k][0] < nears[i-1][k][0] ||
                    nears[i][k][2] < nears[i-1][k][2]) change[k] = -1;
                //
              } else {
                matched = false;
                break;
              }
            } else {
              matched = false;
              break;
            }
          } // k
          if (matched) {
            seg[1] = i;
            i2p[i] = seg.index;
            for (let k in change) {
              seg[2][k] = change[k];
            }
          } else {
            seg = [i, i, nears[i].map (_ => 0)];
            seg.index = phases.length;
            i2p[i] = seg.index;
            phases.unshift (seg);
            //size = s;
          }
        } else { // size boundary
          seg = [i, i, nears[i].map (_ => 0)];
          seg.index = phases.length;
          i2p[i] = seg.index;
          phases.unshift (seg);
          size = s;
        }
      }
    }
    phases = phases.reverse ();

    let d2b = [];
    {
      let currentI = -1;
      J: for (let j = 0; j < dataPoints.length; j++) {
        let dp = dataPoints[j];
        if (dp.baseIndex != null) {
          let link = d2b[j] = {dataIndex: j, effectiveIndex: dp.baseIndex,
                               nearestIndex: dp.baseIndex,
                               phase: i2p[dp.baseIndex],
                               forced: dp.source};
          maxBaseIndex = dp.maxBaseIndex;
          continue J;
        }
        
        let nearest = getNearest (augPoints, dp);
        if (nearest.distance2 < threshold) {
          let i = nearest.index;
          let link = d2b[j] = {dataIndex: j, nearestIndex: i};

          let candI = null;
          N: for (let n of nears[i]) {
            if (n[1] === i) {
              if (currentI < i) {
                candI = i;
                break;
              } else if (n[0] <= currentI) {
                if (currentI <= n[2]) {
                  continue J;
                } else {
                  continue N;
                }
              }

              if (i2p[currentI] === i2p[n[1]]) {
                continue J;
              }

            } else {
              if (i2p[currentI] === i2p[n[0]] && currentI < n[1]) {
                candI = n[1];
                break;
              }
              
              if (currentI < n[2]) {
                let minD = Infinity;
                let minDi = -1;
                let minDi2 = -1;
                for (let k = n[0]; k <= n[2]; k++) {
                  let d = distance2 (augPoints[k], dp);
                  if (d < minD) {
                    minD = d;
                    minDi = k;
                    if (currentI < k) minDi2 = k;
                  }
                }
                if (currentI < minDi) {
                  candI = minDi;
                  break;
                } else if (currentI < minDi2) {
                  candI = minDi2;
                  break;
                } else if (n[0] <= currentI) {
                  continue J;
                }
              }
            }
          } // N
          if (candI !== null) {
            if (i2p[currentI] < i2p[candI]) {
              N: for (let n of nears[currentI]) {
                let c = false;
                if (i2p[currentI] < i2p[n[1]] && i2p[n[1]] < i2p[candI]) {
                  c = true;
                } else if (i2p[currentI] <= i2p[n[2]] &&
                           i2p[n[1]] < i2p[candI] && candI <= n[2]) {
                  c = true;
                } else if (i2p[n[2]] <= i2p[currentI]) {
                  continue N;
                } else if (i2p[candI] < i2p[n[0]]) {
                  continue N;
                }
                if (c) {
                  if (0 <= i2p[n[1]] - i2p[currentI] &&
                      i2p[n[1]] - i2p[currentI] < 10) {
                    let small = true;
                    for (let k = i2p[currentI]; k <= i2p[n[1]]; k++) {
                      if (phases[k][1] - phases[k][0] < 10) {
                        let l = Math.floor ((phases[k][0] + phases[k][1]) / 2);
                        if ((currentI <= l ? distances[l][currentI] : distances[currentI][l]) < threshold*4) {
                          //
                        } else {
                          small = false;
                          break;
                        }
                      } else {
                        small = false;
                        break;
                      }
                    }
                    if (!small) continue J;

                  } else {
                    continue J;
                  }
                } else {
                  //continue J;
                } // c
              }
            }
            if (currentI !== candI && candI < maxBaseIndex) {
              link.effectiveIndex = candI;
              currentI = candI;
              link.phase = i2p[candI];
            }
            continue J;
          } // candI
        }
      } // J
    }

    return {
      elapsed: {start, recompute: performance.now () - start},
      thresholdMInput: radius,
      threshold,
      thresholdC,
      confluentialPoints,
      useThresholdC: useThC,
      basePoints: augPoints,
      baseNears: nears,
      basePhases: phases,
      dataPoints,
      dataToBase: d2b,
    };
  } // recompute

  function parseGPX (text) {
    var parser = new GPXParser;
    parser.baseURL = 'about:blank';
    var json = parser.parseText (text);
    json = json || {tracks: []};
    let points = [];
    json.tracks.forEach ((track) => {
      track.segments.forEach (function (seg) {
        seg.points.forEach (function (p) {
          points.push (p);
        });
      });
    });
    return points;
  } // parseGPX

  function fetchIbuki (u) {
    let urls = {routes: new URL (u)};
    let m;
    let teamId;
    if (urls.routes.pathname.match (/^\/a\/log\//)) {
      urls.routes = new URL ('t/1/locationhistory.json', urls.routes);
    } else if (m = urls.routes.pathname.match (/\/t\/([0-9]+)/)) {
      teamId = m[1];
      urls.routes = new URL ('locationhistory.json', urls.routes);
      urls.results = new URL ('../../results.json', urls.routes);
      urls.info = new URL ('../../info.json', urls.routes);
    } else {
      urls.routes = new URL ('info.json', urls.routes);
      urls.results = new URL ('results.json', urls.routes);
    }
    return Promise.all ([
      fetch (urls.routes).then (res => {
        if (res.status !== 200) throw res;
        return res.json ();
      }),
      urls.results ? fetch (urls.results).then (res => {
        if (res.status !== 200) throw res;
        return res.json ();
      }) : null,
      urls.info ? fetch (urls.info).then (res => {
        if (res.status !== 200) throw res;
        return res.json ();
      }) : null,
    ]).then (([jsonRoutes, jsonResults, jsonInfo]) => {
      let pp = [];
      let routes = parseEncodedRoutes (jsonRoutes.encoded_routes);
      routes.forEach (_ => {
        pp = pp.concat (_.points);
      }); // XXX boundary
      let teamResultItems = [];
      let teamIds = new Set;
      (jsonResults || {}).items.forEach (_ => {
        if (_.t == teamId) {
          teamResultItems[_.p] = _;
        }
        teamIds.add (_.t);
      });
      let forced = [];
      ((jsonInfo || jsonRoutes || {}).marked_points || []).forEach (mp => {
        if (teamId != null) {
          if (mp.type === 'globalStart' || mp.type === 'partialStart') {
            let tr = teamResultItems[mp.id];
            if (tr && tr.n) {
              forced.push ({timestamp: tr.c, lat: mp.lat, lon: mp.lon,
                            baseOrigIndex: mp.index,
                            source: 'resultStart'});
            }
          }
        } else {
          pp[mp.index].confluential = true;
        }
      });
      (((teamResultItems[0] || {}).d || {}).m || []).forEach (_ => {
        forced.push ({timestamp: _.t, lat: 0, lon: 0, source: 'marker'});
      });
      
      return {
        routePoints: pp,
        forcedPoints: forced,
        teamIds,
      };
    });
  } // fetchIbuki

  function parseEncodedRoutes (encodedRoutes) {
    let routes = [];
    encodedRoutes.forEach (function (_) {
      var latlon = EncodedPolyline.decode (_.latlon, 2, 1e5);
      var elevation = EncodedPolyline.decode (_.elevation, 1, 1e3);
      var distance = _.distance != null ? EncodedPolyline.decode (_.distance, 1, 1e3) : [];
      var timestamp = _.timestamp != null ? EncodedPolyline.decode (_.timestamp, 1, 1e0) : [];
      var roadtype = _.roadtype != null ? EncodedPolyline.decode (_.roadtype, 1, 1e0) : [];
      var points = [];
      for (var i = 0; i < latlon.length; i++) {
        points.push ({lat: latlon[i][0], lon: latlon[i][1],
                      elevation: elevation[i][0],
                      to_distance: (distance[i] ? distance[i][0] : null),
                      timestamp: (timestamp[i] ? timestamp[i][0] : null),
                      roadtype: (roadtype[i] ? roadtype[i][0] : null)});
      }
      if (points.length) routes.push ({points: points});
    });
    return routes;
  } // parseEncodedRoutes

  // Hubeny's distance with WGS84
  function distanceH84(p1, p2) {
    var d2r = (deg) => deg * Math.PI / 180;

    var lat1 = d2r (p1.lat);
    var lat2 = d2r (p2.lat);

    var latDelta = lat1 - lat2;
    var lonDelta = Math.abs (d2r (p1.lon) - d2r (p2.lon));
    if (lonDelta > Math.PI) lonDelta = 2 * Math.PI - lonDelta;
    var latAvg = (lat1 + lat2) / 2;

    // WGS84
    var a = 6378137.000;
    var e2 = 0.00669437999019758; // e^2 = (a^2 - b^2) / a^2
    var a1e2 = 6335439.32729246; // a * (1 - e^2)

    var W2 = 1 - e2 * Math.pow (Math.sin (latAvg), 2);
    var W = Math.pow (W2, 0.5);
    var M = a1e2 / (W2 * W);
    var N = a / W;

    return Math.sqrt (Math.pow (latDelta * M, 2) +
                      Math.pow (lonDelta * N * Math.cos (latAvg), 2));
  } // distanceH84



  function bounds (points) {
    var data = {distanceSum: 0, routeCount: 0, west:0,east:0,north:0,south:0};
    if (!points.length) return data;

    data.maxLat = data.minLat = points[0].lat;
    data.maxLon = data.minLon = points[0].lon;
    data.minElevation = data.maxElevation = points[0].elevation;

    points.forEach (function (pt) {
      // XXX +180/-180
      if (pt.lat < data.minLat) data.minLat = pt.lat;
      if (data.maxLat < pt.lat) data.maxLat = pt.lat;
      if (pt.lon < data.minLon) data.minLon = pt.lon;
      if (data.maxLon < pt.lon) data.maxLon = pt.lon;
      if (pt.elevation != null) {
        if (pt.elevation < data.minElevation || !Number.isFinite (data.minElevation)) {
          data.minElevation = pt.elevation;
        }
        if (data.maxElevation < pt.elevation || !Number.isFinite (data.maxElevation)) {
          data.maxElevation = pt.elevation;
        }
      }
      if (!Number.isFinite (pt.prevDistance)) {
        data.routeCount++;
      } else {
        data.distanceSum += pt.prevDistance;
      }
    });

    let bounds = data;
    return {east: bounds.maxLon, west: bounds.minLon,
            north: bounds.maxLat, south: bounds.minLat};
  } // bounds

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = Promise.all ([
    fetch ("https://raw.githack.com/wakaba/js-gpx-parser/master/gpx-parser.js").then (res => {
      if (res.status !== 200) throw res;
      return res.text ();
    }).then (_ => eval (_ + "; global.GPXParser = GPXParser")),
    fetch ("https://raw.githack.com/wakaba/js-geo-encodedpolyline/master/encodedpolyline.js").then (res => {
      if (res.status !== 200) throw res;
      return res.text ();
    }).then (_ => eval (_ + "; global.EncodedPolyline = EncodedPolyline")),
  ]).then (() => {
    return {
      fetchIbuki,
      recompute,
    };
  });
}

/*
  
Copyright 2019-2024 Wakaba <wakaba@suikawiki.org>.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Affero General Public License for more details.

You does not have received a copy of the GNU Affero General Public
License along with this program, see <https://www.gnu.org/licenses/>.

*/
