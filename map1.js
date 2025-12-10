  function parseEncodedRoutes (encodedRoutes) {
    let routes = [];
    encodedRoutes.forEach (function (_) {
      var latlon = EncodedPolyline.decode (_.latlon, 2, 1e5);
      var elevation = EncodedPolyline.decode (_.elevation, 1, 1e3);
      var distance = _.distance != null ? EncodedPolyline.decode (_.distance, 1, 1e3) : [];
      delete distance[0];
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

function attachTimestamps (route, startTime) {
  let baseSpeed = 5.0; // m/s
  let gradeFactor = 0;
  
  function haversine(a, b) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const lat1 = a.lat * rad;
    const lat2 = b.lat * rad;

    const h = Math.sin(dLat / 2)**2 +
              Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2)**2;

    return 2 * R * Math.asin(Math.sqrt(h));
  }

  let current = startTime;
  route[0].timestamp = startTime;

  for (let i = 1; i < route.length; i++) {
    const A = route[i - 1];
    const B = route[i];

    const dist = haversine(A, B);
    const elevDiff = (B.elevation ?? 0) - (A.elevation ?? 0);

    const grade = dist > 0 ? elevDiff / dist : 0;

    const speed = baseSpeed * (1 / (1 + gradeFactor * grade));

    const dt = dist / speed;
    current += dt;
    B.timestamp = current;
  }
} // attachTimestamps
      async function createMarkerImage (id, opts) {
        let {
          width = 64,
          height = 64,
          text = "",
          fontFamily = "sans-serif",
    fontSize = 20,
    fgColor = "#ffffff",
          padding = 6,
          maxFontShrinkIterations = 10
        } = opts;

        const dpr = window.devicePixelRatio || 1;

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
        
        let ctx = canvas.getContext ("2d");
        ctx.scale (dpr, dpr);
        //ctx.clearRect (0, 0, width, height);

        let cx = width / 2;
        let cy = height / 2;
        if (opts.circleFillColor || opts.circleStrokeWidth) {
          let radius = Math.min (width - 2*padding, height - 2*padding) / 2;

          if (opts.circleFillColor) {
            ctx.beginPath ();
            ctx.arc (cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = opts.circleFillColor;
            ctx.fill ();
          }

          if (opts.circleStrokeWidth) {
            ctx.beginPath ();
            ctx.arc (cx, cy, radius, 0, Math.PI * 2);
            ctx.lineWidth = opts.circleStrokeWidth;
            ctx.strokeStyle = opts.circleStrokeColor;
            ctx.stroke ();
          }
        }
        
        if (opts.rectFillColor || opts.rectStrokeWidth) {
          let radius = Math.min (width - 2*padding, height - 2*padding) / 2;

          if (opts.rectFillColor) {
            ctx.beginPath ();
            ctx.fillStyle = opts.rectFillColor;
            ctx.fillRect (padding, padding, width - 2*padding, height - 2*padding);
          }

          if (opts.rectStrokeWidth) {
            ctx.beginPath ();
            ctx.lineWidth = opts.rectStrokeWidth;
            ctx.strokeStyle = opts.rectStrokeColor;
            ctx.strokeRect (padding, padding, width - 2*padding, height - 2*padding);
          }
        }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fgColor;

        ctx.font = `${fontSize}px ${fontFamily}`;
        
        ctx.fillText(text, cx, cy);
        
        return {id, url: canvas.toDataURL("image/png"), width, height};
      }

      async function createTextImageDataURL(id, text, opts) {
        let {
          fontFamily = 'sans-serif', fontSize = 24, color = '#000',
                  strokeColor = 'white',
                  strokeWidth = 4,
          padding = 2,
          vertical = false,
        } = opts;

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, 'svg');
        const textEl = document.createElementNS(svgNS, 'text');

        if (vertical) {
          textEl.setAttribute('writing-mode', 'vertical-rl');
        }
        
  textEl.setAttribute ('x', padding);
        textEl.setAttribute('y', padding);
  textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('fill', color);
        textEl.setAttribute('stroke', strokeColor);
        textEl.setAttribute('stroke-width', strokeWidth);
        textEl.setAttribute('paint-order', 'stroke');
        textEl.style.textOrientation = "upright";
  textEl.textContent = text;

        svg.appendChild(textEl);
        document.body.appendChild(svg);

        const bbox = textEl.getBBox();
        svg.setAttribute ('width', bbox.width + 2 * padding);
        svg.setAttribute ('height', bbox.height + 2 * padding);
        if (vertical) {
          textEl.setAttribute('writing-mode', 'vertical-rl');
          textEl.setAttribute('dominant-baseline', 'text-after-edge');
          textEl.setAttribute('text-anchor', 'start');
          textEl.setAttribute ('x', padding);
        } else {
          textEl.setAttribute('dominant-baseline', 'alphabetic');
          textEl.setAttribute('text-anchor', 'start');
          textEl.setAttribute ('y', padding + fontSize);
        }

  const svgData = new XMLSerializer().serializeToString(svg);
          document.body.removeChild(svg);

        return new Promise((resolve) => {
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          return resolve({id, url,width:bbox.width,height:bbox.height});
        });
      }
      let icons = {};
      async function addTeamIcon (map, team, opts)  {
        let id = 'team-icon-' + team.id;
        if (opts.tracked) id += '-tracked';
        if (map.hasImage (id)) return icons[id];

        let x = await createMarkerImage (id, {
          width: 64,
          height: 64,
          text: team.short_label,
          fontFamily: "sans-serif",
          fontSize: 20,
          fgColor: "black",
          circleFillColor: opts.tracked ? "yellow" : "white",
          circleStrokeColor: "black",
    circleStrokeWidth: 3,
    padding: 6
        });

        return new Promise ((ok, ng) => {
          let img = document.createElement ('img');
          img.onerror = ng;
          img.onload = () => {
            map.addImage (id, img);
            ok (icons[id] = x);
          };
          img.src = x.url;
        });
      } // addTeamIcon

      async function addMarkedPointIcon (map, mp)  {
        let id = 'markedpoint-icon-' + mp.id;
        if (map.hasImage (id)) return icons[id];

        let x = await createMarkerImage (id, {
          width: 64,
          height: 48,
          text: mp.short_label,
          fontFamily: "sans-serif",
          fontSize: 20,
          fgColor: "white",
          rectFillColor: {
            globalStart: "#d82d29",
            partialStart: "#d82d29",
            globalGoal: "#8037e2",
            partialGoal: "#8037e2",
          }[mp.type] || "gray",
          rectStrokeColor: "#eee",
          rectStrokeWidth: 2,
          padding: 6,
        });

        return new Promise ((ok, ng) => {
          let img = document.createElement ('img');
          img.onerror = ng;
          img.onload = () => {
            map.addImage (id, img);
            ok (icons[id] = x);
          };
          img.src = x.url;
        });
      } // addMarkedPointIcon
      async function addMarkedPointLabel (map, mp)  {
        let id = 'markedpoint-label-' + mp.id;
        if (map.hasImage (id)) return icons[id];

        let x = await createTextImageDataURL (id, mp.label, {
          color: 'black',
          vertical: true,
        });

        return new Promise ((ok, ng) => {
          let img = document.createElement ('img');
          img.onerror = ng;
          img.onload = () => {
            map.addImage (id, img);
            ok (icons[id] = x);
          };
          img.src = x.url;
        });
      } // addMarkedPointLabel

      let hasHandlers = {};
      async function showMarkedPoints (map, mps) {
        if (!map.getSource ('markedpoints')) {
          map.addSource ('markedpoints', {type: 'geojson', data: {
            type: 'FeatureCollection',
            features: [],
          }});
        }
        if (!map.getLayer ('markedpoints')) {
          map.addLayer ({
            id: 'markedpoints',
            source: 'markedpoints',
            type: 'circle',
            paint: {
              'circle-radius': 8,
              'circle-color': 'rgba(0, 255, 0, 0.4)',
              'circle-stroke-color': '#000000',
              'circle-stroke-width': 1,
            },
            minzoom: 10,
          });
          map.addLayer ({
            id: 'markedpoint-icons',
            source: 'markedpoints',
            type: 'symbol',
            layout: {
              'icon-image': ['get', 'iconImage'],
              'icon-size': 1,
              'icon-allow-overlap': true,
              'icon-offset': ['get', 'iconImageOffset'],
            },
            minzoom: 10,
          });
          map.addLayer ({
            id: 'markedpoint-labels',
            source: 'markedpoints',
            type: 'symbol',
            layout: {
              'icon-image': ['get', 'labelImage'],
              'icon-size': 1,
              'icon-allow-overlap': false,
              'icon-offset': ['get', 'labelImageOffset'],
            },
            minzoom: 10,
          });
          if (!hasHandlers.markedPointClick) {
            hasHandlers.markedPointClick = true;
            map.on ('click', 'markedpoints', (e) => {
              let feature = e.features[0];
              console.log (feature.properties.markedPoint);
            });
          }
        }
        
        await Promise.all (mps.map (_ => addMarkedPointIcon (map, _).then (x => _.icon = x)));
        await Promise.all (mps.map (_ => addMarkedPointLabel (map, _).then (x => _.labelImage = x)));

        let data = {
          type: 'FeatureCollection',
          features: [
            ...mps.map ((item, i) => ({
              type: 'Feature',
              geometry: {type: 'Point', coordinates: [item.lon, item.lat]},
              properties: {
                markedPoint: item,
                iconImage: item.icon.id,
                iconImageOffset: [0, - (item.icon.height/2 + 10)],
                labelImage: item.labelImage.id,
                labelImageOffset: [0, - (item.labelImage.height/2 + 2 + item.icon.height + 10)],
              },
            })),
          ],
        };
        let source = map.getSource ('markedpoints');
        source.setData (data);
      } // showMarkedPoints

      let trackedTeamDk = null;
      async function showTeamLocations (map, items, opts) {
        await Promise.all (items.map (_ => addTeamIcon (map, _.td, {}).then (x => _.icon = x)));
        await Promise.all (items.map (_ => addTeamIcon (map, _.td, {
          tracked: true,
        }).then (x => _.trackedIcon = x)));

        let data = {
          type: 'FeatureCollection',
          features: [
            ...items.map ((item, i) => ({
              type: 'Feature',
              geometry: {type: 'Point',
                         coordinates: [item.point.lon, item.point.lat]},
              properties: {
                td: item.td,
                iconImage: item.icon.id,
                iconImageOffset: [0, - (item.icon.height/2 + 10)],
                trackedIconImage: item.trackedIcon.id,
                tracked: opts.tracked || false,
              },
            })),
          ],
        };
        let source = map.getSource ('team-locations-' + opts.id);
        if (source) {
          source.setData (data);
        } else {
          map.addSource ('team-locations-' + opts.id, {type: 'geojson', data});
        }

        if (!map.getLayer ('team-locations-' + opts.id)) {
          map.addLayer ({
            id: 'team-locations-' + opts.id,
            source: 'team-locations-' + opts.id,
            type: 'symbol',
            layout: {
              'icon-image': [
                'case',
                ['get', 'tracked'], ['get', 'trackedIconImage'],
                ['get', 'iconImage'],
              ],
              'icon-size': 1,
              'icon-allow-overlap': true,
              'icon-offset': ['get', 'iconImageffset'],
            },
          });
          if (!hasHandlers['teamClick-' + opts.id]) {
            hasHandlers['teamClick-' + opts.id] = true;
            map.on ('click', 'team-locations-' + opts.id, (e) => {
              let feature = e.features[0];
              console.log (feature.properties.td);
              trackedTeamDk = JSON.parse (feature.properties.td).dk;
            });
          }
        }
      } // showTeamLocations

function showRoutes (map, routes, opts) {
  function splitByRoadtype(points) {
  if (points.length === 0) return [];

  const segments = [];
  let currentType = points[0].computedRoadtype ?? points[0].roadtype ?? 0;
  let currentSegment = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const type = p.computedRoadtype ?? p.roadtype ?? 0;

    if (type === currentType) {
      currentSegment.push(p);
    } else {
      segments.push({
        roadtype: currentType,
        points: currentSegment
      });
      currentType = type;
      currentSegment = [points[i - 1], p];  
    }
  }

    segments.push({
      roadtype: currentType,
      points: currentSegment
    });
    
    return segments;
  } // splitByRoadtype
  
  let data = {
    type: 'FeatureCollection',
    features: [
            ...routes.map (_ => _.points).flat ().map (p => ({
              type: 'Feature',
              geometry: {type: 'Point', coordinates: [p.lon, p.lat]},
              properties: {
                roadtype: p.computedRoadtype ?? p.roadtype ?? 0,
              },
            })),
      ...routes.flatMap(route => {
  const segments = splitByRoadtype(route.points);

  return segments.map(seg => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: seg.points.map(p => [p.lon, p.lat]),
    },
    properties: {
      roadtype: seg.roadtype,
    },
  }));
      }),
    ],
  }; // data
        let source = map.getSource ('routes-' + opts.id);
        if (source) {
          source.setData (data);
        } else {
          map.addSource ('routes-' + opts.id, {type: 'geojson', data});
        }

        if (!map.getLayer ('route-points-' + opts.id)) {
          map.addLayer({
            id: 'route-lines-' + opts.id,
            source: 'routes-' + opts.id,
            type: 'line',
            paint: opts.linePaint || {},
            layout: opts.lineLayout || {},
            filter: ['==', ['geometry-type'], 'LineString']
          }, opts.layerBeforeId || undefined);
          map.addLayer ({
            id: 'route-points-' + opts.id,
            source: 'routes-' + opts.id,
            type: 'circle',
            paint: opts.pointPaint || {},
            layout: opts.pointLayout || {},
            filter: ['==', ['geometry-type'], 'Point'],
            minzoom: opts.pointMinZoom,
          }, opts.layerBeforeId || undefined);
        }
      } // showRoutes

      function showTeamHistory (map, taem, routes, opts) {
        showRoutes (map, routes, {
          id: 'team-history',
          linePaint: {
            'line-color': '#ffff0087',
            'line-width': 3,
          },
          pointPaint: {
            'circle-radius': 5,
            'circle-color': 'yellow',
            'circle-stroke-color': 'gray',
            'circle-stroke-width': 1,
          },
          layerBeforeId: opts.layerBeforeId,
        });
      } // showTeamHistory



      function directionByPCA (points, idx, window) {
        const center = points[idx];
        const deg2rad = Math.PI/180;
        const R = 6371000;
        const lat0 = center.lat * deg2rad;
        const cosLat0 = Math.cos(lat0);

        const start = Math.max(0, idx - window);
        const end   = Math.min(points.length - 1, idx + window);

        const arr = [];
        for (let i = start; i <= end; i++) {
          const p = points[i];
          const dx = (p.lon - center.lon) * deg2rad * R * cosLat0; 
          const dy = (p.lat - center.lat) * deg2rad * R;
          arr.push([dx, dy]);
        }

        let sx=0, sy=0, sxx=0, sxy=0, syy=0;
        const n = arr.length;
        for (const [dx, dy] of arr) { sx += dx; sy += dy; sxx += dx*dx; sxy += dx*dy; syy += dy*dy; }
  const mx = sx / n, my = sy / n;
  const covxx = sxx/n - mx*mx;
  const covxy = sxy/n - mx*my;
  const covyy = syy/n - my*my;

        const trace = covxx + covyy;
  const det = covxx*covyy - covxy*covxy;
  const lambda = trace/2 + Math.sqrt((trace*trace)/4 - det);
        let vx = covxy;
  let vy = lambda - covxx;
  if (Math.abs(vx) < 1e-12 && Math.abs(vy) < 1e-12) { vx = 1; vy = 0; }
        const len = Math.hypot(vx, vy) || 1;
        vx /= len; vy /= len;

        const angRad = Math.atan2(vy, vx);
        const bearing = (90 - angRad*180/Math.PI + 360) % 360;
        return bearing;
      }

      let prevTimer1;
      let prevTimer2;
      let prevNow = 0;
      let prevTime = 0;
      let time = 0;
      function showByTime (mani, map, info, teamData, teamStatuses, time, opts) {
        if (time) {
          clearTimeout (prevTimer2);
          cancelAnimationFrame (prevTimer1);
        } else {
          if (prevTimer1 || prevTimer2) return;
        }
        if (false && map.XXXdragging) {
          prevTimer2 = setTimeout (() => {
            if (time) {
              prevTime = time;
              prevNow = performance.now ();
            }
            prevTimer1 = prevTimer2 = null;
            _showByTime (mani, map, info, teamData, teamStatuses, opts);
          }, 500);
        } else {
          prevTimer1 = requestAnimationFrame (() => {
            if (time) {
              prevTime = time;
              prevNow = performance.now ();
            }
            prevTimer1 = prevTimer2 = null;
            _showByTime (mani, map, info, teamData, teamStatuses, opts);
          });
        }
      } // showByTime
      let prevEased = 0;
let prevTeamDk = null;
let prevDuration = 0;
      let locItems = {};
      let trackedLocItems = {};
      let timeFactor = 600;
      function _showByTime (mani, map, info, teamData, teamStatuses, opts) {

        let now = performance.now ();
        if (opts.animated) {
          let delta = (now - prevNow) / 1000;
          time = prevTime + delta * timeFactor;
          prevNow = now;
          prevTime = time;
        } else {
          time = prevTime;
        }

        let container = map.getContainer ();
        let rect = container.getBoundingClientRect ();
        let width = rect.width;
        let height = rect.height;

        let txes = {};
        let newCameraPoint = undefined;
        let newCameraOffset = undefined;
        let newCameraDuration = 3000;
        let newBearing = undefined;
        for (let ts of Object.values (teamStatuses)) {
          let td = teamData[ts.dk];

          let path = ts.computed.dataPoints;
          if (path.length < 2) continue;
        
          let i = 0;
          while (i < path.length-1 && path[i+1].timestamp < time) i++;
          if (i >= path.length-1) i = path.length-2;
          let p0 = path[i];
          let p1 = path[i+1];
          let t = (time - p0.timestamp)/(p1.timestamp - p0.timestamp);
          if (i === 0) {
            t = 0;
          } else if (path.length-2 <= i) {
            t = 1;
          }
          txes[ts.dk] = {path, i, p0, p1, computedBaseIndex: 0,
                         td, dk: ts.dk};
          for (let j = p0.index; j >= 0; j--) {
            let x = ts.computed.dataToBase[j]?.effectiveIndex;
            if (Number.isFinite (x)) {
              txes[ts.dk].computedBaseIndex = x;
              break;
            }
          }

          txes[ts.dk].point = {
            lat: p0.lat + t*(p1.lat - p0.lat),
            lon: p0.lon + t*(p1.lon - p0.lon),
          };
        } // ts

        {
          let tdk = trackedTeamDk;
          if (document.querySelector ('input[name=track_by_rank]:checked')) {
            let rank = document.querySelector ('input[name=tracked_rank]').valueAsNumber;
            let tx = Object.values (txes).sort ((a, b) => b.computedBaseIndex - a.computedBaseIndex)[rank - 1];
            if (tx) tdk = tx.dk;
          }

          locItems = {};
          trackedLocItems = {};
          Object.values (txes).forEach (tx => {
            if (tdk === tx.dk) {
              trackedLocItems[tx.dk] = {td: tx.td, point: tx.point};
            } else {
              locItems[tx.dk] = {td: tx.td, point: tx.point};
            }
          });
          showTeamLocations (map, Object.values (locItems), {
            id: 'history-current',
          });
          showTeamLocations (map, Object.values (trackedLocItems), {
            id: 'history-current-tracked',
            tracked: true,
          });
          
          let tx = txes[tdk];
          if (tx) {
            let td = teamData[tdk];
            let ts = teamStatuses[tdk];
            
            if (!map.XXXdragging) {
              let p0 = tx.p0;
              let p1 = tx.p1;
              let deltaLon = (p1.lon - p0.lon) * Math.PI/180;
              let y = Math.sin(deltaLon) * Math.cos(p1.lat*Math.PI/180);
              let x = Math.cos(p0.lat*Math.PI/180)*Math.sin(p1.lat*Math.PI/180) - Math.sin(p0.lat*Math.PI/180)*Math.cos(p1.lat*Math.PI/180)*Math.cos(deltaLon);
              let targetBearing = (Math.atan2(y,x) * 180/Math.PI + 360) % 360;
              targetBearing = directionByPCA (tx.path, tx.i, 50);
              if (width > height) targetBearing += 90;

              newBearing = targetBearing;
              newCameraPoint = tx.point
              newCameraOffset = undefined;
              if (opts.animated) {
                let unchanged = 0.5;
                unchanged = 0.01//XXX
                let targetPoint = map.project (newCameraPoint);
              let centerPoint = map.project (map.getCenter ());
              let centerX = width / 2;
              let centerY = height / 2;
              let allowedX = width * unchanged / 2;
              let allowedY = height * unchanged / 2;
              let dx = targetPoint.x - centerPoint.x;
              let dy = targetPoint.y - centerPoint.y;
              let overX = 0;
              let overY = 0;
              if (dx >  allowedX) overX = +1;
              if (dx < -allowedX) overX = -1;
              if (dy >  allowedY) overY = +1;
              if (dy < -allowedY) overY = -1;
              if (Math.abs (dx) < allowedX) overX = 0;
              if (Math.abs (dy) < allowedY) overY = 0;
              let biasAmountX = width * 0.20;
              let biasAmountY = height * 0.20;
              let offsetX = (centerX - centerPoint.x) + -overX * biasAmountX;
              let offsetY = (centerY - centerPoint.y) + -overY * biasAmountY;
                newCameraOffset = [offsetX, offsetY];
                newCameraOffset = null // XXX
                if (overX || overY) {
                  if (targetPoint.x < 0 || targetPoint.y < 0 ||
                      targetPoint.x > width || targetPoint.y > height) {
                    newCameraDuration = 1000;
                  } else {
                    //
                  }
                } else {
                  newCameraPoint = newCameraOffset = undefined;
                }

                {
                  let nw = map.unproject ({x: centerX - allowedX, y: centerY - allowedY});
                  let ne = map.unproject ({x: centerX + allowedX, y: centerY - allowedY});
                  let se = map.unproject ({x: centerX + allowedX, y: centerY + allowedY});
                  let sw = map.unproject ({x: centerX - allowedX, y: centerY + allowedY});

                  let geojson = {
                    type: "Feature",
                    geometry: {
                      type: "Polygon",
                      coordinates: [[
        [nw.lng, nw.lat],
        [ne.lng, ne.lat],
        [se.lng, se.lat],
        [sw.lng, sw.lat],
        [nw.lng, nw.lat],
      ]],
                    },
                    properties: {
                      outside: newCameraPoint ? newCameraDuration > 1000 ? 1 : 2 : 0,
                    },
                  };

                  if (map.getSource("focus-rect")) {
                    map.getSource("focus-rect").setData(geojson);
                  } else {
                    map.addSource("focus-rect", { type: "geojson", data: geojson });
                    map.addLayer({
      id: "focus-rect-outline",
      type: "line",
      source: "focus-rect",
                      paint: {
                        "line-color": [
                          'match', ['get', 'outside'],
                          2, 'red', 1, 'orange', "green",
                        ],
                        "line-width": [
                          'match', ['get', 'outside'],
                          2, 8, 1, 4, 2,
                        ],
                        "line-opacity": 0.8,
                      }
                    });
                  }
                }
              } else { // not animated
                newCameraDuration = 0;
              }
            
              if (prevTeamDk !== tdk) {
                if (ts.showHistory) showTeamHistory (map, td, ts.routes, {
                  layerBeforeId: 'markedpoints',
                });
                prevTeamDk = tdk;
              }
            } // tracked
            
            let rank = Object.values (txes).filter (_ => _.computedBaseIndex > tx.computedBaseIndex).length + 1;
            $fill (document.querySelector ('.tracked-team-info'), {
              td,
              ts,
              rank,
            });
          } // tx
        }

        if (newCameraPoint || newBearing) {
          mani.update ({
            cameraPoint: newCameraPoint,
            cameraOffset: newCameraOffset,
            bearing: newBearing,
            soon: ! newCameraDuration,
          });
          /*
          if (!opts.animated ||
              now - prevEased > (newCameraDuration || 3*1000)) {
            if (newBearing != null) map.easeTo({
              bearing: newBearing,
              duration: opts.animated ? 30*1000 : 0,
            });
            if (newCameraPoint) map.easeTo({
              center: newCameraPoint,
              ...(newCameraOffset ? {offset: newCameraOffset} : {}),
              duration: newCameraDuration,
              easing : t => t,
            });
            prevEased = now;
            if (newCameraPoint) prevDuration = newCameraDuration
            }
            */
        } // opts.ease

        if (document.querySelector ('input[name=animated]:checked')) {
          showByTime (mani, map, info, teamData, teamStatuses, null, {
            animated: true,
          });
        }
        document.querySelector ('input-datetime').value = time;
      } // _showByTime

      document.querySelectorAll ('map-area').forEach (ma => {
        ma.addEventListener ('mousedown', () => {
          ma.pc_MLMap.XXXdragging = true;
        }, {capture: true});
        window.addEventListener ('mouseup', () => {
          ma.pc_MLMap.XXXdragging = false;
        }, {capture: true});
      });

class MapAnimator {
  constructor(map) {
    this.map = map;

    this.anim = {camera: {}, bearing: {}};
    this.running = false;
  } // constructor

  update({ cameraPoint, cameraOffset, bearing, soon }) {
    if (soon) {
      let ease = {};
      if (cameraPoint) {
        ease.center = cameraPoint;
        if (cameraOffset) ease.offset = cameraOffset;
      }
      if (bearing != null) ease.bearing = bearing;
      this.map.jumpTo (ease);
      this.anim = {camera: {}, bearing: {}};
      this.running = false;
      return;
    }
    
    const now = Date.now ();

    if (cameraPoint) {
      let center = this.map.getCenter ();
      let logicalCenterPx = this.map.project (center);
      let targetPx = this.map.project (cameraPoint);
      let screenCenterPx = {
        x: this.map._canvas.width/2,
        y: this.map._canvas.height/2, // XXX
      };
      let screenCenter = this.map.unproject (screenCenterPx);
      let dx = logicalCenterPx.x - screenCenterPx.x;
      let dy = logicalCenterPx.y - screenCenterPx.y;
      let correctedCenterPx = {
        x: targetPx.x + dx,
        y: targetPx.y + dy,
      };
      let cCenter = this.map.unproject (correctedCenterPx);
      cCenter.lon = cCenter.lng;
      this.anim.camera.rawTarget = cCenter;
      if (!this.anim.camera.smooth) {
        this.anim.camera.smooth = cCenter;
      }
      this.anim.camera.vel = this.anim.camera.vel || {x: 0, y: 0};
    }

    if (bearing != null) {
      this.anim.bearing.start = this.map.getBearing ();
      this.anim.bearing.end = bearing;
    }

    if (!this.running) {
      this.running = true;
      requestAnimationFrame (this._animate.bind (this));
    }
  } // update

  _animate() {
    const frameMs = 500;
    let needNextFrame = false;
    let ease = {};

    if (!this.map.XXXdragging) {
      if (this.anim.camera.rawTarget) {
        const raw = this.anim.camera.rawTarget;
        let smooth = this.anim.camera.smooth;

  const now = performance.now();
  const dtMs = now - (this.anim.prevTime ?? now);
  this.anim.prevTime = now;
        
        const dt = dtMs / 1000;
        function computeAlpha(rawPxDist) {
          const α_min = 0.1;
          const α_max = 0.4;   
          const D = 1000;

          if (rawPxDist <= 0) return 0;
          const ratio = Math.min(rawPxDist / D, 1);

          return α_min + (α_max - α_min) * (1 - ratio);
        }

        const startPx = this.map.project(this.anim.camera.smooth);
        const endPx   = this.map.project(raw);

        const dx = endPx.x - startPx.x;
        const dy = endPx.y - startPx.y;
        const rawPxDist = Math.sqrt(dx*dx + dy*dy);

        const alpha = computeAlpha(rawPxDist); 
        smooth = {
  lat: smooth.lat + (raw.lat - smooth.lat) * alpha,
          lon: smooth.lon + (raw.lon - smooth.lon) * alpha,
        };
        this.anim.camera.smooth = smooth;
        ease.center = smooth;
      }

    if (this.anim.bearing.end != null) {
      function shortestAngleDiff(target, current) {
        let d = target - current;
        d = (d + 540) % 360 - 180; 
        return d;
      }

      let current = this.map.getBearing();
      let diff = shortestAngleDiff (this.anim.bearing.end, current);

      const MAX_DEG_PER_SEC = 3;
const maxStep = MAX_DEG_PER_SEC * (frameMs / 1000);
      
let step;
      if (Math.abs(diff) <= maxStep) {
        step = diff;  
      } else {
        step = Math.sign(diff) * maxStep;
      }

      const newBearing = current + step;
      ease.bearing = newBearing;

      if (Math.abs(diff) > 0.01) {
        needNextFrame = true;
      } else {
        this.anim.bearing.end = null;
      }
    }

    } else {
      needNextFrame = true;
    }

    if (Object.keys (ease).length) this.map.easeTo ({
      ...ease,
      duration: frameMs,
      easing: t => t,
    });
    if (needNextFrame) {
      //requestAnimationFrame(this._animate.bind(this));
      setTimeout(this._animate.bind(this), frameMs);
    } else {
      this.running = false;
    }
  }
}


      let timeSetter;
      let timeSetterMain = () => {};

      let teamStatuses = {};
      function showIbukiEvent (url, opts) {
        let ma = document.querySelector ('map-area');
        let map = ma.pc_MLMap;
        if (!map) return false;
        let mani = new MapAnimator (map);

        if (!timeSetter) {
          ma.pcTimeSetters.push (timeSetter = _ => timeSetterMain (_));
        }
        
        url = url.replace (/^https?:\/\/(?:\w+\.|)ibuki.run\//, 'https://od.ibuki.run/');
        //not return
        Promise.all ([
          fetch (new URL ('info.json?with_routes=1', url)).then (res => {
            if (res.status !== 200) throw res;
            return res.json ();
          }).then (info => {
            let color = [
              'match',
              ['get', 'roadtype'],
              1, "rgba(79, 38, 114, 0.8)",
              2, "rgba(247, 147, 30, 0.8)",
              3, "rgba(237, 28, 36, 0.8)",
              9, "rgba(255, 255, 255, 0.8)",
              "#13b739", // --map-roadtype-0-color
            ];
            showRoutes (map, info.routes = parseEncodedRoutes (info.encoded_routes), {
              id: 'route',
              linePaint: {
                'line-color': color,
                //'line-opacity': 0.3,
                'line-width': [
                  'step',
                  ['zoom'],
                  3,
                  13, 5,
                  15, 7,
                ],
              },
              pointPaint: {
                'circle-radius': 9,
                'circle-color': color,
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 0,
              },
              pointMinZoom: 19,
            });
            showMarkedPoints (map, info.marked_points);
            return info;
          }),
          fetch (new URL ('teams.json', url)).then (res => {
            if (res.status !== 200) throw res;
            return res.json ();
          }),
          /*fetch (new URL ('teamlocations.json', url)).then (res => {
            if (res.status !== 200) throw res;
            return res.json ();
          }),*/
        ]).then (([info, teams/*, locs*/]) => {
          let teamData = {};
          teams.items.forEach (t => {
            t.dk = 'tt,,' + t.id;
            teamData[t.dk] = t;
          });

          /*
          showTeamLocations (map, Object.keys (locs.items).map (dk => {
            return {td: teamData[dk], point: locs.items[dk]};
          }), {
            id: 'teamlocations',
          });
          */

          let now = new Date () . valueOf () / 1000;
          //if (hist) {
          //  now = hist?.[0]?.points.at (-1).timestamp;
          //}
          if (info.end_date < now) now = info.end_date
          if (now < info.start_date) now = info.start_date;
          document.querySelectorAll ('input[name=event-time-range]').forEach (e => {
            e.min = info.start_date
            e.max = info.end_date;
            e.valueAsNumber = now;
            e.dispatchEvent (new Event ('input', {bubbles: true}));
            e.closest ('input-datetime').querySelector ('input[type=checkbox]').checked = true;
          });

          if (opts.new) {
            ma.pcScroll ({
              center: info.marked_points.at (-1) || undefined,
            });
          }
                              
          let baseRoute = info.routes.map (_ => _.points).flat ();
          let computed = {elapsed: {}};
          {
            let radius = 100;
            computeBase ([baseRoute], radius, computed);
          }
          
          teamStatuses = {};
          let loadTeam = async (url, td) => {
            if (td.dk === ',,route') {
              let ts = {dk: td.dk};
              ts.routes = [{points: computed.basePoints}];
              attachTimestamps (ts.routes[0].points, info.start_date);
              teamStatuses[td.dk] = ts;
            } else {
              return fetch (new URL ('t/' + td.id + '/locationhistory.json', url)).then (res => {
                if (res.status !== 200) throw res;
                return res.json ();
              }).then (json => {
                return parseEncodedRoutes (json.encoded_routes);
              }).then (hist => {
                teamStatuses[td.dk] = {dk: td.dk, routes: hist,
                                       showHistory: true};
              });
            }
          }; // loadTeam
          let tds = [];
          if (opts.routeOnly) {
            let td = teamData[',,route'] = {dk: ',,route'};
            tds.push (td);
          } else if (opts.teamId) {
            let td = teamData['tt,,' + opts.teamId];
            if (!td) throw new Error ("Bad team: " + opts.teamId);
            tds.push (td);
          } else {
            tds = Object.values (teamData);
          }
          {
            let first = true;
            let progress = document.querySelector ('progress');
            progress.hidden = false;
            progress.min = 0;
            progress.max = tds.length;
            progress.value = 0;
            Promise.all (tds.map ((td) => {
              return loadTeam (url, td).then (() => {
                if (first) {
                  trackedTeamDk = td.dk;
                  first = false;

                  timeSetterMain = (time) => {
                    if (!time) return;
                    showByTime (mani, map, info, teamData, teamStatuses, time, {});
                  };
                }

                let ts = teamStatuses[td.dk] || {};

                let forced = [];
              /*XXX
              info.marked_points.forEach (mp => {
                let tr = teamResultItems[mp.id];
                if (tr && tr.n) {
                  forced.push ({timestamp: tr.c, lat: mp.lat, lon: mp.lon,
                                baseOrigIndex: mp.index,
                                source: 'mp' + mp.type});
                }
              });
              (((teamResultItems[0] || {}).d || {}).m || []).forEach (_ => {
                forced.push ({timestamp: _.t, lat: 0, lon: 0, source: 'marker'});
              });
              */

                let cp = {...computed};
                let pointsList = [baseRoute, (ts.routes || []).map (_ => _.points).flat (), forced];
                computeData (pointsList, cp);
                ts.computed = cp;
                
                progress.value++;
                showByTime (mani, map, info, teamData, teamStatuses, null, {});
              });
            })).then (() => progress.hidden = true);
          }
        });

        return true;
      } // showIbukiEvent

      function showIbukiEventByURL (u, opts) {
        let m = u.match (/^(https?:\/\/[^\/]+\/ev\/[0-9]+\/)(?:t\/([0-9]+)\/|)(#route|)/);
        if (!m) throw new Error ("Bad URL: " + u);

        let r = showIbukiEvent (m[1], {...opts, teamId: m[2], routeOnly: m[3]});
        return r;
      } // showIbukiEventByURL
